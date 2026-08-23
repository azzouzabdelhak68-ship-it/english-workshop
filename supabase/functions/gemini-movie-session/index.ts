import { preflight, json } from '../_shared/cors.ts'
import { DEFAULT_GEMINI_MODEL } from '../_shared/gemini-models.ts'
import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2'

const TIMEOUT_MS = 45_000

interface Candidate {
  title: string
  year: number | null
  duration_minutes: number | null
  language: string
  audio_type?: 'english_original' | 'english_dub' | 'non_english'
  subtitles?: 'english' | 'none' | 'unknown'
  availability_url?: string | null
  availability_verified?: boolean
  imdb_rating?: number | null
  imdb_votes?: number | null
  review_summary?: string | null
  review_score?: number | null
  appropriateness?: 'safe' | 'caution' | 'unsuitable'
  educational_score?: number | null
  why_it_works?: string
}

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf
  if (req.method !== 'POST') return json({ ok: false, error_code: 'AI_UNAVAILABLE', message: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  if (userErr || !userData.user) return json({ ok: false, error_code: 'AI_UNAVAILABLE' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: prof } = await admin.from('profiles').select('role').eq('id', userData.user.id).single()
  if (!prof || !['host', 'organizer', 'admin'].includes(prof.role)) {
    return json({ ok: false, error_code: 'AI_UNAVAILABLE' }, 403)
  }

  let body: { user_message?: string; workshop_level?: string; chosen_movie?: string | null; prior_result?: unknown }
  try {
    body = await req.json()
  } catch {
    return typedError('INVALID_JSON')
  }
  const userMessage = (body.user_message ?? '').slice(0, 2000)
  const workshopLevel = body.workshop_level ?? 'Intermediate'

  console.log(JSON.stringify({ event: 'generation_started', level: workshopLevel, mode: 'web_search_grounding' }))

  // Load the rotatable key + selected model from Supabase Vault / ai_settings (service role only).
  const { data: settings } = await admin
    .from('ai_settings')
    .select('gemini_key_secret_id, gemini_model, configured')
    .eq('id', true)
    .single()

  if (!settings?.configured || !settings.gemini_key_secret_id) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'missing_key', configured: false }))
    return typedError('NO_API_KEY')
  }
  const geminiModel = settings.gemini_model ?? DEFAULT_GEMINI_MODEL
  const { data: secretRow, error: vaultErr } = await admin
    .schema('vault')
    .from('decrypted_secrets')
    .select('decrypted_secret')
    .eq('id', settings.gemini_key_secret_id)
    .single()

  if (vaultErr || !secretRow?.decrypted_secret) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'missing_key', configured: true }))
    return typedError('NO_API_KEY')
  }
  const geminiKey: string = secretRow.decrypted_secret

  // Single grounded Gemini call: the model searches the web itself (google_search
  // tool) and must only use facts from its own search results (see system prompt).
  const { systemPrompt } = await loadSystemPrompt()
  const filledPrompt = systemPrompt
    .replace('{{user_message}}', userMessage)
    .replace('{{workshop_level}}', workshopLevel)
    .replace('{{chosen_movie_or_null}}', body.chosen_movie ?? 'null')

  let raw: string
  try {
    raw = await callGemini(geminiKey, geminiModel, filledPrompt)
  } catch (e) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'gemini_error', detail: String(e).slice(0, 120), configured: true }))
    return typedError('AI_UNAVAILABLE')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(raw))
  } catch {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'malformed_json', configured: true }))
    return typedError('INVALID_JSON')
  }

  if (!validateResult(parsed)) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'schema_invalid', configured: true }))
    return typedError('INVALID_JSON')
  }

  const result = parsed as { session: { film: string; duration_minutes: number } }

  // Defense-in-depth: the raw key must never appear in any response body.
  const payload = JSON.stringify({ ok: true, result: parsed })
  if (payload.includes(geminiKey)) {
    console.error(JSON.stringify({ event: 'generation_failed', code: 'secret_leak_blocked' }))
    return typedError('AI_UNAVAILABLE')
  }

  console.log(JSON.stringify({
    event: 'session_generated',
    film: result.session.film,
    total_minutes: result.session.duration_minutes,
    configured: true
  }))

  return new Response(payload, { headers: { 'Content-Type': 'application/json' } })
})

function typedError(code: 'NO_API_KEY' | 'AI_UNAVAILABLE' | 'NO_CANDIDATE' | 'INVALID_JSON'): Response {
  return json({ ok: false, error_code: code }, 200)
}

async function loadSystemPrompt(): Promise<{ systemPrompt: string }> {
  const url = new URL(import.meta.url)
  url.pathname = url.pathname.replace(/index\.ts$/, 'system-prompt.txt')
  const res = await fetch(url)
  return { systemPrompt: await res.text() }
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no json object')
  return candidate.slice(start, end + 1)
}

// ---- validation -----------------------------------------------------------

function validateResult(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false
  const r = parsed as Record<string, unknown>
  const session = r.session as Record<string, unknown> | undefined
  const activities = r.activities as unknown[] | undefined
  if (!session) return false
  if (typeof session.title !== 'string' || typeof session.film !== 'string') return false
  if (typeof session.duration_minutes !== 'number') return false
  if (!Array.isArray(activities) || activities.length !== 4) return false
  return activities.every((a) => {
    const act = a as Record<string, unknown>
    return (
      typeof act.title === 'string' &&
      typeof act.goal === 'string' &&
      typeof act.timing_min === 'number' &&
      typeof act.grouping === 'string' &&
      typeof act.prompt === 'string' &&
      typeof act.expected_output === 'string' &&
      Array.isArray(act.skill_focus) &&
      (act.skill_focus as unknown[]).includes('communication')
    )
  })
}

async function callGemini(key: string, model: string, prompt: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.6 }
        })
      }
    )
    if (res.status === 429 || res.status >= 500) throw new Error(`gemini ${res.status}`)
    if (!res.ok) throw new Error(`gemini ${res.status}`)
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text)
      .filter((t: unknown): t is string => typeof t === 'string')
      .join('')
    if (!text) throw new Error('empty completion')
    return text
  } finally {
    clearTimeout(timeout)
  }
}

import { preflight, json } from '../_shared/cors.ts'
import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const YOUTUBE_KEY = Deno.env.get('YOUTUBE_API_KEY')
const OMDB_KEY = Deno.env.get('OMDB_API_KEY')
const TIMEOUT_MS = 22_000
const MAX_RUNTIME_MIN = 15

interface Candidate {
  title: string
  year: number | null
  duration_minutes: number | null
  language: string
  audio_type: 'english_original' | 'english_dub' | 'non_english'
  subtitles: 'english' | 'none' | 'unknown'
  availability_url: string | null
  availability_verified: boolean
  imdb_rating: number | null
  imdb_votes: number | null
  review_summary: string | null
  review_score: number | null
  appropriateness: 'safe' | 'caution' | 'unsuitable'
  educational_score: number | null
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

  console.log(JSON.stringify({ event: 'generation_started', level: workshopLevel }))

  if (!YOUTUBE_KEY) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'search_failure', configured: false }))
    return typedError('NO_CANDIDATE')
  }

  // Phase A — deterministic discovery & verification (no AI)
  let candidates: Candidate[] = []
  try {
    candidates = await discoverAndVerify(userMessage, body.chosen_movie ?? null)
  } catch (e) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'search_failure', detail: String(e).slice(0, 120) }))
    return typedError('NO_CANDIDATE')
  }

  console.log(JSON.stringify({
    event: 'verification_completed',
    verified: candidates.filter((c) => c.availability_verified).length,
    total: candidates.length
  }))

  if (candidates.length === 0) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'no_candidate_passed' }))
    return typedError('NO_CANDIDATE')
  }

  // Load the rotatable key from Supabase Vault (service role only).
  const { data: settings } = await admin
    .from('ai_settings')
    .select('gemini_key_secret_id, configured')
    .eq('id', true)
    .single()

  if (!settings?.configured || !settings.gemini_key_secret_id) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'missing_key', configured: false }))
    return typedError('NO_API_KEY')
  }
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

  // Phase B — single one-shot Gemini call over the verified payload.
  const { systemPrompt } = await loadSystemPrompt()
  const filledPrompt = systemPrompt
    .replace('{{user_message}}', userMessage)
    .replace('{{workshop_level}}', workshopLevel)
    .replace('{{chosen_movie_or_null}}', body.chosen_movie ?? 'null')
    .replace('{{hybrid_verification_json}}', JSON.stringify(candidates))

  let raw: string
  try {
    raw = await callGemini(geminiKey, filledPrompt)
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

// ---- Phase A tools -------------------------------------------------------

async function discoverAndVerify(userMessage: string, previousFilm: string | null): Promise<Candidate[]> {
  const query = deriveQuery(userMessage, previousFilm)
  console.log(JSON.stringify({ event: 'search_started', query }))

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=medium&maxResults=6&safeSearch=strict&q=${encodeURIComponent(query)}&key=${YOUTUBE_KEY}`
  )
  if (!searchRes.ok) throw new Error(`youtube search ${searchRes.status}`)
  const searchJson = await searchRes.json()
  const videoIds: string[] = ((searchJson.items ?? []) as Array<{ id: { videoId?: string } }>)
    .map((it) => it.id.videoId)
    .filter((v): v is string => !!v)

  console.log(JSON.stringify({ event: 'search_completed', candidates_found: videoIds.length }))

  const verified: Candidate[] = []
  for (const id of videoIds.slice(0, 5)) {
    const cand = await verifyCandidate(id, query)
    if (cand) verified.push(cand)
  }

  // Hard gates: runtime < 15 min, availability verified, not unsuitable.
  return verified.filter(
    (c) => c.duration_minutes !== null && c.duration_minutes < MAX_RUNTIME_MIN && c.availability_verified && c.appropriateness !== 'unsuitable'
  )
}

function deriveQuery(userMessage: string, previousFilm: string | null): string {
  const wantsNew = /next session|another|alternative|different/i.test(userMessage)
  const base = userMessage.replace(/suggest me next session|suggest short movie|find alternative movie/gi, '').trim()
  const topic = base.length > 3 ? `${base} short film` : wantsNew ? 'award winning short film english' : `${previousFilm ?? ''} short film`.trim()
  return topic.length > 0 ? topic : 'short film english subtitles'
}

async function verifyCandidate(videoId: string, queryFallbackTitle: string): Promise<Candidate | null> {
  const detailsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoId}&key=${YOUTUBE_KEY}`
  )
  if (!detailsRes.ok) return null
  const details = await detailsRes.json()
  const item = (details.items ?? [])[0]
  if (!item) return null

  const snippet = item.snippet as {
    title: string
    description: string
    defaultAudioLanguage?: string
    tags?: string[]
  }
  const contentDetails = item.contentDetails as { duration: string }
  const status = item.status as { privacyStatus: string; embeddable: boolean }

  const minutes = iso8601ToMinutes(contentDetails.duration)

  // Availability: public/embeddable video whose page IS the watch page.
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const availability_verified =
    status.privacyStatus === 'public' &&
    status.embeddable &&
    (minutes ?? 999) > 1 &&
    !/trailer|teaser/i.test(snippet.title)

  const audioLang = snippet.defaultAudioLanguage ?? 'unknown'
  const audio_type: Candidate['audio_type'] = /^en/i.test(audioLang) ? 'english_original' : 'non_english'
  const descLower = snippet.description.toLowerCase()
  const subtitles: Candidate['subtitles'] = /english (subtitles|cc)|cc english|\[english\]/.test(descLower)
    ? 'english'
    : /no subtitles|without subtitles/.test(descLower)
      ? 'none'
      : 'unknown'

  // Enrichment via OMDb — never invented; year cross-checked against fuzzy titles.
  const omdb = await omdbLookup(snippet.title)

  const suitabilityFlags = /(nsfw|explicit|gore|porn)/i.test(`${snippet.title} ${snippet.description}`) ? 'caution' : 'safe'

  return {
    title: snippet.title,
    year: omdb?.year ?? null,
    duration_minutes: minutes,
    language: /^en/i.test(audioLang) ? 'English' : audioLang,
    audio_type,
    subtitles,
    availability_url: watchUrl,
    availability_verified,
    imdb_rating: omdb?.imdb_rating ?? null,
    imdb_votes: omdb?.imdb_votes ?? null,
    review_summary: omdb?.plot ?? null,
    review_score: null,
    appropriateness: suitabilityFlags,
    educational_score: null,
    why_it_works: `Found for "${queryFallbackTitle}".`
  }
}

function iso8601ToMinutes(iso: string): number | null {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return null
  const h = Number(m[1] ?? 0)
  const min = Number(m[2] ?? 0)
  const s = Number(m[3] ?? 0)
  return Math.round((h * 3600 + min * 60 + s) / 60)
}

interface OmdbData {
  year: number | null
  imdb_rating: number | null
  imdb_votes: number | null
  plot: string | null
}

async function omdbLookup(title: string): Promise<OmdbData | null> {
  if (!OMDB_KEY) return null
  const cleanTitle = title.replace(/\s*[|#].*$/, '').trim().slice(0, 80)
  const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&t=${encodeURIComponent(cleanTitle)}&type=short`)
  if (!res.ok) return null
  const data = await res.json() as { Response?: string; Year?: string; imdbRating?: string; imdbVotes?: string; Plot?: string; Title?: string }
  // Fuzzy-title guard: accept only a clearly related match, else treat as unavailable.
  if (data.Response !== 'True') return null
  const tNorm = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
  const rNorm = (data.Title ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!rNorm.includes(tNorm.slice(0, Math.max(8, Math.floor(tNorm.length * 0.7)))) ) {
    if (!tNorm.includes(rNorm.slice(0, 8))) return null
  }
  return {
    year: data.Year ? parseInt(data.Year.slice(0, 4), 10) || null : null,
    imdb_rating: data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
    imdb_votes: data.imdbVotes && data.imdbVotes !== 'N/A' ? parseInt(data.imdbVotes.replace(/,/g, ''), 10) : null,
    plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : null
  }
}

// ---- Phase B validation ---------------------------------------------------

function validateResult(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false
  const r = parsed as Record<string, unknown>
  const session = r.session as Record<string, unknown> | undefined
  const activities = r.activities as unknown[] | undefined
  if (!session || typeof session.title !== 'string' || typeof session.film !== 'string') return false
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

async function callGemini(key: string, prompt: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, responseMimeType: 'application/json' }
        })
      }
    )
    if (res.status === 429 || res.status >= 500) throw new Error(`gemini ${res.status}`)
    if (!res.ok) throw new Error(`gemini ${res.status}`)
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') throw new Error('empty completion')
    return text
  } finally {
    clearTimeout(timeout)
  }
}

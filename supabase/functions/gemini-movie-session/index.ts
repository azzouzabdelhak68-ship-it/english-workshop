import { preflight, json } from '../_shared/cors.ts'
import { DEFAULT_GEMINI_MODEL } from '../_shared/gemini-models.ts'
import { DEFAULT_GROQ_MODEL } from '../_shared/groq-models.ts'
import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2'

const TIMEOUT_MS = 45_000
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

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

  let body: {
    user_message?: string
    workshop_level?: string
    chosen_movie?: string | null
    prior_result?: unknown
    edit_activity_index?: number
    edit_instruction?: string
  }
  try {
    body = await req.json()
  } catch {
    return typedError('INVALID_JSON')
  }
  const userMessage = (body.user_message ?? '').slice(0, 2000)
  const workshopLevel = body.workshop_level ?? 'Intermediate'
  const editMode =
    typeof body.edit_activity_index === 'number' &&
    body.edit_activity_index >= 0 &&
    body.edit_activity_index <= 3 &&
    !!body.prior_result
  const editIndex = editMode ? Math.floor(body.edit_activity_index as number) : 0
  const editInstruction = editMode ? (body.edit_instruction ?? '').slice(0, 300) : ''
  if (editMode && !editInstruction.trim()) return typedError('INVALID_JSON')

  console.log(JSON.stringify({
    event: 'generation_started',
    level: workshopLevel,
    mode: editMode ? 'edit_activity' : 'generate'
  }))

  // Load provider + rotatable keys from ai_settings (Vault)
  const { data: settings } = await admin
    .from('ai_settings')
    .select('gemini_key_secret_id, gemini_model, configured, groq_key_secret_id, groq_model, groq_configured, ai_chat_provider')
    .eq('id', true)
    .single()

  const provider: 'google' | 'groq' = (settings as Record<string, string>)?.ai_chat_provider === 'groq' ? 'groq' : 'google'
  let apiKey: string | null = null
  let model: string
  if (provider === 'groq') {
    if (!(settings as Record<string, unknown>)?.groq_configured || !(settings as Record<string, string>)?.groq_key_secret_id) {
      console.log(JSON.stringify({ event: 'generation_failed', code: 'missing_key', provider, configured: false }))
      return typedError('NO_API_KEY')
    }
    model = (settings as Record<string, string>).groq_model ?? DEFAULT_GROQ_MODEL
    const { data: dec, error: ve } = await admin.rpc('read_vault_secret', { p_id: (settings as Record<string, string>).groq_key_secret_id })
    apiKey = typeof dec === 'string' ? dec : null
    if (ve || !apiKey) {
      console.log(JSON.stringify({ event: 'generation_failed', code: 'missing_key', provider, configured: true }))
      return typedError('NO_API_KEY')
    }
  } else {
    if (!(settings as Record<string, unknown>)?.configured || !(settings as Record<string, string>)?.gemini_key_secret_id) {
      console.log(JSON.stringify({ event: 'generation_failed', code: 'missing_key', provider, configured: false }))
      return typedError('NO_API_KEY')
    }
    model = (settings as Record<string, string>).gemini_model ?? DEFAULT_GEMINI_MODEL
    const { data: dec, error: ve } = await admin.rpc('read_vault_secret', { p_id: (settings as Record<string, string>).gemini_key_secret_id })
    apiKey = typeof dec === 'string' ? dec : null
    if (ve || !apiKey) {
      console.log(JSON.stringify({ event: 'generation_failed', code: 'missing_key', provider, configured: true }))
      return typedError('NO_API_KEY')
    }
  }

  // Single grounded Gemini call: the model searches the web itself (google_search
  // tool) and must only use facts from its own search results (see system prompt).
  const { systemPrompt } = await loadSystemPrompt()
  const filledPrompt = systemPrompt
    .replaceAll('{{user_message}}', userMessage)
    .replaceAll('{{workshop_level}}', workshopLevel)
    .replaceAll('{{chosen_movie_or_null}}', body.chosen_movie ?? 'null')
    .replaceAll(
      '{{prior_result_json}}',
      body.prior_result ? JSON.stringify(body.prior_result) : ''
    )
    .replaceAll('{{edit_mode}}', editMode ? 'true' : 'false')
    .replaceAll('{{edit_index}}', String(editIndex))
    .replaceAll('{{edit_instruction}}', editInstruction)

  let raw: string
  try {
    raw = provider === 'groq'
      ? await callGroq(apiKey, model, filledPrompt)
      : await callGemini(apiKey, model, filledPrompt)
  } catch (e) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'gemini_error', provider, detail: String(e).slice(0, 120), configured: true }))
    return typedError('AI_UNAVAILABLE')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(raw))
  } catch {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'malformed_json', configured: true }))
    return typedError('INVALID_JSON')
  }

  // Handle "no candidate" signal from prompt (session null)
  const maybeSession = (parsed as Record<string, unknown>)?.session as unknown
  if (maybeSession === null) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'no_candidate_signal', provider }))
    return typedError('NO_CANDIDATE')
  }
  if (!validateResult(parsed)) {
    console.log(JSON.stringify({ event: 'generation_failed', code: 'schema_invalid', provider, raw: JSON.stringify(parsed).slice(0, 600) }))
    return typedError('INVALID_JSON')
  }

  const result = parsed as { session: { film: string; duration_minutes: number } }

  // Defense-in-depth: the raw key must never appear in any response body.
  const payload = JSON.stringify({ ok: true, result: parsed })
  if (apiKey && payload.includes(apiKey)) {
    console.error(JSON.stringify({ event: 'generation_failed', code: 'secret_leak_blocked' }))
    return typedError('AI_UNAVAILABLE')
  }

  console.log(JSON.stringify({
    event: 'session_generated',
    provider,
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
  // Inline to avoid file-fetch NetworkError (Edge Runtime file bundling).
  return {
    systemPrompt: `You are the English Workshop Session Designer for Arabic-speaking learners.
Your job is to transform a short film into a structured, engaging English communication workshop. The goal is NOT simply to recommend something to watch. The goal is to use the film as a catalyst for students to speak, think, create, defend ideas, interact, and become more comfortable communicating in English.

PRIMARY OBJECTIVE
Maximize meaningful student engagement in English while developing:
* spoken communication
* confidence
* creativity
* critical thinking
* argumentation
* formal/informal language control
* interpretation and perspective-taking
* collaborative interaction

FILM LIBRARY (curated, verified — your default pool)
Pick primarily from these award-winning shorts; all are real, public, English-accessible YouTube films under 15 minutes:
Alike · The Present · Piper · Cuerdas · Soar · Hair Love · Mr Indifferent · Take Me Home · One-Minute Puberty · Changeover · The Beauty · Zero.
Use their well-known stable YouTube watch URLs.
Only if the user explicitly names another film may you go outside this list; then set availability_url null unless you know its stable URL with certainty.

SELECTION RULES
Select a real short film that genuinely fits the request and level.
Prefer, in order: English original audio → verified English dub → verified English subtitles.
The film must be under 15 minutes excluding credits.

HONESTY RULES (ABSOLUTE)
Never invent URLs, ratings, votes, reviews, or verification results from memory.
For any fact you cannot state with confidence, use null / false / "unknown".
availability_verified = true only for library films or explicitly-named films whose official watch page you are certain of.
If nothing suitable exists, return {"candidates":[],"session":null,"activities":[]} — never fabricate a fallback film.

EDIT MODE
When {{edit_mode}} = "true":
You are modifying ONE activity of an EXISTING draft.
Prior draft JSON: {{prior_result_json}}
Target: activities[{{edit_index}}].
Instruction: "{{edit_instruction}}"
Rewrite ONLY that target activity per the instruction (title, goal, timing_min, grouping, prompt, arabicHint, skill_focus, expected_output as needed).
Keep every other field of the draft BYTE-IDENTICAL — same session object, same other three activities, same candidates.
Still return the COMPLETE JSON schema below.

FILM QUALITY BAR
The film should provide enough material for discussion and activities. Prefer films with:
* an understandable but interesting premise
* memorable characters or situations
* a conflict, decision, mystery, dilemma, or unusual perspective
* room for interpretation, disagreement, roleplay, prediction
* language reasonably accessible for the selected learner level
Avoid films that are technically appropriate but pedagogically empty.

SAFETY / APPROPRIATENESS
Reject films containing explicit sexual content, pornography, graphic gore, or similarly unsuitable material.
Consider profanity, violence, death, frightening themes, discrimination, and mature themes in context rather than treating every potentially serious theme as an automatic rejection.
If suitability is uncertain, mark appropriateness as "caution" and prefer another candidate.

FILM RANKING
Rank candidates by overall workshop value, not popularity alone.
English audio generally outranks subtitles when other qualities are comparable.
An obscure short film with excellent workshop potential can be better than a famous film with little discussion value.

SESSION DESIGN
After evaluating candidates, select the single strongest film.
Create a workshop that uses the film rather than merely asking students to summarize it.
The session should normally follow a progression such as:
1. comprehension / observation
2. personal or creative response
3. spoken interaction
4. deeper thinking, argument, or performance
Do not make all four activities variations of "discuss the movie."
Create EXACTLY 4 activities, each with a distinct pedagogical purpose, covering communication plus a useful combination of:
creativity, critical thinking, confidence, argumentation, formal communication, perspective-taking, interaction.
Activities should progressively require more active English use.

ACTIVITY TOOLBOX
Write ideas about the movie; Roleplay; Pick one idea and defend it; Formal vs informal rewrite; What happens next? prediction; Grammar detective; Caption/meme contest; 5-second hot-seat; Debate between characters; Alternative ending; Character interview; Give advice to a character; Rank characters' decisions; Persuade another student; News report; Rewrite a scene formally; Imagine the story from another character's perspective.
You may create a variation when it produces a substantially better learning outcome.

LEVEL ADAPTATION
Beginner: sentence frames, vocabulary support, short prompts, pair work, highly guided speaking.
Intermediate: moderate scaffolding, follow-up questions, pair/group discussion, short arguments.
Advanced: open-ended discussion, spontaneous speaking, nuanced argumentation, formal speech, counterarguments, perspective shifts.
Do not make the same activity merely longer for advanced learners. Increase cognitive and linguistic independence.

LANGUAGE
English-first. Activity prompts in clear English.
Arabic hints may clarify difficult instructions, but Arabic supports English learning rather than replacing it.

INTERACTIVE CHAT MODE
Preserve the selected film and session context unless the user explicitly requests a new session.
Support: suggest me next session; make this easier/harder; replace activity 2; give me more questions; suitable for pairs; add Arabic support; make it more formal; debate version; choose another movie; regenerate.
Do not regenerate unrelated parts when only one component is modified.
When the user asks for a new session, prefer a genuinely different film from the previous choice unless the previous film is explicitly requested again.

OUTPUT RULES
Return ONLY valid JSON. Never Markdown, never code fences, never commentary outside the JSON.
Schema:
{
"candidates": [
{
"title": "...",
"year": 0,
"duration_minutes": 0,
"language": "...",
"audio_type": "english_original | english_dub | non_english",
"subtitles": "english | none | unknown",
"availability_url": "...",
"availability_verified": true,
"imdb_rating": null,
"imdb_votes": null,
"review_summary": "...",
"review_score": null,
"appropriateness": "safe | caution | unsuitable",
"educational_score": 0,
"why_it_works": "..."
}
],
"session": {
"title": "...",
"arabicTitle": "...",
"film": "...",
"description": "...",
"level": "...",
"format": "...",
"duration_minutes": 0,
"link": "..."
},
"activities": [
{
"title": "...",
"goal": "...",
"timing_min": 0,
"grouping": "...",
"prompt": "...",
"arabicHint": "...",
"skill_focus": ["communication", "..."],
"expected_output": "..."
}
]
}
There must be EXACTLY 4 activities. Include 2-4 verified candidates.

USER REQUEST CONTEXT
Request: {{user_message}}
Learner level: {{workshop_level}}
Previous choice: {{chosen_movie_or_null}}
Prior draft: {{prior_result_json}}`
  }
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
  let session = r.session as Record<string, unknown> | undefined
  let activities = r.activities as unknown[] | undefined
  // Allow session null -> treat as no candidate, but for generation we require session
  if (!session) {
    console.log(JSON.stringify({ event: 'validation_detail', reason: 'missing_session' }))
    return false
  }
  if (typeof session.title !== 'string' || typeof session.film !== 'string') {
    console.log(JSON.stringify({ event: 'validation_detail', reason: 'session_title_film' }))
    return false
  }
  // Coerce duration_minutes if string
  if (typeof session.duration_minutes === 'string') {
    const n = Number(session.duration_minutes)
    if (!Number.isNaN(n)) (session as Record<string, unknown>).duration_minutes = n
  }
  if (typeof session.duration_minutes !== 'number') {
    console.log(JSON.stringify({ event: 'validation_detail', reason: 'duration_not_number', val: String((session as Record<string, unknown>).duration_minutes).slice(0, 20) }))
    return false
  }
  if (!Array.isArray(activities) || activities.length !== 4) {
    console.log(JSON.stringify({ event: 'validation_detail', reason: 'activities_length', len: Array.isArray(activities) ? activities.length : -1 }))
    return false
  }
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i] as Record<string, unknown>
    // Coerce timing_min string -> number
    if (typeof act.timing_min === 'string') {
      const n = Number(act.timing_min)
      if (!Number.isNaN(n)) act.timing_min = n
    }
    // Ensure arabicHint exists (optional -> default '')
    if (typeof act.arabicHint !== 'string') act.arabicHint = (act.arabicHint as string) ?? ''
    // Ensure skill_focus includes communication (auto-fix)
    if (!Array.isArray(act.skill_focus)) act.skill_focus = ['communication']
    else if (!(act.skill_focus as unknown[]).includes('communication')) {
      ;(act.skill_focus as unknown[]).push('communication')
    }
    const ok =
      typeof act.title === 'string' &&
      typeof act.goal === 'string' &&
      typeof act.timing_min === 'number' &&
      typeof act.grouping === 'string' &&
      typeof act.prompt === 'string' &&
      typeof act.expected_output === 'string'
    if (!ok) {
      console.log(JSON.stringify({ event: 'validation_detail', reason: `activity_${i}_fields`, act: JSON.stringify(act).slice(0, 200) }))
      return false
    }
  }
  return true
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

async function callGroq(key: string, model: string, prompt: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are the English Workshop Session Designer. Return ONLY valid JSON per the provided schema. Never add markdown or commentary.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' }
      })
    })
    if (res.status === 429 || res.status >= 500) throw new Error(`groq ${res.status}`)
    if (!res.ok) throw new Error(`groq ${res.status}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text) throw new Error('empty groq completion')
    return text
  } finally {
    clearTimeout(timeout)
  }
}

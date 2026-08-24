import { preflight, json } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DEFAULT_GROQ_MODEL } from '../_shared/groq-models.ts'

const ENV_GROQ_KEY = Deno.env.get('GROQ_API_KEY')
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

interface Question {
  prompt: string
  hint_ar?: string
  options: string[]
  answer_index: number
}

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // Resolve Groq key: Vault first, then env fallback
  let groqKey: string | null = null
  let groqModel: string = DEFAULT_GROQ_MODEL
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: settings } = await admin.from('ai_settings').select('groq_key_secret_id, groq_configured, groq_model').eq('id', true).single()
    if (settings && (settings as Record<string, unknown>).groq_configured && (settings as Record<string, string>).groq_key_secret_id) {
      const { data: decrypted } = await admin.rpc('read_vault_secret', { p_id: (settings as Record<string, string>).groq_key_secret_id })
      if (typeof decrypted === 'string' && decrypted.length > 20) groqKey = decrypted
      if (typeof (settings as Record<string, string>).groq_model === 'string' && (settings as Record<string, string>).groq_model) {
        groqModel = (settings as Record<string, string>).groq_model
      }
    }
  } catch (_) {
    // fall through to env
  }
  if (!groqKey) groqKey = ENV_GROQ_KEY ?? null
  if (!groqKey) return json({ error: 'groq_not_configured' }, 500)

  let body: { mode?: string; game_type?: string; difficulty?: string; text?: string; title?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  try {
    if (body.mode === 'weekly-quiz') {
      const questions = await askForQuestions(groqKey, groqModel, quizPrompt(), 5)
      return json({ title: '🤖 AI Weekly Quiz Ready for Review', questions })
    }
    if (body.mode === 'game-questions') {
      const n = 5
      const questions = await askForQuestions(groqKey, groqModel, gamePrompt(body.game_type ?? 'hot-seat', body.difficulty ?? 'Intermediate'), n)
      return json({ questions })
    }
    if (body.mode === 'essay-feedback') {
      const feedback = await feedbackPrompt(groqKey, groqModel, body.text ?? '', body.title ?? '')
      return json({ feedback })
    }
    return json({ error: 'unknown_mode' }, 400)
  } catch (e) {
    console.error(JSON.stringify({ event: 'groq_generation_failed', message: String(e) }))
    return json({ error: 'generation_failed' }, 502)
  }
})

async function chat(key: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  })
  if (!res.ok) throw new Error(`groq ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

function parseQuestions(raw: string): Question[] {
  const parsed = JSON.parse(raw) as { questions?: Question[] } | Question[]
  const qs = Array.isArray(parsed) ? parsed : (parsed.questions ?? [])
  return qs.filter((q) => q && typeof q.prompt === 'string' && Array.isArray(q.options)).map((q) => ({
    prompt: q.prompt,
    hint_ar: typeof q.hint_ar === 'string' ? q.hint_ar : undefined,
    options: q.options.slice(0, 4),
    answer_index: Number.isInteger(q.answer_index) ? q.answer_index : 0
  }))
}

async function askForQuestions(key: string, model: string, prompt: string, n: number): Promise<Question[]> {
  const raw = await chat(
    key,
    model,
    'You generate English practice quiz content for Arabic-speaking learners. Return ONLY valid JSON: {"questions":[{"prompt","hint_ar","options":[...],"answer_index"}]}. Arabic hints clarify instructions but the quiz is English-first.',
    `${prompt} Produce exactly ${n} questions.`
  )
  return parseQuestions(raw)
}

function quizPrompt(): string {
  return 'Create a weekly English review quiz (grammar, vocabulary, idioms) for mixed-level adult learners.'
}

function gamePrompt(type: string, difficulty: string): string {
  const specs: Record<string, string> = {
    'hot-seat': 'rapid-fire multiple choice with one clearly correct option',
    'word-order-race': 'sentence building; give a shuffled word list as "prompt" using " / " separators and the correct sentence in "hint_ar" field replaced by english answer inside options[0]; set answer_index 0',
    'vocab-chain': 'vocabulary synonyms/opposites multiple choice',
    'idioms-trivia': 'English idiom/slang meaning multiple choice',
    'grammar-detective': 'give an incorrect sentence in prompt; put the corrected sentence as options[0]; answer_index 0',
    'meme-caption': 'funny image-description prompts for caption writing; options may be empty'
  }
  return `Generate ${specs[type] ?? specs['hot-seat']} at ${difficulty} level.`
}

async function feedbackPrompt(key: string, model: string, text: string, title: string): Promise<string> {
  return await chat(
    key,
    model,
    'You are an encouraging English writing coach for Arabic-speaking learners. Reply in plain text (no JSON), max 120 words: two strengths + one concrete improvement.',
    `Assignment: ${title}\n\nStudent writing:\n${text}`
  )
}

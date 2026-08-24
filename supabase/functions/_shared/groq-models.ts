// Allowed Groq models (mirrors DB default). Keep in sync with any CHECK constraint.
export const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant'

export const ALLOWED_GROQ_MODELS = [
  DEFAULT_GROQ_MODEL,
  'llama-3.3-70b-versatile',
  'llama-3.3-70b-specdec',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'llama3-8b-8192',
  'llama3-70b-8192'
] as const

export function isAllowedGroqModel(model: unknown): model is string {
  return typeof model === 'string' && (ALLOWED_GROQ_MODELS as readonly string[]).includes(model)
}

// Shared allow-list of Gemini models staff may switch between (F7 settings card).
// Mirrors the DB CHECK constraint `ai_settings_gemini_model_check` — keep in sync.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'

export const ALLOWED_GEMINI_MODELS = [
  DEFAULT_GEMINI_MODEL,
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  'gemini-2.5-pro',
  'gemini-2.5-flash'
] as const

export function isAllowedGeminiModel(model: unknown): model is string {
  return typeof model === 'string' && (ALLOWED_GEMINI_MODELS as readonly string[]).includes(model)
}

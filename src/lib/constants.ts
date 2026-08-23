export const POINTS_CORRECT_ANSWER = 100
export const POINTS_CHECKIN = 20
export const POINTS_STREAK_FREEZE_COST = 25
// [OPEN DECISION] PRD specifies no points for peer review / session ratings.
// Defaults to 0 behind named constants — flip here when decided, nowhere else.
export const POINTS_PEER_REVIEW = 0
export const POINTS_SESSION_RATING = 0

export const AVATAR_PRESETS = ['👨‍🎓', '👩‍🎓', '🧑‍💻', '👩‍🎨', '🦁', '🦊', '🐼', '🐯', '🚀', '⭐'] as const

export const ANNOUNCEMENT_CATEGORIES = ['General', 'Event', 'Homework', 'Game Night'] as const
export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
export const SESSION_FORMATS = ['In-Person', 'Virtual', 'Hybrid'] as const
export const RESOURCE_CATEGORIES = ['Grammar', 'Vocabulary', 'Idioms', 'Listening', 'Worksheets'] as const
export const FILE_TYPES = ['PDF', 'Audio', 'Note', 'Glossary'] as const
export const GAME_TYPES = [
  'hot-seat',
  'word-order-race',
  'vocab-chain',
  'idioms-trivia',
  'meme-caption',
  'grammar-detective'
] as const

export const CATEGORY_COLORS: Record<string, string> = {
  General: 'bg-petrol-100 text-petrol-800 dark:bg-petrol-800 dark:text-petrol-100',
  Event: 'bg-brass-100 text-brass-800 dark:bg-brass-900 dark:text-brass-200',
  Homework: 'bg-mist-200 text-mist-800 dark:bg-mist-800 dark:text-mist-100',
  'Game Night': 'bg-petrol-600 text-white dark:bg-petrol-500 dark:text-white'
}

export const STAFF_ROLES = ['host', 'organizer', 'admin']

// Gemini models staff may pick in AI Chat Room settings (F7).
// Mirrors supabase/functions/_shared/gemini-models.ts and the DB CHECK constraint.
export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
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

// Focus presets (AI_ROOM_PLAN.md F-E): id → i18n labelKey + promptPrefix.
export const GEMINI_FOCUS_PRESETS = [
  { id: 'speaking', labelKey: 'focusSpeaking', promptPrefix: 'Prioritize maximum student talking time and spoken interaction in every activity.' },
  { id: 'grammar', labelKey: 'focusGrammar', promptPrefix: 'Weave one clear target grammar point (detection then reuse) across all four activities.' },
  { id: 'vocab', labelKey: 'focusVocab', promptPrefix: 'Extract key vocabulary from the film and recycle it deliberately through all four activities.' },
  { id: 'debate', labelKey: 'focusDebate', promptPrefix: 'Bias the activities toward argumentation, rebuttal and structured disagreement.' },
  { id: 'culture', labelKey: 'focusCulture', promptPrefix: 'Connect the film to Arab-world cultural comparison where natural.' },
  { id: 'exam', labelKey: 'focusExam', promptPrefix: 'Align activity outputs with exam-style speaking and writing tasks.' }
] as const

export type FocusPresetId = (typeof GEMINI_FOCUS_PRESETS)[number]['id']

export function isStaffRole(role?: string | null): boolean {
  return !!role && STAFF_ROLES.includes(role)
}

export function placementTestAnswerCorrect(answer: string): boolean {
  return answer === 'had finished'
}

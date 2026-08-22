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

export function isStaffRole(role?: string | null): boolean {
  return !!role && STAFF_ROLES.includes(role)
}

export function placementTestAnswerCorrect(answer: string): boolean {
  return answer === 'had finished'
}

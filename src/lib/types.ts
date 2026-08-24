export type Role = 'student' | 'host' | 'organizer' | 'admin'
export type Level = 'Beginner' | 'Intermediate' | 'Advanced'
export type SessionFormat = 'In-Person' | 'Virtual' | 'Hybrid'
export type AnnouncementCategory = 'General' | 'Event' | 'Homework' | 'Game Night'
export type ResourceCategory = 'Grammar' | 'Vocabulary' | 'Idioms' | 'Listening' | 'Worksheets'
export type FileType = 'PDF' | 'Audio' | 'Note' | 'Glossary'
export type GameType =
  | 'hot-seat'
  | 'word-order-race'
  | 'vocab-chain'
  | 'idioms-trivia'
  | 'meme-caption'
  | 'grammar-detective'

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  nickname: string | null
  avatar: string
  level: Level
  role: Role
  points: number
  streak: number
  streak_freezes: number
  badges: string[]
  learning_goals: string | null
  onboarded: boolean
}

export interface Session {
  id: string
  title: string
  arabic_title: string | null
  description: string | null
  level: Level
  format: SessionFormat
  location: string | null
  meeting_link: string | null
  starts_at: string
  duration_minutes: number
  ended_at: string | null
  created_by: string | null
}

export interface Rsvp {
  session_id: string
  user_id: string
}

export interface Checkin {
  id: string
  session_id: string
  user_id: string
  checked_in_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  category: AnnouncementCategory
  pinned: boolean
  author_id: string | null
  created_at: string
}

export interface HomeworkAssignment {
  id: string
  title: string
  description: string | null
  deadline: string | null
  organizer_id: string | null
  peer_review_open: boolean
  created_at: string
}

export interface HomeworkSubmission {
  id: string
  assignment_id: string
  student_id: string
  content: string
  grade: string | null
  feedback: string | null
  submitted_at: string
}

export interface PeerReviewForAuthor {
  assignment_id: string
  author_id: string
  rating: number
  comment: string | null
}

export interface SessionRating {
  id?: string
  session_id: string
  student_id: string
  rating: number
  note: string | null
}

export interface RatingAggregate {
  session_id: string
  average_rating: number | null
  response_count: number
  notes: string[] | null
}

export interface ChatMessage {
  id: string
  author_id: string
  body: string
  created_at: string
  author?: Pick<Profile, 'nickname' | 'avatar' | 'role'>
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string | null
  read: boolean
  created_at: string
}

export interface Resource {
  id: string
  title: string
  category: ResourceCategory
  file_type: FileType
  file_url: string | null
  size_label: string | null
  downloads: number
  added_by: string | null
  created_at: string
}

export interface GameQuestion {
  prompt: string
  hint_ar?: string
  options: string[]
  answer_index?: number
  answer_text?: string
  words?: string[]
}

export interface GameRound {
  id: string
  type: GameType
  difficulty: Level
  round_count: number
  timer_seconds: number
  questions: GameQuestion[]
  session_id: string | null
  status: 'lobby' | 'playing' | 'review' | 'ended'
  current_question: number
  phase: 'submit' | 'vote' | 'done'
  created_by: string | null
}

export interface GameAnswer {
  id: string
  round_id: string
  player_id: string
  question_index: number
  answer: unknown
  correct: boolean | null
}

export interface GameSubmission {
  id: string
  round_id: string
  player_id: string
  content: string
}

export interface BreakoutRoom {
  id: string
  session_id: string
  label: string
  capacity: number
  scenario_prompt: string | null
}

export interface RoomMember {
  room_id: string
  student_id: string
  joined_at: string
  profile?: Pick<Profile, 'nickname' | 'avatar'>
}

export interface ModerationReport {
  id: string
  message_source: 'chat' | 'breakout'
  message_id: string
  reporter_id: string
  status: 'open' | 'reviewed' | 'dismissed'
  created_at: string
}

export interface ScenarioTemplate {
  id: string
  title: string
  arabic_title: string | null
  prompt: string
}

export interface AiSettingsStatus {
  configured: boolean
  last4: string | null
  gemini_model: string | null
  groq_configured: boolean
  groq_last4: string | null
  groq_model: string | null
  ai_chat_provider: 'google' | 'groq'
  updated_by: string | null
  updated_at: string
}

export interface TranscriptMsg {
  id: number
  role: 'sys' | 'user'
  kind: 'phase' | 'err' | 'user' | 'ok'
  key?: string
  vars?: Record<string, string | number>
  raw?: string
  at: string
}

export interface AiChatSessionRow {
  id: string
  owner: string
  title: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  focus_preset: string | null
  transcript: TranscriptMsg[]
  result: MovieSessionResult | null
  updated_at: string
}

export interface DraftMeta {
  id: string
  title: string
  updated_at: string
  has_result: boolean
}

export interface MovieCandidate {
  title: string
  year: number
  duration_minutes: number
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
  why_it_works: string
}

export interface WorkshopActivity {
  title: string
  goal: string
  timing_min: number
  grouping: string
  prompt: string
  arabicHint: string
  skill_focus: string[]
  expected_output: string
}

export interface MovieSessionResult {
  candidates: MovieCandidate[]
  session: {
    title: string
    arabicTitle: string
    film: string
    description: string
    level: string
    format: string
    duration_minutes: number
    link: string
  }
  activities: WorkshopActivity[]
}

export interface AdminOverviewStats {
  total_students: number
  active_today: number
  upcoming_sessions: number
  reported_items: number
  refreshed_at: string
}

export interface AdminStudentProgress {
  student_id: string
  nickname: string | null
  avatar: string
  level: Level
  points: number
  streak: number
  total_checkins: number
  homework_submitted: number
  game_correct: number
}

export interface AdminSessionReport {
  session_id: string
  title: string
  starts_at: string
  ended_at: string | null
  attendance: number
  rsvps: number
  avg_rating: number | null
  rating_responses: number
}

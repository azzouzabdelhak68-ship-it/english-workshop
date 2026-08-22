import type { GameQuestion, GameType, Level } from '../lib/types'

export type RenderMode = 'select-one' | 'free-text' | 'vote'
export type { GameType } from '../lib/types'

export interface RoundConfig {
  type: GameType
  difficulty: Level
  roundCount: number
  timerSeconds: number
}

export interface GameStrategy {
  readonly type: GameType
  readonly renderMode: RenderMode
  getTimerSeconds(difficulty: Level): number
  scoreAnswer(question: GameQuestion, answer: unknown): boolean
}

const DEFAULT_TIMERS: Record<Level, number> = { Beginner: 8, Intermediate: 5, Advanced: 4 }

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

export const hotSeatStrategy: GameStrategy = {
  type: 'hot-seat',
  renderMode: 'select-one',
  getTimerSeconds: () => 5,
  scoreAnswer: (q, a) => q.answer_index === a
}

export const vocabChainStrategy: GameStrategy = {
  type: 'vocab-chain',
  renderMode: 'select-one',
  getTimerSeconds: (d) => DEFAULT_TIMERS[d],
  scoreAnswer: (q, a) => q.answer_index === a
}

export const idiomsTriviaStrategy: GameStrategy = {
  type: 'idioms-trivia',
  renderMode: 'select-one',
  getTimerSeconds: (d) => DEFAULT_TIMERS[d],
  scoreAnswer: (q, a) => q.answer_index === a
}

export const wordOrderRaceStrategy: GameStrategy = {
  type: 'word-order-race',
  renderMode: 'free-text',
  getTimerSeconds: (d) => DEFAULT_TIMERS[d] + 10,
  scoreAnswer: (q, a) => typeof a === 'string' && typeof q.answer_text === 'string' && normalize(a) === normalize(q.answer_text)
}

export const grammarDetectiveStrategy: GameStrategy = {
  type: 'grammar-detective',
  renderMode: 'free-text',
  getTimerSeconds: (d) => DEFAULT_TIMERS[d] + 15,
  scoreAnswer: (q, a) => typeof a === 'string' && typeof q.answer_text === 'string' && normalize(a) === normalize(q.answer_text)
}

export const memeCaptionStrategy: GameStrategy = {
  type: 'meme-caption',
  renderMode: 'vote',
  getTimerSeconds: (d) => DEFAULT_TIMERS[d] + 25,
  scoreAnswer: () => false
}

export const STRATEGIES: Record<GameType, GameStrategy> = {
  'hot-seat': hotSeatStrategy,
  'word-order-race': wordOrderRaceStrategy,
  'vocab-chain': vocabChainStrategy,
  'idioms-trivia': idiomsTriviaStrategy,
  'meme-caption': memeCaptionStrategy,
  'grammar-detective': grammarDetectiveStrategy
}

// Static fallback banks per type — the resilience pattern every round keeps,
// mirroring §8 ("if AI questions are loaded, they replace the bank").
export const FALLBACK_BANKS: Record<GameType, GameQuestion[]> = {
  'hot-seat': [
    {
      prompt: 'Complete it: "She ___ to school every day."',
      hint_ar: 'فعل المضارع البسيط',
      options: ['goes', 'go', 'going'],
      answer_index: 0
    },
    {
      prompt: 'What does "hang out" mean?',
      hint_ar: 'تعبير شائع',
      options: ['Spend time relaxing', 'Hang clothes', 'Climb'],
      answer_index: 0
    },
    {
      prompt: 'Pick the correct preposition: "good ___ English"',
      hint_ar: '',
      options: ['at', 'in', 'for'],
      answer_index: 0
    }
  ],
  'word-order-race': [
    { prompt: 'Arrange: "movie / we / watched / a / last night"', words: ['We', 'watched', 'a', 'movie', 'last night'], answer_text: 'We watched a movie last night', options: [], hint_ar: '' },
    { prompt: "Arrange: \"been / have / where / you / ?\"", words: ['Where', 'have', 'you', 'been'], answer_text: 'Where have you been', options: [], hint_ar: '' },
    { prompt: 'Arrange: "is / brother / my / than / taller / me"', words: ['My brother', 'is', 'taller', 'than', 'me'], answer_text: 'My brother is taller than me', options: [], hint_ar: '' }
  ],
  'vocab-chain': [
    { prompt: 'Synonym of "happy"?', hint_ar: '', options: ['glad', 'angry', 'sleepy'], answer_index: 0 },
    { prompt: 'Opposite of "ancient"?', hint_ar: '', options: ['modern', 'old', 'huge'], answer_index: 0 },
    { prompt: '"Delicious" describes…', hint_ar: '', options: ['food', 'weather', 'homework'], answer_index: 0 }
  ],
  'idioms-trivia': [
    { prompt: '"Break the ice" means…', hint_ar: '', options: ['Start a conversation', 'Damage something', 'Get cold'], answer_index: 0 },
    { prompt: '"Piece of cake" means…', hint_ar: '', options: ['Very easy', 'A dessert', 'Expensive'], answer_index: 0 },
    { prompt: '"Under the weather" means…', hint_ar: '', options: ['Feeling sick', 'Raining', 'Sad about weather'], answer_index: 0 }
  ],
  'meme-caption': [
    { prompt: 'Write the funniest caption for: a cat wearing glasses reading a book 🐱👓📚', words: [], answer_text: '', options: [], hint_ar: '' },
    { prompt: 'Write the funniest caption for: Monday morning alarm clock ⏰😩', words: [], answer_text: '', options: [], hint_ar: '' },
    { prompt: 'Write the funniest caption for: a dog doing homework 🐶📝', words: [], answer_text: '', options: [], hint_ar: '' }
  ],
  'grammar-detective': [
    { prompt: 'Fix this sentence: "He dont like coffee."', words: [], answer_text: 'He doesnt like coffee', options: [], hint_ar: '' },
    { prompt: 'Fix this sentence: "I am living here since 2019."', words: [], answer_text: 'I have been living here since 2019', options: [], hint_ar: '' },
    { prompt: 'Fix this sentence: "She can to swim very well."', words: [], answer_text: 'She can swim very well', options: [], hint_ar: '' }
  ]
}

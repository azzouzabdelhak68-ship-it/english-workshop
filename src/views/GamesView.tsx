import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { GameAnswer, GameQuestion, GameRound, GameSubmission, GameType, Level, Profile } from '../lib/types'
import { GAME_TYPES, LEVELS } from '../lib/constants'
import { FALLBACK_BANKS, STRATEGIES } from '../games/engine'
import { Modal, Banner } from '../components/ui'
import { fireConfetti } from '../components/Confetti'

const GAME_LABELS: Record<GameType, string> = {
  'hot-seat': 'gameHotSeat',
  'word-order-race': 'gameWordOrder',
  'vocab-chain': 'gameVocabChain',
  'idioms-trivia': 'gameIdiomsTrivia',
  'meme-caption': 'gameMemeCaption',
  'grammar-detective': 'gameGrammarDetective'
} as const

export function GamesView({ profile }: { profile: NonNullable<Profile> }) {
  const { t, lang, isStaff } = useApp()
  const [round, setRound] = useState<GameRound | null>(null)
  const [stage, setStage] = useState<'lobby' | 'countdown' | 'playing' | 'review'>('lobby')
  const [countdown, setCountdown] = useState(3)
  const [earnedThisRound, setEarnedThisRound] = useState(0)
  const [projectorOpen, setProjectorOpen] = useState(false)

  useEffect(() => {
    void loadActiveRound()
    const channel = supabase
      .channel('game-rounds-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds' }, () => void loadActiveRound())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  async function loadActiveRound() {
    const { data } = await supabase
      .from('game_rounds')
      .select('*')
      .in('status', ['lobby', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1)
    const first = data?.[0] ?? null
    setRound((first as GameRound) ?? null)
  }

  async function joinArena() {
    setStage('countdown')
    setCountdown(3)
  }

  useEffect(() => {
    if (stage !== 'countdown') return
    if (countdown === 0) {
      setStage('playing')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [stage, countdown])

  if (!supabase) return null

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pb-10">
      <div className="app-card p-6">
        <h2 className="text-xl font-extrabold">🎮 {t('hotSeatName')}</h2>
        <p className="mt-1 text-sm opacity-75">{t('hotSeatDesc')}</p>
        <button onClick={joinArena} className="btn-primary mt-4 w-full">
          🎯 {t('joinEnterArena')}
        </button>
        {isStaff && (
          <button onClick={() => setProjectorOpen(true)} className="btn-accent mt-2 w-full">
            🖥 {t('hostProjectorDashboard')}
          </button>
        )}
      </div>

      {stage === 'countdown' && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-petrol-950/90 text-white">
          <p className="mb-6 text-lg font-bold">{t('gameStartingSoon')}</p>
          <p key={countdown} className="animate-bounceIn text-9xl font-extrabold">{countdown > 0 ? countdown : 'GO!'}</p>
        </div>
      )}

      {stage === 'playing' && round && (
        <PlayingStage
          round={round}
          profile={profile}
          onFinish={(points) => {
            setEarnedThisRound(points)
            setStage('review')
          }}
        />
      )}

      {stage === 'review' && (
        <div className="app-card mt-4 p-8 text-center">
          <p className="text-2xl font-extrabold">{t('awesomeJob', { nickname: profile.nickname ?? '' })}</p>
          <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {t('pointsEarnedRound', { points: earnedThisRound })}
          </p>
          <button onClick={() => setStage('lobby')} className="btn-primary mt-6 w-full">
            ↻ {t('playAnotherRound')}
          </button>
        </div>
      )}

      {stage === 'lobby' && (
        <div className={`app-card mt-4 p-5 ${round?.status === 'lobby' ? 'ring-2 ring-brass-500' : ''}`}>
          <p className="text-sm font-semibold opacity-70">{t('lobbyTitle')}</p>
          {round ? (
            <p className="mt-1 text-sm">
              {lang === 'ar' ? 'جولة مفتوحة:' : 'Open round:'}{' '}
              <strong>{t(GAME_LABELS[round.type] as never)}</strong> • {round.difficulty}
            </p>
          ) : (
            <p className="mt-1 text-sm opacity-60">{t('waitingForPlayers')}</p>
          )}
        </div>
      )}

      {projectorOpen && <ProjectorDashboard onClose={() => setProjectorOpen(false)} />}
    </div>
  )
}

function PlayingStage({
  round,
  profile,
  onFinish
}: {
  round: GameRound
  profile: NonNullable<Profile>
  onFinish: (points: number) => void
}) {
  const { t } = useApp()
  const strategy = STRATEGIES[round.type]
  const questions: GameQuestion[] =
    Array.isArray(round.questions) && round.questions.length > 0 ? round.questions : FALLBACK_BANKS[round.type]
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [textAnswer, setTextAnswer] = useState('')
  const timerSeconds = round.timer_seconds ?? strategy.getTimerSeconds(round.difficulty)
  const [timer, setTimer] = useState(timerSeconds)
  const [correctCount, setCorrectCount] = useState(0)
  const submittedRef = useRef(false)

  // Vote-mode two-phase round
  const [submissions, setSubmissions] = useState<GameSubmission[]>([])
  const [mySubmissionId, setMySubmissionId] = useState<string | null>(null)
  const isVoteMode = strategy.renderMode === 'vote'

  useEffect(() => {
    if (!isVoteMode) return
    void reloadSubmissions()
    const channel = supabase
      .channel(`submissions-${round.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_submissions' }, () => void reloadSubmissions())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isVoteMode, round.id])

  useEffect(() => {
    if (locked || submittedRef.current) return
    if (timer <= 0) {
      void handleTimeout()
      return
    }
    const id = setTimeout(() => setTimer((x) => x - 1), 1000)
    return () => clearTimeout(id)
  }, [timer, locked])

  async function reloadSubmissions() {
    const { data } = await supabase.from('game_submissions').select('*').eq('round_id', round.id)
    setSubmissions(((data as GameSubmission[]) ?? []).filter((s) => s.player_id !== profile.id))
    const mine = ((data as GameSubmission[]) ?? []).find((s) => s.player_id === profile.id)
    if (mine) setMySubmissionId(mine.id)
  }

  async function saveAnswer(answer: unknown, correct: boolean) {
    await supabase.from('game_answers').insert({
      round_id: round.id,
      player_id: profile.id,
      question_index: qIndex,
      answer,
      correct
    })
    if (correct) {
      setCorrectCount((c) => c + 1)
      fireConfetti()
      await supabase.rpc('award_game_points', { p_reason: 'correct_answer' })
    }
  }

  function advance() {
    if (qIndex + 1 >= Math.max(questions.length, 1)) {
      onFinish(correctCount * 100)
      return
    }
    setQIndex((i) => i + 1)
    setSelected(null)
    setLocked(false)
    setTextAnswer('')
    setTimer(timerSeconds)
    submittedRef.current = false
  }

  function handleSelect(idx: number) {
    if (locked || !questions[qIndex]) return
    setSelected(idx)
    setLocked(true)
    const q = questions[qIndex]
    const correct = q.answer_index === idx
    void saveAnswer(idx, correct)
    setTimeout(advance, 1500)
  }

  async function handleTimeout() {
    if (strategy.renderMode === 'free-text') {
      await gradeText(textAnswer)
    } else if (strategy.renderMode === 'select-one') {
      setLocked(true)
      setSelected(-1)
      setTimeout(advance, 1200)
    }
  }

  async function gradeText(value: string) {
    if (submittedRef.current) return
    submittedRef.current = true
    setLocked(true)
    const q = questions[qIndex]
    const correct = strategy.scoreAnswer(q, value)
    await saveAnswer(value, correct)
    setTimeout(advance, 1500)
  }

  const q = questions[qIndex]

  if (!q && !isVoteMode) {
    return (
      <div className="app-card mt-4 p-8 text-center">
        <Banner kind="info">{t('waitingForPlayers')}</Banner>
      </div>
    )
  }

  return (
    <div className="mt-4">
      {!isVoteMode && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold">{t('questionXofN', { x: qIndex + 1, n: questions.length })}</span>
            <span
              className={`pill ${timer <= 2 ? '!bg-red-600 !text-white' : 'bg-petrol-700 !text-white'} text-base tabular-nums`}
              aria-live="polite"
            >
              ⏱ {t('xsHotSeatTimer', { x: timer })}
            </span>
          </div>

          <div className="app-card p-5">
            <p className="text-lg font-bold leading-relaxed">{q.prompt}</p>
            {q.hint_ar && (
              <p dir="rtl" className="font-arabic mt-1 text-sm text-brass-700 dark:text-brass-300">
                💡 {t('hintLabel')} {q.hint_ar}
              </p>
            )}

            {strategy.renderMode === 'select-one' && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, idx) => {
                  const isCorrect = q.answer_index === idx
                  const chosen = selected === idx
                  let cls = 'btn-secondary justify-start'
                  if (locked && isCorrect) cls += ' !bg-emerald-600 !text-white'
                  else if (locked && chosen) cls += ' !bg-red-600 !text-white'
                  return (
                    <button key={idx} onClick={() => handleSelect(idx)} disabled={locked} className={`${cls} min-h-[52px]`}>
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {strategy.renderMode === 'free-text' && (
              <form
                className="mt-4 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void gradeText(textAnswer)
                }}
              >
                <textarea rows={2} className="input-base" placeholder={t('typeAnswerHere')} value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} />
                <button type="submit" disabled={locked || !textAnswer.trim()} className="btn-primary disabled:opacity-50">
                  {t('submit')}
                </button>
                {locked && typeof q.answer_text === 'string' && (
                  <p className="text-sm font-semibold">
                    {strategy.scoreAnswer(q, textAnswer) ? `✅ ${t('correctFeedback')}` : `❌ ${t('wrongFeedback')} ${q.answer_text}`}
                  </p>
                )}
              </form>
            )}
          </div>
        </>
      )}

      {isVoteMode && (
        <div className="app-card p-5">
          <p className="text-lg font-bold leading-relaxed">{q.prompt}</p>
          {!mySubmissionId ? (
            <form
              className="mt-4 flex flex-col gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!textAnswer.trim()) return
                const { data } = await supabase
                  .from('game_submissions')
                  .insert({ round_id: round.id, player_id: profile.id, content: textAnswer.trim() })
                  .select()
                  .single()
                if (data) setMySubmissionId(data.id)
                setTextAnswer('')
              }}
            >
              <p className="pill bg-brass-500 !text-white">{t('submissionPhase')}</p>
              <textarea rows={2} className="input-base" placeholder={t('captionPlaceholder')} value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} />
              <button type="submit" className="btn-primary">
                {t('submitEntry')}
              </button>
            </form>
          ) : (
            <>
              <p className="pill mt-4 bg-petrol-600 !text-white">{t('votingPhase')}</p>
              <div className="mt-2 flex flex-col gap-2">
                {submissions.map((s) => (
                  <VoteRow key={s.id} submission={s} profileId={profile.id} onVoted={() => void reloadSubmissions()} />
                ))}
                {submissions.length === 0 && <p className="py-3 text-center text-sm opacity-60">{t('waitingForPlayers')}</p>}
              </div>
              <button onClick={() => onFinish(correctCount * 100)} className="btn-secondary mt-4 w-full">
                {t('playAnotherRound')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function VoteRow({ submission, profileId, onVoted }: { submission: GameSubmission; profileId: string; onVoted: () => void }) {
  const { t } = useApp()
  const [votes, setVotes] = useState(0)
  const [myVote, setMyVote] = useState(false)

  useEffect(() => {
    void supabase
      .from('game_votes')
      .select('*')
      .eq('submission_id', submission.id)
      .then(({ data }) => {
        const all = (data as { voter_id: string }[]) ?? []
        setVotes(all.length)
        setMyVote(all.some((v) => v.voter_id === profileId))
      })
  }, [submission.id, profileId])

  async function toggleVote() {
    if (myVote) {
      await supabase.from('game_votes').delete().eq('submission_id', submission.id).eq('voter_id', profileId)
      setMyVote(false)
      setVotes((v) => v - 1)
    } else {
      try {
        await supabase.from('game_votes').insert({ submission_id: submission.id, voter_id: profileId })
        setMyVote(true)
        setVotes((v) => v + 1)
      } catch {
        alert(t('selfVoteBlocked'))
      }
    }
    onVoted()
  }

  return (
    <button
      onClick={toggleVote}
      className={`btn-secondary justify-between text-start ${myVote ? 'ring-2 ring-brass-500' : ''}`}
    >
      <span className="truncate">{submission.content}</span>
      <span className="ms-2 shrink-0 font-bold">🗳 {votes}</span>
    </button>
  )
}

function ProjectorDashboard({ onClose }: { onClose: () => void }) {
  const { t } = useApp()
  const [type, setType] = useState<GameType>('hot-seat')
  const [difficulty, setDifficulty] = useState<Level>('Intermediate')
  const [roundCount, setRoundCount] = useState(5)
  const [timerSec, setTimerSec] = useState(5)
  const [aiQuestions, setAiQuestions] = useState<GameQuestion[] | null>(null)
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [stats, setStats] = useState<{ players: number; top: string | null }>({ players: 0, top: null })
  const [activeRound, setActiveRound] = useState<GameRound | null>(null)

  useEffect(() => {
    void loadActive()
    const channel = supabase.channel('proj-rounds').on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds' }, () => void loadActive()).subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!activeRound) return
    void supabase
      .from('game_answers')
      .select('player_id,correct')
      .eq('round_id', activeRound.id)
      .then(({ data }) => {
        const answers = (data as { player_id: string; correct: boolean | null }[]) ?? []
        const byPlayer = new Map<string, number>()
        answers.forEach((a) => {
          if (a.correct) byPlayer.set(a.player_id, (byPlayer.get(a.player_id) ?? 0) + 1)
        })
        let top: string | null = null
        let best = 0
        byPlayer.forEach((score, id) => {
          if (score > best) {
            best = score
            top = id
          }
        })
        setStats({ players: byPlayer.size, top })
      })
  }, [activeRound])

  async function loadActive() {
    const { data } = await supabase
      .from('game_rounds')
      .select('*')
      .in('status', ['lobby', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1)
    const first = data?.[0] ?? null
    setActiveRound((first as GameRound) ?? null)
  }

  async function generateQuestions() {
    setAiState('loading')
    try {
      const res = await supabase.functions.invoke('groq-generate', {
        body: { mode: 'game-questions', game_type: type, difficulty }
      })
      if (res.error) throw res.error
      const qs = res.data?.questions as GameQuestion[] | undefined
      if (!qs || qs.length === 0) throw new Error('empty')
      setAiQuestions(qs)
      setAiState('ok')
    } catch {
      setAiQuestions(null)
      setAiState('err')
    }
  }

  async function startRound() {
    const bank = aiQuestions && aiQuestions.length > 0 ? aiQuestions.slice(0, roundCount) : FALLBACK_BANKS[type].slice(0, Math.max(roundCount, 1))
    await supabase.from('game_rounds').insert({
      type,
      difficulty,
      round_count: roundCount,
      timer_seconds: timerSec,
      questions: bank,
      status: 'lobby'
    })
    await loadActive()
  }

  async function resetLobby() {
    if (!activeRound) return
    await supabase.from('game_rounds').update({ status: 'ended' }).eq('id', activeRound.id)
    await loadActive()
  }

  return (
    <Modal open onClose={onClose} title={t('hostProjectorDashboard')} wide>
      <div className="rounded-xl bg-petrol-950 p-4 text-white shadow-lg dark:bg-black">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-mist-300">
          HOST PROJECTOR DASHBOARD — {t(GAME_LABELS[type] as never)}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t('currentGame')} value={activeRound ? t(GAME_LABELS[activeRound.type] as never) : '—'} />
          <Stat label={t('roundStatus')} value={activeRound ? t('roundXofN', { x: activeRound.current_question + 1, n: activeRound.round_count }) : '—'} />
          <Stat label={t('topPlayer')} value={stats.top ? stats.top.slice(0, 8) : '—'} />
        </div>
        <p className="mt-2 text-center text-xs text-mist-300">{t('studentsActive', { count: stats.players })}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {t('selectGameType')}
          <select className="input-base !min-h-[44px]" value={type} onChange={(e) => setType(e.target.value as GameType)}>
            {GAME_TYPES.map((g) => (
              <option key={g} value={g}>
                {t(GAME_LABELS[g] as never)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {t('difficulty')}
          <select className="input-base !min-h-[44px]" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Level)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {t('rounds')}
          <input type="number" min={1} max={20} className="input-base !min-h-[44px]" value={roundCount} onChange={(e) => setRoundCount(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {t('perQuestionTimer')}
          <input type="number" min={3} max={60} className="input-base !min-h-[44px]" value={timerSec} onChange={(e) => setTimerSec(Number(e.target.value))} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={startRound} className="btn-primary flex-1">
          ▶ {t('startGameRoundNow')}
        </button>
        <button onClick={resetLobby} className="btn-secondary flex-1">
          ↺ {t('resetGameLobby')}
        </button>
        <button onClick={generateQuestions} disabled={aiState === 'loading'} className="btn-accent flex-1 disabled:opacity-60">
          {aiState === 'loading' ? t('aiQuestionsLoading') : `✨ ${t('generateAiQuestions')}`}
        </button>
      </div>
      {aiState === 'ok' && (
        <div className="mt-3">
          <Banner>{t('aiQuestionsLoaded')} ({aiQuestions?.length})</Banner>
        </div>
      )}
      {aiState === 'err' && (
        <div className="mt-3">
          <Banner kind="info">{t('aiQuestionsFailed')}</Banner>
        </div>
      )}
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-petrol-900 p-3">
      <p className="truncate text-[10px] uppercase tracking-wide text-mist-400">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold">{value}</p>
    </div>
  )
}

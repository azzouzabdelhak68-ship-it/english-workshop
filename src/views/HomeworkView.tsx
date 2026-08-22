import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { HomeworkAssignment, HomeworkSubmission, PeerReviewForAuthor, Profile } from '../lib/types'
import { Modal, Banner } from '../components/ui'
import { CelebrationPopup } from '../components/CelebrationPopup'

export function HomeworkView({ profile }: { profile: NonNullable<Profile> }) {
  const { t, isStaff, refreshProfile } = useApp()
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([])
  const [mySubs, setMySubs] = useState<HomeworkSubmission[]>([])
  const [submissionsAll, setSubmissionsAll] = useState<HomeworkSubmission[]>([])
  const [subCount, setSubCount] = useState<Record<string, number>>({})
  const [submitFor, setSubmitFor] = useState<HomeworkAssignment | null>(null)
  const [content, setContent] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [pubTitle, setPubTitle] = useState('')
  const [pubDesc, setPubDesc] = useState('')
  const [pubDeadline, setPubDeadline] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const [reviewFor, setReviewFor] = useState<HomeworkAssignment | null>(null)
  const [reviewsForMe, setReviewsForMe] = useState<PeerReviewForAuthor[]>([])
  const [banner, setBanner] = useState('')
  const [aiFeedbackFor, setAiFeedbackFor] = useState<string | null>(null)
  const [reviewedAssignments, setReviewedAssignments] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ew-reviewed-assignments')
      if (stored) setReviewedAssignments(new Set(JSON.parse(stored)))
    } catch { /* ignore */ }
  }, [])

  function markReviewed(assignmentId: string) {
    setReviewedAssignments((prev) => {
      const next = new Set(prev)
      next.add(assignmentId)
      try { localStorage.setItem('ew-reviewed-assignments', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  function isReviewed(assignmentId: string): boolean {
    return reviewedAssignments.has(assignmentId)
  }

  useEffect(() => {
    void reload()
  }, [])

  async function reload() {
    const { data: a } = await supabase.from('homework_assignments').select('*').order('created_at', { ascending: false })
    setAssignments((a as HomeworkAssignment[]) ?? [])
    const { data: s } = await supabase.from('homework_submissions').select('*').eq('student_id', profile.id)
    setMySubs((s as HomeworkSubmission[]) ?? [])
    if (isStaff) {
      const { data: allSubs } = await supabase.from('homework_submissions').select('*')
      setSubmissionsAll((allSubs as HomeworkSubmission[]) ?? [])
      void loadCounts()
    }
    const { data: rev } = await supabase
      .from('peer_reviews_for_author')
      .select('*')
      .eq('author_id', profile.id)
    setReviewsForMe(((rev as PeerReviewForAuthor[]) ?? []).filter((r) => r.author_id === profile.id))
  }

  async function loadCounts() {
    for (const a of assignments) {
      const { count } = await supabase
        .from('homework_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('assignment_id', a.id)
      setSubCount((prev) => ({ ...prev, [a.id]: count ?? 0 }))
    }
    return { countFn: null }
  }

  useEffect(() => {
    if (isStaff && assignments.length > 0 && Object.keys(subCount).length === 0) void loadCounts()
  }, [isStaff, assignments])

  async function submitHomework(e: React.FormEvent) {
    e.preventDefault()
    if (!submitFor || !content.trim()) return
    await supabase.from('homework_submissions').upsert(
      { assignment_id: submitFor.id, student_id: profile.id, content: content.trim() },
      { onConflict: 'assignment_id,student_id' }
    )
    setSubmitFor(null)
    setContent('')
    void reload()
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('homework_assignments').insert({
      title: pubTitle.trim(),
      description: pubDesc.trim() || null,
      deadline: pubDeadline.trim() || null,
      organizer_id: profile.id
    })
    setPublishOpen(false)
    setPubTitle('')
    setPubDesc('')
    setPubDeadline('')
    void reload()
  }

  async function aiFeedback(a: HomeworkAssignment, submissionId: string) {
    try {
      const sub = mySubs.find((s) => s.id === submissionId) ?? submissionsAll.find((s) => s.id === submissionId)
      if (!sub) return
      const res = await supabase.functions.invoke('groq-generate', {
        body: { mode: 'essay-feedback', text: sub.content, title: a.title }
      })
      if (res.error) throw res.error
      const fb = String(res.data?.feedback ?? '')
      await supabase
        .from('homework_submissions')
        .update({ grade: 'A', feedback: fb })
        .eq('id', sub.id)
      setCelebrate(true)
      setTimeout(() => setCelebrate(false), 4200)
      void reload()
      void refreshProfile()
    } catch {
      setBanner(t('errorGeneric'))
      setTimeout(() => setBanner(''), 4000)
    }
  }

  async function openPeerReview(a: HomeworkAssignment) {
    const { error } = await supabase.rpc('open_peer_review', { p_assignment_id: a.id })
    if (error) alert(error.message === 'NOT_ENOUGH_SUBMISSIONS' ? t('notEnoughSubmissions') : error.message)
    void reload()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pb-10">
      {banner && (
        <div className="mb-4">
          <Banner kind="err">{banner}</Banner>
        </div>
      )}
      {celebrate && <CelebrationPopup />}

      {isStaff && (
        <button onClick={() => setPublishOpen(true)} className="btn-primary mb-4">
          📢 {t('publishAssignment')}
        </button>
      )}

      <div className="flex flex-col gap-4">
        {assignments.map((a) => {
          const mine = mySubs.find((s) => s.assignment_id === a.id)
          return (
            <article key={a.id} className="app-card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                {mine ? (
                  <span className="pill bg-emerald-100 font-bold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">{t('submittedLabel')}</span>
                ) : (
                  <span className="pill bg-amber-100 font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">{t('pendingSubmission')}</span>
                )}
                <span className="opacity-60">⏰ {t('deadline')}: {a.deadline ?? '—'}</span>
                {mine?.grade && <span className="pill bg-brass-500 !text-white">{t('gradeLabel', { grade: mine.grade })}</span>}
                {isStaff && subCount[a.id] !== undefined && (
                  <span className="pill bg-petrol-100 !text-petrol-900 dark:bg-petrol-800 dark:!text-petrol-100">👥 {t('submissionsCount', { count: subCount[a.id] })}</span>
                )}
                {a.peer_review_open && <span className="pill bg-mist-200 !text-mist-900 dark:bg-mist-800 dark:!text-mist-100">{t('peerReviewActive')}</span>}
              </div>

              <h3 className="text-lg font-extrabold">{a.title}</h3>
              {a.description && <p className="mt-1 text-sm opacity-80">{a.description}</p>}

              {mine?.feedback && (
                <div className="mt-3 rounded-lg border-s-4 p-3 text-sm" style={{ borderColor: '#B08A57', background: 'var(--background)' }}>
                  <p className="font-bold">{t('organizerFeedback')}</p>
                  <p className="mt-1 whitespace-pre-line opacity-85">{mine.feedback}</p>
                </div>
              )}

              {reviewsForMe.filter((r) => r.assignment_id === a.id).length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold">⭐ {t('reviewsReceived')} ({reviewsForMe.filter((r) => r.assignment_id === a.id).length})</summary>
                  <ul className="mt-2 space-y-2">
                    {reviewsForMe
                      .filter((r) => r.assignment_id === a.id)
                      .map((r, i) => (
                        <li key={i} className="rounded-lg bg-mist-100 p-3 text-sm dark:bg-mist-800/60">
                          {'⭐'.repeat(r.rating)}
                          {r.comment ? ` — ${r.comment}` : ''}
                        </li>
                      ))}
                  </ul>
                  {assignments.length < 4 && <p className="mt-2 text-xs opacity-60">{t('smallCohortNote')}</p>}
                </details>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {!isStaff && (
                  <>
                    <button onClick={() => { setSubmitFor(a); setContent(mine?.content ?? '') }} className={mine ? 'btn-secondary' : 'btn-primary'}>
                      {mine ? `✎ ${t('editResubmit')}` : `📤 ${t('submitHomework')}`}
                    </button>
                    {a.peer_review_open && !isReviewed(a.id) && mine && (
                      <button onClick={() => setReviewFor(a)} className="btn-secondary">
                        🔁 {t('reviewAPeer')}
                      </button>
                    )}
                    {a.peer_review_open && mine && (
                      <p className="w-full text-xs opacity-60">{t('lateSubmitterNote')}</p>
                    )}
                  </>
                )}
                {isStaff && !a.peer_review_open && (
                  <button onClick={() => void openPeerReview(a)} className="btn-secondary">
                    🔓 {t('openPeerReview')}
                  </button>
                )}
                {isStaff && a.peer_review_open && (
                  <button onClick={() => setAiFeedbackFor(a.id)} className="btn-accent">
                    ✨ {t('aiFeedback')}
                  </button>
                )}
                {isStaff && (
                  <details className="w-full">
                    <summary className="cursor-pointer text-xs font-semibold opacity-70">🛡 {t('staffReviewMap')}</summary>
                    <StaffMapping assignmentId={a.id} />
                  </details>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <Modal open={!!submitFor} onClose={() => setSubmitFor(null)} title={t('submitHomework')}>
        <form onSubmit={submitHomework} className="flex flex-col gap-3">
          <p className="font-bold">{submitFor?.title}</p>
          <textarea rows={6} required className="input-base" placeholder={t('yourWriting')} value={content} onChange={(e) => setContent(e.target.value)} />
          <button type="submit" className="btn-primary">
            {t('submitToOrganizer')}
          </button>
        </form>
      </Modal>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title={t('publishAssignment')}>
        <form onSubmit={publish} className="flex flex-col gap-3">
          <input required className="input-base" placeholder={t('announcementTitle')} value={pubTitle} onChange={(e) => setPubTitle(e.target.value)} />
          <textarea rows={3} className="input-base" placeholder={t('content')} value={pubDesc} onChange={(e) => setPubDesc(e.target.value)} />
          <input className="input-base" placeholder={`${t('deadline')} — June 20, 2026`} value={pubDeadline} onChange={(e) => setPubDeadline(e.target.value)} />
          <button type="submit" className="btn-primary">
            {t('publishAssignment')}
          </button>
        </form>
      </Modal>

      {reviewFor && (
        <PeerReviewModal
          assignmentId={reviewFor.id}
          reviewerId={profile.id}
          onClose={() => {
            setReviewFor(null)
            void reload()
          }}
          onReviewed={() => markReviewed(reviewFor!.id)}
        />
      )}
      {aiFeedbackFor && (
        <AiFeedbackModal
          assignmentId={aiFeedbackFor}
          submissions={submissionsAll.filter((s) => s.assignment_id === aiFeedbackFor)}
          onClose={() => {
            setAiFeedbackFor(null)
            void reload()
          }}
        />
      )}
    </div>
  )
}

function AiFeedbackModal({ assignmentId, submissions, onClose }: { assignmentId: string; submissions: HomeworkSubmission[]; onClose: () => void }) {
  const { t } = useApp()
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const assignment = submissions[0] ? undefined : undefined

  async function runFeedback() {
    if (!selectedSubmissionId) return
    setBusy(true)
    setErr('')
    try {
      const sub = submissions.find((s) => s.id === selectedSubmissionId)
      if (!sub) return
      const res = await supabase.functions.invoke('groq-generate', {
        body: { mode: 'essay-feedback', text: sub.content, title: '' }
      })
      if (res.error) throw res.error
      const fb = String(res.data?.feedback ?? '')
      await supabase.from('homework_submissions').update({ grade: 'A', feedback: fb }).eq('id', sub.id)
      onClose()
    } catch {
      setErr(t('errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('aiFeedback')}>
      <p className="mb-3 text-sm opacity-70">{t('aiFeedbackInstructions')}</p>
      <select className="input-base mb-3" value={selectedSubmissionId} onChange={(e) => setSelectedSubmissionId(e.target.value)}>
        <option value="">{t('selectSubmission')}</option>
        {submissions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id.slice(0, 8)}…
          </option>
        ))}
      </select>
      {err && <Banner kind="err">{err}</Banner>}
      <button disabled={busy || !selectedSubmissionId} onClick={runFeedback} className="btn-primary w-full disabled:opacity-50">
        {busy ? t('loading') : t('generateFeedback')}
      </button>
    </Modal>
  )
}

function StaffMapping({ assignmentId }: { assignmentId: string }) {
  const [rows, setRows] = useState<Array<{ id: string; profiles: { nickname: string | null }; submissions: { student_id: string; profiles: { nickname: string | null } | null } | null }>>([])
  useEffect(() => {
    void supabase
      .from('peer_reviews')
      .select('id,profiles!peer_reviews_reviewer_id_fkey(nickname),submissions:homework_submissions!peer_reviews_reviewee_submission_id_fkey(student_id,profiles(nickname))')
      .eq('assignment_id', assignmentId)
      .then(({ data }) => setRows(((data as never[]) ?? []) as typeof rows))
  }, [assignmentId])
  if (rows.length === 0) return null
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {rows.map((r) => (
        <li key={r.id} className="rounded bg-mist-100 px-2 py-1 dark:bg-mist-800/60">
          {r.profiles?.nickname ?? '?'} → {r.submissions?.profiles?.nickname ?? '?'}
        </li>
      ))}
    </ul>
  )
}

function PeerReviewModal({ assignmentId, reviewerId, onClose, onReviewed }: { assignmentId: string; reviewerId: string; onClose: () => void; onReviewed: () => void }) {
  const { t } = useApp()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!rating) return
    const { error } = await supabase.rpc('submit_peer_review', {
      p_assignment_id: assignmentId,
      p_rating: rating,
      p_comment: comment.trim() || null
    })
    if (error) {
      setErr(error.message === 'ALREADY_REVIEWED' ? t('alreadyReviewed') : t('notEnoughSubmissions'))
      return
    }
    setDone(true)
    onReviewed()
    setTimeout(onClose, 1200)
  }

  return (
    <Modal open onClose={onClose} title={t('reviewAPeer')}>
      <p className="mb-1 text-sm opacity-70">{t('peerReviewIntro')}</p>
      <p className="mb-4 text-xs opacity-60">{reviewerId ? '' : ''}{t('smallCohortNote')}</p>
      {done ? (
        <Banner>{t('ratingThanks')}</Banner>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={`${n} stars`} onClick={() => setRating(n)} className="min-h-[44px] min-w-[44px] text-2xl">
                {n <= rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>
          <textarea rows={3} className="input-base" placeholder={t('reviewCommentPlaceholder')} value={comment} onChange={(e) => setComment(e.target.value)} />
          {err && <Banner kind="err">{err}</Banner>}
          <button disabled={!rating} onClick={submit} className="btn-primary disabled:opacity-50">
            {t('submitReview')}
          </button>
        </div>
      )}
    </Modal>
  )
}
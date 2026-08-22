import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Announcement, AnnouncementCategory } from '../lib/types'
import { ANNOUNCEMENT_CATEGORIES, CATEGORY_COLORS, isStaffRole } from '../lib/constants'
import { Modal, Banner } from '../components/ui'

interface AnnouncementWithAuthor extends Announcement {
  author: { nickname: string | null; avatar: string | null } | null
}

export function AnnouncementsView({ profile }: { profile: NonNullable<import('../lib/types').Profile> }) {
  const { t, isStaff } = useApp()
  const [items, setItems] = useState<AnnouncementWithAuthor[]>([])
  const [postOpen, setPostOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<AnnouncementCategory>('General')
  const [body, setBody] = useState('')
  const [quizState, setQuizState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [realtimeNote, setRealtimeNote] = useState('')

  useEffect(() => {
    void reload()
    const channel = supabase
      .channel('announcements-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => {
        setRealtimeNote('● new')
        void reload()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  async function reload() {
    const { data } = await supabase
      .from('announcements')
      .select('*,author:profiles(nickname,avatar)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setItems((data as AnnouncementWithAuthor[]) ?? [])
  }

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    await supabase.from('announcements').insert({ title: title.trim(), body: body.trim(), category })
    setTitle('')
    setBody('')
    setPostOpen(false)
    void reload()
  }

  async function generateQuiz() {
    setQuizState('loading')
    try {
      const res = await supabase.functions.invoke('groq-generate', { body: { mode: 'weekly-quiz' } })
      if (res.error) throw res.error
      const quiz = res.data as { title?: string; questions?: Array<{ prompt?: string; options?: string[] }> }
      await supabase.from('announcements').insert({
        title: quiz.title ?? t('quizReadyBanner'),
        body: formatQuiz(quiz),
        category: 'Game Night',
        pinned: true
      })
      setQuizState('ok')
      void reload()
    } catch {
      setQuizState('err')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pb-10">
      <Banner kind="info">🎓 {t('welcomeBack', { nickname: profile.nickname ?? '' })} — {t('welcomeMessage')}</Banner>

      {isStaff && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setPostOpen(true)} className="btn-primary">
            ✍️ {t('postAnnouncement')}
          </button>
          <button onClick={generateQuiz} disabled={quizState === 'loading'} className="btn-secondary">
            {quizState === 'loading' ? t('quizGenerating') : `🤖 ${t('generateWeeklyQuiz')}`}
          </button>
        </div>
      )}
      {quizState === 'ok' && (
        <div className="mt-3">
          <Banner>{t('quizReadyBanner')}</Banner>
        </div>
      )}
      {quizState === 'err' && (
        <div className="mt-3">
          <Banner kind="err">{t('quizFailed')}</Banner>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {items.map((a) => (
          <article key={a.id} className={`app-card p-5 ${a.pinned ? 'ring-2 ring-brass-500' : ''}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`pill ${CATEGORY_COLORS[a.category]}`}>{a.category}</span>
              {a.pinned && <span className="pill bg-brass-500 !text-white">📌</span>}
              <time className="opacity-60">{new Date(a.created_at).toLocaleDateString()}</time>
            </div>
            <h3 className="text-lg font-bold">{a.title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed opacity-85">{a.body}</p>
            <p className="mt-3 text-xs font-semibold opacity-60">— {a.author?.nickname ?? 'Organizer'}</p>
          </article>
        ))}
      </div>

      <Modal open={postOpen} onClose={() => setPostOpen(false)} title={t('postAnnouncement')}>
        <form onSubmit={post} className="flex flex-col gap-3">
          <input className="input-base" placeholder={t('announcementTitle')} value={title} onChange={(e) => setTitle(e.target.value)} required />
          <select className="input-base" value={category} onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}>
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea rows={5} className="input-base" placeholder={t('content')} value={body} onChange={(e) => setBody(e.target.value)} required />
          <button type="submit" className="btn-primary">
            {t('postAnnouncement')}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function formatQuiz(quiz: { questions?: Array<{ prompt?: string; options?: string[] }> }): string {
  if (!quiz.questions || quiz.questions.length === 0) return 'Weekly AI Quiz'
  return quiz.questions
    .map((q, i) => `${i + 1}. ${q.prompt ?? ''}\n${(q.options ?? []).join(' | ')}`)
    .join('\n\n')
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Announcement, Session } from '../lib/types'
import { CATEGORY_COLORS } from '../lib/constants'

export function LandingView({ onLogin }: { onLogin: () => void }) {
  const { t, lang } = useApp()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    void supabase
      .from('announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setAnnouncements((data as Announcement[]) ?? []))
    void supabase
      .from('sessions')
      .select('*')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(3)
      .then(({ data }) => setSessions((data as Session[]) ?? []))
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <section className="py-14 text-center md:py-20">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">{t('heroTitle')}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg opacity-75">{t('heroSubtitle')}</p>
        <button onClick={onLogin} className="btn-primary mt-8 px-8 text-base">
          {t('ctaLogin')}
        </button>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-bold">{t('latestAnnouncements')}</h2>
          <div className="flex flex-col gap-3">
            {announcements.map((a) => (
              <article key={a.id} className={`app-card p-4 ${a.pinned ? 'ring-1 ring-brass-500' : ''}`}>
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className={`pill ${CATEGORY_COLORS[a.category]}`}>{a.category}</span>
                  {a.pinned && <span className="pill bg-brass-500 !text-white">📌 {t('pinned')}</span>}
                </div>
                <h3 className="font-bold">{a.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm opacity-75">{a.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-xl font-bold">{t('upcomingSessions')}</h2>
          <div className="flex flex-col gap-3">
            {sessions.map((s) => (
              <article key={s.id} className="app-card p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="pill bg-petrol-100 text-petrol-800 dark:bg-petrol-800 dark:text-petrol-100">{s.level}</span>
                  <span className="pill bg-mist-200 text-mist-900 dark:bg-mist-800 dark:text-mist-100">{s.format}</span>
                </div>
                <h3 className="font-bold">{lang === 'ar' && s.arabic_title ? s.arabic_title : s.title}</h3>
                <p className="text-sm opacity-70">
                  {new Date(s.starts_at).toLocaleString(lang === 'ar' ? 'ar' : 'en', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-16 rounded-2xl bg-petrol-700 p-10 text-center text-white shadow-lg dark:bg-petrol-800">
        <h2 className="text-2xl font-extrabold">{t('finalCta')}</h2>
        <button onClick={onLogin} className="btn-accent mt-6 px-8">
          {t('ctaLogin')}
        </button>
      </section>
    </div>
  )
}

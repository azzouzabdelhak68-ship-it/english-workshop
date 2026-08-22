import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Profile } from '../lib/types'
import { Banner } from '../components/ui'

export function RankingsView() {
  const { t, lang } = useApp()
  const [tab, setTab] = useState<'weekly' | 'alltime'>('alltime')
  const [rows, setRows] = useState<Profile[]>([])

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('*')
      .order('points', { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as Profile[]) ?? []))
  }, [])

  const sorted = tab === 'alltime' ? rows : rows
  const podium = sorted.slice(0, 3)
  const rest = sorted.slice(3)
  const podiumStyles = ['from-brass-400 to-brass-600', 'from-mist-300 to-mist-500', 'from-brass-700 to-brass-900']

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-10">
      <div className="mb-6 flex gap-2 rounded-full bg-mist-100 p-1 dark:bg-mist-800">
        {(['weekly', 'alltime'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`min-h-[44px] flex-1 rounded-full text-sm font-bold transition ${
              tab === k ? 'bg-petrol-700 !text-white shadow' : 'opacity-70'
            }`}
          >
            {k === 'weekly' ? t('weeklyLeaderboard') : t('allTimeCumulative')}
          </button>
        ))}
      </div>

      {tab === 'weekly' && (
        <div className="mb-4">
          <Banner kind="info">{t('weeklyNotImplemented')}</Banner>
        </div>
      )}

      <div className="mb-8 grid grid-cols-3 items-end gap-2">
        {[podium[1], podium[0], podium[2]].map((p, i) => {
          if (!p) return <div key={i} />
          const place = p.id === podium[0]?.id ? 1 : p.id === podium[1]?.id ? 2 : 3
          return (
            <div
              key={p.id}
              className={`app-card animate-bounceIn bg-gradient-to-b ${podiumStyles[place - 1]} p-4 !text-white`}
              style={{ order: i }}
            >
              <p className="text-center text-3xl">{place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}</p>
              <p className="mt-1 truncate text-center text-2xl">{p.avatar}</p>
              <p className="truncate text-center text-sm font-bold">{p.nickname}</p>
              <p className="text-center text-xs opacity-90">
                {place === 1 ? p.points : Math.max(p.points, 0).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en')} {t('points')}
              </p>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        {rest.map((p, idx) => (
          <div key={p.id} className="app-card flex items-center gap-3 px-4 py-3">
            <span className="w-7 text-center font-extrabold opacity-50">#{idx + 4}</span>
            <span className="text-xl">{p.avatar}</span>
            <span className="min-w-0">
              <span className="block truncate font-bold">{p.nickname}</span>
              <span className="hidden text-xs opacity-60 sm:block">{p.display_name}</span>
            </span>
            <span className="pill ms-auto hidden bg-petrol-100 !text-xs text-petrol-800 md:inline dark:bg-petrol-800 dark:!text-petrol-100">{p.level}</span>
            <span className="pill bg-brass-100 !text-xs text-brass-800 dark:bg-brass-900 dark:!text-brass-200">🔥 {p.streak}d</span>
            <span className="font-extrabold">
              {p.points} <span className="text-xs opacity-60">{t('points')}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

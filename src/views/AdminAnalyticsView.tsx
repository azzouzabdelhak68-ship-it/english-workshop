import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { AdminOverviewStats, AdminSessionReport, AdminStudentProgress, ModerationReport } from '../lib/types'
import { Banner } from '../components/ui'

export function AdminAnalyticsView() {
  const { t } = useApp()
  const [overview, setOverview] = useState<AdminOverviewStats | null>(null)
  const [students, setStudents] = useState<AdminStudentProgress[]>([])
  const [sessionsRep, setSessionsRep] = useState<AdminSessionReport[]>([])
  const [reports, setReports] = useState<ModerationReport[]>([])

  useEffect(() => {
    void reloadAll()
  }, [])

  async function reloadAll() {
    const [o, s, sr, r] = await Promise.all([
      supabase.from('admin_overview_stats').select('*').single(),
      supabase.from('admin_student_progress').select('*').order('points', { ascending: false }).limit(50),
      supabase.from('admin_session_report').select('*').order('starts_at', { ascending: false }).limit(30),
      supabase.from('moderation_reports').select('*').eq('status', 'open').order('created_at', { ascending: false })
    ])
    setOverview((o.data as AdminOverviewStats) ?? null)
    setStudents((s.data as AdminStudentProgress[]) ?? [])
    setSessionsRep((sr.data as AdminSessionReport[]) ?? [])
    setReports((r.data as ModerationReport[]) ?? [])
  }

  async function refreshStats() {
    await supabase.rpc('refresh_admin_stats_rpc')
    void reloadAll()
  }

  async function triage(id: string, status: 'reviewed' | 'dismissed') {
    await supabase.from('moderation_reports').update({ status }).eq('id', id)
    void reloadAll()
  }

  const minsAgo = overview ? Math.max(0, Math.round((Date.now() - new Date(overview.refreshed_at).getTime()) / 60000)) : null

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:pb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">📊 {t('overviewCards')}</h2>
        <div className="flex items-center gap-2 text-xs opacity-70">
          {minsAgo !== null && <span>{t('statsUpdatedAt', { mins: minsAgo })}</span>}
          <button onClick={refreshStats} className="btn-secondary !min-h-[36px] px-3 py-1.5 text-xs">
            ↻ {t('refreshStats')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon="👥" label={t('totalStudents')} value={overview?.total_students ?? '—'} />
        <StatCard icon="🟢" label={t('activeToday')} value={overview?.active_today ?? '—'} />
        <StatCard icon="📅" label={t('upcomingSessionsCard')} value={overview?.upcoming_sessions ?? '—'} />
        <StatCard icon="⚑" label={t('reportedItems')} value={overview?.reported_items ?? '—'} />
      </div>

      {reports.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-2 font-bold">⚑ {t('moderationQueue')}</h3>
          <div className="flex flex-col gap-2">
            {reports.map((r) => (
              <div key={r.id} className="app-card flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="pill bg-mist-200 !text-mist-900 dark:bg-mist-800 dark:!text-mist-100">{r.message_source}</span>
                <code className="truncate text-xs opacity-60">{r.message_id.slice(0, 12)}…</code>
                <time className="text-xs opacity-60">{new Date(r.created_at).toLocaleString()}</time>
                <span className="ms-auto flex gap-2">
                  <button onClick={() => void triage(r.id, 'reviewed')} className="btn-secondary !min-h-[36px] px-3 py-1 text-xs">
                    ✓ {t('markReviewed')}
                  </button>
                  <button onClick={() => void triage(r.id, 'dismissed')} className="btn-secondary !min-h-[36px] px-3 py-1 text-xs !text-red-700 dark:!text-red-400">
                    ✕ {t('dismissReport')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h3 className="mb-2 font-bold">📈 {t('perStudentProgress')}</h3>
        <div className="app-card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-start text-xs uppercase opacity-60" style={{ borderColor: 'var(--border)' }}>
                <th className="p-3 text-start">Student</th>
                <th className="p-3 text-start">{t('levelLabel')}</th>
                <th className="p-3 text-start">{t('points')}</th>
                <th className="p-3 text-start">🔥</th>
                <th className="p-3 text-start">{t('attendanceCol')}</th>
                <th className="p-3 text-start">{t('tabHomework')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <td className="p-3 font-semibold">
                    {s.avatar} {s.nickname}
                  </td>
                  <td className="p-3">{s.level}</td>
                  <td className="p-3 font-bold">{s.points}</td>
                  <td className="p-3">{s.streak}d</td>
                  <td className="p-3">{s.total_checkins}</td>
                  <td className="p-3">{s.homework_submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h3 className="mb-2 font-bold">🗓 {t('perSessionReport')}</h3>
        <div className="flex flex-col gap-2">
          {sessionsRep.map((s) => (
            <div key={s.session_id} className="app-card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
              <strong>{s.title}</strong>
              <span className="text-xs opacity-65">{new Date(s.starts_at).toLocaleDateString()}</span>
              <span className={`pill ${s.ended_at ? 'bg-red-100 !text-red-900 dark:bg-red-900/40 dark:!text-red-100' : 'bg-emerald-100 !text-emerald-900 dark:bg-emerald-900/40 dark:!text-emerald-100'}`}>
                {s.ended_at ? t('sessionEndedLabel') : t('liveStatus')}
              </span>
              <span className="ms-auto text-xs">
                🎟 {s.rsvps} • ✅ {s.attendance} • ⭐ {s.avg_rating ?? '—'} ({s.rating_responses})
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Banner kind="info">{t('printDeferred')}</Banner>
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="app-card p-4">
      <p className="text-2xl">{icon}</p>
      <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide opacity-60">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
    </div>
  )
}

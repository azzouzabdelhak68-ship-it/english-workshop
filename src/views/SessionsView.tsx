import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Checkin, Profile, Rsvp, RatingAggregate, Session, SessionRating } from '../lib/types'
import { Modal, Banner } from '../components/ui'
import { downloadIcs, googleCalendarUrl } from '../lib/calendar'
import { fireConfetti } from '../components/Confetti'
import { BreakoutRoomsPanel } from './BreakoutRoomsView'

export function SessionsView({ profile }: { profile: NonNullable<import('../lib/types').Profile> }) {
  const { t, isStaff, refreshProfile } = useApp()
  const [sessions, setSessions] = useState<Session[]>([])
  const [rsvps, setRsvps] = useState<Rsvp[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [qrSession, setQrSession] = useState<Session | null>(null)
  const [hostSession, setHostSession] = useState<Session | null>(null)
  const [breakoutSession, setBreakoutSession] = useState<Session | null>(null)
  const [banner, setBanner] = useState('')
  const [calMenuFor, setCalMenuFor] = useState<string | null>(null)

  useEffect(() => {
    void reload()
    const channel = supabase
      .channel('sessions-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, () => void reload())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  async function reload() {
    const [s, r, c] = await Promise.all([
      supabase.from('sessions').select('*').order('starts_at', { ascending: true }),
      supabase.from('rsvps').select('*'),
      supabase.from('checkins').select('*')
    ])
    setSessions((s.data as Session[]) ?? [])
    setRsvps((r.data as Rsvp[]) ?? [])
    setCheckins((c.data as Checkin[]) ?? [])
  }

  async function toggleRsvp(s: Session) {
    const has = rsvps.some((r) => r.session_id === s.id && r.user_id === profile.id)
    if (has) {
      setRsvps((prev) => prev.filter((r) => !(r.session_id === s.id && r.user_id === profile.id)))
      await supabase.from('rsvps').delete().eq('session_id', s.id).eq('user_id', profile.id)
    } else {
      setRsvps((prev) => [...prev, { session_id: s.id, user_id: profile.id }])
      await supabase.from('rsvps').insert({ session_id: s.id, user_id: profile.id })
    }
    void reload()
  }

  async function checkIn(s: Session) {
    const { error } = await supabase.rpc('record_checkin', { p_session_id: s.id })
    if (!error) {
      setBanner(t('attendanceVerified'))
      fireConfetti()
      setTimeout(() => setBanner(''), 5000)
      void reload()
      void refreshProfile()
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pb-10">
      {banner && (
        <div className="mb-4">
          <Banner>{banner}</Banner>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {sessions.map((s) => {
          const attending = rsvps.some((r) => r.session_id === s.id && r.user_id === profile.id)
          const checked = checkins.filter((c) => c.session_id === s.id)
          const iChecked = checked.some((c) => c.user_id === profile.id)
          const ended = !!s.ended_at
          return (
            <article key={s.id} className="app-card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="pill bg-petrol-100 font-bold text-petrol-800 dark:bg-petrol-800 dark:text-petrol-100">{s.level}</span>
                <span className="pill bg-mist-200 text-mist-900 dark:bg-mist-800 dark:text-mist-100">{s.format}</span>
                <span className={`pill ${iChecked ? 'bg-emerald-600 !text-white' : 'bg-brass-100 text-brass-800 dark:bg-brass-900 dark:text-brass-200'}`}>
                  ✓ {t('checkedInCount', { count: checked.length })}
                </span>
                {ended && <span className="pill bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">{t('sessionEndedLabel')}</span>}
              </div>
              <h3 className="text-lg font-extrabold">{s.title}</h3>
              {s.arabic_title && <p dir="rtl" className="font-arabic text-sm opacity-75">{s.arabic_title}</p>}
              {s.description && <p className="mt-1 text-sm opacity-80">{s.description}</p>}
              <p className="mt-2 text-sm opacity-70">
                📅 {new Date(s.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} • ⏱{' '}
                {s.duration_minutes} min{s.location ? ` • 📍 ${s.location}` : ''}
              </p>
              <p className="text-xs opacity-60">{t('attendees', { count: rsvps.filter((r) => r.session_id === s.id).length })}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {!ended && (
                  <>
                    <button onClick={() => void toggleRsvp(s)} className={attending ? 'btn-secondary' : 'btn-primary'}>
                      {attending ? t('rsvpConfirmed') : t('rsvpNow')}
                    </button>
                    {!iChecked && (
                      <button onClick={() => setQrSession(s)} className="btn-secondary">
                        📷 {t('scanQrCheckin')}
                      </button>
                    )}
                    {s.meeting_link && (
                      <a href={s.meeting_link} target="_blank" rel="noreferrer" className="btn-secondary no-underline">
                        🔗 {t('joinVirtualLink')}
                      </a>
                    )}
                  </>
                )}

                <div className="relative">
                  <button onClick={() => setCalMenuFor(calMenuFor === s.id ? null : s.id)} className="btn-secondary">
                    🗓 {t('addToCalendar')}
                  </button>
                  {calMenuFor === s.id && (
                    <div className="app-card absolute top-12 z-20 w-52 p-2 shadow-lg" onMouseLeave={() => setCalMenuFor(null)}>
                      <button
                        className="w-full rounded-lg px-3 py-2.5 text-start text-sm hover:bg-mist-100 dark:hover:bg-mist-800"
                        onClick={() => {
                          downloadIcs(s)
                          setCalMenuFor(null)
                        }}
                      >
                        ⬇️ {t('downloadIcs')}
                      </button>
                      <a
                        href={googleCalendarUrl(s)}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg px-3 py-2.5 text-sm no-underline hover:bg-mist-100 dark:hover:bg-mist-800"
                      >
                        📆 {t('googleCalendar')}
                      </a>
                    </div>
                  )}
                </div>

                {isStaff && (
                  <>
                    <button onClick={() => setHostSession(s)} className="btn-accent">
                      🎛 {t('hostControlPanel')}
                    </button>
                    {!ended && (
                      <button
                        onClick={async () => {
                          await supabase.from('sessions').update({ ended_at: new Date().toISOString() }).eq('id', s.id)
                          void reload()
                        }}
                        className="btn-secondary !text-red-700 dark:!text-red-400"
                      >
                        ⏹ {t('endSession')}
                      </button>
                    )}
                  </>
                )}
              </div>

              <RatingCard session={s} profileId={profile.id} />
            </article>
          )
        })}
      </div>

      {qrSession && <QrModal session={qrSession} onClose={() => setQrSession(null)} onVerified={() => checkIn(qrSession)} />}
      {hostSession && <HostPanel session={hostSession} onClose={() => setHostSession(null)} onOpenBreakout={() => { setBreakoutSession(hostSession); setHostSession(null) }} />}
      {breakoutSession && <BreakoutRoomsPanel session={breakoutSession} profileId={profile.id} onClose={() => setBreakoutSession(null)} />}
    </div>
  )
}

function QrModal({ session, onClose, onVerified }: { session: Session; onClose: () => void; onVerified: () => void }) {
  const { t } = useApp()
  const [src, setSrc] = useState('')
  const [link] = useState(
    () => `${window.location.origin}${window.location.pathname}#/checkin?session=${session.id}&t=${Date.now()}`
  )

  useEffect(() => {
    void QRCode.toDataURL(link, { width: 260, margin: 1, errorCorrectionLevel: 'H' }).then(setSrc)
  }, [link])

  return (
    <Modal open onClose={onClose} title={t('scanQrCheckin')}>
      <div className="flex flex-col items-center gap-4">
        {src && <img src={src} alt="QR code" width={260} height={260} className="rounded-xl bg-white p-2 shadow" />}
        <code className="max-w-full break-all rounded-lg bg-mist-100 px-3 py-2 text-xs dark:bg-mist-900">{link}</code>
        <button
          className="btn-primary w-full"
          onClick={() => {
            onVerified()
            onClose()
          }}
        >
          📱 {t('simulateScan')}
        </button>
      </div>
    </Modal>
  )
}

export function RatingCard({ session, profileId }: { session: Session; profileId: string }) {
  const { t } = useApp()
  const ended = !!session.ended_at
  const [mine, setMine] = useState<SessionRating | null>(null)
  const [rating, setRating] = useState(0)
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!ended) return
    void supabase
      .from('session_ratings')
      .select('*')
      .eq('session_id', session.id)
      .eq('student_id', profileId)
      .single()
      .then(({ data }) => {
        if (data) {
          setMine(data)
          setDone(true)
        }
      })
  }, [ended, session.id, profileId])

  if (!ended) return null

  async function submit() {
    if (!rating) return
    await supabase.from('session_ratings').insert({
      session_id: session.id,
      student_id: profileId,
      rating,
      note: note.trim() || null
    })
    setDone(true)
  }

  if (mine) {
    return (
      <div className="app-card mt-4 bg-emerald-50 p-4 dark:bg-emerald-900/20">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          {t('ratingThanks')} — {t('yourRating')}: {'⭐'.repeat(mine.rating)}
        </p>
        {mine.note && <p className="mt-1 text-xs opacity-70">\"{mine.note}\"</p>}
      </div>
    )
  }

  return (
    <div className="app-card mt-4 bg-mist-50 p-4 dark:bg-mist-900/40">
      {done ? (
        <p className="text-sm font-semibold">{t('ratingThanks')}</p>
      ) : (
        <>
          <p className="mb-2 text-sm font-bold">⭐ {t('rateThisSession')}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={`${n} stars`} onClick={() => setRating(n)} className="min-h-[44px] min-w-[44px] text-2xl">
                {n <= rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>
          <textarea rows={2} className="input-base mt-2" placeholder={t('ratingNotePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
          <button disabled={!rating} onClick={submit} className="btn-primary mt-2 w-full disabled:opacity-50">
            {t('submit')}
          </button>
        </>
      )}
    </div>
  )
}

export function StaffRatingsSummary({ sessionId }: { sessionId: string }) {
  const { t } = useApp()
  const [agg, setAgg] = useState<RatingAggregate | null>(null)
  useEffect(() => {
    void supabase
      .from('session_rating_aggregates')
      .select('*')
      .eq('session_id', sessionId)
      .single()
      .then(({ data }) => setAgg((data as RatingAggregate) ?? null))
  }, [sessionId])
  if (!agg || agg.response_count === 0) return <p className="mt-3 text-xs opacity-60">{t('noRatingsYet')}</p>
  return (
    <div className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
      <p className="font-bold">
        ⭐ {t('avgRating')}: {agg.average_rating} ({agg.response_count})
      </p>
      {!!agg.notes?.length && (
        <ul className="mt-1 list-disc ps-5 text-xs opacity-80">
          {agg.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HostPanel({ session, onClose, onOpenBreakout }: { session: Session; onClose: () => void; onOpenBreakout: () => void }) {
  const { t } = useApp()
  const [members, setMembers] = useState<Profile[]>([])
  const [query, setQuery] = useState('')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const loadChecked = useMemo(
    () => async () => {
      const { data } = await supabase
        .from('checkins')
        .select('*,profiles!inner(nickname,id)')
        .eq('session_id', session.id)
      const ids = new Set(((data as Record<string, Record<string, string>>[]) ?? []).map((d) => d.profiles.id))
      setCheckedIds(ids)
    },
    [session.id]
  )

  useEffect(() => {
    void loadChecked()
    void supabase.from('profiles').select('*').order('nickname').then(({ data }) => setMembers((data as Profile[]) ?? []))
    const channel = supabase.channel(`checkins-${session.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, () => void loadChecked()).subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadChecked, session.id])

  const filtered = members.filter(
    (m) =>
      (m.nickname ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (m.display_name ?? '').toLowerCase().includes(query.toLowerCase())
  )

  async function manualAdd(m: Profile) {
    await supabase.rpc('staff_check_in', { p_session_id: session.id, p_user_id: m.id })
    await loadChecked()
  }

  const now = Date.now()
  const start = new Date(session.starts_at).getTime()
  const status = now >= start && now <= start + 15 * 60_000 ? t('liveStatus') : now < start ? t('graceOpen') : t('liveStatus')

  return (
    <Modal open onClose={onClose} title={t('hostControlPanel')} wide>
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <HostQr sessionId={session.id} />
          <p className="rounded-lg bg-emerald-600 px-4 py-1 text-sm font-bold text-white">{status}</p>
          <div className="grid w-full grid-cols-2 gap-2 text-center">
            <div className="app-card p-2">
              <p className="text-xs opacity-60">{t('checkedInMembers')}</p>
              <p className="text-xl font-extrabold">{checkedIds.size}</p>
            </div>
            <div className="app-card p-2">
              <p className="text-xs opacity-60">RSVP</p>
              <RsvpCount sessionId={session.id} />
            </div>
          </div>
          <button onClick={onOpenBreakout} className="btn-secondary w-full">
            👥 {t('openBreakoutRooms')}
          </button>
        </div>

        <div>
          <input className="input-base mb-3" placeholder={t('manualAdd')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {(query ? filtered : members).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-mist-100 dark:hover:bg-mist-800">
                <span className="truncate text-sm font-semibold">
                  {m.avatar} {m.nickname}
                </span>
                {checkedIds.has(m.id) ? (
                  <span className="pill bg-emerald-600 !text-white">✓</span>
                ) : (
                  <button onClick={() => void manualAdd(m)} className="btn-secondary !min-h-[36px] px-3 py-1 text-xs">
                    {t('addMember')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[...checkedIds].map((id) => {
              const m = members.find((x) => x.id === id)
              return (
                <span key={id} className="pill bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">
                  {m?.avatar ?? '👤'} {m?.nickname ?? id.slice(0, 6)}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function HostQr({ sessionId }: { sessionId: string }) {
  const [src, setSrc] = useState('')
  const [link] = useState(
    () => `${window.location.origin}${window.location.pathname}#/checkin?session=${sessionId}&t=${Date.now()}`
  )
  useEffect(() => {
    void QRCode.toDataURL(link, { width: 260, margin: 1, errorCorrectionLevel: 'H' }).then(setSrc)
  }, [link])
  return src ? <img src={src} alt="session QR" width={260} height={260} className="rounded-xl bg-white p-2 shadow-lg" /> : null
}

function RsvpCount({ sessionId }: { sessionId: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    void supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('session_id', sessionId).then(({ count }) => setCount(count ?? 0))
  }, [sessionId])
  return <p className="text-xl font-extrabold">{count}</p>
}

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Modal } from './ui'
import { AVATAR_PRESETS, LEVELS, placementTestAnswerCorrect } from '../lib/constants'
import type { Profile, Role } from '../lib/types'

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, profile, refreshProfile, isStaff } = useApp()
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [level, setLevel] = useState(profile?.level ?? 'Beginner')
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATAR_PRESETS[0])
  const [goals, setGoals] = useState(profile?.learning_goals ?? '')
  const [showPlacement, setShowPlacement] = useState(false)
  const [placementResult, setPlacementResult] = useState('')
  const [showRoles, setShowRoles] = useState(false)
  const [freezeMsg, setFreezeMsg] = useState('')
  const [saved, setSaved] = useState('')

  if (!profile) return null

  async function save() {
    setSaved('')
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: nickname.trim(), level, avatar, learning_goals: goals || null })
      .eq('id', profile!.id)
    if (error) setSaved(t('profileSaveFailed'))
    else {
      setSaved(t('profileSaved'))
      await refreshProfile()
    }
  }

  async function buyFreeze() {
    setFreezeMsg('')
    const { data, error } = await supabase.rpc('grant_streak_freeze')
    if (error || !data) setFreezeMsg(t('freezeFailed'))
    else {
      setFreezeMsg(t('freezeBought'))
      await refreshProfile()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('profileModalTitle')}>
      <div className="flex items-center gap-4">
        <span className="text-5xl">{profile.avatar}</span>
        <div>
          <p className="text-lg font-extrabold">{profile.nickname}</p>
          <p className="text-sm opacity-75">{t('totalPoints', { points: profile.points })}</p>
          <p className="text-sm opacity-75">
            {t('dayStreak', { streak: profile.streak })} • 🧊 {profile.streak_freezes}
          </p>
        </div>
      </div>

      {profile.role === 'admin' && (
        <button onClick={() => setShowRoles(true)} className="btn-secondary mt-4 w-full">
          👑 {t('manageRoles')}
        </button>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('nicknameLabel')}
          <input className="input-base" value={nickname} onChange={(e) => setNickname(e.target.value)} minLength={2} />
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold">{t('levelLabel')}</p>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                onClick={() => setLevel(lv)}
                className={`btn-secondary min-h-[44px] py-2 text-sm ${level === lv ? '!bg-petrol-700 !text-white ring-2 ring-brass-500' : ''}`}
              >
                {lv}
              </button>
            ))}
          </div>
          {placementResult && (
            <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{placementResult}</p>
          )}
          {!showPlacement ? (
            <button onClick={() => setShowPlacement(true)} className="mt-2 text-xs font-semibold underline">
              {t('placementTestBtn')}
            </button>
          ) : (
            <div className="app-card mt-2 flex flex-wrap gap-2 p-3">
              {['finished', 'had finished', 'was finishing'].map((opt) => (
                <button
                  key={opt}
                  className="btn-secondary min-h-[40px] px-3 py-1 text-xs"
                  onClick={() => {
                    if (placementTestAnswerCorrect(opt)) {
                      setLevel('Intermediate')
                      setPlacementResult(t('scoreSetIntermediate'))
                    }
                    setShowPlacement(false)
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">{t('avatarLabel')}</p>
          <div className="grid grid-cols-5 gap-2">
            {AVATAR_PRESETS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                aria-label={`avatar ${a}`}
                className={`app-card flex aspect-square items-center justify-center text-2xl ${avatar === a ? 'ring-2 ring-brass-500' : ''}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('goalsLabel')}
          <textarea rows={2} className="input-base" value={goals ?? ''} onChange={(e) => setGoals(e.target.value)} />
        </label>

        <div className="app-card p-3">
          <p className="text-xs opacity-80">{t('buyFreeze')}</p>
          <button onClick={buyFreeze} className="btn-accent mt-2 w-full py-2 text-sm">
            {t('buyFreezeAction')}
          </button>
          {freezeMsg && <p className="mt-2 text-xs font-semibold">{freezeMsg}</p>}
        </div>

        {saved && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{saved}</p>}

        <div className="flex gap-2">
          <button onClick={save} className="btn-primary flex-1">
            {t('save')}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
        </div>
        {isStaff && <p className="text-center text-xs opacity-60">role: {profile.role}</p>}
      </div>

      <RoleManager open={showRoles} onClose={() => setShowRoles(false)} />
    </Modal>
  )
}

function RoleManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useApp()
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState<Profile[]>([])

  async function search(q: string) {
    setQuery(q)
    if (q.trim().length < 2) {
      setMembers([])
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`nickname.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10)
    setMembers((data as Profile[]) ?? [])
  }

  async function assign(id: string, role: Role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    await search(query)
  }

  return (
    <Modal open={open} onClose={onClose} title={t('roleManager')} wide>
      <input className="input-base mb-4" value={query} onChange={(e) => void search(e.target.value)} placeholder={t('memberSearch')} />
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border p-2" style={{ borderColor: 'var(--border)' }}>
            <span className="truncate text-sm font-semibold">
              {m.avatar} {m.nickname} <span className="opacity-60">({m.email})</span>
            </span>
            <select value={m.role} onChange={(e) => void assign(m.id, e.target.value as Role)} className="input-base !min-h-[36px] w-auto py-1 text-xs">
              {(['student', 'host', 'organizer', 'admin'] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function LogoutButton() {
  const { t } = useApp()
  return (
    <button
      onClick={() => void supabase.auth.signOut()}
      className="min-h-[44px] rounded-lg px-3 text-sm font-bold text-red-700 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
    >
      {t('logout')}
    </button>
  )
}

export function ProfileChip({ onOpen }: { onOpen: () => void }) {
  const { profile, t } = useApp()
  if (!profile) return null
  return (
    <button
      onClick={onOpen}
      className="flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition hover:bg-mist-100 dark:border-mist-700 dark:hover:bg-mist-800"
      style={{ borderColor: 'var(--border)' }}
    >
      <span>{profile.avatar}</span>
      <span className="max-w-[120px] truncate font-bold">{profile.nickname}</span>
      <span className="hidden opacity-70 sm:inline">
        {profile.points} {t('points')} • 🔥 {profile.streak}d
      </span>
    </button>
  )
}

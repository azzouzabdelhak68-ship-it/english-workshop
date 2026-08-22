import { useState } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Modal } from './ui'

const DEMO_ACCOUNTS = [
  { label: '🧑‍🏫 Staff demo account', email: 'coach@demo.test' },
  { label: '🎓 Student demo account', email: 'omar@demo.test' }
]

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useApp()
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
        else onClose()
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setError(error.message)
        else {
          setInfo(t('verifyEmailBody'))
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) setError(error.message)
        else setInfo(t('resetSent'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    if (isDemoMode) {
      setError(t('demoNoGoogle'))
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'signup' ? t('signup') : mode === 'reset' ? t('resetPassword') : t('login')}>
      {isDemoMode && mode === 'login' && (
        <div className="mb-4 rounded-lg border border-brass-400 bg-brass-50 p-3 text-xs dark:border-brass-700 dark:bg-brass-900/40">
          <p className="font-bold">🧪 Demo accounts (password: Passw0rd!)</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email)
                  setPassword('Passw0rd!')
                }}
                className="btn-secondary !min-h-[38px] justify-between px-3 py-1.5 text-xs"
              >
                <span>{a.label}</span>
                <span className="opacity-60">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('email')}
          <input
            type="email"
            required
            autoComplete="email"
            className="input-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode !== 'reset' && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('password')}
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="input-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
        {info && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{info}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? t('loading') : mode === 'reset' ? t('resetPassword') : t('login')}
        </button>
      </form>
      <div className="my-4 h-px bg-[color:var(--border)]" />
      <button onClick={handleGoogle} disabled={busy} className="btn-secondary w-full">
        {t('continueWithGoogle')}
      </button>
      <div className="mt-4 flex flex-col gap-2 text-center text-sm">
        <button
          type="button"
          className="font-semibold text-petrol-700 underline-offset-2 hover:underline dark:text-petrol-300"
          onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
        >
          {mode === 'signup' ? t('haveAccount') : t('needAccount')}
        </button>
        <button
          type="button"
          className="text-xs opacity-70 underline-offset-2 hover:underline"
          onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}
        >
          {t('forgotPassword')}
        </button>
      </div>
    </Modal>
  )
}

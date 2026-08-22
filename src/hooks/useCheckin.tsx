import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useHashRoute } from '../lib/router'
import { fireConfetti } from '../components/Confetti'

/**
 * Handles the QR check-in deep link (#/checkin?session=<id>&t=<ts>) — reachable
 * directly by URL or via the simulated camera scan. Renders the emerald
 * success banner at the top of the authenticated app.
 */
export function CheckinDeepLinkHandler() {
  const { t, refreshProfile } = useApp()
  const route = useHashRoute()
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')

  const sessionId = route.path === '/checkin' ? route.params.get('session') : null

  useEffect(() => {
    if (!sessionId) return
    void (async () => {
      const { error } = await supabase.rpc('record_checkin', { p_session_id: sessionId })
      setState(error ? 'err' : 'ok')
      if (!error) {
        fireConfetti()
        void refreshProfile()
      }
    })()
  }, [sessionId, refreshProfile])

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => {
      setState('idle')
      window.location.hash = ''
    }, 5000)
    return () => clearTimeout(timer)
  }, [state])

  if (!sessionId || state === 'idle') return null

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4">
      {state === 'ok' ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
          ✓ {t('attendanceVerified')}
        </div>
      ) : (
        <div className="rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-sm font-bold text-red-900 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100">
          {t('errorGeneric')}
        </div>
      )}
    </div>
  )
}

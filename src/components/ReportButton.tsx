import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

/**
 * Shared Report control (F3 scope decision): used by main chat AND breakout rooms.
 * One moderation queue, one UI — never build a second report design.
 */
export function ReportButton({
  messageSource,
  messageId,
  compact
}: {
  messageSource: 'chat' | 'breakout'
  messageId: string
  compact?: boolean
}) {
  const { t, authSession } = useApp()
  const [reported, setReported] = useState(false)
  const [err, setErr] = useState('')

  async function report() {
    setErr('')
    if (!authSession) {
      setErr(t('loginRequired'))
      return
    }
    const { error } = await supabase
      .from('moderation_reports')
      .insert({ message_source: messageSource, message_id: messageId, reporter_id: authSession.user.id })
    if (error) {
      setErr(t('errorGeneric'))
      return
    }
    setReported(true)
  }

  if (reported) return <span className="text-[10px] font-semibold opacity-60">{t('reportSubmitted')}</span>

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => void report()}
        className={`font-semibold text-red-700 underline-offset-2 hover:underline dark:text-red-400 ${
          compact ? 'text-[10px]' : 'text-xs'
        }`}
      >
        ⚑ {t('reportMessage')}
      </button>
      {err && <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">{err}</span>}
    </div>
  )
}

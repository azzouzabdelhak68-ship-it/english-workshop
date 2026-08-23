import { useApp } from '../../context/AppContext'
import type { TranscriptMsg } from '../../lib/types'

interface Props {
  msgs: TranscriptMsg[]
  busy: boolean
  hasContent: boolean
}

export function ChatStream({ msgs, busy, hasContent }: Props) {
  const { t } = useApp()
  return (
    <div aria-live="polite" className="mt-4 space-y-1.5">
      {!hasContent && !busy && (
        <div className="py-10 text-center opacity-70">
          <p className="text-5xl">🎬</p>
          <p className="mt-3 text-lg font-extrabold">{t('emptyHeroTitle')}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed">{t('emptyHeroBody')}</p>
          <p className="mt-4 font-mono text-[11px] opacity-50">{t('shortcutsHint')}</p>
        </div>
      )}

      {msgs.map((m) => {
        if (m.role === 'user') {
          return (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-ee-sm bg-petrol-700 px-4 py-2 text-sm text-white rtl:rounded-es-sm rtl:rounded-ee-2xl dark:bg-petrol-600">
                {m.raw}
              </p>
            </div>
          )
        }
        const text = m.key ? t(m.key as never, m.vars as never) : m.raw ?? ''
        return (
          <p
            key={m.id}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              m.kind === 'err'
                ? 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100'
                : 'bg-mist-200 text-mist-900 dark:bg-mist-800 dark:text-mist-100'
            }`}
          >
            {text}
          </p>
        )
      })}

      {busy && msgs.every((m) => m.role !== 'sys' || m.kind !== 'phase') && (
        <div className="space-y-1.5 py-1">
          <div className="h-3 w-[90%] animate-pulse rounded-full bg-mist-200/70 dark:bg-mist-700/60" />
          <div className="h-3 w-[75%] animate-pulse rounded-full bg-mist-200/70 [animation-delay:80ms] dark:bg-mist-700/60" />
          <div className="h-3 w-[60%] animate-pulse rounded-full bg-mist-200/70 [animation-delay:160ms] dark:bg-mist-700/60" />
        </div>
      )}
    </div>
  )
}

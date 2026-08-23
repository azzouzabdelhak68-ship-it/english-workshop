import { useApp } from '../../context/AppContext'
import { sumTimings } from '../../lib/ai-chat'
import type { MovieSessionResult } from '../../lib/types'
import { ActivityItem } from './ActivityItem'
import { VideoPreview } from './VideoPreview'

interface Props {
  result: MovieSessionResult
  presetLabel: string | null
  published: boolean
  busy: boolean
  editingIdx: number | null
  onEdit(idx: number): void
  onCancelEdit(): void
  onSubmitEdit(instruction: string): void
  onPublish(): void
}

export function SessionResultCard(p: Props) {
  const { t } = useApp()
  const s = p.result.session
  const sum = sumTimings(p.result)
  const total = Number(s.duration_minutes) || 0
  const mismatch = sum !== total

  function printWorksheet() {
    window.print()
  }

  return (
    <article className="app-card print-worksheet mt-4 overflow-hidden">
      <header className="flex items-start justify-between gap-3 bg-petrol-700 p-5 !text-white">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">{t('workshopSession')}</p>
          <h3 className="mt-1 text-xl font-extrabold md:text-2xl">{s.title}</h3>
          {s.arabicTitle && (
            <p dir="rtl" className="mt-0.5 font-arabic text-start text-sm opacity-85">{s.arabicTitle}</p>
          )}
          <p className="mt-2 text-sm opacity-85">
            🎬 {t('filmLabel')}: <strong>{s.film}</strong>
            {s.link && (
              <>
                {' • '}
                <a href={s.link} target="_blank" rel="noreferrer" className="underline">{t('watch')}</a>
              </>
            )}
            {' • '}
            🕒 {t('timingMin', { min: s.duration_minutes })}
          </p>
        </div>
        {p.presetLabel && (
          <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">{p.presetLabel}</span>
        )}
      </header>

      <div className="p-4 space-y-4">
        <VideoPreview url={s.link} title={s.film} />

        <p
          role="status"
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
            mismatch
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100'
          }`}
        >
          {mismatch ? '⚠️' : '✓'} {t('timingSumLabel', { sum, total })}
          {mismatch && ` · ${t('timingMismatchWarn')}`}
        </p>

        <ol className="space-y-3">
          {p.result.activities.map((a, i) => (
            <ActivityItem
              key={`${i}-${a.title}`}
              n={i + 1}
              activity={a}
              busy={p.busy}
              editing={p.editingIdx === i}
              onEdit={() => p.onEdit(i)}
              onCancelEdit={p.onCancelEdit}
              onSubmitEdit={p.onSubmitEdit}
            />
          ))}
        </ol>

        <div className="no-print mt-4 flex flex-wrap items-center gap-2">
          <button onClick={p.onPublish} disabled={p.busy || p.published} className="btn-primary min-h-[44px] flex-1 disabled:opacity-60">
            {p.published ? `✓ ${t('sessionCreatedOk')}` : `📅 ${t('createSessionFromDraft')}`}
          </button>
          <button onClick={printWorksheet} aria-label={t('printWorksheet')} className="btn-secondary h-[44px] px-4">
            🖨️
          </button>
        </div>
        <p className="print-footer hidden text-xs" data-print-meta={`${s.title} · ${new Date().toLocaleDateString()}`}>
          {s.link}
        </p>
      </div>
    </article>
  )
}

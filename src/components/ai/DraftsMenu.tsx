import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { DraftMeta } from '../../lib/types'

interface Props {
  open: boolean
  drafts: DraftMeta[]
  activeId: string | null
  busy: boolean
  onOpen(id: string): void
  onNew(): void
  onRename(id: string, title: string): void
  onDuplicate(id: string): void
  onDelete(id: string): void
  onClose(): void
}

type RowMode = 'view' | 'rename' | 'confirm-delete'

export function DraftsMenu(p: Props) {
  const { t } = useApp()
  const [rowModes, setRowModes] = useState<Record<string, RowMode>>({})
  const [renaming, setRenaming] = useState<Record<string, string>>({})
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!p.open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) p.onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') p.onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [p.open])

  if (!p.open) return null

  function relTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return t('relNow')
    if (m < 60) return t('relMin', { n: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t('relHour', { n: h })
    return t('relDay', { n: Math.floor(h / 24) })
  }

  function mode(id: string): RowMode {
    return rowModes[id] ?? 'view'
  }

  function setMode(id: string, m: RowMode) {
    setRowModes((prev) => ({ ...prev, [id]: m }))
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute end-0 z-20 mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-xl border border-mist-200 bg-white p-2 shadow-lg dark:border-mist-700 dark:bg-mist-900"
    >
      <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide opacity-60">{t('draftsTitle')}</p>
      {p.drafts.length === 0 && <p className="px-2 py-4 text-sm opacity-60">{t('emptyDrafts')}</p>}
      {p.drafts.map((d) => (
        <div key={d.id} role="none" className="flex items-center gap-1 rounded-lg px-1 hover:bg-mist-100 dark:hover:bg-mist-800">
          {mode(d.id) === 'view' && (
            <>
              <button
                role="menuitem"
                onClick={() => p.onOpen(d.id)}
                className="min-w-0 flex-1 rounded-md px-2 py-2 text-start"
              >
                <span className="block truncate text-sm font-medium">
                  {d.title}{p.activeId === d.id ? ' •' : ''}
                </span>
                <span className="block text-[11px] opacity-50">
                  {relTime(d.updated_at)}{d.has_result ? ' · 🎬' : ''}
                </span>
              </button>
              <button
                aria-label={t('draftActions')}
                disabled={p.busy}
                onClick={() => setMode(d.id, 'rename') }
                className="grid h-8 w-8 place-items-center rounded-lg text-sm hover:bg-mist-200 dark:hover:bg-mist-700"
              >
                ✏️
              </button>
              <button
                aria-label={t('duplicateDraft')}
                disabled={p.busy}
                onClick={() => p.onDuplicate(d.id)}
                className="grid h-8 w-8 place-items-center rounded-lg text-sm hover:bg-mist-200 dark:hover:bg-mist-700"
              >
                ⧉
              </button>
              <button
                aria-label={t('deleteDraft')}
                disabled={p.busy}
                onClick={() => setMode(d.id, 'confirm-delete')}
                className="grid h-8 w-8 place-items-center rounded-lg text-sm hover:bg-mist-200 dark:hover:bg-mist-700"
              >
                🗑
              </button>
            </>
          )}
          {mode(d.id) === 'rename' && (
            <input
              autoFocus
              className="input-base my-1 h-7 w-full text-sm"
              value={renaming[d.id] ?? d.title}
              onChange={(e) => setRenaming((prev) => ({ ...prev, [d.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  p.onRename(d.id, (renaming[d.id] ?? d.title).trim() || d.title)
                  setMode(d.id, 'view')
                }
                if (e.key === 'Escape') setMode(d.id, 'view')
              }}
              onBlur={() => setMode(d.id, 'view')}
            />
          )}
          {mode(d.id) === 'confirm-delete' && (
            <div className="flex w-full items-center justify-between px-2 py-1 text-sm">
              <span className="opacity-80">{t('confirmDeleteDraft')}</span>
              <span className="flex gap-1">
                <button
                  onClick={() => {
                    p.onDelete(d.id)
                    setMode(d.id, 'view')
                  }}
                  className="rounded-md px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  {t('yesDelete')}
                </button>
                <button
                  onClick={() => setMode(d.id, 'view')}
                  className="rounded-md px-2 py-1 text-xs hover:bg-mist-200 dark:hover:bg-mist-700"
                >
                  {t('keepIt')}
                </button>
              </span>
            </div>
          )}
        </div>
      ))}
      <button onClick={p.onNew} disabled={p.busy} className="btn-secondary mt-1 w-full text-sm">
        ＋ {t('newDraft')}
      </button>
    </div>
  )
}

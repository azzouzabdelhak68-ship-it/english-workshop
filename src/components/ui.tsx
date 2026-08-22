import { useEffect, type ReactNode } from 'react'

export function Modal({
  open,
  onClose,
  title,
  children,
  wide
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-petrol-950/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`app-card animate-bounceIn relative z-10 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto p-6`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            aria-label="close"
            onClick={onClose}
            className="min-h-[32px] min-w-[32px] rounded-lg px-2 text-xl leading-none hover:bg-mist-100 dark:hover:bg-mist-800"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="animate-pulseSoft text-5xl">🎓</div>
      <p className="text-sm font-medium opacity-70">{label}</p>
    </div>
  )
}

export function Banner({ kind = 'ok', children }: { kind?: 'ok' | 'err' | 'info'; children: ReactNode }) {
  const styles =
    kind === 'ok'
      ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-700'
      : kind === 'err'
        ? 'bg-red-100 text-red-900 border-red-300 dark:bg-red-900/40 dark:text-red-100 dark:border-red-700'
        : 'bg-petrol-100 text-petrol-900 border-petrol-300 dark:bg-petrol-800/60 dark:text-petrol-50 dark:border-petrol-600'
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${styles}`}>{children}</div>
}

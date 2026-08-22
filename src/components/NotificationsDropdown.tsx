import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'

export function NotificationsDropdown() {
  const { t, notifications, unreadCount, markAllRead } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={t('notifications')}
        aria-expanded={open}
        onClick={() => {
          if (!open) void markAllRead()
          setOpen(!open)
        }}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-xl transition hover:bg-mist-100 dark:hover:bg-mist-800"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brass-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="app-card absolute end-0 top-12 z-40 max-h-96 w-80 overflow-y-auto p-2 shadow-lg">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm opacity-60">{t('noNotifications')}</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-lg p-3 ${!n.read ? 'bg-petrol-50 dark:bg-petrol-900/60' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {!n.read && <span className="h-2 w-2 rounded-full bg-petrol-600" />}
                  <p className="text-sm font-bold">{n.title}</p>
                </div>
                {n.body && <p className="mt-1 ps-4 text-xs opacity-75">{n.body}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

import { useApp } from '../context/AppContext'
import { NotificationsDropdown } from './NotificationsDropdown'
import { LogoutButton, ProfileChip } from './ProfileModal'

export type TabKey =
  | 'announcements'
  | 'sessions'
  | 'games'
  | 'homework'
  | 'library'
  | 'rankings'
  | 'chat'
  | 'aichat'
  | 'analytics'

export function Navbar({
  activeTab,
  onTab,
  onProfile,
  onLogin,
  authenticated
}: {
  activeTab: TabKey | null
  onTab: (t: TabKey) => void
  onProfile: () => void
  onLogin: () => void
  authenticated: boolean
}) {
  const { t, lang, setLang, toggleDark } = useApp()

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'announcements', label: t('tabAnnouncements') },
    { key: 'sessions', label: t('tabSessions') },
    { key: 'games', label: t('tabGames') },
    { key: 'homework', label: t('tabHomework') },
    { key: 'library', label: t('tabLibrary') },
    { key: 'rankings', label: t('tabRankings') },
    { key: 'chat', label: t('tabChat') }
  ]

  return (
    <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--background) 85%, transparent)' }}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <button className="flex items-center gap-2" onClick={() => onTab('announcements')}>
          <span className="text-2xl">🎓</span>
          <span className="flex flex-col items-start leading-tight">
            <span className="flex items-center gap-2 font-extrabold">
              {t('appName')}
              <span className="pill bg-petrol-700 text-white">PWA v1.0</span>
            </span>
            <span className="hidden text-xs opacity-60 sm:block">{t('tagline')}</span>
          </span>
        </button>

        <div className="ms-auto flex items-center gap-1.5">
          <button
            aria-label="language"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-lg transition hover:bg-mist-100 dark:hover:bg-mist-800"
          >
            🌐 <span className="ms-1 text-xs font-bold">{lang === 'en' ? 'AR' : 'EN'}</span>
          </button>
          <button
            aria-label="theme"
            onClick={toggleDark}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-lg transition hover:bg-mist-100 dark:hover:bg-mist-800"
          >
            🌙
          </button>
          {authenticated ? (
            <>
              <NotificationsDropdown />
              <ProfileChip onOpen={onProfile} />
              <LogoutButton />
            </>
          ) : (
            <button onClick={onLogin} className="btn-primary !min-h-[44px] py-2">
              {t('ctaLogin')}
            </button>
          )}
        </div>
      </div>

      {authenticated && (
        <nav className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-4 pb-2 md:flex">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => onTab(tb.key)}
              className={`min-h-[40px] whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${
                activeTab === tb.key ? 'bg-petrol-700 text-white shadow' : 'hover:bg-mist-100 dark:hover:bg-mist-800'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  )
}

export function BottomNav({ activeTab, onTab, onProfile }: { activeTab: TabKey; onTab: (t: TabKey) => void; onProfile: () => void }) {
  const { t } = useApp()
  const items: { key: TabKey | 'profile'; icon: string; label: string }[] = [
    { key: 'announcements', icon: '🏠', label: t('navHome') },
    { key: 'sessions', icon: '📅', label: t('navSchedule') },
    { key: 'games', icon: '🎮', label: t('tabGames') },
    { key: 'profile', icon: '👤', label: t('navProfile') }
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t md:hidden" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="grid grid-cols-4">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => (it.key === 'profile' ? onProfile() : onTab(it.key))}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
              activeTab === it.key ? 'text-brass-600 dark:text-brass-400' : 'opacity-70'
            }`}
          >
            <span className="text-xl">{it.icon}</span>
            {it.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

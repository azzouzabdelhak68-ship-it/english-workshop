import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { isDemoMode, supabase } from './lib/supabase'
import { useHashRoute } from './lib/router'
import type { Profile } from './lib/types'
import { Navbar, BottomNav, type TabKey } from './components/Navbar'
import { LoginModal } from './components/LoginModal'
import { ProfileModal } from './components/ProfileModal'
import { OnboardingWizard } from './components/OnboardingWizard'
import { ConfettiLayer } from './components/Confetti'
import { Spinner } from './components/ui'
import { CheckinDeepLinkHandler } from './hooks/useCheckin'
import { LandingView } from './views/LandingView'
import { AnnouncementsView } from './views/AnnouncementsView'
import { SessionsView } from './views/SessionsView'
import { GamesView } from './views/GamesView'
import { HomeworkView } from './views/HomeworkView'
import { LibraryView } from './views/LibraryView'
import { RankingsView } from './views/RankingsView'
import { ChatView } from './views/ChatView'
import { AiChatRoomView } from './views/AiChatRoomView'
import { AdminAnalyticsView } from './views/AdminAnalyticsView'

function DemoBadge() {
  return (
    <div
      className="fixed bottom-20 start-3 z-40 rounded-full bg-brass-500 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-lg md:bottom-3"
      title="Local demo mode: data lives in your browser only. Reset via console: EW_DEMO_RESET()"
    >
      🧪 Demo mode — local data
    </div>
  )
}

function Shell() {
  const { t, authSession, profile, loading, isStaff, refreshProfile } = useApp()
  const route = useHashRoute()
  const [tab, setTab] = useState<TabKey>('announcements')
  const [loginOpen, setLoginOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [verified, setVerified] = useState(true)

  useEffect(() => {
    if (!authSession || isDemoMode) {
      setVerified(true)
      return
    }
    void supabase.auth.getUser().then(({ data }) => {
      setVerified(!!data.user?.email_confirmed_at || !!data.user?.phone_confirmed_at)
    })
  }, [authSession])

  if (loading) return <Spinner label={t('loading')} />

  if (!authSession || !profile) {
    return (
      <>
        <Navbar activeTab={null} onTab={() => undefined} onProfile={() => undefined} onLogin={() => setLoginOpen(true)} authenticated={false} />
        <LandingView onLogin={() => setLoginOpen(true)} />
        <DemoBadge />
        <ConfettiLayer />
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    )
  }

  if (route.path.startsWith('/checkin')) {
    return (
      <>
        <Navbar activeTab={null} onTab={() => undefined} onProfile={() => undefined} onLogin={() => undefined} authenticated />
        <CheckinDeepLinkHandler />
        <ConfettiLayer />
        <DemoBadge />
      </>
    )
  }

  if (!profile.onboarded) {
    return (
      <>
        <OnboardingWizard
          onDone={() => {
            void refreshProfile()
          }}
        />
        <ConfettiLayer />
      </>
    )
  }

  if (!verified) {
    return (
      <div className="mx-auto max-w-md px-4 pt-24">
        <div className="app-card p-8 text-center">
          <p className="text-4xl">📧</p>
          <h2 className="mt-3 text-xl font-extrabold">{t('verifyEmailTitle')}</h2>
          <p className="mt-2 text-sm opacity-75">{t('verifyEmailBody')}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary mt-6">
            ↻ {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Navbar
        activeTab={tab}
        onTab={(k) => setTab(k)}
        onProfile={() => setProfileOpen(true)}
        onLogin={() => setLoginOpen(true)}
        authenticated
      />

      <main>
        {tab === 'announcements' && <AnnouncementsView profile={profile as Profile} />}
        {tab === 'sessions' && <SessionsView profile={profile} />}
        {tab === 'games' && <GamesView profile={profile} />}
        {tab === 'homework' && <HomeworkView profile={profile} />}
        {tab === 'library' && <LibraryView />}
        {tab === 'rankings' && <RankingsView />}
        {tab === 'chat' && <ChatView />}
        {tab === 'aichat' && isStaff && <AiChatRoomView />}
        {tab === 'analytics' && isStaff && <AdminAnalyticsView />}
      </main>

      {/* Staff extras */}
      {isStaff && (
        <nav className="fixed bottom-20 end-4 z-30 flex flex-col gap-2 md:bottom-auto md:end-6 md:top-32">
          {tab !== 'aichat' && (
            <button onClick={() => setTab('aichat')} title={t('tabAiChat')} className="app-card flex h-12 w-12 items-center justify-center text-xl shadow-lg">
              🤖
            </button>
          )}
          {tab !== 'analytics' && (
            <button onClick={() => setTab('analytics')} title={t('tabAnalytics')} className="app-card flex h-12 w-12 items-center justify-center text-xl shadow-lg">
              📊
            </button>
          )}
        </nav>
      )}

      <BottomNav activeTab={tab} onTab={(k) => setTab(k)} onProfile={() => setProfileOpen(true)} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <DemoBadge />
      <ConfettiLayer />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

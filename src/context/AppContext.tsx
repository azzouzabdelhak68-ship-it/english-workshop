import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session as SupaSession } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { translate, type Lang, type TKey } from '../lib/i18n'
import { isStaffRole } from '../lib/constants'
import type { Notification, Profile } from '../lib/types'

interface AppContextValue {
  authSession: SupaSession | null
  profile: Profile | null
  loading: boolean
  lang: Lang
  dir: 'ltr' | 'rtl'
  dark: boolean
  t: (key: TKey, vars?: Record<string, string | number>) => string
  setLang: (l: Lang) => void
  toggleDark: () => void
  isStaff: boolean
  notifications: Notification[]
  unreadCount: number
  markAllRead: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AppContext = createContext<AppContextValue>(null as unknown as AppContextValue)

export function useApp(): AppContextValue {
  return useContext(AppContext)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [authSession, setAuthSession] = useState<SupaSession | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('ew-lang') as Lang) || 'en')
  const [dark, setDark] = useState(() => localStorage.getItem('ew-dark') === '1')
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('ew-dark', dark ? '1' : '0')
  }, [dark])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('ew-lang', lang)
  }, [lang])

  const refreshProfile = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single()
    setProfile((data as Profile) ?? null)
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(async ({ data }) => {
      setAuthSession(data.session)
      await refreshProfile()
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setAuthSession(s)
      if (!s) setProfile(null)
      else void refreshProfile()
    })
    return () => sub.subscription.unsubscribe()
  }, [refreshProfile])

  useEffect(() => {
    if (!authSession) {
      setNotifications([])
      return
    }
    const channel = supabase
      .channel('notifications-' + authSession.user.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${authSession.user.id}` },
        (payload) => setNotifications((prev) => [payload.new as Notification, ...prev])
      )
      .subscribe()
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setNotifications(data as Notification[])
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [authSession])

  const markAllRead = useCallback(async () => {
    if (!authSession) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', authSession.user.id).eq('read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [authSession])

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  )

  const value = useMemo<AppContextValue>(
    () => ({
      authSession,
      profile,
      loading,
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      dark,
      t,
      setLang: setLangState,
      toggleDark: () => setDark((d) => !d),
      isStaff: isStaffRole(profile?.role),
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markAllRead,
      refreshProfile
    }),
    [authSession, profile, loading, lang, dark, t, notifications, markAllRead, refreshProfile]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

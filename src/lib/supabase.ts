import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { demoClient } from './demo/backend'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

function getDemoOverride(): 'demo' | 'live' | null {
  try {
    const v = localStorage.getItem('EW_DEMO_OVERRIDE')
    if (v === 'demo' || v === 'live') return v
  } catch {}
  return null
}

/** Demo mode: no cloud project — a local browser-backed emulator. Override via localStorage EW_DEMO_OVERRIDE. */
export const isDemoMode = (() => {
  const ov = getDemoOverride()
  if (ov === 'demo') return true
  if (ov === 'live') return false
  return !isConfigured
})()

export function setDemoOverride(v: 'auto' | 'demo' | 'live') {
  try {
    if (v === 'auto') localStorage.removeItem('EW_DEMO_OVERRIDE')
    else localStorage.setItem('EW_DEMO_OVERRIDE', v)
  } catch {}
  location.reload()
}

export const supabase: SupabaseClient = isDemoMode
  ? (demoClient as unknown as SupabaseClient)
  : createClient(url!, anonKey!)

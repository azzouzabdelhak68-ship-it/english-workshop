import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { demoClient } from './demo/backend'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)
/** Demo mode: no cloud project — a local browser-backed emulator with seeded test accounts. */
export const isDemoMode = !isConfigured

export const supabase: SupabaseClient = isConfigured
  ? createClient(url!, anonKey!)
  : (demoClient as unknown as SupabaseClient)

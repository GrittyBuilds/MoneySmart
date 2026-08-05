import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * True when both Supabase environment variables are present. The UI uses this
 * to show a friendly "connect your Supabase project" screen instead of crashing
 * when the app is opened before `.env` is filled in.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

// A dummy fallback keeps `createClient` from throwing at import time when the
// project hasn't been configured yet. Every real call is gated behind
// `isSupabaseConfigured`, so the dummy client is never actually used.
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

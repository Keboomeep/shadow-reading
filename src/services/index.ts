/**
 * The one place that picks storage implementations.
 * With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set, data lives in Supabase.
 * Without them, it stays in this browser's localStorage.
 * UI code imports `services` and never touches either directly.
 */
import { LocalStorageProgressStore, type ProgressStore } from './ProgressStore'
import { LocalStorageSessionLogStore, type SessionLogStore } from './SessionLogStore'
import { LocalStorageSettingsStore, type SettingsStore } from './SettingsStore'
import { LocalStorageTextStore, type TextStore } from './TextStore'
import { SupabaseProgressStore, SupabaseSessionLogStore, SupabaseSettingsStore, SupabaseTextStore } from './supabase'
import { supabase } from './supabaseClient'

export type Services = {
  texts: TextStore
  settings: SettingsStore
  progress: ProgressStore
  sessions: SessionLogStore
}

export const backend: 'supabase' | 'local' = supabase ? 'supabase' : 'local'

export const services: Services = supabase
  ? {
      texts: new SupabaseTextStore(supabase),
      settings: new SupabaseSettingsStore(supabase),
      progress: new SupabaseProgressStore(supabase),
      sessions: new SupabaseSessionLogStore(supabase),
    }
  : {
      texts: new LocalStorageTextStore(),
      settings: new LocalStorageSettingsStore(),
      progress: new LocalStorageProgressStore(),
      sessions: new LocalStorageSessionLogStore(),
    }

export * from './types'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** null when the env vars are missing. The app then stays on localStorage. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

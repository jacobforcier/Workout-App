import { createClient } from '@supabase/supabase-js'
import { PERSIST_SESSION, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'

// The auth session token is the only thing ever written to browser storage,
// and only when PERSIST_SESSION is true.
export const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON_KEY || 'missing-key', {
  auth: {
    persistSession: PERSIST_SESSION,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

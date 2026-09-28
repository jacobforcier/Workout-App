/**
 * PERSIST_SESSION (default true)
 *   true  – Supabase keeps only its auth session token in browser storage, so you stay signed in.
 *   false – `persistSession: false`: nothing at all is stored on the device; sign in each visit.
 * Override at build time with VITE_PERSIST_SESSION=false.
 */
export const PERSIST_SESSION: boolean = (import.meta.env.VITE_PERSIST_SESSION ?? 'true') !== 'false'

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

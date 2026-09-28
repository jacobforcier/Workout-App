import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ensureHousehold, getMembership, listAthletes, type Membership } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Athlete } from '../lib/types'

interface AppState {
  session: Session | null
  authReady: boolean
  membership: Membership | null
  membershipError: Error | null
  athletes: Athlete[]
  athletesError: Error | null
  athletesLoading: boolean
  activeAthlete: Athlete | null
  kidMode: boolean
  setActiveAthleteId: (id: string) => void
  reloadHousehold: () => void
  reloadAthletes: () => Promise<void>
  signOut: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [membershipError, setMembershipError] = useState<Error | null>(null)
  const [householdNonce, setHouseholdNonce] = useState(0)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [athletesError, setAthletesError] = useState<Error | null>(null)
  const [athletesLoading, setAthletesLoading] = useState(false)
  // Active athlete lives in memory only (no browser storage beyond the auth token).
  const [activeAthleteId, setActiveAthleteId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  // Load the household; create it (or claim an invite) on first sign-in.
  useEffect(() => {
    if (!userId) {
      setMembership(null)
      setAthletes([])
      setActiveAthleteId(null)
      return
    }
    let cancelled = false
    setMembershipError(null)
    ;(async () => {
      try {
        let m = await getMembership(userId)
        if (!m) {
          const name = (session?.user.user_metadata?.household_name as string | undefined) ?? null
          await ensureHousehold(name)
          m = await getMembership(userId)
        }
        if (!cancelled) setMembership(m)
      } catch (e) {
        if (!cancelled) setMembershipError(e as Error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, householdNonce])

  const householdId = membership?.household_id ?? null

  const reloadAthletes = useCallback(async () => {
    if (!householdId) return
    setAthletesLoading(true)
    setAthletesError(null)
    try {
      setAthletes(await listAthletes(householdId))
    } catch (e) {
      setAthletesError(e as Error)
    } finally {
      setAthletesLoading(false)
    }
  }, [householdId])

  useEffect(() => {
    void reloadAthletes()
  }, [reloadAthletes])

  const activeAthlete = athletes.find((a) => a.id === activeAthleteId) ?? athletes[0] ?? null

  const value = useMemo<AppState>(
    () => ({
      session,
      authReady,
      membership,
      membershipError,
      athletes,
      athletesError,
      athletesLoading,
      activeAthlete,
      kidMode: activeAthlete?.kind === 'kid',
      setActiveAthleteId,
      reloadHousehold: () => setHouseholdNonce((n) => n + 1),
      reloadAthletes,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, authReady, membership, membershipError, athletes, athletesError, athletesLoading, activeAthlete, reloadAthletes],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/** For screens that only render once an athlete exists. */
export function useActiveAthlete(): Athlete {
  const { activeAthlete } = useApp()
  if (!activeAthlete) throw new Error('No active athlete')
  return activeAthlete
}

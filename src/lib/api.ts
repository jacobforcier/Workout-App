import { supabase } from './supabase'
import type {
  Athlete,
  AthleteInput,
  Benchmark,
  BodyMetric,
  Household,
  HouseholdInvite,
  HouseholdMember,
  SessionRow,
  SessionWithLogs,
  SetLogInput,
} from './types'

/**
 * Thin data layer over Supabase. Every call either returns data or throws an
 * Error with a message fit to show the user. Nothing is cached or queued
 * locally: if the network is down, the call fails and the UI says so.
 */

export class ApiError extends Error {
  offline: boolean
  constructor(message: string, offline = false) {
    super(message)
    this.offline = offline
  }
}

export const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again. Nothing is saved on this phone."

function toApiError(err: unknown): ApiError {
  const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
  const offline = (typeof navigator !== 'undefined' && !navigator.onLine) || /failed to fetch|network|load failed|fetch/i.test(message)
  return new ApiError(offline ? OFFLINE_MESSAGE : message || 'Something went wrong.', offline)
}

async function run<T>(fn: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  let result: { data: T | null; error: unknown }
  try {
    result = await fn()
  } catch (err) {
    throw toApiError(err)
  }
  if (result.error) throw toApiError(result.error)
  return result.data as T
}

// --- Household ------------------------------------------------------------

export interface Membership extends HouseholdMember {
  household: Household
}

export async function getMembership(userId: string): Promise<Membership | null> {
  const rows = await run<(HouseholdMember & { households: Household })[]>(() =>
    supabase.from('household_members').select('*, households(*)').eq('user_id', userId).order('created_at').limit(1),
  )
  const row = rows[0]
  if (!row) return null
  const { households, ...member } = row
  return { ...member, household: households }
}

export async function ensureHousehold(name: string | null): Promise<string> {
  return run<string>(() => supabase.rpc('ensure_household', { p_name: name }))
}

export async function listMembers(householdId: string): Promise<HouseholdMember[]> {
  return run(() => supabase.from('household_members').select('*').eq('household_id', householdId).order('created_at'))
}

export async function listInvites(householdId: string): Promise<HouseholdInvite[]> {
  return run(() => supabase.from('household_invites').select('*').eq('household_id', householdId).order('created_at'))
}

export async function createInvite(householdId: string, email: string, invitedBy: string): Promise<void> {
  await run(() =>
    supabase.from('household_invites').insert({ household_id: householdId, email: email.trim().toLowerCase(), invited_by: invitedBy }),
  )
}

export async function deleteInvite(id: string): Promise<void> {
  await run(() => supabase.from('household_invites').delete().eq('id', id))
}

// --- Athletes -------------------------------------------------------------

export async function listAthletes(householdId: string): Promise<Athlete[]> {
  return run(() => supabase.from('athletes').select('*').eq('household_id', householdId).order('kind').order('created_at'))
}

/** Leave `custom_rotation` out of the payload when it's unset, so a database without that column still works. */
function athletePayload<T extends Partial<AthleteInput>>(input: T): T {
  if (input.custom_rotation !== undefined && input.custom_rotation !== null) return input
  const { custom_rotation: _omit, ...rest } = input
  return rest as T
}

export async function createAthlete(householdId: string, input: AthleteInput): Promise<Athlete> {
  return run(() => supabase.from('athletes').insert({ ...athletePayload(input), household_id: householdId }).select().single())
}

/** Pass `clearCustomRotation` to switch an athlete back to the default rotation. */
export async function updateAthlete(id: string, input: Partial<AthleteInput>, clearCustomRotation = false): Promise<Athlete> {
  const payload = clearCustomRotation ? { ...input, custom_rotation: null } : athletePayload(input)
  return run(() => supabase.from('athletes').update(payload).eq('id', id).select().single())
}

export async function deleteAthlete(id: string): Promise<void> {
  await run(() => supabase.from('athletes').delete().eq('id', id))
}

// --- Sessions -------------------------------------------------------------

/** Completed sessions for an athlete, oldest first (no set logs). */
export async function listSessions(athleteId: string): Promise<SessionRow[]> {
  return run(() =>
    supabase.from('sessions').select('*').eq('athlete_id', athleteId).eq('completed', true).order('performed_on').order('started_at'),
  )
}

/** Completed sessions with set logs, oldest first. */
export async function listSessionsWithLogs(athleteId: string, sinceDate?: string): Promise<SessionWithLogs[]> {
  return run(() => {
    let q = supabase.from('sessions').select('*, set_logs(*)').eq('athlete_id', athleteId).eq('completed', true)
    if (sinceDate) q = q.gte('performed_on', sinceDate)
    return q.order('performed_on').order('started_at')
  })
}

/** The most recent completed sessions of one workout, with set logs, newest first. */
export async function recentWorkoutSessions(athleteId: string, workoutId: string, limit = 2): Promise<SessionWithLogs[]> {
  return run(() =>
    supabase
      .from('sessions')
      .select('*, set_logs(*)')
      .eq('athlete_id', athleteId)
      .eq('workout_id', workoutId)
      .eq('completed', true)
      .order('performed_on', { ascending: false })
      .order('started_at', { ascending: false })
      .limit(limit),
  )
}

export type NewSession = Omit<SessionRow, 'id'>

/** Saves a finished session and its set logs. If the logs fail, the session row is removed again. */
export async function saveSession(session: NewSession, logs: SetLogInput[]): Promise<SessionRow> {
  const saved = await run<SessionRow>(() => supabase.from('sessions').insert(session).select().single())
  if (logs.length) {
    try {
      await run(() => supabase.from('set_logs').insert(logs.map((l) => ({ ...l, session_id: saved.id }))))
    } catch (err) {
      await supabase.from('sessions').delete().eq('id', saved.id)
      throw err
    }
  }
  return saved
}

export async function deleteSession(id: string): Promise<void> {
  await run(() => supabase.from('sessions').delete().eq('id', id))
}

// --- Benchmarks & body metrics -------------------------------------------

export async function listBenchmarks(athleteId: string): Promise<Benchmark[]> {
  return run(() => supabase.from('benchmarks').select('*').eq('athlete_id', athleteId).order('tested_on'))
}

export async function addBenchmark(input: Omit<Benchmark, 'id'>): Promise<void> {
  await run(() => supabase.from('benchmarks').insert(input))
}

export async function listBodyMetrics(athleteId: string): Promise<BodyMetric[]> {
  return run(() => supabase.from('body_metrics').select('*').eq('athlete_id', athleteId).order('measured_on'))
}

export async function addBodyMetric(input: Omit<BodyMetric, 'id'>): Promise<void> {
  await run(() => supabase.from('body_metrics').insert(input))
}

import { getWorkout } from '../content'
import { addDays, startOfWeek, type ISODate } from './dates'
import { mondayIndex, weekPlanFor, type Phase, type RotationProfile, type WeekPlan } from './rotation'

/**
 * Sequence-based scheduling. The weekly plan says *what* to do this week and in
 * what order; the calendar only says which week it is. Miss Monday and Tuesday
 * suggests Monday's workout, not Tuesday's.
 */

export interface DoneSession {
  performed_on: ISODate
  workout_id: string
}

export interface PlanEntry {
  /** Monday-first day index the plan put it on. */
  day: number
  workoutId: string
  done: boolean
  doneOn: ISODate | null
}

export interface WeekStatus {
  weekStart: ISODate
  plan: WeekPlan
  phase: Phase
  week: number
  /** The plan's workouts in order, marked off by this week's sessions. */
  entries: PlanEntry[]
  /** Harder (non-recovery) sessions planned this week. */
  goal: number
  /** Harder sessions done this week (swaps and extras count). */
  done: number
  recoveryDone: number
}

export const RECOVERY_ID = 'recovery'

const isRecovery = (id: string) => id === RECOVERY_ID
const isHingeHeavy = (id: string) => getWorkout(id)?.hingeHeavy === true

function sessionsInWeek(sessions: DoneSession[], weekStart: ISODate): DoneSession[] {
  const end = addDays(weekStart, 6)
  return sessions.filter((s) => s.performed_on >= weekStart && s.performed_on <= end).sort((a, b) => a.performed_on.localeCompare(b.performed_on))
}

export function weekStatus(date: ISODate, profile: RotationProfile, sessions: DoneSession[], firstSessionDate: ISODate | null): WeekStatus {
  const weekStart = startOfWeek(date)
  const { plan, phase, week } = weekPlanFor(date, profile, firstSessionDate)
  const entries: PlanEntry[] = plan.flatMap((workoutId, day) => (workoutId ? [{ day, workoutId, done: false, doneOn: null }] : []))
  const thisWeek = sessionsInWeek(sessions, weekStart)

  for (const s of thisWeek) {
    // Exact match first; otherwise a swap fills the next open slot of the same kind (hard vs recovery).
    const slot =
      entries.find((e) => !e.done && e.workoutId === s.workout_id) ??
      entries.find((e) => !e.done && isRecovery(e.workoutId) === isRecovery(s.workout_id))
    if (slot) {
      slot.done = true
      slot.doneOn = s.performed_on
    }
  }

  return {
    weekStart,
    plan,
    phase,
    week,
    entries,
    goal: entries.filter((e) => !isRecovery(e.workoutId)).length,
    done: thisWeek.filter((s) => !isRecovery(s.workout_id)).length,
    recoveryDone: thisWeek.filter((s) => isRecovery(s.workout_id)).length,
  }
}

export type TodayKind = 'workout' | 'catch_up' | 'rest' | 'done_today' | 'week_complete'

export interface TodaySuggestion {
  kind: TodayKind
  /** What to do today (or, for done_today, what's next). null = nothing planned. */
  workoutId: string | null
  /** Optional short explanation for the suggestion. */
  note: string | null
}

/** Next open plan entries, in order. Recovery days already in the past are dropped; hard sessions carry over. */
function openEntries(status: WeekStatus, today: ISODate): PlanEntry[] {
  const todayIdx = mondayIndex(today)
  return status.entries.filter((e) => !e.done && !(isRecovery(e.workoutId) && e.day < todayIdx))
}

export function suggestToday(today: ISODate, status: WeekStatus, sessions: DoneSession[]): TodaySuggestion {
  const doneToday = sessions.some((s) => s.performed_on === today)
  const open = openEntries(status, today)
  const todayIdx = mondayIndex(today)

  if (doneToday) {
    return { kind: 'done_today', workoutId: open[0]?.workoutId ?? null, note: null }
  }
  if (open.length === 0) {
    return { kind: 'week_complete', workoutId: null, note: null }
  }

  let next = open[0]
  let note: string | null = null

  // Don't stack swing-heavy days: after one yesterday, pick the next easier open entry.
  const yesterday = addDays(today, -1)
  const hingeYesterday = sessions.some((s) => s.performed_on === yesterday && isHingeHeavy(s.workout_id))
  if (hingeYesterday && isHingeHeavy(next.workoutId)) {
    const easier = open.find((e) => !isHingeHeavy(e.workoutId))
    if (easier) {
      next = easier
      note = 'Yesterday was swing-heavy, so today is easier on your back.'
    } else {
      return {
        kind: 'workout',
        workoutId: RECOVERY_ID,
        note: 'Yesterday was swing-heavy. Recovery today; the rest of the week stays in order.',
      }
    }
  }

  const plannedToday = status.plan[todayIdx]
  if (plannedToday === null) {
    const behind = open.some((e) => e.day < todayIdx && !isRecovery(e.workoutId))
    return behind
      ? { kind: 'rest', workoutId: next.workoutId, note: 'Planned rest day. Behind this week? You can catch up.' }
      : { kind: 'rest', workoutId: null, note: null }
  }

  const catchUp = next.day < todayIdx
  return { kind: catchUp ? 'catch_up' : 'workout', workoutId: next.workoutId, note: note ?? (catchUp ? 'Picking up where you left off.' : null) }
}

/**
 * "Never miss twice": yesterday had a harder session planned and nothing was
 * done, and nothing is done yet today.
 */
export function missedYesterday(today: ISODate, profile: RotationProfile, sessions: DoneSession[], firstSessionDate: ISODate | null): boolean {
  if (!firstSessionDate || sessions.some((s) => s.performed_on === today)) return false
  const yesterday = addDays(today, -1)
  if (yesterday < firstSessionDate) return false
  const planned = weekPlanFor(yesterday, profile, firstSessionDate).plan[mondayIndex(yesterday)]
  return planned !== null && !isRecovery(planned) && !sessions.some((s) => s.performed_on === yesterday)
}

/**
 * Consecutive weeks (Mon–Sun) that hit their harder-session goal. The current
 * week counts once it's hit, and doesn't break the streak while in progress.
 */
export function weeklyStreak(today: ISODate, profile: RotationProfile, sessions: DoneSession[], firstSessionDate: ISODate | null): number {
  if (!firstSessionDate) return 0
  const firstWeek = startOfWeek(firstSessionDate)
  let streak = 0
  for (let w = startOfWeek(today); w >= firstWeek; w = addDays(w, -7)) {
    const status = weekStatus(w, profile, sessions, firstSessionDate)
    const met = status.goal > 0 && status.done >= status.goal
    if (met) streak++
    else if (w === startOfWeek(today)) continue
    else break
  }
  return streak
}

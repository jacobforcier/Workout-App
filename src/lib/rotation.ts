import { getWorkout } from '../content'
import { addDays, daysBetween, dayOfWeek, type ISODate } from './dates'

export type AthleteKind = 'adult' | 'kid'

/** What the rotation needs to know about an athlete (an `Athlete` row satisfies it). */
export interface RotationProfile {
  kind: AthleteKind
  has_pullup_bar?: boolean
  has_dip_bars?: boolean
  /** Monday-first, 7 entries; null entries are rest days. null/undefined = default rotation. */
  custom_rotation?: (string | null)[] | null
}

export interface RotationDay {
  date: ISODate
  /** null = planned rest day. */
  workoutId: string | null
  label: string
  /** 1-based training week, counted from the athlete's first logged session. */
  week: number
  intro: boolean
  /** True when the athlete's own weekly plan decided this day. */
  custom: boolean
}

/** Index 0 = Sunday. */
const ADULT_WEEKLY: (string | null)[] = [null, 'joe_rogan', 'swing_emom', 'recovery', 'joe_rogan', 'simple_sinister', 'family_circuit']
const KID_WEEKLY: (string | null)[] = [null, 'foundation', 'recovery', 'family_circuit', 'recovery', 'foundation', 'family_circuit']
/** Weeks 1–2 (everyone): Foundation Mon/Wed/Fri, Recovery on other days. */
const INTRO_WEEKLY: (string | null)[] = ['recovery', 'foundation', 'recovery', 'foundation', 'recovery', 'foundation', 'recovery']

export const INTRO_WEEKS = 2

export const KID_WORKOUT_IDS = ['family_circuit', 'recovery', 'foundation']

/** Monday-first day names, matching `custom_rotation`. */
export const PLAN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** With no pull-up bar and no dip bars, the podcast version (kettlebell only) replaces the Onnit version. */
function adaptForEquipment(workoutId: string | null, profile: RotationProfile): string | null {
  if (workoutId === 'joe_rogan' && !profile.has_pullup_bar && !profile.has_dip_bars) return 'joe_rogan_podcast'
  return workoutId
}

/** Monday-first → Sunday-first index. */
const toSundayFirst = (plan: (string | null)[]) => [plan[6], ...plan.slice(0, 6)]
/** Sunday-first → Monday-first. */
const toMondayFirst = (plan: (string | null)[]) => [...plan.slice(1), plan[0]]

/** Only known workouts, and only kid-safe ones for kids; anything else becomes a rest day. */
function sanitize(workoutId: string | null, profile: RotationProfile): string | null {
  if (workoutId === null) return null
  const w = getWorkout(workoutId)
  if (!w || (profile.kind === 'kid' && !w.kidSafe)) return null
  return workoutId
}

function hasCustomPlan(profile: RotationProfile): profile is RotationProfile & { custom_rotation: (string | null)[] } {
  return Array.isArray(profile.custom_rotation) && profile.custom_rotation.length === 7
}

/** The default post-intro week for this athlete, Monday first (used to prefill the plan editor). */
export function defaultWeeklyPlan(profile: RotationProfile): (string | null)[] {
  const table = profile.kind === 'kid' ? KID_WEEKLY : ADULT_WEEKLY
  return toMondayFirst(table.map((id) => adaptForEquipment(id, profile)))
}

/**
 * Week number for `date`. Week 1 starts on the athlete's first logged session;
 * before any session exists the athlete is in week 1.
 */
export function trainingWeek(date: ISODate, firstSessionDate: ISODate | null): number {
  if (!firstSessionDate) return 1
  const days = daysBetween(firstSessionDate, date)
  if (days < 0) return 1
  return Math.floor(days / 7) + 1
}

/**
 * The suggested workout for a day. A custom weekly plan, when set, applies every
 * week (including the intro weeks). Otherwise: intro weeks 1–2, then the adult or
 * kid default.
 */
export function rotationFor(date: ISODate, profile: RotationProfile, firstSessionDate: ISODate | null): RotationDay {
  const week = trainingWeek(date, firstSessionDate)
  const intro = week <= INTRO_WEEKS
  const custom = hasCustomPlan(profile)
  let workoutId: string | null
  if (custom) {
    workoutId = sanitize(toSundayFirst(profile.custom_rotation)[dayOfWeek(date)], profile)
  } else {
    const table = intro ? INTRO_WEEKLY : profile.kind === 'kid' ? KID_WEEKLY : ADULT_WEEKLY
    workoutId = adaptForEquipment(table[dayOfWeek(date)], profile)
  }
  return {
    date,
    workoutId,
    label: workoutId === null ? 'Rest or walk' : workoutId,
    week,
    intro: intro && !custom,
    custom,
  }
}

/** The 7 days starting on `from`. */
export function rotationWeek(from: ISODate, profile: RotationProfile, firstSessionDate: ISODate | null): RotationDay[] {
  return Array.from({ length: 7 }, (_, i) => rotationFor(addDays(from, i), profile, firstSessionDate))
}

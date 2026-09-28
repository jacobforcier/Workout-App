import { getWorkout } from '../content'
import { addDays, daysBetween, dayOfWeek, startOfWeek, type ISODate } from './dates'

export type AthleteKind = 'adult' | 'kid'

/** What the rotation needs to know about an athlete (an `Athlete` row satisfies it). */
export interface RotationProfile {
  kind: AthleteKind
  has_pullup_bar?: boolean
  has_dip_bars?: boolean
  /** Monday-first, 7 entries; null entries are rest days. null/undefined = default rotation. */
  custom_rotation?: (string | null)[] | null
}

/** Which stage of the default program a week belongs to. */
export type Phase = 'intro' | 'bridge' | 'full' | 'custom'

/** Monday-first weekly plan: a workout id per day, null = rest. */
export type WeekPlan = (string | null)[]

export interface RotationDay {
  date: ISODate
  /** null = planned rest day. */
  workoutId: string | null
  label: string
  /** 1-based training week, counted from the athlete's first logged session. */
  week: number
  phase: Phase
  intro: boolean
  /** True when the athlete's own weekly plan decided this day. */
  custom: boolean
}

// All tables are Monday first.
/** Weeks 1–2 (everyone): Foundation Mon/Wed/Fri, Recovery on other days. */
const INTRO: WeekPlan = ['foundation', 'recovery', 'foundation', 'recovery', 'foundation', 'recovery', 'recovery']
/**
 * Adults, weeks 3–6: four harder days instead of five, with the swing-heavy days
 * (Mon if kettlebell-only, Wed, Fri) never back to back.
 */
const ADULT_BRIDGE: WeekPlan = ['joe_rogan', 'recovery', 'swing_emom', 'recovery', 'simple_sinister', 'family_circuit', null]
/** Adults, week 7+: the spec's rotation. Swing-heavy days (Tue, Fri) are already apart. */
const ADULT_FULL: WeekPlan = ['joe_rogan', 'swing_emom', 'recovery', 'joe_rogan', 'simple_sinister', 'family_circuit', null]
/**
 * Adults with no pull-up bar and no dip bars, week 7+. The podcast version is
 * swing-heavy, so it can't sit next to the EMOM or S&S: Rogan twice, S&S once,
 * each separated by an easier day.
 */
const ADULT_FULL_KB_ONLY: WeekPlan = ['joe_rogan_podcast', 'recovery', 'family_circuit', 'joe_rogan_podcast', 'recovery', 'simple_sinister', null]
/** Kids after the intro: Foundation, Family circuit, and Recovery only. */
const KID: WeekPlan = ['foundation', 'recovery', 'family_circuit', 'recovery', 'foundation', 'family_circuit', null]

export const INTRO_WEEKS = 2
/** Last week of the adult bridge phase. */
export const BRIDGE_END_WEEK = 6

export const KID_WORKOUT_IDS = ['family_circuit', 'recovery', 'foundation']

/** Monday-first day names, matching `WeekPlan` and `custom_rotation`. */
export const PLAN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function kettlebellOnly(profile: RotationProfile): boolean {
  return !profile.has_pullup_bar && !profile.has_dip_bars
}

/** With no pull-up bar and no dip bars, the podcast version (kettlebell only) replaces the Onnit version. */
function adaptForEquipment(plan: WeekPlan, profile: RotationProfile): WeekPlan {
  if (!kettlebellOnly(profile)) return plan
  return plan.map((id) => (id === 'joe_rogan' ? 'joe_rogan_podcast' : id))
}

/** Only known workouts, and only kid-safe ones for kids; anything else becomes a rest day. */
function sanitize(workoutId: string | null, profile: RotationProfile): string | null {
  if (workoutId === null) return null
  const w = getWorkout(workoutId)
  if (!w || (profile.kind === 'kid' && !w.kidSafe)) return null
  return workoutId
}

function hasCustomPlan(profile: RotationProfile): profile is RotationProfile & { custom_rotation: WeekPlan } {
  return Array.isArray(profile.custom_rotation) && profile.custom_rotation.length === 7
}

/** Monday-first index of a date (0 = Monday … 6 = Sunday). */
export function mondayIndex(date: ISODate): number {
  return (dayOfWeek(date) + 6) % 7
}

/** The athlete's long-term default week (used to prefill the plan editor). */
export function defaultWeeklyPlan(profile: RotationProfile): WeekPlan {
  if (profile.kind === 'kid') return [...KID]
  return kettlebellOnly(profile) ? [...ADULT_FULL_KB_ONLY] : [...ADULT_FULL]
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

export function phaseFor(week: number, profile: RotationProfile): Phase {
  if (hasCustomPlan(profile)) return 'custom'
  if (week <= INTRO_WEEKS) return 'intro'
  if (profile.kind === 'adult' && week <= BRIDGE_END_WEEK) return 'bridge'
  return 'full'
}

/**
 * The plan for the calendar week (Mon–Sun) containing `date`. The phase comes
 * from that week's Monday, so a week never changes plan halfway through.
 * A custom plan, when set, applies every week.
 */
export function weekPlanFor(date: ISODate, profile: RotationProfile, firstSessionDate: ISODate | null): { plan: WeekPlan; phase: Phase; week: number } {
  const monday = startOfWeek(date)
  // Before the first session, trainingWeek() already reports week 1.
  const week = trainingWeek(monday, firstSessionDate)
  const phase = phaseFor(week, profile)
  let plan: WeekPlan
  switch (phase) {
    case 'custom':
      plan = profile.custom_rotation!.map((id) => sanitize(id, profile))
      break
    case 'intro':
      plan = [...INTRO]
      break
    case 'bridge':
      plan = adaptForEquipment(ADULT_BRIDGE, profile)
      break
    default:
      plan = profile.kind === 'kid' ? [...KID] : kettlebellOnly(profile) ? [...ADULT_FULL_KB_ONLY] : [...ADULT_FULL]
  }
  return { plan, phase, week }
}

/** The planned workout for one calendar day. */
export function rotationFor(date: ISODate, profile: RotationProfile, firstSessionDate: ISODate | null): RotationDay {
  const { plan, phase } = weekPlanFor(date, profile, firstSessionDate)
  const workoutId = plan[mondayIndex(date)]
  return {
    date,
    workoutId,
    label: workoutId === null ? 'Rest or walk' : workoutId,
    week: trainingWeek(date, firstSessionDate),
    phase,
    intro: phase === 'intro',
    custom: phase === 'custom',
  }
}

/** The 7 days starting on `from`. */
export function rotationWeek(from: ISODate, profile: RotationProfile, firstSessionDate: ISODate | null): RotationDay[] {
  return Array.from({ length: 7 }, (_, i) => rotationFor(addDays(from, i), profile, firstSessionDate))
}

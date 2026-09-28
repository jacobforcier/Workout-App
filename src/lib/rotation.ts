import { addDays, daysBetween, dayOfWeek, type ISODate } from './dates'

export type AthleteKind = 'adult' | 'kid'

export interface RotationDay {
  date: ISODate
  /** null = planned rest day. */
  workoutId: string | null
  label: string
  /** 1-based training week, counted from the athlete's first logged session. */
  week: number
  intro: boolean
}

/** Index 0 = Sunday. */
const ADULT_WEEKLY: (string | null)[] = [null, 'joe_rogan', 'swing_emom', 'recovery', 'joe_rogan', 'simple_sinister', 'family_circuit']
const KID_WEEKLY: (string | null)[] = [null, 'foundation', 'recovery', 'family_circuit', 'recovery', 'foundation', 'family_circuit']
/** Weeks 1–2 (everyone): Foundation Mon/Wed/Fri, Recovery on other days. */
const INTRO_WEEKLY: (string | null)[] = ['recovery', 'foundation', 'recovery', 'foundation', 'recovery', 'foundation', 'recovery']

export const INTRO_WEEKS = 2

export const KID_WORKOUT_IDS = ['family_circuit', 'recovery', 'foundation']

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

export function rotationFor(date: ISODate, kind: AthleteKind, firstSessionDate: ISODate | null): RotationDay {
  const week = trainingWeek(date, firstSessionDate)
  const intro = week <= INTRO_WEEKS
  const table = intro ? INTRO_WEEKLY : kind === 'kid' ? KID_WEEKLY : ADULT_WEEKLY
  const workoutId = table[dayOfWeek(date)]
  return {
    date,
    workoutId,
    label: workoutId === null ? 'Rest or walk' : workoutId,
    week,
    intro,
  }
}

/** The 7 days starting on `from`. */
export function rotationWeek(from: ISODate, kind: AthleteKind, firstSessionDate: ISODate | null): RotationDay[] {
  return Array.from({ length: 7 }, (_, i) => rotationFor(addDays(from, i), kind, firstSessionDate))
}

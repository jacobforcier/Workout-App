import { addDays, type ISODate } from './dates'

export const STREAK_MILESTONES = [3, 7, 14, 30]

/**
 * Consecutive training days ending today (or yesterday, if today isn't done yet).
 * Planned rest days (per the rotation) neither add to nor break a streak.
 * Recovery sessions count like any other completed session.
 */
export function currentStreak(
  sessionDates: Iterable<ISODate>,
  todayDate: ISODate,
  isPlannedRest: (date: ISODate) => boolean = () => false,
  maxLookbackDays = 3650,
): number {
  const done = new Set(sessionDates)
  let streak = 0
  let day = todayDate
  for (let i = 0; i < maxLookbackDays; i++, day = addDays(day, -1)) {
    if (done.has(day)) {
      streak++
    } else if (day === todayDate || isPlannedRest(day)) {
      continue
    } else {
      break
    }
  }
  return streak
}

/** Longest streak ever, with the same rest-day rule. */
export function longestStreak(sessionDates: Iterable<ISODate>, isPlannedRest: (date: ISODate) => boolean = () => false): number {
  const sorted = [...new Set(sessionDates)].sort()
  if (sorted.length === 0) return 0
  const done = new Set(sorted)
  let best = 0
  let run = 0
  const last = sorted[sorted.length - 1]
  for (let day = sorted[0]; day <= last; day = addDays(day, 1)) {
    if (done.has(day)) {
      run++
      best = Math.max(best, run)
    } else if (!isPlannedRest(day)) {
      run = 0
    }
  }
  return best
}

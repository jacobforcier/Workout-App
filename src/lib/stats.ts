import { today as todayDate, type ISODate } from './dates'
import { rotationFor, type AthleteKind } from './rotation'
import { currentStreak, longestStreak, STREAK_MILESTONES } from './streak'

export interface AthleteStats {
  firstSessionDate: ISODate | null
  sessionDates: ISODate[]
  streak: number
  bestStreak: number
  isPlannedRest: (d: ISODate) => boolean
}

export function athleteStats(sessions: { performed_on: string }[], kind: AthleteKind, today: ISODate = todayDate()): AthleteStats {
  const sessionDates = sessions.map((s) => s.performed_on).sort()
  const firstSessionDate = sessionDates[0] ?? null
  const isPlannedRest = (d: ISODate) => rotationFor(d, kind, firstSessionDate).workoutId === null
  return {
    firstSessionDate,
    sessionDates,
    streak: currentStreak(sessionDates, today, isPlannedRest),
    bestStreak: longestStreak(sessionDates, isPlannedRest),
    isPlannedRest,
  }
}

export interface Badge {
  id: string
  icon: string
  label: string
}

/** Kid-mode badges: one per completed session, plus streak milestones. */
export function badgesFor(sessionCount: number, bestStreak: number): { sessionBadges: number; streakBadges: Badge[] } {
  return {
    sessionBadges: sessionCount,
    streakBadges: STREAK_MILESTONES.filter((m) => bestStreak >= m).map((m) => ({
      id: `streak_${m}`,
      icon: m >= 30 ? '🏆' : m >= 14 ? '🥇' : m >= 7 ? '🥈' : '🥉',
      label: `${m}-day streak`,
    })),
  }
}

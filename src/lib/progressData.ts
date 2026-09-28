import { SWING_EXERCISE_IDS } from '../content'
import { addDays, formatDate, startOfWeek, type ISODate } from './dates'

interface SessionPoint {
  performed_on: string
  bell_lb: number | null
  set_logs?: { exercise_id: string; reps: number | null }[]
}

export interface WeekPoint {
  weekStart: ISODate
  label: string
  value: number
}

function weeks(count: number, todayDate: ISODate): ISODate[] {
  const last = startOfWeek(todayDate)
  return Array.from({ length: count }, (_, i) => addDays(last, (i - count + 1) * 7))
}

function perWeek(sessions: SessionPoint[], count: number, todayDate: ISODate, value: (s: SessionPoint) => number): WeekPoint[] {
  const buckets = new Map(weeks(count, todayDate).map((w) => [w, 0]))
  for (const s of sessions) {
    const w = startOfWeek(s.performed_on)
    if (buckets.has(w)) buckets.set(w, buckets.get(w)! + value(s))
  }
  return [...buckets].map(([weekStart, v]) => ({ weekStart, label: formatDate(weekStart), value: v }))
}

export function sessionsPerWeek(sessions: SessionPoint[], count: number, todayDate: ISODate): WeekPoint[] {
  return perWeek(sessions, count, todayDate, () => 1)
}

export function swingsPerWeek(sessions: SessionPoint[], count: number, todayDate: ISODate): WeekPoint[] {
  return perWeek(sessions, count, todayDate, (s) =>
    (s.set_logs ?? []).filter((l) => SWING_EXERCISE_IDS.includes(l.exercise_id)).reduce((n, l) => n + (l.reps ?? 0), 0),
  )
}

/** Bell used over time: one point per change (plus the latest). */
export function bellHistory(sessions: SessionPoint[]): { date: ISODate; bell: number }[] {
  const out: { date: ISODate; bell: number }[] = []
  const sorted = [...sessions].filter((s) => s.bell_lb !== null).sort((a, b) => a.performed_on.localeCompare(b.performed_on))
  for (const s of sorted) {
    if (out.length === 0 || out[out.length - 1].bell !== s.bell_lb) out.push({ date: s.performed_on, bell: s.bell_lb! })
  }
  const last = sorted[sorted.length - 1]
  if (last && out[out.length - 1].date !== last.performed_on) out.push({ date: last.performed_on, bell: last.bell_lb! })
  return out
}

/** Sessions per day for the heatmap: `weeks` columns ending with the current week (Mon–Sun rows). */
export function heatmap(sessionDates: ISODate[], weekCount: number, todayDate: ISODate): { date: ISODate; count: number; future: boolean }[][] {
  const counts = new Map<ISODate, number>()
  for (const d of sessionDates) counts.set(d, (counts.get(d) ?? 0) + 1)
  return weeks(weekCount, todayDate).map((w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(w, i)
      return { date, count: counts.get(date) ?? 0, future: date > todayDate }
    }),
  )
}

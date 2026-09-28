/** Dates are handled as local-calendar `YYYY-MM-DD` strings (matching Postgres `date`). */
export type ISODate = string

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): ISODate {
  return toISODate(new Date())
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Whole calendar days from `a` to `b` (positive when b is later). DST-safe. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const ua = Date.UTC(...ymd(a))
  const ub = Date.UTC(...ymd(b))
  return Math.round((ub - ua) / 86_400_000)
}

function ymd(s: ISODate): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number)
  return [y, m - 1, d]
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(s: ISODate): number {
  return parseISODate(s).getDay()
}

/** Monday of the week containing `s`. */
export function startOfWeek(s: ISODate): ISODate {
  const dow = dayOfWeek(s)
  return addDays(s, dow === 0 ? -6 : 1 - dow)
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function formatDate(s: ISODate, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return parseISODate(s).toLocaleDateString(undefined, opts)
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

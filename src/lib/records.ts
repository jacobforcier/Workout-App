/** "Last time" summaries and personal records, from logged sets. */

export interface LogLike {
  exercise_id: string
  set_number: number
  reps: number | null
  weight_lb: number | null
  seconds: number | null
  side: 'left' | 'right' | 'both'
}

export interface SessionLogsLike {
  performed_on: string
  rpe: number | null
  set_logs: LogLike[]
}

/**
 * One line for an exercise from a previous session, e.g. "3 × 10/side @ 35 lb"
 * or "3 sets: 10, 10, 8 @ 35 lb". Null when the exercise wasn't logged.
 */
export function summarizeExercise(exerciseId: string, logs: LogLike[]): string | null {
  const mine = logs.filter((l) => l.exercise_id === exerciseId)
  if (mine.length === 0) return null
  const perSide = mine.some((l) => l.side !== 'both') && mine.some((l) => l.side === 'left') && mine.some((l) => l.side === 'right')
  // One value per set (per-side sets: the lower side, so the summary never overstates).
  const bySet = new Map<number, LogLike[]>()
  for (const l of mine) bySet.set(l.set_number, [...(bySet.get(l.set_number) ?? []), l])
  const sets = [...bySet.entries()].sort((a, b) => a[0] - b[0]).map(([, ls]) => ls)
  const useSeconds = mine.every((l) => l.reps === null && l.seconds !== null)
  const values = sets.map((ls) => Math.min(...ls.map((l) => (useSeconds ? l.seconds : l.reps) ?? 0)))
  const unit = useSeconds ? ' s' : perSide ? '/side' : ''
  const weights = mine.map((l) => l.weight_lb).filter((w): w is number => w !== null && w > 0)
  const weight = weights.length ? ` @ ${Math.max(...weights)} lb` : ''
  const allSame = values.every((v) => v === values[0])
  const body = allSame
    ? values.length === 1
      ? `${values[0]}${unit}`
      : `${values.length} × ${values[0]}${unit}`
    : `${values.length} sets: ${values.join(', ')}${unit}`
  return body + weight
}

export interface PersonalRecord {
  exerciseId: string
  kind: 'weight' | 'reps' | 'hold'
  message: string
}

function best(logs: LogLike[], pick: (l: LogLike) => number | null): number | null {
  const vals = logs.map(pick).filter((v): v is number => v !== null)
  return vals.length ? Math.max(...vals) : null
}

/**
 * Records set in `current` compared with every earlier session. An exercise's
 * first-ever appearance isn't a record (there's nothing to beat yet).
 * Per exercise, reports the most meaningful one: heavier bell, else more reps
 * at the top weight, else a longer hold.
 */
export function personalRecords(current: LogLike[], history: SessionLogsLike[], exerciseName: (id: string) => string): PersonalRecord[] {
  const past = history.flatMap((s) => s.set_logs)
  const out: PersonalRecord[] = []
  for (const id of [...new Set(current.map((l) => l.exercise_id))]) {
    const now = current.filter((l) => l.exercise_id === id)
    const before = past.filter((l) => l.exercise_id === id)
    if (before.length === 0) continue
    const name = exerciseName(id)

    const wNow = best(now, (l) => l.weight_lb)
    const wBefore = best(before, (l) => l.weight_lb)
    if (wNow !== null && wNow > 0 && (wBefore === null || wNow > wBefore)) {
      out.push({ exerciseId: id, kind: 'weight', message: `${name}: heaviest yet, ${wNow} lb` })
      continue
    }

    const atWeight = (ls: LogLike[]) => ls.filter((l) => (l.weight_lb ?? 0) === (wNow ?? 0))
    const rNow = best(atWeight(now), (l) => l.reps)
    const rBefore = best(atWeight(before), (l) => l.reps)
    if (rNow !== null && rBefore !== null && rNow > rBefore) {
      out.push({ exerciseId: id, kind: 'reps', message: `${name}: most reps in a set${wNow ? ` at ${wNow} lb` : ''}, ${rNow}` })
      continue
    }

    const sNow = best(now, (l) => l.seconds)
    const sBefore = best(before, (l) => l.seconds)
    if (sNow !== null && sBefore !== null && sNow > sBefore) {
      out.push({ exerciseId: id, kind: 'hold', message: `${name}: longest yet, ${sNow} s` })
    }
  }
  return out
}

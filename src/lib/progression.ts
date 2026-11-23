import { exerciseName, getExercise, getWorkout, isLoaded, type RestGuidance, type Workout, type WorkoutItem } from '../content'

/**
 * Progression: suggest (never force) an increase when an athlete hits every
 * target rep for a unit with RPE ≤ 7 in two consecutive sessions of the same
 * workout. Order: add a set/round (up to the max) → shorten rest → add reps.
 * Heavier bells are suggested per exercise by bellUpSuggestions.
 *
 * It also suggests stepping back: after two sessions at RPE ≥ 9, or when reps
 * fell short in both of the last two sessions (and the latest felt hard).
 */

export const PROGRESSION_MAX_RPE = 7
/** Two sessions in a row at or above this → suggest a lighter session. */
export const STEP_BACK_RPE = 9
/** Missed reps twice, and the latest session at or above this → step back on that unit. */
export const MISSED_REPS_RPE = 8
export const REST_STEP_SEC = 15

export interface SetLogLike {
  exercise_id: string
  set_number: number
  reps: number | null
  seconds: number | null
  side: 'left' | 'right' | 'both'
  rest_sec: number | null
}

export interface SessionLike {
  id: string
  performed_on: string
  rpe: number | null
  bell_lb: number | null
  completed: boolean
  set_logs: SetLogLike[]
}

/** A thing that progresses as a whole: one item of a `sets` block, or a whole circuit / EMOM. */
export interface ProgressionUnit {
  key: string
  label: string
  blockIndex: number
  format: 'sets' | 'circuit' | 'emom'
  items: WorkoutItem[]
  targetSets: number
  maxSets: number
  rest?: RestGuidance
}

export type SuggestionKind = 'add_set' | 'shorten_rest' | 'next_bell' | 'add_reps' | 'step_back'

export interface Suggestion {
  unitKey: string
  label: string
  kind: SuggestionKind
  /** add_set: sets/rounds. shorten_rest: seconds. next_bell / step_back: lb (step_back may have none). */
  from?: number
  to?: number
  message: string
}

export function progressionUnits(workout: Workout): ProgressionUnit[] {
  const units: ProgressionUnit[] = []
  workout.main.forEach((block, blockIndex) => {
    if (block.format === 'sets') {
      block.items.forEach((item, itemIndex) => {
        const targetSets = item.sets ?? 1
        units.push({
          key: `${blockIndex}:${itemIndex}`,
          label: exerciseName(item.exerciseId),
          blockIndex,
          format: 'sets',
          items: [item],
          targetSets,
          maxSets: Math.max(targetSets, item.maxSets ?? targetSets),
          rest: item.rest,
        })
      })
    } else if (block.format === 'circuit') {
      const rounds = block.rounds ?? 1
      units.push({
        key: `${blockIndex}`,
        label: block.title,
        blockIndex,
        format: 'circuit',
        items: block.items,
        targetSets: rounds,
        maxSets: Math.max(rounds, block.maxRounds ?? rounds),
        rest: block.restBetweenRounds,
      })
    } else if (block.format === 'emom') {
      const minutes = block.minutes ?? 10
      units.push({
        key: `${blockIndex}`,
        label: block.title,
        blockIndex,
        format: 'emom',
        items: block.items,
        targetSets: minutes,
        maxSets: minutes,
      })
    }
    // `timed` blocks (mobility, walks) don't progress.
  })
  return units
}

/** Logs for an item, including any substitution the athlete used in its place. */
function logsForItem(item: WorkoutItem, logs: SetLogLike[]): SetLogLike[] {
  const ids = new Set([item.exerciseId, ...(getExercise(item.exerciseId)?.substitutions ?? [])])
  return logs.filter((l) => ids.has(l.exercise_id))
}

function setNumbers(logs: SetLogLike[]): number[] {
  return [...new Set(logs.map((l) => l.set_number))]
}

/** Every item: at least the target number of sets, every logged set at or above target, both sides when per-side. */
export function hitAllTargets(unit: ProgressionUnit, logs: SetLogLike[]): boolean {
  return unit.items.every((item) => {
    const itemLogs = logsForItem(item, logs)
    const sets = setNumbers(itemLogs)
    if (sets.length < unit.targetSets) return false
    if (item.perSide) {
      for (const n of sets) {
        const sides = new Set(itemLogs.filter((l) => l.set_number === n).map((l) => l.side))
        if (!sides.has('left') || !sides.has('right')) return false
      }
    }
    return itemLogs.every((l) => {
      if (item.reps !== undefined) return l.reps !== null && l.reps >= item.reps
      if (item.seconds !== undefined) return l.seconds !== null && l.seconds >= item.seconds
      return true
    })
  })
}

/** Sets (or rounds / minutes) completed for the unit: the fewest across its items. */
export function setsPerformed(unit: ProgressionUnit, logs: SetLogLike[]): number {
  return Math.min(...unit.items.map((item) => setNumbers(logsForItem(item, logs)).length))
}

/** Rest the athlete used for this unit in a session, or null if none was recorded. */
export function restUsed(unit: ProgressionUnit, logs: SetLogLike[]): number | null {
  const rests = unit.items.flatMap((item) => logsForItem(item, logs)).map((l) => l.rest_sec).filter((r): r is number => r !== null && r > 0)
  return rests.length ? Math.max(...rests) : null
}

function unitIsLoaded(unit: ProgressionUnit): boolean {
  return unit.items.some((i) => isLoaded(i.exerciseId))
}

/** Some logged set fell short of its target (skipped sets don't count as missed). */
export function missedReps(unit: ProgressionUnit, logs: SetLogLike[]): boolean {
  return unit.items.some((item) =>
    logsForItem(item, logs).some((l) => {
      if (item.reps !== undefined) return l.reps !== null && l.reps < item.reps
      if (item.seconds !== undefined) return l.seconds !== null && l.seconds < item.seconds
      return false
    }),
  )
}

export function previousBell(current: number, available: number[]): number | null {
  const smaller = available.filter((b) => b < current).sort((a, b) => b - a)
  return smaller[0] ?? null
}

export function nextBell(current: number, available: number[]): number | null {
  const bigger = available.filter((b) => b > current).sort((a, b) => a - b)
  return bigger[0] ?? null
}

export interface ProgressionInput {
  workout: Workout
  /** Sessions of this workout for this athlete, any order. */
  sessions: SessionLike[]
  currentBellLb: number
  availableBellsLb: number[]
}

export function suggestProgressions({ workout, sessions, currentBellLb, availableBellsLb }: ProgressionInput): Suggestion[] {
  const recent = sessions
    // Partial sessions count: they can't pass hitAllTargets (too few sets), but they do inform step-backs.
    .filter((s) => s.set_logs.length > 0)
    .sort((a, b) => (a.performed_on < b.performed_on ? 1 : a.performed_on > b.performed_on ? -1 : 0))
    .slice(0, 2)
  if (recent.length < 2) return []
  const [latest] = recent
  const lighter = previousBell(currentBellLb, availableBellsLb)

  // Two very hard sessions: one workout-wide step back, nothing else.
  if (recent.every((s) => s.rpe !== null && s.rpe >= STEP_BACK_RPE)) {
    return [
      {
        unitKey: 'workout',
        label: workout.name,
        kind: 'step_back',
        from: currentBellLb,
        to: lighter ?? undefined,
        message: lighter
          ? `${workout.name} felt very hard twice in a row. Next time use the ${lighter} lb bell and rebuild from there.`
          : `${workout.name} felt very hard twice in a row. Next time do one fewer set of each exercise and rebuild from there.`,
      },
    ]
  }

  // Reps fell short twice and it felt hard: step back on that unit.
  if (latest.rpe !== null && latest.rpe >= MISSED_REPS_RPE) {
    const back = progressionUnits(workout)
      .filter((unit) => recent.every((s) => missedReps(unit, s.set_logs)))
      .map((unit): Suggestion => {
        const useLighter = lighter !== null && unitIsLoaded(unit)
        return {
          unitKey: unit.key,
          label: unit.label,
          kind: 'step_back',
          from: useLighter ? currentBellLb : undefined,
          to: useLighter ? lighter : undefined,
          message: useLighter
            ? `${unit.label}: reps came up short twice. Try the ${lighter} lb bell until every rep is clean.`
            : `${unit.label}: reps came up short twice. Do one fewer ${unit.format === 'circuit' ? 'round' : 'set'} until every rep is clean.`,
        }
      })
    if (back.length) return back
  }

  if (!recent.every((s) => s.rpe !== null && s.rpe <= PROGRESSION_MAX_RPE)) return []

  const suggestions: Suggestion[] = []

  for (const unit of progressionUnits(workout)) {
    if (!recent.every((s) => hitAllTargets(unit, s.set_logs))) continue

    const noun = unit.format === 'circuit' ? 'rounds' : 'sets'
    const done = setsPerformed(unit, latest.set_logs)
    if (done < unit.maxSets) {
      suggestions.push({
        unitKey: unit.key,
        label: unit.label,
        kind: 'add_set',
        from: done,
        to: done + 1,
        message: `${unit.label}: try ${done + 1} ${noun} next time.`,
      })
      continue
    }

    if (unit.rest?.minSeconds !== undefined) {
      const used = restUsed(unit, latest.set_logs) ?? unit.rest.seconds
      if (used > unit.rest.minSeconds) {
        const to = Math.max(unit.rest.minSeconds, used - REST_STEP_SEC)
        suggestions.push({
          unitKey: unit.key,
          label: unit.label,
          kind: 'shorten_rest',
          from: used,
          to,
          message: `${unit.label}: try resting ${to} s instead of ${used} s.`,
        })
        continue
      }
    }

    // Heavier bells are decided per exercise (see bellUpSuggestions). EMOMs have no per-set reps to judge, so they keep the workout-level rule.
    if (unit.format === 'emom' && unitIsLoaded(unit)) {
      // Only when both sessions were done with the current bell; otherwise the athlete already moved up.
      if (recent.every((s) => (s.bell_lb ?? currentBellLb) === currentBellLb)) {
        const bell = nextBell(currentBellLb, availableBellsLb)
        if (bell !== null) {
          suggestions.push({
            unitKey: unit.key,
            label: unit.label,
            kind: 'next_bell',
            from: currentBellLb,
            to: bell,
            message: `${unit.label}: ready for the ${bell} lb bell (up from ${currentBellLb} lb).`,
          })
          continue
        }
      }
    }

    suggestions.push({
      unitKey: unit.key,
      label: unit.label,
      kind: 'add_reps',
      message: `${unit.label}: try adding 1 rep to each set.`,
    })
  }

  return suggestions
}

/** Reps on every set needed before an exercise moves to the next bell, unless the exercise sets its own. */
export const DEFAULT_BELL_UP_REPS = 8
/** Sets at the bell needed before moving up (fewer if the workout prescribes fewer). */
export const BELL_UP_SETS = 3

export interface BellUpSession {
  workout_id: string
  performed_on: string
  set_logs: (SetLogLike & { weight_lb: number | null })[]
}

/** Sets or rounds a workout prescribes for an exercise's main work; null if it isn't there. */
function prescribedSets(workoutId: string, exerciseId: string): number | null {
  const w = getWorkout(workoutId)
  if (!w) return null
  for (const block of w.main) {
    const item = block.items.find((i) => i.exerciseId === exerciseId)
    if (!item) continue
    if (block.format === 'circuit') return block.rounds ?? 1
    if (block.format === 'sets') return item.sets ?? 1
    return null
  }
  return null
}

/**
 * Per-exercise bell progression: an exercise is ready for the next bell once its
 * most recent main-work session (any workout) had at least 3 sets (or every
 * prescribed set, if fewer) at its heaviest bell, each with at least the
 * exercise's bell-up reps (default 8) on the weaker side.
 * `sessions` must be newest first.
 */
export function bellUpSuggestions({
  workout,
  sessions,
  availableBellsLb,
  isWarmupOnly,
}: {
  workout: Workout
  sessions: BellUpSession[]
  availableBellsLb: number[]
  isWarmupOnly: (workoutId: string, exerciseId: string) => boolean
}): Suggestion[] {
  const out: Suggestion[] = []
  const ids = [...new Set(workout.main.flatMap((b) => (b.format === 'emom' ? [] : b.items.filter((i) => i.reps !== undefined && i.unit !== 'steps').map((i) => i.exerciseId))))]
  for (const id of ids) {
    if (!isLoaded(id)) continue
    const s = sessions.find((x) => !isWarmupOnly(x.workout_id, id) && x.set_logs.some((l) => l.exercise_id === id))
    if (!s) continue
    const mine = s.set_logs.filter((l) => l.exercise_id === id)
    const weights = mine.map((l) => Number(l.weight_lb ?? 0))
    const top = Math.max(...weights)
    if (!(top > 0)) continue
    const bell = nextBell(top, availableBellsLb)
    if (bell === null) continue
    // Sets done entirely at the top bell, and the weaker side's reps on each.
    const bySet = new Map<number, typeof mine>()
    for (const l of mine) bySet.set(l.set_number, [...(bySet.get(l.set_number) ?? []), l])
    const topSets = [...bySet.values()].filter((ls) => ls.every((l) => Number(l.weight_lb ?? 0) === top))
    const needSets = Math.min(BELL_UP_SETS, prescribedSets(s.workout_id, id) ?? BELL_UP_SETS)
    const needReps = getExercise(id)?.bellUpReps ?? DEFAULT_BELL_UP_REPS
    const reps = topSets.map((ls) => Math.min(...ls.map((l) => l.reps ?? 0)))
    if (topSets.length < needSets || reps.some((r) => r < needReps)) continue
    out.push({
      unitKey: `exercise:${id}`,
      label: exerciseName(id),
      kind: 'next_bell',
      from: top,
      to: bell,
      message: `${exerciseName(id)}: ${topSets.length} sets of ${Math.min(...reps)}+ at ${top} lb. Ready to try the ${bell} lb bell.`,
    })
  }
  return out
}

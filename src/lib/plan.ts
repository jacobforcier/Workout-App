import { getExercise, isLoaded, type Equipment, type Workout, type WorkoutBlock, type WorkoutItem } from '../content'
import type { SetLogInput } from './types'

/**
 * Turns a workout into the session player's steps, designed for as few taps as
 * possible: the whole warm-up is one checklist, a circuit round is one step,
 * and a per-side set logs both sides at once. Targets are pre-filled, so a
 * step only needs a tap unless something differs.
 */

/** One exercise-set inside a step; also the key for its log. */
export interface Entry {
  /** Stable id so logs survive plan rebuilds (e.g. after adding a round). */
  id: string
  /** Key for this item's substitution choice. */
  itemKey: string
  item: WorkoutItem
  setNumber: number
  /** 'each' = one entry that logs the same numbers for left and right. */
  side: 'left' | 'right' | 'both' | 'each'
  sideLabel: string | null
}

interface StepBase {
  id: string
  section: 'warmup' | 'main'
  blockTitle: string
  /** Progression unit key for main blocks (matches progression.ts), null for warm-ups. */
  unitKey: string | null
}

/** One set of one exercise (sets blocks, timed items). */
export interface WorkStep extends StepBase {
  kind: 'work'
  format: WorkoutBlock['format']
  entry: Entry
  totalSets: number
  /** Seconds of rest after this step, or null to go straight on. */
  restAfter: number | null
  restGuidance: string | null
}

/** A whole circuit round: every exercise, one tap. */
export interface RoundStep extends StepBase {
  kind: 'round'
  entries: Entry[]
  round: number
  totalRounds: number
  restAfter: number | null
  restGuidance: string | null
}

/** The entire warm-up as one checklist. */
export interface ChecklistStep extends StepBase {
  kind: 'checklist'
  groups: { title: string; rounds: number; items: WorkoutItem[] }[]
  entries: Entry[]
}

export interface EmomStep extends StepBase {
  kind: 'emom'
  itemKey: string
  item: WorkoutItem
  minutes: number
}

export type PlanStep = WorkStep | RoundStep | ChecklistStep | EmomStep

export interface PlanOverrides {
  /** Sets (sets blocks) or rounds (circuits), keyed by unit key. */
  sets: Record<string, number>
  /** Rest seconds keyed by unit key. */
  rest: Record<string, number>
}

export const emptyOverrides = (): PlanOverrides => ({ sets: {}, rest: {} })

function sideNames(item: WorkoutItem): [string, string] {
  return item.sideNames ?? ['Left', 'Right']
}

/** Entry side for one set of an item (alternating items switch sides set to set). */
function entrySide(item: WorkoutItem, setNumber: number): Pick<Entry, 'side' | 'sideLabel'> {
  const [l, r] = sideNames(item)
  if (item.alternateSides) return setNumber % 2 === 1 ? { side: 'left', sideLabel: l } : { side: 'right', sideLabel: r }
  if (item.perSide) return { side: 'each', sideLabel: item.sideNames ? `each way` : 'each side' }
  return { side: 'both', sideLabel: null }
}

function entry(prefix: string, i: number, item: WorkoutItem, setNumber: number, side?: Pick<Entry, 'side' | 'sideLabel'>): Entry {
  const s = side ?? entrySide(item, setNumber)
  return { id: `${prefix}-${i}-${setNumber}-${s.side}`, itemKey: `${prefix}-${i}`, item, setNumber, ...s }
}

export function buildPlan(workout: Workout, overrides: PlanOverrides = emptyOverrides()): PlanStep[] {
  const steps: PlanStep[] = []

  // Warm-up: one checklist covering every warm-up block.
  if (workout.warmup.length) {
    const entries: Entry[] = []
    const groups: ChecklistStep['groups'] = []
    workout.warmup.forEach((block, b) => {
      const prefix = `warmup-${b}`
      const rounds = block.format === 'circuit' ? block.rounds ?? 1 : 1
      groups.push({ title: block.title, rounds, items: block.items })
      block.items.forEach((item, i) => {
        const sets = block.format === 'circuit' ? rounds : item.sets ?? 1
        for (let n = 1; n <= sets; n++) entries.push(entry(prefix, i, item, n))
      })
    })
    steps.push({ kind: 'checklist', id: 'warmup', section: 'warmup', blockTitle: 'Warm-up', unitKey: null, groups, entries })
  }

  workout.main.forEach((block, b) => {
    const prefix = `main-${b}`
    if (block.format === 'emom') {
      steps.push({
        kind: 'emom',
        id: `${prefix}-emom`,
        section: 'main',
        blockTitle: block.title,
        unitKey: `${b}`,
        itemKey: `${prefix}-0`,
        item: block.items[0],
        minutes: block.minutes ?? 10,
      })
      return
    }

    if (block.format === 'circuit') {
      const unitKey = `${b}`
      const rounds = overrides.sets[unitKey] || block.rounds || 1
      const rest = overrides.rest[unitKey] || block.restBetweenRounds?.seconds || null
      for (let r = 1; r <= rounds; r++) {
        steps.push({
          kind: 'round',
          id: `${prefix}-round-${r}`,
          section: 'main',
          blockTitle: block.title,
          unitKey,
          entries: block.items.map((item, i) => entry(prefix, i, item, r)),
          round: r,
          totalRounds: rounds,
          restAfter: r < rounds ? rest : null,
          restGuidance: block.restBetweenRounds?.guidance ?? null,
        })
      }
      return
    }

    // `sets`: one step per set. `timed`: one step per item, per-side items split so each side gets its own timer.
    block.items.forEach((item, i) => {
      const unitKey = block.format === 'sets' ? `${b}:${i}` : null
      const sets = (unitKey && overrides.sets[unitKey]) || item.sets || 1
      const rest = (unitKey && overrides.rest[unitKey]) || item.rest?.seconds || null
      for (let n = 1; n <= sets; n++) {
        const [l, r] = sideNames(item)
        const sides: Pick<Entry, 'side' | 'sideLabel'>[] =
          block.format === 'timed' && item.perSide
            ? [
                { side: 'left', sideLabel: l },
                { side: 'right', sideLabel: r },
              ]
            : [entrySide(item, n)]
        sides.forEach((side, si) => {
          const e = entry(prefix, i, item, n, side)
          steps.push({
            kind: 'work',
            id: e.id,
            section: 'main',
            blockTitle: block.title,
            unitKey,
            format: block.format,
            entry: e,
            totalSets: sets,
            restAfter: si === sides.length - 1 && n < sets ? rest : null,
            restGuidance: item.rest?.guidance ?? null,
          })
        })
      }
    })
  })
  return steps
}

/** Entries a step logs when marked done. */
export function stepEntries(step: PlanStep): Entry[] {
  switch (step.kind) {
    case 'work':
      return [step.entry]
    case 'round':
    case 'checklist':
      return step.entries
    case 'emom':
      return []
  }
}

export function targetText(item: WorkoutItem): string {
  if (item.reps !== undefined) return `${item.reps} ${item.unit ?? (item.reps === 1 ? 'rep' : 'reps')}`
  if (item.seconds !== undefined) return item.seconds >= 120 ? `${Math.round(item.seconds / 60)} min` : `${item.seconds} s`
  return ''
}

export interface EquipmentProfile {
  has_pullup_bar: boolean
  has_dip_bars: boolean
}

export function hasEquipment(equipment: Equipment[], profile: EquipmentProfile): boolean {
  return equipment.every((e) => (e === 'pullup_bar' ? profile.has_pullup_bar : e === 'dip_bars' ? profile.has_dip_bars : true))
}

/**
 * The exercise to do for an item: the prescribed one if the athlete has the
 * equipment (and, for kids, it is kid-safe), else the first substitution that works.
 */
export function defaultExerciseFor(exerciseId: string, profile: EquipmentProfile, kidMode: boolean): string {
  const ok = (id: string) => {
    const ex = getExercise(id)
    return !!ex && hasEquipment(ex.equipment, profile) && (!kidMode || ex.kidSafe)
  }
  if (ok(exerciseId)) return exerciseId
  return getExercise(exerciseId)?.substitutions.find(ok) ?? exerciseId
}

/** Exercises the athlete may pick for an item: the prescribed one plus its substitutions. */
export function exerciseOptions(exerciseId: string, kidMode: boolean): string[] {
  const ids = [exerciseId, ...(getExercise(exerciseId)?.substitutions ?? [])]
  return ids.filter((id) => !kidMode || getExercise(id)?.kidSafe)
}

// ---------------------------------------------------------------------------
// Logging

export interface EntryLog {
  reps: number | null
  weight: number | null
  seconds: number | null
  /** Rest (s) taken after this entry; recorded on the last entry of a step. */
  rest: number | null
  done: boolean
}

/** Pre-filled log: the target reps/seconds and the session bell for loaded exercises. */
export function defaultEntryLog(e: Entry, exerciseId: string, bell: number): EntryLog {
  return {
    reps: e.item.reps ?? null,
    weight: isLoaded(exerciseId) ? bell : null,
    seconds: e.item.seconds ?? null,
    rest: null,
    done: false,
  }
}

export interface LogContext {
  logs: Record<string, EntryLog>
  /** Exercise actually done for an item (substitutions). */
  exerciseFor: (itemKey: string) => string
  bell: number
  emomReps: Record<string, number[]>
  /** Minutes started per EMOM step; only these are logged. */
  emomReached: Record<string, number>
}

/** Everything marked done, as `set_logs` rows. A per-side entry becomes a left and a right row. */
export function buildSetLogs(steps: PlanStep[], ctx: LogContext): SetLogInput[] {
  const out: SetLogInput[] = []
  const seen = new Set<string>()
  for (const step of steps) {
    if (step.kind === 'emom') {
      const exerciseId = ctx.exerciseFor(step.itemKey)
      const reached = ctx.logs[step.id]?.done ? ctx.emomReached[step.id] ?? 0 : 0
      const reps = ctx.emomReps[step.id] ?? Array.from({ length: step.minutes }, () => step.item.reps ?? 0)
      reps.slice(0, reached).forEach((r, i) =>
        out.push({
          exercise_id: exerciseId,
          set_number: i + 1,
          reps: r,
          weight_lb: isLoaded(exerciseId) ? ctx.bell : null,
          seconds: null,
          side: 'both',
          rest_sec: null,
        }),
      )
      continue
    }
    for (const e of stepEntries(step)) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      const l = ctx.logs[e.id]
      if (!l?.done) continue
      const row = {
        exercise_id: ctx.exerciseFor(e.itemKey),
        set_number: e.setNumber,
        reps: e.item.reps !== undefined ? l.reps : null,
        weight_lb: l.weight,
        seconds: e.item.seconds !== undefined ? l.seconds : null,
        rest_sec: l.rest,
      }
      if (e.side === 'each') {
        out.push({ ...row, side: 'left', rest_sec: null }, { ...row, side: 'right' })
      } else {
        out.push({ ...row, side: e.side })
      }
    }
  }
  return out
}

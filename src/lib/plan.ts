import { getExercise, type Equipment, type Workout, type WorkoutBlock, type WorkoutItem } from '../content'

/** One tap-through step of the session player. */
export interface WorkStep {
  kind: 'work'
  /** Stable id so logs survive plan rebuilds (e.g. after adding a round). */
  id: string
  section: 'warmup' | 'main'
  blockTitle: string
  format: WorkoutBlock['format']
  /** Progression unit key for main blocks (matches progression.ts), null for warm-ups. */
  unitKey: string | null
  /** Key for this item's substitution choice. */
  itemKey: string
  item: WorkoutItem
  setNumber: number
  totalSets: number
  side: 'left' | 'right' | 'both'
  sideLabel: string | null
  /** Seconds of rest after this step, or null to go straight on. */
  restAfter: number | null
  restGuidance: string | null
}

export interface EmomStep {
  kind: 'emom'
  id: string
  section: 'warmup' | 'main'
  blockTitle: string
  unitKey: string | null
  itemKey: string
  item: WorkoutItem
  minutes: number
}

export type PlanStep = WorkStep | EmomStep

export interface PlanOverrides {
  /** Sets (sets blocks) or rounds (circuits), keyed by unit key. */
  sets: Record<string, number>
  /** Rest seconds keyed by unit key. */
  rest: Record<string, number>
}

export const emptyOverrides = (): PlanOverrides => ({ sets: {}, rest: {} })

function sideSteps(item: WorkoutItem, setNumber: number): { side: WorkStep['side']; sideLabel: string | null }[] {
  const names = item.sideNames ?? ['Left', 'Right']
  if (item.alternateSides) {
    const left = setNumber % 2 === 1
    return [{ side: left ? 'left' : 'right', sideLabel: left ? names[0] : names[1] }]
  }
  if (item.perSide) {
    return [
      { side: 'left', sideLabel: names[0] },
      { side: 'right', sideLabel: names[1] },
    ]
  }
  return [{ side: 'both', sideLabel: null }]
}

export function buildPlan(workout: Workout, overrides: PlanOverrides = emptyOverrides()): PlanStep[] {
  const steps: PlanStep[] = []
  const sections: ['warmup' | 'main', WorkoutBlock[]][] = [
    ['warmup', workout.warmup],
    ['main', workout.main],
  ]

  for (const [section, blocks] of sections) {
    blocks.forEach((block, b) => {
      const prefix = `${section}-${b}`
      if (block.format === 'emom') {
        const item = block.items[0]
        steps.push({
          kind: 'emom',
          id: `${prefix}-emom`,
          section,
          blockTitle: block.title,
          unitKey: section === 'main' ? `${b}` : null,
          itemKey: `${prefix}-0`,
          item,
          minutes: block.minutes ?? 10,
        })
        return
      }

      if (block.format === 'circuit') {
        const unitKey = section === 'main' ? `${b}` : null
        const rounds = (unitKey && overrides.sets[unitKey]) || block.rounds || 1
        const rest = (unitKey && overrides.rest[unitKey]) || block.restBetweenRounds?.seconds || null
        for (let r = 1; r <= rounds; r++) {
          block.items.forEach((item, i) => {
            const sides = sideSteps(item, r)
            sides.forEach((s, si) => {
              const lastOfRound = i === block.items.length - 1 && si === sides.length - 1
              steps.push({
                kind: 'work',
                id: `${prefix}-${i}-${r}-${s.side}`,
                section,
                blockTitle: block.title,
                format: block.format,
                unitKey,
                itemKey: `${prefix}-${i}`,
                item,
                setNumber: r,
                totalSets: rounds,
                ...s,
                restAfter: lastOfRound && r < rounds ? rest : null,
                restGuidance: block.restBetweenRounds?.guidance ?? null,
              })
            })
          })
        }
        return
      }

      // `sets` and `timed`: each item done in full before the next.
      block.items.forEach((item, i) => {
        const unitKey = section === 'main' && block.format === 'sets' ? `${b}:${i}` : null
        const sets = (unitKey && overrides.sets[unitKey]) || item.sets || 1
        const rest = (unitKey && overrides.rest[unitKey]) || item.rest?.seconds || null
        for (let s = 1; s <= sets; s++) {
          const sides = sideSteps(item, s)
          sides.forEach((sd, si) => {
            const lastSide = si === sides.length - 1
            steps.push({
              kind: 'work',
              id: `${prefix}-${i}-${s}-${sd.side}`,
              section,
              blockTitle: block.title,
              format: block.format,
              unitKey,
              itemKey: `${prefix}-${i}`,
              item,
              setNumber: s,
              totalSets: sets,
              ...sd,
              restAfter: lastSide && s < sets ? rest : null,
              restGuidance: item.rest?.guidance ?? null,
            })
          })
        }
      })
    })
  }
  return steps
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

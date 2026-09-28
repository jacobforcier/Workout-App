import { describe, expect, it } from 'vitest'
import { getWorkout, workouts, type Workout } from '../content'
import { buildPlan, buildSetLogs, defaultEntryLog, stepEntries, type EntryLog, type PlanStep } from './plan'
import { hitAllTargets, progressionUnits } from './progression'

const w = (id: string) => getWorkout(id) as Workout

/** Mark every step done at its defaults, as tapping "Done" through the session would. */
function doAll(steps: PlanStep[], bell = 35) {
  const logs: Record<string, EntryLog> = {}
  const emomReached: Record<string, number> = {}
  for (const s of steps) {
    if (s.kind === 'emom') {
      logs[s.id] = { reps: null, weight: null, seconds: null, rest: null, done: true }
      emomReached[s.id] = s.minutes
      continue
    }
    const entries = stepEntries(s)
    entries.forEach((e, i) => {
      const rest = i === entries.length - 1 && (s.kind === 'work' || s.kind === 'round') ? s.restAfter : null
      logs[e.id] = { ...defaultEntryLog(e, e.item.exerciseId, bell), done: true, rest }
    })
  }
  return buildSetLogs(steps, { logs, exerciseFor: (key) => keyToExercise(steps, key), bell, emomReps: {}, emomReached })
}

function keyToExercise(steps: PlanStep[], itemKey: string): string {
  for (const s of steps) {
    if (s.kind === 'emom' && s.itemKey === itemKey) return s.item.exerciseId
    for (const e of stepEntries(s)) if (e.itemKey === itemKey) return e.item.exerciseId
  }
  throw new Error(itemKey)
}

describe('buildPlan: taps per session', () => {
  it('uses one step for the warm-up and one per circuit round', () => {
    const steps = buildPlan(w('foundation'))
    expect(steps.map((s) => s.kind)).toEqual(['checklist', 'round', 'round', 'round'])
  })

  it('logs both sides of a per-side set with one step', () => {
    const steps = buildPlan(w('joe_rogan_podcast'))
    // Warm-up + 4 exercises × 3 sets.
    expect(steps).toHaveLength(13)
    const first = steps[1]
    expect(first.kind === 'work' && first.entry.side).toBe('each')
  })

  it('keeps alternating sides and per-side timers', () => {
    const ss = buildPlan(w('simple_sinister')).filter((s) => s.kind === 'work')
    expect(ss.slice(0, 2).map((s) => s.kind === 'work' && s.entry.side)).toEqual(['left', 'right'])
    const recovery = buildPlan(w('recovery')).filter((s) => s.kind === 'work' && s.entry.item.exerciseId === 'worlds_greatest_stretch')
    expect(recovery).toHaveLength(2)
  })

  it('keeps every workout to a handful of taps', () => {
    for (const workout of workouts) expect(buildPlan(workout).length, workout.id).toBeLessThanOrEqual(22)
  })

  it('applies round and rest overrides', () => {
    const steps = buildPlan(w('joe_rogan'), { sets: { '0': 5 }, rest: { '0': 60 } })
    const rounds = steps.filter((s) => s.kind === 'round')
    expect(rounds).toHaveLength(5)
    expect(rounds[0].kind === 'round' && rounds[0].restAfter).toBe(60)
    expect(rounds[4].kind === 'round' && rounds[4].restAfter).toBeNull()
  })
})

describe('buildSetLogs', () => {
  it('turns a per-side entry into a left and a right row', () => {
    const logs = doAll(buildPlan(w('joe_rogan_podcast')))
    const swings = logs.filter((l) => l.exercise_id === 'one_arm_swing')
    expect(swings).toHaveLength(6)
    expect(swings.filter((l) => l.side === 'left')).toHaveLength(3)
    expect(swings.every((l) => l.reps === 10 && l.weight_lb === 35)).toBe(true)
  })

  it('logs the warm-up checklist at its targets', () => {
    const logs = doAll(buildPlan(w('joe_rogan')))
    expect(logs.filter((l) => l.exercise_id === 'two_hand_swing').map((l) => l.reps)).toEqual([20, 20])
  })

  it('records rest on the round that was followed by rest', () => {
    const logs = doAll(buildPlan(w('foundation')))
    expect(logs.filter((l) => l.rest_sec).map((l) => [l.exercise_id, l.set_number, l.rest_sec])).toEqual([
      ['single_arm_row', 1, 90],
      ['single_arm_row', 2, 90],
    ])
  })

  it('produces logs the progression logic accepts as "all targets hit"', () => {
    for (const workout of workouts) {
      const logs = doAll(buildPlan(workout))
      for (const unit of progressionUnits(workout)) expect(hitAllTargets(unit, logs), `${workout.id} ${unit.key}`).toBe(true)
    }
  })

  it('skips steps not marked done', () => {
    const steps = buildPlan(w('foundation'))
    expect(buildSetLogs(steps, { logs: {}, exerciseFor: () => 'x', bell: 35, emomReps: {}, emomReached: {} })).toEqual([])
  })
})

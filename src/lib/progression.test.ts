import { describe, expect, it } from 'vitest'
import { getWorkout, type Workout } from '../content'
import {
  hitAllTargets,
  nextBell,
  progressionUnits,
  restUsed,
  setsPerformed,
  suggestProgressions,
  type SessionLike,
  type SetLogLike,
} from './progression'

const joeRogan = getWorkout('joe_rogan') as Workout
const foundation = getWorkout('foundation') as Workout
const simpleSinister = getWorkout('simple_sinister') as Workout
const emom = getWorkout('swing_emom') as Workout
const joePodcast = getWorkout('joe_rogan_podcast') as Workout

function log(exercise_id: string, set_number: number, reps: number, side: SetLogLike['side'] = 'both', rest_sec: number | null = null): SetLogLike {
  return { exercise_id, set_number, reps, seconds: null, side, rest_sec }
}

/** Joe Rogan main circuit: chin-ups, dips, overhead squat per side. */
function joeRoganLogs(rounds: number, reps = 5, rest = 120): SetLogLike[] {
  const logs: SetLogLike[] = []
  for (let r = 1; r <= rounds; r++) {
    logs.push(log('chin_up', r, reps))
    logs.push(log('dip', r, reps))
    logs.push(log('kb_overhead_squat', r, reps, 'left'))
    logs.push(log('kb_overhead_squat', r, reps, 'right', r < rounds ? rest : null))
  }
  return logs
}

function session(id: string, performed_on: string, rpe: number | null, set_logs: SetLogLike[], bell_lb = 35): SessionLike {
  return { id, performed_on, rpe, bell_lb, completed: true, set_logs }
}

const base = { currentBellLb: 35, availableBellsLb: [26, 35, 44, 53] }

describe('progressionUnits', () => {
  it('treats a circuit as one unit using rounds', () => {
    const units = progressionUnits(joeRogan)
    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({ format: 'circuit', targetSets: 3, maxSets: 5 })
  })
  it('treats each item of a sets block as its own unit', () => {
    const units = progressionUnits(simpleSinister)
    expect(units.map((u) => u.key)).toEqual(['0:0', '1:0'])
    expect(units[0]).toMatchObject({ targetSets: 10, maxSets: 10 })
  })
  it('skips timed blocks', () => {
    expect(progressionUnits(getWorkout('recovery') as Workout)).toHaveLength(0)
  })
})

describe('hitAllTargets', () => {
  const unit = progressionUnits(joeRogan)[0]
  it('passes when every set meets the target', () => {
    expect(hitAllTargets(unit, joeRoganLogs(3))).toBe(true)
  })
  it('fails when a set is short', () => {
    const logs = joeRoganLogs(3)
    logs[1] = log('dip', 1, 4)
    expect(hitAllTargets(unit, logs)).toBe(false)
  })
  it('fails when too few rounds were done', () => {
    expect(hitAllTargets(unit, joeRoganLogs(2))).toBe(false)
  })
  it('requires both sides for per-side items', () => {
    const logs = joeRoganLogs(3).filter((l) => !(l.exercise_id === 'kb_overhead_squat' && l.side === 'right' && l.set_number === 2))
    expect(hitAllTargets(unit, logs)).toBe(false)
  })
  it('accepts a listed substitution', () => {
    const logs = joeRoganLogs(3).map((l) => (l.exercise_id === 'chin_up' ? { ...l, exercise_id: 'single_arm_row', side: 'left' as const } : l))
    expect(hitAllTargets(unit, logs)).toBe(true)
  })
})

describe('setsPerformed / restUsed', () => {
  const unit = progressionUnits(joeRogan)[0]
  it('counts rounds', () => {
    expect(setsPerformed(unit, joeRoganLogs(4))).toBe(4)
  })
  it('returns the rest used, or null', () => {
    expect(restUsed(unit, joeRoganLogs(3, 5, 90))).toBe(90)
    expect(restUsed(unit, joeRoganLogs(1))).toBeNull()
  })
})

describe('nextBell', () => {
  it('picks the next heavier available bell', () => {
    expect(nextBell(35, [53, 26, 44])).toBe(44)
    expect(nextBell(53, [26, 35, 53])).toBeNull()
  })
})

describe('suggestProgressions', () => {
  it('needs two completed sessions', () => {
    expect(suggestProgressions({ workout: joeRogan, sessions: [session('a', '2026-09-01', 6, joeRoganLogs(3))], ...base })).toEqual([])
  })

  it('needs RPE ≤ 7 in both sessions', () => {
    const sessions = [session('a', '2026-09-01', 8, joeRoganLogs(3)), session('b', '2026-09-03', 6, joeRoganLogs(3))]
    expect(suggestProgressions({ workout: joeRogan, sessions, ...base })).toEqual([])
    const missing = [session('a', '2026-09-01', null, joeRoganLogs(3)), session('b', '2026-09-03', 6, joeRoganLogs(3))]
    expect(suggestProgressions({ workout: joeRogan, sessions: missing, ...base })).toEqual([])
  })

  it('needs all target reps in both sessions', () => {
    const short = joeRoganLogs(3)
    short[0] = log('chin_up', 1, 3)
    const sessions = [session('a', '2026-09-01', 6, short), session('b', '2026-09-03', 6, joeRoganLogs(3))]
    expect(suggestProgressions({ workout: joeRogan, sessions, ...base })).toEqual([])
  })

  it('only looks at the two most recent sessions', () => {
    const bad = joeRoganLogs(3)
    bad[0] = log('chin_up', 1, 1)
    const sessions = [
      session('old', '2026-08-01', 9, bad),
      session('a', '2026-09-01', 6, joeRoganLogs(3)),
      session('b', '2026-09-03', 7, joeRoganLogs(3)),
    ]
    expect(suggestProgressions({ workout: joeRogan, sessions, ...base })).toHaveLength(1)
  })

  it('ignores incomplete sessions', () => {
    const sessions = [
      session('a', '2026-09-01', 6, joeRoganLogs(3)),
      { ...session('b', '2026-09-02', 6, []), completed: false },
      session('c', '2026-09-03', 6, joeRoganLogs(3)),
    ]
    expect(suggestProgressions({ workout: joeRogan, sessions, ...base })[0]?.kind).toBe('add_set')
  })

  it('first suggests adding a round, up to the max', () => {
    const sessions = [session('a', '2026-09-01', 6, joeRoganLogs(3)), session('b', '2026-09-03', 6, joeRoganLogs(4))]
    const [s] = suggestProgressions({ workout: joeRogan, sessions, ...base })
    expect(s).toMatchObject({ kind: 'add_set', from: 4, to: 5 })
    expect(s.message).toContain('5 rounds')
  })

  it('then suggests shortening rest', () => {
    const sessions = [session('a', '2026-09-01', 6, joeRoganLogs(5)), session('b', '2026-09-03', 6, joeRoganLogs(5, 5, 120))]
    const [s] = suggestProgressions({ workout: joeRogan, sessions, ...base })
    expect(s).toMatchObject({ kind: 'shorten_rest', from: 120, to: 105 })
  })

  it('never suggests rest below the minimum', () => {
    const sessions = [session('a', '2026-09-01', 6, joeRoganLogs(5)), session('b', '2026-09-03', 6, joeRoganLogs(5, 5, 70))]
    const [s] = suggestProgressions({ workout: joeRogan, sessions, ...base })
    expect(s).toMatchObject({ kind: 'shorten_rest', from: 70, to: 60 })
  })

  it('then suggests the next available bell', () => {
    const sessions = [session('a', '2026-09-01', 6, joeRoganLogs(5, 5, 60)), session('b', '2026-09-03', 7, joeRoganLogs(5, 5, 60))]
    const [s] = suggestProgressions({ workout: joeRogan, sessions, ...base })
    expect(s).toMatchObject({ kind: 'next_bell', from: 35, to: 44 })
  })

  it('does not suggest a bell after the athlete already moved up', () => {
    const sessions = [session('a', '2026-09-01', 6, joeRoganLogs(5, 5, 60)), session('b', '2026-09-03', 6, joeRoganLogs(5, 5, 60))]
    expect(suggestProgressions({ workout: joeRogan, sessions, currentBellLb: 44, availableBellsLb: [35, 44, 53] })).toEqual([])
  })

  it('suggests more reps when there is no heavier bell', () => {
    const sessions = [session('a', '2026-09-01', 6, joeRoganLogs(5, 5, 60)), session('b', '2026-09-03', 6, joeRoganLogs(5, 5, 60))]
    const [s] = suggestProgressions({ workout: joeRogan, sessions, currentBellLb: 35, availableBellsLb: [26, 35] })
    expect(s.kind).toBe('add_reps')
  })

  it('goes straight to rest for fixed-round circuits (Foundation)', () => {
    const logs = (rest: number): SetLogLike[] => {
      const out: SetLogLike[] = []
      for (let r = 1; r <= 3; r++) {
        out.push(log('kb_deadlift', r, 10), log('goblet_squat', r, 8), log('two_hand_swing', r, 10))
        out.push(log('single_arm_press', r, 5, 'left'), log('single_arm_press', r, 5, 'right'))
        out.push(log('single_arm_row', r, 8, 'left'), log('single_arm_row', r, 8, 'right', r < 3 ? rest : null))
      }
      return out
    }
    const sessions = [session('a', '2026-09-01', 5, logs(90)), session('b', '2026-09-03', 5, logs(90))]
    const [s] = suggestProgressions({ workout: foundation, sessions, ...base })
    expect(s).toMatchObject({ kind: 'shorten_rest', from: 90, to: 75 })
  })

  it('suggests the next bell for EMOM when all minutes are hit', () => {
    const logs = Array.from({ length: 10 }, (_, i) => log('two_hand_swing', i + 1, 10))
    const sessions = [session('a', '2026-09-01', 6, logs), session('b', '2026-09-03', 6, logs)]
    const [s] = suggestProgressions({ workout: emom, sessions, ...base })
    expect(s).toMatchObject({ kind: 'next_bell', to: 44 })
  })

  it('suggests the next bell for the podcast version (fixed sets, full rest)', () => {
    const logs: SetLogLike[] = []
    for (const id of ['one_arm_swing', 'kb_clean_and_press', 'windmill', 'renegade_row']) {
      for (let s = 1; s <= 3; s++) logs.push(log(id, s, 10, 'left'), log(id, s, 10, 'right', 120))
    }
    const sessions = [session('a', '2026-09-01', 6, logs), session('b', '2026-09-03', 7, logs)]
    const suggestions = suggestProgressions({ workout: joePodcast, sessions, ...base })
    expect(suggestions).toHaveLength(4)
    expect(suggestions.every((s) => s.kind === 'next_bell' && s.to === 44)).toBe(true)
  })
})

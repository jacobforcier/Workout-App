import { describe, expect, it } from 'vitest'
import { lastSessionWithExercise, lastTimeForExercise, personalRecords, summarizeExercise, type LogLike } from './records'

const l = (exercise_id: string, set_number: number, reps: number | null, weight_lb: number | null = 35, side: LogLike['side'] = 'both', seconds: number | null = null): LogLike => ({
  exercise_id,
  set_number,
  reps,
  weight_lb,
  side,
  seconds,
})
const name = (id: string) => id

describe('summarizeExercise', () => {
  it('summarizes uniform sets', () => {
    expect(summarizeExercise('goblet_squat', [l('goblet_squat', 1, 8), l('goblet_squat', 2, 8), l('goblet_squat', 3, 8)])).toBe('3 × 8 @ 35 lb')
  })
  it('lists uneven sets', () => {
    expect(summarizeExercise('dip', [l('dip', 1, 5, null), l('dip', 2, 5, null), l('dip', 3, 4, null)])).toBe('3 sets: 5, 5, 4')
  })
  it('handles per-side sets, reporting the weaker side', () => {
    const logs = [l('row', 1, 8, 35, 'left'), l('row', 1, 7, 35, 'right'), l('row', 2, 8, 35, 'left'), l('row', 2, 8, 35, 'right')]
    expect(summarizeExercise('row', logs)).toBe('2 sets: 7, 8/side @ 35 lb')
  })
  it('handles holds and single sets', () => {
    expect(summarizeExercise('plank', [l('plank', 1, null, null, 'both', 20)])).toBe('20 s')
  })
  it('returns null when the exercise was not logged', () => {
    expect(summarizeExercise('plank', [l('dip', 1, 5)])).toBeNull()
  })
})

describe('personalRecords', () => {
  const history = [{ performed_on: '2026-09-01', rpe: 6, set_logs: [l('swing', 1, 10, 35), l('press', 1, 5, 26), l('plank', 1, null, null, 'both', 20), l('dip', 1, 5, null)] }]

  it('reports a heavier bell', () => {
    expect(personalRecords([l('swing', 1, 10, 44)], history, name)).toEqual([{ exerciseId: 'swing', kind: 'weight', message: 'swing: heaviest yet, 44 lb' }])
  })
  it('reports more reps at the same weight', () => {
    expect(personalRecords([l('press', 1, 6, 26)], history, name)[0]).toMatchObject({ kind: 'reps', message: 'press: most reps in a set at 26 lb, 6' })
    expect(personalRecords([l('dip', 1, 7, null)], history, name)[0]).toMatchObject({ kind: 'reps', message: 'dip: most reps in a set, 7' })
  })
  it('reports a longer hold', () => {
    expect(personalRecords([l('plank', 1, null, null, 'both', 30)], history, name)[0]).toMatchObject({ kind: 'hold' })
  })
  it('does not celebrate a first attempt or a matched result', () => {
    expect(personalRecords([l('windmill', 1, 5, 18)], history, name)).toEqual([])
    expect(personalRecords([l('swing', 1, 10, 35)], history, name)).toEqual([])
  })
  it('does not count more reps with a lighter bell', () => {
    expect(personalRecords([l('swing', 1, 20, 26)], history, name)).toEqual([])
  })
})

describe('lastTimeForExercise', () => {
  const warmupOnly = (w: string, ex: string) => w === 'strength_a' && ex === 'halo'
  const sessions = [
    { workout_id: 'foundation', performed_on: '2026-11-21', rpe: 5, set_logs: [l('single_arm_row', 1, 10, 53, 'left'), l('single_arm_row', 1, 10, 53, 'right')] },
    { workout_id: 'strength_a', performed_on: '2026-11-20', rpe: 7, set_logs: [l('halo', 1, 10, 35)] },
    { workout_id: 'strength_c', performed_on: '2026-11-19', rpe: 7, set_logs: [l('single_arm_row', 1, 8, 53), l('halo', 1, 10, 53)] },
  ]
  it('uses the most recent session of any workout', () => {
    expect(lastTimeForExercise('single_arm_row', sessions, warmupOnly)).toEqual({ text: '10/side @ 53 lb', performedOn: '2026-11-21', workoutId: 'foundation' })
  })
  it('skips sessions where the exercise was only a warm-up', () => {
    expect(lastTimeForExercise('halo', sessions, warmupOnly)).toMatchObject({ performedOn: '2026-11-19', workoutId: 'strength_c' })
  })
  it('returns null when never done', () => {
    expect(lastTimeForExercise('windmill', sessions, warmupOnly)).toBeNull()
  })
})

describe('lastSessionWithExercise', () => {
  const warmupOnly = (w: string, ex: string) => w === 'strength_a' && ex === 'halo'
  const sessions = [
    { workout_id: 'strength_a', performed_on: '2026-11-23', rpe: 7, set_logs: [l('halo', 1, 10, 35), l('single_arm_row', 1, 13, 53)] },
    { workout_id: 'strength_c', performed_on: '2026-11-20', rpe: 7, set_logs: [l('halo', 1, 10, 53)] },
  ]
  it('finds the newest main-work use across workouts', () => {
    expect(lastSessionWithExercise('single_arm_row', sessions, 'main', warmupOnly)?.performed_on).toBe('2026-11-23')
    expect(lastSessionWithExercise('halo', sessions, 'main', warmupOnly)?.performed_on).toBe('2026-11-20')
  })
  it('keeps warm-up and main uses apart', () => {
    expect(lastSessionWithExercise('halo', sessions, 'warmup', warmupOnly)?.performed_on).toBe('2026-11-23')
    expect(lastSessionWithExercise('single_arm_row', sessions, 'warmup', warmupOnly)).toBeNull()
  })
})

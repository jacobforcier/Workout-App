import { describe, expect, it } from 'vitest'
import { personalRecords, summarizeExercise, type LogLike } from './records'

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

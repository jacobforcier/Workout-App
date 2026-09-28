import { describe, expect, it } from 'vitest'
import { KID_WORKOUT_IDS, rotationFor, rotationWeek, trainingWeek } from './rotation'

// 2026-09-28 is a Monday.
const MON = '2026-09-28'

describe('trainingWeek', () => {
  it('is week 1 with no sessions yet', () => {
    expect(trainingWeek(MON, null)).toBe(1)
  })
  it('counts 7-day weeks from the first session', () => {
    expect(trainingWeek('2026-09-28', '2026-09-28')).toBe(1)
    expect(trainingWeek('2026-10-04', '2026-09-28')).toBe(1)
    expect(trainingWeek('2026-10-05', '2026-09-28')).toBe(2)
    expect(trainingWeek('2026-10-12', '2026-09-28')).toBe(3)
  })
  it('treats dates before the first session as week 1', () => {
    expect(trainingWeek('2026-09-01', '2026-09-28')).toBe(1)
  })
})

describe('rotationFor', () => {
  it('uses Foundation Mon/Wed/Fri and Recovery otherwise in weeks 1–2', () => {
    const week = rotationWeek(MON, 'adult', null).map((d) => d.workoutId)
    expect(week).toEqual(['foundation', 'recovery', 'foundation', 'recovery', 'foundation', 'recovery', 'recovery'])
    // Still intro in week 2.
    expect(rotationFor('2026-10-05', 'adult', MON).workoutId).toBe('foundation')
    expect(rotationFor('2026-10-06', 'adult', MON).workoutId).toBe('recovery')
    expect(rotationFor('2026-10-06', 'adult', MON).intro).toBe(true)
  })

  it('uses the default adult rotation from week 3', () => {
    const first = '2026-09-14' // two weeks before MON
    const week = rotationWeek(MON, 'adult', first)
    expect(week.map((d) => d.workoutId)).toEqual([
      'joe_rogan',
      'swing_emom',
      'recovery',
      'joe_rogan',
      'simple_sinister',
      'family_circuit',
      null,
    ])
    expect(week[6].label).toBe('Rest or walk')
    expect(week[0].week).toBe(3)
    expect(week[0].intro).toBe(false)
  })

  it('only gives kids Family circuit, Recovery, and Foundation', () => {
    for (const first of [null, '2026-01-05']) {
      for (const d of rotationWeek(MON, 'kid', first)) {
        if (d.workoutId !== null) expect(KID_WORKOUT_IDS).toContain(d.workoutId)
      }
    }
    const kidWeek = rotationWeek(MON, 'kid', '2026-01-05').map((d) => d.workoutId)
    expect(kidWeek).toContain('family_circuit')
    expect(kidWeek).toContain('foundation')
    expect(kidWeek).toContain('recovery')
  })
})

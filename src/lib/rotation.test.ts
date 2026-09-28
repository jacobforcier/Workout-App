import { describe, expect, it } from 'vitest'
import { defaultWeeklyPlan, KID_WORKOUT_IDS, rotationFor, rotationWeek, trainingWeek, type RotationProfile } from './rotation'

// 2026-09-28 is a Monday.
const MON = '2026-09-28'
const ADULT: RotationProfile = { kind: 'adult', has_pullup_bar: true, has_dip_bars: true }
const KID: RotationProfile = { kind: 'kid' }

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
    const week = rotationWeek(MON, ADULT, null).map((d) => d.workoutId)
    expect(week).toEqual(['foundation', 'recovery', 'foundation', 'recovery', 'foundation', 'recovery', 'recovery'])
    // Still intro in week 2.
    expect(rotationFor('2026-10-05', ADULT, MON).workoutId).toBe('foundation')
    expect(rotationFor('2026-10-06', ADULT, MON).workoutId).toBe('recovery')
    expect(rotationFor('2026-10-06', ADULT, MON).intro).toBe(true)
  })

  it('uses the default adult rotation from week 3', () => {
    const first = '2026-09-14' // two weeks before MON
    const week = rotationWeek(MON, ADULT, first)
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
      for (const d of rotationWeek(MON, KID, first)) {
        if (d.workoutId !== null) expect(KID_WORKOUT_IDS).toContain(d.workoutId)
      }
    }
    const kidWeek = rotationWeek(MON, KID, '2026-01-05').map((d) => d.workoutId)
    expect(kidWeek).toContain('family_circuit')
    expect(kidWeek).toContain('foundation')
    expect(kidWeek).toContain('recovery')
  })
})

describe('equipment-aware default', () => {
  const first = '2026-09-14'
  it('uses the podcast version with no pull-up bar and no dip bars', () => {
    const week = rotationWeek(MON, { kind: 'adult', has_pullup_bar: false, has_dip_bars: false }, first).map((d) => d.workoutId)
    expect(week[0]).toBe('joe_rogan_podcast')
    expect(week[3]).toBe('joe_rogan_podcast')
    expect(week).not.toContain('joe_rogan')
  })
  it('keeps the Onnit version when either bar is available', () => {
    expect(rotationFor(MON, { kind: 'adult', has_pullup_bar: true, has_dip_bars: false }, first).workoutId).toBe('joe_rogan')
    expect(rotationFor(MON, { kind: 'adult', has_pullup_bar: false, has_dip_bars: true }, first).workoutId).toBe('joe_rogan')
  })
})

describe('custom weekly plan', () => {
  const plan = ['joe_rogan_podcast', 'recovery', 'swing_emom', null, 'simple_sinister', 'family_circuit', null]
  it('replaces the default, Monday first, including intro weeks', () => {
    const week = rotationWeek(MON, { ...ADULT, custom_rotation: plan }, null)
    expect(week.map((d) => d.workoutId)).toEqual(plan)
    expect(week.every((d) => d.custom && !d.intro)).toBe(true)
    expect(week[3].label).toBe('Rest or walk')
  })
  it('turns unknown workouts into rest days', () => {
    const bad = ['nope', ...plan.slice(1)]
    expect(rotationFor(MON, { ...ADULT, custom_rotation: bad }, null).workoutId).toBeNull()
  })
  it('never gives kids adult workouts', () => {
    const week = rotationWeek(MON, { kind: 'kid', custom_rotation: plan }, null).map((d) => d.workoutId)
    expect(week).toEqual([null, 'recovery', null, null, null, 'family_circuit', null])
  })
  it('ignores a malformed plan', () => {
    expect(rotationFor(MON, { ...ADULT, custom_rotation: ['recovery'] }, null).custom).toBe(false)
  })
})

describe('defaultWeeklyPlan', () => {
  it('is Monday first and equipment-aware', () => {
    expect(defaultWeeklyPlan({ kind: 'adult' })).toEqual([
      'joe_rogan_podcast',
      'swing_emom',
      'recovery',
      'joe_rogan_podcast',
      'simple_sinister',
      'family_circuit',
      null,
    ])
    expect(defaultWeeklyPlan(KID)[6]).toBeNull()
  })
})

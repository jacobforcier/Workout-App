import { describe, expect, it } from 'vitest'
import { defaultWeeklyPlan, KID_WORKOUT_IDS, phaseFor, rotationFor, rotationWeek, trainingWeek, weekPlanFor, type RotationProfile } from './rotation'
import { getWorkout } from '../content'

// 2026-09-28 is a Monday.
const MON = '2026-09-28'
const ADULT: RotationProfile = { kind: 'adult', has_pullup_bar: true, has_dip_bars: true }
const KB_ONLY: RotationProfile = { kind: 'adult', has_pullup_bar: false, has_dip_bars: false }
const KID: RotationProfile = { kind: 'kid' }
/** First session N weeks before MON. */
const weeksAgo = (n: number) => {
  const d = new Date(MON + 'T00:00')
  d.setDate(d.getDate() - 7 * n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ids = (profile: RotationProfile, first: string | null) => rotationWeek(MON, profile, first).map((d) => d.workoutId)

describe('trainingWeek', () => {
  it('is week 1 with no sessions yet', () => {
    expect(trainingWeek(MON, null)).toBe(1)
  })
  it('counts 7-day weeks from the first session', () => {
    expect(trainingWeek('2026-10-04', MON)).toBe(1)
    expect(trainingWeek('2026-10-05', MON)).toBe(2)
    expect(trainingWeek('2026-10-12', MON)).toBe(3)
  })
  it('treats dates before the first session as week 1', () => {
    expect(trainingWeek('2026-09-01', MON)).toBe(1)
  })
})

describe('phases', () => {
  it('intro for weeks 1–2, bridge for adults in weeks 3–6, then full', () => {
    expect(phaseFor(1, ADULT)).toBe('intro')
    expect(phaseFor(2, ADULT)).toBe('intro')
    expect(phaseFor(3, ADULT)).toBe('bridge')
    expect(phaseFor(6, ADULT)).toBe('bridge')
    expect(phaseFor(7, ADULT)).toBe('full')
    expect(phaseFor(3, KID)).toBe('full')
  })
  it('keeps one plan for the whole calendar week', () => {
    // First session on a Wednesday: the week containing it is intro from Monday to Sunday.
    const first = '2026-09-30'
    expect(weekPlanFor('2026-09-28', ADULT, first).phase).toBe('intro')
    expect(weekPlanFor('2026-10-04', ADULT, first).phase).toBe('intro')
  })
})

describe('weekly plans', () => {
  it('intro: Foundation Mon/Wed/Fri, Recovery otherwise', () => {
    expect(ids(ADULT, null)).toEqual(['foundation', 'recovery', 'foundation', 'recovery', 'foundation', 'recovery', 'recovery'])
    expect(rotationFor(MON, ADULT, null).intro).toBe(true)
  })

  it('bridge: four harder days, swing-heavy days never back to back', () => {
    expect(ids(ADULT, weeksAgo(2))).toEqual(['joe_rogan', 'recovery', 'swing_emom', 'recovery', 'simple_sinister', 'family_circuit', null])
    expect(ids(KB_ONLY, weeksAgo(2))[0]).toBe('joe_rogan_podcast')
  })

  it('full: the spec rotation with bars, a spaced-out plan without', () => {
    expect(ids(ADULT, weeksAgo(6))).toEqual(['joe_rogan', 'swing_emom', 'recovery', 'joe_rogan', 'simple_sinister', 'family_circuit', null])
    expect(ids(KB_ONLY, weeksAgo(6))).toEqual(['joe_rogan_podcast', 'recovery', 'family_circuit', 'joe_rogan_podcast', 'recovery', 'simple_sinister', null])
    expect(rotationWeek(MON, ADULT, weeksAgo(6))[6].label).toBe('Rest or walk')
  })

  it('never puts swing-heavy workouts on consecutive days in any default plan', () => {
    for (const profile of [ADULT, KB_ONLY, { kind: 'adult' as const, has_pullup_bar: true }]) {
      for (const n of [0, 2, 6]) {
        const plan = ids(profile, n ? weeksAgo(n) : null)
        for (let i = 1; i < 7; i++) {
          const both = [plan[i - 1], plan[i]].every((id) => id && getWorkout(id)?.hingeHeavy)
          expect(both, `${JSON.stringify(profile)} week ${n + 1}: ${plan[i - 1]} → ${plan[i]}`).toBe(false)
        }
      }
    }
  })

  it('only gives kids Family circuit, Recovery, and Foundation', () => {
    for (const first of [null, weeksAgo(10)]) {
      for (const id of ids(KID, first)) if (id !== null) expect(KID_WORKOUT_IDS).toContain(id)
    }
    expect(ids(KID, weeksAgo(10))).toEqual(['foundation', 'recovery', 'family_circuit', 'recovery', 'foundation', 'family_circuit', null])
  })
})

describe('custom weekly plan', () => {
  const plan = ['joe_rogan_podcast', 'recovery', 'swing_emom', null, 'simple_sinister', 'family_circuit', null]
  it('replaces the default, Monday first, including intro weeks', () => {
    const week = rotationWeek(MON, { ...ADULT, custom_rotation: plan }, null)
    expect(week.map((d) => d.workoutId)).toEqual(plan)
    expect(week.every((d) => d.custom && !d.intro && d.phase === 'custom')).toBe(true)
  })
  it('turns unknown workouts into rest days', () => {
    expect(rotationFor(MON, { ...ADULT, custom_rotation: ['nope', ...plan.slice(1)] }, null).workoutId).toBeNull()
  })
  it('never gives kids adult workouts', () => {
    expect(ids({ kind: 'kid', custom_rotation: plan }, null)).toEqual([null, 'recovery', null, null, null, 'family_circuit', null])
  })
  it('ignores a malformed plan', () => {
    expect(rotationFor(MON, { ...ADULT, custom_rotation: ['recovery'] }, null).custom).toBe(false)
  })
})

describe('defaultWeeklyPlan', () => {
  it('is the long-term plan for the athlete', () => {
    expect(defaultWeeklyPlan({ kind: 'adult' })).toEqual(['joe_rogan_podcast', 'recovery', 'family_circuit', 'joe_rogan_podcast', 'recovery', 'simple_sinister', null])
    expect(defaultWeeklyPlan(ADULT)[1]).toBe('swing_emom')
    expect(defaultWeeklyPlan(KID)[6]).toBeNull()
  })
})

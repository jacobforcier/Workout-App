import { describe, expect, it } from 'vitest'
import { groupBySlot, summarizeDay, sumMacros } from './nutrition'
import type { MealEntry, NutritionTargets } from './types'

function entry(over: Partial<MealEntry>): MealEntry {
  return {
    id: Math.random().toString(36),
    athlete_id: 'a',
    eaten_on: '2026-11-10',
    meal: 'meal_1',
    position: 0,
    food_id: null,
    name: 'Food',
    amount_label: null,
    grams: null,
    kcal: 100,
    protein_g: 10,
    fat_g: null,
    carbs_g: null,
    fiber_g: null,
    status: 'planned',
    notes: null,
    ...over,
  }
}

const targets: NutritionTargets = {
  athlete_id: 'a',
  kcal: 2050,
  protein_g: 180,
  fat_g: null,
  carbs_g: null,
  fiber_g: null,
  flex_kcal: 200,
  window_start: null,
  window_end: null,
  notes: null,
}

describe('nutrition', () => {
  it('sums macros, treating missing values as zero', () => {
    const m = sumMacros([entry({ kcal: 230, protein_g: 42, fat_g: 3 }), entry({ kcal: 95, protein_g: 0 })])
    expect(m).toEqual({ kcal: 325, protein_g: 42, fat_g: 3, carbs_g: 0, fiber_g: 0 })
  })

  it('counts planned and eaten separately and ignores skipped', () => {
    const s = summarizeDay(
      [entry({ kcal: 600, status: 'eaten' }), entry({ kcal: 800 }), entry({ kcal: 500, status: 'skipped' })],
      targets,
    )
    expect(s.planned.kcal).toBe(1400)
    expect(s.eaten.kcal).toBe(600)
    expect(s.flexLeft).toBe(650)
    expect(s.overBy).toBe(0)
  })

  it('reports how far over target the day runs', () => {
    const s = summarizeDay([entry({ kcal: 2200 })], targets)
    expect(s.flexLeft).toBe(0)
    expect(s.overBy).toBe(150)
  })

  it('has no flex figure without targets', () => {
    expect(summarizeDay([entry({})], null).flexLeft).toBeNull()
  })

  it('groups entries in meal order and drops empty slots', () => {
    const g = groupBySlot([entry({ meal: 'flex' }), entry({ meal: 'meal_2' })])
    expect(g.map((x) => x.slot)).toEqual(['meal_2', 'flex'])
  })
})

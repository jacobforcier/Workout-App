import type { MealEntry, MealSlot, NutritionTargets } from './types'

export interface Macros {
  kcal: number
  protein_g: number
  fat_g: number
  carbs_g: number
  fiber_g: number
}

export const MEAL_SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: 'meal_1', label: 'Meal 1' },
  { slot: 'meal_2', label: 'Meal 2' },
  { slot: 'meal_3', label: 'Meal 3' },
  { slot: 'flex', label: 'Flex' },
  { slot: 'other', label: 'Other' },
]

const ZERO: Macros = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 }

export function sumMacros(entries: MealEntry[]): Macros {
  return entries.reduce<Macros>(
    (acc, e) => ({
      kcal: acc.kcal + Number(e.kcal),
      protein_g: acc.protein_g + Number(e.protein_g),
      fat_g: acc.fat_g + Number(e.fat_g ?? 0),
      carbs_g: acc.carbs_g + Number(e.carbs_g ?? 0),
      fiber_g: acc.fiber_g + Number(e.fiber_g ?? 0),
    }),
    { ...ZERO },
  )
}

export interface DaySummary {
  /** Everything not skipped: what the day adds up to if the plan holds. */
  planned: Macros
  /** Only entries marked eaten. */
  eaten: Macros
  /** Calories still open in the day's flex budget (target minus planned meals). Never negative. */
  flexLeft: number | null
  /** Calories over target once everything planned is counted. 0 when under. */
  overBy: number
}

export function summarizeDay(entries: MealEntry[], targets: NutritionTargets | null): DaySummary {
  const live = entries.filter((e) => e.status !== 'skipped')
  const planned = sumMacros(live)
  const eaten = sumMacros(live.filter((e) => e.status === 'eaten'))
  if (!targets) return { planned, eaten, flexLeft: null, overBy: 0 }
  const gap = targets.kcal - planned.kcal
  return { planned, eaten, flexLeft: Math.max(0, Math.round(gap)), overBy: Math.max(0, Math.round(-gap)) }
}

export function groupBySlot(entries: MealEntry[]): { slot: MealSlot; label: string; entries: MealEntry[] }[] {
  return MEAL_SLOTS.map((s) => ({ ...s, entries: entries.filter((e) => e.meal === s.slot) })).filter((g) => g.entries.length > 0)
}

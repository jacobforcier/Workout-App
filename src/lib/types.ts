export type AthleteKind = 'adult' | 'kid'
export type Side = 'left' | 'right' | 'both'

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface HouseholdMember {
  user_id: string
  household_id: string
  role: 'owner' | 'adult'
  created_at: string
}

export interface HouseholdInvite {
  id: string
  household_id: string
  email: string
  created_at: string
  accepted_at: string | null
}

export interface Athlete {
  id: string
  household_id: string
  name: string
  kind: AthleteKind
  current_bell_lb: number
  available_bells_lb: number[]
  has_pullup_bar: boolean
  has_dip_bars: boolean
  /** Monday-first weekly plan (workout id or null = rest). null = default rotation. */
  custom_rotation: (string | null)[] | null
  created_at: string
}

export type AthleteInput = Omit<Athlete, 'id' | 'household_id' | 'created_at'>

export interface SessionRow {
  id: string
  household_id: string
  athlete_id: string
  workout_id: string
  performed_on: string
  started_at: string | null
  duration_sec: number | null
  bell_lb: number | null
  rpe: number | null
  feel: number | null
  trained_fasted: boolean | null
  notes: string | null
  completed: boolean
}

export interface SetLog {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  reps: number | null
  weight_lb: number | null
  seconds: number | null
  side: Side
  rest_sec: number | null
}

export type SetLogInput = Omit<SetLog, 'id' | 'session_id'>

export interface SessionWithLogs extends SessionRow {
  set_logs: SetLog[]
}

export interface Benchmark {
  id: string
  athlete_id: string
  test_id: string
  tested_on: string
  value: number
  notes: string | null
}

export interface BodyMetric {
  id: string
  athlete_id: string
  measured_on: string
  bodyweight_lb: number | null
  waist_in: number | null
}

export interface NutritionTargets {
  athlete_id: string
  kcal: number
  protein_g: number
  fat_g: number | null
  carbs_g: number | null
  fiber_g: number | null
  flex_kcal: number
  window_start: string | null
  window_end: string | null
  notes: string | null
}

export type MealSlot = 'meal_1' | 'meal_2' | 'meal_3' | 'flex' | 'other'
export type MealStatus = 'planned' | 'eaten' | 'skipped'

export interface MealEntry {
  id: string
  athlete_id: string
  eaten_on: string
  meal: MealSlot
  position: number
  food_id: string | null
  name: string
  amount_label: string | null
  grams: number | null
  kcal: number
  protein_g: number
  fat_g: number | null
  carbs_g: number | null
  fiber_g: number | null
  status: MealStatus
  notes: string | null
}

export type RecipeCategory = 'breakfast' | 'lunch' | 'meal_3' | 'dinner' | 'snack' | 'dessert' | 'other'

export interface RecipeIngredient {
  item: string
  amount?: string
  note?: string
}

export interface Recipe {
  id: string
  household_id: string
  name: string
  summary: string | null
  source_name: string | null
  source_url: string | null
  category: RecipeCategory
  servings: number
  serving_label: string | null
  prep_minutes: number | null
  ingredients: RecipeIngredient[]
  steps: string[]
  notes: string | null
  kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  fiber_g: number | null
  tags: string[]
}

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

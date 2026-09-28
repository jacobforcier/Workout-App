export type Equipment = 'kettlebell' | 'pullup_bar' | 'dip_bars' | 'bench'

export interface Exercise {
  id: string
  name: string
  category: string
  equipment: Equipment[]
  kidSafe: boolean
  steps: string[]
  formCues: string[]
  commonMistakes: string[]
  videoUrl: string | null
  /** Title of the linked video, shown next to the link. */
  videoTitle: string | null
  substitutions: string[]
}

export interface RestGuidance {
  /** Default rest in seconds. */
  seconds: number
  /** Shortest rest the progression logic will suggest. Absent = rest is not a progression lever. */
  minSeconds?: number
  guidance: string
}

export interface WorkoutItem {
  exerciseId: string
  /** Target sets (for `sets` blocks). Circuits use the block's rounds instead. */
  sets?: number
  /** Most sets the progression logic will suggest. Defaults to `sets`. */
  maxSets?: number
  reps?: number
  seconds?: number
  /** What `reps` counts. Defaults to reps. */
  unit?: 'reps' | 'steps'
  /** Do the target on each side (left, then right). */
  perSide: boolean
  /** Alternate sides set to set (set 1 left, set 2 right, …). */
  alternateSides?: boolean
  /** Display names for the two sides, e.g. ["Clockwise", "Counter-clockwise"]. */
  sideNames?: [string, string]
  rest?: RestGuidance
  note?: string
}

export type BlockFormat = 'sets' | 'circuit' | 'emom' | 'timed'

export interface WorkoutBlock {
  title: string
  format: BlockFormat
  /** Circuit rounds. */
  rounds?: number
  /** Most rounds the progression logic will suggest. Defaults to `rounds`. */
  maxRounds?: number
  restBetweenRounds?: RestGuidance
  /** EMOM duration. */
  minutes?: number
  items: WorkoutItem[]
}

export interface Workout {
  id: string
  name: string
  summary: string
  level: 'beginner' | 'intermediate'
  estimatedMinutes: number
  recommendedFrequency: string
  kidSafe: boolean
  /** Lots of swings/hinging: the scheduler avoids putting two of these on consecutive days. */
  hingeHeavy?: boolean
  notes: string[]
  warmup: WorkoutBlock[]
  main: WorkoutBlock[]
}

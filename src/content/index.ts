import exercisesJson from './exercises.json'
import workoutsJson from './workouts.json'
import type { Exercise, Workout } from './types'

export * from './types'

export const exercises = exercisesJson as Exercise[]
export const workouts = workoutsJson as Workout[]

const exerciseById = new Map(exercises.map((e) => [e.id, e]))
const workoutById = new Map(workouts.map((w) => [w.id, w]))

export function getExercise(id: string): Exercise | undefined {
  return exerciseById.get(id)
}

export function getWorkout(id: string): Workout | undefined {
  return workoutById.get(id)
}

export function workoutName(id: string): string {
  return workoutById.get(id)?.name ?? id
}

export function exerciseName(id: string): string {
  return exerciseById.get(id)?.name ?? id
}

/** Exercises that use a kettlebell take a weight; the rest are bodyweight. */
export function isLoaded(exerciseId: string): boolean {
  return exerciseById.get(exerciseId)?.equipment.includes('kettlebell') ?? false
}

export const SWING_EXERCISE_IDS = ['two_hand_swing', 'one_arm_swing']

export interface BenchmarkTest {
  id: string
  name: string
  unit: string
  description: string
  cadence: string
  requires?: 'pullup_bar'
}

export const benchmarkTests: BenchmarkTest[] = [
  {
    id: 'swing_5min',
    name: '5-minute swing test',
    unit: 'swings',
    description: 'Max two-hand swings in 5 minutes with your current bell. Rest whenever you need to; the clock keeps running.',
    cadence: 'Monthly',
  },
  {
    id: 'dead_hang',
    name: 'Dead hang',
    unit: 'seconds',
    description: 'Longest dead hang from a pull-up bar, in seconds.',
    cadence: 'Monthly',
    requires: 'pullup_bar',
  },
]

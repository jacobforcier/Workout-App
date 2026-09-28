import { describe, expect, it } from 'vitest'
import { exercises, getExercise, workouts } from './index'

describe('content', () => {
  it('has unique ids', () => {
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length)
    expect(new Set(workouts.map((w) => w.id)).size).toBe(workouts.length)
  })

  it('references only known exercises', () => {
    for (const e of exercises) {
      for (const sub of e.substitutions) expect(getExercise(sub), `${e.id} → ${sub}`).toBeDefined()
      expect(e.videoUrl).toBeNull()
    }
    for (const w of workouts) {
      for (const block of [...w.warmup, ...w.main]) {
        for (const item of block.items) expect(getExercise(item.exerciseId), `${w.id} → ${item.exerciseId}`).toBeDefined()
      }
    }
  })

  it('kid-safe workouts only use kid-safe exercises', () => {
    for (const w of workouts.filter((w) => w.kidSafe)) {
      for (const block of [...w.warmup, ...w.main]) {
        for (const item of block.items) expect(getExercise(item.exerciseId)?.kidSafe, `${w.id} → ${item.exerciseId}`).toBe(true)
      }
    }
  })

  it('every item has a target', () => {
    for (const w of workouts) {
      for (const block of [...w.warmup, ...w.main]) {
        for (const item of block.items) expect(item.reps ?? item.seconds, `${w.id} → ${item.exerciseId}`).toBeDefined()
        if (block.format === 'circuit') expect(block.rounds).toBeGreaterThan(0)
        if (block.format === 'emom') expect(block.minutes).toBeGreaterThan(0)
      }
    }
  })
})

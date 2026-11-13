import { describe, expect, it } from 'vitest'
import { bellForExercise } from './plan'

const last = (bell: number, logs: [string, number | null][]) => ({
  bell_lb: bell,
  set_logs: logs.map(([exercise_id, weight_lb]) => ({ exercise_id, weight_lb })),
})

describe('bellForExercise', () => {
  it('uses the session bell with no other information', () => {
    expect(bellForExercise('goblet_squat', 35, {}, null)).toBe(35)
  })
  it('a bell picked earlier this session sticks for that exercise only', () => {
    expect(bellForExercise('goblet_squat', 35, { goblet_squat: 53 }, null)).toBe(53)
    expect(bellForExercise('single_arm_press', 35, { goblet_squat: 53 }, null)).toBe(35)
  })
  it("remembers last session's deliberate per-exercise bell", () => {
    const prev = last(35, [['goblet_squat', 53], ['single_arm_press', 35]])
    expect(bellForExercise('goblet_squat', 35, {}, prev)).toBe(53)
    expect(bellForExercise('single_arm_press', 35, {}, prev)).toBe(35)
  })
  it('follows a new session bell when last time just used the session bell', () => {
    // Moving up from 18 to 26: every exercise that was at 18 follows the new session bell.
    expect(bellForExercise('goblet_squat', 26, {}, last(18, [['goblet_squat', 18]]))).toBe(26)
  })
  it('a pick this session beats last time', () => {
    expect(bellForExercise('goblet_squat', 35, { goblet_squat: 35 }, last(35, [['goblet_squat', 53]]))).toBe(35)
  })
})

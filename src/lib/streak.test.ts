import { describe, expect, it } from 'vitest'
import { currentStreak, longestStreak } from './streak'

const TODAY = '2026-09-30' // Wednesday

describe('currentStreak', () => {
  it('is zero with no sessions', () => {
    expect(currentStreak([], TODAY)).toBe(0)
  })
  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-09-28', '2026-09-29', '2026-09-30'], TODAY)).toBe(3)
  })
  it('does not break just because today is not done yet', () => {
    expect(currentStreak(['2026-09-28', '2026-09-29'], TODAY)).toBe(2)
  })
  it('breaks on a missed day', () => {
    expect(currentStreak(['2026-09-26', '2026-09-27', '2026-09-29'], TODAY)).toBe(1)
  })
  it('skips planned rest days without breaking', () => {
    const sundayRest = (d: string) => d === '2026-09-27'
    expect(currentStreak(['2026-09-26', '2026-09-28', '2026-09-29'], TODAY, sundayRest)).toBe(3)
  })
  it('counts sessions done on planned rest days', () => {
    const sundayRest = (d: string) => d === '2026-09-27'
    expect(currentStreak(['2026-09-27', '2026-09-28'], TODAY, sundayRest)).toBe(0)
    expect(currentStreak(['2026-09-27', '2026-09-28', '2026-09-29'], TODAY, sundayRest)).toBe(3)
  })
  it('ignores duplicate dates', () => {
    expect(currentStreak(['2026-09-30', '2026-09-30'], TODAY)).toBe(1)
  })
})

describe('longestStreak', () => {
  it('finds the best run', () => {
    expect(longestStreak(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-11'])).toBe(3)
  })
  it('bridges planned rest days', () => {
    expect(longestStreak(['2026-09-01', '2026-09-03'], (d) => d === '2026-09-02')).toBe(2)
  })
  it('is zero with no sessions', () => {
    expect(longestStreak([])).toBe(0)
  })
})

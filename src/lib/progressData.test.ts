import { describe, expect, it } from 'vitest'
import { bellHistory, heatmap, sessionsPerWeek, swingsPerWeek } from './progressData'

const TODAY = '2026-09-30' // Wednesday; week starts Mon 2026-09-28

describe('progress aggregation', () => {
  it('buckets sessions by Monday-start week', () => {
    const data = sessionsPerWeek(
      [
        { performed_on: '2026-09-28', bell_lb: 26 },
        { performed_on: '2026-09-27', bell_lb: 26 },
        { performed_on: '2026-09-21', bell_lb: 26 },
        { performed_on: '2026-01-01', bell_lb: 26 },
      ],
      3,
      TODAY,
    )
    expect(data.map((d) => [d.weekStart, d.value])).toEqual([
      ['2026-09-14', 0],
      ['2026-09-21', 2],
      ['2026-09-28', 1],
    ])
  })

  it('sums swing reps only', () => {
    const data = swingsPerWeek(
      [
        {
          performed_on: '2026-09-29',
          bell_lb: 26,
          set_logs: [
            { exercise_id: 'two_hand_swing', reps: 10 },
            { exercise_id: 'one_arm_swing', reps: 10 },
            { exercise_id: 'goblet_squat', reps: 8 },
          ],
        },
      ],
      1,
      TODAY,
    )
    expect(data[0].value).toBe(20)
  })

  it('records bell changes', () => {
    expect(
      bellHistory([
        { performed_on: '2026-09-03', bell_lb: 35 },
        { performed_on: '2026-09-01', bell_lb: 26 },
        { performed_on: '2026-09-02', bell_lb: 26 },
        { performed_on: '2026-09-05', bell_lb: 35 },
      ]),
    ).toEqual([
      { date: '2026-09-01', bell: 26 },
      { date: '2026-09-03', bell: 35 },
      { date: '2026-09-05', bell: 35 },
    ])
  })

  it('builds a heatmap grid', () => {
    const grid = heatmap(['2026-09-28', '2026-09-28'], 2, TODAY)
    expect(grid).toHaveLength(2)
    expect(grid[1][0]).toEqual({ date: '2026-09-28', count: 2, future: false })
    expect(grid[1][6].future).toBe(true)
  })
})

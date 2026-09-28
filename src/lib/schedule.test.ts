import { describe, expect, it } from 'vitest'
import { missedYesterday, suggestToday, weeklyStreak, weekStatus, type DoneSession } from './schedule'
import type { RotationProfile } from './rotation'

// 2026-09-28 is a Monday.
const ONNIT: RotationProfile = { kind: 'adult', has_pullup_bar: true, has_dip_bars: true }
const KB_ONLY: RotationProfile = { kind: 'adult' }
// A first session 8 weeks back puts 2026-09-28 in the full phase.
const FIRST = '2026-08-03'
const s = (performed_on: string, workout_id: string): DoneSession => ({ performed_on, workout_id })

describe('weekStatus', () => {
  it('lists the plan in order and counts only harder sessions toward the goal', () => {
    const st = weekStatus('2026-09-30', ONNIT, [s('2026-09-28', 'joe_rogan'), s('2026-09-29', 'recovery')], FIRST)
    expect(st.phase).toBe('full')
    expect(st.entries.map((e) => e.workoutId)).toEqual(['joe_rogan', 'swing_emom', 'recovery', 'joe_rogan', 'simple_sinister', 'family_circuit'])
    expect(st.goal).toBe(5)
    expect(st.done).toBe(1)
    expect(st.recoveryDone).toBe(1)
    expect(st.entries[0].done).toBe(true)
    expect(st.entries[2].done).toBe(true)
  })

  it('lets a swap fill the next open harder slot', () => {
    const st = weekStatus('2026-09-28', ONNIT, [s('2026-09-28', 'foundation')], FIRST)
    expect(st.entries[0]).toMatchObject({ workoutId: 'joe_rogan', done: true })
  })

  it('ignores sessions from other weeks', () => {
    expect(weekStatus('2026-09-28', ONNIT, [s('2026-09-27', 'joe_rogan')], FIRST).done).toBe(0)
  })
})

describe('suggestToday', () => {
  const at = (today: string, sessions: DoneSession[], profile = ONNIT) => suggestToday(today, weekStatus(today, profile, sessions, FIRST), sessions)

  it("suggests today's planned workout when on track", () => {
    expect(at('2026-09-28', [])).toEqual({ kind: 'workout', workoutId: 'joe_rogan', note: null })
    expect(at('2026-09-29', [s('2026-09-28', 'joe_rogan')])).toMatchObject({ kind: 'workout', workoutId: 'swing_emom' })
  })

  it('picks up a missed workout instead of skipping it', () => {
    expect(at('2026-09-29', [])).toMatchObject({ kind: 'catch_up', workoutId: 'joe_rogan' })
  })

  it('drops missed recovery days but carries harder sessions', () => {
    const sessions = [s('2026-09-28', 'joe_rogan'), s('2026-09-29', 'swing_emom')]
    // Wednesday's recovery was skipped; on Thursday the next thing is Thursday's Rogan.
    expect(at('2026-10-01', sessions)).toMatchObject({ kind: 'workout', workoutId: 'joe_rogan' })
  })

  it('reports done today with what is next', () => {
    expect(at('2026-09-28', [s('2026-09-28', 'joe_rogan')])).toMatchObject({ kind: 'done_today', workoutId: 'swing_emom' })
  })

  it('offers a catch-up on a planned rest day only when behind', () => {
    const all = [
      s('2026-09-28', 'joe_rogan'),
      s('2026-09-29', 'swing_emom'),
      s('2026-09-30', 'recovery'),
      s('2026-10-01', 'joe_rogan'),
      s('2026-10-02', 'simple_sinister'),
      s('2026-10-03', 'family_circuit'),
    ]
    expect(at('2026-10-04', all)).toEqual({ kind: 'week_complete', workoutId: null, note: null })
    const behind = all.filter((x) => x.workout_id !== 'simple_sinister')
    expect(at('2026-10-04', behind)).toMatchObject({ kind: 'rest', workoutId: 'simple_sinister' })
  })

  it('never stacks swing-heavy days', () => {
    // Kettlebell-only full week: Rogan podcast, Recovery, Family, Rogan podcast, Recovery, S&S.
    // Did the podcast Monday, skipped Tue–Wed: on Thursday the missed Family circuit comes before Thursday's podcast.
    expect(at('2026-10-01', [s('2026-09-28', 'joe_rogan_podcast')], KB_ONLY)).toMatchObject({ workoutId: 'family_circuit' })
    // Catching up after a swing-heavy day: the easier open entry comes first.
    const sessions = [s('2026-09-28', 'joe_rogan_podcast'), s('2026-09-29', 'family_circuit'), s('2026-09-30', 'joe_rogan_podcast')]
    expect(at('2026-10-01', sessions, KB_ONLY)).toMatchObject({ workoutId: 'recovery' })
  })

  it('falls back to recovery when only swing-heavy work is left', () => {
    const sessions = [
      s('2026-09-28', 'joe_rogan_podcast'),
      s('2026-09-29', 'recovery'),
      s('2026-09-30', 'family_circuit'),
      s('2026-10-01', 'recovery'),
      s('2026-10-02', 'joe_rogan_podcast'),
    ]
    expect(at('2026-10-03', sessions, KB_ONLY)).toMatchObject({ kind: 'workout', workoutId: 'recovery' })
  })
})

describe('missedYesterday', () => {
  it('flags a missed harder day, not a missed recovery or rest day', () => {
    expect(missedYesterday('2026-09-29', ONNIT, [s('2026-09-20', 'joe_rogan')], FIRST)).toBe(true)
    expect(missedYesterday('2026-10-01', ONNIT, [s('2026-09-29', 'swing_emom')], FIRST)).toBe(false) // Wed = recovery
    expect(missedYesterday('2026-09-28', ONNIT, [], FIRST)).toBe(false) // Sun = rest
  })
  it('clears once today is done, and is off before the first session', () => {
    expect(missedYesterday('2026-09-29', ONNIT, [s('2026-09-29', 'swing_emom')], FIRST)).toBe(false)
    expect(missedYesterday('2026-09-29', ONNIT, [], null)).toBe(false)
  })
})

describe('weeklyStreak', () => {
  const fullWeek = (monday: string) =>
    ['joe_rogan', 'swing_emom', 'recovery', 'joe_rogan', 'simple_sinister', 'family_circuit'].map((id, i) => {
      const d = new Date(monday + 'T00:00')
      d.setDate(d.getDate() + i)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return s(iso, id)
    })

  it('counts consecutive weeks that hit the goal; the current week does not break it', () => {
    const sessions = [...fullWeek('2026-09-14'), ...fullWeek('2026-09-21')]
    expect(weeklyStreak('2026-09-29', ONNIT, sessions, FIRST)).toBe(2)
    expect(weeklyStreak('2026-09-29', ONNIT, [...sessions, ...fullWeek('2026-09-28')], FIRST)).toBe(3)
  })
  it('breaks on a missed week', () => {
    expect(weeklyStreak('2026-09-29', ONNIT, fullWeek('2026-09-14'), FIRST)).toBe(0)
  })
  it('is zero before any session', () => {
    expect(weeklyStreak('2026-09-29', ONNIT, [], null)).toBe(0)
  })
})

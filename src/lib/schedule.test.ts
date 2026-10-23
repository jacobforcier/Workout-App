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
    // Tuesday's recovery walk doesn't tick Tuesday's harder slot or Wednesday's future recovery day.
    expect(st.entries[1].done).toBe(false)
    expect(st.entries[2].done).toBe(false)
  })

  it('lets a swap fill the next open harder slot', () => {
    const st = weekStatus('2026-09-28', ONNIT, [s('2026-09-28', 'foundation')], FIRST)
    expect(st.entries[0]).toMatchObject({ workoutId: 'joe_rogan', done: true })
  })

  it('never lets a session tick off a future day', () => {
    // KB-only full plan: Mon Rogan · Tue Rec · Wed Family · Thu Rogan · Fri Rec · Sat S&S.
    // Foundation on Tuesday (a recovery day) ticks Tuesday, not Wednesday or Thursday.
    const st = weekStatus('2026-09-30', KB_ONLY, [s('2026-09-28', 'joe_rogan_podcast'), s('2026-09-29', 'foundation')], FIRST)
    expect(st.entries.filter((e) => e.done).map((e) => e.day)).toEqual([0, 1])
    expect(st.done).toBe(2)
  })

  it("a recovery session doesn't tick off a harder day", () => {
    const st = weekStatus('2026-09-28', ONNIT, [s('2026-09-28', 'recovery')], FIRST)
    expect(st.entries.some((e) => e.done)).toBe(false)
  })

  it('ticks off the day you trained, even when you did a different workout', () => {
    // ONNIT full plan: Wednesday is recovery. A hard session on Wednesday still ticks Wednesday.
    const st = weekStatus('2026-09-30', ONNIT, [s('2026-09-30', 'foundation')], FIRST)
    expect(st.entries.filter((e) => e.done).map((e) => [e.day, e.doneWorkoutId])).toEqual([[2, 'foundation']])
  })

  it('a session on a rest day catches up an earlier missed day', () => {
    // KB-only full plan: Sunday is rest. Sunday's Rogan catches up Thursday's missed Rogan.
    const st = weekStatus('2026-10-04', KB_ONLY, [s('2026-10-04', 'joe_rogan_podcast')], FIRST)
    expect(st.entries.filter((e) => e.done).map((e) => e.day)).toEqual([0])
  })

  it("doesn't ask you to catch up a workout you already did on another day", () => {
    // ONNIT: Monday missed, Monday's Rogan done on Tuesday instead. Wednesday shouldn't suggest Rogan again.
    const sessions = [s('2026-09-29', 'joe_rogan')]
    const sug = suggestToday('2026-09-30', weekStatus('2026-09-30', ONNIT, sessions, FIRST), sessions)
    expect(sug.workoutId).toBe('recovery')
  })

  it("matches a session to its own day's slot before an earlier one", () => {
    // ONNIT full plan has Rogan on Mon and Thu; Rogan done Thursday after missing Monday.
    const st = weekStatus('2026-10-01', ONNIT, [s('2026-10-01', 'joe_rogan')], FIRST)
    expect(st.entries.find((e) => e.done)?.day).toBe(3)
  })

  it('does not let an earlier swap steal a slot a later session matches exactly', () => {
    // Foundation Monday, then Rogan Thursday: Rogan takes Thursday, foundation takes Monday.
    const st = weekStatus('2026-10-01', ONNIT, [s('2026-09-28', 'foundation'), s('2026-10-01', 'joe_rogan')], FIRST)
    expect(st.entries.filter((e) => e.done).map((e) => e.day)).toEqual([0, 3])
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

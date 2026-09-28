import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Badges from '../components/Badges'
import Suggestions from '../components/Suggestions'
import { Button, Card, ErrorBox, inputClass, PageTitle, Pill, Spinner } from '../components/ui'
import { getWorkout, workoutName, workouts } from '../content'
import { listSessions, recentWorkoutSessions } from '../lib/api'
import { formatDate, today } from '../lib/dates'
import { suggestProgressions } from '../lib/progression'
import { BRIDGE_END_WEEK, INTRO_WEEKS, mondayIndex, PLAN_DAYS } from '../lib/rotation'
import { missedYesterday, RECOVERY_ID, suggestToday, weeklyStreak, weekStatus, type TodayKind } from '../lib/schedule'
import { athleteStats } from '../lib/stats'
import { useAsync } from '../hooks/useAsync'
import { useApp } from '../state/AppContext'
export default function Today() {
  const { activeAthlete, athletesLoading, athletesError, reloadAthletes } = useApp()

  if (athletesError) return <ErrorBox error={athletesError} onRetry={() => void reloadAthletes()} />
  if (!activeAthlete) {
    if (athletesLoading) return <Spinner />
    return (
      <>
        <PageTitle sub="Add the people who'll be training to get started.">Welcome!</PageTitle>
        <Link to="/family">
          <Button size="lg" block>
            Add athletes
          </Button>
        </Link>
      </>
    )
  }
  return <TodayFor key={activeAthlete.id} />
}

function TodayFor() {
  const { activeAthlete, kidMode } = useApp()
  const athlete = activeAthlete!
  const navigate = useNavigate()
  const todayDate = today()

  const sessionsQ = useAsync(() => listSessions(athlete.id), [athlete.id])
  const derived = useMemo(() => {
    const sessions = sessionsQ.data
    if (!sessions) return null
    const stats = athleteStats(sessions, athlete, todayDate)
    const status = weekStatus(todayDate, athlete, sessions, stats.firstSessionDate)
    return {
      stats,
      status,
      suggestion: suggestToday(todayDate, status, sessions),
      weeks: weeklyStreak(todayDate, athlete, sessions, stats.firstSessionDate),
      missed: missedYesterday(todayDate, athlete, sessions, stats.firstSessionDate),
    }
  }, [sessionsQ.data, athlete, todayDate])

  const [swapId, setSwapId] = useState<string | null>(null)
  const suggested = derived?.suggestion.workoutId ?? null
  const kind: TodayKind | null = derived?.suggestion.kind ?? null
  // On a rest day or once today's session is done, nothing is offered to start unless picked.
  const workoutId = swapId ?? (kind === 'rest' || kind === 'done_today' || kind === 'week_complete' ? null : suggested)
  const workout = workoutId ? getWorkout(workoutId) : undefined

  const progressionQ = useAsync(
    () => (workoutId ? recentWorkoutSessions(athlete.id, workoutId, 2) : Promise.resolve([])),
    [athlete.id, workoutId],
  )
  const suggestions = useMemo(
    () =>
      workout && progressionQ.data
        ? suggestProgressions({ workout, sessions: progressionQ.data, currentBellLb: athlete.current_bell_lb, availableBellsLb: athlete.available_bells_lb })
        : [],
    [workout, progressionQ.data, athlete.current_bell_lb, athlete.available_bells_lb],
  )

  if (sessionsQ.loading && !sessionsQ.data) return <Spinner />
  if (sessionsQ.error) return <ErrorBox error={sessionsQ.error} onRetry={sessionsQ.reload} title="Couldn't load sessions" />
  if (!derived) return null
  const { stats, status, suggestion, weeks, missed } = derived

  const choices = workouts.filter((w) => !kidMode || w.kidSafe)
  const phaseLabel =
    status.phase === 'custom'
      ? 'your own plan'
      : status.phase === 'intro'
        ? `intro, weeks 1–${INTRO_WEEKS}`
        : status.phase === 'bridge'
          ? `building up, weeks ${INTRO_WEEKS + 1}–${BRIDGE_END_WEEK}`
          : 'full plan'
  const todayIdx = mondayIndex(todayDate)
  const heading = swapId
    ? 'Your pick'
    : kind === 'catch_up'
      ? 'Up next'
      : kind === 'done_today'
        ? 'Done for today'
        : kind === 'rest'
          ? 'Rest day'
          : kind === 'week_complete'
            ? 'Week complete'
            : kidMode
              ? "Today's workout"
              : 'Today'

  return (
    <div className="flex flex-col gap-4">
      <PageTitle sub={formatDate(todayDate, { weekday: 'long', month: 'long', day: 'numeric' })}>
        {kidMode ? `Hi ${athlete.name}! 👋` : `Today · ${athlete.name}`}
      </PageTitle>

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">This week</span>
          {!kidMode && (
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Week {status.week} · {phaseLabel}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-4xl font-black tabular">
            {Math.min(status.done, status.goal)}
            <span className="text-2xl text-slate-500"> / {status.goal}</span>
          </span>
          <span className="flex-1 font-semibold text-slate-700 dark:text-slate-200">
            workouts done
            {status.recoveryDone > 0 && <span className="block text-sm font-normal text-slate-500">+ {status.recoveryDone} recovery</span>}
          </span>
          <span className="text-center">
            <span className="block text-2xl font-black tabular">🔥 {weeks}</span>
            <span className="block text-xs font-semibold text-slate-500">{weeks === 1 ? 'week' : 'weeks'} in a row</span>
          </span>
        </div>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {Array.from({ length: status.goal }, (_, i) => (
            <span key={i} className={`h-2.5 flex-1 rounded-full ${i < status.done ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
          ))}
        </div>
      </Card>

      {missed && !swapId && (
        <div role="note" className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900">
          <p className="font-bold">{kidMode ? 'Welcome back! 👋' : 'Missed yesterday? No problem.'}</p>
          <p className="text-slate-700 dark:text-slate-300">
            {kidMode ? "Let's do one today." : 'Just don’t miss twice. Even a Recovery day today keeps the habit going.'}
          </p>
          {!kidMode && suggested !== RECOVERY_ID && (
            <Button variant="secondary" className="mt-2" onClick={() => setSwapId(RECOVERY_ID)}>
              Do a Recovery day
            </Button>
          )}
        </div>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">{heading}</span>
          {kind === 'done_today' && <Pill tone="green">✓ Done today</Pill>}
        </div>

        {workout ? (
          <>
            <div>
              <h2 className="text-2xl font-extrabold kid:text-3xl">{workout.name}</h2>
              {!swapId && suggestion.note && <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{suggestion.note}</p>}
              <p className="mt-1 text-slate-700 dark:text-slate-300">{workout.summary}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Pill>⏱ ~{workout.estimatedMinutes} min</Pill>
                <Pill>{workout.level}</Pill>
                {!kidMode && <Pill tone="blue">🔔 {athlete.current_bell_lb} lb</Pill>}
              </div>
            </div>
            <Button size="xl" block onClick={() => navigate(`/session/${workout.id}`)}>
              {kidMode ? "▶ Let's go!" : '▶ Start'}
            </Button>
            <Link to={`/library/workout/${workout.id}`} className="text-center font-semibold text-brand-700 underline dark:text-brand-500">
              {kidMode ? 'See the moves' : 'Read the instructions'}
            </Link>
          </>
        ) : kind === 'done_today' ? (
          <div>
            <h2 className="text-2xl font-extrabold">{kidMode ? 'Great work today! ⭐' : 'Nice work.'}</h2>
            <p className="mt-1 text-slate-700 dark:text-slate-300">{suggested ? `Next up: ${workoutName(suggested)}.` : 'That was the last one this week.'}</p>
          </div>
        ) : kind === 'week_complete' ? (
          <div>
            <h2 className="text-2xl font-extrabold">{kidMode ? 'You did every workout! 🎉' : 'Every session this week is done.'}</h2>
            <p className="mt-1 text-slate-700 dark:text-slate-300">Rest, go for a walk, or pick something below for a bonus.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-extrabold">Rest or walk</h2>
            <p className="mt-1 text-slate-700 dark:text-slate-300">A planned rest day. An easy walk is a great idea.</p>
            {suggested && (
              <>
                <p className="mt-2 font-semibold">{suggestion.note}</p>
                <Button size="lg" variant="secondary" block className="mt-2" onClick={() => setSwapId(suggested)}>
                  Catch up: {workoutName(suggested)}
                </Button>
              </>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{kidMode ? 'Pick a different one' : 'Swap workout'}</span>
          <select className={inputClass} value={workoutId ?? ''} onChange={(e) => setSwapId(e.target.value || null)}>
            {!workoutId && <option value="">Choose a workout…</option>}
            {choices.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.id === suggested ? ' (up next)' : ''}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {progressionQ.error ? (
        <ErrorBox error={progressionQ.error} onRetry={progressionQ.reload} title="Couldn't check progression" />
      ) : (
        <Suggestions suggestions={suggestions} kidMode={kidMode} />
      )}

      {kidMode && <Badges sessionCount={stats.sessionDates.length} bestStreak={stats.bestStreak} />}

      <Card>
        <h2 className="text-lg font-extrabold">This week's plan</h2>
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">Missed a day? Just carry on from the next one that isn't ticked.</p>
        <ol className="divide-y divide-slate-200 dark:divide-slate-800">
          {status.plan.map((id, day) => {
            const entry = status.entries.find((e) => e.day === day)
            return (
              <li key={day} className={`flex items-center justify-between gap-2 py-2 ${day === todayIdx ? 'font-bold' : ''}`}>
                <span className="w-12 text-slate-500 dark:text-slate-400">{PLAN_DAYS[day].slice(0, 3)}</span>
                <span className={`flex-1 ${id ? '' : 'text-slate-500'}`}>{id ? workoutName(id) : 'Rest'}</span>
                {entry?.done && <span aria-label="done">✅</span>}
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}

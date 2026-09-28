import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Badges from '../components/Badges'
import Suggestions from '../components/Suggestions'
import { Button, Card, ErrorBox, inputClass, PageTitle, Pill, Spinner } from '../components/ui'
import { getWorkout, workoutName, workouts } from '../content'
import { listSessions, recentWorkoutSessions } from '../lib/api'
import { dayOfWeek, formatDate, startOfWeek, today, WEEKDAY_NAMES } from '../lib/dates'
import { suggestProgressions } from '../lib/progression'
import { INTRO_WEEKS, rotationFor, rotationWeek } from '../lib/rotation'
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
  const stats = useMemo(() => (sessionsQ.data ? athleteStats(sessionsQ.data, athlete.kind, todayDate) : null), [sessionsQ.data, athlete.kind, todayDate])
  const rotation = stats ? rotationFor(todayDate, athlete.kind, stats.firstSessionDate) : null

  const [swapId, setSwapId] = useState<string | null>(null)
  const workoutId = swapId ?? rotation?.workoutId ?? null
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
  if (!stats || !rotation) return null

  const doneToday = stats.sessionDates.includes(todayDate)
  const choices = workouts.filter((w) => !kidMode || w.kidSafe)
  const week = rotationWeek(startOfWeek(todayDate), athlete.kind, stats.firstSessionDate)

  return (
    <div className="flex flex-col gap-4">
      <PageTitle sub={formatDate(todayDate, { weekday: 'long', month: 'long', day: 'numeric' })}>
        {kidMode ? `Hi ${athlete.name}! 👋` : `Today · ${athlete.name}`}
      </PageTitle>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <div className="text-4xl font-black tabular">🔥 {stats.streak}</div>
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{kidMode ? 'days in a row' : 'day streak'}</div>
        </Card>
        <Card className="text-center">
          <div className="text-4xl font-black tabular">{rotation.week}</div>
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {kidMode ? 'week' : `training week${rotation.intro ? ` (intro, of ${INTRO_WEEKS})` : ''}`}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {swapId ? 'Your pick' : kidMode ? "Today's workout" : 'Suggested today'}
          </span>
          {doneToday && <Pill tone="green">✓ Done today</Pill>}
        </div>

        {workout ? (
          <>
            <div>
              <h2 className="text-2xl font-extrabold kid:text-3xl">{workout.name}</h2>
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
        ) : (
          <div>
            <h2 className="text-2xl font-extrabold">Rest or walk</h2>
            <p className="mt-1 text-slate-700 dark:text-slate-300">A planned rest day. An easy walk is a great idea. Rest days don't break your streak.</p>
            <Button size="lg" variant="secondary" block className="mt-3" onClick={() => setSwapId('recovery')}>
              Do a Recovery day instead
            </Button>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{kidMode ? 'Pick a different one' : 'Swap workout'}</span>
          <select className={inputClass} value={workoutId ?? ''} onChange={(e) => setSwapId(e.target.value || null)}>
            {!rotation.workoutId && <option value="">Rest or walk</option>}
            {choices.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.id === rotation.workoutId ? ' (suggested)' : ''}
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
        <h2 className="mb-2 text-lg font-extrabold">This week</h2>
        <ol className="divide-y divide-slate-200 dark:divide-slate-800">
          {week.map((d) => {
            const done = stats.sessionDates.includes(d.date)
            return (
              <li key={d.date} className={`flex items-center justify-between py-2 ${d.date === todayDate ? 'font-bold' : ''}`}>
                <span className="w-12 text-slate-500 dark:text-slate-400">{WEEKDAY_NAMES[dayOfWeek(d.date)].slice(0, 3)}</span>
                <span className="flex-1">{d.workoutId ? workoutName(d.workoutId) : 'Rest or walk'}</span>
                {done && <span aria-label="done">✅</span>}
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}

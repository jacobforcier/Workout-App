import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Badges from '../components/Badges'
import Suggestions from '../components/Suggestions'
import { Button, Card, ErrorBox, PageTitle, Pill, Spinner, Stepper, SuperviseBanner } from '../components/ui'
import { exerciseName, getWorkout, isLoaded, type Workout } from '../content'
import { useAsync } from '../hooks/useAsync'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import { listSessions, recentWorkoutSessions, saveSession, updateAthlete } from '../lib/api'
import { unlockAudio } from '../lib/beep'
import { formatDuration, today } from '../lib/dates'
import {
  buildPlan,
  defaultExerciseFor,
  emptyOverrides,
  exerciseOptions,
  type EmomStep,
  type PlanOverrides,
  type PlanStep,
  type WorkStep,
} from '../lib/plan'
import { progressionUnits, restUsed, suggestProgressions, type Suggestion } from '../lib/progression'
import { athleteStats } from '../lib/stats'
import type { Athlete, SetLogInput } from '../lib/types'
import { useApp } from '../state/AppContext'
import EmomPanel from './player/EmomPanel'
import ExerciseCard from './player/ExerciseCard'
import FinishPanel, { type FinishMeta } from './player/FinishPanel'
import HoldTimer from './player/HoldTimer'
import RestOverlay, { type RestState } from './player/RestOverlay'

type Phase = 'ready' | 'running' | 'finish' | 'saved'

interface StepLog {
  reps: number | null
  weight: number | null
  seconds: number | null
  rest: number | null
  done: boolean
}

export default function SessionPlayer() {
  const { workoutId } = useParams()
  const { activeAthlete, kidMode } = useApp()
  const workout = workoutId ? getWorkout(workoutId) : undefined

  if (!workout || !activeAthlete) {
    return <NotAvailable message="That workout doesn't exist." />
  }
  if (kidMode && !workout.kidSafe) {
    return <NotAvailable message={`${workout.name} isn't a kids' workout. Pick one from Today.`} />
  }
  return <Player workout={workout} athlete={activeAthlete} kidMode={kidMode} />
}

function NotAvailable({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-xl p-4">
      <ErrorBox error={message} title="Can't start this workout" />
      <Link to="/" className="mt-4 block">
        <Button block>Back to Today</Button>
      </Link>
    </main>
  )
}

function Player({ workout, athlete, kidMode }: { workout: Workout; athlete: Athlete; kidMode: boolean }) {
  const navigate = useNavigate()
  const { membership, reloadAthletes } = useApp()

  const history = useAsync(() => recentWorkoutSessions(athlete.id, workout.id, 2), [athlete.id, workout.id])
  const suggestions = useMemo(
    () =>
      history.data
        ? suggestProgressions({ workout, sessions: history.data, currentBellLb: athlete.current_bell_lb, availableBellsLb: athlete.available_bells_lb })
        : [],
    [history.data, workout, athlete.current_bell_lb, athlete.available_bells_lb],
  )

  const [phase, setPhase] = useState<Phase>('ready')
  const [overrides, setOverrides] = useState<PlanOverrides>(emptyOverrides)
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [sessionBell, setSessionBell] = useState(athlete.current_bell_lb)
  const [subs, setSubs] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<Record<string, StepLog>>({})
  const [emomReps, setEmomReps] = useState<Record<string, number[]>>({})
  const [emomReached, setEmomReached] = useState<Record<string, number>>({})
  const [index, setIndex] = useState(0)
  const [rest, setRest] = useState<(RestState & { stepId: string; unitKey: string | null }) | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<Error | null>(null)

  useWakeLock(phase === 'running')
  const now = useNow(phase === 'running', 1000)

  // Default rest to what the athlete used last time, so a "shorten rest" change sticks.
  const restSeeded = useRef(false)
  useEffect(() => {
    const latest = history.data?.[0]
    if (!latest || restSeeded.current) return
    restSeeded.current = true
    const rests: Record<string, number> = {}
    for (const unit of progressionUnits(workout)) {
      const used = restUsed(unit, latest.set_logs)
      if (used !== null) rests[unit.key] = used
    }
    setOverrides((o) => ({ ...o, rest: { ...rests, ...o.rest } }))
  }, [history.data, workout])

  const steps = useMemo(() => buildPlan(workout, overrides), [workout, overrides])
  const safeIndex = Math.min(index, steps.length - 1)
  const step = steps[safeIndex]

  const exerciseFor = useCallback(
    (s: PlanStep) => subs[s.itemKey] ?? defaultExerciseFor(s.item.exerciseId, athlete, kidMode),
    [subs, athlete, kidMode],
  )

  const logFor = useCallback(
    (s: PlanStep): StepLog => {
      const existing = logs[s.id]
      if (existing) return existing
      return {
        reps: s.item.reps ?? null,
        weight: isLoaded(exerciseFor(s)) ? sessionBell : null,
        seconds: s.item.seconds ?? null,
        rest: null,
        done: false,
      }
    },
    [logs, exerciseFor, sessionBell],
  )

  const repsForEmom = (s: EmomStep) => emomReps[s.id] ?? Array.from({ length: s.minutes }, () => s.item.reps ?? 0)

  const updateLog = (s: PlanStep, patch: Partial<StepLog>) => setLogs((l) => ({ ...l, [s.id]: { ...logFor(s), ...patch } }))

  const advance = () => {
    if (safeIndex < steps.length - 1) {
      setIndex(safeIndex + 1)
      window.scrollTo({ top: 0 })
    } else {
      finish()
    }
  }

  const finish = () => {
    setEndedAt(Date.now())
    setPhase('finish')
    window.scrollTo({ top: 0 })
  }

  const markDone = () => {
    const restAfter = step.kind === 'work' ? step.restAfter : null
    updateLog(step, { done: true, rest: restAfter })
    if (restAfter && restAfter > 0) {
      setRest({ startedAt: Date.now(), totalSec: restAfter, stepId: step.id, unitKey: step.unitKey })
    } else {
      advance()
    }
  }

  const endRest = () => {
    if (rest) setLogs((l) => ({ ...l, [rest.stepId]: { ...l[rest.stepId], rest: rest.totalSec } }))
    setRest(null)
    advance()
  }

  const adjustRest = (delta: number) => {
    if (!rest) return
    const totalSec = Math.max(0, rest.totalSec + delta)
    setRest({ ...rest, totalSec })
    if (rest.unitKey) {
      const key = rest.unitKey
      setOverrides((o) => ({ ...o, rest: { ...o.rest, [key]: totalSec } }))
    }
  }

  const addSet = (s: WorkStep) => {
    if (!s.unitKey) return
    const key = s.unitKey
    setOverrides((o) => ({ ...o, sets: { ...o.sets, [key]: s.totalSets + 1 } }))
  }

  const applySuggestion = (sg: Suggestion) => {
    if (sg.kind === 'add_set' && sg.to) setOverrides((o) => ({ ...o, sets: { ...o.sets, [sg.unitKey]: sg.to! } }))
    if (sg.kind === 'shorten_rest' && sg.to) setOverrides((o) => ({ ...o, rest: { ...o.rest, [sg.unitKey]: sg.to! } }))
    if (sg.kind === 'next_bell' && sg.to) setSessionBell(sg.to)
    setApplied((a) => new Set(a).add(sg.unitKey + sg.kind))
  }

  /** Everything the athlete marked done, as set_logs rows. */
  const setLogs_ = useMemo((): SetLogInput[] => {
    const out: SetLogInput[] = []
    for (const s of steps) {
      const exerciseId = exerciseFor(s)
      if (s.kind === 'emom') {
        const reached = logs[s.id]?.done ? emomReached[s.id] ?? 0 : 0
        repsForEmom(s)
          .slice(0, reached)
          .forEach((reps, i) =>
            out.push({ exercise_id: exerciseId, set_number: i + 1, reps, weight_lb: isLoaded(exerciseId) ? sessionBell : null, seconds: null, side: 'both', rest_sec: null }),
          )
        continue
      }
      const l = logs[s.id]
      if (!l?.done) continue
      out.push({
        exercise_id: exerciseId,
        set_number: s.setNumber,
        reps: s.item.reps !== undefined ? l.reps : null,
        weight_lb: l.weight,
        seconds: s.item.seconds !== undefined ? l.seconds : null,
        side: s.side,
        rest_sec: l.rest,
      })
    }
    return out
  }, [steps, logs, emomReps, emomReached, exerciseFor, sessionBell])

  const mainSteps = steps.filter((s) => s.section === 'main')
  const completed = mainSteps.length > 0 && mainSteps.every((s) => logs[s.id]?.done)

  const save = async (meta: FinishMeta) => {
    if (!membership || startedAt === null) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveSession(
        {
          household_id: membership.household_id,
          athlete_id: athlete.id,
          workout_id: workout.id,
          performed_on: today(),
          started_at: new Date(startedAt).toISOString(),
          duration_sec: Math.round(((endedAt ?? Date.now()) - startedAt) / 1000),
          bell_lb: sessionBell,
          rpe: meta.rpe,
          feel: meta.feel,
          trained_fasted: meta.trainedFasted,
          notes: meta.notes || null,
          completed,
        },
        setLogs_,
      )
      if (meta.updateBell) {
        await updateAthlete(athlete.id, { current_bell_lb: sessionBell })
        await reloadAthletes()
      }
      setPhase('saved')
      window.scrollTo({ top: 0 })
    } catch (e) {
      setSaveError(e as Error)
    } finally {
      setSaving(false)
    }
  }

  const exit = () => {
    if (phase === 'ready' || phase === 'saved' || window.confirm('Leave this workout? Nothing has been saved, and nothing is kept on this phone.')) {
      navigate('/')
    }
  }

  // ---------------------------------------------------------------- Ready
  if (phase === 'ready') {
    const bells = [...new Set([...athlete.available_bells_lb, athlete.current_bell_lb])].sort((a, b) => a - b)
    const swapped = [...new Map(steps.map((s) => [s.itemKey, s])).values()].filter((s) => exerciseFor(s) !== s.item.exerciseId)
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={exit}>
            ✕ Close
          </Button>
          <Pill>{athlete.name}</Pill>
        </div>
        {kidMode && <SuperviseBanner />}
        <PageTitle sub={workout.summary}>{workout.name}</PageTitle>

        {workout.notes.length > 0 && !kidMode && (
          <Card>
            <ul className="list-disc space-y-1 pl-5">
              {workout.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="mb-2 font-extrabold">{kidMode ? 'Your bell' : 'Bell for this session'}</h2>
          <BellPicker bells={bells} value={sessionBell} onChange={setSessionBell} />
        </Card>

        {swapped.length > 0 && (
          <Card>
            <h2 className="mb-1 font-extrabold">Swapped for your equipment</h2>
            <ul className="list-disc pl-5">
              {swapped.map((s) => (
                <li key={s.itemKey}>
                  {exerciseName(s.item.exerciseId)} → <strong>{exerciseName(exerciseFor(s))}</strong>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {history.error && <ErrorBox error={history.error} onRetry={history.reload} title="Couldn't load your last sessions" />}
        {history.loading && <Spinner label="Checking your last sessions…" />}
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <Suggestions suggestions={suggestions} kidMode={kidMode} />
            {suggestions
              .filter((s) => s.kind !== 'add_reps')
              .map((s) => {
                const done = applied.has(s.unitKey + s.kind)
                return (
                  <Button key={s.unitKey + s.kind} variant="secondary" disabled={done} onClick={() => applySuggestion(s)}>
                    {done ? '✓ Applied: ' : 'Apply: '}
                    {s.kind === 'add_set' ? `${s.to} ${s.unitKey.includes(':') ? 'sets' : 'rounds'}` : s.kind === 'shorten_rest' ? `${s.to} s rest` : `${s.to} lb bell`}
                    {' · '}
                    {s.label}
                  </Button>
                )
              })}
          </div>
        )}

        <Button
          size="xl"
          block
          onClick={() => {
            unlockAudio()
            setStartedAt(Date.now())
            setPhase('running')
          }}
        >
          {kidMode ? "▶ Let's go!" : '▶ Start workout'}
        </Button>
      </main>
    )
  }

  // ---------------------------------------------------------------- Finish / saved
  if (phase === 'finish') {
    const previous = history.data?.[0] ?? null
    return (
      <main className="mx-auto max-w-xl p-4 pb-10">
        <FinishPanel
          workout={workout}
          athlete={athlete}
          kidMode={kidMode}
          logs={setLogs_}
          durationSec={((endedAt ?? Date.now()) - (startedAt ?? Date.now())) / 1000}
          sessionBell={sessionBell}
          completed={completed}
          previous={previous}
          saving={saving}
          error={saveError}
          onSave={(m) => void save(m)}
          onBack={() => setPhase('running')}
        />
      </main>
    )
  }

  if (phase === 'saved') {
    return <SavedScreen athlete={athlete} kidMode={kidMode} onDone={() => navigate('/')} />
  }

  // ---------------------------------------------------------------- Running
  const log = logFor(step)
  const exerciseId = exerciseFor(step)
  const loaded = isLoaded(exerciseId)
  const bells = [...new Set([...athlete.available_bells_lb, athlete.current_bell_lb, sessionBell])].sort((a, b) => a - b)
  const isLastOfUnit =
    step.kind === 'work' && step.unitKey !== null && step.setNumber === step.totalSets && (step.format === 'sets' || step.format === 'circuit')
  const next = steps[safeIndex + 1]
  const emomDone = step.kind === 'emom' && (emomReached[step.id] ?? 0) > 0

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <Button variant="ghost" onClick={exit} aria-label="Leave workout">
            ✕
          </Button>
          <span className="tabular text-lg font-bold">⏱ {formatDuration(startedAt ? (now - startedAt) / 1000 : 0)}</span>
          <Button variant="ghost" onClick={finish}>
            Finish
          </Button>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-800">
          <div className="h-full bg-brand-600" style={{ width: `${((safeIndex + 1) / steps.length) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 pb-40">
        {kidMode && <SuperviseBanner />}
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Step {safeIndex + 1} of {steps.length}
          {log.done && ' · ✓ logged'}
        </p>

        <ExerciseCard
          step={step}
          exerciseId={exerciseId}
          options={exerciseOptions(step.item.exerciseId, kidMode)}
          onSwap={(id) => setSubs((s) => ({ ...s, [step.itemKey]: id }))}
          kidMode={kidMode}
        />

        {step.kind === 'emom' ? (
          <EmomPanel
            minutes={step.minutes}
            targetReps={step.item.reps ?? 0}
            reps={repsForEmom(step)}
            onRepsChange={(i, v) => setEmomReps((r) => ({ ...r, [step.id]: repsForEmom(step).map((x, j) => (j === i ? v : x)) }))}
            onMinutesReached={(n) => setEmomReached((r) => ({ ...r, [step.id]: Math.max(r[step.id] ?? 0, n) }))}
            kidMode={kidMode}
          />
        ) : (
          <Card className="flex flex-col gap-4">
            {step.item.seconds !== undefined && (
              <>
                <HoldTimer key={step.id} targetSec={step.item.seconds} onElapsed={(sec) => updateLog(step, { seconds: sec })} />
                <Stepper label="Seconds done" value={log.seconds} step={5} onChange={(v) => updateLog(step, { seconds: v })} />
              </>
            )}
            {step.item.reps !== undefined && (
              <Stepper label={step.item.unit === 'steps' ? 'Steps done' : 'Reps done'} value={log.reps} onChange={(v) => updateLog(step, { reps: v })} />
            )}
            {loaded && (
              <div>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Weight</span>
                <BellPicker bells={bells} value={log.weight ?? 0} onChange={(v) => updateLog(step, { weight: v === 0 ? null : v })} allowNone />
              </div>
            )}
            {isLastOfUnit && step.kind === 'work' && (
              <Button variant="secondary" onClick={() => addSet(step)}>
                ＋ Add a {step.format === 'circuit' ? 'round' : 'set'}
              </Button>
            )}
          </Card>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto grid max-w-xl grid-cols-[auto_auto_1fr] gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="secondary" size="xl" disabled={safeIndex === 0} onClick={() => setIndex(safeIndex - 1)} aria-label="Previous step">
            ◀
          </Button>
          <Button variant="secondary" size="xl" onClick={advance}>
            Skip
          </Button>
          <Button size="xl" onClick={markDone} disabled={step.kind === 'emom' && !emomDone}>
            {safeIndex === steps.length - 1 ? 'Done · Finish' : kidMode ? 'Done! ✓' : 'Done ✓'}
          </Button>
        </div>
      </footer>

      {rest && (
        <RestOverlay
          rest={rest}
          guidance={step.kind === 'work' ? step.restGuidance : null}
          nextLabel={next ? exerciseName(exerciseFor(next)) : 'Finish'}
          onAdjust={adjustRest}
          onDone={endRest}
          kidMode={kidMode}
        />
      )}
    </div>
  )
}

function BellPicker({ bells, value, onChange, allowNone }: { bells: number[]; value: number; onChange: (v: number) => void; allowNone?: boolean }) {
  const options = allowNone ? [0, ...bells] : bells
  return (
    <div className="mt-1 flex gap-2 overflow-x-auto pb-1" role="radiogroup">
      {options.map((b) => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={value === b}
          onClick={() => onChange(b)}
          className={`tabular min-h-14 min-w-16 shrink-0 rounded-2xl border-2 px-3 text-lg font-bold ${value === b ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
        >
          {b === 0 ? 'None' : `${b} lb`}
        </button>
      ))}
    </div>
  )
}

function SavedScreen({ athlete, kidMode, onDone }: { athlete: Athlete; kidMode: boolean; onDone: () => void }) {
  const sessionsQ = useAsync(() => listSessions(athlete.id), [athlete.id])
  const stats = sessionsQ.data ? athleteStats(sessionsQ.data, athlete.kind) : null
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-10">
      <div className="text-center">
        <div className="text-6xl" aria-hidden>
          {kidMode ? '⭐' : '✅'}
        </div>
        <h1 className="mt-2 text-3xl font-black">{kidMode ? `Great job, ${athlete.name}!` : 'Session saved'}</h1>
        {kidMode && <p className="mt-1 text-lg">You earned a new star badge!</p>}
      </div>
      {sessionsQ.error && <ErrorBox error={sessionsQ.error} onRetry={sessionsQ.reload} title="Saved, but couldn't load your streak" />}
      {stats && (
        <Card className="text-center">
          <div className="text-4xl font-black">🔥 {stats.streak}</div>
          <div className="font-semibold text-slate-600 dark:text-slate-300">day streak</div>
        </Card>
      )}
      {kidMode && stats && <Badges sessionCount={stats.sessionDates.length} bestStreak={stats.bestStreak} />}
      <Button size="xl" block onClick={onDone}>
        Back to Today
      </Button>
    </main>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Badges from '../components/Badges'
import Suggestions from '../components/Suggestions'
import VideoLink from '../components/VideoLink'
import { Button, Card, ErrorBox, PageTitle, Pill, Spinner, Stepper, SuperviseBanner } from '../components/ui'
import { exerciseName, getWorkout, isLoaded, type Workout } from '../content'
import { useAsync } from '../hooks/useAsync'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import { listSessions, listSessionsWithLogs, recentWorkoutSessions, saveSession, updateAthlete } from '../lib/api'
import { unlockAudio } from '../lib/beep'
import { formatDate, formatDuration, today } from '../lib/dates'
import {
  buildPlan,
  buildSetLogs,
  defaultEntryLog,
  defaultExerciseFor,
  emptyOverrides,
  exerciseOptions,
  stepEntries,
  targetText,
  type ChecklistStep,
  type EmomStep,
  type Entry,
  type EntryLog,
  type PlanOverrides,
  type PlanStep,
  type WorkStep,
} from '../lib/plan'
import { progressionUnits, restUsed, suggestProgressions, type Suggestion } from '../lib/progression'
import { personalRecords, summarizeExercise } from '../lib/records'
import { weeklyStreak, weekStatus } from '../lib/schedule'
import { athleteStats } from '../lib/stats'
import type { Athlete, SetLogInput } from '../lib/types'
import { useApp } from '../state/AppContext'
import BellPicker from './player/BellPicker'
import EmomPanel from './player/EmomPanel'
import EntryRow from './player/EntryRow'
import ExerciseCard, { HowTo } from './player/ExerciseCard'
import FinishPanel, { type FinishMeta } from './player/FinishPanel'
import HoldTimer from './player/HoldTimer'
import RestOverlay, { type RestState } from './player/RestOverlay'

type Phase = 'ready' | 'running' | 'finish' | 'saved'

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

function applyLabel(s: Suggestion): string | null {
  switch (s.kind) {
    case 'add_set':
      return `${s.to} ${s.unitKey.includes(':') ? 'sets' : 'rounds'}`
    case 'shorten_rest':
      return `${s.to} s rest`
    case 'next_bell':
    case 'step_back':
      return s.to ? `${s.to} lb bell` : null
    default:
      return null
  }
}

function Player({ workout, athlete, kidMode }: { workout: Workout; athlete: Athlete; kidMode: boolean }) {
  const navigate = useNavigate()
  const { membership, reloadAthletes } = useApp()

  const history = useAsync(() => recentWorkoutSessions(athlete.id, workout.id, 2), [athlete.id, workout.id])
  const lastSession = history.data?.[0] ?? null
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
  const [logs, setLogs] = useState<Record<string, EntryLog>>({})
  const [emomReps, setEmomReps] = useState<Record<string, number[]>>({})
  const [emomReached, setEmomReached] = useState<Record<string, number>>({})
  const [index, setIndex] = useState(0)
  const [rest, setRest] = useState<(RestState & { entryId: string; unitKey: string | null; nextIndex: number }) | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<Error | null>(null)

  useWakeLock(phase === 'running')
  const now = useNow(phase === 'running', 1000)

  // Default rest to what the athlete used last time, so a "shorten rest" change sticks.
  const restSeeded = useRef(false)
  useEffect(() => {
    if (!lastSession || restSeeded.current) return
    restSeeded.current = true
    const rests: Record<string, number> = {}
    for (const unit of progressionUnits(workout)) {
      const used = restUsed(unit, lastSession.set_logs)
      if (used !== null) rests[unit.key] = used
    }
    setOverrides((o) => ({ ...o, rest: { ...rests, ...o.rest } }))
  }, [lastSession, workout])

  const steps = useMemo(() => buildPlan(workout, overrides), [workout, overrides])
  const safeIndex = Math.min(index, steps.length - 1)
  const step = steps[safeIndex]

  const exerciseFor = useCallback(
    (itemKey: string, prescribed: string) => subs[itemKey] ?? defaultExerciseFor(prescribed, athlete, kidMode),
    [subs, athlete, kidMode],
  )
  const exerciseForKey = useCallback(
    (itemKey: string) => {
      for (const s of steps) {
        if (s.kind === 'emom' && s.itemKey === itemKey) return exerciseFor(itemKey, s.item.exerciseId)
        const e = stepEntries(s).find((x) => x.itemKey === itemKey)
        if (e) return exerciseFor(itemKey, e.item.exerciseId)
      }
      return itemKey
    },
    [steps, exerciseFor],
  )

  const logFor = useCallback(
    (e: Entry): EntryLog => logs[e.id] ?? defaultEntryLog(e, exerciseFor(e.itemKey, e.item.exerciseId), sessionBell),
    [logs, exerciseFor, sessionBell],
  )
  const updateEntry = (e: Entry, patch: Partial<EntryLog>) => setLogs((l) => ({ ...l, [e.id]: { ...logFor(e), ...patch } }))

  const lastTimeFor = (exerciseId: string) => (lastSession ? summarizeExercise(exerciseId, lastSession.set_logs) : null)

  const repsForEmom = (s: EmomStep) => emomReps[s.id] ?? Array.from({ length: s.minutes }, () => s.item.reps ?? 0)

  const stepDone = (s: PlanStep) => (s.kind === 'emom' ? !!logs[s.id]?.done : stepEntries(s).every((e) => logs[e.id]?.done))

  const finish = () => {
    setEndedAt(Date.now())
    setPhase('finish')
    window.scrollTo({ top: 0 })
  }

  const goTo = (i: number) => {
    if (i < steps.length) {
      setIndex(i)
      window.scrollTo({ top: 0 })
    } else {
      finish()
    }
  }

  /** Mark steps done (at their current values); rest after the last one if it has rest. */
  const completeSteps = (range: PlanStep[], values?: EntryLog) => {
    const patch: Record<string, EntryLog> = {}
    let lastRest: { entryId: string; restAfter: number | null; unitKey: string | null } | null = null
    for (const s of range) {
      if (s.kind === 'emom') {
        patch[s.id] = { reps: null, weight: null, seconds: null, rest: null, done: true }
        continue
      }
      const entries = stepEntries(s)
      const restAfter = s.kind === 'work' || s.kind === 'round' ? s.restAfter : null
      entries.forEach((e, i) => {
        const base = values ? { ...logFor(e), reps: values.reps, weight: values.weight, seconds: values.seconds } : logFor(e)
        const isLast = i === entries.length - 1
        patch[e.id] = { ...base, done: true, rest: isLast ? restAfter : base.rest }
        if (isLast) lastRest = { entryId: e.id, restAfter, unitKey: s.unitKey }
      })
    }
    setLogs((l) => ({ ...l, ...patch }))
    const nextIndex = steps.indexOf(range[range.length - 1]) + 1
    const r = lastRest as { entryId: string; restAfter: number | null; unitKey: string | null } | null
    if (range.length === 1 && r && r.restAfter && r.restAfter > 0) {
      setRest({ startedAt: Date.now(), totalSec: r.restAfter, entryId: r.entryId, unitKey: r.unitKey, nextIndex })
    } else {
      goTo(nextIndex)
    }
  }

  const endRest = () => {
    if (!rest) return
    setLogs((l) => ({ ...l, [rest.entryId]: { ...l[rest.entryId], rest: rest.totalSec } }))
    setRest(null)
    goTo(rest.nextIndex)
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

  const addSet = (unitKey: string, current: number) => setOverrides((o) => ({ ...o, sets: { ...o.sets, [unitKey]: current + 1 } }))

  const applySuggestion = (sg: Suggestion) => {
    if (sg.kind === 'add_set' && sg.to) setOverrides((o) => ({ ...o, sets: { ...o.sets, [sg.unitKey]: sg.to! } }))
    if (sg.kind === 'shorten_rest' && sg.to) setOverrides((o) => ({ ...o, rest: { ...o.rest, [sg.unitKey]: sg.to! } }))
    if ((sg.kind === 'next_bell' || sg.kind === 'step_back') && sg.to) setSessionBell(sg.to)
    setApplied((a) => new Set(a).add(sg.unitKey + sg.kind))
  }

  const setLogRows = useMemo(
    (): SetLogInput[] => buildSetLogs(steps, { logs, exerciseFor: exerciseForKey, bell: sessionBell, emomReps, emomReached }),
    [steps, logs, exerciseForKey, sessionBell, emomReps, emomReached],
  )

  const mainSteps = steps.filter((s) => s.section === 'main')
  const completed = mainSteps.length > 0 && mainSteps.every(stepDone)

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
        setLogRows,
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

  const bells = [...new Set([...athlete.available_bells_lb, athlete.current_bell_lb, sessionBell])].sort((a, b) => a - b)

  // ---------------------------------------------------------------- Ready
  if (phase === 'ready') {
    const items = new Map<string, string>()
    for (const s of steps) {
      if (s.kind === 'emom') items.set(s.itemKey, s.item.exerciseId)
      else for (const e of stepEntries(s)) items.set(e.itemKey, e.item.exerciseId)
    }
    const swapped = [...items].filter(([key, id]) => exerciseFor(key, id) !== id)
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

        {lastSession && (
          <p className="-mt-2 text-slate-600 dark:text-slate-300">
            ↺ Last time: {formatDate(lastSession.performed_on, { weekday: 'short', month: 'short', day: 'numeric' })}
            {lastSession.bell_lb ? ` · ${lastSession.bell_lb} lb` : ''}
            {lastSession.rpe ? ` · RPE ${lastSession.rpe}` : ''}
          </p>
        )}

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
              {swapped.map(([key, id]) => (
                <li key={key}>
                  {exerciseName(id)} → <strong>{exerciseName(exerciseFor(key, id))}</strong>
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
            {suggestions.map((s) => {
              const label = applyLabel(s)
              if (!label) return null
              const done = applied.has(s.unitKey + s.kind)
              return (
                <Button key={s.unitKey + s.kind} variant="secondary" disabled={done} onClick={() => applySuggestion(s)}>
                  {done ? '✓ Applied: ' : 'Apply: '}
                  {label} · {s.label}
                </Button>
              )
            })}
          </div>
        )}

        <p className="text-sm text-slate-600 dark:text-slate-400">
          {steps.length} steps. Targets are filled in, so tap <strong>Done</strong> unless something was different.
        </p>

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
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-10">
        <RecordsCard athleteId={athlete.id} logs={setLogRows} kidMode={kidMode} />
        <FinishPanel
          workout={workout}
          athlete={athlete}
          kidMode={kidMode}
          logs={setLogRows}
          durationSec={((endedAt ?? Date.now()) - (startedAt ?? Date.now())) / 1000}
          sessionBell={sessionBell}
          completed={completed}
          previous={lastSession}
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
  const next = steps[rest ? rest.nextIndex : safeIndex + 1]
  const nextLabel = !next
    ? 'Finish'
    : next.kind === 'round'
      ? `${next.blockTitle}, round ${next.round}`
      : next.kind === 'checklist'
        ? 'Warm-up'
        : exerciseName(next.kind === 'emom' ? exerciseFor(next.itemKey, next.item.exerciseId) : exerciseFor(next.entry.itemKey, next.entry.item.exerciseId))

  // "All sets done": the remaining sets of this exercise in a sets block.
  const remainingSets =
    step.kind === 'work' && step.format === 'sets'
      ? steps.slice(safeIndex).filter((s): s is WorkStep => s.kind === 'work' && s.entry.itemKey === step.entry.itemKey)
      : []

  const doneLabel =
    step.kind === 'checklist' ? 'Warm-up done ✓' : step.kind === 'round' ? 'Round done ✓' : safeIndex === steps.length - 1 ? 'Done · Finish' : kidMode ? 'Done! ✓' : 'Done ✓'

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
          {stepDone(step) && ' · ✓ logged'}
        </p>

        {step.kind === 'checklist' && <ChecklistView step={step} exerciseFor={exerciseFor} setSubs={setSubs} kidMode={kidMode} />}

        {step.kind === 'round' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Pill tone="brand">{step.blockTitle}</Pill>
              <Pill>
                Round {step.round} of {step.totalRounds}
              </Pill>
            </div>
            <h2 className="text-3xl font-black kid:text-4xl">Round {step.round}</h2>
            <p className="-mt-2 text-slate-600 dark:text-slate-300">Do each exercise in order. Tap one to change the numbers or see how.</p>
            <ul className="flex flex-col gap-2">
              {step.entries.map((e) => {
                const exId = exerciseFor(e.itemKey, e.item.exerciseId)
                return (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    log={logFor(e)}
                    exerciseId={exId}
                    options={exerciseOptions(e.item.exerciseId, kidMode)}
                    bells={bells}
                    lastTime={lastTimeFor(exId)}
                    kidMode={kidMode}
                    onChange={(p) => updateEntry(e, p)}
                    onSwap={(id) => setSubs((s) => ({ ...s, [e.itemKey]: id }))}
                  />
                )
              })}
            </ul>
            {step.round === step.totalRounds && step.unitKey && (
              <Button variant="secondary" onClick={() => addSet(step.unitKey!, step.totalRounds)}>
                ＋ Add a round
              </Button>
            )}
          </div>
        )}

        {step.kind === 'work' &&
          (() => {
            const e = step.entry
            const exId = exerciseFor(e.itemKey, e.item.exerciseId)
            const log = logFor(e)
            const pills = [step.blockTitle, ...(step.totalSets > 1 ? [`Set ${e.setNumber} of ${step.totalSets}`] : [])]
            return (
              <>
                <ExerciseCard
                  pills={pills}
                  item={e.item}
                  sideLabel={e.sideLabel}
                  exerciseId={exId}
                  options={exerciseOptions(e.item.exerciseId, kidMode)}
                  onSwap={(id) => setSubs((s) => ({ ...s, [e.itemKey]: id }))}
                  lastTime={lastTimeFor(exId)}
                  kidMode={kidMode}
                />
                <Card className="flex flex-col gap-4">
                  {e.item.seconds !== undefined && (
                    <>
                      <HoldTimer key={step.id} targetSec={e.item.seconds} onElapsed={(sec) => updateEntry(e, { seconds: sec })} />
                      <Stepper label="Seconds done" value={log.seconds} step={5} onChange={(v) => updateEntry(e, { seconds: v })} />
                    </>
                  )}
                  {e.item.reps !== undefined && (
                    <Stepper
                      label={`${e.item.unit === 'steps' ? 'Steps' : 'Reps'} done${e.side === 'each' ? ' (each side)' : ''}`}
                      value={log.reps}
                      onChange={(v) => updateEntry(e, { reps: v })}
                    />
                  )}
                  {isLoaded(exId) && (
                    <div>
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Weight</span>
                      <BellPicker bells={bells} value={log.weight ?? 0} onChange={(v) => updateEntry(e, { weight: v === 0 ? null : v })} allowNone />
                    </div>
                  )}
                  {remainingSets.length >= 2 && (
                    <Button variant="secondary" onClick={() => completeSteps(remainingSets, log)}>
                      ✓ All {remainingSets.length} remaining sets done
                    </Button>
                  )}
                  {step.format === 'sets' && step.unitKey && e.setNumber === step.totalSets && (
                    <Button variant="secondary" onClick={() => addSet(step.unitKey!, step.totalSets)}>
                      ＋ Add a set
                    </Button>
                  )}
                </Card>
              </>
            )
          })()}

        {step.kind === 'emom' &&
          (() => {
            const exId = exerciseFor(step.itemKey, step.item.exerciseId)
            return (
              <>
                <ExerciseCard
                  pills={[step.blockTitle, `${step.minutes} min`]}
                  item={step.item}
                  sideLabel={null}
                  exerciseId={exId}
                  options={exerciseOptions(step.item.exerciseId, kidMode)}
                  onSwap={(id) => setSubs((s) => ({ ...s, [step.itemKey]: id }))}
                  lastTime={lastTimeFor(exId)}
                  kidMode={kidMode}
                  suffix="every minute"
                />
                <EmomPanel
                  minutes={step.minutes}
                  targetReps={step.item.reps ?? 0}
                  reps={repsForEmom(step)}
                  onRepsChange={(i, v) => setEmomReps((r) => ({ ...r, [step.id]: repsForEmom(step).map((x, j) => (j === i ? v : x)) }))}
                  onMinutesReached={(n) => setEmomReached((r) => ({ ...r, [step.id]: Math.max(r[step.id] ?? 0, n) }))}
                  kidMode={kidMode}
                />
              </>
            )
          })()}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto grid max-w-xl grid-cols-[auto_auto_1fr] gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="secondary" size="xl" disabled={safeIndex === 0} onClick={() => goTo(safeIndex - 1)} aria-label="Previous step">
            ◀
          </Button>
          <Button variant="secondary" size="xl" onClick={() => goTo(safeIndex + 1)}>
            Skip
          </Button>
          <Button size="xl" onClick={() => completeSteps([step])} disabled={step.kind === 'emom' && !((emomReached[step.id] ?? 0) > 0)}>
            {doneLabel}
          </Button>
        </div>
      </footer>

      {rest && (
        <RestOverlay
          rest={rest}
          guidance={step.kind === 'work' || step.kind === 'round' ? step.restGuidance : null}
          nextLabel={nextLabel}
          onAdjust={adjustRest}
          onDone={endRest}
          kidMode={kidMode}
        />
      )}
    </div>
  )
}

function ChecklistView({
  step,
  exerciseFor,
  setSubs,
  kidMode,
}: {
  step: ChecklistStep
  exerciseFor: (itemKey: string, prescribed: string) => string
  setSubs: Dispatch<SetStateAction<Record<string, string>>>
  kidMode: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Pill tone="blue">Warm-up</Pill>
      </div>
      <h2 className="text-3xl font-black kid:text-4xl">Warm-up</h2>
      <p className="-mt-2 text-slate-600 dark:text-slate-300">Easy pace. Tap one to see how. One tap when you're done with all of it.</p>
      {step.groups.map((g, gi) => (
        <Card key={gi} className="flex flex-col gap-2">
          {g.rounds > 1 && <p className="font-extrabold">{g.rounds} rounds of:</p>}
          <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
            {g.items.map((item, ii) => {
              const itemKey = `warmup-${gi}-${ii}`
              const exId = exerciseFor(itemKey, item.exerciseId)
              const options = exerciseOptions(item.exerciseId, kidMode)
              return (
                <li key={itemKey} className="py-2">
                  <details>
                    <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2">
                      <span className="text-lg font-bold">{exerciseName(exId)}</span>
                      <span className="tabular font-bold text-brand-700 dark:text-brand-500">
                        {item.sets && item.sets > 1 ? `${item.sets} × ` : ''}
                        {targetText(item)}
                        {item.perSide ? (item.sideNames ? ' each way' : ' / side') : ''}
                      </span>
                    </summary>
                    <div className="mt-2 flex flex-col gap-2">
                      {options.length > 1 && (
                        <select
                          className="min-h-11 rounded-xl border-2 border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900"
                          value={exId}
                          onChange={(e) => setSubs((s) => ({ ...s, [itemKey]: e.target.value }))}
                          aria-label="Swap exercise"
                        >
                          {options.map((id) => (
                            <option key={id} value={id}>
                              {exerciseName(id)}
                            </option>
                          ))}
                        </select>
                      )}
                      <VideoLink exerciseId={exId} compact />
                      <HowTo exerciseId={exId} kidMode={kidMode} />
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        </Card>
      ))}
    </div>
  )
}

/** New personal records in this session, compared with every earlier session. */
function RecordsCard({ athleteId, logs, kidMode }: { athleteId: string; logs: SetLogInput[]; kidMode: boolean }) {
  const all = useAsync(() => listSessionsWithLogs(athleteId), [athleteId])
  const records = useMemo(() => (all.data ? personalRecords(logs, all.data, exerciseName) : []), [all.data, logs])
  if (all.error) return <ErrorBox error={all.error} onRetry={all.reload} title="Couldn't check for new records" />
  if (records.length === 0) return null
  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-50">
      <p className="text-lg font-extrabold">{kidMode ? '🏆 You beat your record!' : `🏆 New record${records.length > 1 ? 's' : ''}`}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {records.map((r) => (
          <li key={r.exerciseId}>{r.message}</li>
        ))}
      </ul>
    </div>
  )
}

function SavedScreen({ athlete, kidMode, onDone }: { athlete: Athlete; kidMode: boolean; onDone: () => void }) {
  const sessionsQ = useAsync(() => listSessions(athlete.id), [athlete.id])
  const todayDate = today()
  const stats = sessionsQ.data ? athleteStats(sessionsQ.data, athlete) : null
  const week = sessionsQ.data && stats ? weekStatus(todayDate, athlete, sessionsQ.data, stats.firstSessionDate) : null
  const weeks = sessionsQ.data && stats ? weeklyStreak(todayDate, athlete, sessionsQ.data, stats.firstSessionDate) : 0
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-10">
      <div className="text-center">
        <div className="text-6xl" aria-hidden>
          {kidMode ? '⭐' : '✅'}
        </div>
        <h1 className="mt-2 text-3xl font-black">{kidMode ? `Great job, ${athlete.name}!` : 'Session saved'}</h1>
        {kidMode && <p className="mt-1 text-lg">You earned a new star badge!</p>}
      </div>
      {sessionsQ.loading && <Spinner />}
      {sessionsQ.error && <ErrorBox error={sessionsQ.error} onRetry={sessionsQ.reload} title="Saved, but couldn't load your week" />}
      {week && (
        <Card className="text-center">
          <div className="text-4xl font-black tabular">
            {Math.min(week.done, week.goal)} of {week.goal}
          </div>
          <div className="font-semibold text-slate-600 dark:text-slate-300">workouts this week{weeks > 0 ? ` · 🔥 ${weeks}-week streak` : ''}</div>
        </Card>
      )}
      {kidMode && stats && <Badges sessionCount={stats.sessionDates.length} bestStreak={stats.bestStreak} />}
      <Button size="xl" block onClick={onDone}>
        Back to Today
      </Button>
    </main>
  )
}


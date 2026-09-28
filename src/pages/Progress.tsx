import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import Badges from '../components/Badges'
import { ChartCard, TrendLine, WeeklyBars } from '../components/Charts'
import { Button, Card, ErrorBox, Field, inputClass, PageTitle, Spinner } from '../components/ui'
import { benchmarkTests, workoutName } from '../content'
import { useAsync } from '../hooks/useAsync'
import { addBenchmark, addBodyMetric, listBenchmarks, listBodyMetrics, listSessionsWithLogs } from '../lib/api'
import { formatDate, formatDuration, today } from '../lib/dates'
import { bellHistory, heatmap, sessionsPerWeek, swingsPerWeek } from '../lib/progressData'
import { weeklyStreak } from '../lib/schedule'
import { athleteStats } from '../lib/stats'
import type { Athlete } from '../lib/types'
import { useApp } from '../state/AppContext'

const WEEKS = 12
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function Progress() {
  const { activeAthlete, athletesLoading } = useApp()
  if (!activeAthlete) {
    return athletesLoading ? (
      <Spinner />
    ) : (
      <Card>
        <p>
          Add an athlete on the{' '}
          <Link className="underline" to="/family">
            Family
          </Link>{' '}
          screen first.
        </p>
      </Card>
    )
  }
  return <ProgressFor key={activeAthlete.id} athlete={activeAthlete} />
}

function ProgressFor({ athlete }: { athlete: Athlete }) {
  const { kidMode } = useApp()
  const todayDate = today()
  const sessionsQ = useAsync(() => listSessionsWithLogs(athlete.id), [athlete.id])
  const benchQ = useAsync(() => listBenchmarks(athlete.id), [athlete.id])
  const bodyQ = useAsync(() => (athlete.kind === 'adult' ? listBodyMetrics(athlete.id) : Promise.resolve([])), [athlete.id, athlete.kind])

  const sessions = sessionsQ.data
  const derived = useMemo(() => {
    if (!sessions) return null
    const stats = athleteStats(sessions, athlete, todayDate)
    return {
      stats,
      weeks: weeklyStreak(todayDate, athlete, sessions, stats.firstSessionDate),
      grid: heatmap(stats.sessionDates, WEEKS, todayDate),
      perWeek: sessionsPerWeek(sessions, WEEKS, todayDate).map((w) => ({ label: w.label, value: w.value })),
      swings: swingsPerWeek(sessions, WEEKS, todayDate).map((w) => ({ label: w.label, value: w.value })),
      bells: bellHistory(sessions).map((b) => ({ label: formatDate(b.date), value: b.bell })),
      recent: [...sessions].reverse().slice(0, 10),
    }
  }, [sessions, athlete, todayDate])

  return (
    <div className="flex flex-col gap-4">
      <PageTitle sub={athlete.name}>Progress</PageTitle>

      {sessionsQ.error && <ErrorBox error={sessionsQ.error} onRetry={sessionsQ.reload} title="Couldn't load sessions" />}
      {sessionsQ.loading && !derived && <Spinner />}

      {derived && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Weeks in a row" value={`🔥 ${derived.weeks}`} />
            <Stat label="Best day streak" value={String(derived.stats.bestStreak)} />
            <Stat label="Sessions" value={String(derived.stats.sessionDates.length)} />
          </div>

          {kidMode && <Badges sessionCount={derived.stats.sessionDates.length} bestStreak={derived.stats.bestStreak} />}

          <ChartCard title="Training calendar" sub={`Last ${WEEKS} weeks`}>
            <div className="flex gap-1">
              <div className="grid grid-rows-7 gap-1 pr-1 text-[10px] leading-none text-slate-500">
                {DAY_LABELS.map((d, i) => (
                  <span key={i} className="flex h-full items-center">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
                {derived.grid.map((week) => (
                  <div key={week[0].date} className="grid grid-rows-7 gap-1">
                    {week.map((d) => (
                      <div
                        key={d.date}
                        title={`${formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}: ${d.count} session${d.count === 1 ? '' : 's'}`}
                        className={`aspect-square rounded-[3px] ${d.future ? 'opacity-0' : ''} ${d.date === todayDate ? 'ring-2 ring-slate-500' : ''}`}
                        style={{ background: `var(--heat-${Math.min(d.count, 2)})` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1 text-xs text-slate-600 dark:text-slate-400">
              <span>None</span>
              {[0, 1, 2].map((n) => (
                <span key={n} className="size-3 rounded-[3px]" style={{ background: `var(--heat-${n})` }} />
              ))}
              <span>2+</span>
            </div>
          </ChartCard>

          <ChartCard title="Sessions per week">
            <WeeklyBars data={derived.perWeek} unit="sessions" />
          </ChartCard>

          <ChartCard title="Swings per week" sub="Two-hand and one-arm swings">
            <WeeklyBars data={derived.swings} unit="swings" />
          </ChartCard>

          <ChartCard title="Bell weight" sub="Bell used per session, lb">
            <TrendLine data={derived.bells} unit="lb" step />
          </ChartCard>
        </>
      )}

      <BenchmarksSection athlete={athlete} q={benchQ} />

      {athlete.kind === 'adult' && <BodySection athlete={athlete} q={bodyQ} />}

      {derived && derived.recent.length > 0 && (
        <Card>
          <h2 className="mb-2 text-lg font-extrabold">Recent sessions</h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {derived.recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="block font-semibold">{workoutName(s.workout_id)}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(s.performed_on, { weekday: 'short', month: 'short', day: 'numeric' })}
                    {s.duration_sec ? ` · ${formatDuration(s.duration_sec)}` : ''}
                    {s.bell_lb ? ` · ${s.bell_lb} lb` : ''}
                  </span>
                </span>
                {s.rpe !== null && <span className="tabular text-sm font-bold">RPE {s.rpe}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-2xl font-black tabular">{value}</div>
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</div>
    </Card>
  )
}

type Q<T> = ReturnType<typeof useAsync<T>>

function BenchmarksSection({ athlete, q }: { athlete: Athlete; q: Q<Awaited<ReturnType<typeof listBenchmarks>>> }) {
  const tests = benchmarkTests.filter((t) => t.requires !== 'pullup_bar' || athlete.has_pullup_bar)
  const [testId, setTestId] = useState(tests[0]?.id ?? '')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await addBenchmark({ athlete_id: athlete.id, test_id: testId, tested_on: date, value: Number(value), notes: null })
      setValue('')
      q.reload()
    } catch (err) {
      setError(err as Error)
    } finally {
      setBusy(false)
    }
  }

  const test = tests.find((t) => t.id === testId)

  return (
    <>
      {q.error && <ErrorBox error={q.error} onRetry={q.reload} title="Couldn't load benchmarks" />}
      {tests.map((t) => (
        <ChartCard key={t.id} title={t.name} sub={`${t.cadence} · ${t.unit}`}>
          {q.loading && !q.data ? (
            <Spinner />
          ) : (
            <TrendLine
              data={(q.data ?? []).filter((b) => b.test_id === t.id).map((b) => ({ label: formatDate(b.tested_on), value: Number(b.value) }))}
              unit={t.unit}
            />
          )}
        </ChartCard>
      ))}
      <Card>
        <h2 className="mb-2 text-lg font-extrabold">Log a benchmark</h2>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <Field label="Test">
            <select className={inputClass} value={testId} onChange={(e) => setTestId(e.target.value)}>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {test && <p className="text-sm text-slate-600 dark:text-slate-400">{test.description}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Result (${test?.unit ?? ''})`}>
              <input className={inputClass} inputMode="numeric" required value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
            <Field label="Date">
              <input className={inputClass} type="date" required value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          {error && <ErrorBox error={error} title="Couldn't save" />}
          <Button type="submit" disabled={busy || !value}>
            {busy ? 'Saving…' : 'Save benchmark'}
          </Button>
        </form>
      </Card>
    </>
  )
}

function BodySection({ athlete, q }: { athlete: Athlete; q: Q<Awaited<ReturnType<typeof listBodyMetrics>>> }) {
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await addBodyMetric({
        athlete_id: athlete.id,
        measured_on: date,
        bodyweight_lb: weight ? Number(weight) : null,
        waist_in: waist ? Number(waist) : null,
      })
      setWeight('')
      setWaist('')
      q.reload()
    } catch (err) {
      setError(err as Error)
    } finally {
      setBusy(false)
    }
  }

  const rows = q.data ?? []
  return (
    <>
      {q.error && <ErrorBox error={q.error} onRetry={q.reload} title="Couldn't load body metrics" />}
      <ChartCard title="Bodyweight" sub="lb">
        <TrendLine data={rows.filter((r) => r.bodyweight_lb !== null).map((r) => ({ label: formatDate(r.measured_on), value: Number(r.bodyweight_lb) }))} unit="lb" />
      </ChartCard>
      <ChartCard title="Waist" sub="inches">
        <TrendLine data={rows.filter((r) => r.waist_in !== null).map((r) => ({ label: formatDate(r.measured_on), value: Number(r.waist_in) }))} unit="in" />
      </ChartCard>
      <Card>
        <h2 className="mb-2 text-lg font-extrabold">Log body metrics</h2>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bodyweight (lb)">
              <input className={inputClass} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
            <Field label="Waist (in)">
              <input className={inputClass} inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
          </div>
          <Field label="Date">
            <input className={inputClass} type="date" required value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {error && <ErrorBox error={error} title="Couldn't save" />}
          <Button type="submit" disabled={busy || (!weight && !waist)}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </Card>
    </>
  )
}

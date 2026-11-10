import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Card, ErrorBox, PageTitle, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { getNutritionTargets, listMealEntries, setMealEntryStatus } from '../lib/api'
import { addDays, formatDate, today } from '../lib/dates'
import { groupBySlot, sumMacros, summarizeDay } from '../lib/nutrition'
import type { Athlete, MealEntry } from '../lib/types'
import { useApp } from '../state/AppContext'

export default function Food() {
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
  return <FoodFor key={activeAthlete.id} athlete={activeAthlete} />
}

const round = (n: number) => Math.round(n)

function FoodFor({ athlete }: { athlete: Athlete }) {
  const todayDate = today()
  const [day, setDay] = useState(todayDate)
  const targetsQ = useAsync(() => getNutritionTargets(athlete.id), [athlete.id])
  const entriesQ = useAsync(() => listMealEntries(athlete.id, day), [athlete.id, day])
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<Error | null>(null)

  const targets = targetsQ.data ?? null
  const entries = entriesQ.data ?? []
  const summary = summarizeDay(entries, targets)
  const isToday = day === todayDate

  async function toggleEaten(e: MealEntry) {
    setSaving(e.id)
    setSaveError(null)
    try {
      await setMealEntryStatus(e.id, e.status === 'eaten' ? 'planned' : 'eaten')
      entriesQ.reload()
    } catch (err) {
      setSaveError(err as Error)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle sub="Meals Claude logged and planned for you.">Food</PageTitle>

      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
          ←
        </Button>
        <div className="text-center">
          <p className="font-bold">{isToday ? 'Today' : formatDate(day, { weekday: 'long' })}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(day, { month: 'long', day: 'numeric' })}</p>
        </div>
        <Button variant="secondary" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
          →
        </Button>
      </div>

      {targetsQ.error && <ErrorBox error={targetsQ.error} onRetry={targetsQ.reload} />}
      {entriesQ.error && <ErrorBox error={entriesQ.error} onRetry={entriesQ.reload} />}
      {saveError && <ErrorBox error={saveError} title="Couldn't save that" />}

      {entriesQ.loading && !entriesQ.data ? (
        <Spinner />
      ) : (
        <>
          <Card>
            <Bar label="Calories" value={summary.planned.kcal} target={targets?.kcal} unit="kcal" />
            <div className="mt-3">
              <Bar label="Protein" value={summary.planned.protein_g} target={targets?.protein_g} unit="g" />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <Stat label="Eaten so far" value={`${round(summary.eaten.kcal)} kcal`} sub={`${round(summary.eaten.protein_g)} g protein`} />
              <Stat
                label={summary.overBy > 0 ? 'Over target' : 'Flex left'}
                value={summary.flexLeft === null ? '—' : `${summary.overBy > 0 ? summary.overBy : summary.flexLeft} kcal`}
                tone={summary.overBy > 0 ? 'warn' : 'ok'}
              />
              <Stat
                label="Fat · Carbs"
                value={`${round(summary.planned.fat_g)} · ${round(summary.planned.carbs_g)} g`}
                sub={`${round(summary.planned.fiber_g)} g fiber`}
              />
            </dl>
            {targets?.window_start && targets.window_end && (
              <p className="mt-3 text-center text-sm text-slate-600 dark:text-slate-400">
                Eating window {targets.window_start.slice(0, 5)}–{targets.window_end.slice(0, 5)}
              </p>
            )}
          </Card>

          {entries.length === 0 ? (
            <Card>
              <p className="text-slate-700 dark:text-slate-300">
                Nothing logged for this day yet. Tell Claude what you're eating, or ask it to plan the day, and it shows up here.
              </p>
            </Card>
          ) : (
            groupBySlot(entries).map((g) => {
              const t = sumMacros(g.entries.filter((e) => e.status !== 'skipped'))
              return (
                <Card key={g.slot}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-lg font-bold">{g.label}</h2>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {round(t.kcal)} kcal · {round(t.protein_g)} g protein
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                    {g.entries.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleEaten(e)}
                          disabled={saving === e.id || e.status === 'skipped'}
                          aria-pressed={e.status === 'eaten'}
                          aria-label={e.status === 'eaten' ? `Mark ${e.name} as not eaten` : `Mark ${e.name} as eaten`}
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                            e.status === 'eaten'
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-slate-300 text-transparent dark:border-slate-600'
                          }`}
                        >
                          ✓
                        </button>
                        <div className={`min-w-0 flex-1 ${e.status === 'skipped' ? 'line-through opacity-50' : ''}`}>
                          <p className="font-medium">{e.name}</p>
                          {(e.amount_label || e.notes) && (
                            <p className="text-sm text-slate-600 dark:text-slate-400">{[e.amount_label, e.notes].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right text-sm">
                          <p className="font-semibold">{round(e.kcal)}</p>
                          <p className="text-slate-600 dark:text-slate-400">{round(e.protein_g)} g</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })
          )}
        </>
      )}
    </div>
  )
}

function Bar({ label, value, target, unit }: { label: string; value: number; target?: number; unit: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-slate-700 dark:text-slate-300">
          <span className="font-bold">{round(value)}</span>
          {target ? ` / ${target}` : ''} {unit}
        </span>
      </div>
      {target ? (
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={round(value)} aria-valuemax={target} aria-label={label}>
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
      <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className={`font-bold ${tone === 'warn' ? 'text-red-700 dark:text-red-400' : ''}`}>{value}</dd>
      {sub && <dd className="text-xs text-slate-600 dark:text-slate-400">{sub}</dd>}
    </div>
  )
}

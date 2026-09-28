import { useState } from 'react'
import { Link } from 'react-router'
import { Card, PageTitle, Pill, Toggle } from '../components/ui'
import { exercises, workouts } from '../content'
import { useApp } from '../state/AppContext'

export default function Library() {
  const { kidMode } = useApp()
  const [tab, setTab] = useState<'workouts' | 'exercises'>('workouts')
  const [kidSafeOnly, setKidSafeOnly] = useState(false)
  const filter = kidMode || kidSafeOnly

  const ws = workouts.filter((w) => !filter || w.kidSafe)
  const es = exercises.filter((e) => !filter || e.kidSafe).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col gap-4">
      <PageTitle sub={kidMode ? 'Workouts and moves for you.' : 'Every workout and exercise, with full instructions.'}>Library</PageTitle>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
        {(['workouts', 'exercises'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-xl font-bold capitalize ${tab === t ? 'bg-white shadow dark:bg-slate-950' : 'text-slate-600 dark:text-slate-300'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {!kidMode && <Toggle label="Kid-safe only" checked={kidSafeOnly} onChange={setKidSafeOnly} />}

      {tab === 'workouts' ? (
        <ul className="flex flex-col gap-3">
          {ws.map((w) => (
            <li key={w.id}>
              <Link to={`/library/workout/${w.id}`} className="block">
                <Card className="hover:border-brand-500">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-extrabold">{w.name}</h2>
                    {w.kidSafe && <Pill tone="green">Kid-safe</Pill>}
                  </div>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{w.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill>~{w.estimatedMinutes} min</Pill>
                    <Pill>{w.level}</Pill>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {es.map((e) => (
            <li key={e.id}>
              <Link to={`/library/exercise/${e.id}`} className="flex min-h-14 items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900">
                <span>
                  <span className="block font-bold">{e.name}</span>
                  <span className="text-sm text-slate-600 capitalize dark:text-slate-400">{e.category}</span>
                </span>
                {e.kidSafe && <Pill tone="green">Kid-safe</Pill>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

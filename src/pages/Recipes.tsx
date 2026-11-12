import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Card, ErrorBox, inputClass, PageTitle, Pill, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { getRecipe, listRecipes } from '../lib/api'
import type { Recipe, RecipeCategory } from '../lib/types'
import { useApp } from '../state/AppContext'

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  meal_3: 'Afternoon meal',
  dinner: 'Dinner',
  snack: 'Snack',
  dessert: 'Dessert',
  other: 'Other',
}
const CATEGORY_ORDER: RecipeCategory[] = ['breakfast', 'lunch', 'meal_3', 'dinner', 'snack', 'dessert', 'other']

const r = (n: number | null) => (n === null ? '—' : Math.round(n))

function MacroLine({ recipe }: { recipe: Recipe }) {
  if (recipe.kcal === null) return null
  return (
    <span>
      {r(recipe.kcal)} kcal · {r(recipe.protein_g)} g protein
    </span>
  )
}

export function RecipeList() {
  const { membership } = useApp()
  const householdId = membership?.household_id ?? ''
  const q = useAsync(() => listRecipes(householdId), [householdId])
  const [search, setSearch] = useState('')

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = (q.data ?? []).filter(
      (x) => !term || x.name.toLowerCase().includes(term) || x.tags.some((t) => t.toLowerCase().includes(term)),
    )
    return CATEGORY_ORDER.map((c) => ({ c, items: list.filter((x) => x.category === c) })).filter((g) => g.items.length)
  }, [q.data, search])

  return (
    <div className="space-y-4">
      <Link to="/food" className="text-sm font-semibold text-brand-600 dark:text-brand-500">
        ← Food
      </Link>
      <PageTitle sub="Send Claude a recipe and it lands here, with macros per serving.">Recipes</PageTitle>
      <input className={inputClass} type="search" placeholder="Search recipes" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search recipes" />
      {q.error && <ErrorBox error={q.error} onRetry={q.reload} />}
      {q.loading && !q.data ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Card>
          <p>{search ? 'No recipes match that search.' : 'No recipes yet. Send Claude one to start your book.'}</p>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.c} className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">{CATEGORY_LABELS[g.c]}</h2>
            {g.items.map((x) => (
              <Link key={x.id} to={`/food/recipes/${x.id}`} className="block">
                <Card className="hover:border-brand-500">
                  <p className="font-bold">{x.name}</p>
                  {x.summary && <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{x.summary}</p>}
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    <MacroLine recipe={x} />
                    {x.prep_minutes ? ` · ${x.prep_minutes} min` : ''}
                  </p>
                </Card>
              </Link>
            ))}
          </section>
        ))
      )}
    </div>
  )
}

export function RecipeDetail() {
  const { id = '' } = useParams()
  const q = useAsync(() => getRecipe(id), [id])
  const x = q.data

  return (
    <div className="space-y-4">
      <Link to="/food/recipes" className="text-sm font-semibold text-brand-600 dark:text-brand-500">
        ← Recipes
      </Link>
      {q.error && <ErrorBox error={q.error} onRetry={q.reload} />}
      {q.loading && !q.data ? (
        <Spinner />
      ) : !x ? (
        <Card>
          <p>That recipe isn't in your book.</p>
        </Card>
      ) : (
        <>
          <PageTitle sub={x.summary}>{x.name}</PageTitle>
          <div className="flex flex-wrap gap-2">
            <Pill tone="brand">{CATEGORY_LABELS[x.category]}</Pill>
            {x.prep_minutes ? <Pill>{x.prep_minutes} min</Pill> : null}
            {x.tags.map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>

          {x.kcal !== null && (
            <Card>
              <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
                Per serving{x.serving_label ? ` (${x.serving_label})` : ''} · makes {Number(x.servings)}
              </p>
              <dl className="grid grid-cols-5 gap-1 text-center">
                {(
                  [
                    ['kcal', x.kcal],
                    ['protein', x.protein_g],
                    ['fat', x.fat_g],
                    ['carbs', x.carbs_g],
                    ['fiber', x.fiber_g],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                    <dd className="text-lg font-bold">
                      {r(v)}
                      {label !== 'kcal' && v !== null ? <span className="text-sm font-semibold"> g</span> : null}
                    </dd>
                    <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          <Card>
            <h2 className="mb-2 text-lg font-bold">Ingredients</h2>
            <ul className="space-y-1.5">
              {x.ingredients.map((ing, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-24 shrink-0 font-semibold">{ing.amount}</span>
                  <span>
                    {ing.item}
                    {ing.note && <span className="text-slate-600 dark:text-slate-400"> — {ing.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {x.steps.length > 0 && (
            <Card>
              <h2 className="mb-2 text-lg font-bold">Steps</h2>
              <ol className="list-decimal space-y-2 pl-5">
                {x.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </Card>
          )}

          {x.notes && (
            <Card>
              <h2 className="mb-1 text-lg font-bold">Notes</h2>
              <p className="whitespace-pre-line">{x.notes}</p>
            </Card>
          )}

          {x.source_url && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Adapted from{' '}
              <a className="underline" href={x.source_url} target="_blank" rel="noreferrer">
                {x.source_name ?? 'the original'}
              </a>
            </p>
          )}
          {!x.source_url && x.source_name && <p className="text-sm text-slate-600 dark:text-slate-400">Adapted from {x.source_name}</p>}
        </>
      )}
    </div>
  )
}

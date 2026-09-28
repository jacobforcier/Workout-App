import { Link, useNavigate, useParams } from 'react-router'
import { Card, ErrorBox, PageTitle, Pill } from '../components/ui'
import { exerciseName, getExercise } from '../content'
import VideoLink from '../components/VideoLink'
import { useApp } from '../state/AppContext'

const EQUIPMENT_LABEL: Record<string, string> = {
  kettlebell: 'Kettlebell',
  pullup_bar: 'Pull-up bar',
  dip_bars: 'Dip bars',
  bench: 'Bench or sturdy chair',
}

export default function ExerciseDetail() {
  const { id } = useParams()
  const { kidMode } = useApp()
  const navigate = useNavigate()
  const exercise = id ? getExercise(id) : undefined
  if (!exercise) return <ErrorBox error="Exercise not found." />
  if (kidMode && !exercise.kidSafe) return <ErrorBox error="This move is for grown-ups." title="Not a kids' exercise" />
  const subs = exercise.substitutions.filter((s) => !kidMode || getExercise(s)?.kidSafe)

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => navigate(-1)} className="self-start font-semibold text-brand-700 dark:text-brand-500">
        ◀ Back
      </button>
      <PageTitle>{exercise.name}</PageTitle>
      <div className="flex flex-wrap gap-2">
        <Pill>{exercise.category}</Pill>
        {exercise.equipment.length === 0 ? <Pill>No equipment</Pill> : exercise.equipment.map((e) => <Pill key={e}>{EQUIPMENT_LABEL[e] ?? e}</Pill>)}
        {exercise.kidSafe ? <Pill tone="green">Kid-safe</Pill> : <Pill>Adults</Pill>}
      </div>

      <VideoLink exerciseId={exercise.id} />

      <Card>
        <h2 className="mb-2 text-lg font-extrabold">{kidMode ? 'How to do it' : 'Steps'}</h2>
        <ol className="list-decimal space-y-2 pl-6 text-lg">
          {exercise.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-extrabold">Form cues</h2>
        <ul className="space-y-1 text-lg">
          {exercise.formCues.map((c) => (
            <li key={c}>✔︎ {c}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-extrabold">{kidMode ? 'Watch out for' : 'Common mistakes'}</h2>
        <ul className="space-y-1 text-lg">
          {exercise.commonMistakes.map((m) => (
            <li key={m}>✗ {m}</li>
          ))}
        </ul>
      </Card>

      {subs.length > 0 && (
        <Card>
          <h2 className="mb-2 text-lg font-extrabold">Substitutions</h2>
          <ul className="flex flex-wrap gap-2">
            {subs.map((s) => (
              <li key={s}>
                <Link to={`/library/exercise/${s}`} className="inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-3 font-semibold dark:bg-slate-800">
                  {exerciseName(s)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

    </div>
  )
}

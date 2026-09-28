import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, ErrorBox, PageTitle, Pill } from '../components/ui'
import { exerciseName, getWorkout, type WorkoutBlock } from '../content'
import { targetText } from '../lib/plan'
import { useApp } from '../state/AppContext'

function blockDescription(b: WorkoutBlock): string {
  switch (b.format) {
    case 'circuit':
      return `${b.rounds}${b.maxRounds && b.maxRounds > (b.rounds ?? 0) ? `–${b.maxRounds}` : ''} round${b.rounds === 1 ? '' : 's'}, one exercise after another`
    case 'emom':
      return `Every minute on the minute for ${b.minutes} minutes`
    case 'timed':
      return 'Follow the timer'
    default:
      return 'Finish all sets of each exercise before moving on'
  }
}

export default function WorkoutDetail() {
  const { id } = useParams()
  const { kidMode, activeAthlete } = useApp()
  const navigate = useNavigate()
  const workout = id ? getWorkout(id) : undefined
  if (!workout) return <ErrorBox error="Workout not found." />
  if (kidMode && !workout.kidSafe) return <ErrorBox error="This workout is for grown-ups." title="Not a kids' workout" />

  const canStart = activeAthlete && (!kidMode || workout.kidSafe)

  return (
    <div className="flex flex-col gap-4">
      <Link to="/library" className="font-semibold text-brand-700 dark:text-brand-500">
        ◀ Library
      </Link>
      <PageTitle sub={workout.summary}>{workout.name}</PageTitle>
      <div className="flex flex-wrap gap-2">
        <Pill>~{workout.estimatedMinutes} min</Pill>
        <Pill>{workout.level}</Pill>
        <Pill tone="blue">{workout.recommendedFrequency}</Pill>
        {workout.kidSafe && <Pill tone="green">Kid-safe</Pill>}
      </div>

      {workout.notes.length > 0 && (
        <Card>
          <ul className="list-disc space-y-1 pl-5">
            {workout.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Card>
      )}

      {[...workout.warmup.map((b) => ['Warm-up', b] as const), ...workout.main.map((b) => ['Main', b] as const)].map(([section, block], i) => (
        <Card key={i}>
          <p className="text-sm font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">{section}</p>
          <h2 className="text-lg font-extrabold">{block.title}</h2>
          <p className="text-slate-600 dark:text-slate-300">{blockDescription(block)}</p>
          <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
            {block.items.map((item, j) => (
              <li key={j} className="flex items-center justify-between gap-2 py-2">
                <Link to={`/library/exercise/${item.exerciseId}`} className="font-semibold underline decoration-slate-300 underline-offset-4">
                  {exerciseName(item.exerciseId)}
                </Link>
                <span className="text-right text-slate-700 dark:text-slate-300">
                  {item.sets ? `${item.sets}${item.maxSets ? `–${item.maxSets}` : ''} × ` : ''}
                  {targetText(item)}
                  {item.perSide ? (item.sideNames ? ' each way' : ' / side') : ''}
                  {item.alternateSides ? ', alternating' : ''}
                </span>
              </li>
            ))}
          </ul>
          {(block.restBetweenRounds ?? block.items.find((it) => it.rest)?.rest) && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Rest: {(block.restBetweenRounds ?? block.items.find((it) => it.rest)?.rest)?.guidance}
            </p>
          )}
        </Card>
      ))}

      {canStart && (
        <Button size="xl" block onClick={() => navigate(`/session/${workout.id}`)}>
          ▶ Start this workout
        </Button>
      )}
    </div>
  )
}

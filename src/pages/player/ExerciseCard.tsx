import { Pill } from '../../components/ui'
import { exerciseName, getExercise, type WorkoutItem } from '../../content'
import { targetText } from '../../lib/plan'

/** Full exercise view for single-exercise steps (sets, timed, EMOM). */
export default function ExerciseCard({
  pills,
  item,
  sideLabel,
  exerciseId,
  options,
  onSwap,
  lastTime,
  kidMode,
  suffix,
}: {
  pills: string[]
  item: WorkoutItem
  sideLabel: string | null
  exerciseId: string
  options: string[]
  onSwap: (id: string) => void
  lastTime: string | null
  kidMode: boolean
  /** Extra text after the target, e.g. "every minute". */
  suffix?: string
}) {
  const exercise = getExercise(exerciseId)
  const substituted = exerciseId !== item.exerciseId
  const cues = exercise?.formCues ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {pills.map((p, i) => (
          <Pill key={p} tone={i === 0 ? 'brand' : 'slate'}>
            {p}
          </Pill>
        ))}
      </div>

      <div>
        <h2 className="text-3xl leading-tight font-black kid:text-4xl">{exercise?.name ?? exerciseId}</h2>
        {substituted && <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">In place of {exerciseName(item.exerciseId)}</p>}
        <p className="mt-1 text-2xl font-bold text-brand-700 kid:text-3xl dark:text-brand-500">
          {targetText(item)}
          {sideLabel && <span className="text-slate-700 dark:text-slate-200"> · {sideLabel}</span>}
          {suffix && <span className="text-slate-700 dark:text-slate-200"> {suffix}</span>}
        </p>
        {lastTime && <LastTime text={lastTime} />}
        {item.note && <p className="mt-1 text-slate-700 dark:text-slate-300">{item.note}</p>}
      </div>

      {cues.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-2xl bg-slate-100 p-3 text-lg dark:bg-slate-800">
          {cues.slice(0, kidMode ? 2 : 4).map((c) => (
            <li key={c}>✔︎ {c}</li>
          ))}
        </ul>
      )}

      {exercise && <HowTo exerciseId={exercise.id} kidMode={kidMode} />}

      {options.length > 1 && <SwapSelect item={item} exerciseId={exerciseId} options={options} onSwap={onSwap} />}
    </div>
  )
}

export function LastTime({ text }: { text: string }) {
  return (
    <p className="mt-1 text-base font-semibold text-slate-600 dark:text-slate-300">
      <span aria-hidden>↺ </span>Last time: <span className="tabular text-slate-900 dark:text-slate-100">{text}</span>
    </p>
  )
}

export function HowTo({ exerciseId, kidMode }: { exerciseId: string; kidMode: boolean }) {
  const exercise = getExercise(exerciseId)
  if (!exercise) return null
  return (
    <details className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
      <summary className="min-h-10 cursor-pointer text-lg font-bold">{kidMode ? 'How do I do it?' : 'How to'}</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        {exercise.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {exercise.commonMistakes.length > 0 && (
        <>
          <h3 className="mt-3 font-bold">{kidMode ? 'Watch out for' : 'Common mistakes'}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-6">
            {exercise.commonMistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      )}
    </details>
  )
}

export function SwapSelect({ item, exerciseId, options, onSwap }: { item: WorkoutItem; exerciseId: string; options: string[]; onSwap: (id: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Swap:</span>
      <select
        className="min-h-11 flex-1 rounded-xl border-2 border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900"
        value={exerciseId}
        onChange={(e) => onSwap(e.target.value)}
      >
        {options.map((id) => (
          <option key={id} value={id}>
            {exerciseName(id)}
            {id === item.exerciseId ? ' (prescribed)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

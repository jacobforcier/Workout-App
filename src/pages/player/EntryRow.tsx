import { useState } from 'react'
import { Stepper } from '../../components/ui'
import { exerciseName, getExercise, isLoaded } from '../../content'
import { targetText, type Entry, type EntryLog } from '../../lib/plan'
import BellPicker from './BellPicker'
import { HowTo, SwapSelect } from './ExerciseCard'
import HoldTimer from './HoldTimer'
import VideoLink from '../../components/VideoLink'

/**
 * One exercise inside a round or the warm-up checklist. Collapsed it shows the
 * target (and last time); tap to adjust numbers, swap, or read the cues.
 */
export default function EntryRow({
  entry,
  log,
  exerciseId,
  options,
  bells,
  lastTime,
  kidMode,
  editable = true,
  onChange,
  onSwap,
}: {
  entry: Entry
  log: EntryLog
  exerciseId: string
  options: string[]
  bells: number[]
  lastTime: string | null
  kidMode: boolean
  editable?: boolean
  onChange: (patch: Partial<EntryLog>) => void
  onSwap: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { item } = entry
  const changed = (item.reps !== undefined && log.reps !== item.reps) || (item.seconds !== undefined && log.seconds !== item.seconds)
  const loaded = isLoaded(exerciseId)

  return (
    <li className="rounded-2xl border-2 border-slate-200 dark:border-slate-700">
      <button type="button" className="flex min-h-16 w-full items-center gap-3 p-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="flex-1">
          <span className="block text-lg leading-tight font-bold kid:text-xl">{getExercise(exerciseId)?.name ?? exerciseId}</span>
          {exerciseId !== item.exerciseId && <span className="block text-xs text-slate-500">in place of {exerciseName(item.exerciseId)}</span>}
          {lastTime && <span className="tabular block text-sm text-slate-600 dark:text-slate-400">Last: {lastTime}</span>}
        </span>
        <span className="tabular text-right font-bold text-brand-700 dark:text-brand-500">
          {item.reps !== undefined ? `${log.reps ?? 0} ${item.unit ?? 'reps'}` : targetText({ ...item, seconds: log.seconds ?? item.seconds })}
          {entry.sideLabel && <span className="block text-xs font-semibold text-slate-500">{entry.sideLabel}</span>}
          {loaded && log.weight ? <span className="block text-xs font-semibold text-slate-500">{log.weight} lb</span> : null}
          {changed && <span className="block text-xs text-amber-700 dark:text-amber-400">changed</span>}
        </span>
        <span aria-hidden className="text-slate-400">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-slate-200 p-3 dark:border-slate-700">
          {(getExercise(exerciseId)?.formCues ?? []).slice(0, 3).map((c) => (
            <p key={c}>✔︎ {c}</p>
          ))}
          {editable && item.seconds !== undefined && (
            <>
              <HoldTimer targetSec={item.seconds} onElapsed={(sec) => onChange({ seconds: sec })} />
              <Stepper label="Seconds done" value={log.seconds} step={5} onChange={(v) => onChange({ seconds: v })} />
            </>
          )}
          {editable && item.reps !== undefined && (
            <Stepper
              label={`${item.unit === 'steps' ? 'Steps' : 'Reps'} done${entry.side === 'each' ? ' (each side)' : ''}`}
              value={log.reps}
              onChange={(v) => onChange({ reps: v })}
            />
          )}
          {editable && loaded && (
            <div>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Weight</span>
              <BellPicker bells={bells} value={log.weight ?? 0} onChange={(v) => onChange({ weight: v === 0 ? null : v })} allowNone />
            </div>
          )}
          {options.length > 1 && <SwapSelect item={item} exerciseId={exerciseId} options={options} onSwap={onSwap} />}
          <VideoLink exerciseId={exerciseId} compact />
          <HowTo exerciseId={exerciseId} kidMode={kidMode} />
        </div>
      )}
    </li>
  )
}

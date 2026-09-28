import { useEffect, useRef, useState } from 'react'
import { Button, Stepper } from '../../components/ui'
import { useNow } from '../../hooks/useNow'
import { beep } from '../../lib/beep'
import { formatDuration } from '../../lib/dates'

/**
 * EMOM interval timer: beeps at the top of every minute. The athlete logs reps
 * per minute (pre-filled with the target).
 */
export default function EmomPanel({
  minutes,
  targetReps,
  reps,
  onRepsChange,
  onMinutesReached,
  kidMode,
}: {
  minutes: number
  targetReps: number
  reps: number[]
  onRepsChange: (minuteIndex: number, reps: number) => void
  /** How many minutes have started (1…minutes). */
  onMinutesReached: (n: number) => void
  kidMode: boolean
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)
  const running = startedAt !== null && stoppedAt === null
  const now = useNow(running)
  const totalSec = minutes * 60
  const elapsed = startedAt === null ? 0 : Math.min(totalSec, ((stoppedAt ?? now) - startedAt) / 1000)
  const finished = elapsed >= totalSec
  const minuteIndex = Math.min(minutes - 1, Math.floor(elapsed / 60))
  const secLeftInMinute = finished ? 0 : 60 - (elapsed % 60)
  const lastBeep = useRef(-1)
  const [selected, setSelected] = useState(0)
  const reportRef = useRef(onMinutesReached)
  reportRef.current = onMinutesReached

  useEffect(() => {
    if (!running) return
    if (finished) {
      setStoppedAt(Date.now())
      beep(990, 250, 3)
      reportRef.current(minutes)
      return
    }
    if (minuteIndex > lastBeep.current) {
      lastBeep.current = minuteIndex
      beep(880, 250, 2)
      reportRef.current(minuteIndex + 1)
      setSelected(minuteIndex)
    }
  }, [running, finished, minuteIndex, minutes])

  const started = startedAt !== null
  const reached = started ? (finished ? minutes : minuteIndex + 1) : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-slate-100 p-4 text-center dark:bg-slate-800">
        {!started ? (
          <>
            <p className="text-lg">
              {kidMode ? 'Do' : 'At every beep, do'} <strong>{targetReps} reps</strong>, then rest until the next beep.
            </p>
            <Button size="xl" block onClick={() => setStartedAt(Date.now())}>
              ▶ Start {minutes}-minute EMOM
            </Button>
          </>
        ) : (
          <>
            <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{finished ? 'All done! 🎉' : `Minute ${minuteIndex + 1} of ${minutes}`}</p>
            <p className="tabular text-7xl font-black" aria-live="off">
              {formatDuration(secLeftInMinute)}
            </p>
            <p className="tabular text-sm text-slate-600 dark:text-slate-300">
              {formatDuration(elapsed)} / {formatDuration(totalSec)}
            </p>
            {running && (
              <Button variant="ghost" onClick={() => setStoppedAt(Date.now())}>
                ■ Stop early
              </Button>
            )}
          </>
        )}
      </div>

      {started && (
        <>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: reached }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                className={`tabular min-h-14 rounded-xl border-2 font-bold ${selected === i ? 'border-brand-600 bg-brand-50 dark:bg-brand-700/30' : 'border-slate-300 dark:border-slate-700'} ${reps[i] < targetReps ? 'text-red-700 dark:text-red-400' : ''}`}
              >
                <span className="block text-xs font-semibold text-slate-500">min {i + 1}</span>
                {reps[i]}
              </button>
            ))}
          </div>
          {selected < reached && (
            <Stepper label={`Reps in minute ${selected + 1}`} value={reps[selected]} onChange={(v) => onRepsChange(selected, v)} />
          )}
        </>
      )}
    </div>
  )
}

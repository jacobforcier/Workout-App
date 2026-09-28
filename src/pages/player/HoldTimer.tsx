import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { useNow } from '../../hooks/useNow'
import { beep } from '../../lib/beep'
import { formatDuration } from '../../lib/dates'

/** Countdown for holds, carries-by-time, stretches, and walks. Reports elapsed seconds. */
export default function HoldTimer({ targetSec, onElapsed }: { targetSec: number; onElapsed: (sec: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [banked, setBanked] = useState(0)
  const running = startedAt !== null
  const now = useNow(running)
  const elapsed = banked + (running ? (now - startedAt) / 1000 : 0)
  const left = Math.max(0, targetSec - elapsed)
  const done = useRef(false)

  useEffect(() => {
    if (elapsed > 0) onElapsed(Math.round(elapsed))
    if (left === 0 && running && !done.current) {
      done.current = true
      beep(990, 220, 3)
    }
    // onElapsed is a setter from the parent; only elapsed matters here.
  }, [Math.round(elapsed)])

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
      <p className="tabular text-6xl font-black" aria-live="polite">
        {formatDuration(left)}
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-300">{left === 0 ? `Done! ${formatDuration(elapsed)} total` : `of ${formatDuration(targetSec)}`}</p>
      <div className="grid w-full grid-cols-2 gap-3">
        {running ? (
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              setBanked(elapsed)
              setStartedAt(null)
            }}
          >
            ❚❚ Pause
          </Button>
        ) : (
          <Button size="lg" onClick={() => setStartedAt(Date.now())}>
            ▶ {elapsed > 0 ? 'Resume' : 'Start'}
          </Button>
        )}
        <Button
          size="lg"
          variant="ghost"
          onClick={() => {
            setStartedAt(null)
            setBanked(0)
            done.current = false
          }}
        >
          ↺ Reset
        </Button>
      </div>
    </div>
  )
}

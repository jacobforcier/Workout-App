import { useEffect, useRef } from 'react'
import { Button } from '../../components/ui'
import { useNow } from '../../hooks/useNow'
import { beep } from '../../lib/beep'
import { formatDuration } from '../../lib/dates'

export interface RestState {
  startedAt: number
  totalSec: number
}

export default function RestOverlay({
  rest,
  guidance,
  nextLabel,
  onAdjust,
  onDone,
  kidMode,
}: {
  rest: RestState
  guidance: string | null
  nextLabel: string
  onAdjust: (deltaSec: number) => void
  onDone: () => void
  kidMode: boolean
}) {
  const now = useNow(true)
  const left = Math.max(0, rest.totalSec - (now - rest.startedAt) / 1000)
  const warned = useRef(false)
  const finished = useRef(false)

  useEffect(() => {
    if (left <= 3.2 && left > 0 && !warned.current) {
      warned.current = true
      beep(660, 120)
    }
    if (left === 0 && !finished.current) {
      finished.current = true
      beep(990, 220, 3)
    }
  }, [left])

  const pct = rest.totalSec > 0 ? (left / rest.totalSec) * 100 : 0

  return (
    <div role="dialog" aria-modal="true" aria-label="Rest" className="fixed inset-0 z-40 flex flex-col bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-2xl font-bold text-slate-300">{left === 0 ? (kidMode ? 'Go! 🚀' : 'Rest over') : kidMode ? 'Rest and breathe 😮‍💨' : 'Rest'}</p>
        <p className="tabular text-8xl font-black" aria-live="polite">
          {formatDuration(left)}
        </p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-brand-500 transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        {guidance && !kidMode && <p className="text-slate-300">{guidance}</p>}
        <p className="text-lg text-slate-200">
          Next: <strong>{nextLabel}</strong>
        </p>
        <div className="grid w-full grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={() => onAdjust(-15)}>
            −15 s
          </Button>
          <Button variant="secondary" size="lg" onClick={() => onAdjust(15)}>
            +15 s
          </Button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button size="xl" block onClick={onDone}>
          {left === 0 ? 'Next ▶' : 'Skip rest ▶'}
        </Button>
      </div>
    </div>
  )
}

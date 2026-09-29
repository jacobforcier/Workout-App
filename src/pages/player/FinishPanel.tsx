import { useMemo, useState } from 'react'
import Suggestions from '../../components/Suggestions'
import { Button, Card, ErrorBox, Field, inputClass, Toggle } from '../../components/ui'
import type { Workout } from '../../content'
import { formatDuration, today } from '../../lib/dates'
import { suggestProgressions, type SessionLike } from '../../lib/progression'
import type { Athlete, SetLogInput } from '../../lib/types'

export interface FinishMeta {
  rpe: number
  feel: number
  trainedFasted: boolean | null
  notes: string
  updateBell: boolean
}

const FEELS = [
  { v: 1, icon: '😫', label: 'Awful' },
  { v: 2, icon: '😕', label: 'Meh' },
  { v: 3, icon: '🙂', label: 'OK' },
  { v: 4, icon: '😀', label: 'Good' },
  { v: 5, icon: '🤩', label: 'Great' },
]

/** Kid mode uses four simple "how hard" choices mapped onto RPE. */
const KID_EFFORT = [
  { rpe: 3, icon: '😀', label: 'Easy' },
  { rpe: 5, icon: '🙂', label: 'OK' },
  { rpe: 7, icon: '😅', label: 'Hard' },
  { rpe: 9, icon: '🥵', label: 'Super hard' },
]

export default function FinishPanel({
  workout,
  athlete,
  kidMode,
  logs,
  durationSec,
  sessionBell,
  completed,
  previous,
  saving,
  error,
  onSave,
  onBack,
}: {
  workout: Workout
  athlete: Athlete
  kidMode: boolean
  logs: SetLogInput[]
  durationSec: number
  sessionBell: number
  completed: boolean
  /** Most recent earlier session of this workout, if any (for the progression preview). */
  previous: SessionLike | null
  saving: boolean
  error: Error | null
  onSave: (meta: FinishMeta) => void
  onBack: () => void
}) {
  const [rpe, setRpe] = useState<number | null>(null)
  const [feel, setFeel] = useState<number | null>(null)
  const [fasted, setFasted] = useState(false)
  const [recordFasted, setRecordFasted] = useState(false)
  const [notes, setNotes] = useState('')
  const bellChanged = sessionBell !== athlete.current_bell_lb
  const [updateBell, setUpdateBell] = useState(bellChanged)

  const totalReps = logs.reduce((n, l) => n + (l.reps ?? 0), 0)

  const preview = useMemo(() => {
    if (rpe === null || !previous) return []
    const current: SessionLike = { id: 'current', performed_on: today(), rpe, bell_lb: sessionBell, completed, set_logs: logs }
    return suggestProgressions({
      workout,
      sessions: [previous, current],
      currentBellLb: athlete.current_bell_lb,
      availableBellsLb: athlete.available_bells_lb,
    })
  }, [rpe, previous, completed, sessionBell, logs, workout, athlete.current_bell_lb, athlete.available_bells_lb])

  const canSave = rpe !== null && feel !== null && !saving

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <div className="text-6xl" aria-hidden>
          {completed ? '🎉' : '👍'}
        </div>
        <h1 className="mt-2 text-3xl font-black">{completed ? (kidMode ? 'You did it!' : 'Workout complete') : 'Finishing early'}</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          {workout.name} · {formatDuration(durationSec)} · {logs.length} sets · {totalReps} reps
        </p>
        {!completed && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Saved as a partial session. It still counts toward your week.</p>}
      </div>

      <Card>
        <h2 className="mb-2 text-lg font-extrabold">{kidMode ? 'How hard was that?' : 'How hard was it? (RPE)'}</h2>
        {kidMode ? (
          <div className="grid grid-cols-2 gap-2">
            {KID_EFFORT.map((e) => (
              <Button key={e.rpe} size="xl" variant={rpe === e.rpe ? 'primary' : 'secondary'} aria-pressed={rpe === e.rpe} onClick={() => setRpe(e.rpe)}>
                <span aria-hidden>{e.icon}</span> {e.label}
              </Button>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Button key={n} size="lg" variant={rpe === n ? 'primary' : 'secondary'} aria-pressed={rpe === n} onClick={() => setRpe(n)}>
                  {n}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">1 = very easy · 7 = hard, 3 reps left · 10 = max effort</p>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-extrabold">{kidMode ? 'How do you feel?' : 'How do you feel?'}</h2>
        <div className="grid grid-cols-5 gap-2">
          {FEELS.map((f) => (
            <button
              key={f.v}
              type="button"
              aria-pressed={feel === f.v}
              onClick={() => setFeel(f.v)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 ${feel === f.v ? 'border-brand-600 bg-brand-50 dark:bg-brand-700/30' : 'border-slate-200 dark:border-slate-700'}`}
            >
              <span className="text-3xl" aria-hidden>
                {f.icon}
              </span>
              <span className="text-xs font-semibold">{f.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {!kidMode && (
        <Card className="flex flex-col gap-3">
          <Toggle label="Record fasted status" checked={recordFasted} onChange={setRecordFasted} hint="Optional" />
          {recordFasted && <Toggle label="Trained fasted" checked={fasted} onChange={setFasted} />}
          <Field label="Notes (optional)">
            <textarea className={`${inputClass} min-h-24 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </Card>
      )}

      {bellChanged && (
        <Card>
          <Toggle
            label={`Make ${sessionBell} lb ${athlete.name}'s bell`}
            hint={`Currently ${athlete.current_bell_lb} lb`}
            checked={updateBell}
            onChange={setUpdateBell}
          />
        </Card>
      )}

      {preview.length > 0 && <Suggestions suggestions={preview} kidMode={kidMode} />}

      {error && <ErrorBox error={error} title="Couldn't save" />}

      <Button
        size="xl"
        block
        disabled={!canSave}
        onClick={() =>
          rpe !== null &&
          feel !== null &&
          onSave({ rpe, feel, trainedFasted: !kidMode && recordFasted ? fasted : null, notes: notes.trim(), updateBell: bellChanged && updateBell })
        }
      >
        {saving ? 'Saving…' : error ? 'Try saving again' : kidMode ? 'Save ⭐' : 'Save session'}
      </Button>
      {!canSave && !saving && <p className="-mt-2 text-center text-sm text-slate-600 dark:text-slate-400">Pick how hard it was and how you feel to save.</p>}
      <Button variant="ghost" block onClick={onBack} disabled={saving}>
        ◀ Back to workout
      </Button>
    </div>
  )
}

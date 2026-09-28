import type { Suggestion } from '../lib/progression'

export default function Suggestions({ suggestions, kidMode }: { suggestions: Suggestion[]; kidMode: boolean }) {
  const back = suggestions.filter((s) => s.kind === 'step_back')
  const up = suggestions.filter((s) => s.kind !== 'step_back')
  return (
    <>
      {back.length > 0 && (
        <div className="rounded-2xl border-2 border-sky-400 bg-sky-50 p-4 text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-50">
          <p className="font-extrabold">{kidMode ? '🙂 Let’s make it a bit easier' : '↘ Take a small step back (suggested)'}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {back.map((s) => (
              <li key={s.unitKey}>{s.message}</li>
            ))}
          </ul>
          {!kidMode && <p className="mt-2 text-sm opacity-80">Backing off for a session or two keeps form clean and progress moving. It isn't a setback.</p>}
        </div>
      )}
      {up.length > 0 && (
        <div className="rounded-2xl border-2 border-green-400 bg-green-50 p-4 text-green-950 dark:border-green-700 dark:bg-green-950/50 dark:text-green-50">
          <p className="font-extrabold">{kidMode ? '💪 You are getting stronger!' : '📈 Ready to progress (optional)'}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {up.map((s) => (
              <li key={s.unitKey}>{s.message}</li>
            ))}
          </ul>
          {!kidMode && <p className="mt-2 text-sm opacity-80">You hit every target with RPE ≤ 7 twice in a row. Only progress if form feels solid.</p>}
        </div>
      )}
    </>
  )
}

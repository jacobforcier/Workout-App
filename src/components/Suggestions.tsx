import type { Suggestion } from '../lib/progression'

export default function Suggestions({ suggestions, kidMode }: { suggestions: Suggestion[]; kidMode: boolean }) {
  if (suggestions.length === 0) return null
  return (
    <div className="rounded-2xl border-2 border-green-400 bg-green-50 p-4 text-green-950 dark:border-green-700 dark:bg-green-950/50 dark:text-green-50">
      <p className="font-extrabold">{kidMode ? '💪 You are getting stronger!' : '📈 Ready to progress (optional)'}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {suggestions.map((s) => (
          <li key={s.unitKey}>{s.message}</li>
        ))}
      </ul>
      {!kidMode && <p className="mt-2 text-sm opacity-80">You hit every target with RPE ≤ 7 twice in a row. Only progress if form feels solid.</p>}
    </div>
  )
}

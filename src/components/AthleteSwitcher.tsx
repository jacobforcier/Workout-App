import { useApp } from '../state/AppContext'

/** Profile switcher shown on every screen. */
export default function AthleteSwitcher({ compact = false }: { compact?: boolean }) {
  const { athletes, activeAthlete, setActiveAthleteId } = useApp()
  if (athletes.length === 0) return null
  return (
    <label className="flex items-center gap-2">
      <span className={compact ? 'sr-only' : 'text-sm text-slate-600 dark:text-slate-400'}>Athlete</span>
      <select
        className="min-h-11 max-w-44 rounded-xl border-2 border-slate-300 bg-white px-2 font-semibold dark:border-slate-700 dark:bg-slate-900"
        value={activeAthlete?.id ?? ''}
        onChange={(e) => setActiveAthleteId(e.target.value)}
      >
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.kind === 'kid' ? '🧒 ' : ''}
            {a.name}
          </option>
        ))}
      </select>
    </label>
  )
}

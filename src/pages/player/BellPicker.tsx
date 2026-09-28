export default function BellPicker({ bells, value, onChange, allowNone }: { bells: number[]; value: number; onChange: (v: number) => void; allowNone?: boolean }) {
  const options = allowNone ? [0, ...bells] : bells
  return (
    <div className="mt-1 flex gap-2 overflow-x-auto pb-1" role="radiogroup">
      {options.map((b) => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={value === b}
          onClick={() => onChange(b)}
          className={`tabular min-h-14 min-w-16 shrink-0 rounded-2xl border-2 px-3 text-lg font-bold ${value === b ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
        >
          {b === 0 ? 'None' : `${b} lb`}
        </button>
      ))}
    </div>
  )
}

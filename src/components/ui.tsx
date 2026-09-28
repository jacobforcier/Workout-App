import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { OFFLINE_MESSAGE } from '../lib/api'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg' | 'xl'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 disabled:bg-slate-400 dark:disabled:bg-slate-700',
  secondary:
    'bg-slate-100 text-slate-950 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700 disabled:opacity-50',
  ghost: 'bg-transparent text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-700 disabled:opacity-50',
}

const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 text-base kid:min-h-14 kid:text-lg',
  lg: 'min-h-14 px-5 text-lg kid:min-h-16 kid:text-xl',
  xl: 'min-h-16 px-6 text-xl kid:min-h-20 kid:text-2xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${block ? 'w-full' : ''} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</div>
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-slate-600 dark:text-slate-300">
      <span className="size-6 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-500" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ error, onRetry, title = 'Something went wrong' }: { error: Error | string; onRetry?: () => void; title?: string }) {
  const message = typeof error === 'string' ? error : error.message
  const offline = message === OFFLINE_MESSAGE
  return (
    <div role="alert" className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100">
      <p className="font-bold">{offline ? 'No connection' : title}</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-extrabold tracking-tight kid:text-3xl">{children}</h1>
      {sub && <p className="mt-1 text-slate-600 dark:text-slate-300">{sub}</p>}
    </div>
  )
}

export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
}: {
  label: string
  value: number | null
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
}) {
  const v = value ?? 0
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex items-stretch gap-2">
        <Button variant="secondary" size="xl" aria-label={`Less ${label}`} className="w-16 text-3xl" onClick={() => onChange(Math.max(min, v - step))}>
          −
        </Button>
        <label className="flex min-w-0 flex-1 items-center justify-center rounded-2xl border-2 border-slate-300 dark:border-slate-700">
          <span className="sr-only">{label}</span>
          <input
            inputMode="numeric"
            className="tabular w-full min-w-0 bg-transparent text-center text-3xl font-bold outline-none"
            value={value ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^\d.]/g, ''))
              if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
            }}
          />
          {suffix && <span className="pr-3 text-slate-500">{suffix}</span>}
        </label>
        <Button variant="secondary" size="xl" aria-label={`More ${label}`} className="w-16 text-3xl" onClick={() => onChange(Math.min(max, v + step))}>
          +
        </Button>
      </div>
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-sm text-slate-600 dark:text-slate-400">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-8 w-14 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:outline-3 peer-focus-visible:outline-brand-500 dark:bg-slate-700 after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-6" />
    </label>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="text-sm text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-slate-950 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50'

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'brand' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    green: 'bg-green-100 text-green-900 dark:bg-green-900/60 dark:text-green-100',
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100',
    blue: 'bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${tones[tone]}`}>{children}</span>
}

export function SuperviseBanner() {
  return (
    <div role="note" className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 text-lg font-bold text-amber-950 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-100">
      👀 A grown-up should watch while you train.
    </div>
  )
}

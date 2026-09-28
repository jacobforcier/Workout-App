import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorBox, Field, inputClass, PageTitle, Pill, Spinner, Toggle } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { createAthlete, createInvite, deleteAthlete, deleteInvite, listInvites, listMembers, updateAthlete } from '../lib/api'
import { getWorkout, workouts } from '../content'
import { defaultWeeklyPlan, PLAN_DAYS } from '../lib/rotation'
import type { Athlete, AthleteInput } from '../lib/types'
import { useApp } from '../state/AppContext'

/** Common kettlebell sizes in lb (≈ 4–48 kg). */
const COMMON_BELLS = [9, 13, 18, 26, 35, 44, 53, 62, 70, 80, 88, 97, 106]

const blankAthlete = (kind: Athlete['kind'] = 'adult'): AthleteInput => ({
  name: '',
  kind,
  current_bell_lb: kind === 'kid' ? 9 : 26,
  available_bells_lb: kind === 'kid' ? [9, 13] : [18, 26, 35],
  has_pullup_bar: false,
  has_dip_bars: false,
  custom_rotation: null,
})

export default function Family() {
  const { membership, athletes, athletesError, athletesLoading, reloadAthletes, session, signOut, kidMode } = useApp()
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  if (!membership) return <Spinner />
  const isOwner = membership.role === 'owner'

  return (
    <div className="flex flex-col gap-6">
      <PageTitle sub={membership.household.name}>Family</PageTitle>

      {kidMode && (
        <p className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">Switch to a grown-up's profile (top right) to change settings.</p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Athletes</h2>
          {!kidMode && editing !== 'new' && (
            <Button variant="secondary" onClick={() => setEditing('new')}>
              ＋ Add
            </Button>
          )}
        </div>

        {athletesError && <ErrorBox error={athletesError} onRetry={() => void reloadAthletes()} />}
        {athletesLoading && athletes.length === 0 && <Spinner />}

        {editing === 'new' && (
          <AthleteForm
            initial={blankAthlete()}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              await createAthlete(membership.household_id, input)
              await reloadAthletes()
              setEditing(null)
            }}
          />
        )}

        {athletes.length === 0 && !athletesLoading && !athletesError && editing !== 'new' && (
          <Card>
            <p>No athletes yet. Add yourself, your partner, and the kids.</p>
          </Card>
        )}

        {athletes.map((a) =>
          editing === a.id ? (
            <AthleteForm
              key={a.id}
              initial={a}
              onCancel={() => setEditing(null)}
              onSave={async (input) => {
                await updateAthlete(a.id, input, a.custom_rotation != null && input.custom_rotation === null)
                await reloadAthletes()
                setEditing(null)
              }}
              onDelete={async () => {
                await deleteAthlete(a.id)
                await reloadAthletes()
                setEditing(null)
              }}
            />
          ) : (
            <Card key={a.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold">
                  {a.kind === 'kid' ? '🧒 ' : ''}
                  {a.name}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  🔔 {a.current_bell_lb} lb · bells: {a.available_bells_lb.length ? a.available_bells_lb.join(', ') : 'none set'}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Pill>{a.kind}</Pill>
                  {a.has_pullup_bar && <Pill tone="blue">Pull-up bar</Pill>}
                  {a.has_dip_bars && <Pill tone="blue">Dip bars</Pill>}
                  {a.custom_rotation && <Pill tone="brand">Own weekly plan</Pill>}
                </div>
              </div>
              {!kidMode && (
                <Button variant="secondary" onClick={() => setEditing(a.id)}>
                  Edit
                </Button>
              )}
            </Card>
          ),
        )}
      </section>

      {!kidMode && <Household isOwner={isOwner} householdId={membership.household_id} userId={session?.user.id ?? ''} />}

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-extrabold">Account</h2>
        <p className="text-slate-600 dark:text-slate-300">Signed in as {session?.user.email}</p>
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </section>
    </div>
  )
}

function AthleteForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: AthleteInput
  onSave: (input: AthleteInput) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState<AthleteInput>({
    name: initial.name,
    kind: initial.kind,
    current_bell_lb: initial.current_bell_lb,
    available_bells_lb: [...initial.available_bells_lb],
    has_pullup_bar: initial.has_pullup_bar,
    has_dip_bars: initial.has_dip_bars,
    custom_rotation: initial.custom_rotation ? [...initial.custom_rotation] : null,
  })
  const [customBell, setCustomBell] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const set = <K extends keyof AthleteInput>(k: K, v: AthleteInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const bellChoices = [...new Set([...COMMON_BELLS, ...form.available_bells_lb])].sort((a, b) => a - b)

  const toggleBell = (b: number) => {
    const has = form.available_bells_lb.includes(b)
    const next = has ? form.available_bells_lb.filter((x) => x !== b) : [...form.available_bells_lb, b].sort((x, y) => x - y)
    setForm((f) => ({ ...f, available_bells_lb: next, current_bell_lb: !has && next.length === 1 ? b : f.current_bell_lb }))
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e as Error)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const available = form.available_bells_lb.includes(form.current_bell_lb)
      ? form.available_bells_lb
      : [...form.available_bells_lb, form.current_bell_lb].sort((a, b) => a - b)
    void run(() => onSave({ ...form, name: form.name.trim(), available_bells_lb: available }))
  }

  return (
    <Card className="border-brand-500">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Name">
          <input className={inputClass} required maxLength={60} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type">
          {(['adult', 'kid'] as const).map((k) => (
            <Button key={k} variant={form.kind === k ? 'primary' : 'secondary'} aria-checked={form.kind === k} role="radio" onClick={() => setForm((f) => ({ ...f, kind: k, custom_rotation: f.custom_rotation ? defaultWeeklyPlan({ ...f, kind: k }) : null }))}>
              {k === 'adult' ? 'Adult' : 'Kid'}
            </Button>
          ))}
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bells you own (lb)</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {bellChoices.map((b) => {
              const on = form.available_bells_lb.includes(b)
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleBell(b)}
                  className={`tabular min-h-11 min-w-14 rounded-xl border-2 px-2 font-bold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                >
                  {b}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="Other size (lb)"
              value={customBell}
              onChange={(e) => setCustomBell(e.target.value.replace(/\D/g, ''))}
            />
            <Button
              variant="secondary"
              disabled={!customBell}
              onClick={() => {
                const n = Number(customBell)
                if (n > 0 && !form.available_bells_lb.includes(n)) toggleBell(n)
                setCustomBell('')
              }}
            >
              Add
            </Button>
          </div>
        </div>

        <Field label="Current working bell">
          <select className={inputClass} value={form.current_bell_lb} onChange={(e) => set('current_bell_lb', Number(e.target.value))}>
            {[...new Set([...form.available_bells_lb, form.current_bell_lb])]
              .sort((a, b) => a - b)
              .map((b) => (
                <option key={b} value={b}>
                  {b} lb
                </option>
              ))}
          </select>
        </Field>

        <Toggle label="Has a pull-up bar" checked={form.has_pullup_bar} onChange={(v) => set('has_pullup_bar', v)} />
        <Toggle label="Has dip bars" checked={form.has_dip_bars} onChange={(v) => set('has_dip_bars', v)} />

        <WeeklyPlanEditor form={form} onChange={(plan) => set('custom_rotation', plan)} />

        {error && <ErrorBox error={error} title="Couldn't save" />}

        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" size="lg" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
        {onDelete && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete ${initial.name} and all of their sessions? This can't be undone.`)) void run(onDelete)
            }}
          >
            Delete athlete
          </Button>
        )}
      </form>
    </Card>
  )
}

function Household({ isOwner, householdId, userId }: { isOwner: boolean; householdId: string; userId: string }) {
  const members = useAsync(() => listMembers(householdId), [householdId])
  const invites = useAsync(() => listInvites(householdId), [householdId])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createInvite(householdId, email, userId)
      setEmail('')
      invites.reload()
    } catch (err) {
      setError(err as Error)
    } finally {
      setBusy(false)
    }
  }

  const pending = (invites.data ?? []).filter((i) => !i.accepted_at)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold">Household</h2>
      {members.error ? (
        <ErrorBox error={members.error} onRetry={members.reload} />
      ) : members.loading ? (
        <Spinner />
      ) : (
        <p className="text-slate-700 dark:text-slate-300">
          {members.data?.length ?? 0} adult login{members.data?.length === 1 ? '' : 's'} · you are {isOwner ? 'the owner' : 'an adult member'}
        </p>
      )}

      {isOwner && (
        <Card className="flex flex-col gap-3">
          <h3 className="font-extrabold">Invite the other adult</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter their email here first. Then they open this app, choose <strong>Create account</strong> with that same email, and confirm it.
            They'll join this household automatically.
          </p>
          <form className="flex gap-2" onSubmit={invite}>
            <input className={inputClass} type="email" required placeholder="partner@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={busy}>
              Invite
            </Button>
          </form>
          {error && <ErrorBox error={error} title="Couldn't invite" />}
          {invites.error && <ErrorBox error={invites.error} onRetry={invites.reload} />}
          {pending.length > 0 && (
            <ul className="flex flex-col gap-2">
              {pending.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-100 p-2 pl-3 dark:bg-slate-800">
                  <span className="truncate">⏳ {i.email}</span>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await deleteInvite(i.id)
                        invites.reload()
                      } catch (err) {
                        setError(err as Error)
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </section>
  )
}

function WeeklyPlanEditor({ form, onChange }: { form: AthleteInput; onChange: (plan: (string | null)[] | null) => void }) {
  const plan = form.custom_rotation
  const choices = workouts.filter((w) => form.kind === 'adult' || w.kidSafe)
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
      <Toggle
        label="Use my own weekly plan"
        hint={
          plan
            ? 'Used every week, including the first two.'
            : form.kind === 'kid'
              ? 'Off: Foundation for 2 weeks, then Foundation, Family circuit, and Recovery.'
              : 'Off: Foundation for 2 weeks, then the default rotation. Without a pull-up bar or dip bars it uses the Joe Rogan podcast version.'
        }
        checked={plan !== null}
        onChange={(on) => onChange(on ? defaultWeeklyPlan(form) : null)}
      />
      {plan &&
        PLAN_DAYS.map((day, i) => (
          <label key={day} className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-semibold">{day}</span>
            <select
              className={inputClass}
              value={plan[i] ?? ''}
              onChange={(e) => onChange(plan.map((v, j) => (j === i ? e.target.value || null : v)))}
            >
              <option value="">Rest or walk</option>
              {choices.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
              {plan[i] && !choices.some((w) => w.id === plan[i]) && <option value={plan[i]!}>{getWorkout(plan[i]!)?.name ?? plan[i]}</option>}
            </select>
          </label>
        ))}
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorBox, Field, inputClass } from '../components/ui'
import { PERSIST_SESSION } from '../config'
import { OFFLINE_MESSAGE } from '../lib/api'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: householdName.trim() ? { household_name: householdName.trim() } : {},
            emailRedirectTo: window.location.origin + window.location.pathname,
          },
        })
        if (error) throw error
        if (!data.session) {
          setNotice('Check your email to confirm your address, then come back and sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(!navigator.onLine || /fetch/i.test(msg) ? OFFLINE_MESSAGE : msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <div className="text-center">
        <div className="text-5xl" aria-hidden>
          🔔
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Kettlebell Family Trainer</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Workouts, timers, and progress for the whole household.</p>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-2 gap-2" role="tablist">
          {(['signin', 'signup'] as const).map((m) => (
            <Button key={m} role="tab" aria-selected={mode === m} variant={mode === m ? 'primary' : 'secondary'} onClick={() => setMode(m)}>
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          ))}
        </div>

        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Field label="Email">
            <input className={inputClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {mode === 'signup' && (
            <Field label="Household name (optional)" hint="Were you invited by your partner? Leave this blank. You'll join their household automatically.">
              <input className={inputClass} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder="The Smiths" />
            </Field>
          )}

          {error && <ErrorBox error={error} title={mode === 'signin' ? "Couldn't sign in" : "Couldn't create account"} />}
          {notice && (
            <p role="status" className="rounded-xl bg-green-50 p-3 font-semibold text-green-900 dark:bg-green-950 dark:text-green-100">
              {notice}
            </p>
          )}

          <Button type="submit" size="lg" block disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {PERSIST_SESSION
          ? 'You stay signed in on this device. Only the sign-in token is stored; all workout data lives in the cloud.'
          : 'Nothing is stored on this device. You will sign in each visit.'}
      </p>
    </main>
  )
}

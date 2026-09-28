import { STREAK_MILESTONES } from '../lib/streak'
import { badgesFor } from '../lib/stats'
import { Card } from './ui'

export default function Badges({ sessionCount, bestStreak }: { sessionCount: number; bestStreak: number }) {
  const { sessionBadges, streakBadges } = badgesFor(sessionCount, bestStreak)
  const earned = new Set(streakBadges.map((b) => b.id))
  const shown = Math.min(sessionBadges, 30)
  return (
    <Card>
      <h2 className="text-xl font-extrabold">Your badges</h2>
      <p className="mt-1 text-lg">
        ⭐ {sessionBadges} workout{sessionBadges === 1 ? '' : 's'} done!
      </p>
      {shown > 0 && (
        <p className="mt-2 text-2xl leading-relaxed break-words" aria-hidden>
          {'⭐'.repeat(shown)}
          {sessionBadges > shown ? ' …' : ''}
        </p>
      )}
      <ul className="mt-3 grid grid-cols-4 gap-2 text-center">
        {STREAK_MILESTONES.map((m) => {
          const got = earned.has(`streak_${m}`)
          const badge = streakBadges.find((b) => b.id === `streak_${m}`)
          return (
            <li key={m} className={`rounded-2xl p-2 ${got ? 'bg-brand-100 dark:bg-brand-700/30' : 'bg-slate-100 opacity-50 dark:bg-slate-800'}`}>
              <div className="text-3xl" aria-hidden>
                {got ? badge?.icon : '🔒'}
              </div>
              <div className="text-sm font-bold">{m} days</div>
              <span className="sr-only">{got ? 'earned' : 'not yet earned'}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

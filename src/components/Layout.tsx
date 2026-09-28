import { NavLink, Outlet } from 'react-router'
import { useApp } from '../state/AppContext'
import AthleteSwitcher from './AthleteSwitcher'
import { SuperviseBanner } from './ui'

const tabs = [
  { to: '/', label: 'Today', icon: '🏠' },
  { to: '/library', label: 'Library', icon: '📖' },
  { to: '/progress', label: 'Progress', icon: '📈' },
  { to: '/family', label: 'Family', icon: '👪' },
]

export default function Layout() {
  const { kidMode } = useApp()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <span className="text-lg font-black tracking-tight">
            <span aria-hidden>🔔</span> KB Family
          </span>
          <AthleteSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-28">
        {kidMode && (
          <div className="mb-4">
            <SuperviseBanner />
          </div>
        )}
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${isActive ? 'text-brand-600 dark:text-brand-500' : 'text-slate-600 dark:text-slate-400'}`
                }
              >
                <span aria-hidden className="text-xl kid:text-2xl">
                  {t.icon}
                </span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

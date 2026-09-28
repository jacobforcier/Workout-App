import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import { ErrorBox, Spinner } from './components/ui'
import { isConfigured } from './config'
import ExerciseDetail from './pages/ExerciseDetail'
import Family from './pages/Family'
import Library from './pages/Library'
import Login from './pages/Login'
import SessionPlayer from './pages/SessionPlayer'
import Today from './pages/Today'
import WorkoutDetail from './pages/WorkoutDetail'
import { useApp } from './state/AppContext'

// Charts are heavy; load them only when the Progress tab opens.
const Progress = lazy(() => import('./pages/Progress'))

export default function App() {
  const { session, authReady, membership, membershipError, reloadHousehold, activeAthlete, kidMode } = useApp()

  if (!isConfigured) {
    return (
      <Shell>
        <ErrorBox
          title="Supabase is not configured"
          error="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README) and rebuild."
        />
      </Shell>
    )
  }
  if (!authReady) return <Spinner />
  if (!session) return <Login />
  if (membershipError) {
    return (
      <Shell>
        <ErrorBox error={membershipError} onRetry={reloadHousehold} title="Couldn't load your household" />
      </Shell>
    )
  }
  if (!membership) return <Spinner label="Setting up your household…" />

  return (
    <div className={kidMode ? 'kid' : ''}>
      <Routes>
        <Route path="/session/:workoutId" element={activeAthlete ? <SessionPlayer key={activeAthlete.id} /> : <Navigate to="/family" replace />} />
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="library" element={<Library />} />
          <Route path="library/workout/:id" element={<WorkoutDetail />} />
          <Route path="library/exercise/:id" element={<ExerciseDetail />} />
          <Route
            path="progress"
            element={
              <Suspense fallback={<Spinner />}>
                <Progress />
              </Suspense>
            }
          />
          <Route path="family" element={<Family />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </div>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-xl p-4">{children}</main>
}

import { useEffect } from 'react'

/** Keeps the screen on while `active`, re-acquiring after the tab becomes visible again. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let disposed = false

    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request('screen')
        if (disposed) void s.release()
        else sentinel = s
      } catch {
        // Not allowed (e.g. low battery); the session still works.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [active])
}

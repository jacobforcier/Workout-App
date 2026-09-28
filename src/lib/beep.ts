let ctx: AudioContext | null = null

/** Call from a tap handler so iOS/Android allow audio later. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export function beep(frequency = 880, durationMs = 180, times = 1) {
  if (!ctx) unlockAudio()
  if (!ctx) return
  const start = ctx.currentTime
  for (let i = 0; i < times; i++) {
    const t = start + i * (durationMs / 1000 + 0.08)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + durationMs / 1000 + 0.02)
  }
  navigator.vibrate?.(times > 1 ? [150, 80, 150] : 150)
}

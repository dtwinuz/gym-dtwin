import type { Settings } from '../core/types'

let ctx: AudioContext | null = null

/** Browsers only start audio after a gesture, so a tick opens the context in advance. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

function beep() {
  unlockAudio()
  if (!ctx) return
  const at = ctx.currentTime
  for (const [i, f] of [880, 880, 1175].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const t = at + i * 0.22
    osc.frequency.value = f
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.2)
  }
}

function flash() {
  const el = document.createElement('div')
  el.className = 'timer-flash'
  el.setAttribute('aria-hidden', 'true')
  document.body.append(el)
  setTimeout(() => el.remove(), 900)
}

/** A timer ran out: sound, vibration and screen flash, as the settings say. */
export function timerAlert(s: Pick<Settings, 'sound' | 'vibrate' | 'timerFlash'>) {
  if (s.sound) beep()
  if (s.vibrate) {
    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      // not allowed without a gesture: the other signals still fire
    }
  }
  if (s.timerFlash) flash()
}

import { useEffect, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { t, type Key } from '../../i18n'
import { timerAlert, unlockAudio } from '../../app/alerts'
import { fmtDate, fmtNum } from '../../app/format'
import { addExercise, canTick, entryMode, isPast, nextPending, restExpired, sessionVolume, settleWork, tickNext } from '../../app/session'
import { getProfile, updateSettings } from '../../app/store'
import { toast } from '../../app/toast'
import { exerciseById, exerciseName } from '../../catalogue'
import { setsDone, setsTotal } from '../../core/history'
import type { ActiveSession, Profile } from '../../core/types'
import ExercisePicker from '../plan/ExercisePicker'
import { updateActive } from './active'
import ExerciseCard from './ExerciseCard'
import ExerciseMenu from './ExerciseMenu'
import FinishSheet from './FinishSheet'
import RestDock, { clock } from './RestDock'

/** A timer that ran out longer ago than this (tab closed) ends without a signal. */
const ALERT_WINDOW_MS = 60_000
const TYPING = 'input,textarea,select,[contenteditable="true"]'

function Elapsed({ start }: { start: number }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="elapsed">{clock((now - start) / 1000)}</span>
}

function useTimers() {
  useEffect(() => {
    const check = () => {
      const { active, settings } = getProfile()
      if (!active) return
      const now = Date.now()
      if (active.work && now >= active.work.endsAt) {
        if (now - active.work.endsAt < ALERT_WINDOW_MS) timerAlert(settings)
        updateActive(s => settleWork(s, getProfile().settings, now))
      }
      const rest = getProfile().active?.rest
      if (rest && restExpired(rest, now)) {
        if (now - rest.endsAt < ALERT_WINDOW_MS) timerAlert(settings)
        updateActive(s => {
          const out = { ...s }
          delete out.rest
          return out
        })
      }
    }
    check()
    const id = setInterval(check, 500)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
}

function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let closed = false
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || lock) return
      try {
        const got = await navigator.wakeLock.request('screen')
        if (closed) void got.release()
        else {
          lock = got
          got.addEventListener('release', () => { lock = null })
        }
      } catch {
        // refused (low battery, no permission): the screen just sleeps as usual
      }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      closed = true
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release()
    }
  }, [on])
}

const isComplete = (s: ActiveSession, i: number) => s.entries[i].sets.length > 0 && s.entries[i].sets.every(x => x.done)

export default function Logger({ p, s }: { p: Profile; s: ActiveSession }) {
  const { settings } = p
  const { lang, unit, workoutView, collapseCompleted, keepAwake, volumeWarmups } = settings
  const L = (k: Key) => t(lang, k)
  const [menu, setMenu] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [finish, setFinish] = useState(false)
  const [opened, setOpened] = useState<Set<number>>(new Set())
  const chips = useRef<HTMLDivElement>(null)
  const past = isPast(s)
  const list = workoutView === 'list'
  const cur = Math.min(s.cur, Math.max(0, s.entries.length - 1))
  const next = nextPending(s)
  const done = setsDone(s.entries)
  const total = setsTotal(s.entries)
  const volume = sessionVolume(s.entries, volumeWarmups)

  useTimers()
  useWakeLock(keepAwake && !past)

  const go = (i: number) => {
    updateActive(x => ({ ...x, cur: i }))
    if (list) document.querySelector(`[data-ei="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (document.body.classList.contains('no-scroll') || ev.ctrlKey || ev.metaKey || ev.altKey) return
      const el = ev.target as HTMLElement | null
      if (el?.closest?.(TYPING)) return
      const active = getProfile().active
      if (!active) return
      if (ev.key === ' ' || ev.key === 'Enter') {
        if (el?.closest?.('a,button') && !el.closest('.check')) return
        ev.preventDefault()
        const at = nextPending(active)
        if (!at) return
        const row = active.entries[at.ei].sets[at.si]
        if (!canTick(row, entryMode(active.entries[at.ei]), at.side)) {
          toast(t(getProfile().settings.lang, 'enterReps'))
          return
        }
        if (getProfile().settings.sound) unlockAudio()
        updateActive(x => tickNext(x, getProfile().settings))
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault()
        const n = active.entries.length
        if (!n) return
        const i = (active.cur + (ev.key === 'ArrowRight' ? 1 : n - 1)) % n
        updateActive(x => ({ ...x, cur: i }))
        if (getProfile().settings.workoutView === 'list') document.querySelector(`[data-ei="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    chips.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [cur])

  const add = (exId: string) => {
    updateActive(x => addExercise(getProfile(), x, exId))
    setPicking(false)
  }

  return (
    <div className="logger">
      <header className="logger-head">
        <div className="logger-title">
          <h1>{s.name}</h1>
          <p className="muted">
            {past ? `${L('pastDate')}: ${fmtDate(s.date, lang)}` : <Elapsed start={s.start} />}
            {' · '}<span data-progress>{done}/{total} {L('setsShort')}</span>
            {' · '}<span data-volume>{fmtNum(volume, lang, 0)} {unit}</span>
          </p>
        </div>
        <div className="seg mode-seg" role="radiogroup" aria-label={L('workoutView')}>
          {(['cards', 'list'] as const).map(v => (
            <button type="button" key={v} role="radio" aria-checked={workoutView === v} className={workoutView === v ? 'on' : ''} onClick={() => updateSettings({ workoutView: v })}>{L(v === 'cards' ? 'viewCards' : 'viewList')}</button>
          ))}
        </div>
      </header>

      <div className="logger-progress" aria-hidden="true"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>

      {s.entries.length > 0 && (
        <div className="ex-chips" ref={chips}>
          {s.entries.map((e, i) => {
            const works = e.sets.filter(x => !x.warmup)
            return (
              <button type="button" key={i} className={`${i === cur ? 'on' : ''}${isComplete(s, i) ? ' complete' : ''}${e.sg ? ' in-sg' : ''}`} aria-current={i === cur} onClick={() => go(i)}>
                {isComplete(s, i) && <Check size={14} />}
                <span>{exerciseName(exerciseById(e.exId), lang)}</span>
                <small>{works.filter(x => x.done).length}/{works.length}</small>
              </button>
            )
          })}
        </div>
      )}

      {s.entries.length === 0 && <div className="card empty">{L('freestyleEmpty')}</div>}

      {s.entries.map((e, i) => {
        if (!list && i !== cur) return null
        const collapsed = list && collapseCompleted && isComplete(s, i) && !opened.has(i)
        return (
          <ExerciseCard
            key={`${i}-${e.exId}`} p={p} s={s} ei={i} next={next} collapsed={collapsed}
            onExpand={() => setOpened(o => new Set(o).add(i))} onMenu={() => setMenu(i)}
          />
        )
      })}

      <button type="button" className="btn add-slot" data-add-ex onClick={() => setPicking(true)}><Plus size={16} />{L('addExercise')}</button>

      <details className="card session-note">
        <summary>{L('sessionNote')}{s.note ? ` · ${s.note.slice(0, 40)}` : ''}</summary>
        <textarea className="input" rows={2} maxLength={1000} value={s.note ?? ''} aria-label={L('sessionNote')} onChange={e => { const note = e.target.value; updateActive(x => ({ ...x, note })) }} />
      </details>

      <p className="muted keys-hint">{L('keysHint')}</p>

      <div className="logger-dock">
        {s.rest && <RestDock rest={s.rest} lang={lang} />}
        <div className="sticky-bar">
          <span className="muted">{done}/{total} · {fmtNum(volume, lang, 0)} {unit}</span>
          <button type="button" className="btn primary" onClick={() => setFinish(true)}>{L('finish')}</button>
        </div>
      </div>

      {menu != null && <ExerciseMenu p={p} s={s} ei={menu} onClose={() => setMenu(null)} />}
      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={e => add(e.id)} />}
      {finish && <FinishSheet p={p} s={s} onClose={() => setFinish(false)} />}
    </div>
  )
}

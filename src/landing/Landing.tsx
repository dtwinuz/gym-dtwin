import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Activity, ArrowRight, ArrowUpRight, BellRing, Brain, CalendarDays, Check, ChevronDown, Dumbbell, FileDown, HardDrive,
  HeartPulse, Infinity as InfinityIcon, Languages, Moon, Play, Presentation, QrCode, Salad, ScanFace, Smartphone, Sun, Swords, Timer,
  TrendingUp, Trophy, UserRoundX, Watch,
} from 'lucide-react'
import { EXERCISES, PLANS, exerciseById } from '../data'
import { LANGS, type Lang } from '../i18n'
import { update, useStore } from '../store'
import { L, MUSCLE_T } from './text'
import type { SceneHandle } from './scene'
import './Landing.css'

type Theme = 'dark' | 'light'
const THEME_KEY = 'gym-dtwin:theme'

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch { /* storage blocked */ }
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Adds `in` once the element scrolls into view; `live` stays true while it is visible. */
function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean, boolean] {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      setLive(e.isIntersecting)
      if (e.isIntersecting) setSeen(true)
    }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, seen, live]
}

/** Step counter that ticks while `live`, looping over `n` steps. */
function useSteps(live: boolean, n: number, ms: number) {
  const [k, setK] = useState(REDUCED ? n - 1 : 0)
  useEffect(() => {
    if (!live || REDUCED) return
    const id = setInterval(() => setK(v => (v + 1) % n), ms)
    return () => clearInterval(id)
  }, [live, n, ms])
  return k
}

const H = ({ html, as = 'h2', className }: { html: string; as?: 'h1' | 'h2'; className?: string }) => {
  const Tag = as
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

function Chapter({ id, k, title, text, children, flip, lang }: { id: string; k: string; title: string; text: string; children: ReactNode; flip?: boolean; lang: Lang }) {
  const [ref, seen] = useInView<HTMLElement>()
  return (
    <section ref={ref} id={id} data-ch className={`ld-ch${flip ? ' flip' : ''}${seen ? ' in' : ''}`} lang={lang}>
      <div className="ld-copy">
        <div className="ld-kick">{k}</div>
        <H className="ld-h2" html={title} />
        <p className="ld-p">{text}</p>
      </div>
      <div className="ld-demo">{children}</div>
    </section>
  )
}

/* ---------- demos ---------- */

function PlanDemo({ lang }: { lang: Lang }) {
  const [ref, seen, live] = useInView<HTMLDivElement>()
  const k = useSteps(live, PLANS.length, 2600)
  const plan = PLANS[k]
  const day = plan.days[0]
  return (
    <div ref={ref} className={`ld-card ld-plan${seen ? ' in' : ''}`}>
      <div className="ld-plan-list">
        {PLANS.map((p, i) => (
          <div key={p.id} className={`ld-prog${i === k ? ' on' : ''}`}>
            <span className="ld-prog-ic"><CalendarDays size={16} /></span>
            <span className="ld-prog-t"><b>{p.name}</b><small>{L.planNotes[i][lang]}</small></span>
            {i === k && <span className="ld-chip acc">✓</span>}
          </div>
        ))}
      </div>
      <div className="ld-plan-day" key={plan.id}>
        <div className="ld-days">
          {plan.days.map((d, i) => (
            <span key={d.name} className={`ld-day${i === 0 ? ' on' : ''}`}>{i === 0 ? `${L.today[lang]} · ` : i === 1 ? `${L.next[lang]} · ` : ''}{d.name}</span>
          ))}
        </div>
        <ul className="ld-ex">
          {day.items.map((it, i) => (
            <li key={it.exId} style={{ animationDelay: `${i * 70}ms` }}>
              <span>{exerciseById(it.exId)?.name}</span>
              <span className="ld-mono">{it.sets} × {it.reps}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const LOG_ROWS = [
  { kg: 80, reps: 6 },
  { kg: 80, reps: 6 },
  { kg: 82.5, reps: 6 },
  { kg: 85, reps: 6 },
]

function LogDemo({ lang }: { lang: Lang }) {
  const [ref, seen, live] = useInView<HTMLDivElement>()
  const step = useSteps(live, 7, 1500)
  const done = Math.min(LOG_ROWS.length, step)
  const resting = step > 0 && step <= LOG_ROWS.length
  const pr = step >= LOG_ROWS.length
  const C = 2 * Math.PI * 34
  return (
    <div ref={ref} className={`ld-card ld-log${seen ? ' in' : ''}`}>
      <div className="ld-log-h">
        <div>
          <small className="ld-mono">Push · 1/5</small>
          <b>Bench press</b>
        </div>
        <div className={`ld-rest${resting ? ' on' : ''}`} key={`r${step}`}>
          <svg viewBox="0 0 80 80" aria-hidden>
            <circle cx="40" cy="40" r="34" className="bg" />
            <circle cx="40" cy="40" r="34" className="fg" style={{ strokeDasharray: C, strokeDashoffset: resting ? 0 : C }} />
          </svg>
          <span><Timer size={13} /> {resting ? '1:30' : '—'}<small>{L.rest[lang]}</small></span>
        </div>
      </div>
      <div className="ld-sets">
        {LOG_ROWS.map((r, i) => (
          <div key={i} className={`ld-set${i < done ? ' done' : ''}${i === LOG_ROWS.length - 1 && pr ? ' pr' : ''}`}>
            <span className="ld-set-n">{i + 1}</span>
            <span className="ld-field">{String(r.kg).replace('.', lang === 'en' ? '.' : ',')}<small>kg</small></span>
            <span className="ld-x">×</span>
            <span className="ld-field">{r.reps}<small>rep</small></span>
            <span className="ld-ck">{i < done && <Check size={15} strokeWidth={3} />}</span>
          </div>
        ))}
      </div>
      <div className={`ld-pr${pr ? ' on' : ''}`}>
        <Trophy size={18} />
        <span><b>{L.pr[lang]}</b> · 1RM ≈ 102 kg</span>
        <span className="ld-mono">85 × 6 · Epley</span>
      </div>
    </div>
  )
}

function ProgressDemo({ lang }: { lang: Lang }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  const cells = Array.from({ length: 84 }, (_, i) => {
    const w = Math.floor(i / 7), d = i % 7
    const on = (d === 0 || d === 2 || d === 4 || (d === 5 && w % 3 === 1)) && !(w === 3 && d === 2) && w > 0
    return on ? (w > 8 ? 2 : 1) : 0
  })
  const weight = [82.4, 82.1, 81.6, 81.8, 81.1, 80.6, 80.2, 80.4, 79.7, 79.1, 78.8, 78.3]
  const min = 74, max = 83.5
  const pts = weight.map((v, i) => `${(i / (weight.length - 1)) * 300},${100 - ((v - min) / (max - min)) * 100}`).join(' ')
  const goalY = 100 - ((75 - min) / (max - min)) * 100
  const recs: [string, number][] = [['Deadlift', 152], ['Back squat', 121], ['Bench press', 102], ['Overhead press', 63]]
  return (
    <div ref={ref} className={`ld-card ld-progress${seen ? ' in' : ''}`}>
      <div className="ld-sub"><Activity size={14} /> {L.activity[lang]}</div>
      <div className="ld-heat">
        {cells.map((c, i) => <span key={i} className={c ? `l${c}` : ''} style={{ transitionDelay: `${(Math.floor(i / 7)) * 45 + (i % 7) * 12}ms` }} />)}
      </div>
      <div className="ld-prog-grid">
        <div>
          <div className="ld-sub"><Trophy size={14} /> {L.records[lang]}</div>
          {recs.map(([n, v], i) => (
            <div key={n} className="ld-rec">
              <span>{n}</span>
              <i><b style={{ width: seen ? `${(v / 160) * 100}%` : 0, transitionDelay: `${300 + i * 120}ms` }} /></i>
              <span className="ld-mono">{v} kg</span>
            </div>
          ))}
        </div>
        <div>
          <div className="ld-sub"><TrendingUp size={14} /> {L.weight[lang]} <span className="ld-mono ld-dim">78,3 → 75 kg</span></div>
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="ld-wchart">
            <line x1="0" x2="300" y1={goalY} y2={goalY} className="goal" />
            <polyline points={pts} pathLength={1} className="ln" />
          </svg>
          <div className="ld-goal ld-mono">— — {L.goal[lang]} 75 kg</div>
        </div>
      </div>
    </div>
  )
}

const BODY_LOAD: Record<string, number> = { chest: 14, back: 16, legs: 18, shoulders: 9, arms: 8, core: 3 }

function BodyDemo({ lang }: { lang: Lang }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  const lvl = (m: string) => `m l${Math.min(3, Math.ceil(BODY_LOAD[m] / 6))}`
  return (
    <div ref={ref} className={`ld-card ld-body${seen ? ' in' : ''}`}>
      <div className="ld-body-h"><span className="ld-sub">{L.bodyWeek[lang]} · 68 {L.sets[lang]}</span><span className="ld-chip soon">{L.soon[lang]}</span></div>
      <div className="ld-figs">
        {[0, 1].map(back => (
          <svg key={back} viewBox="0 0 120 260" className="ld-fig" aria-hidden>
            <circle cx="60" cy="22" r="15" className="skin" />
            <rect x="52" y="36" width="16" height="10" rx="4" className="skin" />
            {back ? (
              <>
                <path d="M34 50 Q60 42 86 50 L84 110 Q60 120 36 110 Z" className={lvl('back')} style={{ transitionDelay: '200ms' }} />
                <path d="M40 112 Q60 118 80 112 L80 132 Q60 138 40 132 Z" className={lvl('core')} style={{ transitionDelay: '700ms' }} />
              </>
            ) : (
              <>
                <path d="M36 52 Q60 44 84 52 L82 80 Q60 88 38 80 Z" className={lvl('chest')} style={{ transitionDelay: '200ms' }} />
                <path d="M42 84 Q60 90 78 84 L78 130 Q60 136 42 130 Z" className={lvl('core')} style={{ transitionDelay: '700ms' }} />
              </>
            )}
            <ellipse cx="28" cy="58" rx="11" ry="10" className={lvl('shoulders')} style={{ transitionDelay: '350ms' }} />
            <ellipse cx="92" cy="58" rx="11" ry="10" className={lvl('shoulders')} style={{ transitionDelay: '350ms' }} />
            <path d="M18 68 Q14 100 16 128 L26 128 Q30 100 34 70 Z" className={lvl('arms')} style={{ transitionDelay: '500ms' }} />
            <path d="M102 68 Q106 100 104 128 L94 128 Q90 100 86 70 Z" className={lvl('arms')} style={{ transitionDelay: '500ms' }} />
            <path d="M40 136 L58 138 L56 246 L42 246 Q36 190 40 136 Z" className={lvl('legs')} style={{ transitionDelay: '100ms' }} />
            <path d="M80 136 L62 138 L64 246 L78 246 Q84 190 80 136 Z" className={lvl('legs')} style={{ transitionDelay: '100ms' }} />
          </svg>
        ))}
      </div>
      <ul className="ld-legend">
        {Object.entries(BODY_LOAD).map(([m, v]) => (
          <li key={m}><i className={`l${Math.min(3, Math.ceil(v / 6))}`} />{MUSCLE_T[m][lang]}<span className="ld-mono">{v} {L.sets[lang]}</span></li>
        ))}
      </ul>
    </div>
  )
}

function Mini({ k, lang }: { k: string; lang: Lang }) {
  switch (k) {
    case 'ai':
      return <div className="mi-chat"><span className="me">{lang === 'uz' ? "Tizzam og'riyapti" : lang === 'ru' ? 'Болит колено' : 'My knee hurts'}</span><span className="bot">→ Leg press · 3×12 ✓</span></div>
    case 'wear':
      return <svg viewBox="0 0 200 40" className="mi-ecg"><polyline points="0,24 40,24 50,20 58,24 70,24 76,4 82,36 88,24 120,24 130,18 140,24 200,24" /></svg>
    case 'food':
      return <div className="mi-rings">{[[85, 'P'], [62, 'C'], [48, 'F']].map(([v, n]) => <span key={n} style={{ ['--v' as string]: v }}><b>{n}</b></span>)}</div>
    case 'form':
      return <svg viewBox="0 0 200 60" className="mi-skel"><polyline points="60,8 70,26 96,34 112,52" /><polyline points="70,26 60,44" /><circle cx="60" cy="8" r="4" /><circle cx="70" cy="26" r="3.5" /><circle cx="96" cy="34" r="3.5" /><circle cx="112" cy="52" r="3.5" /><text x="104" y="30">92°</text></svg>
    case 'market':
      return <div className="mi-qr"><QrCode size={34} /><span><b>{lang === 'en' ? 'Coach Sardor' : lang === 'ru' ? 'Тренер Сардор' : 'Murabbiy Sardor'}</b><small>★ 4.9 · 120k</small></span></div>
    case 'bot':
      return <div className="mi-toast"><span className="tg">✈</span><span><b>gym.dtwin</b><small>Legs · 18:00</small></span></div>
    case 'social':
      return <div className="mi-board">{[['Aziza', 21], [lang === 'en' ? 'You' : lang === 'ru' ? 'Вы' : 'Siz', 18], ['Bekzod', 15]].map(([n, v], i) => <span key={i} className={i === 1 ? 'me' : ''}><i>{i + 1}</i>{n}<i style={{ width: `${(Number(v) / 30) * 70}px` }} className="b" /></span>)}</div>
    case 'dtwin':
      return <div className="mi-day">{['06:15', '13:00', '18:00', '21:30'].map((t, i) => <span key={t} className={i === 2 ? 'on' : ''}>{t}</span>)}</div>
    case 'prog':
      return <svg viewBox="0 0 200 50" className="mi-steps"><polyline points="10,42 50,42 50,34 90,34 90,26 130,26 130,30 150,30 150,16 190,16" /></svg>
    case 'video':
      return <div className="mi-anim"><Dumbbell size={26} /><span className="ld-mono">0:04</span><span className="bar"><i /></span></div>
    case 'pwa':
      return <div className="mi-pwa"><Smartphone size={26} /><span><b>gym.dtwin</b><small>offline ✓</small></span></div>
    default:
      return <div className="mi-file"><FileDown size={18} /><span className="ld-mono">workouts.csv</span><span className="bar"><i /></span></div>
  }
}

const ROAD_IC: Record<string, ReactNode> = {
  video: <Play size={18} />, pwa: <Smartphone size={18} />,
  ai: <Brain size={18} />, wear: <Watch size={18} />, food: <Salad size={18} />, form: <ScanFace size={18} />, market: <QrCode size={18} />,
  bot: <BellRing size={18} />, social: <Swords size={18} />, dtwin: <InfinityIcon size={18} />, prog: <TrendingUp size={18} />, csv: <FileDown size={18} />,
}

function Roadmap({ lang }: { lang: Lang }) {
  const [ref, seen] = useInView<HTMLElement>()
  return (
    <section ref={ref} id="roadmap" data-ch className={`ld-wide${seen ? ' in' : ''}`}>
      <div className="ld-copy center">
        <div className="ld-kick">{L.roadK[lang]}</div>
        <H className="ld-h2" html={L.roadH[lang]} />
        <p className="ld-p">{L.roadP[lang]}</p>
      </div>
      <div className="ld-road">
        {L.road.map((r, i) => (
          <article key={r.k} className="ld-rc" style={{ transitionDelay: `${i * 60}ms` }}>
            <div className="ld-rc-h">
              <span className="ld-rc-ic">{ROAD_IC[r.k]}</span>
              <b>{r.t[lang]}</b>
              <span className="ld-chip soon">{L.soon[lang]}</span>
            </div>
            <p>{r.d[lang]}</p>
            <div className="ld-rc-mini"><Mini k={r.k} lang={lang} /></div>
            <div className="ld-rc-m ld-mono">{r.m[lang]}</div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Wide({ id, children }: { id: string; children: ReactNode }) {
  const [ref, seen] = useInView<HTMLElement>()
  return <section ref={ref} id={id} data-ch className={`ld-wide${seen ? ' in' : ''}`}>{children}</section>
}

const TRUST_IC = [<UserRoundX size={20} key="a" />, <HardDrive size={20} key="b" />, <Languages size={20} key="c" />, <HeartPulse size={20} key="d" />]

/* ---------- static fallback when WebGL is unavailable ---------- */
function StaticBell() {
  return (
    <svg className="ld-static" viewBox="0 0 800 400" aria-hidden>
      <defs><radialGradient id="ldg" r=".5"><stop offset="0" stopColor="rgb(198 244 50 / .35)" /><stop offset="1" stopColor="rgb(198 244 50 / 0)" /></radialGradient></defs>
      <ellipse cx="400" cy="230" rx="380" ry="150" fill="url(#ldg)" />
      <rect x="120" y="196" width="560" height="8" rx="4" fill="#c9ced4" />
      {[[150, '#e5322d', 120], [178, '#2f6fe4', 120], [204, '#f5c518', 100]].map(([x, c, h]) => (
        <g key={String(x)}>
          <rect x={Number(x) - 12} y={200 - Number(h) / 2} width="22" height={Number(h)} rx="5" fill={String(c)} />
          <rect x={800 - Number(x) - 10} y={200 - Number(h) / 2} width="22" height={Number(h)} rx="5" fill={String(c)} />
        </g>
      ))}
    </svg>
  )
}

export default function Landing() {
  const { lang, workouts } = useStore()
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const bpm = useRef<HTMLSpanElement>(null)
  const handle = useRef<SceneHandle | null>(null)
  const themeRef = useRef(theme)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = `gym.dtwin — ${L.tagline[lang]}`
  }, [lang])

  useEffect(() => {
    themeRef.current = theme
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f4ee' : '#0a0b0d')
    handle.current?.setLight(theme === 'light')
  }, [theme])

  // chapter progress + scroll pulse
  useEffect(() => {
    let lastY = scrollY, raf = 0
    const chapters = () => [...(root.current?.querySelectorAll<HTMLElement>('[data-ch]') ?? [])]
    const progress = () => {
      const els = chapters()
      const mid = scrollY + innerHeight * 0.5
      const tops = els.map(e => e.getBoundingClientRect().top + scrollY)
      let p = 0
      for (let i = 0; i < tops.length; i++) {
        if (mid >= tops[i]) {
          const next = tops[i + 1] ?? tops[i] + els[i].offsetHeight
          p = i + Math.min(1, (mid - tops[i]) / Math.max(1, next - tops[i]))
        }
      }
      return Math.max(0, p - 0.5) * (scrollY < 4 ? 0 : 1)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const dy = Math.abs(scrollY - lastY)
        lastY = scrollY
        handle.current?.setProgress(progress())
        handle.current?.kick(Math.min(0.25, dy / 1800))
        root.current?.classList.toggle('scrolled', scrollY > 24)
      })
    }
    addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  // free area next to / under the hero copy, so the barbell never covers text
  const measure = () => {
    const hero = root.current?.querySelector<HTMLElement>('.ld-hero')
    const copy = root.current?.querySelector<HTMLElement>('.ld-hero-copy')
    const stats = root.current?.querySelector<HTMLElement>('.ld-stats')
    const hud = root.current?.querySelector<HTMLElement>('.ld-hud')
    if (!hero || !copy || !stats || !hud || !handle.current) return
    const W = innerWidth, Hh = innerHeight, y = scrollY
    const top = (r: DOMRect) => r.top + y, bottom = (r: DOMRect) => r.bottom + y
    const portrait = Hh > W * 1.05
    root.current?.classList.remove('tight')
    const hudTop = top(hud.getBoundingClientRect())
    if (portrait) {
      const t0 = (bottom(stats.getBoundingClientRect()) + 18) / Hh
      const b0 = Math.min(0.97, (hudTop - 10) / Hh)
      // little room above the pulse chip: drop the chip and give the barbell the bottom of the screen
      const tight = b0 - t0 < 0.15
      root.current?.classList.toggle('tight', tight)
      handle.current.setSafe({ left: 0.03, right: 0.97, top: t0, bottom: tight ? Math.max(t0 + 0.12, 0.985) : b0 })
    } else {
      const c = copy.getBoundingClientRect()
      handle.current.setSafe({ left: (c.right + 40) / W, right: 0.98, top: 100 / Hh, bottom: Math.min(0.95, (hudTop - 12) / Hh) })
    }
  }
  const measureRef = useRef(measure)
  useEffect(() => { measureRef.current = measure })
  useEffect(() => {
    const ro = new ResizeObserver(() => measureRef.current())
    const copy = root.current?.querySelector('.ld-hero')
    if (copy) ro.observe(copy)
    document.fonts?.ready.then(() => measureRef.current())
    measureRef.current()
    return () => ro.disconnect()
  }, [lang])

  // lazy 3D scene
  useEffect(() => {
    let disposed = false
    const host = stage.current
    if (!host) return
    const t = setTimeout(async () => {
      try {
        const probe = document.createElement('canvas')
        if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl')
        const { mountScene } = await import('./scene')
        if (disposed) return
        const h = await mountScene({
          host, progress: 0, light: themeRef.current === 'light', reduced: REDUCED,
          onBpm: n => { if (bpm.current) bpm.current.textContent = String(n) },
        })
        if (disposed) { h.dispose(); return }
        handle.current = h
        measure()
        requestAnimationFrame(() => setReady(true))
      } catch {
        if (!disposed) setFallback(true)
      }
    }, 60)
    return () => { disposed = true; clearTimeout(t); handle.current?.dispose(); handle.current = null }
  }, [])

  const setLang = (l: Lang) => update(s => ({ ...s, lang: l }))
  const hasData = workouts.length > 0
  const ov = lang === 'uz' ? '/overview/' : `/overview/${lang}/`

  return (
    <div ref={root} className={`ld${ready ? ' ready' : ''}`} data-theme={theme}>
      <div className="ld-stage" ref={stage} aria-hidden>
        {fallback && <StaticBell />}
      </div>
      <div className="ld-veil" aria-hidden />

      <header className="ld-header">
        <div className="ld-header-in">
          <a className="ld-brand" href="#/"><span className="ld-logo"><Dumbbell size={16} strokeWidth={2.4} /></span><b>gym<span>.dtwin</span></b></a>
          <div className="ld-flex" />
          <div className="ld-langs" role="group" aria-label="Language">
            {LANGS.map(l => <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)} aria-pressed={l === lang}>{l}</button>)}
          </div>
          <button className="ld-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={L.theme[lang]} title={L.theme[lang]}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <a className="ld-head-cta" href="#/home"><span className="ld-long">{L.open[lang]}</span><span className="ld-short">{L.openShort[lang]}</span><ArrowRight size={15} /></a>
        </div>
      </header>

      <main>
        <section className="ld-hero" data-ch>
          <div className="ld-hero-copy">
            <div className="ld-eyebrow"><span className="ld-live" /> {L.eyebrow[lang]}</div>
            <H as="h1" className="ld-title" html={L.title[lang]} />
            <p className="ld-lead">{L.lead[lang]}</p>
            <div className="ld-ctas">
              <a className="ld-btn primary" href="#/home"><Play size={16} fill="currentColor" /> {hasData ? L.cont[lang] : L.start[lang]}</a>
              <a className="ld-btn ghost" href={ov}><Presentation size={16} /> {L.watch[lang]}</a>
            </div>
            <div className="ld-stats">
              {L.stats.map(([n, s]) => <div key={n}><b>{n}</b><span>{s[lang]}</span></div>)}
            </div>
          </div>
          <div className="ld-hud" aria-hidden>
            <HeartPulse size={15} /> <span ref={bpm}>64</span> <small>bpm · {L.pulse[lang]}</small>
          </div>
          <button className="ld-scroll" onClick={() => document.getElementById('plan')?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' })} aria-label={L.scroll[lang]}><ChevronDown size={18} /></button>
        </section>

        <Chapter id="plan" k={L.planK[lang]} title={L.planH[lang]} text={L.planP[lang]} lang={lang}><PlanDemo lang={lang} /></Chapter>
        <Chapter id="log" k={L.logK[lang]} title={L.logH[lang]} text={L.logP[lang]} flip lang={lang}><LogDemo lang={lang} /></Chapter>
        <Chapter id="progress" k={L.progK[lang]} title={L.progH[lang]} text={L.progP[lang]} lang={lang}><ProgressDemo lang={lang} /></Chapter>
        <Chapter id="body" k={L.bodyK[lang]} title={L.bodyH[lang]} text={L.bodyP[lang]} flip lang={lang}><BodyDemo lang={lang} /></Chapter>
        <Roadmap lang={lang} />

        <Wide id="trust">
          <div className="ld-copy center">
            <div className="ld-kick">{L.trustK[lang]}</div>
            <H className="ld-h2" html={L.trustH[lang]} />
          </div>
          <div className="ld-trust">
            {L.trust.map(([t, d], i) => (
              <div key={i} className="ld-tc"><span className="ld-rc-ic">{TRUST_IC[i]}</span><b>{t[lang]}</b><p>{d[lang]}</p></div>
            ))}
          </div>
          <div className="ld-decks">
            <div className="ld-sub">{L.decksK[lang]} · {L.decksH[lang]}</div>
            <div className="ld-deck-row">
              <a href={ov} className="ld-deck hot"><Play size={16} fill="currentColor" /><span>{L.deckOverview[lang]}</span><ArrowUpRight size={15} /></a>
              <a href="/deck/tadqiqot.html" target="_blank" rel="noopener" className="ld-deck"><Presentation size={16} /><span>{L.deckResearch[lang]}</span><ArrowUpRight size={15} /></a>
              <a href="/deck/konsept.html" target="_blank" rel="noopener" className="ld-deck"><Presentation size={16} /><span>{L.deckConcept[lang]}</span><ArrowUpRight size={15} /></a>
            </div>
          </div>
        </Wide>

        <section className="ld-final" data-ch>
          <H className="ld-title sm" html={L.finalH[lang]} />
          <p className="ld-lead">{L.finalP[lang]}</p>
          <div className="ld-ctas center">
            <a className="ld-btn primary" href="#/home"><Play size={16} fill="currentColor" /> {hasData ? L.cont[lang] : L.start[lang]}</a>
            <a className="ld-btn ghost" href={ov}><Presentation size={16} /> {L.watch[lang]}</a>
          </div>
          <div className="ld-final-ex ld-mono">{EXERCISES.slice(0, 12).map(e => e.name).join(' · ')} …</div>
        </section>
      </main>

      <footer className="ld-foot">
        <div className="ld-foot-in">
          <span className="ld-brand"><span className="ld-logo"><Dumbbell size={14} strokeWidth={2.4} /></span><b>gym<span>.dtwin</span></b></span>
          <span className="ld-dim">{L.foot[lang]}</span>
          <div className="ld-flex" />
          <a href="#/home">{L.open[lang]}</a>
          <a href={ov}>Overview</a>
          <a href="https://dtwin.uz" target="_blank" rel="noopener">dtwin.uz</a>
        </div>
      </footer>
    </div>
  )
}

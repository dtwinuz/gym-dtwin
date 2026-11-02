import { t, type Lang } from '../i18n'
import { exerciseById, exerciseName } from '../catalogue'
import { setsDone, topSet } from '../core/history'
import type { Entry, SetRow, Settings, Workout } from '../core/types'
import { formatWeight } from '../core/units'
import { fmtDate, fmtNum } from './format'
import { workoutMinutes } from './session'

const BRAND = 'gym.dtwin.uz'
export const SHARE_SITE = `https://${BRAND}`
const SIZE = 1080
const PAD = 72
const MAX_ROWS = 7

type Fmt = Pick<Settings, 'lang' | 'unit' | 'wdec'>

export function setText(s: SetRow | undefined, { lang, unit, wdec }: Fmt): string {
  if (!s) return ''
  if (s.min != null) return `${s.min} ${t(lang, 'minShort')}`
  if (s.sec != null) return `${s.w ? `${formatWeight(s.w, wdec)} ${unit} × ` : ''}${s.sec} ${t(lang, 'secShort')}`
  return s.w ? `${formatWeight(s.w, wdec)} ${unit} × ${s.r ?? 0}` : `${s.r ?? 0} ×`
}

const name = (e: Entry | string, lang: Lang) => exerciseName(exerciseById(typeof e === 'string' ? e : e.exId), lang)

export function recordsOf(w: Workout) {
  return [...w.prs, ...(w.e1prs ?? [])]
}

/** The text that goes with the Telegram link. */
export function workoutText(w: Workout, f: Fmt): string {
  const { lang, unit } = f
  const head = `${w.name} · ${fmtDate(w.date, lang)}`
  const stats = `${workoutMinutes(w)} ${t(lang, 'minShort')} · ${fmtNum(w.vol, lang, 0)} ${unit} · ${setsDone(w.entries)} ${t(lang, 'setsShort')}`
  const tops = w.entries.slice(0, 5).map(e => `${name(e, lang)}: ${setText(topSet(e), f)}`)
  const prs = recordsOf(w).map(id => `PR: ${name(id, lang)}`)
  return [head, stats, ...prs, ...tops].join('\n')
}

function fit(g: CanvasRenderingContext2D, text: string, width: number) {
  if (g.measureText(text).width <= width) return text
  let s = text
  while (s && g.measureText(`${s}…`).width > width) s = s.slice(0, -1)
  return `${s}…`
}

function cardColors() {
  const css = getComputedStyle(document.documentElement)
  return { accent: css.getPropertyValue('--accent').trim() || '#c6f432', ink: '#f2f4f6', muted: '#9aa1aa', bg: '#111316', panel: '#1b1e22' }
}

/** A square PNG summary of the workout. */
export function renderCard(w: Workout, f: Fmt): HTMLCanvasElement {
  const { lang, unit } = f
  const c = cardColors()
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const g = canvas.getContext('2d')
  if (!g) return canvas
  const font = (px: number, weight = 400) => `${weight} ${px}px Inter, system-ui, sans-serif`
  const width = SIZE - PAD * 2

  g.fillStyle = c.bg
  g.fillRect(0, 0, SIZE, SIZE)
  g.fillStyle = c.accent
  g.fillRect(0, 0, SIZE, 14)

  g.textBaseline = 'top'
  g.fillStyle = c.muted
  g.font = font(32)
  g.fillText(fmtDate(w.date, lang, { day: 'numeric', month: 'long', year: 'numeric' }), PAD, 64)
  g.fillStyle = c.ink
  g.font = font(64, 800)
  g.fillText(fit(g, w.name, width), PAD, 108)

  const stats: [string, string][] = [
    [`${workoutMinutes(w)}`, t(lang, 'minShort')],
    [fmtNum(w.vol, lang, 0), unit],
    [`${setsDone(w.entries)}`, t(lang, 'setsShort')],
  ]
  const cell = (width - 32) / 3
  stats.forEach(([v, label], i) => {
    const x = PAD + i * (cell + 16)
    g.fillStyle = c.panel
    g.fillRect(x, 208, cell, 132)
    g.fillStyle = i === 1 ? c.accent : c.ink
    g.font = font(52, 800)
    g.fillText(fit(g, v, cell - 40), x + 20, 224)
    g.fillStyle = c.muted
    g.font = font(28)
    g.fillText(label, x + 20, 288)
  })

  let y = 380
  const records = recordsOf(w)
  if (records.length) {
    g.fillStyle = c.accent
    g.font = font(36, 800)
    g.fillText(fit(g, `PR: ${records.map(id => name(id, lang)).join(', ')}`, width), PAD, y)
    y += 64
  }

  const rows = w.entries.slice(0, MAX_ROWS)
  for (const e of rows) {
    const top = setText(topSet(e), f)
    g.font = font(34, 600)
    const tw = g.measureText(top).width
    g.fillStyle = c.ink
    g.fillText(top, SIZE - PAD - tw, y)
    g.font = font(34)
    g.fillStyle = c.muted
    g.fillText(fit(g, name(e, lang), width - tw - 32), PAD, y)
    y += 60
  }
  if (w.entries.length > rows.length) {
    g.font = font(28)
    g.fillStyle = c.muted
    g.fillText(`+${w.entries.length - rows.length}`, PAD, y)
  }

  g.fillStyle = c.ink
  g.font = font(38, 800)
  g.fillText(BRAND, PAD, SIZE - 96)
  return canvas
}

const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))

/** Share the card as a file where the browser can, download it otherwise. */
export async function shareCard(w: Workout, f: Fmt): Promise<'shared' | 'saved' | 'failed'> {
  const blob = await toBlob(renderCard(w, f))
  if (!blob) return 'failed'
  const fileName = `gym-dtwin-${w.date}.png`
  const file = new File([blob], fileName, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: w.name, text: BRAND })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'saved'
}

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { linePath, linear, nearestIndex, niceTicks, timeTicks } from './scale'
import { useWidth } from './useWidth'

export interface ChartPoint {
  x: number
  y: number
  mark?: boolean
}

export interface Series {
  key: string
  label: string
  points: ChartPoint[]
  /** Second line: quieter colour. */
  soft?: boolean
}

interface Props {
  series: Series[]
  /** One-sentence summary for screen readers. */
  label: string
  formatY: (v: number) => string
  /** Axis label of a time. */
  formatX: (t: number) => string
  /** Readout heading of a time. */
  formatFull: (t: number) => string
  target?: { y: number; label: string }
  height?: number
  compact?: boolean
}

const DAY = 86_400_000
const YTICKS = 4

export default function LineChart({ series, label, formatY, formatX, formatFull, target, height = 200, compact = false }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const m = compact ? { l: 4, r: 4, t: 6, b: 4 } : { l: 44, r: 12, t: 10, b: 24 }
  const xs = useMemo(() => [...new Set(series.flatMap(s => s.points.map(p => p.x)))].sort((a, b) => a - b), [series])
  const ys = series.flatMap(s => s.points.map(p => p.y))
  if (target) ys.push(target.y)
  if (xs.length === 0) return null

  const yt = niceTicks(Math.min(...ys), Math.max(...ys), YTICKS)
  const y0 = compact ? Math.min(...ys) : yt[0]
  const y1 = compact ? Math.max(...ys) : yt[yt.length - 1]
  const x0 = xs[0] === xs[xs.length - 1] ? xs[0] - DAY : xs[0]
  const x1 = xs[0] === xs[xs.length - 1] ? xs[0] + DAY : xs[xs.length - 1]
  const sx = linear(x0, x1, m.l, width - m.r)
  const sy = linear(y0, y1, height - m.b, m.t)
  const maxXTicks = Math.max(2, Math.min(6, Math.floor(width / 90)))
  const shown = active != null ? xs[active] : null

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const at = x0 + ((e.clientX - box.left - m.l) / Math.max(1, width - m.l - m.r)) * (x1 - x0)
    setActive(nearestIndex(xs, at))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowLeft' ? -1 : 1
    setActive(a => Math.max(0, Math.min(xs.length - 1, (a ?? (step < 0 ? xs.length : -1)) + step)))
  }

  const tipLeft = shown != null ? Math.min(Math.max(sx(shown), 70), Math.max(70, width - 70)) : 0

  return (
    <div className={`lc${compact ? ' compact' : ''}`} ref={ref}>
      <svg
        width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} tabIndex={0}
        onPointerMove={pick} onPointerDown={pick} onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null) }}
        onKeyDown={onKey} onBlur={() => setActive(null)}
      >
        {!compact && yt.map(v => (
          <g key={v} className="lc-grid">
            <line x1={m.l} x2={width - m.r} y1={sy(v)} y2={sy(v)} />
            <text x={m.l - 6} y={sy(v) + 4} textAnchor="end">{formatY(v)}</text>
          </g>
        ))}
        {!compact && timeTicks(x0, x1, maxXTicks).map(v => (
          <text key={v} className="lc-x" x={sx(v)} y={height - 6} textAnchor="middle">{formatX(v)}</text>
        ))}
        {target && (
          <g className="lc-target">
            <line x1={m.l} x2={width - m.r} y1={sy(target.y)} y2={sy(target.y)} />
            {!compact && <text x={width - m.r} y={sy(target.y) - 5} textAnchor="end">{target.label}</text>}
          </g>
        )}
        {series.map(s => {
          const pts = s.points.map((p): [number, number] => [sx(p.x), sy(p.y)])
          return (
            <g key={s.key} className={`lc-series${s.soft ? ' soft' : ''}`}>
              {pts.length > 1 && <path d={linePath(pts)} />}
              {(pts.length <= 40 || compact) && pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={compact ? 2 : 2.5} />)}
              {s.points.map((p, i) => p.mark && <path key={`m${i}`} className="lc-mark" d={`M${pts[i][0]} ${pts[i][1] - 7}l6 7l-6 7l-6 -7z`} />)}
            </g>
          )
        })}
        {shown != null && <line className="lc-cursor" x1={sx(shown)} x2={sx(shown)} y1={m.t} y2={height - m.b} />}
        {shown != null && series.map(s => {
          const p = s.points.find(q => q.x === shown)
          return p ? <circle key={s.key} className={`lc-dot${s.soft ? ' soft' : ''}`} cx={sx(p.x)} cy={sy(p.y)} r={4.5} /> : null
        })}
      </svg>
      {shown != null && (
        <div className="lc-tip" style={{ left: tipLeft }} role="status">
          <b>{formatFull(shown)}</b>
          {series.map(s => {
            const p = s.points.find(q => q.x === shown)
            return p ? <span key={s.key} className={s.soft ? 'soft' : ''}>{series.length > 1 || !compact ? `${s.label}: ` : ''}{formatY(p.y)}{p.mark ? ' · PR' : ''}</span> : null
          })}
        </div>
      )}
    </div>
  )
}

import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import type { HeatDay } from '../stats'

const CELL = 12
const GAP = 2
const LEFT = 26
const TOP = 16

interface Props {
  weeks: HeatDay[][]
  label: string
  selected: string | null
  onPick: (date: string) => void
  /** Month name of a date in the top row. */
  monthName: (date: string) => string
  /** Weekday name by row. */
  dayName: (row: number) => string
  /** Hover text of one day. */
  dayText: (d: HeatDay) => string
}

export default function Heatmap({ weeks, label, selected, onPick, monthName, dayName, dayText }: Props) {
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (box.current) box.current.scrollLeft = box.current.scrollWidth }, [])

  const days = weeks.flat().filter(d => !d.future)
  const width = LEFT + weeks.length * (CELL + GAP)
  const height = TOP + 7 * (CELL + GAP)

  const onKey = (e: KeyboardEvent) => {
    const move: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
    const step = move[e.key]
    if (step == null) return
    e.preventDefault()
    const at = days.findIndex(d => d.date === selected)
    const next = days[Math.max(0, Math.min(days.length - 1, (at < 0 ? days.length - 1 : at + step)))]
    if (next) onPick(next.date)
  }

  return (
    <div className="hm" ref={box}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} tabIndex={0} onKeyDown={onKey}>
        {weeks.map((w, c) => {
          const first = w[0].date
          const newMonth = c > 0 ? first.slice(0, 7) !== weeks[c - 1][0].date.slice(0, 7) : false
          return newMonth && c < weeks.length - 1 ? <text key={c} className="hm-label" x={LEFT + c * (CELL + GAP)} y={10}>{monthName(first)}</text> : null
        })}
        {[0, 2, 4, 6].map(r => <text key={r} className="hm-label" x={0} y={TOP + r * (CELL + GAP) + 10}>{dayName(r)}</text>)}
        {weeks.map((w, c) => w.map((d, r) => (
          d.future ? null : (
            <rect
              key={d.date} className={`hm-cell l${d.level}${d.date === selected ? ' sel' : ''}`}
              x={LEFT + c * (CELL + GAP)} y={TOP + r * (CELL + GAP)} width={CELL} height={CELL} rx={2.5}
              onClick={() => onPick(d.date)}
            ><title>{dayText(d)}</title></rect>
          )
        )))}
      </svg>
    </div>
  )
}

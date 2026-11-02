import { linear } from './scale'
import { useWidth } from './useWidth'

const HEIGHT = 150
const TOP = 20
const BOTTOM = 24
const GAP = 8

/** Columns with the value written on each, so nothing hides behind a hover. */
export default function Bars({ items, label }: { items: { label: string; value: number; title?: string }[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const max = Math.max(1, ...items.map(i => i.value))
  const sy = linear(0, max, HEIGHT - BOTTOM, TOP)
  const w = Math.max(4, (width - GAP * (items.length - 1)) / items.length)
  return (
    <div className="bars" ref={ref}>
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={label}>
        {items.map((it, i) => {
          const x = i * (w + GAP)
          const top = sy(it.value)
          return (
            <g key={it.label}>
              <rect className="bar" x={x} y={top} width={w} height={Math.max(1, HEIGHT - BOTTOM - top)} rx={4}>
                {it.title && <title>{it.title}</title>}
              </rect>
              <text className="bar-v" x={x + w / 2} y={top - 5} textAnchor="middle">{it.value}</text>
              <text className="bar-l" x={x + w / 2} y={HEIGHT - 7} textAnchor="middle">{it.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

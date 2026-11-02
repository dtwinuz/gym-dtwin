import body from './data/body.json'

type Side = 'front' | 'back'
type Figure = 'male' | 'female'
interface View { vb: number[]; parts: Record<string, string[]> }
const BODY = body as Record<Figure, Record<Side, View>>

/** Catalogue muscle -> MuscleMap regions. */
export const MUSCLE_REGIONS: Record<string, string[]> = {
  chest: ['chest'],
  shoulders: ['deltoids'],
  triceps: ['triceps'],
  biceps: ['biceps'],
  forearms: ['forearm'],
  neck: ['neck'],
  traps: ['trapezius'],
  lats: ['upperBack'],
  'middle back': ['rhomboids'],
  'lower back': ['lowerBack'],
  abdominals: ['abs', 'obliques'],
  glutes: ['gluteal'],
  quadriceps: ['quadriceps'],
  hamstrings: ['hamstring'],
  adductors: ['adductors'],
  abductors: ['gluteal'],
  calves: ['calves'],
}

const REGION_MUSCLE: Record<string, string> = {}
for (const [m, regions] of Object.entries(MUSCLE_REGIONS)) for (const r of regions) REGION_MUSCLE[r] ??= m

const PASSIVE = new Set(['head', 'hair', 'hands', 'feet', 'knees', 'ankles'])

export interface BodyMapProps {
  /** Muscle -> intensity 0..1. */
  levels: Record<string, number>
  side?: Side | 'both'
  figure?: Figure
  selected?: string | null
  onPick?: (muscle: string) => void
  className?: string
  label?: string
}

function regionLevels(levels: Record<string, number>) {
  const out: Record<string, number> = {}
  for (const [m, v] of Object.entries(levels)) for (const r of MUSCLE_REGIONS[m] ?? []) out[r] = Math.max(out[r] ?? 0, v)
  return out
}

function Figure1({ view, rl, selected, onPick }: { view: View; rl: Record<string, number>; selected?: string | null; onPick?: (m: string) => void }) {
  const [x, y, w, h] = view.vb
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-hidden={!onPick}>
      {Object.entries(view.parts).map(([slug, paths]) => {
        const muscle = REGION_MUSCLE[slug]
        const v = rl[slug] ?? 0
        const passive = PASSIVE.has(slug) || !muscle
        const cls = passive ? 'bm-passive' : v > 0 ? 'bm-on' : 'bm-off'
        const sel = muscle && selected === muscle
        return (
          <g
            key={slug}
            className={`${cls}${sel ? ' bm-sel' : ''}${onPick && muscle ? ' bm-pick' : ''}`}
            style={v > 0 ? { fillOpacity: 0.35 + 0.65 * v } : undefined}
            onClick={onPick && muscle ? () => onPick(muscle) : undefined}
          >
            {paths.map((d, i) => <path key={i} d={d} />)}
          </g>
        )
      })}
    </svg>
  )
}

export default function BodyMap({ levels, side = 'both', figure = 'male', selected, onPick, className, label }: BodyMapProps) {
  const rl = regionLevels(levels)
  const sides: Side[] = side === 'both' ? ['front', 'back'] : [side]
  return (
    <div className={`bodymap ${className ?? ''}`} aria-label={label}>
      {sides.map(s => <Figure1 key={s} view={BODY[figure][s]} rl={rl} selected={selected} onPick={onPick} />)}
    </div>
  )
}

/** Primary muscles at full intensity, secondary at 40 %. */
export function exerciseLevels(p: string[], s: string[]) {
  const out: Record<string, number> = {}
  for (const m of s) out[m] = 0.4
  for (const m of p) out[m] = 1
  return out
}

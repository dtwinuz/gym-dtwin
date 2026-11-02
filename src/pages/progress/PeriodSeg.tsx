import { t, type Lang } from '../../i18n'
import { PERIODS, type Period } from '../../app/stats'

const SHORT: Record<Exclude<Period, 'all'>, string> = { '1m': '1M', '3m': '3M', '1y': '1Y' }

export default function PeriodSeg({ value, onPick, lang, options = PERIODS }: { value: Period; onPick: (p: Period) => void; lang: Lang; options?: Period[] }) {
  return (
    <div className="seg mode-seg" role="radiogroup" aria-label={t(lang, 'period')}>
      {options.map(p => (
        <button type="button" key={p} role="radio" aria-checked={p === value} className={p === value ? 'on' : ''} onClick={() => onPick(p)}>
          {p === 'all' ? t(lang, 'all') : SHORT[p]}
        </button>
      ))}
    </div>
  )
}

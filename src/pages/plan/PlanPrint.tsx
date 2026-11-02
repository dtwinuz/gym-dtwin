import { ArrowLeft, Printer } from 'lucide-react'
import { t, type Key } from '../../i18n'
import { weekdayName } from '../../app/format'
import { orderedWeekdays } from '../../app/plan'
import { useCustomExercises } from '../../app/routineMap'
import { slotTarget } from '../../app/slotText'
import { useProfile } from '../../app/store'
import { exerciseById, exerciseName } from '../../catalogue'
import { REST } from '../../core/schedule'
import { formatWeight } from '../../core/units'

export default function PlanPrint() {
  const p = useProfile()
  const { lang, unit, wdec, weekStart } = p.settings
  const L = (k: Key) => t(lang, k)
  useCustomExercises(p.customEx)
  const nameOf = (id: string) => (id === REST ? L('rest') : p.routines.find(r => r.id === id)?.name ?? '?')
  const loop = p.scheduleMode === 'rotation' && p.rotation

  return (
    <div className="print-view">
      <div className="row wrap no-print">
        <a className="btn" href="#/plan/routines"><ArrowLeft size={18} />{L('backToPlan')}</a>
        <button type="button" className="btn primary" onClick={() => window.print()}><Printer size={18} />{L('print')}</button>
      </div>
      <h1>gym.dtwin · {L('plan')}</h1>
      {p.routines.length === 0 && <p className="muted">{L('noRoutines')}</p>}

      <section className="print-block">
        <h2>{L('tabSchedule')}</h2>
        {loop ? (
          <p>{loop.sequence.map(nameOf).join(' → ')}</p>
        ) : (
          <table className="print-table">
            <tbody>
              {orderedWeekdays(weekStart).map(d => (
                <tr key={d}>
                  <th scope="row">{weekdayName(d, lang)}</th>
                  <td>{(p.week[d] ?? []).map(nameOf).join(', ') || L('rest')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {p.routines.map(r => (
        <section key={r.id} className="print-block">
          <h2>{r.name}</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th scope="col">{L('exercises')}</th>
                <th scope="col">{L('sets')}</th>
                <th scope="col">{L('weightLabel')}</th>
                <th scope="col">{L('rest')}</th>
              </tr>
            </thead>
            <tbody>
              {r.ex.map((s, i) => (
                <tr key={`${s.exId}-${i}`}>
                  <td>
                    {s.sg ? `[${s.sg.toUpperCase()}] ` : ''}{exerciseName(exerciseById(s.exId), lang)}
                    {s.note && <small className="print-note">{s.note}</small>}
                  </td>
                  <td>{slotTarget(s, lang)}</td>
                  <td>{s.weight > 0 ? `${formatWeight(s.weight, wdec)} ${unit}` : s.bodyweight ? L('loadBw') : ''}</td>
                  <td>{s.restOff || s.restSec == null ? '' : `${s.restSec} ${L('secShort')}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}

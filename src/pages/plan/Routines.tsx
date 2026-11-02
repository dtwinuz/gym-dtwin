import { Copy, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { t, type Key } from '../../i18n'
import { copyRoutine, newId, planSnapshot, removeRoutine } from '../../app/plan'
import { slotLevels } from '../../app/routineMap'
import { updateProfile, upsert, useProfile } from '../../app/store'
import { toast } from '../../app/toast'
import BodyMap from '../../catalogue/BodyMap'
import { exerciseById, exerciseName } from '../../catalogue'

export default function Routines() {
  const p = useProfile()
  const { lang, body } = p.settings
  const L = (k: Key) => t(lang, k)

  const create = () => {
    const id = newId()
    upsert('routines', { id, name: L('newRoutine'), prog: 'double', ex: [], updatedAt: Date.now() })
    location.hash = `#/plan/routine/${id}`
  }
  const del = (id: string) => {
    const before = planSnapshot(p)
    updateProfile(x => removeRoutine(x, id))
    toast(L('routineDeleted'), { label: L('undo'), run: () => updateProfile(x => ({ ...x, ...before })) })
  }
  const copy = (id: string) => {
    updateProfile(x => copyRoutine(x, id, L('copySuffix')))
    toast(L('routineCopied'))
  }

  return (
    <>
      <div className="grid routine-grid">
        {p.routines.map(r => (
          <article key={r.id} className="card routine-card">
            <header>
              <span className="glyph">{r.glyph || (r.name[0] ?? '?').toUpperCase()}</span>
              <div className="routine-title">
                <h2>{r.name || '?'}</h2>
                <p className="muted">{r.ex.length} {L('exCount')} · {r.ex.reduce((n, s) => n + s.sets, 0)} {L('setsShort')}</p>
              </div>
            </header>
            <div className="routine-body">
              <BodyMap levels={slotLevels(r.ex)} figure={body} className="mini-map" label={L('muscleMap')} />
              <p className="muted routine-ex">{r.ex.slice(0, 6).map(s => exerciseName(exerciseById(s.exId), lang)).join(' · ')}{r.ex.length > 6 ? ' …' : ''}</p>
            </div>
            <div className="routine-actions">
              <a className="btn small primary" href={`#/workout?routine=${encodeURIComponent(r.id)}`}><Play size={16} />{L('start')}</a>
              <a className="btn small" href={`#/plan/routine/${encodeURIComponent(r.id)}`}><Pencil size={16} />{L('edit')}</a>
              <button type="button" className="icon-btn" aria-label={L('copy')} title={L('copy')} onClick={() => copy(r.id)}><Copy size={18} /></button>
              <button type="button" className="icon-btn" aria-label={L('remove')} title={L('remove')} onClick={() => del(r.id)}><Trash2 size={18} /></button>
            </div>
          </article>
        ))}
      </div>
      <div className="row"><button type="button" className="btn" onClick={create}><Plus size={18} />{L('newRoutine')}</button></div>
    </>
  )
}

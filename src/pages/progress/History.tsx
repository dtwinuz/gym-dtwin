import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Download, Plus, Search, Trophy } from 'lucide-react'
import { t, type Key } from '../../i18n'
import { fmtDate, fmtNum } from '../../app/format'
import { matchesLabels } from '../../app/match'
import { hashQuery } from '../../app/nav'
import { blankWorkout } from '../../app/records'
import { workoutMinutes } from '../../app/session'
import { recordsOf, shareCard } from '../../app/share'
import { toast } from '../../app/toast'
import { exerciseById, exerciseName } from '../../catalogue'
import { isoDate, setsDone, sortByStart } from '../../core/history'
import type { Profile, Workout } from '../../core/types'
import WorkoutEditor from './WorkoutEditor'
import WorkoutSheet from './WorkoutSheet'

const askedId = () => hashQuery().get('w')

function clearAsked() {
  if (location.hash.includes('?')) history.replaceState(history.state, '', '#/progress/history')
}

export default function History({ p }: { p: Profile }) {
  const { settings, workouts } = p
  const { lang, unit } = settings
  const L = (k: Key) => t(lang, k)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(askedId)
  const [editing, setEditing] = useState<{ w: Workout; isNew: boolean } | null>(null)

  useLayoutEffect(clearAsked, [])

  useEffect(() => {
    const on = () => {
      const id = askedId()
      if (id) {
        setOpenId(id)
        clearAsked()
      }
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const groups = useMemo(() => {
    const out: { month: string; items: Workout[] }[] = []
    for (const w of sortByStart(workouts).reverse()) {
      const labels = [w.name, w.note ?? '', w.date, ...w.entries.flatMap(e => {
        const x = exerciseById(e.exId)
        return [x?.n ?? '', x?.uz ?? '', x?.ru ?? '', e.note ?? '']
      })]
      if (!matchesLabels(labels, q)) continue
      const month = w.date.slice(0, 7)
      const last = out.at(-1)
      if (last?.month === month) last.items.push(w)
      else out.push({ month, items: [w] })
    }
    return out
  }, [workouts, q])

  const open = openId ? workouts.find(w => w.id === openId) : undefined

  return (
    <>
      <div className="row between history-bar">
        <div className="searchbox grow">
          <Search size={18} />
          <input className="input" type="search" value={q} placeholder={L('searchHistory')} aria-label={L('searchHistory')} onChange={e => setQ(e.target.value)} />
        </div>
        <button type="button" className="btn" data-add-past onClick={() => setEditing({ w: blankWorkout(L('paperWorkout'), isoDate(new Date())), isNew: true })}><Plus size={16} />{L('addPast')}</button>
      </div>

      {workouts.length === 0 && <section className="card empty"><p>{L('empty')}</p></section>}
      {workouts.length > 0 && groups.length === 0 && <section className="card empty"><p>{L('noResults')}</p></section>}

      {groups.map(g => (
        <section key={g.month} className="card history-month">
          <h2>{fmtDate(`${g.month}-01`, lang, { month: 'long', year: 'numeric' })}</h2>
          <ul className="recent-list">
            {g.items.map(w => (
              <li key={w.id}>
                <div className="recent-head">
                  <button type="button" className="history-open" data-open-workout={w.id} onClick={() => setOpenId(w.id)}>
                    <b>{w.name}{recordsOf(w).length > 0 && <Trophy size={14} className="pr" aria-label="PR" />}</b>
                    <span className="muted">
                      {fmtDate(w.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })} · {setsDone(w.entries)} {L('setsShort')} · {fmtNum(w.vol, lang, 0)} {unit}{workoutMinutes(w) > 0 ? ` · ${workoutMinutes(w)} ${L('minShort')}` : ''}
                    </span>
                  </button>
                  <button
                    type="button" className="icon-btn" aria-label={L('shareImage')}
                    onClick={async () => {
                      const r = await shareCard(w, settings)
                      if (r === 'saved') toast(L('cardSaved'))
                      if (r === 'failed') toast(L('cardFailed'))
                    }}
                  ><Download size={16} /></button>
                </div>
                {w.note && <p className="recent-note">{w.note}</p>}
                {w.entries.filter(e => e.note).map((e, i) => <p key={i} className="muted recent-note">{exerciseName(exerciseById(e.exId), lang)}: {e.note}</p>)}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {open && <WorkoutSheet p={p} w={open} onClose={() => setOpenId(null)} onEdit={() => { setOpenId(null); setEditing({ w: open, isNew: false }) }} />}
      {editing && <WorkoutEditor p={p} initial={editing.w} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </>
  )
}

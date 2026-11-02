import { useState } from 'react'
import { X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import { PROGRAMS, type InstallMode, type Program } from '../../app/programs'
import { slotTarget } from '../../app/slotText'
import { useProfile } from '../../app/store'
import { exerciseById, exerciseName } from '../../catalogue'
import { LEVEL_NAME, label } from '../../catalogue/labels'
import { runInstall } from './install'

export function InstallAsk({ onPick, onClose }: { onPick: (mode: InstallMode) => void; onClose: () => void }) {
  const { lang } = useProfile().settings
  const L = (k: Key) => t(lang, k)
  return (
    <Sheet onClose={onClose} label={L('installAsk')} className="form confirm">
      <header className="sheet-head"><h2>{L('installAsk')}</h2></header>
      <p>{L('installAskText')}</p>
      <div className="row wrap">
        <button type="button" className="btn primary" onClick={() => onPick('replace')}>{L('replace')}</button>
        <button type="button" className="btn" onClick={() => onPick('add')}>{L('add')}</button>
        <button type="button" className="btn" onClick={onClose}>{L('cancel')}</button>
      </div>
    </Sheet>
  )
}

export function ProgramBadges({ program }: { program: Program }) {
  const { lang } = useProfile().settings
  return (
    <div className="tags">
      <span className="badge">{program.days} {t(lang, 'perWeek')}</span>
      <span className="badge">{label(LEVEL_NAME, program.level, lang)}</span>
      <span className="badge">{t(lang, program.place === 'home' ? 'placeHome' : 'placeGym')}</span>
    </div>
  )
}

export default function ProgramsSheet({ onClose, onInstalled, focus }: { onClose: () => void; onInstalled?: () => void; focus?: string }) {
  const { settings: { lang }, routines } = useProfile()
  const L = (k: Key) => t(lang, k)
  const [asking, setAsking] = useState<Program | null>(null)
  const list = focus ? [...PROGRAMS].sort((a, b) => Number(b.id === focus) - Number(a.id === focus)) : PROGRAMS

  const finish = (program: Program, mode: InstallMode) => {
    runInstall(program, mode)
    setAsking(null)
    ;(onInstalled ?? onClose)()
  }
  const install = (program: Program) => {
    if (routines.length) setAsking(program)
    else finish(program, 'replace')
  }

  return (
    <Sheet onClose={onClose} label={L('programs')} className="programs">
      <header className="sheet-head">
        <h2>{L('programs')}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>
      <div className="program-list">
        {list.map(program => (
          <article key={program.id} className="card program" data-program={program.id}>
            <h3>{program.name[lang]}</h3>
            <ProgramBadges program={program} />
            <p className="program-desc">{program.desc[lang]}</p>
            <details open={program.id === focus}>
              <summary>{program.routines.length} × {L('tabRoutines').toLowerCase()}</summary>
              {program.routines.map(r => (
                <div key={r.id} className="day">
                  <h3>{r.name[lang]}</h3>
                  <p className="muted">{r.ex.map(s => `${exerciseName(exerciseById(s.exId), lang)} ${slotTarget(s, lang)}`).join(' · ')}</p>
                </div>
              ))}
            </details>
            <div className="row"><button type="button" className="btn primary" onClick={() => install(program)}>{L('install')}</button></div>
          </article>
        ))}
      </div>
      {asking && <InstallAsk onClose={() => setAsking(null)} onPick={mode => finish(asking, mode)} />}
    </Sheet>
  )
}

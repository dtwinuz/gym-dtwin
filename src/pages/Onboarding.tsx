import { useState } from 'react'
import { X } from 'lucide-react'
import { t, type Key } from '../i18n'
import Sheet from '../app/Sheet'
import { legacyProgram, recommendProgram, type Answers, type InstallMode, type Program } from '../app/programs'
import { useProfile } from '../app/store'
import ProgramsSheet, { InstallAsk, ProgramBadges } from './plan/ProgramsSheet'
import { runInstall } from './plan/install'

const REASON: Record<string, Key> = {
  ppl: 'reasonPpl', 'upper-lower': 'reasonUpperLower', 'full-body': 'reasonFullBody', 'five-by-five': 'reasonFive',
  'beginner-machines': 'reasonMachines', 'home-dumbbells': 'reasonHome',
}

type Step = 'goal' | 'level' | 'days' | 'place' | 'result'

function Options<T extends string | number>({ title, options, onPick }: { title: string; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <div className="ob-step">
      <h3>{title}</h3>
      <div className="ob-options">
        {options.map(([v, l]) => <button type="button" key={String(v)} className="btn" onClick={() => onPick(v)}>{l}</button>)}
      </div>
    </div>
  )
}

export default function Onboarding({ onClose }: { onClose: () => void }) {
  const { settings: { lang }, routines, planId } = useProfile()
  const L = (k: Key) => t(lang, k)
  const legacy = routines.length ? undefined : legacyProgram(planId)
  const [step, setStep] = useState<Step>(legacy ? 'result' : 'goal')
  const [answers, setAnswers] = useState<Partial<Answers>>({})
  const [programs, setPrograms] = useState(false)
  const [asking, setAsking] = useState(false)

  const pick = (patch: Partial<Answers>, next: Step) => {
    setAnswers(a => ({ ...a, ...patch }))
    setStep(next)
  }

  const full = answers.goal && answers.level && answers.days && answers.place ? (answers as Answers) : null
  const program: Program | undefined = full ? recommendProgram(full) : legacy
  const finish = (mode: InstallMode) => {
    if (!program) return
    runInstall(program, mode)
    setAsking(false)
    onClose()
  }

  return (
    <Sheet onClose={onClose} label={L('obTitle')} className="form onboarding">
      <header className="sheet-head">
        <h2>{L('obTitle')}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>

      {step === 'goal' && (
        <Options<Answers['goal']>
          title={L('obGoal')} onPick={goal => pick({ goal }, 'level')}
          options={[['strength', L('goalStrength')], ['muscle', L('goalMuscle')], ['fitness', L('goalFitness')]]}
        />
      )}
      {step === 'level' && (
        <Options<Answers['level']>
          title={L('obLevel')} onPick={level => pick({ level }, 'days')}
          options={[['beginner', L('levelNew')], ['intermediate', L('levelSeasoned')]]}
        />
      )}
      {step === 'days' && (
        <Options<number>
          title={L('obDays')} onPick={days => pick({ days }, 'place')}
          options={[2, 3, 4, 5, 6].map(n => [n, String(n)])}
        />
      )}
      {step === 'place' && (
        <Options<Answers['place']>
          title={L('obPlace')} onPick={place => pick({ place }, 'result')}
          options={[['gym', L('placeGym')], ['home', L('placeHome')]]}
        />
      )}

      {step === 'result' && program && (
        <div className="ob-step">
          <p className="muted">{L('obResult')}</p>
          <h3 className="ob-program">{program.name[lang]}</h3>
          <ProgramBadges program={program} />
          <p>{L(full ? REASON[program.id] ?? 'reasonOther' : 'reasonLegacy')}</p>
          {full && full.days !== program.days && <p className="muted">{L('obDaysNote').replace('{n}', String(program.days))}</p>}
          <p className="program-desc muted">{program.desc[lang]}</p>
          <div className="row wrap">
            <button type="button" className="btn primary" onClick={() => (routines.length ? setAsking(true) : finish('replace'))}>{L('install')}</button>
            <button type="button" className="btn" onClick={() => setPrograms(true)}>{L('programs')}</button>
            <button type="button" className="btn" onClick={() => { setAnswers({}); setStep('goal') }}>{L('obAgain')}</button>
          </div>
        </div>
      )}

      {step !== 'result' && (
        <div className="row"><button type="button" className="btn ghost" onClick={onClose}>{L('skip')}</button></div>
      )}

      {programs && <ProgramsSheet onClose={() => setPrograms(false)} onInstalled={onClose} />}
      {asking && <InstallAsk onClose={() => setAsking(false)} onPick={finish} />}
    </Sheet>
  )
}

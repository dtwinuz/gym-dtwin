import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, Layers, Printer, Send, Sparkles, Upload } from 'lucide-react'
import { t, type Key } from '../i18n'
import { weekdayName } from '../app/format'
import { downloadText } from '../app/nav'
import { planSnapshot } from '../app/plan'
import { buildPlanFile, mergePlanFile, parsePlanFile, planSummary, telegramShareUrl } from '../app/planFile'
import { useCustomExercises } from '../app/routineMap'
import { getProfile, updateProfile, useProfile } from '../app/store'
import { toast } from '../app/toast'
import Onboarding from './Onboarding'
import PlanPrint from './plan/PlanPrint'
import ProgramsSheet from './plan/ProgramsSheet'
import RoutineEditor from './plan/RoutineEditor'
import Routines from './plan/Routines'
import Schedule from './plan/Schedule'

const SHARE_URL = 'https://gym.dtwin.uz'
const MAX_FILE = 2_000_000

function Share() {
  const p = useProfile()
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  const input = useRef<HTMLInputElement>(null)
  const empty = p.routines.length === 0

  const exportFile = () => downloadText('gym-dtwin-plan.json', JSON.stringify(buildPlanFile(getProfile()), null, 2))

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const parsed = file.size <= MAX_FILE ? parsePlanFile(await file.text()) : ({ ok: false } as const)
    if (!parsed.ok) {
      toast(L('importBad'))
      return
    }
    const before = planSnapshot(getProfile())
    updateProfile(x => mergePlanFile(x, parsed.file))
    toast(L('importDone').replace('{n}', String(parsed.file.routines.length)), { label: L('undo'), run: () => updateProfile(x => ({ ...x, ...before })) })
    if (parsed.dropped.length) toast(L('importDropped').replace('{n}', String(parsed.dropped.length)))
  }

  const summary = `${L('shareIntro')}\n${planSummary(p, d => weekdayName(d, lang, 'short'), L('rest'))}`

  return (
    <section className="card">
      <h2>{L('secShare')}</h2>
      <div className="row wrap">
        {!empty && <button type="button" className="btn small" onClick={exportFile}><Download size={16} />{L('exportPlan')}</button>}
        <button type="button" className="btn small" onClick={() => input.current?.click()}><Upload size={16} />{L('importPlan')}</button>
        {!empty && <a className="btn small" href="#/plan/print"><Printer size={16} />{L('print')}</a>}
        {!empty && <a className="btn small" href={telegramShareUrl(SHARE_URL, summary)} target="_blank" rel="noopener noreferrer"><Send size={16} />{L('telegramShare')}</a>}
      </div>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={onFile} aria-label={L('importPlan')} />
    </section>
  )
}

export default function Plan() {
  const p = useProfile()
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  useCustomExercises(p.customEx)
  const [programs, setPrograms] = useState(false)
  const [onboarding, setOnboarding] = useState(false)
  const route = location.hash.slice(1).split('?')[0]
  const sub = route.split('/').slice(2)

  useEffect(() => { window.scrollTo(0, 0) }, [route])

  if (sub[0] === 'print') return <PlanPrint />
  if (sub[0] === 'routine' && sub[1]) return <RoutineEditor id={decodeURIComponent(sub[1])} />

  const onRoutines = sub[0] === 'routines'
  const empty = p.routines.length === 0

  return (
    <>
      <h1>{L('plan')}</h1>
      <nav className="tabs" aria-label={L('plan')}>
        <a href="#/plan" className={onRoutines ? '' : 'on'} aria-current={onRoutines ? undefined : 'page'}>{L('tabSchedule')}</a>
        <a href="#/plan/routines" className={onRoutines ? 'on' : ''} aria-current={onRoutines ? 'page' : undefined}>{L('tabRoutines')}</a>
      </nav>

      {empty && <div className="card empty">{L('noRoutines')}</div>}
      <div className="row wrap">
        <button type="button" className="btn small" onClick={() => setPrograms(true)}><Layers size={16} />{L('programs')}</button>
        <button type="button" className="btn small" onClick={() => setOnboarding(true)}><Sparkles size={16} />{L('helpMePick')}</button>
      </div>

      {onRoutines ? <Routines /> : !empty && <Schedule />}
      <Share />

      {programs && <ProgramsSheet onClose={() => setPrograms(false)} />}
      {onboarding && <Onboarding onClose={() => setOnboarding(false)} />}
    </>
  )
}

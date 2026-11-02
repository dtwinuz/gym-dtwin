import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { t, type Key } from '../i18n'
import Sheet from './Sheet'
import { updateSettings, useSettings } from './store'

export const SAFETY_QUESTIONS: Key[] = ['safetyQ1', 'safetyQ2', 'safetyQ3', 'safetyQ4', 'safetyQ5', 'safetyQ6']

export default function SafetyNotice({ onClose }: { onClose: () => void }) {
  const { lang } = useSettings()
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => SAFETY_QUESTIONS.map(() => null))
  const anyYes = answers.some(a => a === true)
  const allAnswered = answers.every(a => a !== null)

  const ack = () => {
    updateSettings({ safetyAck: Date.now(), safetyFlag: anyYes })
    onClose()
  }

  return (
    <Sheet onClose={onClose} label={t(lang, 'safetyTitle')} className="safety" onSubmit={ack}>
      <header className="sheet-head">
        <ShieldCheck size={22} className="safety-icon" />
        <h2>{t(lang, 'safetyTitle')}</h2>
      </header>
      <p>{t(lang, 'safetyIntro')}</p>
      <ol className="safety-qs">
        {SAFETY_QUESTIONS.map((q, i) => (
          <li key={q}>
            <span id={`sq-${i}`}>{t(lang, q)}</span>
            <div className="seg" role="radiogroup" aria-labelledby={`sq-${i}`}>
              {([true, false] as const).map(v => (
                <button
                  type="button" key={String(v)} role="radio" aria-checked={answers[i] === v}
                  className={answers[i] === v ? 'on' : ''}
                  onClick={() => setAnswers(a => a.map((x, n) => (n === i ? v : x)))}
                >
                  {t(lang, v ? 'yes' : 'no')}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {anyYes && <p className="safety-warn" role="alert">{t(lang, 'safetyYes')}</p>}
      {!anyYes && allAnswered && <p className="safety-ok">{t(lang, 'safetyNo')}</p>}
      <p className="muted">{t(lang, 'safetyFoot')}</p>
      <div className="row">
        <button type="submit" className="btn primary safety-ack">{t(lang, 'safetyAck')}</button>
        <button type="button" className="btn" onClick={onClose}>{t(lang, 'later')}</button>
      </div>
    </Sheet>
  )
}

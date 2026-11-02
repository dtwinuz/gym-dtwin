import { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import { decodeBytes, ticker } from '../../app/data/csv'
import { parseImport, type Format, type ParsedFile } from '../../app/data/formats'
import { applyImport, buildImport, defaultChoices, namesIn, NEW_EXERCISE, type Choices } from '../../app/data/importer'
import { matchNames, type NameMatch } from '../../app/data/names'
import { fmtDate } from '../../app/format'
import Sheet from '../../app/Sheet'
import { commitProfile, getProfile, useProfile } from '../../app/store'
import { toast } from '../../app/toast'
import { exerciseById, exerciseName } from '../../catalogue'
import type { Unit } from '../../core/types'
import ExercisePicker from '../plan/ExercisePicker'
import { MAX_FILE } from './Backup'

const FORMAT_NAME: Record<Exclude<Format, 'generic'>, string> = { strong: 'Strong', hevy: 'Hevy', fitnotes: 'FitNotes' }
const UNDO_MS = 15000

interface Loaded {
  file: ParsedFile
  matches: NameMatch[]
}

function Preview({ loaded, onClose }: { loaded: Loaded; onClose: () => void }) {
  const p = useProfile()
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  const { file, matches } = loaded
  const [choices, setChoices] = useState<Choices>(() => defaultChoices(matches))
  const [unit, setUnit] = useState<Unit | null>(null)
  const [changing, setChanging] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Key | null>(null)

  const defaultName = file.format === 'generic' ? t(lang, 'dataImportName') : FORMAT_NAME[file.format]
  const built = useMemo(
    () => buildImport(file, p, { choices, matches, unit: unit ?? undefined, defaultName }),
    [file, p, choices, matches, unit, defaultName],
  )
  const low = matches.filter(m => m.confidence === 'low' && built.names.has(m.name))
  const unmatched = matches.filter(m => m.confidence === 'none' && built.names.has(m.name))
  const needUnit = file.needsUnit && !unit
  const fmtName = file.format === 'generic' ? L('dataImportGeneric') : FORMAT_NAME[file.format]

  const confirm = async () => {
    setSaving(true)
    setError(null)
    const before = getProfile()
    const next = await applyImport(before, built, ticker())
    setSaving(false)
    if (!commitProfile(next)) return setError('dataErrStorage')
    toast(L('dataImportDone').replace('{n}', String(built.workouts.length)), { label: L('undo'), run: () => { commitProfile(before) } }, UNDO_MS)
    onClose()
  }

  const rowOf = (m: NameMatch) => {
    const choice = choices[m.name]
    const isNew = choice === NEW_EXERCISE
    return (
      <li key={m.name} className="review-row">
        <span className="review-text">
          <b>{m.name}</b>
          <span className="muted">→ {isNew ? L('dataKeepNew') : exerciseName(exerciseById(choice), lang)}</span>
        </span>
        <span className="row-gap">
          <button type="button" className="btn small" data-review-change onClick={() => setChanging(m.name)}>{L('dataChange')}</button>
          {!isNew && <button type="button" className="btn small" data-review-new onClick={() => setChoices(c => ({ ...c, [m.name]: NEW_EXERCISE }))}>{L('dataKeepNew')}</button>}
        </span>
      </li>
    )
  }

  return (
    <Sheet onClose={onClose} label={L('dataImportTitle')} className="import-sheet">
      <header className="sheet-head">
        <h2>{L('dataImportTitle')} · {fmtName}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>
      {file.needsUnit && (
        <div className="field">
          <span>{L('dataImportUnit')}</span>
          <div className="seg" role="radiogroup" aria-label={L('dataImportUnit')}>
            {(['kg', 'lb'] as const).map(u => (
              <button type="button" key={u} role="radio" aria-checked={u === unit} data-import-unit={u} className={u === unit ? 'on' : ''} onClick={() => setUnit(u)}>{u}</button>
            ))}
          </div>
        </div>
      )}
      <ul className="list" data-import-summary>
        <li><span>{L('dataStatWorkouts')}</span><b>{built.workouts.length}</b></li>
        <li><span>{L('dataStatSets')}</span><b>{built.sets}</b></li>
        <li><span>{L('dataStatNewEx')}</span><b>{built.customEx.length}</b></li>
        <li><span>{L('dataStatSkipped')}</span><b>{built.skippedDays.length}</b></li>
        {file.bad > 0 && <li><span>{L('dataStatBad')}</span><b>{file.bad}</b></li>}
        {built.from && built.to && <li><span>{L('dataStatPeriod')}</span><b>{fmtDate(built.from, lang)} – {fmtDate(built.to, lang)}</b></li>}
      </ul>
      {low.length > 0 && (
        <section>
          <h3>{L('dataReview')}</h3>
          <p className="muted">{L('dataReviewHint')}</p>
          <ul className="review-list">{low.map(rowOf)}</ul>
        </section>
      )}
      {unmatched.length > 0 && (
        <section>
          <h3>{L('dataNewList')}</h3>
          <ul className="review-list">{unmatched.map(rowOf)}</ul>
        </section>
      )}
      {built.workouts.length === 0 && <p className="muted">{L('dataImportNothing')}</p>}
      {error && <p className="data-err" role="alert">{L(error)}</p>}
      <div className="row">
        <button type="button" className="btn primary" data-import-go disabled={needUnit || saving || built.workouts.length === 0} onClick={() => void confirm()}>
          {saving ? L('dataImportSaving') : L('dataImportGo')}
        </button>
        <button type="button" className="btn" onClick={onClose}>{L('cancel')}</button>
      </div>
      {changing && (
        <ExercisePicker
          onClose={() => setChanging(null)}
          onPick={e => {
            setChoices(c => ({ ...c, [changing]: e.id }))
            setChanging(null)
          }}
        />
      )}
    </Sheet>
  )
}

export default function ImportCsv() {
  const { settings: { lang } } = useProfile()
  const L = (k: Key) => t(lang, k)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Key | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  const pick = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    if (f.size > MAX_FILE) return setError('dataErrSize')
    setBusy(true)
    try {
      const tick = ticker()
      const text = decodeBytes(new Uint8Array(await f.arrayBuffer()))
      await tick(0)
      const file = await parseImport(text, tick)
      if (!file) return setError('dataErrFormat')
      const matches = await matchNames(namesIn(file), getProfile().customEx, tick)
      setLoaded({ file, matches })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="data-ctl">
      <div className="row wrap">
        <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? L('dataImportBusy') : L('dataImportPick')}</button>
        <input
          ref={input} data-import-input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" hidden aria-label={L('dataImportPick')}
          onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
      {error && <p className="data-err" role="alert">{L(error)}</p>}
      {loaded && <Preview loaded={loaded} onClose={() => setLoaded(null)} />}
    </div>
  )
}

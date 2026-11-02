import { t } from '../../i18n'
import { bodyCsv, download, setsCsv } from '../../app/data/export'
import { useProfile } from '../../app/store'
import { isoDate } from '../../core/history'

const CSV = 'text/csv;charset=utf-8'

export default function ExportCsv() {
  const p = useProfile()
  const { lang } = p.settings
  const day = () => isoDate(new Date())
  return (
    <div className="row wrap">
      <button type="button" className="btn" data-export-sets disabled={!p.workouts.length} onClick={() => download(`gym-dtwin-sets-${day()}.csv`, setsCsv(p), CSV)}>{t(lang, 'dataExportSets')}</button>
      <button type="button" className="btn" data-export-body disabled={!p.bodyweight.length && !p.measurements.length} onClick={() => download(`gym-dtwin-body-${day()}.csv`, bodyCsv(p), CSV)}>{t(lang, 'dataExportBody')}</button>
    </div>
  )
}

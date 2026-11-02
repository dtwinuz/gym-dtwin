import { t } from '../i18n'
import { modeOf } from '../core/progression'
import { formatWeight } from '../core/units'
import type { Settings, Slot } from '../core/types'
import type { Lang } from './profile'

export function slotTarget(s: Slot, lang: Lang): string {
  const mode = modeOf(s)
  if (mode === 'time') return `${s.sets} × ${s.sec ?? 0} ${t(lang, 'secShort')}`
  if (mode === 'cardio') return `${s.min ?? 0} ${t(lang, 'minShort')}`
  if (s.pyramid?.length) return s.pyramid.join(' / ')
  const reps = s.repsMin && s.repsMin < s.reps ? `${s.repsMin}-${s.reps}` : String(s.reps)
  return `${s.sets} × ${reps}`
}

export function slotSummary(s: Slot, { lang, unit, wdec }: Pick<Settings, 'lang' | 'unit' | 'wdec'>): string {
  const parts = [slotTarget(s, lang)]
  if (s.weight > 0) parts.push(`${s.assisted ? '-' : ''}${formatWeight(s.weight, wdec)} ${unit}`)
  else if (s.bodyweight) parts.push(t(lang, 'loadBw'))
  if (s.side) parts.push(t(lang, 'perSide'))
  if (s.intensifier) parts.push(t(lang, s.intensifier === 'dropset' ? 'dropset' : 'restpause'))
  return parts.join(' · ')
}

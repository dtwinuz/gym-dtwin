import { exerciseById } from '../../catalogue'
import { sortByStart } from '../../core/history'
import type { Profile, SetRow, Workout } from '../../core/types'
import { lengthUnit, measureKeys, toDisplayLength } from '../body'
import { timeOf } from '../records'
import { writeCsv, type Cell } from './csv'

const SET_HEAD = [
  'date', 'start_time', 'workout', 'exercise_id', 'exercise_name', 'set_number', 'set_type', 'weight', 'unit',
  'reps', 'seconds', 'minutes', 'speed', 'incline', 'rir', 'rpe', 'note',
]

const setType = (s: SetRow) => (s.warmup ? 'warmup' : s.rp ? 'restpause' : s.failure ? 'failure' : 'normal')

/** One row per logged set, a drop being a row of its own. Weights are stored in the current unit. */
export function setsCsv(p: Profile): string {
  const { unit } = p.settings
  const custom = new Map(p.customEx.map(c => [c.id, c.name]))
  const rows: Cell[][] = [SET_HEAD]
  for (const w of sortByStart(p.workouts)) rows.push(...workoutRows(w, unit, custom))
  return writeCsv(rows)
}

function workoutRows(w: Workout, unit: string, custom: Map<string, string>): Cell[][] {
  const rows: Cell[][] = []
  const head = [w.date, timeOf(w.start), w.name]
  w.entries.forEach((e, ei) => {
    const name = custom.get(e.exId) ?? exerciseById(e.exId)?.n ?? e.exId
    let n = 0
    for (const s of e.sets) {
      if (!s.done) continue
      n++
      const notes = n === 1 ? [ei === 0 ? w.note : undefined, e.note].filter(Boolean).join(' | ') : ''
      rows.push([...head, e.exId, name, n, setType(s), s.w, s.w == null ? '' : unit, s.r, s.sec, s.min, s.speed, s.incline, s.rir, s.rpe, notes])
      for (const d of s.drops ?? []) rows.push([...head, e.exId, name, n, 'drop', d.w, unit, d.r, '', '', '', '', '', '', ''])
    }
  })
  return rows
}

/** One row per date with body weight and measurements, lengths in the unit's own scale. */
export function bodyCsv(p: Profile): string {
  const { unit } = p.settings
  const keys = measureKeys(p.measurements)
  const dates = [...new Set([...p.bodyweight.map(b => b.date), ...p.measurements.map(m => m.date)])].sort()
  const weight = new Map(p.bodyweight.map(b => [b.date, b.w]))
  const measures = new Map(p.measurements.map(m => [m.date, m.values]))
  const rows: Cell[][] = [['date', 'weight', 'unit', ...keys.map(k => `${k}_${lengthUnit(unit)}`)]]
  for (const date of dates) {
    const w = weight.get(date)
    const values = measures.get(date) ?? {}
    rows.push([date, w, w == null ? '' : unit, ...keys.map(k => (values[k] == null ? '' : toDisplayLength(values[k], unit)))])
  }
  return writeCsv(rows)
}

export function download(fileName: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

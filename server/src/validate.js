export const PROFILE_KIND = 'gym-dtwin-profile'

const LISTS = {
  routines: 'id',
  workouts: 'id',
  customEx: 'id',
  bodyweight: 'date',
  measurements: 'date',
}
const DICTS = ['week', 'dayPlan', 'dayNotes', 'exWeights', 'exNotes', 'barWeights', 'plates', 'deleted', 'stamps']
const MAX_ID = 200

const isObj = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v)

/** @param {Record<string, unknown>} p */
function okProfile(p) {
  if (!isObj(p.settings) || 'photos' in p) return false
  if (typeof p.updatedAt !== 'number' || !Number.isFinite(p.updatedAt)) return false
  for (const [list, idKey] of Object.entries(LISTS)) {
    const rows = p[list]
    if (rows == null) continue
    if (!Array.isArray(rows)) return false
    for (const row of rows) {
      if (!isObj(row)) return false
      const id = row[idKey]
      if (typeof id !== 'string' || !id || id.length > MAX_ID) return false
    }
  }
  return DICTS.every(k => p[k] == null || isObj(p[k]))
}

/**
 * The body of PUT /api/data. Only the outline is checked: the client merges field by field
 * and validates what it reads back, and a full copy of its rules here would drift.
 * @param {unknown} body
 * @returns {{ baseRev: number, doc: string } | null}
 */
export function readPut(body) {
  if (!isObj(body)) return null
  const { kind, baseRev, profile } = /** @type {Record<string, unknown>} */ (body)
  if (kind !== PROFILE_KIND) return null
  if (typeof baseRev !== 'number' || !Number.isSafeInteger(baseRev) || baseRev < 0) return null
  if (!isObj(profile) || !okProfile(/** @type {Record<string, unknown>} */ (profile))) return null
  return { baseRev, doc: JSON.stringify(profile) }
}

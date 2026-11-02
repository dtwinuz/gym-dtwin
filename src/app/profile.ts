import type { CustomExercise, Ms, Profile, Routine, Settings, Workout } from '../core/types'

export type Lang = Settings['lang']

export function detectLang(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): Lang {
  for (const l of languages) {
    const code = (l ?? '').slice(0, 2).toLowerCase()
    if (code === 'uz' || code === 'ru' || code === 'en') return code
  }
  return 'uz'
}

export const DEFAULT_ACCENT = '#c6f432'

export function defaultSettings(lang: Lang = detectLang()): Settings {
  return {
    lang,
    unit: 'kg',
    wdec: 1,
    theme: 'system',
    accent: DEFAULT_ACCENT,
    body: 'male',
    restSec: 90,
    restPauseSec: 20,
    effort: 'none',
    logRef: 'last',
    startFrom: 'plan',
    workoutView: 'cards',
    collapseCompleted: true,
    weighIn: false,
    keepAwake: true,
    sound: true,
    vibrate: true,
    timerFlash: true,
    weekStart: 1,
    oneRmFormula: 'epley',
    volumeWarmups: false,
    showWeightCard: true,
    safetyAck: null,
    safetyFlag: false,
    ramadanMode: false,
    heatTips: false,
    weightGoal: 'hold',
  }
}

export function emptyProfile(now: Ms = Date.now(), lang?: Lang): Profile {
  return {
    settings: defaultSettings(lang),
    routines: [],
    week: {},
    dayPlan: {},
    dayNotes: {},
    scheduleMode: 'week',
    rotation: null,
    workouts: [],
    active: null,
    bodyweight: [],
    targetW: null,
    measurements: [],
    customEx: [],
    exWeights: {},
    exNotes: {},
    favEx: [],
    gear: null,
    barWeights: {},
    plates: {},
    deleted: {},
    updatedAt: now,
  }
}

/** Fill in anything a stored (possibly older) profile is missing. */
export function normalizeProfile(raw: Partial<Profile>, now: Ms = Date.now()): Profile {
  const base = emptyProfile(now, raw.settings?.lang)
  return { ...base, ...raw, settings: { ...base.settings, ...raw.settings } }
}

export interface ListItems {
  routines: Routine
  workouts: Workout
  customEx: CustomExercise
}
export type ListKey = keyof ListItems

export function markDeleted(p: Profile, list: string, id: string, now: Ms = Date.now()): Profile {
  return { ...p, deleted: { ...p.deleted, [list]: { ...p.deleted[list], [id]: now } } }
}

export function liftTombstone(p: Profile, list: string, id: string): Profile {
  const tomb = p.deleted[list]
  if (!tomb || !(id in tomb)) return p
  const rest = { ...tomb }
  delete rest[id]
  return { ...p, deleted: { ...p.deleted, [list]: rest } }
}

/** Insert or replace by id, stamp the item and lift any tombstone it had. */
export function upsertItem<K extends ListKey>(p: Profile, list: K, item: ListItems[K], now: Ms = Date.now()): Profile {
  const items = p[list] as ListItems[K][]
  const stamped = { ...item, updatedAt: now }
  const i = items.findIndex(x => x.id === item.id)
  const next = i < 0 ? [...items, stamped] : items.map((x, n) => (n === i ? stamped : x))
  const tomb = p.deleted[list]
  let deleted = p.deleted
  if (tomb && item.id in tomb) {
    const rest = { ...tomb }
    delete rest[item.id]
    deleted = { ...p.deleted, [list]: rest }
  }
  return { ...p, [list]: next, deleted }
}

/** Remove by id and leave a tombstone so a sync does not bring it back. */
export function deleteItem<K extends ListKey>(p: Profile, list: K, id: string, now: Ms = Date.now()): Profile {
  const items = p[list] as ListItems[K][]
  return {
    ...p,
    [list]: items.filter(x => x.id !== id),
    deleted: { ...p.deleted, [list]: { ...p.deleted[list], [id]: now } },
  }
}

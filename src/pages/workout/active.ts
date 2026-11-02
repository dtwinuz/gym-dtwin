import type { Key } from '../../i18n'
import { updateProfile } from '../../app/store'
import type { ActiveSession } from '../../core/types'
import type { Why } from '../../core/progression'

export const updateActive = (fn: (s: ActiveSession) => ActiveSession) =>
  updateProfile(p => {
    if (!p.active) return p
    const next = fn(p.active)
    return next === p.active ? p : { ...p, active: next }
  })

export const WHY_KEY: Record<Why, Key> = {
  first: 'whyFirst', plan: 'whyPlan', hold: 'whyHold', off: 'whyOff', load: 'whyLoad', reps: 'whyReps', set: 'whySet', time: 'whyTime', deload: 'whyDeload', effort: 'whyEffort',
}

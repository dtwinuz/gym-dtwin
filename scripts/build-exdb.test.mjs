import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dedupeIndex, equipKind, sameEquipment } from './build-exdb.mjs'

const base = JSON.parse(readFileSync('src/catalogue/data/exercises.json', 'utf8'))
const dupOf = dedupeIndex(base)

describe('exercises-dataset dedupe', () => {
  it('still drops obvious duplicates of free-exercise-db', () => {
    const pairs = [
      ['Barbell Romanian Deadlift', 'barbell', 'hamstrings', 'barbell', 'Romanian_Deadlift'],
      ['Dumbbell Hammer Curl', 'dumbbell', 'biceps', 'dumbbell', 'Hammer_Curls'],
      ['Lever Leg Extension', 'machine', 'quadriceps', 'leverage machine', 'Leg_Extensions'],
      ['Lever Shoulder Press', 'machine', 'shoulders', 'leverage machine', 'Leverage_Shoulder_Press'],
      ['Smith Bench Press', 'machine', 'chest', 'smith machine', 'Smith_Machine_Bench_Press'],
      ['Sled Hack Squat', 'machine', 'glutes', 'sled machine', 'Hack_Squat'],
      ['Kettlebell Goblet Squat', 'kettlebell', 'quadriceps', 'kettlebell', 'Goblet_Squat'],
      ['Cable Straight Arm Pulldown', 'cable', 'lats', 'cable', 'Straight-Arm_Pulldown'],
      ['Weighted Pull-up', 'other', 'lats', 'weighted', 'Weighted_Pull_Ups'],
    ]
    for (const [n, eq, p0, raw, id] of pairs) expect(dupOf(n, eq, p0, raw), n).toBe(id)
  })

  it('keeps different movements on different equipment', () => {
    const kept = [
      ['Smith Shoulder Press', 'machine', 'shoulders', 'smith machine'],
      ['Smith Shrug', 'machine', 'traps', 'smith machine'],
      ['Smith Hack Squat', 'machine', 'glutes', 'smith machine'],
      ['Smith Machine Bicep Curl', 'machine', 'biceps', 'smith machine'],
      ['Lever Bent over Row', 'barbell', 'middle back', 'barbell'],
      ['Weighted Muscle Up', 'other', 'lats', 'weighted'],
      ['Weighted Donkey Calf Raise', 'other', 'calves', 'weighted'],
      ['Barbell Reverse Close-grip Bench Press', 'barbell', 'triceps', 'barbell'],
      ['Dumbbell One Arm Hammer Preacher Curl', 'dumbbell', 'biceps', 'dumbbell'],
    ]
    for (const [n, eq, p0, raw] of kept) expect(dupOf(n, eq, p0, raw), n).toBeUndefined()
  })

  it('never treats smith, leverage machine and cable as the same equipment', () => {
    const smith = equipKind('Smith Shoulder Press', 'machine', 'smith machine')
    const lever = equipKind('Leverage Shoulder Press', 'machine')
    const sled = equipKind('Sled Hack Squat', 'machine', 'sled machine')
    expect([smith, lever, sled]).toEqual(['smith', 'lever', 'sled'])
    expect(sameEquipment(smith, lever)).toBe(false)
    expect(sameEquipment(smith, 'machine')).toBe(false)
    expect(sameEquipment(lever, sled)).toBe(false)
    expect(sameEquipment(lever, 'cable')).toBe(false)
    expect(sameEquipment(lever, 'machine')).toBe(true)
    expect(dupOf('Cable Shoulder Press', 'cable', 'shoulders', 'cable')).toBe('Cable_Shoulder_Press')
    expect(dupOf('Lever Shoulder Press', 'machine', 'shoulders', 'leverage machine')).not.toBe('Cable_Shoulder_Press')
  })
})

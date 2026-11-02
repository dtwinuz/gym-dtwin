/** Sample exercises and plans shown on the landing page only. */
export type Muscle = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'

export interface Exercise {
  id: string
  name: string
  muscle: Muscle
  equipment: Equipment
}

export interface PlanItem {
  exId: string
  sets: number
  reps: number
}

export interface PlanDay {
  name: string
  items: PlanItem[]
}

export interface Plan {
  id: string
  name: string
  days: PlanDay[]
}

export const MUSCLES: Muscle[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']

const ex = (id: string, name: string, muscle: Muscle, equipment: Equipment): Exercise => ({ id, name, muscle, equipment })

export const EXERCISES: Exercise[] = [
  ex('bench', 'Bench press', 'chest', 'barbell'),
  ex('incline-db', 'Incline dumbbell press', 'chest', 'dumbbell'),
  ex('fly', 'Cable fly', 'chest', 'cable'),
  ex('dips', 'Dips', 'chest', 'bodyweight'),
  ex('pushup', 'Push-up', 'chest', 'bodyweight'),
  ex('deadlift', 'Deadlift', 'back', 'barbell'),
  ex('row', 'Barbell row', 'back', 'barbell'),
  ex('pullup', 'Pull-up', 'back', 'bodyweight'),
  ex('lat', 'Lat pulldown', 'back', 'cable'),
  ex('seated-row', 'Seated cable row', 'back', 'cable'),
  ex('db-row', 'One-arm dumbbell row', 'back', 'dumbbell'),
  ex('squat', 'Back squat', 'legs', 'barbell'),
  ex('front-squat', 'Front squat', 'legs', 'barbell'),
  ex('rdl', 'Romanian deadlift', 'legs', 'barbell'),
  ex('leg-press', 'Leg press', 'legs', 'machine'),
  ex('lunge', 'Walking lunge', 'legs', 'dumbbell'),
  ex('leg-curl', 'Leg curl', 'legs', 'machine'),
  ex('calf', 'Calf raise', 'legs', 'machine'),
  ex('ohp', 'Overhead press', 'shoulders', 'barbell'),
  ex('db-shoulder', 'Dumbbell shoulder press', 'shoulders', 'dumbbell'),
  ex('lateral', 'Lateral raise', 'shoulders', 'dumbbell'),
  ex('face-pull', 'Face pull', 'shoulders', 'cable'),
  ex('curl', 'Barbell curl', 'arms', 'barbell'),
  ex('hammer', 'Hammer curl', 'arms', 'dumbbell'),
  ex('pushdown', 'Triceps pushdown', 'arms', 'cable'),
  ex('skull', 'Skull crusher', 'arms', 'barbell'),
  ex('plank', 'Plank (soniya)', 'core', 'bodyweight'),
  ex('hanging-raise', 'Hanging leg raise', 'core', 'bodyweight'),
  ex('cable-crunch', 'Cable crunch', 'core', 'cable'),
]

export const exerciseById = (id: string) => EXERCISES.find(e => e.id === id)

const it = (exId: string, sets: number, reps: number): PlanItem => ({ exId, sets, reps })

export const PLANS: Plan[] = [
  {
    id: 'ppl', name: 'Push / Pull / Legs',
    days: [
      { name: 'Push', items: [it('bench', 4, 6), it('ohp', 3, 8), it('incline-db', 3, 10), it('lateral', 3, 15), it('pushdown', 3, 12)] },
      { name: 'Pull', items: [it('deadlift', 3, 5), it('pullup', 4, 8), it('row', 3, 8), it('face-pull', 3, 15), it('curl', 3, 10)] },
      { name: 'Legs', items: [it('squat', 4, 6), it('rdl', 3, 8), it('leg-press', 3, 12), it('leg-curl', 3, 12), it('calf', 4, 15)] },
    ],
  },
  {
    id: 'upper-lower', name: 'Upper / Lower',
    days: [
      { name: 'Upper A', items: [it('bench', 4, 6), it('row', 4, 8), it('ohp', 3, 8), it('lat', 3, 10), it('hammer', 3, 12)] },
      { name: 'Lower A', items: [it('squat', 4, 6), it('rdl', 3, 8), it('lunge', 3, 10), it('calf', 4, 15), it('plank', 3, 45)] },
      { name: 'Upper B', items: [it('incline-db', 4, 8), it('pullup', 4, 8), it('db-shoulder', 3, 10), it('seated-row', 3, 10), it('skull', 3, 12)] },
      { name: 'Lower B', items: [it('deadlift', 3, 5), it('front-squat', 3, 8), it('leg-curl', 3, 12), it('hanging-raise', 3, 12)] },
    ],
  },
  {
    id: 'full-body', name: 'Full Body',
    days: [
      { name: 'Full A', items: [it('squat', 3, 8), it('bench', 3, 8), it('row', 3, 8), it('plank', 3, 30)] },
      { name: 'Full B', items: [it('deadlift', 3, 5), it('ohp', 3, 8), it('lat', 3, 10), it('cable-crunch', 3, 15)] },
    ],
  },
  {
    id: '5x5', name: '5×5',
    days: [
      { name: 'A', items: [it('squat', 5, 5), it('bench', 5, 5), it('row', 5, 5)] },
      { name: 'B', items: [it('squat', 5, 5), it('ohp', 5, 5), it('deadlift', 1, 5)] },
    ],
  },
]

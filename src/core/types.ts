export type Unit = 'kg' | 'lb'
export type Mode = 'reps' | 'time' | 'cardio'
export type Policy = 'off' | 'linear' | 'greyskull' | 'double' | 'triple' | 'time'
export type Effort = 'none' | 'rir' | 'rpe'
export type Intensifier = 'dropset' | 'restpause'
/** YYYY-MM-DD in local time. */
export type ISODate = string
export type Ms = number

/** A planned exercise inside a routine: the target, not the log. */
export interface Slot {
  exId: string
  mode?: Mode
  sets: number
  reps: number
  /** Bottom of a rep range (double/triple progression); `reps` is the top. */
  repsMin?: number
  setsMax?: number
  sec?: number
  min?: number
  speed?: number
  incline?: number
  weight: number
  prog?: Policy
  inc?: number
  deloadFactor?: number
  bodyweight?: boolean
  assisted?: boolean
  side?: boolean
  warmups?: number
  restSec?: number
  restOff?: boolean
  /** Superset group id; contiguous slots with the same id form one superset. */
  sg?: string
  intensifier?: Intensifier
  dropCount?: number
  dropPct?: number
  pyramid?: (number | 'max')[]
  /** Planned backup exercises, max 5. */
  subs?: string[]
  note?: string
}

export interface Routine {
  id: string
  name: string
  glyph?: string
  prog?: Policy
  ex: Slot[]
  updatedAt: Ms
}

export interface Drop {
  w: number
  r: number
}

export interface SetRow {
  w?: number
  r?: number
  sec?: number
  min?: number
  speed?: number
  incline?: number
  done: boolean
  warmup?: boolean
  failure?: boolean
  rir?: number
  rpe?: number
  drops?: Drop[]
  /** Per-side logging: aggregate r = L + R, w = max, done = both. */
  sides?: { L: SideRow; R: SideRow }
}

export interface SideRow {
  w?: number
  r?: number
  sec?: number
  done: boolean
}

/** What the session asked for, recorded so the next one can judge against it. */
export interface Rx {
  sets: number
  reps: number
  weight: number
  sec?: number
}

export interface Entry {
  exId: string
  sets: SetRow[]
  /** Snapshot of the routine slot (the plan). */
  target?: Slot
  /** The prescription given for this session. */
  rx?: Rx
  routineId?: string
  sg?: string
  noProg?: boolean
  note?: string
}

export interface Workout {
  id: string
  date: ISODate
  start: Ms
  end: Ms
  routineIds: string[]
  name: string
  bw?: number
  entries: Entry[]
  /** Exercise ids with a load PR in this session. */
  prs: string[]
  /** Exercise ids with an estimated-1RM record (without a load PR). */
  e1prs?: string[]
  vol: number
  note?: string
  noProg?: boolean
  updatedAt: Ms
}

export interface ActiveSession {
  id: string
  date: ISODate
  start: Ms
  routineIds: string[]
  name: string
  entries: Entry[]
  cur: number
  note?: string
  /** Set when editing an already saved workout. */
  editingId?: string
}

export interface WeighIn {
  date: ISODate
  w: number
  t: Ms
}

export interface Measurement {
  date: ISODate
  t: Ms
  values: Record<string, number>
}

export interface Rotation {
  id: string
  /** Routine ids or 'rest'. */
  sequence: string[]
  /** Workouts that started before this moment do not advance the loop. */
  since: Ms
}

export interface CustomExercise {
  id: string
  name: string
  bodyPart: string
  equipment: string
  primary: string[]
  secondary: string[]
  category: string
}

export type WorkoutView = 'cards' | 'list'

export interface Settings {
  lang: 'uz' | 'ru' | 'en'
  unit: Unit
  /** 1 = 0.5 step display, 2 = two decimals. */
  wdec: 1 | 2
  theme: 'dark' | 'light' | 'system'
  accent: string
  body: 'male' | 'female'
  restSec: number
  restPauseSec: number
  warmupRestSec?: number
  effort: Effort
  logRef: 'last' | 'best'
  startFrom: 'plan' | 'last'
  workoutView: WorkoutView
  collapseCompleted: boolean
  weighIn: boolean
  keepAwake: boolean
  sound: boolean
  vibrate: boolean
  timerFlash: boolean
  weekStart: 0 | 1
  oneRmFormula: OneRmFormula
  volumeWarmups: boolean
  showWeightCard: boolean
}

export type OneRmFormula = 'epley' | 'brzycki' | 'lombardi' | 'oconner' | 'mayhew' | 'wathan' | 'lander'

export interface Profile {
  settings: Settings
  routines: Routine[]
  /** Weekday (0 = Sunday, Date.getDay) → routine ids. */
  week: Record<number, string[]>
  /** Per-day override: routine id or 'rest'. */
  dayPlan: Record<ISODate, string>
  dayNotes: Record<ISODate, { text: string; tag?: string }>
  scheduleMode: 'week' | 'rotation'
  rotation: Rotation | null
  workouts: Workout[]
  active: ActiveSession | null
  bodyweight: WeighIn[]
  targetW: number | null
  measurements: Measurement[]
  customEx: CustomExercise[]
  /** Last good working weight per exercise. */
  exWeights: Record<string, { w: number; date: ISODate }>
  exNotes: Record<string, string>
  favEx: string[]
  /** Bar weight per exercise; 0 = no bar. */
  barWeights: Record<string, number>
  /** Owned plate pairs per size, per unit. */
  plates: Partial<Record<Unit, Record<number, number>>>
  /** Deletion tombstones for sync: list → id → time. */
  deleted: Record<string, Record<string, Ms>>
  updatedAt: Ms
}

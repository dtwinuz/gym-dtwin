import type { Lang } from '../i18n'

type L = Record<Lang, string>

export const GROUPS = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'neck'] as const
export type Group = (typeof GROUPS)[number] | 'other'

export const GROUP_NAME: Record<Group, L> = {
  chest: { uz: 'Ko\'krak', ru: 'Грудь', en: 'Chest' },
  back: { uz: 'Orqa', ru: 'Спина', en: 'Back' },
  shoulders: { uz: 'Yelka', ru: 'Плечи', en: 'Shoulders' },
  arms: { uz: 'Qo\'l', ru: 'Руки', en: 'Arms' },
  legs: { uz: 'Oyoq', ru: 'Ноги', en: 'Legs' },
  core: { uz: 'Qorin (press)', ru: 'Пресс и кор', en: 'Core' },
  neck: { uz: 'Bo\'yin', ru: 'Шея', en: 'Neck' },
  other: { uz: 'Boshqa', ru: 'Другое', en: 'Other' },
}

export const MUSCLE_NAME: Record<string, L> = {
  chest: { uz: 'Ko\'krak', ru: 'Грудные', en: 'Chest' },
  shoulders: { uz: 'Yelka (deltasimon)', ru: 'Дельты', en: 'Shoulders' },
  triceps: { uz: 'Triseps', ru: 'Трицепс', en: 'Triceps' },
  biceps: { uz: 'Biseps', ru: 'Бицепс', en: 'Biceps' },
  forearms: { uz: 'Bilak', ru: 'Предплечья', en: 'Forearms' },
  neck: { uz: 'Bo\'yin', ru: 'Шея', en: 'Neck' },
  traps: { uz: 'Trapetsiya', ru: 'Трапеции', en: 'Traps' },
  lats: { uz: 'Keng orqa (lats)', ru: 'Широчайшие', en: 'Lats' },
  'middle back': { uz: 'Orqa o\'rtasi', ru: 'Середина спины', en: 'Middle back' },
  'lower back': { uz: 'Bel', ru: 'Поясница', en: 'Lower back' },
  abdominals: { uz: 'Qorin mushaklari', ru: 'Пресс', en: 'Abs' },
  glutes: { uz: 'Dumba (glute)', ru: 'Ягодицы', en: 'Glutes' },
  quadriceps: { uz: 'Son oldi (kvadritseps)', ru: 'Квадрицепс', en: 'Quads' },
  hamstrings: { uz: 'Son orqasi', ru: 'Бицепс бедра', en: 'Hamstrings' },
  adductors: { uz: 'Son ichki qismi', ru: 'Приводящие', en: 'Adductors' },
  abductors: { uz: 'Son tashqi qismi', ru: 'Отводящие', en: 'Abductors' },
  calves: { uz: 'Boldir', ru: 'Икры', en: 'Calves' },
}

export const EQUIPMENT = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'ez bar',
  'medicine ball', 'exercise ball', 'foam roll', 'other',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export const EQUIPMENT_NAME: Record<Equipment, L> = {
  barbell: { uz: 'Shtanga', ru: 'Штанга', en: 'Barbell' },
  dumbbell: { uz: 'Gantel', ru: 'Гантели', en: 'Dumbbell' },
  machine: { uz: 'Trenajor', ru: 'Тренажёр', en: 'Machine' },
  cable: { uz: 'Blok (tros)', ru: 'Блок', en: 'Cable' },
  bodyweight: { uz: 'O\'z vazni', ru: 'Свой вес', en: 'Bodyweight' },
  kettlebell: { uz: 'Girya', ru: 'Гиря', en: 'Kettlebell' },
  band: { uz: 'Rezina', ru: 'Резина', en: 'Band' },
  'ez bar': { uz: 'EZ grif', ru: 'EZ-гриф', en: 'EZ bar' },
  'medicine ball': { uz: 'Medbol', ru: 'Медбол', en: 'Medicine ball' },
  'exercise ball': { uz: 'Fitbol', ru: 'Фитбол', en: 'Exercise ball' },
  'foam roll': { uz: 'Massaj roligi', ru: 'Ролл', en: 'Foam roller' },
  other: { uz: 'Boshqa', ru: 'Другое', en: 'Other' },
}

export const CATEGORIES = ['strength', 'cardio', 'stretching', 'plyometrics', 'olympic', 'strongman'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_NAME: Record<Category, L> = {
  strength: { uz: 'Kuch', ru: 'Силовые', en: 'Strength' },
  cardio: { uz: 'Kardio', ru: 'Кардио', en: 'Cardio' },
  stretching: { uz: 'Cho\'zilish', ru: 'Растяжка', en: 'Stretching' },
  plyometrics: { uz: 'Pliometrika', ru: 'Плиометрика', en: 'Plyometrics' },
  olympic: { uz: 'Og\'ir atletika', ru: 'Тяжёлая атлетика', en: 'Olympic' },
  strongman: { uz: 'Strongmen', ru: 'Стронгмен', en: 'Strongman' },
}

export const LEVELS = ['beginner', 'intermediate', 'expert'] as const
export type Level = (typeof LEVELS)[number]

export const LEVEL_NAME: Record<Level, L> = {
  beginner: { uz: 'Boshlovchi', ru: 'Новичок', en: 'Beginner' },
  intermediate: { uz: 'O\'rta', ru: 'Средний', en: 'Intermediate' },
  expert: { uz: 'Tajribali', ru: 'Опытный', en: 'Expert' },
}

export const label = (map: Record<string, L>, key: string, lang: Lang) => map[key]?.[lang] ?? key

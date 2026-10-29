export type Lang = 'uz' | 'ru' | 'en'

export const LANGS: Lang[] = ['uz', 'ru', 'en']

const dict = {
  home: { uz: 'Bosh sahifa', ru: 'Главная', en: 'Home' },
  plan: { uz: 'Reja', ru: 'План', en: 'Plan' },
  exercises: { uz: 'Mashqlar', ru: 'Упражнения', en: 'Exercises' },
  workout: { uz: 'Mashg\'ulot', ru: 'Тренировка', en: 'Workout' },
  progress: { uz: 'Progress', ru: 'Прогресс', en: 'Progress' },
  today: { uz: 'Bugungi mashg\'ulot', ru: 'Тренировка на сегодня', en: 'Today\'s session' },
  start: { uz: 'Boshlash', ru: 'Начать', en: 'Start' },
  finish: { uz: 'Yakunlash', ru: 'Завершить', en: 'Finish' },
  thisWeek: { uz: 'Shu hafta', ru: 'На этой неделе', en: 'This week' },
  total: { uz: 'Jami mashg\'ulot', ru: 'Всего тренировок', en: 'Total sessions' },
  volume: { uz: 'Umumiy hajm', ru: 'Общий объём', en: 'Total volume' },
  search: { uz: 'Qidirish…', ru: 'Поиск…', en: 'Search…' },
  all: { uz: 'Hammasi', ru: 'Все', en: 'All' },
  choose: { uz: 'Tanlash', ru: 'Выбрать', en: 'Choose' },
  active: { uz: 'Faol', ru: 'Активный', en: 'Active' },
  rest: { uz: 'Dam olish', ru: 'Отдых', en: 'Rest' },
  bodyWeight: { uz: 'Tana vazni', ru: 'Вес тела', en: 'Body weight' },
  records: { uz: 'Rekordlar (taxminiy 1RM)', ru: 'Рекорды (оценка 1RM)', en: 'Records (est. 1RM)' },
  activity: { uz: 'Faollik (12 hafta)', ru: 'Активность (12 недель)', en: 'Activity (12 weeks)' },
  add: { uz: 'Qo\'shish', ru: 'Добавить', en: 'Add' },
  empty: { uz: 'Hali ma\'lumot yo\'q — birinchi mashg\'ulotni boshlang', ru: 'Пока нет данных — начните первую тренировку', en: 'No data yet — start your first session' },
  history: { uz: 'Tarix', ru: 'История', en: 'History' },
  goal: { uz: 'Maqsad', ru: 'Цель', en: 'Goal' },
  decks: { uz: 'Prezentatsiyalar', ru: 'Презентации', en: 'Presentations' },
  decksText: { uz: 'Bozor tadqiqoti va sayt konsepti, oxirida zalning 3D Digital Twin\'i', ru: 'Исследование рынка и концепт сайта, в конце — 3D цифровой двойник зала', en: 'Market research and the site concept, ending with a 3D digital twin of the gym' },
  deckResearch: { uz: 'Tadqiqot', ru: 'Исследование', en: 'Research' },
  deckConcept: { uz: 'Sayt konsepti · 3D twin', ru: 'Концепт сайта · 3D-двойник', en: 'Site concept · 3D twin' },
} satisfies Record<string, Record<Lang, string>>

export type Key = keyof typeof dict

export const t = (lang: Lang, key: Key) => dict[key][lang]

export const muscleName: Record<string, Record<Lang, string>> = {
  chest: { uz: 'Ko\'krak', ru: 'Грудь', en: 'Chest' },
  back: { uz: 'Orqa', ru: 'Спина', en: 'Back' },
  legs: { uz: 'Oyoq', ru: 'Ноги', en: 'Legs' },
  shoulders: { uz: 'Yelka', ru: 'Плечи', en: 'Shoulders' },
  arms: { uz: 'Qo\'l', ru: 'Руки', en: 'Arms' },
  core: { uz: 'Press', ru: 'Пресс', en: 'Core' },
}

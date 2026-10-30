import type { Lang } from '../i18n'

type Tri = Record<Lang, string>
const tri = (uz: string, ru: string, en: string): Tri => ({ uz, ru, en })

export const L = {
  tagline: tri("mashg'ulot kundaligi", 'дневник тренировок', 'training log'),
  open: tri('Ilovani ochish', 'Открыть приложение', 'Open the app'),
  openShort: tri('Ochish', 'Открыть', 'Open'),
  theme: tri('Mavzu', 'Тема', 'Theme'),
  eyebrow: tri("gym.dtwin · zal uchun raqamli egizak", 'gym.dtwin · цифровой двойник для зала', 'gym.dtwin · a digital twin for the gym'),
  title: tri('Har bir set&nbsp;— <em>kuchingiz</em> tarixi.', 'Каждый подход&nbsp;— история вашей <em>силы</em>.', 'Every set writes your <em>strength</em> story.'),
  lead: tri(
    "Tayyor reja tanlang, vazn va takrorni bir bosishda yozing. Dam olish taymeri, rekordlar va progress o'zi hisoblanadi — ro'yxatdan o'tmasdan.",
    'Выберите готовый план, записывайте вес и повторы в одно касание. Таймер отдыха, рекорды и прогресс считаются сами — без регистрации.',
    'Pick a ready-made plan, log weight and reps in one tap. Rest timer, records and progress are tracked for you — no sign-up.',
  ),
  start: tri("Mashg'ulotni boshlash", 'Начать тренировку', 'Start training'),
  watch: tri("Tanishuvni ko'rish", 'Смотреть обзор', 'Watch the overview'),
  cont: tri('Davom etish', 'Продолжить', 'Continue'),
  pulse: tri('puls', 'пульс', 'pulse'),
  scroll: tri('pastga suring', 'листайте вниз', 'scroll down'),
  stats: [
    ['4', tri('tayyor reja', 'готовых плана', 'ready plans')],
    ['29', tri('mashq', 'упражнений', 'exercises')],
    ['90 s', tri('dam taymeri', 'таймер отдыха', 'rest timer')],
    ['1RM', tri('Epley hisobi', 'по Эпли', 'Epley estimate')],
  ] as [string, Tri][],
  soon: tri('Tez kunda', 'Скоро', 'Soon'),

  planK: tri('01 · Reja', '01 · План', '01 · Plan'),
  planH: tri('Reja tayyor&nbsp;— siz faqat <em>kelasiz</em>.', 'План готов&nbsp;— вам остаётся <em>прийти</em>.', 'The plan is ready&nbsp;— you just <em>show up</em>.'),
  planP: tri(
    "Push/Pull/Legs, Upper/Lower, Full Body yoki Kuch 5×5. Kunlar o'zi aylanadi: bugun Push bo'lsa, keyingi safar — Pull.",
    'Push/Pull/Legs, Upper/Lower, Full Body или Сила 5×5. Дни меняются сами: сегодня Push — в следующий раз Pull.',
    'Push/Pull/Legs, Upper/Lower, Full Body or Strength 5×5. Days rotate on their own: Push today, Pull next time.',
  ),
  planNotes: [
    tri("3 kunlik aylanish", '3-дневный цикл', '3-day rotation'),
    tri('haftada 4 kun', '4 дня в неделю', '4 days a week'),
    tri('boshlovchilar uchun', 'для новичков', 'for beginners'),
    tri('+2.5 kg har safar', '+2.5 кг каждый раз', '+2.5 kg every time'),
  ],
  today: tri('Bugun', 'Сегодня', 'Today'),
  next: tri('keyingisi', 'далее', 'next'),

  logK: tri("02 · Mashg'ulot", '02 · Тренировка', '02 · Workout'),
  logH: tri('Set yozish&nbsp;— <em>bir bosish</em>.', 'Записать подход&nbsp;— <em>одно касание</em>.', 'Logging a set&nbsp;— <em>one tap</em>.'),
  logP: tri(
    "Oxirgi vazn oldindan to'ldiriladi. Belgilang — 90 soniyalik dam taymeri o'zi boshlanadi, yangi rekord bo'lsa kubok chiqadi.",
    'Последний вес подставляется сам. Отметьте подход — таймер отдыха на 90 секунд запустится, а за новый рекорд появится кубок.',
    'Your last weight is pre-filled. Tick the set — a 90-second rest timer starts, and a new record earns a trophy.',
  ),
  rest: tri('Dam olish', 'Отдых', 'Rest'),
  pr: tri('Yangi rekord', 'Новый рекорд', 'New record'),

  progK: tri('03 · Progress', '03 · Прогресс', '03 · Progress'),
  progH: tri("O'sishingizni <em>ko'ring</em>.", 'Видите свой <em>рост</em>.', 'See yourself <em>grow</em>.'),
  progP: tri(
    "12 haftalik faollik xaritasi, har mashq bo'yicha taxminiy 1RM (Epley) va tana vazni grafigi maqsad chizig'i bilan.",
    'Карта активности за 12 недель, оценка 1RM по каждому упражнению (Эпли) и график веса тела с линией цели.',
    'A 12-week activity map, estimated 1RM per exercise (Epley) and a body-weight chart with your goal line.',
  ),
  activity: tri('Faollik · 12 hafta', 'Активность · 12 недель', 'Activity · 12 weeks'),
  records: tri('Rekordlar · 1RM', 'Рекорды · 1RM', 'Records · 1RM'),
  weight: tri('Tana vazni', 'Вес тела', 'Body weight'),
  goal: tri('maqsad', 'цель', 'goal'),

  bodyK: tri('04 · Tana xaritasi', '04 · Карта тела', '04 · Body map'),
  bodyH: tri("Qaysi mushak <em>ishladi</em>&nbsp;— bir qarashda.", 'Какие мышцы <em>работали</em>&nbsp;— с одного взгляда.', 'Which muscles <em>worked</em>&nbsp;— at a glance.'),
  bodyP: tri(
    "Har mashq mushak guruhiga bog'langan: ko'krak, orqa, oyoq, yelka, qo'l, press. Haftalik hajm tana xaritasida yonadi — dam bergan joyingiz ham ko'rinadi.",
    'Каждое упражнение привязано к группе мышц: грудь, спина, ноги, плечи, руки, пресс. Недельный объём подсвечивается на карте тела — видно и то, что вы пропустили.',
    'Every exercise maps to a muscle group: chest, back, legs, shoulders, arms, core. Weekly volume lights up on a body map — so do the parts you skipped.',
  ),
  sets: tri('set', 'подх.', 'sets'),
  bodyWeek: tri('Shu hafta', 'Эта неделя', 'This week'),

  roadK: tri("05 · Keyingi bosqich", '05 · Следующий этап', '05 · What comes next'),
  roadH: tri("Murabbiy, soat, ovqat&nbsp;— <em>hammasi bir joyda</em>.", 'Тренер, часы, питание&nbsp;— <em>всё в одном месте</em>.', 'Coach, watch, food&nbsp;— <em>all in one place</em>.'),
  roadP: tri(
    "gym.dtwin kundalikdan to'liq sport egizagiga o'sadi. Mana yo'l xaritasi — har biri allaqachon loyihalangan.",
    'gym.dtwin вырастает из дневника в полноценного спортивного двойника. Вот дорожная карта — каждый пункт уже спроектирован.',
    'gym.dtwin grows from a log into a full training twin. Here is the roadmap — every item is already designed.',
  ),
  road: [
    { k: 'ai', t: tri('AI murabbiy', 'ИИ-тренер', 'AI coach'), d: tri("Charchoq, uyqu va rekordlarga qarab rejani o'zi moslaydi.", 'Сам подстраивает план под усталость, сон и рекорды.', 'Adapts the plan to fatigue, sleep and your records.'), m: tri("«Tizzam og'riyapti» → Squat o'rniga Leg press", '«Болит колено» → Leg press вместо приседа', '"My knee hurts" → Leg press instead of squat') },
    { k: 'wear', t: tri('Soat va bilaguzuk', 'Часы и браслеты', 'Watches & bands'), d: tri('Mi Band, Apple Health, Google Fit — puls va kaloriya avtomatik.', 'Mi Band, Apple Health, Google Fit — пульс и калории автоматически.', 'Mi Band, Apple Health, Google Fit — heart rate and calories, automatic.'), m: tri('♥ 142 bpm · 3-zona', '♥ 142 уд/мин · зона 3', '♥ 142 bpm · zone 3') },
    { k: 'food', t: tri('Ovqat va makrolar', 'Питание и макросы', 'Nutrition & macros'), d: tri("Oqsil, uglevod, yog' — palov ham, tvorog ham bazada.", 'Белки, углеводы, жиры — в базе и плов, и творог.', 'Protein, carbs, fat — plov and cottage cheese both in the database.'), m: tri('Oqsil 128 / 150 g', 'Белок 128 / 150 г', 'Protein 128 / 150 g') },
    { k: 'form', t: tri('Video texnika tahlili', 'Видео-разбор техники', 'Video form check'), d: tri("Telefonni qo'ying — bo'g'im burchaklari va xatolar real vaqtda.", 'Поставьте телефон — углы суставов и ошибки в реальном времени.', 'Prop up your phone — joint angles and mistakes in real time.'), m: tri('Tizza 92° · orqa tekis ✓', 'Колено 92° · спина ровная ✓', 'Knee 92° · back neutral ✓') },
    { k: 'market', t: tri('Murabbiylar va zallar', 'Тренеры и залы', 'Trainers & gyms'), d: tri('Murabbiy toping, abonement oling, zalga QR bilan kiring.', 'Найдите тренера, купите абонемент, входите в зал по QR.', 'Find a trainer, buy a membership, enter the gym with a QR code.'), m: tri('QR · Chilonzor zali · kirish ✓', 'QR · зал Чиланзар · вход ✓', 'QR · Chilonzor gym · check-in ✓') },
    { k: 'bot', t: tri('Telegram eslatmalar', 'Напоминания в Telegram', 'Telegram reminders'), d: tri("«Bugun Legs kuni, 18:00» — bot vaqtida yozadi.", '«Сегодня день ног, 18:00» — бот напомнит вовремя.', '"Leg day today, 18:00" — the bot pings you on time.'), m: tri('🔔 18:00 · Legs kuni', '🔔 18:00 · день ног', '🔔 18:00 · Leg day') },
    { k: 'social', t: tri("Do'stlar bilan musobaqa", 'Челленджи с друзьями', 'Challenges with friends'), d: tri("30 kunlik challenge, reyting va birga mashg'ulot.", '30-дневный челлендж, рейтинг и совместные тренировки.', '30-day challenges, leaderboards and training together.'), m: tri('Siz · 2-o\'rin · 18 / 30 kun', 'Вы · 2-е место · 18 / 30 дней', 'You · 2nd · 18 / 30 days') },
    { k: 'dtwin', t: tri('dtwin bilan bog\'lanish', 'Связка с dtwin', 'dtwin integration'), d: tri("Mashg'ulot hayot rejangizga tushadi — bitta akkaunt, hamma qurilmada.", 'Тренировки попадают в ваш жизненный план — один аккаунт на всех устройствах.', 'Workouts land in your life plan — one account across every device.'), m: tri('dtwin · bugun 18:00 Legs', 'dtwin · сегодня 18:00 Legs', 'dtwin · today 18:00 Legs') },
    { k: 'prog', t: tri('Aqlli progressiya', 'Умная прогрессия', 'Smart progression'), d: tri("Linear va double progression, deload haftasi — vazn o'zi oshadi.", 'Линейная и двойная прогрессия, разгрузочная неделя — вес растёт сам.', 'Linear and double progression, deload weeks — the weight goes up for you.'), m: tri('Bench 80 → 82.5 kg', 'Жим 80 → 82.5 кг', 'Bench 80 → 82.5 kg') },
    { k: 'csv', t: tri('Import / eksport', 'Импорт / экспорт', 'Import / export'), d: tri("CSV va JSON: boshqa ilovadan ko'chib keling, tarixingiz sizniki.", 'CSV и JSON: переезжайте из другого приложения, история — ваша.', 'CSV and JSON: move in from another app, your history stays yours.'), m: tri('workouts.csv · 214 qator', 'workouts.csv · 214 строк', 'workouts.csv · 214 rows') },
    { k: 'video', t: tri('Mashq animatsiyalari', 'Анимации упражнений', 'Exercise animations'), d: tri("Har mashq uchun qisqa 3D animatsiya va ishlaydigan mushaklar.", 'Короткая 3D-анимация и рабочие мышцы для каждого упражнения.', 'A short 3D loop and the target muscles for every exercise.'), m: tri('Bench press · 3D · 4 s', 'Жим лёжа · 3D · 4 с', 'Bench press · 3D · 4 s') },
    { k: 'pwa', t: tri("Ilova va oflayn rejim", 'Приложение и офлайн', 'App & offline mode'), d: tri("Bosh ekranga o'rnating — zalda internet bo'lmasa ham ishlaydi.", 'Установите на главный экран — работает даже без интернета в зале.', 'Install it to your home screen — works even with no signal in the gym.'), m: tri('✓ Oflayn · 3 set navbatda', '✓ Офлайн · 3 подхода в очереди', '✓ Offline · 3 sets queued') },
  ],

  trustK: tri("06 · Ishonch", '06 · Доверие', '06 · Trust'),
  trustH: tri("Ma'lumot&nbsp;— <em>sizda</em>.", 'Данные&nbsp;— <em>у вас</em>.', 'Your data stays <em>yours</em>.'),
  trust: [
    [tri("Akkauntsiz", 'Без аккаунта', 'No account'), tri("Ochasiz va boshlaysiz. Hech qanday parol, SMS yoki pochta.", 'Открыли и начали. Никаких паролей, SMS и почты.', 'Open and go. No password, SMS or email.')],
    [tri('Brauzeringizda', 'В вашем браузере', 'In your browser'), tri("Mashg'ulotlar qurilmangizda saqlanadi — serverga yuborilmaydi.", 'Тренировки хранятся на устройстве и не уходят на сервер.', 'Workouts are stored on your device — never sent to a server.')],
    [tri('Uch tilda', 'На трёх языках', 'Three languages'), tri("O'zbekcha, ruscha, inglizcha — bir bosishda almashadi.", 'Узбекский, русский, английский — переключаются в одно касание.', 'Uzbek, Russian, English — switch in one tap.')],
    [tri("Bepul va ochiq g'oya", 'Бесплатно', 'Free'), tri("Hech qanday obuna yo'q. Struktura openGym g'oyasidan, kod — o'zimizniki.", 'Без подписок. Структура вдохновлена openGym, код — наш собственный.', 'No subscription. Structure inspired by openGym, code is our own.')],
  ] as [Tri, Tri][],

  decksK: tri('Prezentatsiyalar', 'Презентации', 'Presentations'),
  decksH: tri("Loyiha qanday tug'ildi", 'Как родился проект', 'How the project was born'),
  deckOverview: tri("Tanishuv · 1 daqiqa", 'Обзор · 1 минута', 'Overview · 1 minute'),
  deckResearch: tri('Bozor tadqiqoti', 'Исследование рынка', 'Market research'),
  deckConcept: tri('Sayt konsepti · 3D twin', 'Концепт сайта · 3D-двойник', 'Site concept · 3D twin'),

  finalH: tri("Birinchi setni <em>bugun</em> yozing.", 'Запишите первый подход <em>сегодня</em>.', 'Log your first set <em>today</em>.'),
  finalP: tri("Bepul. Akkauntsiz. Telefonda ham, kompyuterda ham.", 'Бесплатно. Без аккаунта. На телефоне и на компьютере.', 'Free. No account. On your phone and your laptop.'),
  foot: tri("gym.dtwin — dtwin oilasidan", 'gym.dtwin — из семейства dtwin', 'gym.dtwin — part of the dtwin family'),
}

export const MUSCLE_T: Record<string, Tri> = {
  chest: tri("Ko'krak", 'Грудь', 'Chest'),
  back: tri('Orqa', 'Спина', 'Back'),
  legs: tri('Oyoq', 'Ноги', 'Legs'),
  shoulders: tri('Yelka', 'Плечи', 'Shoulders'),
  arms: tri("Qo'l", 'Руки', 'Arms'),
  core: tri('Press', 'Пресс', 'Core'),
}

// Generates the Stories-style overview deck: public/overview/{index,ru/index,en/index}.html + deck.js
// Engine (navigation/progress/fit/split) and the GSAP 3.12.5 bundle are reused from the dtwin overview.
// usage: node scripts/build-overview.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = f => readFileSync(join(here, 'overview', f), 'utf8')
const out = join(here, '..', 'public', 'overview')
const VER = Date.now().toString(36)

const LANGS = ['uz', 'ru', 'en']
let LANG = 'uz'
const t = (uz, ru, en) => ({ uz, ru, en })[LANG]
const CK = '<span class="ck"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>'
const soon = () => `<span class="soon">${t('Tez kunda', 'Скоро', 'Soon')}</span>`
const APP = '/#/home'
const HOME = '/'

const kick = (n, s, future) => `<div class="kick">${String(n).padStart(2, '0')} · ${s}${future ? soon() : ''}</div>`
const slide = (o, body) => `<section class="sl${o.cls ? ' ' + o.cls : ''}" data-id="${o.id}" data-hold="${o.hold || 3.5}" data-title="${o.title.replace(/<[^>]+>/g, '').replace(/"/g, '&quot;')}">
${body}
</section>`
const txt = (n, k, h, lead, future) => `  <div class="txt">
    ${kick(n, k, future)}
    <h2 class="h">${h}</h2>
    <p class="lead">${lead}</p>
  </div>`

const phone = (inner, style = 'left:180px;top:0') => `<div class="phone" style="${style}"><div class="scr"><div class="sbar"><span>9:41</span><span>●●●</span></div>${inner}</div></div>`

function slides() {
  const S = []
  let n = 0
  const add = (o, body) => { S.push(slide(o, body)) }

  // 1. cover
  add({ id: 'cover', cls: 'center cover', hold: 3, title: t('Har bir set — kuchingiz tarixi', 'Каждый подход — история силы', 'Every set writes your strength story') }, `  <div class="vis bgv"><div class="vbox" style="width:640px;height:640px">
    <svg class="ab" viewBox="-320 -320 640 640" width="640" height="640" id="cv-ring"><g id="cv-plates"></g></svg>
    <svg class="ab" viewBox="0 0 1200 160" width="1200" height="160" style="left:-280px;top:480px" id="cv-ecg"></svg>
  </div></div>
  <div class="txt">
    <div class="kick">gym.dtwin · ${t("mashg'ulot kundaligi", 'дневник тренировок', 'training log')}</div>
    <h1 class="h" style="font-size:clamp(34px,6.2vw,92px)">${t('Har bir set&nbsp;— <em>kuchingiz</em> tarixi.', 'Каждый подход&nbsp;— история вашей <em>силы</em>.', 'Every set writes your <em>strength</em> story.')}</h1>
    <p class="lead">${t("Reja, set, dam olish, rekord va progress — <b>bitta ilovada, akkauntsiz</b>.", 'План, подходы, отдых, рекорды и прогресс — <b>в одном приложении, без аккаунта</b>.', 'Plan, sets, rest, records and progress — <b>one app, no account</b>.')}</p>
    <div class="after" style="margin-top:28px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <a class="cta" href="#2" data-go="1">${t('Tanishuvni boshlash →', 'Начать обзор →', 'Start the tour →')}</a>
      <a class="cta ghost" href="${APP}">${t('Ilovani ochish', 'Открыть приложение', 'Open the app')}</a>
    </div>
  </div>`)

  // 2. plan
  const plans = [['Push / Pull / Legs', t('3 kunlik aylanish', '3-дневный цикл', '3-day rotation'), ['Push', 'Pull', 'Legs']],
    ['Upper / Lower', t('haftada 4 kun', '4 дня в неделю', '4 days a week'), ['Upper A', 'Lower A', 'Upper B', 'Lower B']],
    ['Full Body', t('boshlovchilar uchun', 'для новичков', 'for beginners'), ['Full A', 'Full B']],
    [t('Kuch 5×5', 'Сила 5×5', 'Strength 5×5'), t('+2.5 kg har safar', '+2.5 кг каждый раз', '+2.5 kg every time'), ['A', 'B']]]
  add({ id: 'plan', title: t('Reja tayyor — siz faqat kelasiz', 'План готов — вам остаётся прийти', 'The plan is ready — just show up') }, `${txt(++n, t('Reja', 'План', 'Plan'), t('Reja tayyor&nbsp;— siz faqat <em>kelasiz.</em>', 'План готов&nbsp;— вам остаётся <em>прийти.</em>', 'The plan is ready&nbsp;— you just <em>show up.</em>'), t("To'rtta tayyor dastur. Kunlar <b>o'zi aylanadi</b>: bugun Push, keyingi safar Pull.", 'Четыре готовые программы. Дни <b>меняются сами</b>: сегодня Push, потом Pull.', 'Four ready programs. Days <b>rotate on their own</b>: Push today, Pull next.'))}
  <div class="vis"><div class="vbox">
    ${plans.map(([nm, note], k) => `<div class="ab gc pl-c${k === 0 ? ' on' : ''}" style="left:0;top:${k * 96}px;width:290px;height:82px;padding:14px 16px;display:flex;align-items:center;gap:12px"><span class="pl-i">${['PPL', 'U/L', 'FB', '5×5'][k]}</span><span style="flex:1;min-width:0"><b style="display:block;font-size:15px">${nm}</b><span class="mute" style="font-size:12.5px">${note}</span></span></div>`).join('')}
    <div class="ab gc" id="pl-rot" style="left:320px;top:0;width:320px;height:372px;padding:18px">
      <div class="eb" style="margin-bottom:14px">${t('Kunlar aylanishi', 'Ротация дней', 'Day rotation')}</div>
      ${plans.map(([, , days], k) => `<div class="pl-d${k === 0 ? ' show' : ''}" data-p="${k}">${days.map((d, i) => `<div class="pl-day${i === 0 ? ' now' : ''}"><span class="mono" style="font-size:11px;width:22px;color:rgb(var(--mute))">${i + 1}</span><b>${d}</b>${i === 0 ? `<span class="pill hot">${t('bugun', 'сегодня', 'today')}</span>` : i === 1 ? `<span class="pill">${t('keyingisi', 'далее', 'next')}</span>` : ''}</div>`).join('')}</div>`).join('')}
    </div>
    <div class="ab" style="left:0;right:0;top:400px;display:flex;gap:8px;flex-wrap:wrap"><span class="pill acc">4 ${t('reja', 'плана', 'plans')}</span><span class="pill">29 ${t('mashq', 'упражнений', 'exercises')}</span><span class="pill">6 ${t('mushak guruhi', 'групп мышц', 'muscle groups')}</span></div>
  </div></div>`)

  // 3. today
  const day = [['Bench press', '4 × 6'], ['Overhead press', '3 × 8'], ['Incline dumbbell press', '3 × 10'], ['Lateral raise', '3 × 15'], ['Triceps pushdown', '3 × 12']]
  add({ id: 'today', cls: 'flip', title: t('Bugungi mashg‘ulot bir qarashda', 'Тренировка на сегодня с одного взгляда', 'Today’s session at a glance') }, `${txt(++n, t('Bosh sahifa', 'Главная', 'Home'), t('Bugungi reja&nbsp;— <em>birinchi ekranda.</em>', 'План на сегодня&nbsp;— <em>на первом экране.</em>', 'Today’s plan&nbsp;— <em>on the first screen.</em>'), t("Bugungi kun mashqlari, haftalik statistika va tarix. <b>Bitta tugma</b> — mashg'ulot boshlandi.", 'Упражнения дня, недельная статистика и история. <b>Одна кнопка</b> — и тренировка началась.', 'Today’s exercises, weekly stats and history. <b>One button</b> and you’re training.'))}
  <div class="vis"><div class="vbox">
    ${phone(`<div style="padding:14px 14px 0">
      <div class="mute" style="font-size:11px">Push / Pull / Legs</div>
      <div style="font:600 17px var(--display);margin:4px 0 10px;letter-spacing:-.02em">${t('Bugun', 'Сегодня', 'Today')}: Push</div>
      ${day.map(([a, b]) => `<div class="td-li"><span>${a}</span><span class="mono mute">${b}</span></div>`).join('')}
      <div id="td-go" class="td-go">▶ ${t('Boshlash', 'Начать', 'Start')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px">
        <div class="td-st"><b id="td-w">0</b><span>${t('shu hafta', 'за неделю', 'this week')}</span></div>
        <div class="td-st"><b id="td-t">0</b><span>${t('jami', 'всего', 'total')}</span></div>
        <div class="td-st"><b id="td-v">0</b><span>${t('hajm', 'объём', 'volume')}</span></div>
      </div>
      <div class="eb" style="margin:14px 0 8px;font-size:9.5px">${t('Shu hafta', 'Эта неделя', 'This week')}</div>
      <div style="display:flex;gap:5px;align-items:flex-end;height:52px">${[60, 0, 82, 0, 74, 0, 0].map((h, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><i class="td-li" style="display:block;width:100%;height:${Math.max(6, h * .42)}px;border:0;padding:0;border-radius:5px;background:${h ? 'rgb(var(--acc))' : 'rgb(var(--fg)/.08)'}"></i><span class="mono mute" style="font-size:8.5px">${t('DSCPJSY', 'ПВСЧПСВ', 'MTWTFSS')[i]}</span></div>`).join('')}</div>
      </div>`, 'left:30px;top:0')}
    <div class="ab gc" id="td-side" style="left:350px;top:150px;width:270px;padding:16px">
      <div class="eb">${t('Tarix', 'История', 'History')}</div>
      ${[['Legs', t('kecha', 'вчера', 'yesterday'), 18], ['Pull', t('3 kun oldin', '3 дня назад', '3 days ago'), 15], ['Push', t('5 kun oldin', '5 дней назад', '5 days ago'), 17]].map(([a, b, c]) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgb(var(--fg)/.07);font-size:13.5px"><b style="font-weight:600">${a}</b><span class="mono mute" style="font-size:11px">${b} · ${c} set</span></div>`).join('')}
    </div>
  </div></div>`)

  // 4. log
  const rows = [[80, 6], [80, 6], [82.5, 6], [85, 6]]
  const kg = v => String(v).replace('.', LANG === 'en' ? '.' : ',')
  add({ id: 'log', title: t('Set yozish — bir bosish', 'Записать подход — одно касание', 'Log a set — one tap') }, `${txt(++n, t("Mashg'ulot", 'Тренировка', 'Workout'), t('Set yozish&nbsp;— <em>bir bosish.</em>', 'Подход&nbsp;— <em>одно касание.</em>', 'A set is <em>one tap.</em>'), t("Oxirgi vazn <b>oldindan to'ldiriladi</b>. Faqat belgilaysiz.", 'Последний вес <b>подставляется сам</b>. Вы только отмечаете.', 'Your last weight is <b>pre-filled</b>. You just tick.'))}
  <div class="vis"><div class="vbox">
    <div class="ab gc" id="lg-card" style="left:60px;top:20px;width:520px;padding:22px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div><div class="mono mute" style="font-size:11px">Push · 1/5</div><div style="font:600 24px var(--display);letter-spacing:-.02em;margin-top:4px">Bench press</div></div><span class="pill acc">4 × 6</span></div>
      ${rows.map(([a, b], i) => `<div class="lg-r"><span class="mono mute" style="width:22px;text-align:center">${i + 1}</span><span class="lg-f">${kg(a)}<small>kg</small></span><span class="mute">×</span><span class="lg-f">${b}<small>rep</small></span>${CK}</div>`).join('')}
    </div>
    <div class="ab gc" id="lg-auto" style="left:120px;top:430px;width:400px;padding:12px 16px;display:flex;align-items:center;gap:10px;border-radius:16px"><span class="pill good">↺</span><span style="font-size:13.5px">${t("O'tgan safar: <b>80 kg × 6</b> — vazn o'zi qo'yildi", 'Прошлый раз: <b>80 кг × 6</b> — вес подставлен', 'Last time: <b>80 kg × 6</b> — weight pre-filled')}</span></div>
  </div></div>`)

  // 5. rest
  add({ id: 'rest', cls: 'flip', title: t('90 soniya dam — taymer o‘zi', '90 секунд отдыха — таймер сам', '90 seconds rest — timer starts itself') }, `${txt(++n, t('Dam olish', 'Отдых', 'Rest'), t("Dam olish taymeri <em>o'zi</em> boshlanadi.", 'Таймер отдыха <em>сам</em> запускается.', 'The rest timer <em>starts itself.</em>'), t("Setni belgiladingiz — 90 soniya sanaladi. Telefonni qidirib o'tirmaysiz.", 'Отметили подход — пошёл отсчёт 90 секунд. Не надо искать секундомер.', 'Tick a set — 90 seconds count down. No stopwatch hunting.'))}
  <div class="vis"><div class="vbox">
    <svg class="ab" width="640" height="420" viewBox="-320 -210 640 420" style="left:0;top:0">
      <circle id="rs-pulse" r="196" fill="rgb(255 90 54 / .12)"/>
      <circle r="170" fill="none" stroke="rgb(255 255 255 / .07)" stroke-width="16"/>
      <circle id="rs-ring" r="170" fill="none" stroke="rgb(255 90 54)" stroke-width="16" stroke-linecap="round" stroke-dasharray="1068.1" stroke-dashoffset="0" transform="rotate(-90)"/>
    </svg>
    <div class="ab" style="left:0;right:0;top:140px;text-align:center"><div id="rs-n" class="mono" style="font-size:96px;font-weight:600;letter-spacing:-.05em;line-height:1">1:30</div><div class="eb" style="margin-top:8px">${t('Dam olish', 'Отдых', 'Rest')}</div></div>
    <div class="ab" style="left:0;right:0;top:440px;display:flex;justify-content:center;gap:8px"><span class="pill rs-p">Bench press · 2/4</span><span class="pill rs-p">80 kg × 6 ✓</span></div>
    <div class="ab gc" id="rs-next" style="left:170px;top:488px;width:300px;padding:10px 14px;border-radius:14px;text-align:center;font-size:14px">${t('Keyingi set: <b class="acc">80 kg × 6</b>', 'Следующий: <b class="acc">80 кг × 6</b>', 'Next set: <b class="acc">80 kg × 6</b>')}</div>
  </div></div>`)

  // 6. pr
  add({ id: 'pr', title: t('Yangi rekord — kubok va 1RM', 'Новый рекорд — кубок и 1RM', 'New record — trophy and 1RM') }, `${txt(++n, t('Rekord', 'Рекорд', 'Record'), t('Yangi rekord&nbsp;— <em>kubok!</em>', 'Новый рекорд&nbsp;— <em>кубок!</em>', 'New record&nbsp;— <em>trophy!</em>'), t("Har set Epley formulasi bilan taxminiy <b>1RM</b>ga aylanadi. Oshsa — darhol ko'rasiz.", 'Каждый подход пересчитывается в <b>1RM</b> по формуле Эпли. Побили — увидите сразу.', 'Every set becomes an estimated <b>1RM</b> via Epley. Beat it — you see it instantly.'))}
  <div class="vis"><div class="vbox">
    <svg class="ab" width="640" height="260" viewBox="-320 -130 640 260" style="left:0;top:0"><g id="pr-rays"></g></svg>
    <div class="ab" id="pr-tr" style="left:270px;top:80px;width:100px;height:100px;border-radius:30px;display:grid;place-items:center;font-size:52px;background:linear-gradient(160deg,rgb(255 198 64),rgb(255 90 54));box-shadow:0 20px 60px -10px rgb(255 160 50/.7)">🏆</div>
    <div class="ab gc" style="left:70px;top:280px;width:500px;padding:20px 22px">
      <div class="eb">Bench press · ${t('taxminiy 1RM', 'оценка 1RM', 'estimated 1RM')}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:12px;font:500 19px var(--mono);flex-wrap:wrap">
        <span class="pr-f">85 kg</span><span class="pr-f mute">× (1 + 6/30)</span><span class="pr-f mute">=</span><b id="pr-v" class="acc" style="font-size:34px">0 kg</b>
      </div>
      <div id="pr-old" style="margin-top:14px;display:flex;gap:8px"><span class="pill">${t('oldingi', 'было', 'previous')}: 96 kg</span><span class="pill gold">+6 kg</span></div>
    </div>
  </div></div>`)

  // 7. exercises
  const ex = [['Bench press', t("Ko'krak", 'Грудь', 'Chest'), 'barbell', 102], ['Overhead press', t('Yelka', 'Плечи', 'Shoulders'), 'barbell', 63], ['Leg press', t('Oyoq', 'Ноги', 'Legs'), 'machine', 210], ['Dumbbell shoulder press', t('Yelka', 'Плечи', 'Shoulders'), 'dumbbell', 32]]
  const ms = [t('Hammasi', 'Все', 'All'), t("Ko'krak", 'Грудь', 'Chest'), t('Orqa', 'Спина', 'Back'), t('Oyoq', 'Ноги', 'Legs'), t('Yelka', 'Плечи', 'Shoulders'), t("Qo'l", 'Руки', 'Arms'), t('Press', 'Пресс', 'Core')]
  add({ id: 'exercises', cls: 'flip', title: t('29 mashq — qidiruv va filtr', '29 упражнений — поиск и фильтр', '29 exercises — search and filter') }, `${txt(++n, t('Mashqlar', 'Упражнения', 'Exercises'), t('29 mashq&nbsp;— <em>sekundda</em> topiladi.', '29 упражнений&nbsp;— найдёте <em>за секунду.</em>', '29 exercises&nbsp;— found <em>in a second.</em>'), t("Mushak bo'yicha filtr, qidiruv va har mashqda eng yaxshi 1RM.", 'Фильтр по мышцам, поиск и лучший 1RM в каждом упражнении.', 'Filter by muscle, search, and your best 1RM on each.'))}
  <div class="vis"><div class="vbox">
    <div class="ab gc" id="ex-card" style="left:40px;top:20px;width:560px;padding:20px">
      <div class="cn-f" style="height:42px;font-size:15px"><span class="mute" style="margin-right:8px">⌕</span><span id="ex-q" data-t="press"></span><span class="caret"></span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0">${ms.map((m, i) => `<span class="pill ex-ch${i === 0 ? ' acc' : ''}">${m}</span>`).join('')}</div>
      ${ex.map(([a, b, c, d]) => `<div class="ex-it"><span class="ex-ic">${c === 'barbell' ? '🏋' : c === 'machine' ? '⚙' : '💪'}</span><span style="flex:1;min-width:0"><b style="display:block;font-size:14.5px;font-weight:600">${a}</b><span class="mute" style="font-size:12px">${b} · ${c}</span></span><span class="pill ex-m">1RM ${d} kg</span></div>`).join('')}
    </div>
  </div></div>`)

  // 8. progress
  add({ id: 'progress', title: t('12 haftalik faollik xaritasi', 'Карта активности за 12 недель', '12-week activity map') }, `${txt(++n, t('Progress', 'Прогресс', 'Progress'), t('Har kun&nbsp;— <em>bitta katak.</em>', 'Каждый день&nbsp;— <em>клетка.</em>', 'Every day&nbsp;— <em>one square.</em>'), t("12 haftalik xarita: qachon kelganingiz va qachon to'xtaganingiz ko'rinib turadi.", 'Карта за 12 недель: видно, когда вы ходили и когда пропали.', 'A 12-week map: see when you showed up and when you slipped.'))}
  <div class="vis"><div class="vbox">
    <div class="ab gc" id="hm-card" style="left:20px;top:40px;width:600px;padding:22px">
      <div class="eb" style="margin-bottom:14px">${t('Faollik · 12 hafta', 'Активность · 12 недель', 'Activity · 12 weeks')}</div>
      <div id="hm"></div>
      <div style="display:flex;gap:28px;margin-top:20px">
        <div><div class="big" id="hm-n">0</div><div class="mute" style="font-size:12.5px">${t("mashg'ulot", 'тренировок', 'sessions')}</div></div>
        <div><div class="big acc" id="hm-s">0</div><div class="mute" style="font-size:12.5px">${t('hafta ketma-ket', 'недель подряд', 'week streak')}</div></div>
      </div>
    </div>
    <div class="ab" style="left:20px;top:440px;display:flex;gap:8px;flex-wrap:wrap"><span class="pill hm-k acc">${t('haftada 3.2 marta', '3.2 раза в неделю', '3.2× a week')}</span><span class="pill hm-k">${t('eng uzun tanaffus: 6 kun', 'самый длинный перерыв: 6 дней', 'longest gap: 6 days')}</span></div>
  </div></div>`)

  // 9. weight
  const W = [82.4, 82.1, 81.6, 81.8, 81.1, 80.6, 80.2, 80.4, 79.7, 79.1, 78.8, 78.3]
  const pts = W.map((v, i) => `${(i / 11 * 560).toFixed(1)},${(170 - (v - 74) / 9.5 * 170).toFixed(1)}`).join(' L')
  const goalY = (170 - (75 - 74) / 9.5 * 170).toFixed(1)
  add({ id: 'weight', cls: 'flip', title: t('Rekordlar va tana vazni', 'Рекорды и вес тела', 'Records and body weight') }, `${txt(++n, t('Rekordlar', 'Рекорды', 'Records'), t("Vazn tushadi, <em>kuch o'sadi.</em>", 'Вес падает, <em>сила растёт.</em>', 'Weight goes down, <em>strength goes up.</em>'), t("Tana vazni grafigi maqsad chizig'i bilan va har mashq bo'yicha rekordlar.", 'График веса с линией цели и рекорды по каждому упражнению.', 'A body-weight chart with your goal line, plus records per lift.'))}
  <div class="vis"><div class="vbox">
    <div class="ab gc" id="wt-card" style="left:20px;top:10px;width:600px;padding:22px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="eb">${t('Tana vazni', 'Вес тела', 'Body weight')}</div><b id="wt-v" class="mono" style="font-size:26px">82,4 kg</b></div>
      <svg width="556" height="190" viewBox="0 -10 560 190" style="margin-top:12px;overflow:visible">
        <line x1="0" x2="560" y1="${goalY}" y2="${goalY}" stroke="rgb(255 255 255/.3)" stroke-dasharray="5 6"/>
        <text x="560" y="${+goalY - 8}" text-anchor="end" fill="rgb(var(--mute))" font-size="11" font-family="JetBrains Mono">${t('maqsad', 'цель', 'goal')} 75 kg</text>
        <path id="wt-line" d="M${pts}" fill="none" stroke="rgb(255 90 54)" stroke-width="3" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="ab gc" style="left:20px;top:300px;width:600px;padding:16px 22px">
      ${[['Deadlift', 152], ['Back squat', 121], ['Bench press', 102]].map(([a, b]) => `<div class="wt-r"><span>${a}</span><i><b style="width:${b / 160 * 100}%"></b></i><span class="mono">${b} kg</span></div>`).join('')}
    </div>
  </div></div>`)

  // 10. langs + privacy
  add({ id: 'langs', title: t('Uch til, akkauntsiz, brauzeringizda', 'Три языка, без аккаунта, в браузере', 'Three languages, no account, in your browser') }, `${txt(++n, t('Ishonch', 'Доверие', 'Trust'), t("Ma'lumot&nbsp;— <em>sizda.</em>", 'Данные&nbsp;— <em>у вас.</em>', 'Your data stays <em>yours.</em>'), t("O'zbek, rus, ingliz tilida. Ro'yxatdan o'tish yo'q — hammasi qurilmangizda saqlanadi.", 'На узбекском, русском и английском. Без регистрации — всё хранится на вашем устройстве.', 'In Uzbek, Russian and English. No sign-up — everything stays on your device.'))}
  <div class="vis"><div class="vbox">
    <div class="ab gc" id="ln-card" style="left:40px;top:20px;width:560px;height:200px;padding:22px">
      <div style="display:flex;gap:6px"><span class="pill lg-p acc">UZ</span><span class="pill lg-p">RU</span><span class="pill lg-p">EN</span></div>
      <div style="position:relative;height:110px;margin-top:18px">
        <div class="lg-h show">Bugungi mashg'ulot: Push</div><div class="lg-h">Тренировка на сегодня: Push</div><div class="lg-h">Today's session: Push</div>
      </div>
    </div>
    ${[[t('Akkaunt shart emas', 'Аккаунт не нужен', 'No account needed'), t('parol, SMS, pochta yo‘q', 'без пароля, SMS и почты', 'no password, SMS or email')], [t('Brauzerda saqlanadi', 'Хранится в браузере', 'Stored in your browser'), 'localStorage · offline'], [t('Bepul', 'Бесплатно', 'Free'), t('obuna yo‘q', 'без подписки', 'no subscription')]].map(([a, b], k) => `<div class="ab gc ln-t" style="left:40px;top:${240 + k * 80}px;width:560px;height:68px;padding:0 18px;display:flex;align-items:center;gap:14px;border-radius:16px">${CK}<b style="font-size:15px;flex:1">${a}</b><span class="mono mute" style="font-size:11.5px">${b}</span></div>`).join('')}
  </div></div>`)

  // 11. AI coach (soon)
  add({ id: 'coach', cls: 'flip', title: t('AI murabbiy rejani moslaydi', 'ИИ-тренер подстраивает план', 'AI coach adapts the plan') }, `${txt(++n, t('AI murabbiy', 'ИИ-тренер', 'AI coach'), t('Murabbiy&nbsp;— <em>cho‘ntagingizda.</em>', 'Тренер&nbsp;— <em>в кармане.</em>', 'A coach&nbsp;— <em>in your pocket.</em>'), t("Og'riq, charchoq yoki uyqu yetishmasa — AI bugungi rejani <b>o'zi o'zgartiradi</b>.", 'Боль, усталость или недосып — ИИ <b>сам меняет</b> сегодняшний план.', 'Pain, fatigue or poor sleep — the AI <b>rewrites</b> today’s plan.'), true)}
  <div class="vis"><div class="vbox">
    ${phone(`<div class="tg-h"><div class="tg-av"><b></b></div><div><div class="tg-n">gym.dtwin AI</div><div class="tg-s">${t('murabbiy', 'тренер', 'coach')}</div></div></div>
      <div class="tg-body">
        <div class="msg out">${t("Bugun tizzam og'riyapti, uyqu 5 soat", 'Сегодня болит колено, спал 5 часов', 'My knee hurts today, slept 5 hours')}<small>17:42</small></div>
        <div class="msg in"><span id="co-ans" data-t="${t("Tushundim. Squat o'rniga Leg press, hajmni 20% kamaytiramiz. Yengil ishlaymiz.", 'Понял. Вместо приседа — жим ногами, объём −20%. Работаем легко.', 'Got it. Leg press instead of squat, volume −20%. Easy day.')}"></span><small>17:42</small></div>
        <div class="msg out">${t('Rahmat 💪', 'Спасибо 💪', 'Thanks 💪')}<small>17:43</small></div>
        <div class="msg in">${t("Ertaga uyqu va tizzani yana so'rayman. Shanba — og'ir kun qaytadi.", 'Завтра снова спрошу про сон и колено. В субботу вернём тяжёлый день.', 'I’ll check sleep and the knee again tomorrow. Heavy day returns on Saturday.')}<small>17:43</small></div>
      </div>`, 'left:20px;top:0')}
    <div class="ab gc" id="co-plan" style="left:330px;top:170px;width:300px;padding:16px">
      <div class="eb" style="margin-bottom:10px">Legs · ${t('moslandi', 'адаптировано', 'adapted')}</div>
      <div class="co-x"><s class="mute">Back squat 4×6</s><b class="acc">Leg press 3×12</b></div>
      <div class="co-x"><s class="mute">Romanian deadlift 3×8</s><b class="acc">Leg curl 3×12</b></div>
      <div class="co-x"><span>Calf raise</span><b>4×15</b></div>
      <div class="co-x"><span class="pill good">−20% ${t('hajm', 'объём', 'volume')}</span><span class="pill">RPE 6</span></div>
    </div>
  </div></div>`)

  // 12. wearables (soon)
  add({ id: 'wear', title: t('Soat va bilaguzuk bilan sinxron', 'Синхронизация с часами и браслетами', 'Watch and band sync') }, `${txt(++n, t('Soat va bilaguzuk', 'Часы и браслеты', 'Watches & bands'), t('Puls&nbsp;— <em>jonli.</em>', 'Пульс&nbsp;— <em>вживую.</em>', 'Heart rate&nbsp;— <em>live.</em>'), t('Mi Band, Apple Health, Google Fit: puls zonasi, kaloriya va uyqu avtomatik keladi.', 'Mi Band, Apple Health, Google Fit: пульсовые зоны, калории и сон приходят сами.', 'Mi Band, Apple Health, Google Fit: heart-rate zones, calories and sleep flow in.'), true)}
  <div class="vis"><div class="vbox">
    <div class="ab" id="wr-watch" style="left:220px;top:0;width:200px;height:230px;border-radius:56px;background:linear-gradient(160deg,#2a2a2f,#0d0d10);box-shadow:0 0 0 2px #3a3a40,0 40px 80px -30px #000;padding:14px">
      <div style="width:100%;height:100%;border-radius:44px;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
        <span id="wr-heart" style="font-size:28px;color:rgb(255 90 54)">♥</span><b id="wr-bpm" class="mono" style="font-size:52px;line-height:1">68</b><span class="mono mute" style="font-size:11px">bpm · ${t('3-zona', 'зона 3', 'zone 3')}</span>
      </div>
    </div>
    <svg class="ab" id="wr-ecg" width="560" height="120" viewBox="0 0 560 120" style="left:40px;top:250px"></svg>
    <div class="ab" style="left:0;right:0;top:390px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap">${['Mi Band', 'Apple Health', 'Google Fit'].map(x => `<span class="gc wr-src" style="display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;font-size:14px">${CK}${x}</span>`).join('')}</div>
    <div class="ab" style="left:0;right:0;top:470px;display:flex;justify-content:center;gap:6px">${['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map((z, i) => `<span class="pill wr-z${i === 2 ? ' hot' : ''}">${z}</span>`).join('')}<span class="pill wr-z">412 kcal</span></div>
  </div></div>`)

  // 13. nutrition (soon)
  const R = (r, c, p) => `<g><circle r="${r}" fill="none" stroke="rgb(255 255 255/.07)" stroke-width="12"/><circle class="fd-ring" data-p="${p}" r="${r}" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * r).toFixed(1)}" stroke-dashoffset="${(2 * Math.PI * r).toFixed(1)}" transform="rotate(-90)"/></g>`
  add({ id: 'food', cls: 'flip', title: t('Ovqat va makrolar', 'Питание и макросы', 'Nutrition and macros') }, `${txt(++n, t('Ovqat va makrolar', 'Питание и макросы', 'Nutrition & macros'), t('Oqsil yetdimi&nbsp;— <em>ko‘rinadi.</em>', 'Хватило ли белка&nbsp;— <em>видно.</em>', 'Enough protein?&nbsp;— <em>you’ll see.</em>'), t("Oqsil, uglevod, yog' va kaloriya. Bazada palov ham, tvorog ham bor.", 'Белки, углеводы, жиры и калории. В базе есть и плов, и творог.', 'Protein, carbs, fat and calories. Plov and cottage cheese are both in the database.'), true)}
  <div class="vis"><div class="vbox">
    <div class="ab gc" id="fd-card" style="left:20px;top:20px;width:600px;padding:22px;display:flex;gap:26px;align-items:center">
      <svg width="200" height="200" viewBox="-100 -100 200 200">${R(88, 'rgb(198 244 50)', .85)}${R(68, 'rgb(255 198 64)', .62)}${R(48, 'rgb(255 90 54)', .48)}</svg>
      <div style="flex:1">
        <div class="eb">${t('Bugun', 'Сегодня', 'Today')}</div>
        <div class="big" style="margin:6px 0 12px"><span id="fd-k">0</span> <span class="mute" style="font-size:16px">/ 2 600 kcal</span></div>
        ${[[t('Oqsil', 'Белки', 'Protein'), '128 / 150 g', 'acc'], [t('Uglevod', 'Углеводы', 'Carbs'), '210 / 340 g', 'gold'], [t("Yog'", 'Жиры', 'Fat'), '58 / 120 g', 'hot']].map(([a, b, c]) => `<div style="display:flex;justify-content:space-between;font-size:14px;padding:5px 0"><span class="${c}">● ${a}</span><span class="mono">${b}</span></div>`).join('')}
      </div>
    </div>
    ${[[t('Palov', 'Плов', 'Plov'), t('1 likopcha', '1 тарелка', '1 plate'), '620 kcal · P 22'], [t('Tvorog 5%', 'Творог 5%', 'Cottage cheese 5%'), '200 g', '242 kcal · P 34'], [t('Tuxum', 'Яйца', 'Eggs'), '3 ta', '210 kcal · P 18']].map(([a, b, c], k) => `<div class="ab gc fd-i" style="left:20px;top:${290 + k * 74}px;width:600px;height:62px;padding:0 18px;display:flex;align-items:center;gap:12px;border-radius:16px"><b style="font-size:15px">${a}</b><span class="mute" style="font-size:13px">${b}</span><span class="mono acc" style="margin-left:auto;font-size:12px">${c}</span></div>`).join('')}
  </div></div>`)

  // 14. form check (soon)
  const J = [[300, 70], [300, 140], [262, 200], [300, 270], [252, 340], [280, 420]]
  add({ id: 'form', title: t('Video texnika tahlili', 'Видео-разбор техники', 'Video form check') }, `${txt(++n, t('Texnika tahlili', 'Разбор техники', 'Form check'), t("Kamera texnikangizni <em>ko'radi.</em>", 'Камера видит вашу <em>технику.</em>', 'The camera <em>sees your form.</em>'), t("Telefonni qo'ying — bo'g'im burchaklari, chuqurlik va orqa holati real vaqtda.", 'Поставьте телефон — углы суставов, глубина и положение спины в реальном времени.', 'Prop up your phone — joint angles, depth and back position in real time.'), true)}
  <div class="vis"><div class="vbox">
    <div class="ab" id="fm-cam" style="left:120px;top:0;width:400px;height:470px;border-radius:26px;overflow:hidden;background:radial-gradient(80% 60% at 50% 40%,#23262b,#0c0d0f);border:1px solid rgb(var(--fg)/.1)">
      <div class="ab mono" style="left:14px;top:12px;font-size:11px;color:rgb(255 90 54)">● REC · Back squat</div>
      <div class="ab" id="fm-scan" style="left:0;right:0;top:60px;height:2px;background:linear-gradient(90deg,transparent,rgb(198 244 50/.8),transparent)"></div>
      <svg class="ab" width="400" height="470" viewBox="100 0 400 470" style="left:0;top:0">
        ${J.slice(0, -1).map((p, i) => `<path class="fm-b" d="M${p[0]} ${p[1]}L${J[i + 1][0]} ${J[i + 1][1]}" stroke="rgb(198 244 50)" stroke-width="6" stroke-linecap="round" fill="none"/>`).join('')}
        <path class="fm-b" d="M300 140 L360 180 L330 230" stroke="rgb(198 244 50/.7)" stroke-width="5" stroke-linecap="round" fill="none"/>
        ${J.map(([x, y], i) => `<circle class="fm-j" cx="${x}" cy="${y}" r="${i ? 9 : 22}" fill="${i ? 'rgb(255 90 54)' : 'rgb(255 255 255/.15)'}" stroke="#fff" stroke-width="2"/>`).join('')}
        <path d="M282 320 A30 30 0 0 1 270 352" stroke="#fff" stroke-width="2" fill="none"/>
      </svg>
      <div class="ab gc" style="left:236px;top:300px;padding:6px 12px;border-radius:12px"><b id="fm-a" class="mono" style="font-size:22px">160°</b></div>
    </div>
    <div class="ab" style="left:0;right:0;top:486px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap">${[t('Chuqurlik ✓', 'Глубина ✓', 'Depth ✓'), t('Orqa tekis', 'Спина ровная', 'Back neutral'), t('Tizza oyoq uchida', 'Колено над носком', 'Knee over toe')].map(x => `<span class="gc fm-c" style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;font-size:13px">${CK}${x}</span>`).join('')}</div>
  </div></div>`)

  // 15. gyms & trainers (soon)
  const qr = []
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) {
    const fin = (a, b) => x >= a && x < a + 5 && y >= b && y < b + 5
    const inF = fin(0, 0) || fin(12, 0) || fin(0, 12)
    const on = inF ? (x % 4 === 0 || y % 4 === 0 || (x % 4 === 2 && y % 4 === 2) || x === 4 || y === 4 || x === 16 || y === 16) : rnd() > .52
    if (on) qr.push(`<rect class="q" x="${x * 10}" y="${y * 10}" width="9" height="9" rx="2"/>`)
  }
  add({ id: 'gyms', cls: 'flip', title: t('Murabbiylar, zallar va QR kirish', 'Тренеры, залы и вход по QR', 'Trainers, gyms and QR check-in') }, `${txt(++n, t('Murabbiylar va zallar', 'Тренеры и залы', 'Trainers & gyms'), t('Zalga kirish&nbsp;— <em>QR bilan.</em>', 'Вход в зал&nbsp;— <em>по QR.</em>', 'Gym entry&nbsp;— <em>by QR.</em>'), t("Murabbiy toping, abonement oling, zalga telefon bilan kiring. Murabbiy rejangizni ko'radi.", 'Найдите тренера, купите абонемент, входите по телефону. Тренер видит ваш план.', 'Find a trainer, buy a membership, walk in with your phone. Your trainer sees your plan.'), true)}
  <div class="vis"><div class="vbox">
    ${[['Sardor', t('Kuch · 8 yil', 'Сила · 8 лет', 'Strength · 8 yrs'), '★ 4.9', '120k'], ['Madina', t('Fitnes · 5 yil', 'Фитнес · 5 лет', 'Fitness · 5 yrs'), '★ 4.8', '90k'], ['Jasur', t('Kross-trening', 'Кросс-тренинг', 'Cross-training'), '★ 4.7', '100k']].map(([a, b, c, d], k) => `<div class="ab gc gy-t" style="left:0;top:${k * 108}px;width:300px;height:94px;padding:14px;display:flex;align-items:center;gap:12px"><span style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font:600 20px var(--display);background:${['rgb(198 244 50/.18)', 'rgb(255 90 54/.18)', 'rgb(86 170 255/.18)'][k]}">${a[0]}</span><span style="flex:1"><b style="display:block;font-size:15px">${t('Murabbiy', 'Тренер', 'Coach')} ${a}</b><span class="mute" style="font-size:12.5px">${b}</span></span><span style="text-align:right"><span class="gold mono" style="font-size:12px;display:block">${c}</span><span class="mono mute" style="font-size:11px">${d} ${t("so'm", 'сум', 'UZS')}</span></span></div>`).join('')}
    <div class="ab gc" id="gy-qr" style="left:330px;top:0;width:300px;height:420px;padding:20px;text-align:center">
      <div class="eb">${t('Chilonzor zali · abonement', 'Зал Чиланзар · абонемент', 'Chilonzor gym · membership')}</div>
      <div style="position:relative;width:190px;height:190px;margin:18px auto;padding:10px;background:#fff;border-radius:16px">
        <svg width="170" height="170" viewBox="0 0 170 170" fill="#0a0b0d">${qr.join('')}</svg>
        <div id="gy-scan" style="position:absolute;left:0;right:0;top:50%;height:3px;background:rgb(198 244 50);box-shadow:0 0 12px rgb(198 244 50)"></div>
      </div>
      <div class="mute" style="font-size:13px">${t('12 / 30 kun qoldi', 'Осталось 12 / 30 дней', '12 / 30 days left')}</div>
      <div id="gy-ok" style="margin-top:14px"><span class="pill good" style="height:32px;font-size:13px">✓ ${t('Kirish ruxsat etildi · 18:04', 'Вход разрешён · 18:04', 'Check-in OK · 18:04')}</span></div>
    </div>
  </div></div>`)

  // 16. social + telegram (soon)
  add({ id: 'social', title: t('Telegram eslatma va challenge', 'Напоминания в Telegram и челленджи', 'Telegram reminders and challenges') }, `${txt(++n, t("Do'stlar bilan", 'С друзьями', 'With friends'), t('Birga&nbsp;— <em>tashlab ketmaysiz.</em>', 'Вместе&nbsp;— <em>не бросите.</em>', 'Together&nbsp;— <em>you won’t quit.</em>'), t("Telegram bot vaqtida eslatadi, do'stlar bilan 30 kunlik challenge reytingi.", 'Telegram-бот напомнит вовремя, а 30-дневный челлендж с друзьями держит в тонусе.', 'The Telegram bot pings you on time; a 30-day challenge with friends keeps you going.'), true)}
  <div class="vis"><div class="vbox">
    ${phone(`<div class="tg-h"><div class="tg-av"><b></b></div><div><div class="tg-n">gym.dtwin</div><div class="tg-s">bot</div></div></div>
      <div class="tg-body">
        <div class="msg in">🔔 ${t('Bugun Legs kuni — 18:00. Tayyormisiz?', 'Сегодня день ног — 18:00. Готовы?', 'Leg day today — 18:00. Ready?')}<div class="kb"><span>✓ ${t('Ha', 'Да', 'Yes')}</span><span>⏰ +1 ${t('soat', 'час', 'hr')}</span></div><small>17:00</small></div>
        <div class="msg out">✓ ${t('Ha', 'Да', 'Yes')}<small>17:01</small></div>
        <div class="msg in">🔥 ${t('Aziza bugun 21-kunni yopdi. Siz 18-kundasiz!', 'Азиза закрыла 21-й день. Вы на 18-м!', 'Aziza just closed day 21. You’re on day 18!')}<small>19:12</small></div>
      </div>`, 'left:0;top:0')}
    <div class="ab gc" id="sc-board" style="left:310px;top:120px;width:320px;padding:18px">
      <div class="eb" style="margin-bottom:12px">${t('Challenge · 30 kun', 'Челлендж · 30 дней', 'Challenge · 30 days')}</div>
      ${[['Aziza', 21], [t('Siz', 'Вы', 'You'), 18], ['Bekzod', 15], ['Dilnoza', 12]].map(([a, v], k) => `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;font-size:14px${k === 1 ? ';color:rgb(var(--acc));font-weight:700' : ''}"><span class="mono mute" style="width:14px">${k + 1}</span><span style="width:70px">${a}</span><span style="flex:1;height:8px;border-radius:4px;background:rgb(var(--fg)/.07);overflow:hidden"><span class="sc-b" style="display:block;height:100%;width:${v / 30 * 100}%;background:${k === 1 ? 'rgb(var(--acc))' : 'rgb(var(--fg)/.3)'};border-radius:4px"></span></span><span class="mono" style="font-size:12px">${v}</span></div>`).join('')}
      <div id="sc-badge" style="margin-top:12px"><span class="pill gold">🏅 ${t('7 kun ketma-ket', '7 дней подряд', '7-day streak')}</span></div>
    </div>
  </div></div>`)

  // 17. dtwin integration (soon)
  add({ id: 'dtwin', cls: 'flip', title: t('dtwin bilan bog‘lanish', 'Связка с dtwin', 'dtwin integration') }, `${txt(++n, t('dtwin oilasi', 'Семья dtwin', 'dtwin family'), t('Mashg‘ulot&nbsp;— <em>hayot rejangizda.</em>', 'Тренировка&nbsp;— <em>в плане жизни.</em>', 'Training&nbsp;— <em>in your life plan.</em>'), t("gym.dtwin dtwin.uz bilan ulanadi: mashg'ulot kun rejangizga tushadi, bitta akkaunt — hamma qurilmada.", 'gym.dtwin связывается с dtwin.uz: тренировки попадают в план дня, один аккаунт на всех устройствах.', 'gym.dtwin links with dtwin.uz: workouts land in your day plan, one account on every device.'), true)}
  <div class="vis"><div class="vbox">
    <div class="ab gc" id="dt-card" style="left:20px;top:10px;width:600px;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div class="eb">dtwin · ${t('bugun', 'сегодня', 'today')}</div><span class="pill acc">dtwin.uz</span></div>
      ${[['06:15', t("Kitob o'qish", 'Чтение', 'Reading'), 'sec'], ['09:00', t('Ish · loyiha', 'Работа · проект', 'Work · project'), ''], ['13:00', t('Tushlik', 'Обед', 'Lunch'), '']].map(([a, b]) => `<div class="dt-s"><span class="mono mute">${a}</span><span>${b}</span></div>`).join('')}
      <div class="dt-s" id="dt-w" style="background:rgb(198 244 50/.12);border-color:rgb(198 244 50/.45)"><span class="mono acc">18:00</span><span><b>🏋 Legs</b> · gym.dtwin · 5 ${t('mashq', 'упражнений', 'exercises')}</span></div>
      <div class="dt-s"><span class="mono mute">21:30</span><span>${t('Kunni yakunlash', 'Итоги дня', 'Day review')}</span></div>
    </div>
    <div class="ab" style="left:0;right:0;top:420px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap">${[t('Telefon', 'Телефон', 'Phone'), t('Kompyuter', 'Компьютер', 'Laptop'), 'Telegram'].map(x => `<span class="gc dt-dev" style="display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;font-size:14px">${CK}${x}</span>`).join('')}</div>
  </div></div>`)

  // 18. final
  add({ id: 'final', cls: 'center final', hold: 6, title: t('Birinchi setni bugun yozing', 'Запишите первый подход сегодня', 'Log your first set today') }, `  <div class="vis bgv"><div class="vbox" style="width:640px;height:640px"><svg class="ab" viewBox="-320 -320 640 640" width="640" height="640"><g id="fn-rings"></g></svg></div></div>
  <div class="txt">
    <div class="kick">gym.dtwin</div>
    <h2 class="h" style="font-size:clamp(32px,5.4vw,80px)">${t('Birinchi setni <em>bugun</em> yozing.', 'Запишите первый подход <em>сегодня.</em>', 'Log your first set <em>today.</em>')}</h2>
    <p class="lead">${t('Bepul. Akkauntsiz. Telefonda ham, kompyuterda ham.', 'Бесплатно. Без аккаунта. На телефоне и на компьютере.', 'Free. No account. On your phone and your laptop.')}</p>
    <div class="after" style="margin-top:28px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <a class="cta" href="${APP}">${t("Mashg'ulotni boshlash", 'Начать тренировку', 'Start training')}</a>
      <a class="cta ghost" href="${HOME}">gym.dtwin.uz</a>
    </div>
    <div class="after mono mute" style="margin-top:18px;font-size:12px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap"><a href="#1" data-go="0" style="color:inherit">↺ ${t("boshidan ko'rish", 'смотреть сначала', 'watch again')}</a><a href="/deck/tadqiqot.html" style="color:inherit">${t('Bozor tadqiqoti', 'Исследование рынка', 'Market research')} ↗</a><a href="/deck/konsept.html" style="color:inherit">${t('Sayt konsepti', 'Концепт сайта', 'Site concept')} ↗</a></div>
  </div>`)
  return S.join('\n\n')
}

const CSS = `:root{
  --bg:10 11 13; --bg2:18 20 23; --fg:255 255 255;
  --ink:244 246 240; --ink2:200 205 210; --ink3:160 166 172; --mute:128 136 144;
  --acc:198 244 50; --acc-ink:16 20 4; --now:255 90 54; --good:110 220 150; --sec:86 170 255; --hot:255 90 54; --gold:255 198 64;
  --tg:42 171 238;
  --display:'Unbounded','Inter',ui-sans-serif,system-ui,sans-serif;
  --sans:'Inter',ui-sans-serif,system-ui,'Segoe UI',sans-serif;
  --mono:'JetBrains Mono',ui-monospace,'Cascadia Code',Consolas,monospace;
  --vs:1;
}
${src('base.css')}
.glow{background:radial-gradient(40% 35% at 18% 12%,rgb(var(--acc)/.14),transparent 70%),radial-gradient(45% 40% at 85% 90%,rgb(var(--hot)/.16),transparent 70%)}
.h{font-family:var(--display);font-weight:600;letter-spacing:-.035em;line-height:1.06;font-size:clamp(28px,4vw,58px)}
.h em{color:rgb(var(--acc))}
.h em .w>span{background:linear-gradient(100deg,rgb(var(--acc)),rgb(var(--gold)) 70%,rgb(var(--hot)));-webkit-background-clip:text;background-clip:text;color:transparent}
.kick::before{background:rgb(var(--hot))}
.soon{margin-left:4px;display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font:600 9.5px var(--mono);letter-spacing:.08em;background:rgb(var(--hot)/.14);border:1px solid rgb(var(--hot)/.4);color:rgb(var(--hot))}
.logo{transform:rotate(-12deg)}.brand{font-family:var(--display);font-size:15px}.brand span.b{color:rgb(var(--acc))}
.pill.hot{background:rgb(var(--hot)/.15);border-color:rgb(var(--hot)/.4);color:rgb(var(--hot))}
.pill.gold{background:rgb(var(--gold)/.14);border-color:rgb(var(--gold)/.4);color:rgb(var(--gold))}
.hot{color:rgb(var(--hot))}.gold{color:rgb(var(--gold))}
.big{font-family:var(--display);font-weight:600}
.ov-x{position:fixed;top:calc(16px + env(safe-area-inset-top));right:16px}
.final .bgv{opacity:.85}.cover .bgv{opacity:.42}
#dust{position:fixed;inset:0;z-index:0;pointer-events:none}
/* plan */
.pl-c{transition:border-color .35s,background .35s}.pl-c.on{border-color:rgb(var(--acc)/.6);background:linear-gradient(180deg,rgb(198 244 50/.14),rgb(19 19 23/.85))}
.pl-i{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;font:700 12px var(--mono);background:rgb(var(--fg)/.07);color:rgb(var(--ink2))}
.pl-c.on .pl-i{background:rgb(var(--acc));color:rgb(var(--acc-ink))}
.lg-h{transition:opacity .35s}.pl-d{display:none}.pl-d.show{display:grid;gap:8px}
.pl-day{display:flex;align-items:center;gap:10px;height:52px;padding:0 14px;border-radius:14px;background:rgb(var(--fg)/.04);border:1px solid rgb(var(--fg)/.08);font-size:15px}
.pl-day b{flex:1;font-weight:600}.pl-day.now{border-color:rgb(var(--hot)/.5);background:rgb(var(--hot)/.08)}
/* today */
.td-li{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgb(var(--fg)/.07);font-size:12.5px}
.td-li .mono{font-size:10.5px}
.td-go{margin-top:12px;height:40px;border-radius:12px;background:rgb(var(--acc));color:rgb(var(--acc-ink));display:grid;place-items:center;font-weight:700;font-size:14px;box-shadow:0 0 0 0 rgb(198 244 50/.6)}
.td-st{padding:8px;border-radius:10px;background:rgb(var(--fg)/.05);text-align:center}.td-st b{display:block;font:600 15px var(--mono)}.td-st span{font-size:9.5px;color:rgb(var(--mute))}
/* log */
.lg-r{display:flex;align-items:center;gap:12px;padding:10px;margin-top:10px;border-radius:16px;background:rgb(var(--fg)/.03);border:1px solid rgb(var(--fg)/.08);transition:background .3s,border-color .3s}
.lg-r.done{background:rgb(198 244 50/.08);border-color:rgb(198 244 50/.3)}
.lg-f{flex:1;height:46px;border-radius:12px;background:rgb(var(--fg)/.06);display:flex;align-items:center;justify-content:center;gap:5px;font:700 19px var(--mono)}.lg-f small{font-size:11px;color:rgb(var(--mute));font-weight:500}
.lg-r .ck{width:46px;height:46px;border-radius:13px}.lg-r .ck svg{width:20px;height:20px}
/* exercises */
.ex-it{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid rgb(var(--fg)/.07)}
.ex-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgb(var(--fg)/.06);font-size:18px}
.caret{display:inline-block;width:2px;height:18px;margin-left:2px;background:rgb(var(--acc));animation:cr 1s steps(1) infinite}@keyframes cr{50%{opacity:0}}
/* heatmap */
#hm{display:grid;grid-template-rows:repeat(7,22px);grid-auto-flow:column;gap:5px}
#hm i{border-radius:5px;background:rgb(var(--fg)/.06)}#hm i.l1{background:rgb(198 244 50/.5)}#hm i.l2{background:rgb(198 244 50);box-shadow:0 0 10px -2px rgb(198 244 50/.7)}
/* weight */
.wt-r{display:grid;grid-template-columns:130px 1fr 70px;align-items:center;gap:12px;padding:7px 0;font-size:14px}
.wt-r i{height:8px;border-radius:4px;background:rgb(var(--fg)/.07);overflow:hidden}.wt-r i b{display:block;height:100%;background:linear-gradient(90deg,rgb(var(--acc)),rgb(var(--gold)));border-radius:4px}
.wt-r .mono{text-align:right;font-size:12.5px}
/* langs */
.lg-h{position:absolute;inset:0;opacity:0;font:600 30px var(--display);letter-spacing:-.03em;line-height:1.15}.lg-h.show{opacity:1}
/* coach */
.co-x{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-top:1px solid rgb(var(--fg)/.07);font-size:13px}
.co-x s{font-size:12px}
/* dtwin */
.dt-s{display:flex;gap:16px;align-items:center;height:52px;padding:0 14px;margin-top:8px;border-radius:14px;border:1px solid rgb(var(--fg)/.08);background:rgb(var(--fg)/.03);font-size:14.5px}
.dt-s .mono{font-size:12px;width:44px}
@media (max-width:520px){.ctl .cnt{display:none}}
@media (max-aspect-ratio:1/1){.cover .bgv .vbox,.final .bgv .vbox{opacity:.7}}
`

const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>'

function page(lang) {
  LANG = lang
  const base = lang === 'uz' ? '/overview/' : `/overview/${lang}/`
  const title = t("gym.dtwin — har bir set, kuchingiz tarixi", 'gym.dtwin — каждый подход, история силы', 'gym.dtwin — every set, your strength story')
  const desc = t("gym.dtwin: tayyor reja, bir bosishda set yozish, 90 s dam taymeri, rekordlar va progress. Bepul, akkauntsiz. Bir daqiqalik jonli tanishuv.", 'gym.dtwin: готовый план, подходы в одно касание, таймер отдыха, рекорды и прогресс. Бесплатно, без аккаунта. Живой обзор за минуту.', 'gym.dtwin: ready plans, one-tap set logging, rest timer, records and progress. Free, no account. A one-minute live tour.')
  return `<!doctype html>
<html lang="${lang}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#0A0B0D">
<meta property="og:type" content="website">
<meta property="og:site_name" content="gym.dtwin">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="https://gym.dtwin.uz${base}">
<link rel="alternate" hreflang="uz" href="https://gym.dtwin.uz/overview/">
<link rel="alternate" hreflang="ru" href="https://gym.dtwin.uz/overview/ru/">
<link rel="alternate" hreflang="en" href="https://gym.dtwin.uz/overview/en/">
<link rel="alternate" hreflang="x-default" href="https://gym.dtwin.uz/overview/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<canvas id="sky"></canvas><div class="glow"></div><div class="grain"></div>

<header class="top">
  <div class="segs" id="segs"></div>
  <div class="bar">
    <a class="brand" href="/" style="color:inherit;text-decoration:none"><span class="logo">${LOGO}</span>gym<span class="b">.dtwin</span></a>
    <div class="ctl">
      <span class="cnt" id="cnt">01 / 01</span>
      <details class="lng"><summary aria-label="${t('Til', 'Язык', 'Language')}">${lang.toUpperCase()}</summary><div class="lng-m"><a href="/overview/?lang=uz" lang="uz"${lang === 'uz' ? ' aria-current="page"' : ''}>O'zbekcha</a><a href="/overview/ru/" lang="ru"${lang === 'ru' ? ' aria-current="page"' : ''}>Русский</a><a href="/overview/en/" lang="en"${lang === 'en' ? ' aria-current="page"' : ''}>English</a></div></details>
      <button id="play" title="${t('Pauza (P)', 'Пауза (P)', 'Pause (P)')}" aria-label="${t('Pauza', 'Пауза', 'Pause')}"></button>
      <button id="menu" title="${t('Barcha slaydlar (O)', 'Все слайды (O)', 'All slides (O)')}" aria-label="${t('Barcha slaydlar', 'Все слайды', 'All slides')}"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg></button>
      <button id="fs" class="hide-m" title="${t("To'liq ekran (F)", 'Полный экран (F)', 'Fullscreen (F)')}" aria-label="${t("To'liq ekran", 'Полный экран', 'Fullscreen')}"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      <a class="cta-mini" href="${APP}">${t('Boshlash', 'Начать', 'Start')}</a>
    </div>
  </div>
</header>

<main class="deck" id="deck">
${slides()}
</main>

<button class="nav prev" id="pv" aria-label="${t('Oldingi', 'Назад', 'Previous')}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
<button class="nav next" id="nx" aria-label="${t('Keyingi', 'Далее', 'Next')}"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
<div class="hint">${t("← → yoki bosing · P pauza · O hammasi · F to'liq ekran", '← → или нажмите · P пауза · O все · F полный экран', '← → or tap · P pause · O all · F fullscreen')}</div>
<div class="paused-pill">${t('pauza · davom etish uchun P yoki ▶', 'пауза · P или ▶, чтобы продолжить', 'paused · press P or ▶ to resume')}</div>

<div class="ov" id="ov"><div class="ctl ov-x"><button id="ovx">${t('Yopish ✕', 'Закрыть ✕', 'Close ✕')}</button></div><h3>gym.dtwin · ${t("barcha bo'limlar", 'все разделы', 'all sections')}</h3><div class="ov-g"></div></div>

<script src="/overview/deck.js?v=${VER}"></script>
</body>
</html>
`
}

// backdrop: chalk dust rising + faint heart-rate line
const SKY = `;
(() => {
  const c = document.getElementById('sky'), x = c.getContext('2d')
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || location.search.includes('shot')
  let W, H, D, dust = [], last = 0, ph = 0
  const beat = u => { const g = (a, w) => Math.exp(-((u - a) * (u - a)) / (2 * w * w)); return .12 * g(.18, .025) - .14 * g(.3, .008) + g(.33, .009) - .28 * g(.36, .01) + .24 * g(.56, .04) }
  function size() {
    D = Math.min(1.5, devicePixelRatio || 1)
    W = innerWidth * D; H = innerHeight * D
    c.width = W; c.height = H; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'
    const n = Math.round(innerWidth * innerHeight / 9000)
    dust = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.4 + .5) * D, v: (Math.random() * .12 + .04) * D * 30, a: Math.random() * .4 + .1, p: Math.random() * 6.3, g: Math.random() < .25 }))
    if (still) draw(0, 0)
  }
  function draw(t, dt) {
    x.clearRect(0, 0, W, H)
    for (const d of dust) {
      if (dt) { d.y -= d.v * dt; d.x += Math.sin(t * .3 + d.p) * 3 * D * dt; if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W } }
      x.globalAlpha = d.a; x.fillStyle = d.g ? '#C6F432' : '#F4F6F0'
      x.beginPath(); x.arc(d.x, d.y, d.r, 0, 6.283); x.fill()
    }
    const y0 = H * .86, amp = H * .05, per = 320 * D
    x.globalAlpha = .22; x.strokeStyle = '#FF5A36'; x.lineWidth = 2 * D; x.beginPath()
    for (let px = 0; px <= W; px += 3 * D) { const u = (((px / per) - ph) % 1 + 1) % 1; const yy = y0 - beat(u) * amp; px ? x.lineTo(px, yy) : x.moveTo(px, yy) }
    x.stroke(); x.globalAlpha = 1
    if (dt) ph += dt * .35
  }
  function frame(now) {
    requestAnimationFrame(frame)
    const dt = Math.min(.05, (now - last) / 1000); last = now
    if (!document.hidden) draw(now / 1000, dt)
  }
  size(); addEventListener('resize', size)
  if (!still) requestAnimationFrame(t => { last = t; frame(t) })
})()
`

const I18N = `;
(() => {
const lang = document.documentElement.lang
window.OV_LANG = ['uz', 'ru', 'en'].includes(lang) ? lang : 'uz'
window.OV_T = {}
})()
`

mkdirSync(join(out, 'ru'), { recursive: true })
mkdirSync(join(out, 'en'), { recursive: true })
writeFileSync(join(out, 'deck.js'), src('gsap.js') + '\n' + SKY + I18N + src('scenes.js') + '\n;\n' + src('engine.js'))
for (const l of LANGS) writeFileSync(join(out, l === 'uz' ? 'index.html' : `${l}/index.html`), page(l))
console.log('overview built', VER)

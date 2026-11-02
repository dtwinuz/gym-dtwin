# gym.dtwin

Mashg'ulot kundaligi MVP — https://gym.dtwin.uz

Struktura g'oyasi [openGym](https://github.com/DuarteSantos8/openGym) dan olingan (reja → mashg'ulot → progress), kod esa o'zimizniki (openGym AGPL-3.0, uning kodi va media'si ko'chirilmagan).

## Imkoniyatlar
- **Mashqlar** - 1827 mashqli kutubxona (free-exercise-db 876 + exercises-dataset matni 951, rasmsiz), 341 tasi uz/ru nomli; sinonim va xatoga chidamli qidiruv, filtrlar, jihozlar profili, tana xaritasi (MuscleMap), sevimlilar, o'z mashqlarim
- **Reja** - hafta va rotatsiya jadvali, routine editor (superset, slot sozlamalari, progression), 8 ta starter reja, onboarding, reja fayli, chop etish, Ramazon va issiq kunlar rejimi
- **Mashg'ulot** - reps/time/cardio setlari, rest timer, warm-up, drop, rest-pause, pyramid, per-side, RIR/RPE, disk kalkulyatori, swap va zaxira, klaviatura, yakuniy hisobot, keyingi safar retsepti, rasm ulashish
- **Progress** - statistika, 12 oylik heatmap, mushak xaritasi 3 rejimda, 1RM grafigi, structural balance, tarixni tahrirlash, tana vazni va o'lchamlar, progress foto (faqat qurilmada)
- **Ma'lumot** - JSON backup va restore, CSV eksport, Strong/Hevy/FitNotes/umumiy CSV import
- uz / ru / en, tema va accent, qidiruvli sozlamalar; ma'lumot brauzerda (local-first), akkaunt shart emas. Sinxron (W8) dtwin bilan kelishuvdan keyin yoqiladi

Reja va holat: [docs/PLAN.md](docs/PLAN.md), [gym-dtwin project](https://github.com/orgs/dtwinuz/projects/10).

## Sahifalar
- `/` — landing (3D shtanga + puls chizig'i, uz/ru/en, yorug'/qorong'i); ilova `#/home`, `#/plan`, `#/workout`, `#/exercises`, `#/progress`
- `/overview/` (+ `ru/`, `en/`) — Stories uslubidagi tanishuv; manba `scripts/build-overview.mjs` + `scripts/overview/` (engine, scenes, css, gsap), natija `public/overview/`. Qayta yig'ish qo'lda: `node scripts/build-overview.mjs` (`npm run build` uni chaqirmaydi)
- `/deck/tadqiqot.html`, `/deck/konsept.html` — prezentatsiyalar

## Katalog ma'lumotlari
Generatsiya qilinadi, qo'lda tahrir qilinmaydi (`src/catalogue/data/`):
```bash
node scripts/build-catalogue.mjs <free-exercise-db checkout>   # exercises.json + steps.{en,uz,ru}.json
python -I scripts/build-images.py <free-exercise-db checkout> public/ex   # 480px webp
node scripts/build-musclemap.mjs <MuscleMap checkout>          # body.json
node scripts/build-exdb.mjs [exercises.json]                   # exdb.json + exdb.steps.{en,ru}.json (pinned SHA dan yuklaydi)
```
uz/ru nom, ko'rsatma va sinonimlar — o'zimiz yozgan `content/exercises-i18n.json` va `content/exdb-i18n.json`. Manbalar va litsenziyalar: [NOTICE](NOTICE) (free-exercise-db — Unlicense, MuscleMap — MIT, exercises-dataset — MIT, faqat matn). openGym katalogi, tarjimalari va Gym Visual media ishlatilmaydi.

## Stek
Vite + React 19 + TypeScript, lucide-react, three.js (faqat landing, lazy). Router — hash (`#/plan`).

## Ishga tushirish
```bash
npm install
npm run dev
npm run build     # tsc -b && vite build → dist/
npm run lint      # oxlint
npm run preview   # dist/ ni lokal ko'rsatish
```

## CI
`.github/workflows/ci.yml`: har PR va `main`ga push'da `npm ci`, `npm run lint`, `npm run build` (Node 24; faqat `*.md` o'zgarsa ishlamaydi). Merge'ni bloklamaydi — natijani PR'da tekshiring. Dependabot oylik: npm va GitHub Actions, 7 kunlik cooldown bilan (`.github/dependabot.yml`).

## Deploy
```bash
bash deploy/deploy.sh   # build → ssh dtwin → /opt/gym-dtwin (caddy konteyner, dtwin-prod_default)
```
Deploy qo'lda: skript lokal `npm run build` qiladi va `dist/` ni VPS'ga ko'chiradi (GHCR image va Release yo'q). Birinchi argument — ssh host (standart `dtwin`); oldingi versiya VPS'da `dist.prev/` da qoladi. TLS va domen dtwin edge Caddy'da (`gym.dtwin.uz → gym-dtwin:80`). Ishlab turgan versiya: https://gym.dtwin.uz/REVISION.

## Sinxron (deploy qilinmagan)
`server/` (API) va akkaunt bo'limi tayyor, lekin `VITE_SYNC_ENABLED` o'chiq: sayt hozircha faqat brauzerda ishlaydi. Arxitektura, dtwin'dan kerak bo'lgan qadamlar va rollout: [docs/W8-SYNC.md](docs/W8-SYNC.md).

## Hissa qo'shish
Qoidalar `dtwinuz` org bo'yicha umumiy: [CONTRIBUTING](https://github.com/dtwinuz/.github/blob/main/CONTRIBUTING.md), [SECURITY](https://github.com/dtwinuz/.github/blob/main/SECURITY.md), [CODE_OF_CONDUCT](https://github.com/dtwinuz/.github/blob/main/CODE_OF_CONDUCT.md). Reviewer — `@dtwinuz/core` (`.github/CODEOWNERS`; GitHub Free'da private repoda CODEOWNERS review'ni avtomatik so'ramaydi — reviewer'ni PR'ga qo'lda qo'shing).

## Keyingi qadamlar
Sinxron va dtwin SSO (W8), PWA va offline, mobil ilova, AI coach, MCP - [project](https://github.com/orgs/dtwinuz/projects/10).

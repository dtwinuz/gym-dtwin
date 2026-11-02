# gym.dtwin

Mashg'ulot kundaligi MVP — https://gym.dtwin.uz

Struktura g'oyasi [openGym](https://github.com/DuarteSantos8/openGym) dan olingan (reja → mashg'ulot → progress), kod esa o'zimizniki (openGym AGPL-3.0, uning kodi va media'si ko'chirilmagan).

## Imkoniyatlar (MVP)
- **Bosh sahifa** — bugungi mashg'ulot (reja aylanishi), haftalik statistika, tarix
- **Reja** — 8 ta starter reja (PPL, Upper/Lower, Full Body, 5×5, trenajyor, uy, dumba, Ramazon), routine muharriri, hafta va rotatsiya jadvali
- **Mashg'ulot** — set/rep/kg kiritish, oxirgi vazn oldindan to'ldiriladi, 90 s dam olish taymeri, PR belgisi
- **Mashqlar** — 876 mashqli kutubxona (free-exercise-db), 187 tasi uz/ru nom va ko'rsatma bilan; sinonim va xatoga chidamli qidiruv (jim, stanovaya, turnik ...), filtrlar (guruh, jihoz, tur, daraja, "menda bor jihoz"), tana xaritasi (MuscleMap) bilan mushak tanlash, sevimlilar, o'z mashqlarim
- **Progress** — 12 haftalik faollik xaritasi, rekordlar (Epley 1RM), tana vazni grafigi
- uz / ru / en, ma'lumot brauzerda (`localStorage`), backend yo'q

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
```
uz/ru nom, ko'rsatma va sinonimlar — o'zimiz yozgan `content/exercises-i18n.json`. Manbalar va litsenziyalar: [NOTICE](NOTICE) (free-exercise-db — Unlicense, MuscleMap — MIT). openGym katalogi, tarjimalari va Gym Visual media ishlatilmaydi.

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

## Hissa qo'shish
Qoidalar `dtwinuz` org bo'yicha umumiy: [CONTRIBUTING](https://github.com/dtwinuz/.github/blob/main/CONTRIBUTING.md), [SECURITY](https://github.com/dtwinuz/.github/blob/main/SECURITY.md), [CODE_OF_CONDUCT](https://github.com/dtwinuz/.github/blob/main/CODE_OF_CONDUCT.md). Reviewer — `@dtwinuz/core` (`.github/CODEOWNERS`; GitHub Free'da private repoda CODEOWNERS review'ni avtomatik so'ramaydi — reviewer'ni PR'ga qo'lda qo'shing).

## Keyingi qadamlar
- Backend + akkaunt (qurilmalar orasida sinxron)
- Progressiya qoidalari (linear, double progression), deload
- Import/eksport (CSV, JSON)

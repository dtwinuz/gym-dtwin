# gym.dtwin

Mashg'ulot kundaligi MVP — https://gym.dtwin.uz

Struktura g'oyasi [openGym](https://github.com/DuarteSantos8/openGym) dan olingan (reja → mashg'ulot → progress), kod esa o'zimizniki (openGym AGPL-3.0, uning kodi va media'si ko'chirilmagan).

## Imkoniyatlar (MVP)
- **Bosh sahifa** — bugungi mashg'ulot (reja aylanishi), haftalik statistika, tarix
- **Reja** — 4 ta starter reja: PPL, Upper/Lower, Full Body, 5×5
- **Mashg'ulot** — set/rep/kg kiritish, oxirgi vazn oldindan to'ldiriladi, 90 s dam olish taymeri, PR belgisi
- **Mashqlar** — 29 ta mashq, mushak bo'yicha filtr, qidiruv, eng yaxshi taxminiy 1RM
- **Progress** — 12 haftalik faollik xaritasi, rekordlar (Epley 1RM), tana vazni grafigi
- uz / ru / en, ma'lumot brauzerda (`localStorage`), backend yo'q

## Sahifalar
- `/` — landing (3D shtanga + puls chizig'i, uz/ru/en, yorug'/qorong'i); ilova `#/home`, `#/plan`, `#/workout`, `#/exercises`, `#/progress`
- `/overview/` (+ `ru/`, `en/`) — Stories uslubidagi tanishuv; manba `scripts/build-overview.mjs` + `scripts/overview/` (engine, scenes, css, gsap), natija `public/overview/`. Qayta yig'ish qo'lda: `node scripts/build-overview.mjs` (`npm run build` uni chaqirmaydi)
- `/deck/tadqiqot.html`, `/deck/konsept.html` — prezentatsiyalar

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
GitHub Actions workflow yo'q (build/lint PR'da avtomatik yurmaydi). Faqat Dependabot — npm, oylik (`.github/dependabot.yml`).

## Deploy
```bash
bash deploy/deploy.sh   # build → ssh dtwin → /opt/gym-dtwin (caddy konteyner, dtwin-prod_default)
```
Deploy qo'lda: skript lokal `npm run build` qiladi va `dist/` ni VPS'ga ko'chiradi (GHCR image va Release yo'q). Birinchi argument — ssh host (standart `dtwin`); oldingi versiya VPS'da `dist.prev/` da qoladi. TLS va domen dtwin edge Caddy'da (`gym.dtwin.uz → gym-dtwin:80`). Ishlab turgan versiya: https://gym.dtwin.uz/REVISION.

## Hissa qo'shish
Qoidalar `dtwinuz` org bo'yicha umumiy: [CONTRIBUTING](https://github.com/dtwinuz/.github/blob/main/CONTRIBUTING.md), [SECURITY](https://github.com/dtwinuz/.github/blob/main/SECURITY.md), [CODE_OF_CONDUCT](https://github.com/dtwinuz/.github/blob/main/CODE_OF_CONDUCT.md). Reviewer — `@dtwinuz/core` (`.github/CODEOWNERS`; GitHub Free'da private repoda CODEOWNERS review'ni avtomatik so'ramaydi — reviewer'ni PR'ga qo'lda qo'shing).

## Keyingi qadamlar
- Backend + akkaunt (qurilmalar orasida sinxron)
- Mashq animatsiyalari / tana xaritasi
- Progressiya qoidalari (linear, double progression), deload
- Import/eksport (CSV, JSON)

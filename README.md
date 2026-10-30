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
- `/overview/` (+ `ru/`, `en/`) — Stories uslubidagi tanishuv; manba `scripts/build-overview.mjs`, qayta yig'ish: `node scripts/build-overview.mjs`
- `/deck/tadqiqot.html`, `/deck/konsept.html` — prezentatsiyalar

## Stek
Vite + React 19 + TypeScript, lucide-react, three.js (faqat landing, lazy). Router — hash (`#/plan`).

## Ishga tushirish
```bash
npm install
npm run dev
```

## Deploy
```bash
bash deploy/deploy.sh   # build → ssh dtwin → /opt/gym-dtwin (caddy konteyner, dtwin-prod_default)
```
TLS va domen dtwin edge Caddy'da (`gym.dtwin.uz → gym-dtwin:80`).

## Keyingi qadamlar
- Backend + akkaunt (qurilmalar orasida sinxron)
- Mashq animatsiyalari / tana xaritasi
- Progressiya qoidalari (linear, double progression), deload
- Import/eksport (CSV, JSON)

# gym.dtwin — openGym darajasidagi web (1-bosqich)

Maqsad: openGym (DuarteSantos8/openGym, v1.4.3, 2026-10-28) imkoniyatlari va UX darajasidagi web ilova.
Keyingi bosqichlar: 2 — PWA/offline + push, 3 — mobil (Capacitor), 4 — AI coach, MCP.

## ⛔ Litsenziya qoidalari (buzilmas)

| Manba | Litsenziya | Biz uchun |
|---|---|---|
| openGym kodi, prompt, openapi, docs, UI matnlari | AGPL-3.0 | **Ko'chirilmaydi.** Faqat xulq-atvor (spec) asosida o'zimiz yozamiz |
| openGym `catalogue/` tavsif, tarjima (ru ham), muscleMap tuzatishlari | AGPL | Ishlatilmaydi |
| Gym visual media (still/clip) | xususiy | **Hech qachon** (hotlink ham, AI ham) |
| yuhonas/free-exercise-db | Unlicense | ✅ Asosiy katalog: 876 mashq, 2 rasm/mashq — rasmlar o'z serverimizda |
| melihcolpan/MuscleMap | MIT | ✅ Tana xaritasi konturlari, upstream'dan o'zimiz konvert qilamiz + NOTICE |
| hasaneyldrm/exercises-dataset (ExerciseDB v1 matni) | MIT | Ixtiyoriy kengaytma, faqat upstream'dan; GIF'lar YO'Q |

uz va ru tarjimalarini o'zimiz yozamiz.

## Arxitektura

- Vite + React 19 + TS, zustand (persist), react-router (hash), vitest.
- `src/core/` — sof domen mantiqi (UI'siz, testli): units, onerm, progression, warmup, plates, volume, muscles, recovery, schedule, pr, csv.
- `src/catalogue/` — `scripts/build-catalogue.mjs` free-exercise-db'dan generatsiya qiladi (qo'lda tahrir qilinmaydi).
- `src/app/` — shell (tab bar, sheet stack, toast), `views/`, `components/`.
- Landing (`src/landing/`) va `/overview`, `/deck` saqlanadi.
- Holat: bitta profil hujjati (local-first, localStorage), har yozuvda `updatedAt` + tombstone — W6 server sinxroni shunga quriladi.

## To'lqinlar

| # | Tarkib | Natija |
|---|---|---|
| W1 | Domen yadrosi + testlar: model, birliklar, 1RM (7 formula + RIR jadvali), progression (linear/greyskull/double/triple/time, stall → deload), warm-up rampa, plate math (DP), hajm, PR, mushak yuklamasi, recovery (half-life), jadval (hafta + rotatsiya) | `npm test` yashil |
| W2 | Katalog: free-exercise-db → generatsiya, rasmlar webp (o'zimizda), qidiruv (sinonim + typo), uz/ru nomlar (eng ko'p ishlatiladigan ~150), MuscleMap tana xaritasi | Kutubxona ishlaydi |
| W3 | Shell + dizayn tizimi (dark/light/system, 8 accent + custom), sheet stack (swipe/backdrop/Esc/back), toast+Undo, Settings (qidiruvli) | Navigatsiya |
| W4 | Plan (hafta + rotatsiya, kun override), RoutineEdit (drag, superset, slot config), starter rejalar (PPL, Upper/Lower, Full Body, 5×5), Home (bugun, hafta tasmasi, streak, vazn kartasi) | Reja tuziladi |
| W5 | Workout: cards/list, set jadvali (reps/time/cardio), rest timer dock (reload'dan omon), warm-up, drop/rest-pause/pyramid, per-side, RIR/RPE, plate qatori, swap/backup, klaviatura, finish summary (PR, keyingi safar) | Mashg'ulot yoziladi |
| W6 | Progress: Stats (tile, 12 oy heatmap, mushak xaritasi 3 rejim, 1RM grafigi, effort), History (tahrir, takror, o'tgan mashg'ulot), body weight + maqsad, o'lchamlar, progress foto, structural balance | To'liq tahlil |
| W7 | Data: JSON backup/restore, CSV export, Strong/Hevy/FitNotes CSV import | Ko'chish |
| W8 | Backend: akkaunt (dtwin SSO yoki passkey), `GET/PUT /api/data` rev + 409 + merge, media upload | Qurilmalar sinxroni |

Har to'lqin: alohida PR (squash), `npm test && npm run build` yashil, deploy userga.

# DM Screen

Harckezelő D&D 5e (2014) mesélőknek: initiative-sorrend csempéken, HP, AC, támadások kattintható dobásokkal, állapotok, encounter-nehézség (DMG 2014), és külön játékos képernyő a második monitorra.

**Megnyitás:** https://szerdori.github.io/dm-screen/

- Ellenfelek importálása az 5e.tools adataiból, játékosok a D&D Beyondról (könyvjelző-gombbal), saját lények űrlappal vagy JSON-sablonnal.
- Az adatok a Firebase-ben (Firestore) vannak, Google-belépéssel érhetők el; a tárolóban csak a program kódja van.
- A játékos képernyő (`player.html`) a DM ablakból nyílik, és ugyanabban a böngészőben élőben követi a harcot.

Frissítés feltöltése: `.\feltoltes.ps1 "Mit változtattunk"` – előtte automatikusan lefutnak a tesztek, és hiba esetén nem tölt fel.

## Tesztek

- `.\teszt.ps1` (vagy dupla kattintás a `teszt.cmd`-n): lefuttatja a regressziós teszteket láthatatlan Chrome-ban, kb. fél perc.
- `.\teszt.ps1 -Online`: az 5e.tools adatok elérhetőségét is ellenőrzi.
- `.\teszt.ps1 -Bongeszo`: látható böngészőben futtatja (hibakereséshez).
- `.\teszt.ps1 -Lefedettseg`: megméri, hogy a tesztek a kód hány százalékát futtatják le (fájlonként: sorok, kód, függvények); a részletes riport (piros = nem futott le) a `%TEMP%\dmscreen-lefedettseg.html` fájlban.
- Új teszt: `tests\tests.js`, a megfelelő `describe(...)` blokkba egy `test('név', () => { ... })` sor. A fájl elején leírás van a segédfüggvényekről.

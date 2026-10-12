# DM Screen

Harckezelő D&D 5e (2014) mesélőknek: initiative-sorrend csempéken, HP, AC, támadások kattintható dobásokkal, állapotok, encounter-nehézség (DMG 2014), és külön játékos képernyő a második monitorra.

**Megnyitás:** https://szerdori.github.io/dm-screen/

- Ellenfelek importálása az 5e.tools adataiból, játékosok a D&D Beyondról (könyvjelző-gombbal), saját lények űrlappal vagy JSON-sablonnal.
- Az adatok a Firebase-ben (Firestore) vannak, Google-belépéssel érhetők el; a tárolóban csak a program kódja van.
- A játékos képernyő (`player.html`) a DM ablakból nyílik, és ugyanabban a böngészőben élőben követi a harcot.

Frissítés feltöltése: `.\feltoltes.ps1 "Mit változtattunk"`

# 0005 – A `sheet.js` változatának őre

*Állapot: elfogadva 2026-10-28. A refaktor 1. lépése általánosítja minden közös fájlra (lásd 0006).*

## Háttér
2026-10-28-án egy böngésző a `sheet.js` régi, gyorsítótárazott példányát használta az új oldallal: az Átállítás gomb hibára futott, és utána a Mentés üres lapot írt három karakterre.

## Döntés
- Az oldalak `sheet.js?v=N`-nel töltik, és összevetik a `Sheet.VERSION`-t a saját várt értékükkel (`karakter.html` → `SHEET_V`, `index.html` → `syncSheets`). Eltérésnél a lapokra nem írnak, és figyelmeztetnek (Ctrl + F5).
- Ha a `sheet.js` új függvényt vagy mezőt kap, amit az oldalak használnak, a számot emelni kell – a pontos helyeket a `CLAUDE.md` sorolja fel.
- Piszkozat nélküli Mentés nem ír.

## Következmények
- Minden ilyen változásnál öt helyen kell a számot átírni; ezt az ellenőrző ügynök is nézi.
- Ugyanez kell a `kozos.js`-re (`?v=N`) és a refaktor után minden közös fájlra.

# 0006 – Rétegek és szerződés

*Állapot: elfogadva 2026-10-29 (a felhasználó döntése). Terv: `TERV-refaktor.md`.*

## Háttér
Az `index.html` egyetlen ≈2500 soros szkript volt, amely egyszerre kezelte a Firebase-t, a harc logikáját, az importálást, a rajzolást és a gombokat; a felhős útvonalak 23 helyen szétszórva szerepeltek, és néhány függvény 100–300 soros volt.

## Döntés
- **Rétegek:** adattár (`Tar`, az egyetlen, ami a `DB` portot hívja) → logika (DOM nélkül) → felület (rajzolás, `AKCIOK`). Egy fájl csak a saját rétegét vagy az alatta lévőt használhatja; teszt figyeli.
- **Szerződés:** minden adatformátum egy helyen (`szerzodes.js` + `SZERZODES.md`, a karakterlapé a `sheet.js`); változáskor először a szerződés és a teszt, aztán a verzió, aztán az oldalak, végül a felhasználó jóváhagyása (és ha kell, a szabályok a konzolba).
- **Bővíthetőség:** nyilvántartások (`IMPORTEROK`, `AKCIOK`, `CALC_LEPESEK`) a hosszú `if`-láncok helyett.
- **Tudás:** egy otthon minden tudásfajtának (lásd `CLAUDE.md` „Hol mi van”).

## Következmények
- Több `<script src>` sor, mindegyik verzióval; a verzióőr minden közös fájlra kiterjed.
- Új kód a rétegszabály szerint készül; a régi lépésenként költözik, minden lépés után élesíthető állapotban.

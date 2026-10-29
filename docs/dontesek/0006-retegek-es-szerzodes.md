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

## Pontosítás (2026-10-30, a 4. lépés: az `index.html` szétbontása)
- A rétegszabály-teszt pontosan: a `js/adat/tar.js`-en kívül sehol nincs `DB.`/`UT.`/`db.`; a `js/logika/*` nem nyúl az oldal DOM-jához (`document.`, `$(`, `innerHTML`, `querySelector`, `createElement`…) – a különálló `DOMParser`-dokumentum megengedett (`stripHtml`); a `js/felulet/*` **kivétel nélkül** nem hívja a `Tar`-t, a logika segédeit kérdezi (`felhoben()`, `szabalyMeta()`). A `js/indulas.js` nem réteg: a `DMApp` köti a `Tar`-t a Firebase-modulhoz.
- Eseményfigyelőt csak az utolsó fájl (`js/indulas.js`) kapcsol fel, és csak ez rajzol betöltéskor (a többi fájl legfelső szintjén deklaráció és a `modul()`-bejelentés van); a felületi fájlok eseményfigyelői `…Esemenyek()` függvényekben vannak.
- A `VART_MODULOK` szándékosan az `index.html`-ben marad, inline, a `<script src>` sorok előtt (lásd 0005): a várt változatok azon az oldalon vannak, amelyik a fájlokat tölti, és induláskor már megvannak.
- Átmenetileg (az 5. lépésig) a logika még hívja a felület értesítőit (`render`, `log`, `setSaveState`…); a szöveges teszt ezt nem tiltja.

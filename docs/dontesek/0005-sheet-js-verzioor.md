# 0005 – A közös fájlok verzióőre

*Állapot: elfogadva 2026-10-28 (csak a `sheet.js`-re); 2026-10-29-én a refaktor 1. lépése minden közös fájlra általánosította.*

## Háttér
2026-10-28-án egy böngésző a `sheet.js` régi, gyorsítótárazott példányát használta az új oldallal: az Átállítás gomb hibára futott, és utána a Mentés üres lapot írt három karakterre.

## Döntés
- A közös fájlokat (`kozos.js`, `sheet.js`, a refaktor után a `js/` alattiak) az oldalak `név.js?v=N`-nel töltik.
- Minden közös fájl bejelenti a változatát: `modul('név', N)` (a `kozos.js` nyilvántartásába, `MODULOK`); a `sheet.js` a `Sheet.VERSION`-t jelenti be.
- Az oldal a saját `VART_MODULOK`-jával veti össze (`regiFajl()` → `elteroModulok`). Eltérésnél (régi vagy be sem jelentett fájl, vagy olyan régi `kozos.js`, amiben még nincs verzióőr) nem ír a felhőbe, és frissítést kér (Ctrl + F5): a DM Screen a lapokra nem ír (`syncSheets`), a `karakter.html` semmit nem ír (`sheetStale`).
- Piszkozat nélküli Mentés nem ír.
- 2026-10-28-ig a `sheet.js` számát kézzel öt helyen kellett emelni; ezt most egy teszt ellenőrzi („verzióőr: a <script src> ?v= száma = …”).

## Következmények
- Ha egy közös fájl olyan nevet kap vagy olyan módon változik, amire az oldalak támaszkodnak: a fájlban a `modul(…)` / `VERSION` számát, és minden oldalon a `?v=N`-t és a `VART_MODULOK`-ot emelni kell. Ha valamelyik kimarad, a teszt elbukik.
- Új közös fájl: `modul('név', 1)` a fájlba, `?v=1` és `név: 1` minden oldalba, amelyik betölti.
- A `player.html` nem ír a felhőbe, ezért nincs `VART_MODULOK`-ja; a `?v=` számának ott is egyeznie kell (a teszt nézi).
- 2026-10-30 (refaktor 4. lépés): a DM Screen `VART_MODULOK`-ja az `index.html`-ben inline `<script>`, a `<script src>` sorok **előtt** – így az utolsó fájl (`js/indulas.js`) betöltéskori rajzolása alatt is megvan (különben a `regiFajl()` hibára futna). A modulnév a fájlnév `.js` nélkül, ezért mappától függetlenül egyedinek kell lennie.

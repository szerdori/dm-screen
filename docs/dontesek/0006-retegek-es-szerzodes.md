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
- ~~Átmenetileg (az 5. lépésig) a logika még hívja a felület értesítőit.~~ Megszűnt, lásd a következő pontosítást.

## Pontosítás (2026-10-30, az 5. lépés: `AKCIOK`)
- **Gombok:** minden `data-act` értékhez pontosan egy `AKCIOK`-bejegyzés tartozik (`js/felulet/akciok.js`, kezelő: `(el, e) => …`), mindegyik szó szerinti név; teszt nézi mindkét irányt. A nem gomb jellegű kattintások (dobások, próbák, kockák, fülek) a `KATTINTASOK` táblázatban vannak, és megelőzik a gombokat, első illeszkedő dönt.
- **A logika nem hívja a felületet.** Ami gombra történik, azt a gomb kezelője rajzolja: a logikai függvény az állapotot módosítja és ment (`save()`), a kezelő hívja a `render()`-t, `closeModal()`-t stb. (a `step` igazat ad, ha volt kire lépni; a felületi `lep` rajzol és görget).
- **`Ertesito`** (`js/logika/alap.js`, bekötés: `js/indulas.js`): ami nem gombra történik vagy a logika közepén keletkezik, ezen át jut el a felületre: `naplo` (a napló sorai), `mentesAllapot` (mentésjelző, időzítőből), `lapokValtoztak` (telefonos lap változása, felhős figyelőből). Azért nem a kezelő, mert ezeknek nincs kezelőjük, a naplót pedig a harcfüggvények (`damage`, `step`…) belsejében kell összerakni.
- **Következmény:** a napló szövege (HTML, `esc()`-pel) továbbra is a logikában készül; ha a logika később adatot adna vissza és a felület írná a szöveget, az külön lépés.
- A rétegteszt a felületi fájlok legfelső szintű neveit gyűjti, és tiltja a hívásukat a logikából (`confirm`, `alert`, `prompt` is). Kivétel nincs (az `importSheet` kérdése a 6. lépésben került a felületre).

## Pontosítás (2026-10-30, a 6. lépés: importálók)
- **Új importforrás** = új bejegyzés az `IMPORTEROK`-ban (`js/logika/import-json.js`): `{nev, felismer, atalakit}`, a karakterlapé `lap: true`-val. Az első illeszkedő dönt, ezért a sorrend számít; az utolsó (JSON) mindent elfogad.
- **Az importáló csak átalakít**, nem ment és nem kérdez: `normCreature`-on (a lapnál `Sheet.norm`-on) átment adatot ad, teszt nézi minden importálóra. A kérdés és a mentés a felületi `importAny`-ban van (`js/felulet/konyvtar-ablak.js`), amely elemenként dolgozik: a tömb második azonos nevű lapja látja az elsőt, és egy hibás elem előtt létrejött lapok megmaradnak.
- **Nem a nyilvántartásból választ** a D&D Beyond fül (`ddbImportText`) és az 5e.tools találat (`fiveTalalat`): itt a forrás már ismert, és a D&D Beyond fülnek el kell utasítania minden mást.
- **Aranyminta:** a `convertDDB` kimenete rögzítve van (`tests/arany-ddb.js`, szintetikus mintákból). Csak akkor írd át, ha az átalakítás szándékosan változik.

## Pontosítás (2026-10-30, a 7. lépés: `Sheet.calc`)
- **Új számolási lépés** = új `(ctx) => void` függvény a `sheet.js`-ben és új bejegyzés a `CALC_LEPESEK`-ben, a helyén (a sorrendet teszt rögzíti). A lépés a `const {…} = ctx` kibontással olvas, és a saját eredményét a `ctx`-be írja. A rossz sorrend hibára fut, vagy csendben `undefined`-ot olvas, ezért számít a sorrend.
- **A választások kulcsai nem változhatnak.** Az ütköző kulcs a felvétel sorrendje szerint kap sorszámot (`…:skills2`), és a lapon ezek alatt vannak a játékosok választásai. Az `addFx`-hívások sorrendjét csak akkor szabad módosítani, ha a régi lapok választásai is átkerülnek.
- **`ctx` és `kor`:** a `ctx` a `calc` közös állapota; az osztály és szint neve helyi változóként `kor`. A hatásrekordok és a `choices[]` `ctx` mezőneve nem változott, mert a `choices` a kimenet része.
- **Aranyminta:** 19 kitalált lap teljes kimenete (`tests/arany-calc.js`, bemenet: `aranyLapok()` a `tests.js`-ben), `JSON.stringify` szerint bájtra egyezik. Az `undefined` értékű és a hiányzó kulcsot nem különbözteti meg. Csak akkor írd át, ha a számolás szándékosan változik, és a különbséget előbb nézd át.
- **Verzió:** a `Sheet.CALC_LEPESEK` új név, de csak a tesztek használják, és a kimenet nem változott, ezért a `Sheet.VERSION` maradt: egy régi, gyorsítótárazott `sheet.js` az oldalaknak ártalmatlan.

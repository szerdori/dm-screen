# Refaktor: rétegek, szerződés, SOLID – terv

*Készült: 2026-10-29. Állapot: **elfogadva 2026-10-29**, ág: `refaktor-retegek`; kész: 0–6. lépés. Előzmény: a kódtisztítás 1–4. lépése élesben (`bfb1a46`: `kozos.js`, az `index.html` a `sheet.js` segédeit használja). Ez a terv a felmérés 5–7. pontját (az `index.html` szétbontása, a `Sheet.calc` és a `convertDDB` felbontása) dolgozza ki, a SOLID elvek és egy contract-first munkamódszer mintája alapján.*

A felhasználó döntései (2026-10-29): **rétegek szerinti szétbontás**; **szerződés kódban és leírásban**; **a tudás szétosztása** (CLAUDE.md / SZERZODES.md / döntési jegyzetek / tervek); **csak olvasó ellenőrző ügynök**.

## Cél

- A DM Screen kódja **rétegekre** bomlik, mindegyik réteg külön fájlokban: adat → logika → felület. Egy fájlnak egy felelőssége van.
- Minden adatformátumnak **egyetlen otthona** van (a „szerződés”): a felhős útvonalak, a tisztító függvények és a formátumverziók egy helyen, leírással és tesztekkel.
- A hosszú függvények (`Sheet.calc` 303 sor, a fő kattintáskezelő 229 sor, `convertDDB` 118 sor) kis, nevesített lépésekre bomlanak, és **bővíthetők a meglévő kód átírása nélkül**.
- **A viselkedés nem változik.** Minden lépés után: minden teszt sikeres, a lefedettség nem csökken (most 97,6% sor / 95,4% függvény), és a lépés önmagában élesíthető.

Ami nem cél: build-eszköz, Node, keretrendszer, ES-modulok (a `file://` és a tesztfuttató miatt maradnak a klasszikus `<script>`-ek), új funkció.

## A SOLID elvek ebben a kódban

| Elv | Most | A terv után |
|---|---|---|
| **S** – egy felelősség | Az `index.html` egyetlen szkriptje mindent csinál (Firebase, harc, loot, import, rajzolás, gombok). A „telefonos karakterlapok” szakasz (254 sor) egyszerre szinkronlogika, adatírás és tisztítás. | Fájl = felelősség, rétegenként (lásd lent). A logikai fájlokban nincs DOM, a felületiekben nincs felhős hívás. |
| **O** – bővíthető, módosítás nélkül | Új importforrás, új gomb, új számolási lépés = egy hosszú függvény közepébe kell beírni. | Nyilvántartások (registry): `IMPORTEROK`, `AKCIOK` (gombok), `CALC_LEPESEK` (szabálymotor). Új elem = új bejegyzés. A `Sheet.EFFECTS` és a `Sheet.FEATURE_FX` már most így működik. |
| **L** – felcserélhetőség | Az importálók (5e.tools, D&D Beyond, JSON, űrlap) kimenete nincs egységesen ellenőrizve. | Minden importáló ugyanazt adja: `normCreature`-on átment lényt. Teszt: minden importálóra `normCreature(ki) ≡ ki`. |
| **I** – szűk felületek | A `window.Sheet` ≈ 90 nevet exportál; az `index.html` ebből ~25-öt használ. | A `Sheet` névterekre bomlik (`Sheet.formatum`, `Sheet.motor`, `Sheet.konyv`); a régi lapos nevek egy ideig megmaradnak (lásd 8. lépés, opcionális). |
| **D** – függés az absztrakciótól | Van már egy jó „port”: a `DB` objektum (`get/list/set/update/del/watch`), a tesztek a `makeFakeDb()`-vel helyettesítik. De a gyűjteményútvonalak (`'sheets/' + id`, `'dmscreen/state'`…) 23 helyen szétszórva szerepelnek. | A logika és a felület csak az **adattár** (`Tar`) nevesített függvényeit hívja (`Tar.lap.mezok(id, patch)`, `Tar.allapot.ment(…)`); a `Tar` az egyetlen, ami a `DB`-t és az útvonalakat ismeri. |

## Rétegek (az `index.html` után)

```
felület   js/felulet/*.js   rajzolás (render*, *Html), modális ablakok, AKCIOK (gombok)   ── csak a logikát hívja
   ↓ hívás
logika    js/logika/*.js    harc, nehézség, loot, csapat, importálók, szinkron            ── DOM nélkül, tisztán tesztelhető
   ↓ hívás
adattár   js/adat/tar.js    Tar.*: nevesített olvasás/írás gyűjteményenként                ── az egyetlen, aki a DB-t hívja
   ↓
port      DB (Firebase-modul az index.html végén, tesztben makeFakeDb)
```

Mellette, minden réteg alatt: **`szerzodes.js`** (formátumok, tisztítás) és a **`sheet.js`** (a karakterlap formátuma és a szabálymotor), valamint a **`kozos.js`**.

Szabály (mint a mintában): egy fájl csak a saját rétegét vagy az alatta lévőt használhatja. A felület nem hív `Tar`-t vagy `DB`-t közvetlenül, a logika nem nyúl a DOM-hoz. Ezt egy teszt figyeli („Szerződés” csoport, a forrásfájlok szövegét nézi); a pontos szabály: `docs/dontesek/0006` (Pontosítás, 2026-10-30).

A fájlok (a 4. lépés után, 2026-10-30; betöltési sorrendben, ≈ sor):

| Fájl | Mit tart | Réteg |
|---|---|---|
| `szerzodes.js` | útvonalak, lényformátum, tisztítók | szerződés |
| `js/adat/tar.js` | felhős olvasás/írás gyűjteményenként (`Tar.*`) | adat |
| `js/logika/alap.js` (35) | a közös fájlok segédei, az állapot (`S`), kis segédek, `regiFajl`, `Ertesito` | logika |
| `js/logika/harc.js` (145) | kocka, initiative-sorrend, encounter, körök, sebzés/gyógyítás | logika |
| `js/logika/nehezseg.js` (35) | XP-küszöbök, `difficulty()` | logika |
| `js/logika/loot.js` (100) | kincstáblák, zsákmány dobása, összesítés | logika |
| `js/logika/csapat.js` (40) | Csapat nézet számolásai, felszerelés szövegként | logika |
| `js/logika/import-5etools.js` (185), `import-ddb.js` (160), `import-json.js` (20) | 5e.tools, D&D Beyond (`convertDDB` és részei), a nyilvántartás (`IMPORTEROK`) | logika |
| `js/logika/szabalykonyv.js` (310) | szabálykönyv letöltése, átalakítása, feltöltése; `szabalyMeta`, `addItemTo` | logika |
| `js/logika/lapszinkron.js` (195) | telefonos karakterlapok szinkronja | logika |
| `js/logika/mentes.js` (140) | mentés, betöltés, napi mentések; `felhoben` | logika |
| `js/logika/konyvtar.js` (25) | `upsertLibrary`, szekciók szövegként, `summarize` | logika |
| `js/felulet/harcter.js` (200) | fő képernyő: csempék, adatlap, napló, dobáslinkek, nehézség, mentésjelző, belépő-ablak | felület |
| `js/felulet/jatekos-kepernyo.js` (25) | `publicView`, `broadcast`, csatorna | felület |
| `js/felulet/modal.js` (75) | modális ablak, Menü, Initiative-menü, mentések, szabálykönyv ablak, letöltés | felület |
| `js/felulet/konyvtar-ablak.js` (200) | Könyvtár ablak és fülei, `importAny` (a kérdés és a mentés), fájlbetöltés (`fajlBetoltesEsemenyek`) | felület |
| `js/felulet/szerkeszto.js` (120) | lényszerkesztő, portré (`szerkesztoEsemenyek`) | felület |
| `js/felulet/ablakok.js` (140) | zsákmány és Csapat nézet ablaka | felület |
| `js/felulet/akciok.js` (320) | a gombok nyilvántartása (`AKCIOK`), kattintásszabályok (`KATTINTASOK`), `lep`, a mezők eseményei (`akciokEsemenyek`) | felület |
| `js/indulas.js` (50) | `DMApp.setAuth`, az `Ertesito` bekötése, a figyelők felkapcsolása, első `render()` | – (utolsó: csak ez kapcsol fel eseményfigyelőt és rajzol) |

Az `index.html`-ben a HTML-váz, a stílus, egy inline `<script>` a `VART_MODULOK`-kal (szándékosan inline és a fájlok előtt, lásd `docs/dontesek/0005`), a `<script src>` sorok és a Firebase-modul maradt. A felületi fájlok eseményfigyelői `…Esemenyek()` függvényekben vannak, az `indulas.js` kapcsolja fel őket a régi sorrendben.

**A 6. lépés után nyitva maradt:** a `fiveResults` (keresési találatok) felületi állapot a logikában; a `localStorage` (helyi másolat) a logikában van, később a `Tar` alá kerülhet; a napló szövege (HTML) a logikában készül, és az `Ertesito`-n át jut a felületre (`docs/dontesek/0006`).

A `karakter.html` (≈ 900 sor szkript) ugyanígy bontható, de **később** (7. lépés), mert a 3. fázis épp oda fejleszt.

## A szerződés (contract-first)

A minta lényege: az adatformátum egy helyen van leírva, minden fogyasztó onnan veszi, és ha valami hiányzik, **először a szerződés változik**. Nálunk ennek megfelelője:

- **`szerzodes.js`** (`window.Szerzodes`):
  - `UT` – minden Firestore-útvonal egy helyen (`UT.allapot`, `UT.konyvtar`, `UT.lap(id)`, …), mellette `HELYI` (böngésző-tároló) és `CSATORNA` (játékos képernyő);
  - a tisztítók: `normCreature`, `normCombatant`, `sanitizeState` (alapbeállítás: `ALAP_BEALLITASOK`), `normInventory`, a nyilvános karakterrész `normPublicChar` (a `karakter.html` `normChar`-ja helyett); *a `publicChars()` és a `publicView()` összeállítása a 3. lépésben kerül az adattár mellé (2026-10-29: a 2. lépésben az `index.html`-ben maradt, a `publicChars` kimenetét teszt veti össze a `normPublicChar`-ral);*
  - formátumverziók: `Sheet.FORMAT`, `Sheet.RB_FORMAT`; a DM Screen állapotának saját verziója (`STATE_FORMAT`) akkor kell, ha a formátuma először változik – addig nem vezetjük be.
- A karakterlap formátuma marad a **`sheet.js`**-ben (`Sheet.norm`, `Sheet.TEMPLATE`) – az már most szerződésként működik.
- **`SZERZODES.md`**: emberi leírás mezőnként (ami ma a CLAUDE.md „Adatok” részében van), ki írja, ki olvassa, melyik szabály védi.
- **Tesztek a szerződésre:**
  - minden `Szerzodes.UT` gyűjteményhez van `match` a `firestore.rules`-ban (a tesztszerver kiszolgálja a fájlt, a teszt szövegesen nézi);
  - minden íráshoz használt adat a tisztítón átmenve változatlan (`norm(x) ≡ x`) – *kész a tisztítókra és a `publicChars`-ra; a hamis DB (`makeFakeDb`) minden `set`/`update`-ének ellenőrzése a 3. lépésben (az adattárral együtt);*
  - a meglévő XSS-tesztek a szerződés tisztítóit használják.

**Változtatási sorrend** (a minta „change order”-je; a CLAUDE.md-be kerül):

1. Szerződés: `szerzodes.js` / `Sheet.norm` + `SZERZODES.md` + teszt.
2. Verzió: a változott közös fájl verziószáma (lásd verzióőr, 1. lépés).
3. Fogyasztók: `index.html` rétegei, `karakter.html`, `player.html`.
4. **Kapu – a felhasználó:** jóváhagyja a commitot és a feltöltést.
5. **Kapu – a felhasználó** (csak ha változott): `firestore.rules` bemásolása a konzolba; szabálykönyv újratöltése (`RB_FORMAT`). Lépésről lépésre, kattintásonként leírva.

## Lépések

Mindegyik külön commit, külön jóváhagyással, és **mindegyik után élesíthető**. Ág: `refaktor-retegek` (a lépések egymásra épülnek; minden lépés után a `main`-re összefésülés és feltöltés, ha a felhasználó kéri).

| # | Lépés | Mit | Kockázat |
|---|---|---|---|
| 0 | **Tudás szétosztása, ellenőrző ügynök** | CLAUDE.md szétbontása (lásd lent), `docs/dontesek/` az első döntési jegyzetekkel, `.claude/agents/ellenorzo.md`. Kódváltozás nincs. | nincs |
| 1 | **Verzióőr általánosítása + tesztfuttató** | A `sheet.js`-es `VERSION`-ellenőrzés helyett közös modul-nyilvántartás a `kozos.js`-ben: minden fájl bejelenti a változatát (`modul('harc', 3)`), induláskor az oldal összeveti a várt értékekkel; eltérésnél figyelmeztető sáv és **nincs írás** (mint most a régi `sheet.js`-nél). A `teszt.ps1` a lefedettséghez magától összegyűjti a `*.js` fájlokat. | kicsi |
| 2 | **Szerződés** *(kész 2026-10-29)* | `szerzodes.js` + `SZERZODES.md`; a tisztítók, az útvonalak, a böngésző-tároló kulcsai és a csatorna átköltöztek; a `karakter.html` `normChar`-ja a közös tisztítót használja; szerződés-tesztek. | kicsi–közepes |
| 3 | **Adattár (`Tar`)** *(kész 2026-10-29)* | Minden `DB.*`-hívás a `js/adat/tar.js` nevesített függvényein át; a `publicChars` összeállítása a `Tar`-ban (`Tar.karakterek.nyilvanosResz`); a `publicView` az `index.html`-ben maradt (nem felhős adat – a 4. lépésben a felülettel költözik); egy mentési kör minden írását teszt ellenőrzi a szerződés tisztítóján; rétegszabály-teszt (az `index.html` nem hív `DB.`/`UT.`-t). Közben: a harcba vett lény a tisztított formában jön létre (`hiddenP`, `publicName`), a `teszt.ps1` újrapróbálja a fogva tartott eredményfájl olvasását. | közepes |
| 4 | **`index.html` szétbontása** *(kész 2026-10-30)* | Szakaszonként egy fájl, a logikai fájlok előbb (DOM nélkül), aztán a felület, végül `indulas.js` – 20 fájl, 20 commit, mindegyik után teszt és ellenőrző ügynök (lásd a fájltáblázatot fent). Az `index.html`-ben a HTML-váz, a stílus, a `VART_MODULOK`, a `<script src>` sorok és a Firebase-modul maradt. Közben: a `stripHtml` (D&D Beyond) `DOMParser`-rel bont, így a beillesztett HTML képei nem töltődnek be és a kódja nem fut (teszt); a felület a `Tar` helyett a `felhoben()` / `szabalyMeta()` segédet kérdezi; a rétegteszt az új fájlokat nézi, és egy teszt figyeli, hogy az `index.html`-ben nem maradt kód. Lefedettség utána: 97,7% sor / 95,5% függvény (292 teszt). | közepes (gyorsítótár → 1. lépés védi) |
| 5 | **Gombok nyilvántartása (`AKCIOK`)** *(kész 2026-10-30)* | A 229 soros kattintáskezelő helyett `AKCIOK` (74 bejegyzés, teszt nézi mindkét irányt a `data-act` értékekkel) és `KATTINTASOK` (6 szabály a dobásokra és fülekre); a Shift/Ctrl a `dobasMod`-ban. A logika nem hívja a felületet: a gomb kezelője rajzol (`lep`), a többi az `Ertesito`-n át megy (`docs/dontesek/0006`); a rétegteszt ezt figyeli. A `change`, `input` és `keydown` figyelők rövidek, maradtak. Lefedettség utána: 97,9% sor / 95,6% függvény (299 teszt). | közepes |
| 6 | **Importálók egységesítése** *(kész 2026-10-30)* | `IMPORTEROK = [{nev, lap?, felismer(o), atalakit(o)}]` (4 bejegyzés); a JSON fül és a fájl ebből választ, a D&D Beyond fül és az 5e.tools találatok a saját átalakítójukat hívják (a D&D Beyond fül mást elutasít). Az importáló csak átalakít: a kérdés és a mentés a felületi `importAny`-ban, a logikában már nincs `confirm`. A `convertDDB` (118 sor → 21) részfüggvényekre bomlott: alap, képességek, HP, AC, mentők, skillek, eszközök, felszerelés, fegyverek, akciók, varázslatok; aranyminta (`tests/arany-ddb.js`) és LSP-teszt minden importálóra. Lefedettség utána: 97,9% sor / 95,7% függvény (306 teszt). | közepes |
| 7 | **`Sheet.calc` lépésekre** | A már meglévő belső szakaszok mentén (faj és háttér → osztályok → választások → hatások → expertise → felszerelés → HP → AC → speed → támadások → erőforrások → varázslás): `CALC_LEPESEK = [...]`, mindegyik `(ctx) => void`, közös `ctx`. Előtte „aranymintás” teszt: 6–8 jellegzetes lap (multiclass, Unarmored Defense, Customizing Your Origin…) teljes `calc` kimenete rögzítve, és a felbontás után bájtra egyezik. | közepes–nagy (a legkényesebb kód) |
| 8 | *(opcionális)* **`karakter.html` rétegei, `Sheet` névterek** | Ugyanaz a felosztás a telefonos lapra; a `sheet.js` → formátum / motor / szabálykönyv. | közepes |

**Időzítés a 3. fázishoz:** javaslat, hogy a 0–5. lépés a 3. fázis (szintlépés-varázsló) folytatása **előtt** készüljön el, mert sok fájlt mozgat, és párhuzamosan ütközne. A 6–7. lépés közvetlenül a varázsló előtt hasznos, mert a varázsló a `Sheet.calc`-ra épül (két `calc`-futás különbsége). A 8. lépés a 3. fázis után.

## Tudás – mi hova kerül

| Otthon | Mit tart | Ki írja |
|---|---|---|
| `CLAUDE.md` | kötelező szabályok, konvenciók, a változtatási sorrend, fájltérkép, fejlesztői környezet | Claude, a felhasználó jóváhagyásával |
| `CLAUDE.local.md` (git-ignorált) | kampány- és személyes részletek | mindketten |
| `SZERZODES.md` | adatformátumok mezőnként, gyűjtemények, jogosultságok | Claude, a szerződés változásakor |
| `docs/mukodes.md` | a funkciók elfogadott viselkedése (ami eddig a CLAUDE.md „Funkciók” része volt) | Claude, a felhasználó jóváhagyásával |
| `docs/kulso-forrasok.md` | 5e.tools, D&D Beyond: elérés és buktatók | Claude |
| `docs/dontesek/NNNN-*.md` | nem magától értetődő technikai döntések: háttér, döntés, következmény; számozott, nem törlődik, a felváltott „Felváltotta: NNNN” jelölést kap | Claude, a felhasználó döntése után |
| `TERV-*.md` | fázis- és refaktortervek (a 0–5. fázis áttekintése: `TERV-jatekos-app.md`) | Claude, a felhasználó elfogadásával |
| `README.md` | a felhasználónak: mi ez, hogyan indul | – |

Az első döntési jegyzetek (a mostani CLAUDE.md-ből, a meglévő döntések rögzítése): 0001 vanilla JS, build nélkül; 0002 saját Firebase-projekt, DM-lista a konzolból; 0003 a szabályszöveg nem kerül a nyilvános tárolóba; 0004 mezőnkénti írás és „shadow” szinkron; 0005 a `sheet.js`-verzió őre (a 2026-10-28-i eset); 0006 rétegek és szerződés (ez a terv).

Elv (a mintából): **ha két forrás ellentmond, Claude kérdez, nem választ.** Ha egy megbeszélt szabály a beszélgetésben születik, az a megfelelő fájlba kerül, hogy legközelebb az ellenőrző ügynök is számon kérje.

## Ellenőrző ügynök

`.claude/agents/ellenorzo.md` – csak olvas (Read, Grep, Glob, `git diff`), kódot nem ír. Minden lépés végén a különbséget nézi a CLAUDE.md szabályai szerint, és súlyosság szerint rangsorolt listát ad:

- új mező: van-e tisztítás (`norm*`) **és** `esc()` a kiírásnál, van-e XSS-teszt;
- közös fájl változott: emelkedett-e a verziószám mindenhol;
- rétegszabály: logika nem nyúl DOM-hoz, felület nem hív `Tar`/`DB`-t;
- új funkció / javítás: van-e új teszt a `tests/tests.js`-ben;
- nyilvános tároló: nincs-e kampányadat, e-mail, valódi D&D Beyond JSON, szabályszöveg;
- a felhasználónak szóló szöveg magyar-e.

Mivel a `.claude/` mappa git-ignorált, a `.gitignore`-ba kivétel kerül (`!.claude/agents/`), hogy az ügynök a tárolóval együtt verziózódjon (személyes adat nincs benne).

## Kockázatok és védekezés

- **Vegyes változatok a böngészőben** (régi `index.html`, új `harc.js` vagy fordítva): az 1. lépés verzióőre – eltérésnél nincs felhős írás, csak figyelmeztetés („Ctrl + F5”).
- **Betöltési sorrend:** a klasszikus szkriptek közös globális térben futnak; a fájlok legfelső szintjén csak deklaráció lehet, minden indítás az `indulas.js`-ben. Teszt figyeli, hogy nincs JavaScript-hiba betöltéskor (már van).
- **A tesztek a globális neveket érik el** (`W.eval`); ez a szétbontás után is így marad, a `tests.js` alig változik.
- **Lefedettség:** a mérő a fájlokat név szerint gyűjti; az 1. lépés után magától követi az új fájlokat.
- **Párhuzamos munka:** a lépések alatt a 3. fázis kódját ne módosítsa másik beszélgetés ugyanebben a mappában.

## Kész, ha

- a 0–7. lépés elkészült (a 8. külön döntés), mindegyik élesítve;
- az `index.html` szkriptje csak `<script src>` sorokból, a `VART_MODULOK`-ból és a Firebase-modulból áll *(kész a 4. lépéssel)*;
- egyik függvény sem hosszabb ~60 sornál a `Sheet.calc`, a kattintáskezelő és a `convertDDB` helyén *(a kattintáskezelő az 5., a `convertDDB` a 6. lépéssel kész; a `Sheet.calc` van hátra)*;
- minden teszt sikeres, a lefedettség ≥ 97,6% sor / 95,4% függvény, és a szerződés- és rétegtesztek is futnak;
- a CLAUDE.md a fenti felosztás szerint rövidebb, a döntések és formátumok a saját helyükön vannak.

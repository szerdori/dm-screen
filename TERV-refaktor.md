# Refaktor: rétegek, szerződés, SOLID – terv

*Készült: 2026-10-29. Állapot: **elfogadva 2026-10-29**, ág: `refaktor-retegek`; kész: 0–1. lépés. Előzmény: a kódtisztítás 1–4. lépése élesben (`bfb1a46`: `kozos.js`, az `index.html` a `sheet.js` segédeit használja). Ez a terv a felmérés 5–7. pontját (az `index.html` szétbontása, a `Sheet.calc` és a `convertDDB` felbontása) dolgozza ki, a SOLID elvek és egy contract-first munkamódszer mintája alapján.*

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

Szabály (mint a mintában): egy fájl csak a saját rétegét vagy az alatta lévőt használhatja. A felület nem hív `Tar`-t vagy `DB`-t közvetlenül, a logika nem nyúl a DOM-hoz. Ezt egy teszt figyeli (a forrásfájlok szövegét nézi: `js/logika/*` nem tartalmazhat `document.`/`$(`/`innerHTML`, a `js/felulet/*` nem tartalmazhat `DB.`/`Tar.`-hívást az `AKCIOK`-on kívül – a pontos szabályt a 3. lépés rögzíti).

A tervezett fájlok (a mostani szakaszok alapján, ≈ sor):

| Fájl | Mostani szakasz(ok) | Réteg |
|---|---|---|
| `js/adat/tar.js` | mentés, biztonsági mentések adatrésze, szabálykönyv feltöltése, lapok írása | adat |
| `szerzodes.js` | bejövő adatok tisztítása (97), `publicChars`, `publicView` | szerződés |
| `js/logika/harc.js` | encounter (98), kocka (63), sebzés/gyógyítás, állapotok | logika |
| `js/logika/nehezseg.js` | nehézség (183, a rajzolás nélkül) | logika |
| `js/logika/loot.js` | zsákmány (138, a rajzolás nélkül) | logika |
| `js/logika/csapat.js` | Csapat nézet számolásai (129-ből) | logika |
| `js/logika/import-5etools.js`, `import-ddb.js`, `import-json.js` | 5e.tools (227), D&D Beyond (151), JSON (44) | logika |
| `js/logika/lapszinkron.js` | telefonos karakterlapok (254) | logika |
| `js/logika/szabalykonyv.js` | szabálykönyv letöltése és átalakítása (320) | logika |
| `js/felulet/*.js` | megjelenítés, modal, könyvtár, szerkesztő, csapat, nehézség-ablak, loot-ablak, játékos képernyő küldése | felület |
| `js/felulet/akciok.js` | események (288) → `AKCIOK` nyilvántartás | felület |
| `js/indulas.js` | indulás, `DMApp.setAuth` | – (utolsó) |

A `karakter.html` (≈ 900 sor szkript) ugyanígy bontható, de **később** (7. lépés), mert a 3. fázis épp oda fejleszt.

## A szerződés (contract-first)

A minta lényege: az adatformátum egy helyen van leírva, minden fogyasztó onnan veszi, és ha valami hiányzik, **először a szerződés változik**. Nálunk ennek megfelelője:

- **`szerzodes.js`** (`window.Szerzodes`):
  - `UT` – minden Firestore-útvonal egy helyen (`state: 'dmscreen/state'`, `library: 'dmscreen_library'`, `sheet: id => 'sheets/' + id`, …);
  - a tisztítók: `normCreature`, `normCombatant`, `sanitizeState`, a nyilvános karakterrész (`publicChars` / a `karakter.html` `normChar`-ja – ma kétszer van meg), a játékos képernyő üzenete (`publicView`);
  - formátumverziók: `STATE_FORMAT`, és hivatkozás a `Sheet.FORMAT`, `Sheet.RB_FORMAT` értékekre.
- A karakterlap formátuma marad a **`sheet.js`**-ben (`Sheet.norm`, `Sheet.TEMPLATE`) – az már most szerződésként működik.
- **`SZERZODES.md`**: emberi leírás mezőnként (ami ma a CLAUDE.md „Adatok” részében van), ki írja, ki olvassa, melyik szabály védi.
- **Tesztek a szerződésre:**
  - minden `Szerzodes.UT` gyűjteményhez van `match` a `firestore.rules`-ban (a tesztszerver kiszolgálja a fájlt, a teszt szövegesen nézi);
  - minden íráshoz használt adat a tisztítón átmenve változatlan (`norm(x) ≡ x`) – a hamis DB (`makeFakeDb`) minden `set`/`update`-et ellenőriz;
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
| 2 | **Szerződés** | `szerzodes.js` + `SZERZODES.md`; a tisztítók és az útvonalak átköltöznek; a `karakter.html` `normChar`-ja a közös tisztítót használja; szerződés-tesztek. | kicsi–közepes |
| 3 | **Adattár (`Tar`)** | Minden `DB.*`-hívás a `js/adat/tar.js` nevesített függvényein át; rétegszabály-teszt. | közepes |
| 4 | **`index.html` szétbontása** | Szakaszonként egy fájl, a logikai fájlok előbb (DOM nélkül), aztán a felület, végül `indulas.js`. **Egy fájl = egy commit**, mindegyik után teszt. Az `index.html`-ben a végén csak a HTML-váz, a stílus és a `<script src>` sorok maradnak. | közepes (gyorsítótár → 1. lépés védi) |
| 5 | **Gombok nyilvántartása (`AKCIOK`)** | A 229 soros kattintáskezelő `if`-lánca helyett `data-act="nev"` + `AKCIOK.nev = (el, e) => …`. A Shift/Ctrl-kezelés egy közös segédben. | közepes |
| 6 | **Importálók egységesítése** | `IMPORTEROK = [{nev, felismer(o), atalakit(o)}]`; a beillesztés/fájl ebből választ. A `convertDDB` részfüggvényekre: képességek, mentők/skillek, felszerelés, spellek, támadások. LSP-teszt minden importálóra. | közepes |
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
- az `index.html` szkriptje csak `<script src>` sorokból és a Firebase-modulból áll;
- egyik függvény sem hosszabb ~60 sornál a `Sheet.calc`, a kattintáskezelő és a `convertDDB` helyén;
- minden teszt sikeres, a lefedettség ≥ 97,6% sor / 95,4% függvény, és a szerződés- és rétegtesztek is futnak;
- a CLAUDE.md a fenti felosztás szerint rövidebb, a döntések és formátumok a saját helyükön vannak.

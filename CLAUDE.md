# DM Screen – munkajegyzet Claude-nak

Harckezelő és csapatnyilvántartó webapp D&D 5e mesélőnek. A felhasználó a saját, homebrew kampányát meséli, **PHB 2014 / DMG 2014 szabályok szerint**, gyakran saját ellenfelekkel. Játék közben az egyik monitoron a DM képernyő fut, egy második (a játékosok felé fordított) monitoron a játékos képernyő. Minden felületi szöveg és válasz **magyarul**; a D&D szakkifejezések (AC, HP, Initiative, skillnevek) maradhatnak angolul.

> Kampány- és személyes részletek a git-ignorált `CLAUDE.local.md`-ben vannak (csak a felhasználó gépén). Ebbe a fájlba (`CLAUDE.md`, nyilvános tároló) ilyet ne írj.

## Szabályok (kötelező)
- **Commit és push csak a felhasználó kifejezett jóváhagyása után**, minden alkalommal külön. Eszköz: `.\feltoltes.ps1 "üzenet"` – előtte magától lefuttatja a teszteket, és hibánál nem tölt fel. Ha a felhasználó azt kéri, hogy „a kibővített esetekkel” futtasd: előbb `.\teszt.ps1 -Online`, siker esetén `.\feltoltes.ps1`.
- **Fázis-ágon** (pl. `fazis-2-szabalymotor`) a `feltoltes.ps1`-et ne futtasd: a jelenlegi ágat tölti fel, a `main`-t (az élő appot) nem. Ott `git commit` (jóváhagyással), élesítés csak a `main`-re összefésülés után. Két párhuzamos session ugyanabban a mappában ágat válthat egymás alatt – commit előtt nézd meg a `git branch --show-current`-et.
- **Ne irányítsd át a kimenetét** (`*>&1`) a `feltoltes.ps1`-nek: a git ártalmatlan figyelmeztetése hibának számít, és megszakad a feltöltés. Helyette `| Select-String -NotMatch '^OK '`.
- **A GitHub-tároló nyilvános**: kampányadat, személyes adat, e-mail nem kerülhet a kódba vagy a tesztekbe. Valódi D&D Beyond karakter JSON-ját se commitold (tesztekhez szintetikus minta van).
- **Minden változtatás után**: `.\teszt.ps1` (≈30 mp, láthatatlan Chrome), és **az új funkcióhoz / javításhoz új teszt** a `tests\tests.js`-be. Hibát ideiglenes visszarontással érdemes ellenőrizni, hogy a teszt tényleg elkapja.
- **Böngészős próbánál a valódi adatokat óvd**: a helyi próbaoldalt `?test=1`-gyel nyisd (ilyenkor nem kapcsolódik a Firebase-hez), és a konzolban előbb `save = () => {}`. Az ideiglenes fájlokat utána töröld.
- A felhasználó nem fejlesztő: a teendőit lépésről lépésre, kattintásonként írd le (Firebase konzolban a menü neve „Product categories”, nem „Build”).
- **Kérdezz, ne találgass:** ha két forrás (kód, ez a fájl, `SZERZODES.md`, `docs/mukodes.md`, egy terv) ellentmond, vagy új tervezési döntés kell, kérdezd meg a felhasználót, a javasolt lehetőséggel elöl. Ha a beszélgetésben új szabály vagy döntés születik, írd be a helyére (lásd „Hol mi van”), hogy legközelebb ne kelljen újra megvitatni.
- **Ellenőrzés:** egy lépés végén, commit előtt futtasd az `ellenorzo` ügynököt (`.claude/agents/ellenorzo.md`) a változásra; a súlyos és közepes találatokat javítsd, a többit sorold fel a felhasználónak.

## Változtatási sorrend (contract-first)
Ha adatformátum, gyűjtemény, mező vagy jogosultság változik:
1. **Szerződés:** `SZERZODES.md` + a tisztító kód (`Sheet.norm` / `normCreature`…, a refaktor után `szerzodes.js`) + teszt.
2. **Verzió:** a változott közös fájl (`sheet.js`, `kozos.js`) `?v=N` száma és a verzióőr mindenhol (lásd lent és `docs/dontesek/0005`).
3. **Fogyasztók:** `index.html`, `karakter.html`, `player.html`.
4. **Kapu – a felhasználó:** jóváhagyja a commitot és a feltöltést.
5. **Kapu – a felhasználó** (csak ha kell): `firestore.rules` a konzolba; szabálykönyv újratöltése (`RB_FORMAT`). Kattintásonként leírva.

## Hol mi van (egy otthon minden tudásfajtának)
| Fájl | Mit tart |
|---|---|
| `CLAUDE.md` (ez) | szabályok, konvenciók, változtatási sorrend, fájltérkép, fejlesztői környezet, nyitott ügyek |
| `CLAUDE.local.md` (git-ignorált) | kampány- és személyes részletek – a nyilvános fájlokba ilyet ne írj |
| `SZERZODES.md` | adatformátumok, gyűjtemények, mezők, jogosultságok, a lap ↔ DM Screen szinkron |
| `docs/mukodes.md` | mit tud az app: a funkciók elfogadott viselkedése |
| `docs/kulso-forrasok.md` | 5e.tools, D&D Beyond: elérés és buktatók – olvasd el, mielőtt az importhoz vagy a szabálykönyvhöz nyúlsz |
| `docs/dontesek/NNNN-*.md` | technikai döntések (háttér, döntés, következmény); számozott, nem törlődik |
| `TERV-*.md` | tervek: `TERV-jatekos-app.md` (0–5. fázis), `TERV-2-fazis.md`, `TERV-3-4-fazis.md`, `TERV-refaktor.md` |
| `README.md` | a felhasználónak: mi ez, hogyan indul |

## Felépítés
- **Élő app:** https://szerdori.github.io/dm-screen/ (GitHub Pages, `main` ág gyökere). Tároló: https://github.com/szerdori/dm-screen. Asztali ikon: Chrome `--app=` módban nyitja a webes címet (ikon: `favicon.ico`).
- **Fájlok:** `index.html` (az egész DM app, vanilla JS, nincs build), `player.html` (játékos képernyő a második monitorra), `karakter.html` (játékos app telefonra), `kozos.js` (mindhárom oldal közös alapja: `$`, `esc`, `rnd`; `?v=N`-nel töltődik, változásnál emeld), `sheet.js` (közös kód a kettőnek: karakterlap-formátum `Sheet.norm`, számolás, pihenők, spell slot táblák, szabálykönyv betöltése és tárgyvariánsok; minden a `window.Sheet` alatt), `firebase-config.js` (nyilvános webes konfig), `firestore.rules` (a konzolba másolandó szabályok – ez az élő változat, nem minta), `tests/index.html` + `tests/tests.js` (tesztek), `teszt.ps1` / `teszt.cmd` (futtató), `feltoltes.ps1` / `.cmd` (feltöltő), `README.md`.

## Fejlesztői környezet
- Nincs Node és Python; PowerShell 5.1 + Git (`C:\Program Files\Git\cmd\git.exe`), Chrome és Edge van.
- PowerShell 5.1 a BOM nélküli UTF-8 `.ps1`-ben az ékezeteket elrontja → ékezetes szkriptet UTF-8 **BOM-mal** ments (vagy maradj ASCII-nál).
- `teszt.ps1`: saját kis webszerver a 8767-es porton + `chrome --headless --dump-dom`; az app `index.html?test=1`-gyel töltődik iframe-be. A `-Lefedettseg` kapcsoló a Chrome DevTools-protokollal (8768-as port, `tests\lefedettseg.cs`, Node nélkül) méri a lefedettséget; 2026-10-29-én ≈97,6% sor, 95% függvény – ami kimarad, az főleg a Firebase-réteg (élő belépés nélkül nem tesztelhető). Tesztsegédek a `tests.js` elején (`A()`, `W`, `mk()`, `pc()`, `stubRnd()`, `makeFakeDb()`, `assertNoXss()`); a `const`-tal deklarált app-függvényeket a futtató `W.név` alá másolja – új ilyen segédnél add a listához.
- **`sheet.js` változata** (miért: `docs/dontesek/0005`): ha a `sheet.js` új függvényt vagy mezőt kap, amit az oldalak használnak, a számot **mind az öt helyen** emeld: `sheet.js?v=N` az `index.html`-ben és a `karakter.html`-ben, `Sheet.VERSION`, `karakter.html` → `SHEET_V`, `index.html` → `syncSheets` (`Sheet.VERSION !== N`). Ugyanígy a `kozos.js?v=N` mindhárom oldalon.
- Böngészős előnézethez a `.claude\launch.json`-ba (git-ignorált) egy statikus szerver kell; a régi PowerShell-szerver (`server.ps1`) már nincs meg.

## Állapot
- **Játékos app:** a 0–2. fázis és a 3. fázis 0. lépésének kódja a `main`-en (79cbc10 és utána); a 3. fázis (szintlépés-varázsló) a refaktor után folytatódik – `TERV-jatekos-app.md`.
- **Refaktor:** `TERV-refaktor.md` (elfogadva 2026-10-29), ág: `refaktor-retegek`.

## Nyitott / félretett ügyek (2026-10-29)
- **1. fázis élesítése:** a `firestore.rules` a konzolban és a szabálykönyv feltöltve (a felhasználó szerint, 2026-10-29). Még hátra: a többi játékos lapjának létrehozása (Könyvtár → 📱, vagy Claude-dal megírt JSON importja; az állás a `CLAUDE.local.md`-ben), és ellenőrzés egy játékos telefonján.
- **Későbbre (a felhasználó kérésére elhalasztva, 2026-10-28):** a régi `dmscreen`, `dmscreen_library`, `dmscreen_saved`, `dmscreen_backup` gyűjtemények törlése a `hazi-naplo` projektből. A 0. fázis élesben van (új projekt `dm-screen-afc89`, az adatok átköltöztek, ellenőrizve). A törlést a felhasználó végzi a konzolban, kattintásonkénti leírással; előtte érdemes friss fájlmentést kérni.
- Kilépéskor a helyi másolat törlése – nem kérte.
- Kampánnyal kapcsolatos függő ügyek: `CLAUDE.local.md`.
- Feltöltés után a felhasználónak újra kell importálnia a játékosokat a könyvjelzővel, ha az import új mezőt kap.

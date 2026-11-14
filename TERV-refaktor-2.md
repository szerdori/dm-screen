# Refaktor, második kör – terv

*Készült: 2026-11-14. Állapot: **elfogadva 2026-11-14** (1–7. lépés), munka a `refaktor-2` ágon. Előzmény: `TERV-refaktor.md` (0–8. lépés, kész).*

## Mi lett belőle (2026-11-14)

- **1. és 7. lépés – kész.** A `tests/tests.js` helyett `tests/keret.js` (mini tesztkeret, közös segédek, `run()`, `APP_NEVEK`, `appNevTipp`), 11 csoportfájl a `tests/csoportok/` alatt (33–76 KB) és `tests/indit.js`. **Eltérés a tervtől:** nincs `tests/segedek.js` – a segédek ott maradtak, ahol először kellenek (a fájlok az eredeti sorrendben töltődnek, egy fájl a korábbiak segédeit használhatja), így a tesztek szövege és sorrendje betűre változatlan. A 152 KB-os „Telefonos karakterlap” csoport három fájlra bomlott (ugyanazzal a csoportnévvel); a közös segédei (`kq`, `kclick`, `ktest`, `openSheet`…) a `07-telefon-1.js` legfelső szintjére kerültek.

A felhasználó kérése: a kód átnézése refaktorálási lehetőségekért, és terv a találatokból.

## Mit néztem át, és mit találtam

Az első kör (rétegek, szerződés, nyilvántartások) rendben tartja a kódot: a DM app logikájában egyetlen DOM-hivatkozás sincs a megengedetten kívül, a gombok és az importálók nyilvántartásból jönnek, a rétegeket teszt figyeli. Nagy átszervezést ezért nem javaslok. Ami maradt, az főleg **méret** és **kézi adminisztráció**:

| # | Találat | Számok (2026-11-14) | Miért baj |
|---|---|---|---|
| A | A `tests/tests.js` egyetlen fájl | 597 KB, 7288 sor, 44 csoport, 480 teszt; a „Telefonos karakterlap” csoport egymaga ≈ 1950 sor | Claude nem tudja egyben beolvasni (a korlát 256 KB), minden új teszthez keresgélni kell; két session ugyanabba a fájlba ír; a párhuzamos tesztfuttatásnak is útjában van (`TERV-teszt-gyorsitas.md` 5. lépés). A tesztsegédek a fájlban szétszórva vannak (`makeFakeDb` az 1400., `fakeRb` a 2155., `mkS` a 2375. sorban), a későbbi csoportok ezekre támaszkodnak. |
| B | Egy közös fájl változata három helyen van kézzel vezetve | `modul('név', N)` a fájlban, `?v=N` a `<script src>`-ben, `VART_MODULOK` az oldalon – 37 modul, két oldal | Az egyezést teszt nézi, de azt nem, hogy *kellett-e* emelni; ez az ellenőrző ügynök egyik „Súlyos” pontja, és minden lépésnél kézi munka. |
| C | A `sheet.js`-ben a szabályadat és a motor egy fájlban | 179 KB, 2119 sor, 268 belső név; ebből tiszta adattábla ≈ 36 KB (`FEATURE_FX`, `LAND_SPELLS`, TCE-táblák ≈ 20 KB; a mezők és teendők magyar leírásai ≈ 9 KB; `SKILL_INFO` és az alapkonstansok ≈ 7 KB) | Új feature vagy feat hatása = adat, mégis a motor fájljához kell nyúlni, és a teljes fájl változata emelkedik. A 2026-11-08-i döntés szerint a `sheet.js` egyben marad, **hacsak a felhasználó mást nem kér** – ezért ez döntést kér (lásd lent). |
| D | A böngésző-tároló (`localStorage`) kezelése szétszórva | 11 hely 6 fájlban, mindenhol saját `try { … } catch {}`; a DM appban a logikai rétegben (`mentes.js`, `lapszinkron.js`, `indulas.js`) | Az első kör 6. lépése után nyitva maradt ügy (`TERV-refaktor.md`: „a `localStorage` a logikában van, később a `Tar` alá kerülhet”). |
| E | Felületi állapot a logikában | `fiveResults` (`import-5etools.js`), `itemResults` (`szabalykonyv.js`): keresési találatok | Szintén a 6. lépés nyitva maradt ügye. |
| F | Hosszú, sűrű rajzoló függvények | `partyHtml` 61 sor / 6,8 KB; `ncStepBody` 44 sor / 5,4 KB; `openEditor` 43 sor / 4,6 KB; `tileHtml` 52 sor / 4,4 KB; `tabBuild`, `tabVar`, `tabHarc` ≈ 4 KB; 300 karakternél hosszabb sor: 18 a `sheet.js`-ben, 16 a `leiras.js`-ben, 12 a `lap-rajz.js`-ben | Nehezen olvasható és nehezen tesztelhető részenként; egy módosítás könnyen elront egy távoli ágat ugyanabban a sablonban. |
| G | Régi munkamásolatok és ágak | 4 worktree a `.claude\worktrees` alatt (a tároló régi másolatai), 4 `claude/…` és 10 régi helyi ág | Nem kód, de zavar: a keresések és fájllisták ezekkel telnek meg, a lefedettségmérőnek külön ki kell hagynia őket. |
| H | A tesztfuttató kézi listája | a `run()`-ban 28 név: `for (const k of ['normCreature', …]) W[k] = A(k)` | Új `const`-os segédnél hozzá kell írni (a `CLAUDE.md` külön figyelmeztet rá); kis teher, de visszatérő. |

Amit megnéztem, és **nem** javaslok: a DM app és a telefonos lap közti névütközés csak 6 név (pl. `render`, `download`), külön oldalon futnak, nem okoz gondot; az `AKCIOK` / `LAP_AKCIOK` hosszú, de nyilvántartás, annak jó; a `CALC_LEPESEK` lépései 30–55 sorosak, rendben vannak.

## Lépések (javasolt sorrendben)

Mindegyik külön commit, külön jóváhagyással, viselkedésváltozás nélkül; mindegyik után teljes teszt és ellenőrző.

| # | Lépés | Mit | Haszon | Kockázat |
|---|---|---|---|---|
| 1 | **A `tests.js` csoportfájlokra** (A) | `tests/keret.js` (a mini tesztkeret és a `run()`), `tests/segedek.js` (minden több csoport által használt segéd: `mk`, `pc`, `makeFakeDb`, `fakeRb`, `rb3`, `mkS`, `assertNoXss`…), és témánként egy fájl a `tests/csoportok/` alatt (≈ 12–15 fájl, pl. `harc.js`, `import.js`, `felho.js`, `motor.js`, `szintlepes.js`, `lap-*.js`, `szerzodes.js`). A tesztek szövege betűre változatlan, csak a helyük változik. Ellenőrzés: a tesztek neve és száma előtte–utána azonos (a riport sorait összevetve). | A legnagyobb: Claude egy témához egy 30–80 KB-os fájlt olvas, nem 600-at; a párhuzamos futás alapja. | kicsi (a csoporton belüli `const` segédek a csoporttal mennek; a csoportok közti rejtett függés a sorrenden – ezt a név- és darabszám-összevetés és a teljes futás kimutatja) |
| 2 | **Verzióemelő szkript és gépi figyelő** (B) | `verzio.ps1 <modul>`: egy paranccsal emeli a számot a fájlban, a `?v=`-ben és a `VART_MODULOK`-ban minden oldalon. Mellé a `TERV-teszt-gyorsitas.md` 6/a pontja: figyelmeztetés, ha egy közös fájl változott, de a száma nem. A futó app nem változik (a `docs/dontesek/0005` szerinti inline `VART_MODULOK` marad). | Kevesebb kézi hiba, gyorsabb ellenőrző. | kicsi |
| 3 | **Böngésző-tároló egy helyen** (D) | Közös segéd a `kozos.js`-ben (pl. `Helyi.olvas(kulcs)`, `.ir`, `.torol`, JSON-nal és hibatűréssel); a 11 hely ezt hívja. A DM appban így a logika már nem nyúl közvetlenül a `localStorage`-hoz; a rétegteszt ezt is figyelheti. `kozos.js` változata emelkedik (mindhárom oldal). | Lezár egy régi nyitott ügyet; egy helyen a hibatűrés. | kicsi–közepes (a `kozos.js` mindhárom oldalé) |
| 4 | **Keresési találatok a felületre** (E) | `fiveResults` → `konyvtar-ablak.js`, `itemResults` → a tárgykereső felületi fájlja; a logika visszaadja a találatot, nem tárolja. | Lezárja a 6. lépés maradékát. | kicsi |
| 5 | **A `sheet.js` adattáblái külön fájlba** (C) – *csak ha a felhasználó kéri* | `sheet-adat.js` (≈ 36 KB): `FEATURE_FX`, `LAND_SPELLS`, a TCE-táblák, `SKILL_INFO`, a mezők és teendők leírásai. A táblák nem hivatkoznak a motor függvényeire, így nincs körbehivatkozás – ez **nem** az a szétbontás, amit 2026-11-08-án elvetettünk (a motor szakaszai egyben maradnak). Új modul a verzióőrben, új `<script src>` a `sheet.js` elé az `index.html`-ben és a `karakter.html`-ben; a `Sheet.*` nevek változatlanok. | Új hatás felvétele nem nyúl a motorhoz; a `sheet.js` ≈ 20%-kal kisebb. | közepes (betöltési sorrend, gyorsítótár – a verzióőr védi; az aranyminta bájtra ellenőrzi a `Sheet.calc`-ot) |
| 6 | **Hosszú rajzoló függvények** (F) – *menet közben* | Nem külön lépés: amikor egy feladat amúgy is hozzányúl a `partyHtml`-hez, a `tabVar`-hoz stb., előbb nevesített részfüggvényekre bomlik (pl. `tabVar` → `slotSorok`, `varazslatFej`, `varazslatLista`, `varazslatFelvetel`), külön commitban, a kimenet változatlanságát teszt nézi. | Olvashatóság ott, ahol épp dolgozunk. | kicsi, ha egyenként megy |
| 7 | **A tesztfuttató kézi listája** (H) | Az 1. lépéssel együtt: a lista a `tests/keret.js` tetejére kerül, megjegyzéssel; ha egy teszt hiányzó `W.név`-be fut, a hibaüzenet megmondja, hogy a listához kell adni. (A lista teljes megszüntetéséhez minden `W.név` hívást át kéne írni – nem éri meg.) | Kisebb buktató. | nincs |

**Takarítás (G)** – nem refaktor, és törléssel jár, ezért külön kérdés: a 4 régi worktree és a már összefésült ágak törlése. Előtte ellenőrizni kell mindegyiknél, hogy minden commitja a `main`-en van-e; ami nincs, az marad. Csak a felhasználó kifejezett jóváhagyásával.

## Sorrend a másik tervvel

A `TERV-teszt-gyorsitas.md` 1–4. lépése előbb (gyorsabb teszt mellett minden további lépés olcsóbb), utána ennek a tervnek az 1. lépése (a `tests.js` bontása), és csak azután a párhuzamos futás. A `tests.js` bontása alatt más session ne írjon tesztet ugyanebben a mappában.

## A felhasználó döntései (2026-11-14)

- **A `sheet.js` adattáblái külön fájlba (5. lépés): menjen most** – nem kell a következő nagy bővítésre várni. (Ez felülírja a 2026-11-08-i „egyben marad” döntést az adattáblákra; a motor szakaszai továbbra is egyben maradnak.)
- **Régi worktree-k és ágak törlése: igen**, egyenkénti ellenőrzés után (ami nincs a `main`-en, az marad).
- Sorrend: előbb a `TERV-teszt-gyorsitas.md` 1–4. lépése.

## Döntés, ami még a felhasználóra vár

1. **A többi lépés (1–4., 7.; a 6. menet közben)?** Javaslat: igen, ebben a sorrendben.

## Kész, ha

- a `tests/` alatt egyik fájl sem nagyobb ≈ 100 KB-nál (az aranyminták kivételével), a tesztek neve és száma változatlan;
- egy modul változatát egy parancs emeli, és gépi figyelő szól, ha elmaradt;
- a DM app logikai rétege nem hív közvetlenül `localStorage`-ot, és nem tart keresési találatot;
- minden teszt sikeres, a lefedettség nem csökkent; a `CLAUDE.md` fájltérképe és a `TERV-refaktor.md` „nyitva maradt” bekezdése frissítve.


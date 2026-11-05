# Terv: megjelenítési beállítások a telefonos karakterlapon (betűméret, sötét / világos)

Állapot: **kész az `olvashato-mod` ágon** (2026-11-05; az 1–7. lépés commitolva, a tesztek sikeresek), még nincs a `main`-en. Hátra: élesítés, majd a 8. lépés (próba a játékosokkal).

## Cél
- Olvasószemüveg nélkül (+1–1,5 dioptria, közelre nehéz élesre látni) is lehessen játszani a telefonos lappal (`karakter.html`): a játékos 2–3 másodperc alatt megtalálja és elolvassa, amit keres („mennyi a Stealth-ed?”, „hány HP-d van?”), és tud vele dobni.
- Mellette legyen **világos mód** is, normál és nagy betűvel egyaránt.

## Elfogadott alapelvek (a felhasználóval megbeszélve)
- **A mostani megjelenítés (Normál betű + Sötét mód) nem változik, ez az alapértelmezett.** Az egyetlen kivétel a fejléc „kilépés” linkje, ami a Fiók menübe kerül (a felhasználó kérése).
- A beállítás **a Fiók menüben** van, nem kell mindig szem előtt lennie (egyszer beállítják, segíthetnek egymásnak). **Eszközönként** megmarad.
- Két, egymástól független beállítás:
  - **Betűméret:** Normál / Nagy / Extra nagy
  - **Mód:** Sötét / Világos
- Nagy és Extra nagy betűnél: nagyobb, vastagabb, jól olvasható betű, a kulcsszámok (HP, AC, módosítók) kiemelve; **magas kontraszt**, szürke („muted”) szöveg nélkül; egyoszlopos, görgetésbarát elrendezés; nagyobb koppintási felületek.
- A színjelzéssel nincs gond, azzal nem foglalkozunk.
- **A koppintás marad a dobásé.** Nagy betűnél a dobáseredmény sávja lesz nagy.
- Nem figyeljük a telefon rendszerbeállításait (sötét/világos, kontraszt), mert azzal a mostani nézet egyes telefonokon magától megváltozna.
- **Wishlist, most nem:** egy érték kinagyítása dobás nélkül (hosszú nyomással) – csak ha a kipróbálás után kell.

### A hat változat
| | Sötét | Világos |
|---|---|---|
| **Normál** | a mostani, változatlan (alapértelmezett) | új: világos téma, a mostani méretekkel |
| **Nagy** | új: nagy betű, kontrasztos sötét | új: nagy betű, kontrasztos világos |
| **Extra nagy** | mint a Nagy, nagyobb szorzóval | mint a Nagy, nagyobb szorzóval |

Így négy színkészlet kell: sötét, világos, kontrasztos sötét, kontrasztos világos. A kontrasztos készlet a Nagy és az Extra nagy betűhöz tartozik.

## Mit találtam a kódban
- Minden a `karakter.html`-ben van: egy inline `<style>` (9–181. sor), a szkript a sablonokkal, a `data-act` gombokkal.
- Sötét téma CSS-változókkal (`:root{--bg…--muted:#8e95a1…}`), de **kb. 20 szín a változókon kívül, beégetve** szerepel (pl. `#1a1405` a kiemelt gombok szövege 7 helyen, `#d6d3cb` a leírásoké, `#0b0d10` a mezők háttere, `#14171cee` a dobássáv, `#2a2414`/`#5a4a20` a dobógombok, `#252a33` az avatar, `#e8d34a` a „Sérült” jelvény, a `text-shadow` és az árnyékok). A szkript inline stílusai már változókat használnak (`var(--red)` stb.) – azokkal nincs teendő.
- `<meta name="theme-color" content="#0e1013">` – a böngésző sávjának színe; világos módban ezt is váltani kell.
- **A betűméretek mind fix px-ben** vannak (11–34 px, sok 12–13 px-es: `.hint`, `.sub`, `.chip small`, `.abil small`, `.nm small`, `.fxchip`, a fülek 14 px).
- A szürke `--muted` sok helyen hordoz fontos tartalmat (pl. a képességnevek a `.abil small`-ban, a dobás részletei).
- Dobás: a `.rb` gomb koppintására `rollD20` / `rollDamage` → `showRoll` → az alsó fix `#rollbar` `#lastRoll` sora (szám 26 px, leírás 13 px szürke). A `main` alján 130 px hely van fenntartva neki.
- Nincs beállítások oldal. A fejlécben (`#who`) van a fiók e-mail és a „kilépés” link – minden oldalon látszik (a belépés előtt nem).
- A viewport nem tiltja a csippentéses nagyítást – ezzel nincs teendő.
- Az eszközönkénti beállításnak már van mintája: `HELYI.csakBekeszitett` (`szerzodes.js`) + `try/catch`-es `localStorage`.
- Van teszt arra, hogy 320 px-en minden elfér.

## Megoldás

### 1. Fiók menü a fejlécben
- A „kilépés” link helyére egy **„👤 Fiók”** gomb kerül (a fiók e-mailje fölötte marad, ahogy most; nagy betűnél az e-mail csak a menüben látszik, hogy a fejléc elférjen). Koppintásra a meglévő `#infoPop` ablak nyílik:
  - **Megjelenítés**
    - Betűméret: Normál / Nagy / Extra nagy – mindegyik gomb a saját méretében írja ki a feliratot, hogy választás előtt látszódjon
    - Mód: 🌙 Sötét / ☀ Világos
    - A választás azonnal érvényes (a lap a háttérben látszik), nincs külön Mentés gomb
  - **Kilépés** (a menü alján, külön, hogy ne lehessen véletlenül megnyomni)
- Új gombok: `data-act="fiok"` (a menü) és `data-act="megj"` (`data-k`: `betumeret` | `tema`, `data-v`: az érték); a meglévő `signOut` marad.
- A menü maga is az aktuális beállítás szerint jelenik meg (nagy betűnél nagy).

### 2. Tárolás
- Két új helyi kulcs: `HELYI.betumeret` (`''` | `'nagy'` | `'extra'`) és `HELYI.tema` (`''` = sötét | `'vilagos'`) a `szerzodes.js`-ben és a `SZERZODES.md`-ben. Contract-first: szerződés + teszt, `szerzodes.js` verzió emelése (`?v=` és `VART_MODULOK`).
- A `<head>`-ben egy kicsi inline szkript **még rajzolás előtt** kiolvassa őket, és beállítja a `<html data-meret="nagy" data-tema="vilagos">` attribútumokat és a `theme-color`-t (különben betöltéskor felvillanna a sötét, kis betűs nézet). Itt a kulcsok szövegként szerepelnek; egy teszt figyeli, hogy egyeznek a `HELYI`-vel.
- Ha a `localStorage` nem elérhető (privát mód), a mostani nézet marad, a menüben választott beállítás csak az oldal újratöltéséig él.

### 3. Színek: a beégetett színek változóba kerülnek
- Ez az egyetlen lépés, ami a **meglévő** stílusokhoz nyúl: a kb. 20 beégetett színből változó lesz (pl. `--on-accent:#1a1405`, `--text2:#d6d3cb`, `--field:#0b0d10`, `--rollbar-bg:#14171cee`, `--rb-bg:#2a2414`, `--rb-line:#5a4a20`, `--hurt:#e8d34a`, `--shadow:#0008`…), **pontosan a mostani értékekkel**. A sötét normál nézet így bitre ugyanaz marad.
- Ezt a lépést önmagában kell lezárni és ellenőrizni (képernyőképek előtte–utána, lásd Ellenőrzés), mielőtt bármilyen új szín jön.
- Alternatíva lett volna az új témákban egyenként felülírni ezeket a szabályokat a meglévők érintése nélkül; ez kb. 20 ismétlődő szabály lenne témánként, és minden új stílusnál könnyű elfelejteni. A változós megoldás tisztább, és egy szöveges teszt figyelheti, hogy a `:root`-on kívül ne legyen beégetett szín.

### 4. A négy színkészlet
- Mind csak változókat állít át, attribútum alatt: `:root[data-tema="vilagos"]{…}`, `:root[data-meret]{…}` (kontrasztos sötét), `:root[data-meret][data-tema="vilagos"]{…}` (kontrasztos világos).
- **Világos (normál):** törtfehér háttér, fehér panelek, sötétszürke vonalak, majdnem fekete szöveg. Az arany kiemelés (`--accent`) világos háttéren rosszul olvasható (≈2:1), ezért szövegként sötétebb arany/barna kell; kitöltött gombként is ez a sötét arany kell, fehér szöveggel (5,9:1). A zöld/narancs/piros/kék is sötétebb árnyalatot kap, hogy szövegként olvasható legyen.
- **Kontrasztos sötét:** majdnem fekete háttér, majdnem fehér szöveg; a `--muted` világosszürke (legalább 7:1 a panelen); erősebb, világosabb vonalak a panelek körül.
- **Kontrasztos világos:** fehér háttér, fekete szöveg, sötétszürke `--muted` (legalább 7:1), vastagabb, sötét vonalak.
- Minden szöveg/háttér párnál a kontrasztot meg kell mérni (normál: legalább 4,5:1, kontrasztos: legalább 7:1).

### 5. Betűméret (csak `data-meret` mellett)
- Külön blokk a `<style>` végén; **minden szabálya `:root[data-meret]` (illetve `[data-meret="extra"]`) előtaggal** kezdődik. Egy szöveges teszt ellenőrzi, hogy nincs előtag nélküli szabály a blokkban.
- Méretezés egy szorzóval: `[data-meret="nagy"]{--meret:1.3}`, `[data-meret="extra"]{--meret:1.55}`, a felülírások `font-size:calc(13px * var(--meret))` alakúak.
- **Elvetett megoldás: a CSS `zoom`.** Gyors volna, de az egész elrendezést nagyítja, és 320–375 px-en kilógna (3 oszlopos képességrács, 2 oszlopos űrlap). Elemenként kell felülírni.
- Minimum: a legkisebb szöveg sem lehet kisebb 18 px-nél (Nagy), illetve 21 px-nél (Extra).
- Betűtípus: **Atkinson Hyperlegible Next** (gyengénlátóknak tervezték, jól megkülönböztethető 1/l/I, 0/O), a tárolóból (`betutipus/`, `docs/dontesek/0007`; eredetileg Google Fonts volt). Csak nagy betűnél töltődik le; az ő és az ű a latin-ext részhalmaz tartományában van (a teszt a tartományt és a betöltést nézi; a megjelenést képernyőképen néztem). A számok is talpatlan betűt kapnak (most Georgia), félkövéren. Betűvastagság 500–700, sortáv 1,45.

### 6. Elrendezés nagy betűnél, fülenként
- **Fejléc és felső sor (`.top`, `.hero`):** a név, az AC és a HP-sáv nagyobb; a HP-szám jól olvasható a sávban (a sáv magasabb). A Short/Long/HD gombok nagyobbak, szükség esetén két sorba törnek.
- **Fülsáv:** nagyobb gombok; a vízszintes görgetés megmarad.
- **Harc:** a támadássorokban (`.li`) a név és a dobógombok külön sorba törhetnek; a `.rb` gombok legalább 48 px magasak.
- **Képességek:** a 3 oszlopos rács (`.abils`) Nagy betűnél 3 oszlop marad, Extra nagynál 2. A skill-lista egy oszlopos: név balra, dobógomb jobbra.
- **Varázslat, Felszerelés:** nagyobb listaelemek; a hosszú leírások (`details .tx`) nagyobb betűvel, alapból csukva, ahogy most.
- **Alapadatok (űrlap):** a 2 oszlopos `.form` 1 oszlopos lesz, a `.g9` (5 oszlop) 3, a `.g6` 2 oszlopos. Játék közben ritkán kell, kisebb prioritás.
- **Szintlépés és új karakter varázsló:** a globális méretezés lefedi; külön finomítás csak ha kell.

### 7. Dobássáv (`#rollbar`) nagy betűnél
- A dobott szám 34 px × szorzó: 44 px (Nagy) / 53 px (Extra), a leírás 18 / 21 px, a kontrasztos szövegszínnel.
- Az Előny / Hátrány / Krit gombok magasabbak.
- A `main` alsó helye a nagyobb sávhoz igazodik, hogy ne takarja el a lap alját.

## Ellenőrzés
- **A mostani nézet változatlansága:** az első változtatás előtt képernyőképek a sötét normál nézetről (minden fül, a Fiók menü nélküli fejléc kivételével, 375 px), és a 3. és minden további lépés után ugyanezek összehasonlítva – pixelre egyezniük kell.
- Új tesztek a `tests/tests.js`-be:
  - a Fiók menü megnyílik; a betűméret és a mód gombja beállítja az attribútumot és elmenti a kulcsot; újratöltés után is érvényes; a Kilépés továbbra is működik
  - a `:root`-on és a téma-blokkokon kívül nincs beégetett szín
  - a betűméret-blokk minden szabálya előtagos
  - **320 px-en Nagy és Extra nagy betűvel** semmi nem lóg ki, a saját dobozából sem (a világos mód csak színt állít, méretet nem; a normál betűt a régi 320 px-es teszt nézi)
  - a kontraszt mérése minden fülön a világos és a nagy betűs változatokban
  - a betűtípus a tárolóból jön, külső kérés nincs (a felhasználó döntése, 2026-11-05: `docs/dontesek/0007`)
- Javítva mellékesen (2026-11-05): az új karakter varázslóban a kiválasztott módszer gombja (pl. Point buy) eddig nem látszott kijelöltnek.
- `.\teszt.ps1`, majd az `ellenorzo` ügynök.
- **Élő próba:** a két érintett játékos szemüveg nélkül, a saját telefonján, sötétben és világosban is; néhány kérdés („mennyi a Stealth-ed?”, „dobj támadást”). Ha a méret túl kicsi vagy túl nagy, a szorzó állítható.

## Lépések
1. Fiók menü (Megjelenítés + Kilépés), tárolás, attribútumok (szerződés + teszt). Ekkor a gombok már működnek, de még nem változtatnak semmit.
2. A beégetett színek változóba (a nézet nem változik – képernyőképes ellenőrzés).
3. Világos téma (normál betűvel).
4. Betűméret: tipográfia + a két kontrasztos színkészlet.
5. Elrendezés nagy betűnél: Harc → Képességek → Varázslat → Felszerelés → Alapadatok.
6. Dobássáv nagy betűnél.
7. Tesztek, `docs/mukodes.md` és `SZERZODES.md` frissítése.
8. Próba a játékosokkal; utána döntés a wishlistről (nagyítás hosszú nyomásra).

Az 1–3. lépés önmagában is élesíthető (Fiók menü + világos mód), a 4–7. utána jöhet.

## Döntések (2026-11-05)
- A kontraszt **automatikusan** jár a nagy betűhöz, nincs külön kapcsoló.
- A DM Screen (`index.html`) és az Initiative tracker (`player.html`) **nem** kap világos módot (csak a DM használja, sötét mód párti).
- A terv elfogadva, mind a 7 lépés mehet; minden lépés után commit (push nincs).

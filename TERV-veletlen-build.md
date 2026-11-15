# Véletlen build magasabb szintű karakterhez – terv

*Készült: 2026-11-15. Állapot: **elfogadva 2026-11-15** (a „Döntések” rész mind a hat javaslatát a felhasználó elfogadta). Az 1. lépés (logika) kész 2026-11-15, nincs commitolva; a 2. (felület) következik.*

## Mi lett belőle (1. lépés, 2026-11-15)

- `js/logika/veletlen-build.js`: `veletlenBuild(be, rb)` → `{lap, figy, hibak}` vagy `{hiba}` (rossz bemenet: ismeretlen osztály / faj / alfaj / alosztály / háttér, ugyanaz a második osztály, rossz második szint, nincs szabálykönyv). A `figy` a nem teljesülő multiclass-feltétel (csak figyelmeztet, mint a szintlépésnél); a `hibak` az, amit nem sikerült kitölteni (a tesztek szerint egyik osztálynál sem marad ilyen).
- A TCE-kérdésekre mindig „nem” (marad a PHB), hogy ne maradjon nyitott ✋ teendő; a játékos átállíthatja.
- Tesztek (`tests/csoportok/05-szintlepes.js`, „véletlen build”): mind a 13 osztály 1., 5., 11., 20. szinten; a megadott adatok; ASI, sebző cantrip, átlagos HP; multiclass és a rossz bemenetek; valódi szabálykönyvvel (online) minden osztály öt szinten, Invocation pact-előfeltétel, Eldritch Blast, felszerelés, Half-Elf Paladin / Sorcerer.

## A felhasználó kérése és döntései (2026-11-15)

- A DM megad **valamennyit** az adatok közül (pl. faj, szint, osztály), a többit a program generálja, és **kész, kitöltött buildet** ad.
- **Ne legyen teljesen véletlen, legyen értelme** („értelmes véletlen”): játszható, nem optimalizált karakter. Példa a felhasználótól: 3. szinten ne legyen Barbarian / Wizard / Cleric multiclass.
- **Bemenet:** a szint kötelező; faj, alfaj, osztály, alosztály, háttér megadható – ami üres, azt a program választja.
- **Multiclass:** csak ha a DM megadja (második osztály és annak szintje); magától soha.

## Mi van már (erre épül)

- **Új játékos** (DM Screen, Új lény → Játékos): üres, szabálymotoros lap (`Sheet.ncBlank`, `ujJatekos` a `js/logika/lapszinkron.js`-ben). A játékos a telefonján a kezdő varázslóval tölti ki; magasabb kezdőszintnél utána a szintlépés-varázsló visz tovább, szintenként kézzel.
- **A motor minden választási helyet megad:** `Sheet.ncPlan` (1. szint), `Sheet.levelUpBuild` / `levelUpPlan` / `levelUpApply` (szintlépés), `Sheet.choiceOptions` (a hely érvényes lehetőségei, előfeltétellel), `Sheet.setChoice`, `Sheet.materialize`.
- **A tesztekben van egy robot** (`tests/csoportok/05-szintlepes.js`, „Szintlépés: robot”, `ncRobot`): mind a 13 osztályt 1 → 20 végigviszi, minden helyre az első érvényes lehetőséget írva, elakadás nélkül. A véletlen build ugyanezt a menetet járja, csak **az „első érvényes” helyett egy értelmes választóval**, és az app kódjában, nem a tesztben.
- **Kezdő felszerelés:** `Sheet.seRows` / `seEredmeny` (PHB-csomag az osztály (a) / (b) választásaival és a háttérrel).

## Hogyan működik (a felhasználó szemével)

1. DM Screen → **Új lény** → Játékos → új kapcsoló: **🎲 Kész build generálása** (a mostani „a játékos tölti ki a varázslóval” mellett).
2. Mezők: név, e-mail, ki láthatja (mint most), **szint (kötelező)**, és üresen hagyhatóan: faj (+ alfaj), osztály (+ alosztály), háttér, **második osztály + szintje** (multiclass, csak ha megadod).
3. **Előnézet** (a lap még nem jön létre): faj, osztály / alosztály, képességek, HP, AC, a fontos választások (ASI / feat, skillek, Fighting Style, Invocation…), varázslatok szintenként, felszerelés. Gombok: **🎲 Újra** (a megadott adatok maradnak, a többi újragenerálódik), **Mégse**, **Létrehozás**.
4. Létrehozáskor kész, szabálymotoros lap jön létre (nincs varázsló, nincs „✨ készül”), backuppal; a könyvtárban megjelenik. A Típus mezővel NPC-vé is állítható, mint bármelyik játékos.

## Az „értelmes véletlen” szabályai (javaslat)

| Mit | Hogyan |
|---|---|
| **Képességek** | Standard array (15, 14, 13, 12, 10, 8), az osztály (és alosztály) képesség-sorrendje szerint kiosztva (pl. Wizard: INT > CON > DEX; Eldritch Knight: STR > CON > INT; Hexblade: CHA > CON > DEX); néhány osztálynak több változata van (Fighter: STR vagy DEX, Cleric, Rogue), abból véletlenül egy, a sorrenden kívüli három képesség véletlen sorrendben. A kiosztás a faji bónuszokat is nézi: a fő képesség a bónusszal együtt is a legmagasabb (pl. Dwarf Artificer: a CON +2 miatt a CON legfeljebb 13-at kap). Multiclassnál mindkét osztály fő képessége előre kerül, hogy a PHB 163. o. feltétele (13+) teljesüljön. |
| **Faj, ha üres** | Véletlen, de nagyobb eséllyel olyan, ami az osztály fő képességét emeli. |
| **Osztály, ha üres** | Egyforma eséllyel a szabálykönyv 13 osztálya közül. |
| **Alosztály, háttér, ha üres** | Véletlen a szabálykönyvben lévők közül. |
| **ASI / feat** | ASI a fő képességre 20-ig (+2, vagy 19-nél +1 / +1 a második képességgel; így 15 → 17 → 19 → 20), utána a második képességre (CON vagy a másodlagos). Feat csak kis eséllyel, teljesülő előfeltétellel (lásd „Döntések” 2.). |
| **Skillek, expertise** | Az osztály listájáról, nagyobb eséllyel a karakter magas képességeihez tartozók (pl. magas WIS → Perception, Insight). Expertise a már jártas skillekre, erősen a magas képességűek felé súlyozva. |
| **Fighting Style, Invocation, Metamagic, Maneuver, Pact Boon** | Véletlen az érvényesek közül (előfeltétellel); Warlocknál Eldritch Blast és Agonizing Blast, ha van rá hely. |
| **Varázslatok** | Véletlen a listáról, de legalább egy sebző cantrip (ha az osztálynak van ilyen), és minden elérhető varázslatszintre jut, ha a helyek engedik. A bekészítést (Cleric, Druid, Paladin, Wizard) nem tölti ki – lásd „Döntések” 4. |
| **HP** | Átlag szintenként (a szintlépés-varázsló „átlag” módja). |
| **Felszerelés** | A PHB kezdő csomag (a) / (b) választásai a buildhez illően (nehéz páncél, ha STR-es és jártas; távolsági fegyver, ha DEX-es); arany és mágikus tárgy nem (a korábbi döntés: új karakter csak a szabály szerinti kezdő felszerelést kapja; az NPC → játékos 🎁 generátor külön marad). |
| **Multiclass** | Az első osztály a (szint − a második osztály szintje)-ig, utána a második; a feltétel ⚠ jelzéssel, mint a szintlépésnél. |

## Lépések (mindegyik után működő, tesztelt, élesíthető állapot)

1. **Logika** – új `js/logika/veletlen-build.js` (DOM nélkül): `veletlenBuild({szint, faj, alfaj, osztaly, alosztaly, hatter, osztaly2, szint2}, rb)` → kész lap (`Sheet.norm`-olt). A menet a teszt-robot mintájára, a választó a fenti szabályokkal, az `rnd`-n át (a tesztben egy magból számoló `rnd`-vel ismételhető). Az osztályok képesség-sorrendje adattábla. Ha a `sheet.js`-hez új segéd kell (pl. a varázslat „sebez-e” jelzése), az oda kerül, verzióemeléssel. Tesztek: mind a 13 osztály 1., 5., 11. és 20. szinten, minden alosztály egy szinten – nincs nyitott hely, a mentett lap újraszámolva nem tér el, a fő képesség a legmagasabb, a megadott adatok megmaradnak, minden feat-előfeltétel teljesül, a varázslatok érvényesek, van sebző cantrip; multiclass-eset; valódi szabálykönyvvel (online teszt) minden osztály × néhány faj. A felületen még nem látszik semmi.
2. **Felület** – az Új lény ablak Játékos űrlapján a kapcsoló és a mezők; az előnézet-ablak (🎲 Újra, Mégse, Létrehozás); létrehozás a mostani `ujJatekos` útján, de kész lappal. Tesztek: a megadott faj / osztály a lapon; a 🎲 Újra a megadottakat megtartja; Mégse után nincs új lény; a lap `newChar` nélküli, motoros; XSS a névre.
3. **Lezárás** – `docs/mukodes.md`, `CLAUDE.md` állapot, élesítés. A felhasználó teendője várhatóan nincs (szabály- és szabálykönyv-változás nincs: a DM már most írhat lapot).

## Döntések (a felhasználóé, javaslattal)

1. **Csak a DM Screenben?** *Javaslat:* igen, a DM gombja; a játékosok varázslója (kezdő és szintlépés) nem kap 🎲 gombot. *Másik:* később lépésenkénti 🎲 a varázslóba is.
2. **Featek:** *Javaslat:* ASI a fő képességre 20-ig, utána kb. egyharmad eséllyel feat (teljesülő előfeltétellel), különben ASI a második képességre. *Másik:* soha feat; vagy a Variant Human / Custom Lineage 1. szintű featje is véletlen.
3. **Képességek:** *Javaslat:* mindig standard array (kiszámítható, kiegyensúlyozott). *Másik:* 4d6 dobás vagy point buy is választható a mezők közt.
4. **Bekészített varázslatok** (Cleric, Druid, Paladin, Wizard): *Javaslat:* nincs bekészítve, a játékos dönti el. *Másik:* véletlen bekészítés is.
5. **Előnézet utáni finomhangolás:** *Javaslat:* csak egészben 🎲 Újra (a megadott adatok maradnak). *Másik:* részenként (pl. csak a varázslatok) újradobás – több munka.
6. **Név, ha üres:** *Javaslat:* „Új karakter” (mint most). *Másik:* véletlen név fajonként.

## Kész, ha

- a DM egy szintet (és ha akar, fajt / osztályt / hátteret / második osztályt) megadva előnézetet kap, és egy kattintással kész, kitöltött, szabálymotoros lapot hoz létre;
- mind a 13 osztály minden szinten elakadás és nyitott hely nélkül generálható, a valódi szabálykönyvvel is;
- a megadott adatok sosem változnak, multiclass csak megadásra lesz;
- a tesztek száma nő, a lefedettség nem csökken.

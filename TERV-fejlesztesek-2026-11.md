# Terv: varázslatsorok (sebzés, támadás, mentő), skill-leírás, initiative a mentett encounterben

A felhasználó kérése (2026-11-13). Három külön, egymástól független lépés; mindegyik után `.\teszt.ps1`, új teszt, `ellenorzo` ügynök, és külön jóváhagyás a feltöltésre. Minden kérdés eldőlt (lásd „Döntések” a végén).

---

## 1. Varázslatsorok a telefonos lapon: sebzés, spell attack, mentő

### Most
A telefonos lap Varázslat fülén a varázslat sebzésgombja a szabálykönyvi leírás **első kockáját** dobja (`spellRow` → `diceOf(r.tx)`, `js/lap/lap-rajz.js`), módosító és szint nélkül. Ebből három hiba és egy hiány jön:
- **Agonizing Blast:** az Eldritch Blast mindig `1d10`, a +CHA nem adódik hozzá. Az Invocation választható és a Jellemzők közé is bekerül, de a sebzéshez a kód sehol nem nyúl. (PHB 2014, 110. o.: minden sugár sebzéséhez a Charisma-módosító adódik.)
- **Cantrip-erősödés:** a cantripek sebzése a karakterszinttel nő (5. / 11. / 17. szint), a gomb mégis mindig az 1. szintit dobja (pl. Fire Bolt `1d10` `2d10` helyett).
- **Sugarak / darabszám:** az Eldritch Blast a kockája helyett a sugarak számát növeli (5. szinttől 2, 11.-től 3, 17.-től 4) – ez most sehol nem látszik.
- **Spell attack / mentő:** a spell attack dobása csak a Varázslat fül tetején van (és a Harc fülön nincs), a mentős varázslatnál pedig nem látszik, mi a mentő és mennyi a DC.

### Megoldás
Minden a varázslat sorában (`spellRow`), a Varázslat fülön; a Harc fül nem változik.

1. **Sebzés a szinthez igazítva** (a felhasználó döntése: szintlépéskor „írja felül”): a sebzésgomb a karakter **mostani szintjéhez** tartozó kockát mutatja és dobja. Nem tárolt érték: minden rajzoláskor a szintből számolódik, így szintlépés után magától frissül, régi lapon is. Csak cantripeknél (a leveles varázslatok upcastja nem része ennek a lépésnek).
2. **Ahol a darabszám nő, nem a kocka** (Eldritch Blast): a név után „(×2)” / „(×3)” / „(×4)”, a gomb egy sugarat dob (`1d10+3`), és az 1–4. szinten nincs jelzés.
3. **Agonizing Blast:** `Sheet.spellDmgBonus(s, név)` – Eldritch Blastnál, ha a lap jellemzői (`s.features`) között van „Agonizing Blast”, a CHA-módosító (negatív is lehet: CHA 8-nál −1). Név szerint nézi, így szabálymotoros (Invocation, Eldritch Adept feat), kézi és D&D Beyondból importált lapon is megy. A gomb `1d10+3`; a kis szövegben „Agonizing Blast: +3”.
4. **Spell attack gomb a sorban:** ahol a varázslat támadódobást kér (a szabálykönyvben `atk: true`), a sebzésgomb előtt egy d20-gomb a spell attack bónuszával (pl. `+5`), a kocka-sávval (előny / hátrány) és a hatásokkal (Bless…) együtt, mint a többi d20-dobás. Multiclassnál a varázslat osztályának bónusza (`sp.cls` → `Sheet.spellCasts`); osztály nélküli (faji, feat-) varázslatnál az első varázsló osztályé. A dobás a DM Screen naplójába is átmegy („Fire Bolt – spell attack”).
5. **Mentős varázslatnál** a kis szövegben a mentő és a célszám, pl. **„WIS 15”** (a DC ugyanúgy osztály szerint, mint a 4.-nél). Ha a varázslat támadást és mentőt is kér, mindkettő látszik.

### Honnan tudja (technikai döntés)
- Támadó-e: a szabálykönyv már tárolja (`atk`).
- A mentő fajtája, a cantrip kockái szintenként és a sugarak: **a leírás szövegéből** olvassa ki („…make a Wisdom saving throw”, „…increases by 1d10 when you reach 5th level (2d10)…”, „two beams at 5th level”). Így **nem kell újratölteni a szabálykönyvet**. Az online teszt (`teszt.ps1 -Online`) a tükörből minden PHB / XGE / TCE varázslaton ellenőrzi, hogy a mentős és a sebző cantripeknél sikerül-e kiolvasni; ha valamelyiknél nem, az a régi módon (első kocka, mentő nélkül) jelenik meg, hiba nélkül.

### Érintett fájlok
`sheet.js` (`spellDmgBonus`, `spellCastOf`, a `spellSave` / `cantripKocka` / `cantripDarab` szövegelemzők, `Sheet.VERSION` 25 → 26), `js/lap/lap-rajz.js` (`spellRow`), `js/lap/lap-dobas.js` (ha a d20-gombnak új fajta kell), verziószámok, `?v=`, `VART_MODULOK`.

### Tesztek
- Agonizing Blast: CHA 16 → `1d10+3`; nélküle `1d10`; CHA 8 → `1d10-1`; szabálymotoros lapon az Invocationből és az Eldritch Adept featből is.
- Fire Bolt 1. / 5. / 11. / 17. szinten: `1d10` / `2d10` / `3d10` / `4d10`; multiclassnál a teljes karakterszint számít.
- Eldritch Blast név után: 4. szinten nincs jel, 5.-en „(×2)”, 17.-en „(×4)”.
- Spell attack gomb: támadó varázslatnál van és jó a bónusz (multiclassnál osztályonként), mentősnél nincs; a dobás a naplóba jut.
- Mentős varázslat: „WIS 15”, „DEX 13” – a jó képesség és DC; ismeretlen szövegnél semmi (nem „undefined”).
- XSS a varázslatsorban; 320 px-en nem lóg ki; visszarontással ellenőrizve.

### Felhasználó teendője
Nincs (sem szabálykönyv-újratöltés, sem `firestore.rules`).

---

## 2. Skill leírása rákattintva

### Most
- Telefonos lap, Képességek fül: a skill sora név + jártasság-jel + dobógomb (`tabKep`, `js/lap/lap-rajz.js` 104. sor). A név nem kattintható.
- A szabálykönyvben **nincs** skill-leírás (a letöltő nem tölti le, `js/logika/szabalykonyv.js`).
- Már van kész minta: „📖 Leírás választás előtt” (`leirasMutat`, `js/lap/lap-fiok.js`) – a varázslat / feat / Invocation nevére koppintva felugró ablak a leírással. Ezt bővítem.

### Megoldás
- **A skill neve gomb lesz** (`nevGomb`, mint a varázslatoknál); koppintásra a meglévő felugró ablak nyílik: a skill neve, a képessége (pl. „DEX”), a leírás, és a karakter bónusza / jártassága. A dobás továbbra is a jobb oldali gombbal megy, ez nem változik.
- **Hol** (a felhasználó döntése, 2026-11-13: mindhárom helyen):
  1. telefonos lap, Képességek fül skill-listája – biztosan;
  2. a telefonos varázslókban (új karakter, szintlépés, Felépítés), ahol skillt kell választani – javaslom, mert ott segít a legtöbbet (választás előtt);
  3. a DM Screen 👥 Csapat nézetének skill-táblázata: a sor elején a skill nevére kattintva (a cellára kattintás továbbra is dobást kér).
- **Honnan jön a leírás** (a felhasználó döntése, 2026-11-13): **saját, rövid magyar leírás** a kódban (`Sheet.SKILL_INFO`, 18 skill, 1–3 mondat, saját szavakkal: mire való, tipikus példák). Előnye: nem kell hozzá szabálykönyv-újratöltés, a DM Screenen is azonnal megy, magyarul van, és nem szerzői jogi szöveg (`docs/dontesek/0003`). A másik lehetőség az angol PHB-szöveg az 5e.tools-ból (`skills.json`) a szabálykönyvbe (`RB_FORMAT` 4 → 5, újratöltés kell).
- A felugró ablak `leirasMutat`-ja új fajtát kap: `data-lr="sk"`, `data-ref="stealth"`.
- **Verzió:** `Sheet.VERSION`, a `lap-rajz`, `lap-fiok` (és a DM oldalon az `ablakok`) modulszáma.

### Tesztek
- Mind a 18 skillhez van leírás, nincs üres.
- A névre kattintva megnyílik az ablak a jó szöveggel; a dobógomb továbbra is dob (a gombteszt listájába).
- XSS-teszt a felugró ablakra; 320 px szélességen nem lóg ki.

---

## 3. Mentett encounter: az initiative is maradjon meg

### Most
A „Jelenlegi mentése” (`encounterMentese`, `js/logika/harc.js`) a nem játékos lényeket a HP-jukkal menti, az initiative-ot nem. Betöltéskor (`encounterBetoltese` → `addToEncounter`) az initiative üres (`null`), vagy ha a harc már megy, újradob.

### Megoldás
- **Mentés:** minden lény mellé a mostani initiative is (`c.init`, csak ha meg volt adva), ugyanúgy, mint a `hp.cur`.
- **Betöltés:** ha a mentésben van initiative, azt kapja – akkor is, ha a harc már megy (nem dob újra). Ha nincs (régi mentés, vagy nem volt megadva), marad a mostani működés.
- A csoportos initiative-ot nem kell külön kezelni: az együtt mentett csoport tagjainak ugyanaz az értéke volt, ugyanaz jön vissza.
- A Mentett encounterek listájában a „· N sérült” mellé: „· initiative-val”, ha van benne mentett érték.
- **Mindenkié mentődik** (a felhasználó döntése, 2026-11-13): ellenfél, NPC és játékos is. Az ellenfelek és NPC-k eddig is a mentésben voltak (teljes adattal, HP-val), most az initiative-juk is.
- **Játékos karakterek:** eddig egyáltalán nem kerültek a mentésbe (a HP-juk a telefonos lapról jön, nem a mentésből). Most csak egy rövid hivatkozás kerül be: melyik játékos (könyvtári azonosító, név) és az initiative-ja – a HP-juk, állapotuk továbbra is a lapról jön.
  - Betöltéskor: ha a játékos már az encounterben van, megkapja a mentett initiative-ot.
  - Ha nincs benne (a felhasználó döntése, 2026-11-13): a könyvtárból hozzáadja a mentett initiative-val (HP és állapot a lapról, mint mindig). Ha közben a könyvtárból is törölve lett, kihagyja, és a naplóba ír egy sort.
- **Szerződés (contract-first):** `SZERZODES.md` (`dmscreen_saved`: a lény új, nem kötelező `init` mezője, és az encounter új, nem kötelező `pcs: [{libId, name, init}]` listája), `normCreature` és a `saved` tisztítója a `szerzodes.js`-ben (szám vagy semmi; az `addToEncounter` törli a lény `init`-jét, hogy harcosba ne kerüljön), teszt a „Szerződés” csoportba; `szerzodes.js` verzió és `?v=`. Firestore-szabály nem változik.
- Ha csak játékosok vannak az encounterben, a mentés eddig „Nincs nem-játékos lény” hibát adott; most ilyenkor is ment (a játékosok initiative-jával).

### Tesztek
- Mentés → betöltés: az initiative visszajön; megadatlan initiative-ú lény üres marad.
- Futó harcba töltve a mentett érték marad, a mentett nélküli dob.
- Régi (init nélküli) mentés úgy töltődik, mint eddig.
- `normCreature`: rossz értéket (szöveg, NaN) eldob.

### Felhasználó teendője
Nincs. A már elmentett encounterekben nincs initiative – amit meg akar tartani, azt újra kell menteni.

---

## Dokumentáció a végén
`docs/mukodes.md` (a három viselkedés), `SZERZODES.md` (3. lépés), `CLAUDE.md` állapot + ez a terv a „Hol mi van” táblázatba.

## Javasolt sorrend
3 → 1 → 2 (a legkisebb és legbiztosabb előre; az 1. a legnagyobb, a 2. független tőlük).

---

## Döntések (a felhasználó, 2026-11-13)
1. Eldritch Blast: a gomb egy sugarat dob; a sugarak száma a név után „(×2)” alakban (a második válasz pontosította).
2. Skill-leírás: telefonos lap Képességek fül + a varázslók skill-választói + DM Screen Csapat nézet.
3. Skill-leírás szövege: saját, rövid magyar leírás, szabálykönyv-újratöltés nélkül.
4. Initiative mentése: mindenkié (ellenfél, NPC, játékos).
5. Betöltéskor a mentett, de az encounterben nem lévő játékost a könyvtárból hozzáadja.
6. Cantrip-sebzés: a karakterszinthez igazodik (szintlépéskor magától frissül); ahol a darabszám nő, nem a kocka, a név után „(×2)”.
7. Spell attack dobás a varázslat sorában (nem a Harc fülön); mentős varázslatnál a mentő és a DC kis betűvel, pl. „WIS 15”.
8. (Technikai, Claude javaslata) A mentő fajtája és a cantrip-kockák a leírás szövegéből jönnek, szabálykönyv-újratöltés nélkül.

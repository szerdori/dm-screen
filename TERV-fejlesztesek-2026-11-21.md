# Terv: állapot- és erőforrás-leírás, varázslatbónuszok, Harness Divine Power, Inspiration, telefonos nézet a DM Screen oldalpanelén

**Állapot: jóváhagyva (2026-11-21), megvalósítás folyamatban.**

A felhasználó kérése (2026-11-21), nyolc pont. Egymástól nagyrészt független lépések; mindegyik után `.\teszt.ps1` (fejlesztés közben szűrve, a lépés végén teljesen), új teszt a `tests\csoportok\` megfelelő fájljába, `ellenorzes.ps1`, `ellenorzo` ügynök, és külön jóváhagyás a feltöltésre. A nyitott kérdések a végén, mindegyiknél a javasolt válasz elöl.

Az egyes lépéseknél a „Most” rész a kód mostani állapota (2026-11-21, `Sheet.VERSION` 28, `lap-rajz` 7, `lap-akciok` 4, `harcter` 3, `lapszinkron` 16).

---

## 1. Állapot leírása rákattintva

### Most
- **DM Screen:** a csempén (`tileHtml`) és az oldalpanelen (`renderDetail`, `js/felulet/harcter.js`) az állapot-címkére kattintás **eltávolítja** az állapotot (`AKCIOK.rmCond`). Leírás sehol nem látszik.
- **Telefonos lap, Harc fül:** a felvett állapot sora lenyitható (`det('cond:…')`, `js/lap/lap-rajz.js`), benne a PHB angol szövege a szabálykönyvből (`RB().conditions`) és az aktív hatás gépi leírása (`H.effectOf(c).text`). Ez már működik.
- **Telefonos lap, a lap tetején:** az `fxbar` címkéinek csak `title`-je van (egérrel látszik, telefonon nem).
- A hozzáadó legördülőben (`#condAdd`) választás előtt nem látszik, mit jelent az állapot.

### Megoldás
1. **DM Screen:** az állapot-címkére kattintva kis felugró ablak (a meglévő `openModal`, vagy a csempe fölött egy kis buborék): név, hátralévő körök, a leírás, alul **Eltávolítás** gomb. Az eltávolítás így két kattintás lesz (lásd 1. nyitott kérdés). A Koncentráció címke marad, ahogy van.
2. **Telefonos lap:** az `fxbar` címkéi gombok lesznek: koppintásra a meglévő felugró ablak (`leirasMutat`, új fajta `data-lr="cond"`). A Harc fül lenyitható sora marad.
3. **A leírás forrása** (2. nyitott kérdés): javaslat: **saját, rövid magyar összefoglaló** a 14 PHB-állapothoz és az Exhaustion szintjeihez (`SheetAdat.COND_INFO`, a `SKILL_INFO` mintájára, saját szavakkal – `docs/dontesek/0003`), alatta, ha a szabálykönyv be van töltve, a PHB angol szövege. Az aktív hatásoknál (Bless, Haste…) a meglévő `EFFECTS[n].text`. Egyéni (kézzel beírt) állapotnál: „Saját állapot, nincs leírás.”
4. A DM Screen állapot-választójában (`#condSel`) a kiválasztott állapot rövid leírása a sor alatt (javaslat, kicsi).

### Érintett fájlok
`sheet-adat.js` (`COND_INFO`), `sheet.js` (kiadja: `Sheet.COND_INFO`, `Sheet.VERSION`), `js/felulet/harcter.js` (címke: `data-act="condInfo"`), `js/felulet/akciok.js` (`AKCIOK.condInfo`, az eltávolítás a felugró ablakból), `js/lap/lap-rajz.js` (`fxBar`), `js/lap/lap-fiok.js` (`leirasMutat` új fajta), verziószámok (`.\verzio.ps1 sheet sheet-adat harcter akciok lap-rajz lap-fiok`).

### Tesztek
- Mind a 14 állapothoz és az Exhaustion 1–6. szintjéhez van leírás, egyik sem üres.
- DM Screen: a címkére kattintás nem törli az állapotot, a felugró ablak a jó szöveget mutatja; az Eltávolítás gomb törli (a lapra is visszaszinkronizál).
- Telefon: az `fxbar` címkéje megnyitja az ablakot; egyéni állapotnál nincs „undefined”.
- XSS az egyéni állapot nevével; 320 px-en nem lóg ki.

### Felhasználó teendője
Nincs.

---

## 2. A sebzéshez adódó varázsképesség-módosító a dobás szövegében

### Most
A varázslat sorának sebzésgombja (`spellDobasok` → `dmgBtn`, `js/lap/lap-rajz.js`) a leírás első kockáját dobja, a cantripet a karakterszinten. Állandó bónusz csak egy van: az **Agonizing Blast** (`Sheet.spellDmgBonus`, csak Eldritch Blastnál, +CHA; a kis szövegben „Agonizing Blast: +3”). Ami kimarad:
- **A varázslat saját szövege**, ha a kockához „+ your spellcasting ability modifier” tartozik: Healing Word, Cure Wounds, Mass Healing Word, Mass Cure Wounds, Spiritual Weapon, Prayer of Healing-féle gyógyítások stb. A gomb most csak `1d4`-et dob (Healing Word), a módosító nélkül.
- **Osztály-feature-ök**, amelyek a varázslat sebzéséhez adják a módosítót (PHB 2014): **Potent Spellcasting** (Cleric 8., Knowledge / Light / Trickery Domain…: a Cleric cantripek sebzéséhez +WIS), **Empowered Evocation** (Wizard Evocation 10.: evocation varázslat egy sebzésdobásához +INT), **Elemental Affinity** (Draconic Sorcerer 6.: a sárkány sebzéstípusával egyező varázslathoz +CHA).

### Megoldás
1. `Sheet.spellDmgBonus(s, sp, tx)` általánosítása: a varázslat neve mellett a leírás szövegét és a varázslat osztályát is kapja, és egy listát ad vissza (`[{v, src}]`), amit a gomb összead.
   - **Szövegből:** ha a kocka után „+ your spellcasting ability modifier” áll, a varázslat osztályának módosítója (`spellCastOf(s, sp).ab`; multiclassnál a varázslat osztályáé). Forrás: „WIS-módosító”.
   - **Feature-ből** (név szerint a lap jellemzői között, mint az Agonizing Blastnál, így motoros, kézi és D&D Beyond-os lapon is): Agonizing Blast (marad), Potent Spellcasting (csak Cleric cantrip), Empowered Evocation (csak evocation iskolájú varázslat; a szabálykönyvben van iskola), Elemental Affinity (csak ha a sebzéstípus egyezik – a típust a lap nem tárolja, lásd 3. nyitott kérdés).
   - A szabályok egy kis táblában a `sheet-adat.js`-ben (`VARAZS_BONUSZ`), hogy később bővíthető legyen.
2. **Megjelenítés:** a gomb felirata a teljes kifejezés (pl. `1d4+4`), a kis szövegben a forrás: „+4 WIS (Healing Word)”, „Potent Spellcasting: +4”. A napló sora is a teljes kifejezést mutatja („Healing Word: 1d4+4 = 7”).
3. **Gyógyító varázslat** (Healing Word, Cure Wounds): a gomb ne kapjon sebzéstípust és flavour textet (most a `H.dmgType(r.tx)` üres, így nem kap – teszttel rögzíteni). Javaslat: a gyógyításnál a gomb címkéje „gyógyítás” (4. nyitott kérdés).
4. A DM Screen statblokkjában nincs varázslat-sebzés, ott nincs teendő (a 3. lépés után a telefonos nézet ezt is mutatja).

### Érintett fájlok
`sheet.js` (`spellDmgBonus`, `Sheet.VERSION`), `sheet-adat.js` (`VARAZS_BONUSZ`), `js/lap/lap-rajz.js` (`spellDobasok`, `spellRow`), verziók.

### Tesztek
- Healing Word WIS 18-cal: `1d4+4`; Cure Wounds: `1d8+4`; Spiritual Weapon: `1d8+4`; multiclassnál a varázslat osztályának módosítója.
- Potent Spellcasting: Cleric 8 Sacred Flame `2d8+4`, Wizard-cantrip ugyanazon a lapon nem kap bónuszt; Empowered Evocation csak evocationnál.
- Agonizing Blast a régi tesztjeivel együtt nem változik; negatív módosító (`1d4-1`).
- Ismeretlen szövegnél nincs bónusz, nincs „undefined”; a gyógyításnak nincs sebzés-flavourje.

### Felhasználó teendője
Nincs (a szöveg a már letöltött szabálykönyvből jön, újratöltés nem kell).

---

## 3. A DM Screen oldalpanele a telefonos lap nézetével

### Most
Az oldalpanel (`#side` → `#detail`, 440 px széles, `renderDetail`, `js/felulet/harcter.js`) felül a harci vezérlők (Init, HP, Temp, AC, állapotok, nyilvános név, jegyzet), alatta a **szörny-stílusú statblokk** (`statblock(c)`). Játékosnál a statblokk a lapból készül (`sheetToCreature`, `js/logika/lapszinkron.js`): a varázslatok, erőforrások, jellemzők egy-egy szövegsorba sűrítve, fülek, gombok, varázslat-sorok nélkül.

### Megoldás (5. nyitott kérdés: melyik változat)
**A) javaslat: a telefonos lap beágyazva.** Játékosnál (és lappal rendelkező NPC-nél) a statblokk helyén egy `<iframe>` a `karakter.html#lap/{id}` címmel – ugyanaz az oldal, ugyanazokkal a fülekkel (Harc, Képességek, Varázslat, Felszerelés…), dobógombokkal, varázslat-sorokkal, mint a telefonon. A 440 px-es panel épp telefonszélesség.
- A DM be van lépve, a `karakter.html` ugyanazon a címen fut, így a belépés közös (nem kér újra Google-belépést), és DM-ként minden lap írható (`isDM`).
- **Egy iframe** marad a panelen; másik játékos kiválasztásakor csak a cím `#`-utáni része változik (`hashchange` → `route()`), nincs újratöltés.
- Új kapcsoló a `karakter.html`-ben: `?beagyazva=1` – elrejti a ‹ Vissza gombot, a Fiók sort és a lap-listát; minden más ugyanaz.
- A felső harci vezérlők maradnak (Init, oldal, nyilvános név, harci jegyzet); a HP és az állapot a lapon is állítható, a kettő a meglévő szinkronnal (`lapszinkron.js`) egyezik.
- A beágyazott lapon dobott dobás a lap `rolls` mezőjén át ugyanúgy a DM naplójába kerül, mint a telefonról.
- A panel tetején egy kapcsoló: **📱 Lap / 📜 Statblokk** (eszközönként megjegyezve, `Bongeszotar`), hogy a régi nézet is elérhető maradjon. Szörnynél és lap nélküli NPC-nél mindig a statblokk.
- Teszt módban (`?test=1`) a beágyazott lap is teszt módban töltődik.

**B) a statblokk átrajzolása telefonos stílusra** a DM appon belül (saját fülek, a `SHEETS`-ből olvasva). Előnye: nincs második oldal és második Firebase-kapcsolat. Hátránya: a telefonos lap rajzolóit (`js/lap/lap-rajz.js`) újra kellene írni a DM rétegeibe, és utána minden telefonos változást két helyen kellene követni. Sokkal nagyobb munka, és tartósan duplikált kód.

### Érintett fájlok (A változat)
`js/felulet/harcter.js` (`renderDetail`: iframe vagy statblokk, a kapcsoló), `js/felulet/akciok.js` (a kapcsoló gombja), `index.html` (stílus: az iframe kitölti a `#detail`-t), `karakter.html` + `js/lap/lap-indulas.js`, `js/lap/lap-utvonal.js` (`beagyazva` mód), `kozos.js` (`Szerzodes.HELYI` új kulcs a kapcsolónak – `szerzodes.js`), `docs/mukodes.md`, verziók.

### Tesztek
- Játékos kiválasztásakor iframe a jó `#lap/{id}` címmel; másik játékosra váltva ugyanaz az iframe, új cím (nem töltődik újra).
- Szörnynél statblokk; a kapcsolóval játékosnál is statblokk, és ez megmarad.
- `beagyazva=1`: nincs Vissza gomb, nincs lap-lista.
- Firebase nélkül (teszt mód) nem ír a felhőbe.

### Felhasználó teendője
Nincs (szabály- és szabálykönyv-változás nincs). Kipróbálás a DM gépén, élesben.

---

## 4. Harness Divine Power elhasználja a Channel Divinity-t

### Most
A szabálymotor két külön erőforrást ad a Clericnek (`sheet-adat.js` `FEATURE_FX`): `Channel Divinity` (2. szinttől 1, 6.-tól 2, 18.-tól 3, short rest) és – ha a TCE opcionális feature-t választotta – `Harness Divine Power` (ugyanígy, long rest). A Harc fülön a pötty kattintása (`LAP_AKCIOK.res`, `pipToggle`) csak a saját erőforrását állítja. A szabály (TCE 30. o.): a Harness Divine Power egy Channel Divinity használatába kerül, és visszaad egy elhasznált spell slotot, aminek a szintje legfeljebb a Proficiency Bonus fele, felfelé kerekítve.

### Megoldás
1. **Összekapcsolt erőforrások táblája** a `sheet-adat.js`-ben: `RES_KAPCS = {'Harness Divine Power': 'Channel Divinity'}` (később bővíthető, pl. a Druid TCE Wild Companion → Wild Shape, ha az is erőforrás lesz).
2. **A Harc fülön** a Harness Divine Power pöttyének elhasználásakor (a `used` nő) ugyanabban az írásban a Channel Divinity `used`-je is nő eggyel. Ha a Channel Divinity elfogyott: megerősítő kérdés, mint a Rage-nél („Elfogyott a Channel Divinity (2 / 2). Mégis használod?”) – Mégse = semmi nem változik.
3. **Visszavonás** (a pötty visszakattintása, `used` csökken): a Channel Divinity is visszakap egyet (6. nyitott kérdés).
4. **A visszakapott slot** (7. nyitott kérdés): javaslat: a használat után a sorban gombok az elhasznált, legfeljebb ⌈PB/2⌉ szintű slotokkal („Visszakapott slot: 1. szint · 2. szint · Most nem”), egy koppintással visszaadja.
5. Multiclass (Cleric + Paladin): a Channel Divinity egy közös erőforrás, ezt használja.

### Érintett fájlok
`sheet-adat.js` (`RES_KAPCS`), `sheet.js` (`Sheet.resKapcsolt(s, i, ujUsed)` – a tisztán számoló rész, a `lap-akciok`-ból hívva), `js/lap/lap-akciok.js` (`res`), `js/lap/lap-rajz.js` (a slot-választó sor), verziók.

### Tesztek
- HDP pötty → CD is −1; CD elfogyva → kérdés, Mégse = nincs változás; visszavonás → mindkettő vissza.
- Csak CD használata nem érinti a HDP-t; TCE-feature nélküli Clericnél nincs változás.
- Slot visszaadás: PB 3 → legfeljebb 2. szintű; szabad slot nélkül nincs gomb.

### Felhasználó teendője
Nincs.

---

## 5. Varázslatok ábécésorrendben a Varázslat fülön

### Most
A `varLista` (`js/lap/lap-rajz.js`) szintenként (multiclassnál osztályonként, azon belül szintenként) csoportosít, a csoporton belül a lap `spells` tömbjének sorrendjében (amilyen sorrendben felkerültek).

### Megoldás
A csoporton belül név szerint ábécérendben (`localeCompare`, kis- és nagybetű nélkül). A szint szerinti (és osztály szerinti) csoportosítás marad. A tárolt sorrend nem változik, csak a megjelenítés; a gombok továbbra is az eredeti indexet kapják (`data-i`), így a bekészítés, Cast, törlés a jó varázslatra hat. Javaslat: a DM statblokk „Varázslatok” sorában (`sheetToCreature`) is ábécérend (8. nyitott kérdés).

### Érintett fájlok
`js/lap/lap-rajz.js` (`varLista`), esetleg `js/logika/lapszinkron.js`; verziók.

### Tesztek
- Összekevert sorrendű lapon a Cantripek és az 1. szint ábécérendben; a Cast és a bekészítés a jó varázslatra hat (index-teszt).
- Multiclassnál osztályonként külön rendezve.

### Felhasználó teendője
Nincs.

---

## 6. A varázsképesség-módosító a spellcasting sorban

### Most
- Varázslat fül fejléce (`varFej`): „Varázsképesség: **Wisdom** · spell save DC **15** · spell attack +7” (multiclassnál osztályonként: „Cleric (Wisdom): spell save DC 15 · spell attack +7”).
- Harc fül, varázslat-sor: „Varázslat · spell save DC 15” + spell attack gomb.

### Megoldás
Mindkét helyen a módosító is: „Varázsképesség: **Wisdom (+4)** · spell save DC **15** · spell attack +7”, a Harc fülön „spell save DC 15 · WIS +4”. A módosító a varázsló osztály képességéből (`c.ab` → `mod(s.abilities[c.ab])`, motoros lapon a számolt képességértékkel). Javaslat: a DM statblokk „Varázslatok” sorában is („spell save DC 15, +7 to hit, WIS +4”).

### Érintett fájlok
`js/lap/lap-rajz.js` (`varFej`, `tabHarc`), `js/logika/lapszinkron.js` (statblokk), verziók.

### Tesztek
WIS 18 → „Wisdom (+4)”; multiclassnál osztályonként a saját módosítója; varázsképesség nélkül nincs sor.

### Felhasználó teendője
Nincs.

---

## 7. Inspiration: fogyó erőforrás, szintlépéskor visszatöltődik

### Most
Az Inspirationnek nincs helye a lapon. Az erőforrások visszatöltése: `RESETS = ['short', 'long', 'none']` (`sheet.js`); a long rest mindent visszatölt, ami nem `none`.

### Megoldás
1. **Új visszatöltési mód: `level`** („szintlépéskor”) a `RESETS`-ben és a `RESET_HU`-ban (`js/lap/lap-alap.js`). A short és a long rest nem tölti vissza (`longRest`: `none` és `level` marad).
2. **Szintlépéskor** (`levelUpApply`, a varázsló mentése) a `level` módú erőforrások `used`-je 0 lesz. Multiclass-szintlépésnél is. A „↩ Szintlépés visszavonása” nem veszi vissza (a mostani `used` marad, mint a többi erőforrásnál).
3. **Inspiration erőforrás** (9. nyitott kérdés): javaslat: a szabálymotor minden motoros lapra felteszi („Inspiration”, max 1, `level`); kézi lapon az Alapadatokon vehető fel az új „szintlépéskor” móddal. Mind a három játékos lapja motoros, így náluk magától megjelenik.
4. **A max** (10. nyitott kérdés): javaslat: 1 (PHB 2014: az Inspiration vagy van, vagy nincs), a DM átírhatja (felülírás a lapon).
5. Leírása (a 8. lépéshez): saját magyar szöveg („Elhasználva előnyt kapsz egy támadásra, mentőre vagy képességpróbára…”), `SheetAdat`.

### Szerződés (contract-first)
`SZERZODES.md`: a lap `resources[].reset` ∈ `short | long | none | level`. `Sheet.norm` (a `RESETS` bővül), `Sheet.TEMPLATE` leírása, teszt a „Szerződés” csoportba. A régi, gyorsítótárazott `sheet.js` az ismeretlen `level`-t `long`-ra írná – ezt a verzióőr akadályozza meg (`Sheet.VERSION` emelés: a régi oldal nem ír a felhőbe). Firestore-szabály nem változik (az erőforrásokat eddig is a játékos írja).

### Érintett fájlok
`SZERZODES.md`, `sheet.js` (`RESETS`, `norm`, `longRest`, `levelUpApply`, a motor erőforrás-listája), `sheet-adat.js` (Inspiration szabály és leírás), `js/lap/lap-alap.js` (`RESET_HU`), `js/lap/lap-rajz.js` (Alapadatok legördülő), D&D Beyond-import (`js/logika/import-ddb.js`: a DDB `inspiration` jelzője → `used` 0 vagy 1, ha egyszerű), verziók.

### Tesztek
- `norm`: `level` megmarad, ismeretlen érték `long`.
- Short és long rest nem tölti vissza; szintlépés igen (multiclassnál is); visszavonás után a `used` marad.
- Motoros lapon megjelenik, max 1; kézi lapon a legördülőben ott a „szintlépéskor”.

### Felhasználó teendője
Feltöltés után nincs; a meglévő motoros lapok a következő újraszámoláskor (megnyitáskor) kapják meg az erőforrást.

---

## 8. Erőforrás leírása a Harc fülön; leírás saját erőforráshoz

### Most
A Harc fül erőforrás-sora: név, „1 / 2 · short rest”, pöttyök (`tabHarc`). A névre kattintva semmi nem történik. Az erőforrásnak nincs leírás-mezője (`resources: {name, max, used, reset}`).

### Megoldás
1. **A név gomb lesz** (`nevGomb`, mint a varázslatnál és a skillnél); koppintásra a meglévő felugró ablak (`leirasMutat`, új fajta `data-lr="res"`): név, „1 / 2 · short rest”, és a leírás. A pöttyök kattintása nem változik.
2. **A leírás forrása**, sorrendben:
   1. az erőforrás saját leírása (új `desc` mező, lásd lent);
   2. a lap azonos nevű jellemzője (pl. „Channel Divinity”, „Bardic Inspiration”, „Rage”, „Ki”; a „Channel Divinity: Harness Divine Power” jellemző a „Harness Divine Power” erőforráshoz – név-részlet szerint);
   3. a szabálykönyv feature-szövege (`RB().features`), ha van;
   4. ha semmi: „Nincs leírás.” (szerkeszthető lapon: „Az Alapadatokon adhatsz hozzá.”).
3. **Saját (homebrew) erőforrás leírása:** az Alapadatok erőforrás-sorában új mező „Leírás” (többsoros), mentéskor a `desc`-be. Motoros lapon is a saját erőforrásokhoz; a motor által adott erőforrásokhoz is írható (11. nyitott kérdés: javaslat igen, és a motor újraszámolása megtartja).

### Szerződés (contract-first)
`SZERZODES.md`: `resources[].desc` (szöveg, legfeljebb 1000 karakter, nem kötelező). `Sheet.norm` tisztítja (`str(x.desc, 1000)`), a motor összefésülése (`merge` a `materialize`-ban, `sheet.js` ≈ 966. sor) a régi `desc`-et megtartja, `restorePatch` / `backupPatch` viszi. XSS-teszt. `Sheet.VERSION` emelés. Firestore-szabály nem változik.

### Érintett fájlok
`SZERZODES.md`, `sheet.js` (`norm`, `materialize` merge), `js/lap/lap-rajz.js` (`tabHarc`, Alapadatok űrlap), `js/lap/lap-fiok.js` (`leirasMutat`), `js/lap/lap-akciok.js` / az űrlap olvasása (`readForm`), `sheet-adat.js` (`MEZO_INFO.resource` bővítése a leírással), verziók.

### Tesztek
- Névre koppintva az ablak a saját leírással; saját nélkül a jellemző szövegével; egyik nélkül „Nincs leírás.”
- Az Alapadatokon beírt leírás mentődik, újraszámolás után megmarad; `norm` levágja 1000 karakterre.
- A pötty kattintása továbbra is elhasznál (a gombteszt listájába az új gomb).
- XSS a leírásban; 320 px-en nem lóg ki.

### Felhasználó teendője
Nincs.

---

## Dokumentáció a végén
`docs/mukodes.md` (minden lépés viselkedése), `SZERZODES.md` (7. és 8. lépés), `CLAUDE.md` „Állapot” + ez a terv a „Hol mi van” táblázatban.

## Javasolt sorrend
5 → 6 → 2 → 1 → 8 → 7 → 4 → 3
(az apró, biztos megjelenítési változások előre; a 8. és a 7. együtt viszi a szerződésváltozást – egy `Sheet.VERSION` emeléssel is mehetnek; a 4. a 8. leírás-ablakára épülhet; a 3. a legnagyobb és a többitől független, a végén mindent megmutat a DM-nek is).

## Figyelendő menet közben
A `js/lap/lap-rajz.js` (40 KB) `tabHarc`-ja és a `harcter.js` `renderDetail`-je hosszú rajzoló: a CLAUDE.md „Figyelendő menet közben” pontja szerint a 3., 4. és 8. lépésnél meg lehet bontani őket – szólok, mielőtt hozzányúlok.

---

## Nyitott kérdések (a felhasználó dönt; a javasolt válasz elöl)
1. **DM Screen állapot-címke:** a kattintás a leírást nyitja, az eltávolítás az ablak gombjával (javaslat) – vagy kattintás = leírás, jobb klikk / Shift+kattintás = azonnali eltávolítás?
2. **Állapot leírásának szövege:** saját rövid magyar összefoglaló + alatta a PHB angol szövege, ha a szabálykönyv betöltött (javaslat) – vagy csak a PHB angol szöveg a szabálykönyvből?
3. **Elemental Affinity** (Draconic Sorcerer): a lap nem tudja a sárkány sebzéstípusát. Kimarad (javaslat; most nincs ilyen karakter) – vagy kérdezzük meg a lapon?
4. **Gyógyító varázslat gombja:** „gyógyítás” címkével, flavour text nélkül (javaslat) – vagy maradjon úgy, mint a sebzés?
5. **Oldalpanel:** A) beágyazott telefonos lap kapcsolóval a régi statblokkra (javaslat) – vagy B) a statblokk átrajzolása telefonos stílusra? Ha A: a felső harci vezérlőkből (HP, AC, állapot) maradjon-e minden, vagy játékosnál csak Init, oldal, nyilvános név, jegyzet (javaslat: maradjon minden, a szinkron úgyis egyezteti)?
6. **Harness Divine Power visszavonása:** a Channel Divinity is visszajön (javaslat) – vagy csak a HDP?
7. **A visszakapott spell slot:** a HDP használata után a slot-választó gombok (javaslat) – vagy csak a két erőforrás, a slotot a játékos kézzel állítja?
8. **Ábécérend a DM statblokkjában is** (javaslat: igen) – vagy csak a telefonos Varázslat fülön?
9. **Inspiration:** minden motoros lapon magától (javaslat) – vagy csak ahol a DM / játékos felveszi?
10. **Inspiration max:** 1, a DM átírhatja (javaslat) – vagy több is gyűlhet (pl. 3)? És adjon-e a DM Screen gombot („＋ Inspiration” a Csapat nézetben vagy a csempén) a menet közbeni jutalmazáshoz?
11. **Leírás a motor által adott erőforráshoz:** a játékos / DM felülírhatja (javaslat: igen, a saját leírás elöl) – vagy csak a saját erőforrásokhoz?

## Döntések (a felhasználó, 2026-11-21)
A felhasználó mind a 11 kérdésre a javasolt választ fogadta el („mehet a javasolt módon”), a sorrend 5 → 6 → 2 → 1 → 8 → 7 → 4 → 3, minden lépés után commit (ha a teljes teszt hibátlan és az `ellenorzes.ps1`-ben nincs `HIBA`), a végén feltöltés a `feltoltes.ps1`-gyel.
1. DM Screen állapot-címke: a kattintás a leírást nyitja, az eltávolítás az ablak **Eltávolítás** gombjával.
2. Állapot leírása: saját rövid magyar összefoglaló, alatta a PHB angol szövege, ha a szabálykönyv betöltött.
3. Elemental Affinity: kimarad.
4. Gyógyító varázslat gombja: „gyógyítás” címkével, flavour text nélkül.
5. Oldalpanel: A) beágyazott telefonos lap (`karakter.html?beagyazva=1#lap/{id}`), 📱 Lap / 📜 Statblokk kapcsolóval; a felső harci vezérlők mind maradnak.
6. Harness Divine Power visszavonása: a Channel Divinity is visszajön.
7. A HDP használata után slot-visszaadó gombok (legfeljebb ⌈PB/2⌉ szintű, elhasznált slotok).
8. Ábécérend a DM statblokkjában is.
9. Inspiration: minden motoros lapon magától.
10. Inspiration max 1, a DM átírhatja; a DM Screenen „＋ Inspiration” gomb.
11. A motor által adott erőforráshoz is írható leírás, és az újraszámolás megtartja.

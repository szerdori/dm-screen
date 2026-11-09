# Kezdő felszerelés és szinthez illő tárgyak – terv

*Készült: 2026-11-09. Állapot: **kész, mind a 6 lépés (2026-11-09)**, elfogadva 2026-11-09 (a döntések a végén); a felhasználó minden lépést kért, lépésenként külön committal, a végén feltöltéssel. A pontos adatformátum: `SZERZODES.md`.*

Előzmény: a `TERV-3-4-fazis.md` 5. fázisának 7. lépése (kezdő felszerelés) és a 10–11. döntés (a csomagok kibontva, tárolóba téve; arany helyett vásárlás kosárral a varázslóban). Az 5. fázis szűkített változata ezt kihagyta: most a játékos a Felszerelés fülön veszi fel a tárgyait (`docs/mukodes.md`, „✨ Új játékos és kezdő varázsló”). A featek és a TCE kész (`TERV-featek-tce.md`), a szabálykönyv 3-as formátumú.

## Mit akar a felhasználó

1. **Új, 1. szintű karakter:** a PHB kezdő felszerelése (osztály + háttér) a lapra kerül. Ahol választás van („chain mail **vagy** leather armor + longbow + 20 arrows”, „bármely martial weapon”), ott a varázslóban választ; ahol nem automatizálható, ott ✋ teendő. A kezdő pénz is meghatározott.
2. **Magasabb szintű, sima új karakter:** ugyanazt a kezdő felszerelést kapja, mint az 1. szintű (a varázsló 1. szinten választja, utána jön a szintlépés).
3. **NPC → játékos karakter:** a karakter a szintjéhez, fajához, osztályához illő tárgyakat kap (véletlen generálás). Ha később újra NPC lesz, a cuccai megmaradnak. Ha átalakításkor már vannak tárgyai, a program rákérdez, hogy generáljon-e még.
4. **Javaslat, döntésre:** magasabb szintű karakternél véletlen build.

## A szabályok (PHB / DMG 2014)

- **Kezdő felszerelés (PHB 143. o., „Starting Equipment”):** az osztály felszerelése (a / b választásokkal) **+** a háttér felszerelése, benne a háttér erszényének pénze (pl. Acolyte 15 gp, Criminal 15 gp, Folk Hero 10 gp).
- **Arany helyett (PHB 143. o., „Equipment” táblázat „Starting Wealth by Class”):** az osztály kezdőarany-dobása, és ebből vásárol – **az osztály és a háttér felszerelése helyett is**, tehát a háttér erszényének pénzét sem kapja. Barbarian 2d4 × 10, Bard 5d4 × 10, Cleric 5d4 × 10, Druid 2d4 × 10, Fighter 5d4 × 10, Monk **5d4** (× 10 nélkül), Paladin 5d4 × 10, Ranger 5d4 × 10, Rogue 4d4 × 10, Sorcerer 3d4 × 10, Warlock 4d4 × 10, Wizard 4d4 × 10 (és Artificer 5d4 × 10, TCE/ERLW). Ez az 5e.tools adatában is így van (`goldAlternative`).
- **Magasabb szintű kezdés (DMG 38. o., „Starting at Higher Level”, „Starting Equipment” táblázat):** a „normal starting equipment” mellé szintsávonként arany és mágikus tárgyak, a kampány mágiaszintje szerint (alacsony / normál / magas). Az értékek (az építéskor a könyvből még egyszer ellenőrizni):

  | Szint | Alacsony mágia | Normál | Magas mágia |
  |---|---|---|---|
  | 1–4. | normál kezdő felszerelés | normál kezdő felszerelés | normál kezdő felszerelés |
  | 5–10. | 500 gp + 1d10 × 25 gp | 500 gp + 1d10 × 25 gp, 1 uncommon | 500 gp + 1d10 × 25 gp, 2 uncommon |
  | 11–16. | 5000 gp + 1d10 × 250 gp, 1 uncommon | 5000 gp + 1d10 × 250 gp, 2 uncommon | 5000 gp + 1d10 × 250 gp, 3 uncommon, 1 rare |
  | 17–20. | 20 000 gp + 1d10 × 250 gp, 2 uncommon | 20 000 gp + 1d10 × 250 gp, 2 uncommon, 1 rare | 20 000 gp + 1d10 × 250 gp, 3 uncommon, 2 rare, 1 very rare |

  (Minden sorban a normál kezdő felszerelés is jár.) A DMG 135. o. „Magic Item Rarity” táblája szerint a ritkaság alsó szinthatára: uncommon 1+, rare 5+, very rare 11+, legendary 17+ – a generátor ennél ritkábbat nem ad.

## Az adat: mit ad az 5e.tools (ellenőrizve 2026-11-09, GitHub-tükör)

- **Osztály** (`class/class-*.json`, a PHB-s `class` elem): `startingEquipment.defaultData` – soronként egy választás: `{a: [...], b: [...]}` (néha `c` is) vagy `{_: [...]}` (fix). Tétel: `'chain mail|phb'`, `{item: 'handaxe|phb', quantity: 2}`, `{equipmentType: 'weaponMartial', quantity: 2}`. Mellette `default` (a PHB szövege, pl. „(a) a mace or (b) a warhammer (if proficient)”) és `goldAlternative` (`'{@dice 5d4 × 10|…}'`).
- **Háttér** (`backgrounds.json`): `startingEquipment` – ugyanilyen sorok; a tételek közt `{special: 'vestments'}` (szabálykönyvben nem szereplő, szöveges tárgy) és `{item: 'pouch|phb', containsValue: 1500}` (az erszény tartalma rézben: 1500 = 15 gp).
- **`equipmentType` értékek** (osztály + háttér, mind előfordul): `weaponSimple`, `weaponSimpleMelee`, `weaponMartial`, `weaponMartialMelee`, `instrumentMusical`, `toolArtisan`, `setGaming`, `focusSpellcastingArcane`, `focusSpellcastingDruidic`, `focusSpellcastingHoly`. Ezekhez a szabálykönyvből választó kell (fegyverkategória, a tárgy típuskódja: INS, AT, GS, SCF + fókuszfajta) – az építéskor ellenőrizni, hogy a `baseItems` / `items` megtartja-e a kategóriát és a fókuszfajtát; ha nem, a letöltő kapja meg (`itemMech`).
- A csomagok (Explorer's Pack…) tartalma már a szabálykönyvben van (`packContents` → a tárgy szövege); a kibontáshoz szerkezetben is kell (`pk: [{r, q}]`, a szöveges tétel `{sp, q}`).

## Terv

### Adatformátum (contract-first)

- **Szabálykönyv v4** (`RB_FORMAT = 4`): `classes[].se = {rows: [{a?, b?, c?, _?}], gold: '5d4*10', tx: [a PHB szövege soronként]}`, `backgrounds[].se = {rows: […]}` (a pénz a tételen: `{r: 'Pouch|PHB', cp: 1500}`); tétel: `{r: 'Chain Mail|PHB', q: 1}`, `{cat: 'weaponMartial', q: 2}`, `{sp: 'vestments'}`; a csomagtárgyakon `pk`. A felhasználó teendője: szabálykönyv újratöltése. Amíg a régi (v3) szabálykönyv van fent, a varázsló a felszerelés-lépést kihagyja, és szól: „A kezdő felszereléshez a DM töltse újra a szabálykönyvet.”
- **`newChar.eq`** (a lap új mezője a `newChar` alatt, `Sheet.norm`): `{mode: 'pack' | 'gold' | '', pick: {sorindex: 'a'|'b'|'c'}, cat: {'sor:betű:tételindex': ['Longsword|PHB', …]}, gold: szám | null, cart: [{r, q}]}`; és a DM beállítása: `newChar.equip: 'pack' | 'gold' | 'any'` (az eredeti tervből; alapértelmezés: `'any'` – a játékos dönt).
- **`fromNpc: true`** a könyvtári lényen (`normCreature`, `dmscreen_library`): a szerkesztő állítja be, amikor NPC-ről Játékosra vált; ebből tudja a DM Screen, hogy a 🎁 gomb látszik-e (csak NPC-ből lett játékosnál, 4. döntés). Újra NPC-vé váltva is megmarad.
- **`settings.magic: 'low' | 'std' | 'high'`** (a DM Screen beállítása, `sanitizeState`): a kampány mágiaszintje a DMG 38. o. táblázatához. Alapértelmezés: `'std'`.
- A tárgyak a lap meglévő `inventory`-jába kerülnek (`ref`, `qty`, `equipped`, `container`, `magic`, `rarity`, `note`) – a tárgyformátum **nem** változik. A kibontott csomag tételei `container: 'Explorer's Pack'`, a csomag maga is tétel (tárolóként). A generált tárgy jegyzete: „Generálva: DMG 38. o., 7. szint” – ebből látszik, honnan jött.
- **Firestore-szabály** (6. döntés): a játékos a `newChar.eq.gold`-ot nem írhatja át, ha már van értéke (mint a `rolls`), és a DM beállítását (`newChar.equip`) sem változtathatja meg.

### Közös kód (`sheet.js`, a telefon és a DM Screen is használja)

- `Sheet.seRows(osztály, háttér, rb)` → a választási sorok, feloldva (minden tétel a szabálykönyvi tárgyával, a kategóriák a választható tárgyak listájával, jártasság-jelzéssel: „warhammer (if proficient)” → ⚠, ha nem jártas – mint a feat-előfeltételnél: jelez, de nem tilt).
- `Sheet.seEredmeny(s, rb)` (a `seCsomag` és a `seLeltar` fölött) → a `newChar.eq` szerint a végleges tárgylista + pénz (csomag módban: osztály + háttér + a háttér pénze; arany módban: a kosár + a maradék). A páncél (az első), a pajzs és a fegyverek alapból felszerelve, így az AC és a támadások azonnal számolódnak.
- A kezdőarany kockakifejezése a `Sheet.seRows(…).gold`; a dobás a varázslóban egyszer, rögzítve (mint a 4d6).
- Ami nem oldható fel (ismeretlen ref, `special`): a tárgy szöveges tételként kerül a lapra (ref nélkül); ha döntés kellene hozzá, ✋ teendő.

### Varázsló: új **Felszerelés** lépés (a Varázslatok és az Összegzés közt)

- Fent a mód (ha a DM mindkettőt engedi): **📦 Kezdő felszerelés** vagy **💰 Arany helyett** – egy mondatban a különbség („az aranyért a háttér felszerelését és pénzét sem kapod meg”).
- **Csomag mód:** az osztály sorai egyenként, a PHB szövegével: (a) / (b) gombok; kategóriánál („bármely martial weapon”) legördülő a szabálykönyvből, a jártas fegyverek elöl; ha két darab jár, két legördülő. Alatta a háttér felszerelése (fix, ha van választás, az is) és a pénze. Továbblépni csak minden sor kiválasztása után lehet.
- **Arany mód:** „🎲 Dobok” (egyszer, rögzítve, a DM látja és újradobhatja), utána egyszerű kosár: keresés a nem mágikus tárgyak közt PHB-áron, darabszám, összesen / maradék; a maradék pénzként kerül a lapra. A kosár üresen is hagyható („majd később veszek”).
- **Összegzés:** a felszerelés is látszik (AC, támadások már vele számolva). **Kész**-kor íródik a lap `inventory`-jába és `currency`-jébe (egy írásban a lezárással); a `newChar.eq` a `newChar`-ral együtt törlődik.
- Magasabb szintű sima új karakter (2. igény): ugyanez, 1. szinten; a szintlépés-varázsló utána nem ad felszerelést, és a DMG 38. o. szerinti extra arany / mágikus tárgy sem jár (a felhasználó döntése: új karakter csak a szabály szerinti kezdő felszerelést kapja, generálás nincs).
- 320 px-en is elfér; minden új gomb `LAP_AKCIOK`, a mezők a change-figyelőben és a gombteszt listájában.

### DM Screen: 🎁 **Szinthez illő felszerelés** (generátor)

Új logikai fájl: `js/logika/felszereles.js` (DOM nélkül; a felülete egy ablak a `js/felulet/`-ben). **Csak NPC-ből lett játékos karakternél** (`fromNpc`): magától az átalakításkor kérdez, utána a Könyvtár sorában a 🎁 gombbal bármikor újra indítható. Új (varázslóval készült) karakternél nincs ilyen gomb.

1. **Arany:** a DMG 38. o. táblázat a szintsáv és a `settings.magic` szerint, dobva (1d10 × 25 / × 250).
2. **Mágikus tárgyak:** annyi uncommon / rare / very rare hely, amennyi a táblázat szerint jár. Minden helyre egy véletlen tárgy a szabálykönyvből (`items` + `variants`), **a karakterhez illő** jelöltek közül:
   - fegyver / páncél / pajzs **+N változata** abból, ami a karakternél van, vagy amiben jártas (+1 fegyver és +1 pajzs uncommon, +2 fegyver és +1 páncél rare, +3 fegyver / +2 páncél very rare – a szabálykönyvi `variants` szerint);
   - attunement-feltétel szerint (`requires attunement by a cleric / spellcaster`): csak ha a karakter megfelel;
   - varázslónak varázsló tárgyak (wand, staff, rod, a fókuszai), a többinek nem;
   - a többi wondrous item / ring / cloak bárkinek;
   - **egyszer használatos tárgy nincs** (potion, scroll, ammunition) – a táblázat tartós felszerelésről szól;
   - nem ismétlődik, és legfeljebb 3 attunement (a többinél a jelölt kimarad).
   Súlyozás: kb. fele eséllyel a karakter saját fegyveréből / páncéljából, a többi a megfelelő tárgyak közül egyenletesen (a 2. kérdés alternatívája: a DMG F/G/H kincstáblái, amelyek már a `loot.js`-ben vannak).
3. **„Normál kezdő felszerelés”** (a DMG szerint ez is jár): mindig az osztály (és ha van, a háttér) kezdő felszerelése is, **duplázás nélkül** – ami már megvan, az kimarad: páncél, ha már visel; pajzs, ha már van; ugyanaz a fegyver. Az (a) / (b) közül véletlenül, a kategóriánál a jártas fegyverek közül; az ablakban tételenként átírható és kihagyható.
4. **Előnézet ablak:** minden tétel egy sor 🎲 (újradob: másik tárgy ugyanabból a ritkaságból) és ✕ (kihagy) gombbal, az arany is újradobható; **Hozzáadás a lapjához** – a tárgyak a lap `inventory`-jába (ha van lapja), különben a könyvtári lény `inventory`-jába; a szinkron (`LINK`) a kettőt amúgy is egyben tartja. Napló: „🎁 Név: 2 tárgy + 742 gp (DMG 38. o., 7. szint, normál mágia)”.

### NPC → játékos karakter

A mai működés (`docs/mukodes.md`, „Játékos ↔ NPC”): a szerkesztő Típus mezőjével váltható; a 📱 gomb a könyvtári lényből lapot csinál (`creatureToSheet`, `inventory` és `currency` is átmegy; ha a szabálykönyv ismeri az osztályt, rögtön szabálymotoros). Ehhez jön:

1. **A statblock felszerelése tárgy lesz:** a lény támadásaiból (Longsword, Light Crossbow…) és az AC-megjegyzésből („chain mail, shield”) – a `loot.js` `gearOf`-ja már kigyűjti – tétel a szabálykönyvi reffel, felszerelve, ha még nincs ilyen az `inventory`-ban. Ami nem azonosítható, kimarad (a napló felsorolja).
2. **Rákérdezés átalakításkor:** amikor a szerkesztőben NPC-ről Játékosra vált (mentéskor; ekkor kap `fromNpc`-t), a DM Screen megkérdezi: „🎁 Generáljak szinthez illő felszerelést (Név, 7. szint)?” – ha a karakternek már vannak tárgyai: „Már van 6 tárgya (Longsword, Chain Mail, …). Generáljak még?” **Igen** → a generátor előnézet-ablaka; **Nem** → semmi. Később a 🎁 gombbal bármikor pótolható.
3. **Szint és osztály:** a lény típusából / szintjéből (`lenyOsztalyok`, `pcLevel`); ha nincs osztálya (pl. „Bandit Captain”), a generátor osztály nélkül, általános tárgyakkal dolgozik, és szól, hogy osztály nélkül nem tud célzottan választani.
4. **Újra NPC:** a tárgyak megmaradnak – ez ma is így van (a lap és a könyvtári lény `inventory`-ja egyben marad, a lap adatai NPC-vé váltáskor nem változnak); teszt biztosítja. Újra Játékosra váltva a kérdés megint jön, de a „már van X tárgya” változatban.

### Véletlen build (4. igény – javaslat: külön terv, később)

Egy-egy **🎲 Véletlen** gomb a varázsló választó-lépésein (faj, osztály, háttér, a választások, a varázslatok, a felszerelés), és a DM-nek egy „🎲 Véletlen karakter” indítás, amely a kezdőszintig mindent kitölt (a standard array az osztály fő képességei szerint rendezve, a szintlépéseknél ASI a fő képességre, a varázslatok a listáról). A motor a választási helyeket már megadja (`Sheet.ncPlan`, szintlépés), tehát főleg a „mit érdemes választani” szabályai kellenek – ez önálló, nagyobb munka; a felszerelés után, külön tervvel javaslom.

## Lépések (mindegyik után működő, tesztelt, élesíthető állapot)

1. **Adat:** szabálykönyv v4 (`classes[].se`, `backgrounds[].se`, csomagok `pk`, a kategóriákhoz szükséges tárgymezők), `Sheet.seRows`, `Sheet.seHiany`, `Sheet.seEredmeny`, a `newChar.eq` a `norm`-ban (`SZERZODES.md`, `Sheet.VERSION`, `szabalykonyv` modulszám). Tesztek: kitalált 5e.tools-alakú mintákkal (a / b, kategória, mennyiség, `special`, `containsValue`, Monk 5d4 × 10 nélkül); online teszt: mind a 13 osztály és minden PHB-háttér felszerelése feloldható a szabálykönyvből. Élesítés: szabálykönyv újratöltése (a felületen még nem látszik semmi).
2. **Varázsló – csomag mód:** a Felszerelés lépés, a DM beállítása (`equip`) az Új játékos űrlapon, összegzés, írás készkor. Tesztek: Fighter (a) chain mail → AC 16; (b) leather + longbow → AC 11 + DEX; „két martial weapon” két legördülővel; Cleric warhammer jártasság nélkül ⚠; Acolyte 15 gp a lapon; Explorer's Pack kibontva tárolóba; v3-as szabálykönyvvel a lépés kimarad; 320 px.
3. **Varázsló – arany mód és kosár:** egyszeri, rögzített dobás (újratöltés után ugyanaz; a DM újradobhat), kosár PHB-árakkal, maradék pénzként; ha a 6. kérdésre igen, `firestore.rules` (a felhasználó másolja a konzolba). Tesztek: Monk 5d4, Fighter 5d4 × 10; a kosár nem mehet a keret fölé; a háttér pénze arany módban nem jár.
4. **🎁 Generátor (DM Screen):** `js/logika/felszereles.js` + ablak, `settings.magic` a Beállításokban, `fromNpc` a `normCreature`-ben, 🎁 gomb a Könyvtárban (csak `fromNpc`-s játékosnál). Tesztek (`stubRnd`): a 🎁 nem látszik varázslóval készült játékosnál; 1–4. szinten nincs mágikus tárgy; a kezdő felszerelésből a már meglévő páncél / fegyver kimarad; 7. szint normál → 1 uncommon + 500–750 gp; 17. szint magas → 3 uncommon, 2 rare, 1 very rare; Fighter longsworddal → a +1 Longsword jelölt; wizard tárgy nem kerül Fighternek; nincs potion / scroll; legfeljebb 3 attunement; ✕ és 🎲 az előnézetben; írás lapra és lap nélküli lénybe.
5. **NPC → játékos:** statblock-felszerelés tárgyakká, rákérdezés a Típus váltásakor (üres / már van tárgya változat), osztály nélküli NPC. Tesztek: Veteran-szerű NPC (Longsword, Shortsword, Heavy Crossbow, splint) → 4 tétel, felszerelve, AC egyezik; újra NPC → a tárgyak megvannak; a kérdés szövege tárgyakkal és nélkülük.
6. **Lezárás:** robot-teszt (minden PHB-osztály × néhány háttér a varázslóban, mindkét móddal, elakadás nélkül), `docs/mukodes.md`, `CLAUDE.md` állapot, README; élesítés. A felhasználó teendői kattintásonként: szabálykönyv újratöltése, (ha kell) `firestore.rules` a konzolba, a mágiaszint beállítása.

## Kockázatok

- **Az 5e.tools adatának kivételei:** nem minden tétel ref (pl. `special`), és a PHB szövege néha feltételt tartalmaz („if proficient”), ami a `defaultData`-ban nincs – ezért a ⚠ jelzés a jártasságból jön, nem a szövegből. Online teszt figyeli, hogy minden feloldható-e.
- **Felszerelve alapból:** két páncél (pl. a statblockból és a csomagból) → csak az első kerül fel; a pajzs csak akkor, ha a fegyverválasztás engedi (kétkezes fegyver mellett nem – csak jelzés).
- **A generált tárgyak minősége:** a véletlen tárgy néha furcsa lesz – ezért egyesével újradobható és kihagyható, és a DM hagyja jóvá; semmi sem íródik a lapra jóváhagyás nélkül.
- **Méret:** a csomagok kibontása 10–15 tételt jelent – a lap `inventory`-ja ezt bírja (a varázsló eddig is kézzel ennyit vett fel).

## Döntések (2026-11-09, a felhasználó válaszai)

1. **Kezdő pénz:** a PHB szerint (javaslat). Csomag = osztály + háttér felszerelése + a háttér pénze; arany = az osztály kezdőarany-dobása, ilyenkor se háttér-felszerelés, se háttér-pénz. A DM állítja: csomag / arany / a játékos dönt.
2. **A generált mágikus tárgyak:** DMG 38. o. táblázat + a szabálykönyvből a karakterhez illő tárgy, egyesével újradobható, DM-jóváhagyással (javaslat).
3. **Mágiaszint:** beállítás a DM Screenben, alapból normál, az ablakban karakterenként átírható (javaslat).
4. **Rákérdezés:** NPC → Játékos váltás mentésekor, és a 🎁 gombbal később is – de **a 🎁 gomb csak NPC-ből lett játékosnál** látszik (a felhasználó pontosítása); új karakter semmit nem generál, csak a szabály szerinti kezdő felszerelést kapja, magasabb szinten is.
5. **Normál kezdő felszerelés a generátorban:** csak NPC → játékos átalakításnál, és ott mindig, duplázás nélkül (ami megvan, kimarad).
6. **Az aranydobás védelme a Firestore-szabályban:** igen (javaslat) – a felhasználónak a szabályokat újra be kell másolnia a konzolba (3. lépés).
7. **Véletlen build:** később, külön tervvel (javaslat).

## Az eredeti kérdések (a javasolt lehetőség elöl)

1. **Kezdő pénz:** *Javaslat:* a PHB szerint – csomagnál az osztály + a háttér felszerelése és a háttér pénze (10–15 gp); arany helyett az osztály kezdőarany-dobása, és ilyenkor se a háttér felszerelése, se a pénze. A DM az Új játékos űrlapon állítja: csomag / arany / a játékos dönt (alapértelmezés). *Másik lehetőség:* csak csomag (arany mód nincs); vagy házi szabály: csomag + háttér pénze + az osztály kezdőaranya is.
2. **A generált mágikus tárgyak forrása (NPC → játékos):** *Javaslat:* a DMG 38. o. táblázat adja a darabszámot és a ritkaságot, a tárgy a szabálykönyvből, a karakterhez illő jelöltek közül (saját fegyver / páncél +N változata, osztályhoz illő attunement, varázslónak varázslós tárgy), egyesével újradobható, a DM hagyja jóvá. *Másik:* a DMG F/G/H kincstáblái teljesen véletlenül (néha nem illik a karakterhez); vagy csak arany, a tárgyakat a DM kézzel adja.
3. **A kampány mágiaszintje:** *Javaslat:* egy beállítás a DM Screenben (alacsony / normál / magas), alapból normál, az ablakban karakterenként átírható. *Másik:* mindig normál, beállítás nélkül.
4. **Mikor kérdezzen rá a generálásra:** *Javaslat:* a szerkesztőben NPC → Játékos váltás mentésekor (tárgyakkal: „Már van X tárgya, generáljak még?”), és a 🎁 gombbal bármikor, bármelyik játékosra. *Másik:* csak a 📱 lap létrehozásakor; vagy csak a 🎁 gombbal, magától soha.
5. **„Normál kezdő felszerelés” a generátorban:** *Javaslat:* csak ha a karakternek nincs egy tárgya sem (különben a statblock felszerelése a kezdő felszerelés). *Másik:* mindig hozzáadja (a csomagot, pl. Explorer's Pack, a páncél / fegyver nélkül).
6. **Az aranydobás védelme a Firestore-szabályban** (a játékos ne dobhasson újra az app kijátszásával), mint a 4d6-nál: *Javaslat: igen* – ehhez a szabályokat újra be kell másolni a konzolba. *Másik:* nem (bizalom), szabályfrissítés nélkül.
7. **Véletlen build:** *Javaslat:* a felszerelés után, külön tervvel (🎲 Véletlen gomb lépésenként + DM-nek teljes véletlen karakter). *Másik:* most, ennek a tervnek a részeként; vagy egyáltalán nem.

## Az elkészült változat eltérései a tervtől (2026-11-09)

- A 🎁 ablakban a kezdő felszerelés tételei csak kihagyhatók (✕), átírni nem lehet; a mágiaszint átírása az egész tervet újragenerálja (a korábbi ✕-ek elvesznek).
- A +N változat a saját fegyverből / páncélból jön; ha ilyen nincs, abból, amiben jártas (a variánsok fele eséllyel, a többi tárgy a maradék eséllyel).
- „NPC-ből lett” csak az, akinél a Könyvtár szerkesztőjében NPC → Játékos váltás volt, és előtte nem volt játékos (nincs lapja, gazdája, D&D Beyond-azonosítója), vagy már volt `fromNpc`-je. A harcbeli (csempe ✎) típusváltás nem jelöl.
- Szabálykönyv nélkül a statblock tárgyai sem kerülnek fel; feltöltés után NPC-re, majd vissza Játékosra váltva pótolható (a 🎁 gomb csak a DMG-generátort nyitja).
- Arany módban, ha a játékos már dobott, a csomagra csak a DM válthat vissza (mint a képességdobásnál); a szabály ezt nem védi, csak a dobást és a DM beállítását.

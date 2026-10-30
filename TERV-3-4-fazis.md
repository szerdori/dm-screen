# 3–5. fázis – Szintlépés-varázsló, multiclass, új karakter: terv

*Készült: 2026-10-28. Állapot: **elfogadva 2026-10-28** – a felhasználó mind a 13 nyitott kérdésben a javaslatot választotta (lásd a végén). Ág: `fazis-3-szintlepes` (a `fazis-2-szabalymotor`-ból).*

## Cél

A DM milestone-alapon engedélyezi a szintlépést, a játékos a telefonján egy **varázslóval** lép szintet: osztályt választ (meglévőt vagy újat), HP-t dob vagy átlagot vesz, kitölti az adott szint összes választását, átnézi az összegzést, és ment. Mentés előtt a teljes lap **előzménybe** kerül, így a szintlépés visszavonható.

- **3. fázis:** varázsló a meglévő osztály(ok) szintlépésére, mind a 13 osztályra, előzmény és visszavonás.
- **4. fázis:** új osztály felvétele (multiclass) a feltételek ellenőrzésével és a multiclass-szabályokkal, featek előfeltétellel és saját választásokkal, TCE opcionális feature-ök.
- **5. fázis:** **új karakter létrehozása varázslóval** (a felhasználó kérése, 2026-10-28; már nem opcionális): végigvezet minden részen – alapadatok, faj, osztály, képességek (standard array / kézi / dobott), háttér, varázslatok, **kezdő felszerelés**, összegzés. A DM mindent felülírhat. Ha a karakter magasabb szinten indul, a végén a szintlépés-varázsló fut tovább a célszintig.

A varázsló **nem számol semmit maga**: a 2. fázis motorja (`Sheet.calc`) adja a választási helyeket, a varázsló csak felület fölöttük. A „mi változott” egyszerűen a motor két futásának különbsége (a régi és az egy szinttel bővített felépítés).

## Kiinduló helyzet (felmérés, 2026-10-28)

**Ami kész és erre épül:**
- `Sheet.calc(lap, rb)` → választási helyek (`choices`: kulcs, fajta, darabszám, `from`, `ok`, `done`), teendők, jellemzők, erőforrások, varázslás osztályonként.
- A motor már **multiclass-képes**: `build.levels` sorrendje, mentők csak az első osztályból, a többi osztály `mc.fx` (szűkebb jártasság, kulcs `Osztály:mc:…`), új osztály 1. szintjén nincs max HP, közös slot tábla (`slotsFor`: full / half / third / Artificer felfelé kerekítve, Pact Magic külön), DC és attack osztályonként, osztályszint szerinti erőforrások (`ctx.lvl`).
- Szabálykönyv v2: `classes[].mc.req` (5e.tools `requirements`, pl. `{int: 13}` vagy `{or: [{str: 13, dex: 13}]}`), `cantrips[20]`, `known[20]`, `prep`, `opt` (Invocations / Metamagic / Maneuvers / Fighting Style progresszió), `asi`, `subLvl`; `optfeatures` `lv` és `pact` feltétellel; `spells[].cl` (melyik osztály listáján van).

**Ami hiányzik (és a tervben szerepel):**
1. **A 2. fázis 5–6. lépése:** a telefonon nincs Felépítés-felület, választók, ℹ bontás, ✎ felülírás, Teendők sáv, „Átállítás szabálymotorra”. A varázsló **ugyanazokat a választókat** használná → lásd 1. nyitott kérdés.
2. **Szintlépés-engedély** mező, DM-gomb, a szintszám védelme a szabályokban.
3. **Előzmény** (pillanatkép szintlépés előtt) és visszaállítás.
4. **Varázslatok mint választás:** a lap `spells` tételeinek nincs osztálya (`cls`), a motor a cantrip-/known-számot csak kijelzi, nem kér választást; nincs spellbook.
5. **Osztályonkénti legmagasabb spellszint** (multiclassnál a known / prepared / spellbook spellek szintjét az adott osztály *egyedüli* táblája korlátozza, nem a közös slot tábla).
6. **Multiclass-finomságok a motorban:** Extra Attack nem halmozódik (most nincs is kezelve), Unarmored Defense csak az elsőként megszerzett (most a legjobbat választja), Fighting Style kétszer ugyanaz nem lehet, Expertise ugyanarra a skillre kétszer nem.
7. **Feat-előfeltétel** a szabálykönyvben csak szövegként van (`pre`), géppel nem ellenőrizhető → szabálykönyv v3 (`pq` szerkezetes feltétel).
8. **TCE opcionális feature-ök:** a motor most minden `opt` feature-t kihagy; nincs ki/be kapcsoló és csere-tábla (melyik mit vált ki).

## Fő döntések (javaslat)

1. **Közös választó-modul** (`karakter.html`, `ChoiceUI`): egy választási helyhez (`choice`) egy szerkesztő widget fajtánként (alosztály, ASI/feat, skill, expertise, mentő, nyelv, eszköz, képesség, optional feature, varázslat). A Felépítés-fül és a varázsló is ezt használja → egyszer kell megírni és tesztelni.
2. **A szintlépés a felépítés módosítása:** `build.levels.push({c, hp})` + új `build.ch` / `build.sub` / `build.spells` értékek. Nincs külön „szintlépés-adat”; a varázsló piszkozata egy ideiglenes `build`, amit a végén egyben ír.
3. **Különbség két calc-futásból:** `Sheet.levelUpPlan(lap, rb, osztály)` → `{régi, új, újVálasztások, újJellemzők, hp, varázslat-változások, összegzés}`. Új választás = olyan kulcs, ami a régi futásban nem volt, vagy most nagyobb az `n`-je (pl. több invocation). A régiek közül a nyitottak is megjelennek („korábbról elmaradt”).
4. **Engedély a lapon:** `levelUp: {to: 6, by: 'dm', at: '…', mc: false}` – a DM írja, a játékos a mentéskor törli. Egyszerre +1 szint; többszöri nyomás → a varázsló egymás után többször fut.
5. **Előzmény alkollekcióban:** `sheets/{id}/hist/{időbélyeg}` = a teljes lap pillanatképe + `{reason: 'levelup', from: 5, to: 6}`. Nem a lap dokumentumában, mert a lap a jellemzőszövegekkel már most is nagy (1 MB-os Firestore-korlát). Utolsó 20 marad.
6. **Varázslatok a felépítésben:** `build.spells = {Wizard: {cantrips: [...], book: [...]}, Sorcerer: {cantrips: [...], known: [...]}}` (refek). A motor ebből írja ki a lap `spells` tételeit `auto: true`-val és `cls`-sel; a **felkészítés** (`prepared`) állapot marad a lapon, nem a felépítésben. Választási helyek: `Sorcerer:cantrips`, `Sorcerer:known`, `Wizard:book` (darabszám a szinthez, a meglévő lista halmozódik).
7. **Ellenőrzés kétszer:** a felületen (letiltott opció, magyarázattal) és a motorban (érvénytelen választás nem számít, és teendő lesz) – kézzel írt JSON vagy régi lap se rontsa el a számolást.

## Adatmodell – új mezők

```js
// sheets/{id}
levelUp: {to: 6, by: 'dm', at: '2026-11-02T18:00:00Z', mc: false, tce: null} | null,   // mc: true = a DM elengedte a multiclass-feltételt
build: {
  …,                                    // a 2. fázis mezői változatlanul
  spells: {                             // osztályonként; ref = 'Név|FORRÁS'
    Wizard:   {cantrips: ['Fire Bolt|PHB', …], book: ['Shield|PHB', …]},
    Sorcerer: {cantrips: […], known: […]}
  },
  tce: {'Ranger|Deft Explorer': true}   // 4. fázis: bekapcsolt TCE opcionális feature-ök
},
spells: [{name, level, prepared, always, ref, cls: 'Wizard', auto: true, book: true}, …]   // cls és book új
// sheets/{id}/hist/{ts}: {at, by, reason: 'levelup' | 'manual' | 'restore', from, to, hp: 'avg' | 'roll' | 'manual' | '', sheet: {…teljes lap…}}
```

`Sheet.norm` mindkét új mezőt tisztítja (`levelUp.to` 2–20 egész, refek `CH_KEY`-szerűen), XSS-teszttel.

## A varázsló menete (telefon)

**Indítás:** ha a lapon `levelUp.to > szint`, a név alatt sáv: **„⬆ Szintlépés: 6. szint – Indítás”**. Teljes képernyős lépéssor, felül lépésjelző, alul Vissza / Tovább. Piszkozat `localStorage`-ban (újratöltés, elalvó telefon után folytatható); a dobott HP a piszkozatban rögzül, újratöltéstől nem dobódik újra. Kézi (`auto: false`) lapnál előbb az Átállítás kell – a sáv ezt kínálja.

1. **Osztály** – a meglévő osztályok („Rogue 5 → 6”), 4. fázistól alattuk „Új osztály”: mind a 13, mindegyiknél ✓ vagy a hiány oka („Wizard: INT 13 kell, neked 12”; „Paladin: a Rogue-hoz DEX 13 kell”). Ha a DM elengedte (`levelUp.mc`), figyelmeztetéssel választható.
2. **HP** – három gomb: *Átlag* (d8 → 5), *Dobás* (appbeli kriptográfiai dobás, egyszer), *Kézi*. Alatta a bontás: „+5 (átlag) + 2 (CON) + 1 (Dwarven Toughness) = +8 → max HP 46”. Új osztálynál is a választott érték (1. szint max csak a karakter legelső szintjén).
3. **Választások** – csak ami ezen a szinten nyílik (vagy korábbról nyitott maradt), sorrendben, mert egymásra épülnek:
   alosztály → ASI vagy feat (feat-választásnál a feat saját választásai is itt jönnek) → skill / expertise / nyelv / eszköz → Fighting Style, Invocation, Metamagic, Maneuver, Pact Boon, Infusion (darabszám a class table-ből; **csere**: Warlock invocation, Sorcerer metamagic nem, Battle Master maneuver TCE-ben is szintlépéskor 1 csere) → ✋ nem automatizálható feature-ök (szöveggel, „rendben” pipával).
4. **Varázslatok** (ha az osztály varázsol) – osztályonként:
   - *cantrip:* +n új, a táblából;
   - *known caster* (Bard, Ranger, Sorcerer, Warlock, EK, AT): +n új **és** 1 csere lehetősége (régi → új, a szint szerint választhatóból); EK / AT iskola-megkötése (abjuration/evocation, illetve enchantment/illusion, a 3/8/14/20. szinti szabad kivételekkel);
   - *Wizard:* +2 spell a spellbookba (bármely wizard spell, aminek a szintjéhez van **wizard** slotod);
   - *prepared caster* (Cleric, Druid, Paladin, Artificer, Wizard is): nincs választás, csak tájékoztatás: „mostantól 7 spellt készíthetsz fel, 3. szintűt is”; az új domain/oath spellek automatikusan.
   - A lista szűrése: osztálylista (`cl`), szint ≤ az osztály saját legmagasabb spellszintje, még nincs meg.
5. **Új jellemzők** – a szint új feature-jei szöveggel (összecsukható), az új erőforrások (pl. „Ki: 5 → 6”).
6. **Összegzés** – régi → új: szint, PB, max HP, Hit Dice, képességek, AC, mentők, slotok, spell DC osztályonként, új jellemzők, erőforrások, nyitva maradt teendők. **Mentés**.

**Mentés:** egy írásban (`writeBatch`): pillanatkép a `hist`-be, `build` + újraszámolt mezők (`materialize`) + `levelUp` (a célszint elérésekor `null`, addig marad); `hp.cur` a max HP növekedésével együtt nő, a `used` értékek maradnak, a Hit Dice új kockája szabad. Internet nélkül a mentés nem indul el – a pillanatkép nélküli szintlépés nem visszavonható.

**Visszavonás:** Alapadatok → „Előzmények”: lista (dátum, „5 → 6”). Visszaállításkor a felépítés és a számolt mezők jönnek vissza (`build`, `ov`, `todoDone`, `spells`, `features`, `resources` maximumai), **nem** jön vissza a felszerelés, a pénz, a jegyzet, az állapotok, a jelenlegi HP (a maximumra vágva). A visszaállítás előtt is pillanatkép készül. A szintlépés-engedély visszajön (`levelUp.to`), így újra lehet lépni.

## DM Screen

- **Könyvtár és 👥 Csapat:** játékosonként „⬆ Szintlépés” gomb (csak lappal rendelkezőnél), a csapatnál „⬆ Mindenki”. Állapot a kártyán: „⬆ 6. szintre vár” / „kész”. Visszavonható, amíg a játékos el nem kezdte.
- Opció az engedélyben: „multiclass-feltétel elengedése” (4. fázis).
- A DM a telefonos lapot DM-ként megnyitva minden előzményt lát és bármelyiket visszaállíthatja.
- A harcban lévő példány a szinkron (`applySheet`) révén magától frissül.

## Firestore-szabályok (a felhasználónak a konzolba kell másolnia)

- `sheets/{id}`: a játékos nem írhatja a `levelUp`-ot másra, csak `null`-ra; a `build.levels` hossza nem nőhet `max(régi hossz, régi levelUp.to)` fölé. Így a játékos nem adhat magának szintet, de a régi lapokat (amelyeken `build` sincs) nem érinti.
- 5. fázis: amíg a lapon `newChar` van, a játékos a `build.levels` hosszát legfeljebb 1-re (a kezdőszintig pedig a szintlépés-szabály szerint) állíthatja; a `newChar.rolls`-t és a `newChar.target`-et nem írhatja át, ha már van értéke (a dobás nem ismételhető); a `newChar`-t csak `null`-ra írhatja.
- `sheets/{id}/hist/{h}`: a gazda és a DM olvas és létrehoz; módosítani nem lehet; törölni csak a DM (a 20 fölöttieket a DM Screen takarítja, vagy a telefon a DM-nél).
- Teszt: a meglévő `makeFakeDb` mellé a szabályfeltételek tükre egy tiszta JS-függvényben (a szabályszöveget magát a konzol ellenőrzi).

## Multiclass-szabályok (PHB 2014, 163–165. o.) – mit és hol

| Szabály | Állapot | Teendő |
|---|---|---|
| Feltétel: a jelenlegi **minden** osztályára és az újra is (Fighter: STR **vagy** DEX 13, Monk / Ranger: kettő is) | nincs | `Sheet.mcCheck(lap, rb, osztály)` a `mc.req`-ből; az értékek a számolt képességek, **tárgyak (`abSet`) nélkül** |
| Mentők csak az első osztályból | kész | – |
| Szűkebb jártasság (Bard, Ranger, Rogue: 1 skill) | kész (`Osztály:mc:skills`) | választó a varázslóban |
| Új osztály 1. szint: nincs max HP | kész | – |
| Hit Dice osztályonként | kész | – |
| PB a karakterszintből | kész | – |
| Közös slot tábla, Artificer felfelé, half / third lefelé | kész | tesztek a határesetekre |
| Pact Magic külön, a slotok bármelyik osztály spelljére | kész (külön tábla) | Cast-nál választható slotfajta |
| Spellek osztályonként: known / prepared / cantrip a saját osztályszint szerint, saját képességgel | részben (kijelzés) | `build.spells`, `cls` a lapon, Varázslat fül osztályonkénti blokkokkal |
| Legmagasabb tanulható spellszint az osztály **egyedüli** táblája szerint | nincs | `Sheet.maxSpellLevel(osztály, szint, alosztály)` |
| Extra Attack nem halmozódik (Fighter 11/20 saját) | nincs | `{extraAttack: n}` hatás, a legnagyobb számít; Harc fülön „Támadások / akció: 2” |
| Unarmored Defense: ha már van, nem kapod meg újra | hibás (legjobb) | csak a legelőbb megszerzett (a `levels` sorrendje szerint) |
| Channel Divinity: a hatások összeadódnak, a használat nem | jó (azonos név → a nagyobb) | teszt Cleric 2 / Paladin 3 |
| Fighting Style kétszer ugyanaz nem | nincs | a `from` szűrése a már választottakkal |
| Expertise ugyanarra kétszer nem (Rogue + Bard) | nincs | szűrés az összes expertise-kulcson |
| Cantrip-sebzés a karakterszintből | – | csak a spell szövegében, nem automatizáljuk |

## Lépések (mindegyik után működő, tesztelt állapot)

### 3. fázis

0. **Előfeltétel – 2. fázis 5–6. lépése** *(lásd 1. nyitott kérdés)*: `ChoiceUI` választó-modul, Felépítés + Számolt értékek az Alapadatok fülön, ℹ bontás, ✎ felülírás, Teendők sáv, Átállítás gomb, JSON-import `build`-del. *(Kész 2026-10-28: `Sheet.choiceOptions` / `setChoice` / `toAuto` a `sheet.js`-ben; a telefonon motoros lapnál az Alapadatok fül = Felépítés (faj, háttér, alapértékek, szintek szintenkénti HP-val, minden választási hely saját választóval), Számolt értékek (ℹ bontás, ✎ felülírás, ↺), Teendők sáv és lista (✋ kipipálható), név + saját támadások / erőforrások; kézi lapon „⚙ Átállítás szabálymotorra”. Szintet csak a DM ad (＋ Szint / − Utolsó szint). Egy feat csak egyszer választható. A JSON-import `build`-del, a CLAUDE.md „Funkciók” része és a README még hátravan.)*
1. **Motor-kiegészítés** (`sheet.js`, felület nélkül): `levelUp` és `build.spells` a `norm`-ban; spellválasztási helyek (`cantrips`, `known`, `book`) osztályonként; `maxSpellLevel`; a lap `spells` tételei `cls`-sel; `Sheet.levelUpPlan`. Régi lap spelljeinek osztálya: egyértelmű listánál magától, különben teendő. Tesztek: Rogue 3 → 4 (ASI), Fighter 2 → 3 (alosztály), Wizard 4 → 5 (spellbook +2, 3. szintű), Warlock 2 → 3 (Pact Boon, invocation-csere), Sorcerer 2 → 3 (metamagic, known-csere), Cleric 1 → 2 (Channel Divinity, nincs választás).
2. **Engedély és előzmény:** `levelUp` mező, DM-gomb a Könyvtárban és a Csapatnál, sáv a telefonon, `hist` alkollekció írása / olvasása, `firestore.rules`. Tesztek: a játékos nem tud szintet adni magának (szabálytükör), az engedély mentéskor törlődik, a pillanatkép megvan.
3. **Varázsló-felület:** a 6 lépés a `ChoiceUI`-val, piszkozat, HP-dobás rögzítve, összegzés, mentés. 320 px-en is (teszt). Tesztek a fenti esetekre a felületen át.
4. **Előzmények és visszaállítás** a felületen (játékos / DM jogosultság szerint, lásd 4. nyitott kérdés).
*(A 3. fázis 1–5. lépése kész 2026-10-30, a `claude/fazis-3-szintlepes-varazslo-06749a` ágon. Felfedezett hiba a robot-tesztből: a szabálykönyv az opcionális feature-ök objektum alakú progressziójában (Metamagic, Maneuvers) összeadta a darabszámokat, pedig azok teljes számok, ezért élesítéskor a szabálykönyvet újra kell tölteni.)* – sehol nem akadhat el, nem maradhat érvénytelen választás, a slotok és erőforrások a PHB táblái szerint (kézzel ellenőrzött mintaszinteken). Online teszt a valódi szabálykönyvvel. CLAUDE.md, README, élesítési teendők.
5. **Robot-teszt és lezárás:** mind a 13 osztály 1 → 20 a varázsló logikájával, minden választást az első érvényes opcióval kitöltve – sehol nem akadhat el, nem maradhat érvénytelen választás, a slotok és erőforrások a PHB táblái szerint (kézzel ellenőrzött mintaszinteken). Online teszt a valódi szabálykönyvvel. CLAUDE.md, README, élesítési teendők.

### 4. fázis

1. **Multiclass:** „Új osztály” a varázslóban, `Sheet.mcCheck`, DM-elengedés, a táblázat „nincs / hibás” sorai a motorban. Tesztek: Fighter 5 / Barbarian 1 (Extra Attack 1, Unarmored Defense nem jön, ha páncélos – és csak a Barbarianéból), Monk 2 / Barbarian 1 (csak a Monk UD-ja), Paladin 2 / Sorcerer 3 (caster level 4 → 4/3 slot), Fighter (EK) 3 / Wizard 1 (caster level 2; a wizard spellbook csak 1. szintű), Artificer 3 / Wizard 1 (caster level 3), Warlock 3 / Sorcerer 2 (Pact: 2 db 2. szintű slot, mellette 3 db 1. szintű rendes slot), Cleric 2 / Paladin 3 (Channel Divinity egy erőforrás), Rogue 1 / Bard 3 (Bard multiclass skill, expertise nem ugyanarra), feltétel: Fighter → Wizard INT 12-vel tiltva, Fighter STR 8 / DEX 13 engedve.
2. **Varázslat fül multiclassra:** osztályonkénti blokkok (DC / attack / felkészíthető szám), a spell a saját osztálya képességével dob, Cast-nál slotfajta (rendes / Pact), spellbook külön a Wizardnál.
3. **Featek:** szabálykönyv v3 (`RB_FORMAT = 3`): `feats[].pq` szerkezetes feltétel (képesség, faj, varázsolni tud, páncél-jártasság, szint); a feat-választóban ✓ / hiány oka. Featek saját választásai: Resilient (képesség + mentő – kész), Skilled (3 skill / eszköz), Magic Initiate (osztály + 2 cantrip + 1 spell), Ritual Caster, Spell Sniper, Elemental Adept, Weapon Master, Martial Adept (maneuver), TCE: Fey Touched, Shadow Touched, Skill Expert, Telekinetic, Telepathic, Artificer Initiate, Eldritch Adept, Fighting Initiate, Metamagic Adept. A szabálykönyv újraépítése után a telefonok maguktól frissítenek (verzió).
4. **TCE opcionális feature-ök** (lásd 5. nyitott kérdés): kézi csere-tábla `TCE_REPLACES` (pl. Ranger: Deft Explorer ↔ Natural Explorer, Favored Foe ↔ Favored Enemy, Primal Awareness ↔ Primeval Awareness; Cleric: Harness Divine Power, Blessed Strikes ↔ Divine Strike / Potent Spellcasting…), `build.tce` kapcsolók, a varázslóban az adott szinten „Elfogadod a TCE változatot?”; ASI-szinti TCE-cserék (Fighting Style, cantrip, maneuver, metamagic csere) mint választható csere-lépés. Ellenőrizni: a `spells[].cl` tartalmazza-e a TCE bővített osztálylistáit külön jelölés nélkül – ha igen, az is a kapcsolóhoz kötődik.
5. **Lezárás:** robot-teszt multiclass-kombinációkkal, online teszt, CLAUDE.md, élesítés (szabálykönyv újratöltése a v3 miatt).

### 5. fázis – Új karakter varázslóval

**Ki indítja:** a lapot most csak a DM hozhatja létre (szabály), és a lap azonosítója a könyvtári lényé. Ezért a DM Screenben: Könyvtár / 👥 Csapat → **„➕ Új karakter játékosnak”** → gazda e-mailje (+ opcionálisan név, kezdőszint, engedélyezett képesség-módszerek, kezdő felszerelés vagy arany) → létrejön a könyvtári játékos és egy üres, motoros lap `newChar`-ral. A játékos telefonján a lap helyén a **„✨ Karakter létrehozása”** varázsló indul. A DM maga is végigmehet rajta (pl. a játékossal együtt, a saját gépén).

```js
// sheets/{id} – amíg a karakter készül
newChar: {
  step: 'race',                         // hol tart (a piszkozat a lapon van, nem csak a telefonon: a DM is látja, és másik eszközön is folytatható)
  target: 3,                            // kezdőszint (1–20); 1 fölött a végén a szintlépés-varázsló fut
  methods: ['array', 'manual', 'roll'], // a DM által engedélyezett képesség-módszerek
  rolls: [[6, 5, 3, 1], …] | null,      // dobott módszernél a 6 × 4d6, egyszer dobva, rögzítve (a DM látja)
  reroll: false,                        // a DM újradobást engedélyezett
  equip: 'pack' | 'gold' | 'any',       // kezdő felszerelés: csomag, arany vagy a játékos dönti el
  by: 'dm', at: '…'
} | null
```

**A varázsló lépései** (mindegyik a közös `ChoiceUI`-val; vissza lehet lépni, a későbbi lépések az előzők változására frissülnek):

1. **Alapok:** név, portré (link vagy kép), alignment, opcionálisan kor / megjelenés a jegyzetbe.
2. **Faj:** faj → alfaj (PHB; TCE Custom Lineage), a faj jellemzői szöveggel; választások (Half-Elf +1/+1 és 2 skill, Variant Human feat + skill, nyelvek, Draconic Ancestry ✋, High Elf cantrip). **TCE Customizing Your Origin**: a faji képességbónusz áthelyezése (`build.origin`), a nyelvek és a jártasságok cseréje (a PHB-fajoknál), kapcsolóval.
3. **Osztály:** a 13 osztály rövid leírással (hit die, fő képesség, mentők, páncél / fegyver); az 1. szint választásai: skillek, Fighting Style, Expertise (Rogue), alosztály, ha 1. szinten jár (Cleric, Sorcerer, Warlock), Favored Enemy / Natural Explorer ✋ stb.
4. **Képességek** – a DM által engedélyezett módszerek közül:
   - *Standard array* (15, 14, 13, 12, 10, 8) – mindegyik érték pontosan egyszer, legördülővel vagy húzással;
   - *Dobott* – 6 × 4d6, a legkisebb kocka elhagyva, appbeli kriptográfiai dobás **egyszer**, az eredmény a `newChar.rolls`-ba íródik, mielőtt megjelenne (újratöltéstől nem dobódik újra); a hat értéket a játékos rendeli a képességekhez. Újradobás csak DM-engedéllyel;
   - *Kézi* – 3–18 közötti értékek (pl. asztali kockához vagy DM által adott értékek).
   Mellette élőben: faji bónusz, végső érték, módosító, és jelzés, ha a választott osztály fő képessége alacsony (csak tájékoztatás). A DM bármikor felülírhatja az alapértékeket (a DM Screenben és a lapon is), és ezt az összegzés jelzi.
5. **Háttér:** PHB háttér (vagy saját: két skill + két nyelv / eszköz, PHB 125. o. „Customizing a Background”) → skill-, nyelv-, eszköz-választás, a háttér feature-je szöveggel; ha egy skill már megvan a fajtól / osztálytól, **másikat választhat** (PHB-szabály, a választó ezt kezeli). Opcionálisan személyiségjegyek, ideál, kötődés, hiba (a háttér táblájából dobva vagy választva, vagy saját szöveg) → a Jegyzetbe.
6. **Varázslatok** (ha az osztály 1. szinten varázsol): cantripek, known spellek, Wizard: 6 spell a spellbookba; prepared castereknél tájékoztatás a felkészíthető számról. Faji cantrip (High Elf) és a Magic Initiate (Variant Human) is itt.
7. **Kezdő felszerelés** (a DM beállítása szerint):
   - *Csomag:* az osztály (a) / (b) választásai (pl. „chain mail **vagy** leather armor + longbow + 20 arrows”, „bármely martial weapon” → fegyverválasztó a szabálykönyvből) + a háttér felszerelése és pénze; a csomagok (Explorer's Pack…) tartalma kibontva vagy egy tételként (lásd 10. nyitott kérdés). Minden tétel `ref`-fel a szabálykönyvből, a páncél / fegyver / pajzs alapból felszerelve, így az AC és a támadások azonnal számolódnak.
   - *Arany:* az osztály kezdőarany-dobása (pl. Fighter 5d4 × 10 gp), egyszer dobva, rögzítve; vásárlás a tárgylistából a PHB-árakon (egyszerű kosár: összeg, maradék), vagy csak a pénz kerül a lapra, és a vásárlás később.
   - Magasabb szintű kezdésnél a DMG 2014 38. o. szerinti extra arany / mágikus tárgy a DM dolga (kézi).
8. **HP:** 1. szinten a hit die maximuma + CON (magától, nincs választás); kiírva.
9. **Összegzés:** a teljes lap előnézete (AC, HP, mentők, skillek, támadások, spellek, felszerelés, nyitott ✋ teendők). **Létrehozás** → a `newChar` törlődik, pillanatkép az előzménybe, a lap kész. Ha `target > 1`: „Tovább a 2. szintre” – a 3. fázis varázslója fut annyiszor, ahány szint hiányzik (multiclass is választható, a 4. fázis szabályai szerint).

**A DM felülírási lehetőségei:** a varázsló bármely lépésében és utána is a DM (a DM Screen szerkesztőjéből vagy a lapon DM-ként) átírhatja az alapértékeket, a dobásokat (újradobás engedélyezése), a HP-t, a felszerelést; a motor szerinti felülírás (`ov`) itt is működik, ✎ jellel. A DM a félkész karaktert is látja (`newChar.step`).

**Szabálykönyv-bővítés (v3, a 4. fázis featjeivel együtt):** `classes[].se` (kezdő felszerelés: választási csoportok, tételrefek, „bármely X fegyver” kategória, kezdőarany-kocka), `backgrounds[].se` (tételek, pénz), `backgrounds[].ch` (személyiség-táblák rövid szöveggel – ha a privát szabálykönyvbe fér), tárgyaknál a `pack` tartalom már megvan. Az 5e.tools mezői: `startingEquipment.defaultData` (`{a: [...], b: [...]}` / `{_: [...]}`, tétel: `'chain mail|phb'`, `{item, quantity}`, `{equipmentType: 'weaponMartial'}`, `{value: 1500}` = réz), `goldAlternative` – a pontos alakot az építéskor kell ellenőrizni.

**Lépések:**
1. **Adat:** szabálykönyv v3 kezdő felszereléssel; `Sheet.startingEquipment(osztály, háttér, választások, rb)` → tárgylista + pénz; `newChar` a `norm`-ban. Tesztek kitalált 5e.tools-alakú mintákkal + online teszt (mind a 13 osztály és 13 PHB-háttér felszerelése feloldható a szabálykönyvből).
2. **DM-oldal:** „➕ Új karakter játékosnak” párbeszéd, üres motoros lap `newChar`-ral, félkész állapot a kártyán, felülírások.
3. **Varázsló 1–6. lépés** (alapok, faj, osztály, képességek mindhárom módszerrel, háttér, varázslatok). Tesztek: standard array csak egyszer minden érték; dobás egyszer, rögzítve, újratöltés után ugyanaz; Half-Elf + Rogue + Criminal (átfedő skill → másik választható); Variant Human + Magic Initiate.
4. **Felszerelés-lépés** (csomag / arany, kosár) és összegzés, létrehozás, folytatás szintlépéssel. Tesztek: Fighter (a) chain mail → AC 16, (b) leather + longbow → AC 11 + DEX; arany-dobás rögzítve; 320 px.
5. **Lezárás:** robot-teszt (minden faj × osztály × háttér egy-egy kombinációja 1. szinten, elakadás nélkül), CLAUDE.md, README, élesítés (szabálykönyv újratöltése, szabályok).

## Kockázatok

- **Választás-láncok:** egy feat választásai csak a feat kiválasztása után derülnek ki → a varázsló minden választás után újra futtatja a `calc`-ot, és a lépéslista frissül. Végtelen lánc ellen a meglévő `depth < 2` korlát.
- **Csere (swap) értelmezése:** a halmozódó listában a csere = egy elem lecserélése; az `n` nem nő. A motor nem tudja, „mikor” volt a csere, ezért csak a varázsló engedi (szintenként egyet), a Felépítés-fülön szabad a szerkesztés (DM-bizalom).
- **Régi lapok spelljei** osztály nélkül: magától besorolni csak egyértelmű esetben, a többi teendő.
- **Szabályfrissítés a konzolban** (a felhasználó teendője): amíg nincs bent, a `hist` írása hibát ad → a varázsló ezt felismeri és szól (mint most a `sheetsWarn`).
- **Méret:** a pillanatkép a teljes lap (jellemzőszövegekkel) – 20 db egy alkollekcióban nem gond, a lapot magát nem növeli.

## Döntések (2026-10-28: mind a 13 kérdésben a javaslat lett elfogadva)

1. **A 2. fázis 5–6. lépése:** (a) előbb külön befejezzük a 2. fázist, vagy (b) a 3. fázis 0. lépéseként, közös választó-modullal? *Javaslat: (b)* – ugyanazokat a választókat egyszer írjuk meg.
2. **Szintlépés-engedély:** egyszerre +1 szint (többszöri nyomással több)? *Javaslat: igen.*
3. **Szintszám védelme a Firestore-szabályban** (a játékos ne tudjon magának szintet adni)? *Javaslat: igen* – ehhez a szabályokat újra be kell másolni a konzolba.
4. **Visszavonás joga:** *Javaslat:* a játékos az utolsó szintlépését vonhatja vissza (amíg újabb nincs), a DM bármelyik előzményt visszaállíthatja.
5. **TCE opcionális feature-ök:** (a) mind elérhető, a játékos dönt, (b) a DM kapcsolja be karakterenként vagy feature-önként, (c) kampányszintű be / ki. *Javaslat: (c) + a játékos dönt egyenként, ha be van kapcsolva.*
6. **HP-dobás:** egyszeri, rögzített dobás; a *Kézi* érték is mindenkinek elérhető (pl. asztali kockához), de a DM az előzményben látja, melyiket választották? *Javaslat: igen.*
7. **Multiclass-feltétel elengedése:** a DM az engedélyben felülbírálhatja? *Javaslat: igen.*
8. **Spellcsere a Felépítés-fülön** (szintlépésen kívül): szabadon szerkeszthető (bizalom), vagy csak a varázslóban? *Javaslat: szabadon, a DM látja az előzményben.*

**A 3. fázis kódjának felmérésekor előjött döntések (2026-10-30, mind a javaslat):**

- **Engedély visszavonáskor:** a szabály engedi, hogy a `levelUp` visszajöjjön, ha a szint közben csökken, és az engedély legfeljebb a korábbi szintre szól (különben a játékos a saját visszavonása után nem tudna újra lépni).
- **✎ felülírások szintlépéskor:** az `ov.hpMax` és az `ov.ab:*` annyival mozdul, amennyit a szintlépés a számolt értéken változtat; a többi felülírás marad, az összegzés ✎ jellel mutatja.
- **Régi lapok varázslatai:** betöltéskor egyszer magától besorolódik, ami egyértelmű (`Sheet.adoptSpells`, `build.spells` `null` → objektum); a többi „saját” varázslat marad. A korábbról elmaradt helyek a Teendők közé kerülnek, a szintlépést nem akadályozzák.
- **Magical Secrets, EK/AT:** a választóban annyi listán (iskolán) kívüli varázslat választható, amennyi jár; a 10/14/18. szinti Magical Secrets a Bard known számába beleszámít, a Lore 6. szintije nem (a PHB szerint), ezért az utóbbi 2-vel növeli a helyek számát.
- **Mentés:** a szintlépés és az előzmény egy írásban (`writeBatch`), a mentéshez internet kell; a piszkozat addig a telefonon marad. A varázsló az adott szint választásait kéri kötelezően, és csak ha van miből választani.

**Az 5. fázishoz (új karakter):**

9. **Point buy** (27 pont, PHB 13. o.) is legyen a három módszer mellett? *Javaslat: igen, a DM kapcsolhatja ki-be, mint a többit.*
10. **Kezdő felszerelés csomagjai** (Explorer's Pack stb.): kibontva a tartalmukra (külön tételek egy „Explorer's Pack” tárolóban), vagy egy tételként? *Javaslat: kibontva, tárolóba téve* – így a kötél, a fáklya stb. egyenként fogyhat.
11. **Arany helyett vásárlás:** kosár a PHB-árakkal már a varázslóban, vagy csak a pénz kerül a lapra, és a játékos utána veszi fel a tárgyakat? *Javaslat: kosár a varázslóban.*
12. **Ki hozhat létre karaktert:** csak a DM indíthatja (játékosnak szánt üres lappal), vagy a játékos is kezdeményezhet (a DM jóváhagyásával)? *Javaslat: csak a DM indítja* – így a szabályokat nem kell lazítani.
13. **Sorrend:** az 5. fázis a 4. után jöjjön (a featekre és a multiclassra épít), vagy előrébb, a 3. után (új karakter 1. szinten, feat nélkül is használható)? *Javaslat: a 4. után*, mert a Variant Human featje és a magasabb szintű kezdés multiclass-a ott lesz kész.

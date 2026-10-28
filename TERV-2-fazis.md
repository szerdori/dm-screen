# 2. fázis – Szabálymotor: terv

*Készült: 2026-10-28. Állapot: a nyitott kérdések eldőltek (lásd a végén); a terv jóváhagyásra vár.*

## Cél

Az 1. fázis végén a karakterlap minden értéket **kézzel** tárol: AC, max HP, mentő- és skill-jártasság, slotok, erőforrások, jellemzők. A 2. fázisban a lap a **választásokat** tárolja: faj, háttér, osztályszintek sorrendben, alosztály, ASI/feat, skillválasztás, Fighting Style… Ezekből és a felszerelésből a program **kiszámolja** az értékeket. Minden számolt érték **kézzel felülírható**, és látszik, miből jön (pl. „AC 16 = 10 + DEX 3 + CON 3”). A DM saját fajt, featet, tárgyat, spellt, alosztályt vihet fel (**homebrew**), ugyanabban a formátumban, mint a hivatalos adat.

A 3. fázis szintlépés-varázslója erre épül: a varázsló csak egy kényelmes felület a 2. fázis „nyitott választásai” fölött.

**Nem része a 2. fázisnak:** szintlépés-varázsló (3.), multiclass-feltétel ellenőrzése és a TCE opcionális feature-ök választója (4.), karakter nulláról (5.). A motor viszont már most multiclass-képes (a lapon lévő multiclass karaktert helyesen számolja), mert a mostani karakterek között is lehet ilyen.

## Kiinduló helyzet (felmérés)

- `sheet.js`: `norm()` (tisztítás), egyszerű számolások (`pb`, `saveBonus`, `skillBonus`, `initiative`, `spellDc`, `slotsFor`, `hitDice`), pihenők, szabálykönyv-darabolás (`RB_FORMAT = 1`, fajták: spells, items, baseItems, variants, feats, conditions).
- `index.html` → `buildRulebook()`: az 5e.tools tükörből letölt, szűr, saját rövid formátumra alakít (`n`, `s`, `tx`…).
- `karakter.html` → Alapadatok fül: minden érték egy szabad űrlapban, piszkozattal.
- DM ↔ lap szinkron (`LINK`): név, portré, gazda, **ac, hp.max, hp.cur, speed, abilities**, felszerelés, pénz. A DM-oldali módosítás a lap mezőjébe íródik.
- Az 5e.tools adatai (ellenőrizve a tükrön):
  - **Géppel olvasható:** fajoknál `ability` (választással is: `choose`), `speed`, `darkvision`, `resist`, `skillProficiencies`, `languageProficiencies`, `weaponProficiencies`, a Variant Human `feats`. Háttereknél skill- és nyelvjártasság. Osztályoknál `hd`, `proficiency` (mentők), `startingProficiencies`, `multiclassing` (feltétel és szűkebb jártasság), `classTableGroups` (pl. Sneak Attack, Rage, Ki oszlop), `casterProgression`, `spellcastingAbility`, `cantripProgression`, `spellsKnownProgression`, `preparedSpells`, `additionalSpells` (domain/oath spellek). Featek `ability` mezője. Tárgyaknál `bonusAc`, `bonusWeapon`, `bonusSavingThrow`, `ability` (pl. Gauntlets of Ogre Power).
  - **Csak szöveg:** az osztály- és alosztály-feature-ök hatása (Unarmored Defense, Expertise, Jack of All Trades, Aura of Protection…). Ezekhez **saját, kézzel írt hatástábla** kell (lásd lent).
  - Buktató: az alosztályok kétszer szerepelnek (2014-es és 2024-es osztályhoz kötve), ezért `classSource` szerint is szűrni kell (PHB, illetve TCE az Artificernél). **Csak a 2014-es kell, a 2024-es nem** (a felhasználó megerősítette).

## Fő döntések (javaslat)

1. **A motor egy tiszta függvény a `sheet.js`-ben:** `Sheet.calc(lap, szabálykönyv) → {értékek, források, választási helyek, teendők}`. Mindkét app ugyanazt használja, és jól tesztelhető.
2. **A számolt értékek a lapra is kiíródnak** (`ac`, `hp.max`, `abilities`, `saveProf`, `skillProf`, `speed`, `classes`, `spellcasting.slots`, erőforrás-maximumok). Ezek gyorsítótárként szolgálnak. Ennek előnyei:
   - a DM Screen, a `characters` nyilvános rész és a harc **változatlan kóddal** működik tovább, szabálykönyv nélkül is;
   - a régi (1. fázisú) lapok ugyanúgy működnek.

   Újraszámolás akkor történik, amikor a lap felépítése, a felülírások vagy a felszerelés változik, vagy új szabálykönyv-verzió jön.
3. **Felépítés + felülírás külön a lapon:** `build` (választások), `ov` (kézi felülírások), `auto` (be van-e kapcsolva a motor).
   - Régi lap: `auto: false`, minden úgy marad, mint most.
   - Átállítás laponként, gombbal (lásd „Meglévő karakterek”).
4. **Egységes hatásformátum** („fx”): minden forrásból ugyanilyen hatáslista lesz, és a motor csak ezt érti. A források:
   - faj, alfaj, háttér, feat: a szabálykönyv építésekor a géppel olvasható mezőkből;
   - tárgy: a `bonusAc` és társai;
   - osztály-feature: a kézi hatástáblából;
   - homebrew: közvetlenül ebben a formában.
5. **A választások kulcs-érték párok** (`build.ch`), a kulcs a választás helyét írja le, pl.:
   - `race:ability` (Half-Elf +1/+1),
   - `Rogue:1:skills`, `Rogue:1:expertise`,
   - `Fighter:4:asi` (`{dex: 2}` vagy `{feat: 'Alert|PHB'}`),
   - `Fighter:1:style`.

   A motor felsorolja a **választási helyeket**: kulcs, fajta, darabszám, miből lehet választani, honnan jön. Amelyik nincs kitöltve, az a „Teendők” listába kerül. Ugyanezt a listát használja majd a 3. fázis varázslója.
6. **Szintek sorrendben** (`build.levels`): `[{c: 'Fighter', hp: null}, {c: 'Fighter', hp: 7}, {c: 'Wizard', hp: 4}…]`.
   - A sorrend számít: az első osztály adja a mentőket és a teljes jártasságot, az első szinten max HP jár, a többin a dobott vagy átlag érték.
   - `hp: null` = átlag.
   - A `classes` összesítő (`[{name, subclass, level, hitDie}]`) ebből számolódik, így a meglévő kód változatlan marad.
7. **(Későbbi fázis) Homebrew a Firebase-ben** (`rules/homebrew`, csak a DM írja). Ugyanaz a rövid formátum `s: 'HB'` forrással, a betöltéskor a hivatalos adathoz fűzve. A nyilvános tárolóba nem kerül szabályszöveg.

## Adatmodell

### Lap (`sheets/{id}`) – új mezők

```js
auto: true,                       // false = kézi lap (1. fázis viselkedése)
build: {
  v: 1,
  race: 'Half-Elf|PHB', subrace: '',          // ref = 'Név|FORRÁS'; homebrew: '…|HB'
  background: 'Acolyte|PHB',
  base: {str: 8, dex: 15, con: 14, int: 10, wis: 12, cha: 15},   // alapértékek faji bónusz nélkül
  levels: [{c: 'Rogue', hp: null}, {c: 'Rogue', hp: 6}, {c: 'Rogue', hp: null}],
  sub: {Rogue: 'Thief|PHB'},                  // alosztály osztályonként
  ch: {                                        // választások: kulcs → érték
    'race:ability': ['dex', 'con'], 'race:skills': ['stealth', 'perception'], 'race:lang': ['Halfling'],
    'Rogue:1:skills': ['acrobatics', 'investigation', 'deception', 'sleight-of-hand'],
    'Rogue:1:expertise': ['stealth', 'sleight-of-hand']
  },
  origin: null                                 // TCE Customizing Your Origin: {dex: 2, con: 1} – a faji bónusz áthelyezése
},
ov: {ac: 17, 'hp.max': 31, 'skill.stealth': 2, speed: '35 ft.'},   // kézi felülírások (kulcs → érték)
todoDone: ['Rogue:3:Fast Hands'],             // kipipált „✋ nem automatizálható” teendők
```

A meglévő mezők (`ac`, `hp.max`, `abilities`, `saveProf`, `skillProf`, `classes`, `speed`, `profs`, `senses`, `resist`, `features`, `resources`, `attacks`, `spellcasting`) maradnak. `auto: true` esetén ezek a **számolt eredményt** tárolják, kivéve:

- az **állapotot** (`hp.cur`, `used` értékek, felkészítés), amit a motor nem bánt;
- a **„saját” tételeket** (`features`, `resources`, `attacks`, `src: 'saját'`), amelyeket a motor megtart és a számoltak mellé tesz.

### Hatásformátum (fx) – példák

```js
{ab: {dex: 2}}                 {abChoose: {from: [...], n: 2, amt: 1, key: 'race:ability'}}
{abSet: {str: 19}}             // Gauntlets of Ogre Power: legalább 19
{save: ['dex', 'int']}         {saveAll: 'pb'} (Diamond Soul)   {saveBonus: 'cha', min: 1} (Aura of Protection)
{skill: {stealth: 1}}          {skillChoose: {from: [...]|'any', n: 4, key}}   {expertise: {n: 2, key}}
{jack: true}                   {remarkable: ['str', 'dex', 'con']}  (Remarkable Athlete)
{armor: [...], weapon: [...], tool: [...], lang: [...], langChoose: {n, key}}
{speed: 10}  {speedIf: {v: 10, noArmor: 'heavy'}}  {dv: 60}  {resist: ['poison']}
{hpPerLevel: 1}  (Dwarven Toughness, Tough: 2, Draconic Resilience)
{acBase: {f: 10, add: ['dex', 'con'], noArmor: true, shieldOk: true}}   (Unarmored Defense, Barbarian)
{acBonus: 1, if: 'armored'}  (Defense)        {init: 5} (Alert)   {initAdd: 'half-pb'}
{res: {name: 'Rage', col: 'Rages', reset: 'long'}}   // maximum a class table oszlopából
{res: {name: 'Bardic Inspiration', max: 'mod:cha', min: 1, reset: 'long', resetAt: {5: 'short'}}}
{res: {name: 'Lay on Hands', max: 'lvl*5', reset: 'long'}}
{spells: {always: [...], key}}   {feat: {key}}   {style: {key, from: 'FS:F'}}   {opt: {type: 'EI', n: 'col:Invocations Known', key}}
{todo: 'Válassz tereptípust (Circle of the Land)'}   // ✋ nem automatizálható
```

A motor a hatásokat **forrásmegjelöléssel** gyűjti, így minden értékhez megvan a bontás: „Stealth +9 = DEX 4 + 2×PB (Expertise, Rogue 1)”.

### Kézi hatástábla (`Sheet.FEATURE_FX`)

Osztály- és alosztály-feature-önként (kulcs: `'Név|Osztály|Alosztály'`) egy fx-lista, csak mechanika, szabályszöveg nélkül. A szöveg a privát szabálykönyvből jön. Javasolt kör, a 13 osztály 1–20. szintjén nagyjából 60–80 bejegyzés:

- **Erőforrások:** Rage, Ki, Sorcery Points, Bardic Inspiration, Channel Divinity, Wild Shape, Second Wind, Action Surge, Indomitable, Lay on Hands, Divine Sense, Arcane Recovery, Superiority Dice, Infusions…
- **AC:** Unarmored Defense (Barbarian, Monk), Draconic Resilience, Fighting Style: Defense, Bladesinging (szöveg + teendő).
- **Mentők, próbák:** Jack of All Trades, Remarkable Athlete, Reliable Talent (csak jelzés), Aura of Protection, Diamond Soul, Slippery Mind (WIS mentő), Resilient (feat).
- **Mozgás, érzékek:** Fast Movement, Unarmored Movement, Superior Darkvision.
- **Támadás:** Martial Arts (kockaoszlop + DEX unarmed), Fighting Style: Archery / Dueling, Extra Attack (jelzés, nem halmozódik), Sneak Attack (oszlop kijelzése).
- **Választások:** Expertise (Rogue 1/6, Bard 3/10), Fighting Style, alosztályválasztás szintje, ASI-szintek (Fighter 6/14, Rogue 10 extra), Invocations, Metamagic, Maneuvers, Pact Boon, Magical Secrets (teendő).

Ami a listában nincs, az a feature szövegével megjelenik a Jellemzők között. Ha a feature tipikusan választást kér, a ✋ jelet kapja.

### Szabálykönyv v2 (`RB_FORMAT = 2`)

Új fajták a meglévők mellé:

- `classes`: n, s, hd, saves, prof (armor, weapon, tool, skillChoose), mc (feltétel + szűkebb jártasság), caster, ab, cantrips[20], known[20], prep (képlet), cols (class table oszlopai szintenként), feats (melyik szinten mi jár), subLvl (alosztály szintje), subTitle.
- `subclasses`: n, short, cls, s, caster/ab (third casterek), spells (always prepared / expanded), feats.
- `features`: n, cls, sub, lvl, s, tx (a szöveg külön fajtában, hogy a darabolás jól működjön).
- `races`, `subraces`: n, s, size, speed, fx (ability, darkvision, resist, skill/lang/weapon/tool, feat), traits (név + szöveg).
- `backgrounds`: n, s, fx, feature (név + szöveg).
- `optfeatures`: n, s, type (EI, MV:B, FS:F, MM, AI, PB…), pre, tx.
- A `feats` és az `items` kap `fx`-et (képességnövelés, `bonusAc`…).

Becsült méret: +2–3 MB (főleg a feature-szövegek), összesen kb. 3–4 MB, 8–10 darab. A telefon egyszer tölti le, utána csak a verziót nézi. Az 1-es formátumú szabálykönyvet az új kód is beolvassa: az új fajták ilyenkor üresek, és a motor szól, hogy frissíteni kell.

**Források:** PHB 2014 osztályok és Artificer (TCE); alosztályok PHB/XGE/TCE; fajok PHB + TCE Custom Lineage; hátterek PHB; optional feature-ök PHB/XGE/TCE. A 2024-es (`XPHB`/`XDMG`) és az `edition: 'one'` adatok kiszűrve, mint eddig.

## Mit számol a motor (`Sheet.calc`)

| Érték | Számolás |
|---|---|
| Szint, PB, osztályösszesítő, Hit Dice | `build.levels` |
| Képességértékek | alap + faj/alfaj (vagy az „origin” áthelyezés) + ASI + featek + tárgyak (`abSet`: min. érték); max. 20, kivéve a tárgyakat |
| Mentők | az **első** osztály mentői + Resilient stb. + Aura of Protection (CHA, min. +1) |
| Skillek | jártasság/expertise a választásokból, Jack of All Trades, Remarkable Athlete |
| Jártasság, nyelv, érzékek, ellenállás | összefésülve, duplikáció nélkül |
| Max HP | 1. szint: a hit die maximuma; utána a tárolt dobás vagy az átlag; + CON × szint; + szintenkénti bónuszok |
| Speed | faj + feature-ök (feltétellel: páncél nélkül / nem heavy armor) + featek; heavy armor STR alatt −10 |
| Initiative | DEX + Alert + Jack of All Trades (fél PB) |
| AC | felszerelt páncél (light/medium/heavy, DEX-plafon) vagy unarmored képletek közül a legjobb, + pajzs, + mágikus `bonusAc`, + Defense; Mage Armor és hasonlók: ideiglenes kézi bónusz |
| Varázslás | **osztályonként** DC és attack (multiclassnál eltérő képesség!), közös slot tábla (`slotsFor`), Pact Magic, cantrip-/spell-known-/felkészítési limit kijelzése, a domain/oath spellek automatikusan „mindig felkészítve” |
| Erőforrások | maximum számolva, a `used` állapot név szerint megmarad |
| Támadások | felszerelt fegyverekből: találat = PB (ha jártas) + STR/DEX (finesse: a jobb), + mágikus bónusz, + Archery; sebzés: kocka + módosító (+ Dueling); Monk unarmed; a saját támadások mellé |
| Jellemzők | osztály-, alosztály-, faji, háttér-feature-ök és featek a szintig, szöveggel; a saját jellemzők mellé |
| Választási helyek, teendők | a ki nem töltött választások + ✋ feature-ök, kivéve a kipipáltakat |

**Felülírás:** az `ov` bármelyik számolt kulcsot felülírja. A felületen ✎ jelzi, és a számolt érték is látszik: „17 (számolt: 16)”. Egy koppintással visszaállítható.

## Felület

### Telefon (`karakter.html`)

- **Teendők (n)** sáv a név alatt, ha van nyitott választás vagy ✋ feature. Lenyitva: a lista, mindegyik a megfelelő helyre visz, vagy kipipálható.
- **Alapadatok fül kettéválik** (`auto: true` lapnál):
  - **Felépítés:** faj, alfaj, háttér (keresővel a szabálykönyvből), alapértékek, szintek listája (osztály, HP: átlag/dobott/kézi), alosztály osztályonként, és alatta minden választási hely saját választóval (skill-pipák, képesség-legördülő, feat-kereső, Fighting Style lista…).
  - **Számolt értékek:** minden érték mellett ℹ (bontás) és ✎ (felülírás).
- A Harc, Képességek és Varázslat fülek a számolt értékeket mutatják, mint eddig. A bontás koppintásra jelenik meg.
- `auto: false` lapnál minden a mostani marad, plusz egy „⚙ Átállítás szabálymotorra” gomb.

**Ki szerkesztheti a felépítést?** Lásd a nyitott kérdéseket. Javaslat: a játékos és a DM is, mint most, a szintszámot viszont csak a DM növelheti (milestone; ez a 3. fázisban a varázsló engedélyezése lesz).

### DM Screen (`index.html`)

- **Szabálykönyv-építő v2** (új fajták, fx-kinyerés, `classSource`-szűrés).
- **Szinkron:** ha `auto: true` lapon a DM a könyvtárban AC-t, max HP-t, speedet vagy képességet ír át, az **felülírásként** (`ov`) megy a lapra, különben a következő újraszámolás eltüntetné. A HP, a felszerelés és a pénz marad, ahogy most van.
- **(Későbbi fázis) Homebrew-szerkesztő** (Menü → 📖 Szabálykönyv → Homebrew fül):
  - lista, törlés;
  - **űrlap** featre, tárgyra, spellre (név, szöveg, néhány mező, egyszerű hatások: képesség +1, AC +1, skill-jártasság);
  - **JSON-sablon** fajra, alfajra, háttérre, alosztályra (feature-ökkel). Ezeket Claude is megírhatja a felhasználó leírásából, mint a karakter-JSON-t.
  - Mentés után a `rules/meta` verziója nő, a telefonok újratöltik.
- A Könyvtár → 📱 „lap létrehozása” az új lapnál `auto: true`-t állít, ha van szabálykönyv, és a felépítést a könyvtári adatokból tölti, ameddig tudja.

## Meglévő karakterek

1. **Átállítás gombbal** (laponként): a motor a meglévő lapból kitölti a felépítést, amit felismer: fajnév → ref, osztálynevek és szintek → `levels`, alosztálynév → ref, skill-jártasság → választások. Ezután kiszámol mindent. **Ahol a számolt érték eltér a régitől, ott a régi érték felülírásként megmarad**, így az átállítás után semmi nem változik láthatóan. A ✎ jelek mutatják, hol kell rendet tenni, a Teendők pedig, mi hiányzik.
2. **Vagy Claude-dal:** a felhasználó leírja a karaktert, Claude megírja a `build`-et tartalmazó JSON-t, és az importálás felülírja a felépítést (az állapot, vagyis a HP, a slothasználat és a felszerelés megmarad). A JSON csak a felhasználónál marad, a tárolóba nem kerül.

## Lépések (mindegyik után működő, tesztelt állapot)

1. **Hatásformátum és motor-mag** (`sheet.js`): `norm` az új mezőkre (`build`, `ov`, `auto`, `todoDone`, tisztítással), `Sheet.calc` a szabálykönyv nélkül is számolható részekre (képességek, PB, mentők, skillek, HP, initiative, Hit Dice, slotok), forrásbontással és felülírással. Tesztek kézzel kiszámolt példákkal. *(Kész 2026-10-28: `Sheet.calc`, `Sheet.materialize`, `CLASSES` kiegészítve mentőkkel, alosztály-szinttel, extra ASI-szintekkel; 6 új teszt. A választási kulcsokban ékezetes betű is lehet.)*
2. **Szabálykönyv v2:** `buildRulebook` új fajtái, fx-kinyerés a faj/háttér/feat/tárgy mezőkből, `RB_FORMAT = 2`, visszafelé kompatibilis betöltés. Tesztek **kitalált** 5e.tools-alakú mintákkal (valódi szöveg nélkül), plusz `-Online` teszt a valódi tükörre (darabszámok, méret). *(Kész 2026-10-28: a valódi tükörrel ≈1,8 MB, 13 darab; a SCAG-hivatkozások és a 2024-es alosztálypéldányok kiszűrve; online teszt ellenőrzi.)*
3. **Motor teljes:** faj/háttér/osztály/alosztály/feat/tárgy hatások, AC, speed, támadások, erőforrások, jellemzők, varázslás osztályonként, választási helyek, teendők. **`FEATURE_FX` tábla** a 13 osztályra. Tesztesetek (mind szintetikus karakter):
   - Thief Rogue 3 (expertise, Sneak Attack oszlop);
   - Hill Dwarf Cleric 5 (HP-bónusz, domain spellek, Channel Divinity);
   - Barbarian 5 (Unarmored Defense + pajzs, Rage, Fast Movement heavy armorban nem);
   - Monk 6 (AC, Martial Arts, Ki);
   - Paladin 6 (Aura of Protection);
   - Half-Elf Bard 3 (faji választások, Jack of All Trades, Bardic Inspiration CHA-ból);
   - Fighter 2 / Wizard 3 (mentők az első osztályból, slotok, külön DC);
   - Variant Human + Alert;
   - +1 Chain Mail, Gauntlets of Ogre Power.
   *(Kész 2026-10-28: `FEATURE_FX` ≈70 bejegyzés (osztály, alosztály, faj, feat, optional feature), a motor számolja az AC-t, a speedet, a támadásokat, az erőforrásokat, a jellemzőket, a varázslást osztályonként, a mindig felkészített spelleket, a jártasságokat; a `materialize` a számolt tételeket `auto: true`-val írja, a sajátok maradnak; a `cache` (mentők, skillek, passzívak, spell DC) a régi számoló függvényeknek. Tesztek: Barbarian, Monk, Paladin, Bard, Champion, Ranger, Life Cleric / Wizard kitalált adattal; online: a hatástábla minden kulcsa létezik, és egy valódi Hill Dwarf Life Cleric 5. Megjegyzés: a Mage Armor-szerű ideiglenes AC-bónusz és a Dual Wielder nincs automatizálva – felülírással kezelhető.)*
4. **Számolt értékek kiírása a lapra és szinkron:** a telefon újraszámol és mezőnként ír; a DM Screen `syncSheets` felülírásként küldi a számolt mezők DM-oldali módosítását; a `characters` nyilvános rész változatlan.
5. **Telefonos felület:** Felépítés + Számolt értékek az Alapadatok fülön, választók, ℹ bontás, ✎ felülírás, Teendők sáv, Átállítás gomb.
6. **Átállítás és lezárás:** „Átállítás szabálymotorra” a meglévő lapokra, JSON-import `build`-del, CLAUDE.md és README frissítése, teljes teszt (`teszt.ps1` és `-Online`), élesítési lépések a felhasználónak (szabálykönyv újratöltése, lapok átállítása).

Az 1–3. lépés tisztán logika és teszt (felület nélkül); a 4–5. lépés után használható a telefonon; a 6. lépés zárja a fázist. Feltöltés a felhasználó jóváhagyásával, lépésenként vagy a végén.

*Homebrew (rules/homebrew, DM-szerkesztő űrlappal és JSON-sablonnal) a felhasználó döntése szerint későbbi fázisba kerül. A 2. fázisban csak annyi készül el, hogy a formátum (fx, `s: 'HB'` forrás) homebrew-kész legyen, így később nem kell átalakítani.*

## Kockázatok

- **A szabálykönyv mérete** (3–4 MB): a telefon első letöltése lassabb, utána a gyorsítótárból megy. Ha túl nagy, a feature-szövegek külön, igény szerint betöltött fajtába mehetnek.
- **Az 5e.tools szerkezete változhat:** az `-Online` teszt jelzi.
- **Két igazságforrás** (felépítés és kiírt értékek): a motor determinisztikus, és minden betöltéskor ellenőrizzük, hogy a kiírt értékek egyeznek-e a számolttal; ha nem, újraírjuk.
- **Nem automatizálható feature-ök:** a ✋ jel, a teendőlista és a felülírás kezeli őket, a motor nem találgat.

## A felhasználó döntései (2026-10-28)

1. **Felépítés szerkesztése:** a játékos és a DM is (mint most). A szintszámot csak a DM növeli (milestone).
2. **Meglévő karakterek:** Átállítás gomb (a régi értékek felülírásként megmaradnak) + szükség esetén Claude által írt JSON.
3. **Homebrew:** nem része a 2. fázisnak, későbbre kerül (a formátum homebrew-kész marad).
4. **HP szintenként:** a játékos választja: átlag vagy dobás. A lap szintenként tárolja (`hp: null` = átlag, szám = dobott vagy kézi érték). Az 1. szint mindig maximum.

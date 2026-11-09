# Terv: featek előfeltétellel és saját választásokkal, TCE opcionális feature-ök

*Készült: 2026-11-08. Állapot: elfogadva 2026-11-08 (döntések a végén), folyamatban; kész: 1–4. lépés. Előzmény: `TERV-3-4-fazis.md` 4. fázis 3–5. lépése; a multiclass (1–2. lépés) a felhasználó döntése szerint később.*

## Cél
- Szintlépéskor (ASI helyett) és a Variant Human / új karakter featjénél a választóban **látszik, melyik feat választható** (✓), és melyik nem (az ok: „DEX 13 kell”, „csak Elf”, „varázsolni kell tudni”, „medium armor jártasság kell”).
- A feat **saját választásai** (képesség, skill, varázslat, maneuver stb.) a meglévő választókkal megjelennek, ✋ teendő helyett.
- A **TCE opcionális feature-ök** választhatók: ami kiegészít (pl. Primal Knowledge, Steady Aim), és ami cserél (pl. Ranger: Favored Foe a Favored Enemy helyett).

## Felmérés (5e.tools-tükör, 2026-11-08)
- 72 feat (PHB 42, XGE 15, TCE 15). Feltételfajták: képesség (vagy-lista: Ritual Caster INT 13 **vagy** WIS 13), faj (+ alfaj: Drow High Magic, Wood Elf Magic; „Small race”), varázsolni tud (`spellcasting`, a TCE-ben `spellcasting2020`: a Pact Magic is), jártasság (light / medium / heavy armor, martial weapon).
- A szabálykönyv ma a feltételt csak szövegként tárolja (`feats[].pre`), és a motor nem ellenőrzi.
- Amit a motor ma is tud egy featből: fix képesség / jártasság, képesség-, skill-, nyelv-, eszköz-, mentő-választás, expertise (pl. Resilient, Linguist, Prodigy, Skill Expert, Lightly Armored).
- Ami ma ✋ teendő vagy semmi, és választó lesz:
  - **varázslat-választás** (most „… varázslat választása” teendő): Magic Initiate (osztály + 2 cantrip + 1 első szintű), Ritual Caster (osztály + 2 ritual), Spell Sniper (osztály + 1 támadó cantrip), Fey Touched (1 divination / enchantment), Shadow Touched (1 illusion / necromancy), Artificer Initiate (1 cantrip + 1 első szintű), Wood Elf Magic (1 druid cantrip);
  - **optional feature**: Martial Adept (2 maneuver), Metamagic Adept (2 metamagic), Eldritch Adept (1 invocation), Fighting Initiate (1 fighting style);
  - **egyéb**: Skilled (3 skill vagy eszköz, vegyesen), Weapon Master (4 fegyver), Elemental Adept (sebzéstípus), Artificer Initiate (1 artisan's tool).
- **Erőforrások** featből: Martial Adept 1 superiority die (short rest), Metamagic Adept 2 sorcery point (long rest), a Fey / Shadow Touched, Telepathic, Drow High Magic napi egyszeri ingyen varázslata.
- **TCE osztály-feature-ök:** 13 osztályban 35 db (a listát a szabálykönyv-letöltő már olvassa, `opt: true` jelöléssel, de a motor most kihagyja). Fajtáik:
  - *kiegészítő* (mellé jön): pl. Primal Knowledge, Magical Inspiration, Harness Divine Power, Wild Companion, Steady Aim, Ki-Fueled Attack, Quickened Healing, Focused Aim, Dedicated Weapon, Nature's Veil, Spellcasting Focus, Magical Guidance, Instinctive Pounce;
  - *csere* (helyette jön): Ranger – Deft Explorer ↔ Natural Explorer, Favored Foe ↔ Favored Enemy, Primal Awareness ↔ Primeval Awareness, Primal Companion ↔ Ranger's Companion; Cleric 8. – Blessed Strikes ↔ Divine Strike / Potent Spellcasting;
  - *„Versatility”* (ASI-szinten egy korábbi választás cseréje): Bardic, Cantrip, Martial, Sorcerous, Eldritch Versatility;
  - *bővített választék*: Maneuver Options, Metamagic Options (több maneuver / metamagic a listán).
- **TCE bővített varázslatlisták** (pl. Cleric: Aura of Vitality): a szabálykönyv ma nem tölti le (csak az alap osztálylistákat).

## Lépések (mindegyik után működő, tesztelt, élesíthető állapot)
1. **Szabálykönyv v3 – feat-feltétel szerkezetben** (`RB_FORMAT = 3`, `feats[].pq`: `[{ab: [{dex: 13}], race: [{n, sub?}], cast: true | 'class', prof: ['armor:medium']}]`, részletek: `SZERZODES.md`), a meglévő `pre` szöveg marad. `Sheet.featOk(feat, cr, rb, lap)` → `{ok, hiany: [...]}`. A választóban a nem teljesülő feat neve előtt ⚠, a megjegyzésben az ok; *(kód kész 2026-11-09)* a nem teljesülő is választható (1. döntés). A régi (v2) szabálykönyvvel minden választható, mint most. *Élesítéskor a felhasználó újratölti a szabálykönyvet.*
2. **Feat-választások I. – varázslatok:** a letöltő a `choose` varázslat-feltételt (szint, osztály, iskola, ritual, támadó) `spellChoose`-zá alakítja; osztályt választó featnél (Magic Initiate, Ritual Caster, Spell Sniper) előbb osztály-választás (`pickChoose` + `then`). A választott varázslat a lapra kerül (ingyenes napi egyszerinél erőforrással).
3. **Feat-választások II. – egyéb:** optional feature featből (maneuver, metamagic, invocation, fighting style – a meglévő `opt` választó), Skilled (skill vagy eszköz), Weapon Master (fegyverlista), Elemental Adept (sebzéstípus), artisan's tool; erőforrások a `FEATURE_FX`-ben. Online teszt: minden feat választható és kitölthető, ✋ teendő csak ott marad, ahol tényleg nincs mit számolni. *(kód kész 2026-11-09; a Skilled eszközlistája: a PHB eszközei, `szabalykonyv.js` `PHB_TOOLS`)*
4. **TCE opcionális feature-ök:** kézi tábla `TCE_CSERE` (mi mit cserél), a választás a felépítésben (`build.ch["Osztály:tce:Név"]`), a játékos dönt (2. döntés). A szintlépés-varázslóban az adott szinten: „Elfogadod a TCE változatot?”; a már elhagyott szintekét a Teendők közt, nem kötelezően. A bővített varázslatlista a 3. kérdés szerint. *(kód kész 2026-11-09: a csere- és hatástábla `TCE_CSERE`, `TCE_KOVET`, `TCE_FX` a `sheet.js`-ben, a választás kulcsa `Osztály:tce:Név`; a XGE-listák a `cl`-ben, jelölve)*
5. **Lezárás:** robot-teszt (minden osztály 1 → 20, featekkel és TCE-vel), online teszt a valódi szabálykönyvvel, `docs/mukodes.md`, `SZERZODES.md`, élesítés; a felhasználó: szabálykönyv újratöltése.

## Döntések
A felhasználó döntései (2026-11-08):
1. **Előfeltétel:** bárki választhatja, a választó csak figyelmeztet (⚠ és az ok), nem tilt.
2. **TCE engedély:** mindig elérhető, a játékos dönt egyenként (a szintlépéskor), a DM az előzményben látja. Nincs kampánykapcsoló, nincs Firebase-szabály-változás. (A `TERV-3-4-fazis.md` 5. döntését ez felülírja.)
3. **TCE bővített varázslatlisták:** igen, osztályonként egy TCE-választás része: ha elfogadja, a bővített lista is választható.
4. **Versatility:** nincs külön csere-lépés; jellemzőként megjelenik, a cserét a játékos a Felépítés fülön végzi (ez most is szabad).
5. **XGE-varázslatok az osztálylistákon** (2026-11-09): az 5e.tools a XGE osztálylistáit külön mezőben adja (`classVariant`, XGE), ezért eddig egyik osztály listáján sem voltak. Mindig felkerülnek (nem a TCE-kapcsolóhoz kötve), de a választóban „XGE” jelölést kapnak; a TCE bővített listájáról jövő „TCE” jelölést.

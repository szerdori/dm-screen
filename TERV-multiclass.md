# Terv: multiclass (új osztály szintlépéskor)

*Készült: 2026-11-11. Állapot: **tervezet, elfogadásra vár**. Előzmény: `TERV-3-4-fazis.md` 4. fázis 1–2. lépés és a „Multiclass-szabályok (PHB 2014, 163–165. o.)” táblázat; a featek és a TCE (`TERV-featek-tce.md`) kész, a multiclass akkor szándékosan kimaradt. A felhasználó döntései (2026-11-11) a végén; a régi terv 7. döntését (a DM elengedheti a feltételt) ezek felülírják.*

## Cél
- Szintlépéskor a játékos a meglévő osztályai mellett **új osztályt** is választhat. A varázsló Osztály lépésében mind a 13 osztály látszik; ahol a PHB 163. o. képesség-feltétele nem teljesül, ⚠ jel és az ok („Wizard: INT 13 kell, neked 12”; „a Rogue-hoz DEX 13 kell”), de **választható** marad.
- A **DM engedélye** a mostani ⬆ Szintlépés engedély: külön multiclass-kapcsoló nincs. Ha a játékos a feltétel nélkül vett fel új osztályt, a DM **jelzést kap** (napló + ⚠ az Előzményekben).
- A lap a PHB multiclass-szabályai szerint számol: multiclass-jártasságok, közös spell slot tábla a kombinált caster level szerint, Pact Magic külön, Extra Attack / Unarmored Defense / Channel Divinity nem halmozódik.
- A Varázslat fül, a Harc fül és a DM Screen osztályonként mutatja a varázslást (DC, attack, bekészíthető szám), a Harc fül a támadások számát akciónként.

## Felmérés (a mostani kód, 2026-11-11)
**Ami kész és erre épül:**
- `build.levels` sorrendje a multiclass alapja (`buildClasses`): az első osztályé a mentő és a teljes jártasság, a többié a szabálykönyv `classes[].mc.fx`-e (szűkebb jártasság; Bard / Ranger / Rogue skill-választás `Osztály:mc:…` kulccsal). Új osztály 1. szintjén nincs maximum HP, Hit Dice osztályonként, PB a karakterszintből.
- `slotsFor`: közös slot tábla (full, half és third lefelé, Artificer felfelé; egy osztálynál a saját táblája), Pact Magic külön. `maxSpellLevel` osztályonként (a known / spellbook választás ehhez igazodik). Varázslás osztályonként a `calc`-ban (`casting[]`: DC, attack, cantrip / known / bekészíthető szám).
- A Cast már választhat Pact slotot (`castChoices`).
- Fighting Style kétszer ugyanaz nem választható (`choiceOptions` „opt”: a máshol választott le van tiltva), Expertise ugyanarra kétszer nem (a „már expertise” le van tiltva). Ehhez csak teszt kell.
- A szabálykönyv (v2 óta) hozza a feltételt: `classes[].mc.req` (5e.tools `requirements`, pl. `{int: 13}`, `{str: 13, wis: 13}`, Fighter `{or: [{str: 13, dex: 13}]}`). Szabálykönyv-újratöltés nem kell.
- A varázsló (`js/lap/lap-szintlepes.js`) és a `Sheet.levelUpBuild` / `levelUpPlan` / `levelUpApply` bármely osztályt elfogad a felépítésben; a DM a Felépítés fülön (＋ Szint (DM)) már most is bármelyik osztályból adhat szintet.
- A kezdő varázsló 1. szint fölötti kezdésnél a szintlépés-varázslót futtatja tovább, így a multiclass ott is magától elérhető lesz.

**Ami hiányzik:**
1. `Sheet.mcCheck` (feltétel) – nincs. A képességértékek a **tárgyak (`abSet`, pl. Gauntlets of Ogre Power) nélkül** számítanak.
2. A varázsló Osztály lépése csak a meglévő osztályokat mutatja, és a piszkozat-betöltés (`luLoad`) eldobja az új osztályú piszkozatot.
3. **Unarmored Defense:** most a legjobb képletet választja (Monk 2 / Barbarian 1 → a jobbik); a PHB szerint csak az elsőként megszerzett jár.
4. **Channel Divinity:** a Clericé erőforrás, a Paladiné nincs a `FEATURE_FX`-ben. Az azonos nevű erőforrásból a nagyobb számít (ez a jó szabály), de a Paladin 3 / Cleric 2 páros most Cleric-tábla szerint számol, a csak Paladin pedig nem kap erőforrást.
5. **Extra Attack:** nincs kezelve (csak jellemzőszöveg; két osztálynál kétszer látszik). A „Támadás akciónként” szám sehol nem látszik.
6. A Varázslat fül, a Harc fül „Varázslat” sora és a DM Screen statblokkja egyetlen DC-t / attacket mutat (`cache.spell`: az első varázsló osztályé).

## Lépések (mindegyik után működő, tesztelt, élesíthető állapot)

1. **Motor** (`sheet.js`, felület nélkül; `Sheet.VERSION` +1):
   - `Sheet.mcCheck(lap, rb, osztály)` → `{ok, hiany: ['INT 13 kell, neked 12', 'a Rogue-hoz DEX 13 kell']}`: a meglévő **minden** osztály és az új feltétele, a `mc.req` alakjai (és / vagy) szerint, a számolt képességekből `abSet` nélkül. Meglévő osztálynál mindig `ok`. Ismeretlen osztály (homebrew, nincs `mc.req`) → `ok`.
   - Unarmored Defense: az `acBase` hatás `ud` jelölést kap; ezekből csak a `levels` sorrendjében elsőként megszerzett osztályé számít (a Draconic Resilience és más nem-UD képlet marad a „legjobb” közt).
   - Channel Divinity: `'Paladin|Channel Divinity'` erőforrás (1, short rest) ugyanazzal a névvel; a használatok nem adódnak össze, a nagyobb számít (Cleric 2 / Paladin 3 → 1; Cleric 6 / Paladin 3 → 2).
   - Extra Attack: új hatás `{extraAttack: n}` (Barbarian, Fighter, Monk, Paladin, Ranger 5.: 2; Fighter 11.: 3, 20.: 4; Bladesinger / Valor / Swords alosztályé: 2; Thirsting Blade invocation: 2) – a **legnagyobb** számít, nem adódik össze; a `calc` kimenete `attacksPerAction`.
   - Tesztek (a régi terv listája): Fighter 5 / Barbarian 1 (2 támadás, páncélban nincs UD), Monk 2 / Barbarian 1 (csak a Monk UD-ja), Barbarian 1 / Monk 2 (csak a Barbariané), Paladin 2 / Sorcerer 3 (caster level 4 → 4/3 slot), Fighter (EK) 3 / Wizard 1 (caster level 2; wizard spellbook csak 1. szintű), Artificer 3 / Wizard 1 (caster level 3), Warlock 3 / Sorcerer 2 (2 db 2. szintű Pact slot + 3 db 1. szintű rendes), Cleric 2 / Paladin 3 (egy Channel Divinity), Rogue 1 / Bard 3 (Bard multiclass skill, expertise nem ugyanarra), Fighter 5 / Ranger 5 (2 támadás, nem 3), Fighter 1 / Paladin 2 (a Fighterrel választott Fighting Style a Paladinnál nem választható); feltétel: Fighter → Wizard INT 12-vel ⚠, Fighter STR 8 / DEX 13 → ok, Gauntlets of Ogre Power (STR 19) nem teljesíti a STR 13-at, ha a saját STR 10.

2. **Varázsló: új osztály** (`js/lap/lap-szintlepes.js`, `modul('lap-szintlepes', 2)`):
   - Osztály lépés: felül a meglévő osztályok („Rogue 5 → 6”), alattuk „Új osztály” csoport (összecsukható) mind a 13 osztállyal: ✓ vagy ⚠ + az ok; a ⚠-osra koppintva megerősítő kérdés („A PHB szerint INT 13 kell. A DM látni fogja. Így is felveszed?”). Mellette egy sor: hit die, mit kap multiclassként (páncél / fegyver / skill, `mc.fx`), varázsol-e.
   - A piszkozat (`luLoad`) az új osztályt is megtartja (az utolsó szint osztálya vagy meglévő, vagy a szabálykönyv osztálya).
   - HP lépés: az új osztály kockájával (1. szinten sem maximum, csak a karakter legelső szintjén).
   - Választások: az új osztály 1. szintjének választásai (multiclass skill, Fighting Style, alosztály ha 1. szinten jár…), Varázslatok lépés az új osztály cantripjeivel / known spelljeivel / 6 spellbook-spellel (Wizard).
   - Összegzés: „Új osztály: Wizard 1”, ⚠ a hiányzó feltétellel, a slot tábla régi → új.
   - Mentés: az előzmény bejegyzése `mc: {cls, hiany}` mezőt kap (csak ha nem teljesült). Az Előzmények listájában ⚠ a sor mellett.
   - A DM Felépítés fülének ＋ Szint (DM) gombja ugyanezt a ⚠-t mutatja (nem tilt).
   - Tesztek: új osztály a varázslón át (Fighter 3 → Wizard 1: választások, spellbook 6, HP), piszkozat újratöltés után megmarad, ⚠ megerősítés, `hist.mc` kitöltve; 320 px.

3. **DM-jelzés** (DM Screen, `js/logika/lapszinkron.js`): a lapszinkron, amikor egy lapon új osztály jelenik meg, és az `mcCheck` nem teljesül, naplósort ír: „⚠ Rella: Wizard multiclass – INT 13 kell, neki 12”. Egy lapnál egyszer (a lap + osztály szerint, újratöltés után sem ismétlődik, ha már ott volt). Teszt: a naplósor megjelenik, teljesülő feltételnél nem, második szinkronnál nem ismétlődik.

4. **Varázslat fül és Harc fül osztályonként** (`js/lap/lap-rajz.js`):
   - Varázslat fül: osztályonként egy blokk – fejléc: „Wizard (INT): DC 14 · attack +6 🎲 · bekészíthető 5 / 7”; alatta az osztály varázslatai szintenként; a Wizard spellbookja (bekészítetlen spellek) a blokkban. A közös slotok és a Pact Magic felül, egyszer. Osztály nélküli (saját, faji, feat-) varázslatok külön „Egyéb” blokkban. Egy varázsló osztálynál a mostani nézet marad (nincs fölösleges fejléc).
   - Cast: a slotfajta-választás marad (rendes / Pact); a spell DC-je és attackje a saját osztályáé.
   - Harc fül: a „Varázslat” sor osztályonként; új sor: **„Támadás akciónként: 2”** (ha `attacksPerAction` > 1).
   - Tesztek: Cleric 3 / Wizard 2 két blokk eltérő DC-vel, Warlock / Sorcerer a Pact és a rendes slot, egyosztályú lap változatlan, Fighter 5 „2”.

5. **DM Screen: DC osztályonként** (szerződés-változás, contract-first):
   - `SZERZODES.md` + `Sheet.norm` (`normCache`): `cache.spells: [{cls, ab, dc, atk}]`, `cache.atk: n` (támadás akciónként); a régi `cache.spell` megmarad (az első varázsló osztály), így a régi lap és a régi oldal is működik. `Sheet.VERSION` +1, verzióőr mindenhol.
   - A DM Screen statblokkjában (`lapszinkron.js`, „Varázslatok” jellemző) osztályonként: „Wizard: DC 14, +6 to hit; Cleric: DC 13, +5 to hit”; „Extra Attack: 2 támadás akciónként”.
   - Teszt: szerződés-csoport (tisztítás, XSS), két osztályú lap statblokkja.

6. **Lezárás:** robot-teszt (minden osztály 5. szintig, majd mind a 12 másik osztályból 1–3 szint a varázsló logikájával, első érvényes választásokkal: nem akad el, nem marad érvénytelen választás, a slotok a PHB multiclass-táblája szerint kézzel ellenőrzött mintákon); online teszt a valódi szabálykönyvvel (`.\teszt.ps1 -Online`: minden osztálynak van `mc.req`-je és `mc.fx`-e); `docs/mukodes.md`, `SZERZODES.md`, `CLAUDE.md`, a `TERV-3-4-fazis.md` állapota.
   - **A felhasználó teendője élesítéskor:** nincs Firestore-szabály-változás és nincs szabálykönyv-újratöltés. Szólni a játékosoknak, hogy szintlépéskor új osztály is választható.

## Kockázatok, korlátok
- **A feltételt a Firestore-szabály nem védi** (a szabály nem tud képességet számolni; most is bármely osztály szintje írható a felépítésbe). Mivel a feltétel csak figyelmeztet, ez nem baj: a DM a jelzésből és az Előzményekből látja.
- A `levelUp.mc` mező (régi terv: „a DM elengedte a feltételt”) a szerződésben marad, de nem használjuk (mindig `false`).
- **Későbbre marad** (nem ebben a körben): a ritual casting osztályhoz kötése (ma bármelyik ritual spell rituáléként castolható); a multiclass a kezdő varázsló 1. szintjén (ott egy osztály választható, ahogy a PHB-ben); a homebrew osztály feltétele; a cantrip-sebzés a karakterszintből (csak a spell szövegében).

## Döntések
A felhasználó döntései (2026-11-11):
1. **DM-engedély:** az új osztály mindig választható a mostani ⬆ Szintlépés engedéllyel; nincs külön multiclass-kapcsoló, nincs kampánykapcsoló. (A `TERV-3-4-fazis.md` 7. döntését – „a DM az engedélyben elengedheti a feltételt” – ez felülírja: nincs mit elengedni.)
2. **Ki választ:** a játékos, a varázsló Osztály lépésében, mind a 13 osztály közül.
3. **Feltétel (PHB 163. o.):** csak figyelmeztet (⚠ és az ok, megerősítő kérdés), nem tilt – mint a feat-előfeltételnél.
4. **DM-jelzés:** ha a feltétel nem teljesült, naplósor a DM Screenben és ⚠ az Előzményekben; elengedő kapcsoló nincs.
5. **Meglévő lapok:** jelenleg nincs multiclass karakter, ezért nincs átnézési / migrációs lépés; a motor javításai a jövőbeli multiclassra hatnak.
6. **A körbe bekerül:** a Varázslat fül osztályonkénti blokkjai, a „Támadás akciónként” sor a Harc fülön, a DM Screenben a DC / attack osztályonként. **Későbbre:** ritual osztályhoz kötve.

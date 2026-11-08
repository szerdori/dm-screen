# Terv: flavour text a sebzésdobásokhoz

A felhasználó kérése és döntései (2026-11-08). Cél: minden sebzésdobás mellé a DM Screen naplójában egy rövid, felolvasható leírás arról, hogyan néz ki a találat és a sérülés.

## Döntések
- **Saját, magyar mondatbank** (nem AI): azonnali, ingyenes, offline is működik, tesztelhető. AI-generálás (Claude API) most nem kell: a nyilvános statikus oldalon az API-kulcs látszana, szerver kellene hozzá.
- **Csak dobáskor**: a leírás a dobás pillanatában jön, a célpont nélkül. A HP-hoz mért súlyosság és a halálos csapás szövege (a HP levonásakor) később jöhet, ha kell.
- **Véresség: közepes**, nincs kapcsoló (van vér és seb, de nem részletezi; a kemény túl durva, visszafogni a DM maga is tudja).
- **A játékosok telefonos sebzésdobásai is** kapnak leírást.
- **Mellétalálás** szövege („a kard a pajzson csattan”): később, most nem.
- A célpont **humanoid** (fej, kar, kéz, mellkas, has, láb…).
- Csak a DM Screenen látszik, az Initiative trackeren és a telefonon nem.

## Működés
- **Mi alapján választ:**
  - **sebzéstípus** (a PHB 13 típusa; a támadás szövegéből: „… slashing damage”),
  - **támadásfajta**: közelharci fegyver, távolsági fegyver, spell attack (közel / távol), mentős spell (pl. Fireball – nem egy testrészt ér, hanem az egészet), természetes fegyver (Bite, Claw, Slam…),
  - **súlyosság** a kockák lehetséges tartományához mérve: karcolás (alsó 30%), rendes, súlyos (felső 30%), **krit** (Shift+kattintás / a telefon Krit ×2 gombja).
- A fizikai típusoknál (vágó, szúró, zúzó) a mondat a támadás módjához igazodik (penge, nyílvessző, karom); az energiatípusoknál (tűz, villám, nekrotikus…) a típus a lényeg.
- A testrész a súlyossághoz igazodik (karcolás: kar, comb, lábszár; krit: mellkas, has, oldal). A mondatokban a testrész előre ragozott alakjai cserélődnek („a vállába / a vállán / a vállát”).
- Ugyanaz a mondat nem jön kétszer egymás után (az utolsó néhányat megjegyzi).
- **Megjelenés:** a naplóban a dobássor alatt, dőlt betűvel, 🔄 gombbal (új mondat ugyanarra a dobásra).
- Leírás csak akkor jön, ha van támadó (név) és ismert a típus vagy a fajta: a kézi kockadobás (d6, d20 gomb, saját kifejezés) és a HP-képlet dobása nem kap.
- Több kockás támadásnál (pl. 1d8+3 slashing + 2d6 fire) minden dobás a saját típusa szerint kap mondatot.
- Nem kap leírást a támadás nem sebző kockája (utána „hit points”, „rounds”, „minutes”…, pl. „regains 1d4 hit points”). Mentős varázslatnál nincs krit (a Shift-tel duplázott összeg dönt). A fizikai sebzésű varázslat (pl. Ice Knife) varázslatos mondatot kap, nem fegyverest. A telefonos dobás súlyossága a lap hatásaival (Rage, Hunter's Mark) együtt mérődik.
- **A DM dobása játékos karakterrel és NPC-vel is** (a felhasználó kérése, 2026-11-08): a telefonos lapból jövő karakter támadássora a DM Screenen „… slashing damage” alakot kap (a lapon „1d8+3 slashing”), a sima „Attack: +5 to hit.” sornál a név és a megjegyzés dönt a közelharci / távolsági fajtáról (`lapszinkron.js`, `leiras.js`).
- A krit testrészei között nincs fej és nyak (a „markolatig a nyakába” már túl véres); a fejet a mondatok maguk említik, ahol illik.

## Adat (részletek: `SZERZODES.md`)
- A telefonos dobás (`rolls[]`) két új, nem kötelező mezőt kap: `dt` (sebzéstípus) és `dk` (támadásfajta: `mw` `rw` `ms` `rs` `sv` `sp` `nat` `w`). Csak sebzésdobásnál van; a régi telefonos dobások ezek nélkül leírás nélkül jelennek meg.
- Firestore-szabály nem változik.

## Lépések
1. `js/logika/leiras.js` (új, DOM nélkül): mondatbank, `sebzesLeiras({type, kind, expr, total, crit})`, `tamadasFajta(név, szöveg)`, `sebzesFokozat`, `nemSebzes`; a típus a szövegből: `Sheet.dmgType`.
2. DM Screen: a támadássorok és a statblokk dobásai `data-type` / `data-kind` jelölést kapnak; a `rollDmg` a dobássor alá írja a leírást; 🔄 gomb.
3. Telefon: a sebzésdobás a `dt` / `dk`-t is elküldi (`Sheet.normRoll`, `sheet.js` verzióemelés).
4. Tesztek: minden típus × fajta × súlyosság párosra van mondat, nincs kitöltetlen helyőrző, XSS, ismétlés, telefonos dobás.
5. `docs/mukodes.md`, `SZERZODES.md`, `CLAUDE.md` állapot.

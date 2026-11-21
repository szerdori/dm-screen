# Terv: nagyobb karakterlap a DM Screen oldalpanelén; figyelmeztetés, ha több varázslat van bekészítve / megtanulva, mint amennyi jár

**Állapot: jóváhagyva (2026-11-21), megvalósítás folyamatban.**

A felhasználó kérése (2026-11-21), két pont:
1. A jobb oldali (beágyazott) karakterlap túl kicsi a hatékony használathoz.
2. A lap írja ki, és figyelmeztessen, ha a karakter több varázslatot tanulna be, mint amennyi jár.

A nyitott kérdések a végén, mindegyiknél a javasolt válasz elöl. Minden lépés után `.\teszt.ps1` (fejlesztés közben szűrve), új teszt, `ellenorzes.ps1`, `ellenorzo` ügynök, commit és feltöltés csak jóváhagyással.

---

## 1. A beágyazott lap mérete

### Most (2026-11-21, `index.html`, `js/felulet/harcter.js`)
- Az oldalpanel (`#side`) **440 px** széles (1200 px alatti ablakban 340 px).
- Lap módban felül a harci vezérlők (Init, HP, Temp, AC, állapotválasztó, címkék, nyilvános név, jegyzet, gombok, kapcsoló) legfeljebb a panel **42%-át** foglalják; alul a dobó és a napló fixen **260 px**.
- A lapnak (`#lapNezet`) ami marad: egy 1080 px magas képernyőn kb. 300–350 px magasság, 440 px szélesség. Ebben alig fér el egy fül.

**A felhasználó pontosítása (2026-11-21):** a gombok és a szövegek jó méretűek, a gond a **magasság** – túl rövid a felület, sokat kell görgetni. Ezért a szélesség helyett a függőleges hely a cél: a lap kapja meg a panel szinte teljes magasságát (1080 px-es képernyőn ≈ 750–800 px a mostani ≈ 300–350 helyett), a betű és a gombok mérete nem változik.

### Megoldás (javaslat: B + D; az A csak, ha a teljes magasság sem elég)
**D) Kisebb dobó és napló lap módban** (a felhasználó ötlete, 2026-11-21: „nem kell ott olyan sokat egyszerre látnom”). Lap módban a panel alján lévő dobó + napló a mostani fix 260 px helyett ≈ 120 px: a kockadobó sora és a napló utolsó 3–4 sora (görgethető, a legújabb felül, mint most). Gomb és kapcsoló nem kell hozzá. Statblokk módban és szörnynél a régi 260 px marad. (Ha a gyakorlatban még ez is sok: utána jöhet egy ▸ összecsukás egy sorra – most nem.)

**B) Kompakt harci vezérlők lap módban** – lásd lent; a D-vel együtt ≈ 450 px-szel több hely jut a lapnak (1080 px-es képernyőn ≈ 750–800 px).

**A) ⤢ Nagy lap gomb** (csak, ha a B + D után is kevés). A kapcsoló mellett (📱 Lap / 📜 Statblokk) új gomb. Megnyomva a beágyazott lap **a csempék helyére** kerül, a képernyő teljes magasságában, szélesen (a csempék és a jobb oldali panel közötti teljes terület). Az iframe nem költözik a DOM-ban (az újratöltené), csak a stílusa vált (`position: fixed` a tábla fölött), ezért a lap állapota (nyitott fül, görgetés) megmarad. Visszaállítás: ugyanaz a gomb (**⤡ Kicsinyítés**), vagy az `Esc`. A választás eszközönként megmarad (`Bongeszotar`, új kulcs a `Szerzodes.HELYI`-ben). Másik harcos kiválasztásakor nagy nézetben marad, szörnynél magától visszaáll.
- Nagy nézetben a jobb oldali panel marad: a harci vezérlők, a dobó és a napló látszik, a csempék nem (ezek a ⤡ gombbal vagy egy játékos nélküli harcos kiválasztásával jönnek vissza; lásd 2. kérdés).

**B) Kompakt harci vezérlők lap módban.** A lapon a HP, a temp HP és az állapotok úgyis állíthatók (a szinkron egyezteti), ezért lap módban felül csak egy sor marad: **név · Init · HP ± · AC · 📱/📜 · ⤢**. A többi (állapotválasztó, nyilvános név, rejtett, harci jegyzet, ✎ Szerkesztés, 📚 Mentés) egy lenyitható **▾ Továbbiak** sor alá kerül (nyitva / zárva megmarad). Így a kis nézetben is kb. 150–200 px-szel több hely jut a lapnak.

**C) Húzható panelszélesség** (a pontosítás után valószínűleg nem kell: a szélesség jó): a panel bal szélét egérrel húzva 340 px és az ablak 60%-a között állítható, eszközönként megjegyezve.

**Elvetett / későbbi lehetőségek:**
- **Külön ablak (⧉):** a lap saját böngészőablakban. A második monitoron az Initiative tracker fut, a DM-monitoron pedig egy külön ablak a DM Screent takarná – az A ugyanezt adja, egy gombbal vissza.
- **Kétoszlopos telefonos lap széles nézetben** (pl. a Harc fül mellett a HP és az állapotok): a nagy nézetben jól jönne, de a `karakter.html` minden fülét érinti. Ha az A után is kell, külön terv.

### Érintett fájlok
`index.html` (stílus: kompakt sor, összecsukott napló, nagy nézet), `js/felulet/harcter.js` (`renderDetail`, `lapNezetFrissit` – a hosszú rajzoló bontása itt menet közben megoldható, lásd `CLAUDE.md` „Figyelendő menet közben”), `js/felulet/akciok.js` (▾ Továbbiak, ▸ Napló, ⤢, az `Esc` a meglévő billentyűkezelőben), `szerzodes.js` + `SZERZODES.md` (új `HELYI` kulcs), verziók (`.\verzio.ps1`).

### Tesztek
- ⤢: az iframe ugyanaz az elem marad (nem töltődik újra), a stílusa nagy; ⤡ és `Esc` visszaállítja; a választás megmarad; szörnynél kis nézet.
- Kompakt sor lap módban: Init, HP, AC megvan; a ▾ Továbbiak alatt az állapotválasztó és a jegyzet; statblokk módban a régi elrendezés.
- Lap módban a dobó + napló ≈ 120 px, a kockadobó és a legújabb naplósorok látszanak; statblokk módban és szörnynél a régi 260 px.
- 1280 × 720-as ablakban lap módban (B + D) a lap legalább 520 px magas, 1920 × 1080-ban legalább 720 px (a mérés a teszt iframe-jében).

### Felhasználó teendője
Nincs (szabály- és szabálykönyv-változás nincs). Kipróbálás a DM gépén.

---

## 2. Figyelmeztetés: több varázslat, mint amennyi jár

### Most
- **Bekészítés** (Cleric, Druid, Paladin, Wizard, Artificer): a motoros lap tudja, hány varázslat készíthető be (`cache.spells[].prep`, `Sheet.calc` → `casting[].prepared`). **Multiclassnál** a Varázslat fül osztályfejléce kiírja („bekészítve 5 / 7”), **egy osztálynál nem**: ott csak „Varázslatok (5 bekészítve)”. Ha több van bekészítve, mint amennyi jár, **sehol nincs figyelmeztetés**; a pipa bármennyit enged.
- **Ismert varázslatok és cantripek** (Bard, Sorcerer, Ranger, Warlock, EK, AT; cantrip mindenkinél): a Felépítés és a szintlépés-varázsló választója a darabszámot betartja, de a Varázslat fül keresőjéből (＋) bármennyi felvehető, és erre sincs figyelmeztetés. A lap gyorsítótára ezeket a számokat nem tárolja (`cache.spells` csak `cls, ab, dc, atk, prep`).
- **Kézi lapon** nincs számolt maximum.

### Megoldás
1. **Kiírás:** a Varázslat fülön egy osztálynál is „Varázslatok (bekészítve 5 / 7)”; ismert varázslatú osztálynál „ismert 6 / 6”, és a cantripeknél „cantrip 3 / 4” – multiclassnál osztályonként, a fejlécben.
2. **Figyelmeztetés** (piros ⚠ sor a Varázslat fül tetején és az osztályfejlécben): „⚠ Több varázslat van bekészítve, mint amennyi jár (8 / 7) – vegyél le 1-et.” Ugyanígy az ismert varázslatokra és a cantripekre („a Felépítésben cserélhetsz”).
3. **A pipánál:** ha a bekészítés már betelt, a következő pipa rákérdez: „Már 7 / 7 varázslat van bekészítve. Mégis bekészíted?” (javaslat; lásd 4. kérdés). Ugyanígy a kereső ＋ gombja, ha az ismert varázslatok betelnének.
4. **A DM is látja:** a DM Screen statblokkjának „Varázslatok” sorában „bekészítve 8 / 7 ⚠”, és a Könyvtár / 👥 Csapat jelvényei mellett egy ⚠, ha valamelyik osztálynál túllépés van (javaslat; 5. kérdés).
5. **Mi számít bele:** a „mindig bekészített” (domain, oath, circle) varázslatok nem számítanak bele (PHB 2014); a fajból és featből jövő varázslatok sem (nincs osztályuk, vagy `auto`); multiclassnál a varázslat osztálya (`cls`) szerint. A Wizard spellbookjának nincs felső határa (másolással bővül), ott csak a bekészítést nézzük.

### Szerződés (contract-first, ha az ismert varázslatok is kellenek)
`SZERZODES.md`: `cache.spells[]` új mezői: `known` (ismert varázslatok száma, 0 = nem ismert varázslatú osztály), `cantrips` (cantripek száma). `normCache` tisztítja, a `materialize` írja, teszt a „Szerződés” csoportba, `Sheet.VERSION` emelés. A meglévő lapok a következő megnyitáskor (újraszámoláskor) kapják meg. Firestore-szabály nem változik.

### Érintett fájlok
`SZERZODES.md`, `sheet.js` (`normCache`, `materialize`, új `Sheet.varazslatKeret(s)`: osztályonként {bekészítve, max, ismert, cantrip} és a túllépések), `js/lap/lap-rajz.js` (`varFej`, `tabVar`), `js/lap/lap-akciok.js` (`prep`, `spellAdd`: a kérdés), `js/logika/lapszinkron.js` (statblokk), `js/felulet/konyvtar-ablak.js` / `ablakok.js` (⚠ jelvény), verziók.

### Tesztek
- Cleric 5 (WIS +3): 8 / 8 → nincs ⚠; 9 / 8 → ⚠ és a szöveg; a mindig bekészített nem számít bele.
- Egy osztálynál is kiírja a „bekészítve X / Y”-t; multiclassnál osztályonként.
- A 9. pipa rákérdez, Mégse = nem változik; levétel mindig kérdés nélkül.
- Sorcerer: a keresőből a 7. ismert varázslat ⚠-et ad; cantrip ugyanígy; a faji / feat-varázslat nem számít bele.
- Kézi lapon nincs kiírás és ⚠ (vagy a 6. kérdés szerint).
- DM statblokk és jelvény ⚠-tel; `normCache` a rossz `known` / `cantrips` értéket eldobja.

### Felhasználó teendője
Nincs. (Szólni a játékosoknak, hogy a ⚠ figyelmeztetés új, és mit jelent.)

---

## Javasolt sorrend
1/B + 1/D (a magasság: ez a sürgősebb) → 2 (figyelmeztetés) → 1/A csak, ha kell.

## Nyitott kérdések (a felhasználó dönt; a javasolt válasz elöl)
1. **Oldalpanel (a magasság a gond):** B (kompakt vezérlők) + D (kisebb, ≈ 120 px-es dobó és napló) (javaslat) – vagy ezek mellé az A is (⤢ Nagy lap a csempék helyén, teljes magasságban)?
2. **(Csak ha az A is kell) Nagy nézetben a csempék:** eltűnnek, amíg a nagy nézet nyitva van (javaslat; a ⤡ / `Esc` hozza vissza) – vagy a nagy lap csak a tábla felét foglalja, és a csempék keskenyebben mellette maradnak?
3. **„Többet tanulna be”:** a bekészítésre **és** az ismert varázslatokra / cantripekre is (javaslat) – vagy csak a bekészítésre (ehhez nem kell szerződésváltozás)?
4. **Túllépéskor:** figyelmeztetés + rákérdezés a pipánál (javaslat) – vagy csak a ⚠ sor, kérdés nélkül – vagy tiltás (a pipa nem enged többet)?
5. **A DM is lássa** (statblokk + ⚠ jelvény a Könyvtárban és a Csapatnál) (javaslat: igen) – vagy csak a játékos lapján?
6. **Kézi lap:** nincs kiírás, mert nincs számolt maximum (javaslat) – vagy a PHB képletével (szint + módosító) számoljunk ott is?

## Döntések (a felhasználó, 2026-11-21)
„Mehet a fejlesztés” a javasolt válaszokkal; lépésenként külön commit, a végén feltöltés.
1. Oldalpanel: B (kompakt vezérlők) + D (kisebb, ≈ 120 px-es dobó és napló lap módban). Az A (⤢ Nagy lap) és a C (húzható szélesség) most nem.
2. – (csak az A-hoz tartozott).
3. A figyelmeztetés a bekészítésre és az ismert varázslatokra / cantripekre is.
4. Túllépéskor ⚠ sor + rákérdezés a pipánál / a ＋ gombnál (nem tilt).
5. A DM is látja (statblokk, ⚠ jelvény a Könyvtárban és a Csapatnál).
6. Kézi lapon nincs kiírás.

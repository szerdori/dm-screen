# Gyorsabb teszt és ellenőrző – terv

*Készült: 2026-11-14. Állapot: **elfogadva 2026-11-14** (1–4. lépés és az ellenőrző gyorsítása, 6–8.; az 5. csak ha kell). Az 1–4. és a 6–8. lépés kész (lásd „Mi lett belőle”); az 5. nem készült el, csak ha kell.*

## Mi lett belőle (6–8. lépés, 2026-11-14)

- **6. lépés – `ellenorzes.ps1`** (külön szkript, nem teszt: a `git diff`-et nézi, azt a böngészős tesztek nem látják). Csak olvas, pár másodperc. `HIBA` (kilépési kód 1): ékezetes `.ps1` BOM nélkül; a privát jegyzet tiltott szava bármelyik nyilvános fájlban; tesztcsoportfájl, amit a `tests/index.html` nem tölt be. `FIGYELEM`: e-mail-cím a változásban (a tesztek kitalált címei kivételével); kód változott, de a `tests\` alatt semmi; fix `wait(N)` az új tesztsorokban; változott, de nem emelt modul (a `verzio.ps1 -Ellenoriz` kimenete). Kipróbálva szándékos hibákkal (mind a hét pontot elkapta).
- **Eltérés a tervtől:** a tiltott szavak listája nincs a szkriptben (az nyilvános), hanem a git-ignorált `CLAUDE.local.md` „Tiltott szavak a nyilvános fájlokban:” sorában; ha a fájl vagy a sor hiányzik, a pont kimarad, és a szkript ezt kiírja. Az (e) pont a `tests\` mappát nézi (a `tests.js` azóta csoportfájlokra bomlott). Két pont a terven felül: a fix várakozás és a be nem töltött tesztfájl.
- **A `feltoltes.ps1` is lefuttatja** (az élő változathoz, `origin/main`-hez képest), és `HIBA`-nál nem tölt fel (akkor sem, ha az előellenőrzés nem tudott lefutni); a `FIGYELEM` csak szól. Téves privátszó-találatnál a `CLAUDE.local.md` listáját kell javítani, a `-TesztNelkul` ezt nem kapcsolja ki.
- **7. lépés – szűkebb ügynök:** az `ellenorzo.md` a gépi pontokat nem nézi újra (a hívó átadja a szkript kimenetét), a diffből indul, a `CLAUDE.md`-t nem olvassa végig, a `SZERZODES.md`-ből és a `docs/mukodes.md`-ből csak a változott részt.
- **8. lépés – arányosság:** csak `*.md` változásnál az ügynök nem kell (a szkript utolsó sora megmondja: „Ügynök: KELL / NEM KELL”); több commitból álló lépésnél az ügynök a végén fut egyszer. A szabály a `CLAUDE.md` „Ellenőrzés” pontjában.
- **Nem mértem:** az ügynök futási idejét előtte és utána (nincs összehasonlítható régi mérés).

## Mi lett belőle (1–4. lépés, 2026-11-14)

**A terv első feltevése téves volt.** A régi futtató 147 mp-éből (egymás mellett lemérve) 120 mp nem a tesztekre ment, hanem a futás végén a kis webszerver leállítására: a kérésre váró szerveren a `Stop-Job` pontosan 2 percig vár. A `--virtual-time-budget` nem volt lassú. A javítás: a futtató egy saját kéréssel (`/__leall`) állítja le a szervert, és a Chrome-ot a segédfolyamataival együtt zárja be.

| Állapot | Teljes futás (kívülről mérve) |
|---|---|
| régi `teszt.ps1` | 147 mp |
| 1. lépés (DevTools-protokoll, azonnali szerverleállítás) | 59 mp |
| 2. lépés (`mentve()` a fix várakozások helyett, 57 helyen) | 29 mp (467 teszt) |
| szűrt futás (`-Csoport "Zsákmány"`) | 6 mp |

Eltérések a tervtől:
- **2. lépés:** a `mentve()` segéd a késleltetett mentést nem kivárja, hanem rögtön lefuttatja (`doSave()`, ahogy az oldal bezárásakor az app is) – a 400 ms-os késleltetés kivárásával alig lett volna nyereség. A késleltetést magát külön teszt nézi („Felhő mentés”). Ellenőrzés: négy szándékos elrontással (a mentés, a lapszinkron, a lapfigyelő és a törlés kikapcsolva) az átírás előtt és után ugyanazok a tesztek buktak.
- **4. lépés:** az eredmény a `.git` mappába kerül (`dmscreen-teszt-eredmeny.txt`), így sosem kerül a tárolóba. Az ujjlenyomat a fájlok tartalmából készül (követett + új fájlok), a `*.md` nélkül: a dokumentáció írása nem érvénytelenít egy sikeres futást (a tesztek nem olvasnak `.md`-t). A sikeres futás 24 óráig érvényes.
- Minden futás saját portot és Chrome-profilt kap (két session egyszerre is futtathat).

## Az eredeti terv

A felhasználó kérése: a tesztek és az ellenőrző fussanak gyorsabban, vagy legalább úgy, hogy Claude-nak ne kelljen rájuk várnia.

## Mit mértem (2026-11-14)

Egy ideiglenes futtatóval (a projekt fájljait nem módosította) tesztenként megmértem a valós időt. A futtató ugyanazt a `tests/index.html`-t nyitotta meg láthatatlan Chrome-ban, de nem a mostani módon (`--virtual-time-budget` + `--dump-dom`), hanem a DevTools-protokollon át figyelte, mikor kész (ezt a `tests\lefedettseg.cs` `Cdp` osztálya már tudja, a `-Lefedettseg` is így dolgozik).

| Mit | Idő |
|---|---|
| A mostani `teszt.ps1` (a `CLAUDE.md` szerint, 2026-11-11) | ≈ 150 mp |
| Ugyanaz a 463 teszt a DevTools-protokollal figyelve | **56 mp** (mind sikeres) |
| Ebből a Chrome indítása és az oldalak betöltése | ≈ 3 mp |
| Ebből fix várakozás a tesztekben (`await wait(500)` és társai, ≈ 80 helyen) | ≈ 27 mp |

Hol megy el az idő (a 463 tesztből):

| Csoport | Idő | Teszt |
|---|---|---|
| Karakterlap a DM Screenben (szinkron, import, mentés) | 21,3 mp | 16 |
| Telefonos karakterlap | 13,1 mp | 79 |
| Játékos app: láthatóság és közzététel | 3,2 mp | 10 |
| Felhő mentés | 3,1 mp | 6 |
| Szintlépés: robot | 2,7 mp | 3 |
| Biztonsági mentések | 2,4 mp | 7 |
| a többi 38 csoport együtt | ≈ 9 mp | 342 |

A leglassabb 12 teszt mind 1,5–2,5 mp, és szinte csak várakozik: a mentés 400 ms-os késleltetésére (`save()` → `setTimeout(doSave, 400)`) vár fix 500 ms-ot, tesztenként 3–5-ször.

**Amit nem mértem:** a mostani `teszt.ps1`-et nem futtattam le egymás mellett (ugyanazt a Chrome-profilt és eredményfájlt használja, mint egy párhuzamos session tesztje, és azt elronthatta volna). A 150 mp a `CLAUDE.md` adata. Az 1. lépés ezért egy közvetlen összeméréssel kezdődik. Az ellenőrző ügynök futási idejét sem mértem.

## Lépések

Mindegyik külön commit, külön jóváhagyással; egyik sem változtat az app viselkedésén.

| # | Lépés | Mit | Várt idő | Kockázat |
|---|---|---|---|---|
| 1 | **A futtató a DevTools-protokollal figyel** | A `teszt.ps1` alapmódja is a `Cdp` osztállyal indít (mint a `-Lefedettseg`, mérés nélkül): megnyitja az oldalt, fél másodpercenként megnézi a `data-done` jelzőt, és azonnal kilép, ha kész. A `--virtual-time-budget` és a `--dump-dom` megszűnik, vele a fogva tartott eredményfájl újrapróbálása is. Előtte: a régi és az új mód egymás utáni mérése. A kimenet formája (OK / HIBA sorok, „MINDEN TESZT SIKERES”) és a kilépési kód változatlan, így a `feltoltes.ps1` nem változik. | 150 → ≈ 57 mp | kicsi |
| 2 | **Fix várakozások helyett feltétel** | Új tesztsegéd (pl. `mentve()`): megvárja, amíg a `saveTimer` lejár és a mentés lefutott – nem tovább. A ≈ 50 db `wait(500)` erre cserélődik; ahol a teszt azt nézi, hogy *nem* történt írás, ott is a mentés végét várja, nem fix időt. A telefonos lap tesztjeiben ugyanez az `until()`-lel. Ellenőrzés: minden érintett tesztet ideiglenes visszarontással kipróbálni, hogy még mindig elkapja a hibát. | ≈ 57 → ≈ 30 mp | közepes (egy rosszul megírt feltétel akkor is zöld, amikor nem kéne) |
| 3 | **Szűrő fejlesztés közben** | `.\teszt.ps1 -Csoport "Zsákmány"` (a csoport nevének részlete) és `-Szuro "initiative"` (a teszt nevének részlete): csak az egyező tesztek futnak. A végén kiírja, hány teszt maradt ki, és a kimenet eleje jelzi, hogy ez **részleges** futás. Fejlesztés közben Claude a szűrt futást használja, a teljeset csak a lépés végén. | 3–10 mp egy csoport | kicsi |
| 4 | **Az eredmény fájlba is** | A futtató az eredményt egy fájlba is kiírja (a munkafa állapotának ujjlenyomatával: `git rev-parse HEAD` + a `git diff` kivonata). A `feltoltes.ps1` nem futtatja újra a teszteket, ha erre az állapotra van friss, sikeres, **teljes** eredmény; különben futtat, mint most. | feltöltésenként egy teljes futás megspórolva | kicsi–közepes (az ujjlenyomatnak a nem követett fájlokat is látnia kell) |
| 5 | **Párhuzamos futás** (csak ha a 30 mp még sok) | A tesztek 2–3 részre osztva, mindegyik saját Chrome-ban és saját profillal (`?resz=1/3`). Feltétele a `TERV-refaktor-2.md` 1. lépése (a `tests.js` csoportfájlokra bontva) – anélkül is megy, de úgy egyszerűbb. | ≈ 30 → ≈ 12–15 mp | közepes (több Chrome, több port; a felhasználó gépén kell kimérni, megéri-e) |

## Hogy Claude-nak ne kelljen várnia

Ez munkamódszer, nem kód – a `CLAUDE.md` „Szabályok” részébe kerül, ha a felhasználó elfogadja:

- **A teljes teszt a háttérben fut.** Claude elindítja, és közben dolgozik tovább (dokumentáció, `SZERZODES.md`, az ellenőrző találatai); az eredményről értesítést kap. Commitot továbbra is csak sikeres, teljes futás után javasol.
- **A teszt és az ellenőrző egyszerre fut**, nem egymás után: az ellenőrző csak olvas, a teszt nem ír a munkafába, nem zavarják egymást.
- **Fejlesztés közben szűrt futás** (3. lépés), a teljes futás a lépés végén egyszer.
- **Párhuzamos sessionök:** a futtató saját portot és Chrome-profilt kapjon futásonként (most közös a `%TEMP%\dmscreen-teszt-profil` és az eredményfájl, két egyidejű futás összeakadhat). Az 1. lépés része.

## Az ellenőrző gyorsítása

Az `ellenorzo` ügynök nyolc pontjából több gépiesen eldönthető; ezeket egy szkript másodpercek alatt megnézi, az ügynöknek az marad, amihez ítélet kell.

| # | Lépés | Mit |
|---|---|---|
| 6 | **Gépi előellenőrzés** (`ellenorzes.ps1`, vagy új tesztek a „Szerződés” csoportban) | (a) változott közös fájl, de a `modul('…', N)` / `Sheet.VERSION` száma nem – a `git diff` alapján (az egyezést már teszt nézi, azt nem, hogy *kellett-e* emelni); (b) ékezetes `.ps1` BOM nélkül; (c) e-mail-cím a változásban; (d) a `CLAUDE.local.md` jellemző szavai a nyilvános fájlokban; (e) kódváltozás van, de a `tests/tests.js` nem változott. A rétegszabályt már most teszt figyeli. |
| 7 | **Szűkebb ügynök** | Az `ellenorzo.md` a gépi pontokat nem nézi újra (a szkript kimenetét megkapja), marad: XSS és tisztító, szerződés és sorrend, a teszt tényleg azt nézi-e, viselkedésváltozás refaktorban, a tudás helye. A hívó a `git diff`-et adja át, a `CLAUDE.md`-ből és a `SZERZODES.md`-ből csak a változáshoz tartozó részt kell elolvasnia. |
| 8 | **Arányosság** | Csak dokumentációt érintő változásnál elég a gépi előellenőrzés. Több commitból álló lépésnél az ügynök a lépés végén fut egyszer a teljes változásra (ez a `CLAUDE.md` mostani szabálya is: „egy lépés végén”). |

## A felhasználó döntései (2026-11-14)

1. **Meddig menjünk?** Az 1–4. és a 6–8. lépés; az 5. (párhuzamos futás) csak akkor, ha kell.
2. **A `feltoltes.ps1` kihagyhatja a tesztet**, ha ugyanarra az állapotra van friss, sikeres, teljes futás (4. lépés).
3. Az ellenőrző ügynök modelljéről nem született döntés; a javaslat szerint marad a mostani.

## Kész, ha

- a teljes helyi teszt ≤ 35 mp (az 5. lépéssel ≤ 15 mp), a mostani ≈ 150 helyett;
- van szűrt futás, és a részleges futás nem téveszthető össze a teljessel;
- a `CLAUDE.md`-ben az új idők és az új munkamódszer szerepel (háttérben futó teszt, párhuzamos ellenőrző);
- a tesztek száma és a lefedettség nem csökkent.

# Gyorsabb teszt és ellenőrző – terv

*Készült: 2026-11-14. Állapot: **javaslat**, a felhasználó még nem fogadta el. Kódváltozás nincs.*

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

## Döntések, amik a felhasználóra várnak

1. **Meddig menjünk?** Javaslat: 1–4. és 6–8. lépés; az 5. (párhuzamos futás) csak akkor, ha a ≈ 30 mp még zavaró.
2. **A `feltoltes.ps1` kihagyhatja-e a tesztet**, ha ugyanarra az állapotra van friss, sikeres futás (4. lépés)? Javaslat: igen. A másik lehetőség: mindig futtat, ahogy most – biztosabb, de feltöltésenként +30–60 mp.
3. **Az ellenőrző ügynök futhat-e kisebb, gyorsabb modellen?** Javaslat: nem – az XSS és a szerződés megítélése a legfontosabb dolga, ott a pontosság többet ér a gyorsaságnál; a gyorsítás a 6–8. lépésből jöjjön.

## Kész, ha

- a teljes helyi teszt ≤ 35 mp (az 5. lépéssel ≤ 15 mp), a mostani ≈ 150 helyett;
- van szűrt futás, és a részleges futás nem téveszthető össze a teljessel;
- a `CLAUDE.md`-ben az új idők és az új munkamódszer szerepel (háttérben futó teszt, párhuzamos ellenőrző);
- a tesztek száma és a lefedettség nem csökkent.

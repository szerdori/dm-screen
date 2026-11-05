# 0007 – A nagy betű betűtípusa a tárolóban

*Állapot: elfogadva 2026-11-05 (a felhasználó döntése).*

## Háttér
A telefonos lap nagy betűs módja (Fiók → Megjelenítés, `TERV-olvashato-mod.md`) az Atkinson Hyperlegible Next betűtípust használja: gyengénlátóknak tervezték, jól megkülönböztethető az 1 / l / I és a 0 / O. Először a Google Fonts-ról töltődött (csak nagy betűnél). Ilyenkor a játékos telefonja kérést küld a Google-nek (IP-cím), és a betű csak internettel jön le.

## Döntés
- A betűfájlok a tárolóban vannak: `betutipus/atkinson-hyperlegible-next-latin.woff2` és `-latin-ext.woff2` (a Google Fonts változatlan woff2 részhalmazai, változtatható vastagság 400–800; az ő és az ű a latin-ext részben van), mellettük a licenc: `betutipus/OFL.txt` (SIL Open Font License 1.1, fenntartott betűnév nélkül – szabadon terjeszthető a licenccel együtt).
- A `karakter.html` `@font-face`-szel (`unicode-range`-dzsel) hivatkozik rájuk. A böngésző csak akkor tölti le őket, ha használja, vagyis csak nagy betűnél; normál betűnél nincs letöltés.
- Külső betűtípus-kérés nincs (teszt nézi: nincs `fonts.googleapis` / `fonts.gstatic` a lapon).

## Következmények
- Nincs harmadik félhez menő kérés a betű miatt; a betű a lappal együtt gyorsítótárazódik.
- A betű frissítése kézi: új woff2 letöltése a Google Fonts CSS-éből (`fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400..800`, böngésző user-agenttel), a `unicode-range` értékek átmásolása.
- A két fájl kb. 53 KB; a tároló nyilvános, a licenc ezt megengedi.

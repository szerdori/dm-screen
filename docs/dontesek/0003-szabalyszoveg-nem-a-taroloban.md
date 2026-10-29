# 0003 – A szabályszöveg nem kerül a nyilvános tárolóba

*Állapot: elfogadva 2026-10-19.*

## Háttér
A játékos appnak kell a szabálykönyv (spellek, tárgyak, osztályok, featek…), de a XGE/TCE stb. szövege szerzői jogi védelem alatt áll, a GitHub-tároló pedig nyilvános.

## Döntés
A DM Screen „Szabálykönyv” gombja futás közben tölti le az 5e.tools GitHub-tükréből, szűri (PHB/XGE/TCE 2014, tárgyaknál DMG 2014; a 2024-es könyvek nélkül), saját formátumra alakítja, és a privát Firebase-be menti 900 KB alatti darabokban (`rules/*`, a meta utoljára). A telefon IndexedDB-ben tárolja, és csak a verziót ellenőrzi.

## Következmények
- A tárolóba és a tesztekbe csak szintetikus minta kerülhet; az online tesztek (`teszt.ps1 -Online`) a tükörből olvasnak.
- Formátumváltozásnál `RB_FORMAT` emelés, és a felhasználónak újra kell töltenie a szabálykönyvet (emberi kapu).

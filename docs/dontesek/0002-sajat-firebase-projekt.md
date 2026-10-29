# 0002 – Saját Firebase-projekt, DM-lista csak a konzolból

*Állapot: elfogadva 2026-10-19, élesben 2026-10-27.*

## Háttér
A DM Screen adatai eredetileg egy másik app Firebase-projektjében voltak, ahol egy `match /{document=**}` szabály mindenkit mindenhez engedett. A játékos app miatt a játékosok is belépnek, nekik csak a saját és a csapat számára látható karaktereket szabad látniuk.

## Döntés
- Saját Firebase-projekt a DM Screennek, Google-belépéssel.
- A DM-ek listája az `access/dms` dokumentumban (`emails` tömb), **csak a Firebase-konzolból írható**; a játékosoké az `access/players`-ben (a DM Screen írja).
- A jogosultság a `firestore.rules`-ban (élő változat, a felhasználó másolja a konzolba); a részletek: `SZERZODES.md`.
- A részben titkos karakter két dokumentum: nyilvános rész (`characters`) + csak DM-nek látható rész (`dmscreen_library`), mert a Firestore csak dokumentumonként jogosít.

## Következmények
- Szabályváltozás után a felhasználónak kézzel kell publikálnia a szabályokat (emberi kapu a változtatási sorrendben).
- Költözés: ha az új felhő üres, a DM Screen a böngészőben tárolt másolatot tölti fel (`loadFromDb`); tartaléknak Menü → Exportálás a régi appból, Importálás az újban. A régi `dmscreen*` gyűjtemények a `hazi-naplo` projektben maradnak, amíg a felhasználó ki nem törli őket.

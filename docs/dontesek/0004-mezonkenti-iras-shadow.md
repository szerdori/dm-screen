# 0004 – Mezőnkénti írás és „shadow” szinkron

*Állapot: elfogadva 2026-10-28.*

## Háttér
Egy karakterlapot egyszerre írhat a játékos (telefon) és a DM (DM Screen). Teljes dokumentum írásakor az egyik fél felülírná a másik friss változását.

## Döntés
- A lapokra mindig mezőnként írunk (`updateDoc`, pl. `'hp.cur'`), `updatedAt` / `updatedBy` mezővel.
- A DM Screen egy „shadow”-ban tartja az utoljára egyeztetett értékeket; mentéskor csak azt küldi, ami a DM oldalán változott (`syncSheets`). A gazdát mindig a DM állítja.
- Szabálymotoros lapon a számolt mező kézi átírása felülírássá (`ov.*`) válik, nem a számolt értéket írja át.

## Következmények
- Új szinkronizált mezőnél a shadow-t is bővíteni kell, és teszt kell mindkét irányra.
- A részletek: `SZERZODES.md` „Lap ↔ DM Screen szinkron”.

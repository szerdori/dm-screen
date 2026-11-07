# Terv: dobáskérés a DM-től a játékosok telefonjára

A felhasználó kérése és döntései (2026-11-06). Cél: játék közben ne menjen el idő azzal, hogy a játékosok keresik a lapjukon, hol van pl. a History.

## Döntések
- **Mit kérhet a DM:** skill, képességpróba (pl. STR próba), mentődobás és **Initiative**. Az Initiative eredménye magától bekerül a harcba.
- **Hol:** a 👥 Csapat nézetben. A skill-táblázat cellájára kattintva egy játékostól, a sor „Mindenki” gombjával mindenkitől. Shift = előny, Ctrl = hátrány (mint eddig). Új táblázat: képességpróbák és mentők, ugyanígy. Initiative: a 🎲 Initiative menüben új lehetőség („📱 a játékosok a telefonjukon dobnak”).
- **Nincs külön titkos dobás mód:** minden dobás titkos (más játékos semmit nem lát, csak a saját játékosa és a DM). Akinek nincs telefonos lapja (vagy nincs gazdája), annak a DM Screen dob, mint eddig.
- **Előny/hátrány:** a DM adja meg; a telefon hozzáveszi a saját hatásaiból jövőt (pl. Poisoned). A játékos nem változtathat rajta.
- **DC:** nem kötelező; a DM a Csapat nézetben adja meg. A játékos nem látja (nem is kerül a lapra); a DM naplójában ✔ / ✖ jelzi.
- **Állapot:** a Csapat nézetben a legutóbbi kérés alatt: „History: 2/4 dobott · vár: … · kihagyta: …”, és ✕ a visszavonáshoz.
- **Egy kérés játékosonként:** az új felülírja a régit; 10 perc után lejár (a telefon nem mutatja).
- **A telefonon:** felugró ablak „🎲 A DM dobást kért tőled: Perception +5 (előnnyel)”, gombok: **🎲 Dobok** és **✕** (nem érintett). Dobás után az eredmény a szokott helyen (a lap alján), az ablak eltűnik. Csak akkor ugrik fel, ha a lap (az app) nyitva van – értesítés nincs (a felhasználó szerint rendben).

## Adat (részletek: `SZERZODES.md`)
- `sheets/{id}.rollReq: {id, kind, label, mode, by, at} | null` – csak a DM írja (új kérés, visszavonás); a telefon sosem, így egy közben jött új kérést sem törölhet. A ✕ a `rollSkip`-be kerül (a kérés azonosítója). `kind`: `check:<ab>:<skill>`, `check:<ab>`, `save:<ab>`, `init`.
- A válasz a már meglévő `rolls` listában jön: a dobás `req` mezője a kérés azonosítója. A DC és a kérés többi DM-oldali adata csak a DM Screen memóriájában van.
- Firestore-szabály nem változik (a játékos a saját lapját egészében írhatja).

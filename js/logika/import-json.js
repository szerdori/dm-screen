// JSON import (logika, DOM nélkül): a beillesztett vagy fájlból jövő adat felismerése és betöltése.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('import-json', N) és az index.html-ben az import-json.js?v=N és a VART_MODULOK.
'use strict';
modul('import-json', 1);

const is5e = o => o.hp?.average != null || Array.isArray(o.ac) || Array.isArray(o.size) || !!o._copy || (Array.isArray(o.action) && o.action[0]?.entries);
const isDDB = o => (o.data && Array.isArray(o.data.stats)) || (Array.isArray(o.stats) && o.stats[0]?.id != null);
async function importAny(obj) {
  const arr = Array.isArray(obj) ? obj : obj.monster || obj.creatures || (obj.library && !obj.enc ? obj.library : null) || [obj];
  const out = [], sheets = [];
  for (const o of arr) {
    if (o?.format === Sheet.FORMAT) sheets.push(importSheet(o));
    else if (isDDB(o)) out.push(convertDDB(o));
    else if (is5e(o)) out.push(convert5e(await resolveCopy(o)));
    else out.push(normCreature({...o, id: uid()}));
  }
  return [...sheets, ...out.map(c => upsertLibrary(c))];
}

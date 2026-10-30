// JSON import (logika, DOM nélkül): a beillesztett vagy fájlból jövő adat felismerése és betöltése.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('import-json', N) és az index.html-ben az import-json.js?v=N és a VART_MODULOK.
'use strict';
modul('import-json', 2);

const is5e = o => o.hp?.average != null || Array.isArray(o.ac) || Array.isArray(o.size) || !!o._copy || (Array.isArray(o.action) && o.action[0]?.entries);
const isDDB = o => (o.data && Array.isArray(o.data.stats)) || (Array.isArray(o.stats) && o.stats[0]?.id != null);
// Új forrás = új bejegyzés. Az első illeszkedő dönt, ezért a sorrend számít; az utolsó mindent elfogad.
// Az atalakit normCreature-on átment lényt ad (a karakterlapé, lap: true, a lap és a könyvtári játékos létrehozásával tér vissza).
const IMPORTEROK = [
  {nev: 'karakterlap', lap: true, felismer: o => o?.format === Sheet.FORMAT, atalakit: o => importSheet(o)},
  {nev: 'D&D Beyond', felismer: isDDB, atalakit: o => convertDDB(o)},
  {nev: '5e.tools', felismer: is5e, atalakit: async o => convert5e(await resolveCopy(o))},
  {nev: 'JSON', felismer: () => true, atalakit: o => normCreature({...o, id: uid()})},
];
async function importAny(obj) {
  const arr = Array.isArray(obj) ? obj : obj.monster || obj.creatures || (obj.library && !obj.enc ? obj.library : null) || [obj];
  const out = [], sheets = [];
  for (const o of arr) {
    const imp = IMPORTEROK.find(i => i.felismer(o));
    (imp.lap ? sheets : out).push(await imp.atalakit(o));
  }
  return [...sheets, ...out.map(c => upsertLibrary(c))];
}

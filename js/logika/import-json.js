// Importálók (logika, DOM nélkül): a beillesztett vagy fájlból jövő adat felismerése és átalakítása (IMPORTEROK).
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('import-json', N) és az index.html-ben az import-json.js?v=N és a VART_MODULOK.
'use strict';
modul('import-json', 2);

const is5e = o => o.hp?.average != null || Array.isArray(o.ac) || Array.isArray(o.size) || !!o._copy || (Array.isArray(o.action) && o.action[0]?.entries);
const isDDB = o => (o.data && Array.isArray(o.data.stats)) || (Array.isArray(o.stats) && o.stats[0]?.id != null);
// Új forrás = új bejegyzés. Az első illeszkedő dönt, ezért a sorrend számít; az utolsó mindent elfogad.
// Az atalakit csak átalakít, nem ment és nem kérdez: normCreature-on átment lényt ad (a karakterlapé, lap: true, Sheet.norm-on átment lapot); a többit az importAny intézi (konyvtar-ablak.js).
const IMPORTEROK = [
  {nev: 'karakterlap', lap: true, felismer: o => o?.format === Sheet.FORMAT, atalakit: o => Sheet.norm(o)},
  {nev: 'D&D Beyond', felismer: isDDB, atalakit: o => convertDDB(o)},
  {nev: '5e.tools', felismer: is5e, atalakit: async o => convert5e(await resolveCopy(o))},
  {nev: 'JSON', felismer: () => true, atalakit: o => normCreature({...o, id: uid()})},
];
// a beillesztett vagy fájlból jövő adat elemei (tömb, {monster}, {creatures}, {library} vagy egyetlen elem)
const importElemek = obj => Array.isArray(obj) ? obj : obj.monster || obj.creatures || (obj.library && !obj.enc ? obj.library : null) || [obj];

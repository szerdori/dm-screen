// Encounter-nehézség (logika, DOM nélkül): DMG 2014, 5. fejezet – XP-küszöbök, szorzók, CR → XP.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('nehezseg', N) és az index.html-ben a nehezseg.js?v=N és a VART_MODULOK.
'use strict';
modul('nehezseg', 1);

// ---------- nehézség (DMG 2014, 5. fejezet) ----------
const CR_XP = {'0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000};
// szintenként: [easy, medium, hard, deadly]
const XP_THRESH = [null, [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100],
  [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400],
  [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700]];
const MULT = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
const crXp = cr => CR_XP[String(cr ?? '').trim().replace(/^CR\s*/i, '').replace(/^0\.125$/, '1/8').replace(/^0\.25$/, '1/4').replace(/^0\.5$/, '1/2')];
const pcLevel = c => { const m = String(c.level ?? c.cr ?? '').match(/\d+/); const n = m ? +m[0] : 0; return n >= 1 && n <= 20 ? n : null; };
function difficulty() {
  const party = S.enc.list.filter(x => sideOf(x) === 'ally' && x.c.kind === 'pc');
  const enemies = S.enc.list.filter(x => sideOf(x) === 'enemy');
  const thresh = [0, 0, 0, 0], noLevel = [];
  party.forEach(x => { const l = pcLevel(x.c); if (l) XP_THRESH[l].forEach((v, i) => thresh[i] += v); else noLevel.push(nameOf(x)); });
  const noCr = [];
  let base = 0;
  enemies.forEach(x => { const xp = crXp(x.c.cr); if (xp == null) noCr.push(nameOf(x)); else base += xp; });
  const counted = enemies.length - noCr.length;
  let idx = counted <= 0 ? 1 : counted === 1 ? 1 : counted === 2 ? 2 : counted <= 6 ? 3 : counted <= 10 ? 4 : counted <= 14 ? 5 : 6;
  const pSize = party.length;
  if (pSize && pSize < 3) idx++; else if (pSize >= 6) idx--;
  const mult = MULT[idx];
  const adj = Math.round(base * mult);
  const rating = !pSize || !counted ? null : adj >= thresh[3] ? 'deadly' : adj >= thresh[2] ? 'hard' : adj >= thresh[1] ? 'medium' : adj >= thresh[0] ? 'easy' : 'trivial';
  return {party, enemies, thresh, noLevel, noCr, base, mult, adj, rating, counted};
}

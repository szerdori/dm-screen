// Encounter-nehézség (logika, DOM nélkül): DMG 2014, 5. fejezet – XP-küszöbök, szorzók, CR → XP.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('nehezseg', N) és az index.html-ben a nehezseg.js?v=N és a VART_MODULOK.
'use strict';
modul('nehezseg', 2);

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
// csapattárs NPC / szörny a csapatban (a felhasználó döntése, 2026-11-14): úgy számít, mint egy játékos, akinek a szintje = a CR-je (CR 1 alatt 1., 20 fölött 20.)
// (a törtes CR-nél a parseFloat("1/4") = 1, a Math.max(1, …) miatt mindegy: CR 1 alatt úgyis 1. szint)
const crSzint = cr => { if (crXp(cr) == null) return null; const n = parseFloat(String(cr).trim().replace(/^CR\s*/i, '')); return Math.max(1, Math.min(20, Math.floor(n) || 1)); };
const tagSzint = x => x.c.kind === 'pc' ? pcLevel(x.c) : crSzint(x.c.cr);
// az aktuális HP aránya 0–1 (a felhasználó döntése, 2026-11-14: arányosan): (HP + temp HP) / max HP, legfeljebb 1; halott 0
const hpArany = x => x.dead ? 0 : Math.max(0, Math.min(1, ((+x.hp || 0) + (+x.temp || 0)) / (x.c.hp.max || 1)));
// egy értékelés: teljes HP-val (aktualis = false, a harc tervezéséhez) vagy az aktuális HP-val (aktualis = true, menet közben)
function nehezsegErtekeles(tagok, ellenfelek, aktualis) {
  const w = x => aktualis ? hpArany(x) : 1;
  const thresh = [0, 0, 0, 0];
  let pSize = 0;
  for (const x of tagok) { const l = tagSzint(x), s = w(x); if (!l || !s) continue; pSize++; XP_THRESH[l].forEach((v, i) => thresh[i] += v * s); }
  let xp = 0, counted = 0;
  for (const x of ellenfelek) { const e = crXp(x.c.cr), s = w(x); if (e == null || !s) continue; counted++; xp += Math.round(e * s); }  // soronként kerekítve: az ablak sorai kiadják az összeget
  let idx = counted <= 1 ? 1 : counted === 2 ? 2 : counted <= 6 ? 3 : counted <= 10 ? 4 : counted <= 14 ? 5 : 6;
  if (pSize && pSize < 3) idx++; else if (pSize >= 6) idx--;
  const mult = MULT[idx], adj = Math.round(xp * mult), t = thresh.map(Math.round);
  const rating = !pSize || !counted ? null : adj >= t[3] ? 'deadly' : adj >= t[2] ? 'hard' : adj >= t[1] ? 'medium' : adj >= t[0] ? 'easy' : 'trivial';
  return {thresh: t, xp: Math.round(xp), mult, adj, rating, counted, pSize};
}
// DMG 2014, 5. fejezet; a csapatba a csapattárs játékosok és a csapattárs NPC-k / szörnyek is; a legfelső szint a teljes HP-s (tervezett) értékelés, a most az aktuális HP-s
function difficulty() {
  const party = S.enc.list.filter(x => sideOf(x) === 'ally' && x.c.kind === 'pc');
  const allies = S.enc.list.filter(x => sideOf(x) === 'ally' && x.c.kind !== 'pc');
  const enemies = S.enc.list.filter(x => sideOf(x) === 'enemy');
  const tagok = [...party, ...allies];
  const noLevel = tagok.filter(x => !tagSzint(x)).map(nameOf), noCr = enemies.filter(x => crXp(x.c.cr) == null).map(nameOf);
  const base = enemies.reduce((t, x) => t + (crXp(x.c.cr) ?? 0), 0);  // a jutalom: mindig a teljes érték
  const terv = nehezsegErtekeles(tagok, enemies, false), most = nehezsegErtekeles(tagok, enemies, true);
  return {party, allies, members: tagok, enemies, noLevel, noCr, base, ...terv, most};
}

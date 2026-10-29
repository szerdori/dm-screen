// Zsákmány (logika, DOM nélkül): DMG 2014 kincstáblák az 5e.tools adataiból, dobás és összesítés.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('loot', N) és az index.html-ben a loot.js?v=N és a VART_MODULOK.
'use strict';
modul('loot', 1);

// ---------- zsákmány (DMG 2014 kincstáblák, az 5e.tools adataiból) ----------
// Egyéni kincs: ellenfelenként a CR-sávja szerinti d100-as táblából érmék.
// Kincshalom: az egész harcért érmék + drágakövek, műtárgyak és mágikus tárgyak (A–I táblák).
const LOOT_URL = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/loot.json';
const COIN_GP = {pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01}, COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];
const BAND_HU = ['CR 0–4', 'CR 5–10', 'CR 11–16', 'CR 17+'];
const NATURAL_ATTACK = /\b(bite|claws?|slam|tail|tentacles?|horns?|hoof|hooves|talons?|gore|sting|fists?|unarmed|beak|tusks?|touch|rend|pseudopod|ram|stomp|wings?|harapás|karom)\b/i;
let lootData = null, lootResult = null;
async function loadLoot() {
  if (!lootData) { const r = await fetch(LOOT_URL); if (!r.ok) throw new Error('HTTP ' + r.status); lootData = await r.json(); }
  return lootData;
}
const crBand = cr => { const n = crNum(String(cr ?? '').replace(/^CR\s*/i, '')); return n <= 4 ? 0 : n <= 10 ? 1 : n <= 16 ? 2 : 3; };
function rollAmount(expr) {
  const m = String(expr ?? '0').replace(/\s/g, '').match(/^(.+?)(?:\*(\d+))?$/);
  return m ? roll(m[1]).total * (m[2] ? +m[2] : 1) : 0;
}
const dmgTable = (list, band) => (list || []).find(t => t.source === 'DMG' && crBand(t.crMin) === band);
function pickRow(table, die) { const r = rnd(die); return (table || []).find(row => r >= row.min && r <= (row.max ?? row.min)); }
function addCoins(acc, coins) { for (const [k, v] of Object.entries(coins || {})) if (COIN_GP[k]) acc[k] = (acc[k] || 0) + rollAmount(v); return acc; }
function lootItemName(row) {
  if (!row) return '';
  if (Array.isArray(row.table) && row.table.length) {
    const die = Math.max(...row.table.map(r => r.max ?? r.min));
    return lootItemName(pickRow(row.table, die) || row.table[0]);
  }
  if (row.choose) return tagStrip(String(Object.values(row.choose).flat()[0] || '')) + ' (válassz konkrét tárgyat)';
  return tagStrip(row.item || '');
}
function rollValuables(list, spec) {
  if (!spec) return [];
  const t = (list || []).find(g => g.source === 'DMG' && g.type === spec.type);
  if (!t || !t.table?.length) return [];
  return Array.from({length: rollAmount(spec.amount)}, () => ({name: tagStrip(t.table[rnd(t.table.length) - 1]), value: spec.type}));
}
function rollMagicItems(data, specs) {
  const out = [];
  for (const s of specs || []) {
    const t = (data.magicItems || []).find(m => m.source === 'DMG' && m.type === s.type);
    if (!t) continue;
    for (let i = 0, n = rollAmount(s.amount); i < n; i++) { const name = lootItemName(pickRow(t.table, 100)); if (name) out.push({name, table: s.type}); }
  }
  return out;
}
// a legyőzött fegyverei és páncélja (természetes támadások nélkül)
function gearOf(c) {
  const items = [];
  for (const a of [...c.actions, ...c.bonusActions])
    if (/Weapon Attack:|Attack Roll:/i.test(a.text) && !/Spell Attack/i.test(a.text) && !NATURAL_ATTACK.test(a.name)) items.push(a.name.replace(/\s*\(.*?\)\s*/g, ' ').trim());
  if (c.acNote && !/natural|scraps|unarmored|mage armor/i.test(c.acNote)) c.acNote.split(/,\s*/).forEach(s => items.push(s.trim()));
  return [...new Set(items.filter(Boolean))];
}
const noTreasure = c => /\b(beast|ooze|plant)\b/i.test(c.type);
function generateLoot(data, chosen, mode, band) {
  const res = {mode, creatures: [], hoard: null};
  for (const x of chosen) {
    let coins = {};
    if (mode !== 'hoard') { const t = dmgTable(data.individual, crBand(x.c.cr)); coins = addCoins({}, t ? pickRow(t.table, 100)?.coins : null); }
    res.creatures.push({name: nameOf(x), coins, gear: gearOf(x.c)});
  }
  if (mode !== 'individual') {
    const t = dmgTable(data.hoard, band);
    const row = (t && pickRow(t.table, 100)) || {};
    res.hoard = {band, coins: addCoins({}, t?.coins), gems: rollValuables(data.gems, row.gems), art: rollValuables(data.artObjects, row.artObjects), items: rollMagicItems(data, row.magicItems)};
  }
  return res;
}
function lootTotals(res) {
  const coins = {};
  for (const c of [...res.creatures.map(c => c.coins), res.hoard?.coins || {}]) for (const k of COINS) if (c[k]) coins[k] = (coins[k] || 0) + c[k];
  const valuables = res.hoard ? [...res.hoard.gems, ...res.hoard.art].reduce((s, v) => s + v.value, 0) : 0;
  const gp = COINS.reduce((s, k) => s + (coins[k] || 0) * COIN_GP[k], 0) + valuables;
  const party = S.enc.list.filter(x => x.c.kind === 'pc' && sideOf(x) === 'ally').length;
  return {coins, gp: Math.round(gp * 100) / 100, party, each: party ? Math.floor(gp / party * 100) / 100 : null};
}
const coinStr = c => COINS.filter(k => c[k]).map(k => `${c[k]} ${k}`).join(', ');
function groupNames(list) {
  const m = new Map();
  for (const v of list) { const k = v.name + (v.value ? ` (${v.value} gp)` : ''); m.set(k, (m.get(k) || 0) + 1); }
  return [...m].map(([k, n]) => (n > 1 ? n + '× ' : '') + k);
}
function lootText(res) {
  if (!res) return '';
  const t = lootTotals(res), lines = [];
  for (const c of res.creatures) {
    const parts = [res.mode !== 'hoard' ? (coinStr(c.coins) || 'nincs érme') : '', c.gear.length ? 'felszerelés: ' + c.gear.join(', ') : ''].filter(Boolean);
    if (parts.length) lines.push(`${c.name}: ${parts.join('; ')}`);
  }
  if (res.hoard) {
    lines.push(`Kincshalom (${BAND_HU[res.hoard.band]}): ${coinStr(res.hoard.coins) || 'nincs érme'}`);
    if (res.hoard.gems.length) lines.push('Drágakövek: ' + groupNames(res.hoard.gems).join(', '));
    if (res.hoard.art.length) lines.push('Műtárgyak: ' + groupNames(res.hoard.art).join(', '));
    if (res.hoard.items.length) lines.push('Mágikus tárgyak: ' + groupNames(res.hoard.items).join(', '));
  }
  lines.push(`Összesen: ${coinStr(t.coins) || '0'} – kb. ${t.gp} gp értékben` + (t.each != null ? `, fejenként kb. ${t.each} gp (${t.party} játékos)` : ''));
  return lines.join('\n');
}

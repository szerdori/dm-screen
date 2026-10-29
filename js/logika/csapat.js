// Csapat nézet számolásai (logika, DOM nélkül): tagok, passzív értékek, skillek, pénz, felszerelés szövegként.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('csapat', N) és az index.html-ben a csapat.js?v=N és a VART_MODULOK.
'use strict';
modul('csapat', 1);

// ---------- Csapat nézet (harcon kívül): passzív értékek, skillek, felszerelés ----------
const PASSIVES = [['perception', 'Perception'], ['investigation', 'Investigation'], ['insight', 'Insight']];
// csapattagok: amíg nincs beállítva (partyIds = null), az összes játékos; utána a kiválasztottak
const byName = (a, b) => a.name.localeCompare(b.name, 'hu');
function partyMembers() {
  const ids = S.settings.partyIds;
  if (!Array.isArray(ids)) return S.library.filter(c => c.kind === 'pc').sort(byName);
  return ids.map(id => S.library.find(c => c.id === id)).filter(Boolean).sort(byName);
}
function setPartyMember(id, on) {
  const ids = new Set(partyMembers().map(c => c.id));
  on ? ids.add(id) : ids.delete(id);
  S.settings.partyIds = [...ids];
  save();
}
// skill-bónusz: D&D Beyondról pontosan; kézzel felvitt játékosnál a „Skills” mezőből, különben a képességmódosító
function partySkill(c, k) {
  if (c.skillMods?.[k]) return c.skillMods[k];
  const base = mod(c.abilities[SKILLS[k]]);
  const m = c.skills.match(new RegExp(skillLabel(k).replace(/ /g, '\\s*') + '\\s*([+\\-−]\\s*\\d+)', 'i'));
  if (m) { const b = parseInt(m[1].replace(/\s/g, '').replace('−', '-')); return {b, p: b > base ? 1 : 0}; }
  return {b: base, p: 0};
}
const passiveScore = (c, k) => 10 + partySkill(c, k).b + (c.passiveBonus?.[k] || 0);
const coinsGp = cur => Math.round(COINS.reduce((s, k) => s + (cur?.[k] || 0) * COIN_GP[k], 0) * 100) / 100;
function inventoryToText(list) { return list.map(i => (i.qty !== 1 ? i.qty + '× ' : '') + i.name + (i.container ? ` [${i.container}]` : '')).join('\n'); }
function textToInventory(text, old = []) {
  return String(text).split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(?:(\d+)\s*[×x*]\s*)?(.+?)(?:\s*\[([^\]]+)\])?$/i);
    const name = m[2].trim(), container = (m[3] || '').trim();
    const prev = old.find(o => o.name === name && o.container === container) || old.find(o => o.name === name) || {};
    return {...prev, name, container, qty: m[1] ? +m[1] : 1};
  });
}

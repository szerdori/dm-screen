// Könyvtár (logika, DOM nélkül): lény felvétele vagy frissítése a könyvtárban, a szekciók szöveges alakja, encounter-összegzés.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('konyvtar', N) és az index.html-ben a konyvtar.js?v=N és a VART_MODULOK.
'use strict';
modul('konyvtar', 1);

// keepShare: újraimportálás / harcból visszamentés nem írja felül a játékos app beállításait (csak a szerkesztő)
function upsertLibrary(c, keepShare = true) {
  c = normCreature(c);
  const i = S.library.findIndex(x => x.id === c.id || (c.ddbId && x.ddbId === c.ddbId));
  if (i >= 0) {
    const old = S.library[i];
    c.id = old.id;
    if (keepShare) c = normCreature({...c, owner: old.owner || c.owner, share: old.share || c.share});
    S.library[i] = c;
  } else S.library.push(c);
  save();
  return c;
}
function summarize(list) {
  const cnt = {}; list.forEach(c => cnt[c.name] = (cnt[c.name] || 0) + 1);
  return Object.entries(cnt).map(([n, k]) => (k > 1 ? k + '× ' : '') + n).join(', ');
}
function sectionToText(arr) { return arr.map(e => (e.name ? e.name + '. ' : '') + e.text).join('\n\n'); }
function textToSection(t) { return t.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(splitEntry); }

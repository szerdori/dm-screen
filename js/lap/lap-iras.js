// Telefonos karakterlap (lap-iras, a karakter.html része): újraszámolás és írás (helyben és a felhőbe), koncentráció, sebzés
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-iras', N) és a karakter.html-ben a lap-iras.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-iras', 2);

// ---------- szabálymotor (auto lap): a számolt értékek a lap mezőibe (Sheet.calc + Sheet.materialize) ----------
// Újraszámolás, ha a felépítés, a felülírás, a felszerelés vagy a szabálykönyv-verzió változott (betöltéskor is: a kiírt értékek ellenőrzése).
const calcSig = new Map();  // lap-id → amiből legutóbb számoltunk
const sigOf = s => JSON.stringify([s.build, s.ov, s.inventory, rbInfo?.version ?? null]);
// szabálykönyv nélkül a faj, a háttér, az alosztály és a featek hatása hiányozna: ilyenkor a lapon tárolt értékek maradnak
function canCalc(s) {
  if (!s.auto || !rbInfo) return false;
  if (RB()?.classes?.length) return true;
  const b = s.build;
  return !b.race && !b.subrace && !b.background && !Object.keys(b.sub).length && !JSON.stringify(b.ch).includes('|') && !Object.keys(b.spells || {}).length;
}

// ---------- írás: helyben azonnal, a felhőbe mezőnként ----------
// a változott mezőket írja (auto lapnál a kézi átírás felülírásként, és ha kell, az újraszámolt mezőkkel együtt); false = nincs mit írni
function write(id, p) {
  const s = sheets.get(id);
  if (!s || !canEdit(s)) return false;
  if (sheetStale) { alert('Az oldal egy része régi változatból töltődött be, ezért nem mentettem.\nFrissítsd az oldalt (Ctrl + F5).'); return false; }
  let next = H.norm({...s, ...p, owner: s.owner});
  const keys = new Set(Object.keys(p));
  if (concBroken(next)) {
    next = H.norm({...next, concentration: '', conditions: H.dropConc(next.conditions, next.concentration)});
    keys.add('concentration'); keys.add('conditions');
  }
  if (next.auto) {
    const ov = H.ovEdits(s, next);
    if (Object.keys(ov).length) { next = H.norm({...next, ov: {...next.ov, ...ov}}); keys.add('ov'); }
    // a meglévő varázslatok besorolása a választási helyekre: egyszer, az első számolás előtt
    if (next.build.spells == null && RB()?.classes?.length && RB().spells?.length) { next = H.norm({...next, build: H.adoptSpells(next, RB())}); keys.add('build'); }
    if (canCalc(next) && sigOf(next) !== calcSig.get(id)) {
      const m = H.materialize(next, H.calc(next, RB()));
      next = H.norm({...next, ...m});
      Object.keys(m).forEach(k => keys.add(k));
      calcSig.set(id, sigOf(next));
    }
  }
  if (!keys.size) return false;
  const out = {};
  for (const k of keys) out[k] = next[k];
  next.updatedAt = out.updatedAt = new Date().toISOString(); next.updatedBy = out.updatedBy = me;
  sheets.set(id, next);
  try { window.KDB?.update(id, JSON.parse(JSON.stringify(out))); } catch {}
  if (['hp', 'ac', 'name', 'classes', 'conditions', 'effOff', 'exhaustion', 'inventory', 'abilities'].some(k => keys.has(k))) pubSheet(id, next);
  return true;
}
// a csapat felé látszó rész (characters/{id}) is frissül: HP, AC, név, szint
// az AC az aktív hatásokkal együtt (pl. Mage Armor, Shield of Faith)
// a HP csak akkor, ha a DM a nyilvános részbe is pontos HP-t ír: rejtett HP-nál (share.hp 'hidden', 2026-11-14) a DM hp: null-t ír, azt a telefon nem írja felül
function pubSheet(id, next) {
  const c0 = chars.find(c => c.id === id);
  if (!c0) return;
  const pub = {...(c0.hp ? {hp: {cur: next.hp.cur, max: next.hp.max}} : {}), ac: H.effects(next, RB()).ac, name: next.name, level: 'Szint ' + H.level(next)};
  try { window.KDB?.pub(id, pub); } catch {}
  chars = chars.map(c => c.id === id ? normChar({...c, ...pub}) : c);
}
// true, ha volt mit írni
function patch(p) { const ok = write(view.id, p); if (ok) render(true); return ok; }
// rövid visszajelzés a képernyő tetején (2,5 mp)
let toastTimer = null;
function toast(text, info = false) {
  const t = $('#toast'); t.textContent = text; t.className = info ? 'info' : ''; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}
// a Mentés csak a ténylegesen megváltozott mezőket küldi (a tisztítás utáni értékeket hasonlítja)
function changedOnly(s, p) {
  const n = H.norm({...s, ...p});
  return Object.fromEntries(Object.keys(p).filter(k => JSON.stringify(n[k]) !== JSON.stringify(s[k])).map(k => [k, p[k]]));
}
// a Mentés gomb visszajelzése (régi sheet.js mellett a write már szólt)
const savedToast = ok => { if (!sheetStale) toast(ok ? '✓ Elmentve' : 'Nem volt változás, nem kellett menteni.', !ok); };
// új koncentráció: ha már másra koncentrál, rákérdez (a régi spell nevével); a régi koncentrációs hatás lekerül. null = mégse
function concTo(s, name, p = {}) {
  const old = s.concentration, same = old && old.toLowerCase() === name.toLowerCase();
  if (old && !same && !confirm(`Most erre koncentrálsz: ${old}.\nHa ezt választod (${name}), a koncentráció megszakad. Folytatod?`)) return null;
  return {...p, concentration: name, conditions: same ? (p.conditions || s.conditions) : H.dropConc(p.conditions || s.conditions, old)};
}
// sebzés: koncentrációnál emlékeztető a CON mentőre (DC a sebzés fele, legalább 10)
function takeDamage(s, n) {
  patch(H.damage(s, n));
  const now = cur();
  if (now?.concentration) showRoll({label: 'Koncentráció: ' + now.concentration, total: 'DC ' + Math.max(10, Math.floor(n / 2)),
    detail: `CON mentő (${sgn(H.saveBonus(now, 'con'))}) – Képességek fül → CON mentő`}, false);
}
// 0 HP-n vagy cselekvésképtelen állapotban a koncentráció megszakad
const concBroken = s => !!s.concentration && (s.hp.cur === 0 || s.conditions.some(c => H.INCAP.includes(c)));
// felszerelés változása: a motoros lapnál a motor számol újra; a kézinél a fegyverek támadásként, páncél / pajzs esetén az AC is
function invPatch(s, inventory, it) {
  if (s.auto) return {inventory};
  return {inventory, ...H.equipPatch(H.norm({...s, inventory}), RB(), H.acItem(it && rbItem(it)))};
}
// a beérkező (vagy újonnan betöltött szabálykönyvvel számolandó) auto lapok újraszámolása; csak a változott mezők íródnak
function recalcAll() {
  let any = false;
  for (const [id, s] of sheets) if (canEdit(s) && ((canCalc(s) && sigOf(s) !== calcSig.get(id)) || concBroken(s))) any = write(id, {}) || any;
  return any;
}
const cur = () => sheets.get(view.id);
const pipToggle = (used, j) => used === j + 1 ? j : j + 1;  // az adott pöttyig minden elhasználva; ugyanarra még egyszer = egyel vissza

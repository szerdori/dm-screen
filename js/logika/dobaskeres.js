// Dobáskérés (logika, DOM nélkül): a DM a Csapat nézetből vagy az Initiative menüből dobást kér a játékosok telefonjára (TERV-dobaskeres.md).
// A kérés a lap rollReq mezőjébe megy (csak a DM írja); a válasz a lap rolls listájában jön vissza (req = a kérés azonosítója), a jatekosDobasok naplózza és ide adja; a ✕ a rollSkip-be.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('dobaskeres', N) és az index.html-ben a dobaskeres.js?v=N és a VART_MODULOK.
'use strict';
modul('dobaskeres', 1);

// a DM Screen memóriájában: a kérések (a DC csak itt van, a játékos nem látja); a legutóbbi a Csapat nézet állapotsora
let keresek = [];  // [{id, kind, label, mode, dc, ids, at}], legújabb elöl
const KERES_MAX = 20;
// kérhető-e a telefonról: van lapja, gazdája, nem törölt és nem készülő
const kerheto = id => { const s = SHEETS[id]; return !!s && !!s.owner && !s.deleted && !s.newChar; };
const keresKind = (tipus, k) => tipus === 'skill' ? `check:${SKILLS[k]}:${k}` : tipus === 'save' ? `save:${k}` : tipus === 'check' ? `check:${k}` : 'init';
const keresCimke = kind => kind === 'init' ? 'Initiative' : kind.startsWith('save:') ? ABIL_FULL[kind.slice(5)] + ' mentő' : kind.split(':')[2] ? skillLabel(kind.split(':')[2]) : ABIL_FULL[kind.slice(6)] + ' próba';
// a lény mentője: a tárolt érték (a 0 is), különben a képességmódosító
const mentoBonusz = (c, a) => c.saves?.[a] != null && c.saves[a] !== '' && Number.isFinite(+c.saves[a]) ? +c.saves[a] : mod(c.abilities[a]);
// a DM-oldali bónusz (annak, akinek nincs telefonos lapja: a DM Screen dob helyette, mint eddig)
function keresBonusz(c, kind) {
  if (kind === 'init') return initBonusOf(c);
  const [t, a, sk] = kind.split(':');
  return t === 'save' ? mentoBonusz(c, a) : sk ? partySkill(c, sk).b : mod(c.abilities[a]);
}
// dobáskérés: ids = könyvtári azonosítók; mode = '' | adv | dis; dc = szám vagy null.
// Visszatér: {keres, helyben: [rollHit eredmények azoknak, akiknek nincs telefonos lapjuk]} (null, ha régi közös fájl miatt nem írhat)
function dobastKer(ids, kind, mode = '', dc = null) {
  if (regiFajl()) return null;
  const at = new Date().toISOString(), by = authInfo.email || 'DM', label = keresCimke(kind);
  const keres = {id: uid(), kind, label, mode: ['adv', 'dis'].includes(mode) ? mode : '', dc: Number.isFinite(dc) ? dc : null, ids: [], at};
  const helyben = [];
  for (const id of ids) {
    const c = S.library.find(x => x.id === id);
    if (!c) continue;
    if (!kerheto(id) && kind === 'init') continue;  // Initiative: annak, akinek nincs lapja, a DM írja be, mint eddig
    if (!kerheto(id)) { helyben.push(rollHit(sgn(keresBonusz(c, kind)), c.name, label + dcSzoveg(keres.dc), keres.mode)); continue; }
    const rollReq = Sheet.normRollReq({id: keres.id, kind, label, mode: keres.mode, by, at});
    keres.ids.push(id);
    SHEETS[id] = Sheet.norm({...SHEETS[id], rollReq});
    if (Tar.kapcsolva()) Tar.lapok.mezok(id, {rollReq, updatedAt: at, updatedBy: by}).catch(e => Ertesito.naplo(`⚠ ${esc(c.name)}: a dobáskérés nem ment el (${esc(e.code || e.message)}).`, 'warn'));
  }
  if (keres.ids.length) {
    keresek = [keres, ...keresek].slice(0, KERES_MAX);
    Ertesito.naplo(`📱 Dobáskérés: <b>${esc(label)}</b>${keres.mode === 'adv' ? ' (előnnyel)' : keres.mode === 'dis' ? ' (hátránnyal)' : ''}${dcSzoveg(keres.dc)} – ${keres.ids.map(id => esc(SHEETS[id].name)).join(', ')}`);
  }
  return {keres: keres.ids.length ? keres : null, helyben};
}
const dcSzoveg = dc => dc != null ? ` (DC ${dc})` : '';
// a kérés visszavonása: akinél még vár, onnan törlődik
function keresVisszavon(keresId) {
  const k = keresek.find(x => x.id === keresId);
  if (!k || regiFajl()) return false;
  const at = new Date().toISOString(), by = authInfo.email || 'DM';
  for (const id of k.ids) if (SHEETS[id]?.rollReq?.id === keresId) {
    SHEETS[id] = Sheet.norm({...SHEETS[id], rollReq: null});
    if (Tar.kapcsolva()) Tar.lapok.mezok(id, {rollReq: null, updatedAt: at, updatedBy: by}).catch(() => {});
  }
  k.visszavonva = true;
  return true;
}
// ki hol tart: dobott (az eredménnyel), vár, kihagyta (✕ a telefonon), lejárt
function keresAllas(k, most = Date.now()) {
  const out = {dobott: [], var: [], kihagyta: [], lejart: []};
  for (const id of k.ids) {
    const s = SHEETS[id];
    if (!s) continue;
    const r = s.rolls.find(x => x.req === k.id);
    if (r) out.dobott.push({id, name: s.name, total: r.total});
    else if (s.rollSkip === k.id) out.kihagyta.push({id, name: s.name});
    // vár, amíg él a kérés a lapon; ha lejárt, visszavonták, vagy egy újabb kérés váltotta, akkor lejárt
    else (s.rollReq?.id === k.id && Sheet.reqAktiv(s.rollReq, most) && !k.visszavonva ? out.var : out.lejart).push({id, name: s.name});
  }
  return out;
}
// a jatekosDobasok hívja minden új, kérésre jött dobásnál: Initiative a harcba; DC-nél siker / kudarc a naplósorhoz
function keresValasz(id, r) {
  const k = keresek.find(x => x.id === r.req);
  if (!k || !k.ids.includes(id)) return '';
  if (k.kind === 'init') {
    const n = parseInt(r.total);
    let volt = false;
    if (Number.isFinite(n)) for (const x of S.enc.list) if (x.c.libId === id) { x.init = n; volt = true; }
    if (volt) save();
    return volt ? ' → Initiative beírva' : '';
  }
  const n = parseInt(r.total);
  return k.dc == null ? '' : !Number.isFinite(n) ? ' ✖' : n >= k.dc ? ` ✔ (DC ${k.dc})` : ` ✖ (DC ${k.dc})`;
}
// Initiative a telefonról: az ellenfelek és NPC-k dobnak (mint eddig), a harcban lévő játékosoktól kér; akinek nincs lapja, annak a DM írja be
function initTelefonrol() {
  rollInitiative('monsters');
  const ids = [...new Set(S.enc.list.filter(x => x.c.kind === 'pc' && x.c.libId).map(x => x.c.libId))];
  return ids.length ? dobastKer(ids, 'init') : null;
}

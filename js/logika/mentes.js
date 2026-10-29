// Mentés és betöltés (logika, DOM nélkül): változott dokumentumok írása a Tar-on át, helyi másolat, mentésfájl, napi felhős mentések, mentett encounterek.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('mentes', N) és az index.html-ben a mentes.js?v=N és a VART_MODULOK.
'use strict';
modul('mentes', 1);

// ---------- mentés: Firebase (Firestore), plusz másolat a böngészőben ----------
// A felhőbe a Tar (js/adat/tar.js) ír: állapot (encounter + beállítások), könyvtár, mentett encounterek, és a játékos appnak
// a karakterek nyilvános része meg a játékosok e-mailjei. Az útvonalak és a formák: szerzodes.js / SZERZODES.md.
// Mindig csak a megváltozott dokumentumokat írjuk.
let saveTimer = null, authInfo = {status: 'loading'};
const emptySaved = () => ({state: '', lib: {}, saved: {}, pub: {}, players: '[]'});
let lastSaved = emptySaved();
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 400); }
function ensureIds() { S.saved.forEach(e => { if (!e.id) e.id = uid(); }); }
// van-e felhős kapcsolat (belépve) – a felület ezt kérdezi, nem közvetlenül a Tar-t
const felhoben = () => Tar.kapcsolva();
// kulcssorrendtől független JSON (a Firestore más sorrendben adja vissza a mezőket)
const stableJson = v => JSON.stringify(v, (k, x) => isObj(x) ? Object.fromEntries(Object.keys(x).sort().map(n => [n, x[n]])) : x);
// egy gyűjtemény (Tar.konyvtar, Tar.mentett, Tar.karakterek) szinkronja: csak a változott és a törölt dokumentumok
function syncCol(gyujt, arr, key, ops, ser = JSON.stringify) {
  const seen = {}, prev = lastSaved[key] || {};
  for (const it of arr) {
    const j = ser(it); seen[it.id] = j;
    if (prev[it.id] !== j) ops.push(gyujt.ir(it.id, JSON.parse(j)));
  }
  for (const id of Object.keys(prev)) if (!(id in seen)) ops.push(gyujt.torol(id));
  lastSaved[key] = seen;
}
// ---------- játékos app: ami a játékosok telefonján látszik ----------
// a karakter nyilvános része (characters/{id}) a könyvtárból: js/adat/tar.js (Tar.karakterek.nyilvanosResz)
const hpStatus = Sheet.hpStatus;  // ma csak a tesztek használják (W.hpStatus)
function publicChars() { return Tar.karakterek.nyilvanosResz(S.library); }
const playerEmails = () => [...new Set(S.library.filter(c => c.owner).map(c => c.owner))].sort();
function syncSharing(ops) {
  syncCol(Tar.karakterek, publicChars(), 'pub', ops, stableJson);
  const pl = JSON.stringify(playerEmails());
  if (pl !== lastSaved.players) { ops.push(Tar.jatekosok.ir(JSON.parse(pl))); lastSaved.players = pl; }
}
const sharingDirty = () => { const now = publicChars(), prev = lastSaved.pub || {};
  return JSON.stringify(playerEmails()) !== lastSaved.players || now.length !== Object.keys(prev).length || now.some(p => prev[p.id] !== stableJson(p)); };

async function doSave() {
  saveTimer = null;
  ensureIds();
  const ops = [];
  syncSheets(ops);
  try { localStorage.setItem(HELYI.allapot, JSON.stringify(S)); } catch {}
  if (!Tar.kapcsolva()) { setSaveState(authInfo.status === 'unconfigured' ? '✓ böngészőben mentve' : ''); return; }
  try {
    const state = JSON.stringify({enc: S.enc, settings: S.settings});
    if (state !== lastSaved.state) { ops.push(Tar.allapot.ir(JSON.parse(state))); lastSaved.state = state; }
    syncCol(Tar.konyvtar, S.library, 'lib', ops);
    syncCol(Tar.mentett, S.saved, 'saved', ops);
    syncSharing(ops);
    if (!ops.length) return;
    setSaveState(navigator.onLine ? 'mentés…' : '⚠ nincs internet – a változások később töltődnek fel');
    await Promise.all(ops);
    setSaveState('✓ mentve');
  } catch (e) {
    lastSaved = {...emptySaved(), players: ''};  // legközelebb mindent újraírunk
    setSaveState('⚠ mentés sikertelen' + (e.code ? ' (' + e.code + ')' : ''));
  }
}
function applyLoaded(d) { S = sanitizeState({...S, ...d}, S.settings); }
// teljes mentésfájl visszatöltése (Menü → Importálás)
function importBackup(obj) {
  if (!isObj(obj) || !Array.isArray(obj.library) || !isObj(obj.enc)) throw new Error('Ez nem teljes DM Screen mentés');
  applyLoaded(obj); restoreSheets(obj.sheets); selected = null;
  save(); render();
}
function loadLocal() {
  try { const t = localStorage.getItem(HELYI.allapot); if (t) applyLoaded(JSON.parse(t)); } catch {}
  try {
    const t = localStorage.getItem(HELYI.lapok), o = t ? JSON.parse(t) : null;
    if (isObj(o)) restoreSheets(Object.entries(o).map(([id, s]) => ({...s, id})));
  } catch {}
}
async function loadFromDb() {
  const [st, lib, saved, pub, players, sheets] = await Promise.all([Tar.allapot.olvas(), Tar.konyvtar.lista(), Tar.mentett.lista(),
    Tar.karakterek.lista(), Tar.jatekosok.olvas(),
    // ha a konzolban még a régi szabályok vannak, a lapok nélkül is betölt (a Menü szól)
    Tar.lapok.lista().then(l => { sheetsWarn = ''; return l; }, e => { sheetsWarn = e.code || e.message; return []; })]);
  lastSaved = emptySaved();
  pub.forEach(p => lastSaved.pub[p.id] = stableJson(p));
  if (Array.isArray(players?.emails)) lastSaved.players = JSON.stringify(players.emails);
  SHEETS = {}; shadow = {}; cshadow = {}; sheetOps = {set: new Set(), del: new Set()};
  if (st || lib.length || saved.length) {
    applyLoaded({...(st || {}), library: lib, saved});
    lastSaved.state = JSON.stringify({enc: S.enc, settings: S.settings});
    S.library.forEach(c => lastSaved.lib[c.id] = JSON.stringify(c));
    S.saved.forEach(e => lastSaved.saved[e.id] = JSON.stringify(e));
    // a telefonon azóta történt változások (HP, felszerelés…) a könyvtárba és a harcba
    for (const d of sheets) if (/^[A-Za-z0-9_-]{1,64}$/.test(d.id)) { SHEETS[d.id] = Sheet.norm(d); applySheet(d.id); }
    if (sharingDirty() || S.library.some(c => lastSaved.lib[c.id] !== JSON.stringify(c))) save();  // pl. az első indításkor még nincs közzétéve semmi
  } else {
    // üres a felhő: ha ebben a böngészőben van korábbi adat, azt töltjük fel
    // (így költözik át az adat az új Firebase-projektbe is)
    loadLocal();
    if (S.library.length || S.enc.list.length || S.saved.length) save();
  }
}
// ---------- biztonsági mentések ----------
// 1) Felhőben: naponta az első betöltéskor egy pillanatkép (dmscreen_backup/{nap}), az utolsó 14 marad meg.
//    A lista egy kis tartalomjegyzékben van (dmscreen/backups), hogy induláskor ne kelljen mindet letölteni.
// 2) Fájlba: a fejléc emlékeztet, ha 7 napja nem volt Exportálás (ez a Firebase-től független másolat).
const BACKUP_KEEP = 14, BACKUP_MAX = 900000, EXPORT_DAYS = 7;
let backupWarn = '';
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hasData = () => S.library.length || S.enc.list.length || S.saved.length;
async function backupIndex() { const d = await Tar.mentesek.tartalom(); return Array.isArray(d?.items) ? d.items : []; }
async function addBackup(id, note, idx) {
  idx = idx || await backupIndex();
  const data = JSON.stringify({library: S.library, saved: S.saved, enc: S.enc, settings: S.settings, sheets: sheetList()});
  if (data.length > BACKUP_MAX) { backupWarn = 'A felhős biztonsági mentés kimaradt, mert túl nagy az adat (valószínűleg sok feltöltött portré). Mentsd fájlba rendszeresen!'; return false; }
  await Tar.mentesek.ir(id, data);
  idx = [{id, note, createdAt: new Date().toISOString(), library: S.library.length, saved: S.saved.length}, ...idx.filter(b => b.id !== id)]
    .sort((a, b) => b.id.localeCompare(a.id));
  for (const b of idx.slice(BACKUP_KEEP)) await Tar.mentesek.torol(b.id);
  await Tar.mentesek.tartalomIr(idx.slice(0, BACKUP_KEEP));
  backupWarn = '';
  return true;
}
async function dailyBackup() {
  if (!Tar.kapcsolva() || !hasData()) return;
  try {
    const idx = await backupIndex();
    if (!idx.some(b => b.id === localDate())) await addBackup(localDate(), 'napi', idx);
  } catch (e) { backupWarn = 'Nem sikerült a napi biztonsági mentés (' + (e.code || e.message) + ').'; }
}
const timeStamp = () => { const d = new Date(); return localDate(d) + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); };
async function restoreBackup(id) {
  const doc = await Tar.mentesek.olvas(id);
  if (typeof doc?.data !== 'string') throw new Error('a mentés nem található');
  const parsed = JSON.parse(doc.data);
  await addBackup(timeStamp() + '-elotte', 'visszaállítás előtt');  // a mostani állapotot is megőrizzük
  applyLoaded(parsed); restoreSheets(parsed.sheets); selected = null;
  save(); render();
}

// Telefonos karakterlap (lap-elozmenyek, a karakter.html része): backup, előzmények, visszaállítás, törlés
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-elozmenyek', N) és a karakter.html-ben a lap-elozmenyek.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-elozmenyek', 1);

// ---------- backup és előzmények: kézi mentés, teljes visszaállítás, letöltés; a legfrissebb szintlépés külön visszavonható ----------
const histCache = new Map();  // lap-id → lista (legfrissebb elöl) | 'hiba'
const HOW_HU = {avg: 'átlag', roll: 'dobás', manual: 'kézi'}, HIST_HU = {levelup: 'Szintlépés', restore: 'Visszaállítás', manual: 'Backup'};
function histLoad(id) {
  if (!window.KDB?.histList) return;
  histCache.set(id, null);
  window.KDB.histList(id).then(list => { histCache.set(id, list.map(d => ({...H.normHist(d), id: String(d.id)})).sort((a, b) => (a.id < b.id ? 1 : -1))); },
    e => { console.warn('az előzmények betöltése nem sikerült:', e.code || e.message); histCache.set(id, 'hiba'); }).then(() => { if (view.id === id) render(); });
}
function histBox(s) {
  if (openKeys.has('hist') && !histCache.has(view.id)) histLoad(view.id);
  const all = histCache.get(view.id), list = Array.isArray(all) ? all.slice(0, H.HIST_MAX) : all, L = H.level(s);
  // a szintlépés visszavonható, amíg nem jött újabb szintlépés vagy visszaállítás (a kézi mentés nem számít)
  const canUndo = h => h === list.find(x => x.reason !== 'manual') && h.reason === 'levelup' && h.to === L;
  const cim = h => h.reason === 'manual' ? `${HIST_HU.manual}: ${h.to}. szint` : `${HIST_HU[h.reason]}: ${h.from} → ${h.to}`;
  const row = h => `<div class="li"><span class="nm"><b>${esc(cim(h))}</b><small>${esc(h.at ? new Date(h.at).toLocaleString('hu-HU') : '')}${h.hp ? ' · HP: ' + esc(HOW_HU[h.hp]) : ''}${isDM ? ' · ' + esc(h.by) : ''}</small></span>
    ${canUndo(h) ? `<button class="small" data-act="histRestore" data-h="${esc(h.id)}" title="Csak a felépítés jön vissza, a felszerelés, a pénz és a jegyzet marad">↩ Szintlépés visszavonása</button>` : ''}
    ${isDM || H.backupAllowed(s, h) ? `<button class="small" data-act="histFull" data-h="${esc(h.id)}" title="A teljes lap visszajön">Visszaállítás</button>` : ''}
    <button class="small" data-act="histDl" data-h="${esc(h.id)}" title="Letöltés JSON-ként">⬇</button></div>`;
  const body = list === 'hiba' ? '<p class="hint">Nem sikerült betölteni (lehet, hogy a DM-nek frissítenie kell a szabályokat).</p>'
    : list ? (list.length ? `<div class="list" style="margin-top:8px">${list.map(row).join('')}</div>` : '<p class="hint">Még nincs backup.</p>') : '<p class="hint">Betöltés…</p>';
  return `<div data-hist="1">${det('hist', '<b>💾 Backup és előzmények</b>', `<div class="row" style="margin-top:8px"><button class="small" data-act="histSave">💾 Backup most</button><button class="small" data-act="lapDl">⬇ A mostani lap letöltése</button></div>
    ${body}<p class="hint" style="margin:6px 0 0">Szintlépés előtt magától is készül backup. A legfrissebb ${esc(H.HIST_MAX)} marad meg. A visszaállítás a teljes lapot hozza vissza (felszerelés, pénz, jegyzet, HP), előtte a mostani állapotról is backup készül. A letöltött fájlban a játékos e-mailje is benne van; a DM a Könyvtár → JSON fülön töltheti vissza.</p>`)}</div>`;
}
// fájl mentése a telefonra / gépre
function download(name, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'}));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// karakter törlése (a piros gomb): a gazda lekerül a lapról és a nyilvános részről, a játékos nem látja többé; a DM a Könyvtárban visszahozhatja vagy véglegesen törölheti
async function lapTorol(s) {
  const id = view.id, pub = chars.find(c => c.id === id);
  if (!confirm(`Biztosan törlöd: ${s.name}?\nEzután ${isDM ? 'a játékos' : 'te'} nem ${isDM ? 'látja' : 'látod'} a karaktert, és a csapat sem. A DM még látja, és vissza tudja hozni.`)) return;
  const at = new Date().toISOString(), p = {...H.torlesPatch(s, {by: me, at, vis: pub?.visibility}), updatedAt: at, updatedBy: me};
  if (!await biztosIr(() => window.KDB.softDelete(id, JSON.parse(JSON.stringify(p)), pub ? {owner: '', visibility: 'dm'} : null))) return;
  draft = null; luDrop(id);
  if (isDM) { sheets.set(id, H.norm({...s, ...p})); chars = chars.filter(c => c.id !== id); render(true); toast('✓ Törölve: a játékos már nem látja'); return; }
  sheets.delete(id); chars = chars.filter(c => c.id !== id);
  location.hash = ''; route();
  toast('✓ A karakter törölve');
}
// átállítás a szabálymotorra: előtte mentés készül, így a DM vissza tudja hozni a kézi lapot. Hibánál semmi nem íródik, és az űrlap piszkozata is megmarad
async function toAutoMent(s) {
  const id = view.id;
  try {
    const p = H.toAuto(s, RB()), at = new Date().toISOString(), L = H.level(s);
    if (!await saveWithHist(id, {updatedAt: at, updatedBy: me}, {at, by: me, reason: 'manual', from: L, to: L, sheet: s})) return;
    histCache.delete(id); draft = null;
    if (view.id === id) patch(p); else write(id, p);
  } catch (err) { console.error(err); alert('Az átállítás nem sikerült, a lapon nem változott semmi.\nFrissítsd az oldalt (Ctrl + F5), és próbáld újra.\n\nHiba: ' + err.message); render(true); }
}
// kézi backup: csak pillanatkép, a lap nem változik
async function histMent(s) {
  const at = new Date().toISOString(), L = H.level(s), id = view.id, utolso = histCache.get(id)?.[0];
  // egyforma mentés ne szorítsa ki a régebbieket a 3-as keretből
  const alak = x => H.stableJson({...x, updatedAt: '', updatedBy: ''});
  if (utolso?.sheet && alak(utolso.sheet) === alak(s)) { toast('Az utolsó backup óta nem változott a lap.', true); return; }
  if (!await saveWithHist(id, {updatedAt: at, updatedBy: me}, {at, by: me, reason: 'manual', from: L, to: L, sheet: s})) return;
  histCache.delete(id); openKeys.add('hist'); render();
  toast('✓ Backup elkészült');
}
// teljes visszaállítás egy előzményből; előtte a mostani állapotról is pillanatkép készül
async function histFull(s, h) {
  const lv = h.sheet.build?.levels?.length || H.level(h.sheet), id = view.id;
  if (!confirm(`Visszaállítod a teljes lapot erre az állapotra (${lv}. szint, ${h.at ? new Date(h.at).toLocaleString('hu-HU') : ''})?\nA felszerelés, a pénz, a jegyzet és a HP is visszajön. Előtte a mostani állapotról backup készül.`)) return;
  const at = new Date().toISOString();
  let p;
  try { p = {...H.backupPatch(s, h, RB(), {by: me, at}), updatedAt: at, updatedBy: me}; }
  catch (err) { console.error(err); alert('A visszaállítás nem sikerült, a lapon nem változott semmi.\n\nHiba: ' + err.message); return; }
  if (!await saveWithHist(id, p, {at, by: me, reason: 'restore', from: H.level(s), to: lv, sheet: s})) return;
  afterSave(id, s, p, at);
  draft = null; histCache.delete(id); luDrop(id);
  render(true); toast('✓ Visszaállítva');
}
async function histRestore(s, h) {
  if (!RB()?.classes?.length) { alert('A visszaállításhoz a szabálykönyv kell: várd meg, amíg betöltődik.'); return; }
  const lv = h.sheet.build?.levels?.length || H.level(h.sheet);
  if (!confirm(`Visszavonod a szintlépést, és visszaállsz a ${lv}. szintre (${h.at ? new Date(h.at).toLocaleString('hu-HU') : ''})?\nA felszerelés, a pénz, a jegyzet és az állapotok maradnak.`)) return;
  const at = new Date().toISOString();
  let p;
  try { p = {...H.restorePatch(s, h, RB(), {by: me, at}), updatedAt: at, updatedBy: me}; }
  catch (err) { console.error(err); alert('A visszavonás nem sikerült, a lapon nem változott semmi.\n\nHiba: ' + err.message); return; }
  if (!await saveWithHist(view.id, p, {at, by: me, reason: 'restore', from: H.level(s), to: lv, sheet: s})) return;
  afterSave(view.id, s, p, at);
  histCache.delete(view.id); luDrop(view.id);
  render(true); toast('✓ Visszaállítva');
}
// számolt érték sora: érték, ℹ bontás, ✎ felülírás (üres = a számolt érték), ↺ visszaállítás
function ovRow(s, key, label, x, kind = 'num') {
  const isOv = key in s.ov;
  const shown = kind === 'save' ? (x.prof ? '● ' : '') + sgn(x.v) : kind === 'skill' ? PROF_MARK[x.prof] + ' ' + sgn(x.v) : x.v;
  const parts = (x.parts || []).map(p => `<li>${esc(typeof p.v === 'number' ? sgn(p.v) : p.v)} – ${esc(p.src)}</li>`).join('');
  const cur = isOv ? s.ov[key] : '';
  const opt = (v, l) => `<option value="${v}" ${isOv && String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;
  const edit = kind === 'save' ? `<select data-ov="${esc(key)}">${opt('', '(számolt)')}${opt(0, 'nem jártas')}${opt(1, 'jártas')}</select>`
    : kind === 'skill' ? `<select data-ov="${esc(key)}">${opt('', '(számolt)')}${opt(0, '–')}${opt(0.5, 'fél (½)')}${opt(1, 'jártas')}${opt(2, 'expertise')}</select>`
    : `<input data-ov="${esc(key)}" ${kind === 'num' ? 'type="number" inputmode="numeric"' : ''} value="${esc(cur)}" placeholder="számolt: ${esc(x.calc ?? x.v)}">`;
  return det('ov:' + key, `<span class="nm"><b>${esc(label)}</b>${isOv ? ` <span class="warn" title="kézzel felülírva">✎</span>${x.calc != null && x.calc !== x.v ? `<small>számolt: ${esc(x.calc)}</small>` : ''}` : ''}</span><b>${esc(shown)}</b>`,
    `${parts ? `<div class="hint" style="margin-top:6px">ℹ Bontás</div><ul class="parts">${parts}</ul>` : ''}
    <div class="row" style="margin-top:8px"><label class="hint grow">✎ Felülírás${edit}</label>${kind === 'text' ? iGomb(H.MEZO_INFO.speed) : ''}${isOv ? `<button class="small" data-act="ovReset" data-key="${esc(key)}">↺ számolt</button>` : ''}</div>
    ${kind === 'skill' && isOv && x.prof === 2 && s.ov[key] < 2 ? '<p class="hint" style="margin:4px 0 0">A jártasság kézi, az expertise a Felépítés választásából jön: levenni ott lehet.</p>' : ''}`);
}

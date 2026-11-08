// Telefonos karakterlap (lap-dobas, a karakter.html része): kockadobás, a DM dobáskérése, dobógombok
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-dobas', N) és a karakter.html-ben a lap-dobas.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-dobas', 1);

// ---------- kocka (az rnd a kozos.js-ben: kriptográfiai véletlen) ----------
function rollExpr(expr, crit = false) {
  let total = 0; const parts = [];
  for (const m of String(expr).replace(/−/g, '-').replace(/\s+/g, '').matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/gi)) {
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3]) {
      const n = Math.min(100, (+m[2] || 1) * (crit ? 2 : 1)), d = Math.max(1, +m[3]), r = [];
      for (let i = 0; i < n; i++) r.push(rnd(d));
      total += sign * r.reduce((a, b) => a + b, 0); parts.push((sign < 0 ? '−' : '') + '[' + r.join(',') + ']');
    } else { total += sign * +m[4]; parts.push((sign < 0 ? '−' : '+') + m[4]); }
  }
  return {total, detail: parts.join(' ')};
}
// kuld = false: csak üzenet (cast, koncentráció-DC), nem dobás – a DM Screenre nem megy
function showRoll(r, kuld = true) {
  rolls.unshift(r); rolls = rolls.slice(0, 20);
  const el = $('#lastRoll');
  el.className = r.nat === 20 ? 'crit' : r.nat === 1 ? 'fumble' : '';
  el.innerHTML = `<b>${esc(r.total)}</b><span>${esc(r.label)} · ${esc(r.detail)}${r.nat === 20 ? ' · természetes 20!' : r.nat === 1 ? ' · természetes 1' : ''}</span>`;
  if (kuld) dobasKuld(r);
}
// a dobás a lapra is felkerül (rolls, legújabb elöl, legfeljebb H.ROLLS_MAX): a DM Screen naplójában a karakter nevével látszik
function dobasKuld(r) {
  const s = cur();
  if (!s || !canEdit(s) || sheetStale) return;
  // a DM kérésére dobott dobás a kérés azonosítójával megy (ebből tudja a DM és a telefon, hogy megválaszolta); a kérést csak a DM írja
  const kert = kertDobas?.id === view.id ? kertDobas.req : '';
  const uj = H.normRoll({...r, at: new Date().toISOString(), req: kert});
  write(view.id, {rolls: [uj, ...(s.rolls || [])].slice(0, H.ROLLS_MAX)});
}
// ---------- dobáskérés a DM-től (TERV-dobaskeres.md): felugró ablak, egy koppintás a dobás ----------
// csak a saját (gazdaként hozzám rendelt) lapon; a DM a telefonos lapon nem kap felugró ablakot. 10 perc után lejár.
let kertDobas = null;  // {id: lap, req: kérés} – amíg a kért dobás tart
const keresElvetve = new Set();  // 'lap|kérés': a ✕ azonnal eltünteti, az írás visszhangja előtt is
let keresIdozito = null;  // a lejáratkor eltünteti az ablakot
function nyitottKeres() {
  if (!me) return null;
  for (const [id, s] of sheets) {
    const q = s.rollReq;
    if (s.owner === me && !s.deleted && q && H.reqAktiv(q) && s.rollSkip !== q.id && !s.rolls.some(r => r.req === q.id) && !keresElvetve.has(id + '|' + q.id)) return {id, s, q};
  }
  return null;
}
function keresAblak() {
  const el = $('#keresPop'), k = nyitottKeres();
  clearTimeout(keresIdozito);
  el.hidden = !k;
  if (!k) { el.innerHTML = ''; el.dataset.html = ''; return; }
  keresIdozito = setTimeout(keresAblak, Math.max(1000, Date.parse(k.q.at) + H.REQ_TTL_MS - Date.now() + 50));
  const {bonus, label} = H.reqRoll(k.s, k.q.kind);
  const tobb = [...sheets.values()].filter(s => s.owner === me && !s.deleted).length > 1;
  const html = `<div class="ibox"><h3>🎲 A DM dobást kért tőled</h3>${tobb ? `<div class="muted">${esc(k.s.name)}</div>` : ''}
    <div class="kerdob"><b>${esc(label)} ${esc(sgn(bonus))}</b>${k.q.mode === 'adv' ? '<br><small>előnnyel</small>' : k.q.mode === 'dis' ? '<br><small>hátránnyal</small>' : ''}</div>
    <div class="row"><button class="primary" data-act="keresDob" data-id="${esc(k.id)}">🎲 Dobok</button><button data-act="keresElvet" data-id="${esc(k.id)}" title="Nem érint (pl. nem vagy ott)">✕</button></div></div>`;
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }  // csak ha változott: egy koppintás közbeni újrarajzolás ne nyelje el a kattintást
}
function keresDob(id) {
  const s = sheets.get(id), q = s?.rollReq;
  if (!s || !q || !canEdit(s) || !H.reqAktiv(q)) { keresAblak(); return; }
  if (view.id !== id) { location.hash = '#lap/' + id; route(); }  // a lapon dob (a hatások és az eredmény helye miatt)
  const {bonus, label} = H.reqRoll(s, q.kind);
  keresElvetve.add(id + '|' + q.id);  // ha az írás nem sikerül (régi fájl), akkor se ugorjon fel újra
  kertDobas = {id, req: q.id};
  setMode(q.mode);  // a DM előnye / hátránya; a lap hatásai a rollD20-ban jönnek hozzá
  try { rollD20(bonus, label, q.kind); } finally { kertDobas = null; }
  keresAblak();
}
function keresElvet(id) {
  const s = sheets.get(id), q = s?.rollReq;
  if (q) { keresElvetve.add(id + '|' + q.id); if (canEdit(s) && !sheetStale) write(id, {rollSkip: q.id}); }
  keresAblak();
}
function setMode(m) { rollMode = m; document.querySelectorAll('#rollbar [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); }
// előny / hátrány / krit: egy dobásra szól, utána visszaáll normálra
// kind: a dobás fajtája ('atk', 'check:dex:stealth', 'save:wis', 'init'); az aktív hatások (állapotok, spellek) ez alapján adnak
// előnyt / hátrányt / automatikus kudarcot / plusz kockát (pl. Poisoned, Rage, Bless). Az előny és a hátrány kioltja egymást.
const curFx = kind => { const s = cur(); return s && kind ? H.rollFx(H.effects(s, RB()), kind) : {adv: [], dis: [], fail: [], bonus: []}; };
function rollD20(bonus, label, kind = '') {
  const f = curFx(kind), manual = rollMode === 'adv' || rollMode === 'dis' ? rollMode : '';
  if (manual) setMode('');
  if (f.fail.length) { const r = {label, total: '✗', detail: 'automatikus kudarc (' + f.fail.join(', ') + ')'}; showRoll(r); return r; }
  const adv = manual === 'adv' || f.adv.length > 0, dis = manual === 'dis' || f.dis.length > 0, mode = adv && !dis ? 'adv' : dis && !adv ? 'dis' : '';
  const a = rnd(20), b = rnd(20), nat = mode === 'adv' ? Math.max(a, b) : mode === 'dis' ? Math.min(a, b) : a;
  const why = [f.adv.length ? 'előny: ' + f.adv.join(', ') : '', f.dis.length ? 'hátrány: ' + f.dis.join(', ') : ''].filter(Boolean).join('; ');
  let total = nat + bonus, extra = '';
  for (const x of f.bonus) { const e = rollExpr(x.v); total += e.total; extra += ` ${x.v.startsWith('-') ? '' : '+'}${x.v} ${x.src} ${e.detail}`; }
  const r = {label, total, nat, detail: (mode || adv || dis ? `[${a}, ${b}] ${mode === 'adv' ? 'előny' : mode === 'dis' ? 'hátrány' : 'normál'}` : `[${a}]`) + ` ${sgn(bonus)}${extra}${why ? ' · ' + why : ''}`};
  showRoll(r); return r;
}
// kind: 'wdmg' (fegyver) vagy 'wdmg:melee' (közelharci) – a fegyversebzést növelő hatások (Rage, Hunter's Mark…) hozzáadódnak
// fx = {dt, dk}: a sebzés típusa és a támadás fajtája (Sheet.DMG_TYPES / DMG_KINDS) – a DM Screen ebből ír flavour textet (TERV-flavour.md)
function rollDamage(expr, label, kind = '', fx = {}) {
  const crit = rollMode === 'crit', r = rollExpr(expr, crit), s = cur();
  if (crit) setMode('');
  let total = r.total, detail = `${expr}: ${r.detail}`;
  if (s && kind.startsWith('wdmg')) for (const x of H.effects(s, RB()).dmg) {
    if (x.melee && kind !== 'wdmg:melee') continue;
    const e = rollExpr(x.v, crit && /d/.test(x.v)); total += e.total; detail += ` ${x.v.startsWith('-') ? '' : '+'}${x.v} ${x.src} ${e.detail}`;
  }
  const out = {label: label + (crit ? ' (krit)' : ''), total, detail, ...(fx.dt ? {dt: fx.dt} : {}), ...(fx.dk ? {dk: fx.dk} : {})};
  showRoll(out); return out;
}
const rollBtn = (bonus, label, text = sgn(bonus), kind = '') => `<button class="rb" data-act="d20" data-bonus="${esc(bonus)}" data-label="${esc(label)}" data-kind="${esc(kind)}">${esc(text)}</button>`;
const dmgBtn = (expr, label, kind = '', fx = {}) => `<button class="rb" data-act="dmg" data-expr="${esc(expr)}" data-label="${esc(label)}" data-kind="${esc(kind)}" data-dt="${esc(fx.dt || '')}" data-dk="${esc(fx.dk || '')}">${esc(expr)}</button>`;
// a flavour texthez (TERV-flavour.md): a varázslat támadásfajtája a leírásából, a támadássoré a nevéből (természetes fegyver, varázslat, távolsági fegyver)
const varazsFajta = tx => /melee spell attack/i.test(tx || '') ? 'ms' : /spell attack/i.test(tx || '') ? 'rs' : /saving throw/i.test(tx || '') ? 'sv' : 'sp';
function tamadasFx(s, a) {
  const sp = s.spells.find(x => x.name.toLowerCase() === a.name.toLowerCase()), r = sp && rbSpell(sp);
  const dk = sp ? varazsFajta(r?.tx) : H.fegyverFajta(a.name, a.note);  // ugyanaz a döntés, mint a DM Screenen (sheet.js)
  return {dt: H.dmgType(a.dmg + ' ' + a.note) || H.dmgType(r?.tx), dk};
}
// sebzés-szövegből a kocka (pl. „1d8+3 slashing” → 1d8+3)
const diceOf = t => (String(t).replace(/−/g, '-').match(/\d*d\d+(?:\s*[+-]\s*\d+(?!\s*d))*/i) || [''])[0].replace(/\s/g, '');

// DM Screen – regressziós tesztek: a keret (mini tesztkeret, közös segédek, a futtató). Az indítás: tests/indit.js.
// Futtatás: a projekt gyökerében  .\teszt.ps1   (vagy böngészőben: tests/index.html, helyi szerverről)
// A tesztek témánként a tests/csoportok/*.js fájlokban vannak (a tests/index.html sorrendjében töltődnek, a tesztek is ebben a sorrendben futnak).
// Új teszt: keresd meg a megfelelő describe(...) blokkot, és adj hozzá egy test('név', async () => { ... }) sort.
// Új csoportfájl: <script src> a tests/index.html-ben (az indit.js elé), a fájl elején 'use strict'.
// Segédek: A('kód') = kód futtatása az app ablakában (pl. A('S.enc.list')), W = az app window-ja,
//          ok / eq / has = ellenőrzések, mk() = minta-lény, fresh() minden teszt előtt lefut.
'use strict';

// ---------- mini tesztkeret ----------
const TESTS = [];
let GROUP = '';
const PARAMS = new URLSearchParams(location.search);
const ONLINE = PARAMS.has('online');
// részleges futás fejlesztés közben (.\teszt.ps1 -Csoport "…" -Szuro "…"): a csoport, illetve a teszt nevének részlete, kis- és nagybetűtől függetlenül
const CSOPORT = PARAMS.get('csoport') || '', SZURO = PARAMS.get('szuro') || '';
const szurtTeszt = (t, csoport, szuro) => { const b = (miben, mi) => !mi || miben.toLowerCase().includes(mi.toLowerCase()); return b(t.group, csoport) && b(t.name, szuro); };
function describe(name, fn) { GROUP = name; fn(); GROUP = ''; }
function test(name, fn, opts = {}) { TESTS.push({name: `${GROUP} › ${name}`, group: GROUP, fn, online: !!opts.online}); }
class Fail extends Error {}
const fmt = v => { try { return JSON.stringify(v); } catch { return String(v); } };
function ok(cond, msg = 'a feltétel nem teljesült') { if (!cond) throw new Fail(msg); }
function eq(actual, expected, msg = '') { const a = fmt(actual), e = fmt(expected); if (a !== e) throw new Fail(`${msg ? msg + ': ' : ''}várt ${e}, kapott ${a}`); }
function has(text, sub, msg = '') { if (!String(text).includes(sub)) throw new Fail(`${msg ? msg + ': ' : ''}nem tartalmazza: ${fmt(sub)} – szöveg: ${fmt(String(text).slice(0, 300))}`); }
function hasNot(text, sub, msg = '') { if (String(text).includes(sub)) throw new Fail(`${msg ? msg + ': ' : ''}nem kellene tartalmaznia: ${fmt(sub)}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 4000, what = 'feltétel') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await fn()) return; } catch {} await wait(25); }
  throw new Fail('időtúllépés: ' + what);
}
// Megvárja, amíg a DM Screen minden függő írása lefutott – fix várakozás (wait(500)) helyett ezt használd.
// A késleltetett mentést (save() → 400 ms múlva doSave) nem várja ki, hanem rögtön lefuttatja, ahogy az oldal bezárásakor az app is;
// az ál-adatbázis írásai mikrofeladatok, két wait(0) alatt befejeződnek. (A 400 ms-os késleltetést külön teszt nézi: „Felhő mentés”.)
// Nem erre való: a másik ablakba (Initiative tracker, telefonos lap) átmenő üzenetre várni – ott until() kell.
async function mentve() {
  for (let i = 0; i < 7; i++) {
    await wait(0); await wait(0);
    if (!A('saveTimer')) return;
    if (i < 6) { A('clearTimeout(saveTimer)'); await W.doSave(); }
  }
  throw new Fail('a mentés nem áll le (minden mentés újabb mentést indít)');
}

// ---------- az app betöltése ----------
let W, P, K, A, appErrors = [];
const frame = (id, src, w, h) => { const f = document.createElement('iframe'); f.id = id; f.src = src; f.width = w; f.height = h; $frames.appendChild(f); return f; };
const $frames = document.getElementById('frames');
try { localStorage.removeItem('dmscreen'); localStorage.removeItem('dmscreen-sheets'); } catch {}

const $ = s => W.document.querySelector(s);
const $$ = s => [...W.document.querySelectorAll(s)];
const click = (el, opts = {}) => { const mi = el; if (typeof el === 'string') el = $(el); ok(el, 'nincs ilyen elem: ' + mi); el.dispatchEvent(new W.MouseEvent('click', {bubbles: true, ...opts})); };
const key = (el, k, opts = {}) => { (el || W.document.body).dispatchEvent(new W.KeyboardEvent('keydown', {key: k, bubbles: true, ...opts})); };
const setVal = (el, v, evt = 'change') => { if (typeof el === 'string') el = $(el); el.value = v; el.dispatchEvent(new W.Event(evt, {bubbles: true})); };
const list = () => A('S.enc.list');
const names = () => A('order()').map(x => W.nameOf(x));
const lastLog = () => A('logLines[0]?.html') || '';
const allLog = () => A('logLines').map(l => l.html).join('\n');
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const stubRnd = (...vals) => { const s = seq(...vals); W.rnd = () => s(); };

let ORIG = {};
// Az app „const f = ...” segédfüggvényei nem window-tulajdonságok: a futtató a tesztek előtt W.f néven elérhetővé teszi őket.
// Új ilyen segédnél, amit egy teszt W.f(...)-ként hív, add ide a nevét (ha kimarad, a bukott teszt üzenete szól: appNevTipp).
const APP_NEVEK = ['normCreature', 'normCombatant', 'splitEntry', 'sideOf', 'mod', 'sgn', 'initBonusOf', 'nameOf', 'byId', 'crXp', 'pcLevel', 'crSzint', 'hpArany', 'tagSzint', 'crToPb', 'ordinal', 'is5e', 'isDDB', 'crBand', 'dmgTable', 'coinStr', 'noTreasure', 'skillLabel', 'passiveScore', 'partyMembers', 'coinsGp', 'hpStatus', 'playerEmails', 'stableJson', 'sharingDirty', 'lenySablon'];
// „W.f is not a function”, és az appban van ilyen nevű (const) segéd, csak nincs a listán → tipp a hibaüzenetbe
function appNevTipp(e) {
  const m = e instanceof Error && /^W\.(\w+) is not a function/.exec(e.message);
  if (!m || APP_NEVEK.includes(m[1])) return '';
  let van = false; try { van = A(`typeof ${m[1]}`) !== 'undefined'; } catch {}
  return van ? `\n      (tipp: a(z) „${m[1]}” az app const-os segédje – add a nevét a tests/keret.js APP_NEVEK listájához)` : '';
}
function fresh() {
  Object.assign(W, ORIG);
  W.confirm = () => true; W.alert = () => {}; W.prompt = () => null;
  A(`Tar.kapcsol(null); authInfo = {status: 'unconfigured'}; clearTimeout(saveTimer); saveTimer = null;
     S = {library: [], enc: {list: [], round: 1, active: null}, saved: [], settings: {groupInit: true, rollHp: false, sources: ['MM']}};
     selected = null; logLines = []; libTab = 'lib'; lastSaved = emptySaved();
     fiveIndex = null; fiveData = {}; fiveResults = []; backupWarn = ''; lootData = null; lootResult = null;
     partySort = {p: {col: null, dir: 1}, s: {col: null, dir: 1}}; partySkillLeiras = null;
     SHEETS = {}; shadow = {}; cshadow = {}; sheetOps = {set: new Set(), del: new Set()}; sheetUnsub = null; sheetsWarn = ''; rulebook = null; itemResults = []; latottDobas = {}; dobasokElso = true; keresek = [];
     closeModal(); renderGate(null); render();`);
  W.document.getElementById('log').innerHTML = '';
}

// minta-lények
const mk = (name = 'Goblin', extra = {}) => ({
  name, kind: 'monster', cr: '1/4', ac: 15, hp: {max: 7, formula: '2d6'},
  abilities: {str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8},
  actions: [
    {name: 'Scimitar', text: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.'},
    {name: 'Fire Breath (Recharge 5–6)', text: 'DC 12 Dexterity saving throw, 3d6 fire damage on a failed save.'}
  ], ...extra
});
const pc = (name, level = 3, extra = {}) => ({name, kind: 'pc', cr: 'Szint ' + level, ac: 16, hp: {max: 30}, abilities: {dex: 12}, ...extra});
const ogre = () => mk('Ogre', {cr: '2', ac: 11, hp: {max: 59, formula: '7d10+21'}, abilities: {dex: 8}});
const add = (c, n = 1) => { const a = W.addToEncounter(c, n); W.render(); return a; };

// ======================================================================
// ---------- futtatás ----------
async function run() {
  const out = document.getElementById('report'), sum = document.getElementById('summary');
  const lines = []; let pass = 0, fail = 0, skip = 0;
  const appF = frame('app', '../index.html?test=1', 1400, 800);
  await new Promise(r => appF.onload = r);
  W = appF.contentWindow; A = code => W.eval(code);
  W.addEventListener('error', e => appErrors.push(e.message));
  W.addEventListener('unhandledrejection', e => appErrors.push('promise: ' + (e.reason?.message || e.reason)));
  await until(() => A('authInfo.status') === 'unconfigured', 10000, 'az app betöltése');
  const plF = frame('player', '../player.html', 1000, 600);
  await new Promise(r => plF.onload = r);
  P = plF.contentWindow;
  const kF = frame('karakter', '../karakter.html?test=1', 420, 700);
  await new Promise(r => kF.onload = r);
  K = kF.contentWindow;
  K.addEventListener('error', e => appErrors.push('karakter.html: ' + e.message));
  for (const k of ['rnd', 'loadFiveSource', 'loadFiveIndex', 'loadLoot', 'confirm', 'alert', 'download', 'buildRulebook']) ORIG[k] = W[k];
  K.addEventListener('unhandledrejection', e => appErrors.push('karakter.html promise: ' + (e.reason?.message || e.reason)));
  for (const k of APP_NEVEK) W[k] = A(k);
  let kiszurt = 0;
  for (const t of TESTS) {
    if (!szurtTeszt(t, CSOPORT, SZURO)) { kiszurt++; continue; }
    if (t.online && !ONLINE) { skip++; continue; }
    try {
      fresh();
      await Promise.race([t.fn(), new Promise((_, rej) => setTimeout(() => rej(new Fail('időtúllépés (10 mp)')), 10000))]);
      pass++; lines.push('OK    ' + t.name);
    } catch (e) {
      fail++; lines.push('HIBA  ' + t.name + '\n      → ' + (e instanceof Fail ? e.message : (e && e.stack || e)) + appNevTipp(e));
    }
    out.textContent = lines.join('\n');
  }
  fresh();
  const total = `ÖSSZESEN: ${pass} sikeres, ${fail} hibás${skip ? `, ${skip} kihagyva (online)` : ''}${kiszurt ? `, ${kiszurt} kihagyva (szűrő – részleges futás)` : ''}`;
  lines.push('', total);
  out.textContent = lines.join('\n');
  sum.textContent = total; sum.className = fail ? 'bad' : 'ok';
  document.title = (fail ? 'HIBA' : 'OK') + ' – DM Screen tesztek';
  document.body.dataset.done = '1';
}

// DM Screen – regressziós tesztek.
// Futtatás: a projekt gyökerében  .\teszt.ps1   (vagy böngészőben: tests/index.html, helyi szerverről)
// Új teszt: keresd meg a megfelelő describe(...) blokkot, és adj hozzá egy test('név', async () => { ... }) sort.
// Segédek: A('kód') = kód futtatása az app ablakában (pl. A('S.enc.list')), W = az app window-ja,
//          ok / eq / has = ellenőrzések, mk() = minta-lény, fresh() minden teszt előtt lefut.
'use strict';

// ---------- mini tesztkeret ----------
const TESTS = [];
let GROUP = '';
const ONLINE = new URLSearchParams(location.search).has('online');
function describe(name, fn) { GROUP = name; fn(); GROUP = ''; }
function test(name, fn, opts = {}) { TESTS.push({name: `${GROUP} › ${name}`, fn, online: !!opts.online}); }
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
function fresh() {
  Object.assign(W, ORIG);
  W.confirm = () => true; W.alert = () => {}; W.prompt = () => null;
  A(`Tar.kapcsol(null); authInfo = {status: 'unconfigured'}; clearTimeout(saveTimer); saveTimer = null;
     S = {library: [], enc: {list: [], round: 1, active: null}, saved: [], settings: {groupInit: true, rollHp: false, sources: ['MM']}};
     selected = null; logLines = []; libTab = 'lib'; lastSaved = emptySaved();
     fiveIndex = null; fiveData = {}; fiveResults = []; backupWarn = ''; lootData = null; lootResult = null;
     partySort = {p: {col: null, dir: 1}, s: {col: null, dir: 1}};
     SHEETS = {}; shadow = {}; cshadow = {}; sheetOps = {set: new Set(), del: new Set()}; sheetUnsub = null; sheetsWarn = ''; rulebook = null; itemResults = [];
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
describe('Kockadobás', () => {
  test('konstans és összetett kifejezés', () => {
    eq(W.roll('5').total, 5);
    stubRnd(4, 5);
    const r = W.roll('2d6+3');
    eq(r.total, 12); eq(r.detail, '[4,5] +3');
  });
  test('negatív módosító, szóközök, unicode mínusz', () => {
    stubRnd(3); eq(W.roll('1d8-1').total, 2);
    stubRnd(6); eq(W.roll('1d6 − 1').total, 5);
    stubRnd(2); eq(W.roll('d4').total, 2);
  });
  test('rnd mindig 1..N között marad, és minden oldal előjön', () => {
    const seen = new Set();
    for (let i = 0; i < 3000; i++) { const v = W.rnd(6); ok(v >= 1 && v <= 6 && Number.isInteger(v), 'érvénytelen: ' + v); seen.add(v); }
    eq(seen.size, 6);
  });
  test('d20 egyenletes eloszlás (20 000 dobás, oldalanként 4–6%)', () => {
    const c = Array(21).fill(0);
    for (let i = 0; i < 20000; i++) c[W.rnd(20)]++;
    for (let f = 1; f <= 20; f++) ok(c[f] > 800 && c[f] < 1200, `a(z) ${f} aránya ${c[f] / 200}%`);
  });
  test('támadódobás: normál, előny, hátrány', () => {
    stubRnd(13); W.rollHit('+4', 'Goblin', 'Scimitar', ''); has(lastLog(), '<b>17</b>');
    stubRnd(5, 17); W.rollHit('+2', 'G', 'X', 'adv'); has(lastLog(), '<b>19</b>'); has(lastLog(), 'előny');
    stubRnd(5, 17); W.rollHit('+2', 'G', 'X', 'dis'); has(lastLog(), '<b>7</b>'); has(lastLog(), 'hátrány');
  });
  test('természetes 20 kritikus, természetes 1 elvétés', () => {
    stubRnd(20); W.rollHit('+0', 'G', 'X', ''); eq(A('logLines[0].cls'), 'crit'); has(lastLog(), 'KRITIKUS');
    stubRnd(1); W.rollHit('+9', 'G', 'X', ''); eq(A('logLines[0].cls'), 'fumble');
  });
  test('kritikus sebzés megduplázza a kockákat, a módosítót nem', () => {
    stubRnd(1); W.rollDmg('2d6+3', 'G', 'X', true);
    has(lastLog(), '<b>7</b>'); has(lastLog(), '4d6+3');
  });
});

// ======================================================================
describe('Dobások felismerése a szövegben', () => {
  test('„+5 to hit” egyszer, kattinthatóan', () => {
    const h = W.linkify('Melee Weapon Attack: +5 to hit, reach 5 ft.');
    eq((h.match(/data-hit=/g) || []).length, 1); has(h, 'data-hit="+5"');
  });
  test('2024-es „Attack Roll: +4” formátum', () => has(W.linkify('Melee Attack Roll: +4, reach 5 ft.'), 'data-hit="+4"'));
  test('sebzéskocka szóközökkel', () => has(W.linkify('Hit: 5 (1d6 + 2) slashing'), 'data-roll="1d6+2"'));
  test('Recharge 5–6 és Recharge 6', () => {
    has(W.linkify('Breath (Recharge 5–6)'), 'data-rech="5"');
    has(W.linkify('Breath (Recharge 6)'), 'data-rech="6"');
  });
  test('HTML-t nem enged befecskendezni, sortörést megtart', () => {
    const h = W.linkify('<img src=x onerror=alert(1)>\nújsor');
    has(h, '&lt;img'); hasNot(h, '<img'); has(h, '<br>');
  });
  test('tooltipek az előny/hátrány emlékeztetővel', () => {
    has(W.linkify('+3 to hit'), 'Shift+kattintás: előny');
    has(W.linkify('1d6'), 'kritikus');
  });
  test('atkInfo: találati bónusz és sebzéstípusok', () => {
    const i = W.atkInfo('Melee Weapon Attack: +6 to hit. Hit: 13 (2d8 + 4) bludgeoning damage plus 5 (2d4) fire damage.');
    eq(i.hit, '+6');
    eq(i.dice.map(d => [d.expr, d.type]), [['2d8+4', 'bludgeoning'], ['2d4', 'fire']]);
  });
  test('atkInfo támadás nélkül (pl. gyógyítás)', () => {
    const i = W.atkInfo('Regain 1d10+3 HP');
    eq(i.hit, undefined); eq(i.dice[0].expr, '1d10+3');
  });
});

// ======================================================================
describe('Lény adatok', () => {
  test('alapértékek kitöltése', () => {
    const c = W.normCreature({name: 'X'});
    eq([c.ac, c.hp.max, c.abilities.dex, c.actions.length, c.initBonus], [10, 10, 10, 0, null]);
    ok(c.id, 'nincs id');
  });
  test('HP megadható sima számként', () => eq(W.normCreature({hp: 25}).hp, {max: 25, formula: ''}));
  test('szekció elem szövegből: „Név. Szöveg”', () => {
    eq(W.normCreature({actions: ['Bite. Melee attack.']}).actions[0], {name: 'Bite', text: 'Melee attack.'});
    eq(W.splitEntry('Csak szöveg'), {name: '', text: 'Csak szöveg'});
  });
  test('initiative bónusz: üres = DEX, 0 = 0', () => {
    eq(W.initBonusOf(W.normCreature({abilities: {dex: 16}})), 3);
    eq(W.initBonusOf(W.normCreature({abilities: {dex: 16}, initBonus: 0})), 0);
    eq(W.normCreature({initBonus: ''}).initBonus, null);
  });
  test('a sablon leírása (_leiras) nem kerül a lénybe', () => ok(!('_leiras' in W.normCreature(A('TEMPLATE')))));
});

// ======================================================================
describe('Szerkesztő', () => {
  test('megnyitás és mentés változatlanul visszaadja az adatokat', () => {
    const c = W.normCreature(A('TEMPLATE'));
    W.openEditor(c, () => {});
    const r = W.readEditor();
    eq(r.actions, c.actions); eq(r.abilities, c.abilities); eq(r.saves, c.saves); eq([r.ac, r.hp.max, r.hp.formula, r.cr], [c.ac, c.hp.max, c.hp.formula, c.cr]);
  });
  test('mentők szövegből (kis/nagybetű, unicode mínusz)', () => {
    W.openEditor(W.normCreature({}), () => {});
    $('#edForm').elements.saves.value = 'dex +5, WIS −1, con 3';
    eq(W.readEditor().saves, {dex: 5, con: 3, wis: -1});
  });
  test('szekciók üres sorral elválasztva', () => {
    W.openEditor(W.normCreature({}), () => {});
    $('#edForm').elements.sec_actions.value = 'Bite. Hits hard.\n\nClaw. Scratches.\nMásodik sor.';
    eq(W.readEditor().actions, [{name: 'Bite', text: 'Hits hard.'}, {name: 'Claw', text: 'Scratches.\nMásodik sor.'}]);
  });
  test('üres initiative bónusz = null, portré megmarad', () => {
    W.openEditor(W.normCreature({portrait: 'https://x/y.png', initBonus: 2}), () => {});
    $('#edForm').elements.initBonus.value = '';
    const r = W.readEditor();
    eq(r.initBonus, null); eq(r.portrait, 'https://x/y.png');
  });
  test('Mentés gomb: új lény a könyvtárba kerül', () => {
    click('[data-act="newCreature"]');
    $('#edForm').elements.name.value = 'Tesztlény';
    click('[data-act="edSave"]');
    eq(A('S.library').map(c => c.name), ['Tesztlény']);
    ok($('#modal').hidden, 'a szerkesztő nem zárult be');
  });
});

// ======================================================================
describe('Encounter összeállítás', () => {
  test('egy lény szám nélkül, a második hozzáadásakor számozás', () => {
    add(mk()); eq(names(), ['Goblin']);
    add(mk()); eq(names().sort(), ['Goblin 1', 'Goblin 2']);
  });
  test('egyszerre három: Goblin 1–3', () => { add(mk(), 3); eq(names().sort(), ['Goblin 1', 'Goblin 2', 'Goblin 3']); });
  test('játékos nem kap számot, az aktuális HP-ja jön át', () => {
    add(pc('Rella', 8, {hp: {max: 51, cur: 12}}));
    const x = list()[0];
    eq([W.nameOf(x), x.hp, x.c.hp.max, 'cur' in x.c.hp], ['Rella', 12, 51, false]);
  });
  test('HP dobás formula alapján (bekapcsolva)', () => {
    A('S.settings.rollHp = true');
    stubRnd(1); add(mk('Skeleton', {hp: {max: 13, formula: '2d8+4'}}));
    eq([list()[0].hp, list()[0].c.hp.max], [6, 13]);
    stubRnd(8); add(mk('Skeleton', {hp: {max: 13, formula: '2d8+4'}}));
    eq([list()[1].hp, list()[1].c.hp.max], [20, 20]);
  });
  test('sorrend: initiative csökkenő, egyezésnél a nagyobb bónusz, üres a végén', () => {
    const [a] = add(mk('A', {abilities: {dex: 10}})), [b] = add(mk('B', {abilities: {dex: 18}})), [c] = add(mk('C')), [d] = add(mk('D'));
    a.init = 10; b.init = 10; c.init = 15; d.init = null;
    eq(names(), ['C', 'B', 'A', 'D']);
  });
  test('Initiative „ellenfelek”: a játékosét nem dobja', () => {
    add(pc('Rella')); add(mk(), 2);
    W.rollInitiative('monsters');
    const l = list();
    eq(l[0].init, null); ok(l[1].init != null && l[2].init != null);
  });
  test('együtt hozzáadott csoport közös initiative-et kap', () => {
    stubRnd(3, 15, 9, 18); add(mk(), 3); add(ogre());
    W.rollInitiative('monsters');
    const l = list();
    eq(new Set(l.slice(0, 3).map(x => x.init)).size, 1); ok(l[3].init !== l[0].init, 'az ogre ugyanazt kapta');
  });
  test('közös initiative kikapcsolva: mindenki külön dob', () => {
    A('S.settings.groupInit = false');
    stubRnd(3, 15, 9); add(mk(), 3);
    W.rollInitiative('monsters');
    eq(new Set(list().map(x => x.init)).size, 3);
  });
  test('„csak akinek nincs” mód a meglévőt nem írja felül', () => {
    const [a, b] = add(mk(), 2); a.init = 99;
    A('S.settings.groupInit = false'); W.rollInitiative('missing');
    eq(a.init, 99); ok(b.init != null);
  });
  test('harc közben hozzáadott ellenfél azonnal initiative-et dob', () => {
    add(pc('Rella'))[0].init = 10; W.lep(1);
    const [g] = add(mk()); ok(g.init != null, 'nincs initiative');
    const [p] = add(pc('Borin')); eq(p.init, null);
  });
  test('másolás gomb: még egy ugyanilyen, számozva', () => {
    add(mk());
    click($$('.tile [data-act="dup"]')[0]);
    eq(names().sort(), ['Goblin 1', 'Goblin 2']);
  });
  test('eltávolítás gomb', () => {
    add(mk(), 2);
    click($$('.tile [data-act="remove"]')[0]);
    eq(list().length, 1);
  });
});

// ======================================================================
describe('Körök és sorrend', () => {
  const setup = () => {
    const [p] = add(pc('Rella')), [g1, g2] = add(mk(), 2);
    p.init = 20; g1.init = 15; g2.init = 10;
    return [p, g1, g2];
  };
  test('az első lépés az elsőt teszi aktívvá, 1. kör', () => {
    const [p] = setup(); W.lep(1);
    eq([A('S.enc.active'), A('S.enc.round')], [p.cid, 1]);
  });
  test('a sor végén új kör kezdődik', () => {
    const [p] = setup(); W.lep(1); W.lep(1); W.lep(1); W.lep(1);
    eq([A('S.enc.active'), A('S.enc.round')], [p.cid, 2]);
    has(allLog(), '2. kör');
  });
  test('halott ellenfelet átugorja, halott játékost nem', () => {
    const [p, g1, g2] = setup(); g1.dead = true; p.dead = true;
    W.lep(1); eq(A('S.enc.active'), p.cid);
    W.lep(1); eq(A('S.enc.active'), g2.cid);
  });
  test('visszalépés az elejéről az utolsóra, a kör nem megy 1 alá', () => {
    const [p, , g2] = setup(); W.lep(1); W.lep(-1);
    eq([A('S.enc.active'), A('S.enc.round')], [g2.cid, 1]);
  });
  test('körszámos állapot a lény körének elején csökken és lejár', () => {
    const [, g1] = setup();
    g1.cond = [{name: 'Prone', rounds: 1}, {name: 'Frightened', rounds: 2}, {name: 'Charmed', rounds: null}];
    W.lep(1); W.lep(1);
    eq(g1.cond, [{name: 'Frightened', rounds: 1}, {name: 'Charmed', rounds: null}]);
    has(allLog(), 'Prone lejárt');
  });
  test('legendás akciók visszaállnak a lény körének elején', () => {
    const [p] = setup(); p.leg = 2; W.lep(1); eq(p.leg, 0);
  });
  test('üres encounterben a lépés nem hibázik', () => { W.lep(1); eq(A('S.enc.active'), null); });
  test('a gomb kezelője rajzol (ettől frissül az Initiative tracker is); ha nincs kire lépni, nem ment és nem rajzol', () => {
    const eredeti = W.render; let n = 0;
    W.render = () => { n++; eredeti(); };
    const rajzol = (mi, fn) => { n = 0; fn(); ok(n > 0, mi + ': nem rajzolt'); };
    try {
      n = 0; W.lep(1); eq([n, A('saveTimer')], [0, null], 'üres lista');
      W.addToEncounter(mk('Halott'))[0].dead = true; A('clearTimeout(saveTimer); saveTimer = null');
      n = 0; W.lep(1); eq([n, A('saveTimer')], [0, null], 'csupa halott ellenfél');
      A('S.enc.list = []');
      W.upsertLibrary(W.normCreature(pc('Rella'))); const lib = W.upsertLibrary(W.normCreature(mk('Lib')));
      rajzol('libAdd', () => { W.openLib('lib'); click(`[data-lib="${lib.id}"] [data-act="libAdd"]`); });
      rajzol('addAllPcs', () => { W.openLib('lib'); click('[data-act="addAllPcs"]'); });
      W.closeModal();
      rajzol('dup', () => click('.tile [data-act="dup"]'));
      rajzol('next', () => click('[data-act="next"]'));
      rajzol('prev', () => click('[data-act="prev"]'));
      rajzol('N billentyű', () => key(null, 'n'));
      rajzol('P billentyű', () => key(null, 'p'));
      rajzol('init', () => { W.openInitMenu(); click('[data-act="init"][data-mode="all"]'); });
      eq($('#modal').hidden, true, 'az Initiative-ablak bezárul');
      W.openLib('enc'); $('#encName').value = 'E'; click('[data-act="encSave"]');
      rajzol('encLoad', () => click('[data-act="encLoad"]'));
    } finally { W.render = eredeti; }
  });
  test('a logika maga nem rajzol: a harcfüggvények után a csempék csak a render()-re frissülnek', () => {
    W.addToEncounter(mk()); eq($$('.tile').length, 0, 'addToEncounter');
    W.render(); eq($$('.tile').length, 1);
    W.step(1); ok(!$('.tile').classList.contains('active'), 'step');
    W.render(); ok($('.tile').classList.contains('active'));
  });
});

// ======================================================================
describe('Sebzés és gyógyítás', () => {
  test('a temp HP először nyel el', () => {
    const [g] = add(mk('Ogre', {hp: {max: 20}})); g.hp = 10; g.temp = 5;
    W.damage(g, 7); eq([g.temp, g.hp], [0, 8]);
  });
  test('ellenfél 0 HP-n meghal', () => { const [g] = add(mk()); W.damage(g, 50); eq([g.hp, g.dead], [0, true]); });
  test('játékos 0 HP-n nem hal meg, death save figyelmeztetés', () => {
    const [p] = add(pc('Rella')); W.damage(p, 99);
    eq([p.hp, p.dead], [0, false]); has(allLog(), 'death save');
  });
  test('gyógyítás feléleszt, és nem megy a maximum fölé', () => {
    const [g] = add(mk()); W.damage(g, 50); W.heal(g, 3); eq([g.hp, g.dead], [3, false]);
    W.heal(g, 100); eq(g.hp, 7);
  });
  test('koncentráció mentő DC: max(10, sebzés fele)', () => {
    const [p] = add(pc('Rella', 3, {hp: {max: 99}})); p.conc = true;
    W.damage(p, 30); has(lastLog(), 'DC 15');
    W.damage(p, 4); has(lastLog(), 'DC 10');
  });
  test('HP mező: pozitív szám + Enter = sebzés, negatív = gyógyítás', () => {
    const [g] = add(mk('Ogre', {hp: {max: 30}}));
    let inp = $('.tile .hpin'); inp.value = '10'; key(inp, 'Enter'); eq(g.hp, 20);
    inp = $('.tile .hpin'); inp.value = '-4'; key(inp, 'Enter'); eq(g.hp, 24);
  });
  test('a − gomb negatív számot is sebzésként vesz', () => {
    const [g] = add(mk('Ogre', {hp: {max: 30}}));
    $('.tile .hpin').value = '-6'; click('.tile [data-act="dmg"]'); eq(g.hp, 24);
    $('.tile .hpin').value = '5'; click('.tile [data-act="heal"]'); eq(g.hp, 29);
  });
  test('T gomb beállítja a temp HP-t', () => {
    const [g] = add(mk()); $('.tile .hpin').value = '8'; click('.tile [data-act="temp"]'); eq(g.temp, 8);
  });
});

// ======================================================================
describe('Ellenfél / csapattárs és nehézség (DMG 2014)', () => {
  test('alapértelmezett oldalak', () => {
    add(mk()); add(pc('Rella')); add(mk('Bárd', {kind: 'npc'}));
    eq(list().map(W.sideOf), ['enemy', 'ally', 'ally']);
  });
  test('oldalváltó gomb', () => {
    const [g] = add(mk());
    click('.tile [data-act="toggleSide"]'); eq(W.sideOf(g), 'ally');
    click('.tile [data-act="toggleSide"]'); eq(W.sideOf(g), 'enemy');
  });
  test('CR → XP', () => {
    eq(['0', '1/8', '1/4', '1/2', 'CR 5', '0.5', '30', 'abc'].map(W.crXp), [10, 25, 50, 100, 1800, 100, 155000, undefined]);
  });
  test('játékos szint felismerése', () => eq(['Szint 8', '12', '25', ''].map(c => W.pcLevel({cr: c})), [8, 12, null, null]));
  test('DMG példa: 4 db 3. szintű játékos vs 4 goblin + ogre = Nehéz', () => {
    ['A', 'B', 'C', 'D'].forEach(n => add(pc(n, 3))); add(mk(), 4); add(ogre());
    const d = W.difficulty();
    eq([d.base, d.mult, d.adj, d.rating, d.thresh], [650, 2, 1300, 'hard', [300, 600, 900, 1600]]);
    has($('#diff').textContent, 'Nehéz · 1300 XP');
  });
  test('3 főnél kisebb csapat: egy fokkal nagyobb szorzó', () => {
    add(pc('A', 1)); add(pc('B', 1)); add(mk());
    const d = W.difficulty(); eq([d.mult, d.adj, d.rating], [1.5, 75, 'easy']);
  });
  test('6+ fős csapat: egy fokkal kisebb szorzó', () => {
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(n => add(pc(n, 1))); add(mk());
    eq(W.difficulty().mult, 0.5);
  });
  test('15+ ellenfél: ×4', () => { ['A', 'B', 'C', 'D'].forEach(n => add(pc(n, 5))); add(mk(), 15); eq(W.difficulty().mult, 4); });
  test('csapattársnak állított szörny nem számít', () => {
    add(pc('A', 3)); add(pc('B', 3)); add(pc('C', 3)); const [g] = add(mk()); add(ogre());
    g.side = 'ally'; const d = W.difficulty();
    eq([d.enemies.length, d.party.length, d.base], [1, 3, 450]);
  });
  test('hiányzó szint / CR figyelmeztetés', () => {
    add(pc('A', 3, {cr: ''})); add(mk('Titok', {cr: ''}));
    const d = W.difficulty(); eq([d.noLevel, d.noCr], [['A'], ['Titok']]);
    has($('#diff').textContent, '⚠');
  });
  test('részletes ablak megnyílik', () => {
    add(pc('A', 3)); add(mk()); click('#diff');
    has($('#modalBox').textContent, 'Korrigált XP');
  });
});

// ======================================================================
// 5e.tools mintaadatok (a valódi formátumot követik)
const FIVE = {
  brute: {
    name: 'Test Brute', source: 'TST', size: ['L'], type: {type: 'giant', tags: ['test']}, alignment: ['C', 'E'],
    ac: [{ac: 15, from: ['{@item hide armor|phb}']}], hp: {average: 59, formula: '7d10 + 21'},
    speed: {walk: 40, fly: {number: 30, condition: '(only in storms)'}, canHover: true},
    str: 19, dex: 12, con: 16, int: 6, wis: 10, cha: 7, save: {con: '+5'}, skill: {perception: '+2'},
    senses: ['darkvision 60 ft.'], passive: 12, resist: [{resist: ['cold', 'fire'], note: 'from nonmagical attacks'}],
    immune: ['poison'], conditionImmune: ['frightened'], languages: ['Giant'], cr: '3',
    trait: [{name: 'Keen Smell', entries: ['Advantage on {@skill Perception} checks.']}],
    action: [
      {name: 'Multiattack', entries: ['Two attacks.']},
      {name: 'Greatclub', entries: ['{@atk mw} {@hit 6} to hit, reach 10 ft. {@h}13 ({@damage 2d8 + 4}) bludgeoning damage.']},
      {name: 'Rock {@recharge 5}', entries: ['{@atk rw} {@hit 6} to hit, range 60/240 ft. {@h}15 ({@damage 2d10 + 4}) bludgeoning damage. Target must succeed on a {@dc 13} Strength saving throw or be knocked {@condition prone}.']}
    ],
    reaction: [{name: 'Parry', entries: [{type: 'list', items: ['Adds 2 to AC.', 'Only melee.']}]}],
    legendary: [{name: 'Stomp', entries: ['Moves.']}], legendaryActions: 2,
    spellcasting: [{name: 'Innate Spellcasting', headerEntries: ['Uses Wisdom ({@dc 10}).'], will: ['{@spell mage hand}'], daily: {'1e': ['{@spell fog cloud}', '{@spell shield}']}, ability: 'wis'}],
    hasToken: true
  },
  scout: {
    name: 'Test Scout', source: 'TST', size: ['M'], type: 'humanoid', alignment: ['N'], ac: [13], hp: {average: 16, formula: '3d8 + 3'},
    speed: {walk: 30}, str: 10, dex: 14, con: 12, int: 10, wis: 13, cha: 10, initiative: {proficiency: 1}, cr: '1/2',
    action: [
      {name: 'Dagger', entries: ['{@atkr m} {@hit 4}, reach 5 ft. {@h}5 ({@damage 1d6 + 2}) Piercing damage.']},
      {name: 'Flame Burst', entries: ['{@actSave dex} {@dc 12}, 10-foot cube. {@actSaveFail} 7 ({@damage 2d6}) Fire damage. {@actSaveSuccess} Half damage.']}
    ],
    bonus: [{name: 'Quick Step', entries: ['Moves 10 feet.']}],
    spellcasting: [{name: 'Spellcasting', headerEntries: ['Casts:'], spells: {'0': {spells: ['{@spell light}']}, '1': {slots: 2, spells: ['{@spell cure wounds}']}}, displayAs: 'action'}]
  },
  chief: {
    name: 'Test Brute Chief', source: 'TST', hp: {average: 80, formula: '10d10 + 25'},
    _copy: {name: 'Test Brute', source: 'TST', _mod: {
      '*': {mode: 'replaceTxt', replace: 'Two attacks', with: 'Three attacks'},
      action: [{mode: 'appendArr', items: {name: 'Roar', entries: ['Scary.']}}, {mode: 'removeArr', names: 'Rock {@recharge 5}'}]
    }}
  }
};
const stubFive = () => { W.loadFiveSource = async () => [FIVE.brute, FIVE.scout, FIVE.chief]; W.loadFiveIndex = async () => ({TST: 'bestiary-tst.json'}); };

describe('5e.tools átalakítás', () => {
  test('címkék ({@...}) feloldása', () => {
    const t = W.tagStrip;
    eq(t('{@atk mw} {@hit 6} to hit'), 'Melee Weapon Attack: +6 to hit');
    eq(t('{@atk mw,rw} {@hit -1}'), 'Melee or Ranged Weapon Attack: -1');
    eq(t('{@atkr m,r} {@hit 3}'), 'Melee or Ranged Attack Roll: +3');
    eq(t('{@h}5 ({@damage 1d6 + 2})'), 'Hit: 5 (1d6 + 2)');
    eq(t('{@dc 15} {@recharge 4} {@recharge}'), 'DC 15 (Recharge 4–6) (Recharge 6)');
    eq(t('{@actSave wis} {@actSaveFail} {@actSaveSuccess} {@actSaveSuccessOrFail}'), 'Wisdom Saving Throw: Failure: Success: Failure or Success:');
    eq(t('{@spell fireball|xphb} {@creature goblin|mm|the goblin} {@chance 25}'), 'fireball the goblin 25%');
    eq(t('{@b {@i nested}}'), 'nested');
    eq(t('{@hom}{@d20 3} {@d20 x} {@actTrigger} {@actResponse}'), 'Hit or Miss: +3 +0 Trigger: Response:');
  });
  test('_copy módosítások: tömbelem cseréje név vagy sorszám szerint, elejére fűzés', () => {
    const o = {action: [{name: 'A'}, {name: 'B'}, 'C']};
    W.applyMod(o, {action: [{mode: 'replaceArr', replace: 'B', items: {name: 'B2'}}, {mode: 'replaceArr', replace: {index: 0}, items: [{name: 'A1'}, {name: 'A2'}]},
      {mode: 'replaceArr', replace: 'nincs', items: {name: 'X'}}, {mode: 'prependArr', items: 'Első'}]});
    eq(o.action.map(x => x.name || x), ['Első', 'A1', 'A2', 'B2', 'C']);
  });
  test('listák és egymásba ágyazott bejegyzések', () => {
    eq(W.entriesToText([{type: 'list', items: ['a', {type: 'item', name: 'B.', entry: 'b'}]}, {type: 'entries', name: 'C', entries: ['c']}]), '• a\n• B. b\nC. c');
  });
  test('klasszikus (2014) szörny minden mezője', () => {
    const c = W.convert5e(FIVE.brute);
    eq([c.size, c.type, c.alignment, c.ac, c.acNote, c.hp.max, c.hp.formula], ['Large', 'giant (test)', 'chaotic evil', 15, 'hide armor', 59, '7d10 + 21']);
    eq(c.speed, '40 ft., fly 30 ft. (only in storms) (hover)');
    eq([c.saves, c.skills, c.senses], [{con: 5}, 'Perception +2', 'darkvision 60 ft., passive Perception 12']);
    eq([c.resist, c.immune, c.condImmune, c.languages, c.cr], ['cold, fire from nonmagical attacks', 'poison', 'frightened', 'Giant', '3']);
    eq([c.initBonus, W.initBonusOf(c), c.legendaryCount], [null, 1, 2]);
    eq(c.actions.map(a => a.name), ['Multiattack', 'Greatclub', 'Rock (Recharge 5–6)']);
    eq(c.actions[1].text, 'Melee Weapon Attack: +6 to hit, reach 10 ft. Hit: 13 (2d8 + 4) bludgeoning damage.');
    eq(c.reactions[0].text, '• Adds 2 to AC.\n• Only melee.');
    eq(c.traits.map(t => t.name), ['Keen Smell', 'Innate Spellcasting']);
    has(c.traits[1].text, 'At will: mage hand'); has(c.traits[1].text, '1/day each: fog cloud, shield');
    eq(c.portrait, 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary/tokens/TST/Test%20Brute.webp');
  });
  test('2024-es szörny: initiative jártasság, Attack Roll, mentődobás-címkék', () => {
    const c = W.convert5e(FIVE.scout);
    eq([c.initBonus, c.portrait], [4, '']);
    eq(c.actions[0].text, 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage.');
    eq(c.actions[1].text, 'Dexterity Saving Throw: DC 12, 10-foot cube. Failure: 7 (2d6) Fire damage. Success: Half damage.');
    eq(c.actions[2].name, 'Spellcasting'); has(c.actions[2].text, 'Cantrips (at will): light'); has(c.actions[2].text, '1st level (2 slots): cure wounds');
    eq(c.bonusActions[0].name, 'Quick Step');
    const i = W.atkInfo(c.actions[0].text); eq([i.hit, i.dice[0].expr, i.dice[0].type], ['+4', '1d6+2', 'piercing']);
  });
  test('_copy: másik szörnyből örököl, módosításokkal', async () => {
    stubFive();
    const c = W.convert5e(await W.resolveCopy(structuredClone(FIVE.chief)));
    eq([c.name, c.hp.max, c.ac], ['Test Brute Chief', 80, 15]);
    eq(c.actions.map(a => a.name), ['Multiattack', 'Greatclub', 'Roar']);
    eq(c.actions[0].text, 'Three attacks.');
  });
  test('különleges AC és CR → jártassági bónusz', () => {
    eq(W.fiveAc([{special: '12 + Dex'}]), {ac: 12, note: '12 + Dex'});
    eq(['1/2', '4', '5', '17', '30'].map(W.crToPb), [2, 2, 3, 6, 9]);
  });
  test('5e.tools link a keresőben', async () => {
    stubFive(); A(`fiveIndex = {TST: 'x.json'}`);
    W.openLib('five');
    $('#fiveQ').value = 'https://5e.tools/bestiary.html#test%20brute_tst';
    await W.fiveSearch();
    eq(A('fiveResults').map(m => m.name), ['Test Brute']);
    eq($$('#fiveRows .lrow').length, 1);
  });
  test('név szerinti keresés a kiválasztott forrásokban', async () => {
    stubFive(); A(`fiveIndex = {TST: 'x.json'}; S.settings.sources = ['TST']`);
    W.openLib('five'); $('#fiveQ').value = 'brute';
    await W.fiveSearch();
    eq(A('fiveResults').map(m => m.name), ['Test Brute', 'Test Brute Chief']);
  });
  test('találat hozzáadása az encounterhez és a könyvtárba', async () => {
    stubFive(); A(`fiveIndex = {TST: 'x.json'}; S.settings.sources = ['TST']`);
    W.openLib('five'); $('#fiveQ').value = 'scout'; await W.fiveSearch();
    click('#fiveRows [data-act="fiveSave"]'); await wait(50);
    $('#fiveRows .cnt').value = '2'; click('#fiveRows [data-act="fiveAdd"]'); await wait(50);
    eq([A('S.library').length, list().length, names().sort()], [1, 2, ['Test Scout 1', 'Test Scout 2']]);
    eq($$('.tile').length, 2, 'a csempék frissülnek');
  });
});

// ======================================================================
// D&D Beyond minta (a valódi v5 karakter-JSON felépítését követi)
const DDB = {success: true, data: {
  id: 424242, name: 'Teszt Tünde',
  stats: [15, 14, 13, 10, 12, 8].map((v, i) => ({id: i + 1, value: v})),
  bonusStats: [{id: 2, value: 2}], overrideStats: [{id: 4, value: 12}],
  baseHitPoints: 40, bonusHitPoints: 2, removedHitPoints: 10,
  classes: [{level: 3, definition: {name: 'Fighter', spellCastingAbilityId: 4}, subclassDefinition: {name: 'Eldritch Knight'}}, {level: 2, definition: {name: 'Rogue'}}],
  race: {fullName: 'Wood Elf', weightSpeeds: {normal: {walk: 35}}},
  decorations: {avatarUrl: 'https://www.dndbeyond.com/avatars/teszt.png'},
  modifiers: {
    race: [{type: 'bonus', subType: 'strength-score', value: 2}, {type: 'set-base', subType: 'darkvision', value: 60},
      {type: 'language', subType: 'common', friendlySubtypeName: 'Common'}, {type: 'language', subType: 'elvish', friendlySubtypeName: 'Elvish'}],
    class: [{type: 'proficiency', subType: 'strength-saving-throws'}, {type: 'proficiency', subType: 'constitution-saving-throws'},
      {type: 'proficiency', subType: 'athletics'}, {type: 'expertise', subType: 'stealth'}, {type: 'proficiency', subType: 'stealth'},
      {type: 'bonus', subType: 'armored-armor-class', value: 1}],
    feat: [{type: 'bonus', subType: 'hit-points-per-level', value: 1}, {type: 'bonus', subType: 'initiative', value: 2}],
    item: [{type: 'set', subType: 'constitution-score', value: 19}, {type: 'bonus', subType: 'armor-class', value: 1}]
  },
  inventory: [
    {equipped: true, definition: {name: 'Breastplate', armorTypeId: 2, armorClass: 14}},
    {equipped: true, definition: {name: 'Shield', armorTypeId: 4, armorClass: 2}},
    {equipped: false, definition: {name: 'Plate', armorTypeId: 3, armorClass: 18}},
    {equipped: true, definition: {name: 'Longsword', filterType: 'Weapon', attackType: 1, damage: {diceString: '1d8'}, damageType: 'Slashing', properties: [{name: 'Versatile', notes: '1d10'}]}},
    {equipped: true, definition: {name: 'Shortbow', filterType: 'Weapon', attackType: 2, range: 80, longRange: 320, damage: {diceString: '1d6'}, damageType: 'Piercing', properties: [{name: 'Ammunition'}]}},
    {equipped: true, definition: {name: 'Dagger +1', filterType: 'Weapon', attackType: 1, damage: {diceString: '1d4'}, damageType: 'Piercing', properties: [{name: 'Finesse'}], grantedModifiers: [{type: 'bonus', subType: 'magic', value: 1}]}},
    {equipped: false, definition: {name: 'Greataxe', filterType: 'Weapon', attackType: 1, damage: {diceString: '1d12'}, damageType: 'Slashing', properties: []}}
  ],
  actions: {class: [
    {name: 'Second Wind', snippet: 'Regain <b>1d10+5</b> HP.', activation: {activationType: 3}},
    {name: 'Action Surge', snippet: 'One extra action.', activation: {activationType: 1}},
    {name: 'Uncanny Dodge', snippet: 'Halve the damage.', activation: {activationType: 4}},
    {name: 'Fighting Style', snippet: 'Defense.', activation: {activationType: 0}}
  ]},
  classSpells: [{spells: [
    {prepared: true, definition: {name: 'Shield', level: 1}},
    {prepared: false, definition: {name: 'Sleep', level: 1}},
    {definition: {name: 'Fire Bolt', level: 0}}
  ]}],
  spells: {race: [{definition: {name: 'Druidcraft', level: 0}}]}
}};

describe('D&D Beyond átalakítás', () => {
  test('stripHtml: a HTML szövege marad, a beillesztett kép eseménykezelője nem fut le', async () => {
    eq(W.stripHtml('<p>Első <b>vastag</b></p>  \n<p>Második &amp; harmadik</p>'), 'Első vastag\nMásodik & harmadik');
    eq([W.stripHtml(null), W.stripHtml('')], ['', '']);
    delete W.__stripXss;
    eq(W.stripHtml('<img src="x:nincs" onerror="window.__stripXss = 1">kép'), 'kép');
    await wait(100);
    eq(W.__stripXss, undefined, 'az onerror nem futott le');
  });
  test('képességek: alap + bónusz + faji bónusz + „set” + felülírás', () => {
    eq(W.convertDDB(DDB).abilities, {str: 17, dex: 16, con: 19, int: 12, wis: 12, cha: 8});
  });
  test('szint, HP (max és aktuális), sebesség, fajta/kaszt sor', () => {
    const c = W.convertDDB(DDB);
    eq([c.cr, c.hp.max, c.hp.cur, c.speed, c.kind, c.ddbId], ['Szint 5', 67, 57, '35 ft.', 'pc', 424242]);
    eq(c.type, 'Wood Elf — Fighter 3 (Eldritch Knight) / Rogue 2');
  });
  test('AC: közepes páncél (max +2 DEX) + pajzs + bónuszok, a nem viselt páncél nem számít', () => eq(W.convertDDB(DDB).ac, 20));
  test('AC páncél nélkül: 10 + DEX + Unarmored Defense (CON)', () => {
    const d = structuredClone(DDB); d.data.inventory = []; d.data.modifiers.class.push({type: 'set', subType: 'unarmored-armor-class', statId: 3});
    eq(W.convertDDB(d).ac, 10 + 3 + 4 + 1);
  });
  test('AC páncél nélkül, rögzített alapértékkel (pl. Draconic Resilience: 13 + DEX), ha az a nagyobb', () => {
    const d = structuredClone(DDB); d.data.inventory = []; d.data.modifiers.class.push({type: 'set', subType: 'unarmored-armor-class', value: 13});
    eq(W.convertDDB(d).ac, 13 + 3 + 1);
    d.data.modifiers.class.at(-1).value = 9;
    eq(W.convertDDB(d).ac, 10 + 3 + 1, 'a kisebb alapérték nem számít');
  });
  test('mentők, skillek, expertise, passive Perception, darkvision, nyelvek, initiative', () => {
    const c = W.convertDDB(DDB);
    eq(c.saves, {str: 6, con: 7});
    eq(c.skills, 'Athletics +6, Stealth +9');
    eq([c.senses, c.languages, c.initBonus], ['darkvision 60 ft., passive Perception 11', 'Common, Elvish', 5]);
  });
  test('fegyverek: kézközeli, távolsági, finesse + mágikus, versatile; a nem viselt kimarad', () => {
    const a = W.convertDDB(DDB).actions;
    eq(a.slice(0, 3).map(x => x.name), ['Longsword', 'Shortbow', 'Dagger +1']);
    eq(a[0].text, 'Melee Weapon Attack: +6 to hit, reach 5 ft. Hit: 1d8+3 slashing damage. Versatile: 1d10+3.');
    eq(a[1].text, 'Ranged Weapon Attack: +6 to hit, range 80/320 ft. Hit: 1d6+3 piercing damage.');
    eq(a[2].text, 'Melee Weapon Attack: +7 to hit, reach 5 ft. Hit: 1d4+4 piercing damage.');
    ok(!a.some(x => x.name === 'Greataxe'), 'a nem viselt fegyver is bekerült');
  });
  test('képességek a megfelelő szekcióba (akció / bónusz / reakció / tulajdonság)', () => {
    const c = W.convertDDB(DDB);
    eq([c.bonusActions.map(x => x.name), c.reactions.map(x => x.name)], [['Second Wind'], ['Uncanny Dodge']]);
    ok(c.actions.some(x => x.name === 'Action Surge')); ok(c.traits.some(x => x.name === 'Fighting Style'));
    eq(c.bonusActions[0].text, 'Regain 1d10+5 HP.');
  });
  test('varázslatok: csak a felkészültek, DC és támadóbónusz', () => {
    const t = W.convertDDB(DDB).traits.find(x => x.name === 'Varázslatok').text;
    has(t, 'Fighter: spell save DC 12, +4 to hit'); has(t, 'Cantrips: Fire Bolt, Druidcraft'); has(t, '1st level: Shield'); hasNot(t, 'Sleep');
  });
  test('portré az avatarból', () => eq(W.convertDDB(DDB).portrait, 'https://www.dndbeyond.com/avatars/teszt.png'));
  test('„data” csomagolás nélkül is működik; nem DDB JSON-ra hibát dob', () => {
    eq(W.convertDDB(DDB.data).name, 'Teszt Tünde');
    let err = null; try { W.convertDDB({name: 'x'}); } catch (e) { err = e; } ok(err, 'nem dobott hibát');
  });
  test('újraimportálás ugyanazt a könyvtári bejegyzést frissíti', () => {
    const a = W.upsertLibrary(W.convertDDB(DDB));
    const d = structuredClone(DDB); d.data.baseHitPoints = 50;
    const b = W.upsertLibrary(W.convertDDB(d));
    eq([A('S.library').length, b.id === a.id, A('S.library')[0].hp.max], [1, true, 77]);
  });
  test('beillesztés a D&D Beyond fülön importál', () => {
    W.openLib('ddb'); W.ddbImportText(JSON.stringify(DDB));
    has($('#ddbMsg').textContent, 'Teszt Tünde'); eq(A('S.library').length, 1);
    W.ddbImportText('nem json'); has($('#ddbMsg').textContent, 'nem D&D Beyond');
  });
  test('könyvjelző: szintaktikailag helyes, más oldalon figyelmeztet', async () => {
    const body = A('BOOKMARKLET').replace(/^javascript:/, '');
    let msg = ''; W.alert = m => msg = m;
    await W.eval(body);
    has(msg, 'Nyisd meg a karakterlapot');
  });
  test('a könyvjelző gomb ott van a D&D Beyond fülön', () => {
    W.openLib('ddb'); ok($('#libRoot a[href^="javascript:"]'), 'nincs könyvjelző link');
  });
});

// ======================================================================
describe('Importálás', () => {
  test('a D&D Beyond átalakítás kimenete tartalomra az aranyminta (tests/arany-ddb.js)', () => {
    const ki = d => { const c = structuredClone(W.convertDDB(d)); delete c.id; delete c.importedAt; return c; };
    eq(W.stableJson(ki(DDB)), W.stableJson(ARANY_DDB.ddb), 'DDB');
    eq(W.stableJson(ki(ddbParty())), W.stableJson(ARANY_DDB.party), 'ddbParty');
  });
  test('minden importáló a szerződés szerinti lényt adja: normCreature(ki) ≡ ki', async () => {
    stubFive();
    const n = W.normCreature, sj = W.stableJson;
    const lenyek = [W.convertDDB(DDB), W.convertDDB(ddbParty()), W.convert5e(FIVE.brute), W.convert5e(FIVE.scout),
      W.convert5e(await W.resolveCopy(structuredClone(FIVE.chief))), n({...A('TEMPLATE'), id: 'sablon'}), n({name: 'Pók', id: 'pok'})];
    for (const c of lenyek) eq(sj(n(structuredClone(c))), sj(c), c.name);
  });
  test('formátum felismerése: saját, 5e.tools, D&D Beyond, tömb, {creatures}', async () => {
    stubFive();
    const r1 = await W.importAny([A('TEMPLATE'), FIVE.brute, DDB]);
    eq(r1.map(c => c.kind), ['monster', 'monster', 'pc']);
    eq(r1[1].source, '5e.tools · TST');
    const r2 = await W.importAny({creatures: [{name: 'A'}, {name: 'B'}]});
    eq(r2.map(c => c.name), ['A', 'B']);
    eq(A('S.library').length, 5);
  });
  test('a sablon hibátlanul importálható, a dobások felismerhetők', async () => {
    const [c] = await W.importAny(A('TEMPLATE'));
    eq([c.name, c.actions.length, c.immune], ['Ködvadász', 3, 'poison']);
    eq(W.atkInfo(c.actions[1].text).hit, '+5');
  });
  test('5e.tools _copy importáláskor is feloldódik', async () => {
    stubFive(); const [c] = await W.importAny(FIVE.chief);
    eq(c.actions.map(a => a.name), ['Multiattack', 'Greatclub', 'Roar']);
  });
  test('JSON fül: beillesztett szöveg importálása', async () => {
    W.openLib('json'); $('#jsonIn').value = JSON.stringify([{name: 'Pók'}]);
    click('[data-act="jsonImport"]'); await until(() => A('S.library').length === 1, 2000, 'import');
    has($('#jsonMsg').textContent, 'Pók');
  });
  test('hibás JSON: üzenet, nem omlik össze', async () => {
    W.openLib('json'); $('#jsonIn').value = '{hibás';
    click('[data-act="jsonImport"]'); await wait(50);
    has($('#jsonMsg').textContent, '⚠');
  });
});

// ======================================================================
describe('Könyvtár', () => {
  test('hozzáadás darabszámmal a könyvtárból', () => {
    W.upsertLibrary(W.normCreature(mk()));
    W.openLib('lib'); $('#libRows .cnt').value = '3'; click('#libRows [data-act="libAdd"]');
    eq(names().sort(), ['Goblin 1', 'Goblin 2', 'Goblin 3']);
    has(lastLog(), '3× Goblin', 'napló');
  });
  test('a könyvtárban szerkesztett lény az új példányokban jelenik meg, a meglévőkben nem', () => {
    const c = W.upsertLibrary(W.normCreature(mk()));
    add(c);
    A('S.library[0].ac = 19');
    add(A('S.library[0]'));
    eq(list().map(x => x.c.ac), [15, 19]);
  });
  test('az encounterben szerkesztett lény csak arra a példányra hat', () => {
    const [a] = add(mk(), 2);
    click($$('.tile [data-act="select"]').find(e => e.classList.contains('t-name')));
    click('[data-act="editCombatant"]');
    $('#edForm').elements.ac.value = '20'; click('[data-act="edSave"]');
    eq(list().map(x => x.c.ac).sort(), [15, 20]);
  });
  test('„Mentés a könyvtárba” visszaírja a módosítást', () => {
    const c = W.upsertLibrary(W.normCreature(mk())); const [x] = add(c);
    x.c.ac = 18; W.selected = x.cid; A(`selected = ${JSON.stringify(x.cid)}`); W.render();
    click('[data-act="saveToLib"]');
    eq([A('S.library').length, A('S.library')[0].ac], [1, 18]);
  });
  test('keresés és szűrés', () => {
    W.upsertLibrary(W.normCreature(mk())); W.upsertLibrary(W.normCreature(pc('Rella')));
    W.openLib('lib'); setVal('#libSearch', 'rel', 'input');
    eq($$('#libRows .lrow').length, 1);
    setVal('#libSearch', '', 'input'); setVal('#libKind', 'monster');
    has($('#libRows').textContent, 'Goblin'); hasNot($('#libRows').textContent, 'Rella');
  });
  test('összes játékos hozzáadása (duplikálás nélkül)', () => {
    W.upsertLibrary(W.normCreature(pc('Rella'))); W.upsertLibrary(W.normCreature(pc('Borin')));
    W.openLib('lib'); click('[data-act="addAllPcs"]');
    W.openLib('lib'); click('[data-act="addAllPcs"]');
    eq(names().sort(), ['Borin', 'Rella']);
  });
  test('törlés a könyvtárból', () => {
    W.upsertLibrary(W.normCreature(mk()));
    W.openLib('lib'); click('#libRows [data-act="libDel"]');
    eq(A('S.library').length, 0);
  });
});

// ======================================================================
describe('Mentett encounterek és új harc', () => {
  test('mentés és betöltés: csoportok és számozás megmarad, játékos nem kerül bele', () => {
    add(pc('Rella')); add(mk(), 3); add(ogre());
    W.openLib('enc'); $('#encName').value = 'Kápolna'; click('[data-act="encSave"]');
    const s = A('S.saved')[0];
    eq([s.name, s.list.length, !!s.id], ['Kápolna', 4, true]);
    eq(W.summarize(s.list), '3× Goblin, Ogre');
    A('S.enc.list = S.enc.list.filter(x => x.c.kind === "pc")'); W.render();
    W.openLib('enc'); click('[data-act="encLoad"]');
    eq(names().sort(), ['Goblin 1', 'Goblin 2', 'Goblin 3', 'Ogre', 'Rella']);
  });
  test('„Új harc”: ellenfelek ki, játékosok maradnak, initiative és kör nullázva', () => {
    const [p] = add(pc('Rella')); add(mk(), 2);
    p.init = 12; p.cond = [{name: 'Prone', rounds: null}]; W.lep(1); W.lep(1);
    W.openMenu(); click('[data-act="newFight"]');
    eq([names(), p.init, p.cond, A('S.enc.round'), A('S.enc.active')], [['Rella'], null, [], 1, null]);
  });
});

// ======================================================================
describe('Felhő mentés (ál-adatbázissal)', () => {
  const fakeDb = () => {
    const store = {}, log = [];
    return {store, log, db: {
      get: async p => store[p] ? structuredClone(store[p]) : null,
      list: async col => Object.entries(store).filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({...structuredClone(v), id: k.split('/')[1]})),
      set: async (p, d) => { store[p] = structuredClone(d); log.push('set ' + p); },
      del: async p => { delete store[p]; log.push('del ' + p); }
    }};
  };
  test('üres felhő: a böngészőben lévő adat feltöltődik', async () => {
    const f = fakeDb();
    W.localStorage.setItem('dmscreen', JSON.stringify({library: [{id: 'a1', name: 'Rella', kind: 'pc'}], enc: {list: [], round: 1, active: null}, saved: [{name: 'Régi', list: []}], settings: {}}));
    await W.DMApp.setAuth({status: 'signedIn', email: 'teszt@example.com', db: f.db});
    await wait(500);
    W.localStorage.removeItem('dmscreen');
    ok(Object.keys(f.store).includes('dmscreen_library/a1') && Object.keys(f.store).includes('dmscreen/state'), 'nem töltődött fel: ' + Object.keys(f.store));
    eq(Object.keys(f.store).filter(k => k.startsWith('dmscreen_saved/')).length, 1);
    ok($('#gate').hidden, 'a belépő képernyő nem tűnt el');
  });
  test('csak a megváltozott dokumentum íródik; törlés is', async () => {
    const f = fakeDb();
    f.store['dmscreen_library/a'] = {name: 'A'}; f.store['dmscreen_library/b'] = {name: 'B'}; f.store['dmscreen/state'] = {enc: {list: [], round: 1, active: null}, settings: {}};
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db});
    await wait(500); eq(f.log.splice(0).filter(l => !l.includes('backup')), [], 'betöltés után (a napi mentésen kívül) nem kellene írni');
    A('S.library.find(c => c.id === "a").ac = 17; save()'); await wait(500);
    eq(f.log.splice(0), ['set dmscreen_library/a']);
    add(mk()); await wait(500);
    eq(f.log.splice(0), ['set dmscreen/state']);
    A('S.library = S.library.filter(c => c.id !== "b"); save()'); await wait(500);
    eq(f.log.splice(0), ['del dmscreen_library/b']);
  });
  test('betöltés a felhőből visszaadja a könyvtárat és az encountert', async () => {
    const f = fakeDb();
    f.store['dmscreen_library/x'] = {name: 'Zombie', kind: 'monster'};
    f.store['dmscreen_saved/s1'] = {name: 'Harc', list: []};
    f.store['dmscreen/state'] = {enc: {list: [], round: 3, active: null}, settings: {rollHp: true}};
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db});
    eq([A('S.library').map(c => c.name), A('S.saved').map(e => e.id), A('S.enc.round'), A('S.settings.rollHp'), A('S.settings.groupInit')], [['Zombie'], ['s1'], 3, true, true]);
  });
  test('idegen fiók: hozzáférés megtagadva üzenet', async () => {
    const f = fakeDb(); f.db.get = async () => { const e = new Error('x'); e.code = 'permission-denied'; throw e; };
    await W.DMApp.setAuth({status: 'signedIn', email: 'idegen@example.com', db: f.db});
    ok(!$('#gate').hidden); has($('#gate').textContent, 'nem fér hozzá');
  });
  test('kijelentkezve a belépő képernyő látszik', async () => {
    await W.DMApp.setAuth({status: 'signedOut'});
    ok(!$('#gate').hidden); ok($('#gate [data-act="signIn"]'), 'nincs belépés gomb');
  });
  test('írási hiba: üzenet, és legközelebb mindent újraír', async () => {
    const f = fakeDb();
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db});
    f.db.set = async () => { const e = new Error('x'); e.code = 'unavailable'; throw e; };
    add(mk()); await wait(500);
    has($('#saveState').textContent, 'sikertelen');
    eq(A('lastSaved.state'), '');
  });
});

// ======================================================================
describe('Initiative tracker', () => {
  test('csak a nyilvános mezők mennek át (nincs AC, jegyzet, statok)', () => {
    const [g] = add(mk()); g.notes = 'titok';
    eq(Object.keys(W.publicView().list[0]).sort(), ['active', 'cond', 'hp', 'id', 'kind', 'max', 'name', 'portrait', 'side', 'status', 'temp']);
    hasNot(JSON.stringify(W.publicView()), 'titok');
    hasNot(JSON.stringify(W.publicView()), '"ac"');
  });
  test('állapotok: sértetlen, sérült, súlyosan sérült, halott, haldoklik', () => {
    const g = add(mk('Ogre', {hp: {max: 20}}), 5); g[1].hp = 15; g[2].hp = 10; g[3].hp = 0; g[3].dead = true; g[4].hp = 0; g[4].side = 'ally';
    eq(W.publicView().list.map(e => e.status).sort(), ['bloodied', 'dead', 'dying', 'healthy', 'hurt'].sort());
  });
  test('játékos pontos HP-ja és temp HP-ja látszik, ellenfélé nem', () => {
    const [p] = add(pc('Rella')); p.hp = 12; p.temp = 4; p.init = 10; add(mk());
    const v = W.publicView().list;
    eq([v[0].hp, v[0].max, v[0].temp, v[0].status], [12, 30, 4, null]);
    eq([v[1].hp, v[1].max], [null, null]);
  });
  test('rejtett lény kimarad, álnév érvényesül, koncentráció állapotként', () => {
    const [a, b] = add(mk(), 2); a.hiddenP = true; b.publicName = 'Csuklyás alak'; b.conc = true;
    const v = W.publicView().list;
    eq([v.length, v[0].name, v[0].cond], [1, 'Csuklyás alak', ['Koncentráció']]);
  });
  test('a player.html élőben megjeleníti a harcot (magyar címkékkel)', async () => {
    const [p] = add(pc('Rella')); const [g1, g2] = add(mk('Ogre', {hp: {max: 20}}), 2);
    const [h] = add(mk('Rejtett')); h.hiddenP = true;
    p.init = 20; g1.init = 10; g2.init = 5; g1.hp = 8; g1.cond = [{name: 'Prone', rounds: null}];
    W.lep(1); W.broadcast();
    const doc = () => P.document.body.textContent;
    await until(() => doc().includes('Ogre 1'), 4000, 'Initiative tracker frissítése');
    has(doc(), 'Soron: Rella'); has(doc(), 'Súlyosan sérült'); has(doc(), 'Sértetlen'); has(doc(), 'Prone'); has(doc(), '30 / 30');
    hasNot(doc(), 'Rejtett'); hasNot(doc(), 'Bloodied');
    ok(P.document.querySelector('.e.active .name').textContent === 'Rella', 'nem a soron lévő van kiemelve');
  });
  test('a player.html követi a következő lépést', async () => {
    const [p] = add(pc('Rella')), [g] = add(mk()); p.init = 20; g.init = 1;
    W.lep(1); W.lep(1);
    await until(() => P.document.querySelector('.e.active .name')?.textContent === 'Goblin', 4000, 'aktív frissítése');
  });
});

// ======================================================================
describe('Felület', () => {
  test('a csempék initiative-sorrendben jelennek meg, az aktív kiemelve', () => {
    const [a] = add(mk('A')), [b] = add(mk('B')); a.init = 5; b.init = 18; W.lep(1);
    eq($$('.tile .t-name').map(e => e.firstChild.textContent.trim()), ['B', 'A']);
    ok($$('.tile')[0].classList.contains('active'));
  });
  test('név kattintás: részletes adatlap', () => {
    add(mk('Ogre')); click('.tile .t-name');
    eq($('#detail .sb h2').textContent, 'Ogre');
  });
  test('N és P billentyű léptet, Esc bezárja az ablakot', () => {
    const [a] = add(mk('A')), [b] = add(mk('B')); a.init = 10; b.init = 5;
    key(null, 'n'); eq(A('S.enc.active'), a.cid);
    key(null, 'N'); eq(A('S.enc.active'), b.cid);
    key(null, 'p'); eq(A('S.enc.active'), a.cid);
    W.openMenu(); ok(!$('#modal').hidden); key(null, 'Escape'); ok($('#modal').hidden);
  });
  test('beviteli mezőben a billentyűk nem léptetnek', () => {
    const [a] = add(mk()); a.init = 1;
    key($('.tile .hpin'), 'n'); eq(A('S.enc.active'), null);
  });
  test('a csempén kattintható támadás, recharge és sebzés', () => {
    add(mk());
    eq($('.tile .roll.hit').textContent, '+4');
    stubRnd(5); click('.tile [data-rech]'); has(lastLog(), 'feltöltődött');
    stubRnd(4); click('.tile .roll[data-roll="1d6+2"]'); has(lastLog(), '<b>6</b>');
    stubRnd(10, 18); click('.tile .roll.hit', {shiftKey: true}); has(lastLog(), '<b>22</b>');
  });
  test('adatlap: képességpróba és mentő dobás kattintásra', () => {
    add(mk('Ogre', {saves: {con: 5}})); click('.tile .t-name');
    stubRnd(10); click('#detail [data-check="str"]'); has(lastLog(), 'Strength próba'); has(lastLog(), '<b>9</b>');
    stubRnd(10); click('#detail [data-save="con"]'); has(lastLog(), 'Constitution mentő'); has(lastLog(), '<b>15</b>');
  });
  test('adatlap: állapot hozzáadása körszámmal, eltávolítás chip kattintással', () => {
    const [g] = add(mk()); click('.tile .t-name');
    $('#condSel').value = 'Prone'; $('#condRounds').value = '2'; click('[data-act="addCond"]');
    eq(g.cond, [{name: 'Prone', rounds: 2}]);
    click('.tile .chip[data-act="rmCond"]'); eq(g.cond, []);
  });
  test('adatlap mezők: initiative, HP, max HP, AC, oldal, álnév, rejtett', () => {
    const [g] = add(mk()); click('.tile .t-name');
    setVal('#detail [data-f="init"]', '14'); setVal('#detail [data-f="hp"]', '3'); setVal('#detail [data-f="max"]', '9');
    setVal('#detail [data-f="ac"]', '17'); setVal('#detail [data-f="side"]', 'ally'); setVal('#detail [data-f="pubName"]', 'Árny');
    const hid = $('#detail [data-f="hiddenP"]'); hid.checked = true; hid.dispatchEvent(new W.Event('change', {bubbles: true}));
    eq([g.init, g.hp, g.c.hp.max, g.c.ac, g.side, g.publicName, g.hiddenP], [14, 3, 9, 17, 'ally', 'Árny', true]);
    ok($('.tile').classList.contains('hiddenp'));
  });
  test('legendás akció pöttyök', () => {
    const [g] = add(mk('Sárkány', {legendary: [{name: 'Tail', text: 'x'}], legendaryCount: 3}));
    eq($$('.tile .pip').length, 3); click($$('.tile .pip')[1]); eq(g.leg, 2);
  });
  test('portré a csempén és az adatlapon', () => {
    add(mk('Arc', {portrait: 'data:image/gif;base64,R0lGODlhAQABAAAAACw='})); click('.tile .t-name');
    ok($('.tile img.av'), 'nincs portré a csempén'); ok($('#detail img.portrait'), 'nincs portré az adatlapon');
  });
  test('minden könyvtár fül és a menü hiba nélkül megnyílik', () => {
    A(`fiveIndex = {TST: 'x.json'}`);
    for (const t of ['lib', 'five', 'ddb', 'json', 'enc']) { W.openLib(t); ok($('#libRoot .tabs button.on'), 'fül: ' + t); }
    W.openMenu(); has($('#modalBox').textContent, 'Exportálás');
    W.openLib('lib'); click('[data-tab="json"]'); ok($('#jsonIn'), 'fülváltás nem működik');
  });
  test('egyéni dobás a dobássávban', () => {
    stubRnd(3); $('#diceInput').value = '2d4+1'; click('[data-act="rollCustom"]'); has(lastLog(), '<b>7</b>');
    stubRnd(6); click('[data-die="1d6"]'); has(lastLog(), '<b>6</b>');
  });
  test('fejléc: Előző / Következő gomb, Initiative dobás ablak (ellenfelek, hiányzók, mindenki; közös initiative kapcsoló)', () => {
    const [p] = add(pc('Rella')), [g1, g2] = add(mk(), 2);
    p.init = 20; g1.init = 15; g2.init = 10;
    click('[data-act="next"]'); click('[data-act="next"]'); eq(A('S.enc.active'), g1.cid);
    click('[data-act="prev"]'); eq(A('S.enc.active'), p.cid);
    click('[data-act="rollInit"]'); has($('#modalBox').textContent, 'Initiative dobás');
    stubRnd(7); click('[data-act="init"][data-mode="monsters"]');
    eq([p.init, g1.init, g2.init], [20, 9, 9], 'a játékos marad, az együtt hozzáadott goblinok közös értéket kapnak');
    ok($('#modal').hidden, 'az ablak bezárult'); has(allLog(), 'Initiative dobva');
    p.init = null; stubRnd(11); W.openInitMenu(); click('[data-act="init"][data-mode="missing"]');
    eq([p.init, g1.init], [12, 9], 'csak akinek nincs');
    W.openInitMenu();
    const box = $('[data-setting="groupInit"]'); box.checked = false; box.dispatchEvent(new W.Event('change', {bubbles: true}));
    eq(A('S.settings.groupInit'), false);
    stubRnd(1, 2, 5); click('[data-act="init"][data-mode="all"]');
    eq([p.init, g1.init, g2.init], [2, 4, 7], 'mindenki külön dob');
  });
  test('csempe gombjai: koncentráció (a chipre kattintva is megszűnik), halott, rejtett; adatlapról vissza az aktuálishoz', () => {
    const [a] = add(mk('A')), [b] = add(mk('B')); a.init = 10; b.init = 5; W.lep(1);
    const on = (x, sel) => click(`[data-cid="${x.cid}"] ${sel}`);
    on(b, 'button[data-act="toggleConc"]'); ok(b.conc, 'koncentrál');
    on(b, '.chip.conc'); ok(!b.conc, 'a chip megszünteti');
    on(b, '[data-act="toggleHidden"]'); ok(b.hiddenP && $(`.tile[data-cid="${b.cid}"]`).classList.contains('hiddenp'), 'rejtett');
    on(b, '[data-act="toggleDead"]'); ok(b.dead && $(`.tile[data-cid="${b.cid}"]`).classList.contains('dead'), 'halott');
    on(b, '.t-name'); eq(A('selected'), b.cid);
    click('[data-act="deselect"]'); eq(A('selected'), null);
  });
  test('Menü → Ürítés (Mégse = marad), nehézség ablak bezárása, mentett encounter törlése, forráskönyvek kijelölése', () => {
    add(mk()); W.openMenu();
    W.confirm = () => false; click('[data-act="clearAll"]'); eq(list().length, 1, 'Mégse');
    W.confirm = () => true; click('[data-act="clearAll"]'); eq([list().length, $('#modal').hidden], [0, true]);
    W.openDiffInfo(); ok(!$('#modal').hidden); click('[data-act="edCancel"]'); ok($('#modal').hidden, 'Bezárás');
    A(`S.saved = [{id: 'e1', name: 'Kápolna', list: []}]`); W.openLib('enc'); click('[data-act="encDel"]'); eq(A('S.saved'), []);
    A(`fiveIndex = {TST: 'x.json', MM: 'y.json'}`); W.openLib('five');
    const src = k => $(`input[data-src="${k}"]`), tick = (k, v) => { src(k).checked = v; src(k).dispatchEvent(new W.Event('change', {bubbles: true})); };
    tick('TST', true); tick('MM', false);
    eq(A('S.settings.sources'), ['TST']);
  });
  test('letöltések és sablonok: lény exportja (fájlnév tisztítva), sablonok, sablon megjelenítése', () => {
    const files = []; W.download = (n, o) => files.push([n, o]);
    W.upsertLibrary(mk('Kő-Ogre!'));
    W.openLib('lib'); click('[data-act="libExport"]');
    W.openLib('json'); click('[data-act="showTemplate"]'); has($('#jsonIn').value, '"name"');
    click('[data-act="downloadSheetTemplate"]');
    W.openMenu(); click('[data-act="downloadTemplate"]');
    eq(files.map(f => f[0]), ['Kő-Ogre.json', 'karakterlap-sablon.json', 'dmscreen-sablon.json']);
    eq([files[0][1].name, files[1][1].format], ['Kő-Ogre!', 'dmscreen-karakter']);
  });
  test('download: JSON fájlt készít a megadott névvel', async () => {
    let got; const proto = W.HTMLAnchorElement.prototype, origClick = proto.click;
    proto.click = function () { got = [this.download, this.href]; };
    try { ORIG.download('x.json', {a: 1}); } finally { proto.click = origClick; }
    eq(got[0], 'x.json');
    eq(await (await W.fetch(got[1])).json(), {a: 1});
  });
  const pickFile = (input, content, name, type = 'application/json') => {
    const dt = new W.DataTransfer(); dt.items.add(new W.File([content], name, {type}));
    input.files = dt.files; input.dispatchEvent(new W.Event('change', {bubbles: true}));
  };
  test('teljes mentés fájlból: a csempék frissülnek', async () => {
    const fi = $('#fileIn'); fi.click = () => {};
    try {
      add(mk('Régi')); eq($$('.tile').length, 1);
      W.openMenu(); click('[data-act="importAll"]');
      pickFile(fi, JSON.stringify({library: [], enc: {list: [], round: 1, active: null}, saved: []}), 'mentes.json');
      await until(() => !$$('.tile').length, 2000, 'a csempe eltűnik');
      eq($('#modal').hidden, true);
    } finally { delete fi.click; }
  });
  test('fájl importálása: lények (JSON fül), teljes mentés (Menü), hibás fájl', async () => {
    const fi = $('#fileIn'); let opened = 0; fi.click = () => opened++;
    try {
      W.openLib('json'); click('[data-act="importFile"]'); eq(opened, 1, 'fájlválasztó');
      pickFile(fi, JSON.stringify([mk('Fájlgoblin')]), 'lenyek.json');
      await until(() => A('S.library').some(c => c.name === 'Fájlgoblin'), 2000, 'lény import');
      has(allLog(), '1 lény importálva');
      W.openMenu(); click('[data-act="importAll"]'); eq(opened, 2);
      pickFile(fi, JSON.stringify({library: [mk('Mentett')], enc: {list: [], round: 1, active: null}, saved: []}), 'mentes.json');
      await until(() => A('S.library').map(c => c.name).join() === 'Mentett', 2000, 'mentés visszatöltése');
      let msg = ''; W.alert = m => { msg = m; };
      pickFile(fi, 'nem json', 'rossz.json');
      await until(() => msg, 2000, 'hibaüzenet'); has(msg, 'Hibás fájl');
    } finally { delete fi.click; }
  });
  test('portré a szerkesztőben: link, feltöltött kép 256 px-es JPEG-ként, törlés', async () => {
    W.openEditor(W.normCreature({}), () => {});
    const pf = $('#portraitFile'); let opened = 0; pf.click = () => opened++;
    click('[data-act="portraitUpload"]'); eq(opened, 1, 'fájlválasztó');
    setVal('#portraitUrl', 'https://x/k.png', 'input');
    eq([$('#edForm').elements.portrait.value, $('#portraitPv').style.visibility], ['https://x/k.png', 'visible']);
    const cv = W.document.createElement('canvas'); cv.width = 40; cv.height = 20;
    pickFile(pf, await new Promise(r => cv.toBlob(r, 'image/png')), 'k.png', 'image/png');
    await until(() => $('#edForm').elements.portrait.value.startsWith('data:image/jpeg'), 3000, 'kicsinyített kép');
    eq([$('#portraitUrl').value, $('#portraitUrl').placeholder], ['', '(feltöltött kép)']);
    click('[data-act="portraitClear"]');
    eq([$('#edForm').elements.portrait.value, $('#portraitPv').style.visibility], ['', 'hidden']);
  });
  test('vágólap: D&D Beyond beillesztés (magától, gombbal, vágólapról), zsákmány másolása; ha a böngésző nem engedi', async () => {
    W.openLib('ddb');
    const dt = new W.DataTransfer(); dt.setData('text/plain', JSON.stringify(DDB));
    $('#ddbPaste').dispatchEvent(new W.ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
    has($('#ddbMsg').textContent, '✓', 'beillesztéskor importált');
    $('#ddbMsg').innerHTML = ''; $('#ddbPaste').value = JSON.stringify(DDB); click('[data-act="ddbPasteImport"]');
    has($('#ddbMsg').textContent, '✓', 'Importálás gomb');
    let copied = null;
    Object.defineProperty(W.navigator, 'clipboard', {configurable: true, value: {readText: async () => JSON.stringify(DDB), writeText: async t => { copied = t; }}});
    try {
      $('#ddbMsg').innerHTML = ''; click('[data-act="ddbClipboard"]');
      await until(() => $('#ddbMsg').textContent.includes('✓'), 2000, 'vágólapról');
      W.navigator.clipboard.readText = async () => { throw new Error('tiltva'); };
      click('[data-act="ddbClipboard"]');
      await until(() => $('#ddbMsg').textContent.includes('nem engedte'), 2000, 'tiltott vágólap');
      stubLoot(); add(pc('A')); const [g] = add(mk()); g.dead = true;
      W.openLoot(); W.rnd = d => d; click('[data-act="lootRoll"]');
      await until(() => $('#lootOut [data-act="lootCopy"]'), 2000, 'zsákmány');
      click('#lootOut [data-act="lootCopy"]');
      await until(() => $('[data-act="lootCopy"]').textContent === '✓ Kimásolva', 2000, 'másolás'); has(copied, 'Összesen');
      W.navigator.clipboard.writeText = async () => { throw new Error('tiltva'); };
      click('#lootOut [data-act="lootCopy"]');
      await until(() => $('[data-act="lootCopy"]').textContent === 'A böngésző nem engedte', 2000, 'tiltott másolás');
    } finally { delete W.navigator.clipboard; }
  });
  test('letöltők (ál-fetch): 5e.tools forráslista és könyv, kincstáblák; egyszer tölt le, hibánál érthető üzenet', async () => {
    const origFetch = W.fetch, urls = [];
    W.fetch = async u => {
      u = String(u); urls.push(u);
      return {ok: true, json: async () => u.endsWith('index.json') ? {TST: 'bestiary-tst.json'} : u.includes('bestiary-tst') ? {monster: [FIVE.brute]} : {tabla: 1}};
    };
    try {
      eq(await ORIG.loadFiveIndex(), {TST: 'bestiary-tst.json'});
      eq((await ORIG.loadFiveSource('TST')).map(m => m.name), ['Test Brute']);
      await ORIG.loadFiveSource('TST'); await ORIG.loadFiveIndex();
      eq(urls.length, 2, 'másodszor már nem tölt le');
      let err = ''; try { await ORIG.loadFiveSource('XYZ'); } catch (e) { err = e.message; }
      has(err, 'Ismeretlen forrás');
      eq(await ORIG.loadLoot(), {tabla: 1}); await ORIG.loadLoot(); eq(urls.length, 3);
      A('lootData = null'); W.fetch = async () => ({ok: false, status: 404});
      err = ''; try { await ORIG.loadLoot(); } catch (e) { err = e.message; }
      eq(err, 'HTTP 404');
    } finally { W.fetch = origFetch; }
    A('fiveIndex = null'); W.loadFiveIndex = async () => { throw new Error('offline'); };
    W.openLib('five'); await until(() => $('#fiveMsg').textContent.includes('Nem sikerült elérni'), 2000, 'hibaüzenet');
    W.loadFiveIndex = async () => { A(`fiveIndex = {TST: 'x.json'}`); return {TST: 'x.json'}; };
    W.openLib('five'); await until(() => $('input[data-src="TST"]'), 2000, 'forráslista');
  });
  test('az oldal bezárásakor helyi másolat, függő mentés azonnal', () => {
    const origSave = W.doSave; let saved = 0; W.doSave = () => { saved++; };
    try {
      add(mk('Bezáráskor'));
      A('clearTimeout(saveTimer); saveTimer = null');
      let e = new W.Event('beforeunload', {cancelable: true}); W.dispatchEvent(e);
      has(W.localStorage.getItem('dmscreen'), 'Bezáráskor'); eq([saved, e.defaultPrevented], [0, false]);
      A('saveTimer = setTimeout(() => {}, 60000)');
      e = new W.Event('beforeunload', {cancelable: true}); W.dispatchEvent(e);
      eq([saved, e.defaultPrevented], [1, true]);
    } finally { W.doSave = origSave; A('clearTimeout(saveTimer); saveTimer = null'); W.localStorage.removeItem('dmscreen'); }
  });
});

// ======================================================================
describe('Online (csak  .\\teszt.ps1 -Online  esetén)', () => {
  test('5e.tools adatok elérhetők, a 2014-es goblin helyesen alakul át', async () => {
    W.loadFiveSource = ORIG.loadFiveSource; W.loadFiveIndex = ORIG.loadFiveIndex;
    const mm = await W.loadFiveSource('MM');
    const g = W.convert5e(mm.find(m => m.name === 'Goblin'));
    eq([g.ac, g.hp.max, W.atkInfo(g.actions.find(a => a.name === 'Scimitar').text).hit], [15, 7, '+4']);
  }, {online: true});
  test('szabálykönyv a valódi tükörből (2. fázis): 13 osztály, csak 2014-es alosztályok, fajok, hátterek, méret', async () => {
    const rb = W.__rbOnline = await ORIG.buildRulebook(), H = W.Sheet;
    eq(rb.classes.map(c => c.n).sort(), Object.keys(H.CLASSES).sort());
    for (const c of rb.classes) {
      eq([c.hd, c.saves], [H.CLASSES[c.n].hd, H.CLASSES[c.n].saves], c.n + ': hit die és mentők a beépített táblával egyeznek');
      eq(c.subLvl, H.CLASSES[c.n].subLvl, c.n + ': alosztály szintje');
      ok(c.feats.length >= 10 && c.asi.includes(4) && c.asi.includes(19), c.n + ': feature-ök / ASI');
    }
    eq(rb.classes.find(c => c.n === 'Fighter').asi, [4, 6, 8, 12, 14, 16, 19]);
    ok(rb.classes.find(c => c.n === 'Monk').cols.some(c => /Martial Arts/.test(c.l)), 'Monk: Martial Arts oszlop');
    ok(rb.classes.find(c => c.n === 'Warlock').opt.some(o => o.t.includes('EI')), 'Warlock: Invocations');
    const srcs = [...new Set([...rb.subclasses, ...rb.races, ...rb.subraces, ...rb.backgrounds, ...rb.optfeatures, ...rb.features].map(x => x.s))].sort();
    const bad = Object.entries({subclasses: rb.subclasses, races: rb.races, subraces: rb.subraces, backgrounds: rb.backgrounds, optfeatures: rb.optfeatures, features: rb.features}).flatMap(([k, l]) => l.filter(x => !['PHB', 'XGE', 'TCE'].includes(x.s)).map(x => k + ':' + x.n + '/' + (x.cls || '') + '/' + (x.sub || '') + '/' + x.s));
    eq(bad, [], 'forrás: ' + srcs.join(', '));
    const keys = rb.subclasses.map(s => s.cls + ':' + s.short);
    eq(keys.length, new Set(keys).size, 'egy alosztály csak egyszer (a 2024-es osztályhoz kötött példány nélkül)');
    ok(rb.subclasses.length >= 90 && rb.subclasses.length <= 130, 'alosztályok: ' + rb.subclasses.length);
    eq(rb.races.map(r => r.n).sort(), ['Custom Lineage', 'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Half-Orc', 'Halfling', 'Human', 'Tiefling']);
    ok(rb.subraces.some(s => s.n === 'Variant' && s.race === 'Human') && rb.subraces.some(s => s.n === 'Hill'), 'alfajok');
    ok(rb.backgrounds.length >= 14 && rb.backgrounds.every(b => b.fx?.length || b.n === 'Custom Background'), 'hátterek');
    ok(rb.optfeatures.length >= 100, 'optional feature-ök: ' + rb.optfeatures.length);
    const chunks = H.splitChunks(rb), total = chunks.reduce((t, c) => t + new TextEncoder().encode(c.data).length, 0);
    ok(chunks.every(c => new TextEncoder().encode(c.data).length < 950000), 'túl nagy darab');
    ok(total < 6e6, 'túl nagy szabálykönyv: ' + total);
  }, {online: true});
  test('a kézi hatástábla (FEATURE_FX) minden kulcsa létezik a valódi szabálykönyvben; egy valódi karakter számolása', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const traits = new Set([...rb.races, ...rb.subraces].flatMap(r => [r.n, ...(r.traits || []).map(t => t.n)]));
    const bad = Object.keys(H.FEATURE_FX).filter(k => {
      const p = k.split('|');
      if (p[0] === 'race') return !traits.has(p[1]);
      if (p[0] === 'feat') return !rb.feats.some(f => f.n === p[1]);
      if (p[0] === 'opt') return !rb.optfeatures.some(o => o.n === p[1]);
      if (p.length === 2) return !rb.features.some(f => f.cls === p[0] && !f.sub && f.n === p[1]);
      return !rb.features.some(f => f.cls === p[0] && f.sub === p[1] && f.n === p[2]);
    });
    eq(bad, [], 'nem létező kulcsok');
    const s = H.norm({auto: true, build: {race: 'Dwarf|PHB', subrace: 'Hill|PHB', base: {str: 15, dex: 10, con: 14, wis: 15, cha: 8}, levels: Array.from({length: 5}, () => ({c: 'Cleric'})), sub: {Cleric: 'Life|PHB'}},
      inventory: [{name: 'Chain Mail', equipped: true}, {name: 'Shield', equipped: true}, {name: 'Warhammer', equipped: true}]});
    const c = H.calc(s, rb);
    eq([c.ac.v, c.speed.v, c.hpMax.v, c.abilities.wis.v, c.casting[0].dc, c.casting[0].prepared, c.slots.filter(Boolean)], [18, '25 ft.', 48, 16, 14, 8, [4, 3, 2]]);
    ok(['Bless', 'Cure Wounds', 'Lesser Restoration', 'Spiritual Weapon', 'Beacon of Hope', 'Revivify'].every(n => c.always.some(a => a.name === n)), 'Life domain spellek: ' + c.always.map(a => a.name));
    eq(c.attacks[0].hit, '+5', 'Warhammer: STR 2 + PB 3 (Dwarven Combat Training)');
    ok(c.resources.some(r => r.name === 'Channel Divinity' && r.max === 1), 'Channel Divinity');
  }, {online: true});
  test('a tokenkép elérhető', async () => {
    const mm = await ORIG.loadFiveSource('MM');
    const r = await fetch(W.convert5e(mm.find(m => m.name === 'Goblin')).portrait);
    eq(r.status, 200);
  }, {online: true});
});

// ======================================================================
// ál-adatbázis a felhős funkciókhoz (a Firestore-adapter felületét utánozza)
function makeFakeDb(initial = {}) {
  const store = structuredClone(initial), log = [], watchers = [];
  const list = col => Object.entries(store).filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({...structuredClone(v), id: k.split('/')[1]}));
  return {store, log, emit: col => watchers.filter(w => w.col === col).forEach(w => w.cb(list(col))), db: {
    get: async p => store[p] ? structuredClone(store[p]) : null,
    list: async col => list(col),
    set: async (p, d) => { JSON.stringify(d); store[p] = structuredClone(d); log.push('set ' + p); },
    // mezőnkénti írás, mint a Firestore updateDoc: 'hp.cur' = beágyazott mező; a naplóba a mezőnevek kerülnek (updatedAt/By nélkül)
    update: async (p, d) => {
      if (!store[p]) throw Object.assign(new Error('nincs ilyen dokumentum'), {code: 'not-found'});
      for (const [k, v] of Object.entries(d)) { const ks = k.split('.'); ks.slice(0, -1).reduce((a, x) => a[x] = a[x] || {}, store[p])[ks.at(-1)] = structuredClone(v); }
      log.push('update ' + p + ' ' + Object.keys(d).filter(k => !k.startsWith('updated')).sort().join(','));
    },
    del: async p => { delete store[p]; log.push('del ' + p); },
    watch: (col, cb) => { const w = {col, cb}; watchers.push(w); return () => watchers.splice(watchers.indexOf(w), 1); }
  }};
}

// rosszindulatú adatok: ha bármelyik lefut, beállítja a window.__xss jelzőt
const XSS = '<img src=x onerror="window.__xss=1">';
const XQ = '" onmouseover="window.__xss=1" x="';
const evilCreature = () => ({
  name: XSS, kind: XQ, id: XQ, libId: XQ, portrait: 'javascript:window.__xss=1', cr: XSS, ac: XSS, acNote: XSS, type: XSS, source: XSS, speed: XSS, notes: XSS,
  hp: {max: XSS, cur: XQ, formula: XSS}, abilities: {str: XSS, dex: XQ}, saves: {con: XSS, wis: XQ}, legendaryCount: XSS, initBonus: XQ,
  actions: [{name: XSS, text: XSS + ' Melee Weapon Attack: +4 to hit. Hit: 1d6+2 slashing damage.'}], legendary: [{name: XSS, text: XSS}], traits: 'nem tömb'
});
const evilCombatant = () => ({cid: XQ, num: XSS, c: evilCreature(), hp: XSS, temp: XQ, init: XQ, cond: [{name: XSS, rounds: XQ}], side: XQ, group: XQ, publicName: XSS, notes: XSS, leg: XQ});
async function renderEverywhere() {
  // minden nézet kirajzolása, ahol a lény adatai megjelenhetnek
  W.render();
  const first = A('order()')[0];
  if (first) { A(`selected = ${JSON.stringify(first.cid)}`); W.render(); W.lep(1); }
  for (const t of ['lib', 'enc']) W.openLib(t);
  if (A('S.library.length')) W.openEditor(A('S.library[0]'), () => {});
  W.closeModal(); W.openDiffInfo(); W.closeModal(); W.broadcast();
  await wait(300);
}
function assertNoXss() {
  for (const [nm, doc] of [['DM képernyő', W.document], ['Initiative tracker', P.document]]) {
    eq(doc.querySelectorAll('[onmouseover]').length, 0, nm + ': attribútum-befecskendezés');
    eq(doc.querySelectorAll('img[src="x"]').length, 0, nm + ': HTML-befecskendezés');
  }
  eq(W.__xss, undefined, 'lefutott a befecskendezett kód'); eq(P.__xss, undefined, 'lefutott a kód az Initiative trackeren');
}

describe('Biztonság (befecskendezett kód ellen)', () => {
  test('lény-adatok tisztítása: számok, típus, azonosító, portré', () => {
    const c = W.normCreature(evilCreature());
    eq([c.kind, c.ac, c.hp.max, c.hp.cur, c.abilities.str, c.abilities.dex, c.legendaryCount, c.initBonus, c.portrait, c.traits], ['monster', 10, 10, 10, 10, 10, 0, null, '', []]);
    eq(c.saves, {});
    ok(/^[A-Za-z0-9_-]+$/.test(c.id) && /^[A-Za-z0-9_-]+$/.test(c.libId), 'nem biztonságos azonosító: ' + c.id);
    eq(c.name, XSS, 'a név szövegként megmarad (kiíráskor escape-elődik)');
  });
  test('érvényes értékek érintetlenek maradnak', () => {
    const c = W.normCreature({id: 'abc_12-x', kind: 'pc', ac: '17', hp: {max: '45', cur: 30}, abilities: {dex: '16'}, saves: {dex: '+5'}, portrait: 'https://example.com/a.png', initBonus: '3', legendaryCount: 3});
    eq([c.id, c.kind, c.ac, c.hp.max, c.hp.cur, c.abilities.dex, c.saves, c.portrait, c.initBonus, c.legendaryCount], ['abc_12-x', 'pc', 17, 45, 30, 16, {dex: 5}, 'https://example.com/a.png', 3, 3]);
    eq(W.normCreature({portrait: 'data:image/png;base64,AAAA'}).portrait, 'data:image/png;base64,AAAA');
  });
  test('harc-résztvevő tisztítása (oldal, számok, állapotok)', () => {
    const x = W.normCombatant(evilCombatant());
    eq([x.num, x.hp, x.temp, x.init, x.leg, 'side' in x, x.cond[0].rounds], [0, 10, 0, null, 0, false, 0]);
    ok(/^[A-Za-z0-9_-]+$/.test(x.cid) && /^[A-Za-z0-9_-]+$/.test(x.group), 'nem biztonságos azonosító');
  });
  test('JSON-import: semmi nem fut le, sehol', async () => {
    const [c] = await W.importAny(evilCreature());
    add(c); await renderEverywhere();
    assertNoXss();
    has($('.tile .t-name').textContent, '<img', 'a nevet szövegként kell mutatni');
  });
  test('teljes mentésfájl visszatöltése: semmi nem fut le', async () => {
    W.importBackup({library: [evilCreature()], saved: [{id: XQ, name: XSS, list: [evilCreature()]}],
      enc: {list: [evilCombatant(), evilCombatant()], round: XSS, active: XQ}, settings: {sources: [XSS, 'MM'], groupInit: XQ, lastExport: XSS}});
    eq([A('S.enc.round'), A('S.settings.sources'), A('S.settings.groupInit'), A('S.settings.lastExport')], [1, ['MM'], true, '']);
    await renderEverywhere();
    assertNoXss();
  });
  test('hibás mentésfájl: hibaüzenet, az adatok nem változnak', () => {
    add(mk());
    let err = null; try { W.importBackup({foo: 1}); } catch (e) { err = e; }
    ok(err, 'nem dobott hibát'); eq(list().length, 1);
  });
  test('a felhőből érkező rosszindulatú adat sem fut le', async () => {
    const f = makeFakeDb({'dmscreen_library/a': evilCreature(), 'dmscreen/state': {enc: {list: [evilCombatant()], round: 2, active: null}, settings: {}}});
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db});
    await renderEverywhere();
    assertNoXss();
  });
  test('a böngésző tárolójából érkező rosszindulatú adat sem fut le', async () => {
    W.localStorage.setItem('dmscreen', JSON.stringify({library: [evilCreature()], enc: {list: [evilCombatant()]}, saved: []}));
    await W.DMApp.setAuth({status: 'unconfigured'});
    W.localStorage.removeItem('dmscreen');
    await renderEverywhere();
    assertNoXss();
  });
});

// ======================================================================
describe('Biztonsági mentések', () => {
  const withData = () => ({'dmscreen_library/a': {name: 'Zombie', kind: 'monster'}, 'dmscreen/state': {enc: {list: [], round: 1, active: null}, settings: {}}});
  test('betöltéskor elkészül a napi felhős mentés, ugyanaznap nem ismétlődik', async () => {
    const f = makeFakeDb(withData());
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(200);
    const today = A('localDate()');
    ok(f.store['dmscreen_backup/' + today], 'nincs mai mentés');
    eq(f.store['dmscreen/backups'].items.map(b => [b.id, b.note, b.library]), [[today, 'napi', 1]]);
    eq(JSON.parse(f.store['dmscreen_backup/' + today].data).library[0].name, 'Zombie');
    f.log.length = 0;
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(200);
    eq(f.log.filter(l => l.includes('backup')), []);
  });
  test('üres adatnál nem készül mentés', async () => {
    const f = makeFakeDb();
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(200);
    ok(!f.store['dmscreen/backups'], 'üres állapotról is készült mentés');
  });
  test('legfeljebb 14 mentés marad, a legrégebbiek törlődnek', async () => {
    const init = withData(), items = [];
    for (let i = 1; i <= 14; i++) { const id = `2020-01-${String(i).padStart(2, '0')}`; items.push({id, note: 'napi'}); init['dmscreen_backup/' + id] = {data: '{}'}; }
    init['dmscreen/backups'] = {items};
    const f = makeFakeDb(init);
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(300);
    const ids = f.store['dmscreen/backups'].items.map(b => b.id);
    eq(ids.length, 14); eq(ids[0], A('localDate()')); ok(!ids.includes('2020-01-01'), 'a legrégebbi megmaradt');
    ok(!f.store['dmscreen_backup/2020-01-01'], 'a legrégebbi mentés dokumentuma nem törlődött');
    ok(f.store['dmscreen_backup/2020-01-02'], 'túl sok törlődött');
  });
  test('túl nagy adatnál a felhős mentés kimarad, figyelmeztetéssel', async () => {
    const init = withData(); init['dmscreen_library/a'].notes = 'x'.repeat(950000);
    const f = makeFakeDb(init);
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(200);
    ok(!f.store['dmscreen/backups'], 'a túl nagy mentés mégis elkészült');
    has(A('backupWarn'), 'túl nagy');
  });
  test('visszaállítás: a régi állapot visszajön, előtte a mostaniról is mentés készül', async () => {
    const old = {library: [{id: 'a', name: 'Régi Zombie'}], saved: [], enc: {list: [], round: 4, active: null}, settings: {}};
    const init = withData(); init['dmscreen_library/b'] = {name: 'Új Ghoul'};
    init['dmscreen_backup/2026-01-01'] = {data: JSON.stringify(old)}; init['dmscreen/backups'] = {items: [{id: '2026-01-01', note: 'napi'}]};
    const f = makeFakeDb(init);
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(200);
    await W.restoreBackup('2026-01-01'); await wait(500);
    eq([A('S.library').map(c => c.name), A('S.enc.round')], [['Régi Zombie'], 4]);
    ok(!f.store['dmscreen_library/b'], 'a régi mentésben nem szereplő lény nem törlődött a felhőből');
    ok(f.store['dmscreen/backups'].items.some(b => b.note === 'visszaállítás előtt'), 'nem készült mentés a visszaállítás előtt');
  });
  test('Menü: mentések listája, „Mentés most”, visszaállítás gomb', async () => {
    const f = makeFakeDb(withData());
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(200);
    W.openMenu(); click('[data-act="openBackups"]'); await until(() => $$('[data-backup]').length === 1, 2000, 'lista');
    click('[data-act="backupNow"]'); await until(() => $$('[data-backup]').length === 2, 2000, '„Mentés most”');
    has($('#modalBox').textContent, 'kézi mentés');
    add(mk('Utána'));
    click($$('[data-act="backupRestore"]')[1]); await wait(300);
    has(allLog(), 'visszaállítva');
    ok(!$$('.tile').some(t => t.textContent.includes('Utána')), 'a visszaállítás után a csempék frissülnek');
  });
  test('emlékeztető a fájlba mentésre: üresen nincs, 7 nap után van, mentés után eltűnik', () => {
    W.render(); ok($('#backupNag').hidden, 'üres adatnál is megjelent');
    add(mk()); has($('#backupNag').textContent, 'még sosem'); ok(!$('#backupNag').hidden);
    const d = new W.Date(); d.setDate(d.getDate() - 8); A(`S.settings.lastExport = localDate(new Date(${d.getTime()}))`); W.render();
    has($('#backupNag').textContent, '8 napja');
    d.setDate(d.getDate() + 3); A(`S.settings.lastExport = localDate(new Date(${d.getTime()}))`); W.render();
    ok($('#backupNag').hidden, '5 napnál még nem kellene szólnia');
    A(`S.settings.lastExport = ''`); W.render();
    let fname = ''; W.download = n => fname = n;
    click('#backupNag');
    eq([fname, A('S.settings.lastExport')], [`dmscreen-mentes-${A('localDate()')}.json`, A('localDate()')]);
    ok($('#backupNag').hidden, 'mentés után is látszik');
  });
});

// ======================================================================
// a DMG kincstáblák felépítését követő mintaadat (5e.tools loot.json formátum)
const LOOT = {
  individual: [
    {source: 'XDMG', crMin: 0, crMax: 4, table: [{min: 1, max: 100, coins: {pp: '1'}}]},
    {source: 'DMG', crMin: 0, crMax: 4, table: [{min: 1, max: 50, coins: {cp: '5d6'}}, {min: 51, max: 100, coins: {gp: '3d6'}}]},
    {source: 'DMG', crMin: 5, crMax: 10, table: [{min: 1, max: 100, coins: {gp: '2d6*10', ep: '1d6*10'}}]}
  ],
  hoard: [{source: 'DMG', crMin: 0, crMax: 4, coins: {cp: '6d6*100', gp: '2d6*10'}, table: [
    {min: 1, max: 50},
    {min: 51, max: 100, gems: {type: 10, amount: '2'}, artObjects: {type: 25, amount: '1'}, magicItems: [{type: 'A', amount: '1'}, {type: 'G', amount: '2'}]}
  ]}],
  gems: [{source: 'DMG', type: 10, table: ['{@item Azurite} (opaque mottled deep blue)', 'Hematite']}],
  artObjects: [{source: 'DMG', type: 25, table: ['{@item Silver ewer}']}],
  magicItems: [
    {source: 'DMG', type: 'A', table: [{min: 1, max: 100, item: '{@item Potion of Healing}'}]},
    {source: 'DMG', type: 'G', table: [
      {min: 1, max: 50, choose: {fromGeneric: ['+2 Weapon']}},
      {min: 51, max: 100, item: 'Figurine', table: [{min: 1, item: '{@item Figurine, Bronze Griffon}'}, {min: 2, max: 3, item: '{@item Figurine, Onyx Dog}'}]}
    ]}
  ]
};
const stubLoot = (data = LOOT) => { W.loadLoot = async () => structuredClone(data); };

describe('Zsákmány (DMG 2014 kincstáblák)', () => {
  test('CR-sávok: 0–4, 5–10, 11–16, 17+', () => eq(['0', '1/4', '4', '5', '10', '11', '16', '17', '30', '', 'CR 7'].map(W.crBand), [0, 0, 0, 1, 1, 2, 2, 3, 3, 0, 1]));
  test('mennyiség-kifejezések: kocka, szorzó, konstans', () => {
    stubRnd(3); eq(W.rollAmount('2d6*100'), 600);
    eq(W.rollAmount('4'), 4);
    stubRnd(5); eq(W.rollAmount('1d6'), 5);
  });
  test('csak a DMG (2014) táblákat használja, az XDMG-t nem', () => eq(W.dmgTable(LOOT.individual, 0).source, 'DMG'));
  test('egyéni kincs: a d100 szerinti sor érméi', () => {
    const [g] = add(mk()); const [o] = add(ogre('Ogre')); o.c.cr = '7';
    stubRnd(60, 2, 3, 4, 50, 1, 1, 3);  // goblin: d100=60 → 3d6 gp; ogre: d100=50 → 2d6×10 gp, 1d6×10 ep
    const r = W.generateLoot(LOOT, [g, o], 'individual', 0);
    eq(r.creatures.map(c => c.coins), [{gp: 9}, {gp: 20, ep: 30}]);
    eq(r.hoard, null);
  });
  test('kincshalom maximális dobásokkal: érmék, drágakövek, műtárgy, mágikus tárgyak, beágyazott tábla', () => {
    W.rnd = d => d;
    const r = W.generateLoot(LOOT, [], 'hoard', 0);
    eq(r.hoard.coins, {cp: 3600, gp: 120});
    eq(r.hoard.gems.map(g => g.name), ['Hematite', 'Hematite']);
    eq(r.hoard.art.map(a => a.name), ['Silver ewer']);
    eq(r.hoard.items.map(i => [i.name, i.table]), [['Potion of Healing', 'A'], ['Figurine, Onyx Dog', 'G'], ['Figurine, Onyx Dog', 'G']]);
  });
  test('kincshalom minimális dobásokkal: csak érmék', () => {
    W.rnd = () => 1;
    const h = W.generateLoot(LOOT, [], 'hoard', 0).hoard;
    eq([h.coins, h.gems.length, h.art.length, h.items.length], [{cp: 600, gp: 20}, 0, 0, 0]);
  });
  test('„válassz” típusú tárgy (pl. +2 Weapon) olvasható névvel', () => {
    eq(W.lootItemName({choose: {fromGeneric: ['+2 Weapon']}}), '+2 Weapon (válassz konkrét tárgyat)');
    eq(W.lootItemName({item: '{@item Bag of Holding}'}), 'Bag of Holding');
  });
  test('felszerelés: fegyverek és páncél igen, természetes támadás és varázslat nem', () => {
    const c = W.normCreature({acNote: 'leather armor, shield', actions: [
      {name: 'Scimitar', text: 'Melee Weapon Attack: +4 to hit.'}, {name: 'Shortbow', text: 'Ranged Weapon Attack: +4 to hit.'},
      {name: 'Bite', text: 'Melee Weapon Attack: +5 to hit.'}, {name: 'Guiding Bolt (1/encounter)', text: 'Ranged Spell Attack: +4 to hit.'},
      {name: 'Dagger (Recharge 6)', text: 'Melee Attack Roll: +3.'}, {name: 'Multiattack', text: 'Two attacks.'},
      {name: 'Leadership', text: 'Each creature can add a d4 to its attack roll or saving throw.'}]});
    eq(W.gearOf(c), ['Scimitar', 'Shortbow', 'Dagger', 'leather armor', 'shield']);
    eq(W.gearOf(W.normCreature({acNote: 'natural armor', actions: [{name: 'Claw', text: 'Melee Weapon Attack: +2 to hit.'}]})), []);
  });
  test('összesítés: arany-egyenérték drágakövekkel és műtárgyakkal, fejenkénti rész', () => {
    ['A', 'B', 'C', 'D'].forEach(n => add(pc(n))); const [g] = add(mk());
    W.rnd = d => d;
    const t = W.lootTotals(W.generateLoot(LOOT, [g], 'both', 0));
    eq(t.coins, {gp: 138, cp: 3600}); eq([t.gp, t.party, t.each], [219, 4, 54.75]);
  });
  test('alapértelmezett kijelölés: a legyőzöttek, állat nélkül; ha senki nem halt meg, mindenki', () => {
    const [a] = add(mk('Goblin')), [b] = add(mk('Farkas', {type: 'beast'})), [c] = add(mk('Ork')); add(pc('Rella'));
    a.dead = true; b.dead = true;
    W.openLoot();
    // initiative-sorrendben jelennek meg (azonos értéknél ábécérendben)
    eq($$('.lootPick').map(i => [i.closest('.lrow').querySelector('b').textContent, i.checked]), [['Farkas', false], ['Goblin', true], ['Ork', false]]);
    a.dead = false; b.dead = false; W.openLoot();
    eq($$('.lootPick').map(i => i.checked), [false, true, true]);
  });
  test('kincshalom szintje alapból a legerősebb kiválasztott ellenfél szerint', () => {
    const [g] = add(mk()), [o] = add(ogre()); o.c.cr = '12'; g.dead = true; o.dead = true;
    W.openLoot(); eq($('#lootBand').value, '2');
  });
  test('ablak: generálás, újradobás, naplóba, mágikus tárgy link', async () => {
    stubLoot(); ['A', 'B'].forEach(n => add(pc(n))); const [g] = add(mk()); g.dead = true;
    W.openLoot(); $('#lootMode').value = 'both';
    W.rnd = d => d; click('[data-act="lootRoll"]');
    await until(() => $('#lootOut').textContent.includes('Összesen'), 2000, 'eredmény');
    const out = $('#lootOut').textContent;
    has(out, 'Goblin'); has(out, 'Felszerelés: Scimitar'); has(out, '2× Hematite (10 gp)'); has(out, 'Potion of Healing'); has(out, 'fejenként');
    ok($('#lootOut a[href*="5e.tools/items.html#potion%20of%20healing_dmg"]'), 'nincs link a mágikus tárgyhoz');
    W.rnd = () => 1; click('#lootOut [data-act="lootRoll"]');
    await until(() => !$('#lootOut').textContent.includes('Hematite') && $('#lootOut').textContent.includes('Összesen'), 2000, 'újradobás');
    click('#lootOut [data-act="lootLog"]'); has(allLog(), '🎁'); has(allLog(), 'Kincshalom');
  });
  test('ha nem érhetők el a táblák: érthető hibaüzenet', async () => {
    W.loadLoot = async () => { throw new Error('offline'); };
    add(mk()); W.openLoot(); click('[data-act="lootRoll"]');
    await until(() => $('#lootOut').textContent.includes('Nem sikerült'), 2000, 'hibaüzenet');
  });
  test('ellenfél nélkül csak kincshalom', () => {
    add(pc('Rella')); W.openLoot();
    eq([$$('.lootPick').length, $('#lootMode').value], [0, 'hoard']);
  });
  test('a táblákból jövő nevek nem tudnak kódot befecskendezni', async () => {
    const evil = structuredClone(LOOT); evil.gems[0].table = [XSS, XSS]; evil.magicItems[0].table[0].item = XSS;
    stubLoot(evil); const [g] = add(mk(XSS)); g.dead = true;
    W.openLoot(); $('#lootMode').value = 'both'; W.rnd = d => d; click('[data-act="lootRoll"]');
    await until(() => $('#lootOut').textContent.includes('Összesen'), 2000, 'eredmény');
    click('#lootOut [data-act="lootLog"]'); await wait(100);
    assertNoXss();
  });
  test('valódi DMG kincstáblák elérhetők és használhatók', async () => {
    W.loadLoot = ORIG.loadLoot;
    const data = await W.loadLoot();
    for (let b = 0; b < 4; b++) { ok(W.dmgTable(data.individual, b), 'nincs egyéni tábla: ' + b); ok(W.dmgTable(data.hoard, b), 'nincs kincshalom tábla: ' + b); }
    for (const t of 'ABCDEFGHI') ok(data.magicItems.some(m => m.source === 'DMG' && m.type === t), 'nincs mágikustárgy-tábla: ' + t);
    const [o] = add(ogre()); o.c.cr = '17';
    for (let i = 0; i < 30; i++) { const r = W.generateLoot(data, [o], 'both', i % 4); ok(W.lootTotals(r).gp >= 0); r.hoard.items.forEach(it => ok(it.name && !it.name.includes('{@'), 'feldolgozatlan név: ' + it.name)); }
  }, {online: true});
});

// ======================================================================
// a D&D Beyond minta bővítése felszereléssel, pénzzel, egyedi nevekkel, Jack of All Trades-szel
function ddbParty() {
  const d = structuredClone(DDB);
  d.data.currencies = {cp: 7, sp: 20, ep: 0, gp: 150, pp: 2};
  d.data.inventory = [
    {id: 1, containerEntityId: 424242, quantity: 1, equipped: true, isAttuned: true, definition: {name: 'Ring of Protection', magic: true, rarity: 'Rare'}},
    {id: 2, containerEntityId: 424242, quantity: 1, equipped: false, definition: {name: 'Backpack', isContainer: true}},
    {id: 3, containerEntityId: 2, quantity: 5, definition: {name: 'Rations (1 day)'}},
    {id: 4, containerEntityId: 2, quantity: 1, definition: {name: 'Rope, Hempen (50 feet)'}},
    {id: 5, containerEntityId: 424242, quantity: 1, definition: {name: 'Spell Scroll (1st Level)', magic: true, rarity: 'Common'}},
    {id: 6, containerEntityId: 424242, quantity: 0, definition: {name: 'Hand Drum'}},
    {id: 7, containerEntityId: 424242, quantity: 1, equipped: true, definition: {name: 'Breastplate', armorTypeId: 2, armorClass: 14}}
  ];
  d.data.characterValues = [{typeId: 8, valueId: 5, value: 'Mage Armor'}, {typeId: 9, valueId: 1, value: 'a nagymamától'}];
  d.data.modifiers.class.push(
    {type: 'half-proficiency', subType: 'ability-checks'}, {type: 'half-proficiency', subType: 'initiative'},
    {type: 'bonus', subType: 'passive-perception', value: 5},
    {type: 'proficiency', subType: 'thieves-tools', friendlySubtypeName: "Thieves' Tools"}, {type: 'proficiency', subType: 'lute', friendlySubtypeName: 'Lute'},
    {type: 'proficiency', subType: 'longsword', friendlySubtypeName: 'Longsword'}, {type: 'proficiency', subType: 'light-armor', friendlySubtypeName: 'Light Armor'},
    {type: 'proficiency', subType: 'simple-weapons', friendlySubtypeName: 'Simple Weapons'});
  return d;
}
const manualPc = () => W.normCreature({name: 'Borin', kind: 'pc', cr: 'Szint 5', abilities: {str: 16, dex: 12, con: 14, int: 8, wis: 14, cha: 10},
  skills: 'Perception +5, Sleight of Hand +7', senses: 'darkvision 60 ft.', languages: 'Common, Dwarvish',
  inventory: [{name: 'Torch', qty: 10, container: 'Backpack'}, {name: 'Rope, Silk (50 feet)', qty: 1}], currency: {gp: 40, sp: 5}, tools: "Smith's Tools"});

describe('Csapat nézet (harcon kívül)', () => {
  test('D&D Beyond: felszerelés tárolókkal, egyedi névvel, jegyzettel; 0 darabos kimarad', () => {
    const inv = W.convertDDB(ddbParty()).inventory;
    eq(inv.map(i => [i.name, i.qty, i.container]), [['Ring of Protection', 1, ''], ['Backpack', 1, ''], ['Rations (1 day)', 5, 'Backpack'], ['Rope, Hempen (50 feet)', 1, 'Backpack'], ['Mage Armor (Spell Scroll (1st Level))', 1, ''], ['Breastplate', 1, '']]);
    eq([inv[0].attuned, inv[0].equipped, inv[0].magic, inv[0].rarity, inv[0].note], [true, true, true, 'Rare', 'a nagymamától']);
  });
  test('tárolóazonosító nélküli tárgyak a fő listába kerülnek', () => {
    eq(W.convertDDB(DDB).inventory.map(i => i.container), ['', '', '', '', '', '', '']);
  });
  test('D&D Beyond: pénz, eszköz- és hangszer-jártasság (fegyver/páncél nélkül), import dátuma', () => {
    const c = W.convertDDB(ddbParty());
    eq(c.currency, {pp: 2, gp: 150, ep: 0, sp: 20, cp: 7});
    eq(c.tools, "Thieves' Tools, Lute");
    eq(c.importedAt, A('localDate()').slice(0, 4) + c.importedAt.slice(4)); ok(/^\d{4}-\d{2}-\d{2}$/.test(c.importedAt));
  });
  test('Jack of All Trades: fél jártasság a nem jártas skillekre és az initiative-ra', () => {
    const c = W.convertDDB(ddbParty());  // 5. szint → jártassági bónusz 3, a fele 1
    eq(c.skillMods.perception, {b: 2, p: 0.5});
    eq(c.skillMods.athletics, {b: 6, p: 1}); eq(c.skillMods.stealth, {b: 9, p: 2});
    eq(c.initBonus, 3 + 2 + 1);
  });
  test('passzív érték: 10 + skill + passzív bónusz (pl. Observant)', () => {
    const c = W.convertDDB(ddbParty());
    eq([W.passiveScore(c, 'perception'), W.passiveScore(c, 'investigation'), W.passiveScore(c, 'insight')], [17, 12, 12]);
    has(c.senses, 'passive Perception 17');
  });
  test('kézzel felvitt játékos: skill a „Skills” mezőből, különben képességmódosító', () => {
    const c = manualPc();
    eq([W.partySkill(c, 'perception'), W.partySkill(c, 'sleight-of-hand'), W.partySkill(c, 'arcana')], [{b: 5, p: 1}, {b: 7, p: 1}, {b: -1, p: 0}]);
    eq(W.skillLabel('sleight-of-hand'), 'Sleight of Hand');
  });
  test('nézet: passzív táblázat és skill-táblázat, a legjobb kiemelve; szörny nem jelenik meg', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.upsertLibrary(W.normCreature(mk()));
    W.openParty();
    const [pt, st] = $$('.ptable');
    eq([...pt.rows].map(r => [...r.cells].slice(0, 4).map(c => c.textContent.trim())), [['Név', 'Passive Perception', 'Passive Investigation', 'Passive Insight'], ['Borin', '15', '9', '12'], ['Teszt Tünde', '17', '12', '12']]);
    eq([...pt.rows[2].cells].slice(1, 4).map(c => c.classList.contains('best')), [true, true, true]);
    const stealth = [...st.rows].find(r => r.cells[0].textContent.startsWith('Stealth'));
    eq([...stealth.cells].slice(1, 3).map(c => c.textContent), ['+1', '+9◆']);
    ok(stealth.cells[2].classList.contains('best'));
    hasNot($$('.ptable').map(t => t.textContent).join('') + $('.pcards').textContent, 'Goblin');
  });
  test('titkos dobás cellára kattintva, előnnyel, és csoportos dobás', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.openParty();
    stubRnd(12); click($$('td.sk[data-sk="stealth"]')[1]);
    has($('#partyRoll').textContent, 'Teszt Tünde Stealth: 21'); has(allLog(), 'Stealth');
    stubRnd(3, 15); click($$('td.sk[data-sk="perception"]')[0], {shiftKey: true});
    has($('#partyRoll').textContent, 'Borin Perception: 20'); has($('#partyRoll').textContent, 'előny');
    stubRnd(10); click('[data-act="partyGroup"][data-sk="insight"]');
    has($('#partyRoll').textContent, 'Borin Insight: 12'); has($('#partyRoll').textContent, 'Teszt Tünde Insight: 12');
  });
  test('kereső a tárgyak között: találatszám, elrejtés, a találat nélküli kártya halványabb', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.openParty();
    setVal('#partySearch', 'ROPE', 'input');
    eq($('#partySearchInfo').textContent, '2 találat');
    eq($$('#modalBox [data-item]:not([hidden])').map(li => li.textContent), ['Rope, Silk (50 feet)', 'Rope, Hempen (50 feet)']);
    setVal('#partySearch', 'torch', 'input');
    eq($$('.pcard').map(c => c.style.opacity), ['1', '0.35']);
    setVal('#partySearch', 'nagymamától', 'input'); eq($('#partySearchInfo').textContent, '1 találat');
    setVal('#partySearch', '', 'input'); eq($$('#modalBox [data-item][hidden]').length, 0);
  });
  test('kártyák: pénz, tárolók, hangolt/viselt jelölés, eszközök; a csapat összes pénze', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.openParty();
    const tunde = $$('.pcard')[1].textContent;
    has(tunde, '2 pp, 150 gp, 20 sp, 7 cp'); has(tunde, '🎒 Backpack'); has(tunde, '5× Rations'); has(tunde, '✦ hangolva'); has(tunde, 'viselve'); has(tunde, "Thieves' Tools, Lute");
    has(tunde, 'D&D Beyond import:');
    has($('#modalBox').textContent, 'Csapat pénze: 2 pp, 190 gp, 25 sp, 7 cp');
    eq(W.coinsGp({pp: 2, gp: 190, sp: 25, cp: 7}), 212.57);
  });
  test('üres csapat: útmutató üzenet', () => { W.openParty(); has($('#modalBox').textContent, 'Még nincs játékos'); });
  test('szerkesztő: felszerelés szövegként (darab, tároló), a jelölések megmaradnak; pénz és eszközök', async () => {
    const c = W.upsertLibrary(W.convertDDB(ddbParty())); W.openParty();
    click('.pcard [data-act="partyEdit"]');
    const f = $('#edForm').elements;
    has(f.inventory.value, '5× Rations (1 day) [Backpack]');
    f.inventory.value = f.inventory.value + '\n3× Fáklya [Backpack]\nVarázspálca';
    f.cur_gp.value = '999'; f.tools.value = "Thieves' Tools, Lute, Flute";
    click('[data-act="edSave"]');
    const s = A('S.library')[0];
    ok(s.inventory.find(i => i.name === 'Ring of Protection').attuned, 'elveszett a hangolás');
    eq(s.inventory.filter(i => ['Fáklya', 'Varázspálca'].includes(i.name)).map(i => [i.name, i.qty, i.container]), [['Fáklya', 3, 'Backpack'], ['Varázspálca', 1, '']]);
    eq([s.currency.gp, s.currency.pp, s.tools, s.id], [999, 2, "Thieves' Tools, Lute, Flute", c.id]);
    await until(() => !$('#modal').hidden && $('#modalBox').textContent.includes('Passzív értékek'), 2000, 'visszatérés a Csapat nézetre');
  });
  test('tisztítás: hibás felszerelés-, pénz- és skilladatok', () => {
    const c = W.normCreature({inventory: ['szöveg', {name: {x: 1}}, {name: 'Kötél', qty: 'sok', equipped: 'igen'}], currency: {gp: -5, pp: 'x'},
      skillMods: {stealth: {b: '4', p: 7}, hacking: {b: 9, p: 1}}, passiveBonus: {perception: 'x'}, importedAt: '<b>'});
    eq(c.inventory, [{name: 'Kötél', qty: 1, equipped: true, attuned: false, magic: false, rarity: '', container: '', note: '', ref: ''}]);
    eq([c.currency.gp, c.currency.pp, c.skillMods, c.passiveBonus.perception, c.importedAt], [0, 0, {stealth: {b: 4, p: 0}}, 0, '']);
  });
  test('a felszerelés és a nyelvek nem tudnak kódot befecskendezni', async () => {
    W.upsertLibrary(W.normCreature({name: XSS, kind: 'pc', languages: XSS, tools: XSS, senses: XSS, notes: XSS, type: XSS,
      inventory: [{name: XSS, note: XSS, container: XSS, rarity: XQ, qty: XQ}], currency: {gp: XSS}, skillMods: {stealth: {b: XSS, p: XQ}}}));
    W.openParty(); setVal('#partySearch', 'img', 'input'); click('td.sk[data-sk="stealth"]');
    await wait(200); assertNoXss();
  });
});

// ======================================================================
const partyNames = () => $$('.ptable')[0] ? [...$$('.ptable')[0].rows].slice(1).map(r => r.cells[0].textContent.trim()) : [];
const setupParty = () => {
  W.upsertLibrary(W.convertDDB(ddbParty()));  // Teszt Tünde: P.Perc 17, P.Inv 12, P.Ins 12
  W.upsertLibrary(manualPc());                 // Borin: 15, 9, 12
  W.upsertLibrary(W.normCreature({name: 'Aria', kind: 'pc', abilities: {wis: 18, int: 16}}));  // 14, 13, 14
  W.upsertLibrary(W.normCreature({name: 'Kísérő Bard', kind: 'npc', abilities: {wis: 10}}));
  W.upsertLibrary(W.normCreature(mk()));
};
describe('Csapat: tagok és rendezés', () => {
  test('alapból az összes játékos a csapatban, NPC és szörny nem', () => {
    setupParty(); W.openParty();
    eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde']);
    eq($$('[data-act="partyRemove"]').length, 3);
  });
  test('kivétel a csapatból (✕), a beállítás elmentődik', () => {
    setupParty(); W.openParty();
    click($$('[data-act="partyRemove"]').find(c => c.textContent.includes('Borin')));
    eq(partyNames(), ['Aria', 'Teszt Tünde']);
    eq(A('S.settings.partyIds').length, 2); hasNot($('#modalBox .pcards').textContent, 'Borin');
  });
  test('hozzáadás a könyvtárból (NPC is), a listában csak a nem-tagok vannak', () => {
    setupParty(); W.openParty();
    const opts = [...$('#partyAddSel').options].slice(1).map(o => o.textContent);
    eq(opts, ['Kísérő Bard (NPC)', 'Goblin (Szörny)'], 'előbb az NPC-k, aztán a szörnyek');
    setVal('#partyAddSel', $$('#partyAddSel option').find(o => o.textContent.startsWith('Kísérő')).value);
    eq(partyNames(), ['Aria', 'Borin', 'Kísérő Bard', 'Teszt Tünde']);
    has($('#modalBox .pcards').textContent, 'Kísérő Bard');
  });
  test('könyvtár: 👥 gomb ki-be kapcsolja a tagságot', () => {
    setupParty(); W.openLib('lib');
    const btn = name => $$('#libRows .lrow').find(r => r.querySelector('b').textContent === name).querySelector('[data-act="libParty"]');
    ok(btn('Aria').classList.contains('on') && !btn('Goblin').classList.contains('on'), 'rossz kezdőállapot');
    click(btn('Aria')); click(btn('Goblin'));
    ok(!btn('Aria').classList.contains('on') && btn('Goblin').classList.contains('on'), 'nem váltott');
    W.openParty(); eq(partyNames(), ['Borin', 'Goblin', 'Teszt Tünde']);
  });
  test('törölt könyvtári lény eltűnik a csapatból; üres csapat üzenet', () => {
    setupParty(); W.openParty();
    ['Aria', 'Borin'].forEach(n => click($$('[data-act="partyRemove"]').find(c => c.textContent.includes(n))));
    A('S.library = S.library.filter(c => c.name !== "Teszt Tünde")'); W.openParty();
    has($('#modalBox').textContent, 'Nincs senki a csapatban'); ok($('#partyAddSel'), 'nincs hozzáadás lista');
  });
  test('tagság mentése és betöltése (tisztítással)', () => {
    setupParty();
    const id = A('S.library').find(c => c.name === 'Aria').id;
    W.importBackup({library: A('S.library'), enc: {list: []}, settings: {partyIds: [id, id, '"><img>', 5]}});
    eq(A('S.settings.partyIds'), [id]);
    W.importBackup({library: A('S.library'), enc: {list: []}, settings: {partyIds: 'nem tömb'}});
    eq(A('S.settings.partyIds'), null); W.openParty(); eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde']);
  });
  test('felhőbe is elmentődik a tagság', async () => {
    const f = makeFakeDb(); await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db});
    setupParty(); W.openParty(); click($$('[data-act="partyRemove"]')[0]); await wait(500);
    eq(f.store['dmscreen/state'].settings.partyIds.length, 2);
  });
  test('passzív táblázat rendezése oszlopra: először csökkenő, újra kattintva növekvő; név szerint', () => {
    setupParty(); W.openParty();
    const th = txt => $$('.ptable')[0].querySelectorAll('th.sortable')[txt];
    click(th(1)); eq(partyNames(), ['Teszt Tünde', 'Borin', 'Aria']); has(th(1).textContent, '▼');
    click(th(1)); eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde']); has(th(1).textContent, '▲');
    click(th(3)); eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde'], 'Insight csökkenő, egyenlőségnél ábécé (14, 12, 12)');
    click(th(0)); eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde']); click(th(0)); eq(partyNames(), ['Teszt Tünde', 'Borin', 'Aria']);
  });
  test('skill-táblázat rendezése egy tag oszlopa szerint, ábécébe, és vissza az alap sorrendhez', () => {
    setupParty(); W.openParty();
    const skillOrder = () => [...$$('.ptable')[1].rows].slice(1).map(r => r.cells[0].firstChild.textContent.trim());
    eq(skillOrder()[0], 'Athletics');
    click($$('.ptable')[1].querySelector('th[data-col="skill"]'));
    eq(skillOrder().slice(0, 3), ['Acrobatics', 'Animal Handling', 'Arcana']);
    const tundeTh = () => [...$$('.ptable')[1].querySelectorAll('th.sortable')].find(t => t.textContent.startsWith('Teszt Tünde'));
    click(tundeTh());
    eq(skillOrder()[0], 'Stealth', 'Tünde legjobb skillje (+9) kerül előre'); has(tundeTh().textContent, '▼');
    click(tundeTh()); eq(skillOrder().slice(-1)[0], 'Stealth');
    click('[data-act="partySortReset"]'); eq(skillOrder()[0], 'Athletics'); ok(!$('[data-act="partySortReset"]'), 'a gomb nem tűnt el');
  });
  test('rendezéskor a keresés és az utolsó dobás megmarad', () => {
    setupParty(); W.openParty();
    stubRnd(10); click($$('td.sk')[0]); const roll = $('#partyRoll').textContent;
    setVal('#partySearch', 'rope', 'input');
    click($$('.ptable')[0].querySelectorAll('th.sortable')[1]);
    eq([$('#partyRoll').textContent, $('#partySearch').value, $('#partySearchInfo').textContent], [roll, 'rope', '2 találat']);
  });
});

// ======================================================================
describe('Játékos app: láthatóság és közzététel', () => {
  const npc = (name, share, extra = {}) => ({name, kind: 'npc', ac: 13, hp: {max: 20, cur: 8}, share, ...extra});
  test('tisztítás: gazda csak játékosnál, kisbetűvel; hibás e-mail kimarad; alapértékek típusonként', () => {
    const p = W.normCreature(pc('Rella', 3, {owner: '  Jatekos@Example.COM '}));
    eq([p.owner, p.share], ['jatekos@example.com', {vis: 'party', hp: 'exact', ac: true}]);
    eq(W.normCreature(pc('X', 1, {owner: 'nem email'})).owner, undefined);
    eq(W.normCreature(pc('X', 1, {owner: '<b>@x.hu'})).owner, undefined);
    const n = W.normCreature(npc('Bob', null, {owner: 'a@b.hu'}));
    eq([n.owner, n.share], [undefined, {vis: 'dm', hp: 'label', ac: false}]);
    eq(W.normCreature(npc('Bob', {vis: 'xx', hp: 'yy', ac: 'igen'})).share, {vis: 'dm', hp: 'label', ac: false});
    const m = W.normCreature(mk('Goblin', {owner: 'a@b.hu', share: {vis: 'party'}}));
    eq([m.owner, m.share], [undefined, undefined]);
  });
  test('közzétett adatok: játékos pontosan, NPC címkével / pontosan, rejtett NPC és szörny nem', () => {
    A(`S.library = ${JSON.stringify([pc('Rella', 3, {id: 'p1', owner: 'a@b.hu', hp: {max: 30, cur: 12}}), pc('Senkié', 2, {id: 'p2', share: {vis: 'dm'}}),
      npc('Titkos', {vis: 'dm'}, {id: 'n1'}), npc('Kalauz', {vis: 'party', hp: 'label', ac: false}, {id: 'n2'}),
      npc('Barát', {vis: 'party', hp: 'exact', ac: true}, {id: 'n3', hp: {max: 20}}), mk('Goblin', {id: 'm1'})])}.map(normCreature)`);
    const pub = Object.fromEntries(W.publicChars().map(p => [p.id, p]));
    eq(Object.keys(pub).sort(), ['n2', 'n3', 'p1']);
    eq(pub.p1, {id: 'p1', kind: 'pc', owner: 'a@b.hu', visibility: 'party', name: 'Rella', portrait: '', level: 'Szint 3', ac: 16, hp: {cur: 12, max: 30}, status: null});
    eq([pub.n2.hp, pub.n2.status, pub.n2.ac, pub.n2.owner], [null, 'bloodied', null, '']);
    eq([pub.n3.hp, pub.n3.status, pub.n3.ac], [{cur: 20, max: 20}, null, 13]);
    hasNot(JSON.stringify(pub), 'actions'); hasNot(JSON.stringify(pub), 'abilities');
    eq([W.hpStatus(0, 10), W.hpStatus(5, 10), W.hpStatus(9, 10), W.hpStatus(10, 10)], ['down', 'bloodied', 'hurt', 'healthy']);
  });
  test('felhő: characters és access/players íródik, utána csak a változás; rejtéskor törlődik', async () => {
    const f = makeFakeDb({'dmscreen/state': {enc: {list: [], round: 1, active: null}, settings: {}},
      'dmscreen_library/p1': pc('Rella', 3, {owner: 'b@x.hu'}), 'dmscreen_library/p2': pc('Bori', 2, {owner: 'a@x.hu'}),
      'dmscreen_library/n1': npc('Kalauz', {vis: 'party'})});
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(600);
    eq(f.log.splice(0).filter(l => !l.includes('backup')).sort(), ['set access/players', 'set characters/n1', 'set characters/p1', 'set characters/p2'], 'első betöltéskor közzéteszi');
    eq(f.store['access/players'], {emails: ['a@x.hu', 'b@x.hu']});
    A('S.library.find(c => c.id === "p1").notes = "titok"; save()'); await wait(500);
    eq(f.log.splice(0), ['set dmscreen_library/p1'], 'a titkos rész változása nem írja a nyilvánost');
    A('S.library.find(c => c.id === "n1").share.vis = "dm"; save()'); await wait(500);
    eq(f.log.splice(0).sort(), ['del characters/n1', 'set dmscreen_library/n1']);
    A('S.library.find(c => c.id === "p2").owner = "c@x.hu"; save()'); await wait(500);
    eq(f.log.splice(0).sort(), ['set access/players', 'set characters/p2', 'set dmscreen_library/p2']);
    eq(f.store['access/players'], {emails: ['b@x.hu', 'c@x.hu']});
  });
  test('újratöltéskor a más mezősorrendben tárolt közzétett adat nem íródik újra', async () => {
    const f = makeFakeDb({'dmscreen/state': {enc: {list: [], round: 1, active: null}, settings: {}}, 'dmscreen_library/p1': pc('Rella', 3, {owner: 'a@x.hu'})});
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(500);
    ok(f.store['characters/p1'], 'közzétette');
    f.store['characters/p1'] = Object.fromEntries(Object.entries(f.store['characters/p1']).reverse());
    fresh(); f.log.splice(0);
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await wait(500);
    eq(f.log.filter(l => !l.includes('backup')), []);
    ok(!W.sharingDirty());
  });
  test('szerkesztő: játékos app mezők típustól függően; mentés; hibás e-mail nem menthető', () => {
    W.openLib('lib'); click('[data-act="newCreature"]');
    const fm = $('#edForm');
    ok($('#shareBox').hidden, 'szörnynél rejtve');
    setVal(fm.elements.kind, 'pc');
    ok(!$('#shareBox').hidden); ok(!fm.elements.owner.closest('label').hidden); ok(fm.elements.shareHp.closest('label').hidden, 'HP-választó csak NPC-nél');
    fm.elements.name.value = 'Rella'; fm.elements.owner.value = 'rossz cím';
    let msg = ''; W.alert = m => msg = m;
    click('[data-act="edSave"]');
    has(msg, 'nem érvényes'); ok($('#edForm'), 'nyitva maradt');
    fm.elements.owner.value = 'Rella@Example.com'; fm.elements.shareVis.value = 'dm';
    click('[data-act="edSave"]');
    const c = A('S.library').find(x => x.name === 'Rella');
    eq([c.owner, c.share.vis], ['rella@example.com', 'dm']);
    W.openLib('lib'); has($('#libRows').textContent, 'csak DM'); has($('#libRows').textContent, 'rella@example.com');
    click('[data-act="libEdit"]');
    setVal($('#edForm').elements.kind, 'npc');
    ok($('#edForm').elements.owner.closest('label').hidden); ok(!$('#edForm').elements.shareAc.closest('label').hidden);
  });
  test('harcbeli szerkesztő: ugyanaz a játékos app rész, a könyvtárból töltve, és oda azonnal visszaírva', () => {
    A(`S.library = [normCreature(${JSON.stringify(pc('Rella', 3, {id: 'p1', owner: 'a@x.hu', share: {vis: 'party'}}))})]`);
    const [x] = W.addToEncounter(A('S.library[0]'), 1);
    A('S.library[0].share.vis = "dm"');  // hozzáadás után a könyvtárban változott
    A(`selected = ${JSON.stringify(x.cid)}`); W.render();
    click('[data-act="editCombatant"]');
    const fm = $('#edForm');
    ok(fm && !$('#shareBox').hidden, 'nincs játékos app rész');
    eq([fm.elements.owner.value, fm.elements.shareVis.value], ['a@x.hu', 'dm'], 'a könyvtár friss értéke');
    has($('#shareBox').textContent, 'könyvtárban is azonnal');
    fm.elements.owner.value = 'b@x.hu'; fm.elements.name.value = 'Rella (sebesült)';
    click('[data-act="edSave"]');
    eq([A('S.library[0].owner'), A('S.library[0].name'), A('S.enc.list[0].c.owner')], ['b@x.hu', 'Rella', 'b@x.hu'], 'gazda a könyvtárba, név csak a harcba');
  });
  test('újraimport / visszamentés megtartja a játékos app beállítást, a könyvtári szerkesztő átírja', () => {
    A(`S.library = [normCreature(${JSON.stringify(pc('Rella', 3, {id: 'p1', owner: 'a@x.hu', share: {vis: 'dm'}}))})]`);
    W.addToEncounter(A('S.library[0]'), 1);
    A(`openEditor(S.enc.list[0].c, null, 'harc')`); ok(!$('#shareBox'), 'opció nélkül nincs'); W.closeModal();
    A(`upsertLibrary(${JSON.stringify(pc('Rella', 4, {id: 'p1', owner: 'masik@x.hu', share: {vis: 'party'}}))})`);
    eq([A('S.library[0].owner'), A('S.library[0].share.vis'), A('S.library[0].cr')], ['a@x.hu', 'dm', 'Szint 4']);
    A(`upsertLibrary(${JSON.stringify(pc('Rella', 4, {id: 'p1', owner: 'masik@x.hu', share: {vis: 'party'}}))}, false)`);
    eq([A('S.library[0].owner'), A('S.library[0].share.vis')], ['masik@x.hu', 'party'], 'a szerkesztő viszont átírja');
  });
  test('karakter.html: saját karakter és a csapat; rejtett lap és NPC nem; adatok tisztítva', () => {
    K.KApp.setAuth({status: 'signedIn', email: 'A@x.hu'});
    K.KApp.setChars([
      {id: 'p1', kind: 'pc', owner: 'a@x.hu', visibility: 'dm', name: 'Rella', level: 'Szint 3', ac: 16, hp: {cur: 12, max: 30}},
      {id: 'p2', kind: 'pc', owner: 'b@x.hu', visibility: 'party', name: 'Bori', ac: 14, hp: {cur: 20, max: 20}},
      {id: 'n1', kind: 'npc', owner: '', visibility: 'party', name: 'Kalauz', ac: null, hp: null, status: 'bloodied'},
      {id: 'n2', kind: 'npc', owner: '', visibility: 'dm', name: 'Titkos', hp: null, status: 'hurt'}]);
    const t = K.document.querySelector('main').textContent;
    eq([...K.document.querySelectorAll('.card.own')].map(e => e.dataset.char), ['p1']);
    has(t, '12 / 30 HP'); has(t, 'csak te és a DM'); has(t, 'Bori'); hasNot(t, 'Kalauz', 'NPC nem látszhat'); hasNot(t, 'Titkos');
    ok(K.document.querySelector('#gate').hidden);
    K.__xss = 0;
    K.KApp.setChars([{id: XQ, kind: XQ, owner: 'a@x.hu', visibility: XQ, name: XSS, level: XSS, portrait: 'javascript:window.__xss=1', ac: XSS, hp: {cur: XQ, max: XSS}, status: XSS}]);
    ok(!K.__xss && !K.document.querySelector('main img[onerror], main [onmouseover]'), 'kód futhatna');
    has(K.document.querySelector('main').textContent, '<img');
  });
  test('fejléc: 📱 Karakterlap gomb új lapon nyitja a karakter.html-t', () => {
    const calls = []; const orig = W.open; W.open = (...a) => calls.push(a);
    try { click('header [data-act="openCharApp"]'); } finally { W.open = orig; }
    eq(calls, [['karakter.html', '_blank']]);
  });
  test('karakter.html: belépő és „nincs a játékosok között” képernyő', () => {
    K.KApp.setAuth({status: 'signedOut'});
    ok(K.document.querySelector('#gate [data-act="signIn"]'));
    K.KApp.setAuth({status: 'denied', email: 'idegen@x.hu'});
    has(K.document.querySelector('#gate').textContent, 'nincs a játékosok között');
    K.KApp.setAuth({status: 'unconfigured'}); ok(K.document.querySelector('#gate').hidden);
  });
});

// ======================================================================
// 1. fázis: telefonos karakterlap, szabálykönyv, tárgy-import
// kitalált, az 5e.tools szerkezetét követő minta (a tesztek internet nélkül futnak)
const FAKE5E = {
  'spells/spells-phb.json': {spell: [
    {name: 'Fireball', source: 'PHB', level: 3, school: 'V', time: [{number: 1, unit: 'action'}], range: {type: 'point', distance: {type: 'feet', amount: 150}},
      components: {v: true, s: true, m: 'a tiny ball of bat guano'}, duration: [{type: 'instant'}], entries: ['Each creature takes {@damage 8d6} fire damage.'],
      entriesHigherLevel: [{type: 'entries', name: 'At Higher Levels', entries: ['+1d6 per slot level.']}]},
    {name: 'Bless', source: 'PHB', level: 1, school: 'E', time: [{number: 1, unit: 'action'}], range: {type: 'point', distance: {type: 'feet', amount: 30}},
      components: {v: true, s: true, m: {text: 'a sprinkling of holy water'}}, duration: [{type: 'timed', duration: {type: 'minute', amount: 1}, concentration: true}], entries: ['Add a d4.']},
    {name: 'Burning Hands', source: 'PHB', level: 1, school: 'V', time: [{number: 1, unit: 'action'}], range: {type: 'cone', distance: {type: 'feet', amount: 15}},
      components: {v: true, s: true}, duration: [{type: 'instant'}], entries: ['{@damage 3d6} fire.']}]},
  'spells/spells-xge.json': {spell: [{name: 'Toll the Dead', source: 'XGE', level: 0, school: 'N', time: [{number: 1, unit: 'action'}], range: {type: 'point', distance: {type: 'feet', amount: 60}},
    components: {v: true, s: true}, duration: [{type: 'instant'}], entries: ['{@damage 1d8} necrotic.']}]},
  'spells/spells-tce.json': {spell: []},
  'generated/gendata-spell-source-lookup.json': {phb: {fireball: {class: {PHB: {Sorcerer: true, Wizard: true}, XPHB: {Bard: true}}}, 'burning hands': {class: {PHB: {Wizard: true}}}},
    xge: {'toll the dead': {class: {XGE: {Cleric: true, Warlock: true, Wizard: true}}}}},
  'items.json': {item: [
    {name: 'Bag of Holding', source: 'DMG', rarity: 'uncommon', wondrous: true, weight: 15, entries: ['Bigger inside.']},
    {name: 'Cloak of Protection', source: 'DMG', rarity: 'uncommon', reqAttune: true, wondrous: true, entries: ['+1 AC.']},
    {name: 'Fancy Bag', source: 'XDMG', rarity: 'rare', entries: ['2024']},
    {name: 'Copy Sword', source: 'TCE', _copy: {name: 'Longsword', source: 'PHB'}, rarity: 'rare', entries: ['Copied.']},
    {name: "Explorer's Pack", source: 'PHB', type: 'G', value: 1000, packContents: ['backpack|phb', {item: 'torch|phb', quantity: 10}]}],
    itemGroup: [{name: 'Absorbing Tattoo', source: 'TCE', rarity: 'very rare', reqAttune: true, entries: ['Tattoo.'], items: ['Acid Absorbing Tattoo|TCE']}]},
  'items-base.json': {baseitem: [
    {name: 'Longsword', source: 'PHB', type: 'M', weaponCategory: 'martial', property: ['V'], dmg1: '1d8', dmgType: 'S', dmg2: '1d10', weight: 3, value: 1500, weapon: true, sword: true},
    {name: 'Net', source: 'PHB', type: 'R', weapon: true, net: true, weight: 3},
    {name: 'Chain Mail', source: 'PHB', type: 'HA', ac: 16, strength: '13', stealth: true, armor: true, weight: 55, value: 7500},
    {name: 'Longsword', source: 'XPHB', type: 'M|XPHB', weapon: true}],
    itemType: [{abbreviation: 'M', source: 'PHB', name: 'Melee Weapon'}, {abbreviation: 'R', source: 'PHB', name: 'Ranged Weapon'}, {abbreviation: 'HA', source: 'PHB', name: 'Heavy Armor'}, {abbreviation: 'G', source: 'PHB', name: 'Adventuring Gear'}],
    itemProperty: [{abbreviation: 'V', source: 'PHB', entries: [{type: 'entries', name: 'Versatile', entries: ['x']}]}]},
  'magicvariants.json': {magicvariant: [
    {name: '+1 Weapon', type: 'GV|DMG', requires: [{weapon: true}], excludes: {net: true}, inherits: {namePrefix: '+1 ', source: 'DMG', rarity: 'uncommon', bonusWeapon: '+1', entries: ['You have a {=bonusWeapon} bonus to attack and damage rolls.']}},
    {name: '+1 Weapon', type: 'GV|XDMG', requires: [{weapon: true}], inherits: {namePrefix: '+1 ', source: 'XDMG', rarity: 'uncommon', entries: ['2024']}},
    {name: 'Flame Tongue', type: 'GV|DMG', requires: [{sword: true}], inherits: {nameSuffix: ' of Flame', source: 'DMG', rarity: 'rare', reqAttune: true, entries: ['Fire!']}},
    {name: 'Armor of Resistance (*)', type: 'GV|DMG', requires: [{armor: true}], inherits: {source: 'DMG', rarity: 'rare', reqAttune: true, entries: ['Resist.']}}]},
  'feats.json': {feat: [{name: 'Alert', source: 'PHB', entries: ['+5 initiative.']}, {name: 'Elven Accuracy', source: 'XGE', prerequisite: [{race: [{name: 'Elf'}, {name: 'Half-Elf'}]}],
      ability: [{choose: {from: ['dex', 'int', 'wis', 'cha'], amount: 1}}], entries: ['Accuracy.']},
    {name: 'Grappler', source: 'PHB', prerequisite: [{ability: [{str: 13}]}], ability: [{str: 1}], entries: ['Grapple.']}, {name: 'Alert', source: 'XPHB', entries: ['2024']}]},
  'conditionsdiseases.json': {condition: [{name: 'Prone', source: 'PHB', entries: ['On the ground.']}, {name: 'Prone', source: 'XPHB', entries: ['2024']}]}
};
// 2. fázis: osztály, faj, háttér, optional feature (kitalált szövegek; a szerkezet és a szűrési csapdák az 5e.tools szerint)
FAKE5E['items.json'].item[1].bonusAc = '+1'; FAKE5E['items.json'].item[1].bonusSavingThrow = '+1';
FAKE5E['items.json'].item.push({name: 'Próbakesztyű', source: 'DMG', rarity: 'uncommon', reqAttune: true, ability: {static: {str: 19}}, entries: ['Erős.']});
FAKE5E['feats.json'].feat.push({name: 'Próbafeat', source: 'TCE', ability: [{choose: {from: ['str', 'dex'], amount: 1}}], savingThrowProficiencies: [{choose: {from: ['str', 'dex']}}],
  skillProficiencies: [{choose: {from: ['sleight of hand', 'stealth']}}], expertise: [{anyProficientSkill: 1}], armorProficiencies: [{light: true}], entries: ['Próba.']});
Object.assign(FAKE5E, {
  'class/index.json': {fighter: 'class-fighter.json', mystic: 'class-mystic.json'},
  'class/class-fighter.json': {
    class: [{name: 'Fighter', source: 'PHB', edition: 'classic', hd: {number: 1, faces: 10}, proficiency: ['str', 'con'], subclassTitle: 'Martial Archetype',
      startingProficiencies: {armor: ['light', '{@item shield|phb|shields}'], weapons: ['simple', 'martial'], skills: [{choose: {from: ['acrobatics', 'animal handling', 'athletics'], count: 2}}]},
      multiclassing: {requirements: {or: [{str: 13, dex: 13}]}, proficienciesGained: {armor: ['light']}},
      classTableGroups: [{colLabels: ['{@filter Próbaoszlop|optionalfeatures|feature type=x}', 'Mozgás'], rows: [[{type: 'dice', toRoll: [{number: 1, faces: 6}]}, 0], [{type: 'dice', toRoll: [{number: 2, faces: 6}]}, {type: 'bonusSpeed', value: 10}]]},
        {title: 'Spell Slots', colLabels: ['1st'], rowsSpellProgression: [[0], [2]]}],
      classFeatures: ['Fighting Style|Fighter||1', {classFeature: 'Martial Archetype|Fighter||3', gainSubclassFeature: true}, 'Ability Score Improvement|Fighter||4',
        'Martial Versatility|Fighter||4|TCE', 'Ability Score Improvement|Fighter||6', 'Új dolog|Fighter||5|XPHB'],
      optionalfeatureProgression: [{name: 'Fighting Style', featureType: ['FS:F'], progression: {1: 1, 10: 1}}]},
      {name: 'Fighter', source: 'XPHB', edition: 'one', hd: {faces: 10}, classFeatures: []}],
    classFeature: [
      {name: 'Fighting Style', source: 'PHB', className: 'Fighter', classSource: 'PHB', level: 1, entries: ['Válassz stílust.', {type: 'options', entries: [{type: 'refOptionalfeature', optionalfeature: 'Archery'}]}]},
      {name: 'Fighting Style', source: 'XPHB', className: 'Fighter', classSource: 'XPHB', level: 1, entries: ['2024']},
      {name: 'Martial Archetype', source: 'PHB', className: 'Fighter', classSource: 'PHB', level: 3, entries: ['Alosztály.']},
      {name: 'Ability Score Improvement', source: 'PHB', className: 'Fighter', classSource: 'PHB', level: 4, entries: ['ASI.']},
      {name: 'Ability Score Improvement', source: 'PHB', className: 'Fighter', classSource: 'PHB', level: 6, entries: ['ASI.']},
      {name: 'Martial Versatility', source: 'TCE', className: 'Fighter', classSource: 'PHB', level: 4, isClassFeatureVariant: true, entries: ['Csere.']},
      {name: 'Új dolog', source: 'XPHB', className: 'Fighter', classSource: 'PHB', level: 5, entries: ['2024']}],
    subclass: [
      {name: 'Champion', shortName: 'Champion', source: 'PHB', className: 'Fighter', classSource: 'PHB', subclassFeatures: ['Champion|Fighter||Champion||3', 'Remarkable Athlete|Fighter||Champion||7']},
      {name: 'Champion', shortName: 'Champion', source: 'PHB', className: 'Fighter', classSource: 'XPHB', subclassFeatures: ['Champion|Fighter|XPHB|Champion||3']},
      {name: 'Samurai', shortName: 'Samurai', source: 'XGE', className: 'Fighter', classSource: 'PHB', subclassFeatures: ['Samurai|Fighter||Samurai|XGE|3'],
        additionalSpells: [{prepared: {1: ['bless', 'cure wounds|phb']}, known: {3: {_: [{choose: 'level=0|class=Wizard'}]}}, ability: 'wis'}]},
      {name: 'Echo Knight', shortName: 'Echo Knight', source: 'EGW', className: 'Fighter', classSource: 'PHB', subclassFeatures: []},
      {name: 'Eldritch Knight', shortName: 'Eldritch Knight', source: 'PHB', className: 'Fighter', classSource: 'PHB', casterProgression: '1/3', spellcastingAbility: 'int',
        cantripProgression: [0, 0, 2], additionalSpells: [{expanded: {3: ' '}}], subclassFeatures: []}],
    subclassFeature: [
      {name: 'Champion', source: 'PHB', className: 'Fighter', classSource: 'PHB', subclassShortName: 'Champion', subclassSource: 'PHB', level: 3,
        entries: ['Bajnok.', {type: 'refSubclassFeature', subclassFeature: 'Improved Critical|Fighter||Champion||3'}]},
      {name: 'Improved Critical', source: 'PHB', className: 'Fighter', classSource: 'PHB', subclassShortName: 'Champion', subclassSource: 'PHB', level: 3, entries: ['19–20.']},
      {name: 'Remarkable Athlete', source: 'PHB', className: 'Fighter', classSource: 'PHB', subclassShortName: 'Champion', subclassSource: 'PHB', level: 7, entries: ['Fél PB.']},
      {name: 'Champion', source: 'PHB', className: 'Fighter', classSource: 'XPHB', subclassShortName: 'Champion', subclassSource: 'PHB', level: 3, entries: ['2024']},
      {name: 'Samurai', source: 'XGE', className: 'Fighter', classSource: 'PHB', subclassShortName: 'Samurai', subclassSource: 'XGE', level: 3, entries: ['Szamuráj.']}]
  },
  'races.json': {
    race: [
      {name: 'Dwarf', source: 'PHB', size: ['M'], speed: 25, ability: [{con: 2}], darkvision: 60, resist: ['poison'], weaponProficiencies: [{'battleaxe|phb': true}],
        toolProficiencies: [{choose: {from: ["smith's tools", "brewer's supplies"]}}], languageProficiencies: [{common: true, dwarvish: true}],
        entries: [{type: 'entries', name: 'Age', entries: ['x']}, {type: 'entries', name: 'Stonecunning', entries: ['Kő.']}]},
      {name: 'Human', source: 'PHB', size: ['M'], speed: 30, languageProficiencies: [{common: true, anyStandard: 1}], entries: []},
      {name: 'Custom Lineage', source: 'TCE', size: ['S', 'M'], speed: 30, ability: [{choose: {from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], amount: 2}}], feats: [{any: 1}], skillProficiencies: [{any: 1}], darkvision: 60, entries: []},
      {name: 'Dwarf', source: 'XPHB', size: ['M'], speed: 30, entries: []}, {name: 'Kenku', source: 'VGM', speed: 30, entries: []}],
    subrace: [
      {name: 'Hill', source: 'PHB', raceName: 'Dwarf', raceSource: 'PHB', ability: [{wis: 1}], entries: [{type: 'entries', name: 'Dwarven Toughness', entries: ['HP.']}]},
      {source: 'PHB', raceName: 'Human', raceSource: 'PHB', ability: [{str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1}]},
      {name: 'Variant', source: 'PHB', raceName: 'Human', raceSource: 'PHB', ability: [{choose: {from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], count: 2}}], feats: [{any: 1}], skillProficiencies: [{any: 1}], overwrite: {ability: true}},
      {name: 'Mark of Próba', source: 'ERLW', raceName: 'Human', raceSource: 'PHB'}, {name: 'Hill', source: 'XPHB', raceName: 'Dwarf', raceSource: 'XPHB'}]
  },
  'backgrounds.json': {background: [
    {name: 'Acolyte', source: 'PHB', skillProficiencies: [{insight: true, religion: true}], languageProficiencies: [{anyStandard: 2}],
      entries: [{type: 'list', items: [{type: 'item', name: 'Skill Proficiencies:', entry: '{@skill Insight}, {@skill Religion}'}]}, {type: 'entries', name: 'Feature: Shelter', entries: ['Menedék.']}]},
    {name: 'Variant Acolyte (Próba)', source: 'PHB', _copy: {name: 'Acolyte', source: 'PHB'}},
    {name: 'Acolyte', source: 'XPHB', entries: ['2024']}]},
  'optionalfeatures.json': {optionalfeature: [
    {name: 'Archery', source: 'PHB', featureType: ['FS:F', 'FS:R'], entries: ['+2.']},
    {name: 'Thirsting Blade', source: 'XGE', featureType: ['EI'], prerequisite: [{pact: 'Blade', level: {level: 5, class: {name: 'Warlock'}}}], entries: ['Két.']},
    {name: 'Archery', source: 'XPHB', featureType: ['FS:F'], entries: ['2024']}]}
});
const fake5eGet = async p => { if (!FAKE5E[p]) throw new Error('nincs: ' + p); return structuredClone(FAKE5E[p]); };
const fakeRb = () => W.buildRulebook(fake5eGet);
const sheetDoc = (extra = {}) => ({...structuredClone(W.Sheet.TEMPLATE), owner: 'a@x.hu', ...extra});
const emptyState = () => ({'dmscreen/state': {enc: {list: [], round: 1, active: null}, settings: {}}});

describe('Karakterlap: formátum és számolás (sheet.js)', () => {
  test('tisztítás: alapértékek, határok, gazda, osztálynév és hit die', () => {
    const H = W.Sheet, s = H.norm({});
    eq([s.format, s.name, s.classes, s.hp, s.abilities.str, s.speed, s.initBonus], ['dmscreen-karakter', 'Névtelen', [{name: '', subclass: '', level: 1, hitDie: 8}], {max: 1, cur: 1, temp: 0}, 10, '30 ft.', null]);
    const e = H.norm({name: XSS, owner: 'Rossz', portrait: 'javascript:x', classes: [{name: 'wizard', level: 99}, {name: 'Barbarian', level: '3', hitDie: 7}],
      abilities: {str: 99, dex: 'x'}, hp: {max: 20, cur: 50, temp: -3}, skillProf: {stealth: 2, arcana: 3, hack: 1}, saveProf: ['dex', 'xxx'],
      spellcasting: {ability: 'foo', slots: [4, 99], used: [9, 1]}, resources: [{name: 'Ki', max: 3, used: 9, reset: 'x'}], spells: [{name: ''}, {name: 'Shield', level: 12}],
      conditions: ['Prone', 'Prone', {}], exhaustion: 9, _leiras: 'x'});
    eq([e.owner, e.portrait, e.name, '_leiras' in e], ['', '', XSS, false]);
    eq(e.classes, [{name: 'Wizard', subclass: '', level: 20, hitDie: 6}, {name: 'Barbarian', subclass: '', level: 3, hitDie: 12}]);
    eq([e.abilities.str, e.abilities.dex, e.hp], [30, 10, {max: 20, cur: 20, temp: 0}]);
    eq([e.skillProf, e.saveProf], [{stealth: 2}, ['dex']]);
    eq([e.spellcasting.ability, e.spellcasting.slots.slice(0, 2), e.spellcasting.used.slice(0, 2)], ['', [4, 9], [4, 1]]);
    eq(e.resources, [{name: 'Ki', max: 3, used: 3, reset: 'long'}]);
    eq(e.spells.map(x => [x.name, x.level]), [['Shield', 9]]);
    eq([e.conditions, e.exhaustion], [['Prone'], 6]);
    eq(H.norm({owner: ' A@X.hu '}).owner, 'a@x.hu');
  });
  test('számolt értékek: Rogue 3 (sablon) és Bard 5 Jack of All Trades-szel', () => {
    const H = W.Sheet, s = H.norm(H.TEMPLATE);
    eq([H.level(s), H.pb(s), H.initiative(s), H.saveBonus(s, 'dex'), H.saveBonus(s, 'str'), H.skillBonus(s, 'stealth'), H.skillBonus(s, 'acrobatics'), H.skillBonus(s, 'athletics'), H.passive(s, 'perception')],
      [3, 2, 3, 5, -1, 7, 5, -1, 13]);
    eq([H.classLabel(s), H.hitDice(s), H.spellDc(s)], ['Rogue 3 (Thief)', [{die: 8, max: 3, used: 0}], null]);
    const b = H.norm({classes: [{name: 'Bard', level: 5}], abilities: {cha: 18, dex: 14}, jack: true});
    eq([H.pb(b), H.skillBonus(b, 'athletics'), H.initiative(b), H.spellAbility(b), H.spellDc(b), H.spellAtk(b)], [3, 1, 3, 'cha', 15, 7]);
    eq(H.hitDice(H.norm({classes: [{name: 'Fighter', level: 3}, {name: 'Wizard', level: 2}], hitDiceUsed: {10: 1}})), [{die: 10, max: 3, used: 1}, {die: 6, max: 2, used: 0}]);
  });
  test('spell slotok (PHB 2014): egy osztály, multiclass, third caster, Pact Magic', () => {
    const sl = cls => { const r = W.Sheet.slotsFor(cls); return [r.slots.filter(Boolean), r.pact]; };
    eq(sl([{name: 'Wizard', level: 5}])[0], [4, 3, 2]);
    eq([sl([{name: 'Paladin', level: 1}])[0], sl([{name: 'Paladin', level: 2}])[0], sl([{name: 'Paladin', level: 5}])[0], sl([{name: 'Ranger', level: 3}])[0]], [[], [2], [4, 2], [3]]);
    eq([sl([{name: 'Fighter', subclass: 'Eldritch Knight', level: 3}])[0], sl([{name: 'Fighter', subclass: 'Eldritch Knight', level: 7}])[0], sl([{name: 'Artificer', level: 1}])[0]], [[2], [4, 2], [2]]);
    eq(sl([{name: 'Wizard', level: 3}, {name: 'Cleric', level: 2}])[0], [4, 3, 2], 'multiclass: összeadva');
    eq(sl([{name: 'Paladin', level: 3}, {name: 'Sorcerer', level: 3}])[0], [4, 3], 'multiclass: half caster lefelé kerekítve');
    eq(sl([{name: 'Warlock', level: 5}]), [[], {max: 2, level: 3}]);
    eq(sl([{name: 'Warlock', level: 11}, {name: 'Sorcerer', level: 1}]), [[2], {max: 3, level: 5}], 'Pact Magic külön');
    eq(sl([{name: 'Rogue', level: 5}])[0], []);
  });
  test('short rest, long rest, sebzés (temp HP először), gyógyítás 0 HP-ról', () => {
    const H = W.Sheet;
    const s = H.norm({classes: [{name: 'Fighter', level: 5}], hp: {max: 44, cur: 10, temp: 4}, hitDiceUsed: {10: 4}, exhaustion: 2, deathSaves: {ok: 1, fail: 2},
      resources: [{name: 'Second Wind', max: 1, used: 1, reset: 'short'}, {name: 'Action Surge', max: 1, used: 1, reset: 'short'}, {name: 'Áldás', max: 2, used: 2, reset: 'long'}, {name: 'Ital', max: 1, used: 1, reset: 'none'}],
      spellcasting: {slots: [2], used: [2], pact: {level: 1, max: 1, used: 1}}});
    const sr = H.shortRest(s);
    eq([sr.resources.map(r => r.used), sr.spellcasting.pact.used, sr.spellcasting.used[0]], [[0, 0, 2, 1], 0, 2]);
    const lr = H.longRest(s);
    eq([lr.hp, lr.hitDiceUsed, lr.exhaustion, lr.deathSaves, lr.resources.map(r => r.used), lr.spellcasting.used[0]], [{max: 44, cur: 44, temp: 0}, {10: 2}, 1, {ok: 0, fail: 0}, [0, 0, 0, 1], 0]);
    eq([H.damage(s, 6).hp, H.damage(s, 3).hp, H.damage(s, 99).hp.cur], [{max: 44, cur: 8, temp: 0}, {max: 44, cur: 10, temp: 1}, 0]);
    eq(H.heal(H.norm({...s, hp: {max: 44, cur: 0}}), 5), {hp: {max: 44, cur: 5, temp: 0}, deathSaves: {ok: 0, fail: 0}});
    eq(H.heal(s, 99).hp.cur, 44);
  });
});

describe('Szabálymotor (sheet.js, 2. fázis)', () => {
  // kitalált szabálykönyv-elemek a hatásformátumban (nem valódi szabályszöveg)
  const RB = () => ({
    races: [{n: 'Próbafaj', s: 'HB', fx: [{ab: {cha: 2}}, {abChoose: {from: ['str', 'dex', 'con', 'int', 'wis'], n: 2, amt: 1}}, {skillChoose: {from: 'any', n: 2}}, {hpPerLevel: 1}]}],
    subraces: [], backgrounds: [{n: 'Próbaháttér', s: 'HB', fx: [{skill: {insight: true, religion: true}}]}],
    feats: [{n: 'Próbafeat', s: 'HB', fx: [{ab: {dex: 1}}, {expertise: {n: 1}}, {save: ['wis']}, {init: 5}]}]
  });
  const fighter = (extra = {}) => W.Sheet.norm({auto: true, build: {base: {str: 15, dex: 12, con: 14, int: 10, wis: 13, cha: 8},
    levels: [{c: 'Fighter'}, {c: 'Fighter', hp: 7}, {c: 'Fighter'}, {c: 'Fighter', hp: 4}, {c: 'Fighter'}], ch: {'Fighter:4:asi': {str: 2}}, ...extra}});

  test('tisztítás: build, ov, auto, todoDone; régi lapnál nincs build és az auto ki van kapcsolva', () => {
    const H = W.Sheet, s = H.norm({});
    eq([s.build, s.auto, s.ov, s.todoDone], [null, false, {}, []]);
    eq(H.norm({auto: true}).auto, false, 'build nélkül nincs auto');
    const e = H.norm({auto: true, build: {race: XSS, base: {str: 99, dex: 'x'}, levels: [{c: 'fighter'}, {c: 'Fighter', hp: 99}, {c: ''}, {c: 'Wizard', hp: '3'}],
      sub: {Fighter: 'Champion|PHB', Rogue: 'Thief|PHB', Wizard: ''}, ch: {'race:ability': ['dex', 'con'], 'rossz\nkulcs': 1, x: {a: 1, 'b c': 2, d: {}}, z: [1, [2], 'a']},
      origin: {dex: 5, con: 1, foo: 2}}, ov: {'ab:str': 40, 'save:dex': '1', 'skill:stealth': 3, 'skill:arcana': 0.5, hpMax: 0, foo: 1, speed: '  '}, todoDone: ['a', 'a', '', {}]});
    const b = e.build;
    eq([e.auto, b.race, b.base.str, b.base.dex], [true, XSS, 30, 10]);
    eq(b.levels, [{c: 'Fighter', hp: null}, {c: 'Fighter', hp: 12}, {c: 'Wizard', hp: 3}]);
    eq([b.sub, b.ch, b.origin], [{Fighter: 'Champion|PHB'}, {'race:ability': ['dex', 'con'], x: {a: 1}, z: [1, 'a']}, {dex: 2, con: 1}]);
    eq(e.ov, {'ab:str': 30, 'save:dex': 1, 'skill:stealth': 0, 'skill:arcana': 0.5, hpMax: 1});
    eq(e.todoDone, ['a']);
  });

  test('Fighter 5: ASI, HP (1. szint max, utána dobott / átlag), első osztály mentői, alosztály-teendő', () => {
    const H = W.Sheet, c = H.calc(fighter());
    eq([c.level, c.pb, c.classes], [5, 3, [{name: 'Fighter', subclass: '', level: 5, hitDie: 10}]]);
    eq([c.abilities.str.v, c.mods.con], [17, 2]);
    eq(c.hpMax.v, 43, '10 + 7 + 6 + 4 + 6 + 5 × CON 2');
    eq([c.saves.str.v, c.saves.con.v, c.saves.dex.v, c.skills.athletics.v, c.init.v], [6, 5, 1, 3, 1]);
    eq(c.todos.map(t => t.key), ['Fighter:sub']);
    eq(c.slots.filter(Boolean), []);
    const c2 = H.calc(fighter({sub: {Fighter: 'Champion|PHB'}}));
    eq([c2.todos, c2.classes[0].subclass], [[], 'Champion']);
    const bad = H.calc(fighter({ch: {'Fighter:4:asi': {str: 3}}}));
    eq([bad.abilities.str.v, bad.todos.map(t => t.key)], [15, ['Fighter:sub', 'Fighter:4:asi']], 'érvénytelen ASI nem számít');
    eq(H.calc(fighter({base: {str: 19}, ch: {'Fighter:4:asi': {str: 2}}})).abilities.str.v, 20, 'legfeljebb 20');
  });

  test('faj, háttér, feat ASI helyett: választások, expertise csak jártas skillre, HP-bónusz, initiative, hiányzó elem', () => {
    const H = W.Sheet, rb = RB();
    const mkR = (ch = {}, extra = {}) => H.norm({auto: true, build: {race: 'Próbafaj|HB', background: 'Próbaháttér|HB', base: {str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 10},
      levels: [{c: 'Rogue'}, {c: 'Rogue'}, {c: 'Rogue'}, {c: 'Rogue'}],
      ch: {'race:ability': ['dex', 'cha', 'con'], 'race:skills': ['Sleight of Hand', 'stealth', 'perception'], 'Rogue:4:asi': {feat: 'Próbafeat|HB'}, ...ch}, ...extra}});
    let c = H.calc(mkR({'feat:Próbafeat|HB:expertise': ['arcana']}), rb);
    eq([c.abilities.dex.v, c.abilities.con.v, c.abilities.cha.v], [18, 15, 12], 'faj: CHA +2, választott DEX/CON +1 (a CHA nem választható), feat: DEX +1');
    eq(c.hpMax.v, 35, '8 + 3 × 5 + 4 × CON 2 + 4 × 1');
    eq([c.saves.dex.v, c.saves.wis.v, c.saves.int.prof, c.init.v], [6, 3, 1, 9]);
    eq([c.skills['sleight-of-hand'].prof, c.skills.stealth.prof, c.skills.perception.prof, c.skills.insight.prof, c.skills.religion.prof], [1, 1, 0, 1, 1]);
    eq(c.todos.map(t => t.key), ['Rogue:sub', 'feat:Próbafeat|HB:expertise'], 'arcana nem jártas → az expertise nincs kitöltve');
    c = H.calc(mkR({'feat:Próbafeat|HB:expertise': ['stealth']}), rb);
    eq([c.skills.stealth.prof, c.skills.stealth.v, c.todos.map(t => t.key)], [2, 8, ['Rogue:sub']]);
    // TCE Customizing Your Origin: a faji képességbónusz helyett az áthelyezett
    c = H.calc(mkR({}, {origin: {dex: 2, con: 1}}), rb);
    eq([c.abilities.dex.v, c.abilities.con.v, c.abilities.cha.v, c.choices.some(x => x.key === 'race:ability')], [19, 15, 10, false]);
    c = H.calc(H.norm({auto: true, build: {race: 'Nincs|HB', levels: [{c: 'Bard'}]}}), rb);
    eq([c.missing, c.todos.map(t => t.key)], [['Faj: Nincs'], ['missing:Faj: Nincs']]);
  });

  test('kézi felülírás: a számolt érték megmarad mellette, és a ráépülő értékek is az újat használják', () => {
    const H = W.Sheet;
    const c = H.calc(H.norm({...fighter(), ov: {'ab:dex': 20, hpMax: 50, 'skill:stealth': 2, 'save:wis': 1, init: 2}}));
    eq([c.abilities.dex.v, c.abilities.dex.calc, c.abilities.dex.ov, c.mods.dex], [20, 12, true, 5]);
    eq([c.skills.stealth.v, c.skills.stealth.ov, c.saves.wis.v, c.saves.wis.ov], [11, true, 4, true]);
    eq([c.hpMax.v, c.hpMax.calc, c.hpMax.ov, c.init.v, c.init.calc, c.init.ov], [50, 43, true, 2, 5, true]);
    eq(H.calc(H.norm({...fighter(), ov: {hpMax: 43}})).hpMax.ov, false, 'a számolttal egyező felülírás nem jelzett');
  });

  test('multiclass: mentők csak az első osztályból, HP, slotok, alosztály szintje osztályonként', () => {
    const H = W.Sheet;
    const c = H.calc(H.norm({auto: true, build: {base: {con: 12, int: 16}, levels: [{c: 'Fighter'}, {c: 'Wizard', hp: 2}, {c: 'Wizard'}]}}));
    eq(c.classes, [{name: 'Fighter', subclass: '', level: 1, hitDie: 10}, {name: 'Wizard', subclass: '', level: 2, hitDie: 6}]);
    eq([c.hpMax.v, c.saves.str.prof, c.saves.con.prof, c.saves.int.prof, c.saves.wis.prof], [19, 1, 1, 0, 0]);
    eq([c.slots.filter(Boolean), c.todos.map(t => t.key)], [[3], ['Wizard:sub']]);
  });

  test('kiírás a lapra: csak a változott mezők, másodszorra már semmi', () => {
    const H = W.Sheet;
    const s = H.norm({...fighter(), hp: {max: 10, cur: 10}, skillProf: {stealth: 1}, saveProf: ['dex'], classes: [{name: 'Rogue', level: 1}], spellcasting: {slots: [2], used: [1]}});
    const p = H.materialize(s, H.calc(s));
    eq(Object.keys(p).sort(), ['abilities', 'cache', 'classes', 'hp', 'saveProf', 'skillProf', 'spellcasting']);
    eq([p.hp, p.saveProf, p.skillProf, p.abilities.str, p.spellcasting.slots[0], p.spellcasting.used[0]], [{max: 43, cur: 10, temp: 0}, ['str', 'con'], {}, 17, 0, 0]);
    const s2 = H.norm({...s, ...p});
    eq(H.materialize(s2, H.calc(s2)), {});
    eq([H.level(s2), H.saveBonus(s2, 'str'), H.initiative(s2)], [5, 6, 1], 'a régi számoló függvények a kiírt értékekből ugyanazt adják');
    const o = H.norm({...s2, ov: {init: 4}});
    eq(H.materialize(o, H.calc(o)), {initBonus: 4});
  });
});

// kitalált szabálykönyv a motor formátumában (a valódi adat szerkezetét követi, szöveg nélkül)
const R20 = f => Array.from({length: 20}, (_, i) => f(i + 1));
const ASI = [4, 8, 12, 16, 19];
const rb3 = () => ({
  classes: [
    {n: 'Barbarian', s: 'PHB', hd: 12, saves: ['str', 'con'], fx: [{armor: ['light', 'medium', 'shields']}, {weapon: ['simple', 'martial']}], subLvl: 3, asi: ASI,
      cols: [{l: 'Rages', v: R20(l => l < 3 ? 2 : l < 6 ? 3 : 4)}], feats: [{n: 'Rage', lvl: 1}, {n: 'Unarmored Defense', lvl: 1}, {n: 'Fast Movement', lvl: 5}]},
    {n: 'Monk', s: 'PHB', hd: 8, saves: ['str', 'dex'], fx: [{weapon: ['simple', 'shortswords']}], subLvl: 3, asi: ASI,
      cols: [{l: 'Martial Arts', v: R20(l => l < 5 ? '1d4' : '1d6')}, {l: 'Ki Points', v: R20(l => l < 2 ? 0 : l)}, {l: 'Unarmored Movement', v: R20(l => l < 2 ? 0 : l < 6 ? 10 : 15)}],
      feats: [{n: 'Unarmored Defense', lvl: 1}, {n: 'Martial Arts', lvl: 1}, {n: 'Ki', lvl: 2}, {n: 'Unarmored Movement', lvl: 2}]},
    {n: 'Paladin', s: 'PHB', hd: 10, saves: ['wis', 'cha'], fx: [{armor: ['light', 'medium', 'heavy', 'shields']}, {weapon: ['simple', 'martial']}], caster: 'half', ab: 'cha', prep: 'lvl/2+cha',
      subLvl: 3, asi: ASI, feats: [{n: 'Divine Sense', lvl: 1}, {n: 'Lay on Hands', lvl: 1}, {n: 'Aura of Protection', lvl: 6}], opt: [{n: 'Fighting Style', t: ['FS:P'], p: R20(l => l >= 2 ? 1 : 0)}]},
    {n: 'Bard', s: 'PHB', hd: 8, saves: ['dex', 'cha'], fx: [{skillChoose: {from: 'any', n: 3}}], caster: 'full', ab: 'cha', cantrips: R20(() => 2), known: R20(l => l + 3), subLvl: 3, asi: ASI,
      feats: [{n: 'Bardic Inspiration', lvl: 1}, {n: 'Jack of All Trades', lvl: 2}, {n: 'Expertise', lvl: 3}]},
    {n: 'Cleric', s: 'PHB', hd: 8, saves: ['wis', 'cha'], fx: [{armor: ['light', 'medium', 'shields']}], caster: 'full', ab: 'wis', cantrips: R20(() => 3), prep: 'lvl+wis', subLvl: 1, asi: ASI,
      feats: [{n: 'Channel Divinity', lvl: 2}]},
    {n: 'Fighter', s: 'PHB', hd: 10, saves: ['str', 'con'], fx: [{armor: ['light', 'medium', 'heavy', 'shields']}, {weapon: ['simple', 'martial']}], subLvl: 3, asi: [4, 6, 8, 12, 14, 16, 19],
      feats: [{n: 'Second Wind', lvl: 1}, {n: 'Martial Archetype', lvl: 3, sub: true}, {n: 'Martial Archetype feature', lvl: 7, sub: true}], opt: [{n: 'Fighting Style', t: ['FS:F'], p: R20(() => 1)}]},
    {n: 'Wizard', s: 'PHB', hd: 6, saves: ['int', 'wis'], caster: 'full', ab: 'int', prep: 'lvl+int', cantrips: R20(() => 3), subLvl: 2, asi: ASI, feats: [{n: 'Arcane Recovery', lvl: 1}]},
    {n: 'Ranger', s: 'PHB', hd: 10, saves: ['str', 'dex'], caster: 'half', ab: 'wis', subLvl: 3, asi: ASI, feats: [{n: 'Favored Enemy', lvl: 1}]}],
  subclasses: [{n: 'Champion', short: 'Champion', cls: 'Fighter', s: 'PHB'},
    {n: 'Life Domain', short: 'Life', cls: 'Cleric', s: 'PHB', fx: [{spells: [{t: 'prepared', lvl: 1, sp: ['bless', 'cure wounds']}, {t: 'prepared', lvl: 3, sp: ['spiritual weapon']}, {t: 'prepared', lvl: 5, sp: ['revivify']}]}]}],
  features: [{n: 'Rage', cls: 'Barbarian', lvl: 1, s: 'PHB', tx: 'Düh.'}, {n: 'Improved Critical', cls: 'Fighter', sub: 'Champion', ss: 'PHB', lvl: 3, s: 'PHB', tx: '19–20.'},
    {n: 'Remarkable Athlete', cls: 'Fighter', sub: 'Champion', ss: 'PHB', lvl: 7, s: 'PHB', tx: 'Fél.'}, {n: 'Bonus Proficiency', cls: 'Cleric', sub: 'Life', ss: 'PHB', lvl: 1, s: 'PHB', tx: 'Nehéz.'}],
  races: [{n: 'Dwarf', s: 'PHB', sp: {walk: 25}, fx: [{ab: {con: 2}}, {lang: ['Common', 'Dwarvish']}, {dv: 60}, {resist: ['poison']}], traits: [{n: 'Stonecunning', tx: 'Kő.'}], subs: 1},
    {n: 'Human', s: 'PHB', sp: {walk: 30}, fx: [{lang: ['Common']}], subs: 2}],
  subraces: [{n: 'Hill', race: 'Dwarf', s: 'PHB', fx: [{ab: {wis: 1}}], traits: [{n: 'Dwarven Toughness', tx: 'HP.'}]},
    {n: 'Human (alap)', race: 'Human', s: 'PHB', fx: [{ab: {str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1}}]},
    {n: 'Variant', race: 'Human', s: 'PHB', fx: [{abChoose: {from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], n: 2, amt: 1}}, {feat: {n: 1}}], ow: ['ab', 'abChoose']}],
  backgrounds: [], feats: [{n: 'Alert', s: 'PHB', tx: 'Éber.'}],
  optfeatures: [{n: 'Defense', s: 'PHB', t: ['FS:F', 'FS:P'], tx: '+1'}, {n: 'Archery', s: 'PHB', t: ['FS:F'], tx: '+2'}],
  baseItems: [{n: 'Chain Mail', s: 'PHB', tc: 'HA', ac: 16, str: '13'}, {n: 'Leather Armor', s: 'PHB', tc: 'LA', ac: 11}, {n: 'Shield', s: 'PHB', tc: 'S', ac: 2},
    {n: 'Longsword', s: 'PHB', tc: 'M', wc: 'martial', dmg: '1d8 slashing', d2: '1d10', pr: 'versatile', m: {weapon: true}},
    {n: 'Longbow', s: 'PHB', tc: 'R', wc: 'martial', dmg: '1d8 piercing', pr: 'heavy, two-handed', rg: '150/600', m: {weapon: true}},
    {n: 'Quarterstaff', s: 'PHB', tc: 'M', wc: 'simple', dmg: '1d6 bludgeoning', pr: 'versatile', m: {weapon: true}}],
  items: [{n: 'Cloak of Protection', s: 'DMG', att: 'requires attunement', bAc: 1, bS: 1}, {n: 'Gauntlets of Ogre Power', s: 'DMG', att: 'requires attunement', abS: {str: 19}}],
  variants: [{n: '+1 Weapon', s: 'DMG', pre: '+1 ', bW: 1, req: [{weapon: true}]}],
  spells: [{n: 'Bless', s: 'PHB', l: 1}, {n: 'Cure Wounds', s: 'PHB', l: 1}, {n: 'Spiritual Weapon', s: 'PHB', l: 2}, {n: 'Revivify', s: 'PHB', l: 3}], conditions: []
});
const lv = (c, n) => Array.from({length: n}, () => ({c}));
const mkS = (build, extra = {}) => W.Sheet.norm({auto: true, build, ...extra});
const inv = (...names) => names.map(n => typeof n === 'string' ? {name: n, qty: 1, equipped: true} : {qty: 1, equipped: true, ...n});

describe('Szabálymotor: teljes számolás (3. lépés)', () => {
  test('hatások: AC (Mage Armor, pajzs, páncél), speed (Haste, Grappled, Exhaustion), dobás-módosítók, DM-kikapcsolás; faji bónusz cseréje', () => {
    const H = W.Sheet, rb = rb3();
    const mk = extra => H.norm({ac: 12, speed: '30 ft.', abilities: {dex: 16}, ...extra});
    eq(H.effects(mk({conditions: ['Mage Armor']}), rb).ac, 16);
    eq(H.effects(mk({conditions: ['Mage Armor'], inventory: [{name: 'Shield', equipped: true}]}), rb).ac, 18, 'pajzzsal 13 + 3 + 2');
    eq(H.effects(mk({ac: 18, conditions: ['Mage Armor'], inventory: [{name: 'Chain Mail', equipped: true}]}), rb).ac, 18, 'páncélban nem hat');
    eq(H.effects(mk({conditions: ['Mage Armor']})).ac, 16, 'szabálykönyv nélkül is (név alapján)');
    let e = H.effects(mk({conditions: ['Haste', 'Shield of Faith']}));
    eq([e.ac, e.speed, e.acParts], [16, '60 ft.', ['Haste', 'Shield of Faith']]);
    eq(H.effects(mk({conditions: ['Grappled'], speed: '30 ft., fly 30 ft.'})).speed, '0 ft., fly 30 ft.');
    eq(H.effects(mk({exhaustion: 2})).speed, '15 ft.');
    e = H.effects(mk({conditions: ['Poisoned', 'Rage', 'Bless', 'Bladesong']}));
    eq(H.rollFx(e, 'atk'), {adv: [], dis: ['Poisoned'], fail: [], bonus: [{k: 'atk', v: '1d4', src: 'Bless'}]});
    eq([H.rollFx(e, 'check:str:athletics').adv, H.rollFx(e, 'check:dex:acrobatics').adv, H.rollFx(e, 'check:dex:stealth').adv], [['Rage'], ['Bladesong'], []]);
    eq(H.rollFx(e, 'check:wis').dis, ['Poisoned']);
    eq(H.rollFx(H.effects(mk({conditions: ['Poisoned'], effOff: ['Poisoned']})), 'atk').dis, [], 'a DM kikapcsolta');
    eq(H.rollFx(H.effects(mk({conditions: ['Stunned']})), 'save:dex').fail, ['Stunned']);
    eq(H.effects(mk({conditions: ['Rage'], classes: [{name: 'Barbarian', level: 9}]})).dmg, [{v: '3', melee: true, src: 'Rage'}]);
    eq(H.dropConc(['Bless', 'Prone', 'Mage Armor'], 'bless'), ['Prone', 'Mage Armor']);
    eq(H.swapRaceAb({str: 8, con: 16, wis: 13, cha: 10}, 'Hill Dwarf', 'Human', rb), {str: 9, dex: 11, con: 15, int: 11, wis: 13, cha: 11});
    eq(H.raceAb('Human (Variant)', rb), {fixed: {}, choose: [{from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], n: 2, amt: 1}]});
  });
  test('ovEdits: a számolt mezők kézi átírása felülírás-kulcsokra (AC, max HP, speed, initiative, képesség, mentő, skill)', () => {
    const H = W.Sheet, s = H.norm({abilities: {dex: 14}, saveProf: ['dex'], skillProf: {stealth: 1}, jack: true});
    eq(H.ovEdits(s, s), {});
    const n = H.norm({...s, ac: 18, hp: {max: 40}, speed: '40 ft.', initBonus: 5, abilities: {dex: 16}, saveProf: ['con'], skillProf: {stealth: 2, arcana: 1}});
    eq(H.ovEdits(s, n), {ac: 18, hpMax: 40, speed: '40 ft.', init: 5, 'ab:dex': 16, 'save:dex': 0, 'save:con': 1, 'skill:arcana': 1, 'skill:stealth': 2});
    eq(H.ovEdits(s, H.norm({...s, skillProf: {}})), {'skill:stealth': 0.5}, 'Jack of All Trades mellett a levett jártasság fél');
  });
  test('Hill Dwarf Barbarian 5: Unarmored Defense pajzzsal, Rage, Fast Movement (heavy armorban nem), HP, jártasságok, fegyver', () => {
    const H = W.Sheet, rb = rb3();
    const build = {race: 'Dwarf|PHB', subrace: 'Hill|PHB', base: {str: 16, dex: 14, con: 14}, levels: lv('Barbarian', 5)};
    let c = H.calc(mkS(build, {inventory: inv('Shield', 'Longsword', {name: 'Chain Mail', equipped: false})}), rb);
    eq([c.ac.v, c.acNote, c.speed.v, c.hpMax.v], [17, 'Unarmored Defense (Barbarian 1), Shield', '35 ft.', 60], 'AC 10 + DEX 2 + CON 3 + pajzs 2; HP 12 + 4 × 7 + 5 × CON 3 + 5 × 1');
    eq(c.resources, [{name: 'Rage', max: 3, reset: 'long'}]);
    eq(c.attacks, [{name: 'Longsword', hit: '+6', dmg: '1d8+3 slashing', note: 'versatile · versatile 1d10'}]);
    eq([c.profs.armor, c.profs.languages, c.senses, c.resist], ['light, medium, shields', 'Common, Dwarvish', 'darkvision 60 ft.', 'poison']);
    eq(c.features.map(f => f.name), ['Stonecunning', 'Dwarven Toughness', 'Rage', 'Unarmored Defense', 'Fast Movement']);
    eq(c.features[2].text, 'Düh.');
    eq(c.todos.map(t => t.key), ['Barbarian:sub', 'Barbarian:4:asi']);
    c = H.calc(mkS(build, {inventory: inv('Shield', 'Chain Mail')}), rb);
    eq([c.ac.v, c.acNote, c.speed.v], [18, 'Chain Mail, Shield', '25 ft.'], 'heavy armorban nincs Fast Movement');
  });

  test('Monk 6: Unarmored Defense (pajzzsal nem), Martial Arts, Ki, Unarmored Movement, monk fegyver DEX-szel', () => {
    const H = W.Sheet, rb = rb3();
    const build = {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 10, dex: 16, con: 12, wis: 14}, levels: lv('Monk', 6)};
    let c = H.calc(mkS(build, {inventory: inv('Quarterstaff')}), rb);
    eq([c.abilities.dex.v, c.ac.v, c.speed.v, c.resources], [17, 15, '45 ft.', [{name: 'Ki', max: 6, reset: 'short'}]]);
    eq(c.attacks, [{name: 'Quarterstaff', hit: '+6', dmg: '1d6+3 bludgeoning', note: 'versatile'}, {name: 'Unarmed Strike', hit: '+6', dmg: '1d6+3 bludgeoning', note: 'Martial Arts'}]);
    c = H.calc(mkS(build, {inventory: inv('Shield')}), rb);
    eq([c.ac.v, c.acNote, c.speed.v], [15, 'páncél nélkül, Shield', '30 ft.'], 'pajzzsal a Monk UD és Unarmored Movement nem jár');
  });

  test('Paladin 6: Aura of Protection, Defense, mágikus tárgyak (hangolás), felkészítés, slotok; érvénytelen Fighting Style', () => {
    const H = W.Sheet, rb = rb3();
    const it = inv('Chain Mail', 'Shield', '+1 Longsword', {name: 'Cloak of Protection', attuned: true}, {name: 'Gauntlets of Ogre Power', attuned: true});
    const build = {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 15, dex: 10, wis: 12, cha: 16}, levels: lv('Paladin', 6), sub: {Paladin: 'Devotion|PHB'},
      ch: {'Paladin:opt:Fighting Style': ['Defense|PHB'], 'Paladin:4:asi': {cha: 2}}};
    let c = H.calc(mkS(build, {inventory: it}), rb);
    eq([c.abilities.str.v, c.abilities.cha.v, c.ac.v], [19, 19, 20], 'Gauntlets: STR 19; AC 16 + 2 + köpeny 1 + Defense 1');
    eq([c.saves.wis.v, c.saves.str.v, c.saves.dex.v], [9, 9, 5], 'aura +CHA 4, köpeny +1');
    eq(c.saves.dex.parts.map(p => p.src), ['DEX-módosító', 'Aura of Protection (Paladin 6)', 'Cloak of Protection']);
    eq(c.resources, [{name: 'Divine Sense', max: 5, reset: 'long'}, {name: 'Lay on Hands', max: 30, reset: 'long'}]);
    eq(c.casting, [{cls: 'Paladin', type: 'half', ab: 'cha', dc: 15, atk: 7, cantrips: 0, known: 0, prepared: 7}]);
    eq(c.slots.filter(Boolean), [4, 2]);
    eq(c.attacks[0], {name: '+1 Longsword', hit: '+8', dmg: '1d8+5 slashing', note: 'versatile · versatile 1d10'});
    ok(c.features.some(f => f.name === 'Defense' && f.src === 'Fighting Style (Paladin)'), 'a választott stílus a jellemzők között');
    eq(c.missing, ['Alosztály: Devotion']);
    c = H.calc(mkS({...build, ch: {'Paladin:opt:Fighting Style': ['Archery|PHB']}}, {inventory: inv({name: 'Cloak of Protection'})}), rb);
    ok(c.todos.some(t => t.key === 'Paladin:opt:Fighting Style'), 'az Archery Paladinnak nem választható');
    eq([c.ac.v, c.saves.dex.v], [10, 3], 'hangolás nélkül a köpeny nem számít');
  });

  test('Variant Human Bard 5: faji választás és feat (Alert), osztály-skillek, expertise, Jack of All Trades, Bardic Inspiration short restre', () => {
    const H = W.Sheet, rb = rb3();
    const mk = exp => mkS({race: 'Human|PHB', subrace: 'Variant|PHB', base: {dex: 14, cha: 16}, levels: lv('Bard', 5),
      ch: {'subrace:ability': ['dex', 'cha'], 'subrace:feat': ['Alert|PHB'], 'Bard:1:skills': ['persuasion', 'performance', 'deception'], 'Bard:3:expertise': exp}});
    let c = H.calc(mk(['persuasion', 'arcana']), rb);
    eq([c.abilities.dex.v, c.abilities.cha.v, c.skills.persuasion.v, c.skills.athletics.v, c.init.v], [15, 17, 9, 1, 8], 'PB 3: persuasion 3 + 6 (az egy érvényes expertise); athletics 0 + 1 (Jack); init 2 + 1 + 5');
    eq(c.todos.map(t => t.key), ['Bard:sub', 'Bard:4:asi', 'Bard:3:expertise'], 'az arcana nem jártas, így az expertise hiányos');
    c = H.calc(mk(['persuasion', 'performance']), rb);
    eq([c.skills.persuasion.v, c.skills.persuasion.prof, c.todos.map(t => t.key)], [9, 2, ['Bard:sub', 'Bard:4:asi']]);
    eq(c.resources, [{name: 'Bardic Inspiration', max: 3, reset: 'short'}]);
    eq([c.casting[0].dc, c.casting[0].cantrips, c.casting[0].known], [14, 2, 8]);
    ok(c.features.some(f => f.name === 'Alert' && f.src === 'Feat'), 'a feat a jellemzők között');
  });

  test('Champion Fighter 7: Remarkable Athlete, Archery íjjal, az alosztály-helyőrző nem jellemző; ✋ teendő kipipálva eltűnik', () => {
    const H = W.Sheet, rb = rb3();
    const c = H.calc(mkS({base: {str: 10, dex: 16, con: 14}, levels: lv('Fighter', 7), sub: {Fighter: 'Champion|PHB'},
      ch: {'Fighter:opt:Fighting Style': ['Archery|PHB'], 'Fighter:4:asi': {con: 2}, 'Fighter:6:asi': {con: 2}}}, {inventory: inv('Longbow', 'Leather Armor')}), rb);
    eq([c.skills.athletics.v, c.skills.acrobatics.v, c.skills.perception.v, c.init.v], [2, 5, 0, 5], 'fél PB felfelé kerekítve STR / DEX / CON próbára és initiative-ra');
    eq(c.attacks, [{name: 'Longbow', hit: '+8', dmg: '1d8+3 piercing', note: 'heavy, two-handed · range 150/600'}]);
    eq(c.ac.v, 14);
    eq(c.features.map(f => f.name), ['Second Wind', 'Martial Archetype', 'Improved Critical', 'Remarkable Athlete', 'Archery']);
    eq(c.resources, [{name: 'Second Wind', max: 1, reset: 'short'}]);
    const r = mkS({levels: [{c: 'Ranger'}]});
    eq(H.calc(r, rb).todos.map(t => t.key), ['✋ Favored Enemy (Ranger 1)']);
    eq(H.calc(H.norm({...r, todoDone: ['✋ Favored Enemy (Ranger 1)']}), rb).todos, []);
  });

  test('Life Cleric 3 / Wizard 1: mindig felkészített domain spellek, két varázsló osztály, kiírás a lapra (saját tételek maradnak), cache', () => {
    const H = W.Sheet, rb = rb3();
    const s = mkS({base: {wis: 16, int: 14}, levels: [...lv('Cleric', 3), {c: 'Wizard'}], sub: {Cleric: 'Life|PHB'}}, {
      spells: [{name: 'Bless', level: 1, prepared: true}, {name: 'Shield', level: 1, prepared: true}],
      features: [{name: 'Saját dolog', text: 'x'}, {name: 'Bonus Proficiency', text: 'régi'}], resources: [{name: 'Channel Divinity', max: 5, used: 1}]});
    const c = H.calc(s, rb);
    eq(c.always, [{name: 'Bless', level: 1, ref: 'Bless|PHB'}, {name: 'Cure Wounds', level: 1, ref: 'Cure Wounds|PHB'}, {name: 'Spiritual Weapon', level: 2, ref: 'Spiritual Weapon|PHB'}], 'a Revivify csak 5. szinttől');
    eq(c.casting.map(x => [x.cls, x.ab, x.dc, x.prepared]), [['Cleric', 'wis', 13, 6], ['Wizard', 'int', 12, 3]]);
    eq([c.slots.filter(Boolean), c.saves.int.prof, c.profs.armor], [[4, 3], 0, 'light, medium, shields, heavy']);
    const p = H.materialize(s, c), s2 = H.norm({...s, ...p});
    eq(s2.spells.map(x => [x.name, x.always, !!x.auto]), [['Bless', true, true], ['Cure Wounds', true, true], ['Spiritual Weapon', true, true], ['Shield', false, false]]);
    eq(s2.features.map(f => [f.name, !!f.auto]), [['Channel Divinity', true], ['Bonus Proficiency', true], ['Arcane Recovery', true], ['Saját dolog', false]]);
    eq(s2.resources, [{name: 'Channel Divinity', max: 1, used: 1, reset: 'short', auto: true}, {name: 'Arcane Recovery', max: 1, used: 0, reset: 'long', auto: true}]);
    eq([s2.spellcasting.ability, H.spellDc(s2), H.spellAtk(s2), s2.cache.spell], ['wis', 13, 5, {dc: 13, atk: 5}]);
    eq(H.materialize(s2, H.calc(s2, rb)), {}, 'másodszorra semmi nem változik');
    // a régi számoló függvények a cache-ből dolgoznak (pl. Aura of Protection), szabálykönyv nélkül a jellemzők megmaradnak
    const pal = mkS({base: {cha: 16}, levels: lv('Paladin', 6)}), pc = H.calc(pal, rb), pal2 = H.norm({...pal, ...H.materialize(pal, pc)});
    eq([H.saveBonus(pal2, 'dex'), pc.saves.dex.v, H.passive(pal2, 'perception')], [3, 3, 10]);
    eq(Object.keys(H.materialize(s2, H.calc(s2))).includes('features'), false, 'szabálykönyv nélkül a jellemzők nem íródnak felül');
  });
  test('választó-modul: opciók (tiltás a máshol már választottra), beírás a felépítésbe (alosztály, ch, törlés)', () => {
    const H = W.Sheet, rb = rb3();
    const s = mkS({race: 'Human|PHB', subrace: 'Variant|PHB', levels: [...lv('Fighter', 2), ...lv('Paladin', 2)], ch: {'Fighter:opt:Fighting Style': ['Defense|PHB']}});
    const c = H.calc(s, rb), ch = k => c.choices.find(x => x.key === k);
    eq(H.choiceOptions(ch('Paladin:opt:Fighting Style'), c, rb).opts.map(x => [x.l, !!x.dis]), [['Defense', true]], 'Paladin-stílus; a Fighterrel már választott tiltva');
    eq(H.choiceOptions(ch('Fighter:opt:Fighting Style'), c, rb).opts.map(x => [x.l, !!x.dis]), [['Defense', false], ['Archery', false]], 'a saját választás nem tiltott');
    const ab = H.choiceOptions(ch('subrace:ability'), c, rb);
    eq([ab.multi, ab.n, ab.opts.length], [true, 2, 6]);
    eq(H.choiceOptions(ch('subrace:feat'), c, rb).opts.map(x => x.v), ['Alert|PHB']);
    const s2 = H.norm({...s, build: H.setChoice(s.build, ch('subrace:feat'), ['Alert|PHB'])}), c2 = H.calc(s2, rb);
    eq([s2.build.ch['subrace:feat'], c2.init.v], [['Alert|PHB'], 5], 'Alert: +5 initiative');
    eq(H.setChoice(s2.build, ch('subrace:feat'), []).ch['subrace:feat'], undefined, 'üres = törlés');
    const f3 = mkS({levels: lv('Fighter', 3)}), c3 = H.calc(f3, rb), sub = c3.choices.find(x => x.kind === 'subclass');
    eq(H.choiceOptions(sub, c3, rb).opts.map(x => x.v), ['Champion|PHB']);
    eq(H.setChoice(f3.build, sub, 'Champion|PHB').sub, {Fighter: 'Champion|PHB'});
    eq(H.setChoice({...f3.build, sub: {Fighter: 'Champion|PHB'}}, sub, '').sub, {});
    // expertise: csak jártas skillre, és nem arra, ami már egy másik expertise-választásban szerepel
    const bard = mkS({levels: lv('Bard', 3), ch: {'Bard:1:skills': ['stealth', 'arcana', 'history']}}), cb = H.calc(bard, rb);
    eq(H.choiceOptions(cb.choices.find(x => x.kind === 'expertise'), cb, rb).opts.map(x => x.v), ['arcana', 'history', 'stealth']);
  });
  test('nyelvválasztás: a PHB nyelvei listából (egzotikus jelölve); ami máshonnan már megvan, az nem választható, a saját választás igen', () => {
    const H = W.Sheet, rb = rb3();
    rb.backgrounds = [{n: 'Acolyte', s: 'PHB', fx: [{langChoose: {n: 2}}]}];
    const s = mkS({race: 'Dwarf|PHB', subrace: 'Hill|PHB', background: 'Acolyte|PHB', levels: lv('Fighter', 1)});
    let c = H.calc(s, rb), ch = c.choices.find(x => x.kind === 'lang'), o = H.choiceOptions(ch, c, rb);
    eq([ch.key, o.free, o.multi, o.n, o.opts.length], ['bg:lang', false, false, 2, 16]);
    eq(o.opts.filter(x => x.dis).map(x => [x.v, x.note]), [['Common', 'már tudja'], ['Dwarvish', 'már tudja']], 'a faj nyelvei');
    eq([o.opts.find(x => x.v === 'Draconic').note, o.opts.find(x => x.v === 'Elvish').note], ['egzotikus', '']);
    const s2 = H.norm({...s, build: H.setChoice(s.build, ch, ['Elvish'])});
    c = H.calc(s2, rb); ch = c.choices.find(x => x.kind === 'lang'); o = H.choiceOptions(ch, c, rb);
    eq([o.opts.find(x => x.v === 'Elvish').dis, c.profs.languages], [false, 'Common, Dwarvish, Elvish'], 'a saját választás nem tiltott');
    // eszköz-választás forráslista nélkül: szabad szöveg marad
    const t = H.calc(mkS({levels: lv('Fighter', 3), sub: {Fighter: 'Champion|PHB'}, ch: {}}), rb);
    ok(!t.choices.some(x => x.kind === 'lang'), 'nyelvválasztás csak ahol a forrás ad');
  });
  test('átállítás szabálymotorra: a felépítés a lap mezőiből, az eltérő régi értékek felülírásként maradnak', () => {
    const H = W.Sheet, rb = rb3();
    const s = H.norm({race: 'Hill Dwarf', background: '', classes: [{name: 'Fighter', subclass: 'Champion', level: 3}], abilities: {str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8},
      saveProf: ['str', 'con'], skillProf: {athletics: 1, perception: 1}, hp: {max: 40, cur: 30}, ac: 18, speed: '25 ft.'});
    const p = H.toAuto(s, rb);
    eq([p.auto, p.build.race, p.build.subrace, p.build.sub, p.build.base, p.build.levels.length], [true, 'Dwarf|PHB', 'Hill|PHB', {Fighter: 'Champion|PHB'}, {str: 16, dex: 12, con: 14, int: 10, wis: 11, cha: 8}, 3], 'az alapérték a faji bónusz nélkül');
    eq(p.ov, {'skill:athletics': 1, 'skill:perception': 1, hpMax: 40, ac: 18}, 'csak ami eltér');
    const n = H.norm({...s, ...p}), n2 = H.norm({...n, ...H.materialize(n, H.calc(n, rb))});
    eq([n2.ac, n2.hp.max, n2.hp.cur, n2.abilities.con, n2.abilities.wis, n2.skillProf, n2.saveProf, n2.speed], [18, 40, 30, 16, 12, {athletics: 1, perception: 1}, ['str', 'con'], '25 ft.'], 'látható változás nincs');
  });
});

describe('Választó-modul: további választástípusok (sheet.js)', () => {
  test('skill: a forrás listája vagy minden skill; a máshonnan jártas tiltva, a saját választás nem', () => {
    const H = W.Sheet, cr = {skills: {stealth: {prof: 1}, arcana: {prof: 1}}, choices: []};
    const o = H.choiceOptions({kind: 'skills', key: 'k', n: 2, from: ['Stealth', 'Sleight of Hand', 'Arcana', 'Nincs ilyen'], value: ['arcana']}, cr, null);
    eq([o.multi, o.free, o.n], [true, false, 2]);
    eq(o.opts.map(x => [x.v, x.dis, x.note]), [['stealth', true, 'már jártas'], ['sleight-of-hand', false, ''], ['arcana', false, '']]);
    eq(H.choiceOptions({kind: 'skills', key: 'k', n: 1}, {}, null).opts.length, Object.keys(H.SKILLS).length, 'lista nélkül minden skill');
  });
  test('eszköz: listából vagy szabad szöveg', () => {
    const H = W.Sheet;
    eq(H.choiceOptions({kind: 'tool', key: 't', n: 1, from: ['Lute', 'Flute']}, {}, null), {multi: false, free: false, n: 1, opts: [{v: 'Lute', l: 'Lute'}, {v: 'Flute', l: 'Flute'}]});
    eq(H.choiceOptions({kind: 'tool', key: 't', n: 1, from: []}, {}, null).free, true);
  });
  test('alfaj: csak a faj alfajai, az „(alap)” változat a faj nevével; beírás és törlés', () => {
    const H = W.Sheet, rb = {subraces: [{n: 'High Elf', s: 'PHB', race: 'Elf'}, {n: 'Base (alap)', s: 'PHB', race: 'Elf'}, {n: 'Hill Dwarf', s: 'PHB', race: 'Dwarf'}]};
    const c = {kind: 'subrace', key: 'race:sub', src: 'Faj: Elf|PHB', n: 1};
    eq(H.choiceOptions(c, {}, rb).opts, [{v: 'High Elf|PHB', l: 'High Elf'}, {v: 'Base (alap)|PHB', l: 'Elf (alap)'}]);
    const b = H.setChoice({levels: []}, c, 'High Elf|PHB');
    eq([b.subrace, H.setChoice(b, c, '').subrace], ['High Elf|PHB', '']);
  });
  test('érvénytelen választás-érték (pl. függvény) nem kerül a felépítésbe', () => {
    eq(W.Sheet.setChoice({levels: []}, {kind: 'feat', key: 'k'}, () => 1).ch, {});
  });
});

describe('Szabálykönyv és tárgy-import', () => {
  test('feat-feltételek szövegesen', () => {
    eq(W.featPre([{proficiency: [{armor: 'medium'}]}, {level: 4}, {spellcasting2020: true}, {other: 'egyéb'}, {race: [{name: 'Elf', subrace: 'High'}, {name: 'Gnome'}]}]),
      'medium armor / level 4 / spellcasting / egyéb / Elf (High) or Gnome');
  });
  test('5e.tools → saját formátum: csak PHB / XGE / TCE (tárgyaknál DMG) 2014, a 2024-es könyvek nélkül', async () => {
    const rb = await fakeRb();
    const sp = Object.fromEntries(rb.spells.map(s => [s.n, s]));
    eq(Object.keys(sp), ['Fireball', 'Bless', 'Burning Hands', 'Toll the Dead']);
    eq([sp.Fireball.l, sp.Fireball.sc, sp.Fireball.t, sp.Fireball.r, sp.Fireball.c, sp.Fireball.d, sp.Fireball.cl], [3, 'evocation', '1 action', '150 feet', 'V, S, M (a tiny ball of bat guano)', 'Instantaneous', ['Sorcerer', 'Wizard']]);
    has(sp.Fireball.tx, '8d6 fire'); has(sp.Fireball.tx, '+1d6 per slot');
    eq([sp.Bless.k, sp.Bless.d, sp.Bless.c, sp['Burning Hands'].r, sp['Toll the Dead'].cl, sp['Toll the Dead'].l], [true, 'Concentration, up to 1 minute', 'V, S, M (a sprinkling of holy water)', 'Self (15-foot cone)', ['Cleric', 'Warlock', 'Wizard'], undefined]);
    const it = Object.fromEntries(rb.items.map(i => [i.n, i]));
    eq(Object.keys(it).sort(), ['Absorbing Tattoo', 'Bag of Holding', 'Cloak of Protection', 'Copy Sword', "Explorer's Pack", 'Próbakesztyű']);
    eq([it['Cloak of Protection'].att, it['Bag of Holding'].ty, it['Copy Sword'].dmg, it['Copy Sword'].rar], ['requires attunement', 'Wondrous item', '1d8 slashing', 'rare']);
    has(it["Explorer's Pack"].tx, 'Tartalom: backpack, 10× torch'); has(it['Absorbing Tattoo'].tx, 'Acid Absorbing Tattoo');
    eq(rb.baseItems.map(b => b.n), ['Longsword', 'Net', 'Chain Mail']);
    const ls = rb.baseItems[0];
    eq([ls.ty, ls.dmg, ls.d2, ls.pr, ls.v, ls.w, ls.m], ['Melee Weapon', '1d8 slashing', '1d10', 'versatile', '15 gp', 3, {weapon: true, sword: true, name: 'Longsword'}]);
    eq([rb.baseItems[2].ac, rb.baseItems[2].str, rb.baseItems[2].st], [16, '13', true]);
    eq(rb.variants.map(v => v.n), ['+1 Weapon', 'Flame Tongue', 'Armor of Resistance']);
    eq(rb.variants[0].tx, 'You have a +1 bonus to attack and damage rolls.');
    eq(rb.feats.map(f => [f.n, f.pre || '']), [['Alert', ''], ['Elven Accuracy', 'Elf or Half-Elf'], ['Grappler', 'STR 13'], ['Próbafeat', '']]);
    eq(rb.feats.map(f => f.tx), ['+5 initiative.', 'Ability Score Increase: DEX, INT, WIS, CHA +1 (1 választható).\nAccuracy.', 'Ability Score Increase: STR +1.\nGrapple.', 'Ability Score Increase: STR, DEX +1 (1 választható).\nPróba.'], 'a képességnövelés is a leírásba kerül');
    eq(rb.conditions, [{n: 'Prone', s: 'PHB', tx: 'On the ground.'}]);
  });
  test('2. fázis: osztály, alosztály, feature-ök (csak a 2014-es osztályhoz kötött alosztályok), faj, alfaj, háttér, optional feature', async () => {
    const rb = await fakeRb();
    const P20 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    eq(rb.classes, [{n: 'Fighter', s: 'PHB', hd: 10, saves: ['str', 'con'],
      fx: [{armor: ['light', 'shields']}, {weapon: ['simple', 'martial']}, {skillChoose: {from: ['acrobatics', 'animal-handling', 'athletics'], n: 2}}],
      mc: {req: {or: [{str: 13, dex: 13}]}, fx: [{armor: ['light']}]}, cols: [{l: 'Próbaoszlop', v: ['1d6', '2d6']}, {l: 'Mozgás', v: [0, 10]}],
      feats: [{n: 'Fighting Style', lvl: 1}, {n: 'Martial Archetype', lvl: 3, sub: true}, {n: 'Ability Score Improvement', lvl: 4}, {n: 'Martial Versatility', lvl: 4, opt: true}, {n: 'Ability Score Improvement', lvl: 6}],
      subLvl: 3, asi: [4, 6], subTitle: 'Martial Archetype', opt: [{n: 'Fighting Style', t: ['FS:F'], p: P20}]}], 'a 2024-es (XPHB) osztály és feature kimarad, a Mystic nincs letöltve');
    eq(rb.subclasses.map(s => s.short), ['Champion', 'Samurai', 'Eldritch Knight'], 'csak PHB / XGE / TCE, és csak a 2014-es Fighterhez kötött');
    eq(rb.subclasses[0], {n: 'Champion', short: 'Champion', cls: 'Fighter', s: 'PHB', feats: [{n: 'Champion', lvl: 3}, {n: 'Remarkable Athlete', lvl: 7}]});
    eq(rb.subclasses[1].fx, [{spells: [{t: 'prepared', lvl: 1, sp: ['bless', 'cure wounds']}], ab: 'wis'}, {todo: 'known varázslat választása (3. szinttől)'}]);
    eq(rb.subclasses[2], {n: 'Eldritch Knight', short: 'Eldritch Knight', cls: 'Fighter', s: 'PHB', caster: 'third', ab: 'int', cantrips: [0, 0, 2]});
    eq(rb.features.map(f => [f.n, f.lvl, f.sub || '']), [['Fighting Style', 1, ''], ['Martial Archetype', 3, ''], ['Ability Score Improvement', 4, ''], ['Martial Versatility', 4, ''],
      ['Ability Score Improvement', 6, ''], ['Champion', 3, 'Champion'], ['Improved Critical', 3, 'Champion'], ['Remarkable Athlete', 7, 'Champion'], ['Samurai', 3, 'Samurai']]);
    eq([rb.features[0].tx, rb.features[3].opt, rb.features[6].tx, rb.features[6].ss], ['Válassz stílust.', true, '19–20.', 'PHB']);
    eq(rb.races.map(r => r.n), ['Dwarf', 'Human', 'Custom Lineage']);
    eq(rb.races[0], {n: 'Dwarf', s: 'PHB', size: 'M', sp: {walk: 25}, fx: [{ab: {con: 2}}, {lang: ['Common', 'Dwarvish']}, {toolChoose: {from: ["smith's tools", "brewer's supplies"], n: 1}},
      {weapon: ['battleaxe']}, {dv: 60}, {resist: ['poison']}], traits: [{n: 'Stonecunning', tx: 'Kő.'}], subs: 1});
    eq([rb.races[1].fx, rb.races[1].subs, rb.races[2].fx], [[{lang: ['Common']}, {langChoose: {n: 1}}], 2,
      [{abChoose: {from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], n: 1, amt: 2}}, {skillChoose: {from: 'any', n: 1}}, {feat: {n: 1}}, {dv: 60}]]);
    eq(rb.subraces, [{n: 'Hill', race: 'Dwarf', s: 'PHB', fx: [{ab: {wis: 1}}], traits: [{n: 'Dwarven Toughness', tx: 'HP.'}]},
      {n: 'Human (alap)', race: 'Human', s: 'PHB', fx: [{ab: {str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1}}]},
      {n: 'Variant', race: 'Human', s: 'PHB', fx: [{abChoose: {from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], n: 2, amt: 1}}, {skillChoose: {from: 'any', n: 1}}, {feat: {n: 1}}], ow: ['ab', 'abChoose']}]);
    eq(rb.backgrounds.map(b => b.n), ['Acolyte', 'Variant Acolyte (Próba)'], '_copy feloldva, XPHB nélkül');
    eq(rb.backgrounds[1], {n: 'Variant Acolyte (Próba)', s: 'PHB', fx: [{skill: {insight: 1, religion: 1}}, {langChoose: {n: 2}}], feature: {n: 'Shelter', tx: 'Menedék.'}, tx: '• Skill Proficiencies: Insight, Religion'});
    eq(rb.optfeatures, [{n: 'Archery', s: 'PHB', t: ['FS:F', 'FS:R'], tx: '+2.'}, {n: 'Thirsting Blade', s: 'XGE', t: ['EI'], pre: 'Pact of the Blade, Warlock 5. szint', lv: 5, pact: 'Blade', tx: 'Két.'}]);
  });
  test('2. fázis: hatáslisták featekben és tárgyakban; a motor a valódi formátumú szabálykönyvvel számol', async () => {
    const H = W.Sheet, rb = await fakeRb(), ft = Object.fromEntries(rb.feats.map(f => [f.n, f.fx]));
    eq([ft.Alert, ft['Elven Accuracy'], ft.Grappler], [undefined, [{abChoose: {from: ['dex', 'int', 'wis', 'cha'], n: 1, amt: 1}}], [{ab: {str: 1}}]]);
    eq(ft['Próbafeat'], [{abChoose: {from: ['str', 'dex'], n: 1, amt: 1}}, {skillChoose: {from: ['sleight-of-hand', 'stealth'], n: 1}}, {armor: ['light']}, {saveChoose: {from: ['str', 'dex'], n: 1}}, {expertise: {n: 1}}]);
    const it = Object.fromEntries(H.allItems(rb).map(i => [i.n, i]));
    eq([it['Cloak of Protection'].bAc, it['Cloak of Protection'].bS, it['Próbakesztyű'].abS, it['Chain Mail'].tc, it.Longsword.tc, it.Longsword.wc],
      [1, 1, {str: 19}, 'HA', 'M', 'martial']);
    eq([it['+1 Longsword'].bW, it['+1 Longsword'].tc, it['+1 Longsword'].wc, it['+1 Chain Mail'], it['Longsword of Flame'].bW], [1, 'M', 'martial', undefined, undefined]);
    const s = H.norm({auto: true, build: {race: 'Dwarf|PHB', subrace: 'Hill|PHB', base: {con: 14, dex: 12}, levels: [{c: 'Fighter'}, {c: 'Fighter'}, {c: 'Fighter'}, {c: 'Fighter'}],
      ch: {'Fighter:4:asi': {feat: 'Próbafeat|TCE'}, 'feat:Próbafeat|TCE:ability': ['dex'], 'feat:Próbafeat|TCE:saves': ['dex'], 'feat:Próbafeat|TCE:skills': ['stealth'], 'feat:Próbafeat|TCE:expertise': ['stealth']}}});
    const c = H.calc(s, rb);
    eq([c.abilities.con.v, c.abilities.wis.v, c.abilities.dex.v, c.saves.dex.prof, c.saves.str.prof, c.skills.stealth.prof], [16, 11, 13, 1, 1, 2]);
    eq(c.todos.map(t => t.key), ['race:tool', 'Fighter:1:skills', 'Fighter:sub', 'Fighter:opt:Fighting Style']);
  });
  test('variánsok kibontása az alaptárgyakra (feltétel, kizárás, név) és keresés', async () => {
    const H = W.Sheet, all = H.allItems(await fakeRb()), names = all.map(i => i.n);
    for (const n of ['+1 Longsword', 'Longsword of Flame', 'Armor of Resistance (Chain Mail)', 'Longsword', 'Bag of Holding']) ok(names.includes(n), 'hiányzik: ' + n);
    for (const n of ['+1 Net', '+1 Chain Mail', 'Net of Flame', 'Armor of Resistance (Longsword)']) ok(!names.includes(n), 'nem kellene: ' + n);
    const p1 = all.find(i => i.n === '+1 Longsword');
    eq([p1.s, p1.rar, p1.dmg, p1.mag], ['DMG', 'uncommon', '1d8 slashing', true]);
    eq(H.search(all, 'longsw').map(i => i.n), ['Longsword', 'Longsword of Flame', '+1 Longsword']);
    eq(H.search(all, 'flame long').map(i => i.n), ['Longsword of Flame'], 'több szó, bármilyen sorrendben');
    eq(H.search(all, ''), []);
    has(H.itemLine(p1), '1d8 slashing (versatile 1d10)');
  });
  test('darabolás 1 MB alá, feltöltés (a meta utoljára, régi darab törölve), telefonos letöltés gyorsítótárral', async () => {
    const H = W.Sheet, rb = await fakeRb();
    const chunks = H.splitChunks(rb, 300);
    ok(chunks.length > H.RB_KINDS.length, 'nem darabolt: ' + chunks.length);
    ok(chunks.every(c => new TextEncoder().encode(c.data).length < 1500), 'túl nagy darab');
    const back = H.joinChunks(chunks);
    for (const k of H.RB_KINDS) eq(back[k], rb[k], k);
    const f = makeFakeDb({'rules/meta': {chunks: ['old-0']}, 'rules/old-0': {data: '{}'}});
    W.__fdb = f.db; A('Tar.kapcsol(window.__fdb)');
    const meta = await W.uploadRulebook(rb);
    eq(f.log.at(-1), 'set rules/meta'); ok(f.log.includes('del rules/old-0'));
    eq([meta.counts.spells, meta.counts.items, meta.counts.variants, meta.counts.classes, meta.counts.races, meta.format], [4, 6, 3, 1, 3, 2]);
    const cache = {}, c = {get: async k => cache[k], set: async (k, v) => { cache[k] = v; }};
    let gets = 0; const db2 = {get: p => { gets++; return f.db.get(p); }};
    const r1 = await H.loadRulebook(db2, c);
    eq([r1.rb.spells.length, r1.format, gets], [4, 2, 1 + meta.chunks.length]);
    gets = 0; await H.loadRulebook(db2, c); eq(gets, 1, 'változatlan verziónál csak a metát nézi');
    const r3 = await H.loadRulebook({get: async () => { throw new Error('offline'); }}, c);
    ok(r3.offline && r3.rb.items.length === 6 && r3.rb.classes.length === 1, 'internet nélkül a tárolt példány');
    eq(await H.loadRulebook({get: async () => null}, null), null, 'még nincs feltöltve');
  });
  test('Menü → Szabálykönyv: frissítés gomb letölt és feltölt', async () => {
    const rb = await fakeRb(), f = makeFakeDb(emptyState());
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await wait(300);
    W.buildRulebook = async () => rb;
    W.openMenu(); click('[data-act="rulebook"]'); await until(() => $('[data-act="rbUpdate"]'), 2000, 'a szabálykönyv ablak');
    has($('#modalBox').textContent, 'Még nincs feltöltve');
    click('[data-act="rbUpdate"]'); await until(() => /Kész/.test($('#rbMsg').textContent), 3000, 'feltöltés');
    ok(f.store['rules/meta']?.chunks.length >= 6, 'nincs meta');
    has($('#rbMsg').textContent, '4 varázslat');
    W.openMenu(); click('[data-act="rulebook"]'); await until(() => /Jelenlegi változat/.test($('#modalBox').textContent), 2000, 'a változat kiírása');
  });
  test('Könyvtár → Tárgyak fül: keresés, hozzáadás a kiválasztott játékoshoz (ismételve darabszám)', async () => {
    W.__rb = {version: '', counts: {}, rb: await fakeRb()}; A('rulebook = window.__rb');
    A(`S.library = [normCreature(${JSON.stringify(pc('Rella', 3, {id: 'p1'}))}), normCreature(${JSON.stringify(pc('Bori', 2, {id: 'p2'}))})]`);
    W.openLib('items'); setVal('#itemTo', 'p2'); setVal('#itemQ', 'longsw', 'input');
    const rows = $$('#itemRows .lrow'), names = rows.map(r => r.querySelector('b').textContent);
    eq(names, ['Longsword', 'Longsword of Flame', '+1 Longsword']);
    has(rows[2].textContent, 'uncommon');
    const btn = rows[2].querySelector('[data-act="itemAdd"]');
    click(btn); click(btn);
    eq(A('S.library[1].inventory').map(i => [i.name, i.qty, i.ref, i.magic, i.rarity]), [['+1 Longsword', 2, '+1 Longsword|DMG', true, 'uncommon']]);
    eq(A('S.library[0].inventory'), []);
    has(allLog(), '+1 Longsword');
  });
  test('szabálykönyv nélkül (nincs felhő) a Tárgyak fül közvetlenül a tükörből tölt', async () => {
    let called = 0; const rb = await fakeRb(); W.buildRulebook = async () => { called++; return rb; };
    W.openLib('items');
    await until(() => $('#itemQ'), 2000, 'a tárgylista');
    eq(called, 1);
  });
});

describe('Karakterlap a DM Screenben (szinkron, import, mentés)', () => {
  const loadWith = async (extra = {}) => {
    const f = makeFakeDb({...emptyState(), 'dmscreen_library/p1': pc('Régi név', 1, {id: 'p1', owner: 'a@x.hu', ac: 10, hp: {max: 5}}), 'sheets/p1': sheetDoc(), ...extra});
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await wait(500);
    return f;
  };
  const lib = () => A('S.library[0]');
  test('betöltéskor a lapról frissül a könyvtár (név, AC, HP, skillek, támadások), a gazda marad', async () => {
    const f = await loadWith();
    eq([lib().name, lib().ac, lib().hp.max, lib().cr, lib().owner, lib().source], ['Minta Tolvaj', 14, 24, 'Szint 3', 'a@x.hu', 'Karakterlap']);
    has(lib().type, 'Lightfoot Halfling — Rogue 3 (Thief)');
    eq([lib().skillMods.stealth, lib().saves, lib().initBonus], [{b: 7, p: 2}, {dex: 5, int: 3}, 3]);
    ok(lib().actions.some(a => a.text === 'Attack: +5 to hit. Hit: 1d6+3 piercing. finesse, light'), JSON.stringify(lib().actions));
    has(lib().senses, 'passive Perception 13');
    ok(!f.log.some(l => /sheets\//.test(l)), 'betöltéskor nem írhat a lapra: ' + f.log);
    eq(f.store['characters/p1'].name, 'Minta Tolvaj', 'a csapat a lap szerinti nevet látja');
  });
  test('harc: a DM sebzése mezőnként visszaíródik; a telefonos változás átjön, és nem ír vissza', async () => {
    const f = await loadWith();
    f.log.splice(0);
    const [x] = W.addToEncounter(lib(), 1);
    eq([x.hp, x.temp], [24, 0]);
    W.damage(x, 5); W.save(); await wait(500);
    ok(f.log.includes('update sheets/p1 hp.cur,hp.temp'), f.log.join('; '));
    eq([f.store['sheets/p1'].hp, f.store['sheets/p1'].updatedBy], [{max: 24, cur: 19, temp: 0}, 'dm@x.hu']);
    eq([lib().hp.cur, f.store['characters/p1'].hp], [19, {cur: 19, max: 24}], 'a könyvtárba és a csapat felé is');
    f.log.splice(0);
    f.store['sheets/p1'].hp = {max: 24, cur: 22, temp: 3}; f.store['sheets/p1'].inventory.push({name: 'Rope', qty: 1}); f.store['sheets/p1'].ac = 15;
    f.emit('sheets'); await wait(500);
    eq([A('S.enc.list[0].hp'), A('S.enc.list[0].temp'), A('S.enc.list[0].c.ac')], [22, 3, 15]);
    has($('.tile .hpbar').textContent, '22 / 24', 'a csempe a telefonos változás után frissül');
    ok(lib().inventory.some(i => i.name === 'Rope'));
    ok(!f.log.some(l => /sheets\//.test(l)), 'nem írhat vissza: ' + f.log);
    ok(f.log.includes('set characters/p1'));
  });
  test('harcba vett játékos a lap temp HP-jával indul; a hozzáadás utáni azonnali sebzés is átmegy', async () => {
    const f = await loadWith({'sheets/p1': sheetDoc({hp: {max: 24, cur: 20, temp: 5}})});
    f.log.splice(0);
    const [x] = W.addToEncounter(lib(), 1);
    eq([x.hp, x.temp], [20, 5]);
    W.damage(x, 7); W.save(); await wait(500);
    eq(f.store['sheets/p1'].hp, {max: 24, cur: 18, temp: 0});
  });
  test('DM oldali módosítás (tárgy a Tárgyak fülről, gazda, AC a szerkesztőben) mezőnként a lapra kerül', async () => {
    const f = await loadWith();
    f.log.splice(0);
    W.addItemTo('p1', {n: 'Bag of Holding', s: 'DMG', mag: true, rar: 'uncommon'}, 1); await wait(500);
    ok(f.log.includes('update sheets/p1 inventory'), f.log.join('; '));
    ok(f.store['sheets/p1'].inventory.some(i => i.name === 'Bag of Holding' && i.ref === 'Bag of Holding|DMG'));
    f.log.splice(0);
    A('S.library[0].owner = "b@x.hu"; save()'); await wait(500);
    ok(f.log.includes('update sheets/p1 owner'), f.log.join('; ')); eq(f.store['sheets/p1'].owner, 'b@x.hu');
    f.log.splice(0);
    W.openLib('lib'); click('[data-act="libEdit"]');
    has($('#edForm').textContent, 'telefonos karakterlapja van');
    $('#edForm').elements.ac.value = '17'; click('[data-act="edSave"]'); await wait(500);
    ok(f.log.includes('update sheets/p1 ac'), f.log.join('; ')); eq(f.store['sheets/p1'].ac, 17);
  });
  test('szabálymotoros lap: mentők és skillek a cache-ből; a DM AC- és képesség-átírása felülírásként (ov) megy a lapra', async () => {
    const H = W.Sheet, s0 = H.norm(sheetDoc({auto: true, build: {base: {cha: 16}, levels: lv('Paladin', 6)}}));
    const f = await loadWith({'sheets/p1': JSON.parse(JSON.stringify({...s0, ...H.materialize(s0, H.calc(s0, rb3()))}))});
    eq(lib().saves, {str: 3, dex: 3, con: 3, int: 3, wis: 6, cha: 9}, 'Aura of Protection: a nem jártas mentők is');
    eq([lib().skillMods.persuasion, lib().skillMods.stealth], [{b: 3, p: 0}, {b: 0, p: 0}]);
    f.log.splice(0);
    W.openLib('lib'); click('[data-act="libEdit"]');
    $('#edForm').elements.ac.value = '19'; click('[data-act="edSave"]'); await wait(500);
    ok(f.log.includes('update sheets/p1 ac,ov.ac'), f.log.join('; '));
    eq([f.store['sheets/p1'].ac, f.store['sheets/p1'].ov], [19, {ac: 19}]);
    f.log.splice(0);
    A('S.library[0].abilities.str = 14; save()'); await wait(500);
    ok(f.log.includes('update sheets/p1 abilities,cache,ov.ab:str'), f.log.join('; '));
    eq([f.store['sheets/p1'].ov, f.store['sheets/p1'].cache], [{ac: 19, 'ab:str': 14}, null]);
    // HP a harcból: nem felülírás
    f.log.splice(0);
    const [x] = W.addToEncounter(lib(), 1); W.damage(x, 5); W.save(); await wait(500);
    ok(f.log.includes('update sheets/p1 hp.cur,hp.temp'), f.log.join('; '));
  });
  test('aktív hatás a lapon (Mage Armor) → a könyvtári AC; koncentráció a harcba és vissza (a DM kikapcsolja → a lapon is vége)', async () => {
    const f = await loadWith({'sheets/p1': sheetDoc({ac: 12, inventory: [], conditions: ['Mage Armor', 'Bless'], concentration: 'Bless'})});
    eq([lib().ac, lib().acNote], [16, 'leather armor + Mage Armor'], '13 + DEX 3');
    f.log.splice(0);
    const [x] = W.addToEncounter(lib(), 1);
    eq(x.conc, true, 'a lap koncentrációjával indul');
    W.save(); await wait(500);
    ok(!f.log.some(l => /sheets\//.test(l)), 'nem ír vissza: ' + f.log);
    x.conc = false; W.save(); await wait(500);
    ok(f.log.includes('update sheets/p1 concentration,conditions'), f.log.join('; '));
    eq([f.store['sheets/p1'].concentration, f.store['sheets/p1'].conditions], ['', ['Mage Armor']]);
  });
  test('állapotok a harc és a lap között oda-vissza (a körszám megmarad); AC-átírás aktív hatás mellett az alapértéket írja', async () => {
    const f = await loadWith({'sheets/p1': sheetDoc({ac: 14, conditions: ['Shield of Faith']})});
    eq(lib().ac, 16);
    f.log.splice(0);
    const [x] = W.addToEncounter(lib(), 1);
    eq(x.cond, [{name: 'Shield of Faith', rounds: null}], 'a lap állapotaival indul');
    x.cond.push({name: 'Prone', rounds: 2}); W.save(); await wait(500);
    ok(f.log.includes('update sheets/p1 conditions'), f.log.join('; '));
    eq(f.store['sheets/p1'].conditions, ['Shield of Faith', 'Prone']);
    f.log.splice(0);
    f.store['sheets/p1'].conditions = ['Shield of Faith', 'Prone', 'Poisoned']; f.emit('sheets'); await wait(500);
    eq(A('S.enc.list[0].cond'), [{name: 'Shield of Faith', rounds: null}, {name: 'Prone', rounds: 2}, {name: 'Poisoned', rounds: null}], 'a telefonos állapot átjön, a DM körszáma marad');
    ok(!f.log.some(l => /sheets\//.test(l)), 'nem ír vissza: ' + f.log);
    A('S.enc.list[0].cond.splice(1, 1); save()'); await wait(500);
    eq(f.store['sheets/p1'].conditions, ['Shield of Faith', 'Poisoned'], 'a DM levette a Prone-t');
    W.openLib('lib'); click('[data-act="libEdit"]');
    $('#edForm').elements.ac.value = '17'; click('[data-act="edSave"]'); await wait(500);
    eq([f.store['sheets/p1'].ac, lib().ac], [15, 17], 'a lapon 15 (+2 Shield of Faith = 17)');
  });
  test('karakterlap létrehozása meglévő (D&D Beyond-os) játékosból: osztály, mentők, skillek, támadás, spellek', () => {
    const c = W.normCreature(pc('Rella', 5, {id: 'p9', owner: 'a@x.hu', type: 'Half-Elf — Bard 5 (College of Lore)', abilities: {dex: 14, cha: 18, con: 12}, saves: {dex: 4, cha: 7},
      skillMods: {performance: {b: 10, p: 2}, perception: {b: 1, p: 0.5}, stealth: {b: 5, p: 1}}, hp: {max: 38, cur: 30},
      actions: [{name: 'Rapier', text: 'Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 1d8+2 piercing damage.'}, {name: 'Dagger', text: 'Melee Weapon Attack: +5 to hit. Hit: 4 (1d4 + 2) piercing damage.'}],
      traits: [{name: 'Varázslatok', text: 'Bard: spell save DC 15, +7 to hit\nCantrips: Vicious Mockery, Minor Illusion\n1st level: Healing Word'}, {name: 'Song of Rest', text: 'd6'}],
      senses: 'darkvision 60 ft., passive Perception 11', notes: 'DM titka'}));
    const s = W.creatureToSheet(c);
    eq([s.classes, s.race], [[{name: 'Bard', subclass: 'College of Lore', level: 5, hitDie: 8}], 'Half-Elf']);
    eq([s.saveProf, s.skillProf, s.jack], [['dex', 'cha'], {performance: 2, stealth: 1}, true]);
    eq(s.attacks.map(a => [a.name, a.hit, a.dmg]), [['Rapier', '+5', '1d8+2 piercing'], ['Dagger', '+5', '1d4+2 piercing']]);
    eq(s.spells.map(x => [x.name, x.level]), [['Vicious Mockery', 0], ['Minor Illusion', 0], ['Healing Word', 1]]);
    eq([s.spellcasting.ability, s.spellcasting.slots.slice(0, 4)], ['cha', [4, 3, 2, 0]]);
    eq([s.hp, s.senses, s.notes], [{max: 38, cur: 30, temp: 0}, 'darkvision 60 ft.', ''], 'a DM jegyzete nem kerül a játékos lapjára');
    ok(s.features.some(f => f.name === 'Song of Rest'));
    // kézzel felvitt játékos: jártasság / expertise a „Skills” szövegből (bónusz − képességmódosító)
    const m = W.creatureToSheet(W.normCreature(pc('Kézi', 5, {abilities: {dex: 16, wis: 12, str: 10}, skills: 'Stealth +9, Perception +4, Athletics +0, Arcana +1, Nemlétező +5'})));
    eq(m.skillProf, {perception: 1, stealth: 2},'Stealth: 3 + 2×3, Perception: 1 + 3');
    A(`S.library = [normCreature(${JSON.stringify(c)})]`); W.openLib('lib');
    click('[data-act="libSheet"]');
    ok(A('SHEETS.p9'), 'létrejött'); eq([A('S.library[0].owner'), A('SHEETS.p9.owner')], ['a@x.hu', 'a@x.hu']);
    ok($('[data-act="libSheet"]').classList.contains('on'));
    const calls = []; const o = W.open; W.open = (...a) => calls.push(a);
    try { click('[data-act="libSheet"]'); } finally { W.open = o; }
    eq(calls, [['karakter.html#lap/p9', '_blank']], 'meglévő lapnál megnyitja');
  });
  test('JSON-import: karakterlap-sablon → játékos + lap a felhőben; azonos névnél rákérdez', async () => {
    const f = makeFakeDb(emptyState());
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await wait(300);
    const [c] = await W.importAny(W.Sheet.TEMPLATE);
    eq([c.kind, c.name, c.cr], ['pc', 'Minta Tolvaj', 'Szint 3']);
    await wait(500);
    const doc = f.store['sheets/' + c.id];
    ok(doc, 'a lap felkerült'); eq(doc.format, 'dmscreen-karakter'); hasNot(JSON.stringify(doc), '_leiras');
    let asked = ''; W.confirm = m => { asked = m; return true; };
    const [c2] = await W.importAny({...W.Sheet.TEMPLATE, hp: {max: 30}});
    has(asked, 'Minta Tolvaj'); eq([c2.id, A('S.library').length, A(`SHEETS[${JSON.stringify(c.id)}].hp.max`)], [c.id, 1, 30]);
    W.confirm = () => false;
    await W.importAny(W.Sheet.TEMPLATE); eq(A('S.library').length, 2, 'Mégse = új karakter');
    W.openLib('json'); click('[data-act="showSheetTemplate"]'); has($('#jsonIn').value, 'dmscreen-karakter');
  });
  test('törlés a lappal együtt; a mentésfájlban és visszatöltéskor a lapok is benne vannak', async () => {
    const f = await loadWith();
    let file; W.download = (n, o) => { file = o; };
    W.openMenu(); click('[data-act="exportAll"]');
    eq([file.sheets.length, file.sheets[0].id, file.sheets[0].name], [1, 'p1', 'Minta Tolvaj']);
    f.log.splice(0);
    W.openLib('lib'); click('[data-act="libDel"]'); await wait(500);
    ok(f.log.includes('del sheets/p1'), f.log.join('; ')); eq(A('Object.keys(SHEETS)'), []);
    W.importBackup(JSON.parse(JSON.stringify(file))); await wait(500);
    ok(A('SHEETS.p1') && f.store['sheets/p1'], 'visszaállt');
    const bk = Object.entries(f.store).find(([k]) => k.startsWith('dmscreen_backup/'));
    ok(bk && JSON.parse(bk[1].data).sheets.length === 1, 'a napi felhős mentésben is benne van');
  });
  test('régi szabályok (a lapok nem olvashatók): a DM Screen így is betölt, a Menü szól', async () => {
    const f = makeFakeDb({...emptyState(), 'dmscreen_library/a': mk()});
    const orig = f.db.list; f.db.list = async c => { if (c === 'sheets') throw Object.assign(new Error('x'), {code: 'permission-denied'}); return orig(c); };
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await wait(300);
    ok($('#gate').hidden); eq(A('S.library').length, 1);
    W.openMenu(); has($('#modalBox').textContent, 'firestore.rules');
  });
});

describe('Telefonos karakterlap (karakter.html)', () => {
  const kq = s => K.document.querySelector(s), kqa = s => [...K.document.querySelectorAll(s)];
  const kclick = el => { if (typeof el === 'string') el = kq(el); ok(el, 'nincs ilyen elem'); el.dispatchEvent(new K.MouseEvent('click', {bubbles: true, cancelable: true})); };
  const kset = (el, v, evt = 'change') => { if (typeof el === 'string') el = kq(el); ok(el, 'nincs ilyen mező'); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new K.Event(evt, {bubbles: true})); };
  const ktext = () => kq('main').textContent;
  let klog;
  const ORIGK = {};
  const ktest = (name, fn, opts) => test(name, async () => {
    for (const k of ['rnd', 'confirm']) ORIGK[k] ??= K[k];
    klog = []; K.KDB = {update: (id, p) => klog.push(['update', id, p]), pub: (id, p) => klog.push(['pub', id, p])};
    K.confirm = () => true;
    try { await fn(); }
    finally { Object.assign(K, ORIGK); K.KDB = undefined; K.location.hash = ''; K.KApp.setSheets([]); K.KApp.setChars([]); K.KApp.setRulebook(null); K.route(); }
  }, opts);
  ktest('valódi szabálykönyvvel: kézi lap átállítása minden osztályra (5. szint, alosztállyal, különböző faj és háttér) – a Felépítés-fül hiba nélkül megjelenik, a gomb eltűnik', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    K.KApp.setRulebook({version: 'online', rb});
    const races = H.raceOptions(rb).map(o => o.label), bgs = rb.backgrounds.map(b => b.n), errs = [];
    rb.classes.forEach((c, i) => {
      const sub = H.subclassesOf(c.n, rb)[0]?.n || '';
      openSheet({race: races[i % races.length], background: bgs[i % bgs.length], classes: [{name: c.n, subclass: sub, level: 5}], features: [], resources: [], attacks: []}, 'dm@x.hu', true);
      kclick('[data-tab="adat"]');
      try { kclick('[data-act="toAuto"]'); K.eval('tabBuild(sheets.get("p1"))'); }
      catch (e) { errs.push(`${c.n} (${races[i % races.length]}, ${bgs[i % bgs.length]}): ${e.message}`); return; }
      const s = K.eval('sheets.get("p1")');
      const lost = [s.name !== 'Minta Tolvaj' && 'név: ' + s.name, s.build?.levels?.length !== 5 && 'szintek: ' + s.build?.levels?.length, !s.build?.race && 'faj üres', H.level(s) !== 5 && 'szint: ' + H.level(s)].filter(Boolean);
      if (lost.length) errs.push(`${c.n} (${races[i % races.length]}): ${lost.join(', ')}`);
      if (!s.auto) errs.push(c.n + ': nem állt át');
      else if (kq('[data-act="toAuto"]') || !ktext().includes('Felépítés')) errs.push(c.n + ': a felület nem váltott át');
    });
    eq(errs, []);
  }, {online: true});
  const openSheet = (extra = {}, email = 'a@x.hu', dm = false) => {
    K.KApp.setAuth({status: 'signedIn', email, dm});
    K.KApp.setChars([{id: 'p1', kind: 'pc', owner: 'a@x.hu', visibility: 'party', name: 'Minta Tolvaj', ac: 14, hp: {cur: 24, max: 24}}]);
    K.KApp.setSheets([{...sheetDoc(), id: 'p1', ...extra}]);
    K.location.hash = '#lap/p1'; K.route();
  };
  const lastUpdate = () => klog.filter(l => l[0] === 'update').at(-1)?.[2] || {};
  const H_sv = fm => ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter(a => fm.elements['sv_' + a].checked);
  ktest('lista → lap: a saját kártya a lapra visz; fejléc, HP, AC, initiative, fülek', () => {
    K.KApp.setAuth({status: 'signedIn', email: 'a@x.hu'});
    K.KApp.setChars([{id: 'p1', kind: 'pc', owner: 'a@x.hu', visibility: 'party', name: 'Minta Tolvaj', ac: 14, hp: {cur: 24, max: 24}}]);
    K.KApp.setSheets([{...sheetDoc(), id: 'p1'}]);
    eq(kq('.card.own').getAttribute('href'), '#lap/p1');
    K.location.hash = '#lap/p1'; K.route();
    const t = ktext();
    has(t, 'Minta Tolvaj'); has(t, 'Rogue 3 (Thief)'); has(t, '24 / 24 HP'); has(t, 'Shortsword');
    eq(kqa('nav.tabs button').map(b => b.dataset.tab), ['harc', 'kep', 'var', 'fel', 'adat', 'jegyz'], 'a Jegyzet az utolsó, nincs külön Jellemzők fül');
    ok(!kq('#rollbar').hidden, 'a dobássáv látszik');
  });
  ktest('elrendezés: fent csak vékony HP-sáv; HP-kezelés a Harc fül alján; AC-sor az Alapadatokon; jellemzők a Képességek alján', () => {
    openSheet({hp: {max: 24, cur: 20, temp: 3}});
    const nav = kq('nav.tabs');
    ok(kq('.hpline .bar.slim') && nav.compareDocumentPosition(kq('.hpline')) & K.Node.DOCUMENT_POSITION_PRECEDING, 'a HP-sáv a fülsáv fölött');
    has(kq('.hpline').textContent, '+3 temp');
    ok(!kq('.chips'), 'az AC-sor nincs a lap tetején');
    ok(nav.compareDocumentPosition(kq('#hpIn')) & K.Node.DOCUMENT_POSITION_FOLLOWING, 'a HP-kezelés a fülek alatt');
    const all = kqa('main h3').map(h => h.textContent);
    eq(all.at(-1), 'HP', 'a Harc fül utolsó része a HP');
    kclick('[data-tab="adat"]');
    ok(kq('.chips') && kq('#edForm'), 'AC-sor és űrlap az Alapadatokon');
    eq(kqa('.chips .chip small').map(x => x.textContent), ['AC', 'Initiative', 'Speed', 'Prof. bónusz', 'Passzív Perc.']);
    eq(K.getComputedStyle(kq('.chips button.chip')).justifyContent, 'flex-start', 'az Initiative is felülre igazítva');
    kclick('[data-tab="kep"]');
    has(ktext(), 'Jellemzők'); has(ktext(), 'Sneak Attack'); ok(kq('#featNew'), 'jellemző felvétele is itt');
    hasNot(ktext(), 'Jártasságok', 'a jártasságok a Harc fülön vannak');
    kclick('[data-tab="harc"]');
    const h3 = kqa('main h3').map(h => h.textContent);
    eq(h3.slice(-2), ['Jártasságok, nyelvek', 'HP'], 'a jártasságok közvetlenül a HP-kezelés fölött');
    has(ktext(), "thieves' tools");
  });
  ktest('pihenő gombok a felső sorban; a HD gomb a Hit Dice panelt nyitja, onnan elkölthető', () => {
    openSheet({classes: [{name: 'Fighter', level: 3}, {name: 'Rogue', level: 2}], hp: {max: 30, cur: 10, temp: 0}});
    const top = kq('.top');
    ok(top.querySelector('[data-act="shortRest"]') && top.querySelector('[data-act="longRest"]') && top.querySelector('[data-act="hdToggle"]'), 'a három gomb fent van');
    eq(K.getComputedStyle(top).position, 'sticky', 'görgetéskor is fent marad');
    ok(!kq('[data-act="hd"]'), 'a panel alapból zárva');
    kclick('[data-act="hdToggle"]');
    eq(kqa('[data-act="hd"]').map(b => b.dataset.die), ['10', '8']);
    K.rnd = () => 6; kclick('[data-act="hd"][data-die="10"]');
    eq([lastUpdate().hp.cur, lastUpdate().hitDiceUsed], [18, {10: 1}], 'd10 = 6 + CON +2');
    ok(kq('[data-act="hd"]'), 'a panel nyitva marad');
    kclick('[data-act="hdToggle"]'); ok(!kq('[data-act="hd"]'));
  });
  ktest('keskeny (320 px) telefonon egyik fül sem lóg ki, az Alapadatok sem', async () => {
    const fr = document.getElementById('karakter'), w0 = fr.width;
    fr.width = 320; await wait(50);
    try {
      openSheet({classes: [{name: 'Fighter', level: 3}, {name: 'Rogue', subclass: 'Thief', level: 2}]});
      const W = K.document.documentElement.clientWidth;
      for (const t of ['harc', 'kep', 'var', 'fel', 'adat', 'jegyz']) {
        kclick(`[data-tab="${t}"]`);
        const wide = kqa('main *').filter(e => e.getBoundingClientRect().right > W + 1 && !e.closest('nav.tabs')).map(e => e.tagName + (e.name ? '[' + e.name + ']' : '') + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right) + '/' + W);
        eq(wide.slice(0, 5), [], t + ' fül');
      }
    } finally { fr.width = w0; }
  });
  ktest('fülre kattintva a fülsáv vízszintes görgetése megmarad', () => {
    openSheet();
    const nav = kq('nav.tabs');
    nav.scrollLeft = 60;  // a 420 px széles próbaablakban a fülek nem férnek ki
    const got = nav.scrollLeft;
    ok(got > 0, 'nem görgethető a próbában');
    kclick('[data-tab="var"]');
    eq(kq('nav.tabs').scrollLeft, got);
  });
  ktest('HP: sebzés, gyógyítás, temp; mezőnként menti, a csapat felé is; 0 HP-n halálmentők', () => {
    openSheet({hp: {max: 24, cur: 24, temp: 0}});
    kset('#hpIn', '5', 'input'); kclick('[data-act="hpDmg"]');
    eq(lastUpdate().hp, {max: 24, cur: 19, temp: 0}); eq(lastUpdate().updatedBy, 'a@x.hu');
    eq(Object.keys(lastUpdate()).sort(), ['hp', 'updatedAt', 'updatedBy'], 'csak a változott mező');
    eq(klog.find(l => l[0] === 'pub')[2], {hp: {cur: 19, max: 24}, ac: 14, name: 'Minta Tolvaj', level: 'Szint 3'});
    kset('#hpIn', '3', 'input'); kclick('[data-act="hpTemp"]'); eq(lastUpdate().hp.temp, 3);
    kset('#hpIn', '5', 'input'); kclick('[data-act="hpDmg"]'); eq(lastUpdate().hp, {max: 24, cur: 17, temp: 0}, 'a temp HP nyel először');
    kset('#hpIn', '50', 'input'); kclick('[data-act="hpHeal"]'); eq(lastUpdate().hp.cur, 24);
    kset('#hpIn', '99', 'input'); kclick('[data-act="hpDmg"]');
    has(ktext(), 'Halálmentők');
    K.rnd = () => 12; kclick('[data-act="dsRoll"]'); eq(lastUpdate().deathSaves, {ok: 1, fail: 0});
    K.rnd = () => 1; kclick('[data-act="dsRoll"]'); eq(lastUpdate().deathSaves, {ok: 1, fail: 2}, 'természetes 1 = két kudarc');
    K.rnd = () => 20; kclick('[data-act="dsRoll"]'); eq([lastUpdate().hp.cur, lastUpdate().deathSaves], [1, {ok: 0, fail: 0}], 'természetes 20 = 1 HP');
  });
  ktest('dobások: skill előnnyel (utána visszaáll normálra), sebzés kritikussal', () => {
    openSheet();
    kclick('[data-tab="kep"]');
    let n = 0; K.rnd = () => [15, 4][n++ % 2];
    kclick('#rollbar [data-mode="adv"]');
    const stealth = kqa('.li').find(r => r.textContent.includes('Stealth'));
    has(stealth.textContent, '◆'); has(stealth.textContent, '+7');
    kclick(stealth.querySelector('[data-act="d20"]'));
    eq(kq('#lastRoll b').textContent, '22'); has(kq('#lastRoll').textContent, 'előny');
    ok(kq('#rollbar [data-mode=""]').classList.contains('on'), 'visszaállt normálra');
    kclick('[data-tab="harc"]');
    K.rnd = () => 4; kclick('#rollbar [data-mode="crit"]');
    kclick(kqa('[data-act="dmg"]').find(b => b.dataset.expr === '1d6+3'));
    eq(kq('#lastRoll b').textContent, '11', '2×d6 + 3');
  });
  ktest('erőforrások és spell slotok pöttyei; short és long rest', () => {
    openSheet({resources: [{name: 'Ki', max: 3, used: 0, reset: 'short'}], spellcasting: {ability: 'int', slots: [2], used: [0]}});
    kclick(kq('[data-act="res"][data-j="1"]')); eq(lastUpdate().resources[0].used, 2);
    kclick(kq('[data-act="res"][data-j="1"]')); eq(lastUpdate().resources[0].used, 1, 'ugyanarra még egyszer: egyel vissza');
    kclick('[data-act="shortRest"]'); eq(lastUpdate().resources[0].used, 0);
    kclick('[data-tab="var"]');
    has(ktext(), 'spell save DC 11');
    kclick(kq('[data-act="slot"][data-j="0"]')); eq(lastUpdate().spellcasting.used[0], 1);
    kclick('[data-tab="harc"]'); kclick('[data-act="longRest"]');
    eq([lastUpdate().spellcasting.used[0], lastUpdate().hp.cur], [0, 24]);
  });
  ktest('varázslat a szabálykönyvből (osztálylista szűrő), leírás, felkészítés, saját varázslat', async () => {
    K.KApp.setRulebook({version: 'v1', rb: await fakeRb()});
    openSheet({classes: [{name: 'Wizard', level: 5}]});
    kclick('[data-tab="var"]');
    kset('#spellQ', 'to', 'input');
    has(kq('#spellRes').textContent, 'Toll the Dead');
    kset('#spellQ', 'bless', 'input'); has(kq('#spellRes').textContent, 'Nincs találat az osztályaid listáján', 'Bless nem Wizard-spell');
    kset('#spellMine', false); has(kq('#spellRes').textContent, 'Bless');
    kset('#spellQ', 'fireb', 'input'); kclick(kq('#spellRes [data-act="spellAdd"]'));
    eq(lastUpdate().spells, [{name: 'Fireball', level: 3, prepared: false, always: false, note: '', ref: 'Fireball|PHB'}]);
    has(ktext(), '3rd level · evocation'); has(ktext(), '8d6 fire');
    kset(kq('[data-act="prep"]'), true); eq(lastUpdate().spells[0].prepared, true);
    kset('#spellNew', 'Ködös homály', 'input'); kset('#spellNewL', '2'); kclick('[data-act="spellCustom"]');
    eq(lastUpdate().spells.map(s => [s.name, s.level]), [['Fireball', 3], ['Ködös homály', 2]]);
  });
  ktest('felszerelés: tárgy a szabálykönyvből (variáns is), felszerelve, darabszám, pénz, saját tárgy', async () => {
    K.KApp.setRulebook({version: 'v1', rb: await fakeRb()});
    openSheet({inventory: []});
    kclick('[data-tab="fel"]');
    kset('#itemQ', '+1 long', 'input'); kclick(kq('#itemRes [data-act="itemAdd"]'));
    eq(lastUpdate().inventory.map(i => [i.name, i.qty, i.ref, i.magic]), [['+1 Longsword', 1, '+1 Longsword|DMG', true]]);
    has(ktext(), 'You have a +1 bonus');
    kset(kq('[data-act="equip"]'), true); eq(lastUpdate().inventory[0].equipped, true);
    kclick(kq('[data-act="qty"][data-d="1"]')); eq(lastUpdate().inventory[0].qty, 2);
    kset(kq('[data-coin="gp"]'), '42'); eq(lastUpdate().currency.gp, 42);
    kset('#itemNew', 'Nagymama medálja', 'input'); kclick('[data-act="itemCustom"]');
    eq(lastUpdate().inventory.at(-1).name, 'Nagymama medálja');
  });
  ktest('alapadatok: osztály átírása, slotok az osztály alapján, mentés; a szint a csapat felé is', () => {
    openSheet();
    kclick('[data-tab="adat"]');
    const fm = kq('#edForm');
    fm.elements.cl_name_0.value = 'Wizard'; fm.elements.cl_sub_0.value = ''; fm.elements.cl_lvl_0.value = '5'; fm.elements.ab_int.value = '16';
    kclick('[data-act="slotsAuto"]');
    eq([kq('#edForm').elements.slot_0.value, kq('#edForm').elements.slot_2.value, kq('#edForm').elements.cl_lvl_0.value], ['4', '2', '5'], 'a beírt értékek megmaradtak');
    kclick('[data-act="rowAdd"][data-list="attacks"]'); ok(kq('#edForm').elements.at_name_2, 'új támadás sor');
    kq('#edForm').elements.at_name_2.value = 'Fire Bolt'; kq('#edForm').elements.at_dmg_2.value = '2d10 fire';
    kclick('[data-act="edSave"]');
    const u = lastUpdate();
    eq([u.classes[0].name, u.classes[0].level, u.spellcasting.slots.slice(0, 3), u.abilities.int, u.attacks.at(-1).name], ['Wizard', 5, [4, 3, 2], 16, 'Fire Bolt']);
    ok(!('hp' in u), 'a változatlan HP nem íródik'); eq(K.eval('sheets.get("p1").hp'), {max: 24, cur: 24, temp: 0}, 'a jelenlegi HP nem változik');
    eq(klog.filter(l => l[0] === 'pub').at(-1)[2].level, 'Szint 5');
    has(ktext(), 'Wizard 5');
  });
  ktest('más lapja csak olvasható; DM-ként minden lap látszik és írható', () => {
    openSheet({owner: 'b@x.hu'});
    ok(!kq('#hpIn'), 'nem szerkeszthető'); has(ktext(), 'csak olvasható');
    kclick('[data-tab="adat"]'); ok(kq('.chips') && !kq('#edForm'), 'az AC-sor látszik, az űrlap nem');
  });
  ktest('DM nézet: minden karakterlap a listában, és írható', () => {
    K.KApp.setAuth({status: 'signedIn', email: 'dm@x.hu', dm: true});
    K.KApp.setSheets([{...sheetDoc(), id: 'p1'}, {...sheetDoc({name: 'Bori', owner: 'b@x.hu'}), id: 'p2'}]);
    has(ktext(), 'Minden karakterlap (DM)'); eq(kqa('a.card').map(a => a.getAttribute('href')).sort(), ['#lap/p1', '#lap/p2']);
    K.location.hash = '#lap/p2'; K.route();
    ok(kq('#hpIn'), 'a DM írhatja');
  });
  ktest('befecskendezett kód a lapon: egyik fülön sem fut le', async () => {
    K.KApp.setRulebook({version: 'v1', rb: await fakeRb()});
    K.__xss = 0;
    openSheet({name: XSS, race: XSS, portrait: 'javascript:window.__xss=1', classes: [{name: XSS, subclass: XQ, level: XQ}], acNote: XQ, speed: XSS,
      attacks: [{name: XSS, hit: XQ, dmg: XSS, note: XSS}], resources: [{name: XSS, max: 2}], features: [{name: XSS, text: XSS, src: XQ}],
      spells: [{name: XSS, level: 1, note: XSS, ref: XQ}], inventory: [{name: XSS, note: XQ, container: XSS, ref: XQ}], conditions: [XSS], notes: XSS,
      profs: {armor: XSS, tools: XQ}, senses: XSS});
    for (const t of ['harc', 'kep', 'var', 'fel', 'adat', 'jegyz']) {
      kclick(`[data-tab="${t}"]`);
      eq(K.document.querySelectorAll('main [onmouseover], main img[src="x"]').length, 0, t + ' fül');
    }
    K.location.hash = ''; K.route();
    eq(K.document.querySelectorAll('main [onmouseover], main img[src="x"]').length, 0, 'lista');
    ok(!K.__xss, 'lefutott a kód');
  });
  ktest('szabálymotoros lap: újraszámolás és mezőnkénti írás betöltéskor, felszereléskor, kézi átírásnál (felülírás); szabálykönyv nélkül nem', () => {
    const doc = {auto: true, build: {race: 'Dwarf|PHB', subrace: 'Hill|PHB', base: {str: 16, dex: 14, con: 14}, levels: lv('Barbarian', 5)},
      inventory: [{name: 'Shield', qty: 1}, {name: 'Longsword', qty: 1, equipped: true}]};
    K.KApp.setRulebook(null);
    openSheet(doc);
    eq(klog, [], 'szabálykönyv nélkül a faj hatása hiányozna: nem ír');
    K.KApp.setRulebook({version: 'v1', rb: rb3()});
    let u = lastUpdate();
    eq([u.ac, u.hp?.max, u.hp?.cur, u.speed, u.abilities?.con, u.cache?.saves?.con, u.classes?.[0]], [15, 60, 24, '35 ft.', 16, 6, {name: 'Barbarian', subclass: '', level: 5, hitDie: 12}]);
    ok(u.features.some(f => f.name === 'Rage' && f.auto) && u.features.some(f => f.name === 'Sneak Attack' && !f.auto), 'a számolt jellemzők a saját mellé');
    eq(klog.filter(l => l[0] === 'pub').at(-1)[2], {hp: {cur: 24, max: 60}, ac: 15, name: 'Minta Tolvaj', level: 'Szint 5'}, 'a csapat felé ugyanaz a nyilvános rész');
    has(ktext(), 'Barbarian 5');
    // a visszajött saját írás (és a csak HP-t érintő változás) nem számol újra
    const n = klog.length;
    K.KApp.setSheets([{...K.eval('sheets.get("p1")'), id: 'p1'}]);
    eq(klog.length, n, 'a visszajött saját írás nem ír újra');
    K.patch({hp: {max: 60, cur: 20, temp: 0}});
    eq(Object.keys(lastUpdate()).sort(), ['hp', 'updatedAt', 'updatedBy']);
    // pajzs felvétele → AC újraszámolva, ugyanabban az írásban
    kclick('[data-tab="fel"]');
    kset(kq('[data-act="equip"][data-i="0"]'), true);
    u = lastUpdate();
    eq([u.inventory?.[0].equipped, u.ac], [true, 17]);
    // kézi AC a Számolt értékeknél (✎) → felülírás (ov), az újraszámolás után is megmarad
    kclick('[data-tab="adat"]');
    kset(kq('[data-ov="ac"]'), '19');
    u = lastUpdate();
    eq([u.ac, u.ov], [19, {ac: 19}]);
    eq([K.eval('sheets.get("p1").ac'), K.eval('sheets.get("p1").ov')], [19, {ac: 19}]);
    // új szabálykönyv-verzió: újraszámol (itt nincs mit változtatni)
    const m = klog.length;
    K.KApp.setRulebook({version: 'v2', rb: rb3()});
    eq(klog.length, m, 'azonos eredménynél nem ír');
  });
  ktest('Felépítés-fül: választók (képesség, feat, Fighting Style, ASI, alosztály), Teendők, ✎ felülírás és visszaállítás, szint-HP, név', () => {
    K.KApp.setRulebook({version: 'v1', rb: rb3()});
    openSheet({auto: true, build: {race: 'Human|PHB', subrace: 'Variant|PHB', base: {str: 15, dex: 14, con: 13}, levels: lv('Fighter', 4)}, inventory: [], attacks: [], resources: [], features: []});
    has(kq('.todobar').textContent, 'Teendők (5)');
    kclick('[data-act="todoGo"]');
    ok(kq('details[data-key="todos"]').open, 'a teendőlista nyitva'); eq(K.eval('view.tab'), 'adat');
    const abBox = a => kqa('[data-ch="subrace:ability"]').find(e => e.value === a);
    kset(abBox('str'), true); eq(lastUpdate().build.ch['subrace:ability'], ['str']);
    kset(abBox('con'), true);
    ok(abBox('dex').disabled && !abBox('str').disabled, 'két választás után a többi tiltva');
    kset(kq('select[data-ch="subrace:feat"]'), 'Alert|PHB'); eq(lastUpdate().build.ch['subrace:feat'], ['Alert|PHB']);
    kset(kq('select[data-ch="Fighter:opt:Fighting Style"]'), 'Archery|PHB');
    kset(kq('[data-ch="Fighter:4:asi"][data-asi="a0"]'), 'dex'); has(ktext(), 'Még 1 pont');
    kset(kq('[data-ch="Fighter:4:asi"][data-asi="a1"]'), 'dex'); eq(lastUpdate().build.ch['Fighter:4:asi'], {dex: 2});
    kset(kq('select[data-ch="Fighter:sub"]'), 'Champion|PHB'); eq(lastUpdate().build.sub, {Fighter: 'Champion|PHB'});
    const s = K.eval('sheets.get("p1")');
    eq([s.abilities.str, s.abilities.dex, s.abilities.con, K.Sheet.initiative(s), s.ac], [16, 16, 14, 8, 13]);
    ok(!kq('.todobar'), 'nincs több teendő');
    // ASI → feat módra váltás
    kset(kq('[data-ch="Fighter:4:asi"][data-asi="mode"]'), 'feat'); ok(kq('[data-ch="Fighter:4:asi"][data-asi="feat"]'), 'feat-lista');
    ok([...kq('[data-ch="Fighter:4:asi"][data-asi="feat"]').options].find(o => o.value === 'Alert|PHB').disabled, 'a már felvett feat nem választható újra');
    // ✎ felülírás és visszaállítás
    kset(kq('[data-ov="ac"]'), '20'); eq([lastUpdate().ov, lastUpdate().ac], [{ac: 20}, 20]); has(ktext(), 'számolt: 12', 'ASI helyett feat: DEX 14');
    kclick('[data-act="ovReset"][data-key="ac"]'); eq([lastUpdate().ov, lastUpdate().ac], [{}, 12]);
    kset(kq('[data-ov="skill:stealth"]'), '2'); eq(lastUpdate().ov, {'skill:stealth': 2});
    // szintenkénti HP, alapérték; szintet a játékos nem ad
    const hp0 = K.eval('sheets.get("p1").hp.max');
    kset(kq('[data-act="lvHp"][data-i="1"]'), '10'); eq([K.eval('sheets.get("p1").build.levels[1].hp'), K.eval('sheets.get("p1").hp.max')], [10, hp0 + 4]);
    kset(kq('[data-act="bBase"][data-a="wis"]'), '12'); eq(lastUpdate().abilities?.wis, 12);
    ok(!kq('[data-act="lvAdd"]'), 'szintet csak a DM ad');
    kq('#edForm').elements.name.value = 'Új név'; kclick('[data-act="edSave"]'); eq(lastUpdate().name, 'Új név');
    ok(K.eval('sheets.get("p1").attacks').every(a => a.auto), 'a számolt támadások maradnak');
    // DM: szint hozzáadása és levétele
    openSheet({auto: true, build: {levels: lv('Fighter', 2)}}, 'dm@x.hu', true);
    kclick('[data-tab="adat"]'); kset('#lvCls', 'Paladin'); kclick('[data-act="lvAdd"]');
    eq(K.eval('sheets.get("p1").build.levels').map(l => l.c), ['Fighter', 'Fighter', 'Paladin']);
    kclick('[data-act="lvRm"]'); eq(K.eval('sheets.get("p1").build.levels').length, 2);
  });
  ktest('biztonság: hibára futó átállítás nem ír és a piszkozat megmarad; piszkozat nélküli Mentés nem ír üres lapot; régi sheet.js mellett nem ír', () => {
    K.KApp.setRulebook({version: 'v1', rb: rb3()});
    const alerts = [], origAlert = K.alert, origToAuto = K.Sheet.toAuto;
    K.alert = m => alerts.push(m);
    try {
      openSheet();
      kclick('[data-tab="adat"]');
      K.Sheet.toAuto = () => { throw new Error('próba'); };
      kclick('[data-act="toAuto"]');
      eq(klog.filter(l => l[0] === 'update'), [], 'nem írt');
      has(alerts.at(-1), 'nem változott semmi');
      ok(K.eval('draft') && kq('#edForm').elements.name.value === 'Minta Tolvaj', 'a piszkozat és az űrlap megmaradt');
      K.Sheet.toAuto = origToAuto;
      // a régi hiba: piszkozat nélkül a Mentés üres lapot írt (név, faj, osztály, skillek elvesztek)
      K.eval('draft = null');
      kclick('[data-act="edSave"]');
      eq(klog.filter(l => l[0] === 'update'), [], 'üres lap nem íródott');
      has(alerts.at(-1), 'nem mentettem');
      eq(K.eval('sheets.get("p1").name'), 'Minta Tolvaj');
      for (const a of ['rowAdd', 'slotsAuto']) { K.eval('draft = null'); kclick(`[data-act="${a}"]`); }
      eq(klog.filter(l => l[0] === 'update'), [], 'a sorhozzáadás és a slot-kitöltés sem ír');
      // régi (gyorsítótárazott) sheet.js: semmi nem íródik
      K.eval('sheetStale = true');
      K.patch({hp: {max: 24, cur: 3, temp: 0}});
      eq(klog.filter(l => l[0] === 'update'), [], 'régi sheet.js mellett nem ír');
      has(alerts.at(-1), 'Ctrl + F5');
    } finally { K.alert = origAlert; K.Sheet.toAuto = origToAuto; K.eval('sheetStale = false'); }
  });
  ktest('Alapadatok Mentés: visszajelzés (Elmentve / nem volt változás), csak a változott mező íródik; motoros lapon nyelvválasztás legördülővel', () => {
    openSheet();
    kclick('[data-tab="adat"]');
    kq('#edForm').elements.alignment.value = 'chaotic neutral'; kclick('[data-act="edSave"]');
    ok(!kq('#toast').hidden, 'látszik'); has(kq('#toast').textContent, 'Elmentve');
    eq(Object.keys(lastUpdate()).sort(), ['alignment', 'updatedAt', 'updatedBy'], 'csak a változott mező');
    const n = klog.length;
    kclick('[data-act="edSave"]');
    has(kq('#toast').textContent, 'Nem volt változás'); ok(kq('#toast').classList.contains('info'));
    eq(klog.length, n, 'változás nélkül nem ír');
    const rb = rb3(); rb.backgrounds = [{n: 'Acolyte', s: 'PHB', fx: [{langChoose: {n: 2}}]}];
    K.KApp.setRulebook({version: 'v1', rb});
    openSheet({auto: true, build: {race: 'Dwarf|PHB', subrace: 'Hill|PHB', background: 'Acolyte|PHB', levels: lv('Fighter', 1)}});
    kclick('[data-tab="adat"]');
    const sels = () => kqa('select[data-ch="bg:lang"]');
    eq(sels().length, 2, 'két nyelv választható');
    ok([...sels()[0].options].find(o => o.value === 'Dwarvish').disabled, 'a már ismert nyelv nem választható');
    kset(sels()[0], 'Elvish'); eq(lastUpdate().build.ch['bg:lang'], ['Elvish']);
    ok([...sels()[1].options].find(o => o.value === 'Elvish').disabled, 'a másik helyen már nem választható');
    kq('#edForm').elements.name.value = 'Új név'; kclick('[data-act="edSave"]'); has(kq('#toast').textContent, 'Elmentve');
  });
  ktest('Átállítás gomb kézi lapon; ✋ teendő kipipálása; befecskendezett választás-érték nem fut le', () => {
    K.KApp.setRulebook({version: 'v1', rb: rb3()});
    openSheet({race: 'Hill Dwarf', classes: [{name: 'Fighter', subclass: 'Champion', level: 3}], abilities: {str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8},
      saveProf: ['str', 'con'], skillProf: {athletics: 1}, hp: {max: 40, cur: 30, temp: 0}, ac: 18, speed: '25 ft.', attacks: [], resources: [], features: []});
    kclick('[data-tab="adat"]'); kclick('[data-act="toAuto"]');
    const s = K.eval('sheets.get("p1")');
    eq([s.auto, s.ac, s.hp.max, s.hp.cur, s.ov.ac, s.ov.hpMax, s.build.sub], [true, 18, 40, 30, 18, 40, {Fighter: 'Champion|PHB'}]);
    has(ktext(), 'Felépítés'); ok(kqa('.warn').some(e => e.textContent === '✎'), 'a felülírt értékek jelölve');
    // ✋ teendő (Ranger: Favored Enemy)
    openSheet({auto: true, build: {levels: lv('Ranger', 1)}, attacks: [], resources: [], features: []});
    kclick('[data-act="todoGo"]');
    const box = kqa('[data-act="todoDone"]')[0]; ok(box, 'kipipálható teendő');
    kset(box, true); eq(lastUpdate().todoDone, [box.dataset.key]);
    has(ktext(), 'Kipipáltak visszaállítása (1)'); kclick('[data-act="todoReset"]'); eq(lastUpdate().todoDone, []);
    // befecskendezett érték a választásban
    K.__xss = 0;
    openSheet({auto: true, build: {levels: lv('Fighter', 1), ch: {'Fighter:opt:Fighting Style': [XSS]}}, name: XSS});
    kclick('[data-tab="adat"]');
    eq(K.document.querySelectorAll('main [onmouseover], main img[src="x"]').length, 0); ok(!K.__xss, 'lefutott a kód');
  });
  ktest('alapadatok: osztály, alosztály, faj legördülőből; választáskor hit die, mentők, jártasságok, slotok magától', () => {
    K.KApp.setRulebook({version: 'v1', rb: rb3()});
    openSheet();
    kclick('[data-tab="adat"]');
    const fm = () => kq('#edForm'), opts = n => [...fm().elements[n].options].map(o => o.textContent);
    eq(fm().elements.cl_name_0.tagName, 'SELECT');
    ok(opts('cl_name_0').includes('Fighter') && opts('cl_name_0').includes('Rogue (saját)'), opts('cl_name_0').join());
    eq(opts('race').slice(0, 2), ['(válassz fajt)', 'Lightfoot Halfling (saját)'], 'a régi, listában nem szereplő faj megmarad');
    ok(['Dwarf (Hill)', 'Human', 'Human (Variant)'].every(x => opts('race').includes(x)), opts('race').join());
    kset(fm().elements.cl_name_0, 'Fighter');
    eq([fm().elements.cl_hd_0.value, H_sv(fm()), fm().elements.pf_armor.value], ['10', ['str', 'con'], 'light armor, medium, heavy, shields'], 'a meglévő „light armor” nem duplázódik');
    eq(opts('cl_sub_0'), ['(nincs alosztály)', 'Champion'], 'az alosztály a választott osztályé');
    kset(fm().elements.race, 'Dwarf (Hill)');
    has(fm().elements.pf_languages.value, 'Dwarvish'); has(fm().elements.pf_languages.value, "Thieves' Cant", 'a meglévő megmarad');
    kset(fm().elements.cl_name_0, 'Cleric'); kset(fm().elements.cl_lvl_0, '3');
    eq([fm().elements.slot_0.value, fm().elements.slot_1.value, fm().elements.cl_hd_0.value, H_sv(fm())], ['4', '2', '8', ['wis', 'cha']]);
    kset(fm().elements.cl_sub_0, 'Life Domain');
    kclick('[data-act="edSave"]');
    const u = lastUpdate();
    eq([u.race, u.classes[0], u.saveProf, u.spellcasting.ability], ['Dwarf (Hill)', {name: 'Cleric', subclass: 'Life Domain', level: 3, hitDie: 8}, ['wis', 'cha'], 'wis']);
    eq(K.Sheet.findRace('Hill Dwarf', rb3())?.label, 'Dwarf (Hill)', 'a régi „Hill Dwarf” név is felismerhető');
  });
  ktest('cast: a spell szintjén vagy magasabb szabad slotból (upcast), Pact slotból, rituáléként; elfogyott slotnál szól', () => {
    const rb = rb3(); rb.spells[0].tx = 'Bless. At Higher Levels. One more creature.'; rb.spells[0].ri = true;
    K.KApp.setRulebook({version: 'v1', rb});
    openSheet({spells: [{name: 'Bless', level: 1, prepared: true, ref: 'Bless|PHB'}, {name: 'Spiritual Weapon', level: 2, prepared: true}, {name: 'Light', level: 0}],
      spellcasting: {ability: 'wis', slots: [2, 1, 0, 0, 0, 0, 0, 0, 0], used: [1, 0], pact: {level: 2, max: 1, used: 0}}});
    kclick('[data-tab="var"]');
    eq(kqa('[data-act="castOpen"]').length, 2, 'cantripnél nincs Cast');
    kclick('[data-act="castOpen"][data-i="0"]');
    eq(kqa('[data-act="cast"]').map(b => b.textContent), ['1. szint (1 szabad)', '2. szint (1 szabad) ⬆ erősebb', 'Pact slot (2. szint, 1 szabad)', 'Rituáléként (+10 perc, nincs slot)']);
    kclick('[data-act="cast"][data-how="2"]');
    eq(lastUpdate().spellcasting.used.slice(0, 2), [1, 1], 'a 2. szintű slot fogyott');
    has(kq('#lastRoll').textContent, 'upcast');
    ok(!kq('[data-act="cast"]'), 'a választó bezárult');
    kclick('[data-act="castOpen"][data-i="1"]');
    eq(kqa('[data-act="cast"]').map(b => b.dataset.how), ['pact']);
    kclick('[data-act="cast"][data-how="pact"]');
    eq(lastUpdate().spellcasting.pact.used, 1);
    kclick('[data-act="castOpen"][data-i="1"]');
    has(ktext(), 'Nincs szabad slot');
    const n = klog.length; kclick('[data-act="castOpen"][data-i="0"]'); kclick('[data-act="cast"][data-how="ritual"]');
    eq(klog.length, n, 'rituáléként nem fogy slot');
  });
  ktest('felszerelés a kézi lapon: a felszerelt fegyver támadás lesz a Harc fülön, a pajzs növeli az AC-t; levéve visszaáll', () => {
    K.KApp.setRulebook({version: 'v1', rb: rb3()});
    openSheet({classes: [{name: 'Fighter', level: 3}], abilities: {str: 16, dex: 14, con: 12}, ac: 13, acNote: 'leather armor',
      inventory: [{name: 'Leather Armor', qty: 1, equipped: true}, {name: 'Shield', qty: 1}, {name: 'Longsword', qty: 1}],
      attacks: [{name: 'Saját ütés', hit: '+1', dmg: '1d4'}, {name: 'Longsword', hit: '+9', dmg: 'régi'}]});
    kclick('[data-tab="fel"]');
    kset(kq('[data-act="equip"][data-i="2"]'), true);
    let u = lastUpdate();
    eq(u.attacks.map(a => [a.name, a.hit, a.dmg, !!a.auto]), [['Longsword', '+5', '1d8+3 slashing', true], ['Saját ütés', '+1', '1d4', false]]);
    ok(!('ac' in u), 'a kard nem változtat AC-t');
    kset(kq('[data-act="equip"][data-i="1"]'), true);
    eq([lastUpdate().ac, lastUpdate().acNote], [15, 'Leather Armor, Shield']);
    kclick('[data-tab="harc"]'); has(ktext(), 'Longsword');
    kclick('[data-tab="fel"]');
    kset(kq('[data-act="equip"][data-i="2"]'), false); kset(kq('[data-act="equip"][data-i="1"]'), false);
    eq([lastUpdate().ac, K.eval('sheets.get("p1").attacks').map(a => a.name)], [13, ['Saját ütés']]);
  });
  ktest('szabálymotoros lap: a Felépítésben váltott faj és a DM által adott szint a felépítésbe kerül, a motor újraszámol', () => {
    K.KApp.setRulebook({version: 'v1', rb: rb3()});
    openSheet({auto: true, build: {race: 'Dwarf|PHB', subrace: 'Hill|PHB', base: {str: 16, dex: 14, con: 14}, levels: [{c: 'Barbarian', hp: null}, {c: 'Barbarian', hp: 9}]}}, 'dm@x.hu', true);
    kclick('[data-tab="adat"]');
    kclick('[data-act="lvAdd"]');
    const sel = kq('[data-act="bRace"]'); kset(sel, [...sel.options].find(o => o.textContent === 'Human').value);
    const s = K.eval('sheets.get("p1")');
    eq([s.build.levels, s.build.race, s.build.subrace, s.classes[0].level, s.abilities.con, s.ov], [[{c: 'Barbarian', hp: null}, {c: 'Barbarian', hp: 9}, {c: 'Barbarian', hp: null}], 'Human|PHB', 'Human (alap)|PHB', 3, 15, {}]);
  });
  // gomb a lapra téve és megnyomva (pl. featAdd egy keresési találatból)
  const kact = data => { const b = K.document.createElement('button'); Object.assign(b.dataset, data); kq('#main').appendChild(b); kclick(b); };
  const rbFx = () => { const rb = rb3(); rb.spells.push({n: 'Shield of Faith', s: 'PHB', l: 1, k: true}); rb.spells[0].k = true;
    rb.feats.push({n: 'Heavy Armor Master', s: 'PHB', fx: [{ab: {str: 1}}]}, {n: 'Resilient', s: 'PHB', fx: [{abChoose: {from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], n: 1, amt: 1}}]}); return rb; };
  ktest('koncentráció: jól látható sáv; másik koncentrációs spellnél rákérdez a régi nevével; Mégse = nem castol; 0 HP-n vége', () => {
    K.KApp.setRulebook({version: 'v1', rb: rbFx()});
    openSheet({spells: [{name: 'Bless', level: 1, prepared: true}, {name: 'Shield of Faith', level: 1, prepared: true}], inventory: [],
      spellcasting: {ability: 'wis', slots: [4, 0, 0, 0, 0, 0, 0, 0, 0]}});
    let asked = []; K.confirm = m => { asked.push(m); return true; };
    kclick('[data-tab="var"]'); kclick('[data-act="castOpen"][data-i="0"]'); kclick('[data-act="cast"][data-how="1"]');
    let s = K.eval('sheets.get("p1")');
    eq([s.concentration, s.conditions, s.spellcasting.used[0]], ['Bless', ['Bless'], 1]);
    has(kq('.concbar').textContent, 'Bless'); has(kq('.fxbar').textContent, 'Bless');
    asked = []; K.confirm = m => { asked.push(m); return !/koncentrálsz/.test(m); };
    kclick('[data-act="castOpen"][data-i="1"]'); kclick('[data-act="cast"][data-how="1"]');
    has(asked[0], 'Most erre koncentrálsz: Bless'); has(asked[0], 'Shield of Faith');
    eq([K.eval('sheets.get("p1").concentration'), K.eval('sheets.get("p1").spellcasting.used[0]')], ['Bless', 1], 'Mégse: marad, slot sem fogy');
    K.confirm = () => true;
    kclick('[data-act="castOpen"][data-i="1"]'); kclick('[data-act="cast"][data-how="1"]');
    s = K.eval('sheets.get("p1")');
    eq([s.concentration, s.conditions, s.spellcasting.used[0]], ['Shield of Faith', ['Shield of Faith'], 2], 'a Bless hatása lekerült');
    kclick('[data-tab="adat"]'); eq(kq('.chips .chip b').textContent, '16', 'AC 14 + 2');
    kclick('[data-tab="harc"]');
    kset('#hpIn', '6', 'input'); kclick('[data-act="hpDmg"]');
    has(kq('#lastRoll').textContent, 'DC 10');
    kset('#hpIn', '50', 'input'); kclick('[data-act="hpDmg"]');
    s = K.eval('sheets.get("p1")');
    eq([s.hp.cur, s.concentration, s.conditions], [0, '', []]); ok(!kq('.concbar'), 'a sáv eltűnt');
  });
  ktest('aktív hatások és állapotok: Mage Armor AC, Rage (erőforrás, sebzés), Poisoned hátrány; a DM kikapcsolhatja', () => {
    K.KApp.setRulebook({version: 'v1', rb: rbFx()});
    openSheet({inventory: [{name: 'Shortsword', qty: 1, equipped: true}], ac: 13, resources: [{name: 'Rage', max: 2, used: 0, reset: 'long'}]}, 'dm@x.hu', true);
    kset('#condAdd', 'Mage Armor');
    eq(klog.filter(l => l[0] === 'pub').at(-1)[2].ac, 16, 'a csapat felé is 13 + DEX 3');
    kclick('[data-tab="adat"]'); eq(kq('.chips .chip b').textContent, '16'); has(kq('.chips .chip small').textContent, '✨');
    kclick('[data-tab="harc"]');
    kset('#condAdd', 'Rage');
    eq(K.eval('sheets.get("p1").resources[0].used'), 1, 'a Rage elhasznált egyet');
    K.rnd = () => 3;
    kclick(kqa('[data-act="dmg"]').find(b => /Shortsword/.test(b.dataset.label)));
    has(kq('#lastRoll').textContent, 'Rage'); eq(kq('#lastRoll b').textContent, '8', '1d6 (3) + 3 + Rage 2');
    kset('#condAdd', 'Poisoned');
    kclick('[data-tab="kep"]'); kclick(kqa('.rb').find(b => b.dataset.label === 'Stealth'));
    has(kq('#lastRoll').textContent, 'hátrány: Poisoned');
    kclick(kq('[data-label="Strength mentő"]'));
    has(kq('#lastRoll').textContent, 'előny: Rage');
    kclick('[data-tab="harc"]');
    kclick('[data-act="effToggle"][data-key="Poisoned"]');
    eq(K.eval('sheets.get("p1").effOff'), ['Poisoned']);
    has(ktext(), 'automatikus hatás kikapcsolva');
    kclick('[data-tab="kep"]'); kclick(kqa('.rb').find(b => b.dataset.label === 'Stealth'));
    hasNot(kq('#lastRoll').textContent, 'hátrány');
    kclick('[data-tab="harc"]'); kset('#condAdd', 'Paralyzed');
    kclick('[data-tab="kep"]'); kclick(kq('[data-label="Dexterity mentő"]'));
    has(kq('#lastRoll').textContent, 'automatikus kudarc (Paralyzed)');
  });
  ktest('kézi lap: fajváltáskor a faji bónusz átíródik; a feat bónusza hozzáadódik, a választhatót a játékos választja (Resilient: mentő is)', () => {
    K.KApp.setRulebook({version: 'v1', rb: rbFx()});
    openSheet({race: 'Dwarf (Hill)', abilities: {str: 8, dex: 14, con: 14, int: 10, wis: 11, cha: 10}});
    kclick('[data-tab="adat"]');
    kset(kq('#edForm').elements.race, 'Human');
    const ab = () => ['str', 'con', 'wis'].map(a => kq('#edForm').elements['ab_' + a].value);
    eq(ab(), ['9', '13', '11'], 'Hill Dwarf (CON +2, WIS +1) le, Human (+1 mind) fel');
    kset(kq('#edForm').elements.race, 'Human (Variant)');
    eq(ab(), ['8', '12', '10']); has(kq('#raceNote').textContent, '2× +1');
    kclick('[data-act="edCancel"]');
    kclick('[data-tab="kep"]');
    kact({act: 'featAdd', ref: 'Heavy Armor Master|PHB'});
    eq(lastUpdate().abilities.str, 9);
    kact({act: 'featAdd', ref: 'Resilient|PHB'});
    ok(kq('#featPickBox'), 'választó');
    kclick('[data-act="featPick"][data-a="wis"]');
    eq([lastUpdate().abilities.wis, lastUpdate().saveProf], [12, ['dex', 'int', 'wis']]);
    ok(!kq('#featPickBox'), 'a választó bezárult');
  });
  ktest('gépelés közben a beérkező változás nem rajzolja újra a lapot (a fókusz elvesztésekor igen)', async () => {
    openSheet();
    const inp = kq('#hpIn'); inp.focus(); inp.value = '7';
    if (K.document.activeElement !== inp) return;  // láthatatlan böngészőben a fókusz nem mindig működik
    K.KApp.setSheets([{...sheetDoc({hp: {max: 24, cur: 10, temp: 0}}), id: 'p1'}]);
    eq(kq('#hpIn').value, '7'); hasNot(kq('.hpnum').textContent, '10');
    inp.blur(); await wait(50);
    has(kq('.hpnum').textContent, '10');
  });
  ktest('halálmentő pöttyök, Pact slot, állapot eltávolítása (a koncentrációé a koncentrációt is megszünteti), koncentráció megszakítása', () => {
    openSheet({hp: {max: 24, cur: 0, temp: 0}});
    kclick('[data-act="ds"][data-kind="fail"][data-i="1"]'); eq(lastUpdate().deathSaves, {ok: 0, fail: 2});
    kclick('[data-act="ds"][data-kind="ok"][data-i="0"]'); eq(lastUpdate().deathSaves, {ok: 1, fail: 2});
    // 0 HP-n a koncentráció magától megszakad, ezért az állapotokat élő karakteren nézzük
    openSheet({conditions: ['Prone', 'Bless'], concentration: 'Bless', spellcasting: {ability: 'cha', slots: [], used: [], pact: {level: 2, max: 2, used: 0}}});
    kclick(kqa('[data-act="condRm"]')[0]); eq(lastUpdate().conditions, ['Bless']); ok(!('concentration' in lastUpdate()), 'a koncentráció marad');
    kclick('[data-act="condRm"]'); eq([lastUpdate().conditions, lastUpdate().concentration], [[], '']);
    kclick('[data-tab="var"]'); kclick('[data-act="pact"][data-j="1"]'); eq(lastUpdate().spellcasting.pact.used, 2);
    openSheet({concentration: 'Haste', conditions: ['Haste', 'Prone']});
    kclick('[data-act="concEnd"]'); eq([lastUpdate().concentration, lastUpdate().conditions], ['', ['Prone']]);
  });
  ktest('eltávolítás megerősítéssel (Mégse = marad): varázslat, tárgy, jellemző; saját jellemző felvétele', () => {
    openSheet({spells: [{name: 'Shield', level: 1}], inventory: [{name: 'Kötél'}], features: [{name: 'Sneak Attack'}]});
    const wrote = k => klog.some(l => l[0] === 'update' && k in l[2]);
    kclick('[data-tab="var"]');
    K.confirm = () => false; kclick('[data-act="spellRm"]'); ok(!wrote('spells'), 'Mégse');
    K.confirm = () => true; kclick('[data-act="spellRm"]'); eq(lastUpdate().spells, []);
    kclick('[data-tab="fel"]'); kclick('[data-act="itemRm"]'); eq(lastUpdate().inventory, []);
    kclick('[data-tab="kep"]');
    kset('#featNew', 'Szerencsés', 'input'); kset('#featNewT', 'újradobhat', 'input'); kset('#featNewS', 'Halfling', 'input');
    kclick('[data-act="featCustom"]');
    eq(lastUpdate().features.map(f => [f.name, f.text, f.src]), [['Sneak Attack', '', ''], ['Szerencsés', 'újradobhat', 'Halfling']]);
    kclick(kqa('[data-act="featRm"]')[0]); eq(lastUpdate().features.map(f => f.name), ['Szerencsés']);
  });
  ktest('feat keresése a szabálykönyvben: feltétel, „megvan” jelölés, nincs találat; a választó kihagyható', async () => {
    K.KApp.setRulebook({version: 'v1', rb: await fakeRb()});
    openSheet({features: [{name: 'Alert'}]});
    kclick('[data-tab="kep"]');
    kset('#featQ', 'aler', 'input'); has(kq('#featRes').textContent, '✓ megvan');
    kset('#featQ', 'zzzz', 'input'); has(kq('#featRes').textContent, 'Nincs találat');
    kset('#featQ', 'grap', 'input'); has(kq('#featRes').textContent, 'feltétel: STR 13');
    kset('#featQ', 'elven', 'input'); kclick('#featRes [data-act="featAdd"]');
    eq(lastUpdate().features.map(f => f.name), ['Alert', 'Elven Accuracy']);
    ok(kq('#featPickBox'), 'választó'); kclick('[data-act="featPickSkip"]'); ok(!kq('#featPickBox'), 'kihagyva');
  });
  ktest('hangolás: a 4. tárgynál rákérdez (Mégse = nem hangol); jegyzet gépelés közben is mentődik; Enter a HP-mezőben', async () => {
    openSheet({inventory: ['A', 'B', 'C', 'D'].map((name, i) => ({name, attuned: i < 3}))});
    kclick('[data-tab="fel"]');
    const free = () => kqa('[data-act="attune"]').find(x => !x.checked);
    K.confirm = () => false; const box = free(); kset(box, true); ok(!box.checked, 'Mégse');
    K.confirm = () => true; kset(free(), true); eq(lastUpdate().inventory.filter(i => i.attuned).length, 4);
    kclick('[data-tab="jegyz"]'); kset('#notes', 'Nyom a kútnál', 'input');
    await until(() => klog.some(l => l[0] === 'update' && l[2].notes === 'Nyom a kútnál'), 3000, 'jegyzet mentése');
    kclick('[data-tab="harc"]');
    const hp = kq('#hpIn'), enter = () => hp.dispatchEvent(new K.KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    hp.value = '5'; enter(); eq(lastUpdate().hp.cur, 19);
    kq('#hpIn').value = '-3'; kq('#hpIn').dispatchEvent(new K.KeyboardEvent('keydown', {key: 'Enter', bubbles: true})); eq(lastUpdate().hp.cur, 22);
  });
  ktest('lista: a karakterek név szerint (magyar ábécé); űrlapsor törlése; a kockadobás 1..N között egyenletes', () => {
    K.KApp.setAuth({status: 'signedIn', email: 'a@x.hu'});
    K.KApp.setChars(['Zoli', 'Ádám', 'Bori'].map((name, i) => ({id: 'c' + i, kind: 'pc', owner: 'b@x.hu', visibility: 'party', name, hp: {cur: 1, max: 1}})));
    const t = ktext(); ok(t.indexOf('Ádám') < t.indexOf('Bori') && t.indexOf('Bori') < t.indexOf('Zoli'), 'sorrend: ' + t.slice(0, 200));
    openSheet();
    kclick('[data-tab="adat"]');
    const rows = () => kqa('#edForm [name^="at_name_"]').length, n = rows();
    kclick('[data-act="rowRm"][data-list="attacks"]'); eq(rows(), n - 1);
    const seen = new Set();
    for (let i = 0; i < 2000; i++) { const v = ORIGK.rnd(6); ok(v >= 1 && v <= 6 && Number.isInteger(v), 'érvénytelen: ' + v); seen.add(v); }
    eq(seen.size, 6);
  });
});

// ======================================================================
describe('Szerződés (szerzodes.js)', () => {
  test('rétegek: csak a js/adat/tar.js hívja az adatbázist; a logika nem nyúl a DOM-hoz, a felület nem hívja a Tar-t (docs/dontesek/0006)', async () => {
    const szoveg = async f => (await fetch('../' + f, {cache: 'no-store'})).text();
    const html = await szoveg('index.html');
    // csak a sima <script> blokkok: a Firebase-modul (type="module") maga a port-illesztő, az szándékosan kimarad (docs/dontesek/0001)
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
    const fajlok = [...html.matchAll(/<script src="(js\/[\w\/-]+\.js)\?v=\d+"><\/script>/g)].map(m => m[1]);
    const logika = fajlok.filter(f => f.startsWith('js/logika/')), felulet = fajlok.filter(f => f.startsWith('js/felulet/'));
    ok(fajlok.includes('js/adat/tar.js') && logika.length >= 10 && felulet.length >= 3, 'megtalálta a fájlokat: ' + fajlok.join(', '));
    eq(fajlok.length, [...html.matchAll(/<script[^>]*src="js\//g)].length, 'minden js/ fájl a megszokott alakban töltődik (<script src="js/….js?v=N">)');
    const talal = (kod, re) => [...kod.matchAll(re)].map(m => m[0]);
    const DB_RE = /\b(DB|UT|db)\??\.\w+/g, TAR_RE = /\b(Tar|DB|UT|db)\??\.\w+/g,
      DOM_RE = /\bdocument\.|(?<![\\\w$])\$\$?\(|\.(innerHTML|outerHTML|classList)\b|querySelector|getElements?By|insertAdjacentHTML|createElement/g;
    eq(talal(inline, DB_RE), [], 'index.html: közvetlen adatbázis- vagy útvonal-hívás');
    for (const f of fajlok.filter(f => f !== 'js/adat/tar.js')) {
      const kod = await szoveg(f);
      eq(talal(kod, DB_RE), [], f + ': közvetlen adatbázis- vagy útvonal-hívás');
      if (logika.includes(f)) eq(talal(kod, DOM_RE), [], f + ': a logika nem nyúl a DOM-hoz');
      if (felulet.includes(f)) eq(talal(kod, TAR_RE), [], f + ': a felület nem hívja a Tar-t');
    }
    has(await szoveg('js/adat/tar.js'), 'db.set(', 'a Tar ír');
    // a logika nem hívja a felület függvényeit, csak az Ertesito-n át szól (kivétel a 6. lépésig: az importSheet kérdése)
    const nevek = new Set(['confirm', 'alert', 'prompt']);
    for (const f of felulet) for (const m of (await szoveg(f)).matchAll(/^(?:async )?function (\w+)|^const (\w+) = /gm)) nevek.add(m[1] || m[2]);
    ok(nevek.has('render') && nevek.has('log') && nevek.has('setSaveState') && nevek.has('closeModal'), 'megtalálta a felület neveit');
    const HIVAS_RE = new RegExp(`(?<![\\w.$])(${[...nevek].join('|')})\\(`, 'g');
    for (const f of logika) {
      const kod = (await szoveg(f)).replace(/^\s*\/\/.*$/gm, '');
      eq(talal(kod, HIVAS_RE), f === 'js/logika/lapszinkron.js' ? ['confirm('] : [], f + ': a logika nem hívja a felületet');
    }
  });
  test('Értesítő: a logika üzenetei eljutnak a felületre (napló, mentésjelző, telefonos lap változása)', () => {
    A(`Ertesito.naplo('üzenet', 'warn')`);
    eq([lastLog(), A('logLines[0].cls')], ['üzenet', 'warn']);
    A(`Ertesito.mentesAllapot('próba')`); eq($('#saveState').textContent, 'próba');
    add(mk()); W.openLib('lib');
    A(`S.library.push(normCreature({name: 'Friss'})); S.enc.list[0].hp = 3; Ertesito.lapokValtoztak()`);
    has($('#libRows').textContent, 'Friss', 'a Könyvtár lista frissül');
    has($('.tile .hpbar').textContent, '3 / ', 'a csempe frissül');
  });
  test('rétegek: az index.html-ben csak a várt változatok (VART_MODULOK) maradtak, a kód a js/ fájlokban; az indulas.js töltődik utoljára', async () => {
    const html = await (await fetch('../index.html', {cache: 'no-store'})).text();
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1].replace(/^\s*\/\/.*$/gm, '').trim());
    eq(inline.length, 1, 'egy sima <script> blokk');
    ok(/^const VART_MODULOK = \{[^}]*\};$/.test(inline[0]), 'csak a VART_MODULOK: ' + inline[0].slice(0, 80));
    ok(html.indexOf('const VART_MODULOK') < html.indexOf('<script src="kozos.js'), 'a VART_MODULOK a fájlok előtt áll');
    const srcek = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => s !== 'firebase-config.js');
    ok(srcek.at(-1).startsWith('js/indulas.js?'), 'az utolsó: ' + srcek.at(-1));
  });
  test('gombok: minden data-act-hoz van AKCIOK-bejegyzés és viszont; mind szó szerinti név (docs/dontesek/0006)', async () => {
    const szoveg = async f => (await fetch('../' + f, {cache: 'no-store'})).text();
    const html = await szoveg('index.html');
    const fajlok = [...html.matchAll(/<script src="(js\/[\w\/-]+\.js)\?v=\d+"><\/script>/g)].map(m => m[1]);
    const kod = [html, ...await Promise.all(fajlok.map(szoveg))].join('\n').replace(/^\s*\/\/.*$/gm, '');
    eq([...kod.matchAll(/data-act=(?!"\w+")[^\s>]*/g)].map(m => m[0]), [], 'összerakott data-act');
    const gombok = [...new Set([...kod.matchAll(/data-act="(\w+)"/g)].map(m => m[1]))].sort();
    ok(gombok.length >= 70, 'megtalálta a gombokat: ' + gombok.length);
    eq(gombok, A('Object.keys(AKCIOK)').sort());
  });
  test('kattintás: a dobás megelőzi a körülötte lévő gombot; ismeretlen data-act nem csinál semmit; Shift/Ctrl közös segéd', () => {
    W.addToEncounter(mk());
    W.renderGate('<button data-act="next"><span class="roll" data-roll="1d6" data-label="Próba">1d6</span></button><button id="ism" data-act="constructor">x</button>');
    stubRnd(4); click('#gate .roll');
    eq(A('S.enc.active'), null, 'a gomb nem futott le'); has(lastLog(), 'Próba');
    click('#ism'); eq(A('S.enc.active'), null);
    W.renderGate(null);
    eq(['shiftKey', 'ctrlKey', 'x'].map(k => A(`dobasMod({${k}: true})`)), ['adv', 'dis', '']);
  });
  test('kattintás: a fejléc és a kereső gombjai (ablakok, Initiative tracker, belépés)', async () => {
    const eredeti = {open: W.open, fiveSearch: W.fiveSearch, DMAuth: W.DMAuth}, hivas = [];
    try {
      W.open = (...a) => { hivas.push(a[0]); return null; };
      W.fiveSearch = () => { hivas.push('keres'); };
      W.DMAuth = {signIn: () => hivas.push('be'), signOut: () => hivas.push('ki')};
      has($('[data-act="openPlayer"]').textContent, 'Initiative tracker', 'a gomb felirata'); has(P.document.title, 'Initiative tracker', 'az ablak címe');
      click('[data-act="openPlayer"]'); click('[data-act="openCharApp"]');
      eq(hivas, ['player.html', 'karakter.html']);
      A('fiveIndex = {}'); W.openLib('five'); click('[data-act="fiveSearch"]');
      W.renderGate('<button data-act="signIn">x</button><button data-act="signOut">y</button>');
      click('#gate [data-act="signIn"]'); click('#gate [data-act="signOut"]'); W.renderGate(null);
      eq(hivas.slice(2), ['keres', 'be', 'ki']);
      eq($('#modal').hidden, true, 'a kilépés bezárja az ablakot');
      click('[data-act="openLib"]'); ok($('#libRoot'), 'könyvtár');
      W.closeModal(); click('[data-act="menu"]'); has($('#modalBox').textContent, 'Exportálás');
      W.closeModal(); click('[data-act="openLoot"]'); ok(!$('#modal').hidden, 'zsákmány');
      W.closeModal(); click('[data-act="openParty"]'); ok(!$('#modal').hidden, 'Csapat nézet');
    } finally { Object.assign(W, eredeti); W.closeModal(); }
  });
  test('a felület segédei a Tar helyett: felhoben() és szabalyMeta()', async () => {
    try {
      A('Tar.kapcsol(null)');
      eq([A('felhoben()'), await W.szabalyMeta()], [false, null], 'felhő nélkül');
      const f = makeFakeDb(); W.__fdb = f.db; A('Tar.kapcsol(window.__fdb)');
      eq(A('felhoben()'), true, 'belépve');
      await W.Tar.szabalyok.metaIr({version: 'v1', chunks: []});
      eq((await W.szabalyMeta())?.version, 'v1', 'a felhőben lévő meta');
    } finally { A('Tar.kapcsol(null)'); delete W.__fdb; }
  });
  test('minden felhős írás átmegy a szerződés tisztítóján (mentés, lap, nyilvános rész, napi mentés)', async () => {
    const {normCreature, sanitizeState, normPublicChar} = W.Szerzodes, sj = W.stableJson, hibak = [], irt = new Set();
    const idoNelkul = d => { const o = structuredClone(d); delete o.updatedAt; delete o.updatedBy; return o; };
    // a két érték eltérő mezőinek útvonala (a hibaüzenethez)
    const elter = (a, b, ut = '') => sj(a) === sj(b) ? [] : a && b && typeof a === 'object' && typeof b === 'object'
      ? [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => elter(a[k], b[k], ut + '.' + k)) : [ut];
    const ellenoriz = (p, d) => {
      const [col, id] = p.split('/'); irt.add(col);
      const [ki, be] = p === 'dmscreen/state' ? [(({enc, settings}) => ({enc, settings}))(sanitizeState(d, d.settings)), d]
        : p === 'dmscreen/backups' ? [Array.isArray(d.items), true]
        : col === 'dmscreen_backup' ? (o => [sanitizeState(o, o.settings).library, o.library])(JSON.parse(d.data))
        : col === 'dmscreen_library' ? [{...normCreature(d), id}, d]
        : col === 'dmscreen_saved' ? [sanitizeState({saved: [d]}).saved[0], d]
        : col === 'characters' ? [{...normPublicChar(d), id}, d]
        : p === 'access/players' ? [{emails: [...new Set(d.emails)].sort()}, d]
        : col === 'sheets' ? [idoNelkul(W.Sheet.norm(d)), idoNelkul(d)]
        : ['ismeretlen útvonal', p];
      const e = elter(ki, be);
      if (e.length) hibak.push(p + ' ' + e.join(', '));
    };
    // a lap a sablonból, de tisztítva (a sablon _leiras mezőjét a Sheet.norm elhagyja – az nem a DM Screen írása)
    const f = makeFakeDb({...emptyState(), 'dmscreen_library/p1': pc('Rella', 1, {id: 'p1', owner: 'a@x.hu'}), 'sheets/p1': W.Sheet.norm(sheetDoc())});
    const {set, update} = f.db;
    f.db.set = async (p, d) => { ellenoriz(p, d); return set(p, d); };
    f.db.update = async (p, d) => { await update(p, d); ellenoriz(p, f.store[p]); };
    try {
      await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await wait(500);
      A(`S.library.push(normCreature(${JSON.stringify(mk('Goblin', {id: 'g1'}))}), normCreature({id: 'n1', name: 'Őr', kind: 'npc', hp: {max: 20, cur: 8}, share: {vis: 'party', hp: 'label'}}))`);
      A(`S.saved.push({id: 's1', name: 'Les', list: [S.library[1]]})`);
      const [x] = W.addToEncounter(A('S.library[0]'), 1); W.addToEncounter(A('S.library[1]'), 2);
      W.damage(x, 4); W.save(); await wait(500);
      await W.addBackup('2026-10-29', 'teszt');
    } finally { f.db.set = set; f.db.update = update; }
    eq(hibak, [], 'a tisztítón átmenve megváltozna');
    eq([...irt].sort(), ['access', 'characters', 'dmscreen', 'dmscreen_backup', 'dmscreen_library', 'dmscreen_saved', 'sheets'], 'minden fajta írás előfordult');
  });
  test('minden felhős útvonal gyűjteményére van szabály a firestore.rules-ban', async () => {
    const rules = await (await fetch('../firestore.rules', {cache: 'no-store'})).text(), UT = W.Szerzodes.UT;
    const utak = Object.values(UT).map(u => typeof u === 'function' ? u('x') : u);
    eq(utak.length, 13, 'az útvonalak száma (új útvonalnál a teszt is bővül)');
    for (const u of utak) {
      const col = u.split('/')[0], doc = u.split('/')[1];
      const van = col.startsWith('dmscreen') ? rules.includes("col.matches('dmscreen.*')")
        : col === 'access' ? rules.includes(`match /access/${doc} `) : rules.includes(`match /${col}/{`);
      ok(van, 'nincs szabály: ' + u);
    }
  });
  test('egy helyen: a sheet.js szabálykönyv-útvonalai, a böngésző-tároló kulcsai és az Initiative tracker csatornája', async () => {
    const {UT, HELYI, CSATORNA} = W.Szerzodes, kert = [];
    await W.Sheet.loadRulebook({get: async p => { kert.push(p); return p === UT.szabalyMeta ? {version: 1, chunks: ['a']} : {data: '{"k":"spells","a":[]}'}; }});
    eq(kert, [UT.szabalyMeta, UT.szabalyDarab('a')]);
    eq(HELYI, {allapot: 'dmscreen', lapok: 'dmscreen-sheets'}, 'a régi kulcsok (a böngészőben tárolt másolat ezeken van)');
    localStorage.removeItem(HELYI.allapot); A('doSave()');
    await until(() => JSON.parse(localStorage.getItem(HELYI.allapot) || 'null')?.settings?.sources, 2000, 'helyi mentés a HELYI.allapot kulcson');
    has(await (await fetch('../player.html', {cache: 'no-store'})).text(), `new BroadcastChannel('${CSATORNA}')`, 'player.html csatornája');
  });
  test('a tisztítók kimenete stabil: még egyszer tisztítva nem változik (lény, harc, állapot, nyilvános karakterrész)', () => {
    const {normCreature, normCombatant, sanitizeState, normPublicChar} = W.Szerzodes;
    const npc = {name: 'Őr', kind: 'npc', ac: 13, hp: {max: 20, cur: 8}, share: {vis: 'party', hp: 'label', ac: false}};
    for (const c of [mk(), pc('Rella', 3, {owner: 'A@X.hu', inventory: [{name: 'Kard', qty: '2'}]}), npc, {kind: 'gonosz', hp: 'x'}]) {
      const egy = normCreature(c); eq(normCreature(egy), egy, 'normCreature: ' + c.name);
    }
    const x = normCombatant({c: mk(), hp: '5', cond: [{name: 'Prone', rounds: '2'}]}); eq(normCombatant(x), x, 'normCombatant');
    const st = sanitizeState({library: [mk()], enc: {list: [x], round: 3, active: x.cid}, settings: {groupInit: false}}, A('S.settings'));
    eq(sanitizeState(st, A('S.settings')), st, 'sanitizeState');
    eq(st.settings.rollHp, A('S.settings.rollHp'), 'a hiányzó beállítás az alapértékből jön');
    try {
      A(`S.library = [${JSON.stringify(pc('Rella', 3, {id: 'p1', owner: 'a@x.hu'}))}, ${JSON.stringify({...npc, id: 'n1'})}].map(normCreature)`);
      const pub = W.publicChars(); eq(pub.length, 2);
      // kulcssorrendtől függetlenül (a Firestore sem őrzi a sorrendet)
      for (const p of pub) eq(W.stableJson(normPublicChar(p)), W.stableJson(p), 'a DM Screen által írt nyilvános rész a karakter.html tisztítóján változatlan: ' + p.name);
      eq(pub.find(p => p.id === 'n1').status, 'bloodied');
    } finally { A('S.library = []'); }
  });
  test('egy helyen: az állapotkódok (Sheet.hpStatus → ALLAPOTOK → a karakter.html címkéi) és az alapbeállítások', () => {
    const {ALLAPOTOK, ALAP_BEALLITASOK, sanitizeState} = W.Szerzodes;
    eq(Object.keys(K.eval('ST')).sort(), [...ALLAPOTOK].sort(), 'a karakter.html minden állapotkódnak ad címkét, és csak azoknak');
    for (const [cur, max] of [[10, 10], [8, 10], [5, 10], [0, 10]]) ok(ALLAPOTOK.includes(W.Sheet.hpStatus(cur, max)), `hpStatus(${cur}, ${max})`);
    eq(W.Szerzodes.normPublicChar({status: 'constructor'}).status, null, 'ismeretlen kód: null');
    eq(sanitizeState({}).settings, {...ALAP_BEALLITASOK, lastExport: '', partyIds: null}, 'alapbeállítás alap nélkül');
    ok(Object.isFrozen(ALAP_BEALLITASOK) && A('S.settings.sources') !== ALAP_BEALLITASOK.sources, 'az alap nem írható át, az app saját másolatot kap');
  });
  test('a karakter.html a szerződés tisztítóját használja; az index.html nem tart saját másolatot', () => {
    ok(K.eval('normChar') === K.Szerzodes.normPublicChar, 'karakter.html: normChar');
    for (const n of ['normCreature', 'normCombatant', 'sanitizeState', 'normInventory', 'blankCreature', 'splitEntry', 'safeId', 'str', 'TEMPLATE', 'SECTIONS'])
      ok(A(n) === W.Szerzodes[n], 'index.html: ' + n);
  });
});

// ======================================================================
describe('Általános', () => {
  test('közös kód: a három oldal a kozos.js $ / esc / rnd függvényét használja', () => {
    const src = w => ['$', 'esc', 'rnd'].map(n => w.eval(n).toString());
    eq(src(P), src(W), 'player.html'); eq(src(K), src(W), 'karakter.html');
    for (const w of [W, P, K]) {
      eq(w.eval(`esc('<a href="x">\\'&')`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
      ok(w.document.querySelector('script[src^="kozos.js"]'), 'kozos.js betöltve');
    }
  });
  test('közös kód: az index.html és a karakter.html a sheet.js segédeit használja, nem saját másolatot', () => {
    for (const n of ['ABIL', 'ABIL_FULL', 'SKILLS', 'skillLabel', 'EMAIL_RE', 'num', 'isObj', 'safeUrl', 'sgn', 'propOf']) ok(A(n) === W.Sheet[n], 'index.html: ' + n);
    for (const n of ['isObj', 'num', 'str', 'mod', 'sgn', 'safeUrl']) ok(K.eval(n) === K.Sheet[n], 'karakter.html: ' + n);
    eq([A(`propOf('finesse|PHB')`), A(`propOf({uid: 'light|PHB'})`), A('propOf(null)')], ['finesse', 'light', '']);
  });
  test('verzióőr: a <script src> ?v= száma = a fájl bejelentett változata = az oldal VART_MODULOK-ja', () => {
    for (const [nev, w] of [['index.html', W], ['karakter.html', K], ['player.html', P]]) {
      const v = {};
      for (const s of w.document.querySelectorAll('script[src*="?v="]')) {
        const m = s.getAttribute('src').match(/^(?:.*\/)?([\w-]+)\.js\?v=(\d+)$/); ok(m, nev + ': ?v= formátum: ' + s.getAttribute('src'));
        v[m[1]] = +m[2];
      }
      ok(Object.keys(v).length, nev + ': van ?v=-s közös fájl');
      const nincsV = [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).filter(s => !s.includes('?v=') && s !== 'firebase-config.js');
      eq(nincsV, [], nev + ': minden közös fájl ?v=-vel töltődik');
      for (const [f, n] of Object.entries(v)) eq(w.eval('MODULOK')[f], n, `${nev}: ${f}.js bejelentett változata`);
      if (w !== P) eq(w.eval('VART_MODULOK'), v, nev + ': VART_MODULOK');
      eq(w.eval('elteroModulok(typeof VART_MODULOK === "undefined" ? {} : VART_MODULOK)'), [], nev + ': nincs eltérés');
    }
    eq(W.Sheet.VERSION, A('MODULOK.sheet'), 'Sheet.VERSION');
  });
  test('verzióőr: régi (gyorsítótárazott) közös fájl mellett a DM Screen nem ír a lapokra, és frissítést kér', () => {
    eq(A(`MODULOK.kozos = 1; elteroModulok({kozos: 2, sheet: MODULOK.sheet, uj: 1})`), ['kozos', 'uj'], 'eltérő és be nem jelentett modul');
    try {
      A('syncSheets.warned = false');
      const ops = []; W.syncSheets(ops);
      eq(ops, [], 'nem írt'); has(lastLog(), 'Ctrl + F5');
      W.syncSheets(ops); eq(A('logLines.filter(l => l.html.includes("Ctrl + F5")).length'), 1, 'csak egyszer szól');
    } finally { A('MODULOK.kozos = VART_MODULOK.kozos; syncSheets.warned = false'); }
    ok(!A('regiFajl()'), 'visszaállítva nem régi');
    // nagyon régi kozos.js (még nincs benne verzióőr): régi fájlnak számít, és nem dob hibát
    const origW = W.elteroModulok, origK = K.elteroModulok;
    try {
      W.elteroModulok = undefined; K.elteroModulok = undefined;
      ok(A('regiFajl()'), 'index.html: verzióőr nélküli kozos.js = régi');
      A('syncSheets.warned = false'); W.syncSheets([]); has(lastLog(), 'Ctrl + F5');
      ok(K.regiFajl(), 'karakter.html: verzióőr nélküli kozos.js = régi');
    } finally { W.elteroModulok = origW; K.elteroModulok = origK; A('syncSheets.warned = false'); }
    try {
      K.eval('MODULOK.sheet = 1');
      ok(K.regiFajl(), 'karakter.html: régi sheet.js felismerve');
    } finally { K.eval('MODULOK.sheet = VART_MODULOK.sheet'); }
    ok(!K.regiFajl(), 'karakter.html: visszaállítva nem régi');
  });
  test('nem volt JavaScript-hiba az app futása közben', () => eq(appErrors, []));
});

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
  // a „const f = ...” segédfüggvények nem window-tulajdonságok, ezért elérhetővé tesszük őket W.f néven
  for (const k of ['normCreature', 'normCombatant', 'splitEntry', 'sideOf', 'mod', 'sgn', 'initBonusOf', 'nameOf', 'byId', 'crXp', 'pcLevel', 'crToPb', 'ordinal', 'is5e', 'isDDB', 'crBand', 'dmgTable', 'coinStr', 'noTreasure', 'skillLabel', 'passiveScore', 'partyMembers', 'coinsGp', 'hpStatus', 'playerEmails', 'stableJson', 'sharingDirty']) W[k] = A(k);
  for (const t of TESTS) {
    if (t.online && !ONLINE) { skip++; continue; }
    try {
      fresh();
      await Promise.race([t.fn(), new Promise((_, rej) => setTimeout(() => rej(new Fail('időtúllépés (10 mp)')), 10000))]);
      pass++; lines.push('OK    ' + t.name);
    } catch (e) {
      fail++; lines.push('HIBA  ' + t.name + '\n      → ' + (e instanceof Fail ? e.message : (e && e.stack || e)));
    }
    out.textContent = lines.join('\n');
  }
  fresh();
  const total = `ÖSSZESEN: ${pass} sikeres, ${fail} hibás${skip ? `, ${skip} kihagyva (online)` : ''}`;
  lines.push('', total);
  out.textContent = lines.join('\n');
  sum.textContent = total; sum.className = fail ? 'bad' : 'ok';
  document.title = (fail ? 'HIBA' : 'OK') + ' – DM Screen tesztek';
  document.body.dataset.done = '1';
}
run().catch(e => { document.getElementById('summary').textContent = 'A TESZTFUTTATÁS ELAKADT: ' + (e.message || e); document.getElementById('report').textContent += '\nÖSSZESEN: 0 sikeres, 1 hibás (elakadt: ' + (e.message || e) + ')'; });

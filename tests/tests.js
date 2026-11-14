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
  test('szövegsablonok ({{scalevalue}}, {{savedc:wis}} …): a karakter adataiból; a feature szinttáblája az adatból, osztályszint a componentId szerint; ami nem dönthető el, „?”', () => {
    const d = structuredClone(DDB).data;
    d.classes[0].classFeatures = [{definition: {id: 11, name: 'Preserve Life'}}];
    d.classes[1].classFeatures = [{definition: {id: 22, name: 'Sneak Attack'}, levelScale: {dice: {diceString: '9d6'}}}];
    d.actions.class.push(
      {name: 'Sneak Attack', componentId: 22, snippet: 'Extra {{scalevalue}} damage.'},
      {name: 'Preserve Life', componentId: 11, snippet: 'Restore {{classlevel*5#unsigned}} HP, DC {{savedc:wis}}, up to level {{(proficiency/2)@roundup#unsigned}}.'},
      {name: 'Mix', componentId: 11, snippet: '{{(modifier:cha+classlevel)@min:1#unsigned}} / {{modifier:cha@min:1#unsigned}} / {{proficiency#signed}} / {{(classlevel/2)@rounddown}}'},
      {name: 'Ismeretlen', snippet: '{{limiteduse}} és {{classlevel}} és {{1+}}'});
    const t = n => W.convertDDB({data: d}).traits.find(x => x.name === n).text;
    eq(t('Sneak Attack'), 'Extra 9d6 damage.', 'a levelScale nyer');
    eq(t('Preserve Life'), 'Restore 15 HP, DC 12, up to level 2.', 'Fighter 3, PB 3, WIS +1');
    eq(t('Mix'), '2 / 1 / +3 / 1');
    eq(t('Ismeretlen'), '? és ? és ?', 'multiclass, componentId nélkül az osztályszint nem dönthető el');
    // levelScale nélkül a PHB szinttáblája (Rogue 2 → 1d6)
    delete d.classes[1].classFeatures[0].levelScale;
    eq(t('Sneak Attack'), 'Extra 1d6 damage.');
  });
  test('szövegsablon a már elmentett szövegben: a telefonos lap és a DM Screen statblokkja a lap / játékos adataiból oldja fel', () => {
    const H = W.Sheet, lap = (cls, ab = {}) => H.norm({classes: cls, abilities: {wis: 14, cha: 16, ...ab}});
    eq(H.ddbSablonLap('Extra {{scalevalue}} damage.', 'Sneak Attack', lap([{name: 'Rogue', level: 5}, {name: 'Fighter', level: 2}])), 'Extra 3d6 damage.', 'a Rogue szintje');
    eq(H.ddbSablonLap('Die ({{scalevalue}}), DC {{savedc:cha}}', 'Bardic Inspiration', lap([{name: 'Bard', level: 10}])), 'Die (d10), DC 15');
    eq(H.ddbSablonLap('{{classlevel*5#unsigned}} HP', 'Channel Divinity: Preserve Life', lap([{name: 'Cleric', level: 6}])), '30 HP', 'egy osztály');
    eq(H.ddbSablonLap('{{scalevalue}}', 'Valami', lap([{name: 'Cleric', level: 6}])), '?', 'ismeretlen szinttábla');
    eq(H.ddbSablonLap('sima szöveg', 'X', lap([])), 'sima szöveg');
    // szélső esetek: osztás nullával, negatív, @ zárójelen belül, kocka a kifejezésben, túl hosszú / túl mély kifejezés
    const k = {pb: 2, ab: {cha: 8}, cl: 3};
    eq(['{{classlevel/0}}', '{{-classlevel+1#signed}}', '{{modifier:cha#signed}}', '{{(classlevel@min:1)*2}}', '{{2d6+1}}', '{{' + '('.repeat(5000) + '1' + ')'.repeat(5000) + '}}'].map(x => H.ddbSablon(x, k)),
      ['?', '-2', '-1', '?', '?', '?']);
    eq(H.ddbSablon('{{(1+2)*3}}', k), '9');
    const pc = {kind: 'pc', type: 'Elf — Rogue 3 (Thief)', abilities: {str: 10, dex: 16, con: 10, int: 10, wis: 12, cha: 10}};
    eq(W.lenySablon(pc, {name: 'Sneak Attack', text: '{{scalevalue}}, DC {{savedc:dex}}'}), '2d6, DC 13');
    eq(W.lenySablon({...pc, kind: 'enemy'}, {name: 'Sneak Attack', text: '{{scalevalue}}'}), '{{scalevalue}}', 'szörnynél nem nyúl hozzá');
  });
  test('képességek: alap + bónusz + faji bónusz + „set” + felülírás', () => {
    eq(W.convertDDB(DDB).abilities, {str: 17, dex: 16, con: 19, int: 12, wis: 12, cha: 8});
  });
  test('szint, HP (max és aktuális), sebesség, fajta/kaszt sor', () => {
    const c = W.convertDDB(DDB);
    eq([c.cr, c.hp.max, c.hp.cur, c.speed, c.kind, c.ddbId], ['Szint 5', 67, 57, '35 ft.', 'pc', 424242]);
    eq(c.type, 'Wood Elf — Fighter 3 (Eldritch Knight) / Rogue 2');
  });
  test('tárgyból jövő bónuszok (skill, minden próba, passzívok), eszköznév tartaléka; egyedi nevű és hiányzó tároló', () => {
    const d = structuredClone(DDB).data;
    (d.modifiers.item = d.modifiers.item || []).push({type: 'bonus', subType: 'stealth', value: 2}, {type: 'bonus', subType: 'ability-checks', value: 1},
      {type: 'bonus', subType: 'passive-investigation', value: 3}, {type: 'bonus', subType: 'passive-insight', value: 4}, {type: 'proficiency', subType: 'thieves-tools'});
    d.inventory.push({id: 900, quantity: 1, definition: {name: 'Zsák'}}, {id: 901, quantity: 1, containerEntityId: 900, definition: {name: 'Kötél'}}, {id: 902, quantity: 1, containerEntityId: 999, definition: {name: 'Lámpás'}});
    (d.characterValues = d.characterValues || []).push({typeId: 8, valueId: 900, value: 'Öreg zsák'});
    const alap = W.convertDDB(DDB), c = W.convertDDB(d), inv = n => c.inventory.find(i => i.name === n);
    eq(c.skillMods.stealth.b, alap.skillMods.stealth.b + 3, 'stealth: +2 és minden próbára +1');
    eq(c.skillMods.perception.b, alap.skillMods.perception.b + 1, 'perception: minden próbára +1');
    eq([c.passiveBonus.investigation, c.passiveBonus.insight], [3, 4]);
    has(c.tools, 'thieves-tools', 'a név nélküli jártasság az azonosítójával');
    ok(inv('Öreg zsák (Zsák)'), 'egyedi név');
    eq([inv('Kötél').container, inv('Lámpás').container], ['Öreg zsák', ''], 'tároló neve');
  });
  test('varázslat nélküli karakternek nincs „Varázslatok” tulajdonsága', () => {
    const d = structuredClone(DDB).data; d.classSpells = []; d.spells = {};
    ok(!W.convertDDB(d).traits.some(t => t.name === 'Varázslatok'));
  });
  test('HP: a kézi felülírás számít, és a jelenlegi nem megy 0 alá', () => {
    const d = structuredClone(DDB); d.data.overrideHitPoints = 50; d.data.removedHitPoints = 80;
    const {hp} = W.convertDDB(d); eq([hp.max, hp.cur], [50, 0]);
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
  test('minden importálót a saját formátuma választja ki, és a szerződés szerinti lényt adja: normCreature(ki) ≡ ki', async () => {
    stubFive();
    const n = W.normCreature, sj = W.stableJson, imp = A('IMPORTEROK');
    const mintak = {karakterlap: W.Sheet.TEMPLATE, 'D&D Beyond': DDB, '5e.tools': FIVE.chief, JSON: {name: 'Pók'}};
    eq(imp.map(i => i.nev).sort(), Object.keys(mintak).sort(), 'minden importálóhoz van minta');
    for (const [nev, m] of Object.entries(mintak)) {
      const valasztott = imp.find(i => i.felismer(m));
      eq(valasztott.nev, nev);
      const ki = await valasztott.atalakit(structuredClone(m));
      eq(sj((valasztott.lap ? W.Sheet.norm : n)(structuredClone(ki))), sj(ki), nev);
    }
    eq([A('S.library').length, Object.keys(A('SHEETS')).length], [0, 0], 'az importáló csak átalakít, nem ment');
    for (const c of [W.convertDDB(ddbParty()), W.convert5e(FIVE.brute), W.convert5e(FIVE.scout), n({...A('TEMPLATE'), id: 'sablon'})]) eq(sj(n(structuredClone(c))), sj(c), c.name);
  });
  test('az importálók sorrendje dönt; a lap a lények elé kerül az eredményben; hibás elemnél elutasít', async () => {
    const imp = A('IMPORTEROK'), valaszt = o => imp.find(i => i.felismer(o)).nev;
    eq(valaszt({format: W.Sheet.FORMAT, stats: [{id: 1}], ac: [1]}), 'karakterlap');
    eq(valaszt({stats: [{id: 1}], ac: [1]}), 'D&D Beyond');
    eq(valaszt({ac: [1]}), '5e.tools');
    const r = await W.importAny([{name: 'A'}, W.Sheet.TEMPLATE]);
    eq(r.map(c => c.name), [W.Sheet.TEMPLATE.name, 'A']);
    let hiba = null; try { await W.importAny([null]); } catch (e) { hiba = e; } ok(hiba, 'null elem');
  });
  test('több azonos nevű lap: a második látja az elsőt és rákérdez; hiba egy elem közben: ami addig bejött, marad', async () => {
    const lap = W.Sheet.TEMPLATE, urit = () => A('S.library = []; SHEETS = {}');
    let kerdes = 0, valasz = false;
    W.confirm = () => { kerdes++; return valasz; };
    await W.importAny([lap, lap]);
    eq([kerdes, A('S.library').length], [1, 2], 'Mégse = új játékos');
    urit(); kerdes = 0; valasz = true;
    await W.importAny([lap, lap]);
    eq([kerdes, A('S.library').length], [1, 1], 'OK = a meglévő lapja cserélődik');
    urit();
    let hiba = null; try { await W.importAny([lap, {name: 'A'}, null]); } catch (e) { hiba = e; }
    ok(hiba, 'a hibás elem elutasít');
    eq(A('S.library').map(c => c.name), [lap.name], 'a lap bent marad, a lény nem kerül be');
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
  test('mentés és betöltés: csoportok és számozás megmarad, a játékos csak hivatkozásként kerül bele', () => {
    add(W.upsertLibrary(W.normCreature(pc('Rella')))); add(mk(), 3); add(ogre());
    W.openLib('enc'); $('#encName').value = 'Kápolna'; click('[data-act="encSave"]');
    const s = A('S.saved')[0];
    eq([s.name, s.list.length, !!s.id], ['Kápolna', 4, true]);
    eq(W.summarize(s.list), '3× Goblin, Ogre');
    eq(s.pcs.map(p => [p.name, 'init' in p]), [['Rella', false]]);
    A('S.enc.list = S.enc.list.filter(x => x.c.kind === "pc")'); W.render();
    W.openLib('enc'); click('[data-act="encLoad"]');
    eq(names().sort(), ['Goblin 1', 'Goblin 2', 'Goblin 3', 'Ogre', 'Rella']);
  });
  test('a HP, a maximum és a temp HP lényenként mentődik és töltődik vissza', () => {
    const [p] = add(W.upsertLibrary(W.normCreature(pc('Rella')))); const g = add(mk(), 3); const [o] = add(ogre());
    p.hp = 4; g[0].hp = 3; g[1].hp = 0; g[1].dead = true; g[2].temp = 5; o.c.hp.max = 70; o.hp = 66;
    W.openLib('enc'); $('#encName').value = 'Kápolna'; click('[data-act="encSave"]');
    const s = A('S.saved')[0];
    eq(s.list.map(c => [c.hp.cur, c.hp.max, c.hp.temp]), [[3, 7, undefined], [0, 7, undefined], [7, 7, 5], [66, 70, undefined]]);
    ok($('[data-enc="0"] small').textContent.includes('3× Goblin, Ogre + Rella · 3 sérült'), 'a lista jelzi a sérülteket');
    // a mentett encounter tisztítás (Firestore-betöltés) után is ugyanez
    const t = W.Szerzodes.sanitizeState({saved: JSON.parse(JSON.stringify(A('S.saved')))}).saved[0];
    eq(t.list.map(c => [c.hp.cur, c.hp.temp]), [[3, undefined], [0, undefined], [7, 5], [66, undefined]]);
    A('S.enc.list = S.enc.list.filter(x => x.c.kind === "pc")'); W.render();
    A('S.settings.rollHp = true'); stubRnd(1);  // a mentett HP-t nem dobja újra
    W.openLib('enc'); click('[data-act="encLoad"]');
    const by = n => A('S.enc.list').find(x => W.nameOf(x) === n);
    eq(['Goblin 1', 'Goblin 2', 'Goblin 3', 'Ogre'].map(n => [by(n).hp, by(n).c.hp.max, by(n).temp, by(n).dead]),
      [[3, 7, 0, false], [0, 7, 0, true], [7, 7, 5, false], [66, 70, 0, false]]);
    eq(by('Rella').hp, 4);
    eq(['Goblin 1', 'Goblin 2', 'Goblin 3'].map(n => by(n).group).filter((v, i, a) => a.indexOf(v) === i).length, 1);  // egy initiative-csoport
    ok(!('cur' in by('Goblin 1').c.hp) && !('temp' in by('Goblin 3').c.hp), 'a harcosban nincs hp.cur / hp.temp');
    eq(W.normCombatant({c: {hp: {max: 7, cur: 2, temp: 4}}}).c.hp, {max: 7, formula: ''});
  });
  test('régi (HP nélküli) mentett encounter: teljes HP, dobott HP-nál dob', () => {
    A(`S.saved = [{id: 'r1', name: 'Régi', list: [${JSON.stringify(mk())}, ${JSON.stringify(mk())}]}]`);
    A('S.settings.rollHp = true'); stubRnd(2, 3, 6, 6);
    W.openLib('enc');
    ok(!$('[data-enc="0"] small').textContent.includes('sérült'), 'nincs sérült-jelzés');
    click('[data-act="encLoad"]');
    eq(A('S.enc.list').map(x => [x.hp, x.c.hp.max]), [[5, 7], [12, 12]]);
  });
  test('az initiative mindenkinél mentődik és visszajön (ellenfél, NPC, játékos); a hiányzó játékos a könyvtárból', () => {
    const rella = W.upsertLibrary(W.normCreature(pc('Rella'))), bor = W.upsertLibrary(W.normCreature(pc('Bor')));
    const [r] = add(rella); const [b] = add(bor); const g = add(mk(), 2); const [n] = add(mk('Őr', {kind: 'npc'})); const [o] = add(ogre());
    r.init = 17; g[0].init = 12; g[1].init = 12; n.init = 0; o.init = -1;  // a Bor initiative-ja nincs megadva; a 0 és a negatív is érték
    W.openLib('enc'); $('#encName').value = 'Híd'; click('[data-act="encSave"]');
    const s = A('S.saved')[0];
    eq(s.list.map(c => [c.name, c.init]), [['Goblin', 12], ['Goblin', 12], ['Őr', 0], ['Ogre', -1]]);
    eq(s.pcs, [{libId: rella.id, name: 'Rella', init: 17}, {libId: bor.id, name: 'Bor'}]);
    ok($('[data-enc="0"] small').textContent.endsWith(' · initiative-val'), 'a lista jelzi');
    // tisztítás (Firestore-betöltés) után is ugyanez; rossz értékek kiesnek
    eq(W.Szerzodes.sanitizeState({saved: JSON.parse(JSON.stringify(A('S.saved')))}).saved[0], JSON.parse(JSON.stringify(s)));
    const t = W.Szerzodes.sanitizeState({saved: [{name: 'x', list: [{name: 'A', init: 'abc'}, {name: 'B', init: 500}], pcs: [{libId: 'ok_1', init: 'x'}, {libId: '<b>'}, 5, {libId: 7}]}]}).saved[0];
    eq([t.list.map(c => c.init), t.pcs], [[undefined, 99], [{libId: 'ok_1', name: ''}]]);
    ok(!('pcs' in W.Szerzodes.sanitizeState({saved: [{name: 'régi', list: []}]}).saved[0]), 'régi mentésben nincs pcs');
    // csak Rella marad; betöltés futó harcba: a mentett initiative jön, nem dob újra; Bor a könyvtárból jön, initiative nélkül
    A('S.enc.list = S.enc.list.filter(x => x.c.name === "Rella")'); A('S.enc.list[0].init = 3'); A('S.enc.active = S.enc.list[0].cid'); stubRnd(20, 20, 20, 20, 20);
    W.openLib('enc'); click('[data-act="encLoad"]');
    const by = nm => A('S.enc.list').filter(x => W.nameOf(x) === nm);
    eq(['Rella', 'Bor', 'Goblin 1', 'Goblin 2', 'Őr', 'Ogre'].map(nm => [by(nm).length, by(nm)[0]?.init]), [[1, 17], [1, null], [1, 12], [1, 12], [1, 0], [1, -1]]);
    ok(!A('S.enc.list').some(x => 'init' in x.c), 'a harcos lényében nincs init');
    eq(W.normCombatant({c: {name: 'A', init: 5}}).c.init, undefined);
  });
  test('mentett játékos, aki a könyvtárból is törlődött: kimarad, naplóba kerül; csak játékosos encounter is menthető', () => {
    const rella = W.upsertLibrary(W.normCreature(pc('Rella')));
    const [r] = add(rella); r.init = 9;
    W.openLib('enc'); $('#encName').value = 'Csak mi'; click('[data-act="encSave"]');
    eq(A('S.saved').length, 1, 'játékosokkal is ment');
    A('S.library = []'); A('S.enc.list = []');
    W.openLib('enc'); click('[data-act="encLoad"]');
    eq(A('S.enc.list').length, 0);
    ok($('#log').textContent.includes('Rella nincs a könyvtárban'), 'naplóbejegyzés');
    // üres encounter: nem ment
    let uz = ''; const al = W.alert; W.alert = m => uz = m;
    try { W.openLib('enc'); click('[data-act="encSave"]'); } finally { W.alert = al; }
    eq([A('S.saved').length, uz], [1, 'Üres az encounter, nincs mit menteni.']);
    // a mentés óta NPC-vé váltott, már bent lévő játékos nem jön kétszer
    const npc = W.upsertLibrary(W.normCreature(mk('Volt játékos', {kind: 'npc'})));
    A('S.enc.list = []'); add(npc);
    W.encounterBetoltese({id: 'x', name: 'x', list: [], pcs: [{libId: npc.id, name: 'Volt játékos', init: 4}]});
    eq(A('S.enc.list').map(x => [x.c.name, x.init]), [['Volt játékos', 4]]);
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
  test('HP rejtve (2026-11-14): a könyvtári „HP a játékosoknak” beállítás a trackerre is szól – NPC: pontos / állapot / rejtve, játékos: pontos / rejtve, szörny: állapot', () => {
    const {hpLathato, normCreature} = W.Szerzodes;
    // a tisztító: 'hidden' megmarad, ismeretlen érték alapra áll
    eq(['exact', 'label', 'hidden', 'x'].map(h => normCreature({kind: 'npc', share: {hp: h}}).share.hp), ['exact', 'label', 'hidden', 'label']);
    eq(normCreature({kind: 'pc', share: {hp: 'x'}}).share.hp, 'exact');
    eq([['npc', 'exact'], ['npc', 'label'], ['npc', 'hidden'], ['pc', 'exact'], ['pc', 'label'], ['pc', 'hidden'], ['monster', 'hidden']].map(([kind, hp]) => hpLathato({kind, share: {hp}})),
      ['exact', 'label', 'hidden', 'exact', 'exact', 'hidden', 'label'], 'a régi játékos „label”-je pontos marad');
    eq([hpLathato(null), hpLathato({kind: 'npc'})], ['label', 'label']);
    const lib = (n, kind, hp) => W.upsertLibrary(W.normCreature({...mk(n, {kind, hp: {max: 20}}), share: {vis: 'party', hp}}));
    const [nh] = add(lib('Rejtett NPC', 'npc', 'hidden')), [ne] = add(lib('Pontos NPC', 'npc', 'exact')), [ph] = add(lib('Rejtett hős', 'pc', 'hidden')), [pl] = add(lib('Régi hős', 'pc', 'label')), [m] = add(mk('Ork', {hp: {max: 20}}));
    [nh, ne, ph, pl, m].forEach((x, i) => { x.hp = 12; x.init = 20 - i; });
    const v = () => Object.fromEntries(W.publicView().list.map(e => [e.name, [e.hp, e.max, e.status]]));
    eq(v(), {'Rejtett NPC': [null, null, null], 'Pontos NPC': [12, 20, null], 'Rejtett hős': [null, null, null], 'Régi hős': [12, 20, null], 'Ork': [null, null, 'hurt']});
    // a könyvtár mostani értéke számít (harc közben átállítva is)
    A(`S.library.find(c => c.name === 'Rejtett NPC').share.hp = 'label'`);
    eq(v()['Rejtett NPC'], [null, null, 'hurt']);
    const pub = Object.fromEntries(A('Tar.karakterek.nyilvanosResz(S.library)').map(p => [p.name, [p.hp, p.status]]));
    eq(pub, {'Rejtett NPC': [null, 'healthy'], 'Pontos NPC': [{cur: 20, max: 20}, null], 'Rejtett hős': [null, null], 'Régi hős': [{cur: 20, max: 20}, null]});
    // rejtett HP-jú legyőzött ellenfél: „Halott” (a tracker szürkíti és átugorja); csapattárs 0 HP-n: semmi
    A(`S.library.find(c => c.name === 'Rejtett NPC').share.hp = 'hidden'`); nh.side = 'enemy'; nh.hp = 0; nh.dead = true;
    eq(v()['Rejtett NPC'], [null, null, 'dead']);
    ph.hp = 0; eq(v()['Rejtett hős'], [null, null, null]);
    ph.hp = 12; nh.hp = 12; nh.dead = false;
    eq(W.Szerzodes.normPublicChar({id: 'a', kind: 'npc', hp: null, status: null}).status, null, 'se HP, se állapot');
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
      if (p[1] === '*') return !rb.features.some(f => f.cls === p[0] && f.sub && f.n === p[2]);
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
  test('varázslat sora a valódi szabálykönyvvel: minden mentős varázslatnál kiolvasható a mentő, minden sebző cantripnél a szintenkénti kocka (vagy a darabszám)', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const mentos = rb.spells.filter(sp => /saving throw/i.test(sp.tx || '') && /\b(make|succeed on|fail) an? \w+ saving throw/i.test(sp.tx || ''));
    eq(mentos.filter(sp => !H.spellSave(sp.tx)).map(sp => sp.n), [], 'mentő nélkül');
    ok(mentos.length >= 150, 'mentős varázslatok: ' + mentos.length);
    // sebző cantrip: van „… damage” a szövegében és nő a szinttel („5th level”)
    const sebzo = rb.spells.filter(sp => sp.l === 0 && /\d+d\d+ \w+ damage/i.test(sp.tx || '') && /\b5th level\b/i.test(sp.tx || ''));
    const nemNo = sebzo.filter(sp => !H.cantripKocka(sp.tx, 17) && H.cantripDarab(sp.tx, 17) === 1).map(sp => sp.n);
    // ezeknél a kocka nem a sebzés kockája nő (pl. pengés cantripek: „At 5th level, the melee attack deals an extra 1d8…”) – a gomb a régi módon (első kocka) marad
    ok(nemNo.length <= 4, 'nem olvasható ki: ' + nemNo.join(', '));
    eq([H.cantripKocka(rb.spells.find(s => s.n === 'Fire Bolt').tx, 5), H.cantripDarab(rb.spells.find(s => s.n === 'Eldritch Blast').tx, 11), H.spellSave(rb.spells.find(s => s.n === 'Sacred Flame').tx)], ['2d10', 3, 'dex']);
    ok(rb.spells.find(s => s.n === 'Eldritch Blast').atk && !rb.spells.find(s => s.n === 'Sacred Flame').atk, 'támadó-e jelölés');
    // ahol a szöveg említ mentőt, de nem a célpontét (előny, jártasság, a varázsló saját fix DC-s mentője)
    const nincs = ['Haste', 'Beacon of Hope', "Heroes' Feast", 'Contact Other Plane', "Tenser's Transformation"];
    ok(nincs.every(n => rb.spells.some(s => s.n === n)), 'a példák megvannak a szabálykönyvben');
    eq(nincs.map(n => H.spellSave(rb.spells.find(s => s.n === n).tx)), nincs.map(() => ''));
  }, {online: true});
  test('featek a valódi szabálykönyvben: minden varázslat-választóból van mit választani, és nem marad „varázslat választása” teendő', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const valasztok = (fx, hol) => (fx || []).flatMap(x => [...(x.spellChoose ? [[hol, x.spellChoose]] : []), ...Object.entries(x.pickChoose?.then || {}).flatMap(([k, l]) => valasztok(l, hol + ' / ' + k))]);
    const lista = rb.feats.flatMap(f => valasztok(f.fx, f.n));
    ok(lista.length >= 20, 'feat varázslat-választók: ' + lista.length);
    const ures = lista.filter(([, sc]) => !H.choiceOptions({key: 'x', kind: 'spell', n: sc.n, ok: [], from: sc.from}, null, rb).opts.length).map(([h]) => h);
    // a Bard és a Cleric listáján nincs támadó cantrip (PHB / XGE / TCE), az 5e.tools mégis felkínálja: ott a választó üres, a játékos másik listát választ
    eq(ures, ['Spell Sniper / Bard', 'Spell Sniper / Cleric'], 'üres választó');
    eq(rb.feats.filter(f => (f.fx || []).some(x => /varázslat választása/.test(x.todo || ''))).map(f => f.n), [], 'maradt teendő');
  }, {online: true});
  test('featek a valódi szabálykönyvben: egy 8. szintű Fighter ASI-jén mind felvehető; minden saját választásuk kitölthető; ✋ teendő egyiknél sem marad', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet, hibak = [], teendo = [];
    for (const f of rb.feats) {
      let s = H.norm({auto: true, build: {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 15, dex: 13, con: 14, int: 13, wis: 13, cha: 13}, levels: Array.from({length: 8}, () => ({c: 'Fighter'})), ch: {'Fighter:4:asi': {feat: f.n + '|' + f.s}}}});
      // a feat választásait sorban kitölti az első szabad lehetőségekkel (a then-láncok miatt többször számol)
      for (let i = 0; i < 6; i++) {
        const c = H.calc(s, rb), nyitott = c.choices.filter(x => x.key.startsWith('feat:') && !x.done);
        if (!nyitott.length) break;
        const ch = {...s.build.ch};
        for (const x of nyitott) {
          const o = H.choiceOptions(x, c, rb, s);
          if (o.free) ch[x.key] = Array.from({length: x.n}, (_, j) => x.kind === 'pick' ? 'Longsword ' + j : "smith's tools");
          else if (x.label === 'Varázslatlista' && o.opts.some(y => y.v === 'Wizard')) ch[x.key] = ['Wizard'];   // a Bard / Cleric listán a Spell Snipernek nincs cantripje
          else ch[x.key] = o.opts.filter(y => !y.dis).slice(0, x.n).map(y => y.v);
        }
        s = H.norm({...s, build: {...s.build, ch}});
      }
      const c = H.calc(s, rb), maradt = c.choices.filter(x => x.key.startsWith('feat:') && !x.done);
      if (maradt.length) hibak.push(f.n + ': ' + maradt.map(x => x.key).join(', '));
      teendo.push(...c.todos.filter(t => t.kind === 'manual' && /^✋ Feat:/.test(t.key)).map(t => t.text));
    }
    eq(hibak, [], 'kitölthetetlen');
    eq(teendo, [], 'maradt ✋ teendő');
  }, {online: true});
  test('TCE a valódi szabálykönyvben: a TCE_FX és a TCE_CSERE kulcsai léteznek; XGE-varázslat az osztálylistán (clx), TCE bővített lista külön (clt)', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const tceFeat = (cls, n, lvl) => rb.classes.find(c => c.n === cls)?.feats.some(f => f.n === n && f.opt && (lvl == null || f.lvl === lvl)) || rb.features.some(f => f.cls === cls && f.n === n && f.opt && (lvl == null || f.lvl === lvl));
    eq(Object.keys(H.TCE_FX).filter(k => { const [cls, n, lvl] = k.split('|'); return !tceFeat(cls, n, +lvl); }), [], 'TCE_FX: nem létező');
    const phb = (cls, sb, n) => sb === '*' ? rb.features.some(f => f.cls === cls && f.sub && f.n === n) : sb ? rb.features.some(f => f.cls === cls && f.sub === sb && f.n === n) : rb.classes.find(c => c.n === cls)?.feats.some(f => f.n === n && !f.opt);
    eq(Object.entries(H.TCE_CSERE).filter(([k, l]) => { const p = k.split('|'), n = p.at(-1), sb = p.length === 3 ? p[1] : ''; return !phb(p[0], sb, n) || !l.every(t => tceFeat(p[0], t)); }).map(([k]) => k), [], 'TCE_CSERE: nem létező');
    const sp = n => rb.spells.find(s => s.n === n);
    eq([sp('Toll the Dead').cl, sp('Toll the Dead').clx], [['Cleric', 'Warlock', 'Wizard'], ['Cleric', 'Warlock', 'Wizard']], 'XGE-cantrip a listákon');
    ok(sp('Aura of Vitality').cl.includes('Paladin') && sp('Aura of Vitality').clt?.includes('Cleric'), 'TCE: Aura of Vitality a Cleric bővített listáján');
    ok(rb.spells.filter(s => s.clt?.length).length >= 30, 'TCE bővített listák: ' + rb.spells.filter(s => s.clt?.length).length);
    // Ranger 6: minden TCE-t elfogadva nincs ✋ teendő a Favored Enemy / Natural Explorer miatt
    const ch = {'Ranger:tce:Favored Foe': 'igen', 'Ranger:tce:Deft Explorer': 'igen', 'Ranger:tce:Primal Awareness': 'igen'};
    const c = H.calc(H.norm({auto: true, build: {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {dex: 15, wis: 14}, levels: Array.from({length: 6}, () => ({c: 'Ranger'})), ch}}), rb);
    ok(!c.features.some(f => /^(Favored Enemy|Natural Explorer|Primeval Awareness)/.test(f.name)), 'kiváltva: ' + c.features.map(f => f.name));
    ok(['Favored Foe', 'Deft Explorer', 'Primal Awareness', 'Deft Explorer Improvement'].every(n => c.features.some(f => f.name === n)), 'TCE-jellemzők');
    ok(c.always.some(a => a.name === 'Speak with Animals') && c.always.some(a => a.name === 'Beast Sense'), 'Primal Awareness varázslatai');
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
  const list = col => Object.entries(store).filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({...structuredClone(v), id: k.slice(col.length + 1)}));
  return {store, log, emit: col => watchers.filter(w => w.col === col).forEach(w => w.cb(list(col))), db: {
    get: async p => store[p] ? structuredClone(store[p]) : null,
    list: async col => list(col).filter(x => !x.id.includes('/')),
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
    W.importBackup({library: [evilCreature()], saved: [{id: XQ, name: XSS, list: [evilCreature()], pcs: [{libId: 'nincs_ilyen', name: XSS, init: 5}]}],
      enc: {list: [evilCombatant(), evilCombatant()], round: XSS, active: XQ}, settings: {sources: [XSS, 'MM'], groupInit: XQ, lastExport: XSS}});
    eq([A('S.enc.round'), A('S.settings.sources'), A('S.settings.groupInit'), A('S.settings.lastExport')], [1, ['MM'], true, '']);
    await renderEverywhere();
    assertNoXss();
    W.encounterBetoltese(A('S.saved')[0]); await renderEverywhere();  // a „nincs a könyvtárban” naplósor a gonosz névvel
    has($('#log').textContent, 'nincs a könyvtárban'); assertNoXss();
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
  test('skill leírása (TERV-fejlesztesek-2026-11.md, 2. lépés): a skill nevére kattintva kinyílik alatta, újra kattintva bezárul; a cella továbbra is dobást kér', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.openParty();
    ok(!$('tr.skinfo'), 'alapból zárva');
    has($('[data-act="partySkillInfo"][data-sk="stealth"]').title, 'Lopakodás');
    click('[data-act="partySkillInfo"][data-sk="stealth"]');
    eq($$('tr.skinfo').length, 1); has($('tr.skinfo').textContent, 'Lopakodás');
    click('[data-act="partySkillInfo"][data-sk="arcana"]');
    eq($$('tr.skinfo').length, 1, 'egyszerre egy'); has($('tr.skinfo').textContent, 'Mágikus tudás');
    click('[data-act="partySkillInfo"][data-sk="arcana"]'); ok(!$('tr.skinfo'), 'bezárult');
    stubRnd(12); click($$('td.sk[data-sk="stealth"]')[1]); has($('#partyRoll').textContent, 'Stealth: 21');
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
  test('tisztítás: gazda játékosnál és NPC-nél (szörnynél nem), kisbetűvel; hibás e-mail kimarad; alapértékek típusonként', () => {
    const p = W.normCreature(pc('Rella', 3, {owner: '  Jatekos@Example.COM '}));
    eq([p.owner, p.share], ['jatekos@example.com', {vis: 'party', hp: 'exact', ac: true}]);
    eq(W.normCreature(pc('X', 1, {owner: 'nem email'})).owner, undefined);
    eq(W.normCreature(pc('X', 1, {owner: '<b>@x.hu'})).owner, undefined);
    const n = W.normCreature(npc('Bob', null, {owner: 'a@b.hu'}));
    eq([n.owner, n.share], ['a@b.hu', {vis: 'dm', hp: 'label', ac: false}], 'NPC-nél is megmarad (a visszaállításhoz)');
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
    W.upsertLibrary(W.normCreature(mk()));
    W.openLib('lib'); click('[data-act="libEdit"]');
    const fm = $('#edForm');
    ok($('#shareBox').hidden, 'szörnynél rejtve');
    setVal(fm.elements.kind, 'pc');
    ok(!$('#shareBox').hidden); ok(!fm.elements.owner.closest('label').hidden); ok(fm.elements.shareHp.closest('label').hidden, 'az NPC HP-választója rejtve');
    ok(!fm.elements.shareHpPc.closest('label').hidden, 'játékosnál a saját HP-választó (pontos / rejtve)');
    eq([...fm.elements.shareHpPc.options].map(o => o.value), ['exact', 'hidden']);
    fm.elements.shareHpPc.value = 'hidden';
    fm.elements.name.value = 'Rella'; fm.elements.owner.value = 'rossz cím';
    let msg = ''; W.alert = m => msg = m;
    click('[data-act="edSave"]');
    has(msg, 'nem érvényes'); ok($('#edForm'), 'nyitva maradt');
    fm.elements.owner.value = 'Rella@Example.com'; fm.elements.shareVis.value = 'dm';
    click('[data-act="edSave"]');
    const c = A('S.library').find(x => x.name === 'Rella');
    eq([c.owner, c.share.vis, c.share.hp], ['rella@example.com', 'dm', 'hidden']);
    W.openLib('lib'); has($('#libRows').textContent, 'csak DM'); has($('#libRows').textContent, 'rella@example.com');
    click('[data-act="libEdit"]');
    eq($('#edForm').elements.shareHpPc.value, 'hidden', 'visszatöltve');
    setVal($('#edForm').elements.kind, 'npc');
    ok($('#edForm').elements.owner.closest('label').hidden); ok(!$('#edForm').elements.shareAc.closest('label').hidden);
    ok(!$('#edForm').elements.shareHp.closest('label').hidden && $('#edForm').elements.shareHpPc.closest('label').hidden, 'NPC-nél a hármas választó');
    eq([...$('#edForm').elements.shareHp.options].map(o => o.value), ['exact', 'label', 'hidden']);
    $('#edForm').elements.shareHp.value = 'hidden'; click('[data-act="edSave"]');
    eq(A('S.library').find(x => x.name === 'Rella').share.hp, 'hidden', 'NPC-nél a hármas választóból');
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
  'spells/spells-xge.json': {spell: [{name: 'Toll the Dead', source: 'XGE', level: 0, school: 'N', spellAttack: ['R'], time: [{number: 1, unit: 'action'}], range: {type: 'point', distance: {type: 'feet', amount: 60}},
    components: {v: true, s: true}, duration: [{type: 'instant'}], entries: ['{@damage 1d8} necrotic.']}]},
  'spells/spells-tce.json': {spell: []},
  'generated/gendata-spell-source-lookup.json': {phb: {fireball: {class: {PHB: {Sorcerer: true, Wizard: true}, XPHB: {Bard: true}}, classVariant: {PHB: {Cleric: {definedInSources: ['TCE']}}, XPHB: {Druid: {definedInSources: ['TCE']}}}}, 'burning hands': {class: {PHB: {Wizard: true}}}},
    xge: {'toll the dead': {classVariant: {PHB: {Cleric: {definedInSources: ['XGE']}, Warlock: {definedInSources: ['XGE']}, Wizard: {definedInSources: ['XGE']}}}}}},
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
      optionalfeatureProgression: [{name: 'Fighting Style', featureType: ['FS:F'], progression: {1: 1, 10: 2}}]},
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
  test('dobáskérés a lapon (rollReq): csak érvényes fajta, azonosító és idő; a DC nem kerül rá; a dobás req-je; bónusz a lapról; backup és letöltés nem viszi', () => {
    const H = W.Sheet, at = '2026-11-06T18:00:00.000Z';
    const q = {id: 'k1', kind: 'check:int:history', label: XSS, mode: 'adv', by: 'dm@x.hu', at, dc: 15};
    eq(H.norm({}).rollReq, null);
    eq(H.norm({rollReq: q}).rollReq, {id: 'k1', kind: 'check:int:history', label: XSS, mode: 'adv', by: 'dm@x.hu', at}, 'a DC nem kerül a lapra');
    for (const kind of ['check:int:stealth', 'save:dex:stealth', 'bogus', 'check:xxx', 'check:dex:stealth:x', '', null]) eq(H.norm({rollReq: {...q, kind}}).rollReq, null, String(kind));
    for (const kind of ['init', 'save:wis', 'check:str', 'check:dex:stealth']) eq(H.norm({rollReq: {...q, kind}}).rollReq.kind, kind);
    eq([H.norm({rollReq: {...q, id: 'a b'}}).rollReq, H.norm({rollReq: {...q, at: 'tegnap'}}).rollReq, H.norm({rollReq: {...q, mode: 'x'}}).rollReq.mode], [null, null, '']);
    eq(H.norm({rolls: [{at, label: 'x', req: 'k1'}, {at, label: 'y', req: '<b>'}]}).rolls.map(r => r.req || ''), ['k1', '']);
    ok(H.reqAktiv({at: new Date().toISOString()}), 'friss'); ok(!H.reqAktiv({at: new Date(Date.now() - H.REQ_TTL_MS - 1000).toISOString()}), 'lejárt'); ok(!H.reqAktiv(null));
    const s = H.norm({abilities: {dex: 16, wis: 14, str: 8}, saveProf: ['dex'], skillProf: {stealth: 1}, classes: [{name: 'Rogue', level: 1}]});
    eq(['init', 'save:dex', 'check:str', 'check:dex:stealth'].map(k => H.reqRoll(s, k)),
      [{bonus: 3, label: 'Initiative'}, {bonus: 5, label: 'Dexterity mentő'}, {bonus: -1, label: 'Strength próba'}, {bonus: 5, label: 'Stealth'}]);
    const lap = H.norm({rollReq: q});
    eq(H.norm(lap), lap, 'kétszer tisztítva sem változik');
    eq(H.exportLap(lap).rollReq, null, 'letöltésben nincs');
    ok(!('rollReq' in H.backupPatch(H.norm({}), {sheet: lap}, null)), 'visszaállításnál nem jön vissza');
    eq([H.norm({}).rollSkip, H.norm({rollSkip: 'k1'}).rollSkip, H.norm({rollSkip: '<b>'}).rollSkip, H.exportLap(H.norm({rollSkip: 'k1'})).rollSkip], ['', 'k1', '', '']);
  });
  test('dobások a lapon (rolls): tisztítva, legfeljebb 15, idő nélküli kimarad; a backup és a letöltés nem viszi', () => {
    const H = W.Sheet, at = '2026-11-06T18:00:00.000Z';
    eq(H.norm({}).rolls, []);
    const s = H.norm({rolls: [{at, label: XSS, total: 17, detail: '[12] +5', nat: 12, extra: 1}, {label: 'idő nélkül'}, 'x', null,
      ...Array.from({length: 20}, (_, i) => ({at, label: 'L' + i, total: '✗', nat: 99}))]});
    eq(s.rolls.length, 12, 'az első 15-ből a rossz elemek kiesnek');
    eq(s.rolls[0], {at, label: XSS, total: '17', detail: '[12] +5', nat: 12});
    eq([s.rolls[1].total, s.rolls[1].nat, s.rolls[1].detail], ['✗', 20, '']);
    eq(H.norm(s), s, 'kétszer tisztítva sem változik');
    eq(H.ROLLS_MAX, 15);
    eq(H.exportLap(s).rolls, [], 'letöltésben nincs');
    ok(!('rolls' in H.backupPatch(H.norm({}), {sheet: s}, null)), 'visszaállításnál a mostani dobások maradnak');
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

  test('Paladin 6: Aura of Protection, Defense, mágikus tárgyak (hangolás), bekészítés, slotok; érvénytelen Fighting Style', () => {
    const H = W.Sheet, rb = rb3();
    const it = inv('Chain Mail', 'Shield', '+1 Longsword', {name: 'Cloak of Protection', attuned: true}, {name: 'Gauntlets of Ogre Power', attuned: true});
    const build = {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 15, dex: 10, wis: 12, cha: 16}, levels: lv('Paladin', 6), sub: {Paladin: 'Devotion|PHB'},
      ch: {'Paladin:opt:Fighting Style': ['Defense|PHB'], 'Paladin:4:asi': {cha: 2}}};
    let c = H.calc(mkS(build, {inventory: it}), rb);
    eq([c.abilities.str.v, c.abilities.cha.v, c.ac.v], [19, 19, 20], 'Gauntlets: STR 19; AC 16 + 2 + köpeny 1 + Defense 1');
    eq([c.saves.wis.v, c.saves.str.v, c.saves.dex.v], [9, 9, 5], 'aura +CHA 4, köpeny +1');
    eq(c.saves.dex.parts.map(p => p.src), ['DEX-módosító', 'Aura of Protection (Paladin 6)', 'Cloak of Protection']);
    eq(c.resources, [{name: 'Divine Sense', max: 5, reset: 'long'}, {name: 'Lay on Hands', max: 30, reset: 'long'}]);
    eq(c.casting, [{cls: 'Paladin', type: 'half', ab: 'cha', dc: 15, atk: 7, cantrips: 0, known: 0, prepared: 7, maxSpell: 2}]);
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
    eq(c.todos.map(t => t.key), ['Bard:sub', 'Bard:4:asi', 'Bard:3:expertise', 'Bard:cantrips', 'Bard:known'], 'az arcana nem jártas, így az expertise hiányos');
    c = H.calc(mk(['persuasion', 'performance']), rb);
    eq([c.skills.persuasion.v, c.skills.persuasion.prof, c.todos.map(t => t.key)], [9, 2, ['Bard:sub', 'Bard:4:asi', 'Bard:cantrips', 'Bard:known']]);
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

  test('feat-előfeltétel (featOk): képesség vagy-lista, faj + alfaj, Small faj, varázslás, jártasság; a választóban ⚠ és az ok, de választható; feltétel nélkül ✓', () => {
    const H = W.Sheet, rb = rb3();
    rb.races.push({n: 'Halfling', s: 'PHB', size: 'S', sp: {walk: 25}, fx: []}, {n: 'Elf', s: 'PHB', size: 'M', sp: {walk: 30}, fx: [], subs: 1});
    rb.subraces.push({n: 'Drow', race: 'Elf', s: 'PHB', fx: []});
    rb.feats.push({n: 'Ritual Caster', s: 'PHB', pre: 'INT 13 or WIS 13', pq: [{ab: [{int: 13}, {wis: 13}]}]},
      {n: 'Drow High Magic', s: 'XGE', pq: [{race: [{n: 'elf', sub: 'drow'}]}]}, {n: 'Squat Nimbleness', s: 'XGE', pq: [{race: [{n: 'dwarf'}, {n: 'small race'}]}]},
      {n: 'War Caster', s: 'PHB', pq: [{cast: true}]}, {n: 'Heavy Armor Master', s: 'PHB', pq: [{prof: ['armor:heavy']}]}, {n: 'Fighting Initiate', s: 'TCE', pq: [{prof: ['weapon:martial']}]});
    const f = n => rb.feats.find(x => x.n === n);
    const fighter = mkS({race: 'Dwarf|PHB', base: {str: 15, int: 8, wis: 12}, levels: lv('Fighter', 4)});
    const cf = H.calc(fighter, rb);
    eq(H.featOk(f('Ritual Caster'), cf, rb, fighter), {ok: false, hiany: ['INT 13 vagy WIS 13']});
    eq(H.featOk(f('War Caster'), cf, rb, fighter), {ok: false, hiany: ['varázsolni kell tudni']});
    ok(H.featOk(f('Heavy Armor Master'), cf, rb, fighter).ok && H.featOk(f('Fighting Initiate'), cf, rb, fighter).ok, 'a Fighter jártas heavy armorban és martial fegyverben');
    ok(H.featOk(f('Squat Nimbleness'), cf, rb, fighter).ok, 'Dwarf');
    eq(H.featOk(f('Drow High Magic'), cf, rb, fighter), {ok: false, hiany: ['faj: Elf (drow)']});
    eq(H.featOk(f('Alert'), cf, rb, fighter), {ok: true, hiany: []}, 'feltétel nélkül');
    const cleric = mkS({race: 'Halfling|PHB', base: {wis: 14}, levels: lv('Cleric', 4)}), cc = H.calc(cleric, rb);
    ok(H.featOk(f('Ritual Caster'), cc, rb, cleric).ok && H.featOk(f('War Caster'), cc, rb, cleric).ok && H.featOk(f('Squat Nimbleness'), cc, rb, cleric).ok, 'WIS 13, varázsol, Small');
    eq(H.featOk(f('Heavy Armor Master'), cc, rb, cleric), {ok: false, hiany: ['heavy armor jártasság']});
    eq(H.featOk(f('Fighting Initiate'), cc, rb, cleric), {ok: false, hiany: ['martial weapons jártasság']});
    const drow = mkS({race: 'Elf|PHB', subrace: 'Drow|PHB', levels: [{c: 'Fighter'}]});
    ok(H.featOk(f('Drow High Magic'), H.calc(drow, rb), rb, drow).ok, 'Elf (Drow)');
    ok(H.featOk(f('Drow High Magic'), cf, rb, null).ok, 'lap nélkül a fajt nem nézi');
    // TCE: osztály-varázslás vagy Pact Magic kell, a faji varázslat nem elég; Paladin 1. szinten még nem varázsol; üres (nem ellenőrizhető) ág teljesül
    const ea = {n: 'Eldritch Adept', s: 'TCE', pq: [{cast: 'class'}]}, faji = {...cf, always: [{name: 'Light', level: 0, ref: ''}]};
    eq(H.featOk(ea, faji, rb, fighter), {ok: false, hiany: ['Spellcasting vagy Pact Magic kell']});
    ok(H.featOk(f('War Caster'), faji, rb, fighter).ok, 'a PHB-s feltételhez a faji varázslat is elég');
    ok(H.featOk(ea, cc, rb, cleric).ok, 'Cleric');
    const pal = mkS({race: 'Dwarf|PHB', levels: [{c: 'Paladin'}]});
    eq(H.featOk(f('War Caster'), H.calc(pal, rb), rb, pal).ok, false, 'Paladin 1. szinten még nem varázsol');
    ok(H.featOk({n: 'X', pq: [{ab: [{int: 13}]}, {}]}, cf, rb, fighter).ok, 'az üres ág teljesül');
    ok(H.featOk({n: 'Y', pq: [{ab: [null, {str: 13}], race: [null]}]}, cf, rb, fighter).ok, 'hibás elem nem dob');
    // a választóban: ⚠ a név előtt, az ok a megjegyzésben, és nem tiltott
    const asi = cf.choices.find(c => c.kind === 'asi');
    const o = H.choiceOptions(asi, cf, rb, fighter).opts, rc = o.find(x => x.v === 'Ritual Caster|PHB'), hm = o.find(x => x.v === 'Heavy Armor Master|PHB');
    eq([rc.l, rc.note, rc.warn, rc.dis], ['⚠ Ritual Caster', 'nem teljesül: INT 13 vagy WIS 13', true, false]);
    eq([hm.l, hm.warn], ['Heavy Armor Master', false]);
  });

  test('feat varázslat-választásai: Magic Initiate (lista → 2 cantrip + 1 első szintű, napi ingyenes), Fey Touched (iskola), Spell Sniper (támadó cantrip), Ritual Caster (ritual, erőforrás nélkül)', () => {
    const H = W.Sheet, rb = rb3();
    // a szabálykönyv-letöltő a valódi 5e.tools-alakból (rövidítve)
    const mi = W.addSpellsFx([{name: 'Bard Spells', ability: 'cha', innate: {_: {daily: {1: [{choose: 'level=1|class=Bard'}]}}}, known: {_: [{choose: 'level=0|class=Bard', count: 2}]}},
      {name: 'Wizard Spells', ability: 'int', innate: {_: {daily: {1: [{choose: 'level=1|class=Wizard'}]}}}, known: {_: [{choose: 'level=0|class=Wizard', count: 2}]}}], 'Magic Initiate');
    eq(mi, [{pickChoose: {label: 'Varázslatlista', from: ['Bard', 'Wizard'], then: {
      Bard: [{spellChoose: {from: {list: 'Bard'}, n: 2, label: 'Cantrip'}}, {spellChoose: {from: {list: 'Bard', l: 1}, n: 1, label: '1. szintű varázslat'}}, {res: {n: 'Magic Initiate: választott 1. szintű varázslat', max: 1, reset: 'long'}}],
      Wizard: [{spellChoose: {from: {list: 'Wizard'}, n: 2, label: 'Cantrip'}}, {spellChoose: {from: {list: 'Wizard', l: 1}, n: 1, label: '1. szintű varázslat'}}, {res: {n: 'Magic Initiate: választott 1. szintű varázslat', max: 1, reset: 'long'}}]}}}]);
    const ft = W.addSpellsFx({ability: 'inherit', innate: {_: {daily: {'1e': ['misty step', {choose: 'level=1|school=E;D'}]}}}}, 'Fey Touched');
    eq(ft, [{spells: [{t: 'innate', lvl: 1, sp: ['misty step']}]}, {spellChoose: {from: {l: 1, sch: ['enchantment', 'divination']}, n: 1, label: '1. szintű varázslat'}},
      {res: {n: 'Fey Touched: Misty Step', max: 1, reset: 'long'}}, {res: {n: 'Fey Touched: választott 1. szintű varázslat', max: 1, reset: 'long'}}]);
    eq(W.addSpellsFx([{name: 'Wizard Spells', ability: 'int', known: {_: [{choose: 'level=0|class=Wizard|spell attack=m;r;o', count: 1}]}}, {name: 'Bard Spells', known: {_: [{choose: 'level=0|class=Bard|spell attack=m;r;o'}]}}], 'Spell Sniper')[0].pickChoose.then.Wizard,
      [{spellChoose: {from: {list: 'Wizard', atk: true}, n: 1, label: 'Cantrip'}}]);
    eq(W.addSpellsFx([{name: 'Wizard Spells', innate: {_: {daily: {1: [{choose: 'level=1|class=Wizard|components & miscellaneous=ritual', count: 2}]}}}}, {name: 'Cleric Spells', innate: {}}], 'Ritual Caster')[0].pickChoose.then.Wizard,
      [{spellChoose: {from: {list: 'Wizard', l: 1, ri: true}, n: 2, label: '1. szintű varázslat'}}], 'ritualnál nincs ingyenes erőforrás');
    eq(W.addSpellsFx({innate: {_: {daily: {1: [{choose: 'level=1|class=Wizard'}]}}}}), [{todo: 'innate varázslat választása (1. szinttől)'}], 'nem featnél (faj, alosztály) a régi teendő marad');
    // a motor: Fighter 4, ASI helyett Magic Initiate (Wizard)
    rb.spells.push({n: 'Fire Bolt', s: 'PHB', l: 0, sc: 'evocation', atk: true, cl: ['Wizard']}, {n: 'Light', s: 'PHB', l: 0, sc: 'evocation', cl: ['Wizard', 'Cleric']},
      {n: 'Mage Hand', s: 'PHB', l: 0, sc: 'conjuration', cl: ['Wizard', 'Bard']}, {n: 'Shield', s: 'PHB', l: 1, sc: 'abjuration', cl: ['Wizard']},
      {n: 'Detect Magic', s: 'PHB', l: 1, sc: 'divination', ri: true, cl: ['Wizard', 'Cleric']}, {n: 'Charm Person', s: 'PHB', l: 1, sc: 'enchantment', cl: ['Wizard', 'Bard']}, {n: 'Misty Step', s: 'PHB', l: 2, sc: 'conjuration', cl: ['Wizard']});
    rb.feats.push({n: 'Magic Initiate', s: 'PHB', fx: mi}, {n: 'Fey Touched', s: 'TCE', fx: [{abChoose: {from: ['int', 'wis', 'cha'], n: 1, amt: 1}}, ...ft]});
    const base = {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 15, con: 14}, levels: lv('Fighter', 4)};
    let s = mkS({...base, ch: {'Fighter:4:asi': {feat: 'Magic Initiate|PHB'}}}), c = H.calc(s, rb);
    const pick = c.choices.find(x => x.key === 'feat:Magic Initiate|PHB:pick');
    ok(pick && !pick.done && pick.label === 'Varázslatlista', 'előbb a lista');
    s = mkS({...base, ch: {'Fighter:4:asi': {feat: 'Magic Initiate|PHB'}, 'feat:Magic Initiate|PHB:pick': ['Wizard']}}); c = H.calc(s, rb);
    const [can, l1] = ['feat:Magic Initiate|PHB:pick:Wizard:spell', 'feat:Magic Initiate|PHB:pick:Wizard:spell2'].map(k => c.choices.find(x => x.key === k));
    eq([l1.n, can.n, l1.label, can.label], [1, 2, '1. szintű varázslat', 'Cantrip'], 'a két választó címkéje eltér');
    eq(H.choiceOptions(can, c, rb).opts.map(o => o.l), ['Fire Bolt', 'Light', 'Mage Hand'], 'csak Wizard cantrip');
    eq(H.choiceOptions(l1, c, rb).opts.map(o => o.l), ['Charm Person', 'Detect Magic', 'Shield'], 'csak 1. szintű Wizard');
    s = mkS({...base, ch: {'Fighter:4:asi': {feat: 'Magic Initiate|PHB'}, 'feat:Magic Initiate|PHB:pick': ['Wizard'], [l1.key]: ['Shield|PHB'], [can.key]: ['Fire Bolt|PHB', 'Light|PHB']}}); c = H.calc(s, rb);
    ok(c.choices.filter(x => x.key.startsWith('feat:')).every(x => x.done), 'minden választás kész');
    ok(['Shield', 'Fire Bolt', 'Light'].every(n => c.always.some(a => a.name === n)), 'a választottak a lapon');
    eq(c.resources.filter(r => /Magic Initiate/.test(r.name)), [{name: 'Magic Initiate: választott 1. szintű varázslat', max: 1, reset: 'long'}]);
    eq(c.todos.filter(t => t.kind === 'manual'), [], 'nincs ✋ teendő');
    // Fey Touched: csak divination / enchantment 1. szintű
    s = mkS({...base, ch: {'Fighter:4:asi': {feat: 'Fey Touched|TCE'}}}); c = H.calc(s, rb);
    eq(H.choiceOptions(c.choices.find(x => x.key === 'feat:Fey Touched|TCE:spell'), c, rb).opts.map(o => o.l), ['Charm Person', 'Detect Magic']);
    ok(c.always.some(a => a.name === 'Misty Step'), 'a fix varázslat');
    // Spell Sniper: csak támadó cantrip; Ritual Caster: csak ritual
    eq(H.choiceOptions({key: 'x', kind: 'spell', n: 1, ok: [], from: {list: 'Wizard', atk: true}}, c, rb).opts.map(o => o.l), ['Fire Bolt']);
    eq(H.choiceOptions({key: 'y', kind: 'spell', n: 2, ok: [], from: {list: 'Wizard', l: 1, ri: true}}, c, rb).opts.map(o => o.l), ['Detect Magic']);
  });

  test('feat egyéb választásai: optional feature (Martial Adept, Fighting Initiate), Skilled (skill vagy eszköz), Weapon Master (fegyverek), Artificer Initiate (artisan\'s tool), Elemental Adept; erőforrások', () => {
    const H = W.Sheet, rb = rb3();
    // a szabálykönyv-letöltő a valódi 5e.tools-alakból
    eq(W.featOptFx({optionalfeatureProgression: [{name: 'Maneuvers', featureType: ['MV:B'], progression: {'*': 2}}]}), [{optChoose: {label: 'Maneuvers', from: ['MV:B'], n: 2}}]);
    const skilled = W.profFx({skillToolLanguageProficiencies: [{choose: [{from: ['anySkill', 'anyTool'], count: 3}]}]}, 'Skilled')[0].pickChoose;
    eq([skilled.label, skilled.n, skilled.from.length, skilled.then.Athletics, skilled.then['Sleight of Hand'], skilled.then["thieves' tools"]],
      ['Skill vagy eszköz', 3, 18 + 39, [{skill: {athletics: 1}}], [{skill: {'sleight-of-hand': 1}}], [{tool: ["thieves' tools"]}]]);
    eq(W.profFx({weaponProficiencies: [{choose: {fromFilter: 'type=martial weapon', count: 4}}]}, 'Weapon Master')[0].pickChoose.n, 4);
    eq(W.profFx({weaponProficiencies: [{choose: {fromFilter: 'x', count: 4}}]}), [{todo: 'Fegyver-jártasság választása'}], 'nem featnél a régi teendő');
    eq(W.profFx({toolProficiencies: [{anyArtisansTool: 1}]}, 'Artificer Initiate')[0].toolChoose.n, 1);
    eq(W.profFx({toolProficiencies: [{anyArtisansTool: 1}]}), [], 'nem featnél (háttér) nem változik');
    eq(W.profFx({skillToolLanguageProficiencies: [{choose: [{from: ['anySkill', 'anyTool'], count: 3}]}]}), [{todo: 'Skill / eszköz / nyelv választása (3)'}], 'nem featnél a régi teendő');
    // a motor
    rb.optfeatures.push({n: 'Riposte', s: 'PHB', t: ['MV:B'], tx: 'R'}, {n: 'Parry', s: 'PHB', t: ['MV:B'], tx: 'P'}, {n: 'Trip Attack', s: 'PHB', t: ['MV:B'], tx: 'T'});
    rb.feats.push({n: 'Martial Adept', s: 'PHB', fx: W.featOptFx({optionalfeatureProgression: [{name: 'Maneuvers', featureType: ['MV:B'], progression: {'*': 2}}]})},
      {n: 'Fighting Initiate', s: 'TCE', fx: W.featOptFx({optionalfeatureProgression: [{name: 'Fighting Style', featureType: ['FS:F'], progression: {'*': 1}}]})},
      {n: 'Skilled', s: 'PHB', fx: W.profFx({skillToolLanguageProficiencies: [{choose: [{from: ['anySkill', 'anyTool'], count: 3}]}]}, 'Skilled')},
      {n: 'Weapon Master', s: 'PHB', fx: W.profFx({weaponProficiencies: [{choose: {fromFilter: 'x', count: 4}}]}, 'Weapon Master')}, {n: 'Elemental Adept', s: 'PHB'});
    const base = {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 15, con: 14}, levels: lv('Fighter', 8)};
    let s = mkS({...base, ch: {'Fighter:4:asi': {feat: 'Martial Adept|PHB'}, 'Fighter:6:asi': {feat: 'Fighting Initiate|TCE'}, 'Fighter:opt:Fighting Style': ['Archery|PHB'], 'Fighter:8:asi': {feat: 'Skilled|PHB'}}});
    let c = H.calc(s, rb);
    const mv = c.choices.find(x => x.key === 'feat:Martial Adept|PHB:opt'), fs = c.choices.find(x => x.key === 'feat:Fighting Initiate|TCE:opt');
    eq([mv.n, mv.label, fs.n], [2, 'Maneuvers', 1]);
    eq(H.choiceOptions(mv, c, rb).opts.map(o => o.l), ['Riposte', 'Parry', 'Trip Attack']);
    eq(H.choiceOptions(fs, c, rb).opts.map(o => [o.l, o.dis]), [['Defense', false], ['Archery', true]], 'az osztály stílusa nem választható újra');
    ok(c.resources.some(r => r.name === 'Superiority Die (Martial Adept, d6)' && r.max === 1 && r.reset === 'short'), 'erőforrás');
    s = mkS({...base, ch: {...s.build.ch, 'feat:Martial Adept|PHB:opt': ['Riposte|PHB', 'Parry|PHB'], 'feat:Fighting Initiate|TCE:opt': ['Defense|PHB'], 'feat:Skilled|PHB:pick': ['Stealth', "thieves' tools", 'Arcana']}},
      {inventory: inv('Chain Mail')});
    c = H.calc(s, rb);
    ok(['Riposte', 'Parry', 'Defense'].every(n => c.features.some(f => f.name === n)), 'a választott optional feature-ök a jellemzők közt');
    eq(c.ac.v, 17, 'Chain Mail 16 + Defense 1');
    eq([c.skills.stealth.prof, c.skills.arcana.prof, /thieves' tools/.test(c.profs.tools)], [1, 1, true], 'Skilled: skill és eszköz');
    ok(c.choices.filter(x => x.key.startsWith('feat:')).every(x => x.done), 'minden kész');
    s = mkS({...base, ch: {'Fighter:4:asi': {feat: 'Weapon Master|PHB'}, 'feat:Weapon Master|PHB:pick': ['Whip', 'Net'], 'Fighter:6:asi': {feat: 'Elemental Adept|PHB'}, 'feat:Elemental Adept|PHB:pick': ['Fire']}});
    c = H.calc(s, rb);
    ok(/whip/i.test(c.profs.weapons) && /net/i.test(c.profs.weapons), 'Weapon Master: fegyver-jártasság');
    eq(c.choices.find(x => x.key === 'feat:Weapon Master|PHB:pick').done, false, 'a 4-ből 2 még hiányzik');
    ok(c.features.some(f => f.name === 'Sebzéstípus: Fire'), 'Elemental Adept');
    // Eldritch Adept: előfeltételes invocation (szint, pact, egyéb) csak Warlocknak; az osztály helyén a szintfeltételes is megjelenik
    rb.optfeatures.push({n: 'Armor of Shadows', s: 'PHB', t: ['EI'], tx: 'A'}, {n: 'Thirsting Blade', s: 'XGE', t: ['EI'], lv: 5, pact: 'Blade', pre: 'level 5, Pact of the Blade'},
      {n: 'Book of Ancient Secrets', s: 'PHB', t: ['EI'], pact: 'Tome', pre: 'Pact of the Tome'}, {n: 'Agonizing Blast', s: 'PHB', t: ['EI'], pre: 'eldritch blast cantrip'}, {n: 'Mask of Many Faces', s: 'PHB', t: ['EI']});
    rb.feats.push({n: 'Eldritch Adept', s: 'TCE', fx: W.featOptFx({optionalfeatureProgression: [{name: 'Eldritch Invocations', featureType: ['EI'], progression: {'*': 1}}]})});
    s = mkS({...base, ch: {'Fighter:4:asi': {feat: 'Eldritch Adept|TCE'}, 'feat:Eldritch Adept|TCE:opt': ['Agonizing Blast|PHB']}}); c = H.calc(s, rb);
    const ea = c.choices.find(x => x.key === 'feat:Eldritch Adept|TCE:opt');
    eq(H.choiceOptions(ea, c, rb).opts.map(o => o.l), ['Armor of Shadows', 'Mask of Many Faces'], 'feltétel nélküliek');
    eq([ea.ok, ea.done], [[], false], 'a feltételes a számolásban sem érvényes');
    eq(H.choiceOptions({key: 'w', kind: 'opt', n: 2, ok: [], from: ['EI'], ctx: {cls: 'Warlock', lvl: 5}}, c, rb).opts.map(o => o.l),
      ['Armor of Shadows', 'Thirsting Blade', 'Book of Ancient Secrets', 'Agonizing Blast', 'Mask of Many Faces'], 'Warlock 5: a szintfeltételes is');
    // fordítva: a Fighting Initiate stílusa a Fighter saját helyén tiltott
    s = mkS({...base, ch: {'Fighter:4:asi': {feat: 'Fighting Initiate|TCE'}, 'feat:Fighting Initiate|TCE:opt': ['Archery|PHB']}}); c = H.calc(s, rb);
    eq(H.choiceOptions(c.choices.find(x => x.key === 'Fighter:opt:Fighting Style'), c, rb).opts.map(o => [o.l, o.dis]), [['Defense', false], ['Archery', true]]);
  });

  test('TCE opcionális feature-ök: igen / nem választás; csere (Ranger, Life Cleric 8), követő (Deft Explorer Improvement), hatások; bővített varázslatlista; XGE / TCE jelölés', () => {
    const H = W.Sheet, rb = rb3();
    const ranger = rb.classes.find(c => c.n === 'Ranger');
    ranger.feats.push({n: 'Favored Foe', lvl: 1, opt: true}, {n: 'Natural Explorer', lvl: 1}, {n: 'Deft Explorer', lvl: 1, opt: true}, {n: 'Deft Explorer Improvement', lvl: 6, opt: true});
    rb.features.push({n: 'Favored Foe', cls: 'Ranger', lvl: 1, s: 'TCE', opt: true, tx: 'Foe.'}, {n: 'Divine Strike', cls: 'Cleric', sub: 'Life', ss: 'PHB', lvl: 8, s: 'PHB', tx: 'DS.'},
      {n: 'Blessed Strikes', cls: 'Cleric', sub: 'Life', ss: 'PHB', lvl: 8, s: 'TCE', opt: true, tx: 'BS.'});
    const base = {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 10, dex: 15, wis: 14}, levels: lv('Ranger', 6)};
    let c = H.calc(mkS(base), rb);
    eq(c.choices.filter(x => x.kind === 'tce').map(x => [x.key, x.done]), [['Ranger:tce:Favored Foe', false], ['Ranger:tce:Deft Explorer', false]], 'a követőnek nincs külön választása');
    ok(['Favored Enemy', 'Natural Explorer'].every(n => c.features.some(f => f.name === n)) && !c.features.some(f => /Favored Foe|Deft Explorer/.test(f.name)), 'alapból a PHB');
    eq(H.choiceOptions(c.choices.find(x => x.key === 'Ranger:tce:Favored Foe'), c, rb).opts.map(o => o.v), ['igen', 'nem']);
    let s = mkS({...base, ch: {'Ranger:tce:Favored Foe': 'igen', 'Ranger:tce:Deft Explorer': 'igen', 'Ranger:tce:Deft Explorer:1:lang': ['Elvish', 'Orc']}}); c = H.calc(s, rb);
    eq(c.features.filter(f => /Favored|Explorer/.test(f.name)).map(f => [f.name, f.src]), [['Favored Foe', 'Ranger 1 (TCE)'], ['Deft Explorer', 'Ranger 1 (TCE)'], ['Deft Explorer Improvement', 'Ranger 6 (TCE)']], 'csere + követő');
    eq(c.features.find(f => f.name === 'Favored Foe').text, 'Foe.');
    ok(c.resources.some(r => r.name === 'Favored Foe' && r.max === 3), 'Favored Foe: PB-szer');
    eq(c.speed.v, '35 ft.', 'Deft Explorer Improvement (6.): +5 ft');
    ok(c.choices.some(x => x.key === 'Ranger:tce:Deft Explorer:1:expertise') && c.choices.find(x => x.key === 'Ranger:tce:Deft Explorer:1:lang').done, 'Deft Explorer választásai');
    ok(!c.todos.some(t => /Favored Enemy/.test(t.text)), 'a PHB-feature ✋ teendője is eltűnik');
    s = mkS({...base, ch: {'Ranger:tce:Favored Foe': 'nem', 'Ranger:tce:Deft Explorer': 'nem'}}); c = H.calc(s, rb);
    ok(c.choices.filter(x => x.kind === 'tce').every(x => x.done) && c.features.some(f => f.name === 'Favored Enemy'), 'nem: kész, marad a PHB');
    // alosztály: Life Cleric 8 – Divine Strike vagy Blessed Strikes
    const cb = {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {wis: 15}, levels: lv('Cleric', 8), sub: {Cleric: 'Life|PHB'}};
    c = H.calc(mkS(cb), rb);
    eq([c.features.some(f => f.name === 'Divine Strike'), c.features.some(f => f.name === 'Blessed Strikes'), c.choices.some(x => x.key === 'Cleric:tce:Blessed Strikes')], [true, false, true]);
    c = H.calc(mkS({...cb, ch: {'Cleric:tce:Blessed Strikes': 'igen'}}), rb);
    eq([c.features.some(f => f.name === 'Divine Strike'), c.features.find(f => f.name === 'Blessed Strikes')?.src], [false, 'Life 8 (TCE)']);
    // bővített varázslatlista és jelölés (Wizard: XGE cantrip a listán, TCE-s csak elfogadva)
    rb.spells.push({n: 'Toll the Dead', s: 'XGE', l: 0, sc: 'necromancy', cl: ['Cleric', 'Wizard'], clx: ['Cleric', 'Wizard']}, {n: 'Fire Bolt', s: 'PHB', l: 0, sc: 'evocation', cl: ['Wizard']},
      {n: 'Mind Whip', s: 'TCE', l: 2, sc: 'enchantment', cl: ['Sorcerer'], clt: ['Wizard']}, {n: 'Magic Missile', s: 'PHB', l: 1, sc: 'evocation', cl: ['Wizard']});
    const wb = {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {int: 16}, levels: lv('Wizard', 3)};
    c = H.calc(mkS(wb), rb);
    const lista = c.choices.find(x => x.key === 'Wizard:tce:' + H.TCE_LISTA);
    eq([lista?.label, lista?.done], ['TCE bővített varázslatlista', false]);
    const opt = (cc, k) => H.choiceOptions(cc.choices.find(x => x.key === k), cc, rb).opts;
    eq(opt(c, 'Wizard:cantrips').filter(o => o.l !== 'Light').map(o => [o.l, o.note]), [['Fire Bolt', ''], ['Toll the Dead', 'XGE']], 'XGE jelölés');
    ok(!opt(c, 'Wizard:book').some(o => o.l === 'Mind Whip'), 'a TCE-s alapból nem');
    c = H.calc(mkS({...wb, ch: {['Wizard:tce:' + H.TCE_LISTA]: 'igen'}}), rb);
    eq(opt(c, 'Wizard:book').find(o => o.l === 'Mind Whip')?.note, 'TCE', 'elfogadva: választható, TCE jelöléssel');
    ok(H.spellOnList({cl: ['Sorcerer'], clt: ['Wizard']}, 'Wizard', true) && !H.spellOnList({cl: ['Sorcerer'], clt: ['Wizard']}, 'Wizard', false), 'spellOnList');
    // szintlépés: csak az ezen a szinten nyíló TCE-kérdés (kötelező), a korábbi nyitott nem; új karakter: nem kötelező
    ranger.feats.push({n: 'Primal Awareness', lvl: 3, opt: true});
    const r2 = mkS({...base, levels: lv('Ranger', 2)}), p = H.levelUpPlan(r2, rb, H.levelUpBuild(r2, 'Ranger')), pk = p.choices.map(x => x.c.key);
    ok(pk.includes('Ranger:tce:Primal Awareness') && !pk.includes('Ranger:tce:Favored Foe') && !pk.includes('Ranger:tce:Deft Explorer'), 'szintlépés: ' + pk);
    eq(p.choices.find(x => x.c.key === 'Ranger:tce:Primal Awareness').missing, 1, 'az ezen a szinten nyíló kérdés kötelező');
    const np = H.ncPlan(mkS({...base, levels: [{c: 'Ranger'}]}), rb), tceK = np.choices.filter(x => x.c.kind === 'tce');
    eq([tceK.length, tceK.every(x => x.missing === 0)], [2, true], 'új karakter: a TCE-kérdés látszik, de nem kötelező');
    // Primal Knowledge: 3. szinten 1, 10. szinten 2 skill
    rb.classes.find(c => c.n === 'Barbarian').feats.push({n: 'Primal Knowledge', lvl: 3, opt: true});
    const pkn = l => H.calc(mkS({race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 15}, levels: lv('Barbarian', l), ch: {'Barbarian:tce:Primal Knowledge': 'igen'}}), rb).choices.find(x => x.key === 'Barbarian:tce:Primal Knowledge:3:skills')?.n;
    eq([pkn(3), pkn(10)], [1, 2]);
  });

  test('azonos forrású ✋ teendők: mind látszik, külön pipálható; az első kulcsa a régi (a kipipált megmarad); azonos szöveg csak egyszer', () => {
    const H = W.Sheet, rb = rb3();
    rb.races.push({n: 'Kettősfaj', s: 'HB', sp: {walk: 30}, fx: [{todo: 'Válassz színt'}, {todo: 'Válassz elemet'}, {todo: 'Válassz színt'}]});
    const r = mkS({race: 'Kettősfaj|HB', levels: [{c: 'Fighter'}]});
    const keys = H.calc(r, rb).todos.filter(t => t.kind === 'manual').map(t => t.key);
    eq(keys.length, 2, 'két különböző teendő, a duplikált szöveg egyszer');
    ok(new Set(keys).size === 2, 'különböző kulcsok');
    ok(/Kettősfaj/.test(keys[0]) && !/–/.test(keys[0]), 'az első kulcsa a régi alak: ' + keys[0]);
    eq(H.calc(H.norm({...r, todoDone: [keys[0]]}), rb).todos.filter(t => t.kind === 'manual').map(t => t.key), [keys[1]], 'a régi kipipálás csak az elsőt rejti');
    eq(H.calc(H.norm({...r, todoDone: keys}), rb).todos.filter(t => t.kind === 'manual'), [], 'mindkettő kipipálható');
    // hosszú (homebrew) név: a kulcs a Sheet.norm 200 karakteres vágása után is egyezik, így a kipipált eltűnik
    const hosszu = 'Nagyon hosszú nevű homebrew faj '.repeat(4);
    rb.races.push({n: hosszu, s: 'HB', sp: {walk: 30}, fx: [{todo: 'Válassz színt'}, {todo: 'Válassz elemet ' + 'x'.repeat(150)}]});
    const r2 = mkS({race: hosszu + '|HB', levels: [{c: 'Fighter'}]});
    const k2 = H.calc(r2, rb).todos.filter(t => t.kind === 'manual').map(t => t.key);
    eq(k2.length, 2);
    ok(k2.every(k => k.length <= 200), 'a kulcs legfeljebb 200 karakter');
    eq(H.calc(H.norm({...r2, todoDone: k2}), rb).todos.filter(t => t.kind === 'manual'), [], 'hosszú névvel is kipipálható');
  });

  test('támadások sorrendje: az újraszámolás (materialize) a lapon beállított sorrendet tartja, azonos nevű tételekkel is; az új tétel a számolt helyén', () => {
    const H = W.Sheet, rb = rb3();
    const s = mkS({base: {str: 16, dex: 14}, levels: lv('Fighter', 1)}, {inventory: inv('+1 Longsword'),
      attacks: [{name: 'Dagger', hit: '+5', dmg: '1d4+3'}, {name: 'Saját ütés', hit: '+1', dmg: '1d4'}, {name: 'Dagger', hit: '+5', dmg: '1d4+3', note: 'dobva'}]});
    const s2 = H.norm({...s, ...H.materialize(s, H.calc(s, rb))});
    eq(s2.attacks.map(a => a.name), ['+1 Longsword', 'Dagger', 'Saját ütés', 'Dagger'], 'az új számolt tétel elöl, a sajátok a sorrendjükben');
    // a játékos átrendezi: a két Dagger körbe, a kard középre
    const at = s2.attacks, s3 = H.norm({...s2, attacks: [at[3], at[2], at[0], at[1]]});
    const s4 = H.norm({...s3, ...H.materialize(s3, H.calc(s3, rb))});
    eq(s4.attacks.map(a => [a.name, a.note || '']), [['Dagger', 'dobva'], ['Saját ütés', ''], ['+1 Longsword', at[0].note], ['Dagger', '']], 'megmaradt, a két Dagger sem cserélődött');
    eq(H.regiSorrend([{name: 'X'}, {name: 'y'}, {name: 'X', n: 2}], [{name: 'X'}, {name: 'X', n: 2}, {name: 'Y'}]).map(x => x.n || 1), [1, 1, 2], 'azonos nevűek: előfordulás szerint');
  });
  test('Life Cleric 3 / Wizard 1: mindig bekészített domain spellek, két varázsló osztály, kiírás a lapra (saját tételek maradnak), cache', () => {
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

// Az aranyminta bemenete: kitalált szabálykönyv és lapok (nem valódi adat, nincs benne szabályszöveg). Szándékosan nem az rb3-at használja, hogy annak bővítése ne írja át a mintát (az R20, ASI, lv, inv, mkS segédek közösek).
const rbArany = () => ({
  classes: [
    {n: 'Barbarian', s: 'PHB', hd: 12, saves: ['str', 'con'], fx: [{armor: ['light', 'medium', 'shields']}, {weapon: ['simple', 'martial']}], mc: {fx: [{armor: ['shields']}, {weapon: ['simple', 'martial']}]},
      subLvl: 3, asi: ASI, cols: [{l: 'Rages', v: R20(l => l < 3 ? 2 : l < 6 ? 3 : 4)}],
      feats: [{n: 'Rage', lvl: 1}, {n: 'Unarmored Defense', lvl: 1}, {n: 'Ability Score Improvement', lvl: 4}, {n: 'Fast Movement', lvl: 5}]},
    {n: 'Monk', s: 'PHB', hd: 8, saves: ['str', 'dex'], fx: [{weapon: ['simple weapons', 'shortswords']}], mc: {fx: [{weapon: ['simple', 'shortswords']}]}, subLvl: 3, asi: ASI,
      cols: [{l: 'Martial Arts', v: R20(l => l < 5 ? '1d4' : l < 11 ? '1d6' : '1d8')}, {l: 'Ki Points', v: R20(l => l < 2 ? 0 : l)}, {l: 'Unarmored Movement', v: R20(l => l < 2 ? 0 : l < 6 ? 10 : 15)}],
      feats: [{n: 'Unarmored Defense', lvl: 1}, {n: 'Martial Arts', lvl: 1}, {n: 'Ki', lvl: 2}, {n: 'Unarmored Movement', lvl: 2}, {n: 'Diamond Soul', lvl: 14}]},
    {n: 'Fighter', s: 'PHB', hd: 10, saves: ['str', 'con'], fx: [{armor: ['light', 'medium', 'heavy', 'shields']}, {weapon: ['simple', 'martial']}], mc: {fx: [{armor: ['light', 'medium', 'shields']}, {weapon: ['simple', 'martial']}]},
      subLvl: 3, asi: [4, 6, 8, 12, 14, 16, 19], opt: [{n: 'Fighting Style', t: ['FS:F'], p: R20(() => 1)}],
      feats: [{n: 'Second Wind', lvl: 1}, {n: 'Opcionális', lvl: 1, opt: true}, {n: 'Action Surge', lvl: 2}, {n: 'Martial Archetype', lvl: 3, sub: true}, {n: 'Martial Archetype feature', lvl: 7, sub: true}, {n: 'Indomitable', lvl: 9}]},
    {n: 'Rogue', s: 'PHB', hd: 8, saves: ['dex', 'int'], fx: [{armor: ['light']}, {weapon: ['simple', 'rapiers']}, {tool: ["thieves' tools"]}, {skillChoose: {from: ['acrobatics', 'perception', 'stealth', 'sleight-of-hand', 'arcana'], n: 4}}],
      mc: {fx: [{armor: ['light']}, {skillChoose: {from: ['stealth', 'perception'], n: 1}}]}, subLvl: 3, asi: [4, 8, 10, 12, 16, 19], feats: [{n: 'Expertise', lvl: 1}, {n: 'Slippery Mind', lvl: 15}]},
    {n: 'Wizard', s: 'PHB', hd: 6, saves: ['int', 'wis'], caster: 'full', ab: 'int', prep: 'lvl+int', cantrips: R20(() => 3), subLvl: 2, asi: ASI, feats: [{n: 'Arcane Recovery', lvl: 1}]},
    {n: 'Cleric', s: 'PHB', hd: 8, saves: ['wis', 'cha'], fx: [{armor: ['light', 'medium', 'shields']}, {skillChoose: {from: ['history', 'insight', 'medicine'], n: 2}}], mc: {fx: [{armor: ['light', 'medium', 'shields']}]},
      caster: 'full', ab: 'wis', cantrips: R20(l => l), prep: 'lvl+wis', subLvl: 1, asi: ASI, feats: [{n: 'Channel Divinity', lvl: 2}]},
    {n: 'Bard', s: 'PHB', hd: 8, saves: ['dex', 'cha'], fx: [{skillChoose: {from: 'any', n: 3}}], mc: {fx: [{skillChoose: {from: 'any', n: 1}}]}, caster: 'full', ab: 'cha', cantrips: R20(() => 2), known: R20(l => l + 3), subLvl: 3, asi: ASI,
      feats: [{n: 'Bardic Inspiration', lvl: 1}, {n: 'Jack of All Trades', lvl: 2}, {n: 'Expertise', lvl: 3}]},
    {n: 'Paladin', s: 'PHB', hd: 10, saves: ['wis', 'cha'], fx: [{armor: ['light', 'medium', 'heavy', 'shields']}, {weapon: ['simple', 'martial']}], mc: {fx: [{armor: ['light', 'medium', 'shields']}]}, caster: 'half', ab: 'cha', prep: 'lvl/2+cha',
      subLvl: 3, asi: ASI, feats: [{n: 'Divine Sense', lvl: 1}, {n: 'Lay on Hands', lvl: 1}, {n: 'Aura of Protection', lvl: 6}], opt: [{n: 'Fighting Style', t: ['FS:P'], p: R20(l => l >= 2 ? 1 : 0)}]},
    {n: 'Warlock', s: 'PHB', hd: 8, saves: ['wis', 'cha'], fx: [{armor: ['light']}], caster: 'pact', ab: 'cha', cantrips: R20(l => l), known: R20(l => l + 1), subLvl: 1, asi: ASI,
      opt: [{n: 'Eldritch Invocations', t: ['EI'], p: R20(l => l < 2 ? 0 : l < 3 ? 2 : 3)}], feats: [{n: 'Mystic Arcanum (6th level)', lvl: 11}]},
    {n: 'Sorcerer', s: 'PHB', hd: 6, saves: ['con', 'cha'], caster: 'full', ab: 'cha', cantrips: R20(() => 4), known: R20(l => l + 1), subLvl: 1, asi: ASI,
      cols: [{l: 'Sorcery Points', v: R20(l => l < 2 ? 0 : l)}], feats: [{n: 'Font of Magic', lvl: 2}]},
    {n: 'Ranger', s: 'PHB', hd: 10, saves: ['str', 'dex'], caster: 'half', ab: 'wis', subLvl: 3, asi: ASI, feats: [{n: 'Favored Enemy', lvl: 1}]},
    {n: 'Próbaosztály', s: 'HB', hd: 7, saves: [], subLvl: 2, asi: [],
      cols: [{l: 'Korlát', v: R20(() => 'Unlimited')}, {l: 'Mozgás', v: R20(l => l * 5)}, {l: 'Szöveg', v: R20(() => '3 alkalom')}],
      mc: {fx: [{res: {n: 'Szám', max: 2, reset: 'rossz'}}, {res: {n: 'Oszlop', max: 'col:Korlát', reset: 'short'}}, {res: {n: 'Szöveges oszlop', max: 'col:Szöveg', reset: 'none'}},
        {res: {n: 'Pb', max: 'pb'}}, {res: {n: 'Szint', max: 'lvl', add: 1}}, {res: {n: 'Szint×', max: 'lvl*3'}}, {res: {n: 'Nulla', max: 0}}, {res: {n: 'Mod', max: 'mod:int', min: 1, shortAt: 3}},
        {res: {n: 'Lépcső', max: {lv: {1: 1, 3: 2, 9: 5}}}}, {res: {n: 'Kétszer', max: 1}}, {res: {n: 'Kétszer', max: 3, reset: 'short'}}, {res: {n: 'Kétszer', max: 3, reset: 'long'}}, {res: {n: 'Kétszer', max: 2}}, {res: {max: 5}},
        {speed: {v: 'col:Mozgás'}}, {speed: {v: 0}}, {weapon: ['dag']}, {abSet: {wis: 15}}, {abSet: {wis: 12}}, {saveBonus: {ab: 'int', min: 2}}, {saveBonus: {ab: 'nincs'}}, {hpPerClassLevel: 2}, {passive: {perception: 2, insight: 3}},
        {init: 2}, {dv: 30}, {dv: 120}, {resist: ['fire', 'Fire', 'cold']}, {mamCap: 1}, {rangedAtk: 1}, {rangedAtk: 1}, {duelDmg: 1}, {duelDmg: 3}, {lang: ['Common', 'common', 'Égi']},
        {spells: [{t: 'known', lvl: 1, sp: ['detect magic', 'kitalált varázs']}, {t: 'expanded', lvl: 1, sp: ['revivify']}, {t: 'innate', lvl: 9, sp: ['túl magas szint']}, 'nem objektum']}, {todo: 'Kétszer felsorolt teendő'}, {todo: 'Kétszer felsorolt teendő'}]},
      feats: []}],
  subclasses: [
    {n: 'Champion', short: 'Champion', cls: 'Fighter', s: 'PHB'},
    {n: 'Battle Master', short: 'Battle Master', cls: 'Fighter', s: 'PHB', opt: [{n: 'Maneuvers', t: ['MV'], p: R20(l => l < 3 ? 0 : 3)}]},
    {n: 'Life Domain', short: 'Life', cls: 'Cleric', s: 'PHB', fx: [{spells: [{t: 'prepared', lvl: 1, sp: ['bless', 'cure wounds']}, {t: 'prepared', lvl: 3, sp: ['spiritual weapon']}, {t: 'prepared', lvl: 7, sp: ['revivify']}]}]},
    {n: 'Knowledge Domain', short: 'Knowledge', cls: 'Cleric', s: 'PHB'},
    {n: 'Oath of Devotion', short: 'Devotion', cls: 'Paladin', s: 'PHB', fx: [{spells: [{t: 'prepared', lvl: 3, sp: ['Bless', 'shield of faith']}]}]},
    {n: 'The Fiend', short: 'Fiend', cls: 'Warlock', s: 'PHB', fx: [{spells: [{t: 'expanded', lvl: 1, sp: ['burning hands']}]}]},
    {n: 'Draconic Bloodline', short: 'Draconic', cls: 'Sorcerer', s: 'PHB'},
    {n: 'Próbamágus', short: 'Próbamágus', cls: 'Próbaosztály', s: 'HB', caster: 'third', ab: 'cha', cantrips: R20(l => l), known: R20(l => l + 2)}, {n: 'Hibás', short: 'Hibás', cls: 'Ranger', s: 'HB', caster: 'third'}],
  features: [{n: 'Rage', cls: 'Barbarian', lvl: 1, s: 'PHB', tx: 'Próbaszöveg: düh.'}, {n: 'Improved Critical', cls: 'Fighter', sub: 'Champion', ss: 'PHB', lvl: 3, s: 'PHB', tx: 'Próbaszöveg: kritikus.'},
    {n: 'Remarkable Athlete', cls: 'Fighter', sub: 'Champion', ss: 'PHB', lvl: 7, s: 'PHB', tx: 'Próbaszöveg: atléta.'}, {n: 'Combat Superiority', cls: 'Fighter', sub: 'Battle Master', ss: 'PHB', lvl: 3, s: 'PHB'},
    {n: 'Student of War', cls: 'Fighter', sub: 'Battle Master', ss: 'PHB', lvl: 3, s: 'PHB'}, {n: 'Bonus Proficiency', cls: 'Cleric', sub: 'Life', ss: 'PHB', lvl: 1, s: 'PHB'},
    {n: 'Blessings of Knowledge', cls: 'Cleric', sub: 'Knowledge', ss: 'PHB', lvl: 1, s: 'PHB'}, {n: 'Draconic Resilience', cls: 'Sorcerer', sub: 'Draconic', ss: 'PHB', lvl: 1, s: 'PHB'},
    {n: 'Dragon Ancestor', cls: 'Sorcerer', sub: 'Draconic', ss: 'PHB', lvl: 1, s: 'PHB'}, {n: 'Későbbi képesség', cls: 'Sorcerer', sub: 'Draconic', ss: 'PHB', lvl: 18, s: 'PHB'}],
  races: [
    {n: 'Dwarf', s: 'PHB', sp: {walk: 25}, fx: [{ab: {con: 2}}, {lang: ['Common', 'Dwarvish']}, {dv: 60}, {resist: ['poison']}], traits: [{n: 'Stonecunning', tx: 'Próbaszöveg: kő.'}], subs: 1},
    {n: 'Human', s: 'PHB', sp: {walk: 30}, fx: [{lang: ['Common']}], subs: 2},
    {n: 'Elf', s: 'PHB', sp: {walk: 30}, fx: [{ab: {dex: 2}}, {dv: 60}, {skill: {perception: 1}}, {save: ['nem-kepesseg']}], subs: 2},
    {n: 'Half-Orc', s: 'PHB', fx: [{ab: {str: 2, con: 1}}, {dv: 60}, {skill: {intimidation: true, 'nincs ilyen': 1}}], traits: [{n: 'Relentless Endurance', tx: 'Próbaszöveg.'}]},
    {n: 'Dragonborn', s: 'PHB', fx: [{ab: {str: 2, cha: 1}}], traits: [{n: 'Draconic Ancestry'}, {n: 'Breath Weapon'}]},
    {n: 'Próbafaj', s: 'HB', sp: {walk: 40, fly: 50, climb: 20, burrow: 10, swim: 0}, fx: ['nem objektum', null, {skillChoose: {from: 'any', n: 1}}, {skillChoose: {from: 'any', n: 1}}, {spells: [{t: 'innate', lvl: 1, sp: ['detect magic']}, {t: 'innate', lvl: 19, sp: ['túl magas faji']}]}]}],
  subraces: [
    {n: 'Hill', race: 'Dwarf', s: 'PHB', fx: [{ab: {wis: 1}}], traits: [{n: 'Dwarven Toughness', tx: 'Próbaszöveg.'}]},
    {n: 'Human (alap)', race: 'Human', s: 'PHB', fx: [{ab: {str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1}}]},
    {n: 'Variant', race: 'Human', s: 'PHB', fx: [{abChoose: {from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], n: 2, amt: 1}}, {feat: {n: 1}}], ow: ['ab', 'abChoose']},
    {n: 'Wood', race: 'Elf', s: 'PHB', sp: {walk: 35}, fx: [{ab: {wis: 1}}]},
    {n: 'Sea', race: 'Elf', s: 'PHB', sp: {swim: 30}, fx: [{ab: {con: 1}}]},
    {n: 'Felülíró', race: 'Elf', s: 'HB', fx: [{ab: {int: 1}}], ow: ['ab']}],
  backgrounds: [
    {n: 'Acolyte', s: 'PHB', fx: [{skill: {insight: true, religion: true}}, {langChoose: {n: 2}}], feature: {n: 'Próbamenedék', tx: 'Próbaszöveg.'}},
    {n: 'Criminal', s: 'PHB', fx: [{skill: {deception: true, stealth: true, perception: true}}, {toolChoose: {from: ["Thieves' Tools", 'dice set'], n: 1}}], feature: {n: 'Próbakapcsolat'}}],
  feats: [
    {n: 'Alert', s: 'PHB', tx: 'Próbaszöveg.'}, {n: 'Tough', s: 'PHB'}, {n: 'Mobile', s: 'PHB'}, {n: 'Observant', s: 'PHB', fx: [{ab: {wis: 1}}]}, {n: 'Lucky', s: 'PHB'}, {n: 'Medium Armor Master', s: 'PHB'},
    {n: 'Próbafeat', s: 'HB', fx: [{feat: {n: 1}}, {ab: {dex: 1}}]}, {n: 'Beágyazott', s: 'HB', fx: [{feat: {n: 1}}, {ab: {str: 1}}]}, {n: 'Túl mély', s: 'HB', fx: [{ab: {cha: 1}}]},
    {n: 'Resilient', s: 'HB', fx: [{abChoose: {from: ['con', 'wis'], n: 3, amt: 1}}, {saveChoose: {from: ['con', 'wis'], n: 3}}]}, {n: 'Linguist', s: 'HB', fx: [{langChoose: {from: ['Elvish', 'Giant'], n: 2}}, {saveAll: true}, {feat: {n: 2}}, {skillChoose: {n: 1}}]}],
  optfeatures: [
    {n: 'Defense', s: 'PHB', t: ['FS:F', 'FS:P'], tx: 'Próba.'}, {n: 'Archery', s: 'PHB', t: ['FS:F']}, {n: 'Dueling', s: 'PHB', t: ['FS:F', 'FS:P']},
    {n: 'Agonizing Blast', s: 'PHB', t: ['EI']}, {n: 'Beguiling Influence', s: 'PHB', t: ['EI'], fx: [{skillChoose: {from: ['deception', 'persuasion'], n: 2}}]}, {n: 'Későbbi', s: 'PHB', t: ['EI'], lv: 5}, {n: 'Pontos szint', s: 'PHB', t: ['EI'], lv: 2},
    {n: 'Evasive Footwork', s: 'PHB', t: ['MV']}, {n: 'Riposte', s: 'PHB', t: ['MV']}],
  baseItems: [
    {n: 'Leather Armor', s: 'PHB', tc: 'LA', ac: 11}, {n: 'Studded Leather', s: 'PHB', tc: 'LA', ac: 12}, {n: 'Half Plate', s: 'PHB', tc: 'MA', ac: 15}, {n: 'Chain Mail', s: 'PHB', tc: 'HA', ac: 16, str: '13'}, {n: 'Plate', s: 'PHB', tc: 'HA', ac: 18, str: '15'},
    {n: 'Shield', s: 'PHB', tc: 'S', ac: 2},
    {n: 'Longsword', s: 'PHB', tc: 'M', wc: 'martial', dmg: '1d8 slashing', d2: '1d10', pr: 'versatile', m: {weapon: true}},
    {n: 'Greatsword', s: 'PHB', tc: 'M', wc: 'martial', dmg: '2d6 slashing', pr: 'heavy, two-handed', m: {weapon: true}},
    {n: 'Rapier', s: 'PHB', tc: 'M', wc: 'martial', dmg: '1d8 piercing', pr: 'finesse', m: {weapon: true}},
    {n: 'Shortsword', s: 'PHB', tc: 'M', wc: 'martial', dmg: '1d6 piercing', pr: 'finesse, light', m: {weapon: true}},
    {n: 'Quarterstaff', s: 'PHB', tc: 'M', wc: 'simple', dmg: '1d6 bludgeoning', d2: '1d8', pr: 'versatile', m: {weapon: true}},
    {n: 'Dagger', s: 'PHB', tc: 'M', wc: 'simple', dmg: '1d4 piercing', pr: 'finesse, light, thrown', rg: '20/60', m: {weapon: true}},
    {n: 'Longbow', s: 'PHB', tc: 'R', wc: 'martial', dmg: '1d8 piercing', pr: 'heavy, two-handed', rg: '150/600', m: {weapon: true}},
    {n: 'Light Crossbow', s: 'PHB', tc: 'R', wc: 'simple', dmg: '1d8 piercing', pr: 'loading', rg: '80/320', m: {weapon: true}},
    {n: 'Greatclub', s: 'PHB', tc: 'M', wc: 'simple', dmg: '1d8 bludgeoning', pr: 'two-handed', m: {weapon: true}}, {n: 'Kötél', s: 'PHB'}, {n: 'Dobás nélküli bot', s: 'HB', tc: 'M', wc: 'simple'}],
  items: [
    {n: 'Cloak of Protection', s: 'DMG', att: 'requires attunement', bAc: 1, bS: 1}, {n: 'Ring of Protection', s: 'DMG', att: 'requires attunement', bAc: 1, bS: 1},
    {n: 'Gauntlets of Ogre Power', s: 'DMG', att: 'requires attunement', abS: {str: 19}}, {n: 'Amulet of Health', s: 'DMG', att: 'requires attunement', abS: {con: 19}},
    {n: 'Bracers of Defense', s: 'DMG', bAc: 2}, {n: 'Shield +2', s: 'DMG', tc: 'S', ac: 2, bAc: 2}, {n: 'Plate +1', s: 'DMG', tc: 'HA', ac: 18, str: '15', bAc: 1}],
  variants: [{n: '+1 Weapon', s: 'DMG', pre: '+1 ', bW: 1, req: [{weapon: true}]}],
  spells: [{n: 'Bless', s: 'PHB', l: 1}, {n: 'Cure Wounds', s: 'PHB', l: 1}, {n: 'Detect Magic', s: 'PHB', l: 1}, {n: 'Spiritual Weapon', s: 'PHB', l: 2}, {n: 'Revivify', s: 'PHB', l: 3}], conditions: []
});
// a varázslat-választásokhoz: kitalált listákkal és iskolákkal, EK / AT / Lore alosztállyal
const rbVarazs = () => {
  const rb = rbArany(), sp = (n, l, sc, ...cl) => ({n, s: 'PHB', l, sc, cl});
  rb.spells = [sp('Light', 0, 'evocation', 'Wizard', 'Sorcerer', 'Bard', 'Cleric'), sp('Fire Bolt', 0, 'evocation', 'Wizard', 'Sorcerer', 'Artificer'), sp('Mage Hand', 0, 'conjuration', 'Wizard', 'Sorcerer', 'Bard', 'Warlock'),
    sp('Vicious Mockery', 0, 'enchantment', 'Bard'), sp('Prestidigitation', 0, 'transmutation', 'Wizard'), sp('Guidance', 0, 'divination', 'Cleric', 'Druid'), sp('Shield', 1, 'abjuration', 'Wizard', 'Sorcerer'), sp('Magic Missile', 1, 'evocation', 'Wizard', 'Sorcerer'),
    sp('Sleep', 1, 'enchantment', 'Wizard', 'Sorcerer', 'Bard'), sp('Thunderwave', 1, 'evocation', 'Wizard', 'Sorcerer', 'Bard', 'Druid'), sp('Grease', 1, 'conjuration', 'Wizard', 'Sorcerer'), sp('Find Familiar', 1, 'conjuration', 'Wizard'),
    sp('Cure Wounds', 1, 'evocation', 'Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger'), sp('Bless', 1, 'enchantment', 'Cleric', 'Paladin'), sp('Hex', 1, 'enchantment', 'Warlock'), sp('Burning Hands', 1, 'evocation', 'Wizard', 'Sorcerer'),
    sp('Web', 2, 'conjuration', 'Wizard', 'Sorcerer'), sp('Spiritual Weapon', 2, 'evocation', 'Cleric'), sp('Fireball', 3, 'evocation', 'Wizard', 'Sorcerer'), sp('Revivify', 3, 'necromancy', 'Cleric', 'Paladin')];
  rb.subclasses.push({n: 'Eldritch Knight', short: 'Eldritch Knight', cls: 'Fighter', s: 'PHB', caster: 'third', ab: 'int', cantrips: R20(l => l < 3 ? 0 : 2), known: R20(l => l < 3 ? 0 : l + 1)},
    {n: 'Arcane Trickster', short: 'Arcane Trickster', cls: 'Rogue', s: 'PHB', caster: 'third', ab: 'int', cantrips: R20(l => l < 3 ? 0 : 3), known: R20(l => l < 3 ? 0 : l)},
    {n: 'College of Lore', short: 'Lore', cls: 'Bard', s: 'PHB'});
  rb.classes.find(c => c.n === 'Warlock').opt.push({n: 'Pact Boon', t: ['PB'], p: R20(l => l >= 3 ? 1 : 0)});
  rb.classes.find(c => c.n === 'Sorcerer').opt = [{n: 'Metamagic', t: ['MM'], p: R20(l => l < 3 ? 0 : l < 10 ? 2 : 3)}];
  rb.optfeatures.push({n: 'Pact of the Blade', s: 'PHB', t: ['PB']}, {n: 'Pact of the Chain', s: 'PHB', t: ['PB']}, {n: 'Quickened Spell', s: 'PHB', t: ['MM']}, {n: 'Twinned Spell', s: 'PHB', t: ['MM']}, {n: 'Subtle Spell', s: 'PHB', t: ['MM']});
  return rb;
};
const rolled = (c, ...hp) => hp.map(h => ({c, hp: h}));
const BASE_A = {str: 10, dex: 16, con: 14, int: 14, wis: 12, cha: 8};
// név → [lap, szabálykönyv]; minden új lapnál az aranymintát is rögzíteni kell (a módszer a tests/arany-calc.js elején)
const aranyLapok = () => {
  const H = W.Sheet;
  return {
    ures: [H.norm({}), null],
    konyvNelkul: [mkS({race: 'Dwarf|PHB', subrace: 'Hill|PHB', background: 'Acolyte|PHB', base: {str: 14, dex: 12, con: 13, int: 16, wis: 8, cha: 14},
      levels: [...lv('Fighter', 4), ...rolled('Warlock', 6, 1), {c: 'Artificer'}, ...lv('Paladin', 2)], sub: {Fighter: 'Eldritch Knight|PHB'}, ch: {'Fighter:4:asi': {feat: 'Alert|PHB'}}}, {inventory: inv('Chain Mail', 'Longsword')}), null],
    hianyosKonyv: [mkS({race: 'Nincs|X', subrace: 'Nincsalfaj|X', background: 'Nincsháttér|X', levels: lv('Barbarian', 4), sub: {Barbarian: 'Nincsalosztály|X'}, ch: {'Barbarian:4:asi': {feat: 'Nincsfeat|X'}}},
      {inventory: inv('Plate')}), {races: [], subraces: [], backgrounds: [], feats: []}],
    multiclass: [mkS({race: 'Elf|PHB', subrace: 'Wood|PHB', background: 'Criminal|PHB', base: BASE_A, levels: [...lv('Rogue', 2), ...rolled('Rogue', 7), ...rolled('Fighter', 9, null, 2), ...lv('Wizard', 2)], sub: {Fighter: 'Battle Master|PHB'},
      ch: {'Rogue:1:skills': ['stealth', 'Sleight of Hand', 'perception', 'acrobatics', 'arcana', 'nincs'], 'Rogue:1:expertise': ['stealth', 'sleight-of-hand', 'arcana'], 'bg:tool': ['dice set', 'nem választható'],
        'Fighter:opt:Fighting Style': ['Archery|PHB'], 'Fighter:Battle Master:opt:Maneuvers': ['Riposte|PHB', 'Riposte|PHB', 'Evasive Footwork|PHB', 'Nincs|PHB'], 'Fighter:3:tool': ["smith's tools"]}},
      {inventory: inv('Studded Leather', '+1 Rapier', 'Longbow', 'Light Crossbow', {name: 'Greatsword', equipped: false})}), rbArany()],
    pancelNelkulPajzzsal: [mkS({race: 'Dwarf|PHB', subrace: 'Hill|PHB', base: {str: 16, dex: 14, con: 15, wis: 16}, levels: [...lv('Barbarian', 5), ...lv('Monk', 6)], ch: {'Barbarian:4:asi': {con: 1, dex: 1}}},
      {inventory: inv('Shield', 'Quarterstaff', 'Shortsword', {name: 'Chain Mail', equipped: false})}), rbArany()],
    szerzetes: [mkS({race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 10, dex: 16, con: 12, wis: 16}, levels: lv('Monk', 14)}, {inventory: inv('Shortsword', 'Dagger', 'Greatsword', 'Light Crossbow', 'Quarterstaff', 'Longsword', 'Greatclub')}), rbArany()],
    szerzetesVarazsPajzzsal: [mkS({race: 'Elf|PHB', subrace: 'Sea|PHB', base: {str: 8, dex: 10, wis: 18}, levels: lv('Monk', 1)}, {inventory: inv('Shield +2', 'Dobás nélküli bot', 'Kötél')}), rbArany()],
    originVariant: [mkS({race: 'Human|PHB', subrace: 'Variant|PHB', origin: {str: 2, con: 1}, base: {str: 13, dex: 14, con: 14, cha: 15}, levels: [...rolled('Sorcerer', 3), ...lv('Sorcerer', 5)], sub: {Sorcerer: 'Draconic|PHB'},
      ch: {'subrace:feat': ['Próbafeat|HB'], 'feat:Próbafeat|HB:feat': ['Beágyazott|HB'], 'feat:Beágyazott|HB:feat': ['Túl mély|HB'], 'subrace:ability': ['str', 'dex']}}, {inventory: inv('Bracers of Defense')}), rbArany()],
    originElf: [mkS({race: 'Elf|PHB', subrace: 'Wood|PHB', origin: {cha: 2}, base: {dex: 10, wis: 14}, levels: lv('Cleric', 1), sub: {Cleric: 'Life|PHB'}, ch: {'Cleric:1:skills': ['history']}}, {inventory: inv('Leather Armor')}), rbArany()],
    utkozoKulcsok: [mkS({race: 'Próbafaj|HB', background: 'Acolyte|PHB', base: {str: 12, dex: 12, con: 12, int: 12, wis: 15, cha: 12}, levels: [...lv('Cleric', 12), ...lv('Bard', 4)], sub: {Cleric: 'Knowledge|PHB'},
      ch: {'race:skills': ['arcana'], 'race:skills2': ['Nature'], 'bg:lang': ['Elvish', 'elvish ', '', 5], 'Cleric:1:skills': ['history', 'history', 'athletics'], 'Cleric:1:lang': ['Giant'], 'Cleric:1:skills2': ['arcana', 'nature'], 'Cleric:1:expertise': ['arcana', 'athletics'],
        'Cleric:4:asi': {feat: 'Próbafeat|HB'}, 'feat:Próbafeat|HB:feat': ['Beágyazott|HB'], 'feat:Beágyazott|HB:feat': ['Túl mély|HB'], 'Cleric:8:asi': {feat: 'Próbafeat|HB'}, 'feat:Próbafeat|HB:feat2': ['Resilient|HB', 'Alert|PHB'],
        'feat:Resilient|HB:ability': ['wis', 'con', 'wis'], 'feat:Resilient|HB:saves': ['wis', 'con', 'str'], 'Cleric:12:asi': {str: 3}, 'Bard:4:asi': {feat: 'Linguist|HB'}, 'feat:Linguist|HB:lang': ['Giant', 'Orc'], 'feat:Linguist|HB:feat': ['', 7], 'feat:Linguist|HB:skills': ['medicine'], 'Bard:mc:skills': ['survival'], 'Bard:3:expertise': ['survival']}}), rbArany()],
    felszereles: [mkS({race: 'Half-Orc|PHB', base: {str: 15, dex: 18, con: 10, wis: 11}, levels: lv('Fighter', 9), sub: {Fighter: 'Champion|PHB'}, ch: {'Fighter:4:asi': {feat: 'Medium Armor Master|PHB'}, 'Fighter:6:asi': {feat: 'Tough|PHB'}, 'Fighter:8:asi': {feat: 'Lucky|PHB'}, 'Fighter:opt:Fighting Style': ['Dueling|PHB']}},
      {inventory: inv('Half Plate', 'Shield +2', {name: 'Cloak of Protection', attuned: true}, 'Ring of Protection', {name: 'Gauntlets of Ogre Power', attuned: true}, {name: 'Amulet of Health', attuned: true}, 'Bracers of Defense',
        '+1 Longsword', 'Greatsword', 'Longbow', {name: 'Saját bot', ref: 'Quarterstaff|PHB'}, 'Ismeretlen tárgy')}), rbArany()],
    nehezPancelGyengen: [mkS({race: 'Dragonborn|PHB', base: {str: 10, dex: 18, cha: 14}, levels: [...lv('Paladin', 6), {c: 'Fighter'}], sub: {Paladin: 'Devotion|PHB'}, ch: {'Paladin:4:asi': 'szöveg', 'Paladin:opt:Fighting Style': ['Defense|PHB'], 'Fighter:opt:Fighting Style': ['Archery|PHB']}},
      {inventory: inv('Plate +1', 'Shield', 'Longbow', 'Quarterstaff')}), rbArany()],
    nehezPancelTorpe: [mkS({race: 'Dwarf|PHB', subrace: 'Hill|PHB', base: {str: 10}, levels: lv('Barbarian', 5), sub: {Barbarian: 'Nincs|PHB'}}, {inventory: inv('Chain Mail')}), rbArany()],
    felulirasok: [mkS({race: 'Elf|PHB', subrace: 'Wood|PHB', base: {str: 25, dex: 20, con: 8, wis: 18}, levels: [...lv('Bard', 6), ...lv('Fighter', 7)], sub: {Fighter: 'Champion|PHB'},
      ch: {'Bard:1:skills': ['history', 'arcana', 'nature'], 'Fighter:4:asi': {feat: 'Observant|PHB'}, 'Fighter:6:asi': {feat: 'Mobile|PHB'}, 'Fighter:mc:skills': []}},
      {inventory: inv({name: 'Amulet of Health', attuned: true}), todoDone: ['nem létező', '✋ Favored Enemy (Ranger 1)'],
        ov: {'ab:wis': 13, 'ab:cha': 10, 'save:wis': 1, 'save:str': 0, 'skill:arcana': 0.5, 'skill:stealth': 2, 'skill:athletics': 0, 'skill:acrobatics': 0.5, 'skill:survival': 1, hpMax: 77, init: 9, ac: 21, speed: '45 ft.'}}), rbArany()],
    remarkableJackNelkul: [mkS({base: {str: 19, dex: 15}, levels: [...lv('Fighter', 7), {c: 'Paladin'}], sub: {Fighter: 'Champion|PHB'}}, {inventory: inv({name: 'Gauntlets of Ogre Power', attuned: true})}), rbArany()],
    hatarertekek: [mkS({base: {str: 15, dex: 14, wis: 10}, levels: lv('Monk', 1)}, {inventory: inv({name: 'Plate', equipped: false})}), rbArany()],
    pontosEro: [mkS({base: {str: 15}, levels: lv('Fighter', 1)}, {inventory: inv('Plate')}), rbArany()],
    alfajFelulirja: [mkS({race: 'Elf|PHB', subrace: 'Felülíró|HB', levels: lv('Fighter', 1), ch: {'Fighter:opt:Fighting Style': ['Defense|PHB']}}), rbArany()],
    varazslok: [mkS({race: 'Próbafaj|HB', base: {str: 8, dex: 14, con: 14, int: 13, wis: 14, cha: 16}, levels: [...lv('Cleric', 7), ...lv('Paladin', 3), ...lv('Warlock', 2), ...lv('Próbaosztály', 3), {c: 'Ranger'}], sub: {Cleric: 'Life|PHB', Paladin: 'Devotion|PHB', Warlock: 'Fiend|PHB', 'Próbaosztály': 'Próbamágus|HB', Ranger: 'Hibás|HB'},
      ch: {'Warlock:opt:Eldritch Invocations': ['Későbbi|PHB', 'Pontos szint|PHB', 'Beguiling Influence|PHB', 'Agonizing Blast|PHB'], 'opt:Beguiling Influence:skills': ['deception', 'nature'], 'Cleric:4:asi': {feat: 7}, 'Paladin:opt:Fighting Style': []}}, {inventory: inv('Dagger'), todoDone: ['✋ Favored Enemy (Ranger 1)']}), rbArany()],
    tanultVarazslatok: [mkS({base: {int: 16, cha: 14}, levels: [...lv('Wizard', 3), ...lv('Sorcerer', 2), ...lv('Bard', 10)], spells: {
      Wizard: {cantrips: ['Light|PHB', 'Fire Bolt|PHB', 'Kitalált|PHB'], book: ['Shield|PHB', 'Magic Missile|PHB', 'Sleep|PHB', 'Web|PHB', 'Fireball|PHB', 'Cure Wounds|PHB', 'Thunderwave|PHB', 'Grease|PHB', 'Find Familiar|PHB']},
      Sorcerer: {cantrips: ['Light|PHB'], known: ['Shield|PHB', 'Fireball|PHB', 'Web|PHB', 'Sleep|PHB']},
      Bard: {cantrips: ['Vicious Mockery|PHB', 'Mage Hand|PHB'], known: ['Sleep|PHB', 'Fireball|PHB', 'Shield|PHB', 'Fire Bolt|PHB']}}}), rbVarazs()]
  };
};
describe('Szabálymotor: aranyminta (a Sheet.calc teljes kimenete)', () => {
  test('minden mintalap kimenete bájtra az aranyminta (tests/arany-calc.js), és a calc nem módosítja a bemenetet', () => {
    const lapok = aranyLapok();
    eq(Object.keys(lapok), Object.keys(ARANY_CALC));
    for (const [nev, [s, rb]] of Object.entries(lapok)) {
      const elotte = fmt([s, rb]);
      eq(W.Sheet.calc(s, rb), ARANY_CALC[nev], nev);
      eq(fmt([s, rb]), elotte, nev + ': a bemenet nem változhat');
    }
  });
  test('a választások kulcsai (a lapon ezek alatt vannak a játékosok választásai): az ütköző kulcs sorszámot kap, sorrendben', () => {
    const [s, rb] = aranyLapok().utkozoKulcsok, kulcsok = W.Sheet.calc(s, rb).choices.map(c => c.key);
    for (const k of ['race:skills', 'race:skills2', 'Cleric:1:skills', 'Cleric:1:skills2', 'feat:Próbafeat|HB:feat', 'feat:Próbafeat|HB:feat2']) ok(kulcsok.includes(k), 'hiányzik: ' + k);
    ok(kulcsok.indexOf('Cleric:1:skills') < kulcsok.indexOf('Cleric:1:skills2'), 'az osztály saját választása az első');
    eq(new Set(kulcsok).size, kulcsok.length, 'minden kulcs egyedi');
    const [v, rbV] = aranyLapok().varazslok, c = W.Sheet.calc(v, rbV);
    ok(c.choices.some(x => x.key === 'opt:Beguiling Influence:skills'), 'a választott optional feature választása is bekerül (a ciklus közben)');
  });
  test('a calc csak végigmegy a lépéseken; a lépések sorrendje rögzített (egy rossz sorrend csendben undefined-ot is olvashat), és egyik sem hosszú', () => {
    const H = W.Sheet;
    eq(H.CALC_LEPESEK.map(f => f.name), ['calcFaj', 'calcOsztalyok', 'calcValasztasok', 'calcHatasok', 'calcExpertise', 'calcFelszereles', 'calcKepessegek', 'calcMentokSkillek',
      'calcHp', 'calcAc', 'calcSpeed', 'calcTamadasok', 'calcEroforrasok', 'calcVarazslas', 'calcVarazslatHelyek', 'calcTeendok']);
    ok(H.calc.toString().split('\n').length <= 5, 'a calc rövid');
    for (const f of H.CALC_LEPESEK) ok(f.toString().split('\n').length <= 60, f.name + ' legfeljebb 60 sor');
  });
});

describe('Szintlépés: varázslat-választások (sheet.js)', () => {
  const hely = (c, k) => c.choices.find(x => x.key === k);
  test('legmagasabb spellszint az osztály saját táblája szerint (full, half, third, Artificer, Pact)', () => {
    const m = W.Sheet.maxSpellLevel;
    eq([1, 3, 5, 17, 20].map(l => m('full', l)), [1, 2, 3, 9, 9]);
    eq([1, 2, 5, 9, 17].map(l => m('half', l)), [0, 1, 2, 3, 5]);
    eq([2, 3, 7, 13, 19].map(l => m('third', l)), [0, 1, 2, 3, 4]);
    eq([1, 5, 9, 17].map(l => m('artificer', l)), [1, 2, 3, 5]);
    eq([1, 3, 9, 11, 20].map(l => m('pact', l)), [1, 2, 5, 5, 5]);
    eq(m('', 5), 0);
  });
  test('Wizard: spellbook 6 + 2 szintenként, csak wizard listáról és csak elérhető szintű; a hely több is lehet (talált varázslat); a Bard / Sorcerer is külön számol', () => {
    const H = W.Sheet, [s, rb] = aranyLapok().tanultVarazslatok, c = H.calc(s, rb), book = hely(c, 'Wizard:book');
    eq(book.n, 10, 'Wizard 3: 6 + 2 × 2');
    eq(book.ok, ['Shield|PHB', 'Magic Missile|PHB', 'Sleep|PHB', 'Web|PHB', 'Thunderwave|PHB', 'Grease|PHB', 'Find Familiar|PHB'], 'a Fireball túl magas (Wizard 3), a Cure Wounds nincs a listáján');
    eq(book.done, false);
    const sok = mkS({base: {int: 16}, levels: lv('Wizard', 1), spells: {Wizard: {book: ['Shield', 'Magic Missile', 'Sleep', 'Thunderwave', 'Grease', 'Find Familiar', 'Burning Hands'].map(n => n + '|PHB')}}});
    eq(H.calc(sok, rb).choices.find(x => x.key === 'Wizard:book').ok.length, 7, 'Wizard 1: 6 hely, de a spellbookban lehet több');
    eq(hely(H.calc(mkS({levels: lv('Sorcerer', 1), spells: {Sorcerer: {known: ['Shield|XGE', 'Shield|PHB', 'Shield']}}}), rb), 'Sorcerer:known').ok, ['Shield|PHB'], 'a más forrású ref a szabálykönyv szerintire fordul, egyszer számít');
    eq(hely(c, 'Wizard:cantrips').ok, ['Light|PHB', 'Fire Bolt|PHB'], 'a kitalált kiesik');
    eq(hely(c, 'Sorcerer:known').ok, ['Shield|PHB', 'Sleep|PHB'], 'Sorcerer 2: csak 1. szintű, a közös slot tábla nem számít');
    eq(H.calc(s, rb).casting.map(x => [x.cls, x.maxSpell]), [['Wizard', 2], ['Sorcerer', 1], ['Bard', 5]]);
    ok(c.todos.some(t => t.key === 'Wizard:book' && t.text.includes('7 / 10')), 'teendő');
    eq(c.learned.find(x => x.name === 'Shield' && x.cls === 'Wizard'), {name: 'Shield', level: 1, ref: 'Shield|PHB', cls: 'Wizard', book: true});
  });
  test('Bard: Magical Secrets (10.: 2 bármely listáról, cantrip is, a known számán belül); Lore 6.: +2 hely és 2 kivétel; 2 fölött nem választható', () => {
    const H = W.Sheet, rb = rbVarazs(), S = (n, known, sub) => mkS({base: {cha: 16}, levels: lv('Bard', n), sub: sub ? {Bard: sub} : {}, spells: {Bard: {known}}});
    let c = H.calc(S(10, ['Shield|PHB', 'Fire Bolt|PHB', 'Fireball|PHB', 'Sleep|PHB']), rb);
    eq(hely(c, 'Bard:known').n, 13, 'a táblázat száma, Magical Secrets nem ad pluszt');
    eq(hely(c, 'Bard:known').ok, ['Shield|PHB', 'Fire Bolt|PHB', 'Sleep|PHB'], 'a harmadik kivétel kiesik');
    const o = H.choiceOptions(hely(c, 'Bard:known'), c, rb);
    eq([o.opts.find(x => x.v === 'Fireball|PHB').dis, o.opts.find(x => x.v === 'Shield|PHB').dis, o.opts.find(x => x.v === 'Sleep|PHB').off], [true, false, false], 'a kivételek elfogytak; a sajátot le lehet venni');
    c = H.calc(S(9, ['Shield|PHB']), rb);
    eq(hely(c, 'Bard:known').ok, [], 'a 10. szint előtt nincs kivétel');
    c = H.calc(S(6, ['Shield|PHB', 'Web|PHB', 'Fireball|PHB'], 'College of Lore|PHB'), rb);
    eq([hely(c, 'Bard:known').n, hely(c, 'Bard:known').ok], [11, ['Shield|PHB', 'Web|PHB']], 'Lore 6.: 9 + 2');
    ok(!c.todos.some(t => /Magical Secrets/.test(t.text)), 'nem ✋ teendő');
  });
  test('EK / AT: a wizard listájáról, iskolához kötve, a szabad helyekkel; a cantrip nincs iskolához kötve', () => {
    const H = W.Sheet, rb = rbVarazs();
    const ek = (n, known, cantrips = []) => H.calc(mkS({base: {int: 14}, levels: lv('Fighter', n), sub: {Fighter: 'Eldritch Knight|PHB'}, spells: {Fighter: {known, cantrips}}}), rb);
    let c = ek(3, ['Shield|PHB', 'Magic Missile|PHB', 'Sleep|PHB'], ['Mage Hand|PHB']);
    eq([hely(c, 'Fighter:known').n, hely(c, 'Fighter:known').ok], [4, ['Shield|PHB', 'Magic Missile|PHB', 'Sleep|PHB']], 'Sleep az 1 szabad hely');
    eq(hely(c, 'Fighter:cantrips').ok, ['Mage Hand|PHB']);
    c = ek(3, ['Sleep|PHB', 'Grease|PHB']);
    eq(hely(c, 'Fighter:known').ok, ['Sleep|PHB'], 'a szabad hely elfogyott');
    c = ek(8, ['Sleep|PHB', 'Grease|PHB', 'Web|PHB']);
    eq(hely(c, 'Fighter:known').ok, ['Sleep|PHB', 'Grease|PHB'], 'a 8. szinten 2 szabad hely van');
    c = ek(3, ['Cure Wounds|PHB', 'Fireball|PHB']);
    eq(hely(c, 'Fighter:known').ok, [], 'nincs a wizard listáján; túl magas');
    ok(c.casting[0].maxSpell === 1);
    const at = H.calc(mkS({base: {int: 14}, levels: lv('Rogue', 3), sub: {Rogue: 'Arcane Trickster|PHB'}, spells: {Rogue: {known: ['Sleep|PHB', 'Shield|PHB', 'Grease|PHB']}}}), rb);
    eq(hely(at, 'Rogue:known').ok, ['Sleep|PHB', 'Shield|PHB'], 'Rogue 3: enchantment / illusion + 1 szabad');
  });
  test('Warlock: a pact táblája szerinti szint, az expanded lista is választható; prepared castereknél csak cantrip a hely', () => {
    const H = W.Sheet, rb = rbVarazs();
    let c = H.calc(mkS({base: {cha: 16}, levels: lv('Warlock', 3), sub: {Warlock: 'Fiend|PHB'}, spells: {Warlock: {known: ['Hex|PHB', 'Burning Hands|PHB', 'Shield|PHB'], cantrips: ['Mage Hand|PHB']}}}), rb);
    eq(hely(c, 'Warlock:known').ok, ['Hex|PHB', 'Burning Hands|PHB'], 'a Fiend listája bővít, a Shield nincs rajta');
    eq(H.choiceOptions(hely(c, 'Warlock:known'), c, rb).opts.map(x => x.l), ['Burning Hands', 'Hex']);
    c = H.calc(mkS({base: {wis: 16}, levels: lv('Cleric', 3), sub: {Cleric: 'Life|PHB'}}), rb);
    eq(c.choices.filter(x => ['cantrips', 'known', 'book'].includes(x.kind)).map(x => x.key), ['Cleric:cantrips']);
    const o = H.choiceOptions(hely(c, 'Cleric:cantrips'), c, rb);
    eq(o.opts.map(x => x.l), ['Guidance', 'Light']);
    eq(H.choiceOptions({kind: 'known', key: 'Bard:known', n: 1, ok: [], ctx: {list: 'Bard', max: 1, off: 0}}, null, rb).opts.map(x => [x.l, x.lvl]), [['Cure Wounds', 1], ['Sleep', 1], ['Thunderwave', 1]], 'számolás nélkül is');
  });
  test('a lapra kiírva: cls, book, a bekészítés és a jegyzet megmarad, az új spellbook-varázslat nem bekészített; a saját varázslat marad; a levett lekerül', () => {
    const H = W.Sheet, rb = rbVarazs();
    const s = mkS({base: {int: 16}, levels: lv('Wizard', 3), spells: {Wizard: {cantrips: ['Light|PHB'], book: ['Shield|PHB', 'Sleep|PHB']}}}, {spells: [{name: 'Shield', level: 1, prepared: true, note: 'jegyzet', auto: true, cls: 'Wizard', book: true}, {name: 'Saját bűbáj', level: 1, prepared: true}, {name: 'Web', level: 2, auto: true, cls: 'Wizard'}]});
    const p = H.materialize(s, H.calc(s, rb)), by = Object.fromEntries(p.spells.map(x => [x.name, x]));
    eq(p.spells.map(x => x.name), ['Light', 'Shield', 'Sleep', 'Saját bűbáj'], 'a Web lekerült');
    eq([by.Light.prepared, by.Light.cls, 'book' in by.Light], [true, 'Wizard', false]);
    eq([by.Shield.prepared, by.Shield.note, by.Shield.book, by.Shield.auto], [true, 'jegyzet', true, true]);
    eq([by.Sleep.prepared, by.Sleep.book], [false, true]);
    ok(!by['Saját bűbáj'].auto);
    const k = H.setChoice(s.build, {kind: 'book', key: 'Wizard:book'}, ['Sleep|PHB']);
    eq(k.spells.Wizard, {cantrips: ['Light|PHB'], book: ['Sleep|PHB']});
    eq(H.setChoice(k, {kind: 'book', key: 'Wizard:book'}, []).spells.Wizard, {cantrips: ['Light|PHB']});
    eq(H.choiceOptions({kind: 'book', key: 'Wizard:book', n: 1, ok: [], ctx: {list: 'Wizard', max: 1, off: 0}}, null, rb).over, true, 'a spellbook lehet a helyeknél több');
    eq(H.calc(mkS({levels: lv('Wizard', 3)})).choices.filter(x => x.kind === 'book'), [], 'szabálykönyv nélkül nincs hely');
  });
  test('régi lap besorolása: az egyértelmű a helyére, a kétértelmű és a listán kívüli saját marad; a hely fölötti nem vész el; a kivételek a Bardnál; egyszer fut', () => {
    const H = W.Sheet, rb = rbVarazs(), sp = (...n) => n.map(x => ({name: x, level: 1, prepared: true}));
    let s = mkS({base: {int: 16, cha: 16}, levels: [...lv('Wizard', 1), ...lv('Sorcerer', 1)]}, {spells: [...sp('Find Familiar', 'Shield', 'Hex', 'Nincs ilyen'), {name: 'Fire Bolt', level: 0}, {name: 'Vicious Mockery', level: 0}, {name: 'Bless', level: 1, always: true}]});
    eq(H.adoptSpells(s, rb).spells, {Wizard: {book: ['Find Familiar|PHB']}}, 'a Shield és a Fire Bolt mindkét listán van; a Hex egyiken sem');
    s = mkS({base: {cha: 16}, levels: lv('Sorcerer', 1)}, {spells: [...sp('Shield', 'Sleep', 'Grease', 'Magic Missile'), {name: 'Light', level: 0}]});
    const b = H.adoptSpells(s, rb);
    eq(b.spells, {Sorcerer: {cantrips: ['Light|PHB'], known: ['Shield|PHB', 'Sleep|PHB']}}, 'Sorcerer 1: 2 ismert, a többi saját marad');
    const p = H.materialize({...s, build: b}, H.calc({...s, build: b}, rb));
    eq(p.spells.map(x => [x.name, !!x.auto]), [['Light', true], ['Shield', true], ['Sleep', true], ['Grease', false], ['Magic Missile', false]], 'egy sem veszik el');
    s = mkS({base: {cha: 16}, levels: lv('Bard', 10)}, {spells: sp('Sleep', 'Shield', 'Grease', 'Hex')});
    eq(H.adoptSpells(s, rb).spells.Bard.known, ['Sleep|PHB', 'Shield|PHB', 'Grease|PHB'], 'a kivételek csak a második körben, kettő');
    eq(H.adoptSpells(s, null), s.build, 'szabálykönyv nélkül nem nyúl hozzá');
    eq(H.adoptSpells(mkS({levels: lv('Fighter', 1)}), rb).spells, {}, 'nem varázslónál üres, így többször nem fut le');
    s = mkS({base: {cha: 16, wis: 16}, levels: [...lv('Cleric', 1), ...lv('Bard', 10)]}, {spells: sp('Cure Wounds', 'Bless', 'Sleep')});
    eq(H.adoptSpells(s, rb).spells, {Bard: {known: ['Sleep|PHB']}}, 'ami a bekészítős osztály listáján is rajta van, az saját marad (kivételt sem fogyaszt)');
  });
  test('adatvédelem: szabálykönyvbeli varázslatok nélkül a tanult varázslatok a lapon maradnak; az érvénytelenné vált ref nem vész el a felépítésből', () => {
    const H = W.Sheet, rb = rbVarazs();
    const s = mkS({base: {int: 16}, levels: lv('Wizard', 1), spells: {Wizard: {book: ['Shield|PHB', 'Fireball|PHB', 'Törölt|X']}}}, {spells: [{name: 'Shield', level: 1, prepared: true, note: 'jegyzet', auto: true, cls: 'Wizard', book: true, ref: 'Shield|PHB'}]});
    const p = H.materialize(s, H.calc(s, {...rb, spells: []}));
    ok(!p.spells || p.spells.some(x => x.name === 'Shield' && x.note === 'jegyzet'), 'nem került le');
    const c = H.calc(s, rb), ch = c.choices.find(x => x.key === 'Wizard:book');
    eq(ch.ok, ['Shield|PHB']);
    eq(H.spellKept(ch, H.choiceOptions(ch, c, rb), rb), ['Fireball|PHB', 'Törölt|X'], 'a Fireball most túl magas, a Törölt nincs a könyvben');
  });
});

describe('Szintlépés: terv és mentés (sheet.js)', () => {
  const H = () => W.Sheet;
  const terv = (s, rb, cls) => H().levelUpPlan(s, rb, H().levelUpBuild(s, cls));
  const kulcs = l => l.map(x => x.c.key);
  test('Rogue 3 → 4: ASI, új jellemző nélkül, HP-bontás; a meglévő választások nem jönnek elő', () => {
    const rb = rbVarazs(), s = mkS({base: {dex: 16, con: 14}, levels: lv('Rogue', 3), ch: {'Rogue:1:skills': ['stealth', 'perception', 'arcana', 'acrobatics'], 'Rogue:1:expertise': ['stealth', 'arcana']}, sub: {Rogue: 'Thief|PHB'}});
    const p = terv(s, rb, 'Rogue');
    eq(kulcs(p.choices), ['Rogue:4:asi']);
    eq([p.choices[0].uj, p.choices[0].missing], [true, 1]);
    eq([p.cls, p.classLevel, p.spells], ['Rogue', 4, []]);
    eq(p.hp, {hd: 8, avg: 5, die: 5, rest: 2, gain: 7, from: 24, to: 31}, 'átlag 5 + CON 2');
  });
  test('Fighter 2 → 3: alosztály elöl; Cleric 1 → 2: nincs választás, Channel Divinity új erőforrás és jellemző', () => {
    const rb = rbVarazs();
    let p = terv(mkS({levels: lv('Fighter', 2), ch: {'Fighter:opt:Fighting Style': ['Defense|PHB']}}), rb, 'Fighter');
    eq(kulcs(p.choices), ['Fighter:sub']);
    p = terv(mkS({base: {wis: 16}, levels: lv('Cleric', 1), sub: {Cleric: 'Life|PHB'}, spells: {Cleric: {cantrips: ['Light|PHB']}}, ch: {'Cleric:1:skills': ['history', 'insight']}}), rb, 'Cleric');
    eq(p.choices.map(x => x.c.key), []);
    eq(p.spells.map(x => [x.c.key, x.uj, x.missing]), [['Cleric:cantrips', true, 1]]);
    eq(p.resources, [{name: 'Channel Divinity', from: 0, to: 1}]);
    eq(p.features.map(f => f.name), ['Channel Divinity']);
    eq([p.nw.casting[0].prepared, p.nw.casting[0].maxSpell], [5, 1]);
  });
  test('Wizard 4 → 5: spellbook +2, 3. szintű is; a meglévők zárolva, nincs csere', () => {
    const rb = rbVarazs(), book = ['Shield', 'Magic Missile', 'Sleep', 'Thunderwave', 'Grease', 'Find Familiar', 'Burning Hands', 'Web'].map(n => n + '|PHB');
    const s = mkS({base: {int: 16}, levels: lv('Wizard', 4), ch: {'Wizard:4:asi': {int: 2}}, spells: {Wizard: {cantrips: ['Light|PHB', 'Fire Bolt|PHB', 'Mage Hand|PHB'], book}}});
    const p = terv(s, rb, 'Wizard'), b = p.spells.find(x => x.c.key === 'Wizard:book');
    eq([b.c.n, b.c.ok.length, b.uj, b.csere, b.locked.length, b.missing], [14, 8, true, false, 8, 1], 'a helyek 6 + 2 × 4; a teszt-könyvben csak 1 maradt');
    ok(H().choiceOptions(b.c, p.nw, rb).opts.some(x => x.l === 'Fireball'), 'már 3. szintű is');
    eq(p.old.casting[0].maxSpell + 1, p.nw.casting[0].maxSpell);
    eq(p.nw.casting[0].maxSpell, 3);
  });
  test('Warlock 2 → 3: Pact Boon, invocation-csere (a darabszám is nő); known: új hely és csere', () => {
    const rb = rbVarazs(), s = mkS({base: {cha: 16}, levels: lv('Warlock', 2), sub: {Warlock: 'Fiend|PHB'}, ch: {'Warlock:opt:Eldritch Invocations': ['Agonizing Blast|PHB', 'Pontos szint|PHB']}, spells: {Warlock: {cantrips: ['Mage Hand|PHB'], known: ['Hex|PHB', 'Burning Hands|PHB', 'Hex|PHB']}}});
    const p = terv(s, rb, 'Warlock');
    eq(kulcs(p.choices), ['Warlock:opt:Eldritch Invocations', 'Warlock:opt:Pact Boon']);
    eq(p.choices[0].locked, ['Agonizing Blast|PHB', 'Pontos szint|PHB']);
    eq(p.choices.map(x => x.csere), [true, false]);
    const k = p.spells.find(x => x.c.key === 'Warlock:known');
    eq([k.uj, k.csere], [true, true]);
    const azonos = mkS({base: {cha: 16}, levels: lv('Warlock', 3), sub: {Warlock: 'Fiend|PHB'}, ch: {'Warlock:opt:Eldritch Invocations': ['Agonizing Blast|PHB', 'Pontos szint|PHB', 'Beguiling Influence|PHB'], 'opt:Beguiling Influence:skills': ['deception', 'persuasion'], 'Warlock:opt:Pact Boon': ['Pact of the Blade|PHB']}, spells: {Warlock: {cantrips: ['Mage Hand|PHB'], known: ['Hex|PHB', 'Burning Hands|PHB']}}});
    const q = terv(azonos, rb, 'Warlock');
    eq(q.choices.map(x => [x.c.key, x.uj, x.csere]), [['Warlock:4:asi', true, false], ['Warlock:opt:Eldritch Invocations', false, true]], 'a darabszám nem nő, de cserélhet; a Pact Boon nem jön elő');
    eq(q.choices[1].missing, 0, 'a csere nem kötelező');
  });
  test('Sorcerer 2 → 3: 2 metamagic, known +1 és csere; a metamagic nem cserélhető; a feat saját választása a plan-be kerül', () => {
    const rb = rbVarazs(), s = mkS({base: {cha: 16}, levels: lv('Sorcerer', 2), sub: {Sorcerer: 'Draconic|PHB'}, spells: {Sorcerer: {cantrips: ['Light|PHB', 'Fire Bolt|PHB', 'Mage Hand|PHB'], known: ['Shield|PHB', 'Sleep|PHB', 'Grease|PHB']}}});
    let p = terv(s, rb, 'Sorcerer');
    eq(p.choices.map(x => [x.c.key, x.c.n, x.csere, x.missing]), [['Sorcerer:opt:Metamagic', 2, false, 2], ['Sorcerer:1:pick', 1, false, 0]], 'a korábbról elmaradt sárkánytípus nem kötelező');
    const kn = p.spells.find(x => x.c.key === 'Sorcerer:known');
    eq([kn.c.n, kn.locked.length, kn.csere, kn.missing], [4, 3, true, 1]);
    // ASI → feat: a feat választása új kulcs, és megjelenik
    const f = mkS({levels: lv('Fighter', 3), sub: {Fighter: 'Champion|PHB'}, ch: {'Fighter:opt:Fighting Style': ['Defense|PHB']}});
    const b = {...H().levelUpBuild(f, 'Fighter')}; b.ch = {...b.ch, 'Fighter:4:asi': {feat: 'Resilient|HB'}};
    p = H().levelUpPlan(f, rb, b);
    eq(kulcs(p.choices), ['Fighter:4:asi', 'feat:Resilient|HB:ability', 'feat:Resilient|HB:saves']);
    eq(p.choices[0].missing, 0, 'az ASI kész');
  });
  test('korábbról nyitott választás megjelenik, de nem kötelező; ha nincs miből választani, a hely nem akad el', () => {
    const rb = rbVarazs(), s = mkS({levels: lv('Fighter', 3), sub: {}});
    const p = terv(s, rb, 'Fighter');
    eq(p.choices.map(x => [x.c.key, x.uj, x.missing]), [['Fighter:sub', false, 0], ['Fighter:4:asi', true, 1], ['Fighter:opt:Fighting Style', false, 0]]);
    const ures = {...rb, optfeatures: []}, w = mkS({base: {cha: 16}, levels: lv('Warlock', 2), ch: {}, sub: {Warlock: 'Fiend|PHB'}, spells: {}});
    eq(terv(w, ures, 'Warlock').choices.map(x => x.missing), [0, 0], 'nincs Pact Boon a könyvben');
    const sz = {...rb, subclasses: rb.subclasses.filter(x => x.cls !== 'Monk')}, m = mkS({levels: lv('Monk', 2)});
    eq(terv(m, sz, 'Monk').choices.map(x => [x.c.key, x.missing]), [['Monk:sub', 0]], 'alosztály nélküli könyvnél sem akad el');
  });
  test('levelUpApply: egy írásban a számolt mezők, a jelenlegi HP a növekedéssel nő, a használt marad; az engedély a célszintnél törlődik, köztes szinten marad; szabálykönyv-mentes felülírás', () => {
    const rb = rbVarazs(), s = mkS({base: {con: 14}, levels: lv('Barbarian', 3)}, {levelUp: {to: 4}, hp: {max: 30, cur: 12}, resources: [{name: 'Rage', max: 3, used: 2, auto: true}]});
    const b = H().levelUpBuild(s, 'Barbarian'); b.levels[3].hp = 9;
    let p = H().levelUpApply(s, rb, b);
    eq(p.levelUp, null);
    eq(p.classes[0].level, 4);
    eq([p.hp.max, p.hp.cur], [12 + 7 * 2 + 9 + 8, 12 + (12 + 7 * 2 + 9 + 8 - 30)]);
    eq((p.resources || s.resources).find(r => r.name === 'Rage').used, 2);
    eq(H().levelUpApply({...s, levelUp: {to: 6, by: 'dm', at: '', mc: false}}, rb, b).levelUp.to, 6, 'két szintre szóló engedély');
    const ovS = mkS({base: {con: 14, str: 10}, levels: lv('Barbarian', 3)}, {ov: {hpMax: 40, 'ab:str': 16, ac: 18}, hp: {max: 40, cur: 40}});
    const ob = H().levelUpBuild(ovS, 'Barbarian'); ob.ch = {'Barbarian:4:asi': {str: 2}};
    p = H().levelUpApply(ovS, rb, ob);
    eq([p.ov.hpMax, p.ov['ab:str'], p.ov.ac, p.abilities.str, p.hp.max, p.hp.cur], [40 + 9, 18, 18, 18, 49, 49], 'a max HP és a képesség felülírása mozdul, az AC-é marad');
    eq(H().levelUpPlan(ovS, rb, ob).hp.to, 49, 'a tervben is');
  });
  test('restorePatch: a felépítés és a számolt mezők vissza, a felszerelés, a pénz, a jegyzet, a HP marad; engedély visszajön; saját varázslat a pillanatkép szerint', () => {
    const rb = rbVarazs(), s = mkS({base: {con: 14}, levels: lv('Barbarian', 3)}, {levelUp: {to: 4}, hp: {max: 40, cur: 40}, notes: 'régi', inventory: [{name: 'Régi'}], spells: [{name: 'Saját', level: 1}], resources: [{name: 'Rage', max: 3, used: 1, auto: true}]});
    const b = H().levelUpBuild(s, 'Barbarian'), up = H().norm({...s, ...H().levelUpApply(s, rb, b), notes: 'új', inventory: [{name: 'Új'}], currency: {gp: 9}, resources: [{name: 'Rage', max: 3, used: 2, auto: true}]});
    const h = {reason: 'levelup', from: 3, to: 4, sheet: s};
    const p = H().restorePatch(up, h, rb, {by: 'a@x.hu', at: '2026-11-02T18:00:00.000Z'}), n = H().norm({...up, ...p});
    eq([n.build.levels.length, H().level(n), n.notes, n.inventory[0].name, n.currency.gp], [3, 3, 'új', 'Új', 9]);
    eq(p.levelUp, {to: 4, by: 'a@x.hu', at: '2026-11-02T18:00:00.000Z', mc: false});
    eq(n.resources.find(r => r.name === 'Rage').used, 2);
    ok(n.hp.cur <= n.hp.max);
    eq(H().restorePatch({...up, levelUp: {to: 6}}, h, rb).levelUp, {to: 6}, 'az érvényes engedély marad');
    eq(H().restorePatch(up, {reason: 'restore', from: 4, to: 3, sheet: s}, rb).levelUp, null, 'visszaállítás visszavonása nem ad engedélyt');
    ok(n.spells.some(x => x.name === 'Saját'));
  });
});

describe('Szintlépés: robot (minden osztály 1 → 20)', () => {
  // minden hely az első érvényes opcióval; ASI: +1 STR, +1 DEX. Hibalista: elakadás, érvénytelen választás, kulcsváltozás, HP-csökkenés
  const kitolt = (c, cr, rb, b) => {
    const H = W.Sheet;
    if (c.kind === 'asi') return H.setChoice(b, c, {str: 1, dex: 1});
    const o = H.choiceOptions(c, cr, rb);
    if (o.free) return H.setChoice(b, c, Array.from({length: c.n}, (_, i) => 'Próbaeszköz' + (i || '')));
    const uj = o.opts.filter(x => !x.dis && !c.ok.includes(x.v)).slice(0, c.n - c.ok.length).map(x => x.v);
    if (c.kind === 'subclass' || c.kind === 'subrace') return H.setChoice(b, c, uj[0]);
    return H.setChoice(b, c, [...c.ok, ...uj]);
  };
  // osztaly: szintenként melyik osztályban lép (multiclass-robot, TERV-multiclass.md), max: meddig
  const robot = (cls, rb, subIdx = 0, kor = null, osztaly = () => cls, max = 20) => {
    const H = W.Sheet, hibak = [];
    const elso = s => {
      for (let g = 0; g < 30; g++) {
        const c = H.calc(s, rb), x = c.choices.find(y => !y.done && H.choiceOptions(y, c, rb).opts.some(o => !o.dis && !y.ok.includes(o.v)));
        if (!x) return s;
        const b = x.kind === 'subclass' ? H.setChoice(s.build, x, H.subclassesOf(cls, rb)[subIdx]?.n + '|' + H.subclassesOf(cls, rb)[subIdx]?.s) : kitolt(x, c, rb, s.build);
        s = H.norm({...s, build: b});
      }
      hibak.push(cls + ': az 1. szint nem tölthető ki'); return s;
    };
    let s = mkS({base: {str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14}, levels: lv(cls, 1), spells: {}});
    s = elso(s); s = H.norm({...s, ...H.materialize(s, H.calc(s, rb))});
    for (let L = 2; L <= max; L++) {
      let b = H.levelUpBuild(s, osztaly(L)), kesz = false;
      s = H.norm({...s, levelUp: {to: L}});
      for (let g = 0; g < 40 && !kesz; g++) {
        const plan = H.levelUpPlan(s, rb, b), x = [...plan.choices, ...plan.spells].find(y => y.missing > 0);
        if (!x) { kesz = true; break; }
        const sc = x.c.key.replace(/:sub$/, ''), al = H.subclassesOf(sc, rb), alv = al[subIdx] || al[0];
        b = x.c.kind === 'subclass' ? H.setChoice(b, x.c, alv.n + '|' + alv.s) : kitolt(x.c, plan.nw, rb, b);
        // egy feat vagy feature új helyet nyithat, de ugyanaz a hely nem ragadhat be
        const u = H.levelUpPlan(s, rb, b);
        if ([...u.choices, ...u.spells].some(y => y.c.key === x.c.key && y.missing >= x.missing)) { hibak.push(`${cls} ${L}: nem tölthető ki: ${x.c.key}`); kesz = true; }
      }
      if (!kesz) hibak.push(`${cls} ${L}: elakadt`);
      const plan = H.levelUpPlan(s, rb, b), regi = plan.old.choices.map(c => c.key), ujK = new Set(plan.nw.choices.map(c => c.key));
      for (const k of regi) if (!ujK.has(k)) hibak.push(`${cls} ${L}: eltűnt kulcs: ${k}`);
      for (const x of plan.old.choices) { const y = plan.nw.choices.find(c => c.key === x.key); if (y && fmt(x.ok.filter(v => !y.ok.some(w => fmt(w) === fmt(v)))) !== '[]') hibak.push(`${cls} ${L}: elveszett választás: ${x.key}`); }
      const p = H.levelUpApply(s, rb, b), n = H.norm({...s, ...p});
      if (H.level(n) !== L) hibak.push(`${cls} ${L}: a szint ${H.level(n)}`);
      if (n.hp.max <= s.hp.max) hibak.push(`${cls} ${L}: a max HP nem nőtt`);
      if (L < 20 ? n.levelUp !== null : false) hibak.push(`${cls} ${L}: az engedély maradt`);
      const m = H.materialize(n, H.calc(n, rb));
      if (Object.keys(m).length) hibak.push(`${cls} ${L}: a mentett lap újraszámolva eltér: ${Object.keys(m)}`);
      kor?.(n, L, plan);
      s = n;
    }
    return {s, hibak};
  };
  const rb13 = () => {
    const rb = rbVarazs();
    rb.classes.push({n: 'Druid', s: 'PHB', hd: 8, saves: ['int', 'wis'], caster: 'full', ab: 'wis', cantrips: R20(l => l < 4 ? 2 : l < 10 ? 3 : 4), prep: 'lvl+wis', subLvl: 2, asi: ASI, feats: [{n: 'Wild Shape', lvl: 2}]},
      {n: 'Artificer', s: 'TCE', hd: 8, saves: ['con', 'int'], caster: 'artificer', ab: 'int', cantrips: R20(l => l < 10 ? 2 : l < 14 ? 3 : 4), prep: 'lvl/2+int', subLvl: 3, asi: ASI, feats: [{n: 'Flash of Genius', lvl: 7}]});
    rb.classes = rb.classes.filter(c => c.n !== 'Próbaosztály');
    rb.subclasses = rb.subclasses.filter(x => x.cls !== 'Próbaosztály');
    for (const c of rb.classes) if (!rb.subclasses.some(x => x.cls === c.n)) rb.subclasses.push({n: 'Próba ' + c.n, short: 'Próba', cls: c.n, s: 'HB'});
    return rb;
  };
  // új karakter: az üres lapból a varázsló logikájával, minden helyet az első érvényes opcióval; a kész lap 1. szintű, a szintlépés indulhat
  const ncRobot = (cls, rb, raceIdx, bgIdx) => {
    const H = W.Sheet, hibak = [], o = H.raceOptions(rb);
    let s = H.ncBlank({name: 'R', target: 1});
    let b = {...s.build, race: o[raceIdx % o.length]?.race || '', subrace: o[raceIdx % o.length]?.subrace || '', background: rb.backgrounds?.length ? rb.backgrounds[bgIdx % rb.backgrounds.length].n + '|' + rb.backgrounds[bgIdx % rb.backgrounds.length].s : '', base: {str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8}};
    b = H.ncSetClass(H.norm({auto: true, build: b}).build, cls);
    s = H.norm({...s, build: b});
    s = H.norm({...s, ...H.materialize(s, H.calc(s, rb))});
    for (let g = 0; g < 40; g++) {
      const plan = H.ncPlan(s, rb), x = [...plan.choices, ...plan.spells].find(y => y.missing > 0);
      if (!x) break;
      const nb = x.c.kind === 'subclass' ? H.setChoice(s.build, x.c, H.subclassesOf(cls, rb)[0].n + '|' + H.subclassesOf(cls, rb)[0].s) : kitolt(x.c, plan.cr, rb, s.build);
      s = H.norm({...s, build: nb}); s = H.norm({...s, ...H.materialize(s, H.calc(s, rb))});
      const u = H.ncPlan(s, rb);
      if ([...u.choices, ...u.spells].some(y => y.c.key === x.c.key && y.missing >= x.missing)) { hibak.push(`${cls}: nem tölthető ki: ${x.c.key}`); break; }
    }
    const plan = H.ncPlan(s, rb), maradt = [...plan.choices, ...plan.spells].filter(y => y.missing > 0).map(y => y.c.key);
    if (maradt.length) hibak.push(`${cls}: nyitva: ${maradt}`);
    if (H.level(s) !== 1 || s.build.levels.length !== 1) hibak.push(`${cls}: szint ${H.level(s)} / ${s.build.levels.length}`);
    if (s.hp.max < 1 || s.classes[0].name !== cls) hibak.push(`${cls}: lap: ${s.hp.max}, ${s.classes[0].name}`);
    return hibak;
  };
  test('új karakter: mind a 13 osztály elkészíthető a varázsló logikájával, elakadás nélkül', () => {
    const rb = rb13(), hibak = [];
    rb.classes.forEach((c, i) => hibak.push(...ncRobot(c.n, rb, i, i)));
    eq(hibak, []);
  });
  test('új karakter: valódi szabálykönyvvel minden osztály × minden faj, különböző háttérrel', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet, hibak = [];
    eq(rb.classes.length, 13);
    H.raceOptions(rb).forEach((_, r) => rb.classes.forEach((c, i) => hibak.push(...ncRobot(c.n, rb, r, i + r))));
    eq(hibak, []);
  }, {online: true});
  test('mind a 13 osztály 1 → 20: nincs elakadás, nem vész el választás, a kulcsok stabilak, a mentett lap újraszámolva nem változik', () => {
    const rb = rb13(), hibak = [];
    eq(rb.classes.map(c => c.n).sort(), ['Artificer', 'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard']);
    for (const c of rb.classes) hibak.push(...robot(c.n, rb).hibak);
    eq(hibak, []);
    const v = robot('Fighter', rb, rb.subclasses.filter(x => x.cls === 'Fighter').findIndex(x => x.short === 'Eldritch Knight'));
    eq(v.hibak, []);
    eq(v.s.spellcasting.slots.slice(0, 4), [4, 3, 3, 1], 'EK 20: PHB third caster tábla');
  });
  // multiclass-robot (TERV-multiclass.md, 6. lépés): A 1–5, utána B 6–7, minden választás az első érvényes opcióval
  // a párok: minden osztály után a lista következő két osztálya (26 pár; mind a 156 túl lassú lenne), plusz a megadottak
  const mcRobot = (rb, extra = []) => {
    const hibak = [], minta = {}, nevek = rb.classes.map(c => c.n);
    const parok = [...nevek.flatMap((a, i) => [1, 2].map(d => [a, nevek[(i + d) % nevek.length]])), ...extra].filter(([a, b], i, l) => l.findIndex(([x, y]) => x === a && y === b) === i);
    for (const [a, b] of parok) {
      const r = robot(a, rb, 0, (n, L) => { if (L === 7) minta[a + '/' + b] = n; }, L => L <= 5 ? a : b, 7);
      hibak.push(...r.hibak.map(h => `${a} 5 / ${b}: ${h}`));
      const n = minta[a + '/' + b];
      if (n && W.Sheet.classLabel(n).replace(/ \([^)]*\)/g, '') !== `${a} 5 / ${b} 2`) hibak.push(`${a}/${b}: osztályok: ${W.Sheet.classLabel(n)}`);
      if (n && fmt(n.saveProf.slice().sort()) !== fmt(W.Sheet.classInfo(a, rb).saves.slice().sort())) hibak.push(`${a}/${b}: mentők nem az elsőből: ${n.saveProf}`);
    }
    return {hibak, minta};
  };
  test('multiclass-robot: osztálypárok (A 5 / B 2, minden osztály két másikkal) elakadás és elveszett választás nélkül; mentők az első osztályból', () => {
    const {hibak, minta} = mcRobot(rb13());
    eq(hibak, []);
    eq(Object.keys(minta).length, 26);
  });
  test('valódi szabálykönyvvel mind a 13 osztály minden alosztálya 1 → 20; a slotok, ismert számok és erőforrások a PHB tábláival egyeznek (kézzel ellenőrzött mintaszintek)', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet, hibak = [];
    eq(rb.classes.length, 13);
    const minta = {};
    for (const c of rb.classes) {
      const subs = H.subclassesOf(c.n, rb);
      for (let i = 0; i < subs.length; i++) hibak.push(...robot(c.n, rb, i, i ? null : (n, L, p) => {
        minta[c.n + L] = {slots: n.spellcasting.slots.join(''), pact: n.spellcasting.pact, res: Object.fromEntries(n.resources.map(r => [r.name, r.max])), cast: p.nw.casting[0]};
      }).hibak);
    }
    eq(hibak, []);
    const slot = (k, v) => eq(minta[k].slots.replace(/0+$/, ''), v, k + ' slotok');
    slot('Wizard20', '433332211'); slot('Wizard5', '432'); slot('Cleric17', '433321111'); slot('Paladin5', '42'); slot('Paladin20', '43332'); slot('Ranger9', '432'); slot('Artificer5', '42'); slot('Artificer20', '43332');
    eq(minta.Warlock11.pact, {level: 5, max: 3, used: 0}); eq(minta.Warlock2.pact, {level: 1, max: 2, used: 0}); eq(minta.Warlock20.pact.max, 4);
    eq([minta.Bard20.cast.known, minta.Sorcerer20.cast.known, minta.Ranger20.cast.known, minta.Warlock20.cast.known], [22, 15, 11, 15]);
    eq([minta.Wizard20.cast.cantrips, minta.Cleric20.cast.cantrips, minta.Sorcerer20.cast.cantrips, minta.Warlock20.cast.cantrips, minta.Druid20.cast.cantrips, minta.Bard20.cast.cantrips], [5, 5, 6, 4, 4, 4]);
    eq([minta.Wizard20.cast.maxSpell, minta.Paladin20.cast.maxSpell, minta.Warlock20.cast.maxSpell, minta.Artificer20.cast.maxSpell], [9, 5, 5, 5]);
    eq([minta.Barbarian3.res.Rage, minta.Barbarian20.res.Rage, minta.Monk20.res.Ki, minta.Cleric18.res['Channel Divinity'], minta.Fighter17.res['Action Surge'], minta.Sorcerer20.res['Sorcery Points']], [3, 99, 20, 3, 2, 20]);
    // multiclass a valódi szabálykönyvvel: minden osztálypár; a slotok a PHB multiclass-táblája szerint (kézzel számolt minták)
    const mr = mcRobot(rb, [['Wizard', 'Cleric'], ['Paladin', 'Sorcerer'], ['Barbarian', 'Wizard'], ['Artificer', 'Wizard'], ['Monk', 'Barbarian'], ['Warlock', 'Sorcerer'], ['Fighter', 'Ranger'], ['Barbarian', 'Monk']]);
    eq(mr.hibak, [], 'multiclass-robot');
    const mslot = (k, v) => eq(mr.minta[k].spellcasting.slots.join('').replace(/0+$/, ''), v, k + ' slotok');
    mslot('Wizard/Cleric', '4331'); mslot('Paladin/Sorcerer', '43'); mslot('Barbarian/Wizard', '3'); mslot('Artificer/Wizard', '432'); mslot('Monk/Barbarian', '');
    eq([mr.minta['Warlock/Sorcerer'].spellcasting.pact.max, mr.minta['Warlock/Sorcerer'].spellcasting.pact.level, mr.minta['Warlock/Sorcerer'].spellcasting.slots[0]], [2, 3, 3], 'Warlock 5 Pact + Sorcerer 2 rendes');
    eq([mr.minta['Fighter/Ranger'].cache.atk, mr.minta['Barbarian/Monk'].cache.atk], [2, 2], 'Extra Attack nem halmozódik');
    // az Artificer infúzió, a Warlock Pact Boon: az opcionális választásoknak legalább ennyi helye van
    const opt = (cls, n, L) => H.calc(mkS({levels: lv(cls, L)}), rb).choices.find(x => x.kind === 'opt' && x.key.endsWith(n))?.n;
    eq([opt('Warlock', 'Eldritch Invocations', 20), opt('Warlock', 'Pact Boon', 3), opt('Sorcerer', 'Metamagic', 17), opt('Sorcerer', 'Metamagic', 10), opt('Fighter', 'Fighting Style', 1)], [8, 1, 4, 3, 1], 'a progression teljes darabszám, nem növekmény');
    const bm = H.calc(mkS({levels: lv('Fighter', 15), sub: {Fighter: 'Battle Master|PHB'}}), rb).choices.find(x => x.key.endsWith(':Maneuvers'));
    eq(bm.n, 9, 'Battle Master 15: 9 maneuver');
    const at = H.calc(mkS({levels: lv('Rogue', 3), sub: {Rogue: 'Arcane Trickster|PHB'}}), rb);
    ok(at.always.some(x => x.name === 'Mage Hand'), 'AT: a Mage Hand a szabálykönyvből mindig megvan, a táblázat csak a többi cantripet számolja');
    eq(at.choices.find(x => x.key === 'Rogue:cantrips').n, 2);
  }, {online: true});
});

// ======================================================================
// multiclass-minta: az rb3 a PHB 163. o. feltételeivel (az 5e.tools requirements alakjában), multiclass-jártasságokkal és a nem halmozódó jellemzőkkel
const rbMc = () => {
  const rb = rb3(), c = n => rb.classes.find(x => x.n === n);
  const req = {Barbarian: {str: 13}, Monk: {dex: 13, wis: 13}, Paladin: {str: 13, cha: 13}, Bard: {cha: 13}, Cleric: {wis: 13}, Fighter: {or: [{str: 13, dex: 13}]}, Wizard: {int: 13}, Ranger: {dex: 13, wis: 13}};
  for (const [n, r] of Object.entries(req)) c(n).mc = {req: r, fx: []};
  c('Bard').mc.fx = [{armor: ['light']}, {skillChoose: {from: 'any', n: 1}}];
  c('Fighter').mc.fx = [{armor: ['light', 'medium', 'shields']}, {weapon: ['simple', 'martial']}];
  for (const n of ['Barbarian', 'Monk', 'Paladin', 'Fighter', 'Ranger']) c(n).feats.push({n: 'Extra Attack', lvl: 5});
  c('Fighter').feats.push({n: 'Extra Attack (2)', lvl: 11});
  // a valódi szabálykönyvben a Paladin Channel Divinity-je az eskü (alosztály) jellemzője
  rb.subclasses.push({n: 'Oath of Devotion', short: 'Devotion', cls: 'Paladin', s: 'PHB'}, {n: 'Bladesinging', short: 'Bladesinging', cls: 'Wizard', s: 'TCE'});
  rb.features.push({n: 'Channel Divinity', cls: 'Paladin', sub: 'Devotion', ss: 'PHB', lvl: 3, s: 'PHB', tx: 'Eskü.'}, {n: 'Extra Attack', cls: 'Wizard', sub: 'Bladesinging', ss: 'TCE', lvl: 6, s: 'TCE', tx: 'Két.'});
  c('Fighter').feats.push({n: 'Extra Attack (3)', lvl: 20});
  return rb;
};
describe('Multiclass: szabálymotor (TERV-multiclass.md, 1. lépés)', () => {
  const H = () => W.Sheet;
  const mc = (base, levels, extra = {}) => mkS({base, levels, ...(extra.build || {})}, extra.lap || {});
  test('mcCheck: az új osztály és a meglévők feltétele; meglévő osztálynál nincs; vagy-feltétel; homebrew osztály', () => {
    const rb = rbMc();
    eq(H().mcCheck(mc({str: 8, dex: 13, int: 12}, lv('Fighter', 3)), rb, 'Wizard'), {ok: false, uj: true, hiany: ['INT 13 kell (most 12)']});
    eq(H().mcCheck(mc({str: 8, dex: 13, int: 13}, lv('Fighter', 3)), rb, 'Wizard'), {ok: true, uj: true, hiany: []}, 'Fighter: STR 8, de DEX 13 elég');
    eq(H().mcCheck(mc({str: 8, dex: 12, int: 14}, lv('Fighter', 3)), rb, 'Wizard'), {ok: false, uj: true, hiany: ['Fighter miatt: STR 13 vagy DEX 13 kell (most 8 / 12)']});
    eq(H().mcCheck(mc({str: 8, int: 12}, lv('Fighter', 3)), rb, 'Fighter'), {ok: true, uj: false, hiany: []}, 'meglévő osztály');
    eq(H().mcCheck(mc({str: 13, dex: 14, wis: 12}, lv('Fighter', 2)), rb, 'Monk').hiany, ['WIS 13 kell (most 12)'], 'Monk: két képesség');
    eq(H().mcCheck(mc({str: 13, int: 8}, lv('Fighter', 2)), rb, 'Próbaosztály'), {ok: true, uj: true, hiany: []}, 'ismeretlen osztály: nincs feltétel');
    eq(H().mcCheck(H().norm({classes: [{name: 'Rogue', level: 3}], abilities: {int: 10}}), rb, 'Wizard').hiany, ['INT 13 kell (most 10)'], 'kézi lap: a lap értékei');
    eq(H().mcCheck(H().norm({}), rb, 'Wizard').ok, true, 'osztály nélkül (új karakter) nincs feltétel');
  });
  test('mcCheck: a tárgy (Gauntlets of Ogre Power) nem teljesíti a feltételt, a kézi felülírás (✎) igen', () => {
    const rb = rbMc(), s = mc({str: 10, int: 14}, lv('Wizard', 3), {lap: {inventory: inv({name: 'Gauntlets of Ogre Power', attuned: true})}});
    eq(H().calc(s, rb).abilities.str.v, 19);
    eq(H().mcCheck(s, rb, 'Barbarian').hiany, ['STR 13 kell (most 10)']);
    eq(H().mcCheck(H().norm({...s, ov: {'ab:str': 14}}), rb, 'Barbarian').ok, true);
  });
  test('Unarmored Defense csak az elsőként megszerzett osztályé; páncélban egyik sem', () => {
    const rb = rbMc(), base = {str: 13, dex: 16, con: 16, wis: 13};
    let c = H().calc(mc(base, [...lv('Monk', 2), ...lv('Barbarian', 1)]), rb);
    eq([c.ac.v, c.acNote], [14, 'Unarmored Defense (Monk 1)'], 'Monk 2 / Barbarian 1: 10 + DEX 3 + WIS 1, a Barbarian CON-os képlete nem jár');
    c = H().calc(mc(base, [...lv('Barbarian', 1), ...lv('Monk', 2)]), rb);
    eq([c.ac.v, c.acNote], [16, 'Unarmored Defense (Barbarian 1)'], 'Barbarian 1 / Monk 2');
    c = H().calc(mc(base, [...lv('Fighter', 5), ...lv('Barbarian', 1)], {lap: {inventory: inv('Chain Mail')}}), rb);
    eq([c.ac.v, c.attacksPerAction], [16, 2], 'Fighter 5 / Barbarian 1 páncélban: Chain Mail, 2 támadás');
  });
  test('Extra Attack nem halmozódik: a legnagyobb számít', () => {
    const rb = rbMc(), base = {str: 13, dex: 13, wis: 13};
    eq([H().calc(mc(base, lv('Fighter', 4)), rb).attacksPerAction, H().calc(mc(base, lv('Fighter', 5)), rb).attacksPerAction, H().calc(mc(base, lv('Fighter', 11)), rb).attacksPerAction], [1, 2, 3]);
    eq(H().calc(mc(base, [...lv('Fighter', 5), ...lv('Ranger', 5)]), rb).attacksPerAction, 2, 'Fighter 5 / Ranger 5: nem 3');
    eq(H().calc(mc(base, [...lv('Fighter', 11), ...lv('Ranger', 5)]), rb).attacksPerAction, 3);
    eq(H().calc(mc(base, lv('Fighter', 20)), rb).attacksPerAction, 4, 'Fighter 20');
    const bs = H().calc(mc({...base, int: 13}, [...lv('Wizard', 6), ...lv('Fighter', 5)], {build: {sub: {Wizard: 'Bladesinging|TCE'}}}), rb);
    eq(bs.attacksPerAction, 2, 'Bladesinging 6 / Fighter 5: alosztályé is, nem 3');
  });
  test('Expertise ugyanarra a skillre kétszer nem (Rogue 1 / Bard 3)', () => {
    const rb = rbVarazs(), c = H().calc(mkS({base: {dex: 14, cha: 14}, levels: [...lv('Rogue', 1), ...lv('Bard', 3)], ch: {'Rogue:1:skills': ['stealth', 'perception', 'arcana', 'acrobatics'], 'Rogue:1:expertise': ['stealth', 'arcana']}}), rb);
    const bard = c.choices.find(x => x.key === 'Bard:3:expertise');
    ok(bard, 'Bard 3 expertise');
    const o = H().choiceOptions(bard, c, rb).opts;
    eq([o.find(x => x.v === 'stealth').dis, o.find(x => x.v === 'perception').dis], [true, false], 'a Rogue-val választott nem, a többi igen');
  });
  test('Channel Divinity: Cleric + Paladin egy erőforrás, a nagyobb számít', () => {
    const rb = rbMc(), base = {str: 13, wis: 13, cha: 13}, cd = levels => H().calc(mc(base, levels, {build: {sub: {Paladin: 'Devotion|PHB'}}}), rb).resources.filter(r => r.name === 'Channel Divinity');
    eq(cd(lv('Paladin', 3)), [{name: 'Channel Divinity', max: 1, reset: 'short'}]);
    eq(cd([...lv('Cleric', 2), ...lv('Paladin', 3)]), [{name: 'Channel Divinity', max: 1, reset: 'short'}], 'Cleric 2 / Paladin 3: 1, nem 2');
    eq(cd([...lv('Cleric', 6), ...lv('Paladin', 3)]).map(r => r.max), [2], 'Cleric 6 / Paladin 3');
  });
  test('multiclass-jártasság, mentők az első osztályból, HP, Fighting Style kétszer nem, spell slotok és spellszint osztályonként', () => {
    const rb = rbMc(), base = {str: 13, dex: 14, con: 14, int: 13, wis: 13, cha: 13};
    let c = H().calc(mc(base, [...lv('Fighter', 1), ...lv('Bard', 1)]), rb);
    ok(c.choices.some(x => x.key === 'Bard:mc:skills' && x.n === 1), 'Bard multiclass: 1 skill');
    ok(!c.choices.some(x => x.key === 'Bard:1:skills'), 'nem a Bard teljes 3 skillje');
    eq(['str', 'dex', 'con', 'cha'].map(a => c.saves[a].prof), [1, 0, 1, 0], 'mentők csak a Fighterből');
    eq(c.hpMax.v, 10 + 2 + 5 + 2, 'Bard 1. szint: átlag (5), nem a maximum');
    c = H().calc(mc(base, [...lv('Fighter', 1), ...lv('Paladin', 2)], {build: {ch: {'Fighter:opt:Fighting Style': ['Defense|PHB']}}}), rb);
    const pal = c.choices.find(x => x.key === 'Paladin:opt:Fighting Style');
    eq(H().choiceOptions(pal, c, rb).opts.find(o => o.v === 'Defense|PHB').dis, true, 'a Fighterrel választott Fighting Style a Paladinnál nem választható');
    c = H().calc(mc(base, [...lv('Fighter', 3), ...lv('Wizard', 1)], {build: {sub: {Fighter: 'Eldritch Knight|PHB'}}}), rb);
    eq([c.slots.filter(Boolean), c.casting.find(x => x.cls === 'Wizard').maxSpell], [[3], 1], 'EK 3 / Wizard 1: caster level 2, a spellbook csak 1. szintű');
    const sl = cls => { const r = H().slotsFor(cls); return [r.slots.filter(Boolean), r.pact]; };
    eq(sl([{name: 'Paladin', level: 2}, {name: 'Sorcerer', level: 3}])[0], [4, 3], 'Paladin 2 / Sorcerer 3: caster level 4');
    eq(sl([{name: 'Artificer', level: 3}, {name: 'Wizard', level: 1}])[0], [4, 2], 'Artificer 3 / Wizard 1: caster level 3 (Artificer felfelé)');
    eq(sl([{name: 'Warlock', level: 3}, {name: 'Sorcerer', level: 2}]), [[3], {max: 2, level: 2}], 'Warlock 3 / Sorcerer 2: Pact külön');
  });
  test('a lap cache-e osztályonként (spells) és a támadás akciónként (atk); tisztítás (normCache); a DM Screen statblokkja osztályonként', () => {
    const rb = rbMc(), s = mc({str: 13, con: 12, int: 16, wis: 14}, [...lv('Fighter', 5), ...lv('Wizard', 1), ...lv('Cleric', 1)]);
    const n = H().norm({...s, ...H().materialize(s, H().calc(s, rb))});
    eq([n.cache.spells, n.cache.atk], [[{cls: 'Wizard', ab: 'int', dc: 14, atk: 6, prep: 4}, {cls: 'Cleric', ab: 'wis', dc: 13, atk: 5, prep: 3}], 2]);
    eq([H().spellCasts(n).length, H().attacksPerAction(n), H().attacksPerAction(H().norm({cache: {atk: 3}}))], [2, 2, 1], 'kézi lapon 1');
    eq(H().spellCasts(H().norm({classes: [{name: 'Bard', level: 2}], abilities: {cha: 16}})), [{cls: '', ab: 'cha', dc: 13, atk: 5}], 'kézi lap: egy sor');
    const c = H().norm({auto: true, build: {}, cache: {spells: [{cls: XSS, ab: 'x', dc: '14', atk: 6, prep: 99, extra: 1}, {cls: '', dc: 1, atk: 1}, {cls: 'Bard', dc: 12}, 'x'], atk: 9}}).cache;
    eq([c.spells, c.atk], [[{cls: XSS.slice(0, 60).trim(), ab: '', dc: 14, atk: 6, prep: 99}], 4]);
    eq(H().norm({auto: true, build: {}, cache: {}}).cache.atk, 1);
    const t = W.sheetToCreature(n, {kind: 'pc'}).traits;
    eq(t.find(x => x.name === 'Támadás akciónként')?.text, '2 (Extra Attack, az Attack action része)');
    const spl = W.sheetToCreature(H().norm({...n, spells: [{name: 'Shield', level: 1, cls: 'Wizard'}]}), {kind: 'pc'}).traits.find(x => x.name === 'Varázslatok').text;
    has(spl, 'Wizard: spell save DC 14, +6 to hit; Cleric: spell save DC 13, +5 to hit');
  });
  test('szintlépés új osztályba: a terv az új osztály 1. szintjének választásait kéri, HP az új osztály kockájával', () => {
    const rb = rbMc(), s = mc({str: 13, dex: 14, con: 14, cha: 13}, lv('Fighter', 3));
    const plan = H().levelUpPlan(s, rb, H().levelUpBuild(s, 'Bard'));
    eq([plan.cls, plan.classLevel, plan.hp.hd, plan.hp.gain], ['Bard', 1, 8, 5 + 2]);
    ok(plan.choices.some(x => x.c.key === 'Bard:mc:skills' && x.uj), 'multiclass skill');
    const n = H().norm({...s, ...H().levelUpApply(s, rb, H().levelUpBuild(s, 'Bard'))});
    eq([H().classLabel(n), n.saveProf.sort()], ['Fighter 3 / Bard 1', ['con', 'str']]);
  });
});

describe('Átállítás és faji varázslat (sheet.js)', () => {
  const rbElf = () => {
    const rb = rbVarazs();
    rb.races.push({n: 'Elf', s: 'PHB', subs: 1, fx: [{ab: {dex: 2}}, {skill: {perception: true}}], traits: []});
    rb.subraces.push({n: 'High', race: 'Elf', s: 'PHB', fx: [{ab: {int: 1}}, {langChoose: {n: 1}}, {todo: 'known varázslat választása (1. szinttől)'}], traits: [{n: 'Cantrip', tx: 'Egy wizard cantrip.'}]});
    rb.backgrounds = [{n: 'Sage', s: 'PHB', fx: [{skill: {arcana: true, history: true}}, {langChoose: {n: 2}}]}];
    rb.subclasses = [...rb.subclasses.filter(x => x.short !== 'Fiend'), {n: 'The Fiend', short: 'Fiend', cls: 'Warlock', s: 'PHB', fx: [{spells: [{t: 'expanded', lvl: 1, sp: ['burning hands']}]}]}];
    rb.spells = [...rb.spells.filter(x => x.n !== 'Burning Hands'), {n: 'Burning Hands', s: 'PHB', l: 1, sc: 'evocation', cl: ['Sorcerer', 'Wizard']}];
    return rb;
  };
  const elf = (extra = {}) => ({auto: true, build: {base: {dex: 14}, levels: lv('Rogue', 1), race: 'Elf|PHB', subrace: 'High|PHB', spells: {}, ...extra}});
  test('High Elf: valódi választás a Wizard cantripekből, ✋ teendő nélkül; a választott a lapra kerül; érvénytelen nem számít; ami megvan, nem választható', () => {
    const H = W.Sheet, rb = rbElf();
    let s = H.norm(elf()), cr = H.calc(s, rb), c = cr.choices.find(x => x.kind === 'spell');
    ok(c && !c.done, 'van hely');
    ok(!cr.todos.some(t => t.kind === 'manual' && /varázslat/.test(t.text)), 'nincs ✋ teendő');
    const o = H.choiceOptions(c, cr, rb);
    ok(!o.multi && !o.free && o.opts.length && o.opts.every(x => x.v.endsWith('|PHB')));
    ok(o.opts.some(x => x.l === 'Fire Bolt') && !o.opts.some(x => x.l === 'Sleep') && !o.opts.some(x => x.l === 'Guidance'), 'csak Wizard cantrip');
    s = H.norm({...s, build: H.setChoice(s.build, c, ['Fire Bolt|PHB'])});
    cr = H.calc(s, rb); c = cr.choices.find(x => x.kind === 'spell');
    ok(c.done, 'kész'); eq(c.ok, ['Fire Bolt|PHB']);
    ok(cr.always.some(x => x.name === 'Fire Bolt' && x.level === 0), 'megvan');
    const m = H.norm({...s, ...H.materialize(s, cr)});
    ok(m.spells.some(x => x.name === 'Fire Bolt' && x.always), 'a Varázslat fülön');
    // érvénytelen: nem Wizard vagy nem cantrip
    for (const rossz of ['Guidance|PHB', 'Sleep|PHB', 'Nincs|PHB']) {
      const y = H.norm({...s, build: H.setChoice(s.build, c, [rossz])}); ok(!H.calc(y, rb).choices.find(x => x.kind === 'spell').done, rossz);
    }
    // Wizardként a már tanult cantrip nem választható
    const w = H.norm(elf({levels: lv('Wizard', 1), spells: {Wizard: {cantrips: ['Fire Bolt|PHB']}}})), cw = H.calc(w, rb);
    ok(H.choiceOptions(cw.choices.find(x => x.kind === 'spell'), cw, rb).opts.find(x => x.l === 'Fire Bolt').dis);
  });
  test('átállítás: a nyitott helyek a meglévő jártasságokból, nyelvekből, faji varázslatból töltődnek; nem marad felülírás és új kérés; ami nem fér be, felülírás marad', () => {
    const H = W.Sheet, rb = rbElf();
    const lap = H.norm({race: 'High Elf', background: 'Sage', classes: [{name: 'Rogue', level: 1}], abilities: {dex: 16, int: 11},
      skillProf: {arcana: 1, history: 1, perception: 1, stealth: 2, acrobatics: 2, deception: 1, insight: 1, 'sleight-of-hand': 1, athletics: 1},
      profs: {languages: 'Common, Elvish, Dwarvish, Giant, Goblin', tools: "thieves' tools"}, spells: [{name: 'Fire Bolt', level: 0}]});
    const p = H.toAuto(lap, rb), cr = H.calc({...lap, ...p}, rb);
    const ch = k => cr.choices.find(x => x.key === k);
    for (const k of ['stealth', 'acrobatics', 'sleight-of-hand']) ok(ch('Rogue:1:skills').ok.includes(k), 'skillek: ' + fmt(ch('Rogue:1:skills').ok));
    ok(!ch('Rogue:1:skills').ok.includes('arcana') && !ch('Rogue:1:skills').ok.includes('perception'), 'ami máshonnan jár, nem foglal helyet');
    eq(ch('Rogue:1:expertise').ok.sort(), ['acrobatics', 'stealth'], 'expertise');
    eq(ch('subrace:lang').ok.length + ch('bg:lang').ok.length, 3, 'nyelvek');
    eq(cr.choices.find(x => x.kind === 'spell').ok, ['Fire Bolt|PHB'], 'a faji cantrip');
    for (const k of ['stealth', 'arcana', 'perception']) ok(!('skill:' + k in p.ov), k + ' nem felülírás');
    eq(cr.skills.stealth.prof, 2);
    // ami nem fér be egyetlen helyre sem, felülírásként megmarad (semmi nem vész el)
    const sok = H.norm({...lap, skillProf: {...lap.skillProf, survival: 1, nature: 1, medicine: 1, religion: 1, intimidation: 1}});
    const q = H.toAuto(sok, rb), c2 = H.calc({...sok, ...q}, rb);
    for (const k of Object.keys(sok.skillProf)) ok(c2.skills[k].prof === sok.skillProf[k], k);
  });
  test('átállítás után a felülírásból jártas skill még választható a helyre (a már átállított lapokhoz), és a felülírás megszűnik; a máshonnan jártas nem, felülírással sem', () => {
    const H = W.Sheet, rb = rbElf();
    const s = H.norm({...elf(), ov: {'skill:stealth': 1, 'skill:perception': 2}}), cr = H.calc(s, rb), c = cr.choices.find(x => x.key === 'Rogue:1:skills');
    const o = H.choiceOptions(c, cr, rb), sor = k => o.opts.find(x => x.v === k);
    ok(!sor('stealth').dis, 'választható');
    ok(sor('perception').dis, 'a fajtól jár, a felülírás expertise');
    eq(H.ovAfterChoice(s, c, ['stealth']), {'skill:perception': 2});
    const e = {kind: 'expertise'};
    eq(H.ovAfterChoice(H.norm({ov: {'skill:stealth': 2}}), e, ['stealth']), {});
    eq(H.ovAfterChoice(H.norm({ov: {'skill:stealth': 2}}), c, ['stealth']), {'skill:stealth': 2}, 'skill-hely az expertise felülírást nem viszi');
    eq(H.ovAfterChoice(s, {kind: 'lang'}, ['x']), s.ov);
  });
  test('expertise a csak kézi felülírásból (✎) jártas skillre: kiválasztható, nem esik ki a választásból, és expertise lesz; levéve a jártasság marad', () => {
    const H = W.Sheet, rb = rbElf();
    // Rogue 1: a skill-hely más négy skillel tele, a Stealth és az Athletics csak felülírásból jártas (az utóbbi kézi expertise-szel)
    let s = H.norm({...elf(), build: {...elf().build, ch: {'Rogue:1:skills': ['acrobatics', 'sleight-of-hand', 'arcana', 'perception']}}, ov: {'skill:stealth': 1, 'skill:athletics': 2}});
    const pick = v => { const cr = H.calc(s, rb), c = cr.choices.find(x => x.key === 'Rogue:1:expertise'); s = H.norm({...s, build: H.setChoice(s.build, c, v), ov: H.ovAfterChoice(s, c, v, cr)}); return H.calc(s, rb); };
    let cr = H.calc(s, rb), o = H.choiceOptions(cr.choices.find(x => x.key === 'Rogue:1:expertise'), cr, rb);
    for (const k of ['stealth', 'athletics']) ok(o.opts.some(x => x.v === k && !x.dis), k + ' választható');
    cr = pick(['stealth']);
    eq(cr.choices.find(x => x.key === 'Rogue:1:expertise').ok, ['stealth'], 'a választás megmarad');
    eq(cr.skills.stealth.prof, 2, 'expertise');
    eq(s.ov['skill:stealth'], 1, 'a felülírás a jártasság alapjaként marad');
    o = H.choiceOptions(cr.choices.find(x => x.key === 'Rogue:1:expertise'), cr, rb);
    ok(o.opts.some(x => x.v === 'stealth'), 'a sor nem tűnik el');
    cr = pick(['stealth', 'athletics']);
    eq(cr.choices.find(x => x.key === 'Rogue:1:expertise').ok, ['stealth', 'athletics']);
    ok(cr.choices.find(x => x.key === 'Rogue:1:expertise').done, 'kész');
    eq([cr.skills.stealth.prof, cr.skills.athletics.prof, s.ov['skill:athletics']], [2, 2, 1], 'a kézi expertise-t a választás viszi, a jártasság alapja marad');
    ok(cr.skills.stealth.ov, 'kézi jelölés (✎) marad');
    // a skill-helyre választva a felülírás megszűnik, az expertise az új alapon marad
    const c = cr.choices.find(x => x.key === 'Rogue:1:skills'), v = ['acrobatics', 'sleight-of-hand', 'arcana', 'stealth'];
    ok(!H.choiceOptions(c, cr, rb).opts.find(x => x.v === 'stealth').dis, 'a kézi jártasság expertise-szel is helyre választható');
    s = H.norm({...s, build: H.setChoice(s.build, c, v), ov: H.ovAfterChoice(s, c, v, cr)}); cr = H.calc(s, rb);
    ok(!('skill:stealth' in s.ov), 'nincs felülírás');
    eq([cr.skills.stealth.prof, cr.skills.stealth.ov], [2, false]);
    cr = pick(['stealth']);
    eq([cr.skills.athletics.prof, s.ov['skill:athletics']], [1, 1], 'levéve: a kézi jártasság marad');
  });
  test('átállítás: a helyre nem férő nyelv, eszköz, páncél, fegyver, érzék, ellenállás nem vész el; a szinonima (light armor) nem duplázódik; szintlépés után is megmarad', () => {
    const H = W.Sheet, rb = rbElf();
    const lap = H.norm({classes: [{name: 'Fighter', level: 1}], abilities: {str: 16}, senses: 'blindsight 10 ft.', resist: 'poison',
      profs: {armor: 'light armor, medium armor, heavy armor, shields, Saját vért', weapons: 'simple weapons, martial weapons, Saját fegyver', tools: 'Saját eszköz', languages: 'Common, Aquan, Druidic'}});
    const p = H.toAuto(lap, rb);
    eq([p.ov['plus:armor'], p.ov['plus:weapons'], p.ov['plus:tools'], p.ov['plus:senses'], p.ov['plus:resist']], ['Saját vért', 'Saját fegyver', 'Saját eszköz', 'blindsight 10 ft.', 'poison']);
    has(p.ov['plus:languages'], 'Aquan');
    const s = H.norm({...lap, ...p}), m = H.norm({...s, ...H.materialize(s, H.calc(s, rb))});
    has(m.profs.languages, 'Druidic'); has(m.profs.armor, 'Saját vért'); has(m.profs.tools, 'Saját eszköz');
    has(m.senses, 'blindsight'); has(m.resist, 'poison');
    eq(H.norm(JSON.parse(JSON.stringify(m))).ov, m.ov, 'a tisztító stabil');
    const u = H.norm({...m, ...H.levelUpApply(m, rb, H.levelUpBuild(m, 'Fighter'))});
    has(u.profs.languages, 'Druidic', 'szintlépés után');
    eq(H.norm({ov: {'plus:rossz': 'x', 'plus:armor': '  '}}).ov, {});
  });
  test('átállítás: a faji cantrip az osztálylistán kívülit veszi, és nem foglal osztályhelyet; a jegyzete megmarad', () => {
    const H = W.Sheet, rb = rbElf();
    const lap = H.norm({race: 'High Elf', classes: [{name: 'Bard', level: 1}], abilities: {cha: 16}, spells: [{name: 'Fire Bolt', level: 0, note: 'jegyzet'}, {name: 'Light', level: 0}, {name: 'Vicious Mockery', level: 0}]});
    const s = H.norm({...lap, ...H.toAuto(lap, rb)}), cr = H.calc(s, rb);
    eq(cr.choices.find(x => x.kind === 'spell').ok, ['Fire Bolt|PHB'], 'a Bard listáján nincs');
    const b = H.adoptSpells(s, rb);
    eq(b.spells.Bard.cantrips.sort(), ['Light|PHB', 'Vicious Mockery|PHB'], 'az osztályhelyre a többi');
    const n = H.norm({...s, build: b}), m = H.norm({...n, ...H.materialize(n, H.calc(n, rb))});
    eq(m.spells.filter(x => x.name === 'Fire Bolt').map(x => [x.always, x.note]), [[true, 'jegyzet']]);
  });
  test('Warlock: a patrón kibővíti a listát (Burning Hands); kézzel írt patrónnév is felismerve; két találatnál nem talál', () => {
    const H = W.Sheet, rb = rbElf();
    eq(['The Fiend', 'fiend', 'Fiend patron', 'A Fiend (ördög)'].map(n => H.subclassRef('Warlock', n, rb)), Array(4).fill('The Fiend|PHB'));
    eq(H.subclassRef('Warlock', 'Sárkány', rb), '');
    const l = H.norm({classes: [{name: 'Warlock', subclass: 'Fiend patron', level: 3}], abilities: {cha: 16}, spells: [{name: 'Burning Hands', level: 1, prepared: true}]});
    const p = H.toAuto(l, rb), s = H.norm({...l, ...p});
    eq(s.build.sub.Warlock, 'The Fiend|PHB');
    const b = H.adoptSpells(s, rb);
    eq(b.spells.Warlock.known, ['Burning Hands|PHB'], 'a meglévő varázslat besorolva');
  });
  test('Pact of the Tome: 3 cantrip bármelyik osztály listájáról, kötelezően a szintlépésben; a lapra kerül; Book of Ancient Secrets: 2 ritual', () => {
    const H = W.Sheet, rb = rbElf();
    rb.optfeatures = [...(rb.optfeatures || []).filter(o => !['Pact of the Tome', 'Book of Ancient Secrets'].includes(o.n)), {n: 'Pact of the Tome', s: 'PHB', t: ['PB'], fx: [{todo: 'known varázslat választása (1. szinttől)'}]}, {n: 'Book of Ancient Secrets', s: 'PHB', t: ['EI']}];
    rb.spells.push({n: 'Rituálé', s: 'PHB', l: 1, ri: true, cl: ['Wizard']});
    const b = {base: {cha: 16}, levels: lv('Warlock', 3), sub: {Warlock: 'The Fiend|PHB'}, spells: {}, ch: {'Warlock:opt:Pact Boon': ['Pact of the Tome|PHB']}};
    let s = H.norm({auto: true, build: b}), cr = H.calc(s, rb), c = cr.choices.find(x => x.kind === 'spell');
    eq([c.key, c.n, c.done], ['opt:Pact of the Tome:spell', 3, false]);
    ok(!cr.todos.some(t => t.kind === 'manual' && /varázslat választása/.test(t.text)), 'nincs ✋');
    const o = H.choiceOptions(c, cr, rb), nevek = o.opts.map(x => x.l);
    ok(nevek.includes('Guidance') && nevek.includes('Vicious Mockery') && nevek.includes('Fire Bolt') && !nevek.includes('Sleep'), 'bármelyik osztály cantripje, csak cantrip');
    s = H.norm({...s, build: H.setChoice(s.build, c, ['Guidance|PHB', 'Vicious Mockery|PHB', 'Fire Bolt|PHB'])});
    cr = H.calc(s, rb);
    ok(cr.choices.find(x => x.kind === 'spell').done);
    const m = H.norm({...s, ...H.materialize(s, cr)});
    eq(['Guidance', 'Vicious Mockery', 'Fire Bolt'].map(n => m.spells.find(x => x.name === n)?.always), [true, true, true]);
    // ritual: csak ritual, 1. szintű
    const r = H.norm({auto: true, build: {...b, ch: {...b.ch, 'Warlock:opt:Eldritch Invocations': ['Book of Ancient Secrets|PHB']}}}), rc = H.calc(r, rb), ch = rc.choices.find(x => x.key === 'opt:Book of Ancient Secrets:spell');
    ok(ch, 'van hely a ritualoknak');
    eq(H.choiceOptions(ch, rc, rb).opts.map(x => x.l), ['Rituálé']);
  });
  test('alosztály-választások: választható lehetőség, hatással (Hunter, Land, Divine Soul, Kensei, skill és jártasság); érvénytelen érték nem számít', () => {
    const H = W.Sheet, sub = (cls, short) => ({n: short, short, cls, s: 'PHB'}), f = (cls, short, n, lvl) => ({n, cls, sub: short, ss: 'PHB', lvl, s: 'PHB', tx: 'x'});
    const rb = rbElf();
    rb.subclasses = [...rb.subclasses, sub('Ranger', 'Hunter'), sub('Druid', 'Land'), {...sub('Sorcerer', 'Divine Soul'), fx: [{spells: [{t: 'known', lvl: 1, sp: ['cure wounds']}]}]}, sub('Monk', 'Kensei'), sub('Cleric', 'Peace'), sub('Bard', 'Valor'), sub('Rogue', 'Scout')];
    rb.features = [...(rb.features || []), f('Ranger', 'Hunter', "Hunter's Prey", 3), f('Druid', 'Land', 'Circle Spells', 2), f('Druid', 'Land', 'Bonus Cantrip', 2), f('Sorcerer', 'Divine Soul', 'Divine Magic', 1), f('Monk', 'Kensei', 'Path of the Kensei', 3), f('Cleric', 'Peace', 'Implement of Peace', 1), f('Bard', 'Valor', 'Bonus Proficiencies', 3), f('Rogue', 'Scout', 'Survivalist', 3)];
    rb.spells.push({n: 'Hold Person', s: 'PHB', l: 2, cl: ['Bard']}, {n: 'Spike Growth', s: 'PHB', l: 2, cl: ['Druid']}, {n: 'Bless', s: 'PHB', l: 1, cl: ['Cleric']});
    const lapo = (cls, short, n, ch = {}) => H.norm({auto: true, build: {base: {}, levels: lv(cls, n), sub: {[cls]: short + '|PHB'}, spells: {}, ch}});
    const kind = (s, key) => H.calc(s, rb).choices.find(x => x.key === key);
    // Hunter: lista; a választott jellemzőként látszik; ami nincs a listán, nem számít
    const h = kind(lapo('Ranger', 'Hunter', 3), 'Ranger:3:pick');
    eq(H.choiceOptions(h, H.calc(lapo('Ranger', 'Hunter', 3), rb), rb).opts.map(x => x.v), ['Colossus Slayer', 'Giant Killer', 'Horde Breaker']);
    const hk = H.calc(lapo('Ranger', 'Hunter', 3, {'Ranger:3:pick': ['Giant Killer']}), rb);
    ok(hk.choices.find(x => x.key === 'Ranger:3:pick').done); ok(hk.features.some(x => x.name === "Hunter's Prey: Giant Killer"));
    ok(!kind(lapo('Ranger', 'Hunter', 3, {'Ranger:3:pick': ['Nincs']}), 'Ranger:3:pick').done);
    // Land: a terep adja a varázslatokat (nem mindig az Arctic), a Bonus Cantrip választás
    const land = H.calc(lapo('Druid', 'Land', 3, {'Druid:2:pick': ['Coast']}), rb);
    ok(land.always.some(x => x.name.toLowerCase() === 'misty step') && !land.always.some(x => x.name === 'Spike Growth'), 'a terep varázslata');
    ok(H.calc(lapo('Druid', 'Land', 3, {'Druid:2:pick': ['Arctic']}), rb).always.some(x => x.name === 'Spike Growth'));
    ok(!H.calc(lapo('Druid', 'Land', 2, {'Druid:2:pick': ['Arctic']}), rb).always.some(x => x.name === 'Spike Growth'), '3. szint alatt még nem');
    ok(land.choices.some(x => x.kind === 'spell' && x.src.startsWith('Bonus Cantrip')));
    // Divine Soul: affinity varázslat, és a Cleric lista is választható
    const ds = H.calc(lapo('Sorcerer', 'Divine Soul', 1, {'Sorcerer:1:pick': ['Law']}), rb);
    ok(ds.always.some(x => x.name === 'Bless') && !ds.always.some(x => /cure wounds/i.test(x.name)), 'az affinity szerint');
    ok(H.choiceOptions(ds.choices.find(x => x.kind === 'known'), ds, rb).opts.some(x => x.l === 'Bless'), 'a Cleric listáról is');
    // Kensei: két szabad szöveg, fegyver-jártasságként; eszköz listából
    const ke = H.calc(lapo('Monk', 'Kensei', 3, {'Monk:3:pick': ['Longbow', 'Glaive']}), rb);
    has(ke.profs.weapons, 'Longbow'); has(ke.profs.weapons, 'Glaive');
    ok(H.choiceOptions(ke.choices.find(x => x.key === 'Monk:3:pick'), ke, rb).free, 'szabad szöveg');
    // skill, páncél, dupla jártasság
    eq(kind(lapo('Cleric', 'Peace', 1), 'Cleric:1:skills2')?.from, ['insight', 'performance', 'persuasion']);
    const va = H.calc(lapo('Bard', 'Valor', 3), rb); has(va.profs.armor, 'medium'); has(va.profs.weapons, 'martial');
    eq(H.calc(lapo('Rogue', 'Scout', 3), rb).skills.survival.prof, 2, 'Scout: dupla jártasság');
    // a háttértől már jártas skill is dupla lesz; arra expertise már nem választható
    rb.backgrounds.push({n: 'Vadász', s: 'PHB', fx: [{skill: {survival: true}}]});
    const sc = H.norm({auto: true, build: {base: {}, levels: lv('Rogue', 3), sub: {Rogue: 'Scout|PHB'}, background: 'Vadász|PHB', spells: {}}}), cs = H.calc(sc, rb);
    eq(cs.skills.survival.prof, 2, 'a háttér után is');
    ok(H.choiceOptions(cs.choices.find(x => x.kind === 'expertise'), cs, rb).opts.find(x => x.v === 'survival').dis);
    // Kensei: a fegyverek száma a szinttel nő
    eq([3, 6, 11, 17].map(n => H.calc(lapo('Monk', 'Kensei', n), rb).choices.find(x => x.key === 'Monk:3:pick').n), [2, 3, 4, 5]);
    // szabad szöveg: a „{” nem dönti el a számolást, a jellemzők közé csak szövegként kerül
    const fura = H.calc(lapo('Monk', 'Kensei', 3, {'Monk:3:pick': ['{x', '<img src=x onerror=alert(1)>']}), rb);
    eq(fura.choices.find(x => x.key === 'Monk:3:pick').ok, ['{x', '<img src=x onerror=alert(1)>']);
  });
  test('valódi szabálykönyvvel: Land terep a valódi varázslatokkal; a táblák minden varázslata létezik; Pact of the Tome', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const land = H.calc(H.norm({auto: true, build: {base: {}, levels: lv('Druid', 9), sub: {Druid: 'Circle of the Land|PHB'}, spells: {}, ch: {'Druid:2:pick': ['Swamp']}}}), rb);
    for (const n of ["Melf's Acid Arrow", 'Darkness', 'Water Walk', 'Stinking Cloud', 'Scrying']) ok(land.always.some(x => x.name === n && x.ref), 'Swamp: ' + n);
    const mind = Object.values(H.FEATURE_FX).flat().flatMap(f => f.pickChoose?.then ? Object.values(f.pickChoose.then).flat().flatMap(x => (x.spells || []).flatMap(y => y.sp)) : []);
    eq([...new Set(mind)].filter(n => !rb.spells.some(s => s.n.toLowerCase() === n.toLowerCase())), [], 'minden táblabeli varázslat létezik');
    const w = H.norm({auto: true, build: {base: {cha: 16}, levels: lv('Warlock', 3), sub: {Warlock: 'The Fiend|PHB'}, spells: {}, ch: {'Warlock:opt:Pact Boon': ['Pact of the Tome|PHB']}}}), cw = H.calc(w, rb), c = cw.choices.find(x => x.key === 'opt:Pact of the Tome:spell');
    ok(c && c.n === 3); ok(H.choiceOptions(c, cw, rb).opts.length > 30, 'minden osztály cantripje');
    ok(!cw.todos.some(t => t.kind === 'manual' && /varázslat választása/.test(t.text)), 'nincs ✋');
  }, {online: true});
  test('valódi szabálykönyvvel: High Elf cantrip választható; Fiend Warlocknál a Burning Hands, más patrónnál nem; az átállítás a Wizard skilleket nem kéri újra', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const s = H.norm({auto: true, build: {base: {}, levels: lv('Rogue', 1), race: 'Elf|PHB', subrace: 'High|PHB', spells: {}}}), cr = H.calc(s, rb), c = cr.choices.find(x => x.kind === 'spell');
    ok(c, 'van hely'); ok(H.choiceOptions(c, cr, rb).opts.some(x => x.l === 'Fire Bolt'));
    ok(!cr.todos.some(t => t.kind === 'manual' && /varázslat választása/.test(t.text)), 'nincs ✋');
    const lista = sub => { const x = H.norm({auto: true, build: {base: {cha: 16}, levels: lv('Warlock', 3), sub: {Warlock: sub}, spells: {}}}), y = H.calc(x, rb); return H.choiceOptions(y.choices.find(k => k.kind === 'known'), y, rb).opts.map(k => k.l); };
    ok(lista('The Fiend|PHB').includes('Burning Hands')); ok(!lista('The Archfey|PHB').includes('Burning Hands'));
    const m = H.norm({race: 'High Elf', background: 'Sage', classes: [{name: 'Wizard', level: 3}], skillProf: {arcana: 1, history: 1, perception: 1, investigation: 1, medicine: 1}, abilities: {int: 16}, profs: {languages: 'Common, Elvish, Dwarvish, Giant, Goblin'}, spells: [{name: 'Fire Bolt', level: 0}]});
    const p = H.toAuto(m, rb), c3 = H.calc({...m, ...p}, rb);
    eq(['Wizard:1:skills', 'subrace:lang', 'bg:lang'].map(k => c3.choices.find(x => x.key === k).done), [true, true, true]);
    eq(Object.keys(p.ov).filter(k => k.startsWith('skill:')), []);
  }, {online: true});
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
    eq([sp.Fireball.atk, sp['Toll the Dead'].atk], [undefined, true], 'támadó varázslat (Spell Sniper): a spellAttack mezőből');
    eq([sp['Toll the Dead'].cl, sp['Toll the Dead'].clx, sp.Fireball.cl, sp.Fireball.clt, sp.Fireball.clx], [['Cleric', 'Warlock', 'Wizard'], ['Cleric', 'Warlock', 'Wizard'], ['Sorcerer', 'Wizard'], ['Cleric'], undefined],
      'a XGE osztálylistája a cl-ben (clx: jelöléshez), a TCE bővített listája külön (clt); a 2024-es (XPHB) nem');
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
    eq(rb.feats.map(f => f.pq), [undefined, [{race: [{n: 'elf'}, {n: 'half-elf'}]}], [{ab: [{str: 13}]}], undefined], 'a feltétel szerkezetben is (v3)');
    // a valódi 5e.tools-alakok: varázslás (PHB / TCE), jártasság, alfaj, csak szöveges feltétel (teljesültnek számít, a vagy-listát nem szigorítja)
    eq(W.featPq([{spellcasting: true}]), [{cast: true}]);
    eq(W.featPq([{spellcasting2020: true}]), [{cast: 'class'}]);
    eq(W.featPq([{proficiency: [{armor: 'medium'}]}, {proficiency: [{weapon: 'martial'}]}]), [{prof: ['armor:medium']}, {prof: ['weapon:martial']}]);
    eq(W.featPq([{race: [{name: 'elf', subrace: 'drow'}]}]), [{race: [{n: 'elf', sub: 'drow'}]}]);
    eq(W.featPq([{ability: [{int: 13}, {wis: 13}]}]), [{ab: [{int: 13}, {wis: 13}]}]);
    eq(W.featPq([{other: 'Valami'}]), [], 'csak nem ellenőrizhető feltétel: nincs pq');
    eq(W.featPq([{ability: [{str: 13}]}, {level: 4}]), [{ab: [{str: 13}]}, {}], 'a nem ellenőrizhető ág üres marad, nem esik ki');
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
    eq(c.todos.map(t => t.key), ['race:tool', 'Fighter:1:skills', 'Fighter:sub', 'Fighter:tce:Martial Versatility', 'Fighter:opt:Fighting Style'], 'a TCE-választás (Martial Versatility) is teendő, nem kötelező');
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
    eq([meta.counts.spells, meta.counts.items, meta.counts.variants, meta.counts.classes, meta.counts.races, meta.format], [4, 6, 3, 1, 3, 4]);
    const cache = {}, c = {get: async k => cache[k], set: async (k, v) => { cache[k] = v; }};
    let gets = 0; const db2 = {get: p => { gets++; return f.db.get(p); }};
    const r1 = await H.loadRulebook(db2, c);
    eq([r1.rb.spells.length, r1.format, gets], [4, 4, 1 + meta.chunks.length]);
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
    ok(lib().actions.some(a => a.text === 'Attack: +5 to hit. Hit: 1d6+3 piercing damage. finesse, light'), JSON.stringify(lib().actions));
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
  test('Játékos → NPC → Játékos: NPC-ként a lap gazda nélküli (a játékos nem látja), az e-mail megmarad; visszaállítva ugyanaz a lap, semmi nem vész el', async () => {
    // gazdag lap: szintek, felépítés (választások, varázslatok), tárgyak, pénz, HP, szintlépés-engedély
    const gazdag = sheetDoc({auto: true, classes: [{name: 'Rogue', subclass: 'Thief', level: 3, hitDie: 8}],
      build: {base: {dex: 16, con: 14}, levels: lv('Rogue', 3), sub: {Rogue: 'Thief|PHB'}, spells: {}, ch: {'Rogue:1:skills': ['stealth', 'perception', 'arcana', 'acrobatics'], 'Rogue:1:expertise': ['stealth', 'arcana']}},
      spells: [{name: 'Mage Hand', level: 0}, {name: 'Sleep', level: 1, prepared: true, note: 'jegyzet'}], inventory: [{name: 'Bag of Holding', qty: 1, ref: 'Bag of Holding|DMG'}, {name: 'Rope', qty: 2}],
      currency: {gp: 42, sp: 3}, hp: {max: 24, cur: 17, temp: 2}, notes: 'titok', levelUp: {to: 4}});
    const f = await loadWith({'sheets/p1': gazdag});
    const nelkul = s => { const {owner, updatedAt, updatedBy, ...rest} = s; return W.stableJson(rest); }, eredeti = nelkul(f.store['sheets/p1']);
    const tipus = async k => { W.openLib('lib'); click('[data-act="libEdit"]'); setVal($('#edForm').elements.kind, k); return $('#edForm'); };
    // → NPC: a szerkesztő szól, az e-mail megmarad, a lap és a nyilvános rész gazda nélküli
    let fm = await tipus('npc');
    has(fm.textContent, 'a@x.hu telefonos lapja megmarad, de amíg NPC, a játékos nem látja');
    f.log.splice(0); click('[data-act="edSave"]'); await wait(500);
    eq([lib().kind, lib().owner], ['npc', 'a@x.hu']);
    eq(f.store['sheets/p1'].owner, '', 'a játékos nem látja / nem szerkeszti (a szabály a lap gazdáját nézi)');
    ok(f.log.includes('update sheets/p1 owner'), f.log.join('; '));
    ok(!f.store['characters/p1'] || f.store['characters/p1'].owner === '', 'a nyilvános rész sem az övé');
    eq(nelkul(f.store['sheets/p1']), eredeti, 'a lap többi része változatlan');
    // a lap változása (pl. a DM írja a telefonján) nem állítja vissza Játékosra
    f.store['sheets/p1'].hp.cur = 16; f.emit('sheets'); await wait(500);
    eq([lib().kind, lib().owner, f.store['sheets/p1'].owner], ['npc', 'a@x.hu', '']);
    f.store['sheets/p1'].hp.cur = 17; f.emit('sheets'); await wait(500);
    // → Játékos: a lap visszakapja a gazdát, minden más ugyanaz
    fm = await tipus('pc');
    eq(fm.elements.owner.value, 'a@x.hu', 'az e-mail újra beírás nélkül ott van');
    f.log.splice(0); click('[data-act="edSave"]'); await wait(500);
    eq([lib().kind, f.store['sheets/p1'].owner, f.store['characters/p1'].owner], ['pc', 'a@x.hu', 'a@x.hu']);
    eq(nelkul(f.store['sheets/p1']), eredeti, 'szint, választások, varázslatok, tárgyak, pénz, HP, engedély: semmi nem veszett el');
    ok(!f.log.some(l => /update sheets\/p1 (?!owner$)/.test(l)), 'csak a gazda íródott: ' + f.log.join('; '));
  });
  test('NPC-vé tett játékos betöltéskor: ha a lapon még ott a gazda (pl. elmaradt írás), mentéskor lekerül; a régebben NPC-vé tett e-mailje a lapról átmentődik', async () => {
    let f = await loadWith({'dmscreen_library/p1': pc('Régi név', 1, {id: 'p1', owner: 'a@x.hu', kind: 'npc'})});
    eq([lib().kind, lib().owner], ['npc', 'a@x.hu']);
    A('save()'); await wait(500);
    eq(f.store['sheets/p1'].owner, '');
    eq(W.playerEmails(), [], 'NPC gazdája nem kerül a játékosok listájára');
    // a régi kód az NPC-ről letörölte az e-mailt, a lapon viszont megmaradt: most a könyvtárba kerül, a lapról lekerül
    f = await loadWith({'dmscreen_library/p1': pc('Régi név', 1, {id: 'p1', kind: 'npc'})});
    A('save()'); await wait(500);
    eq([lib().owner, f.store['sheets/p1'].owner], ['a@x.hu', '']);
  });
  test('NPC-ként a DM szerkesztése (AC, tárgy) továbbra is a lapra kerül, a harcbeli HP nem; törölt, majd NPC-vé tett karakter visszahozva gazda nélküli lapot kap', async () => {
    const f = await loadWith({'dmscreen_library/p1': pc('Régi név', 1, {id: 'p1', owner: 'a@x.hu', kind: 'npc'})});
    A('save()'); await wait(500); f.log.splice(0);
    A('S.library[0].ac = 18; save()'); await wait(500);
    eq([f.store['sheets/p1'].ac, f.store['sheets/p1'].owner], [18, '']);
    const [x] = W.addToEncounter(lib(), 1), hp0 = f.store['sheets/p1'].hp.cur;
    W.damage(x, 3); W.save(); await wait(500);
    eq(f.store['sheets/p1'].hp.cur, hp0, 'NPC-ként a harcbeli sebzés nem a lapé');
    // visszahozás NPC-ként
    A('SHEETS.p1 = Sheet.norm({...SHEETS.p1, owner: "", deleted: {owner: "a@x.hu", vis: "party", at: "2026-11-01T00:00:00.000Z", by: "a@x.hu"}})');
    ok(W.lapVisszahoz('p1')); await wait(300);
    eq([lib().owner, f.store['sheets/p1'].owner, f.store['sheets/p1'].deleted ?? null], ['a@x.hu', '', null]);
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
  test('karakterlap létrehozása meglévő (D&D Beyond-os) játékosból: osztály, mentők, skillek, támadás, spellek', async () => {
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
    click('[data-act="libSheet"]'); await until(() => A('SHEETS.p9'), 2000, 'a lap létrejön');
    eq(A('SHEETS.p9.auto'), false, 'szabálykönyv nélkül kézi lap'); has(lastLog(), 'kézi lapként'); eq([A('S.library[0].owner'), A('SHEETS.p9.owner')], ['a@x.hu', 'a@x.hu']);
    ok($('[data-act="libSheet"]').classList.contains('on'));
    const calls = []; const o = W.open; W.open = (...a) => calls.push(a);
    try { click('[data-act="libSheet"]'); } finally { W.open = o; }
    eq(calls, [['karakter.html#lap/p9', '_blank']], 'meglévő lapnál megnyitja');
  });
  test('📱 a szabálykönyvvel: ha ismeri az osztályokat, a lap rögtön szabálymotoros (mint az Átállítás); ismeretlen osztálynál és osztály nélkül kézi', async () => {
    A(`rulebook = ${JSON.stringify({version: 't', counts: {}, rb: rb3()})}`);
    try {
      const c = W.normCreature(pc('Thorin', 3, {id: 'p7', owner: 'a@x.hu', type: 'Hill Dwarf — Fighter 3 (Champion)', abilities: {str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8},
        saves: {str: 5, con: 5}, skillMods: {athletics: {b: 5, p: 1}}, ac: 18, hp: {max: 31, cur: 25}, inventory: [{name: 'Rope', qty: 1}]}));
      const n = W.normCreature(pc('Volt NPC', 2, {id: 'p8', owner: 'b@x.hu', type: 'humanoid (elf)'}));
      const x = W.normCreature(pc('Furcsa', 4, {id: 'p6', type: 'Elf — Artificer 4'}));
      A(`S.library = ${JSON.stringify([c, n, x])}.map(normCreature)`); W.openLib('lib');
      const gomb = id => $(`.lrow[data-lib="${id}"] [data-act="libSheet"]`);
      click(gomb('p7')); await until(() => A('SHEETS.p7'), 2000, 'a lap létrejön');
      const s = A('SHEETS.p7');
      eq([s.auto, s.build.levels.length, s.build.race, s.build.subrace, s.build.sub, s.owner], [true, 3, 'Dwarf|PHB', 'Hill|PHB', {Fighter: 'Champion|PHB'}, 'a@x.hu'], 'átállítva');
      eq([s.ac, s.hp.max, s.hp.cur, s.abilities.con], [18, 31, 25, 16], 'a látható értékek nem változnak (az eltérés felülírásként marad)');
      ok(s.features.some(f => f.name === 'Second Wind' && f.auto), 'a szabálykönyvből számolt jellemzők');
      ok(s.inventory.some(i => i.name === 'Rope'));
      has(lastLog(), 'szabálymotorosan');
      // osztály nélküli (NPC-ből lett) és a szabálykönyvben nem szereplő osztály: kézi lap
      click(gomb('p8')); await until(() => A('SHEETS.p8'), 2000);
      click(gomb('p6')); await until(() => A('SHEETS.p6'), 2000);
      eq([A('SHEETS.p8.auto'), A('SHEETS.p6.auto')], [false, false]);
      has(lastLog(), 'kézi lapként');
      // nem átállítható lap: a segéd null-t ad
      eq(W.Sheet.autoLap(W.Sheet.norm({classes: [{name: 'Artificer', level: 4}]}), rb3()), null);
    } finally { A('rulebook = null'); }
  });
  test('📱 a felhős szabálykönyvvel: onnan tölti, átállít, és a kézi változat backupként az Előzményekbe kerül; a tükörből letöltött szabálykönyv nem számít', async () => {
    const rb = {...Object.fromEntries(W.Sheet.RB_KINDS.map(k => [k, []])), ...rb3()};
    const c = pc('Thorin', 3, {id: 'p7', owner: 'a@x.hu', type: 'Hill Dwarf — Fighter 3 (Champion)', abilities: {str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8}, ac: 18, hp: {max: 31, cur: 25}});
    const f = makeFakeDb({...emptyState(), 'dmscreen_library/p7': c});
    A('rulebook = null');
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await wait(300);
    try {
      await W.uploadRulebook(rb); A('rulebook = null');
      W.openLib('lib'); click('[data-act="libSheet"]');
      await until(() => A('SHEETS.p7'), 3000, 'a lap létrejön');
      eq(A('SHEETS.p7.auto'), true, 'a felhős szabálykönyvvel átállítva');
      ok(A('rulebook?.version'), 'a betöltött szabálykönyv megmarad a következőhöz');
      await until(() => Object.keys(f.store).some(k => k.startsWith('sheets/p7/hist/')), 2000, 'backup');
      const h = Object.entries(f.store).find(([k]) => k.startsWith('sheets/p7/hist/'))[1];
      eq([h.reason, h.from, h.to, h.by, h.sheet.auto, h.sheet.owner, h.sheet.ac], ['manual', 3, 3, 'dm@x.hu', false, 'a@x.hu', 18], 'a kézi változat');
      has(lastLog(), 'a kézi változat backupként');
      // a tükörből épített (version: '') szabálykönyv: abból a telefonok nem számolnak, ezért kézi lap
      A(`rulebook = ${JSON.stringify({version: '', counts: {}, rb})}`); A('Tar.kapcsol(null)');
      A(`S.library.push(normCreature(${JSON.stringify(pc('Balin', 2, {id: 'p5', type: 'Hill Dwarf — Fighter 2'}))}))`); W.openLib('lib');
      click('.lrow[data-lib="p5"] [data-act="libSheet"]'); await until(() => A('SHEETS.p5'), 2000);
      eq(A('SHEETS.p5.auto'), false);
    } finally { A('rulebook = null'); }
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
    W.prompt = () => 'Delete';
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

describe('Dobáskérés (DM Screen → telefon)', () => {
  const lapos = (id, nev) => { A(`S.library.push(normCreature(${JSON.stringify({...pc(nev, 5), id, owner: 'a@x.hu'})}))`); W.createSheet(id, {name: nev, classes: [{name: 'Rogue', level: 5}]}); };
  // a telefon válasza: a dobás a kérés azonosítójával (a kérést a telefon nem írja); ✕ = rollSkip
  const valasz = (id, req, total) => A(`onSheets(Object.entries(SHEETS).map(([id, s]) => id === '${id}' ? {...s, id, rolls: [{at: new Date().toISOString(), label: 'x', total: '${total}', detail: '', nat: 10, req: '${req}'}, ...s.rolls]} : {...s, id}))`);
  const kihagy = id => A(`onSheets(Object.entries(SHEETS).map(([id, s]) => id === '${id}' ? {...s, id, rollSkip: s.rollReq.id} : {...s, id}))`);
  test('a kérés a lapra és a felhőbe megy (DC nélkül); akinek nincs lapja, annak helyben dob; válasz: ✔ / ✖ a DC-vel, állás; visszavonás', async () => {
    const f = makeFakeDb(); A('Tar').kapcsol(f.db);
    lapos('p1', 'Aranka'); lapos('p2', 'Béla');
    A(`S.library.push(normCreature(${JSON.stringify({...pc('Lap nélküli', 3), id: 'p3'})}))`);
    await A('doSave()');
    await until(() => f.store['sheets/p2'], 2000, 'a lapok a felhőben');
    const r = A(`dobastKer(['p1', 'p2', 'p3'], keresKind('skill', 'history'), 'adv', 15)`);
    eq([r.keres.ids, r.helyben.length], [['p1', 'p2'], 1]);
    has(r.helyben[0].html, 'Lap nélküli'); has(r.helyben[0].html, 'History (DC 15)');
    eq(A('SHEETS.p1.rollReq'), {id: r.keres.id, kind: 'check:int:history', label: 'History', mode: 'adv', by: 'DM', at: r.keres.at});
    await until(() => f.store['sheets/p1'].rollReq?.id === r.keres.id, 2000, 'a felhőben');
    ok(!JSON.stringify(f.store['sheets/p1']).includes('"dc"'), 'a DC nem megy a lapra');
    has(lastLog(), 'Dobáskérés'); has(lastLog(), 'History');
    valasz('p1', r.keres.id, 17);
    has(lastLog(), '📱 Aranka'); has(lastLog(), '✔ (DC 15)');
    kihagy('p2');
    eq(A('keresAllas(keresek[0])'), {dobott: [{id: 'p1', name: 'Aranka', total: '17'}], var: [], kihagyta: [{id: 'p2', name: 'Béla'}], lejart: []});
    const r2 = A(`dobastKer(['p1', 'p2'], keresKind('save', 'con'), '', 12)`);
    valasz('p2', r2.keres.id, 9);
    has(lastLog(), '✖ (DC 12)');
    eq(A(`keresVisszavon('${r2.keres.id}')`), true);
    eq([A('SHEETS.p1.rollReq'), A('keresAllas(keresek[0]).lejart.map(x => x.id)'), A('keresAllas(keresek[0]).dobott.map(x => x.id)')], [null, ['p1'], ['p2']]);
    await until(() => f.store['sheets/p1'].rollReq === null, 2000, 'a felhőből is törlődik');
    // egy újabb kérés felülírja a régit: a régi „lejárt” lesz, nem „kihagyta”; a mentés visszaállítása a mostani kérést megtartja
    const r3 = A(`dobastKer(['p1'], keresKind('check', 'str'))`), r4 = A(`dobastKer(['p1'], keresKind('check', 'dex'))`);
    eq(A(`keresAllas(keresek.find(k => k.id === '${r3.keres.id}')).lejart.map(x => x.id)`), ['p1']);
    A(`restoreSheets([{...SHEETS.p1, id: 'p1', rollReq: null, rollSkip: 'regi'}])`);
    eq([A('SHEETS.p1.rollReq.id'), A('SHEETS.p1.rollSkip')], [r4.keres.id, ''], 'a mentésből a régi kérés-állapot nem jön vissza');
    A('VART_MODULOK.sheet += 100');
    try { eq(A(`dobastKer(['p1'], 'init')`), null, 'régi közös fájl mellett nem ír'); } finally { A('VART_MODULOK.sheet -= 100'); }
  });
  test('Initiative a telefonról: az ellenfelek dobnak, a játékostól kér; a válasz beíródik a harcba; lap nélküli játékosnál nem dob', () => {
    lapos('p1', 'Aranka');
    A(`S.library.push(normCreature(${JSON.stringify({...pc('Lap nélküli', 3), id: 'p3'})}))`);
    A(`addToEncounter(S.library.find(c => c.id === 'p1')); addToEncounter(S.library.find(c => c.id === 'p3')); addToEncounter(normCreature(${JSON.stringify(mk('Goblin'))}))`);
    W.openInitMenu(); click('[data-act="initTelefon"]');
    const init = n => A(`S.enc.list.find(x => x.c.name === '${n}').init`);
    ok(init('Goblin') != null, 'az ellenfél dobott'); eq([init('Aranka'), init('Lap nélküli')], [null, null]);
    eq([A('SHEETS.p1.rollReq.kind'), A('keresek[0].ids')], ['init', ['p1']]);
    valasz('p1', A('keresek[0].id'), 18);
    eq(init('Aranka'), 18); has(lastLog(), 'Initiative beírva');
    ok([...W.document.querySelectorAll('#tiles input.init')].some(i => i.value === '18'), 'a csempén is látszik');
  });
  test('Csapat nézet: cellára kattintva egytől, „Mindenki” gombbal mindenkitől kér (próba, mentő is); DC a mezőből; élő állás és visszavonás; gonosz név nem fut', () => {
    lapos('p1', 'Aranka'); lapos('p2', XSS);
    W.openParty();
    click('td.sk[data-pc="p1"][data-sk="history"]');
    eq([A('SHEETS.p1.rollReq.kind'), A('SHEETS.p2.rollReq')], ['check:int:history', null]);
    has($('#keresAllas').textContent, '0/1 dobott'); has($('#keresAllas').textContent, 'vár: Aranka');
    $('#keresDc').value = '13';
    click('[data-act="partyGroup"][data-tipus="save"][data-sk="dex"]', {shiftKey: true});
    eq([A('SHEETS.p1.rollReq.kind'), A('SHEETS.p2.rollReq.kind'), A('SHEETS.p2.rollReq.mode'), A('keresek[0].dc')], ['save:dex', 'save:dex', 'adv', 13]);
    has($('#keresAllas').textContent, 'Dexterity mentő'); has($('#keresAllas').textContent, 'DC 13'); has($('#keresAllas').textContent, 'előnnyel');
    click('.kr[data-pc="p1"][data-tipus="check"][data-sk="str"]');
    eq(A('SHEETS.p1.rollReq.kind'), 'check:str');
    valasz('p1', A('keresek[0].id'), 11);
    has($('#keresAllas').textContent, '1/1 dobott'); has($('#keresAllas').textContent, 'Aranka 11');
    click('[data-act="partyGroup"][data-tipus="check"][data-sk="wis"]');
    click('[data-act="keresVissza"]');
    eq([A('SHEETS.p1.rollReq'), A('SHEETS.p2.rollReq')], [null, null]);
    has($('#keresAllas').textContent, 'visszavonva');
    assertNoXss();
  });
});

describe('Multiclass: DM-jelzés a naplóban (TERV-multiclass.md, 3. lépés)', () => {
  test('új osztály nem teljesülő feltétellel: ⚠ sor egyszer, a régi lap szerint; teljesülőnél, első betöltéskor és szabálykönyv nélkül nincs; gonosz név nem fut', async () => {
    const elotte = A('rulebook');
    try {
      A(`rulebook = ${JSON.stringify({version: 'v', counts: {}, rb: rbMc()})}`);
      const lap = (id, name, classes, int = 12) => ({...W.Sheet.norm({name, classes, abilities: {str: 14, int}}), id});
      const F3 = [{name: 'Fighter', level: 3}], FW = [{name: 'Fighter', level: 3}, {name: 'Wizard', level: 1}];
      const sorok = () => A('logLines').map(l => l.html).filter(h => h.includes('multiclass'));
      A(`onSheets(${JSON.stringify([lap('p1', XSS, FW), lap('p2', 'Béla', F3, 13)])})`);
      await new Promise(r => setTimeout(r, 20));
      eq(sorok(), [], 'első betöltéskor (nincs régi lap) nincs sor');
      // osztálycsere, készülő karakter (kezdő varázsló), törölt lap: nem multiclass
      const W1 = [{name: 'Wizard', level: 1}], nc = {newChar: {step: 'osztaly', target: 1, methods: ['array'], by: 'dm', at: '2026-11-11T10:00:00.000Z'}};
      const p12 = [lap('p1', XSS, FW), lap('p2', 'Béla', F3, 13)];
      A(`onSheets(${JSON.stringify([...p12, lap('p3', 'Csere', F3), {...lap('p4', 'Új', [{name: 'Fighter', level: 1}]), ...nc}, lap('p5', 'Törölt', F3)])})`);
      A(`onSheets(${JSON.stringify([...p12, lap('p3', 'Csere', [{name: 'Wizard', level: 3}]), {...lap('p4', 'Új', [{name: 'Fighter', level: 1}, ...W1]), ...nc},
        {...lap('p5', 'Törölt', FW), deleted: {at: '2026-11-11T10:00:00.000Z', by: 'a@x.hu', owner: 'a@x.hu', vis: 'party'}}])})`);
      await new Promise(r => setTimeout(r, 20));
      eq(sorok(), [], 'osztálycsere, készülő és törölt lap: nincs sor');
      A(`onSheets(${JSON.stringify([lap('p1', XSS, FW), lap('p2', 'Béla', F3, 13)])})`);
      A(`onSheets(${JSON.stringify([lap('p1', XSS, [...FW, {name: 'Bard', level: 1}]), lap('p2', 'Béla', FW, 13)])})`);
      await until(() => sorok().length, 2000, 'naplósor');
      await new Promise(r => setTimeout(r, 20));
      eq(sorok().length, 1, 'csak a nem teljesülő (p1: Bard – CHA 13 kell); p2 Wizardja INT 13-mal rendben');
      has(sorok()[0], 'Bard multiclass'); has(sorok()[0], 'CHA 13 kell (most 10)'); has(sorok()[0], 'Wizard miatt: INT 13 kell (most 12)');
      assertNoXss();
      A(`onSheets(${JSON.stringify([lap('p1', XSS, [...FW, {name: 'Bard', level: 2}]), lap('p2', 'Béla', FW, 13)])})`);
      await new Promise(r => setTimeout(r, 20));
      eq(sorok().length, 1, 'a következő szintnél nem ismétlődik');
      A('rulebook = null');
      A(`onSheets(${JSON.stringify([lap('p1', XSS, [...FW, {name: 'Bard', level: 2}, {name: 'Paladin', level: 1}])])})`);
      await new Promise(r => setTimeout(r, 20));
      eq(sorok().length, 1, 'szabálykönyv nélkül nincs sor');
    } finally { A(`rulebook = ${JSON.stringify(elotte)}`); }
  });
});

describe('Játékosok dobásai a DM naplójában', () => {
  const t = (perc, mp = 0) => `2026-11-06T18:${String(perc).padStart(2, '0')}:${String(mp).padStart(2, '0')}.000Z`;
  const lap = (id, name, rolls, extra = {}) => ({...W.Sheet.norm({name, classes: [{name: 'Rogue', level: 3}], rolls, ...extra}), id});
  test('betöltéskor az összes lapról a legutóbbi 15, időrendben (legújabb felül), a karakter nevével; utána csak az újak', () => {
    const a = Array.from({length: 10}, (_, i) => ({at: t(10 + i), label: 'A' + i, total: i, detail: 'x', nat: i === 9 ? 20 : 5}));
    const b = Array.from({length: 10}, (_, i) => ({at: t(10 + i, 30), label: 'B' + i, total: i, nat: i === 0 ? 1 : 0}));
    A(`onSheets(${JSON.stringify([lap('p1', 'Aranka', a.slice().reverse()), lap('p2', XSS, b.slice().reverse())])})`);
    const sorok = A('logLines').map(l => l.html);
    eq(sorok.length, 15);
    has(sorok[0], 'B9'); has(sorok[1], 'A9'); has(sorok[14], 'B2');
    has(sorok[1], '📱 Aranka'); has(sorok[1], 'KRITIKUS'); eq(A('logLines[1].cls'), 'crit');
    assertNoXss();
    // élőben: új dobás az egyik lapon; a régiek nem jönnek újra
    A(`onSheets(${JSON.stringify([lap('p1', 'Aranka', [{at: t(30), label: 'Perception', total: 14, detail: '[9] +5', nat: 9}, ...a.slice().reverse()]), lap('p2', XSS, b.slice().reverse())])})`);
    eq(A('logLines').length, 16);
    has(lastLog(), '📱 Aranka'); has(lastLog(), 'Perception'); has(lastLog(), '<b>14</b>'); has(lastLog(), '[9] +5');
    A(`onSheets(${JSON.stringify([lap('p1', 'Aranka', [{at: t(30), label: 'Perception', total: 14, detail: '[9] +5', nat: 9}]), lap('p2', XSS, [])])})`);
    eq(A('logLines').length, 16, 'változatlan dobásokra nincs új sor');
  });
  test('törölt lap dobása nem látszik; új dobás nélküli lapváltozásra nincs sor', () => {
    A(`onSheets(${JSON.stringify([lap('p1', 'Törölt', [{at: t(1), label: 'X', total: 1}], {deleted: {at: t(0), by: 'a@x.hu', owner: 'a@x.hu', vis: 'party'}}), lap('p2', 'Béla', [])])})`);
    eq(A('logLines').length, 0);
    A(`onSheets(${JSON.stringify([lap('p2', 'Béla', [], {hp: {max: 20, cur: 5}})])})`);
    hasNot(allLog(), '📱');
  });
  test('késő órájú második eszköz dobása is látszik (a tartalom azonosít, nem az időhatár); a mentés visszaállítása a mostani dobásokat megtartja', () => {
    A(`S.library.push(normCreature(${JSON.stringify({...pc('Aranka', 3), id: 'p1'})}))`);
    const most = {at: t(50), label: 'Stealth', total: 20, nat: 13};
    A(`onSheets(${JSON.stringify([lap('p1', 'Aranka', [most])])})`);
    eq(A('logLines').length, 1);
    A(`onSheets(${JSON.stringify([lap('p1', 'Aranka', [{at: t(40), label: 'Insight', total: 9, nat: 4}, most])])})`);
    eq(A('logLines').length, 2); has(lastLog(), 'Insight');
    A(`restoreSheets(${JSON.stringify([lap('p1', 'Aranka', [{at: t(1), label: 'Régi', total: 1}])])})`);
    eq(A('SHEETS.p1.rolls').map(r => r.label), ['Insight', 'Stealth'], 'a mentésből a régi dobások nem jönnek vissza');
  });
});

describe('Szintlépés-engedély a DM Screenben', () => {
  const lapos = (id, nev, extra = {}) => { A(`S.library.push(normCreature(${JSON.stringify({...pc(nev, 5), id, owner: 'a@x.hu'})}))`); W.createSheet(id, {name: nev, classes: [{name: 'Rogue', level: 5}], ...extra}); };
  test('Könyvtár: ⬆ +1 szint (többször is), ✕ vissza; csak lappal rendelkezőnél; felhőbe a levelUp megy; 20. szinten nincs', async () => {
    const f = makeFakeDb(); A('Tar').kapcsol(f.db);
    A(`S.library.push(normCreature(${JSON.stringify({...pc('Lap nélkül', 5), id: 'nl'})}))`);
    lapos('p1', 'Lapos');
    await A('doSave()');
    await until(() => f.store['sheets/p1'], 2000, 'a lap a felhőben');
    f.log.length = 0;
    W.openLib('lib');
    ok(!$('[data-lib="nl"] [data-act="libSzintAd"]'), 'lap nélkül nincs gomb');
    click('[data-lib="p1"] [data-act="libSzintAd"]');
    has($('[data-lib="p1"]').textContent, '6. szintre vár');
    eq(A('SHEETS.p1.levelUp.to'), 6);
    click('[data-lib="p1"] [data-act="libSzintAd"]');
    has($('[data-lib="p1"]').textContent, '7. szintre vár');
    await until(() => f.store['sheets/p1']?.levelUp?.to === 7, 2000, 'a felhőbe is');
    ok(f.log.some(l => l === 'update sheets/p1 levelUp'), f.log.join(';'));
    click('[data-lib="p1"] [data-act="libSzintVissza"]');
    eq(A('SHEETS.p1.levelUp.to'), 6);
    click('[data-lib="p1"] [data-act="libSzintVissza"]');
    eq(A('SHEETS.p1.levelUp'), null);
    ok(!$('[data-lib="p1"] [data-act="libSzintVissza"]'), 'nincs több visszavonás');
    await until(() => f.store['sheets/p1']?.levelUp === null, 2000, 'a felhőben is törölve');
    W.createSheet('p1', {name: 'Lapos', classes: [{name: 'Rogue', level: 20}]});
    W.filterLib(); ok($('[data-lib="p1"] [data-act="libSzintAd"]').disabled, '20. szinten tiltva');
    eq(A(`szintlepesAd('p1')`), false);
  });
  test('Csapat: egyenként és ⬆ Mindenki; régi közös fájl mellett nem ír; gonosz név nem fut', () => {
    lapos('p1', 'Egy'); lapos('p2', '<img src=x onerror=alert(1)>');
    W.openParty();
    click('[data-pcard="p1"] [data-act="partySzintAd"]');
    has($('[data-pcard="p1"]').textContent, '6. szintre vár');
    click('[data-act="partySzintMind"]');
    eq([A('SHEETS.p1.levelUp.to'), A('SHEETS.p2.levelUp.to')], [7, 6]);
    click('[data-pcard="p2"] [data-act="partySzintVissza"]');
    eq(A('SHEETS.p2.levelUp'), null);
    assertNoXss();
    A('VART_MODULOK.sheet += 100');
    try { eq([A(`szintlepesAd('p2')`), A(`szintlepesVissza('p1')`), A('SHEETS.p2.levelUp')], [false, false, null], 'régi közös fájl mellett nem ír'); } finally { A('VART_MODULOK.sheet -= 100'); }
  });
  test('törölt karakter: a játékos telefonjáról jön; a DM látja, a nyilvános rész lekerül, a csapatból kikerül; visszahozható; végleges törlés csak „Delete” beírásával', async () => {
    const f = makeFakeDb(); A('Tar').kapcsol(f.db);
    lapos('p1', 'Lapos');
    A(`S.library[0].share.vis = 'party'`);
    await A('doSave()');
    await until(() => f.store['characters/p1']?.owner === 'a@x.hu', 2000, 'közzétéve');
    const torles = {at: '2026-11-01T10:00:00.000Z', by: 'a@x.hu', owner: 'a@x.hu', vis: 'party'};
    A(`onSheets([{...SHEETS.p1, id: 'p1', owner: '', deleted: ${JSON.stringify(torles)}}])`);
    eq([A(`lapTorolt('p1')`), A('S.library[0].owner'), A('S.library[0].share.vis'), A(`lapAllapot('p1')`)], [true, '', 'dm', 'torolt']);
    await A('doSave()');
    await until(() => !f.store['characters/p1'], 2000, 'a nyilvános rész lekerül');
    eq(f.store['access/players'].emails, ['a@x.hu'], 'a gazda játékos marad');
    eq(A('partyMembers()').length, 0, 'a csapatban nincs');
    eq(A(`szintlepesAd('p1')`), false, 'szintlépés nem adható');
    W.openLib('lib');
    has($('[data-lib="p1"]').textContent, 'a@x.hu');
    ok(!$('[data-lib="p1"] [data-act="libSzintAd"]'), 'nincs szintlépés-gomb');
    // a DM hiába ad közben gazdát a szerkesztőben: visszahozás nélkül nem kerül vissza
    A(`S.library[0].owner = 'mas@x.hu'`); await A('doSave()');
    eq(A('S.library[0].owner'), '');
    ok(!f.log.some(l => l.startsWith('update sheets/p1') && l.includes('owner')), 'a lapra sem megy');
    // visszahozás: gazda, láthatóság, nyilvános rész
    click('[data-lib="p1"] [data-act="libVisszahoz"]');
    eq([A('SHEETS.p1.owner'), A('SHEETS.p1.deleted'), A('S.library[0].owner'), A('S.library[0].share.vis')], ['a@x.hu', null, 'a@x.hu', 'party']);
    await A('doSave()');
    await until(() => f.store['characters/p1']?.owner === 'a@x.hu' && f.store['sheets/p1'].owner === 'a@x.hu' && f.store['sheets/p1'].deleted === null, 2000, 'a felhőben is vissza');
    // ha a visszahozás után a könyvtár mentése elmaradt, a lap változásakor a gazda visszakerül
    A(`S.library[0].owner = ''; applySheet('p1')`); eq(A('S.library[0].owner'), 'a@x.hu');
    // a csapat módosítása nem dobja ki a törölt tagot; importálás törölt karakterre: visszahozza a gazdát és a láthatóságot
    A(`SHEETS.p1 = Sheet.norm({...SHEETS.p1, owner: '', deleted: ${JSON.stringify(torles)}}); applySheet('p1'); setPartyMember('p1', true); setPartyMember('uj', false)`);
    ok(A('S.settings.partyIds').includes('p1'), 'a törölt tag megmarad a listában');
    A(`importSheet(Sheet.norm({name: 'Lapos', owner: ''}), S.library[0])`);
    eq([A('SHEETS.p1.owner'), A('SHEETS.p1.deleted'), A('S.library[0].owner'), A('S.library[0].share.vis')], ['a@x.hu', null, 'a@x.hu', 'party']);
    A(`S.settings.partyIds = null`);
    await A('doSave()');
    // végleges törlés: mégse, rossz szó, „Delete”
    W.openLib('lib');
    const hist = 'sheets/p1/hist/2026-11-01';
    f.store[hist] = {reason: 'manual'};
    click('[data-lib="p1"] [data-act="libDel"]');
    eq(A('S.library.length'), 1, 'prompt mégse');
    let figy = ''; W.alert = m => { figy = m; };
    W.prompt = () => 'delete';
    click('[data-lib="p1"] [data-act="libDel"]');
    eq(A('S.library.length'), 1, 'kisbetűvel nem'); has(figy, 'nem töröltem');
    W.prompt = () => 'Delete';
    click('[data-lib="p1"] [data-act="libDel"]');
    eq(A('S.library.length'), 0);
    await A('doSave()');
    await until(() => !f.store['sheets/p1'] && !f.store['characters/p1'] && !f.store[hist] && !f.store['dmscreen_library/p1'], 2000, 'minden törlődik');
  });
  test('Sheet: a törlés mezői tisztítva; a backup visszaállítása és a letöltés nem hozza vissza a törlést; visszaimport után nincs törölve', () => {
    const H = W.Sheet;
    const s = H.norm({name: 'A', owner: 'A@x.hu', deleted: {at: 'x', by: '<b>', owner: '<img src=x>@x', vis: 'nem'}});
    eq(s.deleted, {at: '', by: '<b>', owner: '', vis: 'dm'});
    eq(H.norm({deleted: 'x'}).deleted, null);
    eq(H.torlesPatch({owner: 'a@x.hu'}, {by: 'a@x.hu', at: 'T', vis: 'party'}), {owner: '', deleted: {at: 'T', by: 'a@x.hu', owner: 'a@x.hu', vis: 'party'}});
    const torolt = H.norm({name: 'A', deleted: {owner: 'a@x.hu', vis: 'party'}});
    eq([H.exportLap(torolt).owner, H.exportLap(torolt).deleted], ['a@x.hu', null]);
    ok(!('deleted' in H.backupPatch(torolt, {sheet: H.norm({name: 'B'})}, null)), 'a backup nem hozza vissza a törölt karaktert');
    lapos('p1', 'Lapos', {deleted: {owner: 'a@x.hu', vis: 'party'}});
    eq(A('SHEETS.p1.deleted'), null, 'a createSheet (import) új, nem törölt lapot ír');
  });
  test('új játékos: az Új lény ablakban a Játékos típus rövid űrlapot ad; üres motoros lap jön létre e-maillel; e-mail nélkül is; hibás cím nem menthető', async () => {
    const f = makeFakeDb(); A('Tar').kapcsol(f.db);
    W.openLib('lib'); click('[data-act="newCreature"]');
    $('#edForm').elements.name.value = 'Valaki';
    setVal($('#edForm').elements.kind, 'pc');
    ok(!$('#edForm'), 'nem a teljes szerkesztő'); eq($('#njForm').elements.name.value, 'Valaki', 'a név átjön');
    click('[data-act="ujJatekosVissza"]'); ok($('#edForm'), 'másik típus');
    setVal($('#edForm').elements.kind, 'npc'); ok($('#edForm'), 'NPC-nél marad a szerkesztő');
    setVal($('#edForm').elements.kind, 'pc');
    const fm = $('#njForm');
    let msg = ''; W.alert = m => msg = m;
    fm.elements.owner.value = 'rossz cím';
    click('[data-act="ujJatekosMent"]'); has(msg, 'nem érvényes'); ok($('#njForm'), 'nyitva maradt');
    fm.elements.owner.value = 'Jatekos@X.hu'; fm.elements.target.value = '3'; fm.elements.name.value = '<img src=x onerror=alert(1)>';
    fm.elements.m_roll.checked = false;
    eq(fm.elements.equip.value, 'any', 'kezdő felszerelés: alapból a játékos dönt'); fm.elements.equip.value = 'pack';
    click('[data-act="ujJatekosMent"]');
    const c = A('S.library').at(-1), s = A(`SHEETS['${c.id}']`);
    eq(s.newChar.equip, 'pack', 'a DM beállítása a lapra');
    eq([c.kind, c.owner, c.share.vis, s.owner, s.auto, s.build.levels, s.newChar.target, s.newChar.methods, s.levelUp.to], ['pc', 'jatekos@x.hu', 'party', 'jatekos@x.hu', true, [], 3, ['array', 'buy', 'manual'], 3]);
    eq(A(`lapAllapot('${c.id}')`), 'keszul');
    eq(A(`szintlepesAllas('${c.id}')`), null, 'készülő lapra nincs engedélyadás');
    W.openLib('lib'); click('[data-act="addAllPcs"]');
    eq(A('S.enc.list').length, 0, 'készülő lap nem megy harcba az „Összes játékos” gombbal');
    await A('doSave()');
    await until(() => f.store['sheets/' + c.id]?.newChar && f.store['access/players']?.emails.includes('jatekos@x.hu'), 2000, 'a felhőben');
    W.openLib('lib'); eq($(`[data-lib="${c.id}"] [data-lapjel]`).dataset.lapjel, 'keszul');
    assertNoXss();
    // e-mail és név nélkül; a sorban a tisztító stabil
    click('[data-act="newCreature"]'); setVal($('#edForm').elements.kind, 'pc');
    eq($('#njForm').elements.name.value, '', 'az alapnév nem jön át');
    click('[data-act="ujJatekosMent"]');
    const d = A('S.library').at(-1);
    eq([d.name, d.owner, A(`SHEETS['${d.id}'].owner`), A(`SHEETS['${d.id}'].levelUp`)], ['Új karakter', null, '', null]);
    const H = W.Sheet, x = H.norm({newChar: {step: '<x>', target: 99, methods: ['x', 'roll'], method: 'buy', rolls: [99, 1, 10, 10, 10, 10], pick: {str: 9, bad: 1}}});
    eq([x.newChar.step, x.newChar.target, x.newChar.methods, x.newChar.method, x.newChar.rolls, x.newChar.pick], ['alap', 20, ['roll'], '', [18, 3, 10, 10, 10, 10], {str: 5}]);
    eq(JSON.parse(JSON.stringify(H.norm(x))), JSON.parse(JSON.stringify(x)), 'még egyszer tisztítva nem változik');
    eq(H.norm({newChar: 'x'}).newChar, null);
    eq(H.exportLap(s).newChar, null);
    ok(!('newChar' in H.backupPatch(H.norm(s), {sheet: H.norm(s)}, null)), 'a backup nem indítja újra a varázslót');
  });
  test('átállítás-jelvény a Könyvtárban és a Csapatnál: nincs lap, kézi, motoros, eltérő szintek', () => {
    A(`S.library.push(normCreature(${JSON.stringify({...pc('Lap nélkül', 5), id: 'nl'})}))`);
    lapos('k1', 'Kézi');
    lapos('m1', 'Motoros', {auto: true, build: {levels: [{c: 'Rogue'}, {c: 'Rogue'}, {c: 'Rogue'}, {c: 'Rogue'}, {c: 'Rogue'}]}});
    lapos('e1', 'Eltérő', {auto: true, build: {levels: [{c: 'Rogue'}]}});
    eq(['nl', 'k1', 'm1', 'e1'].map(id => A(`lapAllapot('${id}')`)), ['nincs', 'kezi', 'motoros', 'elter']);
    W.openLib('lib');
    const jel = id => $(`[data-lib="${id}"] [data-lapjel]`);
    eq(['nl', 'k1', 'm1', 'e1'].map(id => jel(id).dataset.lapjel), ['nincs', 'kezi', 'motoros', 'elter']);
    has(jel('k1').textContent, 'kézi');
    A(`S.library.push(normCreature(${JSON.stringify(mk('Goblin', {id: 'g1'}))}))`);
    W.filterLib(); ok(!$('[data-lib="g1"] [data-lapjel]'), 'szörnynél nincs jelvény');
    W.openParty();
    eq($('[data-pcard="k1"] [data-lapjel]').dataset.lapjel, 'kezi');
    eq($('[data-pcard="m1"] [data-lapjel]').dataset.lapjel, 'motoros');
  });
  test('előzmények: csak a legfrissebb 3 marad az engedély adásakor és induláskor; lap törlésekor mind törlődik; hiba nem akasztja meg', async () => {
    const f = makeFakeDb(); A('Tar').kapcsol(f.db);
    lapos('p1', 'Lapos');
    for (let i = 10; i < 35; i++) f.store[`sheets/p1/hist/2026-11-${i}`] = {reason: 'levelup'};
    A(`szintlepesAd('p1')`);
    await until(() => Object.keys(f.store).filter(k => k.includes('/hist/')).length === 3, 2000, 'takarítás');
    ok(f.store['sheets/p1/hist/2026-11-34'] && !f.store['sheets/p1/hist/2026-11-31'], 'a régiek mentek');
    for (let i = 10; i < 15; i++) f.store[`sheets/p1/hist/2026-11-${i}`] = {reason: 'manual'};
    // régi közös fájl mellett semmit nem töröl (a Sheet.HIST_MAX hiánya nem törölheti az összeset)
    A('VART_MODULOK.sheet += 100');
    try { A('elozmenyekTakarit()'); await wait(50); } finally { A('VART_MODULOK.sheet -= 100'); }
    await A(`elozmenyTakarit('p1', NaN)`);
    eq(Object.keys(f.store).filter(k => k.includes('/hist/')).length, 8, 'nem törölt');
    A('elozmenyekTakarit()');
    await until(() => Object.keys(f.store).filter(k => k.includes('/hist/')).length === 3, 2000, 'induláskor is');
    A(`sheetOps.del.add('p1'); doSave()`);
    await until(() => !Object.keys(f.store).some(k => k.startsWith('sheets/p1')), 2000, 'lappal együtt');
    const hibas = {...f.db, list: async () => { throw new Error('tilos'); }};
    A('Tar').kapcsol(hibas);
    await A(`elozmenyTakarit('p1')`);
  });
});

describe('Varázslat sora: mentő, cantrip-kocka, darab, sebzésbónusz (sheet.js)', () => {
  // szintetikus szövegek (nem a PHB-é), csak a felismert minták
  const TUZ = 'Make a ranged spell attack. Hit: 1d10 fire damage. Grows when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).';
  const EB = 'Make a ranged spell attack. Hit: 1d10 force damage. More: two beams at 5th level, three beams at 11th level, and four beams at 17th level.';
  test('mentő a szövegből; cantrip-kocka és darabszám a karakterszinten', () => {
    const H = W.Sheet;
    eq(['must make a Constitution saving throw', 'a Wisdom saving throw or', 'STRENGTH SAVING THROW', 'no save here', '', null].map(H.spellSave), ['con', 'wis', 'str', '', '', '']);
    // nem a célpont mentője: előny / jártasság mentőkre (többes szám), fix DC (a varázsló saját mentője); utána a valódi mentő megtalálható
    eq(['advantage on Dexterity saving throws', 'make a DC 15 Intelligence saving throw', 'proficiency in Constitution saving throws; later a DC 15 Constitution saving throw',
      'on a failed DC 12 Wisdom saving throw you take damage; the target makes a Strength saving throw'].map(H.spellSave), ['', '', '', 'str']);
    eq([1, 4, 5, 10, 11, 16, 17, 20].map(l => H.cantripKocka(TUZ, l)), ['', '', '2d10', '2d10', '3d10', '3d10', '4d10', '4d10']);
    eq([4, 5, 11, 17].map(l => H.cantripKocka(EB, l)), ['', '', '', '']);
    eq([1, 4, 5, 11, 17, 20].map(l => H.cantripDarab(EB, l)), [1, 1, 2, 3, 4, 4]);
    eq([H.cantripDarab(TUZ, 17), H.cantripDarab('', 20), H.cantripKocka(undefined, 20)], [1, 1, '']);
  });
  test('Agonizing Blast: +CHA az Eldritch Blasthoz (kézi és szabálymotoros lapon is, a jellemzők neve szerint); más varázslat nem kap', () => {
    const H = W.Sheet, lap = (cha, ...f) => H.norm({abilities: {cha}, features: f.map(name => ({name, text: ''}))});
    eq(H.spellDmgBonus(lap(16, 'Agonizing Blast'), 'Eldritch Blast'), {v: 3, src: 'Agonizing Blast'});
    eq(H.spellDmgBonus(lap(8, 'Eldritch Invocations: Agonizing Blast'), 'eldritch blast'), {v: -1, src: 'Agonizing Blast'});
    eq([H.spellDmgBonus(lap(16), 'Eldritch Blast'), H.spellDmgBonus(lap(16, 'Agonizing Blast'), 'Fire Bolt'), H.spellDmgBonus(lap(16, 'Agonizing Blastless'), 'Eldritch Blast')], [null, null, null]);
    // szabálymotoros lapon az Invocation-választásból és az Eldritch Adept featből
    const rb = rbVarazs();
    rb.feats.push({n: 'Eldritch Adept', s: 'TCE', fx: W.featOptFx({optionalfeatureProgression: [{name: 'Eldritch Invocations', featureType: ['EI'], progression: {'*': 1}}]})});
    for (const ch of [{'Warlock:opt:Eldritch Invocations': ['Agonizing Blast|PHB']}, {'Fighter:4:asi': {feat: 'Eldritch Adept|TCE'}, 'feat:Eldritch Adept|TCE:opt': ['Agonizing Blast|PHB']}]) {
      const s = mkS({base: {cha: 16}, levels: ch['Fighter:4:asi'] ? lv('Fighter', 4) : lv('Warlock', 2), ch});
      const m = H.norm({...s, ...H.materialize(s, H.calc(s, rb))});
      eq(H.spellDmgBonus(m, 'Eldritch Blast')?.v, 3, Object.keys(ch)[0]);
    }
  });
  test('skill-leírás: mind a 18 skillhez van saját magyar leírás (2. lépés)', () => {
    const H = W.Sheet;
    eq(Object.keys(H.SKILL_INFO).sort(), Object.keys(H.SKILLS).sort());
    ok(Object.values(H.SKILL_INFO).every(t => typeof t === 'string' && t.length >= 60 && !/[<>]/.test(t)), 'nem üres, nincs benne HTML');
  });
  test('a varázslat osztályának DC-je és attackje (multiclass); osztály nélkül az elsőé', () => {
    const H = W.Sheet, s = {auto: true, cache: {spells: [{cls: 'Cleric', dc: 14, atk: 6}, {cls: 'Wizard', dc: 15, atk: 7}]}};
    eq([H.spellCastOf(s, {cls: 'Wizard'}).dc, H.spellCastOf(s, {cls: ''}).dc, H.spellCastOf(s, {cls: 'Bard'}).dc], [15, 14, 14]);
    eq(H.spellCastOf(H.norm({}), {cls: ''}), null);
  });
});

describe('Telefonos karakterlap (karakter.html)', () => {
  const kq = s => K.document.querySelector(s), kqa = s => [...K.document.querySelectorAll(s)];
  const kclick = el => { const _k = el; if (typeof el === 'string') el = kq(el); ok(el, 'nincs ilyen elem' + (typeof _k === 'string' ? ': ' + _k : '')); el.dispatchEvent(new K.MouseEvent('click', {bubbles: true, cancelable: true})); };
  const kset = (el, v, evt = 'change') => { const _s = el; if (typeof el === 'string') el = kq(el); ok(el, 'nincs ilyen mező' + (typeof _s === 'string' ? ': ' + _s : '')); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new K.Event(evt, {bubbles: true})); };
  const ktext = () => kq('main').textContent;
  // a választó pipája (a feat, az opt és a faji / feat-varázslat is pipás lista, nem legördülő)
  const kcb = (key, v) => { const el = kqa('input[type=checkbox][data-ch]').find(e => e.dataset.ch === key && e.value === v); ok(el, `nincs ilyen pipa: ${key} = ${v}`); return el; };
  let klog;
  const ORIGK = {};
  const ktest = (name, fn, opts) => test(name, async () => {
    for (const k of ['rnd', 'confirm', 'alert']) ORIGK[k] ??= K[k];
    klog = []; K.KDB = {update: (id, p) => klog.push(['update', id, p]), pub: (id, p) => klog.push(['pub', id, p]), saveWithHist: async (id, p, h, doc) => { klog.push(['hist', id, p, h, doc]); }, histList: async () => []};
    K.confirm = () => true;
    K.localStorage.removeItem('dmscreen-szintlepes-p1');
    try { await fn(); }
    finally { Object.assign(K, ORIGK); K.KDB = undefined; K.eval('lu = null; histCache.clear(); openKeys.delete("hist")'); K.localStorage.removeItem('dmscreen-szintlepes-p1'); K.frameElement.width = 420; delete K.navigator.onLine; K.location.hash = ''; K.KApp.setSheets([]); K.KApp.setChars([]); K.KApp.setRulebook(null); K.route(); }
  }, opts);
  ktest('valódi szabálykönyvvel: kézi lap átállítása minden osztályra (5. szint, alosztállyal, különböző faj és háttér) – a Felépítés-fül hiba nélkül megjelenik, a gomb eltűnik', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    K.KApp.setRulebook({version: 'online', rb});
    const races = H.raceOptions(rb).map(o => o.label), bgs = rb.backgrounds.map(b => b.n), errs = [];
    for (const [i, c] of rb.classes.entries()) {
      const sub = H.subclassesOf(c.n, rb)[0]?.n || '';
      openSheet({race: races[i % races.length], background: bgs[i % bgs.length], classes: [{name: c.n, subclass: sub, level: 5}], features: [], resources: [], attacks: []}, 'dm@x.hu', true);
      kclick('[data-tab="adat"]');
      try { kclick('[data-act="toAuto"]'); await until(() => K.eval('sheets.get("p1")').auto, 2000, c.n + ' átállt'); K.eval('tabBuild(sheets.get("p1"))'); }
      catch (e) { errs.push(`${c.n} (${races[i % races.length]}, ${bgs[i % bgs.length]}): ${e.message}`); continue; }
      const s = K.eval('sheets.get("p1")');
      const lost = [s.name !== 'Minta Tolvaj' && 'név: ' + s.name, s.build?.levels?.length !== 5 && 'szintek: ' + s.build?.levels?.length, !s.build?.race && 'faj üres', H.level(s) !== 5 && 'szint: ' + H.level(s)].filter(Boolean);
      if (lost.length) errs.push(`${c.n} (${races[i % races.length]}): ${lost.join(', ')}`);
      if (!s.auto) errs.push(c.n + ': nem állt át');
      else if (kq('[data-act="toAuto"]') || !ktext().includes('Felépítés')) errs.push(c.n + ': a felület nem váltott át');
    }
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
  // ---------- szintlépés-varázsló ----------
  const rogue3 = (extra = {}) => ({auto: true, build: {base: {dex: 16, con: 14}, levels: lv('Rogue', 3), sub: {Rogue: 'Thief|PHB'}, spells: {}, ch: {'Rogue:1:skills': ['stealth', 'perception', 'arcana', 'acrobatics'], 'Rogue:1:expertise': ['stealth', 'arcana']}}, classes: [{name: 'Rogue', subclass: 'Thief', level: 3, hitDie: 8}], levelUp: {to: 4}, hp: {max: 24, cur: 20}, ...extra});
  const luStep = () => kq('.lusteps span.on')?.textContent;
  const luNext = () => kclick('[data-act="luNext"]');
  const asi = (a, b) => { kset('[data-asi="a0"]', a); kset('[data-asi="a1"]', b); };
  ktest('szintlépés: sáv csak engedéllyel; kézi lapnál Átállítás; szabálykönyv nélkül vár; a DM-é és a gazdáé', () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet(rogue3({levelUp: null}));
    ok(!kq('.lubar'), 'engedély nélkül nincs');
    openSheet(rogue3({levelUp: {to: 3}}));
    ok(!kq('.lubar'), 'már elérte');
    openSheet(rogue3());
    has(kq('.lubar').textContent, '4. szint'); ok(kq('[data-act="luStart"]'));
    openSheet(rogue3({levelUp: {to: 6}}));
    has(kq('.lubar').textContent, '6. szintig');
    openSheet({classes: [{name: 'Rogue', level: 3}], levelUp: {to: 4}});
    has(kq('.lubar').textContent, 'állítsd át'); ok(!kq('[data-act="luStart"]'));
    openSheet(rogue3(), 'mas@x.hu');
    ok(!kq('.lubar'), 'idegen lapon nincs');
    K.KApp.setRulebook(null);
    openSheet(rogue3());
    has(kq('.lubar').textContent, 'szabálykönyv'); ok(!kq('[data-act="luStart"]'));
  });
  ktest('szintlépés Rogue 3 → 4: osztály, dobás egyszer és rögzítve, ASI kötelező, összegzés, mentés előzménnyel; az engedély törlődik; a csapat felé is', async () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet(rogue3());
    klog.length = 0;
    kclick('[data-act="luStart"]');
    eq(luStep(), 'Osztály'); has(ktext(), 'Rogue 3 → 4');
    luNext(); eq(luStep(), 'HP');
    ok(kq('[data-act="luNext"]').disabled, 'HP nélkül nem lép tovább');
    K.rnd = () => 2;
    kclick('[data-act="luHow"][data-how="roll"]');
    has(ktext(), 'A dobás: 2');
    has(ktext(), 'max HP');
    ok(kq('[data-act="luHow"][data-how="avg"]').disabled && kq('[data-act="luHow"][data-how="roll"]').disabled, 'nem dobható újra');
    // újratöltés után ugyanaz (a dobás nem dobódik újra, ha a kockát más adná)
    K.rnd = () => 8;
    kclick('[data-act="luClose"]'); ok(kq('.lubar'));
    kclick('[data-act="luStart"]');
    eq(luStep(), 'HP'); has(ktext(), 'A dobás: 2');
    luNext(); eq(luStep(), 'Választások');
    ok(kq('[data-act="luNext"]').disabled); has(ktext(), 'Még 1 választás');
    eq(K.eval('sheets.get("p1")').build.levels.length, 3, 'a mentésig a lap nem változik');
    asi('dex', 'dex');
    ok(!kq('[data-act="luNext"]').disabled);
    luNext(); eq(luStep(), 'Jellemzők');
    luNext(); eq(luStep(), 'Összegzés');
    const t = ktext();
    has(t, '3 → 4'); has(t, 'Dexterity'); has(t, '16 → 18'); has(t, 'Rogue 3 (Thief) → Rogue 4 (Thief)'); has(t, '3d8 → 4d8');
    kclick('[data-act="luBack"]'); eq(luStep(), 'Jellemzők'); luNext();
    kclick('[data-act="luSave"]');
    await until(() => !K.eval('lu'), 2000, 'a varázsló bezárul');
    const [, id, p, h, doc] = klog.find(l => l[0] === 'hist');
    eq([id, p.build.levels.length, p.build.levels[3], p.levelUp, p.classes[0].level, p.abilities.dex], ['p1', 4, {c: 'Rogue', hp: 2}, null, 4, 18]);
    eq([p.hp.max - 24, p.hp.cur - 20], [p.hp.max - 24, p.hp.max - 24], 'a jelenlegi HP ugyanannyit nő');
    ok(/^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d+Z$/.test(h), 'időbélyeg-azonosító: ' + h);
    eq([doc.reason, doc.from, doc.to, doc.hp, doc.by, doc.sheet.build.levels.length], ['levelup', 3, 4, 'roll', 'a@x.hu', 3]);
    const s = K.eval('sheets.get("p1")');
    eq([K.Sheet.level(s), s.levelUp], [4, null]);
    ok(!kq('.lubar'), 'a sáv eltűnt');
    eq(K.localStorage.getItem('dmscreen-szintlepes-p1'), null);
    eq(klog.find(l => l[0] === 'pub')?.[2].level, 'Szint 4');
    has(kq('#toast').textContent, '4. szint');
    eq(klog.filter(l => l[0] === 'update' && l[2].build), [], 'nem két írás');
  });
  ktest('szintlépés: sikertelen mentés (szabály, internet nélkül) a lapot nem változtatja, a piszkozat marad; két szintes engedély újra indul', async () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet(rogue3({levelUp: {to: 5}, build: {...rogue3().build, ch: {...rogue3().build.ch, 'Rogue:4:asi': {dex: 2}}}}));
    const uzenet = []; K.alert = m => uzenet.push(m);
    K.KDB.saveWithHist = async () => { const e = new Error('tilos'); e.code = 'permission-denied'; throw e; };
    kclick('[data-act="luStart"]'); luNext();
    kclick('[data-act="luHow"][data-how="avg"]'); luNext();
    while (!kq('[data-act="luSave"]')) luNext();
    kclick('[data-act="luSave"]');
    await until(() => uzenet.length, 2000, 'hibaüzenet');
    has(uzenet[0], 'szabályokat');
    await until(() => !K.eval('lu').saving, 1000, 'újra menthető');
    eq(K.Sheet.level(K.eval('sheets.get("p1")')), 3); ok(kq('[data-act="luSave"]'), 'a varázsló nyitva');
    Object.defineProperty(K.navigator, 'onLine', {get: () => false, configurable: true});
    kclick('[data-act="luSave"]');
    await until(() => uzenet.length === 2, 2000, 'internet nélkül');
    has(uzenet[1], 'internet');
    delete K.navigator.onLine;
    K.KDB.saveWithHist = async (id, p, h, doc) => { klog.push(['hist', id, p, h, doc]); };
    kclick('[data-act="luSave"]');
    await until(() => !K.eval('lu'), 2000, 'menthető');
    eq(K.eval('sheets.get("p1")').levelUp.to, 5, 'a köztes szinten az engedély marad');
    ok(kq('[data-act="luStart"]'), 'jöhet a következő');
    has(kq('.lubar').textContent, '5. szint');
  });
  ktest('szintlépés: a meglévő választás zárolt; known casternél 1 csere, a többi zárolt', () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet({auto: true, build: {base: {cha: 16}, levels: lv('Sorcerer', 2), sub: {Sorcerer: 'Draconic|PHB'}, spells: {Sorcerer: {cantrips: ['Light|PHB', 'Fire Bolt|PHB', 'Mage Hand|PHB', 'Prestidigitation|PHB'], known: ['Shield|PHB', 'Sleep|PHB', 'Grease|PHB']}}}, classes: [{name: 'Sorcerer', level: 2, hitDie: 6}], levelUp: {to: 3}});
    kclick('[data-act="luStart"]'); luNext();
    kclick('[data-act="luHow"][data-how="manual"]');
    ok(kq('[data-act="luNext"]').disabled, 'kézi: érték kell');
    kset('#luHpIn', 99, 'input'); ok(kq('[data-act="luNext"]').disabled, 'érvénytelen');
    kset('#luHpIn', 4, 'input'); ok(!kq('[data-act="luNext"]').disabled);
    has(ktext(), '+4 (kézi, d6)');
    luNext(); eq(luStep(), 'Választások');
    ok(kcb('Sorcerer:opt:Metamagic', 'Quickened Spell|PHB'), 'pipás lista');
    kset(kcb('Sorcerer:opt:Metamagic', 'Quickened Spell|PHB'), true);
    kset(kcb('Sorcerer:opt:Metamagic', 'Twinned Spell|PHB'), true);
    luNext(); eq(luStep(), 'Varázslatok');
    has(ktext(), 'Egyet lecserélhetsz');
    const C = (k, v) => kqa('input[type=checkbox]').find(e => e.dataset.ch === k && e.value === v);
    const K_ = 'Sorcerer:known';
    ok(!C(K_, 'Shield|PHB').disabled && !C(K_, 'Sleep|PHB').disabled, 'még cserélhető');
    kset(C(K_, 'Web|PHB'), true);
    has(kq('#ch-Sorcerer_known').textContent, '4 / 4');
    kset(C(K_, 'Shield|PHB'), false);
    ok(C(K_, 'Sleep|PHB').disabled && C(K_, 'Grease|PHB').disabled, 'egy csere után a többi zárolt');
    ok(!C(K_, 'Shield|PHB').disabled, 'a levett visszarakható');
    ok(kq('[data-act="luNext"]').disabled, 'a levett hely pótlandó');
    kset(C(K_, 'Thunderwave|PHB'), true);
    ok(!kq('[data-act="luNext"]').disabled);
    eq([...K.eval('lu').build.spells.Sorcerer.known].sort(), ['Grease|PHB', 'Sleep|PHB', 'Thunderwave|PHB', 'Web|PHB']);
    eq(K.eval('sheets.get("p1")').build.spells.Sorcerer.known.length, 3, 'a lap még a régi');
  });
  ktest('pipás lista: a zárolt (szintlépés előtti) választás sem a listából, sem a leírás ablakából nem cserélhető; a szabálykönyvben nem szereplő régi érték „saját” jelöléssel megmarad', () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    const MM = 'Sorcerer:opt:Metamagic', pop = () => kq('#infoPop');
    openSheet({auto: true, build: {base: {cha: 16}, levels: lv('Sorcerer', 3), sub: {Sorcerer: 'Draconic|PHB'}, spells: {}, ch: {[MM]: ['Quickened Spell|PHB', 'Régi Metamagic|HB']}}, classes: [{name: 'Sorcerer', level: 3, hitDie: 6}]});
    kclick('[data-tab="adat"]');
    // zárolva (ahogy a szintlépés-varázsló rajzolja): a választott és a többi is tiltott, az ablakban nincs gomb
    K.eval(`{ const cr = calcOf(sheets.get('p1')), c = cr.choices.find(x => x.key === '${MM}'); $('main').innerHTML = choiceBox(c, cr, {locked: ['Quickened Spell|PHB'], csere: false}); }`);
    ok(kcb(MM, 'Quickened Spell|PHB').checked && kcb(MM, 'Quickened Spell|PHB').disabled, 'zárolt');
    ok(kcb(MM, 'Twinned Spell|PHB').disabled, 'a hely betelt, a többi tiltott');
    kclick(kqa('[data-act="leiras"]').find(e => e.dataset.chk === MM && e.dataset.ref === 'Quickened Spell|PHB'));
    has(pop().textContent, 'nem cserélhető'); ok(!pop().querySelector('[data-act="leirasValaszt"]'), 'nincs választó gomb');
    kclick(pop().querySelector('[data-act="infoClose"]'));
    // a „saját” régi érték bepipálva látszik, és egy másik pipa levétele után is megmarad
    K.render(true);
    ok(kcb(MM, 'Régi Metamagic|HB').checked, 'a saját érték bepipálva');
    has(kcb(MM, 'Régi Metamagic|HB').closest('label').textContent, 'saját');
    kset(kcb(MM, 'Quickened Spell|PHB'), false);
    eq(lastUpdate().build.ch[MM], ['Régi Metamagic|HB'], 'a saját érték megmaradt');
  });
  ktest('szintlépés: a piszkozat a telefonon, és ha közben megváltozik a felépítés vagy elveszik az engedélyt, nem írja felül; 320 px; gonosz adat', () => {
    const rb = rbVarazs();
    rb.features.push({n: '<img src=x onerror=window.__x1=1>', cls: 'Rogue', lvl: 4, s: 'PHB', tx: '<img src=x onerror=window.__x2=1>'});
    rb.classes.find(c => c.n === 'Rogue').feats.push({n: '<img src=x onerror=window.__x1=1>', lvl: 4});
    K.KApp.setRulebook({version: 'v', rb});
    openSheet(rogue3());
    K.frameElement.width = 320;
    const nincsSzeles = l => ok(K.document.documentElement.scrollWidth <= 320, l + ': nem lóg ki, ' + K.document.documentElement.scrollWidth);
    kclick('[data-act="luStart"]'); nincsSzeles('osztály');
    luNext(); kclick('[data-act="luHow"][data-how="avg"]'); nincsSzeles('HP');
    luNext(); asi('str', 'con'); nincsSzeles('választások');
    luNext(); nincsSzeles('jellemzők');
    ok(!kq('main img') && !K.__x1 && !K.__x2, 'nincs befecskendezés'); has(ktext(), '<img src=x');
    luNext(); nincsSzeles('összegzés');
    const tabla = kq('.lutab'), cella = tabla.querySelector('td');
    ok(tabla.getBoundingClientRect().right <= 320, 'az összegző táblázat nem lóg ki: ' + tabla.getBoundingClientRect().right);
    ok(cella.getBoundingClientRect().width >= 60 && cella.getBoundingClientRect().height < 60, 'a címke olvasható, nem betűnként törik');
    eq(JSON.parse(K.localStorage.getItem('dmscreen-szintlepes-p1')).how, 'avg', 'a piszkozat a telefonon');
    // kívülről változott a felépítés: a választások újrakezdődnek, a régi nem írja felül
    const b = {...rogue3().build, ch: {...rogue3().build.ch, 'Rogue:1:expertise': ['stealth', 'perception']}};
    K.KApp.setSheets([{...sheetDoc(), id: 'p1', ...rogue3({build: b})}]);
    eq(K.eval('lu').build.ch['Rogue:1:expertise'], ['stealth', 'perception']);
    eq([K.eval('lu').how, K.eval('lu').build.ch['Rogue:4:asi']], ['avg', undefined]);
    // elvették az engedélyt: bezárul
    K.KApp.setSheets([{...sheetDoc(), id: 'p1', ...rogue3({levelUp: null})}]);
    eq(K.eval('lu'), null); ok(!kq('.lubar'));
    // másik szintről maradt, vagy kézzel átírt piszkozat nem számít
    K.localStorage.setItem('dmscreen-szintlepes-p1', JSON.stringify({from: 9, cls: 'Rogue', how: 'roll', die: 1}));
    K.KApp.setSheets([{...sheetDoc(), id: 'p1', ...rogue3()}]);
    kclick('[data-act="luStart"]');
    eq(K.eval('lu').how, '');
    kclick('[data-act="luClose"]');
    K.localStorage.setItem('dmscreen-szintlepes-p1', '{rossz json');
    kclick('[data-act="luStart"]'); eq(K.eval('lu').from, 3);
    kclick('[data-act="luClose"]');
    K.localStorage.setItem('dmscreen-szintlepes-p1', JSON.stringify({from: 3, cls: 'Rogue', step: 'x', how: 'roll', die: 99, base: K.JSON.stringify(K.eval('sheets.get("p1")').build), build: K.eval('sheets.get("p1")').build}));
    kclick('[data-act="luStart"]');
    eq([K.eval('lu').how, K.eval('lu').die], ['', null], 'a kockánál nagyobb dobás érvénytelen');
  });
  ktest('szintlépés: a kulcssorrend nem számít változásnak; a kapcsolat közbeni megszakadásnál sorba áll; hiányos felépítésnél nem indul', async () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    const base = rogue3();
    openSheet(base);
    kclick('[data-act="luStart"]'); luNext(); kclick('[data-act="luHow"][data-how="avg"]'); luNext(); asi('dex', 'dex');
    K.KApp.setSheets([{...sheetDoc(), id: 'p1', ...base, build: {...base.build, ch: Object.fromEntries(Object.entries(base.build.ch).reverse())}}]);
    eq(K.eval('lu').build.ch['Rogue:4:asi'], {dex: 2}, 'a választás megmaradt');
    eq(luStep(), 'Választások');
    luNext(); luNext();
    const uzenet = []; K.alert = m => uzenet.push(m);
    K.eval('saveTimeout = 20');
    K.KDB.saveWithHist = () => new Promise(() => {});
    klog.length = 0;
    kclick('[data-act="luSave"]');
    await until(() => !K.eval('lu'), 2000, 'a varázsló bezárul');
    K.eval('saveTimeout = 20000');
    has(uzenet[0], 'sorba állt');
    eq(K.Sheet.level(K.eval('sheets.get("p1")')), 4);
    ok(klog.some(l => l[0] === 'pub' && l[2].level === 'Szint 4'), 'a csapat felé is');
    // a felépítés kevesebb szintet tud, mint a lap (saját osztály): a varázsló visszaejtené
    openSheet({auto: true, build: {levels: [], spells: {}}, classes: [{name: 'Saját', level: 5, hitDie: 8}], levelUp: {to: 6}});
    ok(!kq('[data-act="luStart"]')); has(kq('.lubar').textContent, 'nem egyeznek');
  });
  ktest('többosztályú lapon választani kell; dobás után nem váltható; osztályváltás újrakezd', () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet({auto: true, build: {base: {str: 14, dex: 14, wis: 14}, levels: [...lv('Fighter', 2), ...lv('Monk', 2)], spells: {}, ch: {'Fighter:opt:Fighting Style': ['Defense|PHB']}}, classes: [{name: 'Fighter', level: 2, hitDie: 10}, {name: 'Monk', level: 2, hitDie: 8}], levelUp: {to: 5}});
    kclick('[data-act="luStart"]');
    ok(kq('[data-act="luNext"]').disabled);
    has(ktext(), 'Monk 2 → 3');
    kclick('[data-act="luCls"][data-c="Monk"]'); eq(K.eval('lu').build.levels.at(-1).c, 'Monk');
    kclick('[data-act="luCls"][data-c="Fighter"]'); eq(K.eval('lu').build.levels.at(-1).c, 'Fighter');
    luNext(); K.rnd = () => 3; kclick('[data-act="luHow"][data-how="roll"]');
    kclick('[data-act="luBack"]');
    ok(kq('[data-act="luCls"][data-c="Monk"]').disabled, 'dobás után rögzült');
    has(ktext(), 'nem változtatható');
  });
  ktest('multiclass (TERV-multiclass.md): új osztály a varázslóban, ⚠ és megerősítés, piszkozat, Wizard 1 varázslatai, összegzés, előzmény; a DM ＋ Szint listája ⚠-tel', async () => {
    const rb = rbVarazs();
    rb.classes.find(c => c.n === 'Wizard').mc = {req: {int: 13}, fx: []};
    rb.classes.find(c => c.n === 'Fighter').mc = {...rb.classes.find(c => c.n === 'Fighter').mc, req: {or: [{str: 13, dex: 13}]}};
    K.KApp.setRulebook({version: 'v', rb});
    const lap = {auto: true, build: {base: {str: 14, dex: 12, con: 14, int: 12}, levels: lv('Fighter', 2), spells: {}, ch: {'Fighter:opt:Fighting Style': ['Defense|PHB']}}, classes: [{name: 'Fighter', level: 2, hitDie: 10}], levelUp: {to: 3}, hp: {max: 22, cur: 22}};
    // kézzel átírt piszkozat ismeretlen / gonosz osztállyal: eldobja
    for (const c of ['Hacker', '<img src=x onerror=window.__x8=1>']) K.localStorage.setItem('dmscreen-szintlepes-p1', JSON.stringify({from: 2, cls: c, how: 'avg', build: {...lap.build, levels: [...lap.build.levels, {c}]}, base: ''}));
    openSheet(lap);
    const szel = K.frameElement.width; K.frameElement.width = 320;
    kclick('[data-act="luStart"]');
    has(ktext(), 'Új osztály (multiclass)'); has(ktext(), '⚠ Wizard'); has(ktext(), 'INT 13 kell (most 12)');
    ok(!kq('[data-act="luCls"][data-c="Rogue"]').textContent.includes('⚠'), 'feltétel nélküli osztály');
    eq(K.eval('lu').cls, 'Fighter', 'egy osztálynál előre kiválasztva');
    let kerdes = '';
    K.confirm = m => { kerdes = m; return false; };
    kclick('[data-act="luCls"][data-c="Wizard"]');
    eq(K.eval('lu').cls, 'Fighter', 'Mégse: marad'); has(kerdes, 'INT 13');
    K.confirm = () => true;
    kclick('[data-act="luCls"][data-c="Wizard"]');
    eq([K.eval('lu').cls, K.eval('lu').build.levels.at(-1).c], ['Wizard', 'Wizard']);
    kclick('[data-act="luClose"]'); kclick('[data-act="luStart"]');
    eq(K.eval('lu').cls, 'Wizard', 'a piszkozat megmarad');
    ok(kq('details[data-key="lu:uj"]').open, 'új osztály választva: a lista nyitva');
    ok(K.document.documentElement.scrollWidth <= 320, 'a lista 320 px-en nem lóg ki: ' + K.document.documentElement.scrollWidth);
    ok(!K.__x8 && !kq('main img'), 'a gonosz piszkozat nem fut');
    luNext(); has(ktext(), 'd6'); kclick('[data-act="luHow"][data-how="avg"]');
    has(ktext(), '+4 (átlag, d6)'); has(kq('#luHpOut').textContent, 'max HP 26', 'Fighter 2: 10 + 6 + 2 × CON 2 = 20, a Wizard 1. szintje átlag: +4 + 2');
    luNext(); eq(luStep(), 'Varázslatok');
    ok(kq('[data-act="luNext"]').disabled, 'varázslatok nélkül nem lép tovább');
    for (const r of ['Light|PHB', 'Fire Bolt|PHB', 'Mage Hand|PHB']) kset(kcb('Wizard:cantrips', r), true);
    for (const r of ['Shield|PHB', 'Magic Missile|PHB', 'Sleep|PHB', 'Thunderwave|PHB', 'Grease|PHB', 'Find Familiar|PHB']) kset(kcb('Wizard:book', r), true);
    ok(!kq('[data-act="luNext"]').disabled);
    while (!kq('[data-act="luSave"]')) luNext();
    has(ktext(), '🔀 Új osztály: Wizard 1'); has(ktext(), 'INT 13 kell (most 12)'); has(ktext(), 'Fighter 2 → Fighter 2 / Wizard 1');
    klog.length = 0;
    kclick('[data-act="luSave"]');
    await until(() => !K.eval('lu'), 2000, 'mentve');
    K.frameElement.width = szel;
    const [, , p, , doc] = klog.find(l => l[0] === 'hist');
    eq([p.classes.map(c => c.name + c.level), doc.mc], [['Fighter2', 'Wizard1'], {cls: 'Wizard', hiany: ['INT 13 kell (most 12)']}]);
    // teljesülő feltételnél nincs ⚠ és nincs mc az előzményben
    openSheet({...lap, build: {...lap.build, base: {...lap.build.base, int: 13}}});
    kclick('[data-act="luStart"]');
    ok(!ktext().includes('⚠ Wizard'));
    kclick('[data-act="luClose"]');
    // a DM ＋ Szint listája: ⚠ az okkal, de választható
    openSheet(lap, 'dm@x.hu', true);
    kclick('[data-tab="adat"]');
    const o = kq('#lvCls option[value="Wizard"]');
    has(o.textContent, '⚠ Wizard'); has(o.textContent, 'INT 13'); ok(!o.disabled);
    ok(!kq('#lvCls option[value="Fighter"]').textContent.includes('⚠'));
    // az Előzményekben ⚠ a szintlépés mellett
    K.KDB.histList = async () => [{...doc, id: '2026-11-11T10-00-00-000Z', mc: {cls: 'Wizard', hiany: ['<img src=x onerror=window.__x9=1>']}}];
    const d = kq('details[data-key="hist"]'); d.open = true; d.dispatchEvent(new K.Event('toggle'));
    await until(() => kq('[data-hist]').textContent.includes('2 → 3'), 2000, 'betöltve');
    has(kq('[data-hist]').textContent, '⚠ Wizard multiclass: <img src=x'); ok(!K.__x9 && !kq('[data-hist] img'), 'nincs befecskendezés');
  });
  ktest('multiclass (TERV-multiclass.md, 4. lépés): Varázslat fül osztályonként (DC, attack, bekészítve / bekészíthető, a varázslatok osztály szerint, Egyéb), Harc fül: osztályonkénti sor, támadás akciónként', () => {
    const rb = rbVarazs(); rb.classes.find(c => c.n === 'Fighter').feats.push({n: 'Extra Attack', lvl: 5});
    K.KApp.setRulebook({version: 'v', rb});
    const sp = (name, level, cls, prepared = false) => ({name, level, cls, prepared});
    // Fighter 5 / Cleric 3 / Wizard 2: PB 4; Cleric DC 8 + 4 + WIS 2 = 14, Wizard DC 8 + 4 + INT 3 = 15; Extra Attack: 2
    openSheet({auto: true, build: {base: {str: 14, wis: 14, int: 16}, levels: [...lv('Fighter', 5), ...lv('Cleric', 3), ...lv('Wizard', 2)], spells: {}, ch: {'Fighter:opt:Fighting Style': ['Defense|PHB']}},
      classes: [{name: 'Fighter', level: 5}, {name: 'Cleric', level: 3}, {name: 'Wizard', level: 2}],
      spells: [sp('Bless', 1, 'Cleric', true), sp('Shield', 1, 'Wizard', true), sp('Sleep', 1, 'Wizard'), sp('Light', 0, 'Wizard'), sp('<img src=x onerror=window.__x7=1>', 1, '')]});
    kclick('[data-tab="harc"]');
    has(kq('#apa').textContent, 'Támadás akciónként: 2');
    const harc = ktext();
    has(harc, 'Varázslat (Cleric)'); has(harc, 'Varázslat (Wizard)'); has(harc, 'spell save DC 15');
    kclick('[data-tab="var"]');
    const fej = kqa('.mcfej').map(e => e.textContent);
    eq(fej.length, 2); has(fej[0], 'Cleric'); has(fej[0], 'DC 14'); has(fej[0], 'bekészítve 1 / 5'); has(fej[1], 'Wizard'); has(fej[1], 'DC 15'); has(fej[1], '+7');
    eq(kqa('.mcosz').map(e => e.textContent), ['Cleric', 'Wizard', 'Egyéb']);
    ok(!K.__x7 && !kq('main img'), 'gonosz név nem fut');
    // egy varázsló osztálynál a régi nézet (nincs osztályfejléc), 1 támadásnál nincs sor
    openSheet({auto: true, build: {base: {int: 16}, levels: lv('Wizard', 3), spells: {}}, classes: [{name: 'Wizard', level: 3}], spells: [sp('Shield', 1, 'Wizard', true)]});
    kclick('[data-tab="harc"]'); ok(!kq('#apa'), '1 támadásnál nincs sor');
    kclick('[data-tab="var"]');
    eq([kqa('.mcfej').length, kqa('.mcosz').length], [0, 0]); has(ktext(), 'spell save DC 13');
    // gonosz osztálynév a cache-ben (a lapot a játékos is írhatja): a Harc és a Varázslat fül rajza és a DM statblokkja sem futtatja
    const gonosz = '<img src=x onerror=window.__x6=1>';
    const gl = {auto: true, build: {levels: [], spells: {}}, cache: {spells: [{cls: gonosz, ab: 'int', dc: 14, atk: 6, prep: 2}, {cls: 'Cleric', ab: '', dc: 13, atk: 5}], atk: 2}, spells: [sp('Shield', 1, gonosz, true)]};
    K.eval(`{ const s = H.norm(${JSON.stringify(gl)}); $('#main').innerHTML = tabHarc(s, true) + tabVar(s, true); }`);
    ok(!K.__x6 && !kq('#main img'), 'nincs befecskendezés'); has(ktext(), gonosz); has(ktext(), 'Cleric: spell save DC 13');
  });
  ktest('előzmények: játékos csak az utolsó szintlépését vonja vissza, a DM bármelyiket; a visszaállítás előzménnyel, engedéllyel; hibánál üzenet; gonosz adat', async () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    const regi = rogue3({levelUp: {to: 4}, notes: 'pillanatkép'});
    const h1 = {id: '2026-11-02T18-00-00-000Z', at: '2026-11-02T18:00:00.000Z', by: 'a@x.hu', reason: 'levelup', from: 3, to: 4, hp: 'roll', sheet: regi};
    const h0 = {id: '2026-10-02T18-00"><img src=x onerror=window.__x3=1>', at: '2026-10-02T18:00:00.000Z', by: '<img src=x onerror=window.__x3=1>', reason: 'levelup', from: 2, to: 3, hp: 'avg', sheet: rogue3({build: {...rogue3().build, levels: lv('Rogue', 2)}, classes: [{name: 'Rogue', level: 2}], levelUp: null})};
    K.KDB.histList = async () => [h0, h1];
    const most = {auto: true, build: {...rogue3().build, levels: lv('Rogue', 4)}, classes: [{name: 'Rogue', subclass: 'Thief', level: 4, hitDie: 8}], levelUp: null, notes: 'új jegyzet', inventory: [{name: 'Új tárgy', qty: 1}], hp: {max: 31, cur: 31}};
    openSheet(most);
    kclick('[data-tab="adat"]');
    const nyit = async () => { const d = kq('details[data-key="hist"]'); d.open = true; d.dispatchEvent(new K.Event('toggle')); await until(() => kq('[data-hist]').textContent.includes('3 → 4'), 2000, 'betöltve'); };
    await nyit();
    const gombok = () => kqa('[data-act="histRestore"]').map(b => b.dataset.h);
    eq(gombok(), [h1.id], 'játékos: csak a legfrissebb szintlépés');
    has(kq('[data-hist]').textContent, 'HP: dobás');
    has(kq('[data-hist]').textContent, '↩ Szintlépés visszavonása');
    let kerdes = '';
    K.confirm = m => { kerdes = m; return false; };
    kclick(kq('[data-act="histRestore"]')); await wait(10);
    has(kerdes, '3. szintre'); eq(klog.filter(l => l[0] === 'hist'), [], 'mégsem');
    K.confirm = () => true; klog.length = 0;
    kclick(kq('[data-act="histRestore"]'));
    await until(() => klog.some(l => l[0] === 'hist'), 2000, 'visszaállítva');
    await until(() => K.Sheet.level(K.eval('sheets.get("p1")')) === 3, 2000);
    const [, , p, , doc] = klog.find(l => l[0] === 'hist');
    eq([doc.reason, doc.from, doc.to, doc.sheet.build.levels.length], ['restore', 4, 3, 4], 'a visszaállítás előtt is pillanatkép');
    eq(p.levelUp.to, 4, 'az engedély visszajön');
    const s = K.eval('sheets.get("p1")');
    eq([s.notes, s.inventory[0].name, s.build.levels.length], ['új jegyzet', 'Új tárgy', 3]);
    await until(() => !K.eval('histCache').size || K.eval('histCache').get('p1') !== undefined, 1000);
    // a DM mindegyiket látja, gonosz adat csak szövegként
    K.eval('histCache.clear()');
    openSheet(most, 'dm@x.hu', true);
    kclick('[data-tab="adat"]');
    await until(() => kq('[data-hist]').textContent.includes('3 → 4'), 2000, 'DM: nyitva marad és betölt');
    eq(gombok(), [h1.id], 'a visszavonás a DM-nek is csak a legfrissebb szintlépésre szól');
    eq(kqa('[data-act="histFull"]').map(b => b.dataset.h), [h1.id, h0.id], 'teljes visszaállítás mindegyikre');
    ok(!kq('[data-hist] img') && !K.__x3, 'nincs befecskendezés');
    // a betöltés hibája csak üzenet
    K.eval('histCache.clear()');
    K.KDB.histList = async () => { throw Object.assign(new Error('x'), {code: 'permission-denied'}); };
    K.render(true);
    await until(() => kq('[data-hist]').textContent.includes('Nem sikerült'), 2000, 'hibaüzenet');
    // a saját, régi előzményt nem tudja a játékos visszaállítani újabb szint után
    K.eval('histCache.clear()');
    K.KDB.histList = async () => [h0];
    openSheet(most);
    kclick('[data-tab="adat"]');
    await until(() => kq('[data-hist]').textContent.includes('2 → 3'), 2000);
    eq(gombok(), [], 'a h0 már nem a mostani szinté');
    eq(kqa('[data-act="histFull"]').map(b => b.dataset.h), [h0.id], 'de a teljes visszaállítás a játékosnak is megy');
  });
  ktest('backup: kézi mentés kézi és motoros lapon; csak a legfrissebb 3 látszik; teljes visszaállítás; szintcsökkentésnél visszajön az engedély; letöltés', async () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    const most = {auto: true, build: {...rogue3().build, levels: lv('Rogue', 4)}, classes: [{name: 'Rogue', subclass: 'Thief', level: 4, hitDie: 8}], levelUp: null, notes: 'új jegyzet', inventory: [{name: 'Új tárgy', qty: 1}], currency: {gp: 99}, hp: {max: 31, cur: 10}};
    const regi = rogue3({levelUp: null, notes: 'régi jegyzet', inventory: [{name: 'Régi tárgy', qty: 1}], currency: {gp: 5}, owner: 'mas@x.hu'});
    const h = (i, extra = {}) => ({id: `2026-11-0${i}T18-00-00-000Z`, at: `2026-11-0${i}T18:00:00.000Z`, by: 'a@x.hu', reason: 'manual', from: 3, to: 3, sheet: regi, ...extra});
    K.KDB.histList = async () => [h(1), h(2), h(3), h(4)];
    openSheet(most);
    kclick('[data-tab="adat"]');
    const d = kq('details[data-key="hist"]'); d.open = true; d.dispatchEvent(new K.Event('toggle'));
    await until(() => kqa('[data-act="histFull"]').length, 2000, 'betöltve');
    eq(kqa('[data-act="histFull"]').map(b => b.dataset.h), [h(4).id, h(3).id, h(2).id], 'a legfrissebb 3');
    has(kq('[data-hist]').textContent, 'Backup: 3. szint'); has(kq('[data-hist]').textContent, 'Backup most');
    // kézi mentés: pillanatkép, a lap nem változik
    klog.length = 0;
    kclick('[data-act="histSave"]');
    await until(() => klog.some(l => l[0] === 'hist'), 2000, 'kézi mentés');
    let [, , p, , doc] = klog.find(l => l[0] === 'hist');
    eq(Object.keys(p).sort(), ['updatedAt', 'updatedBy']);
    eq([doc.reason, doc.from, doc.to, doc.sheet.notes], ['manual', 4, 4, 'új jegyzet']);
    // egyforma mentés nem készül másodszor; a közbeni kézi mentés nem zárja ki a szintlépés visszavonását
    K.KDB.histList = async () => [h(1, {reason: 'levelup', from: 3, to: 4}), {...h(2), sheet: K.eval('sheets.get("p1")')}];
    K.eval('histCache.clear()'); K.render(true);
    await until(() => kqa('[data-act="histRestore"]').length, 2000, 'visszavonás a kézi mentés után is');
    klog.length = 0;
    kclick('[data-act="histSave"]'); await wait(20);
    eq(klog.filter(l => l[0] === 'hist'), [], 'nem változott a lap');
    K.KDB.histList = async () => [h(1), h(2), h(3), h(4)];
    K.eval('histCache.clear()'); K.render(true);
    // teljes visszaállítás: minden visszajön, a gazda nem; a szintlépés-engedély a mostani szintig
    await until(() => kqa('[data-act="histFull"]').length, 2000, 'újratöltve');
    klog.length = 0;
    kclick('[data-act="histFull"]');
    await until(() => klog.some(l => l[0] === 'hist'), 2000, 'visszaállítás');
    [, , p, , doc] = klog.find(l => l[0] === 'hist');
    eq(doc.reason, 'restore'); eq(doc.sheet.notes, 'új jegyzet', 'előtte pillanatkép');
    ok(!('owner' in p), 'a gazdát nem írja'); eq(p.levelUp.to, 4);
    await until(() => K.eval('sheets.get("p1")').notes === 'régi jegyzet', 2000);
    const s = K.eval('sheets.get("p1")');
    eq([s.inventory[0].name, s.currency.gp, s.owner, s.build.levels.length, s.levelUp.to], ['Régi tárgy', 5, 'a@x.hu', 3, 4]);
    // letöltés: a fájl visszatölthető lap
    const H = K.Sheet, lap = H.exportLap({...s, updatedBy: 'x@x.hu'});
    eq([lap.format, lap.levelUp, lap.updatedBy, lap.owner], [H.FORMAT, null, '', 'a@x.hu']);
    eq(H.exportNev('Min<ta>/Tolvaj', '2026-11-05T10:00:00Z'), 'MintaTolvaj-backup-2026-11-05.json');
    // magasabb szintű mentést és felépítés nélküli mentést a játékos nem állíthat vissza (a szabály sem engedné), engedéllyel igen
    const a3 = {build: {levels: lv('Rogue', 3)}, levelUp: null}, sh = l => ({sheet: {build: l ? {levels: lv('Rogue', l)} : null}});
    eq([H.backupAllowed(a3, sh(3)), H.backupAllowed(a3, sh(2)), H.backupAllowed(a3, sh(4)), H.backupAllowed({...a3, levelUp: {to: 4}}, sh(4)), H.backupAllowed(a3, sh(0)), H.backupAllowed({build: null}, sh(0))], [true, true, false, true, false, true]);
  });
  ktest('karakter törlése: piros gomb az Alapadatok alján, megerősítés; a játékos elveszíti, a DM látja; mégse és hiba esetén nem változik', async () => {
    openSheet({});
    let ir = null;
    K.KDB.softDelete = async (id, p, pub) => { ir = {id, p, pub}; };
    ok(!kq('[data-act="lapTorol"]'), 'a Harc fülön nincs');
    kclick('[data-tab="adat"]');
    const gomb = kq('[data-act="lapTorol"]');
    ok(gomb && gomb.classList.contains('danger'), 'piros gomb');
    ok(gomb.compareDocumentPosition(kq('[data-hist]')) & K.Node.DOCUMENT_POSITION_PRECEDING, 'a fül alján');
    let kerdes = ''; K.confirm = m => { kerdes = m; return false; };
    kclick(gomb); await wait(10);
    has(kerdes, 'Minta Tolvaj'); eq(ir, null, 'mégse');
    K.confirm = () => true;
    K.KDB.softDelete = async () => { const e = new Error('x'); e.code = 'permission-denied'; throw e; };
    K.alert = () => {};
    kclick('[data-act="lapTorol"]'); await wait(10);
    ok(K.eval('sheets.get("p1")').owner === 'a@x.hu', 'hibánál megmarad');
    K.KDB.softDelete = async (id, p, pub) => { ir = {id, p, pub}; };
    kclick('[data-act="lapTorol"]');
    await until(() => ir, 2000, 'törölve');
    eq([ir.id, ir.p.owner, ir.p.deleted.owner, ir.p.deleted.vis, ir.pub], ['p1', '', 'a@x.hu', 'party', {owner: '', visibility: 'dm'}]);
    await until(() => !K.eval('sheets.has("p1")'), 2000, 'a játékosnak eltűnik');
    eq(K.location.hash, ''); hasNot(ktext(), 'Minta Tolvaj');
    // a DM: a lap megmarad, felirattal, gomb nélkül
    openSheet({owner: '', deleted: {owner: 'a@x.hu', vis: 'party'}}, 'dm@x.hu', true);
    has(ktext(), 'Törölt karakter');
    kclick('[data-tab="adat"]');
    ok(!kq('[data-act="lapTorol"]'), 'már törölt');
    K.location.hash = ''; K.route();
    has(ktext(), '🗑 törölve: a@x.hu');
  });
  ktest('új karakter: a varázsló végig (Wizard): név, faj, osztály, standard array, háttér, választások, varázslatok, Kész; backup, teli HP, kezdőszinttel tovább a szintlépésre', async () => {
    const rb = rbVarazs(), H = K.Sheet;
    rb.backgrounds = rb.backgrounds?.length ? rb.backgrounds : [{n: 'Sage', s: 'PHB', fx: []}];
    K.KApp.setRulebook({version: 'v', rb});
    openSheet(JSON.parse(JSON.stringify(H.ncBlank({name: 'Új karakter', owner: 'a@x.hu', target: 2, by: 'dm@x.hu', at: '2026-11-01T10:00:00.000Z'}))));
    const lepes = () => kq('.lusteps span.on').textContent, tovabb = () => kclick('[data-act="ncNext"]'), lap = () => K.eval('sheets.get("p1")');
    eq(lepes(), 'Alapok'); ok(!kq('nav.tabs'), 'a lap helyén a varázsló');
    kset('[data-ncf="name"]', '<img src=x onerror=window.__x9=1>');
    eq(lap().name, '<img src=x onerror=window.__x9=1>');
    ok(klog.some(l => l[0] === 'update' && l[2].name), 'a név a felhőbe');
    ok(!K.__x9 && !kq('main img'), 'a gonosz név nem fut');
    kset('[data-ncf="name"]', 'Próba Varázsló');
    // a saját írás visszhangja nem cseréli ki a gombot a koppintás közben
    const gomb = kq('[data-act="ncNext"]'); K.KApp.setSheets([{...lap(), id: 'p1'}]);
    ok(kq('[data-act="ncNext"]') === gomb, 'a Tovább ugyanaz az elem');
    tovabb();
    eq(lepes(), 'Faj'); ok(kq('[data-act="ncNext"]').disabled, 'faj kell');
    kset('[data-act="bRace"]', '0'); ok(lap().build.race, 'faj');
    eq(lap().race, H.raceOptions(rb)[0].label, 'a lap fejlécébe és a DM Screenbe is');
    tovabb(); eq(lepes(), 'Osztály'); ok(kq('[data-act="ncNext"]').disabled, 'osztály kell');
    kclick('[data-act="ncCls"][data-c="Rogue"]');
    eq(lap().build.levels, [{c: 'Rogue', hp: null}]);
    kclick('[data-act="ncCls"][data-c="Wizard"]');
    eq(lap().build.levels, [{c: 'Wizard', hp: null}], 'az osztály cserélhető, marad egy szint');
    K.eval(`sheets.get("p1").build.ch['Wizard:x'] = ['y']`);
    kclick('[data-act="ncCls"][data-c="Wizard"]');
    eq(lap().build.ch['Wizard:x'], ['y'], 'ugyanarra koppintva a választások maradnak');
    K.eval(`delete sheets.get("p1").build.ch['Wizard:x']`);
    eq(lap().classes[0].name, 'Wizard');
    tovabb(); eq(lepes(), 'Képességek'); ok(kq('[data-act="ncNext"]').disabled, 'módszer kell');
    kclick('[data-act="ncMethod"][data-m="array"]');
    // a kiválasztott módszer gombja kijelöltnek látszik (kiemelő színnel), a többi nem
    const hatterSzin = m => K.getComputedStyle(kq(`[data-act="ncMethod"][data-m="${m}"]`)).backgroundColor;
    eq([hatterSzin('array'), hatterSzin('buy')], ['rgb(226, 166, 59)', 'rgb(26, 29, 35)'], 'a választott kiemelő színű, a másik a sima gombé');
    H.ABIL.forEach((a, i) => { if (i < 5) kset(`[data-nc-pick="${a}"]`, String(i)); });
    ok(kq('[data-act="ncNext"]').disabled, 'egy még hiányzik');
    ok(kq('[data-nc-pick="cha"] option[value="0"]').disabled, 'a kiosztott érték nem választható újra');
    kset('[data-nc-pick="cha"]', '5');
    eq(lap().build.base, {str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8});
    tovabb(); eq(lepes(), 'Háttér');
    kset('[data-act="bBg"]', kqa('[data-act="bBg"] option').at(-1).value); ok(lap().build.background, 'háttér');
    tovabb();
    while (lepes() === 'Választások' || lepes() === 'Varázslatok') {
      const c = K.Sheet.ncPlan(lap(), rb), x = (lepes() === 'Választások' ? c.choices : c.spells).find(y => y.missing);
      if (!x) { tovabb(); continue; }
      ok(kq('[data-act="ncNext"]').disabled, 'kötelező választás: ' + x.c.key);
      const o = H.choiceOptions(x.c, c.cr, rb);
      K.eval(`patch({build: Sheet.setChoice(sheets.get("p1").build, ${JSON.stringify(x.c)}, ${JSON.stringify(o.opts.filter(y => !y.dis).slice(0, x.c.n).map(y => y.v))})})`);
    }
    eq(lepes(), 'Összegzés');
    has(ktext(), 'Wizard'); has(ktext(), 'Felszerelés fülön'); has(ktext(), '2. szintig');
    klog.length = 0;
    kclick('[data-act="ncDone"]');
    await until(() => klog.some(l => l[0] === 'hist'), 2000, 'mentve');
    await until(() => !lap().newChar, 2000, 'lezárva');
    const [, , p, , doc] = klog.find(l => l[0] === 'hist');
    eq([p.newChar, doc.reason, doc.sheet.newChar], [null, 'manual', null]);
    eq(lap().hp.cur, lap().hp.max, 'teli HP');
    await until(() => kq('.lusteps span.on')?.textContent === 'HP' || kq('.lusteps span.on')?.textContent === 'Osztály', 2000, 'jöhet a szintlépés');
    has(ktext(), '2. szint');
  });
  ktest('új karakter: Felszerelés lépés (TERV-kezdo-felszereles.md) – csomag mód: (a) / (b), két martial weapon legördülővel, holy symbol; összegzés AC-vel; Kész-kor a lapra; a DM rögzített módja; befecskendezés ellen', async () => {
    const rb = await W.buildRulebook(seGet), H = K.Sheet;
    rb.backgrounds[0].se.rows[0]._.push({sp: XSS});
    rb.items.push({n: XSS + 'Bot', s: 'PHB', v: '1 gp', tc: 'G'});
    K.KApp.setRulebook({version: 'v', rb});
    const lap = () => K.eval('sheets.get("p1")'), lepes = () => kq('.lusteps span.on').textContent, tovabb = () => kclick('[data-act="ncNext"]');
    const uj = (equip = 'any') => ({...JSON.parse(JSON.stringify(H.ncBlank({owner: 'a@x.hu', equip}))), currency: {gp: 1},
      build: {levels: lv('Fighter', 1), spells: {}, race: 'Dwarf|PHB', subrace: 'Hill|PHB', background: 'Acolyte|PHB', base: {str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8}}});
    openSheet({...uj(), newChar: {...uj().newChar, step: 'fel', method: 'manual'}});
    // a korábbi lépések kötelező választásai (a Kész csak akkor ment, ha minden lépés rendben)
    const kitolt = () => { for (let k = 0; k < 4; k++) {
      const c = H.ncPlan(lap(), rb);
      for (const x of [...c.choices, ...c.spells].filter(y => y.missing))
        K.eval(`patch({build: Sheet.setChoice(sheets.get("p1").build, ${JSON.stringify(x.c)}, ${JSON.stringify(H.choiceOptions(x.c, c.cr, rb).opts.filter(y => !y.dis).slice(0, x.c.n).map(y => y.v))})})`);
    } };
    kitolt();
    eq(lepes(), 'Felszerelés');
    ok(kq('[data-act="ncNext"]').disabled, 'mód kell'); has(kq('#ncBaj').textContent, 'kezdő felszerelés vagy arany');
    kclick('[data-act="ncEqMode"][data-m="pack"]');
    eq(lap().newChar.eq.mode, 'pack');
    ok(kq('[data-act="ncNext"]').disabled, 'a sorok választása kell'); has(ktext(), 'chain mail'); has(ktext(), 'Pénz: 15 gp');
    kclick('[data-act="ncEqPick"][data-r="c0"][data-k="a"]');
    kclick('[data-act="ncEqPick"][data-r="c1"][data-k="b"]');
    eq(kqa('select[data-act="ncEqCat"]').length, 3, 'két martial weapon + a holy symbol');
    kset('select[data-act="ncEqCat"][data-key="c1:b:0"][data-n="0"]', 'Longsword|PHB');
    ok(kq('[data-act="ncNext"]').disabled, 'a második fegyver hiányzik');
    kset('select[data-act="ncEqCat"][data-key="c1:b:0"][data-n="1"]', 'Battleaxe|PHB');
    eq(lap().newChar.eq.cat['c1:b:0'], ['Longsword|PHB', 'Battleaxe|PHB']);
    kset('select[data-act="ncEqCat"][data-key="h0:_:0"][data-n="0"]', 'Amulet|PHB');
    ok(!kq('[data-act="ncNext"]').disabled, 'minden megvan');
    eq(K.document.querySelectorAll('img[src="x"]').length, 0, 'HTML-befecskendezés'); ok(!K.__xss, "lefutott a befecskendezett kód");
    K.frameElement.width = 320; await wait(50);
    ok(K.document.documentElement.scrollWidth <= 320, '320 px-en nincs vízszintes görgetés: ' + K.document.documentElement.scrollWidth);
    K.frameElement.width = 420;
    tovabb(); eq(lepes(), 'Összegzés');
    const sor = l => [...kqa('.lutab tr')].find(tr => tr.cells[0].textContent === l)?.cells[1].textContent;
    eq(sor('AC'), '16'); has(sor('Felszerelés'), 'Chain Mail'); has(sor('Támadások'), 'Longsword'); eq(sor('Pénz'), '15 gp');
    eq(K.document.querySelectorAll('img[src="x"]').length, 0, 'HTML-befecskendezés az összegzésben');
    klog.length = 0;
    kclick('[data-act="ncDone"]');
    await until(() => klog.some(l => l[0] === 'hist'), 2000, 'mentve');
    const [, , p] = klog.find(l => l[0] === 'hist');
    eq([p.newChar, p.currency.gp], [null, 16], 'a meglévő 1 gp + 15 gp');
    const by = n => p.inventory.find(i => i.name === n);
    eq([by('Chain Mail').equipped, by('Longsword').equipped, by('Battleaxe').equipped, by('Amulet').note, by("Explorer's Pack").container, by('Torch').container],
      [true, true, true, 'holy symbol (a gift)', '', "Explorer's Pack"]);
    ok(by(XSS), 'a szöveges tétel is a lapra kerül');
    await until(() => !lap().newChar, 2000, 'lezárva');
    eq(lap().inventory.length, p.inventory.length);
    // a DM csak csomagot engedett: nincs módválasztó, a sorok rögtön látszanak
    openSheet({...uj('pack'), newChar: {...uj('pack').newChar, step: 'fel'}});
    ok(!kq('[data-act="ncEqMode"]'), 'nincs módválasztó'); ok(kq('[data-act="ncEqPick"]'), 'a sorok látszanak');
    // jártasság nélkül ⚠ a fegyver mellett (de választható)
    const fx = rb.classes[0].fx, wi = fx.findIndex(x => x.weapon);
    fx[wi] = {weapon: ['simple']};
    kclick('[data-act="ncEqPick"][data-r="c1"][data-k="b"]');
    has(kq('select[data-key="c1:b:0"] option[value="Longsword|PHB"]').textContent, '⚠ nem vagy jártas');
    ok(!kq('select[data-key="c1:b:0"] option[value="Longsword|PHB"]').disabled, 'választható');
    fx[wi] = {weapon: ['simple', 'martial']};
    // arany mód: egyszeri dobás, kosár, a maradék pénzként; a csomagra a dobás után a játékos nem válthat
    openSheet({...uj(), newChar: {...uj().newChar, step: 'fel', method: 'manual', eq: {mode: 'gold'}}});
    kitolt();
    ok(kq('[data-act="ncNext"]').disabled, 'dobás nélkül nem lehet továbblépni'); has(ktext(), '5d4 × 10 gp');
    K.rnd = () => 1;
    kclick('[data-act="ncEqGold"]');
    eq(lap().newChar.eq.gold, 50); ok(!kq('[data-act="ncEqGoldRe"]'), 'újradobni csak a DM tud');
    ok(!kq('[data-act="ncEqGold"]'), 'nem dobható újra');
    ok(kq('[data-act="ncEqMode"][data-m="pack"]').disabled, 'a dobás után nem válthat csomagra');
    ok(!kq('[data-act="ncNext"]').disabled, 'üres kosárral is mehet');
    kset('#ncBolt', 'chain', 'input');
    ok(kq('#ncBoltTalalat [data-act="ncKosar"][data-r="Chain Mail|PHB"]').disabled, 'a 75 gp-s páncélra nincs elég pénz');
    kset('#ncBolt', 'longsw', 'input');
    kclick('#ncBoltTalalat [data-act="ncKosar"][data-r="Longsword|PHB"]');
    eq(lap().newChar.eq.cart, [{r: 'Longsword|PHB', q: 1}]);
    kclick('[data-act="ncKosar"][data-r="Longsword|PHB"][data-d="1"]');
    kclick('[data-act="ncKosar"][data-r="Longsword|PHB"][data-d="-1"]');
    eq(lap().newChar.eq.cart, [{r: 'Longsword|PHB', q: 1}]);
    has(ktext(), 'Maradt: 35 gp');
    tovabb(); eq(lepes(), 'Összegzés'); eq(sor('Pénz'), '35 gp'); has(sor('Felszerelés'), 'Longsword');
    klog.length = 0;
    kclick('[data-act="ncDone"]');
    await until(() => klog.some(l => l[0] === 'hist'), 2000, 'mentve (arany)');
    const [, , pa] = klog.find(l => l[0] === 'hist');
    eq([pa.inventory.map(i => i.name), pa.currency.gp], [['Longsword'], 1 + 35]);
    // a DM újradobhat (a dobás és a kosár törlődik); a boltlista befecskendezés ellen; kezdőarany-kifejezés nélkül nincs dobás
    openSheet({...uj(), newChar: {...uj().newChar, step: 'fel', method: 'manual', eq: {mode: 'gold', gold: 50, cart: [{r: 'Dagger|PHB', q: 1}]}}}, 'dm@x.hu', true);
    kitolt();
    kset('#ncBolt', 'bot', 'input');
    ok(kq('#ncBoltTalalat [data-act="ncKosar"]'), 'a találat látszik');
    eq(K.document.querySelectorAll('img[src="x"]').length, 0, 'HTML-befecskendezés a boltlistában'); ok(!K.__xss, 'lefutott a kód');
    kclick('[data-act="ncEqGoldRe"]');
    eq([lap().newChar.eq.gold, lap().newChar.eq.cart], [null, []]);
    ok(kq('[data-act="ncEqGold"]'), 'újra dobható');
    const aranyNelkul = rb.classes[0].se.gold; delete rb.classes[0].se.gold;
    openSheet({...uj(), newChar: {...uj().newChar, step: 'fel', method: 'manual', eq: {mode: 'gold'}}});
    ok(!kq('[data-act="ncEqGold"]'), 'kifejezés nélkül nincs dobás'); has(ktext(), 'nem adja meg a kezdőaranyat');
    ok(kq('[data-act="ncNext"]').disabled, 'nem lehet továbblépni');
    rb.classes[0].se.gold = aranyNelkul;
    // a régi (3-as) szabálykönyvben nincs kezdő felszerelés: a lépés kimarad, az összegzés szól
    const regi = structuredClone(rb); regi.classes.forEach(c => delete c.se); regi.backgrounds.forEach(b => delete b.se);
    K.KApp.setRulebook({version: 'v3', rb: regi});
    openSheet({...uj(), newChar: {...uj().newChar, step: 'fel'}});
    eq(lepes(), 'Összegzés'); has(ktext(), 'újra kell töltenie a szabálykönyvet');
  });
  ktest('új karakter: dobás egyszer, rögzül; a DM újradobhat; point buy és kézi érték ellenőrzése; a tilos módszer nem látszik; a DM kihagyhatja; szabálykönyv nélkül üzenet', async () => {
    const rb = rbVarazs(), H = K.Sheet;
    const blank = (extra = {}) => JSON.parse(JSON.stringify(H.ncBlank({owner: 'a@x.hu', methods: ['roll', 'buy', 'manual'], ...extra})));
    K.KApp.setRulebook(null);
    openSheet({...blank()});
    has(ktext(), 'Új karakter'); ok(!kq('[data-act="ncNext"]'), 'szabálykönyv nélkül nincs lépés');
    K.KApp.setRulebook({version: 'v', rb});
    const lap = () => K.eval('sheets.get("p1")');
    openSheet({...blank(), build: {levels: lv('Fighter', 1), spells: {}, race: '', base: {}}, newChar: {step: 'kep', target: 1, methods: ['roll', 'buy', 'manual']}});
    ok(!kq('[data-act="ncMethod"][data-m="array"]'), 'a tilos módszer nem látszik');
    // point buy: 27 pont, 8–15
    kclick('[data-act="ncMethod"][data-m="buy"]');
    eq(lap().build.base.str, 8);
    kset('[data-nc-base="str"]', 15, 'input'); has(kq('#ncOut').textContent, 'Maradt: 18');
    ok(!kq('[data-act="ncNext"]').disabled);
    kset('[data-nc-base="dex"]', 16, 'input'); ok(kq('[data-act="ncNext"]').disabled, '16 nem lehet');
    kset('[data-nc-base="dex"]', 15); kset('[data-nc-base="con"]', 15); kset('[data-nc-base="int"]', 15, 'input');
    ok(kq('[data-act="ncNext"]').disabled, 'több mint 27 pont'); has(kq('#ncBaj').textContent, 'túl sok');
    eq([lap().build.base.str, lap().build.base.dex], [15, 15], 'a mező elhagyásakor mentődik');
    // kézi: 3–18
    kclick('[data-act="ncMethod"][data-m="manual"]');
    kset('[data-nc-base="str"]', 19, 'input'); ok(kq('[data-act="ncNext"]').disabled);
    kset('[data-nc-base="str"]', 18, 'input'); ok(!kq('[data-act="ncNext"]').disabled);
    // dobás: egyszer, utána nem váltható másik módszerre
    let n = 0; K.rnd = () => { n++; return 4; };
    kclick('[data-act="ncMethod"][data-m="roll"]');
    eq(lap().newChar.rolls, null);
    kclick('[data-act="ncRollDo"]');
    eq(lap().newChar.rolls, [12, 12, 12, 12, 12, 12]); eq(n, 24);
    ok(!kq('[data-act="ncRollDo"]'), 'egyszer dobható');
    ok(!kq('[data-act="ncReroll"]'), 'a játékos nem dobhat újra');
    ok(kq('[data-act="ncMethod"][data-m="buy"]').disabled, 'dobás után nem vált');
    K.eval('render(true)'); eq(lap().newChar.rolls.length, 6);
    // DM: újradobás, kihagyás
    openSheet({...blank(), build: {levels: lv('Fighter', 1), spells: {}}, newChar: {step: 'kep', target: 1, methods: ['roll'], method: 'roll', rolls: [10, 10, 10, 10, 10, 10]}}, 'dm@x.hu', true);
    kclick('[data-act="ncReroll"]');
    eq(lap().newChar.rolls, null);
    kclick('[data-act="ncSkip"]');
    eq(lap().newChar, null); ok(kq('nav.tabs'), 'a szokásos lap');
    // a Felépítés-fülön nem marad nyoma; 320 px-en is elfér
    K.frameElement.width = 320;
    openSheet({...blank(), newChar: {step: 'kep', target: 1, methods: ['roll', 'buy', 'manual'], method: 'buy'}});
    await wait(30);
    ok(K.document.documentElement.scrollWidth <= K.document.documentElement.clientWidth + 1, 'nincs vízszintes görgetés 320 px-en');
  });
  ktest('új karakter, Alapok: az alignment legördülő, a régi érték megmarad; a portré tallózható és kicsinyítve kerül a lapra; nem kép: üzenet', async () => {
    const H = K.Sheet;
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet({...JSON.parse(JSON.stringify(H.ncBlank({owner: 'a@x.hu'}))), alignment: 'saját <b>'});
    const lap = () => K.eval('sheets.get("p1")'), al = () => kq('select[data-ncf="alignment"]');
    eq(al().value, 'saját <b>', 'a nem szabványos érték is látszik');
    eq([...al().options].filter(o => o.value).length, 10, '9 alignment + a saját');
    ok(!kq('main b b'), 'nincs befecskendezés');
    kset(al(), 'chaotic good'); eq(lap().alignment, 'chaotic good');
    K.eval('render(true)'); eq(al().value, 'chaotic good');
    eq([...al().options].filter(o => o.value).length, 9);
    const cv = K.document.createElement('canvas'); cv.width = 800; cv.height = 400; cv.getContext('2d').fillRect(0, 0, 800, 400);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    await K.ncPortre(blob);
    ok(lap().portrait.startsWith('data:image/jpeg'), 'a lapon');
    const kep = new K.Image(); await new Promise(r => { kep.onload = r; kep.src = lap().portrait; });
    eq([kep.width, kep.height], [256, 256], 'kicsinyítve');
    ok(kq('main img.av'), 'előnézet');
    eq(kq('[data-ncf="portrait"]').value, '', 'a link mezőbe nem kerül');
    ok(klog.some(l => l[0] === 'update' && l[2].portrait), 'a felhőbe is');
    kclick('[data-act="ncPortreTorol"]'); eq(lap().portrait, '');
    await K.ncPortre(new K.Blob(['nem kép'], {type: 'text/plain'}));
    eq(lap().portrait, ''); has(kq('#toast').textContent, 'képként');
  });
  ktest('High Elf cantrip a felületen: Felépítésen választható, a Varázslat fülre kerül; a varázslóban kötelező; szintlépésnél zárolt; a felülírt skill a helyre választva tisztul', () => {
    const rb = rbVarazs();
    rb.races.push({n: 'Elf', s: 'PHB', subs: 1, fx: [], traits: []});
    rb.subraces.push({n: 'High', race: 'Elf', s: 'PHB', fx: [{todo: 'known varázslat választása (1. szinttől)'}], traits: [{n: 'Cantrip', tx: 'x'}]});
    K.KApp.setRulebook({version: 'v', rb});
    const b = extra => ({base: {dex: 14}, levels: lv('Rogue', 1), race: 'Elf|PHB', subrace: 'High|PHB', spells: {}, ...extra});
    openSheet({auto: true, build: b(), classes: [{name: 'Rogue', level: 1, hitDie: 8}], ov: {'skill:stealth': 1}});
    const lap = () => K.eval('sheets.get("p1")'), sel = () => kqa('input[type=checkbox]').find(e => e.dataset.ch === 'subrace:spell' && e.value === 'Fire Bolt|PHB');
    kclick('[data-tab="adat"]');
    ok(sel(), 'van választó');
    ok(!sel().disabled, 'nem szürke');
    kset(sel(), true);
    eq(lap().build.ch['subrace:spell'], ['Fire Bolt|PHB']);
    ok(lap().spells.some(x => x.name === 'Fire Bolt'), 'a lapon');
    const box = kqa('input[type=checkbox]').find(e => e.dataset.ch === 'Rogue:1:skills' && e.value === 'stealth');
    ok(box && !box.disabled, 'a felülírt skill választható');
    box.checked = true; box.dispatchEvent(new K.Event('change', {bubbles: true}));
    eq(lap().ov['skill:stealth'], undefined, 'a felülírás megszűnt'); eq(lap().skillProf.stealth, 1);
    // expertise a csak felülírásból jártas skillre: a doboz bepipálva megmarad, a felülírás 1-re vált (2 → 1 is beíródik), a ✎ sor szól
    openSheet({auto: true, build: b({ch: {'Rogue:1:skills': ['perception', 'arcana', 'acrobatics', 'sleight-of-hand']}}), classes: [{name: 'Rogue', level: 1, hitDie: 8}], ov: {'skill:stealth': 2}});
    kclick('[data-tab="adat"]');
    const exp = () => kqa('input[type=checkbox]').find(e => e.dataset.ch === 'Rogue:1:expertise' && e.value === 'stealth');
    ok(exp() && !exp().disabled, 'expertise-re választható');
    exp().checked = true; exp().dispatchEvent(new K.Event('change', {bubbles: true}));
    ok(exp() && exp().checked, 'a doboz megmaradt, bepipálva');
    eq([lap().ov['skill:stealth'], lap().skillProf.stealth], [1, 2]);
    has(K.document.body.textContent, 'az expertise a Felépítés választásából jön');
    // varázsló: kötelező
    openSheet({auto: true, build: b(), newChar: {step: 'val', target: 1, methods: ['manual'], method: 'manual'}});
    ok(sel(), 'a varázslóban is'); ok(kq('[data-act="ncNext"]').disabled, 'kötelező');
    // szintlépés: a meglévő választás zárolt
    openSheet({auto: true, build: b({levels: lv('Rogue', 3), sub: {Rogue: 'Thief|PHB'}, ch: {'subrace:spell': ['Fire Bolt|PHB'], 'Rogue:1:skills': ['stealth', 'perception', 'arcana', 'acrobatics'], 'Rogue:1:expertise': ['stealth', 'arcana']}}), classes: [{name: 'Rogue', subclass: 'Thief', level: 3, hitDie: 8}], levelUp: {to: 4}});
    const plan = K.Sheet.levelUpPlan(lap(), rb, K.Sheet.levelUpBuild(lap(), 'Rogue'));
    ok(![...plan.choices, ...plan.spells].some(x => x.c.kind === 'spell' && x.missing), 'nem kér újat');
  });
  ktest('alosztály-választó a felületen: a címke látszik, több szabad mező, gonosz szöveg nem fut, a szintlépésben az új hely kötelező', () => {
    const rb = rbVarazs();
    rb.subclasses.push({n: 'Way of the Kensei', short: 'Kensei', cls: 'Monk', s: 'PHB'});
    rb.features = [...(rb.features || []), {n: 'Path of the Kensei', cls: 'Monk', sub: 'Kensei', ss: 'PHB', lvl: 3, s: 'PHB', tx: 'x'}];
    K.KApp.setRulebook({version: 'v', rb});
    const b = extra => ({base: {dex: 14}, levels: lv('Monk', 3), sub: {Monk: 'Way of the Kensei|PHB'}, spells: {}, ...extra});
    openSheet({auto: true, build: b(), classes: [{name: 'Monk', subclass: 'Kensei', level: 3, hitDie: 8}]});
    kclick('[data-tab="adat"]');
    const box = kq('[id="ch-Monk_3_pick"]'), mezok = () => kqa('input').filter(e => e.dataset.ch === 'Monk:3:pick');
    has(box.textContent, 'Kensei fegyverek');
    eq(mezok().length, 2); eq(mezok()[0].placeholder, 'Kensei fegyverek');
    kset(mezok()[0], '<img src=x onerror=window.__x7=1>');
    eq(K.eval('sheets.get("p1")').build.ch['Monk:3:pick'], ['<img src=x onerror=window.__x7=1>']);
    kclick('[data-tab="kep"]'); kclick('[data-tab="adat"]');
    ok(!kq('main img[src="x"]') && !K.__x7, 'nem fut');
    const s = K.eval('sheets.get("p1")'), Sh = K.Sheet;
    const uj = Sh.norm({...s, build: {...s.build, levels: lv('Monk', 5), ch: {'Monk:3:pick': ['Longbow', 'Glaive']}}, classes: [{name: 'Monk', subclass: 'Kensei', level: 5, hitDie: 8}]});
    const p = Sh.levelUpPlan(uj, rb, Sh.levelUpBuild(uj, 'Monk')), x = p.choices.find(y => y.c.key === 'Monk:3:pick');
    eq([x.uj, x.missing], [true, 1], '6. szinten eggyel több, kötelező');
  });
  ktest('i gomb: minden teendőnél felugró leírás (mit, ki tudja megcsinálni); a háttérre koppintva és a gombbal bezárul; gonosz szöveg nem fut', () => {
    const rb = rbVarazs();
    rb.races.push({n: 'Rossz', s: 'PHB', fx: [{todo: '<img src=x onerror=window.__x8=1>'}], traits: []});
    rb.backgrounds = [{n: 'Próba', s: 'PHB', fx: [{todo: 'Ellenállás választása'}]}];
    K.KApp.setRulebook({version: 'v', rb});
    openSheet({auto: true, build: {base: {dex: 14}, levels: lv('Rogue', 3), race: 'Rossz|PHB', subrace: 'Nincs|X', background: 'Próba|PHB', spells: {}}, classes: [{name: 'Rogue', level: 3, hitDie: 8}]});
    kclick('[data-tab="adat"]');
    const d = kq('details[data-key="todos"]'); d.open = true;
    const sorok = kqa('details[data-key="todos"] .list > *');
    ok(sorok.length > 2, 'vannak teendők');
    ok(sorok.every(x => x.querySelector('[data-act="info"]')), 'mindegyiknél van i gomb');
    const pop = kq('#infoPop');
    ok(pop.hidden, 'alapból zárva');
    const nyit = re => { const b = sorok.find(x => re.test(x.textContent)).querySelector('[data-act="info"]'); kclick(b); ok(!pop.hidden, 'nyitva: ' + re); return pop.textContent; };
    has(nyit(/skill/i), 'Megcsinálható az appban');
    kclick(pop); ok(pop.hidden, 'a háttérre koppintva bezárul');
    has(nyit(/Nincs/), 'csak a DM');
    kclick('[data-act="infoClose"]'); ok(pop.hidden, 'a gombbal is');
    const t = nyit(/Ellenállás/);
    has(t, 'homebrew'); has(t, 'Saját jártasságok');
    kclick('[data-act="infoClose"]');
    nyit(/onerror/);
    ok(!pop.querySelector('img') && !K.__x8, 'a szöveg nem fut');
    kclick('[data-act="infoClose"]');
    ok(kq('[data-act="todoDone"]'), 'a pipa megmaradt');
  });
  ktest('i gomb a szabad szöveges mezőknél: példa és formátum; Saját jártasságok mezők a számolt mellé kerülnek', () => {
    const rb = rbVarazs();
    K.KApp.setRulebook({version: 'v', rb});
    openSheet({auto: true, build: {base: {dex: 14}, levels: lv('Fighter', 1), spells: {}}, classes: [{name: 'Fighter', level: 1, hitDie: 10}]});
    kclick('[data-tab="adat"]');
    const pop = kq('#infoPop'), gombok = () => kqa('[data-act="info"]');
    for (const cim of ['Saját támadás', 'Saját erőforrás', 'Saját jártasságok']) {
      const b = gombok().find(x => x.dataset.info === cim); ok(b, 'van gomb: ' + cim);
      kclick(b); has(pop.textContent, 'Formátum'); has(pop.textContent, 'Példa'); ok(!pop.querySelector('.hol'), 'mezőnél nincs jelvény'); kclick('[data-act="infoClose"]');
    }
    kset('[data-ov="plus:languages"]', 'Aquan, Druidic');
    has(K.eval('sheets.get("p1")').profs.languages, 'Druidic');
    eq(kq('[data-ov="plus:languages"]').value, 'Aquan, Druidic');
    kset('[data-ov="plus:languages"]', '');
    hasNot(K.eval('sheets.get("p1")').profs.languages, 'Druidic');
    ok(kq('select[name="alignment"]'), 'az alignment itt is legördülő');
    const H = K.Sheet;
    eq(H.freeInfo({kind: 'pick', label: 'X', help: {mit: 'a', sablon: 'b', pelda: 'c'}}), {cim: 'X: mit írj ide?', mit: ['a'], sablon: 'b', pelda: 'c'});
    has(H.freeInfo({kind: 'tool'}).pelda, 'Tools');
    for (const [k, v] of Object.entries(H.MEZO_INFO)) ok(v.cim && v.mit[0] && v.sablon && v.pelda, 'hiányos: ' + k);
    // minden ✋ teendő-szövegre van leírás, a jellemző nevére illesztve
    for (const [szoveg, hol] of [['Mystic Arcanum: válassz', 'app'], ['X: Favored Enemy: válassz', 'homebrew'], ['X: known varázslat választása', 'app'], ['X: valami más', 'homebrew']]) eq(H.todoInfo({kind: 'manual', text: szoveg, key: 'k'}, null).hol, hol);
    eq(H.todoInfo({kind: 'missing', text: 'Faj: X', key: 'k'}, null).hol, 'vegyes');
    // a Saját jártasságok fegyvere a támadásnál is jártasságnak számít
    const fegyver = extra => { const rbf = rb3(); return H.calc(H.norm({auto: true, build: {base: {str: 16}, levels: lv('Wizard', 1), spells: {}}, ov: extra, inventory: [{name: 'Longsword', qty: 1, equipped: true}]}), rbf).attacks[0]; };
    const a0 = fegyver({}), a1 = fegyver({'plus:weapons': 'longsword'});
    ok(a0 && a1, 'van támadás'); ok(parseInt(a1.hit) > parseInt(a0.hit), 'jártasság: ' + a0.hit + ' → ' + a1.hit);
    // a valódi választás-fajták szövege: mennyi van hátra, milyen listából
    const c = {key: 'k', kind: 'skills', n: 2, ok: ['stealth'], from: ['stealth', 'animal-handling']};
    const i = H.todoInfo({kind: 'skills', text: 'T', key: 'k'}, {choices: [c]});
    eq(i.hol, 'app'); has(i.mit[0], 'még 1'); has(i.mit[0], 'Animal Handling');
  });
  ktest('varázslat-választó: szól, ha a helyek beteltek, és ha az alosztály még nincs kiválasztva', () => {
    const rb = rbVarazs();
    rb.subclasses.filter(x => x.cls === 'Warlock').forEach(x => { x.fx = [{spells: [{t: 'expanded', lvl: 1, sp: ['sleep']}]}]; });
    K.KApp.setRulebook({version: 'v', rb});
    openSheet({auto: true, build: {base: {cha: 16}, levels: lv('Warlock', 1), spells: {}}});
    kclick('[data-tab="adat"]');
    has(kq('#ch-Warlock_known').textContent, 'Előbb válaszd ki az alosztályt');
    hasNot(kq('#ch-Warlock_known').textContent, 'Minden hely foglalt');
  });
  ktest('átállítás előtt mentés készül; ha a mentés nem megy, a lap nem változik', async () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet({});
    kclick('[data-tab="adat"]');
    K.KDB.saveWithHist = async () => { const e = new Error('tilos'); e.code = 'permission-denied'; throw e; };
    K.alert = () => {};
    kclick('[data-act="toAuto"]'); await wait(20);
    ok(!K.eval('sheets.get("p1")').auto, 'nem állt át');
    K.KDB.saveWithHist = async (id, p, h, doc) => { klog.push(['hist', id, p, h, doc]); };
    kclick('[data-act="toAuto"]');
    await until(() => K.eval('sheets.get("p1")').auto, 2000, 'átállt');
    const doc = klog.find(l => l[0] === 'hist')[4];
    eq([doc.reason, doc.sheet.auto], ['manual', false]);
    ok(kq('[data-hist]'), 'a backup a motoros lapon is ott van');
  });
  ktest('varázslat-választó a Felépítésen: besorolás betöltéskor, választás, keresés, a tanult varázslat a Varázslat fülön, nem távolítható el; a teli hely tilt, a spellbook nem', () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet({auto: true, build: {base: {int: 16}, levels: lv('Wizard', 1)}, spells: [{name: 'Light', level: 0, prepared: true, ref: 'Light|PHB'}, {name: 'Shield', level: 1, prepared: true, note: 'jegyzet', ref: 'Shield|PHB'}, {name: 'Saját', level: 1, prepared: true}]});
    let s = K.eval('sheets.get("p1")');
    eq(s.build.spells, {Wizard: {cantrips: ['Light|PHB'], book: ['Shield|PHB']}}, 'besorolva');
    eq(s.spells.find(x => x.name === 'Shield').note, 'jegyzet');
    ok(klog.some(l => l[0] === 'update' && l[2].build?.spells), 'kiírva a felhőbe');
    kclick('[data-tab="adat"]');
    const box = kq('#ch-Wizard_book');
    ok(box.classList.contains('need'), 'még nyitott');
    has(box.textContent, '1 / 6');
    const chk = v => kqa('input[type=checkbox]').find(e => e.dataset.ch === 'Wizard:book' && e.value === v);
    ok(chk('Shield|PHB').checked);
    kset(chk('Sleep|PHB'), true);
    s = K.eval('sheets.get("p1")');
    eq(s.build.spells.Wizard.book, ['Shield|PHB', 'Sleep|PHB']);
    eq(s.spells.find(x => x.name === 'Sleep').book, true);
    const q = kq('[data-chq="Wizard:book"]'); q.value = 'gre'; q.dispatchEvent(new K.Event('input', {bubbles: true}));
    eq(kqa('#ch-Wizard_book label[data-chl]:not([hidden])').map(l => l.dataset.chl), ['grease']);
    ok(kqa('#ch-Wizard_book details').some(d => d.open), 'a találat szintje kinyílik');
    K.eval('delete chSearch["Wizard:book"]');
    // a cantrip-hely (3) a telitől tilt
    for (const v of ['Fire Bolt|PHB', 'Mage Hand|PHB']) kset(kqa('input[type=checkbox]').find(e => e.dataset.ch === 'Wizard:cantrips' && e.value === v), true);
    ok(kq('#ch-Wizard_cantrips').querySelector('label[data-chl] input:not(:checked)')?.disabled === true, 'a harmadik után a többi tiltott');
    kclick('[data-tab="var"]');
    has(ktext(), 'Sleep'); has(ktext(), 'Saját');
    const rows = kqa('details').filter(d => d.dataset.key?.startsWith('sp:'));
    eq(rows.filter(d => d.querySelector('[data-act="spellRm"]')).map(d => d.dataset.key), ['sp:Saját'], 'csak a sajátnál van eltávolítás');
    const n = klog.length;
    K.KApp.setSheets([{...sheetDoc(), id: 'p1', ...K.eval('sheets.get("p1")')}]);
    eq(klog.slice(n).filter(l => l[2].build), [], 'egyszer sorol be');
    // a jegyzetes varázslat levétele megerősítést kér; a szabálykönyvből jövő gonosz név csak szövegként jelenik meg
    kclick('[data-tab="adat"]');
    K.confirm = () => false;
    const shield = () => kqa('input[type=checkbox]').find(e => e.dataset.ch === 'Wizard:book' && e.value === 'Shield|PHB');
    kset(shield(), false);
    ok(shield().checked && K.eval('sheets.get("p1")').build.spells.Wizard.book.includes('Shield|PHB'), 'mégsem: marad');
    K.confirm = () => true;
    const rb2 = rbVarazs(); rb2.spells.push({n: '<img src=x onerror=window.__xss=1>', s: '<b>', l: 1, sc: 'evocation', cl: ['Wizard']});
    K.KApp.setRulebook({version: 'v2', rb: rb2});
    kclick('[data-tab="adat"]');
    ok(!kq('#ch-Wizard_book img') && !K.__xss, 'nincs befecskendezés');
    has(kq('#ch-Wizard_book').textContent, '<img src=x');
  });
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
  ktest('elrendezés: fent csak vékony HP-sáv és az AC a név mellett; HP-kezelés a Harc fül alján; AC-sor az Alapadatokon; jártasságok és jellemzők a Képességeken', () => {
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
    // a jártasságok a Képességek fülön, a passzív értékek alatt (a jellemzők előtt)
    const k3 = kqa('main h3').map(h => h.textContent), pi = k3.indexOf('Passzív értékek');
    eq(k3.slice(pi, pi + 2), ['Passzív értékek', 'Jártasságok, nyelvek']);
    has(ktext(), "thieves' tools");
    kclick('[data-tab="harc"]');
    hasNot(ktext(), 'Jártasságok', 'a Harc fülről átkerült');
    // az AC a fejlécben, a név mellett jobbra, a HP-sáv fölött (minden fülön)
    const ac = kq('.hero .chip.ac');
    ok(ac, 'van AC a fejlécben'); eq(ac.querySelector('b').textContent, '14');
    ok(ac.getBoundingClientRect().left > kq('.hero .name').getBoundingClientRect().right, 'a név mellett jobbra');
    ok(ac.compareDocumentPosition(kq('.hpline')) & K.Node.DOCUMENT_POSITION_FOLLOWING, 'a HP-sáv fölött');
    openSheet({hp: {max: 24, cur: 20, temp: 0}, conditions: ['Shield of Faith']});
    eq([kq('.hero .chip.ac b').textContent, kq('.hero .chip.ac').classList.contains('fx')], ['16', true], 'a hatással együtt, jelölve');
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
      // hosszú, szóköz nélküli név és faj, portréval: a fejléc (név, AC) se lógjon ki
      openSheet({name: 'Hosszúnevűkarakterszóközeknélkülkiírva', race: 'Nagyonhosszúsajátfajnévszóköznélkül', portrait: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', classes: [{name: 'Fighter', level: 3}, {name: 'Rogue', subclass: 'Thief', level: 2}]});
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
  ktest('Harc: a támadások sorrendje a ⠿ fogantyúval áthúzható (pointer események, telefonon is), és mentődik; csak szerkeszthető lapon', () => {
    const at = n => ({name: n, hit: '+5', dmg: '1d6+3 piercing', note: ''});
    openSheet({attacks: [at('Shortsword'), at('Shortbow'), at('Dagger')]});
    const fog = () => kqa('[data-drag="atk"]'), sorok = () => kqa('.li').filter(r => r.querySelector('[data-drag="atk"]'));
    eq(fog().length, 3, 'minden sorban fogantyú');
    const pe = (el, type, y) => el.dispatchEvent(new K.PointerEvent(type, {bubbles: true, cancelable: true, pointerId: 7, clientY: y}));
    const r = sorok().map(x => x.getBoundingClientRect());
    pe(fog()[0], 'pointerdown', r[0].top + 5);
    ok(sorok()[0].classList.contains('dragging'), 'húzás közben jelölve');
    pe(fog()[0], 'pointermove', r[2].bottom + 5);
    pe(fog()[0], 'pointerup', r[2].bottom + 5);
    eq(lastUpdate().attacks.map(x => x.name), ['Shortbow', 'Dagger', 'Shortsword'], 'az első a végére');
    eq(kqa('[data-drag="atk"]').length, 3, 'újrarajzolva');
    // ugyanoda elengedve nincs írás
    const n = klog.length;
    pe(fog()[1], 'pointerdown', 0); pe(fog()[1], 'pointerup', 0);
    eq(klog.length, n);
    // megszakított gesztus (pl. rendszer-gesztus telefonon): nem ment, a sorrend visszaáll
    const r2 = sorok().map(x => x.getBoundingClientRect());
    pe(fog()[0], 'pointerdown', r2[0].top + 5); pe(fog()[0], 'pointermove', r2[2].bottom + 5); pe(fog()[0], 'pointercancel', r2[2].bottom + 5);
    eq([klog.length, sorok().map(x => x.querySelector('b').textContent)], [n, ['Shortbow', 'Dagger', 'Shortsword']]);
    // jobb gombbal nem indul húzás
    fog()[0].dispatchEvent(new K.PointerEvent('pointerdown', {bubbles: true, cancelable: true, pointerId: 8, button: 2}));
    ok(!sorok()[0].classList.contains('dragging'));
    // a szabálymotor újraszámolása (és a kézi lap felszerelés-frissítése) megtartja a meglévők sorrendjét; az új a számolt helyén marad
    eq(K.Sheet.regiSorrend([{name: 'B'}, {name: 'a'}], [{name: 'A', auto: true}, {name: 'C'}, {name: 'b'}]).map(x => x.name), ['b', 'C', 'A']);
    // egy támadásnál nincs mit rendezni: nincs fogantyú
    openSheet({attacks: [at('Shortsword')]}); eq(fog().length, 0);
  });
  ktest('fülváltás vízszintes húzással (swipe): balra a következő, jobbra az előző fül; nem indul mezőben, a fogantyún, a képernyő szélén, két ujjal, függőleges vagy lassú húzásnál', () => {
    const at = n => ({name: n, hit: '+5', dmg: '1d6', note: ''});
    openSheet({attacks: [at('Shortsword'), at('Dagger')]});
    const fül = () => kq('nav.tabs .on').dataset.tab;
    const te = (el, type, x, y, ujjak = 1) => {
      const t = new K.Touch({identifier: 1, target: el, clientX: x, clientY: y});
      const lista = type === 'touchend' ? [] : Array(ujjak).fill(t);
      el.dispatchEvent(new K.TouchEvent(type, {bubbles: true, cancelable: true, touches: lista, targetTouches: lista, changedTouches: [t]}));
    };
    const huz = (el, x1, x2, dy = 0, ujjak = 1) => { if (typeof el === 'string') el = kq(el); ok(el, 'nincs ilyen elem'); te(el, 'touchstart', x1, 300, ujjak); te(el, 'touchmove', x2, 300 + dy, ujjak); te(el, 'touchend', x2, 300 + dy); };
    const w = K.innerWidth, J = w - 80, B = w - 230, E = w - 10;  // jobb oldali és bal oldali pont, és a képernyő széle (24 px-en belül)
    eq(fül(), 'harc');
    huz('.hero', J, B); eq(fül(), 'kep', 'balra: következő');
    huz('main h3', J, B); eq(fül(), 'var');
    huz('.hero', B, J); eq(fül(), 'kep', 'jobbra: előző');
    huz('.hero', B, J); huz('.hero', B, J); eq(fül(), 'harc', 'az elsőnél nem jár körbe');
    huz('.hero', J, J - 50); eq(fül(), 'harc', 'túl rövid');
    huz('.hero', J, J - 120, 80); eq(fül(), 'harc', 'inkább függőleges (görgetés)');
    huz('.hero', E, B); eq(fül(), 'harc', 'a képernyő széléről (rendszer-gesztus)');
    huz('.hero', J, B, 0, 2); eq(fül(), 'harc', 'két ujjal (nagyítás)');
    huz('[data-drag="atk"]', J, B); eq(fül(), 'harc', 'a ⠿ fogantyún');
    const ido = K.Date.now; let most = 1e12;
    K.Date.now = () => most;
    try { te(kq('.hero'), 'touchstart', J, 300); most += 2000; te(kq('.hero'), 'touchend', B, 300); eq(fül(), 'harc', 'lassú húzás'); }
    finally { K.Date.now = ido; }
    for (const k of ['kep', 'var', 'fel', 'adat', 'jegyz']) { huz('.hero', J, B); eq(fül(), k); }
    huz('.hero', J, B); eq(fül(), 'jegyz', 'az utolsónál nem jár körbe');
    // mezőben (pl. kijelölés, kurzormozgatás) nem vált; az Alapadatokba gépelt érték a húzással váltva is megmarad
    huz('.hero', B, J); eq(fül(), 'adat');
    const nev = kqa('main input').find(x => x.value === 'Minta Tolvaj');
    ok(nev, 'névmező');
    huz(nev, J, B); eq(fül(), 'adat', 'mezőben');
    nev.value = 'Átírt Név';
    huz('.hero', B, J); eq(fül(), 'fel');
    huz('.hero', J, B); eq(kqa('main input').some(x => x.value === 'Átírt Név'), true, 'a piszkozat megmaradt');
    // vízszintesen görgethető elemben (a fülsáv keskeny kijelzőn) nem vált
    K.frameElement.width = 320; K.render(true);  // keskeny kijelzőn a fülsáv görgethető
    const nav = kq('nav.tabs');
    ok(nav.scrollWidth > nav.clientWidth, 'a fülsáv 320 px-en görgethető');
    huz(nav, J, B); eq(fül(), 'adat', 'a fülsávon');
    // húzás után az új fül gombja a fülsáv látható részén van (előre és vissza is)
    const latszik = l => { const n = kq('nav.tabs').getBoundingClientRect(), g = kq('nav.tabs .on').getBoundingClientRect(); ok(g.left >= n.left - 1 && g.right <= n.right + 1, `${l}: a(z) ${fül()} gombja kilóg (${g.left}–${g.right} / ${n.left}–${n.right})`); };
    huz('.hero', J, B); latszik('előre');
    for (const k of ['adat', 'fel', 'var', 'kep', 'harc']) { huz('.hero', B, J); eq(fül(), k); latszik('vissza'); }
    for (let k = 0; k < 5; k++) { huz('.hero', J, B); latszik('előre ' + k); }
    // a fókuszban lévő mező elengedődik (így a change lefut, a beírt érték nem vész el)
    huz('.hero', B, J); eq(fül(), 'adat');
    huz('.hero', B, J); eq(fül(), 'fel');
    const mezo = kq('main input:not([type=checkbox])');
    ok(mezo, 'mező a Felszerelés fülön');
    // a blur() hívását nézzük, nem a blur eseményt: ha a tesztablaknak nincs fókusza (lefedettségmérés), a Chrome az eseményt nem küldi el
    let elengedve = false;
    const blur = mezo.blur.bind(mezo); mezo.blur = () => { elengedve = true; blur(); };
    mezo.focus(); eq(K.document.activeElement, mezo);
    huz('.hero', J, B); eq([fül(), elengedve], ['adat', true]);
    // a lap listáján (nincs fülsáv) nem csinál semmit
    K.location.hash = ''; K.route();
    huz('main', J, B); ok(!kq('nav.tabs'));
  });
  ktest('Varázslat fül: „csak a bekészítettek” szűrő (a cantrip mindig látszik), eszközönként megmarad; a szöveg „bekészítve”', async () => {
    K.KApp.setRulebook({version: 'v1', rb: await fakeRb()});
    const kulcs = K.Szerzodes.HELYI.csakBekeszitett;
    K.localStorage.removeItem(kulcs);
    openSheet({classes: [{name: 'Wizard', level: 5}], spells: [{name: 'Fire Bolt', level: 0}, {name: 'Shield', level: 1, prepared: true}, {name: 'Sleep', level: 1, prepared: false}, {name: 'Fireball', level: 3, prepared: false}]});
    kclick('[data-tab="var"]');
    has(ktext(), '1 bekészítve'); hasNot(ktext(), 'felkészít');
    has(ktext(), 'Sleep');
    kset('[data-act="csakBek"]', true);
    eq(K.localStorage.getItem(kulcs), '1', 'eszközönként tárolva');
    has(ktext(), 'Fire Bolt'); has(ktext(), 'Shield'); hasNot(ktext(), 'Sleep'); hasNot(ktext(), 'Fireball');
    has(ktext(), '2 elrejtve');
    openSheet({classes: [{name: 'Wizard', level: 5}], spells: [{name: 'Sleep', level: 1, prepared: false}]}); kclick('[data-tab="var"]');
    ok(kq('[data-act="csakBek"]').checked, 'másik lapon is be van kapcsolva');
    has(ktext(), 'Nincs bekészített varázslat.');
    kset('[data-act="csakBek"]', false);
    has(ktext(), 'Sleep'); eq(K.localStorage.getItem(kulcs), null);
  });
  // ---------- megjelenítés (betűméret, sötét / világos) ----------
  const megjTorol = () => {
    const d = K.document.documentElement; delete d.dataset.meret; delete d.dataset.tema;
    for (const k of ['betumeret', 'tema']) K.localStorage.removeItem(K.Szerzodes.HELYI[k]);
    K.document.querySelector('meta[name="theme-color"]').content = K.getComputedStyle(d).getPropertyValue('--bg').trim();
  };
  const megjInditoFut = () => K.eval(kq('#megjIndito').textContent);  // a <head> szkriptje: oldalbetöltéskor fut
  ktest('Megjelenítés: a betűtípus a tárolóból jön (latin + latin-ext, licenccel), külső betűtípus-kérés nincs, normál betűnél nem is töltődik; a nagy betűs szabályok mind :root[data-meret] alattiak', async () => {
    const lapSzoveg = [...K.document.querySelectorAll('style, script')].map(s => s.textContent).join('\n') + K.document.head.innerHTML;
    hasNot(lapSzoveg, 'fonts.googleapis', 'nincs Google Fonts'); hasNot(lapSzoveg, 'fonts.gstatic', 'nincs Google Fonts');
    const arcok = [...K.document.fonts].filter(f => f.family.replace(/"/g, '') === 'Atkinson Hyperlegible Next');
    eq(arcok.length, 2, 'két részhalmaz (latin, latin-ext)');
    ok(arcok.some(f => /U\+100-2BA/i.test(f.unicodeRange)), 'az ő (U+151) és az ű (U+171) a latin-ext tartományában');
    for (const f of ['atkinson-hyperlegible-next-latin.woff2', 'atkinson-hyperlegible-next-latin-ext.woff2', 'OFL.txt']) {
      const r = await fetch('../betutipus/' + f); ok(r.ok, f + ' megvan');
      if (f.endsWith('.woff2')) eq(new TextDecoder().decode((await r.arrayBuffer()).slice(0, 4)), 'wOF2', f + ' woff2 fájl');
    }
    // normál betűnél a böngésző nem tölti le (a betűtípust semmi nem használja). Ennek a tesztnek a nagy betűt bekapcsoló tesztek ELŐTT kell maradnia: egy betöltött betűtípus nem lesz újra „unloaded”
    megjTorol(); await wait(30);
    ok(arcok.every(f => f.status === 'unloaded'), 'normál betűnél nem töltődik le: ' + arcok.map(f => f.status));
    try {
      K.megjAllit('betumeret', 'nagy'); await K.document.fonts.ready; await wait(50);
      ok(K.getComputedStyle(K.document.body).fontFamily.startsWith('"Atkinson Hyperlegible Next"'), 'nagy betűnél ez a betű');
      const betoltott = await K.document.fonts.load('16px "Atkinson Hyperlegible Next"', 'Aőű');
      eq([betoltott.length, betoltott.every(f => f.status === 'loaded')], [2, true], 'mindkét részhalmaz betöltődik (az ő, ű a latin-extben)');
    } finally { megjTorol(); K.megjAllit('betumeret', ''); }
    // a nagy betűs blokk (a --meret szorzótól a <style> végéig) minden szabálya :root[data-meret] alatt van: normál betűnél egyik sem érvényes
    const css = kq('style').textContent.replace(/\/\*[\s\S]*?\*\//g, ''), blokk = css.slice(css.indexOf(':root[data-meret="nagy"]{--meret'));
    ok(blokk.length > 1000, 'megvan a blokk');
    const elotagNelkul = [...blokk.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(([, sel]) => sel.split(',').map(s => s.trim())).filter(s => !s.startsWith(':root[data-meret'));
    eq(elotagNelkul, []);
  });
  ktest('Fiók menü: a fejlécben a kilépés helyett 👤 Fiók; Megjelenítés (betűméret, mód) eszközönként, azonnal; Kilépés', () => {
    const {HELYI} = K.Szerzodes, d = K.document.documentElement, ki = [];
    megjTorol();
    try {
      openSheet();
      ok(!kq('#who [data-act="signOut"]'), 'a fejlécben nincs külön kilépés');
      kclick('#who [data-act="fiok"]');
      const pop = kq('#infoPop');
      ok(!pop.hidden, 'megnyílt'); has(pop.textContent, 'Betűméret'); has(pop.textContent, 'Mód'); has(pop.textContent, 'a@x.hu');
      const gomb = (k, v) => kq(`#infoPop [data-act="megj"][data-k="${k}"][data-v="${v}"]`);
      ok(gomb('betumeret', '').classList.contains('on') && gomb('tema', '').classList.contains('on'), 'alapból Normál és Sötét');
      kclick(gomb('betumeret', 'nagy'));
      eq([d.dataset.meret, K.localStorage.getItem(HELYI.betumeret)], ['nagy', 'nagy']);
      ok(!kq('#infoPop').hidden && gomb('betumeret', 'nagy').classList.contains('on') && gomb('betumeret', 'nagy').getAttribute('aria-pressed') === 'true', 'nyitva marad, jelölve');
      kclick(gomb('betumeret', 'extra')); eq(d.dataset.meret, 'extra');
      kclick(gomb('tema', 'vilagos'));
      eq([d.dataset.tema, K.localStorage.getItem(HELYI.tema)], ['vilagos', 'vilagos']);
      // újratöltéskor a <head> visszaállítja (a lap rajzolása előtt)
      delete d.dataset.meret; delete d.dataset.tema; megjInditoFut();
      eq([d.dataset.meret, d.dataset.tema], ['extra', 'vilagos'], 'újratöltés után is');
      // vissza az alapra: az attribútum és a kulcs is eltűnik
      kclick(gomb('betumeret', '')); kclick(gomb('tema', ''));
      eq([d.dataset.meret, d.dataset.tema, K.localStorage.getItem(HELYI.betumeret), K.localStorage.getItem(HELYI.tema)], [undefined, undefined, null, null]);
      // rossz érték se a gombról, se a tárolóból nem érvényes
      K.megjAllit('betumeret', 'oriasi'); K.megjAllit('x', 'nagy'); eq(d.dataset.meret, undefined);
      K.localStorage.setItem(HELYI.betumeret, '"><b>'); K.localStorage.setItem(HELYI.tema, 'piros'); megjInditoFut();
      eq([d.dataset.meret, d.dataset.tema], [undefined, undefined], 'a tárolt rossz érték nem kerül az oldalra');
      // Kilépés a menüből: bezárja az ablakot
      K.KAuth = {signOut: () => ki.push('ki')};
      kclick('#who [data-act="fiok"]'); kclick('#infoPop [data-act="signOut"]');
      eq(ki, ['ki']); ok(kq('#infoPop').hidden, 'bezárult');
      // a karakterlista oldalán (lap nélkül) is működik
      K.location.hash = ''; K.route();
      kclick('#who [data-act="fiok"]'); kclick(gomb('tema', 'vilagos')); eq(d.dataset.tema, 'vilagos');
      kclick('#infoPop [data-act="infoClose"]'); ok(kq('#infoPop').hidden);
    } finally { megjTorol(); delete K.KAuth; }
  });
  ktest('Megjelenítés: színt csak a :root kezdetű (téma-) szabályok adnak meg, a többi szabály változót használ – így minden téma mindent átszínez', () => {
    const css = [...K.document.querySelectorAll('style')].map(s => s.textContent).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    const szin = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|(^|[\s:,])(white|black)\b/i;
    // :root kezdetű szabály (téma) is csak változót adhat meg színnel: a téma így nem írhat felül egy-egy elemet
    const rossz = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, sel, body]) => body.split(';').filter(d => szin.test(d.slice(d.indexOf(':') + 1)) &&!(sel.trim().startsWith(':root') && /^\s*--[\w-]+\s*:/.test(d))).map(d => sel.trim() + ' { ' + d.trim() + ' }'));
    eq(rossz, []);
    // a szkript által írt inline stílusok (style="…", style='…', el.style.x =) is csak változót használnak
    const js = kqa('script').map(s => s.textContent).join('\n');
    eq([...js.matchAll(/style=(["'])(.*?)\1|\.style\.[\w-]+\s*=\s*([^;]+)/g)].map(m => m[2] ?? m[3]).filter(v => szin.test(v)), [], 'inline stílus beégetett színnel');
  });
  // a látható szövegek kontrasztja a mögöttük lévő háttéren (WCAG); az átlátszó hátteret a szülőkén keverjük ki
  const rgb = s => { const m = s.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0]; return [m[0], m[1], m[2], m[3] ?? 1]; };
  const fenyesseg = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const kever = (f, a) => [0, 1, 2].map(i => f[i] * f[3] + a[i] * (1 - f[3])).concat(1);
  const hatter = el => {
    const reteg = [];
    for (let e = el; e; e = e.parentElement) { const c = rgb(K.getComputedStyle(e).backgroundColor); if (c[3] > 0) { reteg.push(c); if (c[3] === 1) break; } }
    return reteg.reverse().reduce((alap, c) => kever(c, alap), [255, 255, 255, 1]);
  };
  const kontrasztHibak = (min, gyoker = 'body') => {
    const hibak = [];
    for (const el of K.document.querySelectorAll(gyoker + ' *')) {
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || !el.getClientRects().length || el.closest('[hidden]')) continue;
      let atl = false; for (let e = el; e; e = e.parentElement) if (+K.getComputedStyle(e).opacity < 1) atl = true;
      if (atl) continue;  // a letiltott (halványított) gomb szándékosan halvány
      // a HP-sáv felirata a kitöltésen (testvérelem, nem ős) és az üres részen is olvasható legyen
      const fill = el.closest('.bar')?.querySelector('.fill');
      for (const bg of [hatter(el), ...(fill ? [hatter(fill)] : [])]) {
        const fg = kever(rgb(K.getComputedStyle(el).color), bg);
        const [a, b] = [fenyesseg(fg), fenyesseg(bg)].sort((x, y) => y - x), k = (a + 0.05) / (b + 0.05);
        if (k < min) hibak.push(`${el.tagName.toLowerCase()}.${el.className} „${el.textContent.trim().slice(0, 20)}” ${k.toFixed(2)}`);
      }
    }
    return [...new Set(hibak)];
  };
  const mindenFul = async (fn) => {
    K.KApp.setRulebook({version: 'v1', rb: await fakeRb()});
    openSheet({hp: {max: 24, cur: 5, temp: 3}, conditions: ['Poisoned', 'Bless'], concentration: 'Bless', classes: [{name: 'Rogue', level: 3}, {name: 'Wizard', level: 1}],
      spellcasting: {ability: 'int', slots: [2, 0, 0, 0, 0, 0, 0, 0, 0], used: [1]}, spells: [{name: 'Fire Bolt', level: 0}, {name: 'Shield', level: 1, prepared: true}],
      resources: [{name: 'Ki', max: 3, used: 1, reset: 'short'}], notes: 'Jegyzet'});
    for (const t of ['harc', 'kep', 'var', 'fel', 'adat', 'jegyz']) { kclick(`[data-tab="${t}"]`); kqa('main details').forEach(d => d.open = true); fn(t); }
    K.rnd = () => 20; kclick('[data-tab="kep"]'); kclick(kq('main .rb')); fn('dobás (20)');
    K.rnd = () => 1; kclick(kq('main .rb')); fn('dobás (1)');
    K.toast('✓ Elmentve'); fn('üzenet'); K.toast('Info', true); fn('info-üzenet');
    kclick('#who [data-act="fiok"]'); fn('Fiók menü'); kclick('#infoPop [data-act="infoClose"]');
    K.location.hash = ''; K.route(); fn('karakterlista');
  };
  for (const meret of ['nagy', 'extra']) ktest(`${meret} betű, keskeny (320 px) telefon: semmi nem lóg ki (fejléc, minden fül, dobássáv, Fiók menü), a HP-sáv felirata elfér, a dobássáv nem takarja a lap alját`, async () => {
    const fr = document.getElementById('karakter'), w0 = fr.width;
    megjTorol(); K.megjAllit('betumeret', meret);
    fr.width = 320; await wait(50);
    try {
      const W = K.document.documentElement.clientWidth, hibak = [];
      const nez = hol => {
        hibak.push(...kqa('header *, main *, #rollbar *, #infoPop:not([hidden]) *').filter(e => e.getClientRects().length && !e.closest('nav.tabs') && (e.getBoundingClientRect().right > W + 1 || e.getBoundingClientRect().left < -1))
          .map(e => `${hol}: ${e.tagName.toLowerCase()}.${e.className} „${e.textContent.trim().slice(0, 15)}” ${Math.round(e.getBoundingClientRect().left)}–${Math.round(e.getBoundingClientRect().right)}/${W}`));
        // a tartalom a saját dobozából se lógjon ki (pl. egy hosszú felirat a keskeny értékdobozból)
        hibak.push(...kqa('header *, main *, #rollbar *, #infoPop:not([hidden]) *').filter(e => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && !e.closest('nav.tabs') && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName) && !['auto', 'scroll'].includes(K.getComputedStyle(e).overflowX))
          .map(e => `${hol}: kilóg a dobozából: ${e.tagName.toLowerCase()}.${e.className} „${e.textContent.trim().slice(0, 15)}” ${e.scrollWidth}/${e.clientWidth}`));
        for (const b of kqa('.bar')) { const s = b.querySelector('span'); if (s && s.getBoundingClientRect().height > b.clientHeight + 1) hibak.push(`${hol}: a HP-sáv felirata nem fér el (${Math.round(s.getBoundingClientRect().height)} > ${b.clientHeight})`); }
        if (K.document.documentElement.scrollWidth > W + 1) hibak.push(`${hol}: vízszintes görgetés (${K.document.documentElement.scrollWidth}/${W})`);
      };
      K.KApp.setRulebook({version: 'v1', rb: await fakeRb()});
      openSheet({name: 'Hosszúnevűkarakterszóközeknélkülkiírva', race: 'Nagyonhosszúsajátfajnévszóköznélkül', portrait: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        classes: [{name: 'Fighter', level: 3}, {name: 'Rogue', subclass: 'Thief', level: 2}, {name: 'Wizard', level: 1}], hp: {max: 24, cur: 5, temp: 3}, conditions: ['Poisoned', 'Bless'], concentration: 'Bless',
        spellcasting: {ability: 'int', slots: [4, 3, 0, 0, 0, 0, 0, 0, 0], used: [1]}, spells: [{name: 'Fire Bolt', level: 0}, {name: 'Shield', level: 1, prepared: true}],
        resources: [{name: 'Hosszú nevű erőforrás', max: 6, used: 1, reset: 'short'}], attacks: [{name: 'Nagyonhosszúfegyvernévszóköznélkül', hit: '+12', dmg: '2d10+12 slashing', note: 'finesse, light, thrown'}]});
      for (const t of ['harc', 'kep', 'var', 'fel', 'adat', 'jegyz']) { kclick(`[data-tab="${t}"]`); kqa('main details').forEach(d => d.open = true); nez(t); }
      kclick('[data-act="hdToggle"]'); nez('Hit Dice panel'); kclick('[data-act="hdToggle"]');
      kclick('[data-tab="kep"]'); kclick('[data-mode="adv"]'); kclick(kq('main .rb')); nez('dobás után');
      const rb = kq('#rollbar').getBoundingClientRect().height, pb = parseFloat(K.getComputedStyle(kq('main')).paddingBottom);
      ok(pb >= rb, `a lap alján elég hely a dobássávnak: ${pb} >= ${Math.round(rb)}`);
      kclick('#who [data-act="fiok"]'); nez('Fiók menü'); kclick('#infoPop [data-act="infoClose"]');
      K.location.hash = ''; K.route(); nez('karakterlista');
      eq([...new Set(hibak)].slice(0, 10), []);
    } finally { fr.width = w0; megjTorol(); K.megjAllit('betumeret', ''); }
  });
  // [betűméret, mód, a minimális kontraszt, a várt háttér]: a világos téma legalább 4,5:1, a nagy betűs (kontrasztos) készletek legalább 7:1
  for (const [meret, tema, min, hatterSzin] of [['', 'vilagos', 4.5, '#f4f1ea'], ['nagy', '', 7, '#050607'], ['nagy', 'vilagos', 7, '#fff'], ['extra', '', 7, '#050607']]) {
    ktest(`${meret || 'normál'} betű, ${tema || 'sötét'} mód: minden fülön, a dobássávban, az üzenetekben és a Fiók menüben a szöveg legalább ${min}:1 kontrasztú`, async () => {
      megjTorol(); K.megjAllit('betumeret', meret); K.megjAllit('tema', tema);
      try {
        const legkisebb = {nagy: 18, extra: 21}[meret] || 0, kicsik = [];
        const hibak = []; await mindenFul(hol => {
          hibak.push(...kontrasztHibak(min).map(h => hol + ': ' + h));
          // nagy betűnél egyetlen látható szöveg sem kisebb a legkisebb méretnél (a letiltott gombok sem)
          if (legkisebb) for (const el of K.document.querySelectorAll('body *'))
            if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && el.getClientRects().length && !el.closest('[hidden]') && parseFloat(K.getComputedStyle(el).fontSize) < legkisebb - 0.01)
              kicsik.push(`${hol}: ${el.tagName.toLowerCase()}.${el.className} „${el.textContent.trim().slice(0, 15)}” ${K.getComputedStyle(el).fontSize}`);
        });
        eq(hibak.slice(0, 8), []);
        eq([...new Set(kicsik)].slice(0, 8), [], 'túl kicsi szöveg');
        eq(kq('meta[name="theme-color"]').content, hatterSzin, 'a böngésző sávja a háttér színe');
      } finally { megjTorol(); K.megjAllit('betumeret', ''); K.megjAllit('tema', ''); }
    });
  }
  ktest('Megjelenítés: a <head> szkriptje a szerződés kulcsait és értékeit ismeri; a böngésző sávjának színe a háttéré', () => {
    const {HELYI, MEGJELENITES} = K.Szerzodes, src = kq('#megjIndito').textContent;
    has(src, `'${HELYI.betumeret}'`); has(src, `'${HELYI.tema}'`);
    for (const v of MEGJELENITES.betumeret.filter(Boolean)) has(src, `m === '${v}'`);
    for (const v of MEGJELENITES.tema.filter(Boolean)) has(src, `t === '${v}'`);
    eq([MEGJELENITES.betumeret[0], MEGJELENITES.tema[0]], ['', ''], 'az alapértelmezett a mostani nézet');
    // a localStorage elérhetetlen (privát mód): az oldal nem akad el, a mostani nézet marad
    const orig = Object.getOwnPropertyDescriptor(K, 'localStorage');
    megjTorol();
    try {
      Object.defineProperty(K, 'localStorage', {configurable: true, get() { throw new Error('tiltva'); }});
      megjInditoFut(); eq(K.document.documentElement.dataset.meret, undefined);
      K.megjAllit('betumeret', 'nagy'); eq(K.document.documentElement.dataset.meret, 'nagy', 'tároló nélkül is érvényes, amíg nyitva van');
    } finally { if (orig) Object.defineProperty(K, 'localStorage', orig); else delete K.localStorage; megjTorol(); }
    // régi (gyorsítótárazott) szerzodes.js, MEGJELENITES és új kulcsok nélkül: a gomb működik, csak nem tárol
    const sz = K.Szerzodes;
    try {
      K.Szerzodes = {HELYI: {}};
      K.megjAllit('betumeret', 'extra'); K.megjAllit('constructor', 'nagy');
      eq([K.document.documentElement.dataset.meret, K.localStorage.getItem(sz.HELYI.betumeret)], ['extra', null]);
    } finally { K.Szerzodes = sz; megjTorol(); }
    eq(kq('meta[name="theme-color"]').content, K.getComputedStyle(K.document.documentElement).getPropertyValue('--bg').trim());
  });
  ktest('Jellemzők: a régebben importált D&D Beyond sablon ({{scalevalue}}) a lap adataiból látszik, a tárolt szöveg nem változik', () => {
    openSheet({classes: [{name: 'Rogue', level: 5, hitDie: 8}], features: [{name: 'Sneak Attack', text: 'Extra {{scalevalue}} damage.', src: ''}]});
    kclick('[data-tab="kep"]');
    has(kq('main').textContent, 'Extra 3d6 damage.');
    hasNot(kq('main').textContent, '{{');
    eq(K.eval('sheets.get("p1")').features[0].text, 'Extra {{scalevalue}} damage.');
  });
  ktest('rejtett HP-jú játékos (2026-11-14): a telefon a HP-t nem írja a csapat felé látszó részbe, a többit igen; pontos HP-nál igen', () => {
    openSheet({hp: {max: 24, cur: 24, temp: 0}});
    K.KApp.setChars([{id: 'p1', kind: 'pc', owner: 'a@x.hu', visibility: 'party', name: 'Minta Tolvaj', ac: 14, hp: null, status: null}]); K.route();
    kclick('[data-tab="harc"]');
    kset('#hpIn', '5', 'input'); kclick('[data-act="hpDmg"]');
    eq(lastUpdate().hp.cur, 19, 'a lapra kiírta');
    const pub = klog.filter(l => l[0] === 'pub').at(-1)?.[2];
    ok(pub && !('hp' in pub), 'nincs HP a nyilvános írásban: ' + JSON.stringify(pub));
    eq([pub.name, pub.ac], ['Minta Tolvaj', 14]);
    eq(K.eval('chars')[0].hp, null, 'a helyi másolatban sem jelent meg');
  });
  ktest('HP: sebzés, gyógyítás, temp; mezőnként menti, a csapat felé is; 0 HP-n halálmentők', () => {
    openSheet({hp: {max: 24, cur: 24, temp: 0}});
    // a gombok előjele a DM Screen szokását követi: + = sebzés, − = gyógyítás
    eq([kq('[data-act="hpDmg"]').textContent, kq('[data-act="hpHeal"]').textContent], ['+ Sebzés', '− Gyógyítás']);
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
  ktest('dobáskérés: felugró ablak a saját lapon; Dobok = a kérés módjával dob, a válasz a kérés azonosítójával megy, a kérés törlődik; ✕; lejárt és a DM-nek nem ugrik fel', () => {
    const most = new Date().toISOString();
    openSheet({rollReq: {id: 'k1', kind: 'check:dex:stealth', label: 'Stealth', mode: 'adv', by: 'dm@x.hu', at: most}});
    ok(!kq('#keresPop').hidden, 'felugrik'); has(kq('#keresPop').textContent, 'Stealth +7'); has(kq('#keresPop').textContent, 'előnnyel');
    let n = 0; K.rnd = () => [15, 4][n++ % 2];
    kclick('[data-act="keresDob"]');
    const u = lastUpdate();
    eq([u.rolls[0].req, u.rolls[0].total, 'rollReq' in u], ['k1', '22', false], 'a DM kérését a telefon nem írja'); has(u.rolls[0].detail, 'előny');
    ok(kq('#keresPop').hidden, 'eltűnt'); eq(kq('#lastRoll b').textContent, '22');
    ok(kq('#rollbar [data-mode=""]').classList.contains('on'), 'a mód visszaállt normálra');
    openSheet({rollReq: {id: 'k2', kind: 'save:wis', label: 'x', mode: '', by: '', at: most}});
    ok(!kq('#keresPop').hidden); has(kq('#keresPop').textContent, 'Wisdom mentő');
    kclick('[data-act="keresElvet"]');
    eq([lastUpdate().rollSkip, 'rollReq' in lastUpdate()], ['k2', false]); ok(!('rolls' in lastUpdate()), 'nem dobott'); ok(kq('#keresPop').hidden, '✕ után eltűnt');
    openSheet({rollReq: {id: 'k5', kind: 'init', label: '', mode: '', by: '', at: most}, rollSkip: 'k5'});
    ok(kq('#keresPop').hidden, 'a kihagyott kérés másik eszközön sem ugrik fel');
    openSheet({rollReq: {id: 'k6', kind: 'init', label: '', mode: '', by: '', at: most}, rolls: [{at: most, label: 'Initiative', total: '12', req: 'k6'}]});
    ok(kq('#keresPop').hidden, 'a megválaszolt kérés sem');
    openSheet({rollReq: {id: 'k3', kind: 'init', label: '', mode: '', by: '', at: new Date(Date.now() - 11 * 60000).toISOString()}});
    ok(kq('#keresPop').hidden, 'lejárt');
    openSheet({owner: 'b@x.hu', rollReq: {id: 'k4', kind: 'init', label: '', mode: '', by: '', at: most}}, 'dm@x.hu', true);
    ok(kq('#keresPop').hidden, 'a DM-nek nem ugrik fel');
  });
  ktest('sebzésdobás: a sebzés típusa és a támadás fajtája (dt / dk) is felkerül a DM Screen flavour textjéhez; a d20-on nincs', () => {
    openSheet();
    K.rnd = () => 3;
    const dob = re => { kclick(kqa('[data-act="dmg"]').find(b => re.test(b.dataset.label))); const r = lastUpdate().rolls[0]; return [r.dt, r.dk]; };
    eq(dob(/Shortsword/), ['piercing', 'mw']);
    eq(dob(/Shortbow/), ['piercing', 'rw']);
    kclick('[data-tab="kep"]');
    kclick(kqa('.li').find(r => r.textContent.includes('Stealth')).querySelector('[data-act="d20"]'));
    ok(!('dt' in lastUpdate().rolls[0]) && !('dk' in lastUpdate().rolls[0]), 'd20-on nincs');
    eq(['You make a melee spell attack', 'Make a ranged spell attack', 'Each creature must make a Dexterity saving throw', 'A creature you touch regains'].map(t => K.eval('varazsFajta')(t)), ['ms', 'rs', 'sv', 'sp']);
    eq(K.eval('tamadasFx')(K.eval('sheets.get("p1")'), {name: 'Bite', dmg: '1d6+2 piercing', note: ''}), {dt: 'piercing', dk: 'nat'});
    // a közös döntés (Sheet.fegyverFajta): a Slam a telefonon is természetes, mint a DM Screenen
    eq(K.eval('tamadasFx')(K.eval('sheets.get("p1")'), {name: 'Slam', dmg: '1d8+3 bludgeoning', note: ''}), {dt: 'bludgeoning', dk: 'nat'});
  });
  ktest('varázslat sora (TERV-fejlesztesek-2026-11.md): a cantrip sebzése a szinthez igazodik, ×N darab, Agonizing Blast +CHA, spell attack gomb, mentő és DC', () => {
    const rb = rbVarazs(), sp = (n, l, tx, atk = false) => ({n, s: 'PHB', l, sc: 'evocation', cl: ['Warlock'], tx, atk});
    // szintetikus szövegek (nem a PHB-é), csak a felismert minták
    rb.spells.push(sp('Eldritch Blast', 0, 'Make a ranged spell attack. Hit: 1d10 force damage. More: two beams at 5th level, three beams at 11th level, and four beams at 17th level.', true),
      sp('Teszt Tűz', 0, 'Make a ranged spell attack. Hit: 1d10 fire damage. Grows when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).', true),
      sp('Teszt Láng', 0, 'The target must succeed on a Dexterity saving throw or take 1d8 radiant damage. Grows when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).'),
      sp('Teszt Bénítás', 2, 'The target must succeed on a Wisdom saving throw or be held.'), sp(XSS, 0, 'Make a melee spell attack. Hit: 1d6 cold damage. ' + XSS, true));
    K.KApp.setRulebook({version: 'v', rb});
    const lap = (level, cha = 16, features = [{name: 'Agonizing Blast', text: ''}]) => {
      openSheet({classes: [{name: 'Warlock', level}], abilities: {str: 10, dex: 10, con: 10, int: 10, wis: 10, cha}, features, spellcasting: {ability: '', slots: [], used: [], pact: {level: 1, max: 1, used: 0}},
        spells: ['Eldritch Blast', 'Teszt Tűz', 'Teszt Láng', XSS].map(name => ({name, level: 0})).concat({name: 'Teszt Bénítás', level: 2, prepared: true})});
      kclick('[data-tab="var"]');
    };
    const sor = n => kqa('details').find(d => d.dataset.key === 'sp:' + n).querySelector('summary');
    const r = n => { const e = sor(n); return {t: e.querySelector('.nm').textContent, dmg: e.querySelector('[data-act="dmg"]')?.dataset.expr, atk: e.querySelector('[data-act="d20"]')?.dataset.bonus}; };
    lap(4);  // PB 2, CHA +3: attack +5, DC 13
    eq([r('Eldritch Blast').dmg, r('Eldritch Blast').atk], ['1d10+3', '5']); has(r('Eldritch Blast').t, 'Agonizing Blast: +3');
    ok(!r('Eldritch Blast').t.includes('(×'), '4. szinten nincs darab');
    eq([r('Teszt Tűz').dmg, r('Teszt Tűz').atk], ['1d10', '5']);
    eq([r('Teszt Láng').dmg, r('Teszt Láng').atk], ['1d8', undefined]); has(r('Teszt Láng').t, 'DEX 13');
    eq([r('Teszt Bénítás').dmg, r('Teszt Bénítás').atk], [undefined, undefined]); has(r('Teszt Bénítás').t, 'WIS 13');
    ok(!r('Teszt Tűz').t.includes('Agonizing'), 'más varázslat nem kap bónuszt');
    // a spell attack gombja dob, és a DM Screenre is felkerül
    K.rnd = () => 3; kclick(sor('Eldritch Blast').querySelector('[data-act="d20"]'));
    eq([lastUpdate().rolls[0].label, lastUpdate().rolls[0].total], ['Eldritch Blast – spell attack', '8']);
    kclick(sor('Eldritch Blast').querySelector('[data-act="dmg"]'));
    eq([lastUpdate().rolls[0].total, lastUpdate().rolls[0].dt], ['6', 'force']);
    lap(5);  // PB 3: +6, DC 14; a cantrip erősödik, az Eldritch Blast két sugár
    has(r('Eldritch Blast').t, '(×2)'); eq([r('Eldritch Blast').dmg, r('Eldritch Blast').atk], ['1d10+3', '6']);
    eq([r('Teszt Tűz').dmg, r('Teszt Láng').dmg], ['2d10', '2d8']); has(r('Teszt Láng').t, 'DEX 14');
    lap(17);
    has(r('Eldritch Blast').t, '(×4)'); eq([r('Teszt Tűz').dmg, r('Teszt Láng').dmg], ['4d10', '4d8']);
    lap(4, 8); eq(r('Eldritch Blast').dmg, '1d10-1');
    lap(4, 16, []); eq(r('Eldritch Blast').dmg, '1d10'); ok(!r('Eldritch Blast').t.includes('Agonizing'), 'Invocation nélkül nincs bónusz');
    lap(4, 10); eq(r('Eldritch Blast').dmg, '1d10'); ok(!r('Eldritch Blast').t.includes('Agonizing'), '+0-nál nincs kiírva');
    ok(!K.__xss && !kq('main img'), 'gonosz név nem fut');
    // multiclass (Cleric 3 / Wizard 2, karakterszint 5, PB 3): a varázslat osztályának DC-je és attackje, a cantrip a teljes karakterszinten
    openSheet({auto: true, build: {base: {wis: 14, int: 16}, levels: [...lv('Cleric', 3), ...lv('Wizard', 2)], spells: {}}, classes: [{name: 'Cleric', level: 3}, {name: 'Wizard', level: 2}],
      spells: [{name: 'Teszt Tűz', level: 0, cls: 'Wizard'}, {name: 'Teszt Láng', level: 0, cls: 'Cleric'}]});
    kclick('[data-tab="var"]');
    eq([r('Teszt Tűz').dmg, r('Teszt Tűz').atk, r('Teszt Láng').dmg], ['2d10', '6', '2d8']); has(r('Teszt Láng').t, 'DEX 13');
  });
  ktest('skill leírása (TERV-fejlesztesek-2026-11.md, 2. lépés): a Képességek fülön és a skill-választóban a névre koppintva; a választóban onnan is választható; a dobógomb marad', () => {
    const pop = () => kq('#infoPop');
    openSheet();
    kclick('[data-tab="kep"]');
    const sor = kqa('.li').find(r => r.textContent.includes('Stealth'));
    const m = klog.length;
    kclick(sor.querySelector('[data-act="leiras"][data-lr="sk"]'));
    eq(klog.length, m, 'nem írt, nem dobott');
    ok(!pop().hidden); has(pop().textContent, 'Lopakodás'); has(pop().textContent, 'Dexterity (DEX)'); has(pop().textContent, 'bónusz ');
    ok(!pop().querySelector('[data-act="leirasValaszt"]'), 'itt nincs választó gomb');
    kclick(pop().querySelector('[data-act="infoClose"]')); ok(pop().hidden, 'bezárult');
    K.rnd = () => 3; kclick(sor.querySelector('[data-act="d20"]')); eq(lastUpdate().rolls[0].label, 'Stealth');
    // ismeretlen skill-kulcs: nem dob hibát, nincs leírás
    K.eval('leirasMutat')({dataset: {lr: 'sk', ref: '__proto__'}}); has(pop().textContent, 'Nincs leírás');
    // választó (szabálymotoros lap, Alapadatok): a skill neve a leírást nyitja, onnan választható
    K.KApp.setRulebook({version: 'v1', rb: rbArany()});
    openSheet({auto: true, build: {base: {dex: 15}, levels: lv('Rogue', 1)}, inventory: [], attacks: [], resources: [], features: []});
    kclick('[data-tab="adat"]');
    const gomb = kqa('[data-act="leiras"][data-lr="sk"]').find(e => e.dataset.chk === 'Rogue:1:skills' && e.dataset.ref === 'stealth');
    ok(gomb, 'a választóban a skill neve gomb'); const key = gomb.dataset.chk;
    kclick(gomb); has(pop().textContent, 'Lopakodás'); has(pop().textContent, '＋ Kiválasztom');
    kclick(pop().querySelector('[data-act="leirasValaszt"]'));
    ok(lastUpdate().build?.ch?.[key]?.includes('stealth'), 'a leírásból választott: ' + key);
  });
  ktest('varázslat sora 320 px-en, normál és nagy betűvel: a leveles, támadó, koncentrációs sor sem lóg ki, a név nem törik betűnként', async () => {
    const rb = rbVarazs();
    rb.spells.push({n: 'Teszt Villámcsapás Hosszú Névvel', s: 'PHB', l: 1, sc: 'evocation', cl: ['Warlock'], atk: true, k: true, tx: 'Make a ranged spell attack. Hit: 1d12 lightning damage.'});
    K.KApp.setRulebook({version: 'v', rb});
    const fr = document.getElementById('karakter'), w0 = fr.width;
    try {
      for (const meret of ['', 'nagy']) {
        megjTorol(); if (meret) K.megjAllit('betumeret', meret);
        openSheet({classes: [{name: 'Warlock', level: 3}], abilities: {str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16}, spellcasting: {ability: '', slots: [], used: [], pact: {level: 2, max: 2, used: 0}},
          spells: [{name: 'Teszt Villámcsapás Hosszú Névvel', level: 1, prepared: true}]});
        kclick('[data-tab="var"]'); fr.width = 320; await wait(50);
        const sum = kqa('details').find(d => d.dataset.key.startsWith('sp:Teszt Villám')).querySelector('summary');
        ok(sum.querySelector('[data-act="d20"]') && sum.querySelector('[data-act="dmg"]'), 'attack és sebzés gomb');
        ok(K.document.documentElement.scrollWidth <= K.document.documentElement.clientWidth + 1, `${meret || 'normál'}: nincs vízszintes görgetés (${K.document.documentElement.scrollWidth})`);
        ok(sum.querySelector('.nm').getBoundingClientRect().width >= 100, `${meret || 'normál'}: a név legalább 100 px széles`);
        fr.width = w0;
      }
    } finally { fr.width = w0; megjTorol(); }
  });
  ktest('a fegyver sebzésgombja: közelharci (wdmg:melee, a Rage és más melee-hatás ide jön) vagy távolra is használható (wdmg; a dobófegyver is)', () => {
    const at = (name, note = '') => ({name, hit: '+5', dmg: '1d6+3 piercing', note});
    openSheet({attacks: [at('Longsword'), at('Dagger', 'finesse, light'), at('Longbow', 'range 150/600'), at('Javelin', 'Thrown · range 30/120'), at('Hand Crossbows'), at('Elbow Strike')]});
    const kind = n => kqa('[data-act="dmg"]').find(b => b.dataset.label === n + ' – sebzés')?.dataset.kind;
    eq(['Longsword', 'Dagger', 'Longbow', 'Javelin', 'Hand Crossbows', 'Elbow Strike'].map(kind), ['wdmg:melee', 'wdmg:melee', 'wdmg', 'wdmg', 'wdmg', 'wdmg:melee']);
  });
  ktest('dobás a lapra is felkerül (rolls, legújabb elöl, legfeljebb 15) a DM Screen naplójához; idegen lapnál nem ír', () => {
    openSheet();
    kclick('[data-tab="kep"]');
    K.rnd = () => 15;
    const stealth = kqa('.li').find(r => r.textContent.includes('Stealth'));
    kclick(stealth.querySelector('[data-act="d20"]'));
    const u = lastUpdate();
    eq(Object.keys(u).sort(), ['rolls', 'updatedAt', 'updatedBy'], 'csak a dobások');
    eq([u.rolls.length, u.rolls[0].total, u.rolls[0].nat], [1, '22', 15]); has(u.rolls[0].label, 'Stealth'); ok(u.rolls[0].at, 'időponttal');
    kclick('[data-tab="harc"]');
    for (let i = 0; i < 16; i++) kclick(kqa('[data-act="dmg"]').find(b => b.dataset.expr === '1d6+3'));
    eq([lastUpdate().rolls.length, lastUpdate().rolls[0].total, lastUpdate().rolls[0].nat, lastUpdate().rolls.at(-1).total], [15, '18', 0, '18'], 'legfeljebb 15, a régi d20 kiesett');
    klog.length = 0;
    openSheet({owner: 'b@x.hu'}, 'a@x.hu');
    for (const b of kqa('[data-act="d20"]').slice(0, 1)) kclick(b);
    eq(klog.filter(l => l[0] === 'update').length, 0, 'más lapjára nem ír');
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
  ktest('varázslat a szabálykönyvből (osztálylista szűrő), leírás, bekészítés, saját varázslat', async () => {
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
  ktest('leírás választás előtt: a feat, a Fighting Style és a varázslat neve a leírást nyitja, onnan választható; egy helynél a másik pipa cserél; a keresőből is; gonosz szöveg nem fut', () => {
    K.__xss = 0;
    const rb = rb3(), pop = () => kq('#infoPop'), nev = (k, v) => kqa('[data-act="leiras"]').find(e => e.dataset.chk === k && e.dataset.ref === v);
    rb.feats.push({n: 'Grappler', s: 'PHB', pre: 'STR 13', tx: 'Fogás ' + XSS}, {n: XSS, s: 'PHB', pre: XQ, tx: XQ});
    rb.optfeatures[1].tx = 'Távolsági +2 ' + XSS;
    rb.spells.push({n: 'Fire Bolt', s: 'PHB', l: 0, sc: 'evocation', t: '1 action', r: '120 feet', c: 'V, S', d: 'Instantaneous', cl: ['Wizard'], tx: 'Tűzcsóva ' + XSS});
    K.KApp.setRulebook({version: 'v1', rb});
    openSheet({auto: true, build: {race: 'Human|PHB', subrace: 'Variant|PHB', base: {str: 15, dex: 14, con: 13}, levels: lv('Fighter', 4)}, inventory: [], attacks: [], resources: [], features: []});
    kclick('[data-tab="adat"]');
    ok(!kq('select[data-ch="subrace:feat"]') && kcb('subrace:feat', 'Alert|PHB'), 'a feat pipás lista, nem legördülő');
    has(kq('#ch-subrace_feat').textContent, 'A névre koppintva');
    // a névre koppintás nem pipál, csak a leírást nyitja
    const m = klog.length;
    kclick(nev('subrace:feat', 'Alert|PHB'));
    eq(klog.length, m, 'nem írt'); ok(!kcb('subrace:feat', 'Alert|PHB').checked, 'nem pipált');
    ok(!pop().hidden); has(pop().textContent, 'Éber.'); has(pop().textContent, '＋ Kiválasztom');
    kclick(pop().querySelector('[data-act="leirasValaszt"]'));
    ok(pop().hidden, 'bezárult'); eq(lastUpdate().build.ch['subrace:feat'], ['Alert|PHB']);
    kclick(nev('subrace:feat', 'Alert|PHB')); has(pop().textContent, 'Leveszem'); kclick(pop().querySelector('[data-act="infoClose"]')); ok(pop().hidden);
    // a feltétel és a gonosz szöveg; egy helynél a másik pipa lecseréli az előzőt
    kclick(nev('subrace:feat', 'Grappler|PHB')); has(pop().textContent, 'Feltétel: STR 13'); has(pop().textContent, 'Fogás <img');
    kclick(pop().querySelector('[data-act="leirasValaszt"]')); eq(lastUpdate().build.ch['subrace:feat'], ['Grappler|PHB'], 'csere');
    kclick(nev('subrace:feat', XSS + '|PHB')); has(pop().textContent, XQ);
    eq(K.document.querySelectorAll('[onmouseover], img[src="x"]').length, 0, 'a felugró ablakban sincs befecskendezés');
    kclick(pop().querySelector('[data-act="infoClose"]'));
    // az ASI-hely feat módja is lista; a máshol felvett feat szürke, a leírásban „Most nem választható”
    kset(kq('[data-ch="Fighter:4:asi"][data-asi="mode"]'), 'feat');
    ok(kcb('Fighter:4:asi', 'Grappler|PHB').disabled, 'máshol felvett');
    kclick(nev('Fighter:4:asi', 'Grappler|PHB')); has(pop().textContent, 'Most nem választható'); ok(!pop().querySelector('[data-act="leirasValaszt"]'));
    kclick(nev('Fighter:4:asi', 'Alert|PHB')); kclick(pop().querySelector('[data-act="leirasValaszt"]'));
    eq(lastUpdate().build.ch['Fighter:4:asi'], {feat: 'Alert|PHB'});
    // Fighting Style
    kclick(nev('Fighter:opt:Fighting Style', 'Archery|PHB')); has(pop().textContent, 'Távolsági +2'); kclick(pop().querySelector('[data-act="leirasValaszt"]'));
    eq(lastUpdate().build.ch['Fighter:opt:Fighting Style'], ['Archery|PHB']);
    // varázslat a Felépítés választójában (Wizard cantrip): szint, iskola, idő, távolság, komponens, időtartam, szöveg
    openSheet({auto: true, build: {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {int: 15}, levels: lv('Wizard', 1)}, inventory: [], attacks: [], resources: [], features: [], spells: []});
    kclick('[data-tab="adat"]');
    kclick(nev('Wizard:cantrips', 'Fire Bolt|PHB'));
    has(pop().textContent, 'Cantrip · evocation · 1 action · 120 feet · V, S · Instantaneous'); has(pop().textContent, 'Tűzcsóva');
    kclick(pop().querySelector('[data-act="leirasValaszt"]'));
    ok(lastUpdate().build.spells.Wizard.cantrips.includes('Fire Bolt|PHB'), 'kiválasztva');
    // a Varázslat fül keresője: a névre koppintva leírás, onnan „Hozzáadom a laphoz”
    openSheet({classes: [{name: 'Wizard', level: 1}], spells: []});
    kclick('[data-tab="var"]'); kset('#spellQ', 'fire', 'input');
    kclick(kq('#spellRes [data-act="leiras"]')); has(pop().textContent, 'Tűzcsóva'); has(pop().textContent, 'Hozzáadom a laphoz');
    kclick(pop().querySelector('[data-act="leirasValaszt"]')); eq(lastUpdate().spells.map(x => x.name), ['Fire Bolt']);
    // a feat keresője
    kclick('[data-tab="kep"]'); kset('#featQ', 'grap', 'input');
    kclick(kq('#featRes [data-act="leiras"]')); has(pop().textContent, 'Feltétel: STR 13');
    kclick(pop().querySelector('[data-act="leirasValaszt"]')); ok(lastUpdate().features.some(f => f.name === 'Grappler'), 'felvéve');
    kset('#featQ', 'grap', 'input'); kclick(kq('#featRes [data-act="leiras"]')); ok(!pop().querySelector('[data-act="leirasValaszt"]'), 'ami megvan, nem vehető fel újra');
    kclick(pop().querySelector('[data-act="infoClose"]'));
    eq(K.document.querySelectorAll('[onmouseover], img[src="x"]').length, 0); ok(!K.__xss, 'lefutott a kód');
    K.eval('for (const k in asiMode) delete asiMode[k]');   // az ASI-hely feat módja a következő tesztre ne maradjon meg
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
    kset(kcb('subrace:feat', 'Alert|PHB'), true); eq(lastUpdate().build.ch['subrace:feat'], ['Alert|PHB']);
    kset(kcb('Fighter:opt:Fighting Style', 'Archery|PHB'), true);
    kset(kq('[data-ch="Fighter:4:asi"][data-asi="a0"]'), 'dex'); has(ktext(), 'Még 1 pont');
    kset(kq('[data-ch="Fighter:4:asi"][data-asi="a1"]'), 'dex'); eq(lastUpdate().build.ch['Fighter:4:asi'], {dex: 2});
    kset(kq('select[data-ch="Fighter:sub"]'), 'Champion|PHB'); eq(lastUpdate().build.sub, {Fighter: 'Champion|PHB'});
    const s = K.eval('sheets.get("p1")');
    eq([s.abilities.str, s.abilities.dex, s.abilities.con, K.Sheet.initiative(s), s.ac], [16, 16, 14, 8, 13]);
    ok(!kq('.todobar'), 'nincs több teendő');
    // ASI → feat módra váltás
    kset(kq('[data-ch="Fighter:4:asi"][data-asi="mode"]'), 'feat'); ok(kq('[data-ch="Fighter:4:asi"][data-asi="feat"]'), 'feat-lista');
    ok(kcb('Fighter:4:asi', 'Alert|PHB').disabled, 'a már felvett feat nem választható újra');
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
  ktest('Átállítás gomb kézi lapon; ✋ teendő kipipálása; befecskendezett választás-érték nem fut le', async () => {
    K.KApp.setRulebook({version: 'v1', rb: rb3()});
    openSheet({race: 'Hill Dwarf', classes: [{name: 'Fighter', subclass: 'Champion', level: 3}], abilities: {str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8},
      saveProf: ['str', 'con'], skillProf: {athletics: 1}, hp: {max: 40, cur: 30, temp: 0}, ac: 18, speed: '25 ft.', attacks: [], resources: [], features: []});
    kclick('[data-tab="adat"]'); kclick('[data-act="toAuto"]');
    await until(() => K.eval('sheets.get("p1")').auto, 2000, 'átállt');
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
    ok(!klog.some(l => l[0] === 'update' && 'rolls' in l[2]), 'a cast nem dobás: a DM Screenre nem megy');
  });
  ktest('felszerelés a kézi lapon: a felszerelt fegyver támadás lesz a Harc fülön, a pajzs növeli az AC-t; levéve visszaáll', () => {
    K.KApp.setRulebook({version: 'v1', rb: rb3()});
    openSheet({classes: [{name: 'Fighter', level: 3}], abilities: {str: 16, dex: 14, con: 12}, ac: 13, acNote: 'leather armor',
      inventory: [{name: 'Leather Armor', qty: 1, equipped: true}, {name: 'Shield', qty: 1}, {name: 'Longsword', qty: 1}],
      attacks: [{name: 'Saját ütés', hit: '+1', dmg: '1d4'}, {name: 'Longsword', hit: '+9', dmg: 'régi'}]});
    kclick('[data-tab="fel"]');
    kset(kq('[data-act="equip"][data-i="2"]'), true);
    let u = lastUpdate();
    eq(u.attacks.map(a => [a.name, a.hit, a.dmg, !!a.auto]), [['Saját ütés', '+1', '1d4', false], ['Longsword', '+5', '1d8+3 slashing', true]], 'a régi Longsword helyén');
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
describe('Flavour text a sebzésdobásokhoz (leiras.js, TERV-flavour.md)', () => {
  const FOK = ['karc', 'rendes', 'sulyos', 'krit'], FAJTAK = ['mw', 'rw', 'ms', 'rs', 'sv', 'sp', 'nat', 'w', ''], TAMADAS = ['mw', 'rw', 'ms', 'rs', 'nat', 'w'];
  const FIZ = ['slashing', 'piercing', 'bludgeoning'], HELYORZO = /\{(ba|n|t|a)\}/;
  test('mondatbank: minden típus × fajta × súlyosság párosra kész, kitöltött mondat jön; típus nélkül csak támadásnál', () => {
    const L = A('LEIRAS'), hibak = [];
    for (const [k, p] of Object.entries(L)) for (const f of FOK) {
      if (!(p[f]?.length >= 3)) hibak.push(`${k}/${f}: kevés mondat`);
      for (const s of p[f] || []) if (/[{}]/.test(s.replace(/\{(ba|n|t|a)\}/g, '')) || !/[.!]$/.test(s)) hibak.push(`${k}/${f}: ${s}`);
    }
    for (const t of [...A('Sheet.DMG_TYPES'), '']) for (const k of FAJTAK) for (const f of FOK) for (let i = 0; i < 4; i++) {
      const s = W.sebzesLeiras({type: t, kind: k, fokozat: f});
      if (!t && !TAMADAS.includes(k)) { if (s !== '') hibak.push(`típus nélkül, ${k}: nem kellene leírás`); continue; }
      if (!s || /[{}]/.test(s) || s[0] !== s[0].toUpperCase() || !/[.!]$/.test(s)) hibak.push(`${t}/${k}/${f}: ${s}`);
    }
    eq(hibak, []);
    eq(Object.keys(L).filter(k => !k.includes(':') && !['varazs', 'terulet'].includes(k)).sort(), A('Sheet.DMG_TYPES').filter(t => !FIZ.includes(t)).sort(), 'minden energiatípusnak saját csoport');
  });
  test('mentős (területi) varázslatnál testrész nélküli mondat; ehhez energiánál fokozatonként legalább kettő van', () => {
    const L = A('LEIRAS');
    for (const t of A('Sheet.DMG_TYPES').filter(t => !FIZ.includes(t))) for (const f of FOK) ok(L[t][f].filter(s => !HELYORZO.test(s)).length >= 2, `${t}/${f}`);
    const tuz = new Set(L.fire.sulyos.filter(s => !HELYORZO.test(s)));
    for (let i = 0; i < 12; i++) ok(tuz.has(W.sebzesLeiras({type: 'fire', kind: 'sv', fokozat: 'sulyos'})), 'testrész nélkül');
    for (let i = 0; i < 6; i++) ok(L.terulet.rendes.includes(W.sebzesLeiras({type: 'piercing', kind: 'sv', fokozat: 'rendes'})), 'fizikai területi: általános');
  });
  test('testrészek: a súlyosság testrészeinek mind a négy alakja megvan', () => {
    const T = A('TESTRESZ'), H = A('HELY_FOKOZAT');
    eq(Object.keys(H).sort(), [...FOK].sort());
    for (const [f, lista] of Object.entries(H)) for (const r of lista) ok(T[r]?.length === 4 && T[r].every(x => /^az? \S+$/.test(x)), `${f}: ${r}`);
  });
  test('súlyosság a kockák lehetséges tartományához mérve; a krit külön', () => {
    eq([['2d6+3', 5], ['2d6+3', 9], ['2d6+3', 12], ['2d6+3', 15], ['7', 7], ['1d8-1', 0], ['1d6+1d4', 10], ['2d6', 'x']].map(([e, t]) => W.sebzesFokozat(e, t, false)),
      ['karc', 'rendes', 'sulyos', 'sulyos', 'rendes', 'karc', 'sulyos', 'rendes']);
    eq(W.sebzesFokozat('2d6+3', 5, true), 'krit');
  });
  test('a támadás fajtája a nevéből és a szövegéből', () => {
    eq([['Scimitar', 'Melee Weapon Attack: +4 to hit'], ['Longbow', 'Ranged Weapon Attack: +5 to hit'], ['Javelin', 'Melee or Ranged Weapon Attack: +4'],
      ['Shocking Grasp', 'Melee Spell Attack: +5'], ['Fire Bolt', 'Ranged Spell Attack: +5'], ['Fire Breath', 'DC 12 Dexterity saving throw, 3d6 fire damage'],
      ['Bite', 'Melee Weapon Attack: +4 to hit'], ['Claws', 'Melee Attack Roll: +6'], ['Spellcasting', 'The mage casts one spell'], ['Heal', 'regains 2d8 hit points']].map(([n, t]) => W.tamadasFajta(n, t)),
      ['mw', 'rw', 'mw', 'ms', 'rs', 'sv', 'nat', 'nat', 'sp', '']);
    // a telefonos lapból jövő sor (lapszinkron.js) és a magyar „vagy”
    eq([['Shortsword', 'Attack: +5 to hit. Hit: 1d6+3 piercing damage. finesse, light'], ['Shortbow', 'Attack: +5 to hit. Hit: 1d6+3 piercing damage. range 80/320'],
      ['Longbow', 'Attack: +7 to hit.'], ['Light Crossbow', 'Attack: +5 to hit.'], ['Dagger', 'Melee vagy Ranged Weapon Attack: +6 to hit'],
      ['Javelin', 'Attack: +5 to hit. Hit: 1d6+3 piercing damage. Thrown · range 30/120']].map(([n, t]) => W.tamadasFajta(n, t)),
      ['mw', 'rw', 'rw', 'rw', 'mw', 'mw']);
  });
  test('a telefonos lap és a DM Screen ugyanúgy dönti el a fegyveres támadás fajtáját (Sheet.fegyverFajta, egy helyen)', () => {
    // régen két külön lista volt: a telefonon a Slam, a Gore, a Tentacle és a Sting közelharci fegyver lett, a DM-en természetes; a „range” szóhatár nélkül
    const sorok = [['Slam', ''], ['Gore', ''], ['Tentacle', ''], ['Sting', ''], ['Bite', ''], ['Longsword', ''], ['Shortbow', 'range 80/320'], ['Light Crossbow', ''],
      ['Javelin', 'Thrown · range 30/120'], ['Sling', ''], ['Dart', 'finesse, thrown'], ['Arrangement', ''], ['Orange Blade', ''], ['Hand Crossbows', ''], ['Slingshot', ''], ['Elbow Strike', ''], ['Rainbow Blade', '']];
    const vart = ['nat', 'nat', 'nat', 'nat', 'nat', 'mw', 'rw', 'rw', 'mw', 'rw', 'mw', 'mw', 'mw', 'rw', 'rw', 'mw', 'mw'];
    eq(sorok.map(([n, m]) => W.Sheet.fegyverFajta(n, m)), vart);
    // a DM Screen a telefonos lapból jövő sorral („Attack: +5 to hit. … megjegyzés”, lapszinkron.js) ugyanezt mondja
    eq(sorok.map(([n, m]) => W.tamadasFajta(n, 'Attack: +5 to hit. Hit: 1d6+3 piercing damage. ' + m)), vart);
  });
  test('játékos és NPC a telefonos lapból: a sebzésdobása is leírást kap (a lap „1d8+3 slashing” sebzése „… slashing damage” lesz)', () => {
    const lap = {...W.Sheet.norm({name: 'Aranka', classes: [{name: 'Fighter', level: 3}], attacks: [
      {name: 'Longsword', hit: '+5', dmg: '1d8+3 slashing', note: ''}, {name: 'Longbow', hit: '+5', dmg: '1d8+3 piercing damage', note: 'range 150/600'},
      {name: 'Flame Blade', hit: '+5', dmg: '1d8+3 slashing + 1d6 fire', note: ''}]}), id: 'p1'};
    for (const kind of ['pc', 'npc']) {
      const c = W.sheetToCreature(lap, {kind});
      eq(c.actions.map(a => a.text), ['Attack: +5 to hit. Hit: 1d8+3 slashing damage.', 'Attack: +5 to hit. Hit: 1d8+3 piercing damage. range 150/600', 'Attack: +5 to hit. Hit: 1d8+3 slashing damage + 1d6 fire damage.']);
      A('S.enc.list = []'); add({...c, id: 'p1-' + kind});
      const kocka = (atk, e) => $$('.tile .atk').find(a => a.dataset.label === atk).querySelector(`.roll[data-roll="${e}"]`);
      click(kocka('Longsword', '1d8+3')); has(lastLog(), 'data-flv="slashing|mw|', kind);
      click(kocka('Longbow', '1d8+3')); has(lastLog(), 'data-flv="piercing|rw|', kind);
      click(kocka('Flame Blade', '1d6')); has(lastLog(), 'data-flv="fire|mw|', kind);
    }
  });
  test('ugyanaz a mondat nem jön kétszer egymás után; ismeretlen típus és fajta = nincs leírás', () => {
    stubRnd(1);
    const sorok = Array.from({length: 6}, () => W.sebzesLeiras({type: 'slashing', kind: 'mw', fokozat: 'rendes'}));
    for (let i = 1; i < sorok.length; i++) ok(sorok[i] !== sorok[i - 1], 'ismétlés: ' + sorok[i]);
    eq([W.sebzesLeiras({type: 'xyz', kind: 'abc', fokozat: 'rendes'}), W.sebzesLeiras({type: '', kind: 'sp', fokozat: 'krit'}), W.leirasHtml({type: '', kind: 'sv'})], ['', '', '']);
    ok(W.sebzesLeiras({type: 'FIRE', kind: 'zz', fokozat: 'karc'}).length > 10, 'nagybetűs típus is jó, ismeretlen fajtával is');
  });
  test('DM Screen: a csempe sebzésdobása alá leírás kerül (típus, fajta, súlyosság); 🔄 új mondat; kézi dobásnál és típus nélkül nincs', () => {
    add(mk());
    stubRnd(1);
    click($$('.tile .atk .roll[data-roll]').find(r => r.dataset.roll === '1d6+2'));
    has(lastLog(), 'Scimitar'); has(lastLog(), 'data-flv="slashing|mw|karc"');
    const szoveg = () => $('#log .le .flv').textContent;
    const elotte = szoveg(), sor = lastLog().slice(0, lastLog().indexOf('<div class="flv"')), db = A('logLines').length;
    click('#log .flvuj');
    ok(szoveg() !== elotte, 'új mondat'); has(lastLog(), sor, 'a dobássor nem változott'); eq(A('logLines').length, db, 'nem új sor');
    click($$('.tile .atk .roll[data-roll]').find(r => r.dataset.roll === '3d6'), {shiftKey: true});
    has(lastLog(), 'data-flv="fire|sv|karc"', 'mentőnél nincs krit: a duplázott kockák összege dönt');
    setVal('#diceInput', '2d6'); click('[data-act="rollCustom"]'); hasNot(lastLog(), 'flv', 'kézi dobás');
    W.rollDmg('1d6', 'Goblin', 'Gyógyítás', false, {type: '', kind: 'sp'}); hasNot(lastLog(), 'flv', 'típus nélküli varázslat');
    W.rollDmg('1d6', '', 'X', false, {type: 'fire', kind: 'rs'}); hasNot(lastLog(), 'flv', 'támadó nélkül');
  });
  test('a nem sebző kocka (hit points, időtartam) nem kap leírást egy támadásban sem; a fizikai sebzésű varázslat varázslatos mondatot kap', () => {
    add(mk('Vámpírdenevér', {actions: [{name: 'Bite', text: 'Melee Weapon Attack: +4 to hit. Hit: 1d6 piercing damage, and it regains 1d4 hit points. The target is stunned for 1d4 rounds.'}]}));
    const kocka = e => $$('.tile .atk .roll[data-roll]').find(r => r.dataset.roll === e);
    eq([kocka('1d6').dataset.type, kocka('1d4').dataset.type], ['piercing', '-']);
    click(kocka('1d6')); has(lastLog(), 'data-flv="piercing|nat|');
    click(kocka('1d4')); hasNot(lastLog(), 'flv');
    eq(W.atkInfo('Hit: 1d6 piercing damage, regains 1d4 hit points').dice.map(d => !!d.nem), [false, true]);
    for (let i = 0; i < 8; i++) ok(!/vessző|lövedék|penge/.test(W.sebzesLeiras({type: 'piercing', kind: 'rs', fokozat: 'rendes'})), 'Ice Knife: nem nyílvessző');
  });
  test('statblokk: a dobás a „… fire damage” típusát és a bekezdés támadásfajtáját kapja', () => {
    has(W.linkify('Hit: 7 (2d6) fire damage.'), 'data-type="fire"');
    has(W.linkify('Hit: 9 (2d6 + 2) Piercing damage plus 3 (1d6) poison damage.'), 'data-type="piercing"');
    has(W.linkify('Hit: 9 (2d6 + 2) Piercing damage plus 3 (1d6) poison damage.'), 'data-type="poison"');
    hasNot(W.linkify('regains 2d8 fire'), 'data-type="fire"', 'csak „… damage” után');
    has(W.linkify('and it regains 1d4 hit points'), 'data-type="-"'); has(W.linkify('stunned for 1d4 rounds'), 'data-type="-"');
    const [x] = add(mk());
    A(`selected = ${JSON.stringify(x.cid)}`); W.render();
    ok($('#detail .sb p[data-kind="mw"] .roll[data-type="slashing"]'), 'Scimitar'); ok($('#detail .sb p[data-kind="sv"] .roll[data-type="fire"]'), 'Fire Breath');
    stubRnd(6); click('#detail .sb p[data-kind="mw"] .roll[data-type="slashing"]');
    has(lastLog(), 'data-flv="slashing|mw|sulyos"');
  });
  test('telefonos sebzésdobás (dt / dk): a DM naplójában leírással; a krit a címkéből; a régi, jelölés nélküli dobás és a d20 nélküle', () => {
    const t = p => `2026-11-08T18:${String(p).padStart(2, '0')}:00.000Z`;
    const lap = {...W.Sheet.norm({name: 'Aranka', classes: [{name: 'Rogue', level: 3}], rolls: [
      {at: t(4), label: 'Shortsword – sebzés (krit)', total: '10', detail: '1d6+3: [3,4] +3', nat: 0, dt: 'piercing', dk: 'mw'},
      {at: t(3), label: 'Fire Bolt', total: '3', detail: '1d10: [3]', nat: 0, dt: 'fire', dk: 'rs'},
      {at: t(2), label: 'Shortbow – sebzés', total: '9', detail: '1d6+3: [6] +3', nat: 0, dt: 'piercing', dk: 'rw'},
      {at: t(1), label: 'Régi – sebzés', total: '5', detail: '1d6+3: [2] +3', nat: 0},
      {at: t(0), label: 'Perception', total: '14', detail: '[9] +5', nat: 9}]}), id: 'p1'};
    A(`onSheets(${JSON.stringify([lap])})`);
    const sorok = A('logLines').map(l => l.html);
    eq(sorok.map(s => (s.match(/data-flv="([^"]*)"/) || [])[1] || ''), ['piercing|mw|krit', 'fire|rs|karc', 'piercing|rw|sulyos', '', '']);
    has(sorok[0], '📱 Aranka');
    // a lap hatásai (Rage, Hunter's Mark) is a kifejezésbe kerülnek: 8 a 1d6+3+2+1d6 tartományban (7–17) karcolás, nem súlyos
    eq(A(`dobasKifejezes("1d6+3: [2] +3 +2 Rage +1d6 Hunter's Mark [1]")`), '1d6+3+2+1d6');
    eq(A(`dobasKifejezes("1d8+3: [5] +3")`), '1d8+3');
    A(`onSheets(${JSON.stringify([{...lap, rolls: [{at: t(9), label: 'Greataxe – sebzés', total: '8', detail: "1d6+3: [2] +3 +2 Rage +1d6 Hunter's Mark [1]", nat: 0, dt: 'slashing', dk: 'mw'}, ...lap.rolls]}])})`);
    has(lastLog(), 'data-flv="slashing|mw|karc"');
  });
  test('dobás a lapon: dt / dk tisztítva; Sheet.dmgType a szövegből', () => {
    const H = W.Sheet, at = '2026-11-08T18:00:00.000Z';
    eq(H.normRoll({at, label: 'x', dt: 'fire', dk: 'rs'}), {at, label: 'x', total: '', detail: '', nat: 0, dt: 'fire', dk: 'rs'});
    eq(H.normRoll({at, label: 'x', dt: XSS, dk: 'zz'}), {at, label: 'x', total: '', detail: '', nat: 0});
    eq(['1d8+3 slashing', 'takes 2d10 Fire damage', 'resistance to cold; 3d6 necrotic damage', 'regains 1d8 hit points', null].map(H.dmgType), ['slashing', 'fire', 'necrotic', '', '']);
  });
});

// ======================================================================
// kitalált, 5e.tools-alakú kezdő felszerelés (a szerkezet a valódi szerint, 2026-11-09)
const seGet = async p => {
  const d = await fake5eGet(p);
  if (p === 'items-base.json') d.baseitem.push(
    {name: 'Leather Armor', source: 'PHB', type: 'LA', ac: 11, armor: true, value: 1000},
    {name: 'Shield', source: 'PHB', type: 'S', ac: 2, armor: true, value: 1000},
    {name: 'Longbow', source: 'PHB', type: 'R', weaponCategory: 'martial', dmg1: '1d8', dmgType: 'P', weapon: true, value: 5000},
    {name: 'Battleaxe', source: 'PHB', type: 'M', weaponCategory: 'martial', dmg1: '1d8', dmgType: 'S', weapon: true, axe: true, value: 1000},
    {name: 'Dagger', source: 'PHB', type: 'M', weaponCategory: 'simple', property: ['F'], dmg1: '1d4', dmgType: 'P', weapon: true, value: 200},
    {name: 'Arrows (20)', source: 'PHB', type: 'A', value: 100}, {name: 'Arrow', source: 'PHB', type: 'A', value: 5});
  if (p === 'items.json') {
    d.item.push({name: 'Amulet', source: 'PHB', type: 'SCF', scfType: 'holy', rarity: 'none', value: 500}, {name: 'Pouch', source: 'PHB', type: 'G', value: 50},
      {name: 'Backpack', source: 'PHB', type: 'G', value: 200}, {name: 'Torch', source: 'PHB', type: 'G', value: 1});
    d.itemGroup.push({name: 'Holy Symbol', source: 'PHB', type: 'SCF', scfType: 'holy', items: ['Amulet|phb']});
  }
  if (p === 'class/class-fighter.json') d.class[0].startingEquipment = {additionalFromBackground: true,
    default: ['(a) {@item chain mail|phb} or (b) {@item leather armor|phb}, {@item longbow|phb}, and {@item arrows (20)|phb|20 arrows}',
      '(a) a {@filter martial weapon|items|type=martial weapon} and a {@item shield|phb} or (b) two {@filter martial weapons|items|type=martial weapon}', "{@item explorer's pack|phb}"],
    goldAlternative: '{@dice 5d4 × 10|5d4 × 10|Starting Gold}',
    defaultData: [{a: ['chain mail|phb'], b: ['leather armor|phb', 'longbow|phb', 'arrows (20)|phb']},
      {a: [{equipmentType: 'weaponMartial'}, 'shield|phb'], b: [{equipmentType: 'weaponMartial', quantity: 2}]}, {_: ["explorer's pack|phb"]}]};
  if (p === 'backgrounds.json') d.background[0].startingEquipment = [{_: [{item: 'holy symbol|phb', displayName: 'holy symbol (a gift)'}, {special: 'vestments'},
    {special: 'sticks of incense', quantity: 5}, {item: 'pouch|phb', containsValue: 1500}]}];
  return d;
};
describe('Kezdő felszerelés (TERV-kezdo-felszereles.md)', () => {
  const seRb = () => W.buildRulebook(seGet);
  const ujFighter = (eq, extra = {}) => W.Sheet.norm({auto: true, build: {base: {str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8}, levels: [{c: 'Fighter'}], background: 'Acolyte|PHB'},
    newChar: {step: 'sum', target: 1, eq}, ...extra});

  test('szabálykönyv v4: az osztály és a háttér kezdő felszerelése, a csomag tartalma, a tárgycsoport, a fókusz fajtája; a refek pontos névre', async () => {
    const rb = await seRb(), f = rb.classes.find(c => c.n === 'Fighter'), ac = rb.backgrounds.find(b => b.n === 'Acolyte');
    eq(W.Sheet.RB_FORMAT, 4);
    eq(f.se.gold, '5d4*10');
    eq(f.se.rows[0], {a: [{r: 'Chain Mail|PHB'}], b: [{r: 'Leather Armor|PHB'}, {r: 'Longbow|PHB'}, {r: 'Arrows (20)|PHB'}]});
    eq(f.se.rows[1].b, [{cat: 'weaponMartial', q: 2}]);
    has(f.se.tx[1], 'two martial weapons'); hasNot(f.se.tx.join(), '{@');
    eq(ac.se.rows[0]._, [{r: 'Holy Symbol|PHB', dn: 'holy symbol (a gift)'}, {sp: 'vestments'}, {sp: 'sticks of incense', q: 5}, {r: 'Pouch|PHB', cp: 1500}]);
    eq(rb.backgrounds.find(b => b.n === 'Variant Acolyte (Próba)').se.rows.length, 1, 'a _copy-s változat is megkapja');
    eq(rb.items.find(i => i.n === "Explorer's Pack").pk, [{r: 'Backpack|PHB'}, {r: 'Torch|PHB', q: 10}]);
    eq(rb.items.find(i => i.n === 'Holy Symbol').grp, ['Amulet|PHB']);
    eq(rb.items.find(i => i.n === 'Amulet').scf, 'holy');
    eq([A("seArany('{@dice 5d4|5d4|Starting Gold}')"), A("seArany('')"), A('seTetel({value: 500})'), A('seTetel(5)')], ['5d4', '', {cp: 500}, null]);
  });
  test('a választási sorok feloldva: kategória a szabálykönyvből, tárgycsoport választásként, hiány szövege', async () => {
    const rb = await seRb(), H = W.Sheet, {rows, gold, has: van} = H.seRows('Fighter', 'Acolyte|PHB', rb);
    eq([rows.map(r => r.key), gold, van], [['c0', 'c1', 'c2', 'h0'], '5d4*10', true]);
    eq(rows[1].opts.map(o => o.k), ['a', 'b']);
    eq(rows[1].opts[1].items[0], {kind: 'cat', cat: 'weaponMartial', label: 'bármely martial weapon', from: ['Battleaxe|PHB', 'Longbow|PHB', 'Longsword|PHB'], q: 2});
    eq(H.seCatItems('weaponSimple', rb), ['Dagger|PHB']);
    eq(H.seCatItems('focusSpellcastingHoly', rb), ['Amulet|PHB'], 'a csoport maga nem választható');
    const hs = rows[3].opts[0].items[0];
    eq([hs.kind, hs.from, hs.dn], ['cat', ['Amulet|PHB'], 'holy symbol (a gift)']);
    has(H.seHiany(rows, {}), 'Fighter');
    has(H.seHiany(rows, {pick: {c0: 'a', c1: 'b'}}), 'martial weapon');
    has(H.seHiany(rows, {pick: {c0: 'a', c1: 'b'}, cat: {'c1:b:0': ['Longsword|PHB', 'Kitalált|PHB']}}), 'martial weapon', 'listán kívüli tárgy nem jó');
    has(H.seHiany(rows, {pick: {c0: 'a', c1: 'b'}, cat: {'c1:b:0': ['Longsword|PHB', 'Battleaxe|PHB']}}), 'holy symbol');
    eq(H.seHiany(rows, {pick: {c0: 'a', c1: 'b'}, cat: {'c1:b:0': ['Longsword|PHB', 'Battleaxe|PHB'], 'h0:_:0': ['Amulet|PHB']}}), '');
    eq(H.seRows('Nincs ilyen', '', rb), {rows: [], gold: '', has: false});
  });
  test('Fighter (a) chain mail → AC 16; két martial weapon felszerelve; Explorer\'s Pack kibontva tárolóba; a háttér tárgyai és 15 gp', async () => {
    const rb = await seRb(), H = W.Sheet;
    const s = ujFighter({mode: 'pack', pick: {c0: 'a', c1: 'b'}, cat: {'c1:b:0': ['Longsword|PHB', 'Longsword|PHB'], 'h0:_:0': ['Amulet|PHB']}}, {currency: {gp: 2}});
    const e = H.seEredmeny(s, rb), inv = e.inventory, by = n => inv.filter(i => i.name === n);
    eq(by('Chain Mail').map(i => [i.qty, i.equipped, i.ref]), [[1, true, 'Chain Mail|PHB']]);
    eq(by('Longsword').map(i => [i.qty, i.equipped]), [[2, true]], 'az azonos fegyver összevonva');
    eq(by("Explorer's Pack").map(i => i.container), ['']);
    eq(inv.filter(i => i.container === "Explorer's Pack").map(i => [i.name, i.qty]), [['Backpack', 1], ['Torch', 10]]);
    eq(by('Amulet')[0].note, 'holy symbol (a gift)');
    eq([by('vestments')[0].ref, by('sticks of incense')[0].qty, by('Pouch').length], ['', 5, 1]);
    eq(e.currency.gp, 17, 'a meglévő 2 gp + 15 gp');
    const c = H.calc({...s, inventory: inv}, rb);
    eq(c.ac.v, 16);
    eq(c.attacks.filter(a => a.name === 'Longsword').length, 1);
  });
  test('Fighter (b) leather + longbow → AC 11 + DEX; „Arrows (20)” → 20 db Arrow; a már felvett páncél mellé nem kerül másik felszerelve', async () => {
    const rb = await seRb(), H = W.Sheet;
    const s = ujFighter({mode: 'pack', pick: {c0: 'b', c1: 'a'}, cat: {'c1:a:0': ['Battleaxe|PHB'], 'h0:_:0': ['Amulet|PHB']}});
    const inv = H.seEredmeny(s, rb).inventory, by = n => inv.find(i => i.name === n);
    eq([by('Leather Armor').equipped, by('Shield').equipped, by('Longbow').equipped, by('Battleaxe').equipped, by('Arrow').qty, by('Arrow').equipped], [true, true, true, true, 20, false]);
    eq(H.calc({...s, inventory: inv}, rb).ac.v, 11 + 2 + 2, 'leather 11 + DEX 2 + shield 2');
    const regi = [{name: 'Chain Mail', qty: 1, equipped: true, ref: 'Chain Mail|PHB'}];
    eq(H.seLeltar([{ref: 'Leather Armor|PHB', n: 'Leather Armor', q: 1}], rb, regi).map(i => i.equipped), [false]);
  });
  test('jártasság a ⚠ jelzéshez (ugyanaz, mint a támadásoknál); a csomag szöveges tétele is a csomagba kerül; vegyes sor fix része mindig jön', async () => {
    const rb = await seRb(), H = W.Sheet, cr = w => ({profs: {weapons: w}});
    eq([H.seJartas(cr('simple weapons'), 'Dagger|PHB', rb), H.seJartas(cr('simple weapons'), 'Longsword|PHB', rb), H.seJartas(cr('simple weapons, longswords'), 'Longsword|PHB', rb),
      H.seJartas(cr('martial weapons'), 'Longbow|PHB', rb), H.seJartas(cr(''), 'Shield|PHB', rb), H.seJartas(cr(''), 'Kitalált|PHB', rb)], [true, false, true, true, true, true]);
    const s = ujFighter({}), c = H.calc(s, rb);
    eq([H.seJartas(c, 'Battleaxe|PHB', rb), c.attacks.length], [true, 0], 'a Fighter martial weapons jártassága a calc-ból');
    const pk = rb.items.find(i => i.n === "Explorer's Pack");
    pk.pk.push({sp: 'little bag of sand', q: 2});
    eq(H.seLeltar([{ref: "Explorer's Pack|PHB", n: "Explorer's Pack", q: 1}], rb).filter(i => i.container).map(i => [i.name, i.qty, i.ref]),
      [['Backpack', 1, 'Backpack|PHB'], ['Torch', 10, 'Torch|PHB'], ['little bag of sand', 2, '']]);
    rb.classes[0].se.rows.push({_: [{r: 'Dagger|PHB'}], a: [{r: 'Shield|PHB'}], b: [{r: 'Arrows (20)|PHB'}]});
    const sor = H.seRows('Fighter', '', rb).rows.at(-1);
    eq(sor.opts.map(o => [o.k, o.items.map(t => t.n)]), [['a', ['Shield', 'Dagger']], ['b', ['Arrows (20)', 'Dagger']]]);
  });
  test('arany mód: ár, bolt (PHB, nem mágikus, nem csoport), dobás (Monk × 10 nélkül), kosár; a háttér felszerelése és pénze nem jár, a maradék pénzként', async () => {
    const rb = await seRb(), H = W.Sheet;
    eq([H.seAr({v: '15 gp'}), H.seAr({v: '5 sp'}), H.seAr({v: '2 cp'}), H.seAr({v: '1,000 gp'}), H.seAr({v: ''}), H.seAr(null)], [1500, 50, 2, 100000, 0, 0]);
    const bolt = H.seBolt(rb).map(H.refOf);
    ok(bolt.includes('Longsword|PHB') && bolt.includes("Explorer's Pack|PHB"), 'fegyver és csomag');
    ok(!bolt.some(r => /Holy Symbol|Copy Sword|XPHB/.test(r)), 'csoport, mágikus és 2024-es nincs');
    eq([H.seAranyDob('5d4*10', () => 2), H.seAranyDob('5d4', () => 4), H.seAranyDob('rossz', () => 4)], [100, 20, 0]);
    const s = ujFighter({mode: 'gold', gold: 50, cart: [{r: 'Longsword|PHB', q: 1}, {r: 'Dagger|PHB', q: 2}, {r: 'Kitalált|PHB', q: 3}], pick: {c0: 'a'}}, {currency: {gp: 1}});
    eq(H.seKosar(s.newChar.eq, rb).koltseg, 1900, 'az ismeretlen tétel kimarad');
    const e = H.seEredmeny(s, rb);
    eq(e.items.map(i => [i.name, i.qty, i.equipped]), [['Longsword', 1, true], ['Dagger', 2, true]]);
    eq(e.currency.gp, 1 + 31, 'a maradék 31 gp a meglévő mellé');
    ok(!e.items.some(i => /Chain Mail|Pouch|vestments/.test(i.name)), 'sem a csomag, sem a háttér felszerelése');
    eq(H.seEredmeny(ujFighter({mode: 'gold', gold: null}), rb).items, [], 'dobás nélkül semmi');
    eq(H.seEredmeny(ujFighter({mode: 'gold'}, {newChar: {target: 1, step: 'sum', equip: 'pack', eq: {mode: 'gold', pick: {c0: 'a', c1: 'b'}, cat: {'c1:b:0': ['Longsword|PHB', 'Longsword|PHB'], 'h0:_:0': ['Amulet|PHB']}}}}), rb).cp, 1500, 'a DM rögzített módja (csomag) számít');
  });
  test('nincs mód vagy arany mód: csomag nélkül semmi nem kerül a lapra; a newChar.eq tisztítása', async () => {
    const rb = await seRb(), H = W.Sheet;
    eq(H.seEredmeny(ujFighter({pick: {c0: 'a'}}), rb).items, []);
    const x = H.norm({newChar: {target: 1, equip: 'x', eq: {mode: 'zz', pick: {c0: 'a', c1: 'q', x: 'a', h3: 'b'}, cat: {'c1:b:0': ['A|B', 5, {}], 'rossz': ['x']}, gold: '120', cart: [{r: 'Dagger|PHB', q: 0}, {q: 2}, 'x']}}}).newChar;
    eq([x.equip, x.eq], ['any', {mode: '', pick: {c0: 'a', h3: 'b'}, cat: {'c1:b:0': ['A|B', '5', '']}, gold: 120, cart: [{r: 'Dagger|PHB', q: 1}]}]);
    eq(H.norm({newChar: {target: 1}}).newChar.eq, {mode: '', pick: {}, cat: {}, gold: null, cart: []});
    eq(H.norm(H.norm({newChar: {target: 1, equip: 'gold', eq: {mode: 'gold', gold: 70}}})).newChar.equip, 'gold');
    eq(H.seErmek(1234), {gp: 12, sp: 3, cp: 4});
  });
  // ---------- 🎁 szinthez illő felszerelés (NPC-ből lett játékos, DMG 38. o.) ----------
  const genRb = async () => {
    const rb = await seRb();
    rb.items.push({n: 'Próbapálca', s: 'DMG', rar: 'uncommon', mag: true, att: 'requires attunement by a wizard', tc: 'WD'},
      {n: 'Potion of Próba', s: 'DMG', rar: 'uncommon', mag: true, tc: 'P'}, {n: 'Törpeöv', s: 'DMG', rar: 'uncommon', mag: true, att: 'requires attunement by a dwarf', tc: ''});
    W.__rb = rb; return rb;
  };
  const npcbol = (type, inv = [], extra = {}) => { const c = W.normCreature({kind: 'pc', name: 'Volt NPC', type, fromNpc: true, inventory: inv, ...extra}); A('S.library').push(c); return c; };
  test('DMG 38. o. sávjai; a jelöltek a karakterhez illenek (saját fegyver +1-e, jártasság, attunement osztály / faj szerint, nincs potion), legfeljebb 3 attunement', async () => {
    await genRb();
    eq([A('dmg38(4)').std, A('dmg38(7)').std, A('dmg38(7)').gp, A('dmg38(12)').high, A('dmg38(20)').high.length, A('dmg38(20)').low], [[], ['uncommon'], 500, ['uncommon', 'uncommon', 'uncommon', 'rare'], 6, ['uncommon', 'uncommon']]);
    const f = npcbol('Human — Fighter 7', [{name: 'Longsword', qty: 1, equipped: true, ref: 'Longsword|PHB'}, {name: 'Chain Mail', qty: 1, equipped: true, ref: 'Chain Mail|PHB'}]);
    const nevek = (id, attSzabad = true) => { const j = A(`felszJeloltek('uncommon', felszKor('${id}', window.__rb), window.__rb, new Set(), ${attSzabad})`); return {own: j.own.map(x => x.n), other: j.other.map(x => x.n)}; };
    const fj = nevek(f.id);
    eq(fj.own, ['+1 Longsword'], 'a saját fegyver változata');
    ok(fj.other.includes('Bag of Holding') && fj.other.includes('Cloak of Protection'), 'általános tárgyak');
    ok(!fj.other.some(n => /Próbapálca|Potion|Törpeöv|\+1 Battleaxe/.test(n)), 'varázslónak szánt, potion, más fajnak szánt, nem saját fegyver kimarad: ' + fj.other);
    ok(!nevek(f.id, false).other.includes('Cloak of Protection'), 'attunement-hely nélkül az attunementes kimarad');
    const w = npcbol('Dwarf — Wizard 7');
    const wj = nevek(w.id);
    ok(wj.other.includes('Próbapálca') && wj.other.includes('Törpeöv'), 'varázslónak és törpének igen');
    eq(wj.own, [], 'saját fegyver nélkül nincs +1-es változat');
  });
  test('a terv: arany, tárgy, a kezdő felszerelésből ami megvan kimarad; újradobás, hozzáadás a könyvtári lényhez (a lapra a szinkron viszi)', async () => {
    const rb = await genRb();
    const f = npcbol('Human — Fighter 7', [{name: 'Longsword', qty: 1, equipped: true, ref: 'Longsword|PHB'}, {name: 'Chain Mail', qty: 1, equipped: true, ref: 'Chain Mail|PHB'}], {currency: {gp: 3}});
    stubRnd(1);
    const t = W.felszerelesTerv(f.id, rb, 'std');
    eq([t.L, t.fo, t.magia, t.gold, t.items.map(x => [x.rar, x.n])], [7, 'Fighter', 'std', 525, [['uncommon', '+1 Longsword']]]);
    eq(t.start.map(x => x.n), ['Battleaxe', 'Shield', "Explorer's Pack"], 'a chain mail megvan (páncél), a többi az (a) lehetőségből');
    stubRnd(2, 2, 1);
    const t2 = W.felszerelesUjra(t, 0, rb);
    ok(t2.items[0].n && t2.items[0].n !== '+1 Longsword' && t2.items[0].rar === 'uncommon', 'másik uncommon: ' + t2.items[0].n);
    eq(W.felszerelesAranyUjra(t, () => 10).gold, 750);
    eq(W.felszerelesTerv(f.id, rb, 'high').items.length, 2);
    eq(W.felszerelesTerv(npcbol('Human — Fighter 3').id, rb, 'high').items, [], '1–4. szinten nincs mágikus tárgy');
    const db = W.felszerelesHozzaad(t, rb), c = A(`S.library.find(x => x.id === '${f.id}')`);
    eq(db, 1 + 3 + 2, 'a +1 Longsword, a 3 kezdő tétel és a csomag tartalma (2)');
    const plus = c.inventory.find(i => i.name === '+1 Longsword');
    eq([plus.magic, plus.rarity, plus.equipped], [true, 'uncommon', false]); has(plus.note, 'Generálva: DMG 38. o., 7. szint, normál mágia');
    eq(c.inventory.filter(i => i.name === 'Chain Mail').length, 1, 'a páncél nem duplázódott');
    eq(c.inventory.find(i => i.name === 'Shield').equipped, true);
    eq(c.currency.gp, 3 + 525);
    has(W.felszerelesSzoveg(t, db), '525 gp');
  });
  test('a szint az osztályokból (nem a régi CR-ből); fegyver nélkül a jártas fegyverek +1-e; pontos alapnév; attunement-korlát a meglévőkkel; a meglévő csomag-tartalom és lőszer nem duplázódik; a lap leltára számít', async () => {
    const rb = await genRb();
    const f = npcbol('Human — Fighter 7', [], {cr: '1/2'});
    eq(A(`felszKor('${f.id}', window.__rb).L`), 7);
    const own = A(`felszJeloltek('uncommon', felszKor('${f.id}', window.__rb), window.__rb, new Set(), true)`).own.map(x => x.n);
    ok(own.includes('+1 Battleaxe') && own.includes('+1 Longsword') && !own.some(n => /Net/.test(n)), 'a jártas fegyverek változatai: ' + own);
    eq([A("felszVariansA({n: '+1 Studded Leather Armor'}, 'leather armor')"), A("felszVariansA({n: '+1 Leather Armor'}, 'leather armor')"),
      A("felszVariansA({n: 'Armor of Resistance (Leather Armor)'}, 'leather armor')"), A("felszVariansA({n: 'Longsword of Flame'}, 'longsword')")], [false, true, true, true]);
    const harom = npcbol('Human — Fighter 17', [{name: 'Cloak of Protection', magic: true, ref: 'Cloak of Protection|DMG', attuned: true},
      {name: 'Próbakesztyű', magic: true, ref: 'Próbakesztyű|DMG'}, {name: 'Absorbing Tattoo', magic: true, ref: 'Absorbing Tattoo|TCE'}]);
    stubRnd(2);
    const t = W.felszerelesTerv(harom.id, rb, 'high');
    ok(t.items.length === 6 && t.items.every(x => !x.att), 'három attunementes van (hangolva vagy sem): több nem jön');
    const p = npcbol('Human — Fighter 7', [{name: 'Backpack', qty: 1}, {name: 'Torch', qty: 5}, {name: 'Arrow', qty: 10}, {name: 'Leather Armor', qty: 1, ref: 'Leather Armor|PHB'}]);
    stubRnd(2);
    const s = W.felszerelesTerv(p.id, rb, 'std').start.map(x => x.n);
    ok(!s.includes("Explorer's Pack") && !s.includes('Arrows (20)'), 'a csomag és a nyíl már megvan: ' + s);
    ok(s.includes('Longbow'), 'a nem viselt páncél mellé jár a (b) lehetőség többi része: ' + s);
    A(`SHEETS['${p.id}'] = Sheet.norm({classes: [{name: 'Fighter', level: 9}], inventory: [{name: 'Dagger', qty: 1}]})`);
    eq([A(`felszKor('${p.id}', window.__rb).L`), A(`felszKor('${p.id}', window.__rb).inv`).map(i => i.name)], [9, ['Dagger']], 'a lap szintje és leltára');
  });
  test('🎁 gomb csak NPC-ből lett játékosnál; az ablak: kihagyás, mágiaszint, hozzáadás; a mágiaszint-beállítás és a fromNpc tisztítása', async () => {
    await genRb();
    A('rulebook = {version: "v", counts: {}, rb: window.__rb}');
    const f = npcbol('Human — Fighter 7', [{name: 'Longsword', qty: 1, ref: 'Longsword|PHB'}]);
    A('S.library').push(W.normCreature({kind: 'pc', name: 'Varázslós', type: 'Human — Fighter 7'}));
    W.openLib('lib');
    ok($(`[data-lib="${f.id}"] [data-act="libFelsz"]`), '🎁 a volt NPC-nél');
    eq($$('[data-act="libFelsz"]').length, 1, 'a varázslóval / máshogy készült játékosnál nincs');
    setVal('select[data-setting="magic"]', 'high'); eq(A('S.settings.magic'), 'high');
    stubRnd(1);
    click(`[data-lib="${f.id}"] [data-act="libFelsz"]`);
    await until(() => $('#felszMagia'), 2000, 'az ablak');
    eq($('#felszMagia').value, 'high', 'a kampány beállítása az alap');
    eq($$('[data-act="felszUjra"]').length, 2, 'magas mágia: 2 uncommon');
    setVal('#felszMagia', 'low'); eq($$('[data-act="felszUjra"]').length, 0, 'alacsony mágia 7. szinten: nincs tárgy');
    setVal('#felszMagia', 'std'); eq($$('[data-act="felszUjra"]').length, 1);
    eq(A('S.settings.magic'), 'high', 'az ablakbeli átírás csak erre a karakterre szól');
    const n = $$('[data-act="felszStartKi"]').length;
    click('[data-act="felszStartKi"][data-i="0"]'); eq($$('[data-act="felszStartKi"]').length, n - 1);
    click('[data-act="felszKi"][data-i="0"]'); eq($$('[data-act="felszUjra"]').length, 0);
    click('[data-act="felszMent"]');
    ok(!$('#felszMagia'), 'bezárult'); has(lastLog(), '🎁'); has(lastLog(), 'Volt NPC');
    ok(!A(`S.library.find(x => x.id === '${f.id}')`).inventory.some(i => i.magic), 'a kihagyott tárgy nem került fel');
    // második generálásnál figyelmeztet; a Mégse nem ír semmit
    W.openLib('lib');
    click(`[data-lib="${f.id}"] [data-act="libFelsz"]`);
    await until(() => $('#felszMagia'), 2000, 'az ablak újra');
    hasNot($('#modalBox').textContent, 'már generáltál', 'tárgy nélkül még nem');
    click('[data-act="felszMent"]');
    W.openLib('lib');
    click(`[data-lib="${f.id}"] [data-act="libFelsz"]`);
    await until(() => $('#felszMagia'), 2000, 'az ablak harmadszor');
    has($('#modalBox').textContent, 'már generáltál');
    const gp = A(`S.library.find(x => x.id === '${f.id}')`).currency.gp;
    click('[data-act="felszMegse"]'); ok(!$('#felszMagia'), 'bezárult');
    eq(A(`S.library.find(x => x.id === '${f.id}')`).currency.gp, gp, 'a Mégse nem ad pénzt'); eq(A('felszAblak'), null);
    const Sz = W.Szerzodes;
    eq([Sz.sanitizeState({settings: {magic: 'x'}}).settings.magic, Sz.sanitizeState({settings: {magic: 'low'}}).settings.magic, Sz.sanitizeState({}).settings.magic], ['std', 'low', 'std']);
    eq([W.normCreature({kind: 'npc', fromNpc: true}).fromNpc, W.normCreature({kind: 'monster', fromNpc: true}).fromNpc, W.normCreature({kind: 'pc', fromNpc: 'igen'}).fromNpc], [true, undefined, undefined]);
  });
  test('NPC → Játékos a szerkesztőben: fromNpc, a statblock felszerelése tárgyként (felszerelve, ami nem azonosítható, a naplóba), kérdés (tárgyakkal / nélkülük), az ablak; újra NPC: minden marad', async () => {
    await genRb();
    A('rulebook = {version: "v", counts: {}, rb: window.__rb}');
    const npc = W.normCreature({kind: 'npc', name: 'Őrkapitány', type: 'Human — Fighter 5', cr: '3', acNote: 'chain mail, shield', actions: [
      {name: 'Longsword', text: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage.'},
      {name: 'Heavy Crossbow', text: 'Ranged Weapon Attack: +3 to hit, range 100/400 ft., one target. Hit: 6 (1d10 + 1) piercing damage.'}]});
    A('S.library').push(npc);
    let kerdes = ''; W.confirm = m => { kerdes = m; return true; };
    W.openLib('lib'); click(`[data-lib="${npc.id}"] [data-act="libEdit"]`); setVal($('#edForm').elements.kind, 'pc'); click('[data-act="edSave"]');
    await until(() => $('#felszMagia'), 2000, 'a generátor ablaka');
    const c = () => A(`S.library.find(x => x.id === '${npc.id}')`);
    eq([c().kind, c().fromNpc], ['pc', true]);
    eq(c().inventory.map(i => [i.name, i.equipped, i.ref]), [['Longsword', true, 'Longsword|PHB'], ['Chain Mail', true, 'Chain Mail|PHB'], ['Shield', true, 'Shield|PHB']]);
    has(allLog(), 'nem azonosítható, kimaradt: Heavy Crossbow');
    has(kerdes, 'Már van 3 tárgya (Longsword, Chain Mail, Shield)'); has(kerdes, 'Generáljak még');
    has($('#modalBox').textContent, 'NPC-ből játékos lett');
    click('[data-act="felszMegse"]');
    // újra NPC: a tárgyak és a jelölés maradnak; vissza Játékosra: nincs dupla statblock-tárgy, a kérdés megint jön, Nem → nincs ablak
    W.openLib('lib'); click(`[data-lib="${npc.id}"] [data-act="libEdit"]`); setVal($('#edForm').elements.kind, 'npc'); click('[data-act="edSave"]'); await wait(50);
    eq([c().kind, c().fromNpc, c().inventory.length], ['npc', true, 3]);
    W.confirm = m => { kerdes = m; return false; };
    W.openLib('lib'); click(`[data-lib="${npc.id}"] [data-act="libEdit"]`); setVal($('#edForm').elements.kind, 'pc'); click('[data-act="edSave"]');
    await until(() => kerdes.includes('Generáljak') && $('#libRows'), 2000, 'kérdés, utána a Könyvtár');
    eq(c().inventory.length, 3, 'nem duplázódott'); ok(!$('#felszMagia'), 'Nem → nincs ablak');
    // tárgy nélküli NPC: a kérdés a „Generáljak” változat
    const ures = W.normCreature({kind: 'npc', name: 'Remete', type: 'Human — Wizard 3'}); A('S.library').push(ures);
    kerdes = '';
    W.openLib('lib'); click(`[data-lib="${ures.id}"] [data-act="libEdit"]`); setVal($('#edForm').elements.kind, 'pc'); click('[data-act="edSave"]');
    await until(() => kerdes, 2000, 'kérdés');
    hasNot(kerdes, 'Már van'); has(kerdes, 'Generáljak szinthez illő felszerelést');
    // az NPC-vé tett, majd visszaállított eredeti játékos (van gazdája) nem „NPC-ből lett”: nincs kérdés, nincs jelölés
    const regi = W.normCreature({kind: 'npc', name: 'Régi játékos', type: 'Human — Rogue 4', owner: 'regi@x.hu', acNote: 'leather armor'}); A('S.library').push(regi);
    kerdes = '';
    W.openLib('lib'); click(`[data-lib="${regi.id}"] [data-act="libEdit"]`); setVal($('#edForm').elements.kind, 'pc'); click('[data-act="edSave"]'); await wait(100);
    const r = A(`S.library.find(x => x.id === '${regi.id}')`);
    eq([r.kind, r.fromNpc, r.inventory.length, kerdes], ['pc', undefined, 0, '']);
    // osztály nélküli NPC (statblock típussal): a generátor osztály nélkül, és szól
    const bandita = W.normCreature({kind: 'npc', name: 'Banditavezér', type: 'humanoid (any race)', cr: '2'}); A('S.library').push(bandita);
    W.confirm = () => true;
    W.openLib('lib'); click(`[data-lib="${bandita.id}"] [data-act="libEdit"]`); setVal($('#edForm').elements.kind, 'pc'); click('[data-act="edSave"]');
    await until(() => $('#felszMagia'), 2000, 'az ablak osztály nélkül');
    has($('#modalBox').textContent, 'Osztály nélkül nincs kezdő felszerelés'); has($('#modalBox').textContent, '2. szint');
    click('[data-act="felszMegse"]');
    // szabálykönyv nélkül: a napló szól, nincs ablak, a Könyvtár nyílik
    A('rulebook = null'); W.buildRulebook = async () => ({classes: []});
    const nincs = W.normCreature({kind: 'npc', name: 'Könyvtelen', type: 'Human — Fighter 5', acNote: 'chain mail'}); A('S.library').push(nincs);
    W.openLib('lib'); click(`[data-lib="${nincs.id}"] [data-act="libEdit"]`); setVal($('#edForm').elements.kind, 'pc'); click('[data-act="edSave"]');
    await until(() => allLog().includes('Könyvtelen') && $('#libRows'), 2000, 'napló és Könyvtár');
    has(allLog(), 'a szabálykönyv kell'); ok(!$('#felszMagia'));
    eq(A(`S.library.find(x => x.id === '${nincs.id}')`).inventory, [], 'a statblock tárgyai sem kerültek fel');
  });
  test('online robot: minden osztály × minden PHB-háttér, mindegyik lehetőséggel csomag módban (kitölthető, a lapra kerül, a számolás nem akad el), és az arany mód dobása', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet, hibak = [];
    const base = {str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8};
    for (const c of rb.classes) for (const [bi, b] of rb.backgrounds.entries()) {
      const {rows, gold} = H.seRows(c.n, b.n + '|' + b.s, rb), eq = {mode: 'pack', pick: {}, cat: {}};
      for (const row of rows) {
        const opt = row.opts[bi % row.opts.length];
        eq.pick[row.key] = opt.k;
        opt.items.forEach((t, j) => { if (t.kind === 'cat') eq.cat[`${row.key}:${opt.k}:${j}`] = Array.from({length: t.q}, (_, n) => t.from[(bi + n) % t.from.length]); });
      }
      const nev = `${c.n} / ${b.n}`;
      const baj = H.seHiany(rows, eq);
      if (baj) { hibak.push(`${nev}: ${baj}`); continue; }
      const s = H.norm({auto: true, build: {base, levels: [{c: c.n}], background: b.n + '|' + b.s}, newChar: {target: 1, eq}});
      try {
        const e = H.seEredmeny(s, rb);
        if (!e.items.length) hibak.push(nev + ': üres felszerelés');
        const cr = H.calc({...s, inventory: e.inventory}, rb);
        if (!(cr.ac.v >= 10)) hibak.push(nev + ': AC ' + cr.ac.v);
      } catch (err) { hibak.push(`${nev}: ${err.message}`); }
      if (!(H.seAranyDob(gold, () => 1) > 0)) hibak.push(nev + ': arany ' + gold);
    }
    eq(hibak, []);
  }, {online: true});
  test('online: a generátor a valódi szabálykönyvvel minden osztályra, 17. szinten, magas mágiával tölt minden helyet; nincs egyszer használatos tárgy', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), hibak = [];
    for (const cls of rb.classes.map(c => c.n)) {
      const c = W.normCreature({kind: 'pc', name: cls, type: 'Human — ' + cls + ' 17', fromNpc: true, inventory: [{name: 'Longsword', qty: 1, ref: 'Longsword|PHB'}]});
      A('S.library').push(c);
      const t = W.felszerelesTerv(c.id, rb, 'high');
      if (t.items.length !== 6 || t.items.some(x => !x.n)) hibak.push(`${cls}: ${t.items.map(x => x.rar + ' ' + (x.n || '–')).join(', ')}`);
      if (t.items.some(x => /potion|scroll|arrow|bolt/i.test(x.n))) hibak.push(cls + ': egyszer használatos');
      if (!t.start.length) hibak.push(cls + ': nincs kezdő felszerelés');
      if (t.items.filter(x => x.att).length > 3) hibak.push(cls + ': 3-nál több attunement');
    }
    eq(hibak, []);
  }, {online: true});
  test('online: mind a 13 osztály és minden PHB-háttér kezdő felszerelése feloldható a szabálykönyvből', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet, hibak = [];
    eq(rb.classes.filter(c => c.se?.rows?.length).length, 13, 'osztály felszereléssel');
    for (const c of rb.classes) {
      if (!/^\d+d4(\*10)?$/.test(c.se?.gold || '')) hibak.push(c.n + ': arany ' + c.se?.gold);
      if (c.se.tx.length !== c.se.rows.length) hibak.push(c.n + ': a PHB-szöveg sorai nem egyeznek a választási sorokkal');
      for (const b of rb.backgrounds) {
        const {rows} = H.seRows(c.n, b.n + '|' + b.s, rb);
        for (const row of rows) for (const o of row.opts) for (const t of o.items) {
          if (t.kind === 'cat' && !t.from.length) hibak.push(`${c.n}/${b.n}: üres kategória ${t.label}`);
          if (t.kind === 'item' && !t.ref && !rb.backgrounds.some(x => x.se?.rows?.some(r => Object.values(r).flat().some(y => y.sp === t.n)))) hibak.push(`${c.n}/${b.n}: ismeretlen tárgy ${t.n}`);
        }
      }
    }
    eq(rb.classes.find(c => c.n === 'Monk').se.gold, '5d4');
    eq([...new Set(hibak)], []);
    ok(rb.backgrounds.filter(b => b.se?.rows?.length).length >= 13, 'háttér felszereléssel');
    const csomagok = rb.items.filter(i => i.s === 'PHB' && /Pack$/.test(i.n));
    eq(csomagok.length, 7, 'a hét PHB-csomag');
    for (const pk of csomagok) for (const p of pk.pk) if (!p.sp && !rb.items.concat(rb.baseItems).some(x => x.n + '|' + x.s === p.r)) hibak.push(`${pk.n}: ${p.r}`);
    const papi = H.seLeltar([{ref: "Priest's Pack|PHB", n: "Priest's Pack", q: 1}], rb);
    ok(papi.some(i => i.name === 'vestments' && i.container === "Priest's Pack"), 'a szöveges tétel is a csomagba kerül');
    eq(hibak, [], 'a csomagok tartalma feloldható');
  }, {online: true});
});

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
    // a logika nem hívja a felület függvényeit, csak az Ertesito-n át szól
    const nevek = new Set(['confirm', 'alert', 'prompt']);
    for (const f of felulet) for (const m of (await szoveg(f)).matchAll(/^(?:async )?function (\w+)|^const (\w+) = /gm)) nevek.add(m[1] || m[2]);
    ok(nevek.has('render') && nevek.has('log') && nevek.has('setSaveState') && nevek.has('closeModal'), 'megtalálta a felület neveit');
    const HIVAS_RE = new RegExp(`(?<![\\w.$])(${[...nevek].join('|')})\\(`, 'g');
    for (const f of logika) {
      const kod = (await szoveg(f)).replace(/^\s*\/\/.*$/gm, '');
      eq(talal(kod, HIVAS_RE), [], f + ': a logika nem hívja a felületet');
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
  test('rétegek: a karakter.html-ben csak a VART_MODULOK maradt, a kód a js/lap/ fájlokban; csak a lap-indulas.js futtat kódot betöltéskor', async () => {
    const szoveg = async f => (await fetch('../' + f, {cache: 'no-store'})).text();
    const html = await szoveg('karakter.html');
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1].replace(/^\s*\/\/.*$/gm, '').trim());
    eq(inline.length, 1, 'egy sima <script> blokk');
    ok(/^'use strict';\s*const VART_MODULOK = \{[^}]*\};$/.test(inline[0]), 'csak a VART_MODULOK: ' + inline[0].slice(0, 80));
    const srcek = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => s !== 'firebase-config.js');
    ok(srcek.at(-1).startsWith('js/lap/lap-indulas.js?'), 'az utolsó: ' + srcek.at(-1));
    const fajlok = srcek.filter(s => s.startsWith('js/lap/')).map(s => s.split('?')[0]);
    ok(fajlok.length >= 10, 'megtalálta a fájlokat: ' + fajlok.length);
    // a többi fájl legfelső szintjén csak deklaráció: nincs figyelő, nincs hívás (a modul() bejelentésen kívül)
    for (const f of fajlok.filter(f => !f.endsWith('lap-indulas.js'))) {
      const fut = (await szoveg(f)).split(/\r?\n/).filter(l => /^[\w$.]+\(/.test(l) && !/^modul\(/.test(l));
      eq(fut, [], f + ': a legfelső szinten csak deklaráció');
      ok(!/^(document|window)\.addEventListener/m.test(await szoveg(f)), f + ': figyelő csak …Esemenyek() függvényben');
    }
  });
  test('telefonos lap gombjai: minden data-act-hoz van LAP_AKCIOK-bejegyzés vagy módosítás-kezelő, és nincs gazdátlan bejegyzés', async () => {
    const szoveg = async f => (await fetch('../' + f, {cache: 'no-store'})).text();
    const html = await szoveg('karakter.html');
    const fajlok = [...html.matchAll(/<script src="(js\/lap\/[\w-]+\.js)\?v=\d+"><\/script>/g)].map(m => m[1]);
    const kod = [html, ...await Promise.all(fajlok.map(szoveg))].join('\n').replace(/^\s*\/\/.*$/gm, '');
    eq([...kod.matchAll(/data-act=(?!"\w+")[^\s>]*/g)].map(m => m[0]), [], 'összerakott data-act (a teszt csak a szó szerinti nevet látja)');
    const nevek = new Set([...kod.matchAll(/data-act="(\w+)"/g)].map(m => m[1]));
    const kulcsok = K.eval('Object.keys(LAP_AKCIOK)');
    eq(kulcsok.filter(k => !nevek.has(k)), [], 'gazdátlan bejegyzés');
    // a mezők (jelölőnégyzet, legördülő, szövegmező) a change-figyelőben, act === '…' alapján
    const valtozas = [...nevek].filter(n => !kulcsok.includes(n)).sort();
    eq(valtozas, ['attune', 'bBase', 'bBg', 'bRace', 'coin', 'csakBek', 'equip', 'itemCont', 'itemNote', 'lvHp', 'ncEqCat', 'prep', 'todoDone']);
    const akciok = await szoveg('js/lap/lap-akciok.js');
    for (const n of valtozas) ok(akciok.includes(`act === '${n}'`), n + ': a change-figyelő kezeli');
    ok(K.eval('LAP_NELKUL').size && [...K.eval('LAP_NELKUL')].every(k => kulcsok.includes(k)), 'a lap nélküli gombok is a táblázatban');
    ok(!/switch \(act\)/.test(akciok), 'nincs nagy elágazás');
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
    eq(utak.length, 15, 'az útvonalak száma (új útvonalnál a teszt is bővül)');
    has(rules, 'match /hist/{h} ', 'a lapok előzménye (alkollekció)');
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
    eq([HELYI.allapot, HELYI.lapok, HELYI.szintlepes('x')], ['dmscreen', 'dmscreen-sheets', 'dmscreen-szintlepes-x'], 'a régi kulcsok (a böngészőben tárolt másolat ezeken van)');
    localStorage.removeItem(HELYI.allapot); A('doSave()');
    await until(() => JSON.parse(localStorage.getItem(HELYI.allapot) || 'null')?.settings?.sources, 2000, 'helyi mentés a HELYI.allapot kulcson');
    has(await (await fetch('../player.html', {cache: 'no-store'})).text(), `new BroadcastChannel('${CSATORNA}')`, 'player.html csatornája');
  });
  test('szintlépés mezői a lapon: levelUp, build.spells, spells.cls / book tisztítva; az előzmény (normHist); XSS-kód csak szövegként', () => {
    const H = W.Sheet, XSS = '<img src=x onerror=alert(1)>';
    eq(H.norm({}).levelUp, null);
    for (const to of [1, 0, -3, 'x', null]) eq(H.norm({levelUp: {to}}).levelUp, null, 'érvénytelen cél: ' + to);
    eq(H.norm({levelUp: {to: 99, by: XSS, at: 'tegnap', mc: 1, extra: 5}}).levelUp, {to: 20, by: XSS, at: '', mc: true});
    eq(H.norm({levelUp: {to: 6, by: 'dm', at: '2026-11-02T18:00:00.000Z'}}).levelUp, {to: 6, by: 'dm', at: '2026-11-02T18:00:00.000Z', mc: false});
    const b = H.norm({auto: true, build: {levels: [{c: 'Wizard'}], spells: {Wizard: {cantrips: ['Light|PHB', 'Light|PHB', 5, XSS], book: ['Shield|PHB'], kitalalt: ['X|Y']}, Bard: {known: ['Sleep|PHB']}, Fighter: 'szöveg'}}}).build;
    eq(b.spells, {Wizard: {cantrips: ['Light|PHB'], book: ['Shield|PHB']}}, 'csak a felépítés osztályai, csak érvényes refek');
    eq(H.norm({auto: true, build: {levels: []}}).build.spells, null, 'null = még nincs besorolva');
    eq(H.norm({auto: true, build: {levels: [{c: 'Bard'}], spells: {}}}).build.spells, {}, 'a besorolt, de üres lista nem null');
    const sp = H.norm({spells: [{name: 'A', cls: 'Wizard', book: 1}, {name: 'B', cls: {x: 1}}]}).spells;
    eq([sp[0].cls, sp[0].book, 'cls' in sp[1], 'book' in sp[1]], ['Wizard', true, false, false]);
    const h = H.normHist({at: '2026-11-02T18:00:00.000Z', by: 'a@x.hu', reason: 'levelup', from: 5, to: 6, hp: 'roll', sheet: {name: XSS, levelUp: {to: 6}}});
    eq([h.reason, h.from, h.to, h.hp, h.sheet.name, h.sheet.levelUp.to], ['levelup', 5, 6, 'roll', XSS, 6]);
    eq([H.normHist({reason: 'x', hp: 'x'}).reason, H.normHist({hp: 'x'}).hp, H.normHist(null).sheet.name], ['manual', '', 'Névtelen']);
    // multiclass nem teljesült feltétellel (TERV-multiclass.md)
    const hm = H.normHist({reason: 'levelup', mc: {cls: XSS, hiany: ['INT 13 kell (most 12)', 7, {x: 1}, XSS], extra: 1}, sheet: {}});
    eq(hm.mc, {cls: XSS.slice(0, 60).trim(), hiany: ['INT 13 kell (most 12)', '7', '', XSS]});
    eq([H.normHist({mc: {cls: ' '}}).mc, H.normHist({mc: 'Wizard'}).mc, h.mc], [null, null, null]);
    for (const x of [H.norm({levelUp: {to: 6, by: XSS}, spells: [{name: 'A', cls: 'Wizard', book: true, auto: true}], auto: true, build: {levels: [{c: 'Wizard'}], spells: {Wizard: {book: ['A|B']}}}}), h, hm])
      eq(JSON.parse(JSON.stringify(x.sheet ? H.normHist(x) : H.norm(x))), JSON.parse(JSON.stringify(x)), 'még egyszer tisztítva nem változik');
  });
  // a firestore.rules játékos-feltételeinek tükre (a szabályszöveget magát a konzol ellenőrzi; a teszt a szöveg kulcssorait is rögzíti)
  const szabalyTukor = (old, now) => {
    const lv = d => d.build == null ? 0 : (d.build.levels || []).length, lu = old.levelUp ?? null, nlu = now.levelUp ?? null;
    const levelsOk = (lv(old) === 0 || lv(now) > 0) && (lv(old) === 0 || lv(now) <= lv(old) || (lu != null && lv(now) <= lu.to)) && (old.auto !== true || lv(old) > 0 || lv(now) <= 1);
    const levelUpOk = fmt(nlu) === fmt(lu) || nlu == null || (lv(now) < lv(old) && nlu.to <= lv(old));
    const d = now.deleted ?? null, ownerOk = (now.owner === old.owner && fmt(d) === fmt(old.deleted ?? null)) || (now.owner === '' && d != null && d.owner === old.owner);
    const na = old.newChar ?? null, nb = now.newChar ?? null;
    const newCharOk = nb == null || (na != null && nb.target === na.target && fmt(nb.methods) === fmt(na.methods) && (na.rolls == null || fmt(nb.rolls ?? null) === fmt(na.rolls))
      && (nb.equip ?? 'any') === (na.equip ?? 'any') && ((na.eq ?? {}).gold == null || ((nb.eq ?? {}).gold ?? null) === na.eq.gold));
    return levelsOk && levelUpOk && ownerOk && newCharOk;
  };
  test('szabályok: új karakter: az üres motoros lapon legfeljebb 1 szint; a varázslót a játékos nem indíthatja, a kezdőszintet, a módszereket, a dobást nem írhatja át', async () => {
    const rules = await (await fetch('../firestore.rules', {cache: 'no-store'})).text();
    for (const sor of ["(old.get('auto', false) != true || buildLv(old) > 0 || buildLv(now) <= 1)", 'newCharOk(resource.data, request.resource.data)',
      "b == null || (a != null && b.target == a.target && b.methods == a.methods && (a.get('rolls', null) == null || b.get('rolls', null) == a.rolls)",
      "&& b.get('equip', 'any') == a.get('equip', 'any') && (a.get('eq', {}).get('gold', null) == null || b.get('eq', {}).get('gold', null) == a.eq.gold));"]) has(rules, sor, 'a tükör a szabály szövegét követi');
    const nc = (extra = {}) => ({target: 2, methods: ['array', 'roll'], rolls: null, ...extra});
    const L = (n, newChar) => ({auto: true, build: {levels: Array(n).fill({c: 'Rogue'})}, newChar});
    ok(szabalyTukor(L(0, nc()), L(1, nc())), 'az első osztály');
    ok(szabalyTukor(L(1, nc()), L(1, nc({step: 'kep'}))), 'osztályváltás, lépés');
    ok(!szabalyTukor(L(0, nc()), L(2, nc())), 'üres lapon nem kettő');
    ok(!szabalyTukor(L(1, nc()), L(2, nc())), 'engedély nélkül nincs második szint');
    ok(szabalyTukor({...L(1, null), levelUp: {to: 2}}, {...L(2, null), levelUp: null}), 'lezárás után a szintlépés a kezdőszintig megy');
    ok(!szabalyTukor(L(1, nc()), L(1, nc({target: 5}))), 'a kezdőszint nem írható át');
    ok(!szabalyTukor(L(1, nc()), L(1, nc({methods: ['manual']}))), 'a módszerek sem');
    ok(szabalyTukor(L(1, nc()), L(1, nc({rolls: [10, 10, 10, 10, 10, 10]}))), 'az első dobás');
    ok(!szabalyTukor(L(1, nc({rolls: [10, 10, 10, 10, 10, 10]})), L(1, nc({rolls: [18, 18, 18, 18, 18, 18]}))), 'a dobás nem ismételhető');
    ok(!szabalyTukor(L(1, nc({rolls: [10, 10, 10, 10, 10, 10]})), L(1, nc())), 'nem is törölhető');
    ok(szabalyTukor(L(1, nc()), L(1, null)), 'lezárás');
    // kezdő felszerelés (TERV-kezdo-felszereles.md): a DM beállítása és a megdobott kezdőarany
    ok(szabalyTukor(L(1, nc()), L(1, nc({equip: 'any', eq: {mode: 'pack'}}))), 'a régi lapon nincs equip: az alapértelmezett any');
    ok(!szabalyTukor(L(1, nc({equip: 'pack'})), L(1, nc({equip: 'any'}))), 'a DM beállítása nem írható át');
    ok(szabalyTukor(L(1, nc({eq: {gold: null}})), L(1, nc({eq: {mode: 'gold', gold: 120}}))), 'az első aranydobás');
    ok(!szabalyTukor(L(1, nc({eq: {gold: 120}})), L(1, nc({eq: {gold: 200}}))), 'az aranydobás nem ismételhető');
    ok(!szabalyTukor(L(1, nc({eq: {gold: 120}})), L(1, nc({eq: {gold: null}}))), 'nem is törölhető');
    ok(szabalyTukor(L(1, nc({eq: {gold: 120}})), L(1, nc({eq: {gold: 120, cart: [{r: 'Dagger|PHB', q: 1}]}}))), 'a kosár változhat');
    ok(!szabalyTukor(L(1, null), L(1, nc())), 'nem indítható újra');
    ok(szabalyTukor({levelUp: null}, L(5, null)), 'a kézi lap átállítása változatlan');
  });
  test('szabályok: a játékos a gazdát csak törléskor veheti le, és csak úgy, hogy a régi megmarad; a nyilvános részből is', async () => {
    const rules = await (await fetch('../firestore.rules', {cache: 'no-store'})).text();
    for (const sor of ["(now.owner == old.owner && d == old.get('deleted', null)) || (now.owner == '' && d != null && d.owner == old.owner)", 'ownerOk(resource.data, request.resource.data)',
      "(request.resource.data.owner == '' && request.resource.data.visibility == 'dm')"]) has(rules, sor, 'a tükör a szabály szövegét követi');
    const A1 = {owner: 'a@x.hu'};
    ok(szabalyTukor(A1, {owner: 'a@x.hu'}), 'marad');
    ok(!szabalyTukor(A1, {owner: 'b@x.hu'}), 'másra nem');
    ok(!szabalyTukor(A1, {owner: ''}), 'törlés-jelölés nélkül nem');
    ok(!szabalyTukor(A1, {owner: 'a@x.hu', deleted: {owner: 'idegen@x.hu'}}), 'a gazda megtartásával nem írhat be idegen címet');
    ok(!szabalyTukor(A1, {owner: '', deleted: {owner: 'x@x.hu'}}), 'más régi gazdával nem');
    ok(szabalyTukor(A1, {owner: '', deleted: {owner: 'a@x.hu'}}), 'törlés');
  });
  test('szabályok: a játékos nem adhat magának szintet és engedélyt, a régi lapot nem zárja ki; a visszavonás visszakapja az engedélyt', async () => {
    const L = (n, levelUp) => ({build: {levels: Array(n).fill({c: 'Rogue'})}, levelUp});
    const rules = await (await fetch('../firestore.rules', {cache: 'no-store'})).text();
    for (const sor of ['(buildLv(old) == 0 || buildLv(now) > 0)', "buildLv(old) == 0 || buildLv(now) <= buildLv(old) || (lu != null && buildLv(now) <= lu.to)", "b == null ? 0 : b.get('levels', []).size()", 'allow read, create: if isDM() || ownSheet();', 'allow delete: if isDM();', "lu == old.get('levelUp', null) || lu == null || (buildLv(now) < buildLv(old) && lu.to <= buildLv(old))",
      'levelsOk(resource.data, request.resource.data) && levelUpOk(resource.data, request.resource.data)']) has(rules, sor, 'a tükör a szabály szövegét követi');
    ok(szabalyTukor(L(5, null), L(5, null)), 'sima írás');
    ok(!szabalyTukor(L(5, null), L(6, null)), 'engedély nélkül nincs új szint');
    ok(szabalyTukor(L(5, {to: 6}), L(6, null)), 'engedéllyel lép, és törli');
    ok(szabalyTukor(L(5, {to: 7}), L(6, {to: 7})), 'két szintre szóló engedélynél az első után megmarad');
    ok(!szabalyTukor(L(5, {to: 6}), L(7, null)), 'az engedélyen túl nem');
    ok(!szabalyTukor(L(5, null), L(5, {to: 6})), 'engedélyt nem adhat magának');
    ok(!szabalyTukor(L(5, {to: 6}), L(5, {to: 7})), 'az engedélyt nem emelheti');
    ok(szabalyTukor(L(6, null), L(5, {to: 6})), 'visszavonás: az engedély visszajön');
    ok(!szabalyTukor(L(6, null), L(5, {to: 7})), 'visszavonásnál sem magasabbra');
    ok(szabalyTukor({levelUp: null}, L(5, null)), 'a kézi lap átállítható (nincs felépítése)');
    ok(szabalyTukor({}, {name: 'x'}), 'a mezők nélküli régi lap írható');
    ok(!szabalyTukor(L(5, null), {build: null, levelUp: null}), 'a felépítést nem veheti le (utána bármekkorát írhatna)');
    ok(!szabalyTukor(L(5, null), L(0, null)), 'üresre sem');
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
  for (const k of ['normCreature', 'normCombatant', 'splitEntry', 'sideOf', 'mod', 'sgn', 'initBonusOf', 'nameOf', 'byId', 'crXp', 'pcLevel', 'crToPb', 'ordinal', 'is5e', 'isDDB', 'crBand', 'dmgTable', 'coinStr', 'noTreasure', 'skillLabel', 'passiveScore', 'partyMembers', 'coinsGp', 'hpStatus', 'playerEmails', 'stableJson', 'sharingDirty', 'lenySablon']) W[k] = A(k);
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
run().catch(e => { document.getElementById('summary').textContent = 'A TESZTFUTTATÁS ELAKADT: ' + (e.message || e); document.getElementById('report').textContent += '\nHIBA  a tesztfuttatás elakadt: ' + (e.message || e) + (appErrors.length ? ' – az app hibái: ' + appErrors.join(' | ') : '') + '\nÖSSZESEN: 0 sikeres, 1 hibás'; });

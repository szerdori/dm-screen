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
let W, P, A, appErrors = [];
const frame = (id, src, w, h) => { const f = document.createElement('iframe'); f.id = id; f.src = src; f.width = w; f.height = h; $frames.appendChild(f); return f; };
const $frames = document.getElementById('frames');
try { localStorage.removeItem('dmscreen'); } catch {}

const $ = s => W.document.querySelector(s);
const $$ = s => [...W.document.querySelectorAll(s)];
const click = (el, opts = {}) => { if (typeof el === 'string') el = $(el); ok(el, 'nincs ilyen elem'); el.dispatchEvent(new W.MouseEvent('click', {bubbles: true, ...opts})); };
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
  A(`DB = null; authInfo = {status: 'unconfigured'}; clearTimeout(saveTimer); saveTimer = null;
     S = {library: [], enc: {list: [], round: 1, active: null}, saved: [], settings: {groupInit: true, rollHp: false, sources: ['MM']}};
     selected = null; logLines = []; libTab = 'lib'; lastSaved = {state: '', lib: {}, saved: {}};
     fiveIndex = null; fiveData = {}; fiveResults = []; backupWarn = ''; lootData = null; lootResult = null;
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
const add = (c, n = 1) => W.addToEncounter(c, n);

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
    add(pc('Rella'))[0].init = 10; W.step(1);
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
    const [p] = setup(); W.step(1);
    eq([A('S.enc.active'), A('S.enc.round')], [p.cid, 1]);
  });
  test('a sor végén új kör kezdődik', () => {
    const [p] = setup(); W.step(1); W.step(1); W.step(1); W.step(1);
    eq([A('S.enc.active'), A('S.enc.round')], [p.cid, 2]);
    has(allLog(), '2. kör');
  });
  test('halott ellenfelet átugorja, halott játékost nem', () => {
    const [p, g1, g2] = setup(); g1.dead = true; p.dead = true;
    W.step(1); eq(A('S.enc.active'), p.cid);
    W.step(1); eq(A('S.enc.active'), g2.cid);
  });
  test('visszalépés az elejéről az utolsóra, a kör nem megy 1 alá', () => {
    const [p, , g2] = setup(); W.step(1); W.step(-1);
    eq([A('S.enc.active'), A('S.enc.round')], [g2.cid, 1]);
  });
  test('körszámos állapot a lény körének elején csökken és lejár', () => {
    const [, g1] = setup();
    g1.cond = [{name: 'Prone', rounds: 1}, {name: 'Frightened', rounds: 2}, {name: 'Charmed', rounds: null}];
    W.step(1); W.step(1);
    eq(g1.cond, [{name: 'Frightened', rounds: 1}, {name: 'Charmed', rounds: null}]);
    has(allLog(), 'Prone lejárt');
  });
  test('legendás akciók visszaállnak a lény körének elején', () => {
    const [p] = setup(); p.leg = 2; W.step(1); eq(p.leg, 0);
  });
  test('üres encounterben a lépés nem hibázik', () => { W.step(1); eq(A('S.enc.active'), null); });
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
    p.init = 12; p.cond = [{name: 'Prone', rounds: null}]; W.step(1); W.step(1);
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
describe('Játékos képernyő', () => {
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
    W.step(1); W.broadcast();
    const doc = () => P.document.body.textContent;
    await until(() => doc().includes('Ogre 1'), 4000, 'játékos képernyő frissítése');
    has(doc(), 'Soron: Rella'); has(doc(), 'Súlyosan sérült'); has(doc(), 'Sértetlen'); has(doc(), 'Prone'); has(doc(), '30 / 30');
    hasNot(doc(), 'Rejtett'); hasNot(doc(), 'Bloodied');
    ok(P.document.querySelector('.e.active .name').textContent === 'Rella', 'nem a soron lévő van kiemelve');
  });
  test('a player.html követi a következő lépést', async () => {
    const [p] = add(pc('Rella')), [g] = add(mk()); p.init = 20; g.init = 1;
    W.step(1); W.step(1);
    await until(() => P.document.querySelector('.e.active .name')?.textContent === 'Goblin', 4000, 'aktív frissítése');
  });
});

// ======================================================================
describe('Felület', () => {
  test('a csempék initiative-sorrendben jelennek meg, az aktív kiemelve', () => {
    const [a] = add(mk('A')), [b] = add(mk('B')); a.init = 5; b.init = 18; W.step(1);
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
});

// ======================================================================
describe('Online (csak  .\\teszt.ps1 -Online  esetén)', () => {
  test('5e.tools adatok elérhetők, a 2014-es goblin helyesen alakul át', async () => {
    W.loadFiveSource = ORIG.loadFiveSource; W.loadFiveIndex = ORIG.loadFiveIndex;
    const mm = await W.loadFiveSource('MM');
    const g = W.convert5e(mm.find(m => m.name === 'Goblin'));
    eq([g.ac, g.hp.max, W.atkInfo(g.actions.find(a => a.name === 'Scimitar').text).hit], [15, 7, '+4']);
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
  const store = structuredClone(initial), log = [];
  return {store, log, db: {
    get: async p => store[p] ? structuredClone(store[p]) : null,
    list: async col => Object.entries(store).filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({...structuredClone(v), id: k.split('/')[1]})),
    set: async (p, d) => { JSON.stringify(d); store[p] = structuredClone(d); log.push('set ' + p); },
    del: async p => { delete store[p]; log.push('del ' + p); }
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
  if (first) { A(`selected = ${JSON.stringify(first.cid)}`); W.render(); W.step(1); }
  for (const t of ['lib', 'enc']) W.openLib(t);
  if (A('S.library.length')) W.openEditor(A('S.library[0]'), () => {});
  W.closeModal(); W.openDiffInfo(); W.closeModal(); W.broadcast();
  await wait(300);
}
function assertNoXss() {
  for (const [nm, doc] of [['DM képernyő', W.document], ['játékos képernyő', P.document]]) {
    eq(doc.querySelectorAll('[onmouseover]').length, 0, nm + ': attribútum-befecskendezés');
    eq(doc.querySelectorAll('img[src="x"]').length, 0, nm + ': HTML-befecskendezés');
  }
  eq(W.__xss, undefined, 'lefutott a befecskendezett kód'); eq(P.__xss, undefined, 'lefutott a kód a játékos képernyőn');
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
    click($$('[data-act="backupRestore"]')[1]); await wait(300);
    has(allLog(), 'visszaállítva');
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
describe('Általános', () => {
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
  for (const k of ['rnd', 'loadFiveSource', 'loadFiveIndex', 'loadLoot', 'confirm', 'alert', 'download']) ORIG[k] = W[k];
  // a „const f = ...” segédfüggvények nem window-tulajdonságok, ezért elérhetővé tesszük őket W.f néven
  for (const k of ['sideOf', 'mod', 'sgn', 'initBonusOf', 'nameOf', 'byId', 'crXp', 'pcLevel', 'crToPb', 'ordinal', 'is5e', 'isDDB', 'crBand', 'dmgTable', 'coinStr', 'noTreasure']) W[k] = A(k);
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

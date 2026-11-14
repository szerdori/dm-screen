// DM Screen – regressziós tesztek: kocka, dobáslinkek, lények, szerkesztő, encounter, körök, sebzés, nehézség; 5e.tools és D&D Beyond átalakítás, importálás, könyvtár, mentett encounterek.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

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
  test('csapattársnak állított szörny és a csapattárs NPC a csapatba számít, szintje = a CR-je (2026-11-14)', () => {
    eq(['1/4', '0', '1/2', '1', '5', 'CR 7', '25', 'x', ''].map(W.crSzint), [1, 1, 1, 1, 5, 7, 20, null, null]);
    add(pc('A', 3)); add(pc('B', 3)); add(pc('C', 3)); const [g] = add(mk()); add(ogre());
    g.side = 'ally'; let d = W.difficulty();
    eq([d.enemies.length, d.party.length, d.allies.length, d.members.length, d.base], [1, 3, 1, 4, 450]);
    // 3 × 3. szint + 1 × 1. szint (CR 1/4): [75·3+25, 150·3+50, 225·3+75, 400·3+100]
    eq([d.thresh, d.pSize, d.mult, d.adj, d.rating], [[250, 500, 750, 1300], 4, 1, 450, 'easy']);
    // csapattárs NPC CR 2 → 2. szint; ismeretlen CR-ű NPC figyelmeztet
    add(mk('Őr', {kind: 'npc', cr: '2'})); add(mk('Titkos NPC', {kind: 'npc', cr: ''}));
    d = W.difficulty();
    eq([d.members.length, d.pSize, d.thresh[0], d.noLevel], [6, 5, 250 + 50, ['Titkos NPC']]);
    click('#diff'); has($('#modalBox').textContent, 'ebből 3 csapattárs NPC / szörny'); has($('#modalBox').textContent, 'CR 2');
  });
  test('aktuális HP (2026-11-14): arányosan számít; a fejlécben a mostani, az ablakban mindkettő; a jutalom a teljes érték', () => {
    const p = ['A', 'B', 'C', 'D'].map(n => add(pc(n, 3))[0]); const g = add(mk(), 4); const [o] = add(ogre());
    // HP-arány: temp HP-val legfeljebb 1, halott 0
    p[0].hp = 15; eq(W.hpArany(p[0]), 0.5); p[0].temp = 40; eq(W.hpArany(p[0]), 1); p[0].temp = 0; p[0].hp = 30;
    g[0].dead = true; eq(W.hpArany(g[0]), 0); g[0].dead = false;
    eq([W.difficulty().most.adj, W.difficulty().most.rating], [1300, 'hard'], 'teljes HP-n a kettő ugyanaz');
    ok(!$('#diff').title, 'nincs eltérés, nincs tooltip');
    // két goblin halott, két játékos 0 HP-n: most 2 · 50 + 450 = 550 XP, 3 ellenfél (×2), 2 fős csapat (+1 fok: ×2,5) = 1375 → Halálos (2 × 3. szint: 400 felett)
    g[0].hp = 0; g[0].dead = true; g[1].hp = 0; g[1].dead = true; p[0].hp = 0; p[1].hp = 0;
    let d = W.difficulty();
    eq([d.adj, d.rating, d.base], [1300, 'hard', 650], 'tervezve: a régi');
    eq([d.most.xp, d.most.counted, d.most.pSize, d.most.mult, d.most.adj, d.most.thresh, d.most.rating], [550, 3, 2, 2.5, 1375, [150, 300, 450, 800], 'deadly']);
    W.render(); has($('#diff').textContent, 'Halálos · 1375 XP'); has($('#diff').title, 'Tervezve, teljes HP-val: Nehéz · 1300 XP');
    // fél HP-s ogre: az XP-je fele
    o.hp = Math.round(o.c.hp.max / 2); d = W.difficulty();
    eq(d.most.xp, 100 + Math.round(450 * o.hp / o.c.hp.max));
    click('#diff');
    const t = $('#modalBox').textContent;
    has(t, 'Most (aktuális HP)'); has(t, 'Tervezve (teljes HP)'); has(t, 'Összesen, aktuális HP-val'); has(t, 'Jutalom: 650 XP'); has(t, 'fejenként 162 XP');
  });
  test('hiányzó szint / CR figyelmeztetés', () => {
    add(pc('A', 3, {cr: ''})); add(mk('Titok', {cr: ''}));
    const d = W.difficulty(); eq([d.noLevel, d.noCr], [['A'], ['Titok']]);
    has($('#diff').textContent, '⚠');
  });
  test('nehézség-ablak gonosz névvel és CR-rel (csapattárs NPC, ellenfél, játékos): semmi nem fut le', () => {
    add(pc(XSS, 3)); add(mk(XSS, {kind: 'npc', cr: XSS})); add(mk(XQ, {cr: XQ})); add(mk('Ork'));
    W.render(); click('#diff');
    has($('#modalBox').textContent, '<img'); assertNoXss();
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

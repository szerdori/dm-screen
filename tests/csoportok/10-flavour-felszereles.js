// DM Screen – regressziós tesztek: flavour text a sebzésdobásokhoz, kezdő felszerelés.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

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

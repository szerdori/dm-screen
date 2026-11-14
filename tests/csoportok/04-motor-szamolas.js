// DM Screen – regressziós tesztek: szabálymotor: teljes számolás (Sheet.calc), aranyminta.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

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

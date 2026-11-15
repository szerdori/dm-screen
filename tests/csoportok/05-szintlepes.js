// DM Screen – regressziós tesztek: szintlépés (varázslat-választások, terv, robot), multiclass szabálymotor, átállítás és faji varázslat, választó-modul.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

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

  // ---------- véletlen build (TERV-veletlen-build.md, js/logika/veletlen-build.js) ----------
  // ismételhető véletlen: a tesztben a W.rnd egy magból számol (xorshift), így egy hiba újra előállítható
  const vbMag = mag => { let x = mag >>> 0 || 1; W.rnd = d => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return 1 + (x % d); }; };
  const VB_FO = {Artificer: ['int'], Barbarian: ['str'], Bard: ['cha'], Cleric: ['wis'], Druid: ['wis'], Fighter: ['str', 'dex'], Monk: ['dex'], Paladin: ['str'], Ranger: ['dex'],
    Rogue: ['dex'], Sorcerer: ['cha'], Warlock: ['cha'], Wizard: ['int']};
  // egy kész build ellenőrzése: hibalista
  const vbHibak = (r, be, rb) => {
    const H = W.Sheet, nev = `${be.osztaly || '?'} ${be.szint}`;
    if (r.hiba) return [`${nev}: ${r.hiba}`];
    const s = r.lap, c = H.calc(s, rb), h = r.hibak.map(x => `${nev}: ${x}`);
    if (H.level(s) !== be.szint || s.build.levels.length !== be.szint) h.push(`${nev}: a szint ${H.level(s)} / ${s.build.levels.length}`);
    if (!be.osztaly2 && new Set(s.build.levels.map(l => l.c)).size !== 1) h.push(`${nev}: magától multiclass lett: ${H.classLabel(s)}`);
    if (s.newChar || s.levelUp || !s.auto) h.push(`${nev}: nem kész, motoros lap (newChar / levelUp / auto)`);
    if (s.hp.cur !== s.hp.max || s.hp.max < be.szint) h.push(`${nev}: HP ${s.hp.cur} / ${s.hp.max}`);
    const m = H.materialize(s, c);
    if (Object.keys(m).length) h.push(`${nev}: a mentett lap újraszámolva eltér: ${Object.keys(m)}`);
    const ert = a => c.abilities[a].nat ?? c.abilities[a].v, max = Math.max(...H.ABIL.map(ert)), cls = s.build.levels[0].c;
    if (VB_FO[cls] && !VB_FO[cls].some(a => ert(a) === max)) h.push(`${nev}: nem a fő képesség a legmagasabb: ${H.ABIL.map(a => a + ' ' + ert(a)).join(', ')}`);
    if (H.ABIL.some(a => ert(a) > 20)) h.push(`${nev}: 20 fölötti képesség`);
    // minden választott varázslat a hely érvényes lehetőségei közt van (a lista, a szint és a „már megvan” szerint)
    for (const x of c.choices.filter(x => H.SPELL_KINDS.includes(x.kind) || x.kind === 'spell')) {
      const o = H.choiceOptions(x, c, rb, s);
      for (const v of x.ok) if (!o.opts.some(y => y.v === v && !y.dis)) h.push(`${nev}: érvénytelen varázslat a(z) ${x.key} helyen: ${v}`);
    }
    for (const x of c.choices.filter(x => x.kind === 'asi' || x.kind === 'feat')) for (const v of x.ok) {
      const ref = typeof v === 'string' ? v : v?.feat, f = ref && rb.feats.find(y => y.n + '|' + y.s === ref);
      if (f && !H.featOk(f, c, rb, s).ok) h.push(`${nev}: nem teljesülő feat-előfeltétel: ${ref}`);
    }
    return h;
  };
  const rbVb = () => {
    const rb = rb13();
    rb.spells.find(x => x.n === 'Fire Bolt').tx = 'You hurl a mote of fire. On a hit, the target takes 1d10 fire damage.';
    return rb;
  };
  test('véletlen build: mind a 13 osztály 1., 5., 11. és 20. szinten – nincs nyitott hely, a fő képesség a legmagasabb, kész, motoros lap, magától nincs multiclass', () => {
    const rb = rbVb(), hibak = [];
    rb.classes.forEach((c, i) => [1, 5, 11, 20].forEach(L => { vbMag(i * 31 + L); const be = {szint: L, osztaly: c.n}; hibak.push(...vbHibak(W.veletlenBuild(be, rb), be, rb)); }));
    eq(hibak, []);
  });
  test('véletlen build: a megadott faj, alfaj, osztály, alosztály, háttér és név megmarad; üres név: „Új karakter”', () => {
    const rb = rbVb(), H = W.Sheet, hat = rb.backgrounds[0];
    for (let m = 1; m <= 5; m++) {
      vbMag(m);
      const r = W.veletlenBuild({szint: 6, nev: ' Tóbiás ', faj: 'dwarf', alfaj: 'Hill', osztaly: 'Fighter', alosztaly: 'Eldritch Knight', hatter: hat.n}, rb);
      eq(r.hibak, []);
      eq([r.lap.name, r.lap.build.race, r.lap.build.subrace, r.lap.build.background, r.lap.build.sub.Fighter, H.classLabel(r.lap)],
        ['Tóbiás', 'Dwarf|PHB', 'Hill|PHB', hat.n + '|' + hat.s, 'Eldritch Knight|PHB', 'Fighter 6 (Eldritch Knight)']);
      // az EK-nál az INT is előre kerül (harmadik helyre), a varázslatai kitöltve
      const c = H.calc(r.lap, rb);
      ok(c.abilities.int.v >= 13, 'EK: INT 13+');
      ok(c.choices.filter(x => H.SPELL_KINDS.includes(x.kind)).every(x => x.ok.length), 'EK: van cantripje és ismert varázslata (a kis tesztkönyvben nincs elég a teljes kitöltéshez)');
    }
    vbMag(9);
    eq(W.veletlenBuild({szint: 1, osztaly: 'Wizard'}, rb).lap.name, 'Új karakter');
  });
  test('véletlen build: ASI a fő képességre 20-ig; sebző cantrip a varázslónak; átlagos HP', () => {
    const rb = rbVb(), H = W.Sheet;
    for (let m = 1; m <= 6; m++) {
      vbMag(m);
      const egy = W.veletlenBuild({szint: 1, osztaly: 'Wizard'}, rb).lap, int1 = H.calc(egy, rb).abilities.int.v;
      vbMag(m);
      const nyolc = W.veletlenBuild({szint: 8, osztaly: 'Wizard'}, rb).lap, c = H.calc(nyolc, rb);
      eq(c.abilities.int.v, Math.min(20, int1 + 4), 'két ASI (4., 8. szint) az INT-re');
      ok(c.choices.find(x => x.key === 'Wizard:cantrips').ok.includes('Fire Bolt|PHB'), 'van sebző cantrip (Fire Bolt)');
      // Wizard: 6 + 7 × 4 (átlag) + 8 × CON-módosító
      eq(nyolc.hp.max, 6 + 7 * 4 + 8 * Math.floor((c.abilities.con.v - 10) / 2), 'átlagos HP');
    }
  });
  test('véletlen build: multiclass csak megadásra; mindkét fő képesség 13+, a szintek a megadott szerint; rossz bemenetre hibaüzenet', () => {
    const rb = rbVb(), H = W.Sheet;
    for (let m = 1; m <= 5; m++) {
      vbMag(m);
      const be = {szint: 7, osztaly: 'Wizard', osztaly2: 'Cleric', szint2: 2}, r = W.veletlenBuild(be, rb);
      eq(vbHibak(r, be, rb), []);
      eq(H.classLabel(r.lap).replace(/ \([^)]*\)/g, ''), 'Wizard 5 / Cleric 2');
      const c = H.calc(r.lap, rb);
      ok(c.abilities.int.v >= 13 && c.abilities.wis.v >= 13, `INT ${c.abilities.int.v}, WIS ${c.abilities.wis.v}`);
      eq(r.lap.build.levels.map(l => l.c), [...Array(5).fill('Wizard'), 'Cleric', 'Cleric']);
    }
    ok(/Nincs ilyen osztály/.test(W.veletlenBuild({szint: 3, osztaly: 'Kalóz'}, rb).hiba));
    ok(/ugyanaz/.test(W.veletlenBuild({szint: 3, osztaly: 'Wizard', osztaly2: 'wizard', szint2: 1}, rb).hiba));
    ok(/kevesebb/.test(W.veletlenBuild({szint: 3, osztaly: 'Wizard', osztaly2: 'Cleric', szint2: 3}, rb).hiba));
    ok(/Nincs ilyen faj/.test(W.veletlenBuild({szint: 3, faj: 'Ork-elf'}, rb).hiba));
    ok(/alosztály/.test(W.veletlenBuild({szint: 3, osztaly: 'Fighter', alosztaly: 'Nincs ilyen'}, rb).hiba));
    ok(/szabálykönyv/.test(W.veletlenBuild({szint: 3}, null).hiba));
    ok(/szintet/.test(W.veletlenBuild({osztaly: 'Wizard'}, rb).hiba), 'a szint kötelező');
    ok(/szintet/.test(W.veletlenBuild(null, rb).hiba));
    // csak a második osztály megadva: az első véletlen, de sosem ugyanaz
    for (let m = 1; m <= 30; m++) { vbMag(m); const r = W.veletlenBuild({szint: 4, osztaly2: 'Wizard', szint2: 1}, rb); ok(!r.hiba && r.lap.build.levels[0].c !== 'Wizard', r.hiba || 'az első osztály is Wizard'); }
    // csak alosztály: az osztálya; csak alfaj: a faja
    vbMag(3);
    const ek = W.veletlenBuild({szint: 3, alosztaly: 'Eldritch Knight', alfaj: 'Hill'}, rb);
    eq([ek.hiba, ek.lap?.build.sub.Fighter, ek.lap?.build.race, ek.lap?.build.subrace], [undefined, 'Eldritch Knight|PHB', 'Dwarf|PHB', 'Hill|PHB']);
    ok(/Nincs ilyen alfaj/.test(W.veletlenBuild({szint: 3, alfaj: 'Nincs'}, rb).hiba));
  });
  test('véletlen build valódi szabálykönyvvel: minden osztály 1., 4., 9., 14. és 20. szinten, véletlen fajjal és háttérrel – nincs nyitott hely, érvényes featek, invocation és felszerelés', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet, hibak = [];
    const pancel = {};
    rb.classes.forEach((c, i) => [1, 4, 9, 14, 20].forEach(L => {
      vbMag(i * 97 + L * 7);
      const be = {szint: L, osztaly: c.n}, r = W.veletlenBuild(be, rb);
      hibak.push(...vbHibak(r, be, rb));
      if (r.hiba) return;
      const s = r.lap, cr = H.calc(s, rb);
      if (!s.inventory.length) hibak.push(`${c.n} ${L}: nincs kezdő felszerelés`);
      // a választott Invocation pact-előfeltétele teljesül
      const pakt = cr.choices.filter(x => x.kind === 'opt').flatMap(x => x.ok).map(v => H.refName(v)).filter(n => /^Pact of the /.test(n));
      for (const v of cr.choices.filter(x => x.kind === 'opt').flatMap(x => x.ok)) {
        const o = rb.optfeatures.find(y => y.n + '|' + y.s === v);
        if (o?.pact && !pakt.includes('Pact of the ' + o.pact)) hibak.push(`${c.n} ${L}: ${o.n} Pact of the ${o.pact} nélkül`);
      }
      // a cantripes osztálynak van sebző cantripje
      const cant = cr.choices.filter(x => x.kind === 'cantrips').flatMap(x => x.ok);
      if (cant.length && !cant.some(v => { const sp = rb.spells.find(y => y.n + '|' + y.s === v); return sp && (sp.atk || /\d+d\d+[^.]{0,60}damage/i.test(sp.tx || '')); })) hibak.push(`${c.n} ${L}: nincs sebző cantrip: ${cant}`);
      if (c.n === 'Warlock' && !cant.includes('Eldritch Blast|PHB')) hibak.push(`Warlock ${L}: nincs Eldritch Blast`);
      pancel[c.n] = s.inventory.filter(i => i.equipped && /Armor|Mail|Plate|Leather/.test(i.name)).map(i => i.name);
    }));
    eq(hibak, []);
    // a felszerelés a buildhez illik: STR-es Fighternek nehéz páncél, Wizardnak nincs páncél
    eq(pancel.Wizard, []);
    ok(['Chain Mail', 'Leather Armor'].some(n => pancel.Fighter.includes(n)), 'Fighter: páncél a csomagból: ' + pancel.Fighter);
    // megadott faj és multiclass a valódi szabálykönyvvel
    vbMag(5);
    const be = {szint: 9, faj: 'Half-Elf', osztaly: 'Paladin', osztaly2: 'Sorcerer', szint2: 3}, r = W.veletlenBuild(be, rb);
    eq(vbHibak(r, be, rb), []);
    eq(r.figy, [], 'a multiclass-feltétel (STR / CHA 13) teljesül');
  }, {online: true});
  test('véletlen build valódi szabálykönyvvel: minden alosztály 6. szinten; az alosztály szerinti képesség-sorrend (EK, AT: INT; Bladesinging: DEX)', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet, hibak = [];
    for (const [i, x] of rb.subclasses.entries()) {
      vbMag(i * 13 + 1);
      const be = {szint: 6, osztaly: x.cls, alosztaly: x.n}, r = W.veletlenBuild(be, rb);
      hibak.push(...vbHibak(r, be, rb).map(h => `${x.n}: ${h}`));
      if (r.lap && r.lap.build.sub[x.cls] !== x.n + '|' + x.s) hibak.push(`${x.n}: az alosztály ${r.lap.build.sub[x.cls]}`);
      const c = r.lap && H.calc(r.lap, rb), v = a => c.abilities[a].nat ?? c.abilities[a].v;
      if (c && ['Eldritch Knight', 'Arcane Trickster'].includes(x.short) && v('int') < 13) hibak.push(`${x.n}: INT ${v('int')}`);
      if (c && x.short === 'Bladesinging' && v('dex') < 14) hibak.push(`${x.n}: DEX ${v('dex')}`);
    }
    eq(hibak, []);
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

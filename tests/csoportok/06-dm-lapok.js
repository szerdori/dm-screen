// DM Screen – regressziós tesztek: szabálykönyv és tárgy-import; karakterlap a DM Screenben (szinkron), dobáskérés, játékosok dobásai, szintlépés-engedély, varázslat sora.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

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
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await mentve();
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
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await mentve();
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
  test('oldalpanel (TERV-fejlesztesek-2026-11-21.md, 3. lépés): játékosnál a telefonos lap beágyazva (egy iframe, másik játékosnál csak a # változik), 📱 Lap / 📜 Statblokk kapcsoló megmarad; szörnynél statblokk', async () => {
    const k = W.Szerzodes.HELYI.oldalpanel, BT = W.eval('Bongeszotar'); BT.torol(k);
    const f = await loadWith({'dmscreen_library/p2': pc('Másik', 1, {id: 'p2', owner: 'b@x.hu'}), 'sheets/p2': sheetDoc({name: 'Másik', owner: 'b@x.hu'})});
    const [a] = W.addToEncounter(lib(), 1), [b] = W.addToEncounter(A('S.library').find(c => c.id === 'p2'), 1), [m] = W.addToEncounter(mk('Ogre'), 1);
    const valaszt = x => { W.eval(`selected = ${JSON.stringify(x.cid)}`); W.render(); };
    valaszt(a);
    const ifr = $('#lapNezet iframe');
    ok(!$('#lapNezet').hidden && ifr, 'a lap látszik'); eq(ifr.getAttribute('src'), 'karakter.html?beagyazva=1&test=1#lap/p1');
    ok(!$('#detail .sb'), 'nincs statblokk'); ok($('#detail [data-f="hp"]') && $('#detail [data-act="addCond"]'), 'a harci vezérlők maradnak');
    valaszt(b); ok($('#lapNezet iframe') === ifr, 'ugyanaz az iframe'); eq(ifr.getAttribute('src'), 'karakter.html?beagyazva=1&test=1#lap/p2');
    // kapcsoló: statblokk, és ez megmarad
    click('#detail [data-act="oldalNezet"][data-v="statblokk"]');
    ok($('#lapNezet').hidden && $('#detail .sb'), 'statblokk'); eq(BT.olvas(k), 'statblokk');
    valaszt(a); ok($('#lapNezet').hidden && $('#detail .sb'), 'másik játékosnál is');
    click('#detail [data-act="oldalNezet"][data-v="lap"]'); ok(!$('#lapNezet').hidden && !$('#detail .sb')); eq(BT.olvas(k), null);
    // szörny: statblokk, nincs kapcsoló
    valaszt(m); ok($('#lapNezet').hidden && $('#detail .sb') && !$('#detail [data-act="oldalNezet"]'), 'szörnynél statblokk');
    ok(!f.log.some(l => /sheets\//.test(l)), 'nem írt a lapokra: ' + f.log);
    W.eval('selected = null'); W.render();
  });
  test('＋ Inspiration a Csapat nézetben (TERV-fejlesztesek-2026-11-21.md, 7. lépés): elhasználtat visszaad, hiányzót felvesz, megvan: csak jelzi; a lapra ír', async () => {
    const f = await loadWith({'sheets/p1': sheetDoc({resources: [{name: 'Inspiration', max: 1, used: 1, reset: 'level'}, {name: 'Ki', max: 2, used: 1, reset: 'short'}]})});
    W.setPartyMember('p1', true); W.openParty();
    f.log.splice(0);
    click('#modalBox [data-act="partyInspiration"]'); await until(() => f.log.some(l => /update sheets\/p1/.test(l)));
    eq(f.store['sheets/p1'].resources.map(r => [r.name, r.used]), [['Inspiration', 0], ['Ki', 1]]);
    has($('#modalBox').textContent, 'van Inspiration'); ok(!$('#modalBox [data-act="partyInspiration"]'), 'megvan: nincs gomb');
    eq(W.inspirationAd('p1'), 'teli');
    // a lapon nincs (kézi lap): felkerül
    f.store['sheets/p1'].resources = []; f.emit('sheets'); await mentve();
    eq(W.inspirationAd('p1'), 'ad'); await until(() => f.store['sheets/p1'].resources.length === 1);
    eq(f.store['sheets/p1'].resources, [{name: 'Inspiration', max: 1, used: 0, reset: 'level'}]);
    eq(W.inspirationAd('nincs-ilyen'), '');
    W.closeModal();
  });
  test('harc: a DM sebzése mezőnként visszaíródik; a telefonos változás átjön, és nem ír vissza', async () => {
    const f = await loadWith();
    f.log.splice(0);
    const [x] = W.addToEncounter(lib(), 1);
    eq([x.hp, x.temp], [24, 0]);
    W.damage(x, 5); W.save(); await mentve();
    ok(f.log.includes('update sheets/p1 hp.cur,hp.temp'), f.log.join('; '));
    eq([f.store['sheets/p1'].hp, f.store['sheets/p1'].updatedBy], [{max: 24, cur: 19, temp: 0}, 'dm@x.hu']);
    eq([lib().hp.cur, f.store['characters/p1'].hp], [19, {cur: 19, max: 24}], 'a könyvtárba és a csapat felé is');
    f.log.splice(0);
    f.store['sheets/p1'].hp = {max: 24, cur: 22, temp: 3}; f.store['sheets/p1'].inventory.push({name: 'Rope', qty: 1}); f.store['sheets/p1'].ac = 15;
    f.emit('sheets'); await mentve();
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
    W.damage(x, 7); W.save(); await mentve();
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
    f.log.splice(0); click('[data-act="edSave"]'); await mentve();
    eq([lib().kind, lib().owner], ['npc', 'a@x.hu']);
    eq(f.store['sheets/p1'].owner, '', 'a játékos nem látja / nem szerkeszti (a szabály a lap gazdáját nézi)');
    ok(f.log.includes('update sheets/p1 owner'), f.log.join('; '));
    ok(!f.store['characters/p1'] || f.store['characters/p1'].owner === '', 'a nyilvános rész sem az övé');
    eq(nelkul(f.store['sheets/p1']), eredeti, 'a lap többi része változatlan');
    // a lap változása (pl. a DM írja a telefonján) nem állítja vissza Játékosra
    f.store['sheets/p1'].hp.cur = 16; f.emit('sheets'); await mentve();
    eq([lib().kind, lib().owner, f.store['sheets/p1'].owner], ['npc', 'a@x.hu', '']);
    f.store['sheets/p1'].hp.cur = 17; f.emit('sheets'); await mentve();
    // → Játékos: a lap visszakapja a gazdát, minden más ugyanaz
    fm = await tipus('pc');
    eq(fm.elements.owner.value, 'a@x.hu', 'az e-mail újra beírás nélkül ott van');
    f.log.splice(0); click('[data-act="edSave"]'); await mentve();
    eq([lib().kind, f.store['sheets/p1'].owner, f.store['characters/p1'].owner], ['pc', 'a@x.hu', 'a@x.hu']);
    eq(nelkul(f.store['sheets/p1']), eredeti, 'szint, választások, varázslatok, tárgyak, pénz, HP, engedély: semmi nem veszett el');
    ok(!f.log.some(l => /update sheets\/p1 (?!owner$)/.test(l)), 'csak a gazda íródott: ' + f.log.join('; '));
  });
  test('NPC-vé tett játékos betöltéskor: ha a lapon még ott a gazda (pl. elmaradt írás), mentéskor lekerül; a régebben NPC-vé tett e-mailje a lapról átmentődik', async () => {
    let f = await loadWith({'dmscreen_library/p1': pc('Régi név', 1, {id: 'p1', owner: 'a@x.hu', kind: 'npc'})});
    eq([lib().kind, lib().owner], ['npc', 'a@x.hu']);
    A('save()'); await mentve();
    eq(f.store['sheets/p1'].owner, '');
    eq(W.playerEmails(), [], 'NPC gazdája nem kerül a játékosok listájára');
    // a régi kód az NPC-ről letörölte az e-mailt, a lapon viszont megmaradt: most a könyvtárba kerül, a lapról lekerül
    f = await loadWith({'dmscreen_library/p1': pc('Régi név', 1, {id: 'p1', kind: 'npc'})});
    A('save()'); await mentve();
    eq([lib().owner, f.store['sheets/p1'].owner], ['a@x.hu', '']);
  });
  test('NPC-ként a DM szerkesztése (AC, tárgy) továbbra is a lapra kerül, a harcbeli HP nem; törölt, majd NPC-vé tett karakter visszahozva gazda nélküli lapot kap', async () => {
    const f = await loadWith({'dmscreen_library/p1': pc('Régi név', 1, {id: 'p1', owner: 'a@x.hu', kind: 'npc'})});
    A('save()'); await mentve(); f.log.splice(0);
    A('S.library[0].ac = 18; save()'); await mentve();
    eq([f.store['sheets/p1'].ac, f.store['sheets/p1'].owner], [18, '']);
    const [x] = W.addToEncounter(lib(), 1), hp0 = f.store['sheets/p1'].hp.cur;
    W.damage(x, 3); W.save(); await mentve();
    eq(f.store['sheets/p1'].hp.cur, hp0, 'NPC-ként a harcbeli sebzés nem a lapé');
    // visszahozás NPC-ként
    A('SHEETS.p1 = Sheet.norm({...SHEETS.p1, owner: "", deleted: {owner: "a@x.hu", vis: "party", at: "2026-11-01T00:00:00.000Z", by: "a@x.hu"}})');
    ok(W.lapVisszahoz('p1')); await mentve();
    eq([lib().owner, f.store['sheets/p1'].owner, f.store['sheets/p1'].deleted ?? null], ['a@x.hu', '', null]);
  });
  test('DM oldali módosítás (tárgy a Tárgyak fülről, gazda, AC a szerkesztőben) mezőnként a lapra kerül', async () => {
    const f = await loadWith();
    f.log.splice(0);
    W.addItemTo('p1', {n: 'Bag of Holding', s: 'DMG', mag: true, rar: 'uncommon'}, 1); await mentve();
    ok(f.log.includes('update sheets/p1 inventory'), f.log.join('; '));
    ok(f.store['sheets/p1'].inventory.some(i => i.name === 'Bag of Holding' && i.ref === 'Bag of Holding|DMG'));
    f.log.splice(0);
    A('S.library[0].owner = "b@x.hu"; save()'); await mentve();
    ok(f.log.includes('update sheets/p1 owner'), f.log.join('; ')); eq(f.store['sheets/p1'].owner, 'b@x.hu');
    f.log.splice(0);
    W.openLib('lib'); click('[data-act="libEdit"]');
    has($('#edForm').textContent, 'telefonos karakterlapja van');
    $('#edForm').elements.ac.value = '17'; click('[data-act="edSave"]'); await mentve();
    ok(f.log.includes('update sheets/p1 ac'), f.log.join('; ')); eq(f.store['sheets/p1'].ac, 17);
  });
  test('szabálymotoros lap: mentők és skillek a cache-ből; a DM AC- és képesség-átírása felülírásként (ov) megy a lapra', async () => {
    const H = W.Sheet, s0 = H.norm(sheetDoc({auto: true, build: {base: {cha: 16}, levels: lv('Paladin', 6)}}));
    const f = await loadWith({'sheets/p1': JSON.parse(JSON.stringify({...s0, ...H.materialize(s0, H.calc(s0, rb3()))}))});
    eq(lib().saves, {str: 3, dex: 3, con: 3, int: 3, wis: 6, cha: 9}, 'Aura of Protection: a nem jártas mentők is');
    eq([lib().skillMods.persuasion, lib().skillMods.stealth], [{b: 3, p: 0}, {b: 0, p: 0}]);
    f.log.splice(0);
    W.openLib('lib'); click('[data-act="libEdit"]');
    $('#edForm').elements.ac.value = '19'; click('[data-act="edSave"]'); await mentve();
    ok(f.log.includes('update sheets/p1 ac,ov.ac'), f.log.join('; '));
    eq([f.store['sheets/p1'].ac, f.store['sheets/p1'].ov], [19, {ac: 19}]);
    f.log.splice(0);
    A('S.library[0].abilities.str = 14; save()'); await mentve();
    ok(f.log.includes('update sheets/p1 abilities,cache,ov.ab:str'), f.log.join('; '));
    eq([f.store['sheets/p1'].ov, f.store['sheets/p1'].cache], [{ac: 19, 'ab:str': 14}, null]);
    // HP a harcból: nem felülírás
    f.log.splice(0);
    const [x] = W.addToEncounter(lib(), 1); W.damage(x, 5); W.save(); await mentve();
    ok(f.log.includes('update sheets/p1 hp.cur,hp.temp'), f.log.join('; '));
  });
  test('aktív hatás a lapon (Mage Armor) → a könyvtári AC; koncentráció a harcba és vissza (a DM kikapcsolja → a lapon is vége)', async () => {
    const f = await loadWith({'sheets/p1': sheetDoc({ac: 12, inventory: [], conditions: ['Mage Armor', 'Bless'], concentration: 'Bless'})});
    eq([lib().ac, lib().acNote], [16, 'leather armor + Mage Armor'], '13 + DEX 3');
    f.log.splice(0);
    const [x] = W.addToEncounter(lib(), 1);
    eq(x.conc, true, 'a lap koncentrációjával indul');
    W.save(); await mentve();
    ok(!f.log.some(l => /sheets\//.test(l)), 'nem ír vissza: ' + f.log);
    x.conc = false; W.save(); await mentve();
    ok(f.log.includes('update sheets/p1 concentration,conditions'), f.log.join('; '));
    eq([f.store['sheets/p1'].concentration, f.store['sheets/p1'].conditions], ['', ['Mage Armor']]);
  });
  test('állapotok a harc és a lap között oda-vissza (a körszám megmarad); AC-átírás aktív hatás mellett az alapértéket írja', async () => {
    const f = await loadWith({'sheets/p1': sheetDoc({ac: 14, conditions: ['Shield of Faith']})});
    eq(lib().ac, 16);
    f.log.splice(0);
    const [x] = W.addToEncounter(lib(), 1);
    eq(x.cond, [{name: 'Shield of Faith', rounds: null}], 'a lap állapotaival indul');
    x.cond.push({name: 'Prone', rounds: 2}); W.save(); await mentve();
    ok(f.log.includes('update sheets/p1 conditions'), f.log.join('; '));
    eq(f.store['sheets/p1'].conditions, ['Shield of Faith', 'Prone']);
    f.log.splice(0);
    f.store['sheets/p1'].conditions = ['Shield of Faith', 'Prone', 'Poisoned']; f.emit('sheets'); await mentve();
    eq(A('S.enc.list[0].cond'), [{name: 'Shield of Faith', rounds: null}, {name: 'Prone', rounds: 2}, {name: 'Poisoned', rounds: null}], 'a telefonos állapot átjön, a DM körszáma marad');
    ok(!f.log.some(l => /sheets\//.test(l)), 'nem ír vissza: ' + f.log);
    A('S.enc.list[0].cond.splice(1, 1); save()'); await mentve();
    eq(f.store['sheets/p1'].conditions, ['Shield of Faith', 'Poisoned'], 'a DM levette a Prone-t');
    W.openLib('lib'); click('[data-act="libEdit"]');
    $('#edForm').elements.ac.value = '17'; click('[data-act="edSave"]'); await mentve();
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
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await mentve();
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
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await mentve();
    const [c] = await W.importAny(W.Sheet.TEMPLATE);
    eq([c.kind, c.name, c.cr], ['pc', 'Minta Tolvaj', 'Szint 3']);
    await mentve();
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
    W.openLib('lib'); click('[data-act="libDel"]'); await mentve();
    ok(f.log.includes('del sheets/p1'), f.log.join('; ')); eq(A('Object.keys(SHEETS)'), []);
    W.importBackup(JSON.parse(JSON.stringify(file))); await mentve();
    ok(A('SHEETS.p1') && f.store['sheets/p1'], 'visszaállt');
    const bk = Object.entries(f.store).find(([k]) => k.startsWith('dmscreen_backup/'));
    ok(bk && JSON.parse(bk[1].data).sheets.length === 1, 'a napi felhős mentésben is benne van');
  });
  test('régi szabályok (a lapok nem olvashatók): a DM Screen így is betölt, a Menü szól', async () => {
    const f = makeFakeDb({...emptyState(), 'dmscreen_library/a': mk()});
    const orig = f.db.list; f.db.list = async c => { if (c === 'sheets') throw Object.assign(new Error('x'), {code: 'permission-denied'}); return orig(c); };
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await mentve();
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
  test('véletlen build az Új játékos ablakból: szabálykönyv nélkül szól; előnézet, 🎲 Újra a megadottakkal; kész, motoros lap backuppal; változott beállítás, hibás bemenet, Vissza, Mégse', async () => {
    const f = makeFakeDb(); A('Tar').kapcsol(f.db);
    let msg = ''; W.alert = m => msg = m;
    A('rulebook = null');
    W.openLib('lib'); click('[data-act="newCreature"]'); setVal($('#edForm').elements.kind, 'pc');
    click('[data-act="vbNyit"]'); await until(() => msg, 2000, 'szól, hogy nincs szabálykönyv');
    has(msg, 'szabálykönyv'); ok(!$('#vbForm'), 'szabálykönyv nélkül nem nyílik meg');
    // az előző teszt Létrehozása után késleltetve nyíló Könyvtár ne zavarjon bele: újra az Új játékos ablak
    W.openLib('lib'); click('[data-act="newCreature"]'); setVal($('#edForm').elements.kind, 'pc');
    try {
      A(`rulebook = ${JSON.stringify({version: 'v', counts: {}, rb: rbMc()})}`);
      const nj = $('#njForm'); nj.elements.name.value = '<img src=x onerror=alert(1)>'; nj.elements.owner.value = 'Jatekos@X.hu'; nj.elements.target.value = '5';
      click('[data-act="vbNyit"]'); await until(() => $('#vbForm'), 2000, 'a véletlen build ablaka');
      const fm = $('#vbForm');
      eq([fm.elements.name.value, fm.elements.owner.value, fm.elements.szint.value], ['<img src=x onerror=alert(1)>', 'jatekos@x.hu', '5'], 'az Új játékos adatai átjönnek');
      ok($('[data-act="vbLetrehoz"]').disabled, 'generálás előtt nem hozható létre');
      setVal(fm.elements.faj, 'Dwarf|PHB');
      ok([...fm.elements.alfaj.options].some(o => o.value === 'Hill|PHB'), 'a faj alfajai a listában');
      setVal(fm.elements.osztaly, 'Wizard');
      ok([...fm.elements.alosztaly.options].some(o => o.value === 'Bladesinging|TCE'), 'az osztály alosztályai a listában');
      click('[data-act="vbGeneral"]');
      has($('#vbElonezet').textContent, 'Wizard 5'); has($('#vbElonezet').textContent, 'Dwarf');
      ok(!$('[data-act="vbLetrehoz"]').disabled, 'generálás után létrehozható');
      click('[data-act="vbGeneral"]'); has($('#vbElonezet').textContent, 'Wizard 5', '🎲 Újra: a megadott osztály marad');
      eq($('[data-act="vbGeneral"]').textContent, '🎲 Újra');
      assertNoXss();
      // a generáló mező változása után újra kell generálni (a név nem számít)
      setVal(fm.elements.szint, '6');
      ok($('[data-act="vbLetrehoz"]').disabled, 'a szint változása után nem hozható létre');
      click('[data-act="vbGeneral"]'); has($('#vbElonezet').textContent, 'Wizard 6');
      setVal(fm.elements.name, '<img src=x onerror=alert(1)>', 'input');
      const n0 = A('S.library').length;
      click('[data-act="vbLetrehoz"]');
      eq(A('S.library').length, n0 + 1, 'egy új lény');
      await until(() => $('#libRows'), 2000, 'utána a Könyvtár nyílik');
      const c = A('S.library').at(-1), s = A(`SHEETS['${c.id}']`);
      eq([c.kind, c.name, c.owner, s.owner, s.auto, s.newChar, s.levelUp, W.Sheet.level(s), s.build.levels[0].c, s.build.race],
        ['pc', '<img src=x onerror=alert(1)>', 'jatekos@x.hu', 'jatekos@x.hu', true, null, null, 6, 'Wizard', 'Dwarf|PHB']);
      eq(A(`lapAllapot('${c.id}')`), 'motoros', 'kész, motoros lap (nem „készül”)');
      ok(c.hp.max > 6 && c.hp.max === s.hp.max, 'a könyvtári lény a lapról kapja a HP-t');
      await A('doSave()');
      await until(() => f.store['sheets/' + c.id] && Object.keys(f.store).some(k => k.startsWith('sheets/' + c.id + '/')), 2000, 'a lap és a kezdőállapot (backup) a felhőben');
      W.openLib('lib'); assertNoXss();
      // hibás bemenet: az előnézet szól, nem hozható létre
      click('[data-act="newCreature"]'); setVal($('#edForm').elements.kind, 'pc');
      click('[data-act="vbNyit"]'); await until(() => $('#vbForm'), 2000, 'az ablak (hibás bemenet)');
      $('#vbForm').elements.szint.value = '4'; setVal($('#vbForm').elements.osztaly, 'Wizard'); setVal($('#vbForm').elements.osztaly2, 'Wizard'); click('[data-act="vbGeneral"]');
      has($('#vbElonezet').textContent, 'ugyanaz'); ok($('[data-act="vbLetrehoz"]').disabled);
      // Vissza: az Új játékos űrlap a beírt adatokkal; Mégse: nincs új lény
      $('#vbForm').elements.owner.value = 'masik@x.hu';
      click('[data-act="vbVissza"]'); ok($('#njForm'), 'vissza az Új játékos űrlapra'); eq($('#njForm').elements.owner.value, 'masik@x.hu');
      // a Kész build ablakban nem szereplő beállítások (képesség-módszer, felszerelés) is megmaradnak
      $('#njForm').elements.m_roll.checked = false; $('#njForm').elements.equip.value = 'gold';
      click('[data-act="vbNyit"]'); await until(() => $('#vbForm'), 2000, 'az ablak (módszerek)'); click('[data-act="vbVissza"]');
      eq([$('#njForm').elements.m_roll.checked, $('#njForm').elements.m_array.checked, $('#njForm').elements.equip.value], [false, true, 'gold']);
      const n1 = A('S.library').length;
      click('[data-act="vbNyit"]'); await until(() => $('#vbForm'), 2000, 'az ablak (Mégse) ' + msg); click('[data-act="vbGeneral"]'); click('[data-act="edCancel"]');
      eq(A('S.library').length, n1, 'Mégse után nincs új lény');
    } finally { A('rulebook = null'); }
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

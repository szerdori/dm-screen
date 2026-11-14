// DM Screen – regressziós tesztek: játékos app láthatósága és közzététele; karakterlap formátuma (sheet.js), szabálymotor (2. fázis).
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

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
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
    eq(f.log.splice(0).filter(l => !l.includes('backup')).sort(), ['set access/players', 'set characters/n1', 'set characters/p1', 'set characters/p2'], 'első betöltéskor közzéteszi');
    eq(f.store['access/players'], {emails: ['a@x.hu', 'b@x.hu']});
    A('S.library.find(c => c.id === "p1").notes = "titok"; save()'); await mentve();
    eq(f.log.splice(0), ['set dmscreen_library/p1'], 'a titkos rész változása nem írja a nyilvánost');
    A('S.library.find(c => c.id === "n1").share.vis = "dm"; save()'); await mentve();
    eq(f.log.splice(0).sort(), ['del characters/n1', 'set dmscreen_library/n1']);
    A('S.library.find(c => c.id === "p2").owner = "c@x.hu"; save()'); await mentve();
    eq(f.log.splice(0).sort(), ['set access/players', 'set characters/p2', 'set dmscreen_library/p2']);
    eq(f.store['access/players'], {emails: ['b@x.hu', 'c@x.hu']});
  });
  test('újratöltéskor a más mezősorrendben tárolt közzétett adat nem íródik újra', async () => {
    const f = makeFakeDb({'dmscreen/state': {enc: {list: [], round: 1, active: null}, settings: {}}, 'dmscreen_library/p1': pc('Rella', 3, {owner: 'a@x.hu'})});
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
    ok(f.store['characters/p1'], 'közzétette');
    f.store['characters/p1'] = Object.fromEntries(Object.entries(f.store['characters/p1']).reverse());
    fresh(); f.log.splice(0);
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
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

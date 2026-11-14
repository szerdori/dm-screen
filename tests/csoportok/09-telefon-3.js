// DM Screen – regressziós tesztek: telefonos karakterlap, 3. rész: fegyverek, szerkesztés, faj és háttér, hatások, HP, hangolás.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

describe('Telefonos karakterlap (karakter.html)', () => {
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

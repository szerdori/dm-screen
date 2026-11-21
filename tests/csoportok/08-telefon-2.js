// DM Screen – regressziós tesztek: telefonos karakterlap, 2. rész: új karakter, választók, fülek, gesztusok, megjelenítés (betűméret, téma), dobások.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

describe('Telefonos karakterlap (karakter.html)', () => {
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
    // (a Chrome 158 a flex-startot „flow-start”-ként adja vissza, 2026-11-21)
    ok(['flex-start', 'flow-start'].includes(K.getComputedStyle(kq('.chips button.chip')).justifyContent), 'az Initiative is felülre igazítva');
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
  test('varázslatok kerete (TERV-oldalpanel-bekeszites.md, 2. lépés): Sheet.varazslatKeret – bekészítve, ismert, cantrip; a mindig bekészített és a Mystic Arcanum nem számít; kézi lapon nincs', () => {
    const H = W.Sheet, sp = (name, level, x = {}) => ({name, level, prepared: true, ...x});
    const lap = (spells, cache) => H.norm({auto: true, build: {levels: [], spells: {}}, cache: {spells: cache, atk: 1}, spells});
    const k = lap([sp('A', 1), sp('B', 1), sp('C', 2, {prepared: false}), sp('Dom', 1, {always: true}), sp('X', 0), sp('Y', 0)], [{cls: 'Cleric', ab: 'wis', dc: 13, atk: 5, prep: 2, cantrips: 3}]);
    eq(H.varazslatKeret(k), [{cls: 'Cleric', prep: {n: 2, max: 2}, known: null, cantrip: {n: 2, max: 3}, tul: []}]);
    const t = H.varazslatKeret(lap([sp('A', 1), sp('B', 1), sp('C', 1)], [{cls: 'Cleric', ab: 'wis', dc: 13, atk: 5, prep: 2}]))[0].tul;
    eq(t, [{mit: 'prep', n: 3, max: 2}]);
    // Warlock: a Mystic Arcanum (6+) nem ismert varázslat; multiclassnál a varázslat osztálya dönt
    const w = lap([sp('H', 1, {cls: 'Warlock'}), sp('M', 6, {cls: 'Warlock'}), sp('S', 1, {cls: 'Wizard'}), sp('N', 1)], [{cls: 'Warlock', ab: 'cha', dc: 13, atk: 5, prep: 0, known: 1}, {cls: 'Wizard', ab: 'int', dc: 13, atk: 5, prep: 1}]);
    eq(H.varazslatKeret(w).map(x => [x.cls, x.known, x.prep, x.tul.length]), [['Warlock', {n: 1, max: 1}, null, 0], ['Wizard', null, {n: 1, max: 1}, 0]]);
    eq(H.varazslatKeret(H.norm({spells: [sp('A', 1)]})), [], 'kézi lapon nincs');
    // gonosz osztálynév a cache-ben, túllépéssel: a Varázslat fül, a multiclass-fejléc, a DM jelvénye és statblokkja sem futtatja
    const gonosz = '<img src=x onerror=window.__x8=1>';
    const g = lap([sp('A', 1, {cls: gonosz}), sp('B', 1, {cls: gonosz}), sp('C', 1, {cls: 'Cleric'})], [{cls: gonosz, ab: 'int', dc: 13, atk: 5, prep: 1}, {cls: 'Cleric', ab: 'wis', dc: 13, atk: 5, prep: 1}]);
    K.eval(`{ const s = H.norm(${JSON.stringify(g)}); $('#main').innerHTML = tabVar(s, true); }`);
    ok(K.document.querySelector('#main .keretwarn'), 'van ⚠'); ok(!K.__x8 && !K.document.querySelector('#main img'), 'nincs befecskendezés a lapon');
    W.eval(`SHEETS.__x = Sheet.norm(${JSON.stringify(g)})`);
    const box = W.document.createElement('div'); box.innerHTML = W.lapJelveny('__x') + W.eval('esc')(W.sheetToCreature(W.eval('SHEETS.__x'), {kind: 'pc'}).traits.find(x => x.name === 'Varázslatok').text);
    ok(!W.__x8 && !box.querySelector('img'), 'nincs befecskendezés a DM-nél'); W.eval('delete SHEETS.__x');
    eq(H.norm({auto: true, build: {}, cache: {spells: [{cls: 'Bard', dc: 12, atk: 4, known: 'x', cantrips: 200}]}}).cache.spells[0], {cls: 'Bard', ab: '', dc: 12, atk: 4, cantrips: 99});
  });
  ktest('varázslatok kerete a lapon: kiírás egy osztálynál, ⚠ túllépéskor, rákérdezés a pipánál és a ＋-nál; a DM statblokkja és jelvénye', () => {
    const rb = rbVarazs(); K.KApp.setRulebook({version: 'v', rb});
    const sp = (name, level, prepared = true) => ({name, level, prepared});
    const lap = spells => { K.eval('calcSig.clear()'); openSheet({auto: true, build: {base: {wis: 16}, levels: lv('Cleric', 1), spells: {}}, classes: [{name: 'Cleric', level: 1}], spells}); };
    lap([sp('Bless', 1), sp('Bane', 1, false)]);  // Cleric 1, WIS +3: 4 bekészíthető
    kclick('[data-tab="var"]');
    const max = K.eval('sheets.get("p1")').cache.spells[0].prep;
    has(ktext(), `bekészítve 1 / ${max}`); ok(!kq('.keretwarn'), 'nincs ⚠');
    // túllépés: ⚠ sor, és a pipa rákérdez (Mégse = marad)
    const sok = Array.from({length: max}, (_, i) => sp('Teszt ' + i, 1));
    lap([...sok, sp('Bane', 1, false)]); kclick('[data-tab="var"]');
    has(ktext(), `bekészítve ${max} / ${max}`);
    let kerdes = ''; K.confirm = m => { kerdes = m; return false; };
    const m = klog.length; kset('details[data-key="sp:Bane"] [data-act="prep"]', true);
    has(kerdes, `Már ${max} bekészítve van, ${max} jár. Mégis bekészíted?`); eq(klog.length, m, 'Mégse: nem írt'); ok(!kq('details[data-key="sp:Bane"] [data-act="prep"]').checked);
    K.confirm = () => true; kset('details[data-key="sp:Bane"] [data-act="prep"]', true);
    eq(lastUpdate().spells.find(x => x.name === 'Bane').prepared, true);
    lap([...sok, sp('Bane', 1)]); kclick('[data-tab="var"]');
    has(kq('.keretwarn').textContent, `Több varázslat van bekészítve, mint amennyi jár: ${max + 1} / ${max}`);
    // DM statblokk
    const t = W.sheetToCreature(K.eval('sheets.get("p1")'), {kind: 'pc'}).traits.find(x => x.name === 'Varázslatok').text;
    has(t, `bekészítve ${max + 1}/${max} ⚠`);
    // levétel kérdés nélkül
    kerdes = ''; K.confirm = m => { kerdes = m; return true; }; kset('details[data-key="sp:Bane"] [data-act="prep"]', false); eq(kerdes, '');
    // a keresőből (＋) a cantrip a kereten felül: rákérdez
    kclick('[data-tab="var"]'); kerdes = ''; K.confirm = m => { kerdes = m; return false; };
    const c0 = rb.spells.find(x => !x.l && (x.cl || []).includes('Cleric'));
    ok(c0, 'van Cleric cantrip a mintában');
    {
      const cmax = K.eval('sheets.get("p1")').cache.spells[0].cantrips || 0;
      K.eval(`sheets.get("p1").spells.push(...Array.from({length: ${cmax}}, (_, i) => ({name: 'C' + i, level: 0, prepared: true})))`);
      const m2 = klog.length; K.eval('LAP_AKCIOK.spellAdd')({dataset: {ref: K.eval('H.refOf')(c0)}}, K.eval('sheets.get("p1")'));
      has(kerdes, 'cantrip van'); has(kerdes, 'hozzáadod'); eq(klog.length, m2, 'Mégse: nem vette fel');
    }
    // kézi lapon a régi felirat
    openSheet({spells: [sp('Bless', 1)]}); kclick('[data-tab="var"]'); has(ktext(), '(1 bekészítve)'); ok(!kq('.keretwarn'));
  });
  ktest('beágyazva (?beagyazva=1, TERV-fejlesztesek-2026-11-21.md, 3. lépés): nincs fejléc és ‹ Vissza, lap nélkül nincs lap-lista; a lap ugyanaz', async () => {
    try {
      K.eval('beagyazva = true; document.documentElement.dataset.beagyazva = "1"');
      openSheet();
      eq([K.getComputedStyle(kq('body>header')).display, K.getComputedStyle(kq('.top>a[href="#"]')).display], ['none', 'none']);
      ok(kq('nav.tabs') && kq('[data-act="d20"]'), 'a fülek és a dobógombok megvannak');
      K.location.hash = ''; K.route();
      has(ktext(), 'Nincs kiválasztott lap'); ok(!kq('#main a[href^="#lap/"]'), 'nincs lap-lista');
      K.location.hash = '#lap/nincs'; K.route(); has(ktext(), 'A lap betöltése');
    } finally { K.eval('beagyazva = false; delete document.documentElement.dataset.beagyazva'); }
    openSheet(); ok(K.getComputedStyle(kq('body>header')).display !== 'none', 'nem beágyazva: van fejléc');
  });
  ktest('Harness Divine Power (TERV-fejlesztesek-2026-11-21.md, 4. lépés): a Channel Divinity is fogy; elfogyva kérdez; visszavonás mindkettőt visszaadja; slot visszaadása ⌈PB/2⌉ szintig', () => {
    const H = W.Sheet;
    const lap = (cd = 0, hdp = 0, used = [1, 2, 1], level = 6) => openSheet({classes: [{name: 'Cleric', level}], spellcasting: {ability: 'wis', slots: [4, 3, 3], used, pact: {level: 0, max: 0, used: 0}},
      resources: [{name: 'Channel Divinity', max: 2, used: cd, reset: 'short'}, {name: 'Harness Divine Power', max: 2, used: hdp, reset: 'long'}, {name: 'Ki', max: 2, used: 0, reset: 'short'}]});
    const pip = (n, j) => kclick(kqa('[data-act="res"]').find(b => b.dataset.i === String(n) && b.dataset.j === String(j)));
    const used = () => lastUpdate().resources.map(r => r.used);
    lap(); pip(1, 0); eq(used(), [1, 1, 0], 'HDP → CD is');
    // a slot-választó: PB 3 → legfeljebb 2. szint; elhasznált 1. és 2. szintű
    eq(kqa('#slotVissza [data-act="slotVissza"]').map(b => b.textContent), ['1. szint', '2. szint']);
    kclick('#slotVissza [data-act="slotVissza"][data-l="1"]'); eq(lastUpdate().spellcasting.used.slice(0, 3), [1, 1, 1]); ok(!kq('#slotVissza'), 'eltűnt');
    // visszavonás: mindkettő vissza, nincs slot-választó
    lap(1, 1); pip(1, 0); eq(used(), [0, 0, 0]); ok(!kq('#slotVissza'), 'visszavonásnál nincs');
    // csak CD: a HDP nem változik
    lap(); pip(0, 0); eq(used(), [1, 0, 0]); ok(!kq('#slotVissza'));
    // elfogyott CD: kérdés; Mégse = semmi
    lap(2, 0); const m = klog.length; K.confirm = () => false; pip(1, 0); eq(klog.length, m, 'Mégse: nem írt');
    K.confirm = () => true; pip(1, 0); eq(used(), [2, 1, 0]);
    // „Most nem”; elhasznált slot nélkül nincs gomb
    lap(0, 0, [0, 0, 0]); pip(1, 0); eq(kqa('#slotVissza [data-act="slotVissza"]').length, 0); has(kq('#slotVissza').textContent, 'nincs elhasznált slot');
    kclick('#slotVissza [data-act="slotMostNem"]'); ok(!kq('#slotVissza'));
    // PB 2 (5. szint alatt): legfeljebb 1. szint
    lap(0, 0, [1, 1, 0], 3); pip(1, 0); eq(kqa('#slotVissza [data-act="slotVissza"]').map(b => b.dataset.l), ['0']);
    // a függvény: TCE-feature nélküli Clericnél (nincs HDP) a CD önmagában; ismeretlen index
    const s = H.norm({classes: [{name: 'Cleric', level: 6}], resources: [{name: 'Channel Divinity', max: 2}]});
    eq(H.resKapcsolt(s, 0, 1), {resources: [{name: 'Channel Divinity', max: 2, used: 1, reset: 'long'}], cel: null, elfogyott: false, slotMax: 0});
    eq(H.resKapcsolt(s, 5, 1).resources, s.resources);
  });
  test('Inspiration (TERV-fejlesztesek-2026-11-21.md, 7. lépés): „level” visszatöltés (norm, pihenők, szintlépés); minden motoros lapon max 1, a DM felülírhatja', () => {
    const H = W.Sheet, rb = rbVarazs();
    eq(H.norm({resources: [{name: 'A', reset: 'level'}, {name: 'B', reset: 'rossz'}]}).resources.map(r => r.reset), ['level', 'long']);
    const s = H.norm({resources: [{name: 'Inspiration', max: 1, used: 1, reset: 'level'}, {name: 'Ki', max: 2, used: 2, reset: 'short'}, {name: 'Pálca', max: 1, used: 1, reset: 'long'}]});
    eq(H.shortRest(s).resources.map(r => r.used), [1, 0, 1]);
    eq(H.longRest(s).resources.map(r => r.used), [1, 0, 0]);
    // motoros lap: megjelenik (max 1, szintlépéskor), a felülírás 2 / 0
    const m = extra => { const a = H.norm({auto: true, build: {base: {}, levels: lv('Fighter', 2), spells: {}}, classes: [{name: 'Fighter', level: 2}], ...extra}); return H.norm({...a, ...H.materialize(a, H.calc(a, rb))}); };
    const a = m();
    eq(a.resources.find(r => r.name === 'Inspiration'), {name: 'Inspiration', max: 1, used: 0, reset: 'level', auto: true});
    eq(m({ov: {'res:Inspiration': 2}}).resources.find(r => r.name === 'Inspiration').max, 2);
    ok(!m({ov: {'res:Inspiration': 0}}).resources.some(r => r.name === 'Inspiration'), '0 = nincs');
    eq(H.norm({ov: {'res:Inspiration': 'x', 'res:Más': 3}}).ov, {'res:Inspiration': 1});
    // az újraszámolás megtartja az elhasználtat; a szintlépés visszatölti, a többi erőforrás elhasználtsága marad
    const used = H.norm({...a, resources: a.resources.map(r => ({...r, used: r.max}))});
    eq(H.norm({...used, ...H.materialize(used, H.calc(used, rb))}).resources.find(r => r.name === 'Inspiration').used, 1);
    const lu = H.levelUpApply(used, rb, {...used.build, levels: lv('Fighter', 3)}), n = H.norm({...used, ...lu});
    eq(n.resources.find(r => r.name === 'Inspiration').used, 0);
    ok(n.resources.filter(r => r.name !== 'Inspiration').every(r => r.used === Math.min(r.max, used.resources.find(x => x.name === r.name)?.used ?? 0)), 'a többi marad');
    // multiclass-szintlépésnél is
    const mc = H.levelUpApply(used, rb, {...used.build, levels: [...lv('Fighter', 2), ...lv('Wizard', 1)]});
    eq(H.norm({...used, ...mc}).resources.find(r => r.name === 'Inspiration').used, 0);
    eq(H.resLeiras(a, a.resources.find(r => r.name === 'Inspiration'), rb).src, 'program');
  });
  ktest('Inspiration a telefonos lapon: a kézi űrlap legördülőjében „szintlépéskor”; a DM felülírási sora; a Harc fülön a pötty', () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet({resources: [{name: 'Inspiration', max: 1, used: 0, reset: 'level'}]});
    has(ktext(), '1 / 1 · szintlépéskor');
    kclick('[data-tab="adat"]');
    ok([...kq('[name="rs_reset_0"]').options].some(o => o.value === 'level' && o.selected && o.textContent === 'szintlépéskor'), 'a legördülőben');
    // motoros lap: a felülírás sora csak a DM-nek
    const auto = {auto: true, build: {base: {}, levels: lv('Fighter', 2), spells: {}}, classes: [{name: 'Fighter', level: 2}]};
    openSheet(auto); kclick('[data-tab="adat"]'); ok(!kq('[data-ov="res:Inspiration"]'), 'a játékosnak nincs');
    openSheet(auto, 'dm@x.hu', true); kclick('[data-tab="adat"]'); ok(kq('[data-ov="res:Inspiration"]'), 'a DM-nek van');
  });
  ktest('erőforrás leírása (TERV-fejlesztesek-2026-11-21.md, 8. lépés): a névre koppintva saját leírás → jellemző → szabálykönyv → „Nincs leírás”; az ablakban írható; a pötty marad; kézi űrlap', () => {
    const H = W.Sheet, rb = rbVarazs(); rb.features.push({n: 'Wild Shape', cls: 'Druid', lvl: 2, s: 'PHB', tx: 'Synthetic wild shape text.'});
    K.KApp.setRulebook({version: 'v', rb});
    openSheet({resources: [{name: 'Ki', max: 2, used: 0, reset: 'short', desc: 'Saját ki-szöveg ' + XSS}, {name: 'Harness Divine Power', max: 1, used: 0, reset: 'long'},
      {name: 'Wild Shape', max: 2, used: 0, reset: 'short'}, {name: 'Titok', max: 1, used: 0, reset: 'none'}],
      features: [{name: 'Channel Divinity: Harness Divine Power', text: 'Jellemző-szöveg HDP.'}]});
    const pop = () => kq('#infoPop'), nyit = n => kclick(kqa('[data-act="leiras"][data-lr="res"]').find(b => b.textContent === n));
    const m = klog.length;
    nyit('Ki'); eq(klog.length, m, 'nem írt'); has(pop().textContent, 'Saját ki-szöveg'); has(pop().textContent, '2 / 2 · short rest'); has(pop().textContent, 'saját leírás');
    ok(!K.__xss && !kq('#infoPop img'), 'nincs befecskendezés');
    nyit('Harness Divine Power'); has(pop().textContent, 'Jellemző-szöveg HDP.'); has(pop().textContent, 'a lap jellemzőjéből');
    nyit('Wild Shape'); has(pop().textContent, 'Synthetic wild shape text.'); has(pop().textContent, 'a szabálykönyvből');
    nyit('Titok'); has(pop().textContent, 'Nincs leírás. Lent adhatsz hozzá.');
    // az ablakban írt leírás a lapra kerül; üresre törölve a mező eltűnik
    kq('#resDescIn').value = 'Új titok-leírás'; kclick(pop().querySelector('[data-act="resDescMent"]'));
    ok(pop().hidden); eq(lastUpdate().resources[3].desc, 'Új titok-leírás');
    nyit('Titok'); kq('#resDescIn').value = '  '; kclick(pop().querySelector('[data-act="resDescMent"]')); ok(!('desc' in lastUpdate().resources[3]), 'üres: nincs desc');
    // a pötty továbbra is elhasznál
    kclick(kqa('[data-act="res"]').find(b => b.dataset.i === '0')); eq(lastUpdate().resources[0].used, 1);
    // idegen (csak olvasható) lapon nincs szerkesztő
    openSheet({resources: [{name: 'Ki', max: 2, used: 0, reset: 'short'}]}, 'mas@x.hu');
    nyit('Ki'); ok(!kq('#resDescIn') && !kq('[data-act="resDescMent"]'), 'nincs szerkesztés'); has(pop().textContent, 'Nincs leírás.');
    // kézi lap: Alapadatok űrlap
    openSheet({resources: [{name: 'Pálca', max: 3, used: 1, reset: 'long'}]});
    kclick('[data-tab="adat"]'); kset('[name="rs_desc_0"]', 'Pálca töltései', 'input'); kclick('[data-act="edSave"]');
    eq(lastUpdate().resources[0].desc, 'Pálca töltései');
    // motoros lap: a saját erőforrás űrlapja (autoForm)
    openSheet({auto: true, build: {base: {}, levels: lv('Fighter', 1), spells: {}}, classes: [{name: 'Fighter', level: 1}], resources: [{name: 'Pálca', max: 3, used: 1, reset: 'long'}]});
    kclick('[data-tab="adat"]'); kset('[name="rs_desc_0"]', 'Motoros pálca', 'input'); kclick('[data-act="edSave"]');
    eq(lastUpdate().resources.find(r => r.name === 'Pálca').desc, 'Motoros pálca');
    // norm: 1000 karakterre vág, üreset nem tárol; gonosz típus
    eq(H.norm({resources: [{name: 'A', desc: 'x'.repeat(1500)}]}).resources[0].desc.length, 1000);
    ok(!('desc' in H.norm({resources: [{name: 'A', desc: ''}, {name: 'B', desc: {a: 1}}]}).resources[1]), 'objektum nem desc');
    eq(H.resLeiras(H.norm({}), {name: '__proto__'}, rb), {src: '', tx: ''});
  });
  test('erőforrás leírása: a motor újraszámolása (materialize) és az előzmény visszaállítása megtartja a számolt erőforrás saját leírását', () => {
    const H = W.Sheet, rb = rbArany();
    const s = H.norm({auto: true, build: {base: {str: 16}, levels: lv('Barbarian', 2), spells: {}}, classes: [{name: 'Barbarian', level: 2}]});
    const s1 = H.norm({...s, ...H.materialize(s, H.calc(s, rb))});
    const i = s1.resources.findIndex(r => r.name === 'Rage'); ok(i >= 0 && s1.resources[i].auto, 'a Rage számolt');
    const s2 = H.norm({...s1, resources: s1.resources.map((r, k) => k === i ? {...r, desc: 'Dühroham, saját szöveg'} : r)});
    const s3 = H.norm({...s2, ...H.materialize(s2, H.calc(s2, rb))});
    eq(s3.resources.find(r => r.name === 'Rage').desc, 'Dühroham, saját szöveg');
    const vissza = H.restorePatch(s2, {sheet: s1, reason: 'manual'}, rb);
    eq(vissza.resources.find(r => r.name === 'Rage').desc, 'Dühroham, saját szöveg');
  });
  ktest('állapot leírása (TERV-fejlesztesek-2026-11-21.md, 1. lépés): mind a 14 állapotnak és az Exhaustion 1–6. szintjének van szövege; a felső sáv címkéje a felugró ablakot nyitja (magyar + PHB); saját állapot', () => {
    const H = W.Sheet;
    for (const c of H.CONDITIONS) ok(H.condLeiras(c).hu.length > 20, c);
    eq(H.condLeiras('Exhaustion 3').szintek.map(x => x.l), [1, 2, 3]); eq(H.condLeiras('Exhaustion').szintek.length, 6);
    ok(H.condLeiras('Exhaustion 6').szintek.every(x => x.t), 'egyik szint sem üres');
    eq([H.condLeiras('poisoned').hu === H.condLeiras('Poisoned').hu, H.condLeiras('__proto__').hu, H.condLeiras('Saját').hu, H.condLeiras(null).n], [true, '', '', '']);
    eq(H.condLeiras('Bless').fx, '+1d4 a támadásra és a mentőre');
    const rb = rbVarazs(); rb.conditions = [{n: 'Poisoned', s: 'PHB', tx: 'Synthetic english text.'}];
    eq(H.condLeiras('Poisoned', rb).en, 'Synthetic english text.');
    K.KApp.setRulebook({version: 'v', rb});
    openSheet({conditions: ['Poisoned', 'Bless', XSS], exhaustion: 2});
    const pop = () => kq('#infoPop'), chip = t => kqa('.fxbar .fxchip').find(b => b.textContent === t);
    eq(kqa('.fxbar .fxchip').map(b => [b.tagName, b.dataset.act, b.dataset.lr]).slice(0, 1), [['BUTTON', 'leiras', 'cond']]);
    const m = klog.length;
    kclick(chip('Poisoned'));
    eq(klog.length, m, 'nem írt');
    ok(!pop().hidden); has(pop().textContent, 'Hátrányos a támadásod'); has(pop().textContent, 'PHB (angolul)'); has(pop().textContent, 'Synthetic english text.');
    ok(!pop().textContent.includes('undefined'), 'nincs undefined');
    kclick(pop().querySelector('[data-act="infoClose"]')); ok(pop().hidden);
    kclick(chip('Bless')); has(pop().textContent, '✨ Hatás: +1d4'); ok(!pop().textContent.includes('PHB'), 'a Blessnek nincs PHB-állapotszövege');
    kclick(chip('Exhaustion 2')); has(pop().textContent, '2. szint: A speeded a felére'); ok(!pop().textContent.includes('3. szint'), 'csak a 2. szintig');
    kclick(chip(XSS)); has(pop().textContent, 'Saját állapot, nincs leírás.'); ok(!K.__xss && !kq('#infoPop img') && !kq('main img'), 'nincs befecskendezés');
    // a Harc fül lenyitható sorában is a magyar összefoglaló
    kclick('[data-tab="harc"]'); has(kq('details[data-key="cond:Poisoned"]').textContent, 'Hátrányos a támadásod');
    // 320 px-en a sáv nem lóg ki
    K.frameElement.width = 320; ok(kq('.fxbar').scrollWidth <= kq('.fxbar').clientWidth + 1, 'nem lóg ki');
  });
  ktest('varázsképesség-módosító a sebzésben (TERV-fejlesztesek-2026-11-21.md, 2. lépés): a leírás „+ your spellcasting ability modifier”-e, Potent Spellcasting, Empowered Evocation; gyógyítás flavour nélkül', () => {
    const rb = rbVarazs(), sp = (n, l, sc, cl, tx) => ({n, s: 'PHB', l, sc, cl, tx});
    // szintetikus szövegek (nem a PHB-é), csak a felismert minták
    rb.spells.push(sp('Teszt Gyógyszó', 1, 'evocation', ['Cleric', 'Bard'], 'A creature of your choice regains hit points equal to 1d4 + your spellcasting ability modifier.'),
      sp('Teszt Seb', 1, 'evocation', ['Cleric'], 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.'),
      sp('Teszt Fegyver', 2, 'evocation', ['Cleric'], 'Make a melee spell attack. On a hit, the target takes force damage equal to 1d8 + your spellcasting ability modifier.'),
      sp('Teszt Szent Láng', 0, 'evocation', ['Cleric'], 'The target must succeed on a Dexterity saving throw or take 1d8 radiant damage. Grows when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).'),
      sp('Teszt Tűzgolyó', 3, 'evocation', ['Wizard', 'Sorcerer'], 'Each creature must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save.'),
      sp('Teszt Bűbáj', 1, 'enchantment', ['Wizard'], 'The target takes 3d6 psychic damage.'),
      sp('Teszt Ismeretlen', 1, 'evocation', ['Cleric'], 'The target regains hit points equal to 1d6 + your favourite number.'));
    K.KApp.setRulebook({version: 'v', rb});
    const ab = (wis, int = 10) => ({str: 10, dex: 10, con: 10, int, wis, cha: 10});
    const lap = (extra) => { openSheet({spellcasting: {ability: '', slots: [4, 3, 3], used: [], pact: {level: 0, max: 0, used: 0}}, ...extra}); kclick('[data-tab="var"]'); };
    const sor = n => kqa('details').find(d => d.dataset.key === 'sp:' + n).querySelector('summary');
    const r = n => { const e = sor(n), b = e.querySelector('[data-act="dmg"]'); return {t: e.querySelector('.nm').textContent, dmg: b?.dataset.expr, label: b?.dataset.label, dt: b?.dataset.dt}; };
    const spells = ns => ns.map(([name, level, cls]) => ({name, level, cls: cls || '', prepared: true}));
    // Cleric 8 (WIS 18, +4), Potent Spellcasting
    lap({classes: [{name: 'Cleric', level: 8}], abilities: ab(18), features: [{name: 'Potent Spellcasting', text: ''}],
      spells: spells([['Teszt Gyógyszó', 1], ['Teszt Seb', 1], ['Teszt Fegyver', 2], ['Teszt Szent Láng', 0], ['Teszt Ismeretlen', 1]])});
    eq([r('Teszt Gyógyszó').dmg, r('Teszt Seb').dmg, r('Teszt Fegyver').dmg, r('Teszt Szent Láng').dmg], ['1d4+4', '1d8+4', '1d8+4', '2d8+4']);
    has(r('Teszt Gyógyszó').t, 'WIS-módosító: +4'); has(r('Teszt Gyógyszó').t, 'gyógyítás'); has(r('Teszt Szent Láng').t, 'Potent Spellcasting: +4');
    eq([r('Teszt Gyógyszó').label, r('Teszt Gyógyszó').dt], ['Teszt Gyógyszó – gyógyítás', '']);
    eq([r('Teszt Fegyver').label, r('Teszt Fegyver').dt], ['Teszt Fegyver', 'force']);
    ok(!r('Teszt Fegyver').t.includes('gyógyítás') && !r('Teszt Fegyver').t.includes('Potent'), 'a sebző 2. szintű nem gyógyítás, a Potent csak cantrip');
    eq(r('Teszt Ismeretlen').dmg, '1d6'); ok(!r('Teszt Ismeretlen').t.includes('undefined'), 'ismeretlen szöveg: nincs bónusz');
    // a gyógyítás dobása flavour nélkül, a teljes kifejezéssel kerül a lapra
    K.rnd = () => 3; kclick(sor('Teszt Gyógyszó').querySelector('[data-act="dmg"]'));
    const d = lastUpdate().rolls[0]; eq([d.label, d.total, 'dt' in d], ['Teszt Gyógyszó – gyógyítás', '7', false]); has(d.detail, '1d4+4');
    // negatív módosító
    lap({classes: [{name: 'Cleric', level: 1}], abilities: ab(8), spells: spells([['Teszt Gyógyszó', 1]])});
    eq(r('Teszt Gyógyszó').dmg, '1d4-1');
    // multiclass (Cleric 8 / Wizard 10, a varázslat osztályának módosítója): Potent csak a Cleric cantripen, Empowered Evocation csak Wizard evocationön
    lap({classes: [{name: 'Cleric', level: 8}, {name: 'Wizard', level: 10}], abilities: ab(14, 18), spellcasting: {ability: 'wis', slots: [4, 3, 3], used: [], pact: {level: 0, max: 0, used: 0}},
      features: [{name: 'Potent Spellcasting', text: ''}, {name: 'Empowered Evocation', text: ''}],
      spells: spells([['Teszt Szent Láng', 0, 'Cleric'], ['Fire Bolt', 0, 'Wizard'], ['Teszt Tűzgolyó', 3, 'Wizard'], ['Teszt Bűbáj', 1, 'Wizard'], ['Teszt Gyógyszó', 1, 'Cleric']])});
    has(r('Teszt Szent Láng').t, 'Potent Spellcasting: +2'); ok(!r('Fire Bolt').t.includes('Potent'), 'Wizard-cantrip nem kap Potentet');
    has(r('Teszt Tűzgolyó').t, 'Empowered Evocation: +4'); eq(r('Teszt Tűzgolyó').dmg, '8d6+4');
    ok(!r('Teszt Bűbáj').t.includes('Empowered'), 'nem evocation: nincs');
    // a kézi lap varázsképessége (WIS) helyett multiclassnál is a lap egy sora, kézi lapon az osztály nélküli varázslat: a lap varázsképessége
    has(r('Teszt Gyógyszó').t, 'WIS-módosító: +2');
    // a függvény maga: osztály nélküli varázslatnál a szabálykönyv osztálylistája dönt
    const H = W.Sheet, s = H.norm({...sheetDoc(), classes: [{name: 'Cleric', level: 8}], abilities: ab(18), features: [{name: 'Potent Spellcasting'}]});
    eq(H.spellBonuszok(s, {name: 'X', level: 0}, {tx: '1d8 radiant damage', cl: ['Wizard']}), []);
    eq(H.spellBonuszok(s, {name: 'X', level: 0}, {tx: '1d8 radiant damage', cl: ['Cleric']}), [{v: 4, src: 'Potent Spellcasting'}]);
    eq(H.spellBonuszok(s, {name: 'X', level: 0}, null), []);
  });
  ktest('ábécérend (TERV-fejlesztesek-2026-11-21.md, 5. lépés): a Varázslat fülön szintenként (multiclassnál osztályonként) név szerint; a gombok a jó varázslatra hatnak; a DM statblokkjában is', () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    const sp = (name, level, cls = '', prepared = false) => ({name, level, cls, prepared});
    openSheet({spells: [sp('Sleep', 1), sp('light', 0), sp('Bless', 1), sp('Mage Hand', 0), sp('Fire Bolt', 0), sp('Charm Person', 1, '', true)]});
    kclick('[data-tab="var"]');
    const nevek = () => kqa('details[data-key^="sp:"]').map(d => d.dataset.key.slice(3));
    eq(nevek(), ['Fire Bolt', 'light', 'Mage Hand', 'Bless', 'Charm Person', 'Sleep']);
    // a tárolt sorrend nem változik; a bekészítés pipája az eredeti indexre hat
    kset('details[data-key="sp:Bless"] [data-act="prep"]', true);
    eq(lastUpdate().spells.map(x => [x.name, !!x.prepared]),
      [['Sleep', false], ['light', false], ['Bless', true], ['Mage Hand', false], ['Fire Bolt', false], ['Charm Person', true]]);
    // multiclass: osztályonként külön rendezve
    openSheet({auto: true, build: {base: {wis: 14, int: 16}, levels: [...lv('Cleric', 3), ...lv('Wizard', 2)], spells: {}}, classes: [{name: 'Cleric', level: 3}, {name: 'Wizard', level: 2}],
      spells: [sp('Shield', 1, 'Wizard'), sp('Bless', 1, 'Cleric'), sp('Alarm', 1, 'Wizard'), sp('Aid', 2, 'Cleric'), sp('Bane', 1, 'Cleric')]});
    kclick('[data-tab="var"]');
    eq(nevek(), ['Bane', 'Bless', 'Aid', 'Alarm', 'Shield']);
    // DM statblokk
    const t = W.sheetToCreature(W.Sheet.norm({...sheetDoc(), spells: [sp('Sleep', 1), sp('light', 0), sp('Bless', 1), sp('Fire Bolt', 0)]}), {kind: 'pc'}).traits.find(x => x.name === 'Varázslatok').text;
    has(t, 'Cantrips: Fire Bolt, light'); has(t, '1st level: Bless (nincs bekészítve), Sleep (nincs bekészítve)');
  });
  ktest('varázsképesség-módosító (TERV-fejlesztesek-2026-11-21.md, 6. lépés): a Varázslat fül fejlécében, a Harc fül varázslat-sorában és a DM statblokkjában; multiclassnál osztályonként; varázsképesség nélkül nincs', () => {
    K.KApp.setRulebook({version: 'v', rb: rbVarazs()});
    openSheet({classes: [{name: 'Cleric', level: 5}], abilities: {str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10}, spellcasting: {ability: 'wis', slots: [4, 3, 2], used: [], pact: {level: 0, max: 0, used: 0}}});
    kclick('[data-tab="var"]');
    has(ktext(), 'Varázsképesség: Wisdom (+4) · spell save DC 15');
    kclick('[data-tab="harc"]');
    has(ktext(), 'spell save DC 15 · WIS +4');
    const t = s => W.sheetToCreature(W.Sheet.norm(s), {kind: 'pc'}).traits.find(x => x.name === 'Varázslatok').text;
    has(t({...sheetDoc(), classes: [{name: 'Cleric', level: 5}], abilities: {wis: 18}, spellcasting: {ability: 'wis'}, spells: [{name: 'Bless', level: 1}]}), 'spell save DC 15, +7 to hit, WIS +4');
    // negatív módosító
    openSheet({classes: [{name: 'Wizard', level: 1}], abilities: {str: 10, dex: 10, con: 10, int: 8, wis: 10, cha: 10}, spellcasting: {ability: 'int', slots: [2], used: [], pact: {level: 0, max: 0, used: 0}}});
    kclick('[data-tab="var"]'); has(ktext(), 'Intelligence (-1)');
    // multiclass (Cleric 3 / Wizard 2): WIS 14 → +2, INT 16 → +3
    openSheet({auto: true, build: {base: {wis: 14, int: 16}, levels: [...lv('Cleric', 3), ...lv('Wizard', 2)], spells: {}}, classes: [{name: 'Cleric', level: 3}, {name: 'Wizard', level: 2}]});
    kclick('[data-tab="var"]');
    const fej = kqa('.mcfej').map(e => e.textContent);
    has(fej[0], 'Cleric (Wisdom +2)'); has(fej[1], 'Wizard (Intelligence +3)');
    kclick('[data-tab="harc"]'); has(ktext(), 'WIS +2'); has(ktext(), 'INT +3');
    // varázsképesség nélkül (Fighter): nincs sor
    openSheet({classes: [{name: 'Fighter', level: 3}], spellcasting: {ability: '', slots: [], used: [], pact: {level: 0, max: 0, used: 0}}});
    kclick('[data-tab="harc"]'); ok(!ktext().includes('spell save DC'), 'nincs varázslat-sor');
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
});

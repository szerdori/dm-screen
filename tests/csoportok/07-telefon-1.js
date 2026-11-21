// DM Screen – regressziós tesztek: telefonos karakterlap (karakter.html), 1. rész: a közös segédek (kq, kclick, ktest, openSheet…), szintlépés-varázsló, előzmények, kezdő varázsló.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

// a telefonos lap tesztjeinek közös segédei (a 07–09. fájl mindegyike használja; eredetileg a describe belsejében voltak)
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
  finally { Object.assign(K, ORIGK); K.KDB = undefined; K.eval('lu = null; slotValaszt = null; histCache.clear(); openKeys.delete("hist")'); K.localStorage.removeItem('dmscreen-szintlepes-p1'); K.frameElement.width = 420; delete K.navigator.onLine; K.location.hash = ''; K.KApp.setSheets([]); K.KApp.setChars([]); K.KApp.setRulebook(null); K.route(); }
}, opts);
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

describe('Telefonos karakterlap (karakter.html)', () => {
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
});

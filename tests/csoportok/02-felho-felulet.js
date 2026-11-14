// DM Screen – regressziós tesztek: felhő mentés (ál-adatbázis), Initiative tracker, felület, online ellenőrzések, biztonság (XSS), biztonsági mentések, zsákmány, Csapat nézet.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

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
    await mentve();
    W.localStorage.removeItem('dmscreen');
    ok(Object.keys(f.store).includes('dmscreen_library/a1') && Object.keys(f.store).includes('dmscreen/state'), 'nem töltődött fel: ' + Object.keys(f.store));
    eq(Object.keys(f.store).filter(k => k.startsWith('dmscreen_saved/')).length, 1);
    ok($('#gate').hidden, 'a belépő képernyő nem tűnt el');
  });
  test('csak a megváltozott dokumentum íródik; törlés is', async () => {
    const f = fakeDb();
    f.store['dmscreen_library/a'] = {name: 'A'}; f.store['dmscreen_library/b'] = {name: 'B'}; f.store['dmscreen/state'] = {enc: {list: [], round: 1, active: null}, settings: {}};
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db});
    await mentve(); eq(f.log.splice(0).filter(l => !l.includes('backup')), [], 'betöltés után (a napi mentésen kívül) nem kellene írni');
    A('S.library.find(c => c.id === "a").ac = 17; save()'); await mentve();
    eq(f.log.splice(0), ['set dmscreen_library/a']);
    add(mk()); await mentve();
    eq(f.log.splice(0), ['set dmscreen/state']);
    A('S.library = S.library.filter(c => c.id !== "b"); save()'); await mentve();
    eq(f.log.splice(0), ['del dmscreen_library/b']);
  });
  // a többi teszt a mentve() segéddel rögtön lefuttatja a mentést; a késleltetést magát ez a teszt nézi, valódi idővel
  test('késleltetett mentés: a save() 400 ms múlva ír, a gyors egymás utáni hívásokból egy írás lesz', async () => {
    const f = fakeDb();
    f.store['dmscreen_library/a'] = {name: 'A'}; f.store['dmscreen/state'] = {enc: {list: [], round: 1, active: null}, settings: {}};
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db});
    await mentve(); f.log.splice(0);
    A('S.library[0].ac = 11; save()'); await wait(150);
    A('S.library[0].ac = 12; save()'); await wait(150);
    A('S.library[0].ac = 13; save()'); await wait(150);
    eq(f.log, [], 'az utolsó hívás után 400 ms-ig még nem ír');
    ok(A('saveTimer'), 'a mentés be van időzítve');
    await until(() => f.log.length, 2000, 'a késleltetett mentés');
    eq([f.log, f.store['dmscreen_library/a'].ac, A('saveTimer')], [['set dmscreen_library/a'], 13, null]);
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
    add(mk()); await mentve();
    has($('#saveState').textContent, 'sikertelen');
    eq(A('lastSaved.state'), '');
  });
});

// ======================================================================
describe('Initiative tracker', () => {
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
  test('HP rejtve (2026-11-14): a könyvtári „HP a játékosoknak” beállítás a trackerre is szól – NPC: pontos / állapot / rejtve, játékos: pontos / rejtve, szörny: állapot', () => {
    const {hpLathato, normCreature} = W.Szerzodes;
    // a tisztító: 'hidden' megmarad, ismeretlen érték alapra áll
    eq(['exact', 'label', 'hidden', 'x'].map(h => normCreature({kind: 'npc', share: {hp: h}}).share.hp), ['exact', 'label', 'hidden', 'label']);
    eq(normCreature({kind: 'pc', share: {hp: 'x'}}).share.hp, 'exact');
    eq([['npc', 'exact'], ['npc', 'label'], ['npc', 'hidden'], ['pc', 'exact'], ['pc', 'label'], ['pc', 'hidden'], ['monster', 'hidden']].map(([kind, hp]) => hpLathato({kind, share: {hp}})),
      ['exact', 'label', 'hidden', 'exact', 'exact', 'hidden', 'label'], 'a régi játékos „label”-je pontos marad');
    eq([hpLathato(null), hpLathato({kind: 'npc'})], ['label', 'label']);
    const lib = (n, kind, hp) => W.upsertLibrary(W.normCreature({...mk(n, {kind, hp: {max: 20}}), share: {vis: 'party', hp}}));
    const [nh] = add(lib('Rejtett NPC', 'npc', 'hidden')), [ne] = add(lib('Pontos NPC', 'npc', 'exact')), [ph] = add(lib('Rejtett hős', 'pc', 'hidden')), [pl] = add(lib('Régi hős', 'pc', 'label')), [m] = add(mk('Ork', {hp: {max: 20}}));
    [nh, ne, ph, pl, m].forEach((x, i) => { x.hp = 12; x.init = 20 - i; });
    const v = () => Object.fromEntries(W.publicView().list.map(e => [e.name, [e.hp, e.max, e.status]]));
    eq(v(), {'Rejtett NPC': [null, null, null], 'Pontos NPC': [12, 20, null], 'Rejtett hős': [null, null, null], 'Régi hős': [12, 20, null], 'Ork': [null, null, 'hurt']});
    // a könyvtár mostani értéke számít (harc közben átállítva is)
    A(`S.library.find(c => c.name === 'Rejtett NPC').share.hp = 'label'`);
    eq(v()['Rejtett NPC'], [null, null, 'hurt']);
    const pub = Object.fromEntries(A('Tar.karakterek.nyilvanosResz(S.library)').map(p => [p.name, [p.hp, p.status]]));
    eq(pub, {'Rejtett NPC': [null, 'healthy'], 'Pontos NPC': [{cur: 20, max: 20}, null], 'Rejtett hős': [null, null], 'Régi hős': [{cur: 20, max: 20}, null]});
    // rejtett HP-jú legyőzött ellenfél: „Halott” (a tracker szürkíti és átugorja); csapattárs 0 HP-n: semmi
    A(`S.library.find(c => c.name === 'Rejtett NPC').share.hp = 'hidden'`); nh.side = 'enemy'; nh.hp = 0; nh.dead = true;
    eq(v()['Rejtett NPC'], [null, null, 'dead']);
    ph.hp = 0; eq(v()['Rejtett hős'], [null, null, null]);
    ph.hp = 12; nh.hp = 12; nh.dead = false;
    eq(W.Szerzodes.normPublicChar({id: 'a', kind: 'npc', hp: null, status: null}).status, null, 'se HP, se állapot');
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
    W.lep(1); W.broadcast();
    const doc = () => P.document.body.textContent;
    await until(() => doc().includes('Ogre 1'), 4000, 'Initiative tracker frissítése');
    has(doc(), 'Soron: Rella'); has(doc(), 'Súlyosan sérült'); has(doc(), 'Sértetlen'); has(doc(), 'Prone'); has(doc(), '30 / 30');
    hasNot(doc(), 'Rejtett'); hasNot(doc(), 'Bloodied');
    ok(P.document.querySelector('.e.active .name').textContent === 'Rella', 'nem a soron lévő van kiemelve');
  });
  test('a player.html követi a következő lépést', async () => {
    const [p] = add(pc('Rella')), [g] = add(mk()); p.init = 20; g.init = 1;
    W.lep(1); W.lep(1);
    await until(() => P.document.querySelector('.e.active .name')?.textContent === 'Goblin', 4000, 'aktív frissítése');
  });
});

// ======================================================================
describe('Felület', () => {
  test('a csempék initiative-sorrendben jelennek meg, az aktív kiemelve', () => {
    const [a] = add(mk('A')), [b] = add(mk('B')); a.init = 5; b.init = 18; W.lep(1);
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
  test('fejléc: Előző / Következő gomb, Initiative dobás ablak (ellenfelek, hiányzók, mindenki; közös initiative kapcsoló)', () => {
    const [p] = add(pc('Rella')), [g1, g2] = add(mk(), 2);
    p.init = 20; g1.init = 15; g2.init = 10;
    click('[data-act="next"]'); click('[data-act="next"]'); eq(A('S.enc.active'), g1.cid);
    click('[data-act="prev"]'); eq(A('S.enc.active'), p.cid);
    click('[data-act="rollInit"]'); has($('#modalBox').textContent, 'Initiative dobás');
    stubRnd(7); click('[data-act="init"][data-mode="monsters"]');
    eq([p.init, g1.init, g2.init], [20, 9, 9], 'a játékos marad, az együtt hozzáadott goblinok közös értéket kapnak');
    ok($('#modal').hidden, 'az ablak bezárult'); has(allLog(), 'Initiative dobva');
    p.init = null; stubRnd(11); W.openInitMenu(); click('[data-act="init"][data-mode="missing"]');
    eq([p.init, g1.init], [12, 9], 'csak akinek nincs');
    W.openInitMenu();
    const box = $('[data-setting="groupInit"]'); box.checked = false; box.dispatchEvent(new W.Event('change', {bubbles: true}));
    eq(A('S.settings.groupInit'), false);
    stubRnd(1, 2, 5); click('[data-act="init"][data-mode="all"]');
    eq([p.init, g1.init, g2.init], [2, 4, 7], 'mindenki külön dob');
  });
  test('csempe gombjai: koncentráció (a chipre kattintva is megszűnik), halott, rejtett; adatlapról vissza az aktuálishoz', () => {
    const [a] = add(mk('A')), [b] = add(mk('B')); a.init = 10; b.init = 5; W.lep(1);
    const on = (x, sel) => click(`[data-cid="${x.cid}"] ${sel}`);
    on(b, 'button[data-act="toggleConc"]'); ok(b.conc, 'koncentrál');
    on(b, '.chip.conc'); ok(!b.conc, 'a chip megszünteti');
    on(b, '[data-act="toggleHidden"]'); ok(b.hiddenP && $(`.tile[data-cid="${b.cid}"]`).classList.contains('hiddenp'), 'rejtett');
    on(b, '[data-act="toggleDead"]'); ok(b.dead && $(`.tile[data-cid="${b.cid}"]`).classList.contains('dead'), 'halott');
    on(b, '.t-name'); eq(A('selected'), b.cid);
    click('[data-act="deselect"]'); eq(A('selected'), null);
  });
  test('Menü → Ürítés (Mégse = marad), nehézség ablak bezárása, mentett encounter törlése, forráskönyvek kijelölése', () => {
    add(mk()); W.openMenu();
    W.confirm = () => false; click('[data-act="clearAll"]'); eq(list().length, 1, 'Mégse');
    W.confirm = () => true; click('[data-act="clearAll"]'); eq([list().length, $('#modal').hidden], [0, true]);
    W.openDiffInfo(); ok(!$('#modal').hidden); click('[data-act="edCancel"]'); ok($('#modal').hidden, 'Bezárás');
    A(`S.saved = [{id: 'e1', name: 'Kápolna', list: []}]`); W.openLib('enc'); click('[data-act="encDel"]'); eq(A('S.saved'), []);
    A(`fiveIndex = {TST: 'x.json', MM: 'y.json'}`); W.openLib('five');
    const src = k => $(`input[data-src="${k}"]`), tick = (k, v) => { src(k).checked = v; src(k).dispatchEvent(new W.Event('change', {bubbles: true})); };
    tick('TST', true); tick('MM', false);
    eq(A('S.settings.sources'), ['TST']);
  });
  test('letöltések és sablonok: lény exportja (fájlnév tisztítva), sablonok, sablon megjelenítése', () => {
    const files = []; W.download = (n, o) => files.push([n, o]);
    W.upsertLibrary(mk('Kő-Ogre!'));
    W.openLib('lib'); click('[data-act="libExport"]');
    W.openLib('json'); click('[data-act="showTemplate"]'); has($('#jsonIn').value, '"name"');
    click('[data-act="downloadSheetTemplate"]');
    W.openMenu(); click('[data-act="downloadTemplate"]');
    eq(files.map(f => f[0]), ['Kő-Ogre.json', 'karakterlap-sablon.json', 'dmscreen-sablon.json']);
    eq([files[0][1].name, files[1][1].format], ['Kő-Ogre!', 'dmscreen-karakter']);
  });
  test('download: JSON fájlt készít a megadott névvel', async () => {
    let got; const proto = W.HTMLAnchorElement.prototype, origClick = proto.click;
    proto.click = function () { got = [this.download, this.href]; };
    try { ORIG.download('x.json', {a: 1}); } finally { proto.click = origClick; }
    eq(got[0], 'x.json');
    eq(await (await W.fetch(got[1])).json(), {a: 1});
  });
  const pickFile = (input, content, name, type = 'application/json') => {
    const dt = new W.DataTransfer(); dt.items.add(new W.File([content], name, {type}));
    input.files = dt.files; input.dispatchEvent(new W.Event('change', {bubbles: true}));
  };
  test('teljes mentés fájlból: a csempék frissülnek', async () => {
    const fi = $('#fileIn'); fi.click = () => {};
    try {
      add(mk('Régi')); eq($$('.tile').length, 1);
      W.openMenu(); click('[data-act="importAll"]');
      pickFile(fi, JSON.stringify({library: [], enc: {list: [], round: 1, active: null}, saved: []}), 'mentes.json');
      await until(() => !$$('.tile').length, 2000, 'a csempe eltűnik');
      eq($('#modal').hidden, true);
    } finally { delete fi.click; }
  });
  test('fájl importálása: lények (JSON fül), teljes mentés (Menü), hibás fájl', async () => {
    const fi = $('#fileIn'); let opened = 0; fi.click = () => opened++;
    try {
      W.openLib('json'); click('[data-act="importFile"]'); eq(opened, 1, 'fájlválasztó');
      pickFile(fi, JSON.stringify([mk('Fájlgoblin')]), 'lenyek.json');
      await until(() => A('S.library').some(c => c.name === 'Fájlgoblin'), 2000, 'lény import');
      has(allLog(), '1 lény importálva');
      W.openMenu(); click('[data-act="importAll"]'); eq(opened, 2);
      pickFile(fi, JSON.stringify({library: [mk('Mentett')], enc: {list: [], round: 1, active: null}, saved: []}), 'mentes.json');
      await until(() => A('S.library').map(c => c.name).join() === 'Mentett', 2000, 'mentés visszatöltése');
      let msg = ''; W.alert = m => { msg = m; };
      pickFile(fi, 'nem json', 'rossz.json');
      await until(() => msg, 2000, 'hibaüzenet'); has(msg, 'Hibás fájl');
    } finally { delete fi.click; }
  });
  test('portré a szerkesztőben: link, feltöltött kép 256 px-es JPEG-ként, törlés', async () => {
    W.openEditor(W.normCreature({}), () => {});
    const pf = $('#portraitFile'); let opened = 0; pf.click = () => opened++;
    click('[data-act="portraitUpload"]'); eq(opened, 1, 'fájlválasztó');
    setVal('#portraitUrl', 'https://x/k.png', 'input');
    eq([$('#edForm').elements.portrait.value, $('#portraitPv').style.visibility], ['https://x/k.png', 'visible']);
    const cv = W.document.createElement('canvas'); cv.width = 40; cv.height = 20;
    pickFile(pf, await new Promise(r => cv.toBlob(r, 'image/png')), 'k.png', 'image/png');
    await until(() => $('#edForm').elements.portrait.value.startsWith('data:image/jpeg'), 3000, 'kicsinyített kép');
    eq([$('#portraitUrl').value, $('#portraitUrl').placeholder], ['', '(feltöltött kép)']);
    click('[data-act="portraitClear"]');
    eq([$('#edForm').elements.portrait.value, $('#portraitPv').style.visibility], ['', 'hidden']);
  });
  test('vágólap: D&D Beyond beillesztés (magától, gombbal, vágólapról), zsákmány másolása; ha a böngésző nem engedi', async () => {
    W.openLib('ddb');
    const dt = new W.DataTransfer(); dt.setData('text/plain', JSON.stringify(DDB));
    $('#ddbPaste').dispatchEvent(new W.ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
    has($('#ddbMsg').textContent, '✓', 'beillesztéskor importált');
    $('#ddbMsg').innerHTML = ''; $('#ddbPaste').value = JSON.stringify(DDB); click('[data-act="ddbPasteImport"]');
    has($('#ddbMsg').textContent, '✓', 'Importálás gomb');
    let copied = null;
    Object.defineProperty(W.navigator, 'clipboard', {configurable: true, value: {readText: async () => JSON.stringify(DDB), writeText: async t => { copied = t; }}});
    try {
      $('#ddbMsg').innerHTML = ''; click('[data-act="ddbClipboard"]');
      await until(() => $('#ddbMsg').textContent.includes('✓'), 2000, 'vágólapról');
      W.navigator.clipboard.readText = async () => { throw new Error('tiltva'); };
      click('[data-act="ddbClipboard"]');
      await until(() => $('#ddbMsg').textContent.includes('nem engedte'), 2000, 'tiltott vágólap');
      stubLoot(); add(pc('A')); const [g] = add(mk()); g.dead = true;
      W.openLoot(); W.rnd = d => d; click('[data-act="lootRoll"]');
      await until(() => $('#lootOut [data-act="lootCopy"]'), 2000, 'zsákmány');
      click('#lootOut [data-act="lootCopy"]');
      await until(() => $('[data-act="lootCopy"]').textContent === '✓ Kimásolva', 2000, 'másolás'); has(copied, 'Összesen');
      W.navigator.clipboard.writeText = async () => { throw new Error('tiltva'); };
      click('#lootOut [data-act="lootCopy"]');
      await until(() => $('[data-act="lootCopy"]').textContent === 'A böngésző nem engedte', 2000, 'tiltott másolás');
    } finally { delete W.navigator.clipboard; }
  });
  test('letöltők (ál-fetch): 5e.tools forráslista és könyv, kincstáblák; egyszer tölt le, hibánál érthető üzenet', async () => {
    const origFetch = W.fetch, urls = [];
    W.fetch = async u => {
      u = String(u); urls.push(u);
      return {ok: true, json: async () => u.endsWith('index.json') ? {TST: 'bestiary-tst.json'} : u.includes('bestiary-tst') ? {monster: [FIVE.brute]} : {tabla: 1}};
    };
    try {
      eq(await ORIG.loadFiveIndex(), {TST: 'bestiary-tst.json'});
      eq((await ORIG.loadFiveSource('TST')).map(m => m.name), ['Test Brute']);
      await ORIG.loadFiveSource('TST'); await ORIG.loadFiveIndex();
      eq(urls.length, 2, 'másodszor már nem tölt le');
      let err = ''; try { await ORIG.loadFiveSource('XYZ'); } catch (e) { err = e.message; }
      has(err, 'Ismeretlen forrás');
      eq(await ORIG.loadLoot(), {tabla: 1}); await ORIG.loadLoot(); eq(urls.length, 3);
      A('lootData = null'); W.fetch = async () => ({ok: false, status: 404});
      err = ''; try { await ORIG.loadLoot(); } catch (e) { err = e.message; }
      eq(err, 'HTTP 404');
    } finally { W.fetch = origFetch; }
    A('fiveIndex = null'); W.loadFiveIndex = async () => { throw new Error('offline'); };
    W.openLib('five'); await until(() => $('#fiveMsg').textContent.includes('Nem sikerült elérni'), 2000, 'hibaüzenet');
    W.loadFiveIndex = async () => { A(`fiveIndex = {TST: 'x.json'}`); return {TST: 'x.json'}; };
    W.openLib('five'); await until(() => $('input[data-src="TST"]'), 2000, 'forráslista');
  });
  test('az oldal bezárásakor helyi másolat, függő mentés azonnal', () => {
    const origSave = W.doSave; let saved = 0; W.doSave = () => { saved++; };
    try {
      add(mk('Bezáráskor'));
      A('clearTimeout(saveTimer); saveTimer = null');
      let e = new W.Event('beforeunload', {cancelable: true}); W.dispatchEvent(e);
      has(W.localStorage.getItem('dmscreen'), 'Bezáráskor'); eq([saved, e.defaultPrevented], [0, false]);
      A('saveTimer = setTimeout(() => {}, 60000)');
      e = new W.Event('beforeunload', {cancelable: true}); W.dispatchEvent(e);
      eq([saved, e.defaultPrevented], [1, true]);
    } finally { W.doSave = origSave; A('clearTimeout(saveTimer); saveTimer = null'); W.localStorage.removeItem('dmscreen'); }
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
  test('szabálykönyv a valódi tükörből (2. fázis): 13 osztály, csak 2014-es alosztályok, fajok, hátterek, méret', async () => {
    const rb = W.__rbOnline = await ORIG.buildRulebook(), H = W.Sheet;
    eq(rb.classes.map(c => c.n).sort(), Object.keys(H.CLASSES).sort());
    for (const c of rb.classes) {
      eq([c.hd, c.saves], [H.CLASSES[c.n].hd, H.CLASSES[c.n].saves], c.n + ': hit die és mentők a beépített táblával egyeznek');
      eq(c.subLvl, H.CLASSES[c.n].subLvl, c.n + ': alosztály szintje');
      ok(c.feats.length >= 10 && c.asi.includes(4) && c.asi.includes(19), c.n + ': feature-ök / ASI');
    }
    eq(rb.classes.find(c => c.n === 'Fighter').asi, [4, 6, 8, 12, 14, 16, 19]);
    ok(rb.classes.find(c => c.n === 'Monk').cols.some(c => /Martial Arts/.test(c.l)), 'Monk: Martial Arts oszlop');
    ok(rb.classes.find(c => c.n === 'Warlock').opt.some(o => o.t.includes('EI')), 'Warlock: Invocations');
    const srcs = [...new Set([...rb.subclasses, ...rb.races, ...rb.subraces, ...rb.backgrounds, ...rb.optfeatures, ...rb.features].map(x => x.s))].sort();
    const bad = Object.entries({subclasses: rb.subclasses, races: rb.races, subraces: rb.subraces, backgrounds: rb.backgrounds, optfeatures: rb.optfeatures, features: rb.features}).flatMap(([k, l]) => l.filter(x => !['PHB', 'XGE', 'TCE'].includes(x.s)).map(x => k + ':' + x.n + '/' + (x.cls || '') + '/' + (x.sub || '') + '/' + x.s));
    eq(bad, [], 'forrás: ' + srcs.join(', '));
    const keys = rb.subclasses.map(s => s.cls + ':' + s.short);
    eq(keys.length, new Set(keys).size, 'egy alosztály csak egyszer (a 2024-es osztályhoz kötött példány nélkül)');
    ok(rb.subclasses.length >= 90 && rb.subclasses.length <= 130, 'alosztályok: ' + rb.subclasses.length);
    eq(rb.races.map(r => r.n).sort(), ['Custom Lineage', 'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Half-Orc', 'Halfling', 'Human', 'Tiefling']);
    ok(rb.subraces.some(s => s.n === 'Variant' && s.race === 'Human') && rb.subraces.some(s => s.n === 'Hill'), 'alfajok');
    ok(rb.backgrounds.length >= 14 && rb.backgrounds.every(b => b.fx?.length || b.n === 'Custom Background'), 'hátterek');
    ok(rb.optfeatures.length >= 100, 'optional feature-ök: ' + rb.optfeatures.length);
    const chunks = H.splitChunks(rb), total = chunks.reduce((t, c) => t + new TextEncoder().encode(c.data).length, 0);
    ok(chunks.every(c => new TextEncoder().encode(c.data).length < 950000), 'túl nagy darab');
    ok(total < 6e6, 'túl nagy szabálykönyv: ' + total);
  }, {online: true});
  test('a kézi hatástábla (FEATURE_FX) minden kulcsa létezik a valódi szabálykönyvben; egy valódi karakter számolása', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const traits = new Set([...rb.races, ...rb.subraces].flatMap(r => [r.n, ...(r.traits || []).map(t => t.n)]));
    const bad = Object.keys(H.FEATURE_FX).filter(k => {
      const p = k.split('|');
      if (p[0] === 'race') return !traits.has(p[1]);
      if (p[0] === 'feat') return !rb.feats.some(f => f.n === p[1]);
      if (p[0] === 'opt') return !rb.optfeatures.some(o => o.n === p[1]);
      if (p.length === 2) return !rb.features.some(f => f.cls === p[0] && !f.sub && f.n === p[1]);
      if (p[1] === '*') return !rb.features.some(f => f.cls === p[0] && f.sub && f.n === p[2]);
      return !rb.features.some(f => f.cls === p[0] && f.sub === p[1] && f.n === p[2]);
    });
    eq(bad, [], 'nem létező kulcsok');
    const s = H.norm({auto: true, build: {race: 'Dwarf|PHB', subrace: 'Hill|PHB', base: {str: 15, dex: 10, con: 14, wis: 15, cha: 8}, levels: Array.from({length: 5}, () => ({c: 'Cleric'})), sub: {Cleric: 'Life|PHB'}},
      inventory: [{name: 'Chain Mail', equipped: true}, {name: 'Shield', equipped: true}, {name: 'Warhammer', equipped: true}]});
    const c = H.calc(s, rb);
    eq([c.ac.v, c.speed.v, c.hpMax.v, c.abilities.wis.v, c.casting[0].dc, c.casting[0].prepared, c.slots.filter(Boolean)], [18, '25 ft.', 48, 16, 14, 8, [4, 3, 2]]);
    ok(['Bless', 'Cure Wounds', 'Lesser Restoration', 'Spiritual Weapon', 'Beacon of Hope', 'Revivify'].every(n => c.always.some(a => a.name === n)), 'Life domain spellek: ' + c.always.map(a => a.name));
    eq(c.attacks[0].hit, '+5', 'Warhammer: STR 2 + PB 3 (Dwarven Combat Training)');
    ok(c.resources.some(r => r.name === 'Channel Divinity' && r.max === 1), 'Channel Divinity');
  }, {online: true});
  test('varázslat sora a valódi szabálykönyvvel: minden mentős varázslatnál kiolvasható a mentő, minden sebző cantripnél a szintenkénti kocka (vagy a darabszám)', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const mentos = rb.spells.filter(sp => /saving throw/i.test(sp.tx || '') && /\b(make|succeed on|fail) an? \w+ saving throw/i.test(sp.tx || ''));
    eq(mentos.filter(sp => !H.spellSave(sp.tx)).map(sp => sp.n), [], 'mentő nélkül');
    ok(mentos.length >= 150, 'mentős varázslatok: ' + mentos.length);
    // sebző cantrip: van „… damage” a szövegében és nő a szinttel („5th level”)
    const sebzo = rb.spells.filter(sp => sp.l === 0 && /\d+d\d+ \w+ damage/i.test(sp.tx || '') && /\b5th level\b/i.test(sp.tx || ''));
    const nemNo = sebzo.filter(sp => !H.cantripKocka(sp.tx, 17) && H.cantripDarab(sp.tx, 17) === 1).map(sp => sp.n);
    // ezeknél a kocka nem a sebzés kockája nő (pl. pengés cantripek: „At 5th level, the melee attack deals an extra 1d8…”) – a gomb a régi módon (első kocka) marad
    ok(nemNo.length <= 4, 'nem olvasható ki: ' + nemNo.join(', '));
    eq([H.cantripKocka(rb.spells.find(s => s.n === 'Fire Bolt').tx, 5), H.cantripDarab(rb.spells.find(s => s.n === 'Eldritch Blast').tx, 11), H.spellSave(rb.spells.find(s => s.n === 'Sacred Flame').tx)], ['2d10', 3, 'dex']);
    ok(rb.spells.find(s => s.n === 'Eldritch Blast').atk && !rb.spells.find(s => s.n === 'Sacred Flame').atk, 'támadó-e jelölés');
    // ahol a szöveg említ mentőt, de nem a célpontét (előny, jártasság, a varázsló saját fix DC-s mentője)
    const nincs = ['Haste', 'Beacon of Hope', "Heroes' Feast", 'Contact Other Plane', "Tenser's Transformation"];
    ok(nincs.every(n => rb.spells.some(s => s.n === n)), 'a példák megvannak a szabálykönyvben');
    eq(nincs.map(n => H.spellSave(rb.spells.find(s => s.n === n).tx)), nincs.map(() => ''));
  }, {online: true});
  test('featek a valódi szabálykönyvben: minden varázslat-választóból van mit választani, és nem marad „varázslat választása” teendő', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const valasztok = (fx, hol) => (fx || []).flatMap(x => [...(x.spellChoose ? [[hol, x.spellChoose]] : []), ...Object.entries(x.pickChoose?.then || {}).flatMap(([k, l]) => valasztok(l, hol + ' / ' + k))]);
    const lista = rb.feats.flatMap(f => valasztok(f.fx, f.n));
    ok(lista.length >= 20, 'feat varázslat-választók: ' + lista.length);
    const ures = lista.filter(([, sc]) => !H.choiceOptions({key: 'x', kind: 'spell', n: sc.n, ok: [], from: sc.from}, null, rb).opts.length).map(([h]) => h);
    // a Bard és a Cleric listáján nincs támadó cantrip (PHB / XGE / TCE), az 5e.tools mégis felkínálja: ott a választó üres, a játékos másik listát választ
    eq(ures, ['Spell Sniper / Bard', 'Spell Sniper / Cleric'], 'üres választó');
    eq(rb.feats.filter(f => (f.fx || []).some(x => /varázslat választása/.test(x.todo || ''))).map(f => f.n), [], 'maradt teendő');
  }, {online: true});
  test('featek a valódi szabálykönyvben: egy 8. szintű Fighter ASI-jén mind felvehető; minden saját választásuk kitölthető; ✋ teendő egyiknél sem marad', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet, hibak = [], teendo = [];
    for (const f of rb.feats) {
      let s = H.norm({auto: true, build: {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {str: 15, dex: 13, con: 14, int: 13, wis: 13, cha: 13}, levels: Array.from({length: 8}, () => ({c: 'Fighter'})), ch: {'Fighter:4:asi': {feat: f.n + '|' + f.s}}}});
      // a feat választásait sorban kitölti az első szabad lehetőségekkel (a then-láncok miatt többször számol)
      for (let i = 0; i < 6; i++) {
        const c = H.calc(s, rb), nyitott = c.choices.filter(x => x.key.startsWith('feat:') && !x.done);
        if (!nyitott.length) break;
        const ch = {...s.build.ch};
        for (const x of nyitott) {
          const o = H.choiceOptions(x, c, rb, s);
          if (o.free) ch[x.key] = Array.from({length: x.n}, (_, j) => x.kind === 'pick' ? 'Longsword ' + j : "smith's tools");
          else if (x.label === 'Varázslatlista' && o.opts.some(y => y.v === 'Wizard')) ch[x.key] = ['Wizard'];   // a Bard / Cleric listán a Spell Snipernek nincs cantripje
          else ch[x.key] = o.opts.filter(y => !y.dis).slice(0, x.n).map(y => y.v);
        }
        s = H.norm({...s, build: {...s.build, ch}});
      }
      const c = H.calc(s, rb), maradt = c.choices.filter(x => x.key.startsWith('feat:') && !x.done);
      if (maradt.length) hibak.push(f.n + ': ' + maradt.map(x => x.key).join(', '));
      teendo.push(...c.todos.filter(t => t.kind === 'manual' && /^✋ Feat:/.test(t.key)).map(t => t.text));
    }
    eq(hibak, [], 'kitölthetetlen');
    eq(teendo, [], 'maradt ✋ teendő');
  }, {online: true});
  test('TCE a valódi szabálykönyvben: a TCE_FX és a TCE_CSERE kulcsai léteznek; XGE-varázslat az osztálylistán (clx), TCE bővített lista külön (clt)', async () => {
    const rb = W.__rbOnline || (W.__rbOnline = await ORIG.buildRulebook()), H = W.Sheet;
    const tceFeat = (cls, n, lvl) => rb.classes.find(c => c.n === cls)?.feats.some(f => f.n === n && f.opt && (lvl == null || f.lvl === lvl)) || rb.features.some(f => f.cls === cls && f.n === n && f.opt && (lvl == null || f.lvl === lvl));
    eq(Object.keys(H.TCE_FX).filter(k => { const [cls, n, lvl] = k.split('|'); return !tceFeat(cls, n, +lvl); }), [], 'TCE_FX: nem létező');
    const phb = (cls, sb, n) => sb === '*' ? rb.features.some(f => f.cls === cls && f.sub && f.n === n) : sb ? rb.features.some(f => f.cls === cls && f.sub === sb && f.n === n) : rb.classes.find(c => c.n === cls)?.feats.some(f => f.n === n && !f.opt);
    eq(Object.entries(H.TCE_CSERE).filter(([k, l]) => { const p = k.split('|'), n = p.at(-1), sb = p.length === 3 ? p[1] : ''; return !phb(p[0], sb, n) || !l.every(t => tceFeat(p[0], t)); }).map(([k]) => k), [], 'TCE_CSERE: nem létező');
    const sp = n => rb.spells.find(s => s.n === n);
    eq([sp('Toll the Dead').cl, sp('Toll the Dead').clx], [['Cleric', 'Warlock', 'Wizard'], ['Cleric', 'Warlock', 'Wizard']], 'XGE-cantrip a listákon');
    ok(sp('Aura of Vitality').cl.includes('Paladin') && sp('Aura of Vitality').clt?.includes('Cleric'), 'TCE: Aura of Vitality a Cleric bővített listáján');
    ok(rb.spells.filter(s => s.clt?.length).length >= 30, 'TCE bővített listák: ' + rb.spells.filter(s => s.clt?.length).length);
    // Ranger 6: minden TCE-t elfogadva nincs ✋ teendő a Favored Enemy / Natural Explorer miatt
    const ch = {'Ranger:tce:Favored Foe': 'igen', 'Ranger:tce:Deft Explorer': 'igen', 'Ranger:tce:Primal Awareness': 'igen'};
    const c = H.calc(H.norm({auto: true, build: {race: 'Human|PHB', subrace: 'Human (alap)|PHB', base: {dex: 15, wis: 14}, levels: Array.from({length: 6}, () => ({c: 'Ranger'})), ch}}), rb);
    ok(!c.features.some(f => /^(Favored Enemy|Natural Explorer|Primeval Awareness)/.test(f.name)), 'kiváltva: ' + c.features.map(f => f.name));
    ok(['Favored Foe', 'Deft Explorer', 'Primal Awareness', 'Deft Explorer Improvement'].every(n => c.features.some(f => f.name === n)), 'TCE-jellemzők');
    ok(c.always.some(a => a.name === 'Speak with Animals') && c.always.some(a => a.name === 'Beast Sense'), 'Primal Awareness varázslatai');
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
  const store = structuredClone(initial), log = [], watchers = [];
  const list = col => Object.entries(store).filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({...structuredClone(v), id: k.slice(col.length + 1)}));
  return {store, log, emit: col => watchers.filter(w => w.col === col).forEach(w => w.cb(list(col))), db: {
    get: async p => store[p] ? structuredClone(store[p]) : null,
    list: async col => list(col).filter(x => !x.id.includes('/')),
    set: async (p, d) => { JSON.stringify(d); store[p] = structuredClone(d); log.push('set ' + p); },
    // mezőnkénti írás, mint a Firestore updateDoc: 'hp.cur' = beágyazott mező; a naplóba a mezőnevek kerülnek (updatedAt/By nélkül)
    update: async (p, d) => {
      if (!store[p]) throw Object.assign(new Error('nincs ilyen dokumentum'), {code: 'not-found'});
      for (const [k, v] of Object.entries(d)) { const ks = k.split('.'); ks.slice(0, -1).reduce((a, x) => a[x] = a[x] || {}, store[p])[ks.at(-1)] = structuredClone(v); }
      log.push('update ' + p + ' ' + Object.keys(d).filter(k => !k.startsWith('updated')).sort().join(','));
    },
    del: async p => { delete store[p]; log.push('del ' + p); },
    watch: (col, cb) => { const w = {col, cb}; watchers.push(w); return () => watchers.splice(watchers.indexOf(w), 1); }
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
  if (first) { A(`selected = ${JSON.stringify(first.cid)}`); W.render(); W.lep(1); }
  for (const t of ['lib', 'enc']) W.openLib(t);
  if (A('S.library.length')) W.openEditor(A('S.library[0]'), () => {});
  W.closeModal(); W.openDiffInfo(); W.closeModal(); W.broadcast();
  await wait(300);
}
function assertNoXss() {
  for (const [nm, doc] of [['DM képernyő', W.document], ['Initiative tracker', P.document]]) {
    eq(doc.querySelectorAll('[onmouseover]').length, 0, nm + ': attribútum-befecskendezés');
    eq(doc.querySelectorAll('img[src="x"]').length, 0, nm + ': HTML-befecskendezés');
  }
  eq(W.__xss, undefined, 'lefutott a befecskendezett kód'); eq(P.__xss, undefined, 'lefutott a kód az Initiative trackeren');
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
    W.importBackup({library: [evilCreature()], saved: [{id: XQ, name: XSS, list: [evilCreature()], pcs: [{libId: 'nincs_ilyen', name: XSS, init: 5}]}],
      enc: {list: [evilCombatant(), evilCombatant()], round: XSS, active: XQ}, settings: {sources: [XSS, 'MM'], groupInit: XQ, lastExport: XSS}});
    eq([A('S.enc.round'), A('S.settings.sources'), A('S.settings.groupInit'), A('S.settings.lastExport')], [1, ['MM'], true, '']);
    await renderEverywhere();
    assertNoXss();
    W.encounterBetoltese(A('S.saved')[0]); await renderEverywhere();  // a „nincs a könyvtárban” naplósor a gonosz névvel
    has($('#log').textContent, 'nincs a könyvtárban'); assertNoXss();
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
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
    const today = A('localDate()');
    ok(f.store['dmscreen_backup/' + today], 'nincs mai mentés');
    eq(f.store['dmscreen/backups'].items.map(b => [b.id, b.note, b.library]), [[today, 'napi', 1]]);
    eq(JSON.parse(f.store['dmscreen_backup/' + today].data).library[0].name, 'Zombie');
    f.log.length = 0;
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
    eq(f.log.filter(l => l.includes('backup')), []);
  });
  test('üres adatnál nem készül mentés', async () => {
    const f = makeFakeDb();
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
    ok(!f.store['dmscreen/backups'], 'üres állapotról is készült mentés');
  });
  test('legfeljebb 14 mentés marad, a legrégebbiek törlődnek', async () => {
    const init = withData(), items = [];
    for (let i = 1; i <= 14; i++) { const id = `2020-01-${String(i).padStart(2, '0')}`; items.push({id, note: 'napi'}); init['dmscreen_backup/' + id] = {data: '{}'}; }
    init['dmscreen/backups'] = {items};
    const f = makeFakeDb(init);
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
    const ids = f.store['dmscreen/backups'].items.map(b => b.id);
    eq(ids.length, 14); eq(ids[0], A('localDate()')); ok(!ids.includes('2020-01-01'), 'a legrégebbi megmaradt');
    ok(!f.store['dmscreen_backup/2020-01-01'], 'a legrégebbi mentés dokumentuma nem törlődött');
    ok(f.store['dmscreen_backup/2020-01-02'], 'túl sok törlődött');
  });
  test('túl nagy adatnál a felhős mentés kimarad, figyelmeztetéssel', async () => {
    const init = withData(); init['dmscreen_library/a'].notes = 'x'.repeat(950000);
    const f = makeFakeDb(init);
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
    ok(!f.store['dmscreen/backups'], 'a túl nagy mentés mégis elkészült');
    has(A('backupWarn'), 'túl nagy');
  });
  test('visszaállítás: a régi állapot visszajön, előtte a mostaniról is mentés készül', async () => {
    const old = {library: [{id: 'a', name: 'Régi Zombie'}], saved: [], enc: {list: [], round: 4, active: null}, settings: {}};
    const init = withData(); init['dmscreen_library/b'] = {name: 'Új Ghoul'};
    init['dmscreen_backup/2026-01-01'] = {data: JSON.stringify(old)}; init['dmscreen/backups'] = {items: [{id: '2026-01-01', note: 'napi'}]};
    const f = makeFakeDb(init);
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
    await W.restoreBackup('2026-01-01'); await mentve();
    eq([A('S.library').map(c => c.name), A('S.enc.round')], [['Régi Zombie'], 4]);
    ok(!f.store['dmscreen_library/b'], 'a régi mentésben nem szereplő lény nem törlődött a felhőből');
    ok(f.store['dmscreen/backups'].items.some(b => b.note === 'visszaállítás előtt'), 'nem készült mentés a visszaállítás előtt');
  });
  test('Menü: mentések listája, „Mentés most”, visszaállítás gomb', async () => {
    const f = makeFakeDb(withData());
    await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db}); await mentve();
    W.openMenu(); click('[data-act="openBackups"]'); await until(() => $$('[data-backup]').length === 1, 2000, 'lista');
    click('[data-act="backupNow"]'); await until(() => $$('[data-backup]').length === 2, 2000, '„Mentés most”');
    has($('#modalBox').textContent, 'kézi mentés');
    add(mk('Utána'));
    click($$('[data-act="backupRestore"]')[1]); await mentve();
    has(allLog(), 'visszaállítva');
    ok(!$$('.tile').some(t => t.textContent.includes('Utána')), 'a visszaállítás után a csempék frissülnek');
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
// a D&D Beyond minta bővítése felszereléssel, pénzzel, egyedi nevekkel, Jack of All Trades-szel
function ddbParty() {
  const d = structuredClone(DDB);
  d.data.currencies = {cp: 7, sp: 20, ep: 0, gp: 150, pp: 2};
  d.data.inventory = [
    {id: 1, containerEntityId: 424242, quantity: 1, equipped: true, isAttuned: true, definition: {name: 'Ring of Protection', magic: true, rarity: 'Rare'}},
    {id: 2, containerEntityId: 424242, quantity: 1, equipped: false, definition: {name: 'Backpack', isContainer: true}},
    {id: 3, containerEntityId: 2, quantity: 5, definition: {name: 'Rations (1 day)'}},
    {id: 4, containerEntityId: 2, quantity: 1, definition: {name: 'Rope, Hempen (50 feet)'}},
    {id: 5, containerEntityId: 424242, quantity: 1, definition: {name: 'Spell Scroll (1st Level)', magic: true, rarity: 'Common'}},
    {id: 6, containerEntityId: 424242, quantity: 0, definition: {name: 'Hand Drum'}},
    {id: 7, containerEntityId: 424242, quantity: 1, equipped: true, definition: {name: 'Breastplate', armorTypeId: 2, armorClass: 14}}
  ];
  d.data.characterValues = [{typeId: 8, valueId: 5, value: 'Mage Armor'}, {typeId: 9, valueId: 1, value: 'a nagymamától'}];
  d.data.modifiers.class.push(
    {type: 'half-proficiency', subType: 'ability-checks'}, {type: 'half-proficiency', subType: 'initiative'},
    {type: 'bonus', subType: 'passive-perception', value: 5},
    {type: 'proficiency', subType: 'thieves-tools', friendlySubtypeName: "Thieves' Tools"}, {type: 'proficiency', subType: 'lute', friendlySubtypeName: 'Lute'},
    {type: 'proficiency', subType: 'longsword', friendlySubtypeName: 'Longsword'}, {type: 'proficiency', subType: 'light-armor', friendlySubtypeName: 'Light Armor'},
    {type: 'proficiency', subType: 'simple-weapons', friendlySubtypeName: 'Simple Weapons'});
  return d;
}
const manualPc = () => W.normCreature({name: 'Borin', kind: 'pc', cr: 'Szint 5', abilities: {str: 16, dex: 12, con: 14, int: 8, wis: 14, cha: 10},
  skills: 'Perception +5, Sleight of Hand +7', senses: 'darkvision 60 ft.', languages: 'Common, Dwarvish',
  inventory: [{name: 'Torch', qty: 10, container: 'Backpack'}, {name: 'Rope, Silk (50 feet)', qty: 1}], currency: {gp: 40, sp: 5}, tools: "Smith's Tools"});

describe('Csapat nézet (harcon kívül)', () => {
  test('D&D Beyond: felszerelés tárolókkal, egyedi névvel, jegyzettel; 0 darabos kimarad', () => {
    const inv = W.convertDDB(ddbParty()).inventory;
    eq(inv.map(i => [i.name, i.qty, i.container]), [['Ring of Protection', 1, ''], ['Backpack', 1, ''], ['Rations (1 day)', 5, 'Backpack'], ['Rope, Hempen (50 feet)', 1, 'Backpack'], ['Mage Armor (Spell Scroll (1st Level))', 1, ''], ['Breastplate', 1, '']]);
    eq([inv[0].attuned, inv[0].equipped, inv[0].magic, inv[0].rarity, inv[0].note], [true, true, true, 'Rare', 'a nagymamától']);
  });
  test('tárolóazonosító nélküli tárgyak a fő listába kerülnek', () => {
    eq(W.convertDDB(DDB).inventory.map(i => i.container), ['', '', '', '', '', '', '']);
  });
  test('D&D Beyond: pénz, eszköz- és hangszer-jártasság (fegyver/páncél nélkül), import dátuma', () => {
    const c = W.convertDDB(ddbParty());
    eq(c.currency, {pp: 2, gp: 150, ep: 0, sp: 20, cp: 7});
    eq(c.tools, "Thieves' Tools, Lute");
    eq(c.importedAt, A('localDate()').slice(0, 4) + c.importedAt.slice(4)); ok(/^\d{4}-\d{2}-\d{2}$/.test(c.importedAt));
  });
  test('Jack of All Trades: fél jártasság a nem jártas skillekre és az initiative-ra', () => {
    const c = W.convertDDB(ddbParty());  // 5. szint → jártassági bónusz 3, a fele 1
    eq(c.skillMods.perception, {b: 2, p: 0.5});
    eq(c.skillMods.athletics, {b: 6, p: 1}); eq(c.skillMods.stealth, {b: 9, p: 2});
    eq(c.initBonus, 3 + 2 + 1);
  });
  test('passzív érték: 10 + skill + passzív bónusz (pl. Observant)', () => {
    const c = W.convertDDB(ddbParty());
    eq([W.passiveScore(c, 'perception'), W.passiveScore(c, 'investigation'), W.passiveScore(c, 'insight')], [17, 12, 12]);
    has(c.senses, 'passive Perception 17');
  });
  test('kézzel felvitt játékos: skill a „Skills” mezőből, különben képességmódosító', () => {
    const c = manualPc();
    eq([W.partySkill(c, 'perception'), W.partySkill(c, 'sleight-of-hand'), W.partySkill(c, 'arcana')], [{b: 5, p: 1}, {b: 7, p: 1}, {b: -1, p: 0}]);
    eq(W.skillLabel('sleight-of-hand'), 'Sleight of Hand');
  });
  test('nézet: passzív táblázat és skill-táblázat, a legjobb kiemelve; szörny nem jelenik meg', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.upsertLibrary(W.normCreature(mk()));
    W.openParty();
    const [pt, st] = $$('.ptable');
    eq([...pt.rows].map(r => [...r.cells].slice(0, 4).map(c => c.textContent.trim())), [['Név', 'Passive Perception', 'Passive Investigation', 'Passive Insight'], ['Borin', '15', '9', '12'], ['Teszt Tünde', '17', '12', '12']]);
    eq([...pt.rows[2].cells].slice(1, 4).map(c => c.classList.contains('best')), [true, true, true]);
    const stealth = [...st.rows].find(r => r.cells[0].textContent.startsWith('Stealth'));
    eq([...stealth.cells].slice(1, 3).map(c => c.textContent), ['+1', '+9◆']);
    ok(stealth.cells[2].classList.contains('best'));
    hasNot($$('.ptable').map(t => t.textContent).join('') + $('.pcards').textContent, 'Goblin');
  });
  test('titkos dobás cellára kattintva, előnnyel, és csoportos dobás', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.openParty();
    stubRnd(12); click($$('td.sk[data-sk="stealth"]')[1]);
    has($('#partyRoll').textContent, 'Teszt Tünde Stealth: 21'); has(allLog(), 'Stealth');
    stubRnd(3, 15); click($$('td.sk[data-sk="perception"]')[0], {shiftKey: true});
    has($('#partyRoll').textContent, 'Borin Perception: 20'); has($('#partyRoll').textContent, 'előny');
    stubRnd(10); click('[data-act="partyGroup"][data-sk="insight"]');
    has($('#partyRoll').textContent, 'Borin Insight: 12'); has($('#partyRoll').textContent, 'Teszt Tünde Insight: 12');
  });
  test('skill leírása (TERV-fejlesztesek-2026-11.md, 2. lépés): a skill nevére kattintva kinyílik alatta, újra kattintva bezárul; a cella továbbra is dobást kér', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.openParty();
    ok(!$('tr.skinfo'), 'alapból zárva');
    has($('[data-act="partySkillInfo"][data-sk="stealth"]').title, 'Lopakodás');
    click('[data-act="partySkillInfo"][data-sk="stealth"]');
    eq($$('tr.skinfo').length, 1); has($('tr.skinfo').textContent, 'Lopakodás');
    click('[data-act="partySkillInfo"][data-sk="arcana"]');
    eq($$('tr.skinfo').length, 1, 'egyszerre egy'); has($('tr.skinfo').textContent, 'Mágikus tudás');
    click('[data-act="partySkillInfo"][data-sk="arcana"]'); ok(!$('tr.skinfo'), 'bezárult');
    stubRnd(12); click($$('td.sk[data-sk="stealth"]')[1]); has($('#partyRoll').textContent, 'Stealth: 21');
  });
  test('kereső a tárgyak között: találatszám, elrejtés, a találat nélküli kártya halványabb', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.openParty();
    setVal('#partySearch', 'ROPE', 'input');
    eq($('#partySearchInfo').textContent, '2 találat');
    eq($$('#modalBox [data-item]:not([hidden])').map(li => li.textContent), ['Rope, Silk (50 feet)', 'Rope, Hempen (50 feet)']);
    setVal('#partySearch', 'torch', 'input');
    eq($$('.pcard').map(c => c.style.opacity), ['1', '0.35']);
    setVal('#partySearch', 'nagymamától', 'input'); eq($('#partySearchInfo').textContent, '1 találat');
    setVal('#partySearch', '', 'input'); eq($$('#modalBox [data-item][hidden]').length, 0);
  });
  test('kártyák: pénz, tárolók, hangolt/viselt jelölés, eszközök; a csapat összes pénze', () => {
    W.upsertLibrary(W.convertDDB(ddbParty())); W.upsertLibrary(manualPc()); W.openParty();
    const tunde = $$('.pcard')[1].textContent;
    has(tunde, '2 pp, 150 gp, 20 sp, 7 cp'); has(tunde, '🎒 Backpack'); has(tunde, '5× Rations'); has(tunde, '✦ hangolva'); has(tunde, 'viselve'); has(tunde, "Thieves' Tools, Lute");
    has(tunde, 'D&D Beyond import:');
    has($('#modalBox').textContent, 'Csapat pénze: 2 pp, 190 gp, 25 sp, 7 cp');
    eq(W.coinsGp({pp: 2, gp: 190, sp: 25, cp: 7}), 212.57);
  });
  test('üres csapat: útmutató üzenet', () => { W.openParty(); has($('#modalBox').textContent, 'Még nincs játékos'); });
  test('szerkesztő: felszerelés szövegként (darab, tároló), a jelölések megmaradnak; pénz és eszközök', async () => {
    const c = W.upsertLibrary(W.convertDDB(ddbParty())); W.openParty();
    click('.pcard [data-act="partyEdit"]');
    const f = $('#edForm').elements;
    has(f.inventory.value, '5× Rations (1 day) [Backpack]');
    f.inventory.value = f.inventory.value + '\n3× Fáklya [Backpack]\nVarázspálca';
    f.cur_gp.value = '999'; f.tools.value = "Thieves' Tools, Lute, Flute";
    click('[data-act="edSave"]');
    const s = A('S.library')[0];
    ok(s.inventory.find(i => i.name === 'Ring of Protection').attuned, 'elveszett a hangolás');
    eq(s.inventory.filter(i => ['Fáklya', 'Varázspálca'].includes(i.name)).map(i => [i.name, i.qty, i.container]), [['Fáklya', 3, 'Backpack'], ['Varázspálca', 1, '']]);
    eq([s.currency.gp, s.currency.pp, s.tools, s.id], [999, 2, "Thieves' Tools, Lute, Flute", c.id]);
    await until(() => !$('#modal').hidden && $('#modalBox').textContent.includes('Passzív értékek'), 2000, 'visszatérés a Csapat nézetre');
  });
  test('tisztítás: hibás felszerelés-, pénz- és skilladatok', () => {
    const c = W.normCreature({inventory: ['szöveg', {name: {x: 1}}, {name: 'Kötél', qty: 'sok', equipped: 'igen'}], currency: {gp: -5, pp: 'x'},
      skillMods: {stealth: {b: '4', p: 7}, hacking: {b: 9, p: 1}}, passiveBonus: {perception: 'x'}, importedAt: '<b>'});
    eq(c.inventory, [{name: 'Kötél', qty: 1, equipped: true, attuned: false, magic: false, rarity: '', container: '', note: '', ref: ''}]);
    eq([c.currency.gp, c.currency.pp, c.skillMods, c.passiveBonus.perception, c.importedAt], [0, 0, {stealth: {b: 4, p: 0}}, 0, '']);
  });
  test('a felszerelés és a nyelvek nem tudnak kódot befecskendezni', async () => {
    W.upsertLibrary(W.normCreature({name: XSS, kind: 'pc', languages: XSS, tools: XSS, senses: XSS, notes: XSS, type: XSS,
      inventory: [{name: XSS, note: XSS, container: XSS, rarity: XQ, qty: XQ}], currency: {gp: XSS}, skillMods: {stealth: {b: XSS, p: XQ}}}));
    W.openParty(); setVal('#partySearch', 'img', 'input'); click('td.sk[data-sk="stealth"]');
    await wait(200); assertNoXss();
  });
});

// ======================================================================
const partyNames = () => $$('.ptable')[0] ? [...$$('.ptable')[0].rows].slice(1).map(r => r.cells[0].textContent.trim()) : [];
const setupParty = () => {
  W.upsertLibrary(W.convertDDB(ddbParty()));  // Teszt Tünde: P.Perc 17, P.Inv 12, P.Ins 12
  W.upsertLibrary(manualPc());                 // Borin: 15, 9, 12
  W.upsertLibrary(W.normCreature({name: 'Aria', kind: 'pc', abilities: {wis: 18, int: 16}}));  // 14, 13, 14
  W.upsertLibrary(W.normCreature({name: 'Kísérő Bard', kind: 'npc', abilities: {wis: 10}}));
  W.upsertLibrary(W.normCreature(mk()));
};
describe('Csapat: tagok és rendezés', () => {
  test('alapból az összes játékos a csapatban, NPC és szörny nem', () => {
    setupParty(); W.openParty();
    eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde']);
    eq($$('[data-act="partyRemove"]').length, 3);
  });
  test('kivétel a csapatból (✕), a beállítás elmentődik', () => {
    setupParty(); W.openParty();
    click($$('[data-act="partyRemove"]').find(c => c.textContent.includes('Borin')));
    eq(partyNames(), ['Aria', 'Teszt Tünde']);
    eq(A('S.settings.partyIds').length, 2); hasNot($('#modalBox .pcards').textContent, 'Borin');
  });
  test('hozzáadás a könyvtárból (NPC is), a listában csak a nem-tagok vannak', () => {
    setupParty(); W.openParty();
    const opts = [...$('#partyAddSel').options].slice(1).map(o => o.textContent);
    eq(opts, ['Kísérő Bard (NPC)', 'Goblin (Szörny)'], 'előbb az NPC-k, aztán a szörnyek');
    setVal('#partyAddSel', $$('#partyAddSel option').find(o => o.textContent.startsWith('Kísérő')).value);
    eq(partyNames(), ['Aria', 'Borin', 'Kísérő Bard', 'Teszt Tünde']);
    has($('#modalBox .pcards').textContent, 'Kísérő Bard');
  });
  test('könyvtár: 👥 gomb ki-be kapcsolja a tagságot', () => {
    setupParty(); W.openLib('lib');
    const btn = name => $$('#libRows .lrow').find(r => r.querySelector('b').textContent === name).querySelector('[data-act="libParty"]');
    ok(btn('Aria').classList.contains('on') && !btn('Goblin').classList.contains('on'), 'rossz kezdőállapot');
    click(btn('Aria')); click(btn('Goblin'));
    ok(!btn('Aria').classList.contains('on') && btn('Goblin').classList.contains('on'), 'nem váltott');
    W.openParty(); eq(partyNames(), ['Borin', 'Goblin', 'Teszt Tünde']);
  });
  test('törölt könyvtári lény eltűnik a csapatból; üres csapat üzenet', () => {
    setupParty(); W.openParty();
    ['Aria', 'Borin'].forEach(n => click($$('[data-act="partyRemove"]').find(c => c.textContent.includes(n))));
    A('S.library = S.library.filter(c => c.name !== "Teszt Tünde")'); W.openParty();
    has($('#modalBox').textContent, 'Nincs senki a csapatban'); ok($('#partyAddSel'), 'nincs hozzáadás lista');
  });
  test('tagság mentése és betöltése (tisztítással)', () => {
    setupParty();
    const id = A('S.library').find(c => c.name === 'Aria').id;
    W.importBackup({library: A('S.library'), enc: {list: []}, settings: {partyIds: [id, id, '"><img>', 5]}});
    eq(A('S.settings.partyIds'), [id]);
    W.importBackup({library: A('S.library'), enc: {list: []}, settings: {partyIds: 'nem tömb'}});
    eq(A('S.settings.partyIds'), null); W.openParty(); eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde']);
  });
  test('felhőbe is elmentődik a tagság', async () => {
    const f = makeFakeDb(); await W.DMApp.setAuth({status: 'signedIn', email: 't', db: f.db});
    setupParty(); W.openParty(); click($$('[data-act="partyRemove"]')[0]); await mentve();
    eq(f.store['dmscreen/state'].settings.partyIds.length, 2);
  });
  test('passzív táblázat rendezése oszlopra: először csökkenő, újra kattintva növekvő; név szerint', () => {
    setupParty(); W.openParty();
    const th = txt => $$('.ptable')[0].querySelectorAll('th.sortable')[txt];
    click(th(1)); eq(partyNames(), ['Teszt Tünde', 'Borin', 'Aria']); has(th(1).textContent, '▼');
    click(th(1)); eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde']); has(th(1).textContent, '▲');
    click(th(3)); eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde'], 'Insight csökkenő, egyenlőségnél ábécé (14, 12, 12)');
    click(th(0)); eq(partyNames(), ['Aria', 'Borin', 'Teszt Tünde']); click(th(0)); eq(partyNames(), ['Teszt Tünde', 'Borin', 'Aria']);
  });
  test('skill-táblázat rendezése egy tag oszlopa szerint, ábécébe, és vissza az alap sorrendhez', () => {
    setupParty(); W.openParty();
    const skillOrder = () => [...$$('.ptable')[1].rows].slice(1).map(r => r.cells[0].firstChild.textContent.trim());
    eq(skillOrder()[0], 'Athletics');
    click($$('.ptable')[1].querySelector('th[data-col="skill"]'));
    eq(skillOrder().slice(0, 3), ['Acrobatics', 'Animal Handling', 'Arcana']);
    const tundeTh = () => [...$$('.ptable')[1].querySelectorAll('th.sortable')].find(t => t.textContent.startsWith('Teszt Tünde'));
    click(tundeTh());
    eq(skillOrder()[0], 'Stealth', 'Tünde legjobb skillje (+9) kerül előre'); has(tundeTh().textContent, '▼');
    click(tundeTh()); eq(skillOrder().slice(-1)[0], 'Stealth');
    click('[data-act="partySortReset"]'); eq(skillOrder()[0], 'Athletics'); ok(!$('[data-act="partySortReset"]'), 'a gomb nem tűnt el');
  });
  test('rendezéskor a keresés és az utolsó dobás megmarad', () => {
    setupParty(); W.openParty();
    stubRnd(10); click($$('td.sk')[0]); const roll = $('#partyRoll').textContent;
    setVal('#partySearch', 'rope', 'input');
    click($$('.ptable')[0].querySelectorAll('th.sortable')[1]);
    eq([$('#partyRoll').textContent, $('#partySearch').value, $('#partySearchInfo').textContent], [roll, 'rope', '2 találat']);
  });
});

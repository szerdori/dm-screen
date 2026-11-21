// DM Screen – regressziós tesztek: szerződés (szerzodes.js), rétegek, verzióőr, általános.
// A keret és a közös segédek: tests/keret.js. A fájlok a tests/index.html sorrendjében töltődnek; egy fájl a korábbiak segédeit használhatja.
'use strict';

describe('Szerződés (szerzodes.js)', () => {
  test('rétegek: csak a js/adat/tar.js hívja az adatbázist; a logika nem nyúl a DOM-hoz, a felület nem hívja a Tar-t (docs/dontesek/0006)', async () => {
    const szoveg = async f => (await fetch('../' + f, {cache: 'no-store'})).text();
    const html = await szoveg('index.html');
    // csak a sima <script> blokkok: a Firebase-modul (type="module") maga a port-illesztő, az szándékosan kimarad (docs/dontesek/0001)
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
    const fajlok = [...html.matchAll(/<script src="(js\/[\w\/-]+\.js)\?v=\d+"><\/script>/g)].map(m => m[1]);
    const logika = fajlok.filter(f => f.startsWith('js/logika/')), felulet = fajlok.filter(f => f.startsWith('js/felulet/'));
    ok(fajlok.includes('js/adat/tar.js') && logika.length >= 10 && felulet.length >= 3, 'megtalálta a fájlokat: ' + fajlok.join(', '));
    eq(fajlok.length, [...html.matchAll(/<script[^>]*src="js\//g)].length, 'minden js/ fájl a megszokott alakban töltődik (<script src="js/….js?v=N">)');
    const talal = (kod, re) => [...kod.matchAll(re)].map(m => m[0]);
    const DB_RE = /\b(DB|UT|db)\??\.\w+/g, TAR_RE = /\b(Tar|DB|UT|db)\??\.\w+/g,
      DOM_RE = /\bdocument\.|(?<![\\\w$])\$\$?\(|\.(innerHTML|outerHTML|classList)\b|querySelector|getElements?By|insertAdjacentHTML|createElement/g;
    eq(talal(inline, DB_RE), [], 'index.html: közvetlen adatbázis- vagy útvonal-hívás');
    for (const f of fajlok.filter(f => f !== 'js/adat/tar.js')) {
      const kod = await szoveg(f);
      eq(talal(kod, DB_RE), [], f + ': közvetlen adatbázis- vagy útvonal-hívás');
      if (logika.includes(f)) eq(talal(kod, DOM_RE), [], f + ': a logika nem nyúl a DOM-hoz');
      if (felulet.includes(f)) eq(talal(kod, TAR_RE), [], f + ': a felület nem hívja a Tar-t');
    }
    has(await szoveg('js/adat/tar.js'), 'db.set(', 'a Tar ír');
    // a logika nem hívja a felület függvényeit, csak az Ertesito-n át szól
    const nevek = new Set(['confirm', 'alert', 'prompt']);
    for (const f of felulet) for (const m of (await szoveg(f)).matchAll(/^(?:async )?function (\w+)|^const (\w+) = /gm)) nevek.add(m[1] || m[2]);
    ok(nevek.has('render') && nevek.has('log') && nevek.has('setSaveState') && nevek.has('closeModal'), 'megtalálta a felület neveit');
    const HIVAS_RE = new RegExp(`(?<![\\w.$])(${[...nevek].join('|')})\\(`, 'g');
    for (const f of logika) {
      const kod = (await szoveg(f)).replace(/^\s*\/\/.*$/gm, '');
      eq(talal(kod, HIVAS_RE), [], f + ': a logika nem hívja a felületet');
    }
  });
  test('böngésző-tároló: a js/ fájlok csak a közös Bongeszotar-on át nyúlnak a localStorage-hoz (kozos.js), és az elérhetetlen tároló mellett sem dobnak', async () => {
    const szoveg = async f => (await fetch('../' + f, {cache: 'no-store'})).text();
    const fajlok = new Set();
    for (const lap of ['index.html', 'karakter.html', 'player.html'])
      for (const m of (await szoveg(lap)).matchAll(/<script src="(js\/[\w\/-]+\.js)\?v=\d+"><\/script>/g)) fajlok.add(m[1]);
    ok(fajlok.size >= 30, 'megtalálta a fájlokat: ' + fajlok.size);
    for (const f of fajlok) eq([...(await szoveg(f)).replace(/^\s*\/\/.*$/gm, '').matchAll(/\blocalStorage\b/g)].length, 0, f + ': közvetlen localStorage');
    has(await szoveg('kozos.js'), 'localStorage.getItem(', 'a kozos.js a tároló egyetlen helye');
    // működés: írás, olvasás, törlés; tiltott tárolónál (privát mód) null / false, kivétel nélkül
    for (const w of [W, K]) {
      const B = w.eval('Bongeszotar'), k = 'dmscreen-proba-kulcs';
      eq([B.ir(k, 'x'), B.olvas(k), B.torol(k), B.olvas(k)], [true, 'x', true, null]);
      const orig = Object.getOwnPropertyDescriptor(w, 'localStorage');
      try {
        Object.defineProperty(w, 'localStorage', {configurable: true, get() { throw new Error('tiltva'); }});
        eq([B.ir(k, 'x'), B.olvas(k), B.torol(k)], [false, null, false]);
      } finally { if (orig) Object.defineProperty(w, 'localStorage', orig); else delete w.localStorage; }
    }
  });
  test('böngésző-tároló: ha a helyi másolat írása dob (pl. régi, gyorsítótárazott kozos.js, Bongeszotar nélkül), a felhős mentés akkor is megy', async () => {
    const f = makeFakeDb({'dmscreen/state': {enc: {list: [], round: 1, active: null}, settings: {}}});
    await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await mentve(); f.log.splice(0);
    const B = A('Bongeszotar'), ir = B.ir;
    try {
      B.ir = () => { throw new ReferenceError('Bongeszotar is not defined'); };
      add(mk('Tároló nélkül')); await mentve();
      ok(f.log.includes('set dmscreen/state'), 'a felhőbe írt: ' + f.log.join(', '));
      ok(Object.keys(f.store).some(k => k.startsWith('dmscreen_library/')) || f.store['dmscreen/state'].enc.list.length === 1, 'az encounter a felhőben');
    } finally { B.ir = ir; }
  });
  test('telefonos lap: a „csak a bekészítettek” szűrő tiltott tárolónál a memóriában marad, amíg az oldal nyitva van', () => {
    const orig = Object.getOwnPropertyDescriptor(K, 'localStorage');
    try {
      Object.defineProperty(K, 'localStorage', {configurable: true, get() { throw new Error('tiltva'); }});
      eq(K.csakBekeszitett(), false, 'alapból minden látszik');
      K.csakBekeszitettAllit(true); eq(K.csakBekeszitett(), true, 'bekapcsolva');
      K.csakBekeszitettAllit(false); eq(K.csakBekeszitett(), false, 'kikapcsolva');
    } finally { if (orig) Object.defineProperty(K, 'localStorage', orig); else delete K.localStorage; K.csakBekeszitettAllit(false); }
    eq([K.csakBekeszitett(), K.localStorage.getItem(K.Szerzodes.HELYI.csakBekeszitett)], [false, null], 'a tároló visszaállt');
  });
  test('sheet-adat.js: a sheet.js adattáblái innen jönnek (ugyanaz az objektum a Sheet alatt), csak adat (függvény nélkül), mindkét oldalon', () => {
    for (const w of [W, K]) {
      const D = w.SheetAdat, H = w.Sheet;
      ok(D && Object.keys(D).length >= 10, 'betöltve');
      for (const n of ['SKILL_INFO', 'FEATURE_FX', 'TCE_FX', 'TCE_CSERE', 'TCE_LISTA', 'MEZO_INFO', 'FX_LABEL']) ok(H[n] === D[n], 'Sheet.' + n + ' = SheetAdat.' + n);
      const fuggveny = (x, ut) => typeof x === 'function' ? [ut] : x && typeof x === 'object' && !(x instanceof w.RegExp) ? Object.entries(x).flatMap(([k, v]) => fuggveny(v, ut + '.' + k)) : [];
      eq(fuggveny(D, 'SheetAdat'), [], 'függvény az adatban');
      ok(w.eval('MODULOK')['sheet-adat'] >= 1, 'a sheet-adat modul bejelentve');
    }
    ok(Object.keys(W.SheetAdat.LAND_SPELLS).length === 8 && W.SheetAdat.FEATURE_FX['Druid|Land|Circle Spells'], 'a FEATURE_FX a LAND_SPELLS-ből épül');
  });
  test('rétegek: a keresések találatai (fiveResults, itemResults) felületi állapot – a felület deklarálja, a logika nem ismeri', async () => {
    const szoveg = async f => (await (await fetch('../' + f, {cache: 'no-store'})).text()).replace(/\/\/.*$/gm, '');
    const html = await szoveg('index.html');
    const logika = [...html.matchAll(/<script src="(js\/logika\/[\w-]+\.js)\?v=\d+"><\/script>/g)].map(m => m[1]);
    ok(logika.length >= 10, 'megtalálta a logikai fájlokat');
    for (const f of logika) eq((await szoveg(f)).match(/\b(fiveResults|itemResults)\b/g), null, f + ': keresési találat a logikában');
    has(await szoveg('js/felulet/konyvtar-ablak.js'), 'let fiveResults = [], itemResults = [];');
  });
  test('Értesítő: a logika üzenetei eljutnak a felületre (napló, mentésjelző, telefonos lap változása)', () => {
    A(`Ertesito.naplo('üzenet', 'warn')`);
    eq([lastLog(), A('logLines[0].cls')], ['üzenet', 'warn']);
    A(`Ertesito.mentesAllapot('próba')`); eq($('#saveState').textContent, 'próba');
    add(mk()); W.openLib('lib');
    A(`S.library.push(normCreature({name: 'Friss'})); S.enc.list[0].hp = 3; Ertesito.lapokValtoztak()`);
    has($('#libRows').textContent, 'Friss', 'a Könyvtár lista frissül');
    has($('.tile .hpbar').textContent, '3 / ', 'a csempe frissül');
  });
  test('rétegek: az index.html-ben csak a várt változatok (VART_MODULOK) maradtak, a kód a js/ fájlokban; az indulas.js töltődik utoljára', async () => {
    const html = await (await fetch('../index.html', {cache: 'no-store'})).text();
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1].replace(/^\s*\/\/.*$/gm, '').trim());
    eq(inline.length, 1, 'egy sima <script> blokk');
    ok(/^const VART_MODULOK = \{[^}]*\};$/.test(inline[0]), 'csak a VART_MODULOK: ' + inline[0].slice(0, 80));
    ok(html.indexOf('const VART_MODULOK') < html.indexOf('<script src="kozos.js'), 'a VART_MODULOK a fájlok előtt áll');
    const srcek = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => s !== 'firebase-config.js');
    ok(srcek.at(-1).startsWith('js/indulas.js?'), 'az utolsó: ' + srcek.at(-1));
  });
  test('rétegek: a karakter.html-ben csak a VART_MODULOK maradt, a kód a js/lap/ fájlokban; csak a lap-indulas.js futtat kódot betöltéskor', async () => {
    const szoveg = async f => (await fetch('../' + f, {cache: 'no-store'})).text();
    const html = await szoveg('karakter.html');
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1].replace(/^\s*\/\/.*$/gm, '').trim());
    eq(inline.length, 1, 'egy sima <script> blokk');
    ok(/^'use strict';\s*const VART_MODULOK = \{[^}]*\};$/.test(inline[0]), 'csak a VART_MODULOK: ' + inline[0].slice(0, 80));
    const srcek = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => s !== 'firebase-config.js');
    ok(srcek.at(-1).startsWith('js/lap/lap-indulas.js?'), 'az utolsó: ' + srcek.at(-1));
    const fajlok = srcek.filter(s => s.startsWith('js/lap/')).map(s => s.split('?')[0]);
    ok(fajlok.length >= 10, 'megtalálta a fájlokat: ' + fajlok.length);
    // a többi fájl legfelső szintjén csak deklaráció: nincs figyelő, nincs hívás (a modul() bejelentésen kívül)
    for (const f of fajlok.filter(f => !f.endsWith('lap-indulas.js'))) {
      const fut = (await szoveg(f)).split(/\r?\n/).filter(l => /^[\w$.]+\(/.test(l) && !/^modul\(/.test(l));
      eq(fut, [], f + ': a legfelső szinten csak deklaráció');
      ok(!/^(document|window)\.addEventListener/m.test(await szoveg(f)), f + ': figyelő csak …Esemenyek() függvényben');
    }
  });
  test('telefonos lap gombjai: minden data-act-hoz van LAP_AKCIOK-bejegyzés vagy módosítás-kezelő, és nincs gazdátlan bejegyzés', async () => {
    const szoveg = async f => (await fetch('../' + f, {cache: 'no-store'})).text();
    const html = await szoveg('karakter.html');
    const fajlok = [...html.matchAll(/<script src="(js\/lap\/[\w-]+\.js)\?v=\d+"><\/script>/g)].map(m => m[1]);
    const kod = [html, ...await Promise.all(fajlok.map(szoveg))].join('\n').replace(/^\s*\/\/.*$/gm, '');
    eq([...kod.matchAll(/data-act=(?!"\w+")[^\s>]*/g)].map(m => m[0]), [], 'összerakott data-act (a teszt csak a szó szerinti nevet látja)');
    const nevek = new Set([...kod.matchAll(/data-act="(\w+)"/g)].map(m => m[1]));
    const kulcsok = K.eval('Object.keys(LAP_AKCIOK)');
    eq(kulcsok.filter(k => !nevek.has(k)), [], 'gazdátlan bejegyzés');
    // a mezők (jelölőnégyzet, legördülő, szövegmező) a change-figyelőben, act === '…' alapján
    const valtozas = [...nevek].filter(n => !kulcsok.includes(n)).sort();
    eq(valtozas, ['attune', 'bBase', 'bBg', 'bRace', 'coin', 'csakBek', 'equip', 'itemCont', 'itemNote', 'lvHp', 'ncEqCat', 'prep', 'todoDone']);
    const akciok = await szoveg('js/lap/lap-akciok.js');
    for (const n of valtozas) ok(akciok.includes(`act === '${n}'`), n + ': a change-figyelő kezeli');
    ok(K.eval('LAP_NELKUL').size && [...K.eval('LAP_NELKUL')].every(k => kulcsok.includes(k)), 'a lap nélküli gombok is a táblázatban');
    ok(!/switch \(act\)/.test(akciok), 'nincs nagy elágazás');
  });
  test('gombok: minden data-act-hoz van AKCIOK-bejegyzés és viszont; mind szó szerinti név (docs/dontesek/0006)', async () => {
    const szoveg = async f => (await fetch('../' + f, {cache: 'no-store'})).text();
    const html = await szoveg('index.html');
    const fajlok = [...html.matchAll(/<script src="(js\/[\w\/-]+\.js)\?v=\d+"><\/script>/g)].map(m => m[1]);
    const kod = [html, ...await Promise.all(fajlok.map(szoveg))].join('\n').replace(/^\s*\/\/.*$/gm, '');
    eq([...kod.matchAll(/data-act=(?!"\w+")[^\s>]*/g)].map(m => m[0]), [], 'összerakott data-act');
    const gombok = [...new Set([...kod.matchAll(/data-act="(\w+)"/g)].map(m => m[1]))].sort();
    ok(gombok.length >= 70, 'megtalálta a gombokat: ' + gombok.length);
    eq(gombok, A('Object.keys(AKCIOK)').sort());
  });
  test('kattintás: a dobás megelőzi a körülötte lévő gombot; ismeretlen data-act nem csinál semmit; Shift/Ctrl közös segéd', () => {
    W.addToEncounter(mk());
    W.renderGate('<button data-act="next"><span class="roll" data-roll="1d6" data-label="Próba">1d6</span></button><button id="ism" data-act="constructor">x</button>');
    stubRnd(4); click('#gate .roll');
    eq(A('S.enc.active'), null, 'a gomb nem futott le'); has(lastLog(), 'Próba');
    click('#ism'); eq(A('S.enc.active'), null);
    W.renderGate(null);
    eq(['shiftKey', 'ctrlKey', 'x'].map(k => A(`dobasMod({${k}: true})`)), ['adv', 'dis', '']);
  });
  test('kattintás: a fejléc és a kereső gombjai (ablakok, Initiative tracker, belépés)', async () => {
    const eredeti = {open: W.open, fiveSearch: W.fiveSearch, DMAuth: W.DMAuth}, hivas = [];
    try {
      W.open = (...a) => { hivas.push(a[0]); return null; };
      W.fiveSearch = () => { hivas.push('keres'); };
      W.DMAuth = {signIn: () => hivas.push('be'), signOut: () => hivas.push('ki')};
      has($('[data-act="openPlayer"]').textContent, 'Initiative tracker', 'a gomb felirata'); has(P.document.title, 'Initiative tracker', 'az ablak címe');
      click('[data-act="openPlayer"]'); click('[data-act="openCharApp"]');
      eq(hivas, ['player.html', 'karakter.html']);
      A('fiveIndex = {}'); W.openLib('five'); click('[data-act="fiveSearch"]');
      W.renderGate('<button data-act="signIn">x</button><button data-act="signOut">y</button>');
      click('#gate [data-act="signIn"]'); click('#gate [data-act="signOut"]'); W.renderGate(null);
      eq(hivas.slice(2), ['keres', 'be', 'ki']);
      eq($('#modal').hidden, true, 'a kilépés bezárja az ablakot');
      click('[data-act="openLib"]'); ok($('#libRoot'), 'könyvtár');
      W.closeModal(); click('[data-act="menu"]'); has($('#modalBox').textContent, 'Exportálás');
      W.closeModal(); click('[data-act="openLoot"]'); ok(!$('#modal').hidden, 'zsákmány');
      W.closeModal(); click('[data-act="openParty"]'); ok(!$('#modal').hidden, 'Csapat nézet');
    } finally { Object.assign(W, eredeti); W.closeModal(); }
  });
  test('a felület segédei a Tar helyett: felhoben() és szabalyMeta()', async () => {
    try {
      A('Tar.kapcsol(null)');
      eq([A('felhoben()'), await W.szabalyMeta()], [false, null], 'felhő nélkül');
      const f = makeFakeDb(); W.__fdb = f.db; A('Tar.kapcsol(window.__fdb)');
      eq(A('felhoben()'), true, 'belépve');
      await W.Tar.szabalyok.metaIr({version: 'v1', chunks: []});
      eq((await W.szabalyMeta())?.version, 'v1', 'a felhőben lévő meta');
    } finally { A('Tar.kapcsol(null)'); delete W.__fdb; }
  });
  test('minden felhős írás átmegy a szerződés tisztítóján (mentés, lap, nyilvános rész, napi mentés)', async () => {
    const {normCreature, sanitizeState, normPublicChar} = W.Szerzodes, sj = W.stableJson, hibak = [], irt = new Set();
    const idoNelkul = d => { const o = structuredClone(d); delete o.updatedAt; delete o.updatedBy; return o; };
    // a két érték eltérő mezőinek útvonala (a hibaüzenethez)
    const elter = (a, b, ut = '') => sj(a) === sj(b) ? [] : a && b && typeof a === 'object' && typeof b === 'object'
      ? [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => elter(a[k], b[k], ut + '.' + k)) : [ut];
    const ellenoriz = (p, d) => {
      const [col, id] = p.split('/'); irt.add(col);
      const [ki, be] = p === 'dmscreen/state' ? [(({enc, settings}) => ({enc, settings}))(sanitizeState(d, d.settings)), d]
        : p === 'dmscreen/backups' ? [Array.isArray(d.items), true]
        : col === 'dmscreen_backup' ? (o => [sanitizeState(o, o.settings).library, o.library])(JSON.parse(d.data))
        : col === 'dmscreen_library' ? [{...normCreature(d), id}, d]
        : col === 'dmscreen_saved' ? [sanitizeState({saved: [d]}).saved[0], d]
        : col === 'characters' ? [{...normPublicChar(d), id}, d]
        : p === 'access/players' ? [{emails: [...new Set(d.emails)].sort()}, d]
        : col === 'sheets' ? [idoNelkul(W.Sheet.norm(d)), idoNelkul(d)]
        : ['ismeretlen útvonal', p];
      const e = elter(ki, be);
      if (e.length) hibak.push(p + ' ' + e.join(', '));
    };
    // a lap a sablonból, de tisztítva (a sablon _leiras mezőjét a Sheet.norm elhagyja – az nem a DM Screen írása)
    const f = makeFakeDb({...emptyState(), 'dmscreen_library/p1': pc('Rella', 1, {id: 'p1', owner: 'a@x.hu'}), 'sheets/p1': W.Sheet.norm(sheetDoc())});
    const {set, update} = f.db;
    f.db.set = async (p, d) => { ellenoriz(p, d); return set(p, d); };
    f.db.update = async (p, d) => { await update(p, d); ellenoriz(p, f.store[p]); };
    try {
      await W.DMApp.setAuth({status: 'signedIn', email: 'dm@x.hu', db: f.db}); await mentve();
      A(`S.library.push(normCreature(${JSON.stringify(mk('Goblin', {id: 'g1'}))}), normCreature({id: 'n1', name: 'Őr', kind: 'npc', hp: {max: 20, cur: 8}, share: {vis: 'party', hp: 'label'}}))`);
      A(`S.saved.push({id: 's1', name: 'Les', list: [S.library[1]]})`);
      const [x] = W.addToEncounter(A('S.library[0]'), 1); W.addToEncounter(A('S.library[1]'), 2);
      W.damage(x, 4); W.save(); await mentve();
      await W.addBackup('2026-10-29', 'teszt');
    } finally { f.db.set = set; f.db.update = update; }
    eq(hibak, [], 'a tisztítón átmenve megváltozna');
    eq([...irt].sort(), ['access', 'characters', 'dmscreen', 'dmscreen_backup', 'dmscreen_library', 'dmscreen_saved', 'sheets'], 'minden fajta írás előfordult');
  });
  test('minden felhős útvonal gyűjteményére van szabály a firestore.rules-ban', async () => {
    const rules = await (await fetch('../firestore.rules', {cache: 'no-store'})).text(), UT = W.Szerzodes.UT;
    const utak = Object.values(UT).map(u => typeof u === 'function' ? u('x') : u);
    eq(utak.length, 15, 'az útvonalak száma (új útvonalnál a teszt is bővül)');
    has(rules, 'match /hist/{h} ', 'a lapok előzménye (alkollekció)');
    for (const u of utak) {
      const col = u.split('/')[0], doc = u.split('/')[1];
      const van = col.startsWith('dmscreen') ? rules.includes("col.matches('dmscreen.*')")
        : col === 'access' ? rules.includes(`match /access/${doc} `) : rules.includes(`match /${col}/{`);
      ok(van, 'nincs szabály: ' + u);
    }
  });
  test('egy helyen: a sheet.js szabálykönyv-útvonalai, a böngésző-tároló kulcsai és az Initiative tracker csatornája', async () => {
    const {UT, HELYI, CSATORNA} = W.Szerzodes, kert = [];
    await W.Sheet.loadRulebook({get: async p => { kert.push(p); return p === UT.szabalyMeta ? {version: 1, chunks: ['a']} : {data: '{"k":"spells","a":[]}'}; }});
    eq(kert, [UT.szabalyMeta, UT.szabalyDarab('a')]);
    eq([HELYI.allapot, HELYI.lapok, HELYI.szintlepes('x')], ['dmscreen', 'dmscreen-sheets', 'dmscreen-szintlepes-x'], 'a régi kulcsok (a böngészőben tárolt másolat ezeken van)');
    localStorage.removeItem(HELYI.allapot); A('doSave()');
    await until(() => JSON.parse(localStorage.getItem(HELYI.allapot) || 'null')?.settings?.sources, 2000, 'helyi mentés a HELYI.allapot kulcson');
    has(await (await fetch('../player.html', {cache: 'no-store'})).text(), `new BroadcastChannel('${CSATORNA}')`, 'player.html csatornája');
  });
  test('szintlépés mezői a lapon: levelUp, build.spells, spells.cls / book tisztítva; az előzmény (normHist); XSS-kód csak szövegként', () => {
    const H = W.Sheet, XSS = '<img src=x onerror=alert(1)>';
    eq(H.norm({}).levelUp, null);
    for (const to of [1, 0, -3, 'x', null]) eq(H.norm({levelUp: {to}}).levelUp, null, 'érvénytelen cél: ' + to);
    eq(H.norm({levelUp: {to: 99, by: XSS, at: 'tegnap', mc: 1, extra: 5}}).levelUp, {to: 20, by: XSS, at: '', mc: true});
    eq(H.norm({levelUp: {to: 6, by: 'dm', at: '2026-11-02T18:00:00.000Z'}}).levelUp, {to: 6, by: 'dm', at: '2026-11-02T18:00:00.000Z', mc: false});
    const b = H.norm({auto: true, build: {levels: [{c: 'Wizard'}], spells: {Wizard: {cantrips: ['Light|PHB', 'Light|PHB', 5, XSS], book: ['Shield|PHB'], kitalalt: ['X|Y']}, Bard: {known: ['Sleep|PHB']}, Fighter: 'szöveg'}}}).build;
    eq(b.spells, {Wizard: {cantrips: ['Light|PHB'], book: ['Shield|PHB']}}, 'csak a felépítés osztályai, csak érvényes refek');
    eq(H.norm({auto: true, build: {levels: []}}).build.spells, null, 'null = még nincs besorolva');
    eq(H.norm({auto: true, build: {levels: [{c: 'Bard'}], spells: {}}}).build.spells, {}, 'a besorolt, de üres lista nem null');
    const sp = H.norm({spells: [{name: 'A', cls: 'Wizard', book: 1}, {name: 'B', cls: {x: 1}}]}).spells;
    eq([sp[0].cls, sp[0].book, 'cls' in sp[1], 'book' in sp[1]], ['Wizard', true, false, false]);
    const h = H.normHist({at: '2026-11-02T18:00:00.000Z', by: 'a@x.hu', reason: 'levelup', from: 5, to: 6, hp: 'roll', sheet: {name: XSS, levelUp: {to: 6}}});
    eq([h.reason, h.from, h.to, h.hp, h.sheet.name, h.sheet.levelUp.to], ['levelup', 5, 6, 'roll', XSS, 6]);
    eq([H.normHist({reason: 'x', hp: 'x'}).reason, H.normHist({hp: 'x'}).hp, H.normHist(null).sheet.name], ['manual', '', 'Névtelen']);
    // multiclass nem teljesült feltétellel (TERV-multiclass.md)
    const hm = H.normHist({reason: 'levelup', mc: {cls: XSS, hiany: ['INT 13 kell (most 12)', 7, {x: 1}, XSS], extra: 1}, sheet: {}});
    eq(hm.mc, {cls: XSS.slice(0, 60).trim(), hiany: ['INT 13 kell (most 12)', '7', '', XSS]});
    eq([H.normHist({mc: {cls: ' '}}).mc, H.normHist({mc: 'Wizard'}).mc, h.mc], [null, null, null]);
    for (const x of [H.norm({levelUp: {to: 6, by: XSS}, spells: [{name: 'A', cls: 'Wizard', book: true, auto: true}], auto: true, build: {levels: [{c: 'Wizard'}], spells: {Wizard: {book: ['A|B']}}}}), h, hm])
      eq(JSON.parse(JSON.stringify(x.sheet ? H.normHist(x) : H.norm(x))), JSON.parse(JSON.stringify(x)), 'még egyszer tisztítva nem változik');
  });
  // a firestore.rules játékos-feltételeinek tükre (a szabályszöveget magát a konzol ellenőrzi; a teszt a szöveg kulcssorait is rögzíti)
  const szabalyTukor = (old, now) => {
    const lv = d => d.build == null ? 0 : (d.build.levels || []).length, lu = old.levelUp ?? null, nlu = now.levelUp ?? null;
    const levelsOk = (lv(old) === 0 || lv(now) > 0) && (lv(old) === 0 || lv(now) <= lv(old) || (lu != null && lv(now) <= lu.to)) && (old.auto !== true || lv(old) > 0 || lv(now) <= 1);
    const levelUpOk = fmt(nlu) === fmt(lu) || nlu == null || (lv(now) < lv(old) && nlu.to <= lv(old));
    const d = now.deleted ?? null, ownerOk = (now.owner === old.owner && fmt(d) === fmt(old.deleted ?? null)) || (now.owner === '' && d != null && d.owner === old.owner);
    const na = old.newChar ?? null, nb = now.newChar ?? null;
    const newCharOk = nb == null || (na != null && nb.target === na.target && fmt(nb.methods) === fmt(na.methods) && (na.rolls == null || fmt(nb.rolls ?? null) === fmt(na.rolls))
      && (nb.equip ?? 'any') === (na.equip ?? 'any') && ((na.eq ?? {}).gold == null || ((nb.eq ?? {}).gold ?? null) === na.eq.gold));
    return levelsOk && levelUpOk && ownerOk && newCharOk;
  };
  test('szabályok: új karakter: az üres motoros lapon legfeljebb 1 szint; a varázslót a játékos nem indíthatja, a kezdőszintet, a módszereket, a dobást nem írhatja át', async () => {
    const rules = await (await fetch('../firestore.rules', {cache: 'no-store'})).text();
    for (const sor of ["(old.get('auto', false) != true || buildLv(old) > 0 || buildLv(now) <= 1)", 'newCharOk(resource.data, request.resource.data)',
      "b == null || (a != null && b.target == a.target && b.methods == a.methods && (a.get('rolls', null) == null || b.get('rolls', null) == a.rolls)",
      "&& b.get('equip', 'any') == a.get('equip', 'any') && (a.get('eq', {}).get('gold', null) == null || b.get('eq', {}).get('gold', null) == a.eq.gold));"]) has(rules, sor, 'a tükör a szabály szövegét követi');
    const nc = (extra = {}) => ({target: 2, methods: ['array', 'roll'], rolls: null, ...extra});
    const L = (n, newChar) => ({auto: true, build: {levels: Array(n).fill({c: 'Rogue'})}, newChar});
    ok(szabalyTukor(L(0, nc()), L(1, nc())), 'az első osztály');
    ok(szabalyTukor(L(1, nc()), L(1, nc({step: 'kep'}))), 'osztályváltás, lépés');
    ok(!szabalyTukor(L(0, nc()), L(2, nc())), 'üres lapon nem kettő');
    ok(!szabalyTukor(L(1, nc()), L(2, nc())), 'engedély nélkül nincs második szint');
    ok(szabalyTukor({...L(1, null), levelUp: {to: 2}}, {...L(2, null), levelUp: null}), 'lezárás után a szintlépés a kezdőszintig megy');
    ok(!szabalyTukor(L(1, nc()), L(1, nc({target: 5}))), 'a kezdőszint nem írható át');
    ok(!szabalyTukor(L(1, nc()), L(1, nc({methods: ['manual']}))), 'a módszerek sem');
    ok(szabalyTukor(L(1, nc()), L(1, nc({rolls: [10, 10, 10, 10, 10, 10]}))), 'az első dobás');
    ok(!szabalyTukor(L(1, nc({rolls: [10, 10, 10, 10, 10, 10]})), L(1, nc({rolls: [18, 18, 18, 18, 18, 18]}))), 'a dobás nem ismételhető');
    ok(!szabalyTukor(L(1, nc({rolls: [10, 10, 10, 10, 10, 10]})), L(1, nc())), 'nem is törölhető');
    ok(szabalyTukor(L(1, nc()), L(1, null)), 'lezárás');
    // kezdő felszerelés (TERV-kezdo-felszereles.md): a DM beállítása és a megdobott kezdőarany
    ok(szabalyTukor(L(1, nc()), L(1, nc({equip: 'any', eq: {mode: 'pack'}}))), 'a régi lapon nincs equip: az alapértelmezett any');
    ok(!szabalyTukor(L(1, nc({equip: 'pack'})), L(1, nc({equip: 'any'}))), 'a DM beállítása nem írható át');
    ok(szabalyTukor(L(1, nc({eq: {gold: null}})), L(1, nc({eq: {mode: 'gold', gold: 120}}))), 'az első aranydobás');
    ok(!szabalyTukor(L(1, nc({eq: {gold: 120}})), L(1, nc({eq: {gold: 200}}))), 'az aranydobás nem ismételhető');
    ok(!szabalyTukor(L(1, nc({eq: {gold: 120}})), L(1, nc({eq: {gold: null}}))), 'nem is törölhető');
    ok(szabalyTukor(L(1, nc({eq: {gold: 120}})), L(1, nc({eq: {gold: 120, cart: [{r: 'Dagger|PHB', q: 1}]}}))), 'a kosár változhat');
    ok(!szabalyTukor(L(1, null), L(1, nc())), 'nem indítható újra');
    ok(szabalyTukor({levelUp: null}, L(5, null)), 'a kézi lap átállítása változatlan');
  });
  test('szabályok: a játékos a gazdát csak törléskor veheti le, és csak úgy, hogy a régi megmarad; a nyilvános részből is', async () => {
    const rules = await (await fetch('../firestore.rules', {cache: 'no-store'})).text();
    for (const sor of ["(now.owner == old.owner && d == old.get('deleted', null)) || (now.owner == '' && d != null && d.owner == old.owner)", 'ownerOk(resource.data, request.resource.data)',
      "(request.resource.data.owner == '' && request.resource.data.visibility == 'dm')"]) has(rules, sor, 'a tükör a szabály szövegét követi');
    const A1 = {owner: 'a@x.hu'};
    ok(szabalyTukor(A1, {owner: 'a@x.hu'}), 'marad');
    ok(!szabalyTukor(A1, {owner: 'b@x.hu'}), 'másra nem');
    ok(!szabalyTukor(A1, {owner: ''}), 'törlés-jelölés nélkül nem');
    ok(!szabalyTukor(A1, {owner: 'a@x.hu', deleted: {owner: 'idegen@x.hu'}}), 'a gazda megtartásával nem írhat be idegen címet');
    ok(!szabalyTukor(A1, {owner: '', deleted: {owner: 'x@x.hu'}}), 'más régi gazdával nem');
    ok(szabalyTukor(A1, {owner: '', deleted: {owner: 'a@x.hu'}}), 'törlés');
  });
  test('szabályok: a játékos nem adhat magának szintet és engedélyt, a régi lapot nem zárja ki; a visszavonás visszakapja az engedélyt', async () => {
    const L = (n, levelUp) => ({build: {levels: Array(n).fill({c: 'Rogue'})}, levelUp});
    const rules = await (await fetch('../firestore.rules', {cache: 'no-store'})).text();
    for (const sor of ['(buildLv(old) == 0 || buildLv(now) > 0)', "buildLv(old) == 0 || buildLv(now) <= buildLv(old) || (lu != null && buildLv(now) <= lu.to)", "b == null ? 0 : b.get('levels', []).size()", 'allow read, create: if isDM() || ownSheet();', 'allow delete: if isDM();', "lu == old.get('levelUp', null) || lu == null || (buildLv(now) < buildLv(old) && lu.to <= buildLv(old))",
      'levelsOk(resource.data, request.resource.data) && levelUpOk(resource.data, request.resource.data)']) has(rules, sor, 'a tükör a szabály szövegét követi');
    ok(szabalyTukor(L(5, null), L(5, null)), 'sima írás');
    ok(!szabalyTukor(L(5, null), L(6, null)), 'engedély nélkül nincs új szint');
    ok(szabalyTukor(L(5, {to: 6}), L(6, null)), 'engedéllyel lép, és törli');
    ok(szabalyTukor(L(5, {to: 7}), L(6, {to: 7})), 'két szintre szóló engedélynél az első után megmarad');
    ok(!szabalyTukor(L(5, {to: 6}), L(7, null)), 'az engedélyen túl nem');
    ok(!szabalyTukor(L(5, null), L(5, {to: 6})), 'engedélyt nem adhat magának');
    ok(!szabalyTukor(L(5, {to: 6}), L(5, {to: 7})), 'az engedélyt nem emelheti');
    ok(szabalyTukor(L(6, null), L(5, {to: 6})), 'visszavonás: az engedély visszajön');
    ok(!szabalyTukor(L(6, null), L(5, {to: 7})), 'visszavonásnál sem magasabbra');
    ok(szabalyTukor({levelUp: null}, L(5, null)), 'a kézi lap átállítható (nincs felépítése)');
    ok(szabalyTukor({}, {name: 'x'}), 'a mezők nélküli régi lap írható');
    ok(!szabalyTukor(L(5, null), {build: null, levelUp: null}), 'a felépítést nem veheti le (utána bármekkorát írhatna)');
    ok(!szabalyTukor(L(5, null), L(0, null)), 'üresre sem');
  });
  test('a tisztítók kimenete stabil: még egyszer tisztítva nem változik (lény, harc, állapot, nyilvános karakterrész)', () => {
    const {normCreature, normCombatant, sanitizeState, normPublicChar} = W.Szerzodes;
    const npc = {name: 'Őr', kind: 'npc', ac: 13, hp: {max: 20, cur: 8}, share: {vis: 'party', hp: 'label', ac: false}};
    for (const c of [mk(), pc('Rella', 3, {owner: 'A@X.hu', inventory: [{name: 'Kard', qty: '2'}]}), npc, {kind: 'gonosz', hp: 'x'}]) {
      const egy = normCreature(c); eq(normCreature(egy), egy, 'normCreature: ' + c.name);
    }
    const x = normCombatant({c: mk(), hp: '5', cond: [{name: 'Prone', rounds: '2'}]}); eq(normCombatant(x), x, 'normCombatant');
    const st = sanitizeState({library: [mk()], enc: {list: [x], round: 3, active: x.cid}, settings: {groupInit: false}}, A('S.settings'));
    eq(sanitizeState(st, A('S.settings')), st, 'sanitizeState');
    eq(st.settings.rollHp, A('S.settings.rollHp'), 'a hiányzó beállítás az alapértékből jön');
    try {
      A(`S.library = [${JSON.stringify(pc('Rella', 3, {id: 'p1', owner: 'a@x.hu'}))}, ${JSON.stringify({...npc, id: 'n1'})}].map(normCreature)`);
      const pub = W.publicChars(); eq(pub.length, 2);
      // kulcssorrendtől függetlenül (a Firestore sem őrzi a sorrendet)
      for (const p of pub) eq(W.stableJson(normPublicChar(p)), W.stableJson(p), 'a DM Screen által írt nyilvános rész a karakter.html tisztítóján változatlan: ' + p.name);
      eq(pub.find(p => p.id === 'n1').status, 'bloodied');
    } finally { A('S.library = []'); }
  });
  test('egy helyen: az állapotkódok (Sheet.hpStatus → ALLAPOTOK → a karakter.html címkéi) és az alapbeállítások', () => {
    const {ALLAPOTOK, ALAP_BEALLITASOK, sanitizeState} = W.Szerzodes;
    eq(Object.keys(K.eval('ST')).sort(), [...ALLAPOTOK].sort(), 'a karakter.html minden állapotkódnak ad címkét, és csak azoknak');
    for (const [cur, max] of [[10, 10], [8, 10], [5, 10], [0, 10]]) ok(ALLAPOTOK.includes(W.Sheet.hpStatus(cur, max)), `hpStatus(${cur}, ${max})`);
    eq(W.Szerzodes.normPublicChar({status: 'constructor'}).status, null, 'ismeretlen kód: null');
    eq(sanitizeState({}).settings, {...ALAP_BEALLITASOK, lastExport: '', partyIds: null}, 'alapbeállítás alap nélkül');
    ok(Object.isFrozen(ALAP_BEALLITASOK) && A('S.settings.sources') !== ALAP_BEALLITASOK.sources, 'az alap nem írható át, az app saját másolatot kap');
  });
  test('a karakter.html a szerződés tisztítóját használja; az index.html nem tart saját másolatot', () => {
    ok(K.eval('normChar') === K.Szerzodes.normPublicChar, 'karakter.html: normChar');
    for (const n of ['normCreature', 'normCombatant', 'sanitizeState', 'normInventory', 'blankCreature', 'splitEntry', 'safeId', 'str', 'TEMPLATE', 'SECTIONS'])
      ok(A(n) === W.Szerzodes[n], 'index.html: ' + n);
  });
});

// ======================================================================
describe('Általános', () => {
  test('közös kód: a három oldal a kozos.js $ / esc / rnd függvényét használja', () => {
    const src = w => ['$', 'esc', 'rnd'].map(n => w.eval(n).toString());
    eq(src(P), src(W), 'player.html'); eq(src(K), src(W), 'karakter.html');
    for (const w of [W, P, K]) {
      eq(w.eval(`esc('<a href="x">\\'&')`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
      ok(w.document.querySelector('script[src^="kozos.js"]'), 'kozos.js betöltve');
    }
  });
  test('közös kód: az index.html és a karakter.html a sheet.js segédeit használja, nem saját másolatot', () => {
    for (const n of ['ABIL', 'ABIL_FULL', 'SKILLS', 'skillLabel', 'EMAIL_RE', 'num', 'isObj', 'safeUrl', 'sgn', 'propOf']) ok(A(n) === W.Sheet[n], 'index.html: ' + n);
    for (const n of ['isObj', 'num', 'str', 'mod', 'sgn', 'safeUrl']) ok(K.eval(n) === K.Sheet[n], 'karakter.html: ' + n);
    eq([A(`propOf('finesse|PHB')`), A(`propOf({uid: 'light|PHB'})`), A('propOf(null)')], ['finesse', 'light', '']);
  });
  test('verzióőr: a <script src> ?v= száma = a fájl bejelentett változata = az oldal VART_MODULOK-ja', () => {
    for (const [nev, w] of [['index.html', W], ['karakter.html', K], ['player.html', P]]) {
      const v = {};
      for (const s of w.document.querySelectorAll('script[src*="?v="]')) {
        const m = s.getAttribute('src').match(/^(?:.*\/)?([\w-]+)\.js\?v=(\d+)$/); ok(m, nev + ': ?v= formátum: ' + s.getAttribute('src'));
        v[m[1]] = +m[2];
      }
      ok(Object.keys(v).length, nev + ': van ?v=-s közös fájl');
      const nincsV = [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).filter(s => !s.includes('?v=') && s !== 'firebase-config.js');
      eq(nincsV, [], nev + ': minden közös fájl ?v=-vel töltődik');
      for (const [f, n] of Object.entries(v)) eq(w.eval('MODULOK')[f], n, `${nev}: ${f}.js bejelentett változata`);
      if (w !== P) eq(w.eval('VART_MODULOK'), v, nev + ': VART_MODULOK');
      eq(w.eval('elteroModulok(typeof VART_MODULOK === "undefined" ? {} : VART_MODULOK)'), [], nev + ': nincs eltérés');
    }
    eq(W.Sheet.VERSION, A('MODULOK.sheet'), 'Sheet.VERSION');
  });
  test('verzióőr: régi (gyorsítótárazott) közös fájl mellett a DM Screen nem ír a lapokra, és frissítést kér', () => {
    eq(A(`MODULOK.kozos = 1; elteroModulok({kozos: 2, sheet: MODULOK.sheet, uj: 1})`), ['kozos', 'uj'], 'eltérő és be nem jelentett modul');
    try {
      A('syncSheets.warned = false');
      const ops = []; W.syncSheets(ops);
      eq(ops, [], 'nem írt'); has(lastLog(), 'Ctrl + F5');
      W.syncSheets(ops); eq(A('logLines.filter(l => l.html.includes("Ctrl + F5")).length'), 1, 'csak egyszer szól');
    } finally { A('MODULOK.kozos = VART_MODULOK.kozos; syncSheets.warned = false'); }
    ok(!A('regiFajl()'), 'visszaállítva nem régi');
    // nagyon régi kozos.js (még nincs benne verzióőr): régi fájlnak számít, és nem dob hibát
    const origW = W.elteroModulok, origK = K.elteroModulok;
    try {
      W.elteroModulok = undefined; K.elteroModulok = undefined;
      ok(A('regiFajl()'), 'index.html: verzióőr nélküli kozos.js = régi');
      A('syncSheets.warned = false'); W.syncSheets([]); has(lastLog(), 'Ctrl + F5');
      ok(K.regiFajl(), 'karakter.html: verzióőr nélküli kozos.js = régi');
    } finally { W.elteroModulok = origW; K.elteroModulok = origK; A('syncSheets.warned = false'); }
    try {
      K.eval('MODULOK.sheet = 1');
      ok(K.regiFajl(), 'karakter.html: régi sheet.js felismerve');
    } finally { K.eval('MODULOK.sheet = VART_MODULOK.sheet'); }
    ok(!K.regiFajl(), 'karakter.html: visszaállítva nem régi');
  });
  test('tesztfuttató: a részleges futás szűrője (teszt.ps1 -Csoport / -Szuro) a csoport és a teszt nevének részletére illeszt, kis- és nagybetűtől függetlenül', () => {
    const t = {group: 'Zsákmány (DMG 2014 kincstáblák)', name: 'Zsákmány (DMG 2014 kincstáblák) › egyéni kincs: érmék'};
    eq([szurtTeszt(t, '', ''), szurtTeszt(t, 'zsákmány', ''), szurtTeszt(t, 'Harc', ''), szurtTeszt(t, '', 'ÉRMÉK'), szurtTeszt(t, 'dmg', 'initiative'), szurtTeszt(t, 'kincs', 'egyéni')],
      [true, true, false, true, false, true]);
    // a csoportszűrő a csoport nevét nézi, nem a teszt teljes nevét (amiben a csoport is benne van)
    ok(!szurtTeszt({group: 'Harc', name: 'Harc › zsákmány a végén'}, 'zsákmány', ''), 'a csoportszűrő csak a csoportnévre illeszt');
    ok(TESTS.every(x => x.group && x.name.startsWith(x.group + ' › ')), 'minden tesztnek van csoportja');
  });
  test('tesztfuttató: ha egy teszt a W.f-ként el nem érhető const-os app-segédbe fut, a hibaüzenet megmondja, hogy az APP_NEVEK-hez kell adni', () => {
    has(appNevTipp(new TypeError('W.emptySaved is not a function')), 'APP_NEVEK');
    eq([appNevTipp(new TypeError('W.lenySablon is not a function')), appNevTipp(new TypeError('W.nincsIlyenNev is not a function')), appNevTipp(new Fail('x')), appNevTipp('szöveg')], ['', '', '', '']);
    ok(APP_NEVEK.every(n => typeof W[n] === 'function'), 'minden listázott név elérhető W alatt');
  });
  test('nem volt JavaScript-hiba az app futása közben', () => eq(appErrors, []));
});

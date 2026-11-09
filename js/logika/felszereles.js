// Szinthez illő felszerelés (logika, DOM nélkül): NPC-ből lett játékos karakternek a DMG 2014 38. o. „Starting Equipment” táblázata szerint
// arany, a szintsávhoz és a kampány mágiaszintjéhez illő mágikus tárgyak a szabálykönyvből (a karakterhez illők közül), és az osztály kezdő felszerelése
// duplázás nélkül. Terv: TERV-kezdo-felszereles.md. A felület (js/felulet/felszereles-ablak.js) mutatja előnézetben, a DM hagyja jóvá.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('felszereles', N) és az index.html-ben a felszereles.js?v=N és a VART_MODULOK.
'use strict';
modul('felszereles', 2);

// DMG 2014 38. o.: szintsávonként alaparany + 1d10 × szorzó, és a mágikus tárgyak ritkasága mágiaszintenként (a normál kezdő felszerelés mindig jár)
const DMG38 = [
  {hi: 4, gp: 0, mult: 0, low: [], std: [], high: []},
  {hi: 10, gp: 500, mult: 25, low: [], std: ['uncommon'], high: ['uncommon', 'uncommon']},
  {hi: 16, gp: 5000, mult: 250, low: ['uncommon'], std: ['uncommon', 'uncommon'], high: ['uncommon', 'uncommon', 'uncommon', 'rare']},
  {hi: 20, gp: 20000, mult: 250, low: ['uncommon', 'uncommon'], std: ['uncommon', 'uncommon', 'rare'], high: ['uncommon', 'uncommon', 'uncommon', 'rare', 'rare', 'very rare']}
];
const MAGIA = ['low', 'std', 'high'], MAGIA_HU = {low: 'alacsony mágia', std: 'normál mágia', high: 'magas mágia'};
const dmg38 = L => DMG38.find(b => L <= b.hi) || DMG38.at(-1);
const ATTUNE_MAX = 3, FELSZ_ARMOR_TC = ['LA', 'MA', 'HA'];
// egyszer használatos tárgyak nem kellenek (a táblázat tartós felszerelésről szól): potion, scroll, lőszer
const EGYSZERI_TC = ['P', 'SC', 'A', 'AF'], EGYSZERI_NEV = /\b(potion|philter|elixir|scroll|ammunition|arrows?|bolts?|bullets?|needles?)\b/i;
const FAJOK = ['dwarf', 'elf', 'gnome', 'halfling', 'human', 'dragonborn', 'tiefling', 'orc'];
const felszMind = rb => [...(rb?.baseItems || []), ...(rb?.items || [])];
const felszTc = (rb, i) => Sheet.byRef(felszMind(rb), i.ref, i.name)?.tc || '';

// a karakter adatai a generáláshoz: szint, osztályok, jártasságok, varázslás, faj, a mostani tárgyai
function felszKor(id, rb) {
  const c = S.library.find(x => x.id === id);
  if (!c) return null;
  const s = SHEETS[id] && !SHEETS[id].deleted ? SHEETS[id] : null;
  const osztalyok = (s ? s.classes : lenyOsztalyok(c)).filter(k => Sheet.findClass(k.name));
  // lap nélkül az osztályszintek összege (az NPC-ből lett karakter cr-je még az NPC CR-je lehet), csak ennek hiányában a cr / level mező
  const L = s ? Sheet.level(s) : osztalyok.reduce((t, k) => t + k.level, 0) || pcLevel(c) || 1;
  const fo = Sheet.findClass([...osztalyok].sort((a, b) => b.level - a.level)[0]?.name || '') || '';
  const fx = osztalyok.flatMap(k => (rb.classes || []).find(r => r.n === Sheet.findClass(k.name))?.fx || []);
  let cr = null;
  try { cr = s?.auto ? Sheet.calc(s, rb) : null; } catch {}
  const lista = (...l) => l.filter(Boolean).join(', ').toLowerCase();
  const caster = osztalyok.some(k => Sheet.CLASSES[Sheet.findClass(k.name)]?.caster || (rb.classes || []).find(r => r.n === Sheet.findClass(k.name))?.caster || (rb.subclasses || []).find(r => r.cls === Sheet.findClass(k.name) && r.n === k.subclass)?.caster)
    || !!s?.spells?.length;
  return {c, s, L, fo, osztalyok: osztalyok.map(k => Sheet.findClass(k.name)), caster,
    weapons: lista(cr?.profs?.weapons, s?.profs?.weapons, ...fx.filter(f => f.weapon).flatMap(f => f.weapon)),
    armor: lista(cr?.profs?.armor, s?.profs?.armor, ...fx.filter(f => f.armor).flatMap(f => f.armor)),
    race: String(s?.race || c.type || '').toLowerCase(), inv: (s ? s.inventory : c.inventory) || [], bg: s?.build?.background || ''};
}
// attunement-feltétel („requires attunement by a cleric / spellcaster / dwarf”): ha nem ismerjük fel, engedjük
function felszAttOk(att, k) {
  const m = String(att || '').match(/by (?:a |an )?(.+)$/i);
  if (!m) return true;
  const t = m[1].toLowerCase();
  if (/spellcaster/.test(t)) return k.caster;
  const oszt = Object.keys(Sheet.CLASSES).filter(n => t.includes(n.toLowerCase()));
  if (oszt.length) return oszt.some(n => k.osztalyok.includes(n));
  const faj = FAJOK.filter(r => t.includes(r));
  if (faj.length) return faj.some(r => k.race.includes(r));
  return true;
}
// a variáns (+1 Longsword, Armor of Resistance (Chain Mail), Longsword of Wounding) alaptárgya-e a név: a pontos alapnév, nem részszó (a „Leather Armor” nem a „Studded Leather Armor”)
const felszVariansA = (x, n) => { const v = x.n.toLowerCase(); return v.replace(/^\+\d+ /, '') === n || v.endsWith('(' + n + ')') || v.startsWith(n + ' of '); };
// jártas-e benne: fegyvernél a fegyver-jártasság (variánsnál az alapfegyveré), páncélnál a kategória, pajzsnál a shield
function felszAlapJartas(x, k, rb) {
  if (['M', 'R'].includes(x.tc)) {
    const alap = x.from ? (rb.baseItems || []).find(b => b.tc === x.tc && felszVariansA(x, b.n.toLowerCase())) : x;
    return !!alap && Sheet.seJartas({profs: {weapons: k.weapons}}, Sheet.refOf(alap), rb);
  }
  if (FELSZ_ARMOR_TC.includes(x.tc)) return k.armor.includes({LA: 'light', MA: 'medium', HA: 'heavy'}[x.tc]);
  return x.tc === 'S' ? k.armor.includes('shield') : true;
}
// a karakterhez illő-e: 'own' = a saját fegyverének / páncéljának változata; 'jartas' = olyan fegyver / páncél változata, amiben jártas; true = más illő tárgy; false = nem illik
function felszIllik(x, k, rb, sajat) {
  const fegyver = ['M', 'R'].includes(x.tc), pancel = FELSZ_ARMOR_TC.includes(x.tc), pajzs = x.tc === 'S';
  if (x.from && (fegyver || pancel || pajzs)) return sajat.some(i => i.tc === x.tc && felszVariansA(x, i.n)) ? 'own' : felszAlapJartas(x, k, rb) ? 'jartas' : false;
  if (fegyver || pancel || pajzs) return felszAlapJartas(x, k, rb);
  if (['WD', 'RD'].includes(x.tc) || /^staff of/i.test(x.n)) return k.caster;
  return true;
}
// egy ritkaság jelöltjei; own = a saját fegyverének / páncéljának változatai, ha nincs ilyen, a jártas fegyverek / páncélok változatai (ezekből kb. fele eséllyel választ)
function felszJeloltek(rar, k, rb, kizart, attSzabad) {
  const sajat = k.inv.filter(i => !i.magic).map(i => ({n: i.name.toLowerCase(), tc: felszTc(rb, i)})).filter(i => ['M', 'R', 'S', ...FELSZ_ARMOR_TC].includes(i.tc));
  const l = Sheet.allItems(rb).filter(x => x.mag && x.rar === rar && !EGYSZERI_TC.includes(x.tc) && !EGYSZERI_NEV.test(x.n) && !kizart.has(x.n.toLowerCase())
    && (!x.att || attSzabad) && felszAttOk(x.att, k)).map(x => [x, felszIllik(x, k, rb, sajat)]).filter(([, f]) => f);
  const own = l.filter(([, f]) => f === 'own').map(([x]) => x);
  return {own: own.length ? own : l.filter(([, f]) => f === 'jartas').map(([x]) => x), other: l.filter(([, f]) => f === true).map(([x]) => x)};
}
// a meglévő tárgyak közül hány kér attunementet (hangolva vagy sem): a 3-as korlát ezekkel együtt számol
const felszAttDb = (k, rb) => k.inv.filter(i => i.attuned || (i.magic && Sheet.byRef(Sheet.allItems(rb), i.ref, i.name)?.att)).length;
// volt-e már generálás (a generált tárgyak jegyzete): az ablak figyelmeztet, hogy a pénz és a tárgyak újra hozzáadódnak
const felszVoltGeneralas = id => (S.library.find(x => x.id === id)?.inventory || []).some(i => i.note.startsWith('Generálva: DMG 38. o.'));
// véletlen elem (a dobás az 1..n tartományra szorítva)
const felszVeletlen = (l, rnd) => l.length ? l[Math.min(l.length, Math.max(1, rnd(l.length))) - 1] : null;
function felszHuz(rar, k, rb, kizart, attSzabad, rnd) {
  const {own, other} = felszJeloltek(rar, k, rb, kizart, attSzabad);
  return felszVeletlen(own.length && (!other.length || rnd(2) === 1) ? own : other, rnd);
}
const felszTetel = (rar, x) => x ? {rar, ref: Sheet.refOf(x), n: x.n, att: !!x.att} : {rar, ref: '', n: '', att: false};
// az osztály (és ha van, a háttér) kezdő felszerelése véletlen választásokkal, a jártas fegyverek közül; ami már megvan, kimarad (páncél, ha visel; pajzs; ugyanaz a tárgy)
function felszKezdo(k, rb, rnd) {
  if (!k.fo) return {list: [], cp: 0};
  const {rows} = Sheet.seRows(k.fo, k.bg, rb), eq = {pick: {}, cat: {}}, cr = {profs: {weapons: k.weapons}};
  for (const row of rows) {
    const opt = felszVeletlen(row.opts, rnd);
    eq.pick[row.key] = opt.k;
    opt.items.forEach((t, j) => {
      if (t.kind !== 'cat' || !t.from.length) return;
      const jo = t.from.filter(r => Sheet.seJartas(cr, r, rb)), l = jo.length ? jo : t.from;
      eq.cat[`${row.key}:${opt.k}:${j}`] = Array.from({length: t.q}, () => felszVeletlen(l, rnd));
    });
  }
  // a név egyes számban, darabszám nélkül („Arrows (20)” = „Arrow”), hogy a meglévő lőszer is számítson
  const egy = n => String(n).toLowerCase().replace(/s?\s*\(\d+\)$/, '').replace(/s$/, '');
  const {list, cp} = Sheet.seCsomag(rows, eq), nevek = new Set(k.inv.map(i => egy(i.name)));
  const vanPancel = k.inv.some(i => i.equipped && FELSZ_ARMOR_TC.includes(felszTc(rb, i))), vanPajzs = k.inv.some(i => felszTc(rb, i) === 'S');
  // a csomag kimarad, ha a tartalmának legalább a fele már megvan
  const csomagMegvan = r => !!r?.pk?.length && r.pk.filter(p => nevek.has(egy(p.r ? Sheet.refName(p.r) : p.sp))).length * 2 >= r.pk.length;
  return {list: list.filter(x => { const r = Sheet.byRef(felszMind(rb), x.ref, x.n), tc = r?.tc;
    return !nevek.has(egy(x.n)) && !(vanPancel && FELSZ_ARMOR_TC.includes(tc)) && !(vanPajzs && tc === 'S') && !csomagMegvan(r); }), cp};
}
// a teljes terv (előnézet): {id, L, magia, gold, items: [{rar, ref, n, att}], start: [{ref, n, q}], startCp, fo}
function felszerelesTerv(id, rb, magia = S.settings.magic || 'std', rnd = window.rnd) {
  const k = felszKor(id, rb);
  if (!k) return null;
  const b = dmg38(k.L), m = MAGIA.includes(magia) ? magia : 'std';
  const kizart = new Set(k.inv.map(i => i.name.toLowerCase()));
  let att = felszAttDb(k, rb);
  const items = b[m].map(rar => {
    const x = felszHuz(rar, k, rb, kizart, att < ATTUNE_MAX, rnd);
    if (x) { kizart.add(x.n.toLowerCase()); if (x.att) att++; }
    return felszTetel(rar, x);
  });
  const {list, cp} = felszKezdo(k, rb, rnd);
  return {id, L: k.L, magia: m, fo: k.fo, gold: b.gp + (b.mult ? rnd(10) * b.mult : 0), items, start: list, startCp: cp};
}
// egy tárgy újradobása: másik ugyanabból a ritkaságból (a terv többi tárgya és a meglévők kizárva)
function felszerelesUjra(terv, i, rb, rnd = window.rnd) {
  const k = felszKor(terv.id, rb), t = terv.items[i];
  if (!k || !t) return terv;
  const kizart = new Set([...k.inv.map(x => x.name.toLowerCase()), ...terv.items.filter(x => x.n).map(x => x.n.toLowerCase())]);
  const att = felszAttDb(k, rb) + terv.items.filter((x, j) => j !== i && x.att).length;
  const x = felszHuz(t.rar, k, rb, kizart, att < ATTUNE_MAX, rnd);
  return x ? {...terv, items: terv.items.map((y, j) => j === i ? felszTetel(t.rar, x) : y)} : terv;
}
function felszerelesAranyUjra(terv, rnd = window.rnd) { const b = dmg38(terv.L); return {...terv, gold: b.gp + (b.mult ? rnd(10) * b.mult : 0)}; }
// jóváhagyás után: a könyvtári lény tárgyai és pénze (a lapra a szinkron viszi át); visszatér: hány tárgy került fel
function felszerelesHozzaad(terv, rb) {
  const c = S.library.find(x => x.id === terv.id);
  if (!c) return 0;
  const note = `Generálva: DMG 38. o., ${terv.L}. szint, ${MAGIA_HU[terv.magia]}`;
  const magikus = terv.items.filter(t => t.n).map(t => { const r = Sheet.byRef(Sheet.allItems(rb), t.ref, t.n);
    return {name: t.n, qty: 1, equipped: false, attuned: false, magic: true, rarity: t.rar, container: '', note, ref: t.ref || (r ? Sheet.refOf(r) : '')}; });
  const kezdo = Sheet.seLeltar(terv.start, rb, c.inventory);
  c.inventory = Szerzodes.normInventory([...c.inventory, ...kezdo, ...magikus]);
  const cp = Math.max(0, Math.floor(terv.gold)) * 100 + Math.max(0, Math.floor(terv.startCp || 0)), add = Sheet.seErmek(cp);
  for (const [k, v] of Object.entries(add)) c.currency[k] = (c.currency[k] || 0) + v;
  save();
  return kezdo.length + magikus.length;
}
// a terv összefoglalója a naplóba
function felszerelesSzoveg(terv, db) { return `${db} tárgy + ${terv.gold} gp (DMG 38. o., ${terv.L}. szint, ${MAGIA_HU[terv.magia]})`; }
// NPC → játékos: a statblock felszerelése (a támadások fegyverei, az AC-megjegyzés páncélja / pajzsa) tárgyként a szabálykönyvi reffel, felszerelve;
// ami már megvan, kimarad; ami nem azonosítható, azt visszaadja (a napló felsorolja). Visszatér: {uj: [inventory-tételek], ismeretlen: [nevek]}
function statblokkTargyak(id, rb) {
  const c = S.library.find(x => x.id === id);
  if (!c) return {uj: [], ismeretlen: []};
  const bolt = felszMind(rb).filter(x => !x.mag && !x.grp?.length), nevek = new Set(c.inventory.map(i => i.name.toLowerCase())), lista = [], ismeretlen = [];
  const keres = n => bolt.find(x => x.s === 'PHB' && x.n.toLowerCase() === n) || bolt.find(x => x.n.toLowerCase() === n);
  for (const nev of gearOf(c)) {
    const n = nev.toLowerCase().replace(/\s+/g, ' ').trim(), r = keres(n) || keres(n.replace(/s$/, '')) || keres(n + ' armor');
    if (!r) { ismeretlen.push(nev); continue; }
    if (nevek.has(r.n.toLowerCase()) || c.inventory.some(i => felszVariansA({n: i.name}, r.n.toLowerCase()))) continue;  // a mágikus változata (+1 Longsword) is megvan
    nevek.add(r.n.toLowerCase());
    lista.push({ref: Sheet.refOf(r), n: r.n, q: 1});
  }
  const uj = Sheet.seLeltar(lista, rb, c.inventory);
  if (uj.length) { c.inventory = Szerzodes.normInventory([...c.inventory, ...uj]); save(); }
  return {uj, ismeretlen};
}

// Véletlen build (logika, DOM nélkül): a DM megad néhány adatot (szint kötelező; faj, alfaj, osztály, alosztály, háttér, második osztály és szintje),
// a többit „értelmes véletlen” tölti ki, és kész, szabálymotoros lap lesz belőle. Terv: TERV-veletlen-build.md.
// A menet a tesztek szintlépés-robotjáé (Sheet.ncPlan → levelUpPlan / levelUpApply), csak az „első érvényes” helyett a lenti választóval.
// A véletlen a kozos.js rnd-jén át megy (a tesztben lecserélhető). A felület mutatja előnézetben, a DM hagyja jóvá.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('veletlen-build', N) és az index.html-ben a veletlen-build.js?v=N és a VART_MODULOK.
'use strict';
modul('veletlen-build', 1);

// a képességek fontossági sorrendje (az első három; a többi véletlen sorrendben jön utána); több változatnál véletlenül egy
const VB_SORREND = {
  Artificer: [['int', 'con', 'dex']], Barbarian: [['str', 'con', 'dex']], Bard: [['cha', 'dex', 'con']],
  Cleric: [['wis', 'con', 'str'], ['wis', 'dex', 'con']], Druid: [['wis', 'con', 'dex']], Fighter: [['str', 'con', 'dex'], ['dex', 'con', 'wis']],
  Monk: [['dex', 'wis', 'con']], Paladin: [['str', 'cha', 'con']], Ranger: [['dex', 'wis', 'con']], Rogue: [['dex', 'con', 'wis'], ['dex', 'int', 'con'], ['dex', 'cha', 'con']],
  Sorcerer: [['cha', 'con', 'dex']], Warlock: [['cha', 'con', 'dex']], Wizard: [['int', 'con', 'dex']]
};
// alosztály szerinti eltérés (a rövid név szerint)
const VB_ALOSZTALY = {'Eldritch Knight': [['str', 'con', 'int']], 'Arcane Trickster': [['dex', 'int', 'con']], Bladesinging: [['int', 'dex', 'con']],
  Hexblade: [['cha', 'con', 'dex']], Kensei: [['dex', 'wis', 'con']], 'Swashbuckler': [['dex', 'cha', 'con']]};
const VB_SEBZES = /\d+d\d+[^.]{0,60}damage/i;

const vbElem = l => l.length ? l[rnd(l.length) - 1] : undefined;
// súlyozott húzás: w(x) ≥ 0
function vbSuly(l, w) {
  const ws = l.map(x => Math.max(0, w(x))), t = ws.reduce((a, b) => a + b, 0);
  if (!(t > 0)) return vbElem(l);
  let r = (rnd(1000000) - 1) / 1000000 * t;
  for (let i = 0; i < l.length; i++) { r -= ws[i]; if (r < 0) return l[i]; }
  return l[l.length - 1];
}
// n darab, ismétlés nélkül, súlyozva
function vbHuz(l, n, w = () => 1) {
  const ki = [], marad = [...l];
  while (ki.length < n && marad.length) { const x = vbSuly(marad, w); ki.push(x); marad.splice(marad.indexOf(x), 1); }
  return ki;
}
const vbKever = l => vbHuz(l, l.length);
const vbRef = x => x ? x.n + '|' + x.s : '';
// név vagy ref (pl. „Elf” vagy „Elf|PHB”) a listában; a rövid nevet (alosztály) is elfogadja
function vbKeres(list, v) {
  const t = String(v || '').trim().toLowerCase();
  if (!t) return null;
  return (list || []).find(x => vbRef(x).toLowerCase() === t) || (list || []).find(x => x.n.toLowerCase() === t || String(x.short || '').toLowerCase() === t) || null;
}
const vbMod = v => Math.floor((Number(v) - 10) / 2);
const vbErtek = (cr, a) => cr.abilities[a].nat ?? cr.abilities[a].v;

function vbSorrendOf(cls, subRef, rb) {
  const sub = Sheet.subclassesOf(cls, rb).find(x => vbRef(x) === subRef);
  const c = (rb.classes || []).find(x => x.n === cls);
  const v = (sub && (VB_ALOSZTALY[sub.short] || VB_ALOSZTALY[sub.n])) || VB_SORREND[cls] || [[c?.ab && Sheet.ABIL.includes(c.ab) ? c.ab : 'str', 'con', 'dex']];
  return [...vbElem(v)];
}
// az osztály(ok) sorrendje: multiclassnál mindkét fő képesség előre kerül (PHB 163. o.: 13+ kell mindkettőből)
function vbSorrend(cls, sub, cls2, sub2, rb) {
  const a = vbSorrendOf(cls, sub, rb), b = cls2 ? vbSorrendOf(cls2, sub2, rb) : [];
  const elol = [...new Set([a[0], ...(b.length ? [b[0]] : []), ...a.slice(1), ...b.slice(1)])].slice(0, 3);
  return [...elol, ...vbKever(Sheet.ABIL.filter(x => !elol.includes(x)))];
}
// a standard array kiosztása a faji bónuszokkal együtt: a fő képesség legyen a legmagasabb (pl. Dwarf Artificer: a CON +2 miatt nem kaphat 14-et),
// ezen belül a sorrend szerint a lehető legnagyobb értékek (mind a 720 kiosztás közül)
function vbKioszt(sorrend, bon) {
  const ert = Sheet.NC_ARRAY, n = ert.length;
  let best = null;
  const jobb = (a, b) => { for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
  const perm = (kesz, marad) => {
    if (!marad.length) {
      const vegso = kesz.map((v, i) => v + (bon[sorrend[i]] || 0));
      if (vegso.some(f => f > vegso[0])) return;
      if (!best || jobb(vegso, best.vegso)) best = {kesz, vegso};
      return;
    }
    marad.forEach((v, i) => perm([...kesz, v], [...marad.slice(0, i), ...marad.slice(i + 1)]));
  };
  perm([], [...ert]);
  const k = best ? best.kesz : ert;
  return Object.fromEntries(sorrend.map((a, i) => [a, k[i]]));
}
// a faj súlya: a fő képességet emelő faj nagyobb eséllyel jön
function vbFajSuly(o, sorrend, rb) {
  const ab = {}; let szabad = false;
  for (const r of [(rb.races || []).find(x => vbRef(x) === o.race), (rb.subraces || []).find(x => vbRef(x) === o.subrace)]) {
    for (const f of r?.fx || []) {
      if (f && typeof f.ab === 'object') for (const [k, v] of Object.entries(f.ab)) ab[k] = (ab[k] || 0) + Number(v || 0);
      if (f?.abChoose) szabad = true;
    }
  }
  return 1 + 3 * (ab[sorrend[0]] || 0) + (ab[sorrend[1]] || 0) + (szabad ? 2 : 0);
}

// ---------- a választó: egy választási hely kitöltése (a robot kitolt-jának értelmes változata) ----------
// opt-előfeltétel (pl. Invocation): pact, patron, ismert varázslat vagy feature; a szint előfeltételét a választó már szűri
function vbOptOk(ref, cr, rb, b) {
  const o = (rb.optfeatures || []).find(x => vbRef(x) === ref);
  if (!o) return true;
  const paktok = cr.choices.filter(c => c.kind === 'opt').flatMap(c => c.ok).map(v => Sheet.refName(v).toLowerCase()).filter(x => x.startsWith('pact of the '));
  if (o.pact && !paktok.includes('pact of the ' + String(o.pact).toLowerCase())) return false;
  if (!o.pre) return true;
  const ismert = new Set([...cr.choices.filter(c => Sheet.SPELL_KINDS.includes(c.kind) || c.kind === 'spell').flatMap(c => c.ok).map(v => Sheet.refName(v)), ...(cr.always || []).map(x => x.name),
    ...(cr.features || []).map(f => f.name)].map(x => String(x).toLowerCase()));
  const alok = Object.values(b.sub || {}).map(v => Sheet.refName(v).toLowerCase()).concat(Object.entries(b.sub || {}).map(([cls, v]) => String(Sheet.subclassesOf(cls, rb).find(x => vbRef(x) === v)?.short || '').toLowerCase())).filter(Boolean);
  return String(o.pre).split(' / ').some(alt => alt.split(', ').every(r => {
    const t = r.trim().toLowerCase().replace(/#c$/, '');
    return !t || /\d+\. szint$/.test(t) || (t.startsWith('pact of the ') && paktok.includes(t)) || (/ patron$/.test(t) && alok.some(x => x && t.startsWith(x))) || ismert.has(t);
  }));
}
// ASI: a fő képesség 20-ig (+2, vagy 19-nél +1 / +1), utána egyharmad eséllyel feat (teljesülő előfeltétellel), különben a következő képesség
function vbAsi(cr, szabad, sorrend) {
  const v = a => vbErtek(cr, a), nyit = sorrend.filter(a => v(a) < 20), featek = szabad.filter(x => !x.warn);
  const novel = l => !l.length ? null : v(l[0]) >= 19 ? (l[1] ? {[l[0]]: 1, [l[1]]: 1} : {[l[0]]: 1}) : {[l[0]]: 2};
  if (v(sorrend[0]) < 20) return novel(nyit);
  if (featek.length && rnd(3) === 1) return {feat: vbElem(featek).v};
  return novel(nyit) || (featek.length ? {feat: vbElem(featek).v} : szabad.length ? {feat: vbElem(szabad).v} : null);
}
function vbVarazslat(c, szabad, n, rb, ctx) {
  let jo = szabad.filter(x => !x.off);
  if (jo.length < n) jo = szabad;
  const sp = v => ctx.spells.get(v), sebez = v => { const r = sp(v); return !!r && (!!r.atk || VB_SEBZES.test(r.tx || '')); };
  const ki = [], vesz = x => { ki.push(x.v); jo = jo.filter(y => y !== x); };
  if (c.kind === 'cantrips') {
    const eb = (c.ctx?.cls || c.key.split(':')[0]) === 'Warlock' && jo.find(x => x.l === 'Eldritch Blast');
    if (eb) vesz(eb);
    if (![...c.ok, ...ki].some(sebez) && ki.length < n) { const s = jo.filter(x => sebez(x.v)); if (s.length) vesz(vbElem(s)); }
  }
  while (ki.length < n && jo.length) {
    if (c.kind !== 'known' && c.kind !== 'book') { vesz(vbElem(jo)); continue; }
    // szintenként egyenletesen: a legkevésbé betöltött szintről (egyenlőségnél a magasabbról)
    const db = {};
    for (const v of [...c.ok, ...ki]) { const l = Number(sp(v)?.l) || 0; db[l] = (db[l] || 0) + 1; }
    const szintek = [...new Set(jo.map(x => x.lvl))].sort((a, b) => (db[a] || 0) - (db[b] || 0) || b - a);
    vesz(vbElem(jo.filter(x => x.lvl === szintek[0])));
  }
  return ki;
}
// szabad szöveges hely (eszköz, fegyvertípus, állattárs…)
function vbSzabad(c, n, rb) {
  const fegyver = /fegyver/i.test(c.label || '');
  let pool = c.kind === 'tool' ? Sheet.seCatItems('toolArtisan', rb).map(r => Sheet.refName(r))
    : fegyver ? [...new Set([...(rb.baseItems || [])].filter(x => x.s === 'PHB' && !x.mag && ['M', 'R'].includes(x.tc) && x.dmg).map(x => x.n))]
    : c.help?.pelda ? [String(c.help.pelda)] : [];
  pool = pool.filter(x => !c.ok.includes(x));
  const ki = vbHuz(pool, n);
  for (let i = 1; ki.length < n; i++) ki.push((c.label || 'Választás') + (i > 1 ? ' ' + i : ''));
  return ki;
}
function vbKitolt(c, cr, rb, s, ctx) {
  const H = Sheet, b = s.build, o = H.choiceOptions(c, cr, rb, s), n = c.n - c.ok.length;
  const szabad = o.opts.filter(x => !x.dis && !c.ok.includes(x.v)), tobb = l => H.setChoice(b, c, [...c.ok, ...l]);
  const prio = x => { const i = ctx.sorrend.indexOf(x.v); return i < 0 ? 9 : i; };
  const skillSuly = x => { const a = H.SKILLS[x.v], m = a ? vbMod(cr.abilities[a].v) : 0; return Math.max(0.3, 1 + m) * (ctx.sorrend.slice(0, 2).includes(a) ? 1.5 : 1) * (x.v === 'perception' ? 1.5 : 1); };
  if (c.kind === 'subclass') { const cls = c.key.replace(/:sub$/, ''); return H.setChoice(b, c, ctx.sub[cls] || vbRef(vbElem(H.subclassesOf(cls, rb)))); }
  if (c.kind === 'tce') return H.setChoice(b, c, 'nem');  // PHB 2014: marad a PHB-változat (a felhasználó bármikor átállíthatja)
  if (c.kind === 'asi') return H.setChoice(b, c, vbAsi(cr, szabad, ctx.sorrend));
  // a sorrend szerint; képességnövelésnél a már 20-as a végére kerül (nem nőhet tovább)
  const tele = x => c.kind === 'ability' && vbErtek(cr, x.v) >= 20 ? 1 : 0;
  if (c.kind === 'ability' || c.kind === 'saves') return tobb([...szabad].sort((x, y) => tele(x) - tele(y) || prio(x) - prio(y)).slice(0, n).map(x => x.v));
  if (c.kind === 'skills') return tobb(vbHuz(szabad, n, skillSuly).map(x => x.v));
  if (c.kind === 'expertise') return tobb(vbHuz(szabad, n, x => skillSuly(x) ** 3).map(x => x.v));
  if (c.kind === 'feat') { const jo = szabad.filter(x => !x.warn); return tobb(vbHuz(jo.length >= n ? jo : szabad, n).map(x => x.v)); }
  if (c.kind === 'opt') {
    const jo = szabad.filter(x => vbOptOk(x.v, cr, rb, b));
    return tobb(vbHuz(jo.length >= n ? jo : szabad, n, x => /^Agonizing Blast\|/.test(x.v) ? 8 : 1).map(x => x.v));
  }
  if (H.SPELL_KINDS.includes(c.kind) || c.kind === 'spell') return tobb(vbVarazslat(c, szabad, n, rb, ctx));
  if (o.free) return tobb(vbSzabad(c, n, rb));
  if (c.kind === 'lang') return tobb(vbHuz(szabad, n, x => x.note === 'egzotikus' ? 0.3 : 1).map(x => x.v));
  return tobb(vbHuz(szabad, n).map(x => x.v));
}

// ---------- kezdő felszerelés: a PHB-csomag (a) / (b) választásai a buildhez illően ----------
function vbFelszereles(s, rb, sorrend) {
  const H = Sheet, cr = H.calc(s, rb), rows = H.seRows(s.build.levels[0]?.c, s.build.background, rb).rows, pick = {}, cat = {};
  const all = [...(rb.baseItems || []), ...(rb.items || [])], tar = ref => all.find(x => H.refOf(x) === ref);
  const pancel = String(cr.profs.armor || '').toLowerCase(), dexes = sorrend.indexOf('dex') < sorrend.indexOf('str');
  const pont = ref => {
    const r = tar(ref);
    if (!r) return 0;
    const tc = r.tc, pr = String(r.pr || '');
    if (tc === 'HA') return pancel.includes('heavy') ? (dexes ? 0 : 4) : -6;
    if (tc === 'MA') return pancel.includes('medium') ? (dexes ? 1 : 2) : -6;
    if (tc === 'LA') return pancel.includes('light') ? (dexes ? 3 : 1) : -6;
    if (tc === 'S') return pancel.includes('shield') ? 1 : -3;
    if (tc === 'M' || tc === 'R') {
      if (!H.seJartas(cr, ref, rb)) return -3;
      if (tc === 'R') return dexes ? 2 : 0.5;
      return dexes ? (/finesse/.test(pr) ? 2 : 0) : (/finesse/.test(pr) && !/heavy/.test(pr) ? 1 : 2);
    }
    if (tc === 'SCF') return cr.casting?.length ? 1 : 0;
    return 0;
  };
  // kategóriából a legjobb pontú tárgyak közül véletlenül
  const legjobb = (from, q) => {
    const sor = from.map(r => ({r, p: pont(r)})), ki = [];
    while (ki.length < q && sor.length) {
      const max = Math.max(...sor.map(x => x.p)), x = vbElem(sor.filter(y => y.p === max));
      ki.push(x.r); if (sor.length > 1) sor.splice(sor.indexOf(x), 1);
    }
    return ki;
  };
  const tetelPont = it => it.kind === 'item' ? pont(it.ref) : it.kind === 'cat' && it.from.length ? Math.max(...it.from.map(pont)) * it.q : 0;
  for (const row of rows) {
    const jel = row.opts.map(o => ({o, p: o.items.reduce((t, it) => t + tetelPont(it), 0)})), max = Math.max(...jel.map(x => x.p));
    const best = vbElem(jel.filter(x => x.p === max)).o;
    if (row.opts.length > 1) pick[row.key] = best.k;
    best.items.forEach((it, j) => { if (it.kind === 'cat' && it.from.length) cat[`${row.key}:${best.k}:${j}`] = legjobb(it.from, it.q); });
  }
  return {mode: 'pack', pick, cat, gold: null, cart: []};
}

// ---------- a teljes build ----------
// be: {szint, nev, owner, faj, alfaj, osztaly, alosztaly, hatter, osztaly2, szint2, by, at} (a faj / háttér / alosztály név vagy ref);
// → {lap, figy: [figyelmeztetések], hibak: [ami nem sikerült]} vagy {hiba: 'szöveg'} (rossz bemenet)
function veletlenBuild(be, rb) {
  const H = Sheet;
  if (!rb?.classes?.length) return {hiba: 'Nincs betöltve a szabálykönyv (Menü → 📖 Szabálykönyv).'};
  be = be || {};
  const szint = parseInt(be.szint), osztaly = n => vbKeres(rb.classes, n)?.n || '';
  if (!(szint >= 1 && szint <= 20)) return {hiba: 'Add meg a szintet (1–20).'};
  let oszt2 = '', szint2 = 0;
  if (be.osztaly2) {
    oszt2 = osztaly(be.osztaly2); szint2 = parseInt(be.szint2) || 0;
    if (!oszt2) return {hiba: `Nincs ilyen osztály a szabálykönyvben: ${be.osztaly2}`};
    if (szint2 < 1 || szint2 >= szint) return {hiba: 'A második osztály szintje legalább 1, és kevesebb, mint a teljes szint.'};
  }
  // az osztály: a megadott; ha csak alosztály van megadva, annak az osztálya; különben véletlen (a második osztályon kívül)
  const alCls = !be.osztaly && be.alosztaly ? [...new Set((rb.subclasses || []).filter(x => vbKeres([x], be.alosztaly)).map(x => x.cls))].filter(c => c !== oszt2) : [];
  if (!be.osztaly && be.alosztaly && alCls.length !== 1) return {hiba: alCls.length ? `Több osztálynak is van ilyen alosztálya (${alCls.join(', ')}) – add meg az osztályt is.` : `Nincs ilyen alosztály a szabálykönyvben: ${be.alosztaly}`};
  const oszt = be.osztaly ? osztaly(be.osztaly) : alCls[0] || vbElem(rb.classes.filter(c => c.n !== oszt2))?.n || '';
  if (!oszt) return {hiba: `Nincs ilyen osztály a szabálykönyvben: ${be.osztaly}`};
  if (oszt2 === oszt) return {hiba: 'A második osztály ugyanaz, mint az első.'};
  const sub = be.alosztaly ? vbRef(vbKeres(H.subclassesOf(oszt, rb), be.alosztaly)) : vbRef(vbElem(H.subclassesOf(oszt, rb)));
  if (be.alosztaly && !sub) return {hiba: `Nincs ilyen ${oszt} alosztály a szabálykönyvben: ${be.alosztaly}`};
  const sub2 = oszt2 ? vbRef(vbElem(H.subclassesOf(oszt2, rb))) : '';
  const sorrend = vbSorrend(oszt, sub, oszt2, sub2, rb);
  // faj (és alfaj): a megadott, vagy véletlen a fő képességhez illők közül
  let fajok = H.raceOptions(rb);
  // csak alfaj megadva: a faja (ha egyértelmű)
  const alFaj = !be.faj && be.alfaj ? [...new Set((rb.subraces || []).filter(x => vbKeres([x], be.alfaj)).map(x => x.race))] : [];
  if (!be.faj && be.alfaj && alFaj.length !== 1) return {hiba: alFaj.length ? `Több fajnak is van ilyen alfaja (${alFaj.join(', ')}) – add meg a fajt is.` : `Nincs ilyen alfaj a szabálykönyvben: ${be.alfaj}`};
  if (be.faj || be.alfaj) {
    const r = be.faj ? vbKeres(rb.races, be.faj) : (rb.races || []).find(x => x.n === alFaj[0]);
    if (!r) return {hiba: `Nincs ilyen faj a szabálykönyvben: ${be.faj || alFaj[0]}`};
    fajok = fajok.filter(o => o.race === vbRef(r));
    if (be.alfaj) {
      const sr = vbKeres((rb.subraces || []).filter(x => x.race === r.n), be.alfaj);
      if (!sr) return {hiba: `Nincs ilyen ${r.n} alfaj a szabálykönyvben: ${be.alfaj}`};
      fajok = fajok.filter(o => o.subrace === vbRef(sr));
    }
  }
  const faj = vbSuly(fajok, o => vbFajSuly(o, sorrend, rb));
  const hat = be.hatter ? vbKeres(rb.backgrounds, be.hatter) : vbElem(rb.backgrounds || []);
  if (be.hatter && !hat) return {hiba: `Nincs ilyen háttér a szabálykönyvben: ${be.hatter}`};
  const ctx = {sorrend, sub: {[oszt]: sub, ...(oszt2 ? {[oszt2]: sub2} : {})}, spells: new Map((rb.spells || []).map(x => [vbRef(x), x]))};
  const figy = [], hibak = [], by = be.by || '', at = be.at || '';
  const szamol = s => H.norm({...s, ...H.materialize(s, H.calc(s, rb))});

  // 1. szint: az üres lapból, mint a kezdő varázsló (standard array a sorrend szerint)
  let s = H.ncBlank({name: String(be.nev || '').trim(), owner: be.owner || '', target: szint, by, at});
  let b = {...s.build, race: faj?.race || '', subrace: faj?.subrace || '', background: vbRef(hat), base: Object.fromEntries(H.ABIL.map(a => [a, 10]))};
  b = H.ncSetClass(H.norm({auto: true, build: b}).build, oszt);
  // a faji bónusz (a 10-es alapértékekhez képest), és a kiosztás ennek tudatában
  const c10 = H.calc(H.norm({...s, build: b}), rb), bon = Object.fromEntries(H.ABIL.map(a => [a, vbErtek(c10, a) - 10]));
  b = {...b, base: vbKioszt(sorrend, bon)};
  s = szamol(H.norm({...s, build: b}));
  for (let g = 0; g < 60; g++) {
    const plan = H.ncPlan(s, rb);
    // a TCE-kérdés az új karakternél nem kötelező, de itt is felelünk rá (marad a PHB), hogy ne maradjon nyitva
    const x = [...plan.choices, ...plan.spells].find(y => y.missing > 0) || plan.choices.find(y => y.c.kind === 'tce' && !y.c.done);
    if (!x) break;
    s = szamol(H.norm({...s, build: vbKitolt(x.c, plan.cr, rb, s, ctx)}));
    const u = H.ncPlan(s, rb);
    if ([...u.choices, ...u.spells].some(y => y.c.key === x.c.key && (y.missing >= x.missing && x.missing > 0 || (y.c.kind === 'tce' && !y.c.done)))) { hibak.push(`1. szint: nem tölthető ki: ${x.c.src || x.c.key}`); break; }
  }
  // szintlépések: az első osztály a (szint − második osztály szintje)-ig, utána a második
  for (let L = 2; L <= szint; L++) {
    const cls = L <= szint - szint2 ? oszt : oszt2;
    if (cls === oszt2 && L === szint - szint2 + 1) {
      const mc = H.mcCheck(s, rb, oszt2);
      if (!mc.ok) figy.push(`⚠ Multiclass-feltétel (PHB 163. o.) nem teljesül: ${mc.hiany.join('; ')}`);
    }
    let lb = H.levelUpBuild(s, cls), kesz = false;
    for (let g = 0; g < 60 && !kesz; g++) {
      const plan = H.levelUpPlan(s, rb, lb), x = [...plan.choices, ...plan.spells].find(y => y.missing > 0);
      if (!x) { kesz = true; break; }
      lb = vbKitolt(x.c, plan.nw, rb, {...s, build: lb}, ctx);
      const u = H.levelUpPlan(s, rb, lb);
      if ([...u.choices, ...u.spells].some(y => y.c.key === x.c.key && y.missing >= x.missing)) { hibak.push(`${L}. szint: nem tölthető ki: ${x.c.src || x.c.key}`); kesz = true; }
    }
    if (!kesz) hibak.push(`${L}. szint: elakadt`);
    s = H.norm({...s, ...H.levelUpApply(s, rb, lb)});
  }
  // kezdő felszerelés (PHB-csomag az első osztályé és a háttéré), lezárás teli HP-val
  s = H.norm({...s, newChar: {...s.newChar, equip: 'pack', eq: vbFelszereles(s, rb, sorrend)}});
  const se = H.seEredmeny(s, rb);
  s = szamol(H.norm({...s, inventory: se.inventory, currency: se.currency, newChar: null, levelUp: null}));
  s = H.norm({...s, hp: {...s.hp, cur: s.hp.max, temp: 0}});
  const vege = H.calc(s, rb);
  for (const c of vege.choices) {
    if (c.done || c.kind === 'subrace') continue;
    const o = H.choiceOptions(c, vege, rb, s);
    if (o.free || o.opts.some(x => !x.dis && !c.ok.includes(x.v))) hibak.push(`nyitva maradt: ${c.src || c.key}`);
  }
  return {lap: s, figy, hibak};
}

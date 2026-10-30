// Szabálykönyv a játékos appnak (logika, DOM nélkül): az 5e.tools adatainak letöltése, átalakítása (fx hatáslisták), feltöltése, és a tárgykeresés.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('szabalykonyv', N) és az index.html-ben a szabalykonyv.js?v=N és a VART_MODULOK.
'use strict';
modul('szabalykonyv', 2);

// ---------- szabálykönyv a játékos appnak (rules/*) ----------
// Az 5e.tools-tükörből letölti a PHB / XGE / TCE varázslatait és featjeit, a PHB / DMG / XGE / TCE tárgyait (2024-es könyvek nélkül),
// saját, tömör formátumra alakítja (sheet.js), és darabolva a privát Firebase-be menti. A nyilvános tárolóba ebből semmi nem kerül.
const RB_URL = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/';
const RB_SPELL = ['PHB', 'XGE', 'TCE'], RB_ITEM = ['PHB', 'DMG', 'XGE', 'TCE'], RB_FEAT = ['PHB', 'XGE', 'TCE'];
let rulebook = null;  // {version, counts, rb}
const rbFetch = async p => { const r = await fetch(RB_URL + p); if (!r.ok) throw new Error(p + ': HTTP ' + r.status); return r.json(); };
const rbText = e => { try { return entriesToText(e).replace(/\n{3,}/g, '\n\n').trim(); } catch { return ''; } };
const compact = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== 0 && v !== false && v != null && !(Array.isArray(v) && !v.length)));
const SCHOOL = {A: 'abjuration', C: 'conjuration', D: 'divination', E: 'enchantment', V: 'evocation', I: 'illusion', N: 'necromancy', T: 'transmutation'};
const DMG_TYPE = {A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning', N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder'};
const spellTime = t => (t || []).map(x => `${x.number} ${x.unit}${x.number > 1 ? 's' : ''}${x.condition ? ', ' + tagStrip(x.condition) : ''}`).join(' or ');
function spellRange(r) {
  if (!r) return '';
  const d = r.distance || {};
  const dist = {touch: 'Touch', self: 'Self', sight: 'Sight', unlimited: 'Unlimited'}[d.type] || (d.amount != null ? `${d.amount} ${d.amount === 1 ? String(d.type).replace(/s$/, '').replace('feet', 'foot') : d.type}` : '');
  if (r.type === 'point') return dist;
  if (r.type === 'special') return 'Special';
  return `Self (${d.amount}-${d.type === 'feet' ? 'foot' : String(d.type).replace(/s$/, '')} ${r.type})`;
}
const spellComp = c => !c ? '' : [c.v && 'V', c.s && 'S', c.m && 'M' + (c.m === true ? '' : ` (${typeof c.m === 'string' ? c.m : c.m.text || ''})`)].filter(Boolean).join(', ');
const spellDur = d => (d || []).map(x => x.type === 'instant' ? 'Instantaneous' : x.type === 'permanent' ? 'Until dispelled' : x.type === 'special' ? 'Special'
  : x.type === 'timed' ? `${x.concentration ? 'Concentration, up to ' : ''}${x.duration.amount} ${x.duration.type}${x.duration.amount > 1 ? 's' : ''}` : '').filter(Boolean).join(' or ');
function convSpell(sp, lookup) {
  const cl = lookup?.[sp.source.toLowerCase()]?.[sp.name.toLowerCase()]?.class || {};
  const classes = [...new Set(Object.entries(cl).filter(([src]) => RB_SPELL.includes(src)).flatMap(([, o]) => Object.keys(o)))].sort();
  return compact({n: sp.name, s: sp.source, l: sp.level, sc: SCHOOL[sp.school] || '', t: spellTime(sp.time), r: spellRange(sp.range), c: spellComp(sp.components),
    d: spellDur(sp.duration), k: (sp.duration || []).some(x => x.concentration), ri: !!sp.meta?.ritual, cl: classes,
    tx: rbText([...(sp.entries || []), ...(sp.entriesHigherLevel || [])])});
}
function convItem(it, types, props) {
  const code = String(it.type || '').split('|')[0], magic = !!it.rarity && !['none', 'unknown'].includes(it.rarity);
  const v = it.value ? (it.value >= 100 ? it.value / 100 + ' gp' : it.value >= 10 ? it.value / 10 + ' sp' : it.value + ' cp') : '';
  const pack = (it.packContents || []).map(p => typeof p === 'string' ? p.split('|')[0] : (p.quantity > 1 ? p.quantity + '× ' : '') + String(p.item || p.special || '').split('|')[0]).filter(Boolean);
  return compact({n: it.name, s: it.source, ty: it.wondrous ? 'Wondrous item' : types[code] || (it.weapon ? 'Weapon' : it.armor ? 'Armor' : ''),
    rar: magic ? it.rarity : '', att: it.reqAttune === true ? 'requires attunement' : typeof it.reqAttune === 'string' ? 'requires attunement ' + tagStrip(it.reqAttune) : '',
    mag: magic || !!it.wondrous, w: it.weight || 0, v, dmg: it.dmg1 ? `${it.dmg1} ${DMG_TYPE[it.dmgType] || ''}`.trim() : '', d2: it.dmg2 || '',
    pr: (it.property || []).map(p => props[propOf(p)] || propOf(p)).join(', '), rg: it.range || '', ac: it.ac || 0, str: it.strength || '', st: !!it.stealth,
    tx: [rbText(it.entries), pack.length ? 'Tartalom: ' + pack.join(', ') : '', it.items ? 'Változatok: ' + it.items.map(x => String(x).split('|')[0]).join(', ') : ''].filter(Boolean).join('\n')});
}
function featPre(pre) {
  return (pre || []).map(o => Object.entries(o).map(([k, v]) =>
    k === 'ability' ? v.map(a => Object.entries(a).map(([ab, n]) => ab.toUpperCase() + ' ' + n).join(' or ')).join('; ')
      : k === 'race' ? v.map(r => r.name + (r.subrace ? ` (${r.subrace})` : '')).join(' or ')
      : /^spellcasting/.test(k) ? 'spellcasting' : k === 'proficiency' ? v.map(p => Object.entries(p).map(([a, b]) => b + ' ' + a).join(', ')).join(' or ')
      : k === 'level' ? 'level ' + (v.level ?? v) : k === 'other' ? String(v) : k).join(', ')).join(' / ');
}
// a featek képességérték-növelése külön mezőben van, nem a leírásban
const featAbility = ab => (ab || []).map(a => 'Ability Score Increase: ' + (a.choose
  ? `${(a.choose.from || []).map(x => x.toUpperCase()).join(', ')} +${a.choose.amount || 1} (${a.choose.count || 1} választható)`
  : Object.entries(a).filter(([k]) => ABIL.includes(k)).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')) + '.').join('\n');
// ---- 2. fázis: a szabálymotor hatáslistái (fx, lásd sheet.js) az 5e.tools géppel olvasható mezőiből ----
const RB_CLASS = ['PHB', 'TCE'], RB_SUB = ['PHB', 'XGE', 'TCE'];
const refClean = s => tagStrip(String(s).split('|')[0]).replace(/#.*$/, '').trim();
const cap1 = s => String(s).replace(/(^|[\s(-])\S/g, m => m.toUpperCase());
const first = v => Array.isArray(v) ? v[0] : v;
const chooseOf = c => ({from: c.from, n: c.count || 1});
// egy 5e.tools elem (faj, alfaj, háttér, feat, osztály-jártasság) jártasságai, képességnövelései → fx lista
function profFx(o) {
  const fx = [], keysTrue = obj => Object.entries(obj).filter(([k, v]) => v === true && !['any', 'anyStandard', 'choose'].includes(k)).map(([k]) => k);
  const ab = first(o.ability);
  if (ab) {
    const fixed = Object.fromEntries(ABIL.filter(a => typeof ab[a] === 'number').map(a => [a, ab[a]]));
    if (Object.keys(fixed).length) fx.push({ab: fixed});
    if (ab.choose) fx.push({abChoose: {from: ab.choose.from || ABIL, n: ab.choose.count || 1, amt: ab.choose.amount || 1}});
  }
  const sk = first(o.skillProficiencies);
  if (sk) {
    const fixed = keysTrue(sk).map(Sheet.skillKey).filter(k => Sheet.SKILLS[k]);
    if (fixed.length) fx.push({skill: Object.fromEntries(fixed.map(k => [k, 1]))});
    if (sk.any) fx.push({skillChoose: {from: 'any', n: sk.any}});
    if (sk.choose) fx.push({skillChoose: {from: (sk.choose.from || []).map(Sheet.skillKey), n: sk.choose.count || 1}});
  }
  const lg = first(o.languageProficiencies);
  if (lg) {
    const fixed = keysTrue(lg).map(cap1);
    if (fixed.length) fx.push({lang: fixed});
    if (lg.any || lg.anyStandard) fx.push({langChoose: {n: lg.any || lg.anyStandard}});
    if (lg.choose) fx.push({langChoose: {from: (lg.choose.from || []).map(cap1), n: lg.choose.count || 1}});
  }
  const tl = first(o.toolProficiencies);
  if (tl) {
    const fixed = keysTrue(tl).map(refClean);
    if (fixed.length) fx.push({tool: fixed});
    if (tl.any) fx.push({toolChoose: {n: tl.any}});
    if (tl.choose) fx.push({toolChoose: {from: (tl.choose.from || []).map(refClean), n: tl.choose.count || 1}});
  }
  const wp = first(o.weaponProficiencies);
  if (wp) { const fixed = keysTrue(wp).map(refClean); if (fixed.length) fx.push({weapon: fixed}); if (wp.choose) fx.push({todo: 'Fegyver-jártasság választása'}); }
  const ar = first(o.armorProficiencies);
  if (ar) { const fixed = keysTrue(ar).map(refClean); if (fixed.length) fx.push({armor: fixed}); }
  const sv = first(o.savingThrowProficiencies);
  if (sv) { const fixed = keysTrue(sv).filter(a => ABIL.includes(a)); if (fixed.length) fx.push({save: fixed}); if (sv.choose) fx.push({saveChoose: {from: sv.choose.from || ABIL, n: sv.choose.count || 1}}); }
  const ex = first(o.expertise);
  if (ex?.anyProficientSkill) fx.push({expertise: {n: ex.anyProficientSkill}});
  const stl = first(o.skillToolLanguageProficiencies);
  if (stl) fx.push({todo: 'Skill / eszköz / nyelv választása (' + ((first(stl.choose)?.count) || 1) + ')'});
  const ft = first(o.feats);
  if (ft?.any) fx.push({feat: {n: ft.any}});
  if (o.darkvision) fx.push({dv: o.darkvision});
  if (Array.isArray(o.resist)) {
    const fixed = o.resist.filter(r => typeof r === 'string');
    if (fixed.length) fx.push({resist: fixed});
    if (o.resist.some(r => r?.choose)) fx.push({todo: 'Ellenállás választása'});
  }
  if (o.additionalSpells) fx.push(...addSpellsFx(o.additionalSpells));
  return fx;
}
// additionalSpells → {spells: [{t: prepared|known|innate|expanded, lvl, sp: [nevek]}], ab}; a választást kérők teendőként
function addSpellsFx(list) {
  const as = first(list);
  if (!as) return [];
  const out = [], todo = [];
  const walk = (v, t, lvl) => {
    if (typeof v === 'string') { const n = refClean(v); if (n) out.push({t, lvl, sp: n}); }
    else if (Array.isArray(v)) v.forEach(x => walk(x, t, lvl));
    else if (v?.choose) todo.push(`${t} varázslat választása (${lvl}. szinttől)`);
    else if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, t, lvl));
  };
  for (const t of ['prepared', 'known', 'innate', 'expanded']) for (const [lvl, v] of Object.entries(as[t] || {})) walk(v, t, parseInt(lvl) || 1);
  const by = {};
  for (const x of out) { const k = x.t + '|' + x.lvl; (by[k] = by[k] || {t: x.t, lvl: x.lvl, sp: []}).sp.push(x.sp); }
  const fx = [];
  if (out.length) fx.push(compact({spells: Object.values(by), ab: typeof as.ability === 'string' ? as.ability : ''}));
  if (todo.length) fx.push({todo: [...new Set(todo)].join('; ')});
  return fx;
}
const CASTER = {full: 'full', '1/2': 'half', '1/3': 'third', pact: 'pact', artificer: 'artificer'};
// class table cella → szám vagy rövid szöveg (pl. Sneak Attack 2d6, Unarmored Movement +10)
function colVal(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return tagStrip(v);
  if (v?.type === 'dice') return (v.toRoll || []).map(d => `${d.number}d${d.faces}`).join('+');
  if (v?.type === 'bonus' || v?.type === 'bonusSpeed') return v.value;
  return '';
}
// az 5e.tools progression objektuma az adott szinttől érvényes teljes darabszám (Metamagic: {3: 2, 10: 3, 17: 4}), nem a növekmény
const progArr = p => Array.isArray(p) ? p.slice(0, 20) : Array.from({length: 20}, (_, i) => Object.entries(p || {}).filter(([l]) => +l <= i + 1).reduce((t, [, n]) => n, 0));
// 'Név|Osztály|OsztályForrás|Szint|Forrás' és 'Név|Osztály|OsztályForrás|Alosztály|AlosztályForrás|Szint|Forrás'
function convClassFile(file, out) {
  const cls = (file.class || []).find(c => RB_CLASS.includes(c.source) && c.edition !== 'one');
  if (!cls) return;
  const cs = cls.source, featTx = new Map();
  const cf = (file.classFeature || []), scf = (file.subclassFeature || []);
  const pushFeat = (f, sub) => {
    const k = [f.name, f.level, sub?.short || '', f.source].join('|');
    if (featTx.has(k)) return;
    featTx.set(k, true);
    out.features.push(compact({n: f.name, cls: cls.name, sub: sub?.short || '', ss: sub?.s || '', lvl: f.level, s: f.source,
      opt: !!f.isClassFeatureVariant || (!sub && f.source !== cs), tx: rbText(f.entries)}));
    // a fejléc-feature hivatkozásai (pl. Champion → Improved Critical) külön feature-ök
    for (const e of JSON.stringify(f.entries || []).match(/"subclassFeature":"[^"]+"/g) || []) {
      const ref = JSON.parse('{' + e + '}').subclassFeature, x = findSubFeat(ref);
      if (x && sub && RB_SUB.includes(x.source)) pushFeat(x, sub);   // pl. a PHB-s Totem Warrior SCAG-os Elk / Tiger opciói nem kellenek
    }
  };
  const findSubFeat = ref => {
    const [n, c, csrc, short, ssrc, lvl, src] = ref.split('|');
    const subSrc = ssrc || cs;
    return scf.find(f => f.name === n && f.className === c && f.classSource === (csrc || cs) && f.subclassShortName === short && f.subclassSource === subSrc && f.level === +lvl && f.source === (src || subSrc));
  };
  const feats = [];
  let subLvl = 0;
  for (const r of cls.classFeatures || []) {
    const ref = typeof r === 'string' ? r : r.classFeature;
    const [n, c, csrc, lvl, src] = ref.split('|');
    const f = cf.find(x => x.name === n && x.className === c && x.classSource === (csrc || cs) && x.level === +lvl && x.source === (src || csrc || cs));
    if (!f || !RB_SUB.includes(f.source)) continue;
    if (r.gainSubclassFeature && !subLvl) subLvl = f.level;
    feats.push(compact({n: f.name, lvl: f.level, sub: !!r.gainSubclassFeature, opt: !!f.isClassFeatureVariant || f.source !== cs}));
    pushFeat(f, null);
  }
  const sp = cls.startingProficiencies || {}, mc = cls.multiclassing || {};
  const startFx = mcp => [
    ...(mcp.armor?.length ? [{armor: mcp.armor.map(x => tagStrip(String(x)))}] : []),
    ...(mcp.weapons?.length ? [{weapon: mcp.weapons.map(x => tagStrip(String(x)))}] : []),
    ...(mcp.tools?.length ? [{tool: mcp.tools.map(x => tagStrip(String(x)))}] : []),
    ...profFx({skillProficiencies: mcp.skills})
  ];
  out.classes.push(compact({n: cls.name, s: cs, hd: cls.hd?.faces || 8, saves: cls.proficiency || [], fx: startFx(sp),
    mc: compact({req: mc.requirements || null, fx: startFx(mc.proficienciesGained || {})}),
    caster: CASTER[cls.casterProgression] || '', ab: cls.spellcastingAbility || '', cantrips: cls.cantripProgression || [], known: cls.spellsKnownProgression || [],
    prep: String(cls.preparedSpells || '').replace(/<\$level\$>/g, 'lvl').replace(/<\$(\w+)_mod\$>/g, '$1').replace(/\s+/g, ''),
    cols: (cls.classTableGroups || []).filter(g => g.rows).flatMap(g => (g.colLabels || []).map((l, i) => ({l: tagStrip(l), v: g.rows.map(r => colVal(r[i]))}))),
    feats, subLvl, asi: feats.filter(f => f.n === 'Ability Score Improvement').map(f => f.lvl), subTitle: cls.subclassTitle || '',
    opt: (cls.optionalfeatureProgression || []).map(o => ({n: o.name, t: o.featureType || [], p: progArr(o.progression)}))}));
  const seen = new Set();
  for (const sc of file.subclass || []) {
    if (sc.classSource !== cs || !RB_SUB.includes(sc.source) || seen.has(sc.shortName + '|' + sc.source)) continue;
    seen.add(sc.shortName + '|' + sc.source);
    const sub = {short: sc.shortName, s: sc.source}, list = [];
    for (const ref of sc.subclassFeatures || []) {
      const f = findSubFeat(ref);
      if (!f) continue;
      list.push({n: f.name, lvl: f.level});
      pushFeat(f, sub);
    }
    out.subclasses.push(compact({n: sc.name, short: sc.shortName, cls: cls.name, s: sc.source, caster: CASTER[sc.casterProgression] || '', ab: sc.spellcastingAbility || '',
      cantrips: sc.cantripProgression || [], known: sc.spellsKnownProgression || [], fx: sc.additionalSpells ? addSpellsFx(sc.additionalSpells) : [], feats: list,
      opt: (sc.optionalfeatureProgression || []).map(o => ({n: o.name, t: o.featureType || [], p: progArr(o.progression)}))}));
  }
}
const SKIP_TRAIT = /^(age|alignment|size|languages|speed)$/i;
const traitsOf = o => (o.entries || []).filter(e => e?.name && !SKIP_TRAIT.test(e.name)).map(e => ({n: tagStrip(e.name), tx: rbText(e.entries)}));
const speedOf = sp => typeof sp === 'number' ? {walk: sp} : Object.fromEntries(['walk', 'fly', 'swim', 'climb', 'burrow'].filter(k => sp?.[k] != null).map(k => [k, sp[k] === true ? (sp.walk || 30) : typeof sp[k] === 'object' ? sp[k].number : sp[k]]));
const OW_FX = {ability: ['ab', 'abChoose'], skillProficiencies: ['skill', 'skillChoose'], languageProficiencies: ['lang', 'langChoose'], toolProficiencies: ['tool', 'toolChoose'], weaponProficiencies: ['weapon'], armorProficiencies: ['armor'], resist: ['resist']};
function convRaces(file) {
  const races = (file.race || []).filter(r => (r.source === 'PHB' || (r.source === 'TCE' && r.name === 'Custom Lineage')));
  const subs = (file.subrace || []).filter(s => s.source === 'PHB' && s.raceSource === 'PHB' && races.some(r => r.name === s.raceName));
  return {
    races: races.map(r => compact({n: r.name, s: r.source, size: (r.size || []).join('/'), sp: speedOf(r.speed), fx: profFx(r), traits: traitsOf(r),
      subs: subs.filter(s => s.raceName === r.name).length})),
    // név nélküli alfaj = a faj alapváltozata (pl. Human: minden képesség +1; a Variant ezt váltja ki)
    subraces: subs.map(s => compact({n: s.name || s.raceName + ' (alap)', race: s.raceName, s: s.source, sp: s.speed != null ? speedOf(s.speed) : null, fx: profFx(s), traits: traitsOf(s),
      ow: Object.keys(s.overwrite || {}).flatMap(k => OW_FX[k] || [])}))
  };
}
function convBackgrounds(file) {
  const all = file.background || [];
  return all.filter(b => b.source === 'PHB').map(b => {
    if (b._copy) { const src = all.find(x => x.name === b._copy.name && x.source === b._copy.source); b = {...(src || {}), ...b}; }
    const feat = (b.entries || []).find(e => /^Feature:/i.test(e?.name || ''));
    return compact({n: b.name, s: b.source, fx: profFx(b), feature: feat ? {n: tagStrip(feat.name).replace(/^Feature:\s*/i, ''), tx: rbText(feat.entries)} : null,
      tx: rbText((b.entries || []).filter(e => e?.type === 'list'))});
  });
}
function optPre(pre) {
  return (pre || []).map(o => Object.entries(o).map(([k, v]) =>
    k === 'level' ? (typeof v === 'object' ? `${v.class?.name || ''} ${v.level}. szint`.trim() : `${v}. szint`)
      : k === 'pact' ? 'Pact of the ' + v : k === 'patron' ? v + ' patron' : k === 'spell' ? v.map(refClean).join(', ')
      : k === 'item' ? v.map(refClean).join(', ') : k === 'feature' ? v.map(refClean).join(', ') : k).join(', ')).join(' / ');
}
function convOptFeatures(file) {
  return (file.optionalfeature || []).filter(o => RB_SUB.includes(o.source)).map(o => {
    const lv = (o.prerequisite || []).map(p => p.level).find(Boolean);
    return compact({n: o.name, s: o.source, t: o.featureType || [], pre: optPre(o.prerequisite), lv: typeof lv === 'object' ? lv.level : lv || 0,
      pact: (o.prerequisite || []).map(p => p.pact).find(Boolean) || '', fx: profFx(o), tx: rbText(o.entries)});
  });
}
const bonusNum = v => v == null ? 0 : parseInt(String(v).replace('+', '')) || 0;
// tárgyak mechanikája: típuskód (páncélhoz / fegyverhez), mágikus bónuszok, képességérték-minimum (pl. Gauntlets of Ogre Power)
const itemMech = it => ({tc: String(it.type || '').split('|')[0], wc: it.weaponCategory || '', bAc: bonusNum(it.bonusAc), bW: bonusNum(it.bonusWeapon), bS: bonusNum(it.bonusSavingThrow),
  abS: it.ability?.static ? Object.fromEntries(ABIL.filter(a => it.ability.static[a]).map(a => [a, it.ability.static[a]])) : null});

async function buildRulebook(get = rbFetch) {
  const [phb, xge, tce, lookup, items, base, variants, feats, conds, clsIndex, races, bgs, opts] = await Promise.all(['spells/spells-phb.json', 'spells/spells-xge.json', 'spells/spells-tce.json',
    'generated/gendata-spell-source-lookup.json', 'items.json', 'items-base.json', 'magicvariants.json', 'feats.json', 'conditionsdiseases.json',
    'class/index.json', 'races.json', 'backgrounds.json', 'optionalfeatures.json'].map(get));
  // osztályfájlok: csak a 13 (PHB 2014 + TCE Artificer) osztály, a Mystic / Sidekick nélkül
  const clsFiles = await Promise.all(Object.entries(clsIndex || {}).filter(([k]) => Sheet.findClass(k)).map(([, f]) => get('class/' + f)));
  const cls = {classes: [], subclasses: [], features: []};
  for (const f of clsFiles) convClassFile(f, cls);
  const rc = convRaces(races);
  const types = Object.fromEntries((base.itemType || []).filter(t => t.source === 'PHB' || t.source === 'DMG').map(t => [t.abbreviation, t.name]));
  const props = Object.fromEntries((base.itemProperty || []).filter(p => p.source === 'PHB' || p.source === 'DMG').map(p => [p.abbreviation, (p.name || p.entries?.[0]?.name || p.abbreviation).toLowerCase()]));
  const vars = (variants.magicvariant || []).filter(v => RB_ITEM.includes(v.inherits?.source) && v.edition !== 'one');
  // az alaptárgyaknál csak azok a jellemzők kellenek, amikre a variánsok feltételei (requires / excludes) hivatkoznak
  const keys = new Set(vars.flatMap(v => [...(v.requires || []).flatMap(r => Object.keys(r)), ...Object.keys(v.excludes || {})]));
  const all = items.item || [];
  const resolve = it => {
    if (!it._copy) return it;
    const src = all.find(x => x.name === it._copy.name && x.source === it._copy.source) || (base.baseitem || []).find(x => x.name === it._copy.name && x.source === it._copy.source);
    const o = {...(src || {}), ...it}; delete o._copy; delete o._mod; return o;
  };
  const rb = {
    spells: [...(phb.spell || []), ...(xge.spell || []), ...(tce.spell || [])].filter(s => RB_SPELL.includes(s.source)).map(s => convSpell(s, lookup)),
    baseItems: (base.baseitem || []).filter(b => b.source === 'PHB' || b.source === 'DMG').map(b => ({...convItem(b, types, props), ...compact(itemMech(b)),
      m: Object.fromEntries([...keys].filter(k => b[k] != null).map(k => [k, b[k]]).concat([['name', b.name]]))})),
    items: [...all.filter(i => RB_ITEM.includes(i.source)).map(resolve), ...(items.itemGroup || []).filter(i => RB_ITEM.includes(i.source))].map(i => ({...convItem(i, types, props), ...compact(itemMech(i))})),
    variants: vars.map(v => { const h = v.inherits; return compact({n: v.name.replace(/\s*\(\*\)$/, ''), s: h.source, rar: h.rarity && h.rarity !== 'none' ? h.rarity : '', bAc: bonusNum(h.bonusAc), bW: bonusNum(h.bonusWeapon), bS: bonusNum(h.bonusSavingThrow),
      att: h.reqAttune === true ? 'requires attunement' : typeof h.reqAttune === 'string' ? 'requires attunement ' + tagStrip(h.reqAttune) : '',
      pre: h.namePrefix || '', suf: h.nameSuffix || '', req: v.requires || [], exc: v.excludes || null,
      tx: rbText(h.entries).replace(/\{=(\w+)[^}]*\}/g, (m, k) => h[k] ?? '')}); }),
    feats: (feats.feat || []).filter(f => RB_FEAT.includes(f.source)).map(f => compact({n: f.name, s: f.source, pre: featPre(f.prerequisite), fx: profFx(f),
      tx: [featAbility(f.ability), rbText(f.entries)].filter(Boolean).join('\n')})),
    conditions: (conds.condition || []).filter(c => c.source === 'PHB').map(c => ({n: c.name, s: c.source, tx: rbText(c.entries)})),
    ...cls, races: rc.races, subraces: rc.subraces, backgrounds: convBackgrounds(bgs), optfeatures: convOptFeatures(opts)
  };
  return rb;
}
async function uploadRulebook(rb, step = () => {}) {
  const chunks = Sheet.splitChunks(rb), old = await Tar.szabalyok.meta();
  for (const [i, c] of chunks.entries()) { step(`Feltöltés: ${i + 1} / ${chunks.length}`); await Tar.szabalyok.darabIr(c.id, c.data); }
  for (const id of old?.chunks || []) if (!chunks.some(c => c.id === id)) await Tar.szabalyok.darabTorol(id);
  // a meta utoljára: a telefonok csak akkor töltik le az újat, ha minden darab fent van
  const meta = {version: new Date().toISOString(), format: Sheet.RB_FORMAT, chunks: chunks.map(c => c.id), counts: Object.fromEntries(Sheet.RB_KINDS.map(k => [k, rb[k].length]))};
  await Tar.szabalyok.metaIr(meta);
  return meta;
}
// a Tárgyak fülnek: a felhőben lévő példány, ha nincs (vagy nincs belépés), közvetlenül a tükörből
async function getRulebook() {
  if (rulebook) return rulebook;
  let r = null;
  if (Tar.kapcsolva()) try { r = await Tar.szabalyok.betolt(); } catch {}
  return (rulebook = r || {version: '', counts: {}, rb: await buildRulebook()});
}
const rbCounts = c => `${c.spells || 0} varázslat, ${(c.items || 0) + (c.baseItems || 0)} tárgy + ${c.variants || 0} variáns, ${c.feats || 0} feat, ${c.classes || 0} osztály ${c.subclasses || 0} alosztállyal, ${c.races || 0} faj, ${c.backgrounds || 0} háttér`;
// a felhőben lévő szabálykönyv adatai (Menü → Szabálykönyv); felhő nélkül null
async function szabalyMeta() { return Tar.kapcsolva() ? Tar.szabalyok.meta() : null; }
let itemResults = [];
function addItemTo(pcId, it, qty) {
  const c = S.library.find(x => x.id === pcId); if (!c) return null;
  const ref = Sheet.refOf(it), have = c.inventory.find(i => i.ref === ref || i.name === it.n);
  if (have) have.qty += qty;
  else c.inventory.push({name: it.n, qty, equipped: false, attuned: false, magic: !!it.mag, rarity: it.rar || '', container: '', note: '', ref});
  save();
  return c;
}

// 5e.tools import (logika, DOM nélkül): a bestiárium letöltése és a szörnyek átalakítása a DM Screen lényformátumára.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('import-5etools', N) és az index.html-ben az import-5etools.js?v=N és a VART_MODULOK.
'use strict';
modul('import-5etools', 1);

// ---------- 5e.tools ----------
const FIVE_BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/';
let fiveIndex = null, fiveData = {}, fiveResults = [];
async function loadFiveIndex() {
  if (!fiveIndex) fiveIndex = await (await fetch(FIVE_BASE + 'index.json')).json();
  return fiveIndex;
}
async function loadFiveSource(src) {
  if (fiveData[src]) return fiveData[src];
  const idx = await loadFiveIndex();
  if (!idx[src]) throw new Error('Ismeretlen forrás: ' + src);
  const j = await (await fetch(FIVE_BASE + idx[src])).json();
  return (fiveData[src] = j.monster || []);
}
function applyMod(o, mods) {
  const nm = x => typeof x === 'string' ? x : x?.name;
  for (const [key, v] of Object.entries(mods || {})) {
    for (const op of [].concat(v)) {
      try {
        if (key === '*') {
          if (op.mode === 'replaceTxt') {
            const re = new RegExp(op.replace, op.flags || 'g');
            for (const k of ['trait', 'action', 'bonus', 'reaction', 'legendary']) if (o[k]) o[k] = JSON.parse(JSON.stringify(o[k]).replace(re, op.with));
          }
          continue;
        }
        const arr = o[key] ? [...o[key]] : [];
        const items = [].concat(op.items || []);
        if (op.mode === 'appendArr') o[key] = [...arr, ...items];
        else if (op.mode === 'prependArr') o[key] = [...items, ...arr];
        else if (op.mode === 'replaceArr') {
          const target = typeof op.replace === 'object' && op.replace.index != null ? nm(arr[op.replace.index]) : op.replace;
          const i = arr.findIndex(x => nm(x) === target);
          if (i >= 0) arr.splice(i, 1, ...items);
          o[key] = arr;
        } else if (op.mode === 'removeArr') {
          const names = [].concat(op.names || op.items || []).map(nm);
          o[key] = arr.filter(x => !names.includes(nm(x)));
        }
      } catch {}
    }
  }
}
async function resolveCopy(m, depth = 0) {
  if (!m._copy || depth > 4) return m;
  const {name, source} = m._copy;
  const arr = await loadFiveSource(source).catch(() => []);
  let base = arr.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!base) return m;
  base = await resolveCopy(structuredClone(base), depth + 1);
  const out = {...base, ...m};
  delete out._copy;
  if (m._copy._mod) applyMod(out, m._copy._mod);
  return out;
}
const SIZE = {T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan'};
const ALIGN = {L: 'lawful', N: 'neutral', NX: 'neutral', NY: 'neutral', C: 'chaotic', G: 'good', E: 'evil', U: 'unaligned', A: 'any alignment'};
const ABIL_5E = {str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'};
function tagRender(tag, body) {
  const parts = body.split('|');
  switch (tag) {
    case 'atk': return ({mw: 'Melee Weapon Attack:', rw: 'Ranged Weapon Attack:', 'mw,rw': 'Melee or Ranged Weapon Attack:', ms: 'Melee Spell Attack:', rs: 'Ranged Spell Attack:', 'ms,rs': 'Melee or Ranged Spell Attack:'}[body] || 'Attack:');
    case 'atkr': return ({m: 'Melee Attack Roll:', r: 'Ranged Attack Roll:', 'm,r': 'Melee or Ranged Attack Roll:'}[body] || 'Attack Roll:');
    case 'hit': return sgn(+parts[0] || 0);
    case 'h': return 'Hit: ';
    case 'hom': return 'Hit or Miss: ';
    case 'damage': case 'dice': case 'autodice': return parts[0];
    case 'd20': return sgn(+parts[0] || 0);
    case 'dc': return 'DC ' + parts[0];
    case 'recharge': return '(Recharge ' + (parts[0] ? parts[0] + '–6' : '6') + ')';
    case 'actSave': return (ABIL_5E[parts[0]] || parts[0]) + ' Saving Throw:';
    case 'actSaveFail': return 'Failure:';
    case 'actSaveSuccess': return 'Success:';
    case 'actSaveSuccessOrFail': return 'Failure or Success:';
    case 'actTrigger': return 'Trigger:';
    case 'actResponse': return 'Response:';
    case 'chance': return parts[0] + '%';
    case 'filter': return parts[0];
    default: return parts[2] || parts[0];
  }
}
function tagStrip(s) {
  s = String(s ?? '');
  let prev;
  do { prev = s; s = s.replace(/\{@(\w+)\s?([^{}]*)\}/g, (m, t, b) => tagRender(t, b)); } while (s !== prev);
  return s;
}
function entriesToText(e) {
  if (e == null) return '';
  if (typeof e === 'string') return tagStrip(e);
  if (Array.isArray(e)) return e.map(entriesToText).filter(Boolean).join('\n');
  if (e.type === 'list') return (e.items || []).map(i => '• ' + entriesToText(i)).join('\n');
  if (e.type === 'item') return (e.name ? tagStrip(e.name) + ' ' : '') + entriesToText(e.entry ?? e.entries);
  if (e.type === 'table') return (e.rows || []).map(r => r.map(entriesToText).join(' | ')).join('\n');
  if (e.entries) return (e.name ? tagStrip(e.name) + '. ' : '') + entriesToText(e.entries);
  if (e.entry) return entriesToText(e.entry);
  return '';
}
function fiveType(t) {
  if (!t) return '';
  if (typeof t === 'string') return t;
  let s = typeof t.type === 'string' ? t.type : (t.type?.choose || []).join('/');
  if (t.tags?.length) s += ` (${t.tags.map(x => typeof x === 'string' ? x : x.tag).join(', ')})`;
  return s;
}
function fiveAlign(a) {
  if (!a) return '';
  return a.map(x => typeof x === 'string' ? (ALIGN[x] || x) : x.alignment ? fiveAlign(x.alignment) : (x.special || '')).join(' ');
}
function fiveSpeed(sp) {
  if (sp == null) return '';
  if (typeof sp === 'number') return sp + ' ft.';
  const out = [];
  for (const k of ['walk', 'burrow', 'climb', 'fly', 'swim']) {
    let v = sp[k]; if (v == null) continue;
    if (v === true) v = sp.walk;
    const n = typeof v === 'object' ? v.number : v;
    const cond = typeof v === 'object' && v.condition ? ' ' + tagStrip(v.condition) : '';
    out.push((k === 'walk' ? '' : k + ' ') + n + ' ft.' + cond + (k === 'fly' && sp.canHover ? ' (hover)' : ''));
  }
  return out.join(', ');
}
function fiveList(l, key) {
  if (!l) return '';
  return l.map(x => typeof x === 'string' ? x : x.special ? x.special : `${x.preNote || ''} ${fiveList(x[key], key)} ${x.note || ''}`.trim()).map(tagStrip).join(', ');
}
function fiveAc(ac) {
  if (ac == null) return {ac: 10, note: ''};
  const a = [].concat(ac)[0];
  if (typeof a === 'number') return {ac: a, note: ''};
  if (a.special) return {ac: parseInt(a.special) || 10, note: a.special};
  return {ac: a.ac || 10, note: [...(a.from || []).map(tagStrip), a.condition ? tagStrip(a.condition) : ''].filter(Boolean).join(', ')};
}
function crNum(cr) { if (cr == null) return 0; const s = String(cr); if (s.includes('/')) { const [a, b] = s.split('/'); return +a / +b; } return +s || 0; }
const crToPb = cr => { const n = crNum(cr); return n < 5 ? 2 : Math.floor((n - 1) / 4) + 2; };
const ordinal = n => n + (n == 1 ? 'st' : n == 2 ? 'nd' : n == 3 ? 'rd' : 'th');
function fiveSpellText(sc) {
  const lines = [];
  const sp = a => (a || []).map(x => tagStrip(typeof x === 'string' ? x : x.entry || '')).join(', ');
  if (sc.headerEntries) lines.push(entriesToText(sc.headerEntries));
  if (sc.will) lines.push('At will: ' + sp(sc.will));
  for (const [per, lbl] of [['daily', '/day'], ['rest', '/rest'], ['weekly', '/week']])
    if (sc[per]) for (const [k, v] of Object.entries(sc[per])) lines.push(`${k.replace('e', '')}${lbl}${k.endsWith('e') ? ' each' : ''}: ${sp(v)}`);
  if (sc.spells) for (const [lvl, o] of Object.entries(sc.spells))
    lines.push(`${lvl === '0' ? 'Cantrips (at will)' : ordinal(+lvl) + ' level' + (o.slots ? ` (${o.slots} slots)` : '')}: ${sp(o.spells)}`);
  if (sc.footerEntries) lines.push(entriesToText(sc.footerEntries));
  return lines.join('\n');
}
function convert5e(m) {
  const abilities = {}; ABIL.forEach(a => abilities[a] = m[a] ?? 10);
  const cr = typeof m.cr === 'object' ? m.cr?.cr : m.cr;
  const pb = crToPb(cr);
  const saves = {}; for (const [k, v] of Object.entries(m.save || {})) if (ABIL.includes(k)) saves[k] = parseInt(v) || 0;
  const skills = Object.entries(m.skill || {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => cap(k) + ' ' + v).join(', ');
  const acx = fiveAc(m.ac);
  let initBonus = null;
  if (typeof m.initiative === 'number') initBonus = m.initiative;
  else if (m.initiative?.initiative != null) initBonus = m.initiative.initiative;
  else if (m.initiative?.proficiency) initBonus = mod(abilities.dex) + pb * m.initiative.proficiency;
  const ent = arr => (arr || []).map(e => ({name: tagStrip(e.name || ''), text: entriesToText(e.entries ?? e.entry ?? [])}));
  const c = {
    name: m.name, kind: 'monster', source: '5e.tools · ' + (m.source || ''),
    size: (m.size || []).map(s => SIZE[s] || s).join('/'), type: fiveType(m.type), alignment: fiveAlign(m.alignment),
    ac: acx.ac, acNote: acx.note,
    hp: {max: m.hp?.average ?? (parseInt(m.hp?.special) || 1), formula: m.hp?.formula || m.hp?.special || ''},
    speed: fiveSpeed(m.speed), abilities, saves, skills,
    senses: [...(m.senses || []).map(tagStrip), m.passive != null ? `passive Perception ${m.passive}` : ''].filter(Boolean).join(', '),
    languages: (m.languages || []).map(tagStrip).join(', '), cr: cr ?? '', initBonus,
    resist: fiveList(m.resist, 'resist'), immune: fiveList(m.immune, 'immune'), vuln: fiveList(m.vulnerable, 'vulnerable'),
    condImmune: fiveList(m.conditionImmune, 'conditionImmune'),
    traits: ent(m.trait), actions: ent(m.action), bonusActions: ent(m.bonus), reactions: ent(m.reaction), legendary: ent(m.legendary),
    legendaryCount: m.legendary ? (m.legendaryActions || 3) : 0,
    portrait: m.hasToken ? `https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary/tokens/${encodeURIComponent(m.token?.source || m.source)}/${encodeURIComponent(m.token?.name || m.name)}.webp` : ''
  };
  for (const sc of m.spellcasting || []) {
    const e = {name: tagStrip(sc.name || 'Spellcasting'), text: fiveSpellText(sc)};
    const target = {action: 'actions', bonus: 'bonusActions', reaction: 'reactions', legendary: 'legendary'}[sc.displayAs] || 'traits';
    c[target].push(e);
  }
  return normCreature(c);
}

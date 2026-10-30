// D&D Beyond import (logika, DOM nélkül): a karakter-JSON átalakítása a DM Screen lényformátumára és telefonos lapra.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('import-ddb', N) és az index.html-ben az import-ddb.js?v=N és a VART_MODULOK.
'use strict';
modul('import-ddb', 1);

// D&D Beyond import: fegyver- és páncéljártasság (nem eszköz)
const WEAPON_ARMOR_PROF = /^(simple|martial)-weapons$|-armor$|^shields$|^(club|dagger|greatclub|handaxe|javelin|light-hammer|mace|quarterstaff|sickle|spear|crossbow-light|crossbow-heavy|crossbow-hand|dart|shortbow|sling|battleaxe|flail|glaive|greataxe|greatsword|halberd|lance|longsword|maul|morningstar|pike|rapier|scimitar|shortsword|trident|war-pick|warhammer|whip|blowgun|longbow|net|firearms)$/;
// külön, nem megjelenített dokumentumban bontjuk ki: a beillesztett HTML képei nem töltődnek be, és a szkriptjei nem futnak
function stripHtml(h) { return new DOMParser().parseFromString(String(h || ''), 'text/html').documentElement.textContent.replace(/\s+\n/g, '\n').trim(); }
const DDB_SUB = {str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma'};
function ddbKepessegek(d, mods, sum) {
  const abilities = {};
  ABIL.forEach((a, i) => {
    const id = i + 1;
    const over = d.overrideStats?.find(s => s.id === id)?.value;
    let v = (d.stats.find(s => s.id === id)?.value || 10) + (d.bonusStats?.find(s => s.id === id)?.value || 0) + sum('bonus', DDB_SUB[a] + '-score');
    const sets = mods.filter(m => m.type === 'set' && m.subType === DDB_SUB[a] + '-score').map(m => m.value || 0);
    if (sets.length) v = Math.max(v, ...sets);
    abilities[a] = over || v;
  });
  return abilities;
}
// a közös alap (k), amiből a részek számolnak: a nyers adat, a módosítók, a képességek, a szint és a jártassági bónusz
function ddbAlap(raw) {
  const d = raw.data || raw;
  if (!Array.isArray(d.stats)) throw new Error('Ez nem D&D Beyond karakter JSON');
  const mods = Object.values(d.modifiers || {}).flat().filter(Boolean);
  const sum = (type, sub) => mods.filter(m => m.type === type && m.subType === sub).reduce((s, m) => s + (m.value || 0), 0);
  const abilities = ddbKepessegek(d, mods, sum);
  const M = a => mod(abilities[a]);
  const classes = d.classes || [];
  const level = classes.reduce((s, c) => s + (c.level || 0), 0) || 1;
  const pb = Math.floor((level - 1) / 4) + 2;
  return {d, mods, sum, abilities, M, classes, level, pb};
}
function ddbHp({d, sum, M, level}) {
  const max = d.overrideHitPoints || ((d.baseHitPoints || 0) + (d.bonusHitPoints || 0) + (M('con') + sum('bonus', 'hit-points-per-level')) * level);
  return {max, cur: Math.max(0, max - (d.removedHitPoints || 0)), formula: ''};
}
const ddbFelszerelt = d => (d.inventory || []).filter(i => i.equipped && i.definition);
function ddbAc({d, mods, sum, abilities, M}) {
  const inv = ddbFelszerelt(d);
  const armor = inv.find(i => [1, 2, 3].includes(i.definition.armorTypeId));
  const shield = inv.find(i => i.definition.armorTypeId === 4);
  const dex = M('dex');
  let ac;
  if (armor) {
    const t = armor.definition.armorTypeId;
    ac = (armor.definition.armorClass || 10) + (t === 1 ? dex : t === 2 ? Math.min(dex, 2) : 0) + sum('bonus', 'armored-armor-class');
  } else {
    ac = 10 + dex;
    mods.filter(m => m.subType === 'unarmored-armor-class' && m.type === 'set').forEach(m => {
      if (m.statId) ac += mod(abilities[ABIL[m.statId - 1]]);
      else if (m.value) ac = Math.max(ac, m.value + dex);
    });
    ac += sum('bonus', 'unarmored-armor-class');
  }
  if (shield) ac += shield.definition.armorClass || 2;
  return ac + sum('bonus', 'armor-class');
}
function convertDDB(raw) {
  const alap = ddbAlap(raw), {d, mods, sum, abilities, M, classes, level, pb} = alap;
  const inv = ddbFelszerelt(d), dex = M('dex');
  const prof = sub => mods.some(m => m.type === 'proficiency' && m.subType === sub);
  const expert = sub => mods.some(m => m.type === 'expertise' && m.subType === sub);
  const saves = {}; ABIL.forEach(a => { if (prof(DDB_SUB[a] + '-saving-throws')) saves[a] = M(a) + pb; });
  // skillek: jártasság / expertise / fél jártasság (Jack of All Trades) + tárgyakból, képességekből jövő bónuszok
  const halfProf = mods.some(m => m.type === 'half-proficiency' && m.subType === 'ability-checks') ? Math.floor(pb / 2) : 0;
  const skillMods = {};
  for (const [k, a] of Object.entries(SKILLS)) {
    const p = expert(k) ? 2 : prof(k) ? 1 : halfProf ? 0.5 : 0;
    const profBonus = p === 2 ? 2 * pb : p === 1 ? pb : p === 0.5 ? halfProf : 0;
    skillMods[k] = {b: M(a) + profBonus + sum('bonus', k) + sum('bonus', 'ability-checks'), p};
  }
  const skillBonus = k => skillMods[k].b;
  const skills = Object.keys(SKILLS).filter(k => skillMods[k].p >= 1).map(k => skillLabel(k) + ' ' + sgn(skillBonus(k))).join(', ');
  const passiveBonus = {perception: sum('bonus', 'passive-perception'), investigation: sum('bonus', 'passive-investigation'), insight: sum('bonus', 'passive-insight')};
  const passive = 10 + skillBonus('perception') + passiveBonus.perception;
  // eszköz- és hangszer-jártasságok (a fegyver- és páncéljártasságok nélkül)
  const tools = [...new Set(mods.filter(m => m.type === 'proficiency' && !(m.subType in SKILLS) && !/saving-throws$/.test(m.subType) && !WEAPON_ARMOR_PROF.test(m.subType)).map(m => m.friendlySubtypeName || m.subType))].join(', ');
  // felszerelés: tárolók szerint, a D&D Beyondon adott egyedi nevekkel és jegyzetekkel
  const custom = (type, id) => (d.characterValues || []).find(v => v.typeId === type && String(v.valueId) === String(id))?.value;
  const allItems = (d.inventory || []).filter(i => i.definition);
  const containerName = id => { if (id == null || String(id) === String(d.id)) return ''; const it = allItems.find(i => i.id != null && String(i.id) === String(id)); return it ? (custom(8, it.id) || it.definition.name) : ''; };
  const inventory = allItems.filter(i => (i.quantity ?? 1) > 0).map(i => ({
    name: custom(8, i.id) ? `${custom(8, i.id)} (${i.definition.name})` : i.definition.name,
    qty: i.quantity ?? 1, equipped: !!i.equipped, attuned: !!i.isAttuned, magic: !!i.definition.magic,
    rarity: i.definition.rarity || '', container: containerName(i.containerEntityId),
    note: str(custom(9, i.id))
  }));
  const currency = {}; for (const k of ['pp', 'gp', 'ep', 'sp', 'cp']) currency[k] = num(d.currencies?.[k], 0);
  const dv = Math.max(0, ...mods.filter(m => m.subType === 'darkvision').map(m => m.value || 0));
  const langs = [...new Set(mods.filter(m => m.type === 'language').map(m => m.friendlySubtypeName))].join(', ');
  // támadások
  const actions = [], bonusActions = [], reactions = [], traits = [];
  inv.filter(i => i.definition.damage || i.definition.filterType === 'Weapon').forEach(w => {
    const def = w.definition;
    const props = (def.properties || []).map(p => p.name);
    const ranged = def.attackType === 2;
    const ab = ranged ? 'dex' : props.includes('Finesse') && M('dex') > M('str') ? 'dex' : 'str';
    const magic = (def.grantedModifiers || []).filter(m => m.type === 'bonus' && m.subType === 'magic').reduce((s, m) => s + (m.value || 0), 0);
    const hit = M(ab) + pb + magic, dm = M(ab) + magic;
    const dice = def.damage?.diceString || '1';
    const reach = ranged ? `range ${def.range || '?'}/${def.longRange || '?'} ft.` : `reach ${props.includes('Reach') ? 10 : 5} ft.`;
    let text = `${ranged ? 'Ranged' : 'Melee'} Weapon Attack: ${sgn(hit)} to hit, ${reach} Hit: ${dice}${dm ? sgn(dm) : ''} ${(def.damageType || '').toLowerCase()} damage.`;
    const vers = def.properties?.find(p => p.name === 'Versatile')?.notes;
    if (vers) text += ` Versatile: ${vers}${dm ? sgn(dm) : ''}.`;
    actions.push({name: w.definition.name, text});
  });
  Object.values(d.actions || {}).flat().filter(Boolean).forEach(a => {
    const e = {name: a.name, text: stripHtml(a.snippet || a.description).slice(0, 500)};
    const t = a.activation?.activationType;
    (t === 1 ? actions : t === 3 ? bonusActions : t === 4 ? reactions : traits).push(e);
  });
  // varázslatok
  const byLvl = {};
  const addSpell = s => { const def = s.definition; if (!def) return; (byLvl[def.level] = byLvl[def.level] || new Set()).add(def.name); };
  (d.classSpells || []).forEach(cs => (cs.spells || []).filter(s => s.prepared || s.alwaysPrepared || s.definition?.level === 0 || s.countsAsKnownSpell).forEach(addSpell));
  Object.values(d.spells || {}).flat().filter(Boolean).forEach(addSpell);
  const lvls = Object.keys(byLvl).sort((a, b) => a - b);
  if (lvls.length) {
    const casters = classes.filter(c => c.definition?.spellCastingAbilityId).map(c => {
      const a = ABIL[c.definition.spellCastingAbilityId - 1];
      return `${c.definition.name}: spell save DC ${8 + pb + M(a)}, ${sgn(pb + M(a))} to hit`;
    });
    traits.push({name: 'Varázslatok', text: [...casters, ...lvls.map(l => `${l == 0 ? 'Cantrips' : ordinal(+l) + ' level'}: ${[...byLvl[l]].join(', ')}`)].join('\n')});
  }
  const clsStr = classes.map(c => `${c.definition?.name || ''} ${c.level}${c.subclassDefinition ? ' (' + c.subclassDefinition.name + ')' : ''}`).join(' / ');
  return normCreature({
    name: d.name, kind: 'pc', source: 'D&D Beyond', ddbId: d.id,
    type: [d.race?.fullName, clsStr].filter(Boolean).join(' — '), cr: 'Szint ' + level,
    ac: ddbAc(alap), hp: ddbHp(alap),
    speed: (d.race?.weightSpeeds?.normal?.walk || 30) + ' ft.',
    abilities, saves, skills,
    senses: [dv ? `darkvision ${dv} ft.` : '', `passive Perception ${passive}`].filter(Boolean).join(', '),
    languages: langs,
    initBonus: dex + sum('bonus', 'initiative') + (mods.some(m => m.type === 'half-proficiency' && m.subType === 'initiative') ? Math.floor(pb / 2) : 0),
    portrait: d.decorations?.avatarUrl || d.avatarUrl || '',
    traits, actions, bonusActions, reactions,
    skillMods, passiveBonus, tools, inventory, currency, importedAt: new Date().toISOString().slice(0, 10)
  });
}

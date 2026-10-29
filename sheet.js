// Közös kód a DM Screennek (index.html) és a telefonos karakterlapnak (karakter.html):
// a karakterlap formátuma (Firestore: sheets/{könyvtár-id}), tisztítása, a számolt értékek, pihenők,
// spell slot táblák (PHB 2014), és a szabálykönyv (rules/*) betöltése, tárgyvariánsok kibontása.
// Minden a window.Sheet alatt van, hogy ne ütközzön a két app saját konstansaival.
'use strict';
window.Sheet = (() => {
  const FORMAT = 'dmscreen-karakter';
  // a sheet.js változata: az oldalak ezzel ellenőrzik, hogy nem a böngésző régi, gyorsítótárazott példányát kapták (lásd SHEET_V)
  const VERSION = 5;
  const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const ABIL_FULL = {str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'};
  const SKILLS = {acrobatics: 'dex', 'animal-handling': 'wis', arcana: 'int', athletics: 'str', deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int', 'sleight-of-hand': 'dex', stealth: 'dex', survival: 'wis'};
  const skillLabel = k => k.split('-').map(w => w === 'of' ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];
  const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];
  const RESETS = ['short', 'long', 'none'];
  const DICE = [6, 8, 10, 12];
  // PHB 2014 osztályok (+ TCE Artificer): hit die, varázsló-típus, varázsképesség, mentő-jártasság, alosztály szintje, extra ASI-szintek
  // (a szabálymotor tartaléka, ha a szabálykönyvben még nincs osztályadat)
  const ASI_LEVELS = [4, 8, 12, 16, 19];
  const CLASSES = {
    Artificer: {hd: 8, caster: 'artificer', ab: 'int', saves: ['con', 'int'], subLvl: 3}, Barbarian: {hd: 12, saves: ['str', 'con'], subLvl: 3},
    Bard: {hd: 8, caster: 'full', ab: 'cha', saves: ['dex', 'cha'], subLvl: 3}, Cleric: {hd: 8, caster: 'full', ab: 'wis', saves: ['wis', 'cha'], subLvl: 1},
    Druid: {hd: 8, caster: 'full', ab: 'wis', saves: ['int', 'wis'], subLvl: 2}, Fighter: {hd: 10, saves: ['str', 'con'], subLvl: 3, asi: [6, 14]},
    Monk: {hd: 8, saves: ['str', 'dex'], subLvl: 3}, Paladin: {hd: 10, caster: 'half', ab: 'cha', saves: ['wis', 'cha'], subLvl: 3},
    Ranger: {hd: 10, caster: 'half', ab: 'wis', saves: ['str', 'dex'], subLvl: 3}, Rogue: {hd: 8, saves: ['dex', 'int'], subLvl: 3, asi: [10]},
    Sorcerer: {hd: 6, caster: 'full', ab: 'cha', saves: ['con', 'cha'], subLvl: 1}, Warlock: {hd: 8, caster: 'pact', ab: 'cha', saves: ['wis', 'cha'], subLvl: 1},
    Wizard: {hd: 6, caster: 'full', ab: 'int', saves: ['int', 'wis'], subLvl: 2}
  };
  const THIRD_CASTERS = /^(eldritch knight|arcane trickster)$/i;

  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const num = (v, def = 0) => { if (v === null || v === '' || typeof v === 'boolean') return def; const n = Number(v); return Number.isFinite(n) ? n : def; };
  const int = (v, def, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(num(v, def))));
  const str = (v, max = 5000) => v == null || typeof v === 'object' ? '' : String(v).slice(0, max);
  const arr = (v, max) => (Array.isArray(v) ? v : []).slice(0, max);
  const safeUrl = v => typeof v === 'string' && /^(https?:\/\/|data:image\/)/i.test(v.trim()) ? v.trim() : '';
  const EMAIL_RE = /^[^\s@<>"'`]{1,100}@[^\s@<>"'`]{1,100}\.[^\s@<>"'`]{2,30}$/;
  const mod = s => Math.floor((num(s, 10) - 10) / 2);
  const sgn = n => (n >= 0 ? '+' : '') + n;
  const findClass = name => Object.keys(CLASSES).find(k => k.toLowerCase() === String(name || '').trim().toLowerCase());

  // ---------- tisztítás: minden bejövő lap (felhő, import, telefon) ezen megy át ----------
  function normInventory(list) {
    return arr(list, 1000).filter(isObj).map(i => ({
      name: str(i.name, 200).trim(), qty: int(i.qty, 1, 0, 99999), equipped: !!i.equipped, attuned: !!i.attuned,
      magic: !!i.magic, rarity: str(i.rarity, 40), container: str(i.container, 200), note: str(i.note, 2000), ref: str(i.ref, 200)
    })).filter(i => i.name);
  }
  const named = (list, max, f) => arr(list, max).filter(isObj).map(f).filter(x => x.name);
  // szabálymotor: a felépítés (választások) és a kézi felülírások tisztítása
  const CH_KEY = /^[\p{L}\p{N}_ ':|.,+()\/-]{1,160}$/u;
  function chVal(v) {
    if (typeof v === 'string') return str(v, 200);
    if (typeof v === 'number') return num(v);
    if (typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.slice(0, 30).filter(x => typeof x === 'string' || typeof x === 'number').map(x => typeof x === 'string' ? str(x, 200) : num(x));
    if (isObj(v)) return Object.fromEntries(Object.entries(v).filter(([k, x]) => /^[\w-]{1,40}$/.test(k) && (typeof x === 'string' || typeof x === 'number')).slice(0, 10)
      .map(([k, x]) => [k, typeof x === 'string' ? str(x, 200) : num(x)]));
    return null;
  }
  function normBuild(b) {
    const base = isObj(b.base) ? b.base : {}, sub = isObj(b.sub) ? b.sub : {}, ch = isObj(b.ch) ? b.ch : {}, org = isObj(b.origin) ? b.origin : {};
    const levels = arr(b.levels, 20).filter(isObj).map(l => ({c: findClass(l.c) || str(l.c, 60).trim(), hp: l.hp == null || l.hp === '' ? null : int(l.hp, 1, 1, 12)})).filter(l => l.c);
    const origin = Object.fromEntries(ABIL.filter(a => num(org[a]) > 0).map(a => [a, int(org[a], 0, 0, 2)]));
    return {
      v: 1, race: str(b.race, 200), subrace: str(b.subrace, 200), background: str(b.background, 200),
      base: Object.fromEntries(ABIL.map(a => [a, int(base[a], 10, 1, 30)])), levels,
      sub: Object.fromEntries(Object.entries(sub).filter(([k, v]) => levels.some(l => l.c === k) && typeof v === 'string' && v.trim()).map(([k, v]) => [k, str(v, 200)])),
      ch: Object.fromEntries(Object.entries(ch).filter(([k]) => CH_KEY.test(k)).slice(0, 300).map(([k, v]) => [k, chVal(v)]).filter(([, v]) => v !== null)),
      origin: Object.keys(origin).length ? origin : null
    };
  }
  // felülírható kulcsok: ab:str, save:dex (0/1), skill:stealth (0 / 0.5 / 1 / 2), hpMax, init, ac, speed
  function normOv(o) {
    const out = {};
    for (const [k, v] of Object.entries(isObj(o) ? o : {})) {
      const [t, x] = k.split(':');
      if (v === null || v === '') continue;
      if (t === 'ab' && ABIL.includes(x)) out[k] = int(v, 10, 1, 30);
      else if (t === 'save' && ABIL.includes(x)) out[k] = num(v) ? 1 : 0;
      else if (t === 'skill' && SKILLS[x]) out[k] = [0, 0.5, 1, 2].includes(num(v, -1)) ? num(v) : 0;
      else if (k === 'hpMax') out[k] = int(v, 1, 1, 9999);
      else if (k === 'init') out[k] = int(v, 0, -20, 30);
      else if (k === 'ac') out[k] = int(v, 10, 0, 50);
      else if (k === 'speed') { const s = str(v, 100).trim(); if (s) out[k] = s; }
    }
    return out;
  }
  // a szabálymotor által számolt tételek (jellemző, erőforrás, támadás, mindig felkészített spell) jelölése; a sajátok nem kapják meg
  const AUTO = x => x.auto ? {auto: true} : {};
  // a számolt értékek gyorsítótára (a régi számoló függvények és a DM Screen ezt olvassa a szabálymotoros lapnál)
  function normCache(c) {
    const nums = (o, keys) => Object.fromEntries(keys.filter(k => isObj(o) && o[k] != null && o[k] !== '').map(k => [k, int(o[k], 0, -50, 99)]));
    const sp = isObj(c.spell) ? nums(c.spell, ['dc', 'atk']) : null;
    return {saves: nums(c.saves, ABIL), skills: nums(c.skills, Object.keys(SKILLS)), passive: nums(c.passive, ['perception', 'investigation', 'insight']),
      spell: sp && 'dc' in sp && 'atk' in sp ? sp : null};
  }
  function norm(d) {
    d = isObj(d) ? d : {};
    const hp = isObj(d.hp) ? d.hp : {};
    const max = int(hp.max, 1, 1, 9999);
    const sc = isObj(d.spellcasting) ? d.spellcasting : {};
    const slots = arr(sc.slots, 9), used = arr(sc.used, 9);
    const pact = isObj(sc.pact) ? sc.pact : {};
    const pactMax = int(pact.max, 0, 0, 9);
    const owner = str(d.owner, 200).trim().toLowerCase();
    const hdu = isObj(d.hitDiceUsed) ? d.hitDiceUsed : {};
    const ds = isObj(d.deathSaves) ? d.deathSaves : {};
    const pr = isObj(d.profs) ? d.profs : {};
    const cur = isObj(d.currency) ? d.currency : {};
    const sk = isObj(d.skillProf) ? d.skillProf : {};
    const ab = isObj(d.abilities) ? d.abilities : {};
    const s = {
      format: FORMAT, owner: EMAIL_RE.test(owner) ? owner : '',
      name: str(d.name, 100).trim() || 'Névtelen', portrait: safeUrl(d.portrait),
      race: str(d.race, 100), background: str(d.background, 100), alignment: str(d.alignment, 60),
      classes: named(d.classes, 12, c => {
        const name = findClass(c.name) || str(c.name, 60).trim();
        return {name, subclass: str(c.subclass, 80), level: int(c.level, 1, 1, 20), hitDie: DICE.includes(num(c.hitDie)) ? num(c.hitDie) : CLASSES[name]?.hd || 8};
      }),
      abilities: Object.fromEntries(ABIL.map(a => [a, int(ab[a], 10, 1, 30)])),
      saveProf: ABIL.filter(a => arr(d.saveProf, 6).includes(a)),
      skillProf: Object.fromEntries(Object.keys(SKILLS).filter(k => [1, 2].includes(sk[k])).map(k => [k, sk[k]])),
      jack: !!d.jack,
      ac: int(d.ac, 10, 0, 50), acNote: str(d.acNote, 200), speed: str(d.speed, 100) || '30 ft.',
      initBonus: d.initBonus == null || d.initBonus === '' ? null : int(d.initBonus, 0, -20, 30),
      hp: {max, cur: int(hp.cur, max, 0, max), temp: int(hp.temp, 0, 0, 9999)},
      hitDiceUsed: Object.fromEntries(DICE.filter(n => num(hdu[n]) > 0).map(n => [n, int(hdu[n], 0, 0, 40)])),
      deathSaves: {ok: int(ds.ok, 0, 0, 3), fail: int(ds.fail, 0, 0, 3)},
      spellcasting: {
        ability: ABIL.includes(sc.ability) ? sc.ability : '',
        slots: Array.from({length: 9}, (_, i) => int(slots[i], 0, 0, 9)),
        used: Array.from({length: 9}, (_, i) => int(used[i], 0, 0, int(slots[i], 0, 0, 9))),
        pact: {level: int(pact.level, 0, 0, 5), max: pactMax, used: int(pact.used, 0, 0, pactMax)}
      },
      spells: named(d.spells, 400, x => ({name: str(x.name, 120).trim(), level: int(x.level, 0, 0, 9), prepared: !!x.prepared, always: !!x.always, note: str(x.note, 500), ref: str(x.ref, 200), ...AUTO(x)})),
      resources: named(d.resources, 50, x => { const m = int(x.max, 1, 0, 99); return {name: str(x.name, 100).trim(), max: m, used: int(x.used, 0, 0, m), reset: RESETS.includes(x.reset) ? x.reset : 'long', ...AUTO(x)}; }),
      attacks: named(d.attacks, 50, x => ({name: str(x.name, 100).trim(), hit: str(x.hit, 20), dmg: str(x.dmg, 120), note: str(x.note, 500), ...AUTO(x)})),
      features: named(d.features, 200, x => ({name: str(x.name, 120).trim(), text: str(x.text, 8000), src: str(x.src, 80), ...AUTO(x)})),
      inventory: normInventory(d.inventory),
      currency: Object.fromEntries(COINS.map(k => [k, int(cur[k], 0, 0, 1e9)])),
      conditions: [...new Set(arr(d.conditions, 30).map(c => str(c, 60).trim()).filter(Boolean))],
      exhaustion: int(d.exhaustion, 0, 0, 6),
      // koncentráció: a spell neve (üres = nincs); effOff: azok az állapotok, amelyek automatikus hatását a DM kikapcsolta
      concentration: str(d.concentration, 120).trim(),
      effOff: [...new Set(arr(d.effOff, 40).map(c => str(c, 60).trim()).filter(Boolean))],
      profs: {armor: str(pr.armor, 500), weapons: str(pr.weapons, 500), tools: str(pr.tools, 500), languages: str(pr.languages, 500)},
      senses: str(d.senses, 300), resist: str(d.resist, 300), notes: str(d.notes, 20000),
      updatedAt: typeof d.updatedAt === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(d.updatedAt) ? d.updatedAt : '',
      updatedBy: str(d.updatedBy, 200)
    };
    if (!s.classes.length) s.classes = [{name: '', subclass: '', level: 1, hitDie: 8}];
    // szabálymotor (2. fázis): a régi, kézi lapon nincs build, és az auto is ki van kapcsolva
    s.build = isObj(d.build) ? normBuild(d.build) : null;
    s.auto = !!d.auto && !!s.build;
    s.ov = normOv(d.ov);
    s.todoDone = [...new Set(arr(d.todoDone, 300).map(x => str(x, 200)).filter(Boolean))];
    s.cache = s.auto && isObj(d.cache) ? normCache(d.cache) : null;
    return s;
  }

  // ---------- számolt értékek (1. fázis: a lapon tárolt választásokból; a szabálymotor a 2. fázisban jön) ----------
  const level = s => Math.max(1, Math.min(20, s.classes.reduce((t, c) => t + c.level, 0)));
  const pb = s => Math.floor((level(s) - 1) / 4) + 2;
  // a szabálymotoros lapnál a számolt értékek a cache-ben vannak (pl. Aura of Protection, Remarkable Athlete), azokat használjuk
  const cached = (s, k, x) => s.auto && s.cache?.[k]?.[x] != null ? s.cache[k][x] : null;
  const saveBonus = (s, a) => cached(s, 'saves', a) ?? mod(s.abilities[a]) + (s.saveProf.includes(a) ? pb(s) : 0);
  const skillProfOf = (s, k) => s.skillProf[k] || (s.jack ? 0.5 : 0);
  const skillBonus = (s, k) => { const c = cached(s, 'skills', k); if (c != null) return c; const p = skillProfOf(s, k); return mod(s.abilities[SKILLS[k]]) + (p === 0.5 ? Math.floor(pb(s) / 2) : p * pb(s)); };
  const passive = (s, k) => cached(s, 'passive', k) ?? 10 + skillBonus(s, k);
  const initiative = s => s.initBonus ?? mod(s.abilities.dex) + (s.jack ? Math.floor(pb(s) / 2) : 0);
  const spellAbility = s => s.spellcasting.ability || CLASSES[findClass(s.classes.find(c => CLASSES[findClass(c.name)]?.ab)?.name)]?.ab || '';
  const spellDc = s => { if (s.auto && s.cache?.spell) return s.cache.spell.dc; const a = spellAbility(s); return a ? 8 + pb(s) + mod(s.abilities[a]) : null; };
  const spellAtk = s => { if (s.auto && s.cache?.spell) return s.cache.spell.atk; const a = spellAbility(s); return a ? pb(s) + mod(s.abilities[a]) : null; };
  const classLabel = s => s.classes.filter(c => c.name).map(c => `${c.name} ${c.level}${c.subclass ? ' (' + c.subclass + ')' : ''}`).join(' / ');
  function hitDice(s) {
    const out = {};
    for (const c of s.classes) out[c.hitDie] = (out[c.hitDie] || 0) + c.level;
    return Object.entries(out).map(([die, max]) => ({die: +die, max, used: Math.min(max, s.hitDiceUsed[die] || 0)})).sort((a, b) => b.die - a.die);
  }
  const attuned = s => s.inventory.filter(i => i.attuned).length;
  const hpStatus = (cur, max) => cur <= 0 ? 'down' : cur <= max / 2 ? 'bloodied' : cur < max ? 'hurt' : 'healthy';

  // PHB 2014 spell slot tábla (full caster / multiclass caster level szerint) és Warlock Pact Magic
  const SLOTS = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
  const PACT = l => l < 1 ? null : {max: l === 1 ? 1 : l <= 10 ? 2 : l <= 16 ? 3 : 4, level: Math.min(5, Math.ceil(l / 2))};
  // caster level: egy osztálynál a saját táblája (half: 2. szinttől felfelé kerekítve, third: 3. szinttől), multiclassnál a PHB szerint lefelé (Artificer felfelé)
  function slotsFor(classes) {
    const casters = classes.map(c => {
      const cl = CLASSES[findClass(c.name)] || {};
      const type = THIRD_CASTERS.test(String(c.subclass || '').trim()) ? 'third' : cl.caster;
      return {type, level: c.level};
    }).filter(c => c.type && c.type !== 'pact');
    const single = casters.length === 1;
    const cl = casters.reduce((t, c) => t + (c.type === 'full' ? c.level : c.type === 'artificer' ? Math.ceil(c.level / 2)
      : c.type === 'half' ? (single ? (c.level < 2 ? 0 : Math.ceil(c.level / 2)) : Math.floor(c.level / 2))
      : (single ? (c.level < 3 ? 0 : Math.ceil(c.level / 3)) : Math.floor(c.level / 3))), 0);
    const row = SLOTS[Math.min(20, cl)] || [];
    const wl = classes.filter(c => findClass(c.name) === 'Warlock').reduce((t, c) => t + c.level, 0);
    return {slots: Array.from({length: 9}, (_, i) => row[i] || 0), pact: PACT(wl) || {level: 0, max: 0}};
  }

  // ---------- szabálymotor (2. fázis): a lap felépítéséből (build) és a kézi felülírásokból (ov) számol ----------
  // A szabálykönyv elemei (faj, alfaj, háttér, feat, optional feature) hatáslistát (fx) hordoznak, az osztály-feature-ökét a FEATURE_FX adja.
  // Egy hatás egy objektum, pl.
  //   {ab: {dex: 2}}  {abChoose: {from, n, amt}}  {abSet: {str: 19}}  {save: ['dex']}  {saveChoose: {from, n}}  {saveAll: true}  {saveBonus: {ab: 'cha', min: 1}}
  //   {skill: {stealth: 1}}  {skillChoose: {from: [...] | 'any', n}}  {expertise: {n}}  {jack: true}  {remarkable: true}  {passive: {perception: 5}}
  //   {armor: [...]} {weapon: [...]} {tool: [...]} {lang: [...]}  {toolChoose / langChoose: {from?, n}}  {dv: 60}  {resist: [...]}
  //   {hpPerLevel: 1}  {hpPerClassLevel: 1}  {init: 5}  {speed: {v: 10 | 'col:Oszlop', if: 'noHeavy' | 'noArmor'}}  {heavyOk: true}
  //   {acBase: {base: 10, add: ['dex', 'con'], noShield}}  {acBonus: 1} (páncélban)  {mamCap: 3}  {rangedAtk: 2}  {duelDmg: 2}  {martialArts: true}
  //   {res: {n, max: szám | 'col:Oszlop' | 'mod:cha' | 'lvl' | 'lvl*5' | 'pb' | {lv: {szint: érték}}, add, min, reset, shortAt}}
  //   {spells: [{t: prepared|known|innate|expanded, lvl, sp: [...]}], ab}  {feat: {n}}  {todo: 'szöveg'} (✋ nem automatizálható)
  // A választást kérő hatások kulcsa: '<forrás>:<fajta>' (pl. 'race:ability', 'Rogue:1:skills', 'Rogue:6:expertise', 'Fighter:4:asi',
  // 'feat:Alert|PHB:skills', 'Fighter:opt:Fighting Style'); az érték a build.ch-ban van. Ha egy kulcs már foglalt, számot kap (…:skills2).
  const refName = r => String(r || '').split('|')[0];
  const skillKey = k => String(k || '').trim().toLowerCase().replace(/\s+/g, '-');
  function rbFind(list, ref) {
    if (!ref || !Array.isArray(list)) return null;
    const [n, s] = String(ref).split('|');
    return list.find(x => x.n === n && (!s || x.s === s)) || list.find(x => String(x.n).toLowerCase() === n.toLowerCase()) || null;
  }
  function classInfo(name, rb) {
    const b = CLASSES[name] || {}, r = (rb?.classes || []).find(c => c.n === name) || null;
    return {r, hd: DICE.includes(r?.hd) ? r.hd : b.hd || 8, saves: r?.saves || b.saves || [], subLvl: r?.subLvl || b.subLvl || 3,
      asi: [...new Set([...(r?.asi || ASI_LEVELS), ...(r?.asi ? [] : b.asi || [])])].sort((x, y) => x - y),
      caster: r ? r.caster || '' : b.caster || '', ab: r ? r.ab || '' : b.ab || ''};
  }
  function subclassOf(b, cls, rb) {
    const ref = b.sub[cls];
    if (!ref) return null;
    const [n, s] = String(ref).split('|');
    return (rb?.subclasses || []).find(x => x.cls === cls && (x.short === n || x.n === n) && (!s || x.s === s)) || null;
  }
  // osztályösszesítő a szintek sorrendjéből (a meglévő kód a classes mezőt használja)
  function buildClasses(b, rb) {
    const out = [];
    for (const l of b.levels) {
      let c = out.find(x => x.name === l.c);
      if (!c) out.push(c = {name: l.c, subclass: refName(b.sub[l.c]), level: 0, hitDie: classInfo(l.c, rb).hd});
      c.level++;
    }
    return out;
  }
  const CHOICE_KIND = {abChoose: 'ability', skillChoose: 'skills', expertise: 'expertise', feat: 'feat', saveChoose: 'saves', langChoose: 'lang', toolChoose: 'tool'};
  const FX_LABEL = {ability: 'képességérték-növelés', skills: 'skill-jártasság', expertise: 'expertise', feat: 'feat', asi: 'ASI vagy feat', subclass: 'alosztály',
    saves: 'mentő-jártasság', lang: 'nyelv', tool: 'eszköz-jártasság', subrace: 'alfaj', opt: 'választás'};

  // Kézi hatástábla: csak mechanika, szabályszöveg nélkül (a szöveg a privát szabálykönyvből jön).
  // Kulcs: 'Osztály|Feature', 'Osztály|Alosztály|Feature', 'race|Faj vagy jellemző', 'feat|Név', 'opt|Név'. Az online teszt ellenőrzi, hogy minden kulcs létezik.
  const FEATURE_FX = {
    'Barbarian|Rage': [{res: {n: 'Rage', max: 'col:Rages', reset: 'long'}}],
    'Barbarian|Unarmored Defense': [{acBase: {add: ['dex', 'con']}}],
    'Barbarian|Fast Movement': [{speed: {v: 10, if: 'noHeavy'}}],
    'Barbarian|Totem Warrior|Totem Spirit': [{todo: 'Totem Spirit: válassz totemállatot'}],
    'Barbarian|Totem Warrior|Aspect of the Beast': [{todo: 'Aspect of the Beast: válassz totemállatot'}],
    'Barbarian|Totem Warrior|Totemic Attunement': [{todo: 'Totemic Attunement: válassz totemállatot'}],
    'Bard|Bardic Inspiration': [{res: {n: 'Bardic Inspiration', max: 'mod:cha', min: 1, reset: 'long', shortAt: 5}}],
    'Bard|Jack of All Trades': [{jack: true}],
    'Bard|Expertise': [{expertise: {n: 2}}],
    'Bard|Magical Secrets': [{todo: 'Magical Secrets: válassz 2 varázslatot bármely osztály listájáról'}],
    'Bard|Lore|Bonus Proficiencies': [{skillChoose: {from: 'any', n: 3}}],
    'Bard|Lore|Additional Magical Secrets': [{todo: 'Additional Magical Secrets: válassz 2 varázslatot bármely osztály listájáról'}],
    'Cleric|Channel Divinity': [{res: {n: 'Channel Divinity', max: {lv: {2: 1, 6: 2, 18: 3}}, reset: 'short'}}],
    'Cleric|Life|Bonus Proficiency': [{armor: ['heavy']}],
    'Cleric|Knowledge|Blessings of Knowledge': [{langChoose: {n: 2}}, {skillChoose: {from: ['arcana', 'history', 'nature', 'religion'], n: 2}}, {expertise: {n: 2}}],
    'Cleric|Tempest|Bonus Proficiencies': [{armor: ['heavy']}, {weapon: ['martial']}],
    'Cleric|War|Bonus Proficiencies': [{armor: ['heavy']}, {weapon: ['martial']}],
    'Cleric|War|War Priest': [{res: {n: 'War Priest', max: 'mod:wis', min: 1, reset: 'long'}}],
    'Cleric|Nature|Acolyte of Nature': [{skillChoose: {from: ['animal-handling', 'nature', 'survival'], n: 1}}, {todo: 'Acolyte of Nature: válassz egy druida cantripet'}],
    'Cleric|Nature|Bonus Proficiency': [{armor: ['heavy']}],
    'Cleric|Forge|Bonus Proficiency': [{armor: ['heavy']}, {tool: ["smith's tools"]}],
    'Cleric|Twilight|Bonus Proficiencies': [{armor: ['heavy']}, {weapon: ['martial']}],
    'Druid|Wild Shape': [{res: {n: 'Wild Shape', max: 2, reset: 'short'}}],
    'Druid|Land|Natural Recovery': [{res: {n: 'Natural Recovery', max: 1, reset: 'long'}}],
    'Druid|Land|Circle Spells': [{todo: 'Circle Spells: válassz tereptípust'}],
    'Druid|Land|Bonus Cantrip': [{todo: 'Bonus Cantrip: válassz egy druida cantripet'}],
    'Fighter|Second Wind': [{res: {n: 'Second Wind', max: 1, reset: 'short'}}],
    'Fighter|Action Surge': [{res: {n: 'Action Surge', max: {lv: {2: 1, 17: 2}}, reset: 'short'}}],
    'Fighter|Indomitable': [{res: {n: 'Indomitable', max: {lv: {9: 1, 13: 2, 17: 3}}, reset: 'long'}}],
    'Fighter|Champion|Remarkable Athlete': [{remarkable: true}],
    'Fighter|Battle Master|Combat Superiority': [{res: {n: 'Superiority Dice', max: {lv: {3: 4, 7: 5, 15: 6}}, reset: 'short'}}],
    'Fighter|Battle Master|Student of War': [{toolChoose: {n: 1}}],
    'Monk|Unarmored Defense': [{acBase: {add: ['dex', 'wis'], noShield: true}}],
    'Monk|Martial Arts': [{martialArts: true}],
    'Monk|Ki': [{res: {n: 'Ki', max: 'col:Ki Points', reset: 'short'}}],
    'Monk|Unarmored Movement': [{speed: {v: 'col:Unarmored Movement', if: 'noArmor'}}],
    'Monk|Diamond Soul': [{saveAll: true}],
    'Paladin|Divine Sense': [{res: {n: 'Divine Sense', max: 'mod:cha', add: 1, min: 1, reset: 'long'}}],
    'Paladin|Lay on Hands': [{res: {n: 'Lay on Hands', max: 'lvl*5', reset: 'long'}}],
    'Paladin|Aura of Protection': [{saveBonus: {ab: 'cha', min: 1}}],
    'Ranger|Favored Enemy': [{todo: 'Favored Enemy: válassz ellenféltípust (és nyelvet)'}],
    'Ranger|Natural Explorer': [{todo: 'Natural Explorer: válassz kedvelt terepet'}],
    'Rogue|Expertise': [{expertise: {n: 2}}],
    'Rogue|Slippery Mind': [{save: ['wis']}],
    'Rogue|Assassin|Bonus Proficiencies': [{tool: ['disguise kit', "poisoner's kit"]}],
    'Sorcerer|Font of Magic': [{res: {n: 'Sorcery Points', max: 'col:Sorcery Points', reset: 'long'}}],
    'Sorcerer|Draconic|Draconic Resilience': [{hpPerClassLevel: 1}, {acBase: {base: 13, add: ['dex']}}],
    'Sorcerer|Draconic|Dragon Ancestor': [{lang: ['Draconic']}, {todo: 'Dragon Ancestor: válassz sárkánytípust'}],
    ...Object.fromEntries([6, 7, 8, 9].map(n => [`Warlock|Mystic Arcanum (${n}th level)`, [{todo: `Mystic Arcanum: válassz egy ${n}. szintű warlock varázslatot`}]])),
    'Wizard|Arcane Recovery': [{res: {n: 'Arcane Recovery', max: 1, reset: 'long'}}],
    'Artificer|Flash of Genius': [{res: {n: 'Flash of Genius', max: 'mod:int', min: 1, reset: 'long'}}],
    'race|Dwarf': [{heavyOk: true}],
    'race|Dwarven Toughness': [{hpPerLevel: 1}],
    'race|Relentless Endurance': [{res: {n: 'Relentless Endurance', max: 1, reset: 'long'}}],
    'race|Breath Weapon': [{res: {n: 'Breath Weapon', max: 1, reset: 'short'}}],
    'race|Draconic Ancestry': [{todo: 'Draconic Ancestry: válassz sárkánytípust'}],
    'feat|Alert': [{init: 5}],
    'feat|Tough': [{hpPerLevel: 2}],
    'feat|Mobile': [{speed: {v: 10}}],
    'feat|Observant': [{passive: {perception: 5, investigation: 5}}],
    'feat|Lucky': [{res: {n: 'Lucky', max: 3, reset: 'long'}}],
    'feat|Medium Armor Master': [{mamCap: 3}],
    'opt|Defense': [{acBonus: 1}],
    'opt|Archery': [{rangedAtk: 2}],
    'opt|Dueling': [{duelDmg: 2}]
  };

  // class table oszlop értéke az adott osztályszinten (pl. Ki Points, Martial Arts 1d6, Unarmored Movement +10)
  function colOf(cols, label, lvl) {
    const c = (cols || []).find(x => String(x.l).toLowerCase() === String(label).toLowerCase());
    return c ? c.v?.[lvl - 1] : undefined;
  }
  // erőforrás-maximum / érték: szám, 'col:Oszlop', 'mod:cha', 'lvl', 'lvl*5', 'pb', {lv: {szint: érték}}
  function evalMax(x, ctx) {
    if (typeof x === 'number') return x;
    if (isObj(x) && isObj(x.lv)) return Object.entries(x.lv).filter(([l]) => +l <= ctx.lvl).reduce((t, [, v]) => num(v), 0);
    const t = String(x || '');
    if (t.startsWith('col:')) { const v = colOf(ctx.cols, t.slice(4), ctx.lvl); return typeof v === 'number' ? v : /unlimited/i.test(v) ? 99 : num(parseInt(v)); }
    if (t.startsWith('mod:')) return ctx.mods[t.slice(4)] || 0;
    if (t === 'lvl') return ctx.lvl;
    if (t === 'pb') return ctx.pb;
    const m = t.match(/^lvl\*(\d+)$/);
    return m ? ctx.lvl * +m[1] : 0;
  }
  // felkészíthető varázslatok száma (pl. 'lvl+wis', 'lvl/2+cha'), legalább 1
  function prepCount(expr, lvl, mods) {
    if (!expr) return 0;
    let t = 0;
    for (const term of String(expr).split('+')) {
      const m = term.match(/^lvl(?:\/(\d+))?$/);
      t += m ? (m[1] ? Math.floor(lvl / +m[1]) : lvl) : ABIL.includes(term) ? mods[term] : num(term);
    }
    return Math.max(1, t);
  }
  const ARMOR_TC = ['LA', 'MA', 'HA'];
  const uniqCI = list => { const seen = new Set(); return list.map(x => String(x).trim()).filter(x => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())); };

  function calc(s, rb = null) {
    const b = s.build || normBuild({}), ov = s.ov || {};
    const full = !!rb?.classes?.length;
    const classes = buildClasses(b, rb);
    const L = Math.max(1, Math.min(20, b.levels.length)), PB = Math.floor((L - 1) / 4) + 2;
    const fxs = [], choices = [], missing = [], features = [];
    const keyOf = base => { let k = base, i = 2; while (choices.some(c => c.key === k)) k = base + i++; return k; };
    // egy forrás hatásai; a választást kérők kulcsot kapnak, és bekerülnek a választási helyek közé
    function addFx(list, src, prefix, ctx = {}, depth = 0) {
      for (const fx of Array.isArray(list) ? list : []) {
        if (!isObj(fx)) continue;
        const rec = {fx, src, ctx, ch: {}};
        for (const [t, kind] of Object.entries(CHOICE_KIND)) {
          if (!fx[t]) continue;
          const o = isObj(fx[t]) ? fx[t] : {}, key = keyOf(`${prefix}:${kind}`);
          const c = {key, kind, src, n: Math.max(1, num(o.n, 1)), amt: num(o.amt, 1), from: o.from, value: b.ch[key]};
          choices.push(c); rec.ch[kind] = c;
          if (t === 'feat' && depth < 2) for (const ref of arr(b.ch[key], c.n)) featFx(ref, depth);
        }
        fxs.push(rec);
      }
    }
    function featFx(ref, depth) {
      const f = rbFind(rb?.feats, ref);
      if (!f) { if (ref) missing.push('Feat: ' + refName(ref)); return; }
      features.push({name: f.n, text: f.tx || '', src: 'Feat'});
      addFx([...(f.fx || []), ...(FEATURE_FX['feat|' + f.n] || [])], 'Feat: ' + f.n, 'feat:' + ref, {}, depth + 1);
    }
    const traitFx = (traits, src, prefix) => (traits || []).forEach(t => {
      features.push({name: t.n, text: t.tx || '', src});
      if (FEATURE_FX['race|' + t.n]) addFx(FEATURE_FX['race|' + t.n], `${t.n} (${src})`, prefix);
    });

    // faj, alfaj, háttér
    const race = rbFind(rb?.races, b.race);
    const subrace = rbFind((rb?.subraces || []).filter(x => !race || x.race === race.n), b.subrace);
    const bg = rbFind(rb?.backgrounds, b.background);
    if (b.race && rb && !race) missing.push('Faj: ' + refName(b.race));
    if (b.subrace && rb && !subrace) missing.push('Alfaj: ' + refName(b.subrace));
    if (b.background && rb && !bg) missing.push('Háttér: ' + refName(b.background));
    // TCE Customizing Your Origin: a faji képességbónusz helyett a megadott áthelyezés; az alfaj felülírhatja a faj egyes hatásait (ow)
    const drop = new Set([...(b.origin ? ['ab', 'abChoose'] : []), ...(subrace?.ow || [])]);
    const keep = list => (list || []).filter(fx => !(isObj(fx) && Object.keys(fx).some(k => drop.has(k))));
    if (race) {
      if (race.subs) choices.push({key: 'race:subrace', kind: 'subrace', src: 'Faj: ' + race.n, n: 1, value: subrace ? b.subrace : ''});
      addFx([...keep(race.fx), ...(FEATURE_FX['race|' + race.n] || [])], 'Faj: ' + race.n, 'race');
      traitFx(race.traits, 'Faj: ' + race.n, 'race');
    }
    if (subrace) { addFx(b.origin ? keep(subrace.fx) : subrace.fx, 'Alfaj: ' + subrace.n, 'subrace'); traitFx(subrace.traits, 'Alfaj: ' + subrace.n, 'subrace'); }
    if (b.origin) fxs.push({fx: {ab: b.origin}, src: 'Faj (áthelyezett bónusz, TCE)', ctx: {}, ch: {}});
    if (bg) {
      addFx(bg.fx, 'Háttér: ' + bg.n, 'bg');
      if (bg.feature) features.push({name: bg.feature.n, text: bg.feature.tx || '', src: 'Háttér: ' + bg.n});
    }

    // osztályok: az első osztály mentői és jártasságai, a többié a multiclass-jártasság; alosztály, ASI, feature-ök, optional feature-választások
    const optChoices = [];
    classes.forEach((c, idx) => {
      const ci = classInfo(c.name, rb), rc = ci.r, sub = subclassOf(b, c.name, rb), ctx = {cls: c.name, lvl: c.level};
      if (idx === 0) {
        fxs.push({fx: {save: ci.saves}, src: c.name + ' (első osztály)', ctx, ch: {}});
        addFx(rc?.fx, c.name + ' 1', c.name + ':1', ctx);
      } else addFx(rc?.mc?.fx, c.name + ' (multiclass)', c.name + ':mc', ctx);
      if (c.level >= ci.subLvl) choices.push({key: c.name + ':sub', kind: 'subclass', src: `${c.name} ${ci.subLvl}`, n: 1, value: b.sub[c.name] || ''});
      if (b.sub[c.name] && rb?.subclasses?.length && !sub) missing.push('Alosztály: ' + refName(b.sub[c.name]));
      for (const lv of ci.asi.filter(x => x <= c.level)) {
        const key = `${c.name}:${lv}:asi`, v = b.ch[key], src = `ASI (${c.name} ${lv})`;
        choices.push({key, kind: 'asi', src, n: 1, value: v});
        if (isObj(v) && typeof v.feat === 'string' && v.feat) featFx(v.feat, 0);
        else if (isObj(v)) { const inc = asiInc(v); if (inc) fxs.push({fx: {ab: inc}, src, ctx, ch: {}}); }
      }
      const featText = (n, lvl, sb) => (rb?.features || []).find(x => x.cls === c.name && x.n === n && x.lvl === lvl && (sb ? x.sub === sb.short && x.ss === sb.s : !x.sub))?.tx || '';
      for (const f of rc?.feats || []) {
        // az ASI-t a választás kezeli, az alosztály-helyőrzőt (pl. „Martial Archetype feature”) az alosztály feature-jei váltják ki
        if (f.lvl > c.level || f.opt || f.n === 'Ability Score Improvement' || (f.sub && f.lvl > ci.subLvl)) continue;
        features.push({name: f.n, text: featText(f.n, f.lvl), src: `${c.name} ${f.lvl}`});
        addFx(FEATURE_FX[`${c.name}|${f.n}`], `${f.n} (${c.name} ${f.lvl})`, `${c.name}:${f.lvl}`, ctx);
      }
      if (sub) {
        addFx(sub.fx, sub.n, `${c.name}:${sub.short}`, ctx);
        for (const f of (rb.features || []).filter(x => x.cls === c.name && x.sub === sub.short && x.ss === sub.s && x.lvl <= c.level)) {
          features.push({name: f.n, text: f.tx || '', src: `${sub.short} ${f.lvl}`});
          addFx(FEATURE_FX[`${c.name}|${sub.short}|${f.n}`], `${f.n} (${sub.short} ${f.lvl})`, `${c.name}:${f.lvl}`, ctx);
        }
      }
      for (const [o, pre] of [...(rc?.opt || []).map(o => [o, c.name]), ...(sub?.opt || []).map(o => [o, c.name + ':' + sub.short])]) {
        const n = num(o.p?.[c.level - 1]);
        if (!n) continue;
        const key = `${pre}:opt:${o.n}`, ch = {key, kind: 'opt', src: `${o.n} (${c.name})`, n, from: o.t || [], ctx, value: b.ch[key]};
        choices.push(ch); optChoices.push(ch);
      }
    });

    // választások ellenőrzése: csak az érvényes értékek számítanak; a választott optional feature-ök hatásai is itt kerülnek be
    const listFrom = c => Array.isArray(c.from) ? c.from : ABIL;
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      let ok = [];
      if (c.kind === 'ability' || c.kind === 'saves') ok = arr(c.value, 6).filter(a => listFrom(c).includes(a));
      else if (c.kind === 'skills') ok = arr(c.value, 18).map(skillKey).filter(k => SKILLS[k] && (c.from === 'any' || !Array.isArray(c.from) || c.from.map(skillKey).includes(k)));
      else if (c.kind === 'feat') ok = arr(c.value, 4).filter(x => typeof x === 'string' && x);
      else if (c.kind === 'asi') ok = isObj(c.value) && ((typeof c.value.feat === 'string' && c.value.feat) || asiInc(c.value)) ? [c.value] : [];
      else if (c.kind === 'subclass' || c.kind === 'subrace') ok = c.value ? [c.value] : [];
      else if (c.kind === 'expertise') ok = arr(c.value, 18).map(skillKey);   // a jártasság-feltételt lent nézzük
      else if (c.kind === 'lang' || c.kind === 'tool') {
        const from = Array.isArray(c.from) ? c.from.map(x => String(x).toLowerCase()) : null;
        ok = arr(c.value, 10).filter(x => typeof x === 'string' && x.trim() && (!from || from.includes(x.trim().toLowerCase())));
      } else if (c.kind === 'opt') {
        ok = arr(c.value, 30).filter(ref => { const o = rbFind(rb?.optfeatures, ref); return o && (o.t || []).some(t => c.from.includes(t)) && (!o.lv || o.lv <= c.ctx.lvl); });
      }
      c.ok = [...new Set(ok.map(x => isObj(x) ? JSON.stringify(x) : x))].slice(0, c.n).map(x => typeof x === 'string' && x[0] === '{' ? JSON.parse(x) : x);
      if (c.kind === 'opt') for (const ref of c.ok) {
        const o = rbFind(rb.optfeatures, ref);
        features.push({name: o.n, text: o.tx || '', src: c.src});
        addFx([...(o.fx || []), ...(FEATURE_FX['opt|' + o.n] || [])], o.n, 'opt:' + o.n, c.ctx);
      }
    }

    // hatások összegyűjtése
    const abil = {};
    for (const a of ABIL) abil[a] = {base: b.base[a], parts: [{v: b.base[a], src: 'alapérték'}], set: null};
    const A = {saves: {}, skills: {}, expert: [], jack: null, remarkable: null, saveAll: null, saveBonus: [], hp: [], init: [], passive: {}, armor: [], weapon: [], tool: [], lang: [],
      dv: 0, resist: [], acBase: [], acBonus: [], speed: [], heavyOk: false, mamCap: 2, rangedAtk: 0, duelDmg: 0, martialArts: null, res: [], spells: [], todo: []};
    for (const {fx, src, ctx, ch} of fxs) {
      if (isObj(fx.ab)) for (const a of ABIL) if (num(fx.ab[a])) abil[a].parts.push({v: num(fx.ab[a]), src});
      if (ch.ability) for (const a of ch.ability.ok) abil[a].parts.push({v: ch.ability.amt, src});
      if (isObj(fx.abSet)) for (const a of ABIL) if (num(fx.abSet[a]) > (abil[a].set?.v || 0)) abil[a].set = {v: num(fx.abSet[a]), src};
      for (const a of [...arr(fx.save, 6), ...(ch.saves?.ok || [])]) if (ABIL.includes(a) && !A.saves[a]) A.saves[a] = src;
      if (isObj(fx.skill)) for (const k of Object.keys(fx.skill).map(skillKey)) if (SKILLS[k] && !A.skills[k]) A.skills[k] = {p: 1, src};
      if (ch.skills) for (const k of ch.skills.ok) if (!A.skills[k]) A.skills[k] = {p: 1, src};
      if (ch.expertise) A.expert.push(ch.expertise);
      if (fx.jack && !A.jack) A.jack = src;
      if (fx.remarkable && !A.remarkable) A.remarkable = src;
      if (fx.saveAll && !A.saveAll) A.saveAll = src;
      if (isObj(fx.saveBonus) && ABIL.includes(fx.saveBonus.ab)) A.saveBonus.push({...fx.saveBonus, src});
      if (num(fx.hpPerLevel)) A.hp.push({v: num(fx.hpPerLevel), src});
      if (num(fx.hpPerClassLevel) && ctx.cls) A.hp.push({v: num(fx.hpPerClassLevel), src, cls: ctx.cls});
      if (num(fx.init)) A.init.push({v: num(fx.init), src});
      if (isObj(fx.passive)) for (const [k, v] of Object.entries(fx.passive)) A.passive[k] = (A.passive[k] || 0) + num(v);
      for (const k of ['armor', 'weapon', 'tool', 'lang']) A[k].push(...arr(fx[k], 30).map(x => str(x, 80)));
      if (ch.tool) A.tool.push(...ch.tool.ok); if (ch.lang) A.lang.push(...ch.lang.ok);
      if (num(fx.dv) > A.dv) A.dv = num(fx.dv);
      A.resist.push(...arr(fx.resist, 20).map(x => str(x, 40)));
      if (isObj(fx.acBase)) A.acBase.push({...fx.acBase, src});
      if (num(fx.acBonus)) A.acBonus.push({v: num(fx.acBonus), src});
      if (isObj(fx.speed)) A.speed.push({...fx.speed, src, ctx});
      if (fx.heavyOk) A.heavyOk = true;
      if (num(fx.mamCap) > A.mamCap) A.mamCap = num(fx.mamCap);
      A.rangedAtk += num(fx.rangedAtk); A.duelDmg = Math.max(A.duelDmg, num(fx.duelDmg));
      if (fx.martialArts) A.martialArts = ctx;
      if (isObj(fx.res) && fx.res.n) A.res.push({...fx.res, src, ctx});
      if (Array.isArray(fx.spells)) A.spells.push(...fx.spells.filter(isObj).map(x => ({...x, ctx})));
      if (fx.todo) A.todo.push({key: '✋ ' + src, text: `${src}: ${str(fx.todo, 300)}`});
    }
    // expertise csak jártas skillre (mindegyik után, hogy a sorrend ne számítson)
    for (const c of A.expert) {
      c.ok = c.ok.filter(k => A.skills[k]);
      for (const k of c.ok) A.skills[k] = {p: 2, src: A.skills[k].src + ' + expertise (' + c.src + ')'};
    }
    for (const c of choices) c.done = c.ok.length >= c.n || ((c.kind === 'ability' || c.kind === 'saves') && c.ok.length >= listFrom(c).length);
    // felszerelés: felszerelt tárgyak a szabálykönyvből (a saját, ismeretlen tárgyak nem számítanak); hangolást kérőnél csak hangolva
    const items = full ? allItems(rb) : [];
    const worn = s.inventory.filter(i => i.equipped).map(i => ({i, r: items.length ? byRef(items, i.ref, i.name) : null})).filter(x => x.r);
    const active = worn.filter(x => !x.r.att || x.i.attuned);
    for (const {i, r} of active) {
      if (isObj(r.abS)) for (const a of ABIL) if (num(r.abS[a]) > (abil[a].set?.v || 0)) abil[a].set = {v: num(r.abS[a]), src: i.name};
      if (num(r.bS)) A.saveBonus.push({flat: num(r.bS), src: i.name});
    }

    const val = (key, v, parts) => (key in ov && ov[key] !== v ? {v: ov[key], calc: v, ov: true, parts} : {v, calc: v, ov: false, parts});
    const sum = parts => parts.reduce((t, p) => t + p.v, 0);
    const abilities = {}, mods = {};
    for (const a of ABIL) {
      const x = abil[a], tot = sum(x.parts);
      let v = x.base > 20 ? tot : Math.min(20, tot);
      const parts = [...x.parts];
      if (v < tot) parts.push({v: v - tot, src: 'legfeljebb 20'});
      if (x.set && x.set.v > v) { parts.push({v: x.set.v - v, src: x.set.src + ` (legalább ${x.set.v})`}); v = x.set.v; }
      abilities[a] = val('ab:' + a, v, parts);
      mods[a] = mod(abilities[a].v);
    }
    const jack = !!A.jack, half = Math.floor(PB / 2), halfUp = Math.ceil(PB / 2);
    const saves = {};
    for (const a of ABIL) {
      const pc = A.saves[a] || A.saveAll ? 1 : 0, p = 'save:' + a in ov ? ov['save:' + a] : pc;
      const parts = [{v: mods[a], src: a.toUpperCase() + '-módosító'}, ...(p ? [{v: PB, src: 'jártasság' + (pc ? ' – ' + (A.saves[a] || A.saveAll) : ' (kézi)')}] : []),
        ...A.saveBonus.map(x => ({v: x.ab ? Math.max(num(x.min, -99), mods[x.ab]) : x.flat, src: x.src}))];
      saves[a] = {prof: p, ov: p !== pc, v: sum(parts), parts};
    }
    const skills = {};
    for (const k of Object.keys(SKILLS)) {
      const a = SKILLS[k], ra = A.remarkable && ['str', 'dex', 'con'].includes(a);
      const pc = A.skills[k]?.p || (jack ? 0.5 : ra ? 0.5 : 0), p = 'skill:' + k in ov ? ov['skill:' + k] : pc;
      const pv = p === 0.5 ? (ra && !('skill:' + k in ov) ? Math.max(halfUp, jack ? half : 0) : half) : p * PB;
      const label = p === 2 ? 'expertise' : p === 1 ? 'jártasság' : ra && pv === halfUp ? 'Remarkable Athlete' : 'Jack of All Trades';
      skills[k] = {prof: p, ov: p !== pc, v: mods[a] + pv,
        parts: [{v: mods[a], src: a.toUpperCase() + '-módosító'}, ...(p ? [{v: pv, src: label + (A.skills[k] && p === pc ? ' – ' + A.skills[k].src : '')}] : [])]};
    }
    const passive = Object.fromEntries(['perception', 'investigation', 'insight'].map(k => [k, 10 + skills[k].v + (A.passive[k] || 0)]));
    // HP: az első szinten a hit die maximuma, utána a tárolt dobás vagy az átlag; + CON-módosító és szintenkénti bónuszok szintenként
    const hpParts = [];
    b.levels.forEach((l, i) => {
      const hd = classInfo(l.c, rb).hd;
      hpParts.push(i === 0 ? {v: hd, src: `${l.c} 1. szint (d${hd} maximum)`} : {v: l.hp ?? hd / 2 + 1, src: `${i + 1}. szint: ${l.c} ` + (l.hp == null ? `(d${hd} átlag)` : '(dobott / kézi)')});
    });
    if (b.levels.length) hpParts.push({v: mods.con * b.levels.length, src: `CON-módosító × ${b.levels.length}`});
    for (const x of A.hp) { const n = x.cls ? classes.find(c => c.name === x.cls)?.level || 0 : b.levels.length; hpParts.push({v: x.v * n, src: `${x.src} (${x.v} × ${n})`}); }
    const hpMax = val('hpMax', Math.max(1, sum(hpParts)), hpParts);
    const initParts = [{v: mods.dex, src: 'DEX-módosító'}, ...(A.remarkable && !jack ? [{v: halfUp, src: 'Remarkable Athlete'}] : jack ? [{v: Math.max(half, A.remarkable ? halfUp : 0), src: 'Jack of All Trades'}] : []), ...A.init];
    const init = val('init', sum(initParts), initParts);
    const sl = slotsFor(classes);

    const armor = worn.find(x => ARMOR_TC.includes(x.r.tc)), shield = worn.find(x => x.r.tc === 'S');
    // AC: a páncél vagy a páncél nélküli képletek közül a legjobb, + pajzs, + mágikus bónuszok, + Defense
    const cands = [];
    if (armor) {
      const r = armor.r, d = r.tc === 'LA' ? mods.dex : r.tc === 'MA' ? Math.min(mods.dex, A.mamCap) : 0;
      cands.push({shield: true, parts: [{v: num(r.ac), src: armor.i.name}, ...(r.tc !== 'HA' ? [{v: d, src: 'DEX-módosító' + (r.tc === 'MA' ? ` (legfeljebb +${A.mamCap})` : '')}] : [])]});
    } else {
      cands.push({shield: true, parts: [{v: 10, src: 'páncél nélkül'}, {v: mods.dex, src: 'DEX-módosító'}]});
      for (const x of A.acBase) cands.push({shield: !x.noShield, parts: [{v: num(x.base, 10), src: x.src}, ...arr(x.add, 3).filter(a => ABIL.includes(a)).map(a => ({v: mods[a], src: a.toUpperCase() + '-módosító'}))]});
    }
    for (const c of cands) { c.useShield = !!shield && c.shield; if (c.useShield) c.parts.push({v: 2, src: shield.i.name}); c.v = sum(c.parts); }
    const best = cands.reduce((m, c) => c.v > m.v ? c : m, cands[0]);
    const acParts = [...best.parts];
    for (const x of worn) {
      if (!num(x.r.bAc) || (x === shield && !best.useShield)) continue;
      if (x !== armor && x !== shield && x.r.att && !x.i.attuned) continue;
      acParts.push({v: num(x.r.bAc), src: x.i.name});
    }
    if (armor) acParts.push(...A.acBonus);
    const ac = val('ac', sum(acParts), acParts);
    const acNote = [armor ? armor.i.name : best.parts[0].src, best.useShield ? shield.i.name : ''].filter(Boolean).join(', ');
    // speed: faj (az alfaj felülírhatja) + feature-ök (feltétellel) ; heavy armor STR alatt −10 (törpének nem)
    const sp = {walk: 30, ...(race?.sp || {}), ...(subrace?.sp || {})};
    const spParts = [{v: num(sp.walk, 30), src: subrace?.sp?.walk ? 'Alfaj: ' + subrace.n : race ? 'Faj: ' + race.n : 'alap'}];
    for (const x of A.speed) {
      if ((x.if === 'noHeavy' && armor?.r.tc === 'HA') || (x.if === 'noArmor' && (armor || shield))) continue;
      const v = evalMax(x.v, {lvl: x.ctx.lvl || L, cols: classInfo(x.ctx.cls, rb).r?.cols, mods, pb: PB});
      if (v) spParts.push({v, src: x.src});
    }
    if (armor?.r.str && abilities.str.v < num(armor.r.str) && !A.heavyOk) spParts.push({v: -10, src: `${armor.i.name}: STR ${armor.r.str} alatt`});
    const walk = sum(spParts);
    const speed = val('speed', [`${walk} ft.`, ...['fly', 'swim', 'climb', 'burrow'].filter(k => num(sp[k])).map(k => `${k} ${sp[k]} ft.`)].join(', '), spParts);

    // támadások a felszerelt fegyverekből
    const wprof = uniqCI(A.weapon).map(x => x.toLowerCase());
    const profW = (r, name) => wprof.some(p => (r.wc && (p === r.wc || p === r.wc + ' weapons')) || (p.length > 3 && name.toLowerCase().includes(p.replace(/s$/, ''))));
    const attacks = [];
    for (const {i, r} of worn) {
      if (!['M', 'R'].includes(r.tc) || !r.dmg) continue;
      const ranged = r.tc === 'R', pr = String(r.pr || '');
      const monkW = A.martialArts && ((r.wc === 'simple' && !ranged && !/heavy|two-handed/i.test(pr)) || /shortsword/i.test(i.name));
      const a = ranged ? 'dex' : (/finesse/i.test(pr) || monkW) && mods.dex > mods.str ? 'dex' : 'str';
      const prof = profW(r, i.name), [dice, ...type] = String(r.dmg).split(' ');
      const dm = mods[a] + num(r.bW) + (!ranged && A.duelDmg && !/two-handed/i.test(pr) ? A.duelDmg : 0);
      attacks.push({name: i.name, hit: sgn(mods[a] + (prof ? PB : 0) + num(r.bW) + (ranged ? A.rangedAtk : 0)), dmg: `${dice}${dm ? sgn(dm) : ''} ${type.join(' ')}`.trim(),
        note: [pr, r.d2 ? 'versatile ' + r.d2 : '', r.rg ? 'range ' + r.rg : '', prof ? '' : 'nem jártas'].filter(Boolean).join(' · ')});
    }
    if (A.martialArts) {
      const die = colOf(classInfo(A.martialArts.cls, rb).r?.cols, 'Martial Arts', A.martialArts.lvl) || '1d4', a = mods.dex > mods.str ? 'dex' : 'str';
      attacks.push({name: 'Unarmed Strike', hit: sgn(mods[a] + PB), dmg: `${die}${mods[a] ? sgn(mods[a]) : ''} bludgeoning`, note: 'Martial Arts'});
    }
    // erőforrások (azonos névnél a nagyobb)
    const resources = [];
    for (const x of A.res) {
      const ctx = {lvl: x.ctx.lvl || L, cols: classInfo(x.ctx.cls, rb).r?.cols, mods, pb: PB};
      let max = evalMax(x.max, ctx) + num(x.add);
      if (x.min != null) max = Math.max(num(x.min), max);
      const r = {name: str(x.n, 100), max: Math.min(99, max), reset: x.shortAt && ctx.lvl >= x.shortAt ? 'short' : RESETS.includes(x.reset) ? x.reset : 'long'};
      const old = resources.find(y => y.name === r.name);
      if (!old) { if (r.max > 0) resources.push(r); } else if (r.max > old.max) Object.assign(old, r);
    }
    // varázslás osztályonként (multiclassnál eltérő képesség és DC)
    const casting = [];
    for (const c of classes) {
      const ci = classInfo(c.name, rb), sub = subclassOf(b, c.name, rb);
      const type = sub?.caster || ci.caster || (THIRD_CASTERS.test(c.subclass) ? 'third' : ''), ab = sub?.caster ? sub.ab : ci.ab || (type === 'third' ? 'int' : '');
      if (!type || !ab) continue;
      const tbl = sub?.caster ? sub : ci.r || {};
      casting.push({cls: c.name, type, ab, dc: 8 + PB + mods[ab], atk: PB + mods[ab], cantrips: num(tbl.cantrips?.[c.level - 1]), known: num(tbl.known?.[c.level - 1]),
        prepared: !sub?.caster && ci.r?.prep ? prepCount(ci.r.prep, c.level, mods) : 0});
    }
    // mindig felkészített / ismert varázslatok (domain, oath, faji)
    const always = [];
    for (const x of A.spells) {
      if (!['prepared', 'known', 'innate'].includes(x.t) || num(x.lvl, 1) > (x.ctx.lvl || L)) continue;
      for (const n of arr(x.sp, 30)) {
        const r = (rb?.spells || []).find(sp => sp.n.toLowerCase() === String(n).toLowerCase());
        if (!always.some(a => a.name.toLowerCase() === String(n).toLowerCase())) always.push({name: r ? r.n : String(n).replace(/(^|\s)\S/g, m => m.toUpperCase()), level: r ? num(r.l) : 0, ref: r ? r.n + '|' + r.s : ''});
      }
    }

    const done = new Set(s.todoDone || []);
    const todos = [
      ...choices.filter(c => !c.done).map(c => ({key: c.key, kind: c.kind, src: c.src, text: `${c.src}: ${FX_LABEL[c.kind] || c.kind}` + (c.n > 1 ? ` (${c.ok.length} / ${c.n})` : '')})),
      ...A.todo.filter((t, i, l) => !done.has(t.key) && l.findIndex(x => x.key === t.key) === i).map(t => ({...t, kind: 'manual'})),
      ...missing.map(m => ({key: 'missing:' + m, kind: 'missing', text: m + ' – nincs a szabálykönyvben'}))
    ];
    return {full, level: L, pb: PB, classes, abilities, mods, saves, skills, jack, passive, hpMax, init, ac, acNote, speed, slots: sl.slots, pact: sl.pact,
      profs: {armor: uniqCI(A.armor).join(', '), weapons: uniqCI(A.weapon).join(', '), tools: uniqCI(A.tool).join(', '), languages: uniqCI(A.lang).join(', ')},
      senses: A.dv ? `darkvision ${A.dv} ft.` : '', resist: uniqCI(A.resist).join(', '),
      features, resources, attacks, casting, always, choices, todos, missing};
  }
  // ASI-érték: összesen +2 (egy képességre +2 vagy kettőre +1)
  function asiInc(v) {
    const inc = Object.fromEntries(ABIL.filter(a => num(v[a]) > 0).map(a => [a, Math.floor(num(v[a]))]));
    const t = Object.values(inc).reduce((x, y) => x + y, 0);
    return t > 0 && t <= 2 ? inc : null;
  }
  // a számolt értékek kiírása a lap mezőibe (gyorsítótár: a DM Screen, a harc és a régi kód ezeket olvassa); csak a változott mezők.
  // Szabálykönyv nélkül (c.full = false) csak a szabálykönyvtől független mezők íródnak, hogy a meglévő jellemzők ne vesszenek el.
  function materialize(s, c) {
    const skillProf = Object.fromEntries(Object.entries(c.skills).filter(([, x]) => x.prof >= 1).map(([k, x]) => [k, x.prof]));
    const abilities = Object.fromEntries(ABIL.map(a => [a, c.abilities[a].v]));
    const dflt = mod(abilities.dex) + (c.jack ? Math.floor(c.pb / 2) : 0);
    const max = c.hpMax.v, sc = s.spellcasting, cast = c.casting[0];
    const p = {
      classes: c.classes.length ? c.classes : s.classes, abilities, saveProf: ABIL.filter(a => c.saves[a].prof), skillProf, jack: c.jack,
      initBonus: c.init.v === dflt ? null : c.init.v,
      hp: {...s.hp, max, cur: Math.min(s.hp.cur, max)},
      spellcasting: {...sc, ability: cast?.ab || (c.full ? '' : sc.ability), slots: c.slots, used: sc.used.map((u, i) => Math.min(u, c.slots[i])),
        pact: {level: c.pact.level, max: c.pact.max, used: Math.min(sc.pact.used, c.pact.max)}},
      cache: {saves: Object.fromEntries(ABIL.map(a => [a, c.saves[a].v])), skills: Object.fromEntries(Object.keys(SKILLS).map(k => [k, c.skills[k].v])),
        passive: c.passive, spell: cast ? {dc: cast.dc, atk: cast.atk} : null}
    };
    if (c.full) {
      // a számolt tételek (auto) cserélődnek, a saját tételek maradnak; az azonos nevű saját tétel kiesik (átállításkor ne legyen kétszer)
      const merge = (old, list, f = x => x) => {
        const names = new Set(list.map(x => x.name.toLowerCase()));
        return [...list.map(x => ({...f(x), auto: true})), ...old.filter(x => !x.auto && !names.has(x.name.toLowerCase()))];
      };
      Object.assign(p, {ac: c.ac.v, acNote: c.acNote, speed: c.speed.v, profs: c.profs, senses: c.senses, resist: c.resist,
        features: merge(s.features, c.features),
        resources: merge(s.resources, c.resources, r => { const o = s.resources.find(x => x.name === r.name); return {...r, used: Math.min(o?.used || 0, r.max)}; }),
        attacks: merge(s.attacks, c.attacks),
        spells: merge(s.spells, c.always, x => ({name: x.name, level: x.level, prepared: false, always: true, note: '', ref: x.ref}))});
    }
    const next = norm({...s, ...p}), out = {};
    for (const k of Object.keys(p)) if (JSON.stringify(next[k]) !== JSON.stringify(s[k])) out[k] = next[k];
    return out;
  }
  // ---------- kézi (régi) lap: a motor a lap mezőiből (osztály-, alosztály-, fajnév; a képességek a beírt végleges értékek) ----------
  // a választólisták: osztályok, egy osztály alosztályai, faj + alfaj párok ('Dwarf (Hill)'; az alapváltozat csak a faj neve)
  const classNames = rb => rb?.classes?.length ? rb.classes.map(c => c.n) : Object.keys(CLASSES);
  const subclassesOf = (cls, rb) => (rb?.subclasses || []).filter(x => x.cls === cls);
  function subclassRef(cls, name, rb) {
    const n = String(name || '').trim().toLowerCase();
    const x = n && subclassesOf(cls, rb).find(sc => sc.n.toLowerCase() === n || String(sc.short || '').toLowerCase() === n);
    return x ? x.n + '|' + x.s : '';
  }
  function raceOptions(rb) {
    const out = [];
    for (const r of rb?.races || []) {
      const subs = (rb.subraces || []).filter(x => x.race === r.n);
      if (!subs.length) out.push({label: r.n, race: r.n + '|' + r.s, subrace: ''});
      for (const sr of subs) out.push({label: /\(alap\)$/.test(sr.n) ? r.n : `${r.n} (${sr.n})`, race: r.n + '|' + r.s, subrace: sr.n + '|' + sr.s});
    }
    return out;
  }
  // a lapon tárolt fajnév → választás; a régi, szabad szöveges nevet is felismeri (pl. „Hill Dwarf”, „Lightfoot Halfling”)
  function findRace(label, rb) {
    const t = String(label || '').trim().toLowerCase();
    if (!t) return null;
    return raceOptions(rb).find(o => {
      const [r, sr] = [refName(o.race), refName(o.subrace)].map(x => x.toLowerCase());
      return o.label.toLowerCase() === t || (sr && !/\(alap\)$/.test(sr) && `${sr} ${r}` === t) || (sr && /\(alap\)$/.test(sr) && r === t);
    }) || null;
  }
  function legacyBuild(s, rb, withRace) {
    const levels = s.classes.filter(c => findClass(c.name) || (rb?.classes || []).some(x => x.n === c.name))
      .flatMap(c => Array.from({length: c.level}, () => ({c: findClass(c.name) || c.name})));
    const sub = Object.fromEntries(s.classes.map(c => [findClass(c.name) || c.name, subclassRef(findClass(c.name) || c.name, c.subclass, rb)]).filter(([, r]) => r));
    const ra = withRace ? findRace(s.race, rb) : null;
    const b = normBuild({base: s.abilities, levels, sub, race: ra?.race || '', subrace: ra?.subrace || ''});
    b.origin = {};  // a beírt képességértékekben a faji bónusz már benne van
    return b;
  }
  const legacyCalc = (s, rb, withRace = true) => calc({...s, auto: true, build: legacyBuild(s, rb, withRace), ov: {}}, rb);
  // az osztályokból és a fajból kitölthető mezők (az Alapadatok űrlapjának): hit die, mentők, jártasságok (a meglévők mellé), slotok
  function derive(s, rb) {
    // összefésülés a meglévő szöveggel; a „light armor” és a „light”, a „simple weapons” és a „simple” ugyanaz
    const key = x => x.trim().toLowerCase().replace(/\s+(armor|weapons?)$/, ''), have = s.profs, c = legacyCalc(s, rb);
    const merge = (a, b) => { const seen = new Set(); return [...String(a || '').split(','), ...String(b || '').split(',')].map(x => x.trim()).filter(x => x && !seen.has(key(x)) && seen.add(key(x))).join(', '); };
    return {
      classes: s.classes.map(x => { const n = findClass(x.name) || x.name; return {...x, name: n, hitDie: classInfo(n, rb).hd}; }),
      saveProf: ABIL.filter(a => c.saves[a].prof),
      profs: {armor: merge(have.armor, c.profs.armor), weapons: merge(have.weapons, c.profs.weapons), tools: merge(have.tools, c.profs.tools), languages: merge(have.languages, c.profs.languages)},
      spellcasting: {...s.spellcasting, ability: c.casting[0]?.ab || s.spellcasting.ability, slots: c.slots, pact: {...s.spellcasting.pact, level: c.pact.level, max: c.pact.max}}
    };
  }
  // felszerelés hatása a kézi lapon: a felszerelt fegyverek támadásként (auto), és ha páncél / pajzs / AC-bónuszos tárgy változott, az AC
  const acItem = r => !!r && (ARMOR_TC.includes(r.tc) || r.tc === 'S' || !!num(r.bAc));
  function equipPatch(s, rb, withAc) {
    if (!rb?.classes?.length) return {};
    const c = legacyCalc(s, rb), names = new Set(c.attacks.map(x => x.name.toLowerCase()));
    const p = {attacks: [...c.attacks.map(x => ({...x, auto: true})), ...s.attacks.filter(x => !x.auto && !names.has(x.name.toLowerCase()))]};
    if (withAc) Object.assign(p, {ac: c.ac.v, acNote: c.acNote});
    return p;
  }
  // ---------- választó-modul (a Felépítés és a szintlépés-varázsló közös része): egy választási hely opciói és beírása ----------
  // choiceOptions(c, calc-eredmény, rb) → {multi, n, free, opts: [{v, l, note, dis}]}; multi = jelölőnégyzetek, free = szabad szöveg
  const ABIL_OPTS = ABIL.map(a => ({v: a, l: a.toUpperCase()}));
  // PHB 2014 nyelvei: [név, egzotikus]
  const LANGS = [['Common', false], ['Dwarvish', false], ['Elvish', false], ['Giant', false], ['Gnomish', false], ['Goblin', false], ['Halfling', false], ['Orc', false],
    ['Abyssal', true], ['Celestial', true], ['Draconic', true], ['Deep Speech', true], ['Infernal', true], ['Primordial', true], ['Sylvan', true], ['Undercommon', true]];
  function choiceOptions(c, cr, rb) {
    const others = kind => (cr?.choices || []).filter(x => x.kind === kind && x.key !== c.key).flatMap(x => x.ok);
    const has = new Set(arr(c.value, 30).map(x => isObj(x) ? '' : String(x)));
    // egy featet csak egyszer lehet felvenni (faj, ASI, más feat választása)
    const featsTaken = new Set((cr?.choices || []).filter(x => x.key !== c.key).flatMap(x => x.kind === 'feat' ? x.ok : x.kind === 'asi' ? x.ok.map(v => v.feat).filter(Boolean) : []));
    const refs = list => (list || []).map(x => { const v = x.n + '|' + x.s; return {v, l: x.n, note: x.pre || '', dis: featsTaken.has(v) && !has.has(v)}; });
    let opts = [], multi = false, free = false;
    if (c.kind === 'ability' || c.kind === 'saves') { multi = true; opts = ABIL_OPTS.filter(o => !Array.isArray(c.from) || c.from.includes(o.v)); }
    else if (c.kind === 'skills') {
      multi = true;
      const from = Array.isArray(c.from) ? c.from.map(skillKey) : Object.keys(SKILLS);
      opts = from.filter(k => SKILLS[k]).map(k => { const x = cr?.skills?.[k]; const other = x?.prof >= 1 && !has.has(k);
        return {v: k, l: skillLabel(k), note: other ? 'már jártas' : '', dis: other}; });
    } else if (c.kind === 'expertise') {
      multi = true;
      const taken = new Set(others('expertise'));
      opts = Object.keys(SKILLS).filter(k => cr?.skills?.[k]?.prof >= 1).map(k => ({v: k, l: skillLabel(k), note: taken.has(k) ? 'már expertise' : '', dis: taken.has(k)}));
    } else if (c.kind === 'lang') {
      // a PHB nyelvei (vagy a forrás listája); ami máshonnan már megvan, az „már tudja” és nem választható
      const own = new Set([...has].map(x => x.toLowerCase()));
      const known = new Set(String(cr?.profs?.languages || '').split(',').map(x => x.trim().toLowerCase()).filter(x => x && !own.has(x)));
      const list = Array.isArray(c.from) && c.from.length ? c.from.map(x => [String(x), false]) : LANGS;
      opts = list.map(([l, ex]) => { const k = known.has(l.toLowerCase()); return {v: l, l, note: k ? 'már tudja' : ex ? 'egzotikus' : '', dis: k}; });
    } else if (c.kind === 'tool') {
      if (Array.isArray(c.from) && c.from.length) opts = c.from.map(x => ({v: String(x), l: String(x)})); else free = true;
    } else if (c.kind === 'feat') opts = refs(rb?.feats);
    else if (c.kind === 'opt') {
      const taken = new Set(others('opt'));
      opts = (rb?.optfeatures || []).filter(o => (o.t || []).some(t => (c.from || []).includes(t)) && (!o.lv || o.lv <= (c.ctx?.lvl || 20)))
        .map(o => { const v = o.n + '|' + o.s; return {v, l: o.n, note: o.pre || '', dis: taken.has(v) && !has.has(v)}; });
    } else if (c.kind === 'subclass') opts = subclassesOf(c.key.replace(/:sub$/, ''), rb).map(x => ({v: x.n + '|' + x.s, l: x.n}));
    else if (c.kind === 'subrace') {
      const race = refName(c.src.replace(/^Faj: /, ''));
      opts = (rb?.subraces || []).filter(x => x.race === race).map(x => ({v: x.n + '|' + x.s, l: /\(alap\)$/.test(x.n) ? race + ' (alap)' : x.n}));
    } else if (c.kind === 'asi') opts = refs(rb?.feats);
    return {multi, free, n: c.n, opts};
  }
  // a választás beírása a felépítésbe (alosztály → sub, alfaj → subrace, a többi → ch); üres érték = törlés
  function setChoice(b, c, v) {
    const n = {...b, sub: {...b.sub}, ch: {...b.ch}};
    const empty = v == null || v === '' || (Array.isArray(v) && !v.length) || (isObj(v) && !Object.keys(v).length);
    if (c.kind === 'subclass') { const cls = c.key.replace(/:sub$/, ''); if (empty) delete n.sub[cls]; else n.sub[cls] = String(v); }
    else if (c.kind === 'subrace') n.subrace = empty ? '' : String(v);
    else if (empty) delete n.ch[c.key];
    else n.ch[c.key] = v;
    return normBuild(n);
  }
  // kézi (1. fázisú) lap átállítása a szabálymotorra: a felépítés a lap mezőiből, és ahol a számolt érték eltér a régitől,
  // ott a régi érték felülírásként (ov) megmarad – így az átállítás után semmi nem változik láthatóan
  function toAuto(s, rb) {
    const ra = findRace(s.race, rb), fixed = raceAb(s.race, rb).fixed;
    const bg = (rb?.backgrounds || []).find(x => x.n.toLowerCase() === String(s.background || '').trim().toLowerCase());
    const b = normBuild({...legacyBuild(s, rb, true), origin: null, background: bg ? bg.n + '|' + bg.s : '',
      base: Object.fromEntries(ABIL.map(a => [a, Math.max(1, num(s.abilities[a], 10) - (fixed[a] || 0))]))});
    const ov = {};
    let c = calc({...s, auto: true, build: b, ov}, rb);
    for (const a of ABIL) if (c.abilities[a].v !== s.abilities[a]) ov['ab:' + a] = s.abilities[a];
    c = calc({...s, auto: true, build: b, ov}, rb);
    for (const a of ABIL) if (!!c.saves[a].prof !== s.saveProf.includes(a)) ov['save:' + a] = s.saveProf.includes(a) ? 1 : 0;
    for (const k of Object.keys(SKILLS)) { const p = s.skillProf[k] || (s.jack ? 0.5 : 0); if (c.skills[k].prof !== p) ov['skill:' + k] = p; }
    if (c.hpMax.v !== s.hp.max) ov.hpMax = s.hp.max;
    if (c.ac.v !== s.ac) ov.ac = s.ac;
    if (c.speed.v !== s.speed) ov.speed = s.speed;
    if (c.init.v !== initiative(s)) ov.init = initiative(s);
    return {auto: true, build: b, ov: normOv(ov), todoDone: []};
  }
  // ---------- faji és feat-képességbónusz a kézi lapon (a beírt értékekhez adva) ----------
  // fixed: azonnal hozzáadható; choose: a játékos választ (pl. Half-Elf 2× +1, Resilient)
  function abBonusOf(fx) {
    const fixed = {}, choose = [];
    for (const f of fx || []) {
      if (isObj(f?.ab)) for (const a of ABIL) if (num(f.ab[a])) fixed[a] = (fixed[a] || 0) + num(f.ab[a]);
      if (isObj(f?.abChoose)) choose.push({from: arr(f.abChoose.from, 6).filter(a => ABIL.includes(a)), n: Math.max(1, num(f.abChoose.n, 1)), amt: Math.max(1, num(f.abChoose.amt, 1))});
    }
    return {fixed, choose: choose.map(c => ({...c, from: c.from.length ? c.from : ABIL}))};
  }
  function raceAb(label, rb) {
    const o = findRace(label, rb);
    if (!o) return {fixed: {}, choose: []};
    const r = rbFind(rb.races, o.race), sr = o.subrace ? rbFind(rb.subraces.filter(x => x.race === r?.n), o.subrace) : null;
    const drop = new Set(sr?.ow || []);
    return abBonusOf([...(r?.fx || []).filter(f => !(isObj(f) && Object.keys(f).some(k => drop.has(k)))), ...(sr?.fx || [])]);
  }
  // fajváltás: a régi faj rögzített bónusza le, az újé fel (legfeljebb 20, legalább 1)
  function swapRaceAb(abilities, oldLabel, newLabel, rb) {
    const o = raceAb(oldLabel, rb).fixed, n = raceAb(newLabel, rb).fixed;
    return Object.fromEntries(ABIL.map(a => { const v = num(abilities[a], 10), d = (n[a] || 0) - (o[a] || 0); return [a, d > 0 ? Math.min(Math.max(v, 20), v + d) : Math.max(1, v + d)]; }));
  }
  const addAb = (abilities, inc) => Object.fromEntries(ABIL.map(a => [a, inc[a] ? Math.min(Math.max(num(abilities[a], 10), 20), num(abilities[a], 10) + inc[a]) : num(abilities[a], 10)]));

  // ---------- aktív hatások (spell, feature) és állapotok: amíg a lapon vannak, a mechanikájuk magától érvényesül ----------
  // ac: +AC; acMin: legalább ennyi (Barkskin); armorless: 13 + DEX páncél nélkül (Mage Armor); speed: +ft; speed0 / speedMul;
  // adv / dis / fail: d20-dobások (atk, check, check:str, save, save:dex); bonus: kocka a dobáshoz; dmg: kocka / szám a fegyversebzéshez;
  // conc: koncentrációs spell (a koncentráció végén lekerül); self: castoláskor felajánlja magára; neg: káros állapot (a DM kikapcsolhatja)
  const EFFECTS = {
    'Mage Armor': {armorless: 13, self: true, text: 'AC 13 + DEX, ha nincs rajtad páncél'},
    'Shield': {ac: 5, self: true, text: '+5 AC a következő köröd elejéig'},
    'Shield of Faith': {ac: 2, conc: true, text: '+2 AC'},
    'Haste': {ac: 2, speedMul: 2, adv: ['save:dex'], conc: true, text: '+2 AC, dupla speed, előny a DEX mentőre'},
    'Barkskin': {acMin: 16, conc: true, text: 'az AC legalább 16'},
    'Longstrider': {speed: 10, text: '+10 ft speed'},
    'Bless': {bonus: {atk: '1d4', save: '1d4'}, conc: true, text: '+1d4 a támadásra és a mentőre'},
    'Bane': {bonus: {atk: '-1d4', save: '-1d4'}, conc: true, neg: true, text: '−1d4 a támadásra és a mentőre'},
    "Hunter's Mark": {dmg: '1d6', conc: true, self: true, text: '+1d6 sebzés a megjelölt célpontra'},
    'Hex': {dmg: '1d6', conc: true, self: true, text: '+1d6 necrotic sebzés a megátkozott célpontra'},
    'Enlarge': {adv: ['check:str', 'save:str'], dmg: '1d4', conc: true, text: 'előny a STR próbára és mentőre, +1d4 fegyversebzés'},
    'Reduce': {dis: ['check:str', 'save:str'], dmg: '-1d4', conc: true, neg: true, text: 'hátrány a STR próbára és mentőre, −1d4 fegyversebzés'},
    'Rage': {adv: ['check:str', 'save:str'], dmg: 'rage', melee: true, resist: 'bludgeoning, piercing, slashing', res: 'Rage', text: 'előny a STR próbára és mentőre, + Rage-sebzés közelharcban, ellenállás: bludgeoning, piercing, slashing'},
    'Bladesong': {acAbil: 'int', speed: 10, adv: ['check:dex:acrobatics'], text: '+INT az AC-hoz, +10 ft speed, előny az Acrobatics próbára'},
    'Dodge': {adv: ['save:dex'], text: 'a rád irányuló támadás hátrányos, előny a DEX mentőre'},
    // PHB 2014 állapotok
    'Blinded': {dis: ['atk'], neg: true, text: 'hátrány a támadásra; a látást igénylő próba sikertelen'},
    'Charmed': {neg: true, text: 'nem támadhatod a bűvölőt'},
    'Deafened': {neg: true, text: 'a hallást igénylő próba sikertelen'},
    'Frightened': {dis: ['atk', 'check'], neg: true, text: 'hátrány a támadásra és a próbákra, amíg látod a félelem forrását'},
    'Grappled': {speed0: true, neg: true, text: 'a speed 0'},
    'Incapacitated': {neg: true, text: 'nincs akció és reakció'},
    'Invisible': {adv: ['atk'], text: 'előny a támadásra; a rád irányuló támadás hátrányos'},
    'Paralyzed': {fail: ['save:str', 'save:dex'], speed0: true, neg: true, text: 'cselekvésképtelen, a STR és DEX mentő automatikusan sikertelen'},
    'Petrified': {fail: ['save:str', 'save:dex'], speed0: true, neg: true, resist: 'minden sebzés', text: 'cselekvésképtelen, STR és DEX mentő sikertelen, ellenállás minden sebzésre'},
    'Poisoned': {dis: ['atk', 'check'], neg: true, text: 'hátrány a támadásra és a próbákra'},
    'Prone': {dis: ['atk'], neg: true, text: 'hátrány a támadásra; felállás: fél speed'},
    'Restrained': {dis: ['atk', 'save:dex'], speed0: true, neg: true, text: 'a speed 0, hátrány a támadásra és a DEX mentőre'},
    'Stunned': {fail: ['save:str', 'save:dex'], speed0: true, neg: true, text: 'cselekvésképtelen, a STR és DEX mentő automatikusan sikertelen'},
    'Unconscious': {fail: ['save:str', 'save:dex'], speed0: true, neg: true, text: 'eszméletlen, a STR és DEX mentő automatikusan sikertelen'}
  };
  const INCAP = ['Incapacitated', 'Paralyzed', 'Petrified', 'Stunned', 'Unconscious'];
  const effectOf = name => EFFECTS[Object.keys(EFFECTS).find(k => k.toLowerCase() === String(name).trim().toLowerCase())] || null;
  // a felszerelt páncél / pajzs: a szabálykönyvből, ennek hiányában név alapján
  function wornArmor(s, rb) {
    const items = rb ? allItems(rb) : [];
    const worn = s.inventory.filter(i => i.equipped).map(i => ({i, r: items.length ? byRef(items, i.ref, i.name) : null}));
    const isShield = x => x.r ? x.r.tc === 'S' : /\bshield\b/i.test(x.i.name);
    const isArmor = x => x.r ? ARMOR_TC.includes(x.r.tc) : /\b(armor|mail|plate|breastplate|hide)\b/i.test(x.i.name) && !isShield(x);
    return {armor: worn.some(isArmor), shield: worn.some(isShield)};
  }
  const rageDmg = s => { const l = s.classes.filter(c => findClass(c.name) === 'Barbarian').reduce((t, c) => t + c.level, 0); return l >= 16 ? 4 : l >= 9 ? 3 : 2; };
  // a lap aktív hatásai összesítve: AC, speed (a lapon tárolt alapértékből), dobás-módosítók, sebzés, teendőszöveg
  function effects(s, rb = null) {
    const off = new Set(s.effOff || []), act = [];
    for (const n of s.conditions) { const fx = effectOf(n); if (fx && !off.has(n)) act.push({name: n, fx}); }
    const ex = s.exhaustion, exFx = {dis: [...(ex >= 1 ? ['check'] : []), ...(ex >= 3 ? ['atk', 'save'] : [])], speedHalf: ex >= 2, speed0: ex >= 5};
    if (ex && !off.has('Exhaustion')) act.push({name: 'Exhaustion ' + ex, fx: exFx});
    const w = wornArmor(s, rb), dex = mod(s.abilities.dex);
    let ac = s.ac; const acParts = [];
    for (const {name, fx} of act) {
      if (fx.armorless && !w.armor) { const v = fx.armorless + dex + (w.shield ? 2 : 0); if (v > ac) { acParts.push(name); ac = v; } }
      if (fx.acMin && fx.acMin > ac) { acParts.push(name); ac = fx.acMin; }
    }
    let acAdd = 0;  // a hozzáadott rész (Shield of Faith, Haste…): a DM AC-átírásából ezt kell levonni, hogy az alapérték maradjon a lapon
    for (const {name, fx} of act) {
      const v = (fx.ac || 0) + (fx.acAbil && !w.armor && !w.shield ? Math.max(1, mod(s.abilities[fx.acAbil])) : 0);
      if (v) { ac += v; acAdd += v; acParts.push(name); }
    }
    const m = String(s.speed).match(/\d+/);
    let walk = m ? +m[0] : 30;
    for (const {fx} of act) if (fx.speed) walk += fx.speed;
    for (const {fx} of act) if (fx.speedMul) walk *= fx.speedMul;
    if (act.some(x => x.fx.speedHalf)) walk = Math.floor(walk / 2);
    const zero = act.find(x => x.fx.speed0);
    if (zero) walk = 0;
    const speed = m ? String(s.speed).replace(/\d+/, walk) : `${walk} ft.`;
    const pick = k => act.flatMap(x => (x.fx[k] || []).map(t => ({t, src: x.name})));
    const dmg = act.filter(x => x.fx.dmg).map(x => ({v: x.fx.dmg === 'rage' ? String(rageDmg(s)) : x.fx.dmg, melee: !!x.fx.melee, src: x.name}));
    return {active: act.map(x => x.name), ac, acAdd, acParts, speed, speedNote: zero ? zero.name : '', adv: pick('adv'), dis: pick('dis'), fail: pick('fail'),
      bonus: act.flatMap(x => Object.entries(x.fx.bonus || {}).map(([k, v]) => ({k, v, src: x.name}))), dmg,
      resist: act.map(x => x.fx.resist).filter(Boolean).join(', ')};
  }
  // egy d20-dobás (kind: 'atk', 'check:dex:stealth', 'save:wis', 'init' = DEX próba) módosítói a hatásokból
  function rollFx(e, kind) {
    const k = kind === 'init' ? 'check:dex' : String(kind || '');
    const hit = list => list.filter(x => k === x.t || k.startsWith(x.t + ':'));
    const type = k.split(':')[0];
    return {adv: hit(e.adv).map(x => x.src), dis: hit(e.dis).map(x => x.src), fail: hit(e.fail).map(x => x.src), bonus: e.bonus.filter(x => x.k === type)};
  }
  // koncentráció vége: a koncentrációs hatás is lekerül
  const dropConc = (conditions, spell) => conditions.filter(c => !(effectOf(c)?.conc && c.toLowerCase() === String(spell).toLowerCase()));

  // szabálymotoros lapnál a számolt mezők kézi átírása (s → n) felülírás-kulcsokra (ov) fordítva, különben a következő újraszámolás eltüntetné
  function ovEdits(s, n) {
    const out = {};
    if (n.ac !== s.ac) out.ac = n.ac;
    if (n.hp.max !== s.hp.max) out.hpMax = n.hp.max;
    if (n.speed !== s.speed) out.speed = n.speed;
    if (n.initBonus !== s.initBonus) out.init = initiative(n);
    for (const a of ABIL) {
      if (n.abilities[a] !== s.abilities[a]) out['ab:' + a] = n.abilities[a];
      if (n.saveProf.includes(a) !== s.saveProf.includes(a)) out['save:' + a] = n.saveProf.includes(a) ? 1 : 0;
    }
    for (const k of Object.keys(SKILLS)) if ((n.skillProf[k] || 0) !== (s.skillProf[k] || 0)) out['skill:' + k] = n.skillProf[k] || (n.jack ? 0.5 : 0);
    return out;
  }

  // pihenők: a változott mezőket adják vissza (a hívó írja a felhőbe)
  function shortRest(s) {
    return {
      resources: s.resources.map(r => r.reset === 'short' ? {...r, used: 0} : r),
      spellcasting: {...s.spellcasting, pact: {...s.spellcasting.pact, used: 0}}
    };
  }
  function longRest(s) {
    const back = Math.max(1, Math.floor(level(s) / 2));
    let left = back;
    const hdu = {};
    for (const h of hitDice(s)) { const r = Math.min(h.used, left); left -= r; if (h.used - r > 0) hdu[h.die] = h.used - r; }
    return {
      hp: {max: s.hp.max, cur: s.hp.max, temp: 0}, deathSaves: {ok: 0, fail: 0}, hitDiceUsed: hdu,
      resources: s.resources.map(r => r.reset === 'none' ? r : {...r, used: 0}),
      spellcasting: {...s.spellcasting, used: s.spellcasting.used.map(() => 0), pact: {...s.spellcasting.pact, used: 0}},
      exhaustion: Math.max(0, s.exhaustion - 1)
    };
  }
  // sebzés / gyógyítás: temp HP először nyel; 0 HP-ról gyógyulva a halálmentők nullázódnak
  function damage(s, n) {
    const fromTemp = Math.min(s.hp.temp, n);
    return {hp: {...s.hp, temp: s.hp.temp - fromTemp, cur: Math.max(0, s.hp.cur - (n - fromTemp))}};
  }
  function heal(s, n) {
    const p = {hp: {...s.hp, cur: Math.min(s.hp.max, s.hp.cur + n)}};
    if (s.hp.cur === 0 && n > 0) p.deathSaves = {ok: 0, fail: 0};
    return p;
  }

  // ---------- szabálykönyv (rules/meta + rules/{darab}); a DM Screen tölti fel, a telefon egyszer letölti ----------
  // darab: {data: '{"k":"spells","a":[...]}'}; a meta: {version, format, chunks: [...], counts}
  // 2-es formátum (2. fázis): osztályok, alosztályok, feature-szövegek, fajok, alfajok, hátterek, optional feature-ök, és hatáslisták (fx)
  const RB_FORMAT = 2, RB_KINDS = ['spells', 'items', 'baseItems', 'variants', 'feats', 'conditions', 'classes', 'subclasses', 'features', 'races', 'subraces', 'backgrounds', 'optfeatures'];
  const emptyRulebook = () => Object.fromEntries(RB_KINDS.map(k => [k, []]));
  function joinChunks(chunks) {
    const rb = emptyRulebook();
    for (const c of chunks) {
      const o = typeof c?.data === 'string' ? JSON.parse(c.data) : null;
      if (o && RB_KINDS.includes(o.k) && Array.isArray(o.a)) rb[o.k].push(...o.a.filter(isObj));
    }
    return rb;
  }
  // a fájlméret-korlát (1 MB / dokumentum) miatt darabolva, bájtban mérve
  function splitChunks(rb, maxBytes = 900000) {
    const enc = new TextEncoder(), out = [];
    for (const k of RB_KINDS) {
      let part = [], size = 20, n = 0;
      const flush = () => { out.push({id: `${k}-${n++}`, data: JSON.stringify({k, a: part})}); part = []; size = 20; };
      for (const x of rb[k] || []) {
        const b = enc.encode(JSON.stringify(x)).length + 1;
        if (part.length && size + b > maxBytes) flush();
        part.push(x); size += b;
      }
      if (part.length || n === 0) flush();
    }
    return out;
  }
  // db: {get(path)}; cache: {get(key), set(key, val)} (a telefonon IndexedDB) – internet nélkül a tárolt példány megy
  async function loadRulebook(db, cache) {
    let meta = null, cached = null;
    try { cached = cache ? await cache.get('rulebook') : null; } catch {}
    try { meta = await db.get('rules/meta'); }
    catch (e) { if (cached?.rb) return {...cached, offline: true}; throw e; }
    if (!meta || !Array.isArray(meta.chunks)) return null;
    if (cached?.version === meta.version && cached.rb) return cached;
    const chunks = await Promise.all(meta.chunks.map(id => db.get('rules/' + id)));
    const out = {version: meta.version, format: meta.format || 1, counts: meta.counts || {}, rb: joinChunks(chunks)};
    try { cache && await cache.set('rulebook', out); } catch {}
    return out;
  }
  // kicsi IndexedDB kulcs-érték tároló (a localStorage kevés lenne: a github.io-s appok osztoznak rajta)
  const idb = (() => {
    let p = null;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('dmscreen-karakter', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, f) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction('kv', mode); const q = f(t.objectStore('kv')); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
    return {get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k))};
  })();

  // tárgyvariánsok (pl. +1 Weapon, Flame Tongue) kibontása az alaptárgyakra; a szabálykönyvben csak egyszer tároljuk őket
  const propOf = x => typeof x === 'string' ? x.split('|')[0] : String(x?.uid || '').split('|')[0];
  function matchVal(m, k, v) {
    if (Array.isArray(v)) return v.some(x => matchVal(m, k, x));
    const have = m[k];
    if (Array.isArray(have)) return have.some(x => propOf(x) === v);
    if (k === 'name') return String(have).toLowerCase() === String(v).toLowerCase();
    return have === v || (typeof have === 'string' && typeof v === 'string' && have.split('|')[0] === v.split('|')[0]);
  }
  function variantFits(v, b) {
    const m = b.m || {};
    if (Array.isArray(v.req) && v.req.length && !v.req.some(r => isObj(r) && Object.entries(r).every(([k, val]) => matchVal(m, k, val)))) return false;
    if (isObj(v.exc) && Object.entries(v.exc).some(([k, val]) => matchVal(m, k, val))) return false;
    return true;
  }
  const cache = new WeakMap();
  function allItems(rb) {
    if (!rb) return [];
    if (cache.has(rb)) return cache.get(rb);
    const out = [...rb.baseItems.map(b => ({...b, base: true})), ...rb.items];
    for (const v of rb.variants) for (const b of rb.baseItems) if (variantFits(v, b)) {
      out.push({n: v.pre || v.suf ? `${v.pre || ''}${b.n}${v.suf || ''}` : `${v.n} (${b.n})`, s: v.s, ty: b.ty, rar: v.rar, att: v.att, mag: true,
        w: b.w, dmg: b.dmg, d2: b.d2, pr: b.pr, rg: b.rg, ac: b.ac, str: b.str, st: b.st, tx: [v.tx, b.tx].filter(Boolean).join('\n\n'), from: v.n,
        tc: b.tc, wc: b.wc, bAc: v.bAc, bW: v.bW, bS: v.bS});
    }
    const seen = new Set(), list = out.filter(x => { const k = x.n.toLowerCase() + '|' + x.s; if (seen.has(k)) return false; seen.add(k); return true; });
    cache.set(rb, list);
    return list;
  }
  function search(list, q, limit = 40) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    return list.filter(x => { const n = String(x.n).toLowerCase(); return words.every(w => n.includes(w)); })
      .sort((a, b) => (a.n.toLowerCase().startsWith(q) ? 0 : 1) - (b.n.toLowerCase().startsWith(q) ? 0 : 1) || a.n.length - b.n.length || a.n.localeCompare(b.n))
      .slice(0, limit);
  }
  const refOf = x => x.n + '|' + x.s;
  const byRef = (list, ref, name) => {
    const [n, s] = String(ref || '').split('|');
    return list.find(x => x.n === n && x.s === s) || list.find(x => x.n.toLowerCase() === String(name || n || '').toLowerCase());
  };
  function itemLine(it) {
    return [it.ty, it.rar && it.rar !== 'none' ? it.rar : '', it.att ? it.att : '', it.dmg ? it.dmg + (it.d2 ? ` (versatile ${it.d2})` : '') : '',
      it.ac ? 'AC ' + it.ac : '', it.pr, it.rg ? 'range ' + it.rg : '', it.str ? 'STR ' + it.str : '', it.st ? 'stealth: disadvantage' : '',
      it.w ? it.w + ' lb' : '', it.v || ''].filter(Boolean).join(' · ');
  }
  const ORD = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
  const spellLine = sp => [sp.l ? ORD[sp.l] + ' level' : 'Cantrip', sp.sc, sp.ri ? 'ritual' : '', sp.t, sp.r, sp.c, sp.d].filter(Boolean).join(' · ');

  // a karakterlap-sablon JSON-importhoz (kitalált minta, nem valódi játékos)
  const TEMPLATE = {
    format: FORMAT,
    _leiras: 'DM Screen karakterlap. Importálás: Könyvtár → JSON / Sablon fül. A számolt értékeket (módosítók, mentők, skillek, spell DC) a program számolja; amit itt megadsz: a választások és a jelenlegi állapot. skillProf: 1 = jártas, 2 = expertise. spellcasting.slots: 1–9. szintű slotok száma. resources.reset: short | long | none. initBonus: null = DEX (+ Jack of All Trades).',
    name: 'Minta Tolvaj', race: 'Lightfoot Halfling', background: 'Urchin', alignment: 'chaotic good', portrait: '', owner: '',
    classes: [{name: 'Rogue', subclass: 'Thief', level: 3}],
    abilities: {str: 8, dex: 17, con: 14, int: 12, wis: 13, cha: 10},
    saveProf: ['dex', 'int'], skillProf: {stealth: 2, 'sleight-of-hand': 2, acrobatics: 1, perception: 1, investigation: 1}, jack: false,
    ac: 14, acNote: 'leather armor', speed: '25 ft.', initBonus: null,
    hp: {max: 24, cur: 24, temp: 0},
    spellcasting: {ability: '', slots: [0, 0, 0, 0, 0, 0, 0, 0, 0]}, spells: [],
    attacks: [{name: 'Shortsword', hit: '+5', dmg: '1d6+3 piercing', note: 'finesse, light'}, {name: 'Shortbow', hit: '+5', dmg: '1d6+3 piercing', note: 'range 80/320'}],
    resources: [],
    features: [{name: 'Sneak Attack', text: 'Once per turn, +2d6 damage with a finesse or ranged weapon if you have advantage or an ally is within 5 ft. of the target.', src: 'Rogue 1'},
      {name: 'Cunning Action', text: 'Bonus action: Dash, Disengage or Hide.', src: 'Rogue 2'},
      {name: 'Fast Hands', text: 'Cunning Action: Sleight of Hand check, thieves\' tools, or Use an Object.', src: 'Thief 3'}],
    inventory: [{name: 'Leather Armor', qty: 1, equipped: true}, {name: 'Shortsword', qty: 1, equipped: true}, {name: 'Shortbow', qty: 1}, {name: 'Arrows', qty: 20}, {name: "Thieves' Tools", qty: 1}],
    currency: {gp: 15, sp: 8},
    profs: {armor: 'light armor', weapons: 'simple weapons, hand crossbows, longswords, rapiers, shortswords', tools: "thieves' tools, disguise kit", languages: 'Common, Halfling, Thieves\' Cant'},
    senses: '', resist: '', notes: ''
  };

  return {FORMAT, VERSION, ABIL, ABIL_FULL, SKILLS, skillLabel, CONDITIONS, COINS, RESETS, CLASSES, EMAIL_RE, TEMPLATE, ORD,
    num, str, isObj, mod, sgn, safeUrl, propOf, norm, normInventory, findClass, level, pb, saveBonus, skillProfOf, skillBonus, passive, initiative,
    spellAbility, spellDc, spellAtk, classLabel, hitDice, attuned, hpStatus, slotsFor, shortRest, longRest, damage, heal,
    FEATURE_FX, classInfo, calc, materialize, ovEdits, refName,
    abBonusOf, raceAb, swapRaceAb, addAb, EFFECTS, INCAP, effectOf, effects, rollFx, dropConc,
    classNames, subclassesOf, subclassRef, raceOptions, findRace, derive, acItem, equipPatch, skillKey, choiceOptions, setChoice, toAuto, FX_LABEL,
    RB_FORMAT, RB_KINDS, joinChunks, splitChunks, loadRulebook, idb, allItems, search, refOf, byRef, itemLine, spellLine};
})();

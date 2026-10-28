// Közös kód a DM Screennek (index.html) és a telefonos karakterlapnak (karakter.html):
// a karakterlap formátuma (Firestore: sheets/{könyvtár-id}), tisztítása, a számolt értékek, pihenők,
// spell slot táblák (PHB 2014), és a szabálykönyv (rules/*) betöltése, tárgyvariánsok kibontása.
// Minden a window.Sheet alatt van, hogy ne ütközzön a két app saját konstansaival.
'use strict';
window.Sheet = (() => {
  const FORMAT = 'dmscreen-karakter';
  const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const ABIL_FULL = {str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'};
  const SKILLS = {acrobatics: 'dex', 'animal-handling': 'wis', arcana: 'int', athletics: 'str', deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int', 'sleight-of-hand': 'dex', stealth: 'dex', survival: 'wis'};
  const skillLabel = k => k.split('-').map(w => w === 'of' ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];
  const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];
  const RESETS = ['short', 'long', 'none'];
  const DICE = [6, 8, 10, 12];
  // PHB 2014 osztályok (+ TCE Artificer): hit die, varázsló-típus, varázsképesség
  const CLASSES = {
    Artificer: {hd: 8, caster: 'artificer', ab: 'int'}, Barbarian: {hd: 12}, Bard: {hd: 8, caster: 'full', ab: 'cha'},
    Cleric: {hd: 8, caster: 'full', ab: 'wis'}, Druid: {hd: 8, caster: 'full', ab: 'wis'}, Fighter: {hd: 10}, Monk: {hd: 8},
    Paladin: {hd: 10, caster: 'half', ab: 'cha'}, Ranger: {hd: 10, caster: 'half', ab: 'wis'}, Rogue: {hd: 8},
    Sorcerer: {hd: 6, caster: 'full', ab: 'cha'}, Warlock: {hd: 8, caster: 'pact', ab: 'cha'}, Wizard: {hd: 6, caster: 'full', ab: 'int'}
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
      spells: named(d.spells, 400, x => ({name: str(x.name, 120).trim(), level: int(x.level, 0, 0, 9), prepared: !!x.prepared, always: !!x.always, note: str(x.note, 500), ref: str(x.ref, 200)})),
      resources: named(d.resources, 50, x => { const m = int(x.max, 1, 0, 99); return {name: str(x.name, 100).trim(), max: m, used: int(x.used, 0, 0, m), reset: RESETS.includes(x.reset) ? x.reset : 'long'}; }),
      attacks: named(d.attacks, 50, x => ({name: str(x.name, 100).trim(), hit: str(x.hit, 20), dmg: str(x.dmg, 120), note: str(x.note, 500)})),
      features: named(d.features, 200, x => ({name: str(x.name, 120).trim(), text: str(x.text, 8000), src: str(x.src, 80)})),
      inventory: normInventory(d.inventory),
      currency: Object.fromEntries(COINS.map(k => [k, int(cur[k], 0, 0, 1e9)])),
      conditions: [...new Set(arr(d.conditions, 30).map(c => str(c, 60).trim()).filter(Boolean))],
      exhaustion: int(d.exhaustion, 0, 0, 6),
      profs: {armor: str(pr.armor, 500), weapons: str(pr.weapons, 500), tools: str(pr.tools, 500), languages: str(pr.languages, 500)},
      senses: str(d.senses, 300), resist: str(d.resist, 300), notes: str(d.notes, 20000),
      updatedAt: typeof d.updatedAt === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(d.updatedAt) ? d.updatedAt : '',
      updatedBy: str(d.updatedBy, 200)
    };
    if (!s.classes.length) s.classes = [{name: '', subclass: '', level: 1, hitDie: 8}];
    return s;
  }

  // ---------- számolt értékek (1. fázis: a lapon tárolt választásokból; a szabálymotor a 2. fázisban jön) ----------
  const level = s => Math.max(1, Math.min(20, s.classes.reduce((t, c) => t + c.level, 0)));
  const pb = s => Math.floor((level(s) - 1) / 4) + 2;
  const saveBonus = (s, a) => mod(s.abilities[a]) + (s.saveProf.includes(a) ? pb(s) : 0);
  const skillProfOf = (s, k) => s.skillProf[k] || (s.jack ? 0.5 : 0);
  const skillBonus = (s, k) => { const p = skillProfOf(s, k); return mod(s.abilities[SKILLS[k]]) + (p === 0.5 ? Math.floor(pb(s) / 2) : p * pb(s)); };
  const passive = (s, k) => 10 + skillBonus(s, k);
  const initiative = s => s.initBonus ?? mod(s.abilities.dex) + (s.jack ? Math.floor(pb(s) / 2) : 0);
  const spellAbility = s => s.spellcasting.ability || CLASSES[findClass(s.classes.find(c => CLASSES[findClass(c.name)]?.ab)?.name)]?.ab || '';
  const spellDc = s => { const a = spellAbility(s); return a ? 8 + pb(s) + mod(s.abilities[a]) : null; };
  const spellAtk = s => { const a = spellAbility(s); return a ? pb(s) + mod(s.abilities[a]) : null; };
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
  const RB_FORMAT = 1, RB_KINDS = ['spells', 'items', 'baseItems', 'variants', 'feats', 'conditions'];
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
    const out = {version: meta.version, counts: meta.counts || {}, rb: joinChunks(chunks)};
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
        w: b.w, dmg: b.dmg, d2: b.d2, pr: b.pr, rg: b.rg, ac: b.ac, str: b.str, st: b.st, tx: [v.tx, b.tx].filter(Boolean).join('\n\n'), from: v.n});
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

  return {FORMAT, ABIL, ABIL_FULL, SKILLS, skillLabel, CONDITIONS, COINS, RESETS, CLASSES, EMAIL_RE, TEMPLATE, ORD,
    num, str, isObj, mod, sgn, norm, normInventory, findClass, level, pb, saveBonus, skillProfOf, skillBonus, passive, initiative,
    spellAbility, spellDc, spellAtk, classLabel, hitDice, attuned, hpStatus, slotsFor, shortRest, longRest, damage, heal,
    RB_FORMAT, RB_KINDS, emptyRulebook, joinChunks, splitChunks, loadRulebook, idb, variantFits, allItems, search, refOf, byRef, itemLine, spellLine};
})();

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
    // szabálymotor (2. fázis): a régi, kézi lapon nincs build, és az auto is ki van kapcsolva
    s.build = isObj(d.build) ? normBuild(d.build) : null;
    s.auto = !!d.auto && !!s.build;
    s.ov = normOv(d.ov);
    s.todoDone = [...new Set(arr(d.todoDone, 300).map(x => str(x, 200)).filter(Boolean))];
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

  // ---------- szabálymotor (2. fázis): a lap felépítéséből (build) és a kézi felülírásokból (ov) számol ----------
  // A szabálykönyv elemei (faj, alfaj, háttér, feat…) hatáslistát (fx) hordoznak; egy hatás egy objektum, pl.
  //   {ab: {dex: 2}}  {abChoose: {from: [...], n: 2, amt: 1}}  {abSet: {str: 19}}  {save: ['dex']}  {skill: {stealth: 1}}
  //   {skillChoose: {from: [...] | 'any', n: 2}}  {expertise: {n: 2}}  {jack: true}  {hpPerLevel: 1}  {init: 5}  {feat: {n: 1}}
  // A választást kérő hatások kulcsa: '<forrás>:<fajta>' (pl. 'race:ability', 'Fighter:4:asi', 'feat:Alert|PHB:skills'); az érték a build.ch-ban van.
  const refName = r => String(r || '').split('|')[0];
  const skillKey = k => String(k || '').trim().toLowerCase().replace(/\s+/g, '-');
  function rbFind(list, ref) {
    if (!ref || !Array.isArray(list)) return null;
    const [n, s] = String(ref).split('|');
    return list.find(x => x.n === n && (!s || x.s === s)) || list.find(x => String(x.n).toLowerCase() === n.toLowerCase()) || null;
  }
  function classInfo(name, rb) {
    const b = CLASSES[name] || {}, r = (rb?.classes || []).find(c => c.n === name) || {};
    return {hd: DICE.includes(r.hd) ? r.hd : b.hd || 8, saves: r.saves || b.saves || [], subLvl: r.subLvl || b.subLvl || 3,
      asi: [...new Set([...(r.asi || ASI_LEVELS), ...(r.asi ? [] : b.asi || [])])].sort((x, y) => x - y)};
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
  const CHOICE_KIND = {abChoose: 'ability', skillChoose: 'skills', expertise: 'expertise', feat: 'feat'};
  const FX_LABEL = {ability: 'képességérték-növelés', skills: 'skill-jártasság', expertise: 'expertise', feat: 'feat', asi: 'ASI vagy feat', subclass: 'alosztály'};

  function calc(s, rb = null) {
    const b = s.build || normBuild({}), ov = s.ov || {};
    const classes = buildClasses(b, rb);
    const L = Math.max(1, Math.min(20, b.levels.length)), PB = Math.floor((L - 1) / 4) + 2;
    const fxs = [], choices = [], missing = [];
    // egy forrás hatásai; a választást kérők kulcsot kapnak, és bekerülnek a választási helyek közé
    function addFx(list, src, prefix, depth = 0) {
      const seen = {};
      for (const fx of Array.isArray(list) ? list : []) {
        if (!isObj(fx)) continue;
        for (const [t, kind] of Object.entries(CHOICE_KIND)) {
          if (!fx[t]) continue;
          const n = seen[kind] = (seen[kind] || 0) + 1;
          const key = `${prefix}:${kind}${n > 1 ? n : ''}`;
          const o = isObj(fx[t]) ? fx[t] : {};
          choices.push({key, kind, src, n: Math.max(1, num(o.n, 1)), amt: num(o.amt, 1), from: o.from, value: b.ch[key]});
          if (t === 'feat' && depth < 2) for (const ref of arr(b.ch[key], num(o.n, 1))) featFx(ref, depth);
        }
        fxs.push({fx, src});
      }
    }
    function featFx(ref, depth) {
      const f = rbFind(rb?.feats, ref);
      if (f) addFx(f.fx, 'Feat: ' + f.n, 'feat:' + ref, depth + 1);
      else if (ref) missing.push('Feat: ' + refName(ref));
    }
    const race = rbFind(rb?.races, b.race), subrace = rbFind(rb?.subraces, b.subrace), bg = rbFind(rb?.backgrounds, b.background);
    if (b.race && !race) missing.push('Faj: ' + refName(b.race));
    if (b.subrace && !subrace) missing.push('Alfaj: ' + refName(b.subrace));
    if (b.background && !bg) missing.push('Háttér: ' + refName(b.background));
    // TCE Customizing Your Origin: a faji képességbónusz helyett a megadott áthelyezés
    const noAb = list => b.origin ? (list || []).filter(fx => !(isObj(fx) && (fx.ab || fx.abChoose))) : list;
    if (race) addFx(noAb(race.fx), 'Faj: ' + race.n, 'race');
    if (subrace) addFx(noAb(subrace.fx), 'Alfaj: ' + subrace.n, 'subrace');
    if (b.origin) fxs.push({fx: {ab: b.origin}, src: 'Faj (áthelyezett bónusz, TCE)'});
    if (bg) addFx(bg.fx, 'Háttér: ' + bg.n, 'bg');
    // osztályok: az első osztály mentői; alosztály és ASI a szintek szerint
    if (classes[0]) fxs.push({fx: {save: classInfo(classes[0].name, rb).saves}, src: classes[0].name + ' (első osztály)'});
    for (const c of classes) {
      const ci = classInfo(c.name, rb);
      if (c.level >= ci.subLvl) choices.push({key: c.name + ':sub', kind: 'subclass', src: `${c.name} ${ci.subLvl}`, n: 1, value: b.sub[c.name] || ''});
      for (const lv of ci.asi.filter(x => x <= c.level)) {
        const key = `${c.name}:${lv}:asi`, v = b.ch[key], src = `ASI (${c.name} ${lv})`;
        choices.push({key, kind: 'asi', src, n: 1, value: v});
        if (isObj(v) && typeof v.feat === 'string' && v.feat) featFx(v.feat, 0);
        else if (isObj(v)) { const inc = asiInc(v); if (inc) fxs.push({fx: {ab: inc}, src}); }
      }
    }

    // választások ellenőrzése: csak az érvényes értékek számítanak
    const valid = {};
    for (const c of choices) {
      let ok = [];
      if (c.kind === 'ability') ok = arr(c.value, 6).filter(a => (Array.isArray(c.from) ? c.from : ABIL).includes(a));
      else if (c.kind === 'skills') ok = arr(c.value, 18).map(skillKey).filter(k => SKILLS[k] && (c.from === 'any' || !Array.isArray(c.from) || c.from.map(skillKey).includes(k)));
      else if (c.kind === 'feat') ok = arr(c.value, 4).filter(x => typeof x === 'string' && x);
      else if (c.kind === 'asi') ok = isObj(c.value) && ((typeof c.value.feat === 'string' && c.value.feat) || asiInc(c.value)) ? [c.value] : [];
      else if (c.kind === 'subclass') ok = c.value ? [c.value] : [];
      else if (c.kind === 'expertise') ok = arr(c.value, 18).map(skillKey);   // a jártasság-feltételt lent nézzük
      c.ok = [...new Set(ok.map(x => isObj(x) ? JSON.stringify(x) : x))].slice(0, c.n).map(x => typeof x === 'string' && x[0] === '{' ? JSON.parse(x) : x);
      valid[c.key] = c;
    }

    // képességértékek: alap + növelések (ASI és feat legfeljebb 20-ig), utána a tárgyak minimuma
    const abil = {};
    for (const a of ABIL) abil[a] = {base: b.base[a], parts: [{v: b.base[a], src: 'alapérték'}], set: null};
    const saveSet = {}, skillSet = {}, expert = [], fxFlags = {jack: null, hpPerLevel: [], init: []};
    for (const {fx, src} of fxs) {
      if (isObj(fx.ab)) for (const a of ABIL) if (num(fx.ab[a])) abil[a].parts.push({v: num(fx.ab[a]), src});
      if (fx.abChoose) { const c = choices.find(x => x.src === src && x.kind === 'ability' && !x.used); if (c) { c.used = true; for (const a of c.ok) abil[a].parts.push({v: c.amt, src}); } }
      if (isObj(fx.abSet)) for (const a of ABIL) if (num(fx.abSet[a]) && num(fx.abSet[a]) > (abil[a].set?.v || 0)) abil[a].set = {v: num(fx.abSet[a]), src};
      for (const a of arr(fx.save, 6)) if (ABIL.includes(a) && !saveSet[a]) saveSet[a] = src;
      if (isObj(fx.skill)) for (const [k, p] of Object.entries(fx.skill)) { const kk = skillKey(k); if (SKILLS[kk] && !skillSet[kk]) skillSet[kk] = {p: p === 2 ? 2 : 1, src}; }
      if (fx.skillChoose) { const c = choices.find(x => x.src === src && x.kind === 'skills' && !x.used); if (c) { c.used = true; for (const k of c.ok) if (!skillSet[k]) skillSet[k] = {p: 1, src}; } }
      if (fx.expertise) { const c = choices.find(x => x.src === src && x.kind === 'expertise' && !x.used); if (c) { c.used = true; expert.push(c); } }
      if (fx.jack && !fxFlags.jack) fxFlags.jack = src;
      if (num(fx.hpPerLevel)) fxFlags.hpPerLevel.push({v: num(fx.hpPerLevel), src});
      if (num(fx.init)) fxFlags.init.push({v: num(fx.init), src});
    }
    // expertise csak jártas skillre (mindegyik után, hogy a sorrend ne számítson)
    for (const c of expert) {
      c.ok = c.ok.filter(k => skillSet[k]);
      for (const k of c.ok) skillSet[k] = {p: 2, src: skillSet[k].src + ' + expertise (' + c.src + ')'};
    }
    for (const c of choices) c.done = c.ok.length >= c.n || (c.kind === 'ability' && c.ok.length >= (Array.isArray(c.from) ? c.from : ABIL).length);

    const val = (key, v, parts) => (key in ov && ov[key] !== v ? {v: ov[key], calc: v, ov: true, parts} : {v, calc: v, ov: false, parts});
    const abilities = {}, mods = {};
    for (const a of ABIL) {
      const x = abil[a], sum = x.parts.reduce((t, p) => t + p.v, 0);
      let v = x.base > 20 ? sum : Math.min(20, sum);
      const parts = [...x.parts];
      if (v < sum) parts.push({v: v - sum, src: 'legfeljebb 20'});
      if (x.set && x.set.v > v) { parts.push({v: x.set.v - v, src: x.set.src + ` (legalább ${x.set.v})`}); v = x.set.v; }
      abilities[a] = val('ab:' + a, v, parts);
      mods[a] = mod(abilities[a].v);
    }
    const jack = !!fxFlags.jack;
    const saves = {};
    for (const a of ABIL) {
      const pc = saveSet[a] ? 1 : 0, p = 'save:' + a in ov ? ov['save:' + a] : pc;
      saves[a] = {prof: p, ov: p !== pc, v: mods[a] + p * PB,
        parts: [{v: mods[a], src: a.toUpperCase() + '-módosító'}, ...(p ? [{v: PB, src: 'jártasság' + (saveSet[a] ? ' – ' + saveSet[a] : ' (kézi)')}] : [])]};
    }
    const skills = {};
    for (const k of Object.keys(SKILLS)) {
      const a = SKILLS[k], pc = skillSet[k]?.p || (jack ? 0.5 : 0), p = 'skill:' + k in ov ? ov['skill:' + k] : pc;
      const pv = p === 0.5 ? Math.floor(PB / 2) : p * PB;
      skills[k] = {prof: p, ov: p !== pc, v: mods[a] + pv,
        parts: [{v: mods[a], src: a.toUpperCase() + '-módosító'}, ...(p ? [{v: pv, src: p === 2 ? 'expertise' : p === 1 ? 'jártasság' : 'Jack of All Trades'}] : []), ...(skillSet[k] && p === pc ? [{v: 0, src: skillSet[k].src}] : [])]};
    }
    // HP: az első szinten a hit die maximuma, utána a tárolt dobás vagy az átlag; + CON-módosító és szintenkénti bónuszok szintenként
    const hpParts = [];
    b.levels.forEach((l, i) => {
      const hd = classInfo(l.c, rb).hd;
      hpParts.push(i === 0 ? {v: hd, src: `${l.c} 1. szint (d${hd} maximum)`} : {v: l.hp ?? hd / 2 + 1, src: `${i + 1}. szint: ${l.c} ` + (l.hp == null ? `(d${hd} átlag)` : '(dobott / kézi)')});
    });
    if (b.levels.length) hpParts.push({v: mods.con * b.levels.length, src: `CON-módosító × ${b.levels.length}`});
    for (const x of fxFlags.hpPerLevel) hpParts.push({v: x.v * b.levels.length, src: `${x.src} (${x.v} × ${b.levels.length})`});
    const hpMax = val('hpMax', Math.max(1, hpParts.reduce((t, p) => t + p.v, 0)), hpParts);
    const initParts = [{v: mods.dex, src: 'DEX-módosító'}, ...(jack ? [{v: Math.floor(PB / 2), src: 'Jack of All Trades'}] : []), ...fxFlags.init];
    const init = val('init', initParts.reduce((t, p) => t + p.v, 0), initParts);
    const sl = slotsFor(classes);

    const todos = [
      ...choices.filter(c => !c.done).map(c => ({key: c.key, kind: c.kind, src: c.src, text: `${c.src}: ${FX_LABEL[c.kind] || c.kind}` + (c.n > 1 ? ` (${c.ok.length} / ${c.n})` : '')})),
      ...missing.map(m => ({key: 'missing:' + m, kind: 'missing', text: m + ' – nincs a szabálykönyvben'}))
    ];
    return {level: L, pb: PB, classes, abilities, mods, saves, skills, jack, hpMax, init, slots: sl.slots, pact: sl.pact,
      choices: choices.map(({used, ...c}) => c), todos, missing};
  }
  // ASI-érték: összesen +2 (egy képességre +2 vagy kettőre +1)
  function asiInc(v) {
    const inc = Object.fromEntries(ABIL.filter(a => num(v[a]) > 0).map(a => [a, Math.floor(num(v[a]))]));
    const sum = Object.values(inc).reduce((t, x) => t + x, 0);
    return sum > 0 && sum <= 2 ? inc : null;
  }
  // a számolt értékek kiírása a lap mezőibe (gyorsítótár: a DM Screen, a harc és a régi kód ezeket olvassa); csak a változott mezők
  function materialize(s, c) {
    const skillProf = Object.fromEntries(Object.entries(c.skills).filter(([, x]) => x.prof >= 1).map(([k, x]) => [k, x.prof]));
    const abilities = Object.fromEntries(ABIL.map(a => [a, c.abilities[a].v]));
    const jack = c.jack;
    const dflt = mod(abilities.dex) + (jack ? Math.floor(c.pb / 2) : 0);
    const max = c.hpMax.v, sc = s.spellcasting;
    const p = {
      classes: c.classes.length ? c.classes : s.classes, abilities, saveProf: ABIL.filter(a => c.saves[a].prof), skillProf, jack,
      initBonus: c.init.v === dflt ? null : c.init.v,
      hp: {...s.hp, max, cur: Math.min(s.hp.cur, max)},
      spellcasting: {...sc, slots: c.slots, used: sc.used.map((u, i) => Math.min(u, c.slots[i])), pact: {level: c.pact.level, max: c.pact.max, used: Math.min(sc.pact.used, c.pact.max)}}
    };
    const next = norm({...s, ...p}), out = {};
    for (const k of Object.keys(p)) if (JSON.stringify(next[k]) !== JSON.stringify(s[k])) out[k] = next[k];
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
    ASI_LEVELS, classInfo, buildClasses, calc, materialize, refName, skillKey,
    RB_FORMAT, RB_KINDS, emptyRulebook, joinChunks, splitChunks, loadRulebook, idb, variantFits, allItems, search, refOf, byRef, itemLine, spellLine};
})();

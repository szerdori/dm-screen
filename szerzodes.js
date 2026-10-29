// Szerződés: a DM Screen adatformátumai egy helyen (docs/dontesek/0006, SZERZODES.md).
// - UT: minden felhős útvonal; HELYI: a böngésző-tároló kulcsai; CSATORNA: a játékos képernyő csatornája
// - a bejövő adatok tisztítói: minden betöltött adat (import, felhő, böngésző-tároló, mentésfájl) ezeken megy át,
//   hogy egy rosszindulatú fájl se tudjon kódot becsempészni: a számok számok, a típusok csak megengedett értékek,
//   az azonosítók csak biztonságos karakterek, a portré csak kép-link lehet.
// A karakterlap formátuma a sheet.js-ben van (Sheet.norm); ez a fájl a sheet.js és a kozos.js után töltődik.
// Ha változik: a modul('szerzodes', N) számát és az oldalakon a szerzodes.js?v=N-t és a VART_MODULOK-ot is emeld.
'use strict';
window.Szerzodes = (() => {
  const {ABIL, SKILLS, EMAIL_RE, num, isObj, safeUrl} = Sheet;

  // ---------- útvonalak ----------
  const UT = {
    allapot: 'dmscreen/state',            // {enc, settings}
    konyvtar: 'dmscreen_library',         // lények (normCreature)
    mentett: 'dmscreen_saved',            // mentett encounterek
    mentesek: 'dmscreen/backups',         // a napi mentések tartalomjegyzéke
    mentes: id => 'dmscreen_backup/' + id,
    karakterek: 'characters',             // a karakterek nyilvános része (normPublicChar)
    karakter: id => 'characters/' + id,
    jatekosok: 'access/players',          // {emails}: a DM Screen írja
    dmek: 'access/dms',                   // {emails}: csak a konzolból írható
    lapok: 'sheets',                      // telefonos karakterlapok (Sheet.norm)
    lap: id => 'sheets/' + id,
    szabalyMeta: 'rules/meta',            // szabálykönyv (sheet.js: loadRulebook)
    szabalyDarab: id => 'rules/' + id,
  };
  const HELYI = {allapot: 'dmscreen', lapok: 'dmscreen-sheets'};
  const CSATORNA = 'dmscreen-player';

  // ---------- lények ----------
  const SECTIONS = ['traits','actions','bonusActions','reactions','legendary'];
  const TEMPLATE = {
    "_leiras": "DM Screen sablon. Töltsd ki, és importáld: Könyvtár → JSON / Sablon fül. kind: monster | npc | pc. A szekciókban (traits, actions, bonusActions, reactions, legendary) minden elem {name, text}. A szövegben lévő dobásokat (pl. 1d6+2, +5 to hit, Recharge 5–6) a program kattinthatóvá teszi. initBonus: null = DEX módosító. Több lényt is megadhatsz egy tömbben: [ {...}, {...} ].",
    "name": "Ködvadász", "kind": "monster", "size": "Medium", "type": "aberration", "alignment": "neutral evil", "cr": "3",
    "ac": 14, "acNote": "natural armor", "hp": {"max": 52, "formula": "8d8+16"}, "speed": "30 ft., climb 30 ft.",
    "abilities": {"str": 14, "dex": 16, "con": 14, "int": 8, "wis": 12, "cha": 6},
    "saves": {"dex": 5}, "skills": "Stealth +7, Perception +3", "senses": "darkvision 60 ft., passive Perception 13",
    "languages": "Deep Speech", "initBonus": null, "resist": "", "immune": "poison", "vuln": "", "condImmune": "poisoned",
    "traits": [{"name": "Ködben járás", "text": "Sűrű ködben a ködvadász láthatatlan."}],
    "actions": [
      {"name": "Multiattack", "text": "Két Karom támadás."},
      {"name": "Karom", "text": "Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 1d8+3 slashing damage."},
      {"name": "Ködlehelet (Recharge 5–6)", "text": "15 ft. cone, DC 12 Constitution saving throw. 3d6 poison damage on a failed save, half as much on a success."}
    ],
    "bonusActions": [], "reactions": [], "legendary": [], "legendaryCount": 0, "notes": ""
  };

  function blankCreature() {
    return {id: uid(), name: 'Új lény', kind: 'monster', source: 'saját', size: '', type: '', alignment: '', cr: '',
      ac: 10, acNote: '', hp: {max: 10, formula: ''}, speed: '30 ft.',
      abilities: {str:10,dex:10,con:10,int:10,wis:10,cha:10}, saves: {}, skills: '', senses: '', languages: '',
      initBonus: null, resist: '', immune: '', vuln: '', condImmune: '',
      traits: [], actions: [], bonusActions: [], reactions: [], legendary: [], legendaryCount: 0, notes: ''};
  }

  // ---------- tisztítók ----------
  const KINDS = ['monster', 'npc', 'pc'], SIDES = ['enemy', 'ally'], VIS = ['dm', 'party'];
  const str = v => v == null ? '' : typeof v === 'object' ? '' : String(v);
  const safeId = v => { const s = typeof v === 'number' ? String(v) : v; return typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : uid(); };
  function normInventory(list) {
    return (Array.isArray(list) ? list : []).slice(0, 1000).filter(isObj).map(i => ({
      name: str(i.name), qty: Math.max(0, Math.floor(num(i.qty, 1))), equipped: !!i.equipped, attuned: !!i.attuned,
      magic: !!i.magic, rarity: str(i.rarity), container: str(i.container), note: str(i.note), ref: str(i.ref)
    })).filter(i => i.name);
  }
  function normCreature(c) {
    c = isObj(c) ? c : {};
    const b = blankCreature();
    const o = {...b, ...c};
    delete o._leiras;
    for (const k of ['name', 'source', 'size', 'type', 'alignment', 'cr', 'acNote', 'speed', 'skills', 'senses', 'languages', 'resist', 'immune', 'vuln', 'condImmune', 'notes']) o[k] = str(o[k]);
    o.kind = KINDS.includes(o.kind) ? o.kind : 'monster';
    o.id = safeId(o.id);
    if (o.libId != null) o.libId = safeId(o.libId);
    if (o.ddbId != null) o.ddbId = num(o.ddbId, null);
    o.portrait = safeUrl(o.portrait);
    const ab = isObj(c.abilities) ? c.abilities : {};
    o.abilities = {}; ABIL.forEach(a => o.abilities[a] = num(ab[a], 10));
    const hp = isObj(c.hp) ? c.hp : c.hp != null ? {max: c.hp} : {};
    o.hp = {max: Math.max(1, num(hp.max, 10)), formula: str(hp.formula)};
    if (hp.cur != null) o.hp.cur = Math.max(0, num(hp.cur, o.hp.max));
    o.ac = num(o.ac, 10) || 10;
    o.legendaryCount = Math.max(0, Math.min(10, Math.floor(num(o.legendaryCount, 0))));
    const sv = isObj(c.saves) ? c.saves : {};
    o.saves = {}; ABIL.forEach(a => { const v = num(sv[a], null); if (v !== null) o.saves[a] = v; });
    for (const k of SECTIONS) o[k] = (Array.isArray(o[k]) ? o[k] : []).map(e => typeof e === 'string' ? splitEntry(e) : {name: str(e?.name), text: str(e?.text)});
    o.initBonus = num(o.initBonus, null);
    // harcon kívüli adatok (Csapat nézet)
    o.inventory = normInventory(c.inventory);
    const cur = isObj(c.currency) ? c.currency : {};
    o.currency = {}; ['pp', 'gp', 'ep', 'sp', 'cp'].forEach(k => o.currency[k] = Math.max(0, num(cur[k], 0)));
    const sm = isObj(c.skillMods) ? c.skillMods : null;
    if (sm) { o.skillMods = {}; for (const k of Object.keys(SKILLS)) if (isObj(sm[k])) o.skillMods[k] = {b: num(sm[k].b, 0), p: [0, 0.5, 1, 2].includes(sm[k].p) ? sm[k].p : 0}; }
    else delete o.skillMods;
    const pbo = isObj(c.passiveBonus) ? c.passiveBonus : {};
    o.passiveBonus = {perception: num(pbo.perception, 0), investigation: num(pbo.investigation, 0), insight: num(pbo.insight, 0)};
    o.tools = str(o.tools);
    o.importedAt = typeof c.importedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.importedAt) ? c.importedAt : '';
    // játékos app: kié a karakter (Google-fiók), ki láthatja, és NPC-nél mennyi látszik belőle
    const owner = str(c.owner).trim().toLowerCase();
    if (o.kind === 'pc' && EMAIL_RE.test(owner)) o.owner = owner; else delete o.owner;
    if (o.kind === 'monster') delete o.share;
    else {
      const sh = isObj(c.share) ? c.share : {}, npc = o.kind === 'npc';
      o.share = {vis: VIS.includes(sh.vis) ? sh.vis : npc ? 'dm' : 'party', hp: ['exact', 'label'].includes(sh.hp) ? sh.hp : npc ? 'label' : 'exact', ac: typeof sh.ac === 'boolean' ? sh.ac : !npc};
    }
    return o;
  }
  function normCombatant(x) {
    x = isObj(x) ? x : {};
    const c = normCreature(x.c);
    delete c.hp.cur;
    const o = {
      cid: safeId(x.cid), num: Math.max(0, Math.floor(num(x.num, 0))), c,
      hp: Math.max(0, num(x.hp, c.hp.max)), temp: Math.max(0, num(x.temp, 0)), init: num(x.init, null),
      cond: (Array.isArray(x.cond) ? x.cond : []).map(k => ({name: str(k?.name), rounds: k?.rounds == null ? null : Math.max(0, Math.floor(num(k.rounds, 0)))})),
      conc: !!x.conc, dead: !!x.dead, notes: str(x.notes), leg: Math.max(0, Math.floor(num(x.leg, 0))),
      group: x.group == null ? null : safeId(x.group), hiddenP: !!x.hiddenP, publicName: str(x.publicName)
    };
    if (SIDES.includes(x.side)) o.side = x.side;
    return o;
  }
  // alap = a hiányzó beállítások helyére kerülő értékek (a DM Screen a mostani beállításait adja; alapból az ALAP_BEALLITASOK)
  const ALAP_BEALLITASOK = Object.freeze({groupInit: true, rollHp: false, sources: Object.freeze(['MM','VGM','MTF','MPMM'])});
  function sanitizeState(d, alap = ALAP_BEALLITASOK) {
    d = isObj(d) ? d : {};
    const enc = isObj(d.enc) ? d.enc : {}, st = isObj(d.settings) ? d.settings : {};
    const list = (Array.isArray(enc.list) ? enc.list : []).map(normCombatant);
    return {
      library: (Array.isArray(d.library) ? d.library : []).map(normCreature),
      saved: (Array.isArray(d.saved) ? d.saved : []).map(e => ({id: safeId(e?.id), name: str(e?.name), list: (Array.isArray(e?.list) ? e.list : []).map(normCreature)})),
      enc: {list, round: Math.max(1, Math.floor(num(enc.round, 1))), active: list.some(x => x.cid === enc.active) ? enc.active : null},
      settings: {
        groupInit: typeof st.groupInit === 'boolean' ? st.groupInit : alap.groupInit,
        rollHp: typeof st.rollHp === 'boolean' ? st.rollHp : alap.rollHp,
        sources: Array.isArray(st.sources) ? st.sources.filter(s => typeof s === 'string' && /^[\w-]{1,30}$/.test(s)) : alap.sources,
        lastExport: typeof st.lastExport === 'string' && /^\d{4}-\d{2}-\d{2}/.test(st.lastExport) ? st.lastExport.slice(0, 10) : (alap.lastExport || ''),
        partyIds: Array.isArray(st.partyIds) ? [...new Set(st.partyIds.filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)))] : null
      }
    };
  }
  function splitEntry(s) {
    s = s.trim();
    const i = s.indexOf('. ');
    return i > 0 && i < 80 ? {name: s.slice(0, i), text: s.slice(i + 2)} : {name: '', text: s};
  }

  // ---------- a karakterek nyilvános része (characters/{id}) ----------
  // a DM Screen publicChars()-a írja, a karakter.html olvassa; a status a Sheet.hpStatus kódja
  const ALLAPOTOK = ['healthy', 'hurt', 'bloodied', 'down'];
  function normPublicChar(d) {
    const str = Sheet.str;  // a hosszkorlátos változat (a karakter.html eddig is ezt használta)
    d = isObj(d) ? d : {};
    const hp = isObj(d.hp) ? {max: Math.max(1, num(d.hp.max, 1)), cur: Math.max(0, num(d.hp.cur, 0))} : null;
    return {
      id: str(d.id), kind: d.kind === 'npc' ? 'npc' : 'pc', owner: str(d.owner).toLowerCase(), visibility: d.visibility === 'party' ? 'party' : 'dm',
      name: str(d.name) || '(névtelen)', portrait: safeUrl(d.portrait), level: str(d.level),
      ac: d.ac == null ? null : num(d.ac, null), hp, status: hp ? null : ALLAPOTOK.includes(d.status) ? d.status : null
    };
  }

  if (typeof modul === 'function') modul('szerzodes', 1);
  return {UT, HELYI, CSATORNA, SECTIONS, TEMPLATE, KINDS, SIDES, VIS, ALLAPOTOK, ALAP_BEALLITASOK, str, safeId, blankCreature, splitEntry,
    normInventory, normCreature, normCombatant, sanitizeState, normPublicChar};
})();

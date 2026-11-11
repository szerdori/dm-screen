// Telefonos karakterlapok szinkronja (logika, DOM nélkül): lap ↔ könyvtári lény és harcbeli példány, shadow-összevetéssel (SZERZODES.md).
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('lapszinkron', N) és az index.html-ben a lapszinkron.js?v=N és a VART_MODULOK.
'use strict';
modul('lapszinkron', 14);

// ---------- telefonos karakterlapok (sheets/{könyvtár-id}, formátum: sheet.js) ----------
// A lap a játékosé: a telefonján írja, a DM Screen élőben figyeli, és a könyvtári lényt + a harcban lévő példányát frissíti belőle.
// Fordítva: amit a DM itt átír (HP a harcban; név, AC, HP, képességek, felszerelés, pénz, gazda a szerkesztőben), az mezőnként
// visszaíródik a lapra. Hogy melyik oldal változott, azt a „shadow” dönti el: a legutóbb egyeztetett értékek másolata.
let SHEETS = {}, shadow = {}, cshadow = {}, sheetOps = {set: new Set(), del: new Set()}, sheetUnsub = null, sheetsWarn = '';
const LINK = {name: 'name', portrait: 'portrait', owner: 'owner', ac: 'ac', hpMax: 'hp.max', hpCur: 'hp.cur', speed: 'speed', abilities: 'abilities', inventory: 'inventory', currency: 'currency'};
const linkFields = c => ({name: c.name, portrait: c.portrait || '', owner: c.kind === 'pc' ? c.owner || '' : '', ac: c.ac, hpMax: c.hp.max, hpCur: c.hp.cur ?? c.hp.max,
  speed: c.speed, abilities: c.abilities, inventory: Sheet.normInventory(c.inventory), currency: c.currency});
// a harcbeli példány lappal egyeztetett része: HP, temp, koncentráció, állapotok (az „Exhaustion” a lapon szint, az nem megy át)
const syncedConds = list => list.map(k => k.name ?? k).filter(n => n && n !== 'Exhaustion');
const hpShadow = x => JSON.stringify([x.hp, x.temp, !!x.conc, syncedConds(x.cond)]);
// a lap állapotai a harcbeli példányra; a DM által megadott körszám név szerint megmarad, a csak harcbeli „Exhaustion” is
const condsFromSheet = (s, old = []) => [...s.conditions.map(n => ({name: n, rounds: old.find(k => k.name.toLowerCase() === n.toLowerCase())?.rounds ?? null})),
  ...old.filter(k => k.name === 'Exhaustion')];
// a lap sebzése („1d8+3 slashing”) a statblokk szokása szerint „… slashing damage” lesz: így a DM Screen ismeri a típust (flavour text, leiras.js)
const SEBZES_SZO_RE = new RegExp(`\\b(${Sheet.DMG_TYPES.join('|')})\\b(?!\\s+damage)`, 'gi');
function sheetToCreature(s, base) {
  const H = Sheet;
  // szabálymotoros lapnál a mentők és a skillek a cache-ből (abban már benne van pl. az Aura of Protection, a Remarkable Athlete);
  // a nem jártas mentő is kiíródik, ha eltér a sima módosítótól
  const cache = s.auto ? s.cache : null;
  const saves = {}; ABIL.forEach(a => {
    const v = cache?.saves?.[a] ?? H.saveBonus(s, a);
    if (s.saveProf.includes(a) || (cache?.saves?.[a] != null && v !== mod(s.abilities[a]))) saves[a] = v;
  });
  const skillMods = {}; for (const k of Object.keys(SKILLS)) skillMods[k] = {b: cache?.skills?.[k] ?? H.skillBonus(s, k), p: H.skillProfOf(s, k)};
  const actions = s.attacks.map(a => {
    const hit = a.hit.trim() ? sgn(parseInt(a.hit.replace('−', '-')) || 0) : '';
    return {name: a.name, text: [hit ? `Attack: ${hit} to hit.` : '', a.dmg ? `Hit: ${a.dmg.replace(SEBZES_SZO_RE, '$1 damage')}.` : '', a.note].filter(Boolean).join(' ')};
  });
  const traits = s.features.map(f => ({name: f.name, text: f.text.slice(0, 600)}));
  if (s.resources.length) traits.unshift({name: 'Erőforrások', text: s.resources.map(r => `${r.name}: ${r.max - r.used}/${r.max}`).join(', ')});
  // támadás akciónként (Extra Attack, a lap cache-éből): a statblokk Multiattackja helyett egy jellemző
  if (H.attacksPerAction(s) > 1) traits.unshift({name: 'Támadás akciónként', text: `${H.attacksPerAction(s)} (Extra Attack, az Attack action része)`});
  if (s.spells.length) {
    // multiclassnál osztályonként (TERV-multiclass.md): „Wizard: spell save DC 14, +6 to hit; Cleric: …”
    const casts = H.spellCasts(s), by = {};
    s.spells.forEach(sp => (by[sp.level] = by[sp.level] || []).push(sp.name + (sp.level && !sp.prepared && !sp.always ? ' (nincs bekészítve)' : '')));
    traits.unshift({name: 'Varázslatok', text: [casts.map(c => `${casts.length > 1 ? c.cls + ': ' : ''}spell save DC ${c.dc}, ${sgn(c.atk)} to hit`).join('; '),
      ...Object.keys(by).sort((a, b) => a - b).map(l => `${l == 0 ? 'Cantrips' : ordinal(+l) + ' level'}: ${by[l].join(', ')}`)].filter(Boolean).join('\n')});
  }
  // az AC és a speed az aktív hatásokkal (Mage Armor, Haste, Grappled…) együtt; a hatások a lap állapotai között vannak
  const fx = H.effects(s);
  // a típus a könyvtári lényé marad: NPC-vé tett játékosnál a lap változása se állítsa vissza Játékosra
  return normCreature({...base, kind: base?.kind === 'npc' ? 'npc' : 'pc', name: s.name, portrait: s.portrait, cr: 'Szint ' + H.level(s),
    type: [s.race, H.classLabel(s)].filter(Boolean).join(' — '), alignment: s.alignment, ac: fx.ac,
    acNote: [s.acNote, fx.acParts.length ? '+ ' + fx.acParts.join(', ') : ''].filter(Boolean).join(' '),
    hp: {max: s.hp.max, cur: s.hp.cur, formula: ''}, speed: fx.speed, abilities: s.abilities, saves, skillMods,
    skills: Object.keys(SKILLS).filter(k => s.skillProf[k]).map(k => skillLabel(k) + ' ' + sgn(skillMods[k].b)).join(', '),
    senses: [s.senses, `passive Perception ${H.passive(s, 'perception')}`].filter(Boolean).join(', '),
    languages: s.profs.languages, tools: s.profs.tools, resist: [s.resist, fx.resist].filter(Boolean).join(', '), initBonus: H.initiative(s),
    traits, actions, bonusActions: [], reactions: [], inventory: s.inventory, currency: s.currency,
    passiveBonus: {perception: 0, investigation: 0, insight: 0}, source: 'Karakterlap'});
}
// a lapról a könyvtárba és a harcban lévő példány(ok)ba; a gazdát mindig a DM állítja, az nem jön a lapról
function applySheet(id) {
  const s = SHEETS[id], i = S.library.findIndex(c => c.id === id);
  if (!s || i < 0) return;
  const lib = sheetToCreature(s, S.library[i]);
  if (s.deleted) { lib.owner = ''; lib.share = {...lib.share, vis: 'dm'}; }  // a játékos törölte: a nyilvános rész is lekerül
  else if (!lib.owner && s.owner) lib.owner = s.owner;  // a visszahozás után a könyvtár mentése elmaradt (bezárt lap, hiba, másik DM Screen)
  S.library[i] = lib; shadow[id] = stableJson(linkFields(lib));
  for (const x of S.enc.list) if (x.c.libId === id) {
    const c = sheetToCreature(s, x.c); delete c.hp.cur; x.c = c;
    x.hp = s.hp.cur; x.temp = s.hp.temp; x.conc = !!s.concentration; x.cond = condsFromSheet(s, x.cond); cshadow[x.cid] = hpShadow(x);
  }
}
const setPath = (o, path, v) => { const ks = path.split('.'); ks.slice(0, -1).reduce((a, k) => a[k] = a[k] || {}, o)[ks.at(-1)] = v; };
// a DM oldali változások visszaírása a lapokra (doSave hívja; internet nélkül is lefut, ilyenkor csak helyben)
function syncSheets(ops) {
  // a böngésző gyorsítótárából régi közös fájl (sheet.js, kozos.js) jött: a lapokra nem írunk, amíg az oldal nem frissül (a könyvtári változás megmarad)
  if (regiFajl()) { if (!syncSheets.warned) Ertesito.naplo('⚠ Az oldal egy része régi változatból töltődött be: frissítsd (Ctrl + F5), addig a karakterlapokra nem írok.'); syncSheets.warned = true; return; }
  const now = new Date().toISOString(), by = authInfo.email || 'DM';
  for (const id of sheetOps.del) { delete SHEETS[id]; delete shadow[id]; if (Tar.kapcsolva()) ops.push(Tar.lapok.torol(id), elozmenyTakarit(id, 0)); }
  sheetOps.del.clear();
  for (const c of S.library) {
    const s = SHEETS[c.id]; if (!s) continue;
    // NPC-vé tett játékos: a lapja gazda nélküli, így a játékos nem látja és nem szerkeszti; a gazda e-mailje a könyvtárban marad,
    // Játékosra visszaállítva a lap visszakapja. A név, AC, HP, képességek, tárgyak szinkronja közben is megy (nincs mit szétválni), a harcbeli HP nem.
    const jatekos = c.kind === 'pc';
    if (!jatekos && !c.owner && s.owner && !s.deleted) c.owner = s.owner;  // a régebben NPC-vé tett: az e-mail csak a lapon maradt meg
    if (s.deleted) { c.owner = ''; c.share = {...c.share, vis: 'dm'}; }  // törölt karakter gazdát csak a visszahozással kap
    const patch = {}, gazda = jatekos ? c.owner || '' : '';
    // a lap gazdája mindig a könyvtárból jön (NPC-nél üres; NPC-ből visszaállítva, vagy ha egy korábbi írás elmaradt, helyreáll)
    if (!s.deleted && (s.owner || '') !== gazda) patch.owner = gazda;
    if (jatekos) for (const x of S.enc.list) if (x.c.libId === c.id) {
      // most került harcba: a lap értékeihez mérjük (a hozzáadáskor onnan kapta a HP-t)
      const prev = cshadow[x.cid] ?? JSON.stringify([s.hp.cur, s.hp.temp, !!s.concentration, syncedConds(s.conditions)]);
      const [ph, pt, pc, pk] = JSON.parse(prev);
      if (ph !== x.hp || pt !== x.temp) { patch['hp.cur'] = Math.min(x.hp, s.hp.max); patch['hp.temp'] = x.temp; c.hp.cur = patch['hp.cur']; }
      // a DM a harcban tett fel / vett le állapotot (vagy lejárt a körszáma): a lapra is, ott a hatása is érvényesül
      let conds = JSON.stringify(pk) !== JSON.stringify(syncedConds(x.cond)) ? syncedConds(x.cond) : s.conditions;
      // a DM a harcban kapcsolta a koncentrációt: ki → a lapon is vége (a koncentrációs hatás is lekerül); be → jelölés név nélkül
      if (pc !== !!x.conc) {
        patch.concentration = x.conc ? s.concentration || 'Koncentráció' : '';
        if (!x.conc && s.concentration) conds = Sheet.dropConc(conds, s.concentration);
      }
      if (JSON.stringify(conds) !== JSON.stringify(s.conditions)) patch.conditions = conds;
      if (!x.conc && s.concentration) x.cond = x.cond.filter(k => k.name === 'Exhaustion' || conds.some(n => n.toLowerCase() === k.name.toLowerCase()));
      cshadow[x.cid] = hpShadow(x);
    }
    const cur = linkFields(c), prev = shadow[c.id] ? JSON.parse(shadow[c.id]) : null;
    if (prev) for (const k of Object.keys(LINK)) if (stableJson(cur[k]) !== stableJson(prev[k])) patch[LINK[k]] = cur[k];
    shadow[c.id] = stableJson(cur);
    if (!Object.keys(patch).length) continue;
    // a könyvtárban a hatásokkal együtti AC látszik (pl. Shield of Faith +2): a lapra az alapérték megy
    if ('ac' in patch) patch.ac = Math.max(0, patch.ac - Sheet.effects(s).acAdd);
    // szabálymotoros lapnál az AC, max HP, speed, képesség átírása felülírásként (ov) is megy, különben a telefon következő
    // újraszámolása eltüntetné; képességnél a mentők / skillek gyorsítótára törlődik, amíg a telefon újra nem számol
    if (s.auto) {
      const nx = structuredClone(s);
      Object.entries(patch).forEach(([p, v]) => setPath(nx, p, structuredClone(v)));
      const ov = Sheet.ovEdits(s, Sheet.norm(nx));
      for (const [k, v] of Object.entries(ov)) if (['ac', 'hpMax', 'speed'].includes(k) || k.startsWith('ab:')) patch['ov.' + k] = v;
      if (Object.keys(ov).some(k => k.startsWith('ab:'))) patch.cache = null;
    }
    Object.entries(patch).forEach(([p, v]) => setPath(s, p, structuredClone(v)));
    SHEETS[c.id] = Sheet.norm({...s, updatedAt: now, updatedBy: by});
    if (Tar.kapcsolva() && !sheetOps.set.has(c.id)) ops.push(Tar.lapok.mezok(c.id, {...JSON.parse(JSON.stringify(patch)), updatedAt: now, updatedBy: by}));
  }
  for (const id of sheetOps.set) if (SHEETS[id] && Tar.kapcsolva()) ops.push(Tar.lapok.ir(id, JSON.parse(JSON.stringify({...SHEETS[id], updatedAt: now, updatedBy: by}))));
  if (Tar.kapcsolva()) sheetOps.set.clear();
  try { localStorage.setItem(HELYI.lapok, JSON.stringify(SHEETS)); } catch {}
}
// élő figyelés: a teljes sheets gyűjtemény minden változáskor
function onSheets(docs) {
  if (saveTimer) { clearTimeout(saveTimer); doSave(); }  // a függő helyi változás előbb kimegy
  let changed = false;
  const ids = new Set();
  for (const d of docs) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(d.id)) continue;
    ids.add(d.id);
    const s = Sheet.norm(d);
    if (SHEETS[d.id] && stableJson(SHEETS[d.id]) === stableJson(s)) continue;
    const regi = SHEETS[d.id];
    SHEETS[d.id] = s; applySheet(d.id); changed = true;
    if (regi) mcFigyel(regi, s);
  }
  for (const id of Object.keys(SHEETS)) if (!ids.has(id) && !sheetOps.set.has(id)) { delete SHEETS[id]; delete shadow[id]; changed = true; }
  jatekosDobasok();  // előbb: a kérésre jött Initiative a harcba kerül, és a rajzolás már ezzel megy
  if (changed) { save(); Ertesito.lapokValtoztak(); }
}
// multiclass nem teljesült PHB-feltétellel (TERV-multiclass.md, a felhasználó döntése: csak figyelmeztet, a DM jelzést kap): ha a lapon új osztály jelenik meg,
// a szintlépés előtti lap szerint ellenőrizzük. Egyszer szól: a következő változásnál a régi lapon már ott az osztály (a helyi másolat újratöltés után is).
// A feltételhez a felhős szabálykönyv kell; nélküle (vagy belépés nélkül) nincs sor.
function mcFigyel(regi, s) {
  // készülő karakter (kezdő varázsló: az osztály még cserélhető) és osztálycsere (a régi osztály eltűnt) nem multiclass
  if (s.deleted || s.newChar || regi.newChar || !regi.classes.some(c => c.name)) return;
  if (!regi.classes.every(c => !c.name || s.classes.some(x => x.name === c.name))) return;
  const ujak = s.classes.map(c => c.name).filter(n => n && !regi.classes.some(c => c.name === n));
  if (!ujak.length) return;
  return felhoSzabalyok().then(rb => {
    if (!rb) return;
    for (const n of ujak) {
      const m = Sheet.mcCheck(regi, rb, n);
      if (!m.ok) Ertesito.naplo(`⚠ <b>${esc(s.name)}</b>: ${esc(n)} multiclass – ${esc(m.hiany.join('; '))} (PHB 163. o.; a feltétel csak figyelmeztet)`, 'warn');
    }
  }).catch(e => console.error('multiclass-ellenőrzés:', e));
}
// a játékosok telefonon dobott dobásai (a lap `rolls` mezője) a DM naplójába, a karakter nevével:
// az első figyelés után az összes lapról együtt a legutóbbi Sheet.ROLLS_MAX, utána csak az újak – a dobást a tartalma azonosítja, nem az időhatár
// (így egy késő órájú második eszköz, pl. a DM a karakter.html-ben, vagy egy jövőbeli időbélyeg sem nyel el dobást)
let latottDobas = {};  // lap-id → a lapon legutóbb látott dobások kulcsai (Set)
let dobasokElso = true;
const dobasKulcs = r => [r.at, r.label, r.total, r.detail].join('|');
function jatekosDobasok() {
  const uj = [];
  for (const [id, s] of Object.entries(SHEETS)) {
    const latott = latottDobas[id] || new Set(), rolls = (s.rolls || []).filter(r => !latott.has(dobasKulcs(r)));
    latottDobas[id] = new Set((s.rolls || []).map(dobasKulcs));
    if (!s.deleted) uj.push(...rolls.map(r => ({...r, who: s.name, lap: id})));
  }
  uj.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  const lista = dobasokElso ? uj.slice(-Sheet.ROLLS_MAX) : uj;
  dobasokElso = false;
  // kérésre jött dobás (req): a dobaskeres.js dönti el, mi lesz vele (Initiative a harcba, DC-nél ✔ / ✖)
  // a flavour text a sor végére (a 🔄 a sor végéig cseréli)
  for (const r of lista) Ertesito.naplo(dobasSor(r) + (r.req ? esc(keresValasz(r.lap, r)) : '') + dobasLeiras(r), r.nat === 20 ? 'crit' : r.nat === 1 ? 'fumble' : '');
}
// óra:perc; ha nem mai, elé a dátum is (a betöltéskor megjelenő régebbi dobásokhoz)
const dobasIdo = at => {
  const d = new Date(at); if (isNaN(d)) return '';
  const ido = d.toLocaleTimeString('hu-HU', {hour: '2-digit', minute: '2-digit'});
  return d.toDateString() === new Date().toDateString() ? ido : d.toLocaleDateString('hu-HU', {month: '2-digit', day: '2-digit'}) + ' ' + ido;
};
const dobasSor = r => `<span class="who">📱 ${esc(r.who || 'Névtelen')}</span> ${esc(r.label)}: <b>${esc(r.total)}</b> <small>${esc(r.detail)}${r.nat === 20 ? ' — KRITIKUS!' : r.nat === 1 ? ' — elvétve' : ''} · ${esc(dobasIdo(r.at))}</small>`;
// telefonos sebzésdobás (dt / dk, TERV-flavour.md): flavour text; a krit a címke vége. A kifejezés a részletek eleje („1d8+3: [5] +3”)
// és a lap hozzáadott hatásai („… +2 Rage +1d6 Hunter's Mark [4]”: előjeles érték, utána a forrás neve), hogy a súlyosság a teljes összeghez mérődjön
const HATAS_RE = /\s([+-]\d*(?:d\d+)?)\s+(?=[A-Za-zÀ-ű])/g;
const dobasKifejezes = detail => { const [eleje, ...resz] = String(detail).split(':'); return eleje + [...resz.join(':').matchAll(HATAS_RE)].map(m => m[1]).join(''); };
const dobasLeiras = r => r.dt || r.dk ? leirasHtml({type: r.dt, kind: r.dk, expr: dobasKifejezes(r.detail), total: r.total, crit: /\(krit\)$/.test(r.label)}) : '';
const lapKeszul = new Set();  // dupla kattintás ellen: amíg a szabálykönyv töltődik
// új lap a könyvtári lényből (📱): ha a szabálykönyv ismeri az osztályait, rögtön szabálymotoros (mint a telefonos Átállítás), különben kézi.
// Visszatér: true = átállítva, false = kézi lap (a szabálykönyv nem ismeri az osztályait, vagy nincs feltöltve), 'hiba' = kézi lap, mert az átállítás hibát dobott, null = nem készült (már van lapja, vagy épp készül)
async function lapKonyvtarbol(lib) {
  if (SHEETS[lib.id] || lapKeszul.has(lib.id)) return null;
  lapKeszul.add(lib.id);
  const kezi = creatureToSheet(lib);
  let auto = null, hiba = false;
  if (!rulebook?.version && Tar.kapcsolva()) Ertesito.naplo(`📖 ${esc(lib.name)}: a szabálykönyv betöltése a lap átállításához…`);
  try { auto = Sheet.autoLap(kezi, await felhoSzabalyok()); } catch (e) { console.error(e); hiba = true; }
  finally { lapKeszul.delete(lib.id); }
  if (SHEETS[lib.id] || !S.library.some(c => c.id === lib.id)) return null;  // közben máshonnan létrejött, vagy a lényt törölték
  createSheet(lib.id, auto || kezi);
  // mint a telefonos Átállításnál: a kézi változat backupként (Előzmények), a DM vissza tudja állítani
  if (auto && Tar.kapcsolva()) {
    const at = new Date().toISOString(), L = Sheet.level(kezi);
    const h = Sheet.normHist({at, by: authInfo.email || 'DM', reason: 'manual', from: L, to: L, sheet: {...kezi, owner: SHEETS[lib.id].owner}});
    Tar.lapok.elozmenyIr(lib.id, at.replace(/[:.]/g, '-'), JSON.parse(JSON.stringify(h))).catch(e => Ertesito.naplo(`⚠ ${esc(lib.name)}: a kézi lap mentése (backup) nem sikerült (${esc(e.code || e.message)}).`, 'warn'));
  }
  return auto ? true : hiba ? 'hiba' : false;
}
function createSheet(id, s) {
  const lib = S.library.find(c => c.id === id);
  SHEETS[id] = Sheet.norm({...s, owner: lib?.owner || s.owner, deleted: null, rolls: SHEETS[id]?.rolls || [], rollReq: SHEETS[id]?.rollReq ?? null, rollSkip: SHEETS[id]?.rollSkip || ''});  // importált lap dobásai és dobáskérése nem kerülnek át
  sheetOps.set.add(id); sheetOps.del.delete(id);
  applySheet(id); save();
}
// ---------- szintlépés-engedély: a DM ad (egy nyomás = +1 szint), a játékos telefonján a varázsló indul; a DM addig vonhatja vissza, amíg a játékos nem mentett ----------
const ELOZMENY_MAX = Sheet.HIST_MAX;
// az előzményekből a legfrissebb `marad` darab marad (a játékos nem törölhet; az azonosító időbélyeg, ezért a sorrend ábécérend). A Firestore az alkollekciót nem törli a lappal együtt.
async function elozmenyTakarit(id, marad = ELOZMENY_MAX) {
  if (!Number.isInteger(marad)) return;  // régi sheet.js mellett nincs korlát: inkább ne töröljünk (a slice különben mindent törölne)
  try {
    const lista = (await Tar.lapok.elozmenyek(id)).map(h => h.id).sort().reverse();
    await Promise.all(lista.slice(marad).map(h => Tar.lapok.elozmenyTorol(id, h)));
  } catch (e) { console.warn('az előzmények takarítása nem sikerült:', e.code || e.message); }
}
// induláskor minden lapnál: a telefon nem törölhet, csak a legfrissebbeket mutatja, a régieket innen takarítjuk
function elozmenyekTakarit() { if (!regiFajl()) Object.keys(SHEETS).forEach(id => elozmenyTakarit(id)); }
function engedelyIr(id, levelUp) {
  const now = new Date().toISOString(), by = authInfo.email || 'DM';
  SHEETS[id] = Sheet.norm({...SHEETS[id], levelUp});
  if (!Tar.kapcsolva()) return;
  Tar.lapok.mezok(id, {levelUp, updatedAt: now, updatedBy: by}).catch(e => Ertesito.naplo(`⚠ A szintlépés-engedély mentése nem sikerült (${esc(e.code || e.message)}).`, 'warn'));
}
// át van-e állítva a lap: nincs lap, kézi, motoros, vagy motoros, de a felépítés kevesebb szintet tud, mint a lap (ott a szintlépés nem indul)
function lapAllapot(id) {
  const s = SHEETS[id];
  return !s ? 'nincs' : s.deleted ? 'torolt' : s.newChar ? 'keszul' : !s.auto ? 'kezi' : s.build.levels.length === Sheet.level(s) ? 'motoros' : 'elter';
}
// új játékos: üres, motoros lap; a gazdája a telefonján a varázslóval állítja be (a gazda később is megadható)
function ujJatekos({name = '', owner = '', vis = 'party', target = 1, methods, equip = 'any'} = {}) {
  const at = new Date().toISOString(), by = authInfo.email || 'DM';
  const lib = normCreature({id: uid(), kind: 'pc', name: name.trim() || 'Új karakter', owner, share: {vis, hp: 'label', ac: false}, source: 'Karakterlap'});
  S.library.push(lib);
  createSheet(lib.id, Sheet.ncBlank({name: lib.name, owner: lib.owner, target, methods, equip, by, at}));
  return lib;
}
// ---------- törlés: a játékos a telefonon törli (Sheet.torlesPatch), a lény itt marad; a DM visszahozhatja, vagy a Könyvtárban véglegesen törölheti ----------
const lapTorolt = id => !!SHEETS[id]?.deleted;
function lapVisszahoz(id) {
  const s = SHEETS[id], lib = S.library.find(c => c.id === id);
  if (!s?.deleted || !lib || regiFajl()) return false;
  const {owner, vis} = s.deleted, updatedAt = new Date().toISOString(), updatedBy = authInfo.email || 'DM';
  // NPC-nél az e-mail a könyvtárba kerül, a lap gazda nélküli marad (a játékos csak Játékosra visszaállítva látja)
  const lapGazda = lib.kind === 'pc' ? owner : '';
  SHEETS[id] = Sheet.norm({...s, owner: lapGazda, deleted: null, updatedAt, updatedBy});
  lib.owner = owner; lib.share = {...lib.share, vis};
  shadow[id] = stableJson(linkFields(lib));
  if (Tar.kapcsolva()) Tar.lapok.mezok(id, {owner: lapGazda, deleted: null, updatedAt, updatedBy}).catch(e => Ertesito.naplo(`⚠ A visszahozás mentése nem sikerült (${esc(e.code || e.message)}).`, 'warn'));
  save();
  return true;
}
// a lap állása: {szint, to}; to = null, ha nincs engedély (törölt karakternek sincs)
const szintlepesAllas = id => { const s = SHEETS[id]; return s && !s.deleted && !s.newChar ? {szint: Sheet.level(s), to: s.levelUp && s.levelUp.to > Sheet.level(s) ? s.levelUp.to : null} : null; };
function szintlepesAd(id) {
  const a = szintlepesAllas(id);
  if (!a || regiFajl() || (a.to || a.szint) >= 20) return false;
  engedelyIr(id, {to: (a.to || a.szint) + 1, by: authInfo.email || 'DM', at: new Date().toISOString(), mc: false});
  if (Tar.kapcsolva()) elozmenyTakarit(id);
  return true;
}
function szintlepesVissza(id) {
  const a = szintlepesAllas(id);
  if (!a?.to || regiFajl()) return false;
  engedelyIr(id, a.to - 1 > a.szint ? {...SHEETS[id].levelUp, to: a.to - 1} : null);
  return true;
}
// mentésfájlból / felhős mentésből: a lapok is visszaállnak (ami a mentésben nincs, az törlődik)
function restoreSheets(list) {
  if (!Array.isArray(list)) return;
  const next = {};
  // a dobások és a dobáskérés a mostaniak maradnak: a mentésből a régiek nem írják felül (és egy megválaszolt kérés sem ugrik fel újra)
  for (const d of list) if (isObj(d) && /^[A-Za-z0-9_-]{1,64}$/.test(d.id) && S.library.some(c => c.id === d.id)) next[d.id] = Sheet.norm({...d, rolls: SHEETS[d.id]?.rolls || [], rollReq: SHEETS[d.id]?.rollReq ?? null, rollSkip: SHEETS[d.id]?.rollSkip || ''});
  Object.keys(SHEETS).forEach(id => { if (!next[id]) sheetOps.del.add(id); });
  SHEETS = next; shadow = {}; cshadow = {};
  Object.keys(next).forEach(id => { sheetOps.set.add(id); applySheet(id); });
}
const sheetList = () => Object.entries(SHEETS).map(([id, s]) => ({...s, id}));
// meglévő (pl. D&D Beyondból importált) játékosból karakterlap: amit a könyvtári adatokból ki lehet olvasni
// a játékos osztályai a típus-sorból („Elf — Rogue 3 (Thief) / Fighter 2”)
function lenyOsztalyok(c) {
  const cls = c.type.includes(' — ') ? c.type.split(' — ')[1] : c.type;
  const classes = [...String(cls).matchAll(/([A-Za-z][A-Za-z' ]*?)\s+(\d{1,2})(?:\s*\(([^)]*)\))?/g)]
    .map(m => ({name: m[1].trim(), level: +m[2], subclass: m[3] || ''})).filter(x => Sheet.findClass(x.name));
  if (!classes.length) classes.push({name: '', level: pcLevel(c) || 1});
  return classes;
}
// a D&D Beyondból régebben importált szöveg sablonjai ({{scalevalue}}, {{savedc:wis}} …) a játékos adataiból
const lenySablon = (c, e) => c.kind === 'pc' ? Sheet.ddbSablonLap(e.text, e.name, {classes: lenyOsztalyok(c), abilities: c.abilities}) : e.text;
function creatureToSheet(c) {
  const race = c.type.includes(' — ') ? c.type.split(' — ')[0] : '';
  const classes = lenyOsztalyok(c);
  const skillProf = {}; let jack = false;
  for (const [k, v] of Object.entries(c.skillMods || {})) { if (v.p >= 1) skillProf[k] = v.p; if (v.p === 0.5) jack = true; }
  // kézzel felvitt játékosnál a „Skills” szövegből (pl. „Stealth +7”): a bónusz és a képességmódosító különbsége adja a jártasságot
  const pb = Math.floor(((pcLevel(c) || classes.reduce((t, x) => t + x.level, 0) || 1) - 1) / 4) + 2;
  for (const m of c.skills.matchAll(/([A-Za-z][A-Za-z ]*?)\s*([+\-−]\s*\d+)/g)) {
    const k = Object.keys(SKILLS).find(s => skillLabel(s).toLowerCase() === m[1].trim().toLowerCase());
    if (!k || skillProf[k]) continue;
    const d = parseInt(m[2].replace(/[−\s]/g, x => x === '−' ? '-' : '')) - mod(c.abilities[SKILLS[k]]);
    if (d >= 2 * pb) skillProf[k] = 2; else if (d >= pb) skillProf[k] = 1;
  }
  const attacks = [], features = [], spells = [];
  let ability = '';
  for (const k of SECTIONS) for (const e of c[k]) {
    const hit = e.text.match(/([+\-]\d+) to hit/)?.[1];
    if (k === 'actions' && hit) {
      const dm = e.text.match(/Hit:\s*(?:\d+\s*\()?\s*(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s*\)?\s*([a-z]+)?/i);
      attacks.push({name: e.name, hit, dmg: dm ? dm[1].replace(/\s/g, '') + (dm[2] ? ' ' + dm[2] : '') : ''});
    } else if (e.name === 'Varázslatok') {
      for (const line of e.text.split('\n')) {
        const cl = line.match(/^(\w+):\s*spell save DC/); if (cl && !ability) ability = Sheet.CLASSES[Sheet.findClass(cl[1])]?.ab || '';
        const lv = line.match(/^(Cantrips|(\d)\w*\s+level):\s*(.+)$/);
        if (lv) lv[3].split(/,\s*/).forEach(n => spells.push({name: n.trim(), level: lv[2] ? +lv[2] : 0, prepared: true}));
      }
    } else features.push({name: e.name || SECTION_HU[k], text: e.text});
  }
  const sl = Sheet.slotsFor(classes);
  return Sheet.norm({name: c.name, portrait: c.portrait, owner: c.owner, race: race.trim(), alignment: c.alignment, classes,
    abilities: c.abilities, saveProf: ABIL.filter(a => c.saves[a] != null && c.saves[a] > mod(c.abilities[a])), skillProf, jack,
    ac: c.ac, acNote: c.acNote, speed: c.speed, hp: {max: c.hp.max, cur: c.hp.cur ?? c.hp.max, temp: 0},
    spellcasting: {ability, slots: sl.slots, pact: sl.pact}, spells, attacks, features,
    inventory: c.inventory, currency: c.currency, profs: {tools: c.tools, languages: c.languages},
    senses: c.senses.replace(/,?\s*passive Perception \d+/i, '').trim(), resist: c.resist});
}
// JSON-import: Claude által megírt vagy letöltött karakterlap. Azonos nevű játékosnál a felület kérdez rá, hogy annak a lapját cserélje-e.
const lapNevtars = s => S.library.find(c => c.kind === 'pc' && c.name.trim().toLowerCase() === s.name.toLowerCase());
// s: Sheet.norm-on átment lap; lib: a játékos, akinek a lapját cseréli (ha nincs, új játékos jön létre)
function importSheet(s, lib) {
  if (!lib) { lib = normCreature({id: uid(), kind: 'pc', name: s.name, owner: s.owner}); S.library.push(lib); }
  else if (lapTorolt(lib.id)) lapVisszahoz(lib.id);  // törölt karakterre importálás: a DM tudatosan hozza vissza, a régi gazda és láthatóság is visszajön
  else if (!lib.owner && s.owner) Object.assign(lib, normCreature({...lib, owner: s.owner}));
  createSheet(lib.id, s);
  return S.library.find(c => c.id === lib.id);
}

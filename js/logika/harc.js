// Harc (logika, DOM nélkül): kockadobás, initiative-sorrend, encounter, körök, sebzés és gyógyítás, mentett encounter (a lények HP-val és initiative-val, a játékosok hivatkozásként: pcs).
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('harc', N) és az index.html-ben a harc.js?v=N és a VART_MODULOK.
'use strict';
modul('harc', 5);

// ---------- kocka ----------
function roll(expr) {
  const e = String(expr).replace(/\s+/g, '').replace(/[−–]/g, '-');
  const terms = e.match(/[+-]?[^+-]+/g) || [];
  let total = 0; const parts = [];
  for (const t of terms) {
    const sign = t[0] === '-' ? -1 : 1;
    const body = t.replace(/^[+-]/, '');
    const m = body.match(/^(\d*)d(\d+)$/i);
    if (m) {
      const n = Math.min(+(m[1] || 1), 200), d = +m[2]; const rs = [];
      for (let i = 0; i < n; i++) rs.push(rnd(d));
      total += sign * rs.reduce((a, b) => a + b, 0);
      parts.push((sign < 0 ? '−' : '') + `[${rs.join(',')}]`);
    } else if (/^\d+$/.test(body)) { total += sign * +body; parts.push((sign < 0 ? '−' : '+') + body); }
  }
  return {total, detail: parts.join(' ')};
}
function rollHit(bonus, who, label, mode) {
  const b = parseInt(bonus) || 0;
  const a = rnd(20), a2 = rnd(20);
  const d = mode === 'adv' ? Math.max(a, a2) : mode === 'dis' ? Math.min(a, a2) : a;
  const tag = mode === 'adv' ? ` előny [${a},${a2}]` : mode === 'dis' ? ` hátrány [${a},${a2}]` : ` [${a}]`;
  const cls = d === 20 ? 'crit' : d === 1 ? 'fumble' : '';
  const html = `<span class="who">${esc(who)}</span> ${esc(label)}: <b>${d + b}</b> <small>d20${tag} ${sgn(b)}${d === 20 ? ' — KRITIKUS!' : d === 1 ? ' — elvétve' : ''}</small>`;
  Ertesito.naplo(html, cls);
  return {html, cls, total: d + b};
}
// leiras = {type, kind}: a sebzés típusa és a támadás fajtája – ha van támadó és ezekből legalább egy, a sor alá flavour text kerül (leiras.js)
function rollDmg(expr, who, label, crit, leiras = null) {
  if (crit) expr = expr.replace(/(\d*)d(\d+)/g, (m, n, d) => `${2 * (+n || 1)}d${d}`);
  const r = roll(expr);
  const flv = who && leiras ? leirasHtml({...leiras, expr, total: r.total, crit}) : '';
  Ertesito.naplo(`<span class="who">${esc(who)}</span> ${esc(label)}: <b>${r.total}</b> <small>${esc(expr)}${crit ? ' (krit)' : ''} ${esc(r.detail)}</small>${flv}`);
}
function atkInfo(text) {
  const hit = (text.match(/([+\-]\d+)(?= to hit)/) || text.match(/Attack(?: Roll)?:\s?([+\-]\d+)/) || [])[1];
  const dice = [];
  const re = /(\d+d\d+(?:\s*[+\-−]\s*\d+(?!\s*d))?)/g; let m;
  while ((m = re.exec(text))) {
    const utana = text.slice(re.lastIndex, re.lastIndex + 30), after = utana.match(/^\)?\s*([A-Za-z]+)\s+damage/i);
    dice.push({expr: m[1].replace(/\s/g, ''), type: after ? after[1].toLowerCase() : '', ...(nemSebzes(utana) ? {nem: true} : {})});  // nem: hit points, időtartam (leiras.js)
  }
  return {hit, dice};
}

// ---------- encounter ----------
function order() {
  return [...S.enc.list].sort((a, b) =>
    (b.init ?? -99) - (a.init ?? -99) ||
    initBonusOf(b.c) - initBonusOf(a.c) ||
    (a.c.kind === 'pc' ? 0 : 1) - (b.c.kind === 'pc' ? 0 : 1) ||
    nameOf(a).localeCompare(nameOf(b), 'hu', {numeric: true}));
}
function addToEncounter(creature, count = 1, mentettHp = false) {  // mentettHp: mentett encounterből, a hp.cur-t nem dobja újra
  const c0 = normCreature(structuredClone(creature));
  const base = c0.name;
  const same = S.enc.list.filter(x => x.c.name === base);
  if (same.length === 1 && !same[0].num && c0.kind !== 'pc') same[0].num = 1;
  let next = Math.max(0, ...same.map(x => x.num || 0)) + 1;
  const group = uid();
  const added = [];
  for (let i = 0; i < count; i++) {
    const c = structuredClone(c0);
    c.libId = creature.libId || creature.id;
    const num = c.kind === 'pc' ? 0 : (count > 1 || same.length ? next++ : 0);
    let hp = c.hp.cur ?? c.hp.max;
    if (S.settings.rollHp && c.hp.formula && c.kind !== 'pc' && !(mentettHp && c.hp.cur != null)) hp = Math.max(1, roll(c.hp.formula).total);
    if (c.kind !== 'pc') c.hp.max = Math.max(c.hp.max, hp);
    delete c.hp.cur; delete c.hp.temp; delete c.init;
    const sheet = c.kind === 'pc' && SHEETS[c.libId];  // telefonos lapnál a lap szerinti HP és temp HP
    if (sheet) hp = sheet.hp.cur;
    const x = {cid: uid(), num, c, hp, temp: sheet ? sheet.hp.temp : 0, init: null, cond: sheet ? condsFromSheet(sheet) : [], conc: !!sheet?.concentration, dead: false, notes: '', leg: 0, group: c.kind === 'pc' ? null : group, hiddenP: false, publicName: ''};
    S.enc.list.push(x); added.push(x);
  }
  // harc közben hozzáadott ellenfelek azonnal dobnak
  if (S.enc.active) added.forEach(x => { if (x.c.kind !== 'pc') x.init = roll('1d20').total + initBonusOf(x.c); });
  save();
  return added;
}
// ---------- mentett encounterek ----------
// a nem játékos lények a mostani HP-jukkal (hp.cur), maximumukkal, temp HP-jukkal (hp.temp) és initiative-jukkal (init);
// a játékosok csak hivatkozásként (pcs: {libId, name, init?}), a HP-juk a lapról / könyvtárból jön – SZERZODES.md
function encounterMentese(name) {
  if (!S.enc.list.length) return null;
  const list = S.enc.list.filter(y => y.c.kind !== 'pc').map(y => {
    const c = structuredClone(y.c);
    c.hp.cur = y.hp;
    if (y.temp > 0) c.hp.temp = y.temp; else delete c.hp.temp;
    if (y.init != null) c.init = y.init; else delete c.init;
    return c;
  });
  const pcs = S.enc.list.filter(y => y.c.kind === 'pc' && y.c.libId).map(y => ({libId: y.c.libId, name: y.c.name, ...(y.init != null ? {init: y.init} : {})}));
  const e = {id: uid(), name: name || 'Encounter ' + (S.saved.length + 1), list};
  if (pcs.length) e.pcs = pcs;
  S.saved.push(e); save();
  return e;
}
// betöltés a mentett HP-val és initiative-val; a régi (HP / initiative nélküli) mentés teljes HP-val, üres initiative-val, mint eddig.
// A mentett játékos, ha nincs az encounterben, a könyvtárból jön (a felhasználó döntése, 2026-11-13).
function encounterBetoltese(enc) {
  const groups = {};
  enc.list.forEach(c => (groups[c.name] = groups[c.name] || []).push(c));
  Object.values(groups).forEach(g => addToEncounter(g[0], g.length, true).forEach((x, i) => {
    if (x.c.kind === 'pc') return;
    if (g[i].init != null) x.init = g[i].init;  // futó harcban is a mentett (az addToEncounter addig dobott)
    const h = g[i].hp;
    if (h.cur == null) return;
    x.c.hp.max = h.max; x.hp = h.cur; x.temp = h.temp || 0; x.dead = x.hp === 0;
  }));
  for (const p of enc.pcs || []) {
    let x = S.enc.list.find(y => y.c.libId === p.libId);  // kind nélkül: a közben NPC-vé váltott se jöjjön kétszer
    if (!x) {
      const lib = S.library.find(c => c.id === p.libId);
      if (!lib) { Ertesito.naplo(`⚠ ${esc(p.name)} nincs a könyvtárban, kimaradt`); continue; }
      [x] = addToEncounter(lib, 1);
    }
    if (p.init != null) x.init = p.init;
  }
  save();
}
function startTurn(x) {
  x.leg = 0;
  const expired = [];
  x.cond.forEach(k => { if (k.rounds != null) { k.rounds--; if (k.rounds <= 0) expired.push(k); } });
  x.cond = x.cond.filter(k => !expired.includes(k));
  Ertesito.naplo(`▶ ${esc(nameOf(x))} köre`, 'turn');
  expired.forEach(k => Ertesito.naplo(`${esc(nameOf(x))}: ${esc(k.name)} lejárt`, 'warn'));
  if (x.conc) Ertesito.naplo(`${esc(nameOf(x))} koncentrál`, 'warn');
}
// igazat ad, ha volt kire lépni (ilyenkor a hívó rajzol)
function step(dir) {
  const o = order();
  if (!o.length) return false;
  const skip = x => x.dead && x.c.kind !== 'pc';
  if (o.every(skip)) return false;
  let i = o.findIndex(x => x.cid === S.enc.active);
  if (i < 0) {
    i = o.findIndex(x => !skip(x));
    S.enc.active = o[i].cid; S.enc.round = S.enc.round || 1;
    Ertesito.naplo(`— ${S.enc.round}. kör —`, 'round'); startTurn(o[i]);
  } else {
    let j = i;
    do {
      j += dir;
      if (j >= o.length) { j = 0; S.enc.round++; Ertesito.naplo(`— ${S.enc.round}. kör —`, 'round'); }
      if (j < 0) { j = o.length - 1; S.enc.round = Math.max(1, S.enc.round - 1); }
    } while (skip(o[j]));
    S.enc.active = o[j].cid;
    if (dir > 0) startTurn(o[j]);
  }
  selected = null;
  save();
  return true;
}
function rollInitiative(mode) {
  const groups = {};
  for (const x of S.enc.list) {
    if (mode === 'monsters' && x.c.kind === 'pc') continue;
    if (mode === 'missing' && x.init != null) continue;
    if (S.settings.groupInit && x.group) {
      if (groups[x.group] == null) groups[x.group] = roll('1d20').total + initBonusOf(x.c);
      x.init = groups[x.group];
    } else x.init = roll('1d20').total + initBonusOf(x.c);
  }
  Ertesito.naplo('🎲 Initiative dobva', 'turn');
  save();
}
function damage(x, n) {
  const max = x.c.hp.max;
  let rem = n;
  if (x.temp) { const t = Math.min(x.temp, rem); x.temp -= t; rem -= t; }
  x.hp = Math.max(0, x.hp - rem);
  Ertesito.naplo(`<span class="who">${esc(nameOf(x))}</span> −${esc(n)} HP → <b>${esc(x.hp)}</b>/${esc(max)}${x.temp ? ` (+${esc(x.temp)} temp)` : ''}`);
  if (x.conc && n > 0) Ertesito.naplo(`⚠ ${esc(nameOf(x))}: koncentráció mentő, DC ${Math.max(10, Math.floor(n / 2))}`, 'warn');
  if (x.hp === 0) {
    if (x.c.kind === 'pc') Ertesito.naplo(`⚠ ${esc(nameOf(x))} 0 HP-n – death save-ek!`, 'warn');
    else { x.dead = true; Ertesito.naplo(`💀 ${esc(nameOf(x))} elesett`, 'warn'); }
  }
}
function heal(x, n) {
  x.hp = Math.min(x.c.hp.max, x.hp + n);
  if (x.hp > 0) x.dead = false;
  Ertesito.naplo(`<span class="who">${esc(nameOf(x))}</span> +${esc(n)} HP → <b>${esc(x.hp)}</b>/${esc(x.c.hp.max)}`);
}

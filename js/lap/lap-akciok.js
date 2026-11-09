// Telefonos karakterlap (lap-akciok, a karakter.html része): a gombok nyilvántartása (LAP_AKCIOK: data-act → kezelő), módosítás, gépelés, billentyűk
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-akciok', N) és a karakter.html-ben a lap-akciok.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-akciok', 3);

// ---------- nyilvántartás: data-act="nev" → LAP_AKCIOK.nev(el, s, i, act) ----------
// Új gomb = új bejegyzés (s = a nyitott lap, i = a gomb data-i értéke). A kezelő maga ír és rajzol, ha kell.
// Lap nélkül (belépés, lista, Fiók menü) csak ezek futnak:
const LAP_NELKUL = new Set(['signIn', 'signOut', 'reload', 'infoClose', 'fiok', 'megj', 'keresDob', 'keresElvet']);
// több gomb közös kezelője (a gomb neve dönt)
const ncGomb = (el, s, i, act) => { if (s.newChar && canEdit(s)) ncAct(act, el, s); };
const luGomb = (el, s, i, act) => { if (lu) luAct(act, el, s); };
function histGomb(el, s, i, act) {
  const h = histCache.get(view.id)?.find?.(x => x.id === el.dataset.h); if (!h || !canEdit(s)) return;
  if (act === 'histDl') download(H.exportNev(h.sheet.name, h.at), H.exportLap(h.sheet));
  else if (act === 'histFull') histFull(s, h); else histRestore(s, h);
}
function hpGomb(el, s, i, act) {
  const n = Math.abs(parseInt($('#hpIn').value));
  if (isNaN(n)) return;
  if (act === 'hpDmg' && n) takeDamage(s, n);
  else if (act === 'hpHeal' && n) patch(H.heal(s, n));
  else if (act === 'hpTemp') patch({hp: {...s.hp, temp: n}});
}
// az űrlap (Alapadatok) sorai: a piszkozatot olvassa, és ha az közben újratöltődött, csak újrarajzol
function urlapGomb(fn) { const d = readForm(); if (d) fn(d); render(true); }
const LAP_AKCIOK = {
  fiok() { fiokMutat(); },
  keresDob(el) { keresDob(el.dataset.id); },
  keresElvet(el) { keresElvet(el.dataset.id); },
  megj(el) { megjAllit(el.dataset.k, el.dataset.v); fiokMutat(); },
  luStart(el, s) { if (canEdit(s) && luEnabled(s) && luReady(s) && !sheetStale) { luLoad(view.id, s); window.scrollTo(0, 0); render(true); } },
  info(el) { const info = infoReg.get(el.dataset.info); if (info) infoMutat(info); },
  infoClose() { $('#infoPop').hidden = true; },
  ncPortre() { $('#ncPortreFile')?.click(); },
  ncPortreTorol(el, s) { if (s.newChar && canEdit(s)) patch({portrait: ''}); },
  ncCls: ncGomb, ncEqMode: ncGomb, ncEqPick: ncGomb, ncEqGold: ncGomb, ncEqGoldRe: ncGomb, ncKosar: ncGomb, ncMethod: ncGomb, ncRollDo: ncGomb, ncReroll: ncGomb, ncNext: ncGomb, ncBack: ncGomb, ncDone: ncGomb, ncSkip: ncGomb,
  luClose: luGomb, luCls: luGomb, luHow: luGomb, luNext: luGomb, luBack: luGomb, luSave: luGomb,
  histRestore: histGomb, histFull: histGomb, histDl: histGomb,
  histSave(el, s) { if (canEdit(s)) histMent(s); },
  lapTorol(el, s) { if (canEdit(s) && !s.deleted) lapTorol(s); },
  lapDl(el, s) { download(H.exportNev(s.name, new Date().toISOString()), H.exportLap(s)); },
  signIn() { window.KAuth?.signIn(); },
  signOut() { $('#infoPop').hidden = true; window.KAuth?.signOut(); },
  reload() { location.reload(); },
  d20(el) { rollD20(+el.dataset.bonus || 0, el.dataset.label, el.dataset.kind || ''); },
  dmg(el) { rollDamage(el.dataset.expr, el.dataset.label, el.dataset.kind || '', {dt: el.dataset.dt || '', dk: el.dataset.dk || ''}); },
  hpDmg: hpGomb, hpHeal: hpGomb, hpTemp: hpGomb,
  ds(el, s, i) { const k = el.dataset.kind; patch({deathSaves: {...s.deathSaves, [k]: pipToggle(s.deathSaves[k], i)}}); },
  dsRoll(el, s) {
    const r = rollD20(0, 'Halálmentő'), ds = {...s.deathSaves};
    if (r.nat === 20) { patch({hp: {...s.hp, cur: 1}, deathSaves: {ok: 0, fail: 0}}); return; }
    if (r.nat === 1) ds.fail += 2; else if (r.total >= 10) ds.ok++; else ds.fail++;
    patch({deathSaves: ds});
  },
  hd(el, s) {
    const die = +el.dataset.die, r = rollExpr('1d' + die), gain = Math.max(0, r.total + mod(s.abilities.con));
    showRoll({label: `Hit Die d${die}`, total: gain, detail: `${r.detail} ${sgn(mod(s.abilities.con))} (CON)`});
    patch({...H.heal(s, gain), hitDiceUsed: {...s.hitDiceUsed, [die]: (s.hitDiceUsed[die] || 0) + 1}});
  },
  hdToggle() { hdOpen = !hdOpen; render(true); },
  shortRest(el, s) { if (confirm('Short rest: a „short rest” erőforrások és a Pact Magic slotok visszatöltődnek. Mehet?')) patch(H.shortRest(s)); },
  longRest(el, s) { if (confirm('Long rest: teljes HP, minden spell slot és erőforrás visszatöltődik, a Hit Dice fele visszajön, exhaustion −1. Mehet?')) patch(H.longRest(s)); },
  res(el, s, i) { patch({resources: s.resources.map((r, k) => k === i ? {...r, used: pipToggle(r.used, +el.dataset.j)} : r)}); },
  slot(el, s) { const l = +el.dataset.l, used = [...s.spellcasting.used]; used[l] = pipToggle(used[l], +el.dataset.j); patch({spellcasting: {...s.spellcasting, used}}); },
  pact(el, s) { patch({spellcasting: {...s.spellcasting, pact: {...s.spellcasting.pact, used: pipToggle(s.spellcasting.pact.used, +el.dataset.j)}}}); },
  condRm(el, s, i) {
    const p = {conditions: s.conditions.filter((_, k) => k !== i)};
    if (s.concentration && s.conditions[i]?.toLowerCase() === s.concentration.toLowerCase()) p.concentration = '';
    patch(p);
  },
  spellRm(el, s, i) { if (confirm(`Eltávolítod: ${s.spells[i].name}?`)) patch({spells: s.spells.filter((_, k) => k !== i)}); },
  spellAdd(el, s) {
    const sp = H.byRef(RB().spells, el.dataset.ref); if (!sp) return;
    patch({spells: [...s.spells, {name: sp.n, level: sp.l || 0, prepared: !sp.l, ref: H.refOf(sp)}]});
  },
  spellCustom(el, s) { const n = $('#spellNew').value.trim(); if (n) patch({spells: [...s.spells, {name: n, level: +$('#spellNewL').value, prepared: true}]}); },
  qty(el, s, i) { patch({inventory: s.inventory.map((it, k) => k === i ? {...it, qty: Math.max(0, it.qty + +el.dataset.d)} : it)}); },
  itemRm(el, s, i) { if (confirm(`Eltávolítod: ${s.inventory[i].name}?`)) patch(invPatch(s, s.inventory.filter((_, k) => k !== i), s.inventory[i])); },
  castOpen(el, s, i) { castOpen = castOpen === i ? null : i; render(true); },
  cast(el, s, i) {
    const sp = s.spells[i], how = el.dataset.how, sc = s.spellcasting;
    if (!sp) return;
    let p = how === 'pact' ? {spellcasting: {...sc, pact: {...sc.pact, used: Math.min(sc.pact.max, sc.pact.used + 1)}}}
      : how === 'ritual' || how === '0' ? {} : {spellcasting: {...sc, used: sc.used.map((u, l) => l === +how - 1 ? Math.min(sc.slots[l], u + 1) : u)}};
    castOpen = null;
    // koncentrációs spell: ha már másra koncentrál, előbb rákérdez (Mégse = nem castol, slot sem fogy)
    if (rbSpell(sp)?.k) { const c = concTo(s, sp.name, p); if (!c) { render(true); return; } p = c; }
    // hatással járó spell (Mage Armor, Shield, Haste…): magára is érvényesüljön?
    const conds = p.conditions || s.conditions;
    if (H.effectOf(sp.name) && !conds.some(c => c.toLowerCase() === sp.name.toLowerCase()) && confirm(`${sp.name}: rád is hat? (bekerül az aktív hatások közé, és a bónusza magától érvényesül)`))
      p.conditions = [...conds, sp.name];
    showRoll({label: sp.name, total: '✨', detail: how === '0' ? 'cantrip' : how === 'ritual' ? 'rituáléként, slot nélkül' : how === 'pact' ? `Pact slotból (${sc.pact.level}. szint)` : `${how}. szintű slotból` + (+how > sp.level ? ' (upcast)' : '')}, false);
    if (Object.keys(p).length) patch(p); else render(true);
  },
  concEnd(el, s) { patch({concentration: '', conditions: H.dropConc(s.conditions, s.concentration)}); },
  effToggle(el, s) { const k = el.dataset.key; patch({effOff: s.effOff.includes(k) ? s.effOff.filter(x => x !== k) : [...s.effOff, k]}); },
  featPick(el, s) {
    if (!featPick) return;
    const a = el.dataset.a, p = {abilities: H.addAb(s.abilities, {[a]: featPick.amt})};
    if (/^resilient$/i.test(featPick.name) && !s.saveProf.includes(a)) p.saveProf = [...s.saveProf, a];
    featPick = featPick.left > 1 ? {...featPick, left: featPick.left - 1, from: featPick.from.filter(x => x !== a)} : null;
    patch(p);
  },
  featPickSkip() { featPick = null; render(true); },
  itemAdd(el, s) {
    const it = H.byRef(H.allItems(RB()), el.dataset.ref); if (!it) return;
    const ref = H.refOf(it), k = s.inventory.findIndex(x => x.ref === ref);
    patch({inventory: k >= 0 ? s.inventory.map((x, j) => j === k ? {...x, qty: x.qty + 1} : x) : [...s.inventory, {name: it.n, qty: 1, magic: !!it.mag, rarity: it.rar || '', ref}]});
  },
  itemCustom(el, s) { const n = $('#itemNew').value.trim(); if (n) patch({inventory: [...s.inventory, {name: n, qty: Math.max(1, +$('#itemNewQ').value || 1)}]}); },
  featAdd(el, s) {
    const f = H.byRef(RB().feats, el.dataset.ref); if (!f) return;
    const p = {features: [...s.features, {name: f.n, text: f.tx || '', src: 'Feat'}]};
    // kézi lapon a feat képességbónusza a beírt értékekhez adódik; a választhatót (pl. Resilient) a játékos választja ki
    if (!s.auto) {
      const b = H.abBonusOf(f.fx);
      if (Object.keys(b.fixed).length) p.abilities = H.addAb(s.abilities, b.fixed);
      featPick = b.choose.length ? {name: f.n, from: b.choose[0].from, amt: b.choose[0].amt, left: b.choose[0].n} : null;
    }
    patch(p);
  },
  featCustom(el, s) { const n = $('#featNew').value.trim(); if (n) patch({features: [...s.features, {name: n, text: $('#featNewT').value, src: $('#featNewS').value}]}); },
  featRm(el, s, i) { if (confirm(`Eltávolítod: ${s.features[i].name}?` + (s.auto ? '' : '\n(Ha képességbónuszt adott, azt az Alapadatokon vedd vissza kézzel.)'))) patch({features: s.features.filter((_, k) => k !== i)}); },
  rowAdd(el) { urlapGomb(d => d[el.dataset.list].push({name: '', subclass: '', level: 1, hitDie: 8, hit: '', dmg: '', note: '', max: 1, used: 0, reset: 'long'})); },
  rowRm(el, s, i) { urlapGomb(d => d[el.dataset.list].splice(i, 1)); },
  slotsAuto() { urlapGomb(d => { const sl = H.slotsFor(H.norm(d).classes); d.spellcasting = {...d.spellcasting, slots: sl.slots, pact: {...d.spellcasting.pact, ...sl.pact}}; }); },
  toAuto(el, s) {
    if (!confirm('Átállítod a lapot a szabálymotorra? A jelenlegi értékek megmaradnak (ahol eltérnek a számolttól, felülírásként), a hiányzó választások a Teendők közé kerülnek.')) return;
    toAutoMent(s);
  },
  todoGo() { if (view.tab === 'adat') readForm(); view.tab = 'adat'; openKeys.add('todos'); render(true); $('details[data-key="todos"]')?.scrollIntoView({block: 'start'}); },
  chGo(el) { document.getElementById(chId(el.dataset.key))?.scrollIntoView({block: 'center'}); },
  todoReset() { patch({todoDone: []}); },
  ovReset(el, s) { const ov = {...s.ov}; delete ov[el.dataset.key]; patch({ov}); },
  lvAdd(el, s) { if (isDM) patch({build: {...s.build, levels: [...s.build.levels, {c: $('#lvCls').value, hp: null}]}}); },
  lvRm(el, s) { if (isDM && confirm('Leveszed az utolsó szintet?')) patch({build: {...s.build, levels: s.build.levels.slice(0, -1)}}); },
  edSave(el, s) {
    // piszkozat nélkül nincs mit menteni: üres lap soha nem íródhat a karakterre
    if (!readForm()) { alert('Az űrlap közben újratöltődött, ezért nem mentettem. Nézd át, és nyomd meg újra a Mentést.'); render(true); return; }
    if (s.auto) {
      // a számolt tételek (auto) a lapról maradnak, a piszkozatból csak a sajátok jönnek
      const d = readForm();
      draft = null;
      savedToast(patch(changedOnly(s, {name: d.name, alignment: d.alignment, attacks: H.regiSorrend(d.attacks, [...s.attacks.filter(a => a.auto), ...d.attacks.filter(a => !a.auto)]), resources: [...s.resources.filter(r => r.auto), ...d.resources.filter(r => !r.auto)]})));
      return;
    }
    const d = H.norm(readForm()), p = {};
    for (const k of EDIT_KEYS) p[k] = d[k];
    p.hp = {...s.hp, max: d.hp.max};
    draft = null; savedToast(patch(changedOnly(s, p)));
  },
  edCancel() { draft = null; render(true); },
};

// figyelők (a lap-indulas.js kapcsolja fel)
function akciokEsemenyek() {
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'infoPop') { t.hidden = true; return; }  // a háttérre koppintva bezárul
    const m = t.closest('#rollbar [data-mode]');
    if (m) { setMode(rollMode === m.dataset.mode ? '' : m.dataset.mode); return; }
    const tab = t.closest('[data-tab]');
    if (tab) { fulValt(tab.dataset.tab); return; }
    const el = t.closest('[data-act]');
    if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
    const act = el.dataset.act, s = cur(), i = +el.dataset.i;
    if (el.tagName === 'A' || el.closest('summary')) e.preventDefault();
    if (!s && !LAP_NELKUL.has(act)) return;
    if (Object.hasOwn(LAP_AKCIOK, act)) LAP_AKCIOK[act](el, s, i, act);
  });
  document.addEventListener('toggle', e => {
    const k = e.target.dataset?.key;
    if (k) e.target.open ? openKeys.add(k) : openKeys.delete(k);
    if (k === 'hist' && e.target.open && !histCache.has(view.id)) histLoad(view.id);
  }, true);
  document.addEventListener('change', e => {
    const t = e.target, s = cur(); if (!s) return;
    const i = +t.dataset.i, act = t.dataset.act;
    const setItem = f => patch(invPatch(s, s.inventory.map((it, k) => k === i ? {...it, ...f} : it), s.inventory[i]));
    if (t.id === 'ncPortreFile') { if (t.files[0]) ncPortre(t.files[0]); return; }
    if (t.dataset.ncf) { ncCsend = Date.now() + 500; write(view.id, {[t.dataset.ncf]: t.value}); return; }  // újrarajzolás nélkül (a Tovább koppintása így nem vész el)
    if (t.dataset.ncPick) {
      const nc = s.newChar, pick = {...nc.pick};
      if (t.value === '') delete pick[t.dataset.ncPick]; else pick[t.dataset.ncPick] = +t.value;
      patch({newChar: {...nc, pick}, build: {...s.build, base: H.ncBaseFromPick(nc, pick)}});
      return;
    }
    if (t.dataset.ncBase) {
      const base = ncBaseInput(s);
      ncBaseLive(s); ncCsend = Date.now() + 500;
      if (H.ABIL.every(a => base[a] >= 1 && base[a] <= 30)) write(view.id, {build: {...s.build, base}});
      return;
    }
    if (act === 'ncEqCat') { if (s.newChar && canEdit(s)) ncEqCat(t, s); return; }
    if (act === 'csakBek') { csakBekeszitettAllit(t.checked); render(true); return; }
    if (t.dataset.ch != null) choicePicked(t);
    else if (t.dataset.ov != null) { const ov = {...s.ov}; if (t.value.trim() === '') delete ov[t.dataset.ov]; else ov[t.dataset.ov] = t.value.trim(); patch({ov}); }
    else if (act === 'bRace') { const o = H.raceOptions(RB())[+t.value]; patch({build: {...s.build, race: o?.race || '', subrace: o?.subrace || ''}, ...(s.newChar ? {race: o?.label || ''} : {})}); }
    else if (act === 'bBg') patch({build: {...s.build, background: t.value}, ...(s.newChar ? {background: H.refName(t.value)} : {})});
    else if (act === 'bBase') patch({build: {...s.build, base: {...s.build.base, [t.dataset.a]: Math.max(1, Math.min(30, +t.value || 10))}}});
    else if (act === 'lvHp') patch({build: {...s.build, levels: s.build.levels.map((l, k) => k === i ? {...l, hp: t.value === '' ? null : +t.value} : l)}});
    else if (act === 'todoDone' && t.checked) patch({todoDone: [...s.todoDone, t.dataset.key]});
    else if (t.form?.id === 'edForm' && /^(cl_name_|cl_sub_|cl_lvl_|race$)/.test(t.name)) formPicked(t.name);
    else if (t.id === 'condAdd' && t.value) {
      // aktív hatás: a Rage elhasznál egyet az erőforrásból; a koncentrációs spell átveszi a koncentrációt (rákérdez, ha már van)
      const n = t.value, fx = H.effectOf(n);
      let p = {conditions: [...s.conditions, n]};
      const k = fx?.res ? s.resources.findIndex(r => r.name.toLowerCase() === fx.res.toLowerCase()) : -1;
      if (k >= 0) {
        const r = s.resources[k];
        if (r.used >= r.max && !confirm(`Elfogyott: ${r.name} (${r.max} / ${r.max} elhasználva). Mégis bekapcsolod?`)) { t.value = ''; return; }
        p.resources = s.resources.map((x, j) => j === k ? {...x, used: Math.min(x.max, x.used + 1)} : x);
      }
      if (fx?.conc) { const c = concTo(s, n, p); if (!c) { t.value = ''; return; } p = c; }
      patch(p);
    }
    else if (t.id === 'exh') patch({exhaustion: +t.value});
    else if (t.id === 'spellMine') { searchQ.all = !t.checked; spellResults(s); }
    else if (act === 'prep') patch({spells: s.spells.map((sp, k) => k === i ? {...sp, prepared: t.checked} : sp)});
    else if (act === 'equip') setItem({equipped: t.checked});
    else if (act === 'attune') {
      if (t.checked && H.attuned(s) >= 3 && !confirm('Már 3 tárgyra vagy hangolva (ez a maximum). Mégis bejelölöd?')) { t.checked = false; return; }
      setItem({attuned: t.checked});
    }
    else if (act === 'itemNote') setItem({note: t.value});
    else if (act === 'itemCont') setItem({container: t.value});
    else if (act === 'coin') patch({currency: {...s.currency, [t.dataset.coin]: Math.max(0, +t.value || 0)}});
    else if (t.id === 'notes') { clearTimeout(notesTimer); patch({notes: t.value}); }
  });
  document.addEventListener('input', e => {
    const t = e.target, s = cur(); if (!s) return;
    if (t.id === 'spellQ') { searchQ.spell = t.value; spellResults(s); }
    if (t.id === 'itemQ') { searchQ.item = t.value; itemResults(s); }
    if (t.id === 'featQ') { searchQ.feat = t.value; featResults(s); }
    if (t.id === 'ncBolt' && s.newChar) ncBoltKeres(t, s);
    if (t.dataset.ncBase) ncBaseLive(s);
    // kézi HP: gépelés közben a szöveg és a Tovább frissül, újrarajzolás nélkül (különben a mező elhagyása elnyelné a Tovább első koppintását)
    if (t.id === 'luHpIn' && lu) {
      const hd = H.classInfo(lu.cls, RB()).hd, v = Math.floor(+t.value);
      luSetHp('manual', v >= 1 && v <= hd ? v : null);
      const plan = H.levelUpPlan(s, RB(), lu.build);
      $('#luHpOut').innerHTML = luHpText(plan);
      $('[data-act="luNext"]').disabled = !!luBlocked(plan);
    }
    if (t.dataset.chq != null) {
      chSearch[t.dataset.chq] = t.value;
      const box = t.closest('.chbox'), q = t.value.trim().toLowerCase();
      box.querySelectorAll('label[data-chl]').forEach(l => { l.hidden = !!q && !l.dataset.chl.includes(q); });
      if (q) box.querySelectorAll('details').forEach(d => { d.open = !!d.querySelector('label[data-chl]:not([hidden])'); });
    }
    // a jegyzet gépelés közben is mentődik, de a lap nem rajzolódik újra (ne ugorjon a kurzor)
    if (t.id === 'notes' && canEdit(s)) {
      clearTimeout(notesTimer);
      notesTimer = setTimeout(() => {
        const s2 = cur(); if (!s2) return;
        s2.notes = H.norm({notes: t.value}).notes;
        try { window.KDB?.update(view.id, {notes: s2.notes, updatedAt: new Date().toISOString(), updatedBy: me}); } catch {}
      }, 1000);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.target.id !== 'hpIn' || e.key !== 'Enter') return;
    const s = cur(), n = parseInt(e.target.value);
    if (n > 0) takeDamage(s, n); else if (n < 0) patch(H.heal(s, -n));
  });
}

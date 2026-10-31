// Események (felület): a gombok nyilvántartása (AKCIOK), kattintásszabályok, módosítás, gépelés, billentyűk és beillesztés kezelése.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('akciok', N) és az index.html-ben az akciok.js?v=N és a VART_MODULOK.
'use strict';
modul('akciok', 4);

// ---------- nyilvántartás: data-act="nev" → AKCIOK.nev(el, e) ----------
// Új gomb = új bejegyzés. A kezelő maga rajzol és ment, ha kell.
const dobasMod = e => e.shiftKey ? 'adv' : e.ctrlKey ? 'dis' : '';  // Shift = előny, Ctrl = hátrány
const harcos = el => byId(el.closest('[data-cid]')?.dataset.cid);
const hpMezo = el => el.closest('.tile').querySelector('.hpin').value;
const harcMod = (el, fn) => { fn(harcos(el)); save(); render(); };  // a gomb harcosán változtat, aztán ment és rajzol
const konyvtari = el => { const libEl = el.closest('[data-lib]'); return libEl && S.library.find(c => c.id === libEl.dataset.lib); };
const darab = el => Math.max(1, +(el.closest('.lrow')?.querySelector('.cnt')?.value) || 1);
const fiveTalalat = async el => convert5e(await resolveCopy(structuredClone(fiveResults[+el.closest('[data-five]').dataset.five])));
// lépés a következő/előző harcosra: rajzol, és a soron következő csempe látszódjon
function lep(dir) { if (step(dir)) { render(); aktivCsempeMutat(); } }

const AKCIOK = {
  // harc
  next: () => lep(1),
  prev: () => lep(-1),
  rollInit: () => openInitMenu(),
  init: el => { rollInitiative(el.dataset.mode); closeModal(); render(); },
  rollCustom: () => { const v = $('#diceInput').value.trim(); if (v) rollDmg(v, '', v); },
  select: el => { selected = harcos(el).cid; render(); },
  deselect: () => { selected = null; render(); },
  dmg: el => { const n = Math.abs(parseInt(hpMezo(el))); if (n > 0) harcMod(el, x => damage(x, n)); },
  heal: el => { const n = Math.abs(parseInt(hpMezo(el))); if (n > 0) harcMod(el, x => heal(x, n)); },
  temp: el => {
    const n = parseInt(hpMezo(el));
    if (n >= 0) harcMod(el, x => { x.temp = n; log(`${esc(nameOf(x))}: ${n} temp HP`); });
  },
  toggleConc: el => harcMod(el, x => { x.conc = !x.conc; }),
  toggleDead: el => harcMod(el, x => { x.dead = !x.dead; }),
  toggleSide: el => harcMod(el, x => { x.side = sideOf(x) === 'enemy' ? 'ally' : 'enemy'; }),
  toggleHidden: el => harcMod(el, x => { x.hiddenP = !x.hiddenP; }),
  dup: el => { const x = harcos(el); addToEncounter({...x.c, id: x.c.libId || x.c.id}, 1); render(); },
  remove: el => {
    const x = harcos(el);
    if (confirm(`Eltávolítod: ${nameOf(x)}?`)) {
      if (S.enc.active === x.cid) lep(1);
      S.enc.list = S.enc.list.filter(y => y !== x);
      if (S.enc.active === x.cid) S.enc.active = null;
      save(); render();
    }
  },
  rmCond: el => harcMod(el, x => { x.cond.splice(+el.dataset.i, 1); }),
  leg: el => { const i = +el.dataset.i; harcMod(el, x => { x.leg = x.leg === i + 1 ? i : i + 1; }); },
  addCond: el => {
    const name = $('#condSel').value || $('#condCustom').value.trim();
    if (!name) return;
    const rounds = parseInt($('#condRounds').value);
    harcMod(el, x => { x.cond.push({name, rounds: rounds > 0 ? rounds : null}); });
  },
  editCombatant: el => {
    const x = harcos(el);
    // a játékos app beállításai a karakterhez tartoznak, nem a harchoz: a könyvtári lényből jönnek, és oda azonnal vissza is íródnak
    const lib = S.library.find(l => l.id === x.c.libId);
    openEditor(lib ? {...x.c, owner: lib.owner, share: lib.share} : x.c, c => {
      const oldMax = x.c.hp.max;
      c.libId = x.c.libId; x.c = c;
      x.hp = x.hp === oldMax ? c.hp.max : Math.min(x.hp, c.hp.max);
      const l = S.library.find(l => l.id === c.libId);
      if (l && l.kind === c.kind) Object.assign(l, normCreature({...l, owner: c.owner, share: c.share}));
    }, 'Adatlap szerkesztése (csak ebben a harcban)', {share: true, shareNote: 'A játékos app beállításai a karakterhez tartoznak: a könyvtárban is azonnal érvényesek.'});
  },
  saveToLib: el => {
    const x = harcos(el), c = structuredClone(x.c);
    c.id = c.libId && S.library.some(l => l.id === c.libId) ? c.libId : uid();
    if (c.kind === 'pc') c.hp.cur = x.hp;
    const saved = upsertLibrary(c);
    x.c.libId = saved.id;
    log(`📚 ${esc(saved.name)} elmentve a könyvtárba`); save();
  },

  // ablakok megnyitása
  openLib: () => openLib(),
  menu: () => openMenu(),
  // 'dmscreen-player' itt ablaknév (ugyanaz a lap nyílik újra), nem a CSATORNA
  openPlayer: () => { window.open('player.html','dmscreen-player', 'popup,width=1280,height=800'); },
  openCharApp: () => { window.open('karakter.html', '_blank'); },
  diffInfo: () => openDiffInfo(),
  openLoot: () => openLoot(),
  openParty: () => openParty(),

  // portré
  portraitUpload: () => $('#portraitFile').click(),
  portraitClear: () => { setPortrait(''); $('#portraitUrl').value = ''; },

  // Csapat nézet
  partySzintAd: el => { szintlepesAd(el.dataset.pc); rerenderParty(); },
  partySzintVissza: el => { szintlepesVissza(el.dataset.pc); rerenderParty(); },
  partySzintMind: () => { partyMembers().forEach(c => szintlepesAd(c.id)); rerenderParty(); },
  partyRemove: el => { setPartyMember(el.dataset.pc, false); rerenderParty(); },
  partySortReset: () => { partySort.s = {col: null, dir: 1}; rerenderParty(); },
  libParty: el => { const lib = konyvtari(el); setPartyMember(lib.id, !partyMembers().some(c => c.id === lib.id)); filterLib(); },
  partyGroup: (el, e) => partyRoll(partyMembers().map(c => c.id), el.dataset.sk, dobasMod(e)),
  partyEdit: el => {
    const pcLib = S.library.find(c => c.id === el.dataset.pc);
    if (pcLib) openEditor(pcLib, c => { c.id = pcLib.id; upsertLibrary(c, false); setTimeout(openParty); }, undefined, {share: true});
  },

  // zsákmány
  lootRoll: () => rollLootUi(),
  lootCopy: async el => {
    try { await navigator.clipboard.writeText(lootText(lootResult)); el.textContent = '✓ Kimásolva'; }
    catch { el.textContent = 'A böngésző nem engedte'; }
  },
  lootLog: el => { log('🎁 ' + esc(lootText(lootResult)).replace(/\n/g, '<br>')); el.textContent = '✓ Naplóban'; },

  // lényszerkesztő
  newCreature: () => openEditor(blankCreature(), c => { upsertLibrary(c, false); log(`📚 ${esc(c.name)} létrehozva`); }, 'Új lény', {share: true}),
  edSave: () => {
    const ow = $('#edForm').elements.owner?.value.trim();
    if (ow && $('#edForm').elements.kind.value === 'pc' && !EMAIL_RE.test(ow.toLowerCase())) { alert('A játékos Google-fiókja nem érvényes e-mail-cím.'); return; }
    const c = readEditor(); const cb = editCb; closeModal(); cb && cb(c); save(); render();
  },
  edCancel: () => closeModal(),

  // könyvtár
  libAdd: el => { const lib = konyvtari(el), n = darab(el); addToEncounter(lib, n); render(); log(`＋ ${n}× ${esc(lib.name)}`); },
  libEdit: el => { const lib = konyvtari(el); openEditor(lib, c => { c.id = lib.id; upsertLibrary(c, false); setTimeout(() => openLib('lib')); }, undefined, {share: true}); },
  libExport: el => { const lib = konyvtari(el); download(lib.name.replace(/[^\wáéíóöőúüű -]/gi, '') + '.json', SHEETS[lib.id] ? Sheet.exportLap(SHEETS[lib.id]) : lib); },
  libDel: el => {
    const lib = konyvtari(el);
    // játékos karaktert csak a „Delete” beírásával lehet véglegesen törölni
    if (lib.kind === 'pc') {
      const v = prompt(`Véglegesen törlöd: ${lib.name}?\nA karakterlapja, a mentései és a nyilvános része is törlődik. Ez nem vonható vissza, csak a napi felhős biztonsági mentésekből hozható vissza (legfeljebb 14 napig, a karakter mentései nélkül).\n\nA megerősítéshez írd be: Delete`);
      if (v === null) return;
      if (v.trim() !== 'Delete') { alert('Nem „Delete” lett beírva, ezért nem töröltem.'); return; }
    } else if (!confirm(`Törlöd a könyvtárból: ${lib.name}?`)) return;
    if (SHEETS[lib.id]) sheetOps.del.add(lib.id);
    S.library = S.library.filter(c => c !== lib); save(); filterLib();
    log(`🗑 ${esc(lib.name)} törölve`);
  },
  libVisszahoz: el => { const lib = konyvtari(el); if (lapVisszahoz(lib.id)) log(`↩ ${esc(lib.name)} visszahozva`); filterLib(); },
  libSzintAd: el => { szintlepesAd(el.dataset.pc); filterLib(); },
  libSzintVissza: el => { szintlepesVissza(el.dataset.pc); filterLib(); },
  libSheet: el => {
    const lib = konyvtari(el);
    if (SHEETS[lib.id]) window.open('karakter.html#lap/' + lib.id, '_blank');
    else if (confirm(`Telefonos karakterlapot hozol létre ${lib.name} számára a könyvtári adatokból?\nEzután a lap a játékosé: amit a telefonján átír, az ide is átjön. Az osztályt, spell slotokat érdemes a lapon ellenőrizni.`)) {
      createSheet(lib.id, creatureToSheet(lib)); filterLib(); log(`📱 ${esc(lib.name)}: karakterlap létrehozva`);
    }
  },

  // szabálykönyv
  rulebook: () => openRulebook(),
  rbUpdate: async el => { el.disabled = true; await rulebookUpdate(); el.disabled = false; },
  itemAdd: el => {
    const it = itemResults[+el.closest('[data-item]').dataset.item], to = $('#itemTo')?.value, n = darab(el);
    const c = it && to && addItemTo(to, it, n);
    if (c) { el.textContent = '✓ ' + c.name; log(`🗡 ${n}× ${esc(it.n)} → ${esc(c.name)}`); }
  },

  // importálás, sablonok
  downloadSheetTemplate: () => download('karakterlap-sablon.json', Sheet.TEMPLATE),
  showSheetTemplate: () => { $('#jsonIn').value = JSON.stringify(Sheet.TEMPLATE, null, 2); },
  addAllPcs: () => {
    const pcs = S.library.filter(c => c.kind === 'pc' && !lapTorolt(c.id) && !S.enc.list.some(x => x.c.libId === c.id));
    pcs.forEach(c => addToEncounter(c, 1)); render();
    log(`＋ ${pcs.length} játékos hozzáadva`); closeModal();
  },
  fiveSearch: () => fiveSearch(),
  fiveAdd: async el => { const c = await fiveTalalat(el), n = darab(el); addToEncounter(c, n); render(); log(`＋ ${n}× ${esc(c.name)}`); },
  fiveSave: async el => { upsertLibrary(await fiveTalalat(el)); el.textContent = '✓ Mentve'; },
  ddbPasteImport: () => ddbImportText($('#ddbPaste').value),
  ddbClipboard: async () => {
    try { ddbImportText(await navigator.clipboard.readText()); }
    catch { $('#ddbMsg').innerHTML = '<p class="muted">A böngésző nem engedte olvasni a vágólapot – kattints a mezőbe, és nyomj Ctrl+V-t.</p>'; }
  },
  jsonImport: async () => {
    try {
      const res = await importAny(JSON.parse($('#jsonIn').value));
      $('#jsonMsg').textContent = `✓ ${res.length} lény importálva: ${res.map(c => c.name).join(', ')}`;
    } catch (err) { $('#jsonMsg').textContent = '⚠ ' + err.message; }
  },
  showTemplate: () => { $('#jsonIn').value = JSON.stringify(TEMPLATE, null, 2); },
  downloadTemplate: () => download('dmscreen-sablon.json', TEMPLATE),
  importFile: () => { fileMode = 'creatures'; $('#fileIn').click(); },

  // belépés
  signIn: () => window.DMAuth?.signIn(),
  signOut: () => { closeModal(); window.DMAuth?.signOut(); },
  reload: () => location.reload(),

  // mentett encounterek
  encSave: () => {
    const list = S.enc.list.filter(y => y.c.kind !== 'pc').map(y => y.c);
    if (!list.length) { alert('Nincs nem-játékos lény az encounterben.'); return; }
    S.saved.push({id: uid(), name:$('#encName').value.trim() || 'Encounter ' + (S.saved.length + 1), list: structuredClone(list)});
    save(); renderLib();
  },
  encLoad: el => {
    const enc = S.saved[+el.closest('[data-enc]').dataset.enc];
    const groups = {};
    enc.list.forEach(c => (groups[c.name] = groups[c.name] || []).push(c));
    Object.values(groups).forEach(g => addToEncounter(g[0], g.length)); render();
    log(`⚔ ${esc(enc.name)} betöltve`); closeModal();
  },
  encDel: el => { if (confirm('Törlöd ezt a mentett encountert?')) { S.saved.splice(+el.closest('[data-enc]').dataset.enc, 1); save(); renderLib(); } },

  // menü
  newFight: () => {
    S.enc.list = S.enc.list.filter(y => y.c.kind === 'pc');
    S.enc.list.forEach(y => { y.init = null; y.cond = []; y.conc = false; y.leg = 0; });
    S.enc.round = 1; S.enc.active = null; selected = null;
    log('— Új harc —', 'round'); closeModal(); save(); render();
  },
  clearAll: () => {
    if (confirm('Mindenkit eltávolítasz az encounterből?')) { S.enc = {list: [], round: 1, active: null}; selected = null; closeModal(); save(); render(); }
  },
  exportAll: () => {
    S.settings.lastExport = localDate();
    download(`dmscreen-mentes-${localDate()}.json`, {...S, sheets: sheetList()});
    save(); render();
  },
  importAll: () => { fileMode = 'all'; $('#fileIn').click(); },

  // biztonsági mentések
  openBackups: () => openBackups(),
  backupNow: async () => {
    try { if (await addBackup(timeStamp() + '-kezi', 'kézi mentés')) log('💾 Biztonsági mentés elkészült a felhőben'); }
    catch (err) { backupWarn = 'Nem sikerült a mentés (' + (err.code || err.message) + ').'; }
    openBackups();
  },
  backupRestore: async el => {
    const id = el.closest('[data-backup]').dataset.backup;
    if (!confirm('Visszaállítod ezt a mentést? A mostani állapotról előbb automatikusan mentés készül.')) return;
    try { await restoreBackup(id); render(); closeModal(); log('↺ Biztonsági mentés visszaállítva'); }
    catch (err) { alert('A visszaállítás nem sikerült: ' + (err.code || err.message)); }
  },
};

// ---------- kattintásszabályok: a dobások és fülek, nem gombok ----------
// A data-act gombok előtt, ebben a sorrendben nézzük; az első illeszkedő dönt (egy gomb belsejében lévő dobás is csak dob).
const KATTINTASOK = [
  // Csapat nézet: titkos skill-dobás egy játékosnak
  ['td.sk', (sk, e) => { partyRoll([sk.dataset.pc], sk.dataset.sk, dobasMod(e)); }],
  ['th.sortable', th => { setPartySort(th.dataset.sort, /^\d+$/.test(th.dataset.col) ? +th.dataset.col : th.dataset.col); rerenderParty(); }],
  // dobások
  ['.roll', (r, e) => {
    const cidEl = r.closest('[data-cid]');
    const x = cidEl ? byId(cidEl.dataset.cid) : null;
    const who = x ? nameOf(x) : '';
    const label = r.closest('[data-label]')?.dataset.label || r.dataset.label || '';
    if (r.dataset.hit) rollHit(r.dataset.hit, who, label || 'Támadás', dobasMod(e));
    else if (r.dataset.roll) rollDmg(r.dataset.roll, who, label || 'Dobás', e.shiftKey);
    else if (r.dataset.rech) {
      const d = rnd(6), ok = d >= +r.dataset.rech;
      log(`<span class="who">${esc(who)}</span> ${esc(label || 'Recharge')}: d6 = <b>${d}</b> — ${ok ? 'feltöltődött ✓' : 'nem töltődött'}`, ok ? 'crit' : '');
    }
  }],
  ['[data-check],[data-save]', (chk, e) => {
    const x = byId(chk.closest('[data-cid]')?.dataset.cid); if (!x) return;
    const sv = e.target.closest('[data-save]');
    if (sv) rollHit(sgn(+x.c.saves[sv.dataset.save]), nameOf(x), ABIL_FULL[sv.dataset.save] + ' mentő', dobasMod(e));
    else { const a = chk.dataset.check; rollHit(sgn(mod(x.c.abilities[a])), nameOf(x), ABIL_FULL[a] + ' próba', dobasMod(e)); }
  }],
  ['[data-die]', d => { rollDmg(d.dataset.die, '', d.dataset.die.replace('1', '')); }],
  ['[data-tab]', f => { libTab = f.dataset.tab; renderLib(); }],
];

// ---------- események ----------
// a gombok és mezők eseményei (document szinten, data-act / data-* alapján); induláskor kapcsoljuk fel.
function akciokEsemenyek() {
  document.addEventListener('click', async e => {
    const t = e.target;
    for (const [valaszto, fn] of KATTINTASOK) {
      const el = t.closest(valaszto);
      if (el) { fn(el, e); return; }
    }
    const el = t.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (Object.hasOwn(AKCIOK, act)) await AKCIOK[act](el, e);
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.setting) { S.settings[t.dataset.setting] = t.checked; save(); return; }
    if (t.dataset.src) {
      const s = new Set(S.settings.sources);
      t.checked ? s.add(t.dataset.src) : s.delete(t.dataset.src);
      S.settings.sources = [...s]; save(); return;
    }
    if (t.id === 'libKind') { filterLib(); return; }
    if (t.id === 'partyAddSel') { if (t.value) { setPartyMember(t.value, true); rerenderParty(); } return; }
    const x = byId(t.closest('[data-cid]')?.dataset.cid);
    if (!x) return;
    if (t.classList.contains('init')) { x.init = t.value === '' ? null : +t.value; save(); render(); return; }
    const f = t.dataset.f;
    if (!f || f === 'notes') return;
    if (f === 'conc') x.conc = t.checked;
    else if (f === 'init') x.init = t.value === '' ? null : +t.value;
    else if (f === 'hp') { x.hp = Math.max(0, +t.value || 0); x.dead = x.hp === 0 && x.c.kind !== 'pc'; }
    else if (f === 'max') x.c.hp.max = Math.max(1, +t.value || 1);
    else if (f === 'temp') x.temp = Math.max(0, +t.value || 0);
    else if (f === 'ac') x.c.ac = +t.value || 0;
    else if (f === 'side') x.side = t.value;
    else if (f === 'hiddenP') x.hiddenP = t.checked;
    else if (f === 'pubName') x.publicName = t.value.trim();
    save(); render();
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'libSearch') filterLib();
    if (t.id === 'itemQ') filterItems();
    if (t.id === 'partySearch') filterPartyItems(t.value);
    if (t.dataset.f === 'notes') { const x = byId(t.closest('[data-cid]')?.dataset.cid); if (x) { x.notes = t.value; save(); } }
  });
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (selected) { selected = null; render(); } return; }
    if (t.classList?.contains('hpin') && e.key === 'Enter') {
      const x = byId(t.closest('[data-cid]').dataset.cid), n = parseInt(t.value);
      if (n > 0) damage(x, n); else if (n < 0) heal(x, -n);
      if (n) { save(); render(); }
      return;
    }
    if (t.id === 'diceInput' && e.key === 'Enter') { const v = t.value.trim(); if (v) rollDmg(v, '', v); return; }
    if (t.id === 'fiveQ' && e.key === 'Enter') { fiveSearch(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !$('#modal').hidden) return;
    if (e.key === 'n' || e.key === 'N' || e.key === ' ') { e.preventDefault(); lep(1); }
    else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); lep(-1); }
  });

  // beillesztéskor magától importál
  document.addEventListener('paste', e => {
    if (e.target.id !== 'ddbPaste') return;
    const t = e.clipboardData?.getData('text');
    if (t && t.trim().startsWith('{')) { e.preventDefault(); ddbImportText(t); }
  });
}

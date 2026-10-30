// Események (felület): kattintás, módosítás, gépelés, billentyűk és beillesztés kezelése; a gombok data-act alapján (az AKCIOK nyilvántartás az 5. lépésben).
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('akciok', N) és az index.html-ben az akciok.js?v=N és a VART_MODULOK.
'use strict';
modul('akciok', 1);

// ---------- nyilvántartás: data-act="nev" → AKCIOK.nev(el, e) ----------
// Új gomb = új bejegyzés. A kezelő maga rajzol és ment, ha kell.
const dobasMod = e => e.shiftKey ? 'adv' : e.ctrlKey ? 'dis' : '';  // Shift = előny, Ctrl = hátrány
const harcos = el => byId(el.closest('[data-cid]')?.dataset.cid);
const hpMezo = el => el.closest('.tile').querySelector('.hpin').value;
const harcMod = (el, fn) => { fn(harcos(el)); save(); render(); };  // a gomb harcosán változtat, aztán ment és rajzol

const AKCIOK = {
  // harc
  next: () => step(1),
  prev: () => step(-1),
  rollInit: () => openInitMenu(),
  init: el => rollInitiative(el.dataset.mode),
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
  dup: el => { const x = harcos(el); addToEncounter({...x.c, id: x.c.libId || x.c.id}, 1); },
  remove: el => {
    const x = harcos(el);
    if (confirm(`Eltávolítod: ${nameOf(x)}?`)) {
      if (S.enc.active === x.cid) step(1);
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
};

// ---------- események ----------
// a gombok és mezők eseményei (document szinten, data-act / data-* alapján); induláskor kapcsoljuk fel.
// A törzs szándékosan nincs behúzva, hogy a többsoros szövegek betűre változatlanok maradjanak (az 5. lépés az AKCIOK nyilvántartásra bontja).
function akciokEsemenyek() {
document.addEventListener('click', async e => {
  const t = e.target;
  // Csapat nézet: titkos skill-dobás egy játékosnak
  const sk = t.closest('td.sk');
  if (sk) { partyRoll([sk.dataset.pc], sk.dataset.sk, dobasMod(e)); return; }
  const th = t.closest('th.sortable');
  if (th) { setPartySort(th.dataset.sort, /^\d+$/.test(th.dataset.col) ? +th.dataset.col : th.dataset.col); rerenderParty(); return; }
  // dobások
  const r = t.closest('.roll');
  if (r) {
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
    return;
  }
  const chk = t.closest('[data-check],[data-save]');
  if (chk) {
    const x = byId(chk.closest('[data-cid]')?.dataset.cid); if (!x) return;
    const sv = t.closest('[data-save]');
    if (sv) rollHit(sgn(+x.c.saves[sv.dataset.save]), nameOf(x), ABIL_FULL[sv.dataset.save] + ' mentő', dobasMod(e));
    else { const a = chk.dataset.check; rollHit(sgn(mod(x.c.abilities[a])), nameOf(x), ABIL_FULL[a] + ' próba', dobasMod(e)); }
    return;
  }
  if (t.dataset.die) { rollDmg(t.dataset.die, '', t.dataset.die.replace('1', '')); return; }
  if (t.dataset.tab) { libTab = t.dataset.tab; renderLib(); return; }

  const el = t.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (Object.hasOwn(AKCIOK, act)) { await AKCIOK[act](el, e); return; }
  const libEl = el.closest('[data-lib]'), lib = libEl && S.library.find(c => c.id === libEl.dataset.lib);
  const cnt = () => Math.max(1, +(el.closest('.lrow')?.querySelector('.cnt')?.value) || 1);

  switch (act) {
    case 'openLib': openLib(); break;
    case 'menu': openMenu(); break;
    // 'dmscreen-player' itt ablaknév (ugyanaz a lap nyílik újra), nem a CSATORNA
    case 'openPlayer': window.open('player.html','dmscreen-player', 'popup,width=1280,height=800'); break;
    case 'openCharApp': window.open('karakter.html', '_blank'); break;
    case 'portraitUpload': $('#portraitFile').click(); break;
    case 'portraitClear': setPortrait(''); $('#portraitUrl').value = ''; break;
    case 'diffInfo': openDiffInfo(); break;
    case 'openLoot': openLoot(); break;
    case 'openParty': openParty(); break;
    case 'partyRemove': setPartyMember(el.dataset.pc, false); rerenderParty(); break;
    case 'partySortReset': partySort.s = {col: null, dir: 1}; rerenderParty(); break;
    case 'libParty': setPartyMember(lib.id, !partyMembers().some(c => c.id === lib.id)); filterLib(); break;
    case 'partyGroup': partyRoll(partyMembers().map(c => c.id), el.dataset.sk, dobasMod(e)); break;
    case 'partyEdit': {
      const pcLib = S.library.find(c => c.id === el.dataset.pc);
      if (pcLib) openEditor(pcLib, c => { c.id = pcLib.id; upsertLibrary(c, false); setTimeout(openParty); }, undefined, {share: true});
      break;
    }
    case 'lootRoll': rollLootUi(); break;
    case 'lootCopy':
      try { await navigator.clipboard.writeText(lootText(lootResult)); el.textContent = '✓ Kimásolva'; }
      catch { el.textContent = 'A böngésző nem engedte'; }
      break;
    case 'lootLog': log('🎁 ' + esc(lootText(lootResult)).replace(/\n/g, '<br>')); el.textContent = '✓ Naplóban'; break;
    case 'newCreature': openEditor(blankCreature(), c => { upsertLibrary(c, false); log(`📚 ${esc(c.name)} létrehozva`); }, 'Új lény', {share: true}); break;
    case 'edSave': {
      const ow = $('#edForm').elements.owner?.value.trim();
      if (ow && $('#edForm').elements.kind.value === 'pc' && !EMAIL_RE.test(ow.toLowerCase())) { alert('A játékos Google-fiókja nem érvényes e-mail-cím.'); break; }
      const c = readEditor(); const cb = editCb; closeModal(); cb && cb(c); save(); render(); break; }
    case 'edCancel': closeModal(); break;

    // könyvtár
    case 'libAdd': addToEncounter(lib, cnt()); log(`＋ ${cnt()}× ${esc(lib.name)}`); break;
    case 'libEdit': openEditor(lib, c => { c.id = lib.id; upsertLibrary(c, false); setTimeout(() => openLib('lib')); }, undefined, {share: true}); break;
    case 'libExport': download(lib.name.replace(/[^\wáéíóöőúüű -]/gi, '') + '.json', SHEETS[lib.id] || lib); break;
    case 'libDel':
      if (confirm(`Törlöd a könyvtárból: ${lib.name}?${SHEETS[lib.id] ? '\nA telefonos karakterlapja is törlődik (a felhős biztonsági mentésekből visszahozható).' : ''}`)) {
        if (SHEETS[lib.id]) sheetOps.del.add(lib.id);
        S.library = S.library.filter(c => c !== lib); save(); filterLib();
      }
      break;
    case 'libSheet':
      if (SHEETS[lib.id]) window.open('karakter.html#lap/' + lib.id, '_blank');
      else if (confirm(`Telefonos karakterlapot hozol létre ${lib.name} számára a könyvtári adatokból?\nEzután a lap a játékosé: amit a telefonján átír, az ide is átjön. Az osztályt, spell slotokat érdemes a lapon ellenőrizni.`)) {
        createSheet(lib.id, creatureToSheet(lib)); filterLib(); log(`📱 ${esc(lib.name)}: karakterlap létrehozva`);
      }
      break;
    case 'rulebook': openRulebook(); break;
    case 'rbUpdate': el.disabled = true; await rulebookUpdate(); el.disabled = false; break;
    case 'itemAdd': {
      const it = itemResults[+el.closest('[data-item]').dataset.item], to = $('#itemTo')?.value;
      const c = it && to && addItemTo(to, it, cnt());
      if (c) { el.textContent = '✓ ' + c.name; log(`🗡 ${cnt()}× ${esc(it.n)} → ${esc(c.name)}`); }
      break;
    }
    case 'downloadSheetTemplate': download('karakterlap-sablon.json', Sheet.TEMPLATE); break;
    case 'showSheetTemplate': $('#jsonIn').value = JSON.stringify(Sheet.TEMPLATE, null, 2); break;
    case 'addAllPcs': {
      const pcs = S.library.filter(c => c.kind === 'pc' && !S.enc.list.some(x => x.c.libId === c.id));
      pcs.forEach(c => addToEncounter(c, 1));
      log(`＋ ${pcs.length} játékos hozzáadva`); closeModal(); break;
    }
    case 'fiveSearch': fiveSearch(); break;
    case 'fiveAdd': case 'fiveSave': {
      const m = fiveResults[+el.closest('[data-five]').dataset.five];
      const c = convert5e(await resolveCopy(structuredClone(m)));
      if (act === 'fiveAdd') { addToEncounter(c, cnt()); log(`＋ ${cnt()}× ${esc(c.name)}`); }
      else { upsertLibrary(c); el.textContent = '✓ Mentve'; }
      break;
    }
    case 'ddbPasteImport': ddbImportText($('#ddbPaste').value); break;
    case 'ddbClipboard':
      try { ddbImportText(await navigator.clipboard.readText()); }
      catch { $('#ddbMsg').innerHTML = '<p class="muted">A böngésző nem engedte olvasni a vágólapot – kattints a mezőbe, és nyomj Ctrl+V-t.</p>'; }
      break;
    case 'signIn': window.DMAuth?.signIn(); break;
    case 'signOut': closeModal(); window.DMAuth?.signOut(); break;
    case 'reload': location.reload(); break;
    case 'jsonImport':
      try {
        const res = await importAny(JSON.parse($('#jsonIn').value));
        $('#jsonMsg').textContent = `✓ ${res.length} lény importálva: ${res.map(c => c.name).join(', ')}`;
      } catch (err) { $('#jsonMsg').textContent = '⚠ ' + err.message; }
      break;
    case 'showTemplate': $('#jsonIn').value = JSON.stringify(TEMPLATE, null, 2); break;
    case 'downloadTemplate': download('dmscreen-sablon.json', TEMPLATE); break;
    case 'importFile': fileMode = 'creatures'; $('#fileIn').click(); break;
    case 'encSave': {
      const list = S.enc.list.filter(y => y.c.kind !== 'pc').map(y => y.c);
      if (!list.length) { alert('Nincs nem-játékos lény az encounterben.'); break; }
      S.saved.push({id: uid(), name:$('#encName').value.trim() || 'Encounter ' + (S.saved.length + 1), list: structuredClone(list)});
      save(); renderLib(); break;
    }
    case 'encLoad': {
      const enc = S.saved[+el.closest('[data-enc]').dataset.enc];
      const groups = {};
      enc.list.forEach(c => (groups[c.name] = groups[c.name] || []).push(c));
      Object.values(groups).forEach(g => addToEncounter(g[0], g.length));
      log(`⚔ ${esc(enc.name)} betöltve`); closeModal(); break;
    }
    case 'encDel': if (confirm('Törlöd ezt a mentett encountert?')) { S.saved.splice(+el.closest('[data-enc]').dataset.enc, 1); save(); renderLib(); } break;

    // menü
    case 'newFight':
      S.enc.list = S.enc.list.filter(y => y.c.kind === 'pc');
      S.enc.list.forEach(y => { y.init = null; y.cond = []; y.conc = false; y.leg = 0; });
      S.enc.round = 1; S.enc.active = null; selected = null;
      log('— Új harc —', 'round'); closeModal(); save(); render(); break;
    case 'clearAll':
      if (confirm('Mindenkit eltávolítasz az encounterből?')) { S.enc = {list: [], round: 1, active: null}; selected = null; closeModal(); save(); render(); }
      break;
    case 'exportAll':
      S.settings.lastExport = localDate();
      download(`dmscreen-mentes-${localDate()}.json`, {...S, sheets: sheetList()});
      save(); render(); break;
    case 'openBackups': openBackups(); break;
    case 'backupNow':
      try { if (await addBackup(timeStamp() + '-kezi', 'kézi mentés')) log('💾 Biztonsági mentés elkészült a felhőben'); }
      catch (err) { backupWarn = 'Nem sikerült a mentés (' + (err.code || err.message) + ').'; }
      openBackups(); break;
    case 'backupRestore': {
      const id = el.closest('[data-backup]').dataset.backup;
      if (!confirm('Visszaállítod ezt a mentést? A mostani állapotról előbb automatikusan mentés készül.')) break;
      try { await restoreBackup(id); closeModal(); log('↺ Biztonsági mentés visszaállítva'); }
      catch (err) { alert('A visszaállítás nem sikerült: ' + (err.code || err.message)); }
      break;
    }
    case 'importAll': fileMode = 'all'; $('#fileIn').click(); break;
  }
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
  if (e.key === 'n' || e.key === 'N' || e.key === ' ') { e.preventDefault(); step(1); }
  else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); step(-1); }
});

// beillesztéskor magától importál
document.addEventListener('paste', e => {
  if (e.target.id !== 'ddbPaste') return;
  const t = e.clipboardData?.getData('text');
  if (t && t.trim().startsWith('{')) { e.preventDefault(); ddbImportText(t); }
});
}

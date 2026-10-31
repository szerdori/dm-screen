// Zsákmány és Csapat nézet ablaka (felület): rajzolás, rendezés, keresés, csapatdobás.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('ablakok', N) és az index.html-ben az ablakok.js?v=N és a VART_MODULOK.
'use strict';
modul('ablakok', 3);

// ---------- zsákmány (megjelenítés) ----------
function openLoot() {
  const enemies = order().filter(x => sideOf(x) === 'enemy');
  const anyDead = enemies.some(x => x.dead);
  const on = x => (anyDead ? x.dead : true) && !noTreasure(x.c);
  const pool = enemies.filter(on);
  const band = crBand((pool.length ? pool : enemies).reduce((m, x) => crNum(x.c.cr) > crNum(m) ? x.c.cr : m, '0'));
  openModal(`<h2>🎁 Zsákmány</h2>
    <p class="hint">A DMG (2014) kincstáblái alapján. Alapból a legyőzött ellenfelek vannak kiválasztva; állatoknál, oozeoknál és növényeknél a DMG szerint nincs kincs. Egyéni kincs = ellenfelenként érmék; kincshalom = egy nagyobb zsákmány az egész harcért (pl. boss, búvóhely), mágikus tárgyakkal.</p>
    ${enemies.length ? `<div class="rows">${enemies.map(x => `<label class="lrow"><input type="checkbox" class="lootPick" value="${esc(x.cid)}" ${on(x) ? 'checked' : ''}>
      <span class="nm"><b>${esc(nameOf(x))}</b><small>${esc(crLabel(x.c) || 'nincs CR')} · ${esc(x.c.type || '')}${x.dead ? ' · legyőzve' : ''}</small></span></label>`).join('')}</div>`
      : '<p class="muted">Nincs ellenfél az encounterben – csak kincshalmot lehet dobni.</p>'}
    <div class="toolbar" style="margin-top:10px">
      <select id="lootMode"><option value="individual">Egyéni kincs (ellenfelenként)</option><option value="hoard"${enemies.length ? '' : ' selected'}>Kincshalom (az egész harcért)</option><option value="both">Mindkettő</option></select>
      <label class="hint">Kincshalom szintje <select id="lootBand">${BAND_HU.map((l, i) => `<option value="${i}" ${i === band ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="primary" data-act="lootRoll">🎲 Generálás</button>
    </div>
    <div id="lootOut"></div>`);
}
async function rollLootUi() {
  const out = $('#lootOut');
  out.innerHTML = '<p class="muted">Kincstáblák betöltése…</p>';
  let data;
  try { data = await loadLoot(); }
  catch (e) { out.innerHTML = `<p style="color:var(--red)">Nem sikerült betölteni a kincstáblákat (van internet?): ${esc(e.message)}</p>`; return; }
  const picked = [...document.querySelectorAll('.lootPick')].filter(i => i.checked).map(i => byId(i.value)).filter(Boolean);
  const mode = $('#lootMode').value;
  lootResult = generateLoot(data, picked, mode, +$('#lootBand').value);
  const t = lootTotals(lootResult), h = lootResult.hoard;
  const itemLink = n => n.includes('(válassz') ? esc(n) : `<a href="https://5e.tools/items.html#${encodeURIComponent(n.toLowerCase())}_dmg" target="_blank" rel="noopener" style="color:var(--accent)">${esc(n)}</a>`;
  out.innerHTML = `
    ${lootResult.creatures.length ? `<h3>Ellenfelenként</h3>${lootResult.creatures.map(c => `<p><b>${esc(c.name)}</b>${mode !== 'hoard' ? ': ' + esc(coinStr(c.coins) || 'nincs érme') : ''}${c.gear.length ? `<br><small class="muted">Felszerelés: ${esc(c.gear.join(', '))}</small>` : ''}</p>`).join('')}` : ''}
    ${h ? `<h3>Kincshalom (${BAND_HU[h.band]})</h3>
      <p><b>Érmék:</b> ${esc(coinStr(h.coins) || 'nincs')}</p>
      ${h.gems.length ? `<p><b>Drágakövek:</b> ${esc(groupNames(h.gems).join(', '))}</p>` : ''}
      ${h.art.length ? `<p><b>Műtárgyak:</b> ${esc(groupNames(h.art).join(', '))}</p>` : ''}
      <p><b>Mágikus tárgyak:</b> ${h.items.length ? h.items.map(i => itemLink(i.name) + ` <small class="muted">(${esc(i.table)} tábla)</small>`).join(', ') : 'nincs'}</p>` : ''}
    <h3>Összesen</h3>
    <p>${esc(coinStr(t.coins) || '0')} – <b>kb. ${esc(t.gp)} gp</b> értékben${t.each != null ? `, fejenként kb. <b>${esc(t.each)} gp</b> (${esc(t.party)} játékos)` : ''}</p>
    <div class="toolbar"><button data-act="lootRoll">🎲 Újradobás</button><button data-act="lootCopy">📋 Másolás</button><button data-act="lootLog">Naplóba</button></div>`;
}

// ---------- Csapat nézet (megjelenítés) ----------
const PROF_MARK = {2: '◆', 1: '●', 0.5: '½', 0: ''};
const PROF_HU = {2: 'expertise', 1: 'jártas', 0.5: 'fél jártasság (Jack of All Trades)', 0: ''};
// oszlop szerinti rendezés: p = passzív táblázat (sorok = játékosok), s = skill-táblázat (sorok = skillek)
let partySort = {p: {col: null, dir: 1}, s: {col: null, dir: 1}};
const sortArrow = (t, col) => partySort[t].col === col ? (partySort[t].dir > 0 ? ' ▲' : ' ▼') : '';
function setPartySort(t, col) {
  const s = partySort[t];
  if (s.col === col) s.dir = -s.dir;
  else { s.col = col; s.dir = col === 'name' || col === 'skill' ? 1 : -1; }  // számoknál először a legnagyobb
}
function openParty() { openModal(partyHtml(), true); }
// újrarajzolás úgy, hogy a keresés és az utolsó dobás eredménye megmaradjon
function rerenderParty() {
  const q = $('#partySearch')?.value || '', roll = $('#partyRoll')?.innerHTML || '', top = $('#modalBox').scrollTop;
  openParty();
  if ($('#partyRoll')) $('#partyRoll').innerHTML = roll;
  if (q && $('#partySearch')) { $('#partySearch').value = q; filterPartyItems(q); }
  $('#modalBox').scrollTop = top;
}
// jelvény: át van-e állítva a játékos lapja a szabálymotorra (Könyvtár, Csapat)
const LAP_JELVENY = {
  nincs: ['📵 nincs lapja', 'Még nincs telefonos karakterlapja: a Könyvtárban a 📱 gombbal hozhatod létre.'],
  kezi: ['✋ kézi lap', 'Nincs átállítva: a lap Alapadatok fülén az „Átállítás szabálymotorra” gombbal állítható át.'],
  elter: ['⚠ szintek eltérnek', 'Át van állítva, de a felépítés kevesebb szintet tud, mint a lap (pl. a szabálykönyvben nem szereplő osztály): a szintlépés nem indul, amíg a lap Alapadatok fülén nem javítod.'],
  motoros: ['⚙ átállítva', 'A lap a szabálymotorral számol.'],
};
function lapJelveny(id) {
  const k = lapAllapot(id), [cim, tip] = LAP_JELVENY[k];
  return `<span class="lapjel" data-lapjel="${k}" title="${esc(tip)}">${esc(cim)}</span>`;
}
// szintlépés-engedély egy lappal rendelkező játékosnak: ⬆ = +1 szint, ✕ = visszavonás; a felirat mutatja, hányadik szintre vár
function szintlepesGomb(id, hol) {
  const a = szintlepesAllas(id);
  if (!a) return '';
  const ad = `class="small ${a.to ? 'on' : ''}" data-pc="${esc(id)}" ${a.szint >= 20 || a.to >= 20 ? 'disabled' : ''} title="Szintlépés engedélyezése (+1 szint): a játékos telefonján indul a varázsló">⬆${a.to ? ` ${esc(a.to)}. szintre vár` : ' Szintlépés'}</button>`;
  const vissza = `class="small" data-pc="${esc(id)}" title="Az engedély visszavonása (egy szinttel)">✕</button>`;
  return hol === 'lib' ? `<button data-act="libSzintAd" ${ad}${a.to ? `<button data-act="libSzintVissza" ${vissza}` : ''}` : `<button data-act="partySzintAd" ${ad}${a.to ? `<button data-act="partySzintVissza" ${vissza}` : ''}`;
}
function partyMembersBar(pcs) {
  const inParty = new Set(pcs.map(c => c.id));
  const cand = S.library.filter(c => !inParty.has(c.id)).sort((a, b) => (KINDS.indexOf(b.kind) - KINDS.indexOf(a.kind)) || byName(a, b));
  return `<div class="toolbar"><b>Tagok:</b>
    ${pcs.map(c => `<span class="chip" data-act="partyRemove" data-pc="${esc(c.id)}" title="Kivétel a csapatból">${esc(c.name)} ✕</span>`).join('') || '<span class="muted">senki</span>'}
    ${cand.length ? `<select id="partyAddSel"><option value="">＋ Hozzáadás a könyvtárból…</option>${cand.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(KIND_HU[c.kind])})</option>`).join('')}</select>` : ''}
    ${pcs.some(c => szintlepesAllas(c.id)) ? '<button class="small" data-act="partySzintMind" title="Minden lappal rendelkező játékos +1 szintet léphet">⬆ Mindenki</button>' : ''}</div>`;
}
function partyHtml() {
  const pcs = partyMembers();
  if (!pcs.length) return `<h2>👥 Csapat</h2>${partyMembersBar(pcs)}<p class="muted">${S.library.length
    ? 'Nincs senki a csapatban. Tegyél be valakit a fenti listából.'
    : 'Még nincs játékos a könyvtárban. Importáld őket a <b>＋ Hozzáadás / Könyvtár → D&D Beyond</b> fülön, vagy hozz létre egy „Játékos” típusú lényt.'}</p>`;
  const head = pcs.map(c => `<th class="sortable" data-sort="s" data-col="${esc(c.id)}" title="Rendezés ${esc(c.name)} skilljei szerint">${esc(c.name)}${sortArrow('s', c.id)}</th>`).join('');
  // passzív értékek (sorok rendezhetők)
  const prow = pcs.map(c => ({c, v: PASSIVES.map(([k]) => passiveScore(c, k))}));
  const pBest = PASSIVES.map((_, i) => Math.max(...prow.map(r => r.v[i])));
  const ps = partySort.p;
  if (ps.col === 'name') prow.sort((a, b) => byName(a.c, b.c) * ps.dir);
  else if (ps.col != null) prow.sort((a, b) => ((a.v[ps.col] - b.v[ps.col]) || byName(a.c, b.c) * ps.dir) * ps.dir);  // egyenlőségnél mindig ábécérend
  const passives = `<table class="ptable"><tr><th class="sortable" data-sort="p" data-col="name">Név${sortArrow('p', 'name')}</th>${PASSIVES.map(([, l], i) => `<th class="sortable" data-sort="p" data-col="${i}">Passive ${l}${sortArrow('p', i)}</th>`).join('')}<th>Látás</th><th>Nyelvek</th></tr>
    ${prow.map(({c, v}) => `<tr><td><b>${esc(c.name)}</b></td>${v.map((x, i) => `<td class="${x === pBest[i] ? 'best' : ''}">${esc(x)}</td>`).join('')}
      <td>${esc((c.senses.match(/darkvision\s*\d+\s*ft\.?/i) || ['–'])[0])}</td><td style="white-space:normal;text-align:left">${esc(c.languages || '–')}</td></tr>`).join('')}</table>`;
  // skill-táblázat: alapból képességek szerint; rendezhető ábécébe vagy egy tag bónusza szerint
  let keys = ['str', 'dex', 'int', 'wis', 'cha'].flatMap(a => Object.keys(SKILLS).filter(k => SKILLS[k] === a));
  const ss = partySort.s, sortPc = pcs.find(c => c.id === ss.col);
  if (ss.col === 'skill') keys.sort((a, b) => a.localeCompare(b) * ss.dir);
  else if (sortPc) keys = keys.map((k, i) => [k, i]).sort((a, b) => ((partySkill(sortPc, a[0]).b - partySkill(sortPc, b[0]).b) * ss.dir) || a[1] - b[1]).map(x => x[0]);
  const rows = keys.map(k => {
    const vals = pcs.map(c => partySkill(c, k)), top = Math.max(...vals.map(v => v.b));
    return `<tr><td>${esc(skillLabel(k))} <span class="ab">${SKILLS[k].toUpperCase()}</span></td>
      ${vals.map((v, i) => `<td class="sk ${v.b === top ? 'best' : ''}" data-pc="${esc(pcs[i].id)}" data-sk="${k}" title="${esc(pcs[i].name)} – ${esc(skillLabel(k))}${v.p ? ' (' + PROF_HU[v.p] + ')' : ''}. Kattints: titkos dobás · Shift: előny · Ctrl: hátrány">${esc(sgn(v.b))}<span class="pmark">${PROF_MARK[v.p]}</span></td>`).join('')}
      <td><button class="small" data-act="partyGroup" data-sk="${k}" title="Mindenki dob erre a skillre">Mindenki</button></td></tr>`;
  }).join('');
  const skills = `<table class="ptable"><tr><th class="sortable" data-sort="s" data-col="skill">Skill${sortArrow('s', 'skill')}</th>${head}<th>${ss.col ? '<button class="small" data-act="partySortReset" title="Vissza a képességek szerinti sorrendhez">alap sorrend</button>' : ''}</th></tr>${rows}</table>
    <p class="hint">● jártas · ◆ expertise · ½ fél jártasság (Jack of All Trades) · aranyszínű = a csapat legjobbja · a fejlécre kattintva rendezhető (▼ csökkenő, ▲ növekvő)</p>`;
  // karakterkártyák
  const item = i => `<li data-item="${esc((i.name + ' ' + i.note + ' ' + i.container).toLowerCase())}"><span class="${i.magic ? 'mag' : ''}" title="${esc(i.rarity)}">${i.qty !== 1 ? esc(i.qty) + '× ' : ''}${esc(i.name)}</span>${i.attuned ? '<span class="flag">✦ hangolva</span>' : i.equipped ? '<span class="flag">viselve</span>' : ''}${i.note ? `<br><span class="note">${esc(i.note)}</span>` : ''}</li>`;
  const card = c => {
    const main = c.inventory.filter(i => !i.container).sort((a, b) => (b.attuned - a.attuned) || (b.equipped - a.equipped) || (b.magic - a.magic));
    const groups = [...new Set(c.inventory.filter(i => i.container).map(i => i.container))];
    return `<div class="pcard" data-pcard="${esc(c.id)}">
      <h3>${c.portrait ? `<img class="av" src="${esc(c.portrait)}" alt="" onerror="this.style.display='none'">` : ''}${esc(c.name)}</h3>
      <div class="muted" style="font-size:12px">${esc(c.type)} · AC ${esc(c.ac)} · HP ${esc(c.hp.max)} · ${esc(c.speed)}${c.kind === 'pc' ? ' · ' + lapJelveny(c.id) : ''}</div>
      <h4>Pénz</h4><div>${esc(coinStr(c.currency) || '–')}${coinsGp(c.currency) ? ` <span class="muted">(≈ ${esc(coinsGp(c.currency))} gp)</span>` : ''}</div>
      <h4>Felszerelés</h4>${c.inventory.length ? `<ul class="inv">${main.map(item).join('')}</ul>
        ${groups.map(g => `<h4>🎒 ${esc(g)}</h4><ul class="inv">${c.inventory.filter(i => i.container === g).map(item).join('')}</ul>`).join('')}` : '<div class="muted">–</div>'}
      <h4>Eszközök, hangszerek</h4><div>${esc(c.tools || '–')}</div>
      ${c.notes ? `<h4>Jegyzet</h4><div style="white-space:pre-wrap">${esc(c.notes)}</div>` : ''}
      <div class="hint" style="margin-top:6px">${c.importedAt ? `D&D Beyond import: ${esc(c.importedAt)} – frissítéshez importáld újra a könyvjelzővel.` : ''}
        <button class="small" data-act="partyEdit" data-pc="${esc(c.id)}">✎ Szerkesztés</button> ${szintlepesGomb(c.id, 'party')}</div>
    </div>`;
  };
  const total = {}; pcs.forEach(c => COINS.forEach(k => total[k] = (total[k] || 0) + (c.currency[k] || 0)));
  return `<h2>👥 Csapat</h2>
    ${partyMembersBar(pcs)}
    <div id="partyRoll" class="le"></div>
    <h3>Passzív értékek</h3>${passives}
    <h3>Skillek</h3>${skills}
    <h3>Felszerelés</h3>
    <div class="toolbar"><input id="partySearch" placeholder="Keresés a tárgyak között (pl. kötél, potion, scroll)…" style="flex:1"><span id="partySearchInfo" class="hint"></span>
      <span>Csapat pénze: <b>${esc(coinStr(total) || '0')}</b> <span class="muted">(≈ ${esc(coinsGp(total))} gp)</span></span></div>
    <div class="pcards">${pcs.map(card).join('')}</div>`;
}
function filterPartyItems(q) {
  q = q.trim().toLowerCase();
  let hits = 0;
  document.querySelectorAll('#modalBox [data-item]').forEach(li => { const show = !q || li.dataset.item.includes(q); li.hidden = !show; if (show && q) hits++; });
  document.querySelectorAll('#modalBox .pcard').forEach(card => card.style.opacity = q && !card.querySelector('[data-item]:not([hidden])') ? 0.35 : 1);
  $('#partySearchInfo').textContent = q ? `${hits} találat` : '';
}
function partyRoll(ids, k, mode) {
  const res = ids.map(id => S.library.find(c => c.id === id)).filter(Boolean)
    .map(c => rollHit(sgn(partySkill(c, k).b), c.name, skillLabel(k), mode));
  $('#partyRoll').innerHTML = '🎲 ' + res.map(r => r.html).join(' &nbsp;·&nbsp; ');
}

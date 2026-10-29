// Könyvtár ablak (felület): a fülek (könyvtár, 5e.tools, D&D Beyond, tárgyak, JSON, mentett encounterek) és a fájlbetöltés.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('konyvtar-ablak', N) és az index.html-ben a konyvtar-ablak.js?v=N és a VART_MODULOK.
'use strict';
modul('konyvtar-ablak', 1);

let libTab = 'lib';
// ---------- könyvtár ----------
function openLib(tab) { if (tab) libTab = tab; openModal('<div id="libRoot"></div>'); renderLib(); }
function renderLib() {
  const root = $('#libRoot'); if (!root) return;
  const tabs = [['lib', '📚 Könyvtár'], ['five', '🐉 5e.tools'], ['ddb', '🧝 D&D Beyond'], ['json', '{ } JSON / Sablon'], ['items', '🗡 Tárgyak'], ['enc', '⚔ Mentett encounterek']];
  let body = '';
  if (libTab === 'lib') body = libTabHtml();
  if (libTab === 'items') body = itemsTabHtml();
  if (libTab === 'five') body = fiveTabHtml();
  if (libTab === 'ddb') body = ddbTabHtml();
  if (libTab === 'json') body = jsonTabHtml();
  if (libTab === 'enc') body = encTabHtml();
  root.innerHTML = `<h2>Hozzáadás / Könyvtár</h2>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="${libTab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}
      <span class="grow"></span>
      <label class="hint"><input type="checkbox" data-setting="rollHp" ${S.settings.rollHp ? 'checked' : ''}> HP dobása formula alapján</label>
      <label class="hint"><input type="checkbox" data-setting="groupInit" ${S.settings.groupInit ? 'checked' : ''}> közös initiative csoportoknak</label>
    </div>${body}`;
  if (libTab === 'lib') filterLib();
}
function libTabHtml() {
  return `<div class="toolbar">
      <input id="libSearch" placeholder="Keresés…" style="flex:1">
      <select id="libKind"><option value="">mind</option><option value="pc">Játékosok</option><option value="npc">NPC-k</option><option value="monster">Ellenfelek</option></select>
      <button data-act="addAllPcs">＋ Összes játékos</button>
      <button data-act="newCreature">✎ Új lény</button>
    </div><div class="rows" id="libRows"></div>`;
}
// ha a Könyvtár lista épp nyitva van, frissül (pl. egy telefonos lap változása után)
function konyvtarFrissit() { if ($('#libRows')) filterLib(); }
function filterLib() {
  const q = ($('#libSearch')?.value || '').toLowerCase(), k = $('#libKind')?.value || '';
  const items = S.library.filter(c => (!k || c.kind === k) && c.name.toLowerCase().includes(q))
    .sort((a, b) => (a.kind === 'pc' ? 0 : 1) - (b.kind === 'pc' ? 0 : 1) || a.name.localeCompare(b.name, 'hu'));
  const party = new Set(partyMembers().map(c => c.id));
  $('#libRows').innerHTML = items.length ? items.map(c => `<div class="lrow" data-lib="${esc(c.id)}">
      <span class="nm"><b>${esc(c.name)}</b><small>${KIND_HU[c.kind]} · ${esc(crLabel(c))} · AC ${esc(c.ac)} · HP ${esc(c.hp.max)} · ${esc(c.source || '')}${c.share ? ` · <span title="Játékos app">📱 ${c.share.vis === 'party' ? 'csapat látja' : 'csak DM'}${c.owner ? ' · ' + esc(c.owner) : ''}</span>` : ''}</small></span>
      <input type="number" min="1" value="1" class="cnt" title="Darabszám">
      <button class="primary" data-act="libAdd">＋ Encounterbe</button>
      ${c.kind === 'pc' ? `<button class="small ${SHEETS[c.id] ? 'on' : ''}" data-act="libSheet" title="${SHEETS[c.id] ? 'Van telefonos karakterlapja – kattints a megnyitáshoz' : 'Telefonos karakterlap létrehozása a könyvtári adatokból'}">📱</button>` : ''}
      <button class="small ${party.has(c.id) ? 'on' : ''}" data-act="libParty" title="${party.has(c.id) ? 'A csapatban van – kattints a kivételhez' : 'Betétel a csapatba (👥 Csapat nézet)'}">👥</button>
      <button class="small" data-act="libEdit" title="Szerkesztés">✎</button>
      <button class="small" data-act="libExport" title="Letöltés JSON-ként">⬇</button>
      <button class="small" data-act="libDel" title="Törlés">🗑</button>
    </div>`).join('') : `<p class="muted">A könyvtár üres${q ? ' erre a keresésre' : ''}. Importálj az 5e.tools / D&D Beyond / JSON füleken, vagy hozz létre új lényt.</p>`;
}

// ---------- 5e.tools (megjelenítés: fül, keresés) ----------
function fiveTabHtml() {
  if (!fiveIndex) {
    loadFiveIndex().then(renderLib).catch(e => { const el = $('#fiveMsg'); if (el) el.textContent = 'Nem sikerült elérni az 5e.tools adatokat (van internet?): ' + e.message; });
    return '<p id="fiveMsg" class="muted">Forráslista betöltése…</p>';
  }
  const keys = Object.keys(fiveIndex).sort((a, b) => (S.settings.sources.includes(b) - S.settings.sources.includes(a)) || a.localeCompare(b));
  return `<p class="hint">Beilleszthetsz 5e.tools linket is (pl. <code>https://5e.tools/bestiary.html#skeleton_mm</code>), vagy név szerint kereshetsz a bejelölt könyvekben. 2014-es szabályokhoz: MM = 2014-es Monster Manual, VGM = Volo's, MTF = Mordenkainen's Tome of Foes, MPMM = Monsters of the Multiverse (2022-es átdolgozás). Az XMM a 2024-es Monster Manual. Az első keresés egy-két másodpercig tölt.</p>
    <div class="srcs">${keys.map(k => `<label><input type="checkbox" data-src="${k}" ${S.settings.sources.includes(k) ? 'checked' : ''}> ${k}</label>`).join('')}</div>
    <div class="toolbar" style="margin-top:10px"><input id="fiveQ" placeholder="5e.tools link, vagy szörny neve angolul (pl. goblin)" style="flex:1"><button class="primary" data-act="fiveSearch">Keresés</button></div>
    <div id="fiveMsg" class="hint"></div><div class="rows" id="fiveRows"></div>`;
}
async function fiveSearch() {
  const q = ($('#fiveQ').value || '').trim().toLowerCase();
  // 5e.tools link, pl. https://5e.tools/bestiary.html#skeleton_xmm
  const link = q.match(/bestiary\.html#([^,]+)_([a-z0-9-]+)/i);
  if (link) {
    $('#fiveMsg').textContent = 'Betöltés…';
    try {
      const name = decodeURIComponent(link[1]).toLowerCase();
      const idx = await loadFiveIndex();
      const src = Object.keys(idx).find(k => k.toLowerCase() === link[2].toLowerCase());
      if (!src) throw new Error('ismeretlen forrás: ' + link[2]);
      fiveResults = (await loadFiveSource(src)).filter(m => m.name.toLowerCase() === name);
      $('#fiveMsg').textContent = fiveResults.length ? '' : 'Nem találtam ilyen szörnyet ebben a forrásban.';
    } catch (e) { $('#fiveMsg').textContent = 'Hiba: ' + e.message; fiveResults = []; }
    renderFiveRows();
    return;
  }
  const srcs = S.settings.sources;
  if (!srcs.length) { $('#fiveMsg').textContent = 'Jelölj ki legalább egy forrást.'; return; }
  $('#fiveMsg').textContent = 'Betöltés…';
  try {
    const all = (await Promise.all(srcs.map(s => loadFiveSource(s).catch(() => [])))).flat();
    fiveResults = all.filter(m => m.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 100);
    $('#fiveMsg').textContent = `${fiveResults.length} találat${fiveResults.length === 100 ? ' (az első 100)' : ''}`;
    renderFiveRows();
  } catch (e) { $('#fiveMsg').textContent = 'Hiba: ' + e.message; }
}
function renderFiveRows() {
  $('#fiveRows').innerHTML = fiveResults.map((m, i) => {
    const cr = typeof m.cr === 'object' ? m.cr?.cr : m.cr;
    return `<div class="lrow" data-five="${i}"><span class="nm"><b>${esc(m.name)}</b><small>${esc(m.source)} · ${cr != null ? 'CR ' + esc(cr) : ''} · ${esc(fiveType(m.type))}</small></span>
      <input type="number" min="1" value="1" class="cnt"><button class="primary" data-act="fiveAdd">＋ Encounterbe</button><button data-act="fiveSave">📚 Könyvtárba</button></div>`;
  }).join('');
}

// ---------- D&D Beyond (megjelenítés: fül, könyvjelző) ----------
// könyvjelző: a D&D Beyond karakterlapján futva lekéri a karaktert, és a vágólapra másolja
const BOOKMARKLET = "javascript:(async()=>{const m=location.pathname.match(/characters\\/(\\d+)/);" +
  "if(!m||!/dndbeyond\\.com$/.test(location.hostname)){alert('Nyisd meg a karakterlapot a D&D Beyondon, és ott kattints erre a könyvjelzőre!');return}" +
  "const ok='Kimásolva! Most a DM Screenben: Hozzáadás → D&D Beyond fül → Ctrl+V a mezőbe.';" +
  "try{const r=await fetch('https://character-service.dndbeyond.com/character/v5/character/'+m[1],{credentials:'include'});" +
  "if(!r.ok)throw new Error('HTTP '+r.status+(r.status===403||r.status===404?' – privát a karakter?':''));const t=await r.text();" +
  "try{await navigator.clipboard.writeText(t)}catch(e){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}" +
  "alert(ok)}catch(e){alert('Nem sikerült letölteni a karaktert: '+e.message)}})()";
function ddbTabHtml() {
  return `<h3 style="margin-top:0">1. Egyszeri beállítás: könyvjelző</h3>
    <p>Fogd meg az egérrel ezt a gombot, és <b>húzd fel a böngésző könyvjelzősávjára</b>:
      <a href="${esc(BOOKMARKLET)}" class="primary" style="display:inline-block;background:var(--accent);color:#1a1405;font-weight:700;padding:6px 14px;border-radius:6px;text-decoration:none;margin-left:6px" onclick="alert('Ezt nem itt kell megnyomni: húzd fel a könyvjelzősávra, és a D&D Beyond karakterlapján kattints rá.');return false">📋 DM Screen import</a></p>
    <p class="hint">Ha nem látod a könyvjelzősávot: Ctrl+Shift+B.</p>
    <h3>2. Importálás</h3>
    <p>Nyisd meg a karakter lapját a D&D Beyondon (pl. <code>dndbeyond.com/characters/12345678</code>), és kattints a <b>📋 DM Screen import</b> könyvjelzőre. Utána gyere vissza ide, és illeszd be (Ctrl+V) a lenti mezőbe – magától importálja.</p>
    <textarea id="ddbPaste" rows="4" placeholder="Ide illeszd be (Ctrl+V)…"></textarea>
    <div class="toolbar"><button data-act="ddbClipboard">📋 Beillesztés a vágólapról</button><button data-act="ddbPasteImport">Importálás</button></div>
    <div id="ddbMsg"></div>
    <p class="hint">A nyilvános karakterek biztosan működnek (karakter → Edit → Home → Character Privacy: Public). A HP, AC, mentők, fegyveres támadások, képességek, varázslatok és a portré importálódik; az AC-t érdemes egyszer ellenőrizni. Újraimportálás (pl. szintlépés után) felülírja a könyvtárban a korábbi változatot.</p>`;
}
function ddbImportText(t) {
  try { ddbDone(convertDDB(JSON.parse(t))); $('#ddbPaste').value = ''; }
  catch (err) { $('#ddbMsg').innerHTML = `<p style="color:var(--red)">Ez nem D&D Beyond karakter – a könyvjelzővel másold ki újra. (${esc(err.message)})</p>`; }
}
function ddbDone(c) {
  c = upsertLibrary(c);
  $('#ddbMsg').innerHTML = `<div class="lrow" data-lib="${esc(c.id)}"><span class="nm">✓ <b>${esc(c.name)}</b><small>${esc(c.type)} · AC ${esc(c.ac)} · HP ${esc(c.hp.max)}</small></span>
    <input type="number" class="cnt" value="1" hidden><button class="primary" data-act="libAdd">＋ Encounterbe</button><button data-act="libEdit">✎ Ellenőrzés</button></div>`;
}


// ---------- tárgyak a szabálykönyvből a játékosok felszereléséhez ----------
function itemsTabHtml() {
  if (!rulebook) {
    getRulebook().then(() => { if (libTab === 'items') renderLib(); }).catch(e => { const el = $('#itemMsg'); if (el) el.textContent = '⚠ Nem sikerült betölteni a tárgylistát (van internet?): ' + e.message; });
    return '<p id="itemMsg" class="muted">Tárgylista betöltése…</p>';
  }
  const pcs = S.library.filter(c => c.kind === 'pc').sort(byName);
  return `<p class="hint">Tárgyak a szabálykönyvből (PHB, DMG, XGE, TCE – a +1 fegyverek, Flame Tongue és hasonló variánsok is, minden alaptárgyra). A kiválasztott játékos felszerelésébe kerül; ha van telefonos karakterlapja, oda is azonnal.</p>
    <div class="toolbar"><input id="itemQ" placeholder="Tárgy neve, pl. bag of holding, +1 longsword…" style="flex:1">
      <label class="hint">Kinek: <select id="itemTo">${pcs.length ? pcs.map(c => `<option value="${esc(c.id)}">${esc(c.name)}${SHEETS[c.id] ? ' 📱' : ''}</option>`).join('') : '<option value="">(nincs játékos a könyvtárban)</option>'}</select></label></div>
    <div class="rows" id="itemRows"><p class="muted">Írd be a tárgy nevét (angolul).</p></div>`;
}
function filterItems() {
  const q = $('#itemQ')?.value || '';
  itemResults = Sheet.search(Sheet.allItems(rulebook.rb), q, 40);
  $('#itemRows').innerHTML = itemResults.map((it, i) => `<div class="lrow" data-item="${i}"><span class="nm"><b>${esc(it.n)}</b><small>${esc(Sheet.itemLine(it))} · ${esc(it.s)}</small>
      ${it.tx ? `<details><summary class="hint">leírás</summary><div class="hint" style="white-space:pre-wrap">${esc(it.tx)}</div></details>` : ''}</span>
      <input type="number" min="1" value="1" class="cnt" title="Darabszám"><button class="primary" data-act="itemAdd">＋ Hozzáadás</button></div>`).join('')
    || `<p class="muted">${q.trim() ? 'Nincs találat.' : 'Írd be a tárgy nevét (angolul).'}</p>`;
}

// ---------- JSON / sablon (megjelenítés: fül, fájl) ----------
function jsonTabHtml() {
  return `<p>Illessz be JSON-t: a saját sablon szerinti lényt (egyet vagy tömböt), 5e.tools szörny JSON-t, D&D Beyond karakter JSON-t vagy <b>telefonos karakterlapot</b> (karakterlap-sablon) – a program felismeri.</p>
    <div class="toolbar"><button data-act="downloadTemplate">⬇ Sablon letöltése</button><button data-act="showTemplate">Sablon betöltése ide</button><button data-act="importFile">Fájl megnyitása…</button><button data-act="newCreature">✎ Új lény űrlappal</button></div>
    <div class="toolbar"><button data-act="downloadSheetTemplate">⬇ Karakterlap-sablon letöltése</button><button data-act="showSheetTemplate">Karakterlap-sablon betöltése ide</button></div>
    <textarea id="jsonIn" rows="16" placeholder='{ "name": "...", "ac": 13, "hp": {"max": 22}, ... }'></textarea>
    <div class="toolbar"><button class="primary" data-act="jsonImport">Importálás a könyvtárba</button><span id="jsonMsg" class="hint"></span></div>`;
}
let fileMode = 'creatures';
// a rejtett fájlválasztó (#fileIn): lények JSON-ból vagy teljes mentésfájl (fileMode); induláskor kapcsoljuk fel
function fajlBetoltesEsemenyek() {
  $('#fileIn').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (fileMode === 'all') {
        if (!confirm('Felülírja a jelenlegi könyvtárat és encountert. Folytatod?')) return;
        importBackup(obj); closeModal();
      } else {
        const res = await importAny(obj);
        openLib('lib');
        log(`📚 ${res.length} lény importálva: ${esc(res.map(c => c.name).join(', '))}`);
      }
    } catch (err) { alert('Hibás fájl: ' + err.message); }
  });
}
// ---------- mentett encounterek ----------
function encTabHtml() {
  return `<p>Előre összerakott harcok. Mentéskor az encounterben lévő <b>nem játékos</b> lények kerülnek bele; betöltéskor hozzáadódnak a mostani encounterhez (a játékosok maradnak).</p>
    <div class="toolbar"><input id="encName" placeholder="Encounter neve, pl. Romos kápolna – kultisták" style="flex:1"><button class="primary" data-act="encSave">Jelenlegi mentése</button></div>
    <div class="rows">${S.saved.length ? S.saved.map((e, i) => `<div class="lrow" data-enc="${i}"><span class="nm"><b>${esc(e.name)}</b><small>${esc(summarize(e.list))}</small></span>
      <button class="primary" data-act="encLoad">Betöltés</button><button class="small" data-act="encDel">🗑</button></div>`).join('') : '<p class="muted">Még nincs mentett encounter.</p>'}</div>`;
}

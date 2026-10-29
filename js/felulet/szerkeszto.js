// Lényszerkesztő (felület): a szerkesztő ablak, a megosztási mezők és a portré.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('szerkeszto', N) és az index.html-ben a szerkeszto.js?v=N és a VART_MODULOK.
'use strict';
modul('szerkeszto', 1);

// ---------- portré ----------
function setPortrait(v) {
  $('#edForm').elements.portrait.value = v;
  const pv = $('#portraitPv');
  pv.src = v; pv.style.visibility = v ? 'visible' : 'hidden';
}
// a szerkesztő eseményei: portré feltöltése (kicsinyítve) vagy címe, és a fajta váltása; induláskor kapcsoljuk fel
function szerkesztoEsemenyek() {
  // feltöltött kép kicsinyítése 256 px-re, hogy ne hízzon meg a mentés
  document.addEventListener('change', e => {
    if (e.target.id !== 'portraitFile' || !e.target.files[0]) return;
    const img = new Image();
    img.onload = () => {
      const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
      const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
      cv.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
      setPortrait(cv.toDataURL('image/jpeg', 0.85));
      $('#portraitUrl').value = ''; $('#portraitUrl').placeholder = '(feltöltött kép)';
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(e.target.files[0]);
  });
  document.addEventListener('input', e => { if (e.target.id === 'portraitUrl') setPortrait(e.target.value.trim()); });
  document.addEventListener('change', e => { if (e.target.name === 'kind' && e.target.closest('#edForm')) syncShareBox(); });
}
// ---------- szerkesztő ablak ----------
let editCb = null;
// a játékos app beállításai csak könyvtárbeli lénynél (share: true) látszanak; a típustól függ, mi jelenik meg
function shareFieldsHtml(c, note = '') {
  const sh = c.share || {vis: 'dm', hp: 'label', ac: false};
  const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  return `<div class="w4 form" id="shareBox" style="border:1px solid var(--line);border-radius:6px;padding:8px">
      <div class="w4"><b>📱 Játékos app</b> <span class="hint">– mi látszik a játékosok telefonján</span></div>
      <label class="w2" data-for="pc">A játékos Google-fiókja (e-mail)<input type="email" name="owner" value="${esc(c.owner || '')}" placeholder="pl. jatekos@gmail.com"></label>
      <label>Ki láthatja<select name="shareVis">${opt('party', 'az egész csapat', sh.vis)}${opt('dm', 'csak a DM', sh.vis)}</select></label>
      <label data-for="npc">HP a játékosoknak<select name="shareHp">${opt('exact', 'pontos érték', sh.hp)}${opt('label', 'csak állapot (Sérült…)', sh.hp)}</select></label>
      <label data-for="npc">AC a játékosoknak<select name="shareAc">${opt('1', 'látszik', sh.ac ? '1' : '0')}${opt('0', 'rejtve', sh.ac ? '1' : '0')}</select></label>
      <p class="hint w4" data-for="pc">A játékos a saját karakterét mindig látja. „Csak a DM” esetén a többi játékos nem látja.</p>
      <p class="hint w4" data-for="npc">„Csak a DM” esetén a játékosok egyáltalán nem látják ezt az NPC-t. A statok, akciók és jegyzetek sosem látszanak.</p>
      ${note ? `<p class="hint w4">${esc(note)}</p>` : ''}
    </div>`;
}
function syncShareBox() {
  const fm = $('#edForm'), box = fm && fm.querySelector('#shareBox'); if (!box) return;
  const k = fm.elements.kind.value;
  box.hidden = k === 'monster';
  box.querySelectorAll('[data-for]').forEach(el => el.hidden = el.dataset.for !== k);
}
function openEditor(creature, cb, title = 'Lény szerkesztése', opts = {}) {
  const c = normCreature(structuredClone(creature));
  editCb = cb;
  const f = (k, l, cls = '', type = 'text') => `<label class="${cls}">${l}<input type="${type}" name="${k}" value="${esc(c[k] ?? '')}"></label>`;
  openModal(`<h2>${esc(title)}</h2>
    <form id="edForm" class="form" onsubmit="return false">
      ${c.kind === 'pc' && SHEETS[c.libId || c.id] ? `<p class="hint w4" style="border:1px solid var(--accent);border-radius:6px;padding:6px 8px">📱 Ennek a karakternek telefonos karakterlapja van, az adatai onnan jönnek.
        ${c.libId ? 'Az itteni (csak erre a harcra szóló) módosítás a lap következő változásakor felülíródik; a HP-t a harc csempéjén állítsd, az visszaíródik a lapra.'
          : 'A név, AC, HP, képességértékek, felszerelés, pénz és a gazda módosítása visszaíródik a lapra; a többi (skillek, mentők, akciók, jellemzők) a lapról számolódik, azt a karakterlapon írd át.'}</p>` : ''}
      ${f('name', 'Név', 'w2')}
      <label>Típus<select name="kind">${Object.entries(KIND_HU).map(([k, l]) => `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${f('cr', 'CR / szint')}
      ${f('size', 'Méret')}${f('type', 'Fajta (type)')}${f('alignment', 'Alignment')}${f('source', 'Forrás')}
      ${f('ac', 'AC', '', 'number')}${f('acNote', 'AC megjegyzés')}
      <label>HP max<input type="number" name="hpMax" value="${esc(c.hp.max)}"></label>
      <label>HP formula<input name="hpFormula" value="${esc(c.hp.formula)}" placeholder="pl. 8d8+16"></label>
      ${f('speed', 'Speed', 'w2')}
      <label>Initiative bónusz<input name="initBonus" value="${c.initBonus ?? ''}" placeholder="üres = DEX"></label>
      ${f('legendaryCount', 'Legendás akció / kör', '', 'number')}
      <div class="w4" style="display:flex;gap:10px;align-items:center">
        <img class="pv" id="portraitPv" src="${esc(c.portrait || '')}" alt="" ${c.portrait ? '' : 'style="visibility:hidden"'}>
        <label style="flex:1">Portré – kép linkje, vagy tölts fel egy képet a gépedről
          <input id="portraitUrl" value="${c.portrait?.startsWith('data:') ? '' : esc(c.portrait || '')}" placeholder="${c.portrait?.startsWith('data:') ? '(feltöltött kép)' : 'https://…'}"></label>
        <input type="hidden" name="portrait" value="${esc(c.portrait || '')}">
        <button type="button" data-act="portraitUpload">Kép feltöltése…</button>
        <button type="button" data-act="portraitClear">Törlés</button>
        <input type="file" id="portraitFile" accept="image/*" hidden>
      </div>
      <div class="w4" style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">${ABIL.map(a => `<label>${a.toUpperCase()}<input type="number" name="ab_${a}" value="${esc(c.abilities[a])}"></label>`).join('')}</div>
      <label class="w2">Mentők (pl. dex +5, wis +3)<input name="saves" value="${esc(ABIL.filter(a => c.saves[a] != null).map(a => a + ' ' + sgn(+c.saves[a])).join(', '))}"></label>
      ${f('skills', 'Skills', 'w2')}${f('senses', 'Senses', 'w2')}${f('languages', 'Languages', 'w2')}
      ${f('resist', 'Resistances', 'w2')}${f('immune', 'Immunities', 'w2')}${f('vuln', 'Vulnerabilities', 'w2')}${f('condImmune', 'Condition immunities', 'w2')}
      ${SECTIONS.map(k => `<label class="w4">${SECTION_HU[k]} <span class="hint">– elemenként: „Név. Szöveg”, az elemek között üres sor</span><textarea name="sec_${k}" rows="${k === 'actions' ? 7 : 3}">${esc(sectionToText(c[k]))}</textarea></label>`).join('')}
      <label class="w4">Jegyzet<textarea name="notes" rows="2">${esc(c.notes)}</textarea></label>
      <label class="w4">Felszerelés <span class="hint">– soronként egy tárgy, pl. „3× Fáklya” vagy „Kötél [Backpack]”${c.importedAt ? '; D&D Beyond-os játékosnál az újraimportálás felülírja' : ''}</span><textarea name="inventory" rows="4">${esc(inventoryToText(c.inventory))}</textarea></label>
      <div class="w4" style="display:grid;grid-template-columns:repeat(5,1fr) 3fr;gap:8px">${['pp', 'gp', 'ep', 'sp', 'cp'].map(k => `<label>${k}<input type="number" min="0" name="cur_${k}" value="${esc(c.currency[k])}"></label>`).join('')}
        <label>Eszköz-, hangszer-jártasságok<input name="tools" value="${esc(c.tools)}"></label></div>
      ${opts.share ? shareFieldsHtml(c, opts.shareNote) : ''}
    </form>
    <div class="toolbar" style="margin-top:12px"><button class="primary" data-act="edSave">Mentés</button><button data-act="edCancel">Mégse</button></div>`);
  $('#edForm')._base = c;
  syncShareBox();
}
function readEditor() {
  const fm = $('#edForm'), c = fm._base, v = n => fm.elements[n].value;
  for (const k of ['name', 'kind', 'cr', 'size', 'type', 'alignment', 'source', 'acNote', 'speed', 'skills', 'senses', 'languages', 'resist', 'immune', 'vuln', 'condImmune', 'notes']) c[k] = v(k);
  c.ac = +v('ac') || 10;
  c.hp = {...c.hp, max: +v('hpMax') || 1, formula: v('hpFormula')};
  c.initBonus = v('initBonus').trim() === '' ? null : parseInt(v('initBonus'));
  c.legendaryCount = +v('legendaryCount') || 0;
  c.portrait = v('portrait');
  c.inventory = textToInventory(v('inventory'), c.inventory);
  c.currency = {}; ['pp', 'gp', 'ep', 'sp', 'cp'].forEach(k => c.currency[k] = Math.max(0, +v('cur_' + k) || 0));
  c.tools = v('tools');
  ABIL.forEach(a => c.abilities[a] = +v('ab_' + a) || 10);
  c.saves = {};
  for (const m of v('saves').matchAll(/(str|dex|con|int|wis|cha)\w*\s*([+\-−]?\s*\d+)/gi)) c.saves[m[1].toLowerCase()] = parseInt(m[2].replace(/[−\s]/g, s => s === '−' ? '-' : ''));
  SECTIONS.forEach(k => c[k] = textToSection(v('sec_' + k)));
  if (fm.elements.shareVis) {
    c.owner = v('owner');
    c.share = {vis: v('shareVis'), hp: v('shareHp'), ac: v('shareAc') === '1'};
  }
  return normCreature(c);
}

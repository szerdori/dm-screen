// Ablakok és menük (felület): modális ablak, Menü, Initiative-menü, biztonsági mentések, szabálykönyv, fájlletöltés.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('modal', N) és az index.html-ben a modal.js?v=N és a VART_MODULOK.
'use strict';
modul('modal', 1);

// ---------- biztonsági mentések ablaka ----------
async function openBackups() {
  openModal('<h2>Biztonsági mentések</h2><p class="muted">Betöltés…</p>');
  let idx = [];
  try { idx = await backupIndex(); } catch (e) { $('#modalBox').innerHTML = `<h2>Biztonsági mentések</h2><p style="color:var(--red)">Nem sikerült betölteni (${esc(e.code || e.message)}).</p>`; return; }
  const when = b => { const d = new Date(b.createdAt); return isNaN(d) ? '' : d.toLocaleString('hu-HU', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}); };
  $('#modalBox').innerHTML = `<h2>Biztonsági mentések</h2>
    <p class="hint">Naponta az első megnyitáskor automatikusan készül egy mentés a felhőbe, az utolsó ${BACKUP_KEEP} marad meg. Visszaállítás előtt a mostani állapotról is készül egy mentés, így az is visszahozható.</p>
    ${backupWarn ? `<p style="color:var(--orange)">⚠ ${esc(backupWarn)}</p>` : ''}
    <div class="toolbar"><button data-act="backupNow">Mentés most</button><button data-act="exportAll">💾 Mentés fájlba</button></div>
    <div class="rows">${idx.length ? idx.map(b => `<div class="lrow" data-backup="${esc(b.id)}"><span class="nm"><b>${esc(when(b))}</b><small>${esc(b.note || '')} · ${esc(num(b.library))} lény · ${esc(num(b.saved))} mentett encounter</small></span>
      <button data-act="backupRestore">Visszaállítás</button></div>`).join('') : '<p class="muted">Még nincs felhős mentés.</p>'}</div>`;
}
// ---------- modal ----------
function openModal(html, wide = false) { $('#modalBox').innerHTML = html; $('#modalBox').classList.toggle('wide', wide); $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modalBox').innerHTML = ''; }
function openMenu() {
  openModal(`<h2>Menü</h2><div class="rows">
    <div class="lrow"><span class="nm">Új harc: ellenfelek törlése, a játékosok maradnak, initiative és kör nullázása</span><button data-act="newFight">Új harc</button></div>
    <div class="lrow"><span class="nm">Mindenki eltávolítása az encounterből</span><button data-act="clearAll">Ürítés</button></div>
    <div class="lrow"><span class="nm">Teljes mentés letöltése fájlba (könyvtár + encounter)</span><button data-act="exportAll">Exportálás</button></div>
    <div class="lrow"><span class="nm">Teljes mentés visszatöltése fájlból (felülírja a mostanit)</span><button data-act="importAll">Importálás</button></div>
    ${felhoben() ? `<div class="lrow"><span class="nm">Felhős biztonsági mentések (naponta automatikusan, az utolsó ${BACKUP_KEEP} megmarad) – visszaállítás${backupWarn ? ` <span style="color:var(--orange)">⚠ ${esc(backupWarn)}</span>` : ''}</span><button data-act="openBackups">Megnyitás</button></div>` : ''}
    <div class="lrow"><span class="nm">Kitölthető sablon letöltése saját lényhez</span><button data-act="downloadTemplate">Sablon letöltése</button></div>
    <div class="lrow"><span class="nm">📖 Szabálykönyv a játékos appnak (varázslatok, tárgyak, featek) – frissítés az 5e.tools-ról${sheetsWarn ? ` <span style="color:var(--orange)">⚠ A telefonos karakterlapok nem olvashatók (${esc(sheetsWarn)}) – a Firebase konzolba be kell másolni a firestore.rules új változatát.</span>` : ''}</span><button data-act="rulebook">Megnyitás</button></div>
  ${felhoben() ? `<div class="lrow"><span class="nm">Belépve: <b>${esc(authInfo.email || '')}</b></span><button data-act="signOut">Kilépés</button></div>` : ''}
  </div>
  <p class="hint">${felhoben() ? 'Az adatok automatikusan mentődnek a felhőbe (Firebase), így bármelyik gépről elérheted őket belépés után. Ha játék közben elmegy az internet, a program tovább működik, és később feltölti a változásokat.' : 'Az adatok csak ebben a böngészőben vannak elmentve.'}</p>`);
}
function openInitMenu() {
  openModal(`<h2>Initiative dobás</h2><div class="rows">
    <div class="lrow"><span class="nm">Ellenfelek és NPC-k dobása (a játékosokét te írod be)</span><button class="primary" data-act="init" data-mode="monsters">Dobás</button></div>
    <div class="lrow"><span class="nm">Csak akinek még nincs</span><button data-act="init" data-mode="missing">Dobás</button></div>
    <div class="lrow"><span class="nm">Mindenki, a játékosok is</span><button data-act="init" data-mode="all">Dobás</button></div>
  </div>
  <p><label><input type="checkbox" data-setting="groupInit" ${S.settings.groupInit ? 'checked' : ''}> Az egyszerre hozzáadott azonos lények közös initiative-et kapnak</label></p>`);
}
// ---------- szabálykönyv (megjelenítés: Menü → Szabálykönyv) ----------
async function openRulebook() {
  openModal('<h2>📖 Szabálykönyv a játékos appnak</h2><p class="muted">Betöltés…</p>');
  let meta = null;
  try { meta = await szabalyMeta(); } catch (e) { meta = {error: e.code || e.message}; }
  $('#modalBox').innerHTML = `<h2>📖 Szabálykönyv a játékos appnak</h2>
    <p>A telefonos karakterlap ebből keresi a varázslatokat, tárgyakat és featek leírását. Források: <b>PHB, XGE, TCE</b> (tárgyaknál a <b>DMG 2014</b> is), a 2024-es könyvek nélkül.
    A frissítés letölti az 5e.tools-tükörből, és a privát felhődbe menti; a játékosok telefonja a következő megnyitáskor egyszer letölti, utána internet nélkül is megvan.</p>
    ${!felhoben() ? '<p style="color:var(--orange)">Feltöltéshez be kell lépni (felhő nélkül csak a Tárgyak fül tudja közvetlenül használni).</p>'
      : meta?.error ? `<p style="color:var(--red)">⚠ Nem olvasható a felhőből (${esc(meta.error)}). Ha ez „permission-denied”, a konzolban még a régi szabályok vannak – másold be a firestore.rules új változatát.</p>`
      : meta ? `<p>Jelenlegi változat: <b>${esc(new Date(meta.version).toLocaleString('hu-HU'))}</b> – ${esc(rbCounts(meta.counts || {}))}.</p>` : '<p class="muted">Még nincs feltöltve.</p>'}
    <div class="toolbar"><button class="primary" data-act="rbUpdate" ${felhoben() ? '' : 'disabled'}>⟳ Letöltés és feltöltés most</button><span id="rbMsg" class="hint"></span></div>`;
}
async function rulebookUpdate() {
  const msg = t => { const el = $('#rbMsg'); if (el) el.textContent = t; };
  try {
    msg('Letöltés az 5e.tools-tükörből…');
    const rb = await buildRulebook();
    const meta = await uploadRulebook(rb, msg);
    rulebook = {version: meta.version, counts: meta.counts, rb};
    msg('✓ Kész: ' + rbCounts(meta.counts));
    log('📖 Szabálykönyv frissítve: ' + esc(rbCounts(meta.counts)));
  } catch (e) { msg('⚠ Nem sikerült: ' + (e.code || e.message)); }
}
// ---------- letöltés fájlba (mentés, export) ----------
function download(name, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'}));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

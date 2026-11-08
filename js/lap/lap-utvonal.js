// Telefonos karakterlap (lap-utvonal, a karakter.html része): rajzolás, útvonal (#lap/id), kapu
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-utvonal', N) és a karakter.html-ben a lap-utvonal.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-utvonal', 1);

// gépelés közben nem rajzolunk újra (pl. ha a DM közben sebzést ír a lapra), csak amikor a mező elveszti a fókuszt
function render(force = false) {
  keresAblak();  // a DM dobáskérése gépelés közben is felugrik
  const a = document.activeElement;
  const typing = a && a.closest?.('#main') && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !['checkbox', 'button', 'radio'].includes(a.type)));
  if ((typing || atkDrag) && !force) { pendingRender = true; return; }
  pendingRender = false;
  // kívülről jött újrarajzolásnál az űrlapba gépelt, még nem mentett értékek megmaradnak
  if (view.tab === 'adat' && !force) readForm();
  $('#who').innerHTML = me ? `<span class="fiokmail">${esc(me)}${isDM ? ' · DM' : ''}</span><br><a href="#" data-act="fiok" style="color:var(--muted)">👤 Fiók</a>` : '';
  const s = view.id && sheets.get(view.id);
  $('#rollbar').hidden = !s;
  if (!s) { renderList(); return; }
  // a varázsló a lap helyén fut; ha közben másik eszközön már szintet lépett, vagy elvették az engedélyt, bezárul
  if (lu && !lu.saving && (lu.id !== view.id || !luEnabled(s) || H.level(s) !== lu.from || !s.auto || !RB()?.classes?.length)) lu = null;
  if (lu && !lu.saving && lu.cls && lu.base !== H.stableJson(s.build)) { luRebase(s); toast('A lap közben változott: a választásokat újra kell kitölteni.', true); }
  if (lu) { $('#rollbar').hidden = true; renderWizard(s); return; }
  if (s.newChar && canEdit(s) && !s.deleted) {
    $('#rollbar').hidden = true;
    // a saját írás visszhangja ne cserélje ki a gombot a koppintás közben (a mező elhagyása írt, a Tovább koppintása még tart)
    if (!force && Date.now() < ncCsend) { setTimeout(() => render(), ncCsend - Date.now() + 20); return; }
    renderNewChar(s); return;
  }
  // a fülsáv vízszintes görgetése megmarad (különben minden kattintásra az elejére ugrana)
  const tabScroll = $('nav.tabs')?.scrollLeft || 0;
  renderSheet(s);
  $('nav.tabs').scrollLeft = tabScroll;
  for (const [k, q, f] of [['spellQ', 'spell', spellResults], ['itemQ', 'item', itemResults], ['featQ', 'feat', featResults]]) {
    const el = $('#' + k);
    if (el && searchQ[q]) { el.value = searchQ[q]; f(s); }
  }
}
function route() {
  $('#infoPop').hidden = true;
  const m = location.hash.match(/^#lap\/([A-Za-z0-9_-]{1,64})$/);
  const id = m ? m[1] : null;
  if (id !== view.id) { view = {id, tab: 'harc'}; draft = null; lu = null; hdOpen = false; castOpen = null; featPick = null; searchQ = {spell: '', item: '', feat: ''}; window.scrollTo(0, 0); }
  render(true);
}
function gate(html) { const g = $('#gate'); g.hidden = !html; if (html) g.innerHTML = `<div>${html}</div>`; }

// figyelők (a lap-indulas.js kapcsolja fel)
function utvonalEsemenyek() {
  document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender) render(); }, 0));
  window.addEventListener('hashchange', route);
}

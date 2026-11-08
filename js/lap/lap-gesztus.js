// Telefonos karakterlap (lap-gesztus, a karakter.html része): a támadások húzása (⠿) és a fülváltás húzással (swipe)
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-gesztus', N) és a karakter.html-ben a lap-gesztus.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-gesztus', 1);

// támadások sorrendje (Harc fül): a ⠿ fogantyúval húzható; pointer események, mert a HTML5 drag & drop telefonon nem működik.
// Húzás közben a beérkező változás nem rajzol újra (lásd render); elengedéskor a lap új sorrendje mentődik, megszakított gesztusnál (pointercancel) nem.
// Csak a fogantyús sorok között mozog (a lista végén lévő spell attack sor a helyén marad); egyszerre egy húzás, csak bal gombbal / egy ujjal.
const atkSorok = list => [...list.children].filter(x => x.querySelector(':scope > [data-drag="atk"]'));
function atkDrop(e) {
  if (!atkDrag || e.pointerId !== atkDrag.id) return;
  const {row, list, from, n} = atkDrag, to = atkSorok(list).indexOf(row), s = cur();
  atkDrag = null;
  row.classList.remove('dragging');
  // a húzás közben máshonnan megváltozott lista (pl. a DM írt) nem rendeződik át vakon
  if (e.type === 'pointercancel' || !s || to < 0 || to === from || s.attacks.length !== n) { render(true); return; }
  const a = [...s.attacks], [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  if (!patch({attacks: a})) render(true);
}
// fülváltás vízszintes húzással (swipe) a lapon: balra a következő, jobbra az előző fül (körbe nem jár).
// Touch események, mert a pointer eseményeket a böngésző a görgetés indulásakor megszakítja. Nem indul: mezőben, vízszintesen
// görgethető elemben (pl. a fülsáv), a ⠿ fogantyún, a képernyő szélén (a rendszer vissza-gesztusa), két ujjal, és ha inkább függőleges.
const SWIPE_MIN = 60, SWIPE_SZEL = 24, SWIPE_IDO = 800;
let swipe = null;
const swipeTiltott = (el, x) => {
  if (x < SWIPE_SZEL || x > innerWidth - SWIPE_SZEL) return true;
  for (let n = el; n && n.id !== 'main'; n = n.parentElement) {
    if (n.matches('input, textarea, select, [data-drag], [contenteditable="true"]')) return true;
    if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
  }
  return false;
};
function fulValt(tab) { if (view.tab === 'adat') readForm(); view.tab = tab; render(true); }

// figyelők (a lap-indulas.js kapcsolja fel)
function gesztusEsemenyek() {
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest?.('[data-drag="atk"]');
    if (!h || atkDrag || e.button > 0) return;
    e.preventDefault();
    const row = h.closest('.li');
    atkDrag = {row, list: row.parentElement, from: +h.dataset.i, id: e.pointerId, n: cur()?.attacks.length};
    try { h.setPointerCapture(e.pointerId); } catch {}
    row.classList.add('dragging');
  });
  document.addEventListener('pointermove', e => {
    if (!atkDrag || e.pointerId !== atkDrag.id) return;
    e.preventDefault();
    const {row, list} = atkDrag, sorok = atkSorok(list), ele = sorok.find(x => x !== row && e.clientY < x.getBoundingClientRect().top + x.offsetHeight / 2);
    const ide = ele || sorok.filter(x => x !== row).at(-1)?.nextElementSibling || null;
    if (ide !== row && ide !== row.nextElementSibling) list.insertBefore(row, ide);
  });
  document.addEventListener('pointerup', atkDrop);
  document.addEventListener('pointercancel', atkDrop);
  document.addEventListener('touchstart', e => {
    swipe = null;
    const t = e.touches[0];
    // két ujjal belenagyított nézetben az egyujjas húzás a kép mozgatása, nem fülváltás
    if (e.touches.length !== 1 || atkDrag || (window.visualViewport?.scale || 1) > 1.01 || !e.target.closest?.('#main') || !$('#main nav.tabs') || swipeTiltott(e.target, t.clientX)) return;
    swipe = {x: t.clientX, y: t.clientY, at: Date.now()};
  }, {passive: true});
  document.addEventListener('touchmove', e => { if (swipe && e.touches.length !== 1) swipe = null; }, {passive: true});
  document.addEventListener('touchcancel', () => { swipe = null; }, {passive: true});
  document.addEventListener('touchend', e => {
    const sw = swipe, t = e.changedTouches[0];
    swipe = null;
    if (!sw || !t || e.touches.length || Date.now() - sw.at > SWIPE_IDO) return;
    const dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < 2 * Math.abs(dy)) return;
    if (!(getSelection()?.isCollapsed ?? true)) return;  // szöveget jelöl ki
    const i = TABS.findIndex(([k]) => k === view.tab) + (dx < 0 ? 1 : -1);
    if (i < 0 || i >= TABS.length || !$('#main nav.tabs')) return;
    // a fókuszban lévő mező (pl. pénz, megjegyzés) elengedése lefuttatja a change-et, így a beírt érték nem vész el az újrarajzoláskor
    const a = document.activeElement;
    if (a && a !== document.body && a.closest?.('#main')) a.blur();
    fulValt(TABS[i][0]);
    // az új fül gombja látszódjon a fülsávban, és ha a fülsáv kigördült a képből, a lap az elejére (a ragadós felső sor alá) ugrik
    const nav = $('#main nav.tabs'), gomb = nav.querySelector('.on'), nr = nav.getBoundingClientRect(), gr = gomb.getBoundingClientRect();
    if (gr.left < nr.left) nav.scrollLeft -= nr.left - gr.left + 16;
    else if (gr.right > nr.right) nav.scrollLeft += gr.right - nr.right + 16;
    const fent = $('#main .top')?.offsetHeight || 0, navY = nav.getBoundingClientRect().top;
    if (navY < fent) window.scrollBy(0, navY - fent - 8);
  }, {passive: true});
}

// Telefonos karakterlap (lap-alap, a karakter.html része): alapok, állapot, a karakterek listája
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-alap', N) és a karakter.html-ben a lap-alap.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-alap', 1);

const H = window.Sheet;
// igaz, ha valamelyik közös fájl régi; a nagyon régi kozos.js-ben az elteroModulok még nincs meg – az is régi
function regiFajl() { return typeof elteroModulok !== 'function' || elteroModulok(VART_MODULOK).length > 0; }
let sheetStale = true;  // a lap-indulas.js állítja be, amikor már minden fájl bejelentkezett (modul)
const {isObj, num, str, mod, sgn, safeUrl} = H;
const ST = {healthy: 'Sértetlen', hurt: 'Sérült', bloodied: 'Súlyosan sérült', down: 'Eszméletlen'};
const RESET_HU = {short: 'short rest', long: 'long rest', none: 'nem töltődik'};
const PROF_MARK = {2: '◆', 1: '●', 0.5: '½', 0: '○'};
const TABS = [['harc', '⚔ Harc'], ['kep', '🎲 Képességek'], ['var', '✨ Varázslat'], ['fel', '🎒 Felszerelés'], ['adat', '✎ Alapadatok'], ['jegyz', '📝 Jegyzet']];

let me = '', isDM = false, chars = [], sheets = new Map(), sheetErr = '';
let view = {id: null, tab: 'harc'}, rbInfo = null, rbErr = '', rollMode = '', rolls = [];
let hdOpen = false, castOpen = null, featPick = null, pendingRender = false, draft = null, openKeys = new Set(), searchQ = {spell: '', item: '', feat: ''}, notesTimer = null, atkDrag = null;

// a karakter nyilvános része (characters/{id}): a szerződés tisztítója
const normChar = Szerzodes.normPublicChar;
const avatar = (portrait, name) => portrait ? `<img class="av" src="${esc(portrait)}" alt="">` : `<div class="av">${esc(String(name).charAt(0).toUpperCase())}</div>`;
function hpBar(hp, cls = '') {
  const p = Math.max(0, Math.min(1, hp.cur / hp.max));
  return `<div class="bar ${cls} ${p <= .25 ? 'low' : p <= .5 ? 'mid' : ''}"><div class="fill" style="width:${(p * 100).toFixed(1)}%"></div><span>${esc(hp.cur)} / ${esc(hp.max)} HP</span></div>`;
}
const canEdit = s => isDM || (!!me && s.owner === me);
const okId = id => /^[A-Za-z0-9_-]{1,64}$/.test(id);
function card(c, own) {
  const has = okId(c.id) && sheets.has(c.id), tag = has ? 'a' : 'div';
  return `<${tag} class="card ${c.kind} ${own ? 'own' : ''}" data-char="${esc(c.id)}" ${has ? `href="#lap/${esc(c.id)}"` : ''}>${avatar(c.portrait, c.name)}
    <div class="main"><div class="name">${esc(c.name)}</div>
      <div class="sub">${c.kind === 'npc' ? 'NPC' : 'Játékos'}${c.level ? ' · ' + esc(c.level) : ''}${own && c.visibility === 'dm' ? ' · 🔒 csak te és a DM látjátok' : ''}</div>
      <div class="stats">${c.ac != null ? `<span class="ac" title="Armor Class">🛡 ${esc(c.ac)}</span>` : ''}${c.hp ? hpBar(c.hp) : ''}${c.status ? `<span class="st ${c.status}">${esc(ST[c.status])}</span>` : ''}</div>
      ${own && !has ? '<div class="hint">A telefonos karakterlapodat még nem hozta létre a DM.</div>' : ''}
    </div>${has ? '<span class="go">Lap ›</span>' : ''}</${tag}>`;
}
const fromSheet = (id, s, level) => normChar({id, kind: 'pc', owner: s.owner, visibility: 'party', name: s.name, portrait: s.portrait, level, ac: s.ac, hp: s.hp});
function renderList() {
  const byName = (a, b) => (a.kind === 'pc' ? 0 : 1) - (b.kind === 'pc' ? 0 : 1) || a.name.localeCompare(b.name, 'hu');
  // csak játékos karakterek látszanak, NPC nem (a felhasználó kérése)
  const pcs = chars.filter(c => c.kind === 'pc');
  const own = pcs.filter(c => c.owner && c.owner === me).sort(byName);
  const party = pcs.filter(c => !(c.owner && c.owner === me) && c.visibility === 'party').sort(byName);
  // saját lap, amihez (még) nincs nyilvános rész
  for (const [id, s] of sheets) if (me && s.owner === me && !own.some(c => c.id === id)) own.push({...fromSheet(id, s, 'Szint ' + H.level(s)), visibility: 'dm'});
  const all = isDM ? [...sheets].sort((a, b) => a[1].name.localeCompare(b[1].name, 'hu')) : [];
  $('#main').innerHTML = `
    <h2>Az én karakterem</h2>${own.length ? own.map(c => card(c, true)).join('') : isDM ? '<p class="muted">DM-ként nincs saját karaktered – lent az összes karakterlap.</p>' : '<p class="muted">Még nincs hozzád rendelt karakter. Szólj a DM-nek, hogy állítsa be a Google-fiókodat a karakterednél.</p>'}
    <h2>A csapat</h2>${party.length ? party.map(c => card(c, false)).join('') : '<p class="muted">Most nem látsz senkit a csapatból.</p>'}
    ${isDM ? `<h2>Minden karakterlap (DM)</h2>${all.length ? all.map(([id, s]) => card(fromSheet(id, s, `Szint ${H.level(s)} · ${s.deleted ? '🗑 törölve' + (s.deleted.owner ? ': ' + s.deleted.owner : '') : s.owner || 'nincs gazdája'}${s.newChar ? ' · ✨ készül' : ''}`), false)).join('')
      : '<p class="muted">Még nincs telefonos karakterlap. A DM Screen könyvtárában a 📱 gombbal hozhatsz létre.</p>'}` : ''}
    ${sheetErr ? `<p class="warn">⚠ A karakterlapok most nem érhetők el (${esc(sheetErr)}).</p>` : ''}`;
}

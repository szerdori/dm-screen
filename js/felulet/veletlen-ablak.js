// Véletlen build ablaka (felület): az Új játékos ablakból nyílik; a DM megad néhány adatot, a többit a logika (js/logika/veletlen-build.js) tölti ki,
// előnézet után a Létrehozás kész, motoros lapot készít. Terv: TERV-veletlen-build.md.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('veletlen-ablak', N) és az index.html-ben a veletlen-ablak.js?v=N és a VART_MODULOK.
'use strict';
modul('veletlen-ablak', 1);

// az ablak állapota: a szabálykönyv, az utolsó eredmény és a bemenet, amiből készült (ha a bemenet azóta változott, újra kell generálni)
let vbAblak = {rb: null, eredmeny: null, be: '', d: {}};
const VB_TIPUS_HU = {cantrips: 'cantrip', known: 'ismert', book: 'spellbook', spell: 'varázslat'};
const vbOpcio = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
const vbNevSor = list => [...list].sort((a, b) => a.n.localeCompare(b.n));

function openVeletlenBuild(rb, d = {}) {
  vbAblak = {rb, eredmeny: null, be: '', d};  // d: az Új játékos űrlap adatai (a Vissza a módszereket és a felszerelést is visszaviszi)
  const r = rb;
  openModal(`<h2>🎲 Kész build generálása</h2>
    <form id="vbForm" class="form" onsubmit="return false">
      <label class="w2">Név <span class="hint">– üresen: „Új karakter”</span><input name="name" value="${esc(d.name || '')}"></label>
      <label class="w2">A játékos Google-fiókja (e-mail) <span class="hint">– később is megadható</span><input type="email" name="owner" value="${esc(d.owner || '')}" placeholder="pl. jatekos@gmail.com"></label>
      <label>Ki láthatja<select name="vis">${vbOpcio('party', 'az egész csapat', d.vis || 'party')}${vbOpcio('dm', 'csak a DM', d.vis)}</select></label>
      <label>Szint<input type="number" name="szint" min="1" max="20" value="${esc(d.target || 1)}"></label>
      <label>Faj<select name="faj"><option value="">– véletlen –</option>${vbNevSor(r.races || []).map(x => vbOpcio(x.n + '|' + x.s, x.n)).join('')}</select></label>
      <label>Alfaj<select name="alfaj">${vbAlfajOpciok(r, '')}</select></label>
      <label>Osztály<select name="osztaly"><option value="">– véletlen –</option>${vbNevSor(r.classes).map(x => vbOpcio(x.n, x.n)).join('')}</select></label>
      <label>Alosztály<select name="alosztaly">${vbAlosztalyOpciok(r, '')}</select></label>
      <label class="w2">Háttér<select name="hatter"><option value="">– véletlen –</option>${vbNevSor(r.backgrounds || []).map(x => vbOpcio(x.n + '|' + x.s, x.n)).join('')}</select></label>
      <label>Második osztály <span class="hint">– multiclass</span><select name="osztaly2"><option value="">– nincs –</option>${vbNevSor(r.classes).map(x => vbOpcio(x.n, x.n)).join('')}</select></label>
      <label>… szintje<input type="number" name="szint2" min="1" max="19" value="1"></label>
      <p class="hint w4">Amit üresen hagysz, azt a program választja, értelmesen: standard array a fő képesség szerint, ASI a fő képességre, az osztályhoz illő skillek és varázslatok, a PHB kezdő felszerelése. Multiclass csak akkor lesz, ha megadod. A bekészített varázslatokat a játékos választja ki.</p>
    </form>
    <div id="vbElonezet"></div>
    <div class="toolbar" style="margin-top:12px"><button class="primary" data-act="vbGeneral">🎲 Generálás</button><button data-act="vbLetrehoz" disabled>Létrehozás</button><button data-act="vbVissza">Vissza</button><button data-act="edCancel">Mégse</button></div>`);
}
function vbAlfajOpciok(rb, faj) {
  const nev = faj.split('|')[0], subs = faj ? (rb.subraces || []).filter(x => x.race === nev) : [];
  return `<option value="">${faj && !subs.length ? '– nincs –' : '– véletlen –'}</option>` + vbNevSor(subs).map(x => vbOpcio(x.n + '|' + x.s, /\(alap\)$/.test(x.n) ? nev + ' (alap)' : x.n)).join('');
}
function vbAlosztalyOpciok(rb, cls) {
  return '<option value="">– véletlen –</option>' + (cls ? vbNevSor(Sheet.subclassesOf(cls, rb)).map(x => vbOpcio(x.n + '|' + x.s, x.n)).join('') : '');
}
// az űrlap: a név, az e-mail és a láthatóság a létrehozáshoz; a többi a generáláshoz
function readVeletlenBuild() {
  const fm = $('#vbForm'), v = n => fm.elements[n].value;
  const be = {szint: v('szint'), faj: v('faj'), alfaj: v('alfaj'), osztaly: v('osztaly'), alosztaly: v('alosztaly'), hatter: v('hatter'), osztaly2: v('osztaly2'), szint2: v('osztaly2') ? v('szint2') : ''};
  return {lap: {name: v('name'), owner: v('owner').trim().toLowerCase(), vis: v('vis')}, be};
}
// egy választás értéke olvashatóan: skill, ref („Alert|PHB” → Alert), ASI (+2 INT) vagy feat
function vbErtekSzoveg(v) {
  if (typeof v === 'string') return Sheet.SKILLS[v] ? Sheet.skillLabel(v) : v.includes('|') ? Sheet.refName(v) : v;
  if (v && typeof v === 'object') return v.feat ? 'feat: ' + Sheet.refName(v.feat) : Object.entries(v).map(([k, n]) => `+${n} ${k.toUpperCase()}`).join(', ');
  return '';
}
function vbElonezetHtml(r, rb) {
  if (r.hiba) return `<p class="warn" style="margin-top:10px">⚠ ${esc(r.hiba)}</p>`;
  const H = Sheet, s = r.lap, c = H.calc(s, rb), b = s.build;
  const faj = [H.refName(b.race), b.subrace && !/\(alap\)/.test(b.subrace) ? '(' + H.refName(b.subrace) + ')' : ''].filter(Boolean).join(' ');
  const valasztas = c.choices.filter(x => x.ok.length && !H.SPELL_KINDS.includes(x.kind) && !['spell', 'tce', 'subrace', 'subclass'].includes(x.kind));
  const varazs = c.choices.filter(x => x.ok.length && (H.SPELL_KINDS.includes(x.kind) || x.kind === 'spell'));
  const targy = s.inventory.filter(i => !i.container).map(i => i.name + (i.qty > 1 ? ' ×' + i.qty : '') + (i.equipped ? ' ✓' : ''));
  return `<div class="card" style="margin-top:10px;padding:8px 10px">
    <h3 style="margin:0 0 4px">${esc(s.name)} – ${esc(faj || 'faj nélkül')} ${esc(H.classLabel(s))}</h3>
    <div class="hint">Háttér: ${esc(H.refName(b.background) || '–')} · HP ${esc(s.hp.max)} · AC ${esc(c.ac.v)} · ${esc(H.ABIL.map(a => a.toUpperCase() + ' ' + c.abilities[a].v).join(' · '))}</div>
    ${r.figy.length ? `<p class="warn">${r.figy.map(esc).join('<br>')}</p>` : ''}
    ${r.hibak.length ? `<p class="warn">⚠ Nem sikerült kitölteni: ${esc(r.hibak.join('; '))} – a játékos a lapon pótolhatja.</p>` : ''}
    <details open><summary><b>Választások</b></summary><ul style="margin:4px 0">${valasztas.map(x => `<li>${esc(x.label || x.src)}: ${esc(x.ok.map(vbErtekSzoveg).join(', '))}</li>`).join('') || '<li>nincs</li>'}</ul></details>
    ${varazs.length ? `<details open><summary><b>Varázslatok</b></summary><ul style="margin:4px 0">${varazs.map(x => `<li>${esc(x.src)} (${esc(VB_TIPUS_HU[x.kind] || x.kind)}): ${esc(x.ok.map(vbErtekSzoveg).join(', '))}</li>`).join('')}</ul></details>` : ''}
    <details><summary><b>Felszerelés</b></summary><p style="margin:4px 0">${esc(targy.join(', ') || 'nincs')}${s.currency.gp ? ` · ${esc(s.currency.gp)} gp` : ''}</p></details>
  </div>`;
}
// generálás: a megadott adatok maradnak, a többi minden nyomásra újra sorsolódik
function vbGeneralas() {
  const {be} = readVeletlenBuild(), r = veletlenBuild(be, vbAblak.rb);
  vbAblak.eredmeny = r.hiba ? null : r; vbAblak.be = JSON.stringify(be);
  $('#vbElonezet').innerHTML = vbElonezetHtml(r, vbAblak.rb);
  $('[data-act="vbLetrehoz"]').disabled = !vbAblak.eredmeny;
  $('[data-act="vbGeneral"]').textContent = '🎲 Újra';
}
// a faj és az osztály választása frissíti az alfaj és az alosztály listáját; a generáló mezők változása érvényteleníti az előnézetet
function veletlenAblakEsemenyek() {
  document.addEventListener('change', e => {
    const fm = e.target.closest?.('#vbForm');
    if (!fm || !vbAblak.rb) return;
    if (e.target.name === 'faj') fm.elements.alfaj.innerHTML = vbAlfajOpciok(vbAblak.rb, e.target.value);
    if (e.target.name === 'osztaly') fm.elements.alosztaly.innerHTML = vbAlosztalyOpciok(vbAblak.rb, e.target.value);
    if (vbAblak.eredmeny && JSON.stringify(readVeletlenBuild().be) !== vbAblak.be) { vbAblak.eredmeny = null; $('[data-act="vbLetrehoz"]').disabled = true; }
  });
}

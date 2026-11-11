// Telefonos karakterlap (lap-fiok, a karakter.html része): felugró leírás, Fiók menü, teendők, Felépítés fül, Alapadatok űrlap
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-fiok', N) és a karakter.html-ben a lap-fiok.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-fiok', 3);

// ---------- felugró leírás (i gomb): a teendők és a szabad szöveges mezők magyarázata; a szövegek a sheet.js-ben (Sheet.todoInfo, freeInfo, MEZO_INFO) ----------
const infoReg = new Map();
const HOL_HU = {app: '✅ Megcsinálható az appban', homebrew: '✍ Kézzel, saját (homebrew) tételként viszed fel', dm: '🛡 Csak a DM tudja megcsinálni', vegyes: '✅🛡 Te is megoldhatod, a szabálykönyvet csak a DM tölti újra'};
function iGomb(info) {
  infoReg.set(info.cim, info);
  return `<button type="button" class="ibtn" data-act="info" data-info="${esc(info.cim)}" title="Mit kell tenni?" aria-label="Leírás: ${esc(info.cim)}">i</button>`;
}
// ---------- Fiók menü: megjelenítés (betűméret, sötét / világos; eszközönként) és kilépés ----------
// az állapot a <html data-meret / data-tema> attribútuma (a <head> állítja be a tárolóból); választáskor azonnal érvényes
const MEGJ_CIMKE = {betumeret: [['', 'Normál'], ['nagy', 'Nagy'], ['extra', 'Extra nagy']], tema: [['', '🌙 Sötét'], ['vilagos', '☀ Világos']]};
const MEGJ_ATTR = {betumeret: 'meret', tema: 'tema'};
const megjAll = k => document.documentElement.dataset[MEGJ_ATTR[k]] || '';
function megjAllit(k, v) {
  // a választható értékek: a szerződésből; egy régi (gyorsítótárazott) szerzodes.js mellett a beépített lista, és nincs tárolás
  const SZ = window.Szerzodes, ertekek = SZ?.MEGJELENITES?.[k] || {betumeret: ['', 'nagy', 'extra'], tema: ['', 'vilagos']}[k];
  if (!Object.hasOwn(MEGJ_ATTR, k) || !ertekek.includes(v)) return;
  const d = document.documentElement, kulcs = SZ?.HELYI?.[k];
  if (v) d.dataset[MEGJ_ATTR[k]] = v; else delete d.dataset[MEGJ_ATTR[k]];
  if (kulcs) try { if (v) localStorage.setItem(kulcs, v); else localStorage.removeItem(kulcs); } catch {}
  $('meta[name="theme-color"]').content = getComputedStyle(d).getPropertyValue('--bg').trim() || '#0e1013';
}
function fiokMutat() {
  const sor = k => `<div class="megj" role="group" aria-labelledby="megj-${k}">${MEGJ_CIMKE[k].map(([v, l]) => `<button type="button" class="${megjAll(k) === v ? 'on' : ''}" data-act="megj" data-k="${k}" data-v="${v}" aria-pressed="${megjAll(k) === v}">${l}</button>`).join('')}</div>`;
  const p = $('#infoPop');
  p.innerHTML = `<div class="ibox fiok" role="dialog" aria-modal="true" aria-label="Fiók"><h3>👤 Fiók</h3><div class="hint">${esc(me)}${isDM ? ' · DM' : ''}</div>
    <h4 id="megj-betumeret">Betűméret</h4>${sor('betumeret')}
    <h4 id="megj-tema">Mód</h4>${sor('tema')}
    <p class="hint">Csak ezen az eszközön; a választás azonnal érvényes.</p>
    <div class="row spread fiokalj"><button type="button" data-act="signOut">Kilépés</button><button type="button" class="primary" data-act="infoClose">Kész</button></div></div>`;
  p.hidden = false;
}
function infoMutat(info) {
  const p = $('#infoPop');
  p.innerHTML = `<div class="ibox" role="dialog" aria-modal="true"><h3>${esc(info.cim)}</h3>
    ${info.hol ? `<div class="hol ${esc(info.hol)}">${esc(HOL_HU[info.hol])}</div>` : ''}
    ${info.mit.length > 1 ? `<ol>${info.mit.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : `<p>${esc(info.mit[0])}</p>`}
    ${info.sablon ? `<p><b>Formátum:</b> ${esc(info.sablon)}</p>` : ''}${info.pelda ? `<p><b>Példa:</b> <code>${esc(info.pelda)}</code></p>` : ''}
    <div class="row" style="justify-content:flex-end"><button class="primary" data-act="infoClose">Rendben</button></div></div>`;
  p.hidden = false;
}
// ---------- felugró leírás választás előtt: varázslat, feat, választható képesség (Invocation, Fighting Style…) a szabálykönyvből ----------
// a név gombja (nevGomb, lap-felepites.js): data-lr (sp | feat | opt), data-ref; a választóban data-chk (a hely kulcsa), a keresőben data-add (spellAdd | featAdd)
const LEIRAS_LISTA = {sp: 'spells', feat: 'feats', opt: 'optfeatures'}, LEIRAS_ADD = new Set(['spellAdd', 'featAdd']);
let leirasCel = null;   // {chk, ref, asi} vagy {add, ref}: mit tesz a „Kiválasztom” / „Hozzáadom” gomb
const chDoboz = (key, ref) => [...document.querySelectorAll('input[type=checkbox][data-ch]')].find(e => e.dataset.ch === key && e.value === ref);
function leirasMutat(el) {
  const f = el.dataset.lr, ref = el.dataset.ref || '', d = el.dataset;
  if (!Object.hasOwn(LEIRAS_LISTA, f)) return;
  const x = H.byRef(RB()?.[LEIRAS_LISTA[f]] || [], ref), cb = d.chk != null ? chDoboz(d.chk, ref) : null;
  const sor = !x ? '' : f === 'sp' ? [H.spellLine(x), (x.cl || []).join(', '), x.s].filter(Boolean).join(' · ') : [x.pre ? 'Feltétel: ' + x.pre : '', x.s].filter(Boolean).join(' · ');
  const note = d.note && d.note !== x?.pre ? d.note : '';
  leirasCel = cb && !cb.disabled ? {chk: d.chk, ref, on: !cb.checked} : LEIRAS_ADD.has(d.add) && x ? {add: d.add, ref} : null;
  const gomb = !leirasCel ? '' : `<button class="primary" data-act="leirasValaszt">${cb?.checked ? '✕ Leveszem' : cb ? '＋ Kiválasztom' : '＋ Hozzáadom a laphoz'}</button>`;
  const p = $('#infoPop');
  p.innerHTML = `<div class="ibox" role="dialog" aria-modal="true" aria-label="${esc(x?.n || H.refName(ref))}"><h3>${esc(x?.n || H.refName(ref))}</h3>
    ${sor ? `<div class="hint">${esc(sor)}</div>` : ''}${note ? `<p class="${d.warn ? 'warn' : 'hint'}" style="margin:6px 0">${d.warn ? '⚠ ' : ''}${esc(note)}</p>` : ''}
    ${x?.tx ? `<div class="tx">${esc(x.tx)}</div>` : '<p class="hint">Nincs leírás a szabálykönyvben.</p>'}
    ${cb?.disabled ? `<p class="hint">Most nem választható${cb.checked ? ' (korábbi választás, nem cserélhető)' : ''}.</p>` : ''}
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button data-act="infoClose">Bezár</button>${gomb}</div></div>`;
  p.hidden = false;
}
function leirasValaszt(s) {
  const c = leirasCel; leirasCel = null;
  $('#infoPop').hidden = true;
  if (!c) return;
  if (c.add) { LAP_AKCIOK[c.add]({dataset: {ref: c.ref}}, s); return; }
  const cb = chDoboz(c.chk, c.ref);
  if (!cb || cb.disabled || cb.checked === c.on) return;   // amit a gomb kiírt, azt teszi (közben jött frissítés után sem fordítva)
  cb.checked = c.on;
  cb.dispatchEvent(new Event('change', {bubbles: true}));
}
function todoList(s, cr) {
  const items = cr.todos.map(t => {
    const i = iGomb(H.todoInfo(t, cr));
    return t.kind === 'manual' ? `<div class="li"><label class="nm"><input type="checkbox" data-act="todoDone" data-key="${esc(t.key)}"> ✋ ${esc(t.text)}</label>${i}</div>`
      : t.kind === 'missing' ? `<div class="li"><span class="nm warn">${esc(t.text)}</span>${i}</div>`
      : `<div class="li"><span class="nm">${esc(t.text)}</span>${i}<button class="small" data-act="chGo" data-key="${esc(t.key)}">→</button></div>`;
  }).join('');
  return det('todos', `<b>📋 Teendők (${cr.todos.length})</b>`, `<div class="list" style="margin-top:8px">${items || '<p class="hint">Nincs nyitott teendő.</p>'}</div>
    ${s.todoDone.length ? `<button class="small" data-act="todoReset" style="margin-top:8px">Kipipáltak visszaállítása (${s.todoDone.length})</button>` : ''}`);
}
function tabBuild(s) {
  const cr = calcOf(s);
  if (!cr) return `${statChips(s)}${rbNote() || '<p class="hint">A szabálykönyvben még nincsenek osztályok: a DM töltse fel újra (DM Screen → Menü → 📖 Szabálykönyv).</p>'}${autoForm(s)}`;
  const b = s.build, rb = RB();
  const races = H.raceOptions(rb), ri = races.findIndex(o => o.race === b.race && (o.subrace || '') === (b.subrace || ''));
  const bgs = (rb.backgrounds || []).map(x => ({v: x.n + '|' + x.s, l: x.n}));
  const lvls = b.levels.map((l, i) => {
    const hd = H.classInfo(l.c, rb).hd;
    return `<div class="li lvrow"><span class="nm"><b>${i + 1}. szint</b> · ${esc(l.c)}</span>${i === 0 ? `<span class="hint">HP: d${hd} maximum</span>`
      : `<label class="hint">HP <input type="number" inputmode="numeric" min="1" max="${hd}" data-act="lvHp" data-i="${i}" value="${esc(l.hp ?? '')}" placeholder="átlag ${hd / 2 + 1}"></label>`}</div>`;
  }).join('');
  const chs = cr.choices.filter(c => c.kind !== 'subrace').map(c => choiceBox(c, cr)).join('');   // az alfaj a faj-listában van
  const ab = H.ABIL.map(a => ovRow(s, 'ab:' + a, H.ABIL_FULL[a], cr.abilities[a])).join('');
  const sv = H.ABIL.map(a => ovRow(s, 'save:' + a, H.ABIL_FULL[a] + ' mentő', cr.saves[a], 'save')).join('');
  const sk = Object.keys(H.SKILLS).map(k => ovRow(s, 'skill:' + k, H.skillLabel(k), cr.skills[k], 'skill')).join('');
  return `${statChips(s)}
    ${cr.todos.length || s.todoDone.length ? todoList(s, cr) : ''}
    <h3>Felépítés</h3>
    <div class="form">
      <label class="w2" id="${chId('race:subrace')}">Faj<select data-act="bRace"><option value="">(válassz fajt)</option>${ri < 0 && b.race ? `<option selected>${esc(H.refName(b.race))} (nincs a szabálykönyvben)</option>` : ''}${races.map((o, i) => `<option value="${i}" ${i === ri ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
      <label class="w2">Háttér<select data-act="bBg">${optList(bgs, b.background)}</select></label>
      <h3>Alapértékek <span class="hint">(faji bónusz nélkül)</span></h3>
      <div class="g6">${H.ABIL.map(a => `<label>${a.toUpperCase()}<input type="number" inputmode="numeric" min="1" max="30" data-act="bBase" data-a="${a}" value="${esc(b.base[a])}"></label>`).join('')}</div>
    </div>
    <h3>Szintek</h3><div class="list">${lvls || '<p class="hint">Még nincs szint.</p>'}</div>
    ${isDM ? `<div class="row" style="margin-top:6px"><select id="lvCls">${H.classNames(rb).map(n => { const m = H.mcCheck(s, rb, n, cr); return `<option value="${esc(n)}" ${n === b.levels.at(-1)?.c ? 'selected' : ''}>${m.ok ? '' : '⚠ '}${esc(n)}${m.ok ? '' : ' – ' + esc(m.hiany.join('; '))}</option>`; }).join('')}</select><button class="small" data-act="lvAdd">＋ Szint (DM)</button>${b.levels.length > 1 ? '<button class="small" data-act="lvRm">− Utolsó szint</button>' : ''}</div>`
      : '<p class="hint">Új szintet a DM ad (szintlépés). A HP üresen hagyva az átlag; dobott értéket beírhatsz.</p>'}
    <h3>Választások</h3>${chs || '<p class="hint">Nincs választási hely.</p>'}
    <h3>Számolt értékek</h3>
    <p class="hint">Koppints egy sorra: ℹ miből jön, ✎ kézi felülírás. A ✎ jel mutatja, hol tér el a lap a számolttól.</p>
    <div class="list">${ovRow(s, 'ac', 'AC', cr.ac)}${ovRow(s, 'hpMax', 'Max HP', cr.hpMax)}${ovRow(s, 'speed', 'Speed', cr.speed, 'text')}${ovRow(s, 'init', 'Initiative', cr.init)}</div>
    <h3 class="sub2">Képességértékek</h3><div class="list">${ab}</div>
    <h3 class="sub2">Mentők</h3><div class="list">${sv}</div>
    <h3 class="sub2">Skillek</h3><div class="list">${sk}</div>
    <h3 class="sub2">Saját jártasságok ${iGomb(H.MEZO_INFO.plus)}</h3>
    <div class="form">${[['languages', 'Nyelvek'], ['tools', 'Eszközök'], ['armor', 'Páncél'], ['weapons', 'Fegyverek'], ['senses', 'Érzékek'], ['resist', 'Ellenállások']].map(([k, l]) => `<label class="w2">${l}<input data-ov="plus:${k}" value="${esc(s.ov['plus:' + k] || '')}"></label>`).join('')}</div>
    ${autoForm(s)}`;
}
// szabálymotoros lapon a kézzel szerkeszthető rész: név, alignment, saját támadások és erőforrások (a számoltak mellé)
function autoForm(s) {
  if (!draft || draft.id !== view.id) draft = {id: view.id, s: structuredClone(s)};
  const d = draft.s;
  const atk = d.attacks.map((a, i) => a.auto ? '' : `<div class="rowedit"><input name="at_name_${i}" value="${esc(a.name)}" placeholder="Név"><input name="at_hit_${i}" value="${esc(a.hit)}" placeholder="+5" style="max-width:60px">
      <input name="at_dmg_${i}" value="${esc(a.dmg)}" placeholder="1d8+3 slashing"><input name="at_note_${i}" value="${esc(a.note)}" placeholder="megjegyzés"><button class="small" data-act="rowRm" data-list="attacks" data-i="${i}">✕</button></div>`).join('');
  const res = d.resources.map((r, i) => r.auto ? '' : `<div class="rowedit"><input name="rs_name_${i}" value="${esc(r.name)}" placeholder="Név"><input name="rs_max_${i}" type="number" min="0" max="99" value="${esc(r.max)}" style="max-width:64px" title="Max">
      <select name="rs_reset_${i}">${H.RESETS.map(k => `<option value="${k}" ${r.reset === k ? 'selected' : ''}>${esc(RESET_HU[k])}</option>`).join('')}</select><button class="small" data-act="rowRm" data-list="resources" data-i="${i}">✕</button></div>`).join('');
  return `<h3>Név és saját tételek</h3>
  <form id="edForm" class="form" data-mode="auto" onsubmit="return false">
    <label class="w2">Név<input name="name" value="${esc(d.name)}"></label><label class="w2">Alignment${alignSelect('name="alignment"', d.alignment)}</label>
    <h3>Saját támadások <span class="hint">(a felszerelt fegyverekből a program számol)</span> ${iGomb(H.MEZO_INFO.attack)}</h3>${atk}
    <div class="w2"><button class="small" data-act="rowAdd" data-list="attacks">＋ Támadás</button></div>
    <h3>Saját erőforrások ${iGomb(H.MEZO_INFO.resource)}</h3>${res}
    <div class="w2"><button class="small" data-act="rowAdd" data-list="resources">＋ Erőforrás</button></div>
  </form>
  <div class="row" style="margin:14px 0"><button class="primary" data-act="edSave">Mentés</button><button data-act="edCancel">Elvetés</button></div>`;
}

function readForm() {
  const fm = $('#edForm');
  // piszkozat nélkül (pl. egy hibára futott művelet után) null: ilyenkor a hívó nem írhat a lapra, csak újrarajzol
  if (!fm || !draft || draft.id !== view.id) return draft?.id === view.id ? draft.s : null;
  const v = n => fm.elements[n]?.value ?? '', ch = n => !!fm.elements[n]?.checked;
  const d = draft.s;
  if (fm.dataset.mode === 'auto') {
    Object.assign(d, {name: v('name'), alignment: v('alignment')});
    d.attacks = d.attacks.map((a, i) => fm.elements['at_name_' + i] ? {...a, name: v('at_name_' + i), hit: v('at_hit_' + i), dmg: v('at_dmg_' + i), note: v('at_note_' + i)} : a);
    d.resources = d.resources.map((r, i) => fm.elements['rs_name_' + i] ? {...r, name: v('rs_name_' + i), max: v('rs_max_' + i), reset: v('rs_reset_' + i)} : r);
    return d;
  }
  Object.assign(d, {name: v('name'), race: v('race'), background: v('background'), alignment: v('alignment'), ac: v('ac'), acNote: v('acNote'), speed: v('speed'),
    initBonus: v('initBonus').trim() === '' ? null : v('initBonus'), senses: v('senses'), resist: v('resist'), jack: ch('jack'),
    profs: {armor: v('pf_armor'), weapons: v('pf_weapons'), tools: v('pf_tools'), languages: v('pf_languages')}});
  d.classes = d.classes.map((c, i) => ({name: v('cl_name_' + i), subclass: v('cl_sub_' + i), level: v('cl_lvl_' + i), hitDie: +v('cl_hd_' + i)}));
  d.abilities = Object.fromEntries(H.ABIL.map(a => [a, v('ab_' + a)]));
  d.saveProf = H.ABIL.filter(a => ch('sv_' + a));
  d.skillProf = Object.fromEntries(Object.keys(H.SKILLS).map(k => [k, +v('sk_' + k)]).filter(([, p]) => p));
  d.hp = {...d.hp, max: v('hpMax')};
  d.spellcasting = {...d.spellcasting, ability: v('spAb'), slots: d.spellcasting.slots.map((_, l) => v('slot_' + l)), pact: {...d.spellcasting.pact, max: v('pactMax'), level: v('pactLvl')}};
  d.attacks = d.attacks.map((a, i) => ({name: v('at_name_' + i), hit: v('at_hit_' + i), dmg: v('at_dmg_' + i), note: v('at_note_' + i)}));
  d.resources = d.resources.map((r, i) => ({...r, name: v('rs_name_' + i), max: v('rs_max_' + i), reset: v('rs_reset_' + i)}));
  return d;
}

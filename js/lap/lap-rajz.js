// Telefonos karakterlap (lap-rajz, a karakter.html része): a szabálykönyv segédei és a lap rajzolása (fülek)
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-rajz', N) és a karakter.html-ben a lap-rajz.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-rajz', 2);

// ---------- szabálykönyv ----------
const RB = () => rbInfo?.rb || null;
const rbSpell = sp => RB() && H.byRef(RB().spells, sp.ref, sp.name);
const rbItem = it => RB() && H.byRef(H.allItems(RB()), it.ref, it.name);
const rbNote = () => RB() ? '' : `<p class="hint">${rbErr ? '⚠ A szabálykönyv nem tölthető be (' + esc(rbErr) + ').'
  : rbInfo === null ? 'Szabálykönyv betöltése…' : 'A szabálykönyvet még nem töltötte fel a DM (DM Screen → Menü → Szabálykönyv), addig csak saját bejegyzést adhatsz hozzá.'}</p>`;
const det = (key, summary, body) => `<details data-key="${esc(key)}" ${openKeys.has(key) ? 'open' : ''}><summary>${summary}</summary>${body}</details>`;

// ---------- a karakterlap ----------
function renderSheet(s) {
  const ed = canEdit(s), L = H.level(s);
  if (!TABS.some(([k]) => k === view.tab)) view.tab = 'harc';
  const body = {harc: tabHarc, kep: tabKep, var: tabVar, fel: tabFel, jegyz: tabJegyz, adat: (x, e) => tabAdat(x, e) + (e ? adatAlj(x) : '')}[view.tab](s, ed);
  // fent csak egy vékony HP-sáv (a HP-t főleg a DM állítja); a kezelés a Harc fül alján van
  $('#main').innerHTML = `
    <div class="top"><a href="#">‹ Vissza</a>${s.updatedAt ? `<span class="hint" title="utoljára mentve">${esc(new Date(s.updatedAt).toLocaleTimeString('hu-HU', {hour: '2-digit', minute: '2-digit'}))}</span>` : ''}<span class="grow"></span>
      ${ed ? `<button class="small" data-act="shortRest" title="Short rest">☕ Short</button><button class="small" data-act="longRest" title="Long rest">🌙 Long</button>
        <button class="small ${hdOpen ? 'on' : ''}" data-act="hdToggle" title="Hit Dice elköltése">🎲 HD</button>` : '<span class="hint">🔒 csak olvasható</span>'}</div>
    ${ed && hdOpen ? `<div class="box hdbox">${H.hitDice(s).map(h => `<div class="row"><span class="grow"><b>d${h.die}</b> <span class="hint">${h.max - h.used} / ${h.max} maradt · gyógyulás: d${h.die} ${sgn(mod(s.abilities.con))}</span></span>
      <button class="small" data-act="hd" data-die="${h.die}" ${h.used >= h.max ? 'disabled' : ''}>Elköltés</button></div>`).join('')}
      <p class="hint" style="margin:6px 0 0">Short rest: a „short rest” erőforrások és a Pact Magic slotok töltődnek vissza. Long rest: teljes HP, minden slot és erőforrás, a Hit Dice fele, −1 exhaustion.</p></div>` : ''}
    <div class="hero">${avatar(s.portrait, s.name)}<div class="main"><div class="name">${esc(s.name)}</div>
      <div class="sub">${esc([s.race, H.classLabel(s) || 'Szint ' + L].filter(Boolean).join(' · '))}</div></div>${acChip(s)}</div>
    <div class="hpline">${hpBar(s.hp, 'slim')}${s.hp.temp ? `<span class="tmp">+${esc(s.hp.temp)} temp</span>` : ''}${s.hp.cur === 0 ? '<span class="tmp" style="color:var(--red)">halálmentők a Harc fül alján</span>' : ''}</div>
    ${s.deleted ? `<div class="lubar"><span class="grow">🗑 <b>Törölt karakter</b>${s.deleted.owner ? ` (${esc(s.deleted.owner)})` : ''}: a játékos nem látja. A DM Screen Könyvtárában hozhatod vissza, vagy törölheted véglegesen.</span></div>` : ''}
    ${ed ? luBar(s) : ''}
    ${ed && calcOf(s)?.todos.length ? `<button class="todobar" data-act="todoGo">📋 Teendők (${calcOf(s).todos.length})</button>` : ''}
    ${s.concentration ? `<div class="concbar">🌀 Koncentráció: <b>${esc(s.concentration)}</b><span class="grow"></span>${ed ? '<button class="small" data-act="concEnd">Megszakítás</button>' : ''}</div>` : ''}
    ${fxBar(s)}
    <nav class="tabs">${TABS.map(([k, l]) => `<button class="${view.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</nav>
    ${body}`;
}
// az aktív hatások és állapotok egy sorban a lap tetején (a káros pirossal; a DM által kikapcsolt áthúzva)
function fxBar(s) {
  const list = [...s.conditions.map(c => ({c, neg: !!H.effectOf(c)?.neg, off: s.effOff.includes(c)})), ...(s.exhaustion ? [{c: 'Exhaustion ' + s.exhaustion, neg: true, off: s.effOff.includes('Exhaustion')}] : [])];
  return list.length ? `<div class="fxbar">${list.map(x => `<span class="fxchip ${x.neg ? 'neg' : ''} ${x.off ? 'off' : ''}" title="${esc(H.effectOf(x.c)?.text || '')}">${esc(x.c)}</span>`).join('')}</div>` : '';
}
// AC az aktív hatásokkal (Mage Armor, Shield…): a fejlécben a név mellett (minden fülön) és az Alapadatok sorában
function acChip(s) {
  const e = H.effects(s, RB());
  return `<div class="chip ac ${e.ac !== s.ac ? 'fx' : ''}" title="${esc([s.acNote, e.acParts.length ? `alap ${s.ac} + ${e.acParts.join(', ')}` : ''].filter(Boolean).join(' · '))}"><b>${esc(e.ac)}</b><small>AC${e.ac !== s.ac ? ' ✨' : ''}</small></div>`;
}
function statChips(s) {
  const e = H.effects(s, RB());
  return `<div class="chips">
      ${acChip(s)}
      <button class="chip" data-act="d20" data-bonus="${H.initiative(s)}" data-label="Initiative" data-kind="init"><b>${esc(sgn(H.initiative(s)))}</b><small>Initiative</small></button>
      <div class="chip ${e.speed !== s.speed ? 'fx' : ''}" title="${esc(e.speed !== s.speed ? 'alap: ' + s.speed : '')}"><b>${esc(e.speed.replace(/\s*ft\.?$/, ''))}</b><small>Speed${e.speed !== s.speed ? ' ✨' : ''}</small></div>
      <div class="chip"><b>${esc(sgn(H.pb(s)))}</b><small>Prof. bónusz</small></div>
      <div class="chip"><b>${esc(H.passive(s, 'perception'))}</b><small>Passzív Perc.</small></div>
      ${s.exhaustion ? `<div class="chip" style="border-color:var(--orange)"><b>${esc(s.exhaustion)}</b><small>Exhaustion</small></div>` : ''}
    </div>`;
}
function hpBox(s, ed) {
  const ds = s.deathSaves, dis = ed ? '' : 'disabled';
  const pips = (kind, n) => [0, 1, 2].map(i => `<button class="pip ${kind} ${i < n ? 'on' : ''}" data-act="ds" data-kind="${kind}" data-i="${i}" ${dis} aria-label="${kind === 'ok' ? 'siker' : 'kudarc'} ${i + 1}"></button>`).join('');
  return `<div class="box">
    <div class="row spread"><div class="hpnum">${esc(s.hp.cur)}<small> / ${esc(s.hp.max)} HP</small></div>${s.hp.temp ? `<div class="chip" style="border-color:var(--blue)"><b>${esc(s.hp.temp)}</b><small>temp HP</small></div>` : ''}</div>
    ${ed ?`<div class="row hprow" style="margin-top:10px"><input id="hpIn" type="number" inputmode="numeric" min="0" placeholder="0">
      <button data-act="hpDmg" style="border-color:var(--red)">+ Sebzés</button><button data-act="hpHeal" style="border-color:var(--green)">− Gyógyítás</button><button data-act="hpTemp">Temp</button></div>` : ''}
    ${s.hp.cur === 0 ? `<div class="row" style="margin-top:10px"><b>Halálmentők</b> <span class="hint">siker</span> <span class="pips">${pips('ok', ds.ok)}</span> <span class="hint">kudarc</span> <span class="pips">${pips('fail', ds.fail)}</span>
      ${ed ? '<button class="small" data-act="dsRoll">🎲 Dobás</button>' : ''}${ds.ok >= 3 ? ' <b style="color:var(--green)">Stabil</b>' : ds.fail >= 3 ? ' <b style="color:var(--red)">Meghalt</b>' : ''}</div>` : ''}
  </div>`;
}
const pipRow = (n, used, attrs, dis, label) => Array.from({length: n}, (_, j) => `<button class="pip ${j < used ? 'used' : ''}" ${attrs} data-j="${j}" ${dis} aria-label="${esc(label)} ${j + 1}"></button>`).join('');
function tabHarc(s, ed) {
  const dis = ed ? '' : 'disabled';
  const fog = ed && s.attacks.length > 1;
  const atk = s.attacks.map((a, i) => `<div class="li">${fog ? `<span class="drag" data-drag="atk" data-i="${i}" title="Húzd a sorrend megváltoztatásához" aria-label="${esc(a.name)} áthelyezése">⠿</span>` : ''}<span class="nm"><b>${esc(a.name)}</b><small>${esc([a.dmg.replace(diceOf(a.dmg), '').trim(), a.note].filter(Boolean).join(' · '))}</small></span>
    ${a.hit.trim() ? rollBtn(parseInt(a.hit.replace('−', '-')) || 0, a.name + ' – támadás', undefined, 'atk') : ''}${diceOf(a.dmg) ? dmgBtn(diceOf(a.dmg), a.name + ' – sebzés', H.tavolsagiFegyver(a.name, a.note) ? 'wdmg' : 'wdmg:melee', tamadasFx(s, a)) : ''}</div>`).join('');
  const sDc = H.spellDc(s);
  const res = s.resources.map((r, i) => `<div class="li"><span class="nm"><b>${esc(r.name)}</b><small>${esc(r.max - r.used)} / ${esc(r.max)} · ${esc(RESET_HU[r.reset])}</small></span>
    <span class="pips">${pipRow(r.max, r.used, `data-act="res" data-i="${i}"`, dis, r.name)}</span></div>`).join('');
  // állapot / aktív hatás: a gépi hatás leírása; a DM kikapcsolhatja (⚙), ilyenkor csak emlékeztető
  const offBtn = key => isDM ? `<button class="small" data-act="effToggle" data-key="${esc(key)}" title="Automatikus hatás be / ki (DM)">⚙ ${s.effOff.includes(key) ? 'ki' : 'be'}</button>` : '';
  const conds = s.conditions.map((c, i) => {
    const t = RB()?.conditions.find(x => x.n.toLowerCase() === c.toLowerCase()), fx = H.effectOf(c);
    return det('cond:' + c, `<span class="nm"><b>${esc(c)}</b>${fx ? `<small>${s.effOff.includes(c) ? 'automatikus hatás kikapcsolva (DM)' : '✨ ' + esc(fx.text)}</small>` : ''}</span>${fx ? offBtn(c) : ''}${ed ? `<button class="small" data-act="condRm" data-i="${i}">✕</button>` : ''}`,
      t ? `<div class="tx">${esc(t.tx)}</div>` : '');
  }).join('');
  const effNames = Object.keys(H.EFFECTS).filter(n => !H.CONDITIONS.includes(n) && !s.conditions.includes(n));
  return `
    <h3>Támadások ${iGomb(H.MEZO_INFO.attack)}</h3><div class="list">${atk || `<p class="hint">Nincs felvett támadás${ed ? ' (Alapadatok fül)' : ''}.</p>`}
      ${sDc ? `<div class="li"><span class="nm"><b>Varázslat</b><small>spell save DC ${esc(sDc)}</small></span>${rollBtn(H.spellAtk(s), 'Spell attack', undefined, 'atk')}</div>` : ''}</div>
    ${res ? `<h3>Erőforrások</h3><div class="list">${res}</div>` : ''}
    <h3>Állapotok</h3><div class="list">${conds || '<p class="hint">Nincs.</p>'}</div>
    ${ed ? `<div class="row" style="margin-top:8px"><select id="condAdd"><option value="">＋ Állapot / hatás hozzáadása…</option>
      <optgroup label="Aktív hatás (spell, feature)">${effNames.map(c => `<option>${esc(c)}</option>`).join('')}</optgroup>
      <optgroup label="Állapot">${H.CONDITIONS.filter(c => !s.conditions.includes(c)).map(c => `<option>${c}</option>`).join('')}</optgroup></select>
      <label class="hint">Exhaustion <select id="exh">${[0, 1, 2, 3, 4, 5, 6].map(n => `<option ${n === s.exhaustion ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${s.exhaustion ? offBtn('Exhaustion') : ''}</div>` : ''}
    ${s.exhaustion ? `<p class="hint">Exhaustion ${esc(s.exhaustion)}: ${esc(['', 'hátrány a próbákra', '+ fél speed', '+ hátrány a támadásra és a mentőre', '+ fél max HP', '+ a speed 0', 'halál'][s.exhaustion])}${s.effOff.includes('Exhaustion') ? ' (automatikus hatás kikapcsolva)' : ''}</p>` : ''}
    <h3>HP</h3>${hpBox(s, ed)}`;
}
function tabKep(s, ed) {
  const ab = H.ABIL.map(a => `<div class="abil" data-act="d20" data-bonus="${mod(s.abilities[a])}" data-label="${H.ABIL_FULL[a]} próba" data-kind="check:${a}"><small>${a.toUpperCase()}</small><b>${esc(sgn(mod(s.abilities[a])))}</b><span class="sc">${esc(s.abilities[a])}</span>
    <span class="sv ${s.saveProf.includes(a) ? 'p' : ''}" data-act="d20" data-bonus="${H.saveBonus(s, a)}" data-label="${H.ABIL_FULL[a]} mentő" data-kind="save:${a}">mentő ${esc(sgn(H.saveBonus(s, a)))}${s.saveProf.includes(a) ? ' ●' : ''}</span></div>`).join('');
  const sk = Object.keys(H.SKILLS).map(k => { const p = H.skillProfOf(s, k);
    return `<div class="li"><span class="mark" title="${p === 2 ? 'expertise' : p === 1 ? 'jártas' : p ? 'Jack of All Trades' : ''}">${PROF_MARK[p]}</span><span class="nm">${esc(H.skillLabel(k))} <span class="hint">${H.SKILLS[k].toUpperCase()}</span></span>${rollBtn(H.skillBonus(s, k), H.skillLabel(k), undefined, `check:${H.SKILLS[k]}:${k}`)}</div>`; }).join('');
  return `<p class="hint">Koppints egy értékre a dobáshoz (nagy szám: próba, alatta: mentődobás). Előnyhöz / hátrányhoz előbb válaszd ki lent.</p>
    <div class="abils">${ab}</div>
    <h3>Skillek</h3><div class="list">${sk}</div>
    <p class="hint">● jártas · ◆ expertise${s.jack ? ' · ½ Jack of All Trades' : ''}</p>
    <h3>Passzív értékek</h3><p>Perception <b>${H.passive(s, 'perception')}</b> · Investigation <b>${H.passive(s, 'investigation')}</b> · Insight <b>${H.passive(s, 'insight')}</b></p>
    ${profsHtml(s)}
    ${tabJell(s, ed)}`;
}
// a Képességek fülön, a passzív értékek alatt
function profsHtml(s) {
  const pr = s.profs, er = H.effects(s, RB()).resist;
  return `<h3>Jártasságok, nyelvek</h3>
    <p>${[['Páncél', pr.armor], ['Fegyver', pr.weapons], ['Eszköz', pr.tools], ['Nyelvek', pr.languages], ['Érzékek', s.senses], ['Ellenállás', [s.resist, er && '✨ ' + er].filter(Boolean).join(', ')]].filter(x => x[1]).map(([l, v]) => `<b>${l}:</b> ${esc(v)}`).join('<br>') || '<span class="hint">Nincs megadva.</span>'}</p>`;
}
// cast: a spell szintjén vagy magasabb (upcast) szabad slotból, Pact slotból, vagy rituáléként slot nélkül
function castChoices(s, sp, r) {
  const sc = s.spellcasting, up = /at higher levels|higher[- ]level/i.test(r?.tx || ''), out = [];
  for (let l = sp.level; l <= 9; l++) {
    const free = sc.slots[l - 1] - sc.used[l - 1];
    if (free > 0) out.push({how: String(l), text: `${l}. szint (${free} szabad)${l > sp.level ? (up ? ' ⬆ erősebb' : ' ⬆') : ''}`});
  }
  if (sc.pact.max > sc.pact.used && sc.pact.level >= sp.level) out.push({how: 'pact', text: `Pact slot (${sc.pact.level}. szint, ${sc.pact.max - sc.pact.used} szabad)`});
  if (r?.ri) out.push({how: 'ritual', text: 'Rituáléként (+10 perc, nincs slot)'});
  return out;
}
function spellRow(sp, i, ed, s) {
  const r = rbSpell(sp);
  const sum = `${sp.level ? `<input type="checkbox" data-act="prep" data-i="${i}" ${sp.prepared || sp.always ? 'checked' : ''} ${sp.always || !ed ? 'disabled' : ''} title="Bekészítve">` : ''}
    <span class="nm"><b>${esc(sp.name)}</b><small>${esc([r ? H.spellLine(r) : '', sp.always ? 'mindig bekészítve' : '', sp.note].filter(Boolean).join(' · '))}</small></span>
    ${r && diceOf(r.tx) ? dmgBtn(diceOf(r.tx), sp.name, '', H.dmgType(r.tx) ? {dt: H.dmgType(r.tx), dk: varazsFajta(r.tx)} : {}) : ''}${ed && sp.level ? `<button class="small cast ${castOpen === i ? 'on' : ''}" data-act="castOpen" data-i="${i}">✨ Cast</button>`
      : ed && (r?.k || H.effectOf(sp.name)) ? `<button class="small cast" data-act="cast" data-i="${i}" data-how="0">✨ Cast</button>` : ''}${r?.k ? '<span class="hint" title="koncentráció">🌀</span>' : ''}`;
  const ch = ed && sp.level && castOpen === i ? castChoices(s, sp, r) : null;
  const pick = ch ? `<div class="row castpick">${ch.map(c => `<button class="small" data-act="cast" data-i="${i}" data-how="${esc(c.how)}">${esc(c.text)}</button>`).join('')
    || '<span class="hint">Nincs szabad slot ehhez a szinthez.</span>'}<button class="small" data-act="castOpen" data-i="${i}">Mégse</button></div>` : '';
  return det('sp:' + sp.name, sum, `${r ? `<div class="tx">${esc(r.tx)}</div>` : '<div class="hint">Nincs leírás a szabálykönyvben.</div>'}${ed && !sp.auto ? `<div class="row" style="margin-top:8px"><button class="small" data-act="spellRm" data-i="${i}">🗑 Eltávolítás</button></div>` : ''}`) + pick;
}
// a „csak a bekészítettek” szűrő eszközönként marad meg (böngésző-tároló; ha nem elérhető, alapból minden látszik)
let csakBekTartalek = false;
function csakBekeszitett() { try { return localStorage.getItem(window.Szerzodes.HELYI.csakBekeszitett) === '1'; } catch { return csakBekTartalek; } }
function csakBekeszitettAllit(v) { csakBekTartalek = v; try { if (v) localStorage.setItem(window.Szerzodes.HELYI.csakBekeszitett, '1'); else localStorage.removeItem(window.Szerzodes.HELYI.csakBekeszitett); } catch {} }
function tabVar(s, ed) {
  const sc = s.spellcasting, dis = ed ? '' : 'disabled', ab = H.spellAbility(s);
  const slots = sc.slots.map((n, l) => n ? `<div class="li"><span class="nm"><b>${H.ORD[l + 1]} level</b><small>${n - sc.used[l]} / ${n} szabad</small></span>
    <span class="pips">${pipRow(n, sc.used[l], `data-act="slot" data-l="${l}"`, dis, (l + 1) + '. szintű slot')}</span></div>` : '').join('');
  const pact = sc.pact.max ? `<div class="li"><span class="nm"><b>Pact Magic (${H.ORD[sc.pact.level] || '?'} level)</b><small>${sc.pact.max - sc.pact.used} / ${sc.pact.max} szabad · short restnél visszatöltődik</small></span>
    <span class="pips">${pipRow(sc.pact.max, sc.pact.used, 'data-act="pact"', dis, 'Pact slot')}</span></div>` : '';
  // „csak a bekészítettek”: a cantripek mindig látszanak (nem kell bekészíteni őket)
  const csak = csakBekeszitett(), by = {};
  s.spells.forEach((sp, i) => { if (!csak || !sp.level || sp.prepared || sp.always) (by[sp.level] = by[sp.level] || []).push(spellRow(sp, i, ed, s)); });
  const prepared = s.spells.filter(sp => sp.level && (sp.prepared || sp.always)).length, rejtett = s.spells.filter(sp => sp.level && !sp.prepared && !sp.always).length;
  return `${ab ? `<p>Varázsképesség: <b>${esc(H.ABIL_FULL[ab])}</b> · spell save DC <b>${esc(H.spellDc(s))}</b> · spell attack ${rollBtn(H.spellAtk(s), 'Spell attack', undefined, 'atk')}</p>` : '<p class="hint">Nincs megadva varázsképesség (Alapadatok fül).</p>'}
    ${slots || pact ? `<h3>Spell slotok</h3><div class="list">${slots}${pact}</div>` : ''}
    <h3>Varázslatok <span class="hint">(${prepared} bekészítve)</span></h3>
    ${s.spells.some(sp => sp.level) ? `<label class="hint"><input type="checkbox" data-act="csakBek" ${csak ? 'checked' : ''}> csak a bekészítettek${csak && rejtett ? ` (${rejtett} elrejtve)` : ''}</label>` : ''}
    ${Object.keys(by).sort((a, b) => a - b).map(l => `<h3 class="sub2">${l == 0 ? 'Cantripek' : H.ORD[l] + ' level'}</h3><div class="list">${by[l].join('')}</div>`).join('') || `<p class="hint">${s.spells.length ? 'Nincs bekészített varázslat.' : 'Még nincs varázslat a lapon.'}</p>`}
    ${ed ? `<h3>＋ Varázslat hozzáadása</h3>${rbNote()}
      ${RB() ? `<div class="row"><input id="spellQ" class="grow" placeholder="Keresés név szerint (angolul)…" autocomplete="off"><label class="hint"><input type="checkbox" id="spellMine" ${searchQ.all ? '' : 'checked'}> csak az osztályaim listája</label></div><div class="list" id="spellRes" style="margin-top:6px"></div>` : ''}
      <div class="row" style="margin-top:8px"><input id="spellNew" class="grow" placeholder="Saját / homebrew varázslat neve">${iGomb(H.MEZO_INFO.spell)}<select id="spellNewL">${H.ORD.map((o, l) => `<option value="${l}">${l ? o + ' level' : 'Cantrip'}</option>`).join('')}</select><button data-act="spellCustom">＋</button></div>` : ''}`;
}
function spellResults(s) {
  const q = $('#spellQ')?.value || '', mine = $('#spellMine')?.checked;
  const cls = s.classes.map(c => H.findClass(c.name)).filter(Boolean);
  let list = H.search(RB().spells, q, 400);
  // a TCE bővített listája csak akkor, ha a karakter elfogadta (Felépítés: TCE bővített varázslatlista)
  const tce = c => H.tceIgen(s.build, c, H.TCE_LISTA);
  if (mine && cls.length) list = list.filter(sp => cls.some(c => H.spellOnList(sp, c, tce(c))));
  // a névre koppintva a leírás (leirasMutat), onnan is felvehető
  $('#spellRes').innerHTML = list.slice(0, 30).map(sp => `<div class="li"><span class="nm"><b>${nevGomb('sp', H.refOf(sp), sp.n, s.spells.some(x => x.name === sp.n) ? '' : ' data-add="spellAdd"')}</b><small>${esc(H.spellLine(sp))} · ${esc((sp.cl || []).join(', '))} · ${esc(sp.s)}</small></span>
    ${s.spells.some(x => x.name === sp.n) ? '<span class="hint">✓ megvan</span>' : `<button class="small" data-act="spellAdd" data-ref="${esc(H.refOf(sp))}">＋</button>`}</div>`).join('')
    || (q.trim() ? `<p class="hint">Nincs találat${mine && cls.length ? ' az osztályaid listáján (vedd ki a pipát a teljes listához)' : ''}.</p>` : '');
}
function tabFel(s, ed) {
  const dis = ed ? '' : 'disabled';
  const groups = {};
  s.inventory.forEach((it, i) => (groups[it.container] = groups[it.container] || []).push([it, i]));
  const row = ([it, i]) => {
    const r = rbItem(it);
    const sum = `<span class="nm"><b>${it.qty !== 1 ? esc(it.qty) + '× ' : ''}${esc(it.name)}</b><small>${esc([it.equipped ? 'felszerelve' : '', it.attuned ? 'hangolva' : '', it.rarity, it.note].filter(Boolean).join(' · '))}</small></span>
      ${r?.dmg && diceOf(r.dmg) ? dmgBtn(diceOf(r.dmg), it.name, '', H.dmgType(r.dmg) ? {dt: H.dmgType(r.dmg), dk: /ranged/i.test(r.ty || '') ? 'rw' : 'mw'} : {}) : ''}`;
    return det('it:' + i + ':' + it.name, sum, `${r ? `<div class="hint" style="margin-top:6px">${esc(H.itemLine(r))}</div>${r.tx ? `<div class="tx">${esc(r.tx)}</div>` : ''}` : ''}
      ${ed ? `<div class="row" style="margin-top:8px"><button class="small" data-act="qty" data-i="${i}" data-d="-1">−</button><b>${esc(it.qty)}</b><button class="small" data-act="qty" data-i="${i}" data-d="1">＋</button>
        <label class="hint"><input type="checkbox" data-act="equip" data-i="${i}" ${it.equipped ? 'checked' : ''}> felszerelve</label>
        <label class="hint"><input type="checkbox" data-act="attune" data-i="${i}" ${it.attuned ? 'checked' : ''}> hangolva</label>
        <span class="grow"></span><button class="small" data-act="itemRm" data-i="${i}">🗑</button></div>
        <div class="row" style="margin-top:6px"><input class="grow" data-act="itemNote" data-i="${i}" value="${esc(it.note)}" placeholder="Jegyzet"><input data-act="itemCont" data-i="${i}" value="${esc(it.container)}" placeholder="Tároló (pl. Backpack)" style="width:40%"></div>` : ''}`);
  };
  const keys = Object.keys(groups).sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0) || a.localeCompare(b));
  return `<h3>Pénz</h3><div class="row">${H.COINS.map(k => `<label class="hint" style="display:flex;flex-direction:column;align-items:center;flex:1">${k}<input type="number" min="0" inputmode="numeric" data-act="coin" data-coin="${k}" value="${esc(s.currency[k])}" ${dis} style="width:100%;text-align:center"></label>`).join('')}</div>
    <h3>Felszerelés <span class="hint">(hangolva: ${H.attuned(s)} / 3)</span></h3>
    ${keys.map(k => `${k ? `<h3 class="sub2">${esc(k)}</h3>` : ''}<div class="list">${groups[k].map(row).join('')}</div>`).join('') || '<p class="hint">Üres.</p>'}
    ${ed ? `<h3>＋ Tárgy hozzáadása</h3>${rbNote()}
      ${RB() ? '<input id="itemQ" style="width:100%" placeholder="Keresés: pl. rope, potion of healing, +1 longsword…" autocomplete="off"><div class="list" id="itemRes" style="margin-top:6px"></div>' : ''}
      <div class="row" style="margin-top:8px"><input id="itemNew" class="grow" placeholder="Saját tárgy neve">${iGomb(H.MEZO_INFO.item)}<input id="itemNewQ" type="number" min="1" value="1" style="width:70px"><button data-act="itemCustom">＋</button></div>` : ''}`;
}
function itemResults() {
  const q = $('#itemQ')?.value || '';
  $('#itemRes').innerHTML = H.search(H.allItems(RB()), q, 30).map(it => `<div class="li"><span class="nm"><b>${esc(it.n)}</b><small>${esc(H.itemLine(it))} · ${esc(it.s)}</small></span>
    <button class="small" data-act="itemAdd" data-ref="${esc(H.refOf(it))}">＋</button></div>`).join('') || (q.trim() ? '<p class="hint">Nincs találat.</p>' : '');
}
// a Képességek fül alján
function tabJell(s, ed) {
  const feats = s.features.map((f, i) => {
    const r = !f.text && RB()?.feats.find(x => x.n.toLowerCase() === f.name.toLowerCase());
    return det('f:' + i + ':' + f.name, `<span class="nm"><b>${esc(f.name)}</b>${f.src ? `<small>${esc(f.src)}</small>` : ''}</span>`,
      `<div class="tx">${esc(H.ddbSablonLap(f.text || r?.tx || '', f.name, s))}</div>${ed ? `<div class="row" style="margin-top:8px"><button class="small" data-act="featRm" data-i="${i}">🗑 Eltávolítás</button></div>` : ''}`);
  }).join('');
  const pick = ed && featPick ? `<div class="box" id="featPickBox"><b>${esc(featPick.name)}</b>: válassz képességet (+${esc(featPick.amt)}${featPick.left > 1 ? `, még ${esc(featPick.left)}` : ''})
    <div class="row" style="margin-top:6px">${featPick.from.map(a => `<button class="small" data-act="featPick" data-a="${a}">${a.toUpperCase()} ${esc(s.abilities[a])}</button>`).join('')}
    <button class="small" data-act="featPickSkip">Kihagyom</button></div></div>` : '';
  return `<h3>Jellemzők (class / race / feat)</h3>${pick}<div class="list">${feats || '<p class="hint">Nincs felvéve.</p>'}</div>
    ${ed ? `<h3>＋ Hozzáadás</h3>
      ${RB() ? '<input id="featQ" style="width:100%" placeholder="Feat keresése (PHB / XGE / TCE)…" autocomplete="off"><div class="list" id="featRes" style="margin-top:6px"></div>' : ''}
      <div class="form" style="margin-top:8px"><div class="w2 hint">Saját jellemző ${iGomb(H.MEZO_INFO.feat)}</div><label class="w2">Saját jellemző neve<input id="featNew"></label><label class="w2">Leírás<textarea id="featNewT" rows="3"></textarea></label>
      <label>Honnan (pl. Rogue 3)<input id="featNewS"></label><label>&nbsp;<button data-act="featCustom">＋ Hozzáadás</button></label></div>` : ''}`;
}
function featResults(s) {
  const q = $('#featQ')?.value || '';
  // a névre koppintva a leírás (leirasMutat); a feltétel teljesülése csak a szabálymotoros lapon számolható
  const cr = calcOf(s);
  $('#featRes').innerHTML = H.search(RB().feats, q, 20).map(f => {
    const fo = cr ? H.featOk(f, cr, RB(), s) : {ok: true}, warn = fo.ok ? '' : 'nem teljesül: ' + fo.hiany.join(', '), van = s.features.some(x => x.name === f.n);
    return `<div class="li"><span class="nm"><b>${nevGomb('feat', H.refOf(f), (warn ? '⚠ ' : '') + f.n, (van ? '' : ' data-add="featAdd"') + (warn ? ` data-note="${esc(warn)}" data-warn="1"` : ''))}</b><small>${esc([warn || (f.pre ? 'feltétel: ' + f.pre : ''), f.s].filter(Boolean).join(' · '))}</small></span>
    ${van ? '<span class="hint">✓ megvan</span>' : `<button class="small" data-act="featAdd" data-ref="${esc(H.refOf(f))}">＋</button>`}</div>`;
  }).join('') || (q.trim() ? '<p class="hint">Nincs találat.</p>' : '');
}
function tabJegyz(s, ed) {
  return `<h3>Jegyzetek</h3><textarea id="notes" rows="14" ${ed ? '' : 'readonly'} placeholder="Bármi, amit meg akarsz jegyezni: NPC-nevek, nyomok, tervek…">${esc(s.notes)}</textarea>
    <p class="hint">Magától mentődik. A DM is látja.</p>`;
}
// legördülő lista; a lapon lévő, listában nem szereplő (régi / saját) érték is megmarad választhatónak
const listOpts = (list, cur, empty) => {
  const has = list.some(x => x === cur);
  return `<option value="">${esc(empty)}</option>${!has && cur ? `<option value="${esc(cur)}" selected>${esc(cur)} (saját)</option>` : ''}${list.map(x => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
};
// faj: a szabálykönyv fajai alfajjal együtt; szabálykönyv nélkül szabad szöveg
function raceField(cur) {
  const opts = H.raceOptions(RB());
  if (!opts.length) return `<label>Faj<input name="race" value="${esc(cur)}"></label>`;
  return `<label>Faj<select name="race">${listOpts(opts.map(o => o.label), H.findRace(cur, RB())?.label || cur, '(válassz fajt)')}</select></label>`;
}
// osztály / alosztály / szint / faj választásakor: a kézi lapon az osztályból és a fajból kitölthető mezők, a motorosnál csak a hit die
function formPicked(field) {
  const prevRace = draft?.s.race, d = readForm(), s = cur();
  if (!d || !s) return;
  // kézi lap, fajváltás: a régi faj rögzített képességbónusza le, az újé fel; a választható bónuszra (pl. Half-Elf) figyelmeztet
  if (field === 'race' && !s.auto && RB()?.races?.length) {
    const known = !prevRace || H.findRace(prevRace, RB());
    if (known) d.abilities = H.swapRaceAb(d.abilities, prevRace, d.race, RB());
    const ch = H.raceAb(d.race, RB()).choose;
    draft.note = [known ? '' : `A régi fajnevet (${prevRace}) nem ismertem fel, ezért a képességértékeken nem változtattam.`,
      ...ch.map(c => `A fajból még jár ${c.n}× +${c.amt} (${c.from.length === 6 ? 'bármelyik képességre' : c.from.map(a => a.toUpperCase()).join(' / ')}${c.n > 1 ? ', különbözőkre' : ''}) – írd be a képességértékeknél.`)].filter(Boolean).join(' ');
  }
  // új osztálynál a régi osztály alosztálya kiesik
  const m = String(field).match(/^cl_name_(\d+)$/), c = m && d.classes[+m[1]];
  if (c && !H.subclassRef(H.findClass(c.name) || c.name, c.subclass, RB())) c.subclass = '';
  if (s.auto) d.classes = d.classes.map(c => ({...c, hitDie: H.classInfo(H.findClass(c.name) || c.name, RB()).hd}));
  else Object.assign(d, H.derive(H.norm(d), RB()));
  render(true);
}
// az Alapadatok fül alja (kézi és motoros lapon is): backup és előzmények
const adatAlj = s => `<h3>Backup</h3>${histBox(s)}${s.deleted ? '' : '<div class="row lapdel"><span class="grow"></span><button class="danger" data-act="lapTorol">🗑 Karakter törlése</button></div>'}`;
// alapadatok: piszkozaton dolgozik (draft), csak a Mentés írja a lapra
const EDIT_KEYS = ['name', 'race', 'background', 'alignment', 'classes', 'abilities', 'saveProf', 'skillProf', 'jack', 'ac', 'acNote', 'speed', 'initBonus', 'spellcasting', 'attacks', 'resources', 'profs', 'senses', 'resist'];
function tabAdat(s, ed) {
  if (!ed) return statChips(s);
  if (s.auto) return tabBuild(s);
  if (!draft || draft.id !== view.id) draft = {id: view.id, s: structuredClone(s)};
  const d = draft.s, f = (n, l, v, cls = '', type = 'text') => `<label class="${cls}">${l}<input name="${n}" type="${type}" value="${esc(v)}"></label>`;
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  return `${statChips(s)}${RB()?.classes?.length ? `<div class="box"><b>⚙ Szabálymotor</b><p class="hint" style="margin:4px 0 8px">Átállítás után a program a fajból, az osztályokból és a választásokból számol mindent. Ami most eltér a számolttól, az felülírásként (✎) megmarad, a hiányzó választások a Teendők közé kerülnek.</p>
    <button data-act="toAuto">⚙ Átállítás szabálymotorra</button></div>` : ''}
  <p class="hint">A karakter alapadatai. A módosítás csak a <b>Mentés</b> gombbal kerül a lapra. A módosítókat, mentőket, skilleket, spell DC-t a program számolja.</p>
  <form id="edForm" class="form" onsubmit="return false">
    ${f('name', 'Név', d.name, 'w2')}${raceField(d.race)}${f('background', 'Háttér', d.background)}<label class="w2">Alignment${alignSelect('name="alignment"', d.alignment)}</label>
    <h3>Osztályok</h3>
    <p class="hint w2">${s.auto ? 'Az osztályból, alosztályból és fajból a program számol mindent (mentés után).' : 'Osztály vagy faj választásakor a hit die, a mentő-jártasság, a jártasságok és a spell slotok magától kitöltődnek (utána átírhatod).'}</p>
    ${d.classes.map((c, i) => {
      const subs = H.subclassesOf(H.findClass(c.name) || c.name, RB());
      return `<div class="rowedit"><select name="cl_name_${i}" title="Osztály">${listOpts(H.classNames(RB()), c.name, '(válassz osztályt)')}</select>
      ${subs.length ? `<select name="cl_sub_${i}" title="Alosztály">${listOpts(subs.map(x => x.n), subs.find(x => [x.n, x.short].some(n => String(n).toLowerCase() === String(c.subclass).trim().toLowerCase()))?.n || c.subclass, '(nincs alosztály)')}</select>`
        : `<input name="cl_sub_${i}" value="${esc(c.subclass)}" placeholder="Alosztály">${iGomb(H.MEZO_INFO.subclass)}`}
      <input name="cl_lvl_${i}" type="number" min="1" max="20" value="${esc(c.level)}" style="max-width:64px" title="Szint"><select name="cl_hd_${i}" style="max-width:76px" title="Hit die (az osztály alapján)">${[6, 8, 10, 12].map(n => opt(n, 'd' + n, c.hitDie)).join('')}</select>
      ${d.classes.length > 1 ? `<button class="small" data-act="rowRm" data-list="classes" data-i="${i}">✕</button>` : ''}</div>`;
    }).join('')}
    <div class="w2"><button class="small" data-act="rowAdd" data-list="classes">＋ Osztály (multiclass)</button></div>
    <h3>Képességértékek</h3>${draft.note ? `<p class="hint w2" id="raceNote">⚠ ${esc(draft.note)}</p>` : ''}
    ${!s.auto ? '<p class="hint w2">A végleges értékeket írd be (a faji bónusszal együtt). Fajváltáskor a faj rögzített bónusza magától átíródik.</p>' : ''}
    <div class="g6">${H.ABIL.map(a => `<label>${a.toUpperCase()}<input name="ab_${a}" type="number" min="1" max="30" value="${esc(d.abilities[a])}"></label>`).join('')}</div>
    <div class="w2 hint">Mentő-jártasság: ${H.ABIL.map(a => `<label class="inl" style="display:inline-flex;margin-right:8px"><input type="checkbox" name="sv_${a}" ${d.saveProf.includes(a) ? 'checked' : ''}>${a.toUpperCase()}</label>`).join('')}</div>
    ${f('ac', 'AC', d.ac, '', 'number')}${f('acNote', 'AC megjegyzés (pl. chain mail, shield)', d.acNote)}
    ${f('speed', 'Speed', d.speed)}${f('initBonus', 'Initiative (üres = automatikus)', d.initBonus ?? '')}
    ${f('hpMax', 'Max HP', d.hp.max, '', 'number')}
    <h3>Skillek</h3>
    <div class="w2 sk3">${Object.keys(H.SKILLS).map(k => `<label>${esc(H.skillLabel(k))}<select name="sk_${k}">${opt(0, '–', d.skillProf[k] || 0)}${opt(1, 'jártas', d.skillProf[k] || 0)}${opt(2, 'expertise', d.skillProf[k] || 0)}</select></label>`).join('')}</div>
    <label class="w2 inl"><input type="checkbox" name="jack" ${d.jack ? 'checked' : ''}> Jack of All Trades (fél jártasság minden képességpróbára)</label>
    <h3>Varázslás</h3>
    <label>Varázsképesség<select name="spAb">${opt('', '(osztály alapján)', d.spellcasting.ability)}${H.ABIL.map(a => opt(a, H.ABIL_FULL[a], d.spellcasting.ability)).join('')}</select></label>
    <label>&nbsp;<button class="small" data-act="slotsAuto">Slotok az osztályok alapján</button></label>
    <div class="g9">${d.spellcasting.slots.map((n, l) => `<label>${l + 1}. szint<input name="slot_${l}" type="number" min="0" max="9" value="${esc(n)}"></label>`).join('')}</div>
    <label>Pact Magic slotok<input name="pactMax" type="number" min="0" max="9" value="${esc(d.spellcasting.pact.max)}"></label>
    <label>Pact slot szintje<input name="pactLvl" type="number" min="0" max="5" value="${esc(d.spellcasting.pact.level)}"></label>
    <h3>Támadások ${iGomb(H.MEZO_INFO.attack)}</h3>
    ${d.attacks.map((a, i) => `<div class="rowedit"><input name="at_name_${i}" value="${esc(a.name)}" placeholder="Név"><input name="at_hit_${i}" value="${esc(a.hit)}" placeholder="+5" style="max-width:60px">
      <input name="at_dmg_${i}" value="${esc(a.dmg)}" placeholder="1d8+3 slashing"><input name="at_note_${i}" value="${esc(a.note)}" placeholder="megjegyzés"><button class="small" data-act="rowRm" data-list="attacks" data-i="${i}">✕</button></div>`).join('')}
    <div class="w2"><button class="small" data-act="rowAdd" data-list="attacks">＋ Támadás</button></div>
    <h3>Erőforrások (pl. Bardic Inspiration, Ki, Rage) ${iGomb(H.MEZO_INFO.resource)}</h3>
    ${d.resources.map((r, i) => `<div class="rowedit"><input name="rs_name_${i}" value="${esc(r.name)}" placeholder="Név"><input name="rs_max_${i}" type="number" min="0" max="99" value="${esc(r.max)}" style="max-width:64px" title="Max">
      <select name="rs_reset_${i}">${H.RESETS.map(k => opt(k, RESET_HU[k], r.reset)).join('')}</select><button class="small" data-act="rowRm" data-list="resources" data-i="${i}">✕</button></div>`).join('')}
    <div class="w2"><button class="small" data-act="rowAdd" data-list="resources">＋ Erőforrás</button></div>
    <h3>Jártasságok és egyebek ${iGomb(H.MEZO_INFO.jartassag)}</h3>
    ${f('pf_armor', 'Páncél', d.profs.armor, 'w2')}${f('pf_weapons', 'Fegyver', d.profs.weapons, 'w2')}${f('pf_tools', 'Eszköz, hangszer', d.profs.tools, 'w2')}${f('pf_languages', 'Nyelvek', d.profs.languages, 'w2')}
    ${f('senses', 'Érzékek (pl. darkvision 60 ft.)', d.senses, 'w2')}${f('resist', 'Ellenállások', d.resist, 'w2')}
  </form>
  <div class="row" style="margin:14px 0"><button class="primary" data-act="edSave">Mentés</button><button data-act="edCancel">Elvetés</button></div>`;
}

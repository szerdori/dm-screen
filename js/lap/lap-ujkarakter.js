// Telefonos karakterlap (lap-ujkarakter, a karakter.html része): az új karakter kezdő varázslója
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-ujkarakter', N) és a karakter.html-ben a lap-ujkarakter.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-ujkarakter', 1);

// ---------- új karakter: a kezdő varázsló a lap helyén fut; a választások egyből a lapra íródnak (másik eszközön folytatható, a DM is látja) ----------
const NC_LEPESEK = [['alap', 'Alapok'], ['faj', 'Faj'], ['oszt', 'Osztály'], ['kep', 'Képességek'], ['hat', 'Háttér'], ['val', 'Választások'], ['var', 'Varázslatok'], ['sum', 'Összegzés']];
const NC_ALIGN = ['lawful good', 'neutral good', 'chaotic good', 'lawful neutral', 'neutral', 'chaotic neutral', 'lawful evil', 'neutral evil', 'chaotic evil'];
// legördülő: a szabványostól eltérő régi érték is megmarad
const alignSelect = (attr, cur) => `<select ${attr}><option value="">(válassz)</option>${[...(cur && !NC_ALIGN.includes(cur) ? [cur] : []), ...NC_ALIGN].map(a => `<option value="${esc(a)}" ${a === cur ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>`;
// a tallózott kép 256 px-re kicsinyítve kerül a lapra, hogy ne hízzon meg a lap és a mentés
function ncPortre(file) {
  return new Promise(kesz => {
    const id = view.id, img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const m = 256, cv = document.createElement('canvas'); cv.width = cv.height = m;
      const k = Math.max(m / img.width, m / img.height), w = img.width * k, h = img.height * k;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, m, m);  // a JPEG-ben az átlátszó rész különben fekete lenne
      g.drawImage(img, (m - w) / 2, (m - h) / 2, w, h);
      URL.revokeObjectURL(url);
      write(id, {portrait: cv.toDataURL('image/jpeg', 0.85)});
      render(true); kesz();
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Ezt a fájlt nem sikerült képként megnyitni.', true); kesz(); };
    img.src = url;
  });
}
const NC_MOD = {array: 'Standard array', buy: 'Point buy', roll: 'Dobott (4d6)', manual: 'Kézi'};
const ncSteps = plan => NC_LEPESEK.filter(([k]) => (k !== 'val' || plan.choices.length) && (k !== 'var' || plan.spells.length));
function ncBlocked(s, plan, step) {
  const b = s.build, n = list => list.reduce((t, x) => t + x.missing, 0), hiany = list => n(list) ? `Még ${n(list)} választás hiányzik.` : '';
  return step === 'faj' ? (b.race ? '' : 'Válassz fajt.') : step === 'oszt' ? (b.levels.length ? '' : 'Válassz osztályt.') : step === 'kep' ? H.ncAbilityProblem(s.newChar, b.base)
    : step === 'hat' ? (b.background ? '' : 'Válassz hátteret.') : step === 'val' ? hiany(plan.choices) : step === 'var' ? hiany(plan.spells) : '';
}
// az eredmény a faji bónusszal (az alapértékek átírásakor gépelés közben is frissül)
function ncKepInfo(s, base) {
  const nc = s.newChar, cr = H.calc({...s, build: {...s.build, base}}, RB()), p = H.ncAbilityProblem(nc, base);
  return `${nc.method === 'buy' ? `<p>Maradt: <b>${esc(H.ncBuyLeft(base))}</b> / ${esc(H.NC_BUY_POINTS)} pont</p>` : ''}
    ${p ? `<p class="warn">${esc(p)}</p>` : ''}
    <p class="hint">A faji bónusszal: ${H.ABIL.map(a => `${a.toUpperCase()} <b>${esc(cr.abilities[a].v)}</b>`).join(' · ')}</p>`;
}
function ncStepKep(s) {
  const nc = s.newChar, b = s.build, pool = H.ncPool(nc);
  const gombok = nc.methods.length > 1 ? `<div class="row">${nc.methods.map(m => `<button class="${nc.method === m ? 'on' : ''}" data-act="ncMethod" data-m="${m}" ${nc.rolls && !isDM && m !== 'roll' ? 'disabled title="Már dobtál: a dobás érvényes"' : ''}>${esc(NC_MOD[m])}</button>`).join('')}</div>` : '';
  if (nc.methods.length === 1 && !nc.method) return `<p class="hint">Egyetlen módszer engedélyezett.</p><button data-act="ncMethod" data-m="${nc.methods[0]}">${esc(NC_MOD[nc.methods[0]])}</button>`;
  let body = '';
  if (nc.method === 'roll' && !nc.rolls) body = '<p class="hint">Hat értéket kapsz (4d6, a legkisebb kocka nélkül). Egyszer dobható, utána a dobás rögzül.</p><button class="primary" data-act="ncRollDo">🎲 Dobás</button>';
  else if (nc.method === 'array' || nc.method === 'roll') {
    body = `${nc.method === 'roll' ? `<p>A dobásod: <b>${esc(pool.join(', '))}</b>${isDM ? ' <button class="small" data-act="ncReroll">Újradobás (DM)</button>' : ''}</p>` : ''}
      <div class="g6">${H.ABIL.map(a => `<label>${a.toUpperCase()}<select data-nc-pick="${a}"><option value="">–</option>${pool.map((v, i) => `<option value="${i}" ${nc.pick[a] === i ? 'selected' : ''} ${Object.entries(nc.pick).some(([k, x]) => k !== a && x === i) ? 'disabled' : ''}>${esc(v)}</option>`).join('')}</select></label>`).join('')}</div>`;
  } else if (nc.method) {
    const [lo, hi] = nc.method === 'buy' ? [8, 15] : [3, 18];
    body = `<div class="g6">${H.ABIL.map(a => `<label>${a.toUpperCase()}<input type="number" inputmode="numeric" min="${lo}" max="${hi}" data-nc-base="${a}" value="${esc(b.base[a])}"></label>`).join('')}</div>`;
  } else body = '<p class="hint">Válaszd ki, hogyan lesznek meg a képességértékek.</p>';
  return `${gombok}${body}<div id="ncOut">${nc.method && !(nc.method === 'roll' && !nc.rolls) ? ncKepInfo(s, b.base) : ''}</div>`;
}
function ncStepBody(s, plan, step) {
  const b = s.build, rb = RB(), cr = plan.cr;
  const ft = list => list.length ? `<div class="list" style="margin-top:8px">${list.map(f => det('ncf:' + f.name + f.src, `<span class="nm"><b>${esc(f.name)}</b><small>${esc(f.src)}</small></span>`, f.text ? `<div class="tx">${esc(f.text)}</div>` : '<div class="hint">Nincs leírás a szabálykönyvben.</div>')).join('')}</div>` : '';
  if (step === 'alap') return `<p class="hint">A karakter neve és külseje. Ezeket később is átírhatod.</p>
    <label>Név<input data-ncf="name" value="${esc(s.name)}" autocomplete="off"></label>
    <label>Alignment${alignSelect('data-ncf="alignment"', s.alignment)}</label>
    <div class="row" style="margin:10px 0 6px">${avatar(s.portrait, s.name)}<button data-act="ncPortre">📷 Kép tallózása…</button>${s.portrait ? '<button class="small" data-act="ncPortreTorol">Törlés</button>' : ''}<input type="file" id="ncPortreFile" accept="image/*" hidden></div>
    <div class="hint">Vagy a kép linkje ${iGomb(H.MEZO_INFO.portrait)}</div><label>Link (nem kötelező)<input data-ncf="portrait" value="${s.portrait.startsWith('data:') ? '' : esc(s.portrait)}" placeholder="${s.portrait.startsWith('data:') ? '(feltöltött kép)' : 'https://…'}"></label>`;
  if (step === 'faj') {
    const races = H.raceOptions(rb), ri = races.findIndex(o => o.race === b.race && (o.subrace || '') === (b.subrace || ''));
    const nevek = [b.race, b.subrace].filter(Boolean).map(H.refName);
    return `<label>Faj<select data-act="bRace"><option value="">(válassz fajt)</option>${races.map((o, i) => `<option value="${i}" ${i === ri ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
      ${ft(cr.features.filter(f => nevek.some(n => f.src.includes(n))))}`;
  }
  if (step === 'oszt') return `<p class="hint">Az 1. szinted osztálya. Multiclass később, szintlépéskor jön.</p><div class="list">${H.classNames(rb).map(n => { const on = b.levels[0]?.c === n, i = H.classInfo(n, rb);
    return `<button class="li ${on ? 'on' : ''}" data-act="ncCls" data-c="${esc(n)}" style="width:100%;text-align:left"><span class="nm"><b>${esc(n)}${on ? ' ✓' : ''}</b><small>d${esc(i.hd)}${H.CLASSES[n]?.saves ? ' · mentők: ' + esc(H.CLASSES[n].saves.join(', ').toUpperCase()) : ''}</small></span></button>`; }).join('')}</div>
    ${ft(cr.features.filter(f => b.levels[0] && f.src.includes(b.levels[0].c)))}`;
  if (step === 'kep') return ncStepKep(s);
  if (step === 'hat') return `<label>Háttér<select data-act="bBg">${optList((rb.backgrounds || []).map(x => ({v: x.n + '|' + x.s, l: x.n})), b.background)}</select></label>
    ${ft(cr.features.filter(f => f.src.startsWith('Háttér')))}`;
  if (step === 'val') {
    const man = cr.todos.filter(t => t.kind === 'manual');
    return `${plan.choices.map(x => choiceBox(x.c, cr)).join('')}${man.length ? `<h3>✋ Kézi teendők</h3><div class="list">${man.map(t => `<div class="li"><span class="nm">${esc(t.text)}</span>${iGomb(H.todoInfo(t, cr))}</div>`).join('')}</div><p class="hint">Ezeket a program nem tudja helyetted kiválasztani, a Teendők közt megtalálod őket.</p>` : ''}`;
  }
  if (step === 'var') {
    const c = cr.casting[0];
    return `${c ? `<p class="hint">${c.prepared ? `${esc(c.prepared)} varázslatot készíthetsz be. ` : ''}DC ${esc(c.dc)}, attack ${esc(sgn(c.atk))}.</p>` : ''}${plan.spells.map(x => choiceBox(x.c, cr)).join('')}`;
  }
  // összegzés
  const row = (l, v) => v === '' || v == null ? '' : `<tr><td>${esc(l)}</td><td><b>${esc(v)}</b></td></tr>`;
  const skillek = Object.keys(H.SKILLS).filter(k => cr.skills[k].prof >= 1).map(H.skillLabel).join(', ');
  return `<table class="lutab">${row('Név', s.name)}${row('Faj', [b.race, b.subrace].filter(Boolean).map(H.refName).join(' / '))}${row('Osztály', b.levels[0]?.c)}${row('Háttér', H.refName(b.background))}
      ${H.ABIL.map(a => row(H.ABIL_FULL[a], `${cr.abilities[a].v} (${sgn(mod(cr.abilities[a].v))})`)).join('')}
      ${row('Max HP', cr.hpMax.v)}${row('AC (felszerelés nélkül)', cr.ac.v)}${row('Speed', cr.speed.v)}${row('Mentők', H.ABIL.filter(a => cr.saves[a].prof).map(a => a.toUpperCase()).join(', '))}${row('Skillek', skillek)}</table>
    ${cr.features.length ? `<p><b>Jellemzők:</b> ${esc(cr.features.map(f => f.name).join(', '))}</p>` : ''}
    ${s.newChar.target > 1 ? `<p>Ezután a szintlépés-varázsló visz tovább a(z) ${esc(s.newChar.target)}. szintig.</p>` : ''}
    <p class="hint">A kezdő felszerelést a Felszerelés fülön veheted fel, az AC és a támadások onnan számolódnak. Készkor a lapról backup is készül.</p>`;
}
function renderNewChar(s) {
  if (!RB()?.classes?.length) { $('#main').innerHTML = `<div class="top"><a href="#">‹ Vissza</a></div><h2>✨ Új karakter</h2>${rbNote() || '<p class="hint">Ehhez a szabálykönyv kell: várd meg, amíg betöltődik.</p>'}`; return; }
  const plan = H.ncPlan(s, RB()), steps = ncSteps(plan), nc = s.newChar;
  const step = steps.some(([k]) => k === nc.step) ? nc.step : steps.at(-1)[0], i = steps.findIndex(([k]) => k === step), baj = ncBlocked(s, plan, step), last = step === 'sum';
  $('#main').innerHTML = `<div class="top"><a href="#">‹ Vissza</a><span class="hint">Minden választás azonnal mentődik.</span><span class="grow"></span>${isDM ? '<button class="small" data-act="ncSkip">Varázsló kihagyása (DM)</button>' : ''}</div>
    <h2 style="margin:6px 0">✨ ${esc(s.name)}</h2>
    <div class="lusteps">${steps.map(([k, l]) => `<span class="${k === step ? 'on' : ''}">${esc(l)}</span>`).join('')}</div>
    <div class="ncbody" data-nc-step="${esc(step)}">${ncStepBody(s, plan, step)}</div>
    <div class="row lunav"><button data-act="ncBack" ${i ? '' : 'disabled'}>Vissza</button><span class="grow hint" id="ncBaj">${esc(baj)}</span>
      ${last ? `<button class="primary" data-act="ncDone" ${ncSaving ? 'disabled' : ''}>${ncSaving ? 'Mentés…' : 'Kész'}</button>` : `<button class="primary" data-act="ncNext" ${baj ? 'disabled' : ''}>Tovább</button>`}</div>`;
}
let ncSaving = false, ncCsend = 0;
function ncMove(s, d) {
  const plan = H.ncPlan(s, RB()), steps = ncSteps(plan), i = steps.findIndex(([k]) => k === s.newChar.step), now = i < 0 ? steps.length - 1 : i, to = steps[now + d];
  if (!to || (d > 0 && ncBlocked(s, plan, steps[now][0]))) return;
  patch({newChar: {...s.newChar, step: to[0]}}); window.scrollTo(0, 0);
}
// lezárás: minden lépés rendben (egy korábbi választás később elromolhatott); a lap kész, teli HP-val, a kezdőállapotról backup készül; 1. szint fölött jöhet a szintlépés
async function ncFinish(s) {
  const plan = H.ncPlan(s, RB()), rossz = ncSteps(plan).find(([k]) => ncBlocked(s, plan, k));
  if (rossz) { toast(`${rossz[1]}: ${ncBlocked(s, plan, rossz[0])}`, true); patch({newChar: {...s.newChar, step: rossz[0]}}); return; }
  const at = new Date().toISOString(), id = view.id, L = H.level(s), p = {newChar: null, hp: {...s.hp, cur: s.hp.max}, updatedAt: at, updatedBy: me};
  ncSaving = true; render(true);
  const ok = await saveWithHist(id, p, {at, by: me, reason: 'manual', from: L, to: L, sheet: {...s, ...p}});
  ncSaving = false;
  if (!ok) { render(true); return; }
  const next = afterSave(id, s, p, at);
  histCache.delete(id); window.scrollTo(0, 0);
  if (view.id === id && luEnabled(next) && luReady(next)) luLoad(id, next);
  render(true); toast(`✓ ${next.name} elkészült`);
}
function ncAct(act, el, s) {
  const nc = s.newChar;
  if (act === 'ncCls') { if (s.build.levels[0]?.c !== el.dataset.c) patch({build: H.ncSetClass(s.build, el.dataset.c)}); }
  else if (act === 'ncMethod') {
    const m = el.dataset.m;
    if (m !== nc.method && (isDM || !nc.rolls)) patch({newChar: {...nc, method: m, pick: {}}, build: {...s.build, base: m === 'buy' ? Object.fromEntries(H.ABIL.map(a => [a, 8])) : Object.fromEntries(H.ABIL.map(a => [a, 10]))}});
  }
  else if (act === 'ncRollDo') { if (!nc.rolls) patch({newChar: {...nc, method: 'roll', rolls: H.ncRoll(rnd), pick: {}}}); }  // egyszeri: előbb rögzül a lapon, csak utána látszik
  else if (act === 'ncReroll') { if (isDM && confirm('Új dobás: a mostani értékek elvesznek. Mehet?')) patch({newChar: {...nc, rolls: null, pick: {}}, build: {...s.build, base: Object.fromEntries(H.ABIL.map(a => [a, 10]))}}); }
  else if (act === 'ncNext') ncMove(s, 1);
  else if (act === 'ncBack') ncMove(s, -1);
  else if (act === 'ncDone') { if (!ncSaving) ncFinish(s); }
  else if (act === 'ncSkip') { if (isDM && confirm('Kihagyod a varázslót? A lap a mostani állapotában marad. Az Alapadatok fülön folytathatod, a szinteket a ＋ Szint gombbal adhatod meg.')) patch({newChar: null}); }
}
// az alapértékek a mezőkből: gépelés közben csak a kiírás és a Tovább frissül (újrarajzolás elnyelné a Tovább első koppintását)
function ncBaseInput(s) {
  const base = {...s.build.base};
  document.querySelectorAll('[data-nc-base]').forEach(e => { base[e.dataset.ncBase] = Math.floor(+e.value) || 0; });
  return base;
}
function ncBaseLive(s) {
  const base = ncBaseInput(s), p = H.ncAbilityProblem(s.newChar, base);
  $('#ncOut').innerHTML = ncKepInfo(s, base); $('#ncBaj').textContent = p;
  const t = $('[data-act="ncNext"]'); if (t) t.disabled = !!p;
  return p;
}

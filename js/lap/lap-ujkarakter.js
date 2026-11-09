// Telefonos karakterlap (lap-ujkarakter, a karakter.html része): az új karakter kezdő varázslója
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-ujkarakter', N) és a karakter.html-ben a lap-ujkarakter.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-ujkarakter', 3);

// ---------- új karakter: a kezdő varázsló a lap helyén fut; a választások egyből a lapra íródnak (másik eszközön folytatható, a DM is látja) ----------
const NC_LEPESEK = [['alap', 'Alapok'], ['faj', 'Faj'], ['oszt', 'Osztály'], ['kep', 'Képességek'], ['hat', 'Háttér'], ['val', 'Választások'], ['var', 'Varázslatok'], ['fel', 'Felszerelés'], ['sum', 'Összegzés']];
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
const ncSteps = (plan, s) => NC_LEPESEK.filter(([k]) => (k !== 'val' || plan.choices.length) && (k !== 'var' || plan.spells.length) && (k !== 'fel' || ncSeRows(s).has));
function ncBlocked(s, plan, step) {
  const b = s.build, n = list => list.reduce((t, x) => t + x.missing, 0), hiany = list => n(list) ? `Még ${n(list)} választás hiányzik.` : '';
  return step === 'faj' ? (b.race ? '' : 'Válassz fajt.') : step === 'oszt' ? (b.levels.length ? '' : 'Válassz osztályt.') : step === 'kep' ? H.ncAbilityProblem(s.newChar, b.base)
    : step === 'hat' ? (b.background ? '' : 'Válassz hátteret.') : step === 'val' ? hiany(plan.choices) : step === 'var' ? hiany(plan.spells) : step === 'fel' ? ncSeBaj(s) : '';
}
// ---------- kezdő felszerelés (TERV-kezdo-felszereles.md): csomag = az osztály (a) / (b) választásai + a háttér felszerelése és pénze; arany = az osztály kezdőaranya ----------
const ncSeMod = nc => H.seMod(nc);
const ncSeRows = s => H.seRows(s.build.levels[0]?.c, s.build.background, RB());
const ncSeBaj = s => { const m = ncSeMod(s.newChar); return !m ? 'Válassz: kezdő felszerelés vagy arany.' : m === 'pack' ? H.seHiany(ncSeRows(s).rows, s.newChar.eq) : ncAranyBaj(s); };
// arany mód: dobás nélkül nem zárható le; a kosár nem lehet drágább a dobásnál
const ncMaradt = s => s.newChar.eq.gold == null ? 0 : s.newChar.eq.gold * 100 - H.seKosar(s.newChar.eq, RB()).koltseg;
const ncAranyBaj = s => s.newChar.eq.gold == null ? 'Dobd meg a kezdőaranyat.' : ncMaradt(s) < 0 ? 'A kosár drágább, mint amennyi pénzed van.' : '';
const ncTetelNev = t => `${t.q > 1 ? t.q + '× ' : ''}${t.kind === 'cat' ? t.label : t.n}${t.kind === 'item' && t.dn ? ` (${t.dn})` : ''}`;
const ncPenz = cp => { const c = H.seErmek(cp); return ['gp', 'sp', 'cp'].filter(k => c[k]).map(k => c[k] + ' ' + k).join(' ') || '0 gp'; };
function ncStepFel(s, cr) {
  const nc = s.newChar, eq = nc.eq, mod = ncSeMod(nc), rb = RB(), {rows} = ncSeRows(s);
  const modok = nc.equip === 'any' ? `<div class="row">${[['pack', '📦 Kezdő felszerelés'], ['gold', '💰 Arany helyett']].map(([m, l]) => `<button class="${mod === m ? 'on' : ''}" data-act="ncEqMode" data-m="${m}" ${m === 'pack' && eq.gold != null && !isDM ? 'disabled title="Már dobtál aranyat: a dobás érvényes"' : ''}>${l}</button>`).join('')}</div>
    <p class="hint">Kezdő felszerelés: az osztályod és a háttered felszerelése, és a háttered pénze. Arany helyett: az osztályod kezdőaranyából vásárolsz, ilyenkor a háttered felszerelését és pénzét sem kapod meg (PHB 143. o.).</p>` : '';
  if (!mod) return modok;
  if (mod === 'gold') return modok + ncStepArany(s);
  const sor = row => {
    const opt = row.opts.length === 1 ? row.opts[0] : row.opts.find(o => o.k === eq.pick[row.key]);
    const gombok = row.opts.length > 1 ? `<div class="ncse">${row.opts.map(o => `<button class="${opt === o ? 'on' : ''}" data-act="ncEqPick" data-r="${esc(row.key)}" data-k="${esc(o.k)}">(${esc(o.k)}) ${esc(o.items.map(ncTetelNev).join(', '))}</button>`).join('')}</div>`
      : `<div class="hint">${esc(opt.items.map(ncTetelNev).join(', '))}</div>`;
    const valasztok = !opt ? '' : opt.items.map((t, j) => t.kind !== 'cat' ? '' : Array.from({length: t.q}, (_, n) => {
      const key = `${row.key}:${opt.k}:${j}`, v = eq.cat[key]?.[n] || '';
      return `<label>${esc(t.label)}${t.q > 1 ? ` (${n + 1}.)` : ''}<select data-act="ncEqCat" data-key="${esc(key)}" data-n="${n}"><option value="">(válassz)</option>${t.from.map(r => `<option value="${esc(r)}" ${r === v ? 'selected' : ''}>${esc(H.refName(r))}${H.seJartas(cr, r, rb) ? '' : ' ⚠ nem vagy jártas benne'}</option>`).join('')}</select></label>`;
    }).join('')).join('');
    return `<div class="box"><b>${esc(row.src)}</b>${row.tx ? `<div class="hint">${esc(row.tx)}</div>` : ''}${gombok}${valasztok}</div>`;
  };
  return `${modok}${rows.map(sor).join('')}<p>Pénz: <b>${esc(ncPenz(H.seCsomag(rows, eq).cp))}</b> <span class="hint">(a háttered erszényéből)</span></p>
    <p class="hint">A páncél, a pajzs és a fegyverek felszerelve kerülnek a lapra; a csomagok tartalma külön tételekként, a csomagba téve.</p>`;
}
// arany mód: az osztály kezdőarany-dobása (egyszer, rögzítve; a DM újradobhat) és a kosár a PHB-árakon; a maradék pénzként kerül a lapra
let ncBoltQ = '';
const ncKocka = expr => String(expr || '').replace('*', ' × ');
function ncBoltLista(s) {
  const q = ncBoltQ.trim(), maradt = ncMaradt(s);
  if (!q) return '<p class="hint">Írd be, mit vennél (angolul, pl. longsword, chain mail, explorer\'s pack).</p>';
  const talalat = H.search(H.seBolt(RB()), q, 15);
  return talalat.length ? `<div class="list">${talalat.map(it => { const ar = H.seAr(it); return `<div class="li"><span class="nm"><b>${esc(it.n)}</b><small>${esc(ncPenz(ar))}</small></span><button class="small" data-act="ncKosar" data-r="${esc(H.refOf(it))}" data-d="1" ${ar > maradt ? 'disabled title="Nincs rá elég pénzed"' : ''}>＋</button></div>`; }).join('')}</div>`
    : '<p class="hint">Nincs ilyen megvásárolható tárgy.</p>';
}
function ncStepArany(s) {
  const nc = s.newChar, eq = nc.eq, {gold} = ncSeRows(s);
  if (eq.gold == null && !gold) return '<p class="warn">A szabálykönyv ennél az osztálynál nem adja meg a kezdőaranyat: válaszd a kezdő felszerelést, vagy kérd meg a DM-et, hogy töltse újra a szabálykönyvet.</p>';
  if (eq.gold == null) return `<p>Kezdőarany: <b>${esc(ncKocka(gold))} gp</b> (az osztályod szerint)</p><p class="hint">Egyszer dobható, utána a dobás rögzül.</p><button class="primary" data-act="ncEqGold">🎲 Dobás</button>`;
  const {list, koltseg} = H.seKosar(eq, RB()), maradt = eq.gold * 100 - koltseg;
  return `<p>A dobásod: <b>${esc(eq.gold)} gp</b> (${esc(ncKocka(gold))})${isDM ? ' <button class="small" data-act="ncEqGoldRe">Újradobás (DM)</button>' : ''}</p>
    <label>Vásárlás<input id="ncBolt" value="${esc(ncBoltQ)}" placeholder="keresés a tárgyak közt" autocomplete="off"></label>
    <div id="ncBoltTalalat">${ncBoltLista(s)}</div>
    <h3>Kosár</h3>${list.length ? `<div class="list">${list.map(x => `<div class="li"><span class="nm"><b>${x.q > 1 ? esc(x.q) + '× ' : ''}${esc(x.n)}</b><small>${esc(ncPenz(x.q * x.ar))}</small></span><button class="small" data-act="ncKosar" data-r="${esc(x.ref)}" data-d="-1">−</button><button class="small" data-act="ncKosar" data-r="${esc(x.ref)}" data-d="1" ${x.ar > maradt ? 'disabled' : ''}>＋</button></div>`).join('')}</div>` : '<p class="hint">Üres. Üresen is hagyhatod: akkor a teljes összeg pénzként kerül a lapra, és később vásárolsz.</p>'}
    <p>Összesen: <b>${esc(ncPenz(koltseg))}</b> · Maradt: <b>${esc(maradt < 0 ? '−' + ncPenz(-maradt) : ncPenz(maradt))}</b></p>`;
}
// a keresés gépelés közben csak a találatokat rajzolja újra (a mező megtartja a fókuszt)
function ncBoltKeres(t, s) { ncBoltQ = t.value; const el = $('#ncBoltTalalat'); if (el) el.innerHTML = ncBoltLista(s); }
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
  const b = s.build, rb = RB();
  let cr = plan.cr;
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
  if (step === 'fel') return ncStepFel(s, cr);
  // összegzés (a kezdő felszereléssel számolva, ha van Felszerelés lépés)
  const fel = ncSteps(plan, s).some(([k]) => k === 'fel'), felBaj = fel ? ncSeBaj(s) : '', se = fel && !felBaj ? H.seEredmeny(s, rb) : null;
  if (se) cr = H.calc({...s, inventory: se.inventory, currency: se.currency}, rb);
  if (felBaj) return `<p class="warn">Felszerelés: ${esc(felBaj)}</p><p class="hint">Lépj vissza a Felszerelés lépésre.</p>`;
  const row = (l, v) => v === '' || v == null ? '' : `<tr><td>${esc(l)}</td><td><b>${esc(v)}</b></td></tr>`;
  const skillek = Object.keys(H.SKILLS).filter(k => cr.skills[k].prof >= 1).map(H.skillLabel).join(', ');
  return `<table class="lutab">${row('Név', s.name)}${row('Faj', [b.race, b.subrace].filter(Boolean).map(H.refName).join(' / '))}${row('Osztály', b.levels[0]?.c)}${row('Háttér', H.refName(b.background))}
      ${H.ABIL.map(a => row(H.ABIL_FULL[a], `${cr.abilities[a].v} (${sgn(mod(cr.abilities[a].v))})`)).join('')}
      ${row('Max HP', cr.hpMax.v)}${row(se ? 'AC' : 'AC (felszerelés nélkül)', cr.ac.v)}${row('Speed', cr.speed.v)}${row('Mentők', H.ABIL.filter(a => cr.saves[a].prof).map(a => a.toUpperCase()).join(', '))}${row('Skillek', skillek)}
      ${se ? row('Támadások', cr.attacks.map(a => `${a.name} ${a.hit}`).join(', ')) + row('Felszerelés', se.items.filter(i => !i.container).map(i => (i.qty > 1 ? i.qty + '× ' : '') + i.name).join(', ')) + row('Pénz', ncPenz(se.cp)) : ''}</table>
    ${cr.features.length ? `<p><b>Jellemzők:</b> ${esc(cr.features.map(f => f.name).join(', '))}</p>` : ''}
    ${s.newChar.target > 1 ? `<p>Ezután a szintlépés-varázsló visz tovább a(z) ${esc(s.newChar.target)}. szintig.</p>` : ''}
    <p class="hint">${se ? 'A kezdő felszerelés Készkor kerül a Felszerelés fülre.' : `A kezdő felszerelést a Felszerelés fülön veheted fel, az AC és a támadások onnan számolódnak.${RB()?.classes?.some(c => c.se) ? '' : ' (A kezdő felszerelés választásához a DM-nek újra kell töltenie a szabálykönyvet.)'}`} Készkor a lapról backup is készül.</p>`;
}
function renderNewChar(s) {
  if (!RB()?.classes?.length) { $('#main').innerHTML = `<div class="top"><a href="#">‹ Vissza</a></div><h2>✨ Új karakter</h2>${rbNote() || '<p class="hint">Ehhez a szabálykönyv kell: várd meg, amíg betöltődik.</p>'}`; return; }
  const plan = H.ncPlan(s, RB()), steps = ncSteps(plan, s), nc = s.newChar;
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
  const plan = H.ncPlan(s, RB()), steps = ncSteps(plan, s), i = steps.findIndex(([k]) => k === s.newChar.step), now = i < 0 ? steps.length - 1 : i, to = steps[now + d];
  if (!to || (d > 0 && ncBlocked(s, plan, steps[now][0]))) return;
  patch({newChar: {...s.newChar, step: to[0]}}); window.scrollTo(0, 0);
}
// lezárás: minden lépés rendben (egy korábbi választás később elromolhatott); a lap kész, teli HP-val, a kezdőállapotról backup készül; 1. szint fölött jöhet a szintlépés
async function ncFinish(s) {
  const plan = H.ncPlan(s, RB()), rossz = ncSteps(plan, s).find(([k]) => ncBlocked(s, plan, k));
  if (rossz) { toast(`${rossz[1]}: ${ncBlocked(s, plan, rossz[0])}`, true); patch({newChar: {...s.newChar, step: rossz[0]}}); return; }
  const at = new Date().toISOString(), id = view.id, L = H.level(s), p = {newChar: null, hp: {...s.hp, cur: s.hp.max}, updatedAt: at, updatedBy: me};
  if (ncSteps(plan, s).some(([k]) => k === 'fel')) { const se = H.seEredmeny(s, RB()); p.inventory = se.inventory; p.currency = se.currency; }  // a kezdő felszerelés a lezárással egy írásban
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
  else if (act === 'ncEqMode') { if (nc.equip === 'any' && SE_MODOK.includes(el.dataset.m) && (isDM || nc.eq.gold == null || el.dataset.m === 'gold')) patch({newChar: {...nc, eq: {...nc.eq, mode: el.dataset.m}}}); }
  else if (act === 'ncEqGold') { if (nc.eq.gold == null && ncSeRows(s).gold) { ncBoltQ = ''; patch({newChar: {...nc, eq: {...nc.eq, gold: H.seAranyDob(ncSeRows(s).gold, rnd), cart: []}}}); } }  // egyszeri: előbb rögzül a lapon
  else if (act === 'ncEqGoldRe') { if (isDM && confirm('Új aranydobás: a mostani dobás és a kosár elvész. Mehet?')) patch({newChar: {...nc, eq: {...nc.eq, gold: null, cart: []}}}); }
  else if (act === 'ncKosar') {
    const d = +el.dataset.d, r = el.dataset.r, cart = nc.eq.cart.map(x => ({...x})), x = cart.find(y => y.r === r), it = H.seBolt(RB()).find(y => H.refOf(y) === r);
    if (!it || nc.eq.gold == null) return;
    if (d > 0) { if (H.seAr(it) > ncMaradt(s)) return; if (x) x.q++; else cart.push({r, q: 1}); }
    else if (x) { x.q--; if (x.q < 1) cart.splice(cart.indexOf(x), 1); }
    patch({newChar: {...nc, eq: {...nc.eq, cart}}});
  }
  else if (act === 'ncEqPick') patch({newChar: {...nc, eq: {...nc.eq, pick: {...nc.eq.pick, [el.dataset.r]: el.dataset.k}}}});
  else if (act === 'ncNext') ncMove(s, 1);
  else if (act === 'ncBack') ncMove(s, -1);
  else if (act === 'ncDone') { if (!ncSaving) ncFinish(s); }
  else if (act === 'ncSkip') { if (isDM && confirm('Kihagyod a varázslót? A lap a mostani állapotában marad. Az Alapadatok fülön folytathatod, a szinteket a ＋ Szint gombbal adhatod meg.')) patch({newChar: null}); }
}
const SE_MODOK = ['pack', 'gold'];
// a kategória-választó („bármely martial weapon”): a key a sor, a lehetőség és a tétel, az n a darab (két fegyvernél két legördülő)
function ncEqCat(t, s) {
  const nc = s.newChar, l = [...(nc.eq.cat[t.dataset.key] || [])];
  l[+t.dataset.n] = t.value;
  patch({newChar: {...nc, eq: {...nc.eq, cat: {...nc.eq.cat, [t.dataset.key]: Array.from(l, x => x || '')}}}});
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

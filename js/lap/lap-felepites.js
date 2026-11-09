// Telefonos karakterlap (lap-felepites, a karakter.html része): a szabálymotoros lap választásai (Felépítés)
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-felepites', N) és a karakter.html-ben a lap-felepites.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-felepites', 1);

// ---------- szabálymotoros lap: Felépítés (választások), Számolt értékek (ℹ bontás, ✎ felülírás), Teendők ----------
let calcMemo = {sig: null, r: null};
const asiMode = {};   // ASI-hely: 'asi' | 'feat', amíg még nincs választott érték
function calcOf(s) {
  if (!s?.auto || !RB()?.classes?.length) return null;
  const sig = view.id + sigOf(s) + JSON.stringify(s.todoDone);
  if (calcMemo.sig !== sig) calcMemo = {sig, r: H.calc(s, RB())};
  return calcMemo.r;
}
const chId = k => 'ch-' + String(k).replace(/[^A-Za-z0-9_-]/g, '_');
const optList = (opts, cur) => `<option value="">(válassz)</option>${cur && !opts.some(x => x.v === cur) ? `<option value="${esc(cur)}" selected>${esc(H.refName(cur))} (saját)</option>` : ''}`
  + opts.map(x => `<option value="${esc(x.v)}" ${x.v === cur ? 'selected' : ''} ${x.dis && x.v !== cur ? 'disabled' : ''}>${esc(x.l)}${x.note ? ' – ' + esc(x.note) : ''}</option>`).join('');
// varázslat-választó: fölül a választottak, alatta keresés és szintenként összecsukva a többi (egy Wizard-lista több száz sor)
const chSearch = {};
const spellHidden = (key, x) => { const q = (chSearch[key] || '').trim().toLowerCase(); return q && !x.l.toLowerCase().includes(q); };
function spellPicker(c, o, lock, cr) {
  const K = esc(c.key), sel = new Set(c.ok), full = !o.over && sel.size >= c.n, zar = lockedFn(c, lock);
  // miért szürke vagy miért hiányzik egy varázslat: a helyek betelve; az alosztály (pl. Warlock patrón) még nincs kiválasztva, pedig a listát bővítheti
  const nincsAl = cr?.choices.some(x => x.key === c.ctx.cls + ':sub' && !x.done) && H.subclassesOf(c.ctx.cls, RB()).some(x => JSON.stringify(x.fx || []).includes('"expanded"'));
  const miert = `${full ? '<p class="hint" style="margin:4px 0">Minden hely foglalt: másikat csak akkor választhatsz, ha előbb leveszel egyet. Ezen felül saját varázslatot a Varázslat fülön vehetsz fel.</p>' : ''}${nincsAl ? '<p class="warn" style="margin:4px 0">Előbb válaszd ki az alosztályt: a kibővített varázslatlistája (pl. Warlock patrón) csak utána látszik.</p>' : ''}`;
  const item = x => `<label ${spellHidden(c.key, x) ? 'hidden' : ''} data-chl="${esc(x.l.toLowerCase())}"><input type="checkbox" data-ch="${K}" value="${esc(x.v)}" ${sel.has(x.v) ? 'checked' : ''} ${zar(x.v) || (!sel.has(x.v) && (full || x.dis)) ? 'disabled' : ''}> ${esc(x.l)}${x.note ? ` <span class="hint">(${esc(x.note)})</span>` : ''}</label>`;
  const rest = o.opts.filter(x => !sel.has(x.v)), szintek = [...new Set(rest.map(x => x.lvl))];
  const off = c.ctx.off ? `<p class="hint" style="margin:4px 0">Ebből ${esc(c.ctx.off)} lehet a rendes listán kívül („kivétel”).</p>` : '';
  return `${miert}${off}${sel.size ? `<div class="chopts">${o.opts.filter(x => sel.has(x.v)).map(item).join('')}</div>` : ''}
    <input data-chq="${K}" value="${esc(chSearch[c.key] || '')}" placeholder="Keresés név szerint (angolul)…" autocomplete="off">
    ${szintek.map(l => det('chl:' + c.key + ':' + l, `<b>${l ? esc(H.ORD[l]) + ' level' : 'Cantrip'}</b> <span class="hint">(${rest.filter(x => x.lvl === l).length})</span>`,
      `<div class="chopts" style="margin-top:6px">${rest.filter(x => x.lvl === l).map(item).join('')}</div>`)).join('')}
    ${o.opts.length ? '' : '<p class="hint">Nincs választható varázslat.</p>'}`;
}
// szintlépéskor a korábbi választás zárolva van (lock: Sheet.levelUpPlan tétele), kivéve a szintenkénti 1 cserét
const lockedFn = (c, lock) => {
  if (!lock) return () => false;
  const can = lock.csere && lock.locked.every(v => c.ok.includes(v));
  return v => lock.locked.includes(v) && c.ok.includes(v) && !can;
};
// egy választási hely szerkesztője (a szintlépés-varázsló is ezt használja)
function choiceBox(c, cr, lock = null) {
  const o = H.choiceOptions(c, cr, RB(), sheets.get(view.id)), K = esc(c.key), zar = lockedFn(c, lock);
  const head = `<div class="chhead"><b>${esc(c.src)}</b><span class="hint">${esc(c.label || H.FX_LABEL[c.kind] || c.kind)}${c.n > 1 ? ` (${c.ok.length} / ${c.n})` : ''}</span><span class="grow"></span>${c.done ? '<span class="okk">✓</span>' : '<span class="warn">⚠</span>'}</div>`;
  let body;
  if (c.kind === 'asi') {
    const v = isObj(c.value) ? c.value : {}, feat = typeof v.feat === 'string' && v.feat ? v.feat : '';
    const mode = asiMode[c.key] || (feat ? 'feat' : 'asi');
    const picks = H.ABIL.flatMap(a => Array(Math.max(0, Math.min(2, Math.floor(num(v[a]))))).fill(a));
    body = `<select data-ch="${K}" data-asi="mode"><option value="asi" ${mode === 'asi' ? 'selected' : ''}>Képességnövelés (+2 egyre vagy +1 kettőre)</option><option value="feat" ${mode === 'feat' ? 'selected' : ''}>Feat</option></select>`
      + (mode === 'feat' ? `<select data-ch="${K}" data-asi="feat">${optList(o.opts, feat)}</select>`
        : [0, 1].map(j => `<select data-ch="${K}" data-asi="a${j}"><option value="">(+1: válassz képességet)</option>${H.ABIL.map(a => `<option value="${a}" ${picks[j] === a ? 'selected' : ''}>+1 ${a.toUpperCase()} (${esc(cr.abilities[a].v)})</option>`).join('')}</select>`).join('')
          + (picks.length === 1 ? '<p class="hint" style="margin:4px 0 0">Még 1 pont kiosztható.</p>' : ''));
  } else if (H.SPELL_KINDS.includes(c.kind)) body = spellPicker(c, o, lock, cr);
  else if (o.multi) {
    const sel = new Set(c.ok.map(String)), full = sel.size >= c.n;
    body = `<div class="chopts">${o.opts.map(x => `<label><input type="checkbox" data-ch="${K}" value="${esc(x.v)}" ${sel.has(x.v) ? 'checked' : ''} ${zar(x.v) || (!sel.has(x.v) && (full || x.dis)) ? 'disabled' : ''}> ${esc(x.l)}${x.note ? ` <span class="hint">(${esc(x.note)})</span>` : ''}</label>`).join('')}</div>`
      + (!o.opts.length ? '<p class="hint">Nincs választható (pl. expertise-hez előbb jártasság kell).</p>' : '');
  } else {
    const vals = Array.isArray(c.value) ? c.value.map(String) : c.value ? [String(c.value)] : [];
    body = Array.from({length: c.n}, (_, j) => o.free ? `<input data-ch="${K}" value="${esc(vals[j] || '')}" placeholder="${esc(c.label || H.FX_LABEL[c.kind] || '')}">${j === 0 ? iGomb(H.freeInfo(c)) : ''}`
      // ugyanazon választás másik legördülőjében már kiválasztott érték itt nem választható
      : `<select data-ch="${K}" ${zar(vals[j]) ? 'disabled' : ''}>${optList(o.opts.map(x => vals.includes(x.v) && vals[j] !== x.v ? {...x, dis: true} : x), vals[j] || '')}</select>`).join('');
  }
  return `<div class="chbox ${c.done ? '' : 'need'}" id="${chId(c.key)}">${head}${body}</div>`;
}
function choicePicked(t) {
  const s = cur(), key = t.dataset.ch, c = (lu ? H.levelUpPlan(s, RB(), lu.build).nw : calcOf(s))?.choices.find(x => x.key === key);
  if (!c) return;
  const els = [...document.querySelectorAll('[data-ch]')].filter(e => e.dataset.ch === key);
  let v;
  if (c.kind === 'asi') {
    if (t.dataset.asi === 'mode') { asiMode[key] = t.value; v = {}; }
    else if (t.dataset.asi === 'feat') v = t.value ? {feat: t.value} : {};
    else { v = {}; for (const e of els.filter(e => /^a\d$/.test(e.dataset.asi) && e.value)) v[e.value] = (v[e.value] || 0) + 1; }
  } else if (H.SPELL_KINDS.includes(c.kind)) {
    // a pipa levétele a varázslat jegyzetét is viszi: telefonon egy véletlen koppintástól ne vesszen el
    const noted = !t.checked && s.spells.find(x => x.auto && x.ref === t.value && x.note);
    if (noted && !confirm(`Leveszed: ${noted.name}? A jegyzete is törlődik.`)) { t.checked = true; return; }
    v = [...H.spellKept(c, H.choiceOptions(c, null, RB()), RB()), ...els.filter(e => e.checked).map(e => e.value)];
  } else if (H.choiceOptions(c, null, RB()).multi) v = els.filter(e => e.checked).map(e => e.value);
  else if (c.kind === 'subclass' || c.kind === 'subrace') v = els[0].value;
  else v = els.map(e => e.value.trim()).filter(Boolean);
  if (lu) { lu.build = H.setChoice(lu.build, c, v); luStore(); render(true); return; }
  const ov = H.ovAfterChoice(s, c, v, calcOf(s));
  patch({build: H.setChoice(s.build, c, v), ...(JSON.stringify(ov) !== JSON.stringify(s.ov) ? {ov} : {})});
}

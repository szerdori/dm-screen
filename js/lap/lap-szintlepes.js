// Telefonos karakterlap (lap-szintlepes, a karakter.html része): a szintlépés-varázsló
// A fájl csak deklarál; ami betöltéskor fut (figyelők, első rajzolás), az a lap-indulas.js. Ha változik, amire más fájl támaszkodik: modul('lap-szintlepes', N) és a karakter.html-ben a lap-szintlepes.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-szintlepes', 2);

// ---------- szintlépés-varázsló: a piszkozat (lu) egy ideiglenes felépítés; a mentésig a lap nem változik, és a telefonon megmarad (újratöltés, elalvó telefon) ----------
let lu = null;  // {id, from, step, cls, how: 'avg'|'roll'|'manual'|'', die, build, saving}
const LU_STEPS = [['cls', 'Osztály'], ['hp', 'HP'], ['ch', 'Választások'], ['sp', 'Varázslatok'], ['ft', 'Jellemzők'], ['sum', 'Összegzés']];
const luFile = id => window.Szerzodes.HELYI.szintlepes(id);
function luStore() { try { localStorage.setItem(luFile(lu.id), JSON.stringify(lu)); } catch {} }
function luDrop(id) { try { localStorage.removeItem(luFile(id)); } catch {} }
// a tárolt piszkozat csak akkor él, ha ugyanarról a szintről indult (másik eszközön már léphetett); a kézzel átírt tárolót sem hisszük el
function luLoad(id, s) {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(luFile(id))); } catch {}
  const L = H.level(s);
  const uj = () => {
    lu = {id, from: L, step: 'cls', cls: '', how: '', die: null, build: null, base: ''};
    if (s.classes.length === 1) luSetClass(s, s.classes[0].name);
    return lu;
  };
  if (!isObj(d) || d.from !== L) return uj();
  // a piszkozat osztálya meglévő, vagy (multiclass) a szabálykönyv osztálya
  const build = H.norm({auto: true, build: d.build}).build, ismert = s.classes.some(c => c.name === d.cls) || H.classNames(RB()).includes(d.cls);
  const cls = ismert && build.levels.at(-1)?.c === d.cls && build.levels.length === L + 1 ? d.cls : '';
  if (!cls) return uj();
  const hd = H.classInfo(cls, RB()).hd, die = Number.isInteger(d.die) && d.die >= 1 && d.die <= hd ? d.die : null, how = die && ['roll', 'manual'].includes(d.how) ? d.how : d.how === 'avg' ? 'avg' : '';
  build.levels.at(-1).hp = how === 'avg' ? null : how ? die : null;
  lu = {id, from: L, step: LU_STEPS.some(([k]) => k === d.step) ? d.step : 'cls', cls, how, die: how === 'avg' ? null : die, build, base: String(d.base)};
  if (lu.base !== H.stableJson(s.build)) luRebase(s);
  return lu;
}
const luEnabled = s => !!s.levelUp && s.levelUp.to > H.level(s) && H.level(s) < 20;
// a felépítés minden szintet tartalmaz (különben a varázsló a lapot visszaejtené a felépítés szintjére)
const luReady = s => s.auto && s.build.levels.length === H.level(s);
function luBar(s) {
  if (!luEnabled(s)) return '';
  const to = H.level(s) + 1;
  if (!s.auto) return `<div class="lubar"><span class="grow">⬆ <b>Szintlépés: ${esc(to)}. szint.</b> Előbb állítsd át a lapot a szabálymotorra (Alapadatok fül).</span><button class="small" data-tab="adat">Alapadatok</button></div>`;
  if (!RB()?.classes?.length) return `<div class="lubar"><span class="grow">⬆ <b>Szintlépés: ${esc(to)}. szint.</b> Ehhez a szabálykönyv kell: várd meg, amíg betöltődik.</span></div>`;
  if (!luReady(s)) return `<div class="lubar"><span class="grow">⬆ <b>Szintlépés: ${esc(to)}. szint.</b> A lap szintjei nem egyeznek a felépítéssel (pl. a szabálykönyvben nem szereplő osztály): kérd meg a DM-et, hogy állítsa be.</span></div>`;
  return `<div class="lubar"><span class="grow">⬆ <b>Szintlépés: ${esc(to)}. szint</b>${s.levelUp.to > to ? ` <span class="hint">(a DM ${esc(s.levelUp.to)}. szintig engedte)</span>` : ''}</span><button class="primary" data-act="luStart">Indítás</button></div>`;
}
function luSetClass(s, cls) { lu.cls = cls; lu.how = ''; lu.die = null; lu.build = H.levelUpBuild(s, cls); lu.base = H.stableJson(s.build); }
// ha a felépítés közben másképp változott (DM, Felépítés fül), a régi piszkozat felülírná: a választások újrakezdődnek, a HP és a dobás marad
function luRebase(s) {
  const {how, die} = lu;
  luSetClass(s, lu.cls);
  if (how) luSetHp(how, die);
  lu.step = 'cls'; luStore();
}
function luSetHp(how, die = null) {
  lu.how = how; lu.die = die;
  lu.build = {...lu.build, levels: lu.build.levels.map((l, i) => i === lu.from ? {...l, hp: how === 'avg' ? null : die} : l)};
  luStore();
}
const luSteps = plan => LU_STEPS.filter(([k]) => k === 'cls' || (plan && (k !== 'ch' || plan.choices.length) && (k !== 'sp' || plan.spells.length || plan.nw.casting.some(x => x.cls === plan.cls))));
const luMissing = list => list.reduce((t, x) => t + x.missing, 0);
function luBlocked(plan) {
  if (lu.step === 'cls') return lu.cls ? '' : 'Válassz osztályt.';
  if (lu.step === 'hp') return !lu.how ? 'Válaszd ki, hogyan lesz meg a HP.' : lu.how === 'manual' && !lu.die ? 'Írd be a dobott értéket.' : '';
  const n = lu.step === 'ch' ? luMissing(plan.choices) : lu.step === 'sp' ? luMissing(plan.spells) : 0;
  return n ? `Még ${n} választás hiányzik.` : '';
}
// multiclass (TERV-multiclass.md): mit ad az új osztály multiclassként (hit die, jártasság a szabálykönyv mc.fx-éből, varázsol-e)
function luMcInfo(n) {
  const ci = H.classInfo(n, RB()), l = [`d${ci.hd}`];
  for (const x of ci.r?.mc?.fx || []) {
    if (x.armor?.length) l.push('páncél: ' + x.armor.join(', '));
    if (x.weapon?.length) l.push('fegyver: ' + x.weapon.join(', '));
    if (x.tool?.length) l.push('eszköz: ' + x.tool.join(', '));
    if (x.skillChoose) l.push(`${x.skillChoose.n} skill`);
  }
  if (ci.caster) l.push(ci.caster === 'pact' ? 'Pact Magic' : 'varázsol');
  return l.join(' · ');
}
// a meglévő osztályok, alattuk a többi (multiclass): a PHB 163. o. feltétele csak figyelmeztet (⚠ és az ok), nem tilt
const luUjOsztalyok = s => H.classNames(RB()).filter(n => !s.classes.some(c => c.name === n || H.findClass(c.name) === n));
function luStepCls(s) {
  const dis = lu.how === 'roll' ? 'disabled' : '', cr = calcOf(s);
  const sor = (n, fej, al) => `<button class="li ${lu.cls === n ? 'on' : ''}" data-act="luCls" data-c="${esc(n)}" ${dis} style="width:100%;text-align:left"><span class="nm">${fej}${lu.cls === n ? ' ✓' : ''}${al ? `<small>${al}</small>` : ''}</span></button>`;
  const uj = luUjOsztalyok(s).map(n => { const m = H.mcCheck(s, RB(), n, cr); return sor(n, `<b>${m.ok ? '' : '⚠ '}${esc(n)}</b> 1. szint`, esc(m.ok ? luMcInfo(n) : m.hiany.join('; ') + ' · ' + luMcInfo(n))); }).join('');
  return `<p class="hint">Melyik osztályban lépsz szintet?</p><div class="list">${s.classes.map(c => sor(c.name, `<b>${esc(c.name)}</b> ${esc(c.level)} → ${esc(c.level + 1)}`, '')).join('')}</div>
    ${uj ? `<details data-key="lu:uj" ${openKeys.has('lu:uj') || luUjOsztalyok(s).includes(lu.cls) ? 'open' : ''}><summary><b>🔀 Új osztály (multiclass)</b></summary><p class="hint">A PHB szerint az új és a meglévő osztályok fő képessége is legalább 13 kell (⚠ = nem teljesül; így is választható, de a DM látja). Multiclassként kevesebb jártasság jár, mentő nem.</p><div class="list">${uj}</div></details>` : ''}
    ${lu.how === 'roll' ? '<p class="hint">Már dobtál HP-t, ezért az osztály nem változtatható.</p>' : ''}`;
}
const luHpText = plan => {
  const h = plan.hp;
  return lu.how && (lu.how !== 'manual' || lu.die) ? `+${esc(h.die)} (${lu.how === 'avg' ? 'átlag' : lu.how === 'roll' ? 'dobás' : 'kézi'}, d${esc(h.hd)})${h.rest ? ` ${esc(sgn(h.rest))} (CON és bónuszok)` : ''} = <b>${esc(sgn(h.gain))}</b> → max HP <b>${esc(h.to)}</b>` : '';
};
function luStepHp(plan) {
  const h = plan.hp, rolled = lu.how === 'roll';
  return `<p class="hint">Mennyi HP-t kapsz ezen a szinten? (d${esc(h.hd)}, most max HP ${esc(h.from)})</p>
    <div class="row"><button class="${lu.how === 'avg' ? 'on' : ''}" data-act="luHow" data-how="avg" ${rolled ? 'disabled' : ''}>Átlag (${esc(h.avg)})</button>
      <button class="${rolled ? 'on' : ''}" data-act="luHow" data-how="roll" ${rolled ? 'disabled' : ''}>🎲 Dobás</button>
      <button class="${lu.how === 'manual' ? 'on' : ''}" data-act="luHow" data-how="manual" ${rolled ? 'disabled' : ''}>Kézi</button></div>
    ${rolled ? `<p>A dobás: <b>${esc(lu.die)}</b> – egyszer dobható, ez rögzült.</p>` : ''}
    ${lu.how === 'manual' ? `<label class="hint">A dobott érték (1–${esc(h.hd)})<input id="luHpIn" type="number" inputmode="numeric" min="1" max="${esc(h.hd)}" value="${esc(lu.die ?? '')}"></label>` : ''}
    <p id="luHpOut">${luHpText(plan)}</p>`;
}
function luBox(x, plan) {
  const note = !x.uj && !x.csere ? 'Korábbról elmaradt: most pótolhatod, de nem kötelező.' : x.csere ? 'Egyet lecserélhetsz: vedd le a pipát (vagy válts a listán), és válassz másikat.' : '';
  return `${note ? `<p class="hint" style="margin:8px 0 2px">${esc(note)}</p>` : ''}${choiceBox(x.c, plan.nw, x)}`;
}
function luStepSp(plan) {
  const cast = plan.nw.casting.find(x => x.cls === plan.cls), info = cast ? `<p class="hint">${cast.prepared ? `Mostantól ${esc(cast.prepared)} varázslatot készíthetsz be. ` : ''}${cast.maxSpell ? `Legfeljebb ${esc(cast.maxSpell)}. szintű varázslatot tanulhatsz. ` : ''}DC ${esc(cast.dc)}, attack ${esc(sgn(cast.atk))}.</p>` : '';
  return info + plan.spells.map(x => luBox(x, plan)).join('');
}
function luStepFt(plan) {
  const ft = plan.features.map(f => det('luf:' + f.name + f.src, `<span class="nm"><b>${esc(f.name)}</b><small>${esc(f.src)}</small></span>`, f.text ? `<div class="tx">${esc(f.text)}</div>` : '<div class="hint">Nincs leírás a szabálykönyvben.</div>')).join('');
  return `${ft ? `<div class="list">${ft}</div>` : '<p class="hint">Ezen a szinten nincs új jellemző.</p>'}
    ${plan.resources.length ? `<h3>Erőforrások</h3><div class="list">${plan.resources.map(r => `<div class="li"><span class="nm">${esc(r.name)}</span><b>${esc(r.from)} → ${esc(r.to)}</b></div>`).join('')}</div>` : ''}
    ${plan.manual.length ? `<h3>✋ Kézi teendők</h3><div class="list">${plan.manual.map(t => `<div class="li"><span class="nm">${esc(t.text)}</span>${iGomb(H.todoInfo(t, plan.nw))}</div>`).join('')}</div><p class="hint">Ezeket a program nem tudja helyetted kiválasztani, a Teendők közt megtalálod őket.</p>` : ''}`;
}
function luStepSum(s, plan) {
  const n = H.norm({...s, ...H.levelUpApply(s, RB(), lu.build)}), row = (l, a, b) => a === b ? '' : `<tr><td>${esc(l)}</td><td>${esc(a)} → <b>${esc(b)}</b></td></tr>`;
  const hd = x => H.hitDice(x).map(h => h.max + 'd' + h.die).join(' + ');
  const slots = x => [...x.spellcasting.slots.map((v, i) => v ? `${i + 1}.: ${v}` : '').filter(Boolean), x.spellcasting.pact.max ? `Pact: ${x.spellcasting.pact.max} (${x.spellcasting.pact.level}.)` : ''].filter(Boolean).join(', ') || '–';
  const casting = plan.nw.casting.map(c => { const o = plan.old.casting.find(x => x.cls === c.cls); return row(`${c.cls}: spell DC`, o?.dc ?? '–', c.dc) + (c.prepared ? row(`${c.cls}: bekészíthető`, o?.prepared ?? 0, c.prepared) : ''); }).join('');
  const ovK = Object.keys(n.ov), nyitott = plan.nw.todos.length, m = H.mcCheck(s, RB(), plan.cls, plan.old);
  return `${m.uj ? `<p class="${m.ok ? '' : 'warn'}">🔀 Új osztály: <b>${esc(plan.cls)} 1</b>${m.ok ? '' : ` – ⚠ ${esc(m.hiany.join('; '))} (a DM látni fogja)`}</p>` : ''}<table class="lutab">
      ${row('Szint', H.level(s), H.level(n))}${row('Osztályok', H.classLabel(s), H.classLabel(n))}${row('Jártassági bónusz', sgn(H.pb(s)), sgn(H.pb(n)))}${row('Max HP', s.hp.max, n.hp.max)}${row('Jelenlegi HP', s.hp.cur, n.hp.cur)}${row('Hit Dice', hd(s), hd(n))}
      ${H.ABIL.map(a => row(H.ABIL_FULL[a], s.abilities[a], n.abilities[a])).join('')}${row('AC', s.ac, n.ac)}${row('Speed', s.speed, n.speed)}
      ${H.ABIL.map(a => row(a.toUpperCase() + ' mentő', sgn(H.saveBonus(s, a)), sgn(H.saveBonus(n, a)))).join('')}${row('Spell slotok', slots(s), slots(n))}${casting}
      ${plan.resources.map(r => row(r.name, r.from, r.to)).join('')}
    </table>
    ${plan.features.length ? `<p><b>Új jellemzők:</b> ${esc(plan.features.map(f => f.name).join(', '))}</p>` : ''}
    ${ovK.length ? `<p class="hint">✎ Kézzel felülírt értékek maradnak: ${esc(ovK.join(', '))}</p>` : ''}
    ${nyitott ? `<p class="warn">📋 Nyitva marad ${esc(nyitott)} teendő: a Teendők közt később pótolhatod.</p>` : ''}
    <p class="hint">Mentés előtt a lap az előzményekbe kerül, így a szintlépés visszavonható.</p>`;
}
function renderWizard(s) {
  const plan = lu.cls ? H.levelUpPlan(s, RB(), lu.build) : null, steps = luSteps(plan);
  if (!steps.some(([k]) => k === lu.step)) lu.step = steps.at(-1)[0];
  const body = lu.step === 'cls' ? luStepCls(s) : lu.step === 'hp' ? luStepHp(plan) : lu.step === 'ch' ? plan.choices.map(x => luBox(x, plan)).join('') : lu.step === 'sp' ? luStepSp(plan) : lu.step === 'ft' ? luStepFt(plan) : luStepSum(s, plan);
  const baj = luBlocked(plan), i = steps.findIndex(([k]) => k === lu.step), last = lu.step === 'sum';
  $('#main').innerHTML = `<div class="top"><button class="small" data-act="luClose">‹ Bezárás</button><span class="hint">A piszkozat megmarad.</span></div>
    <h2 style="margin:6px 0">⬆ ${esc(s.name)}: ${esc(lu.from + 1)}. szint</h2>
    <div class="lusteps">${steps.map(([k, l]) => `<span class="${k === lu.step ? 'on' : ''}">${esc(l)}</span>`).join('')}</div>
    ${body}
    <div class="row lunav"><button data-act="luBack" ${i ? '' : 'disabled'}>Vissza</button><span class="grow hint">${esc(baj)}</span>
      ${last ? `<button class="primary" data-act="luSave" ${lu.saving ? 'disabled' : ''}>${lu.saving ? 'Mentés…' : 'Mentés'}</button>` : `<button class="primary" data-act="luNext" ${baj ? 'disabled' : ''}>Tovább</button>`}</div>`;
}
const histId = at => at.replace(/[:.]/g, '-');
let saveTimeout = 20000;
// a pillanatkép és a lap egy írásban; a sikertelen írás nem hagy nyomot, és nem marad el csendben. Internet nélkül nem indul (a Firestore különben sorba állítaná)
const saveWithHist = (id, p, h) => biztosIr(() => window.KDB.saveWithHist(id, JSON.parse(JSON.stringify(p)), histId(h.at), JSON.parse(JSON.stringify(h))));
async function biztosIr(ir0) {
  if (sheetStale) { alert('Az oldal egy része régi változatból töltődött be, ezért nem mentettem.\nFrissítsd az oldalt (Ctrl + F5).'); return false; }
  if (navigator.onLine === false) { alert('Nincs internet. A mentéshez kapcsolat kell, a piszkozat megmarad.'); return false; }
  try {
    const ir = ir0();
    await Promise.race([ir, new Promise((_, rej) => setTimeout(() => rej(new Error('időtúllépés')), saveTimeout))]);
    return true;
  } catch (e) {
    // a kapcsolat közben szakadt meg: a Firestore az írást megőrizte, és feltölti, amint van internet (a helyi lap már az új)
    if (e.message === 'időtúllépés') { alert('Nincs kapcsolat a felhővel. A mentés sorba állt, és magától feltöltődik, amint lesz internet.'); return true; }
    console.warn('az előzményes mentés nem sikerült:', e.code || e.message);
    alert(e.code === 'permission-denied' ? 'A mentést a jogosultsági szabályok nem engedték: lehet, hogy a DM közben visszavonta az engedélyt, vagy frissítenie kell a szabályokat a Firebase konzolban.' : 'A mentés nem sikerült (' + (e.code || e.message) + '). A lap nem változott, próbáld újra.');
    return false;
  }
}
// a mentés után a helyi lap és a csapat felé látszó rész (a felhős figyelő ezt később megerősíti)
function afterSave(id, s, p, at) {
  const next = H.norm({...(sheets.get(id) || s), ...p, updatedAt: at, updatedBy: me});
  sheets.set(id, next); calcSig.set(id, sigOf(next));
  pubSheet(id, next);
  return next;
}
async function luFinish(s) {
  const at = new Date().toISOString(), id = lu.id, from = lu.from, how = lu.how;
  const p = {...H.levelUpApply(s, RB(), lu.build), updatedAt: at, updatedBy: me}, m = H.mcCheck(s, RB(), lu.cls, calcOf(s));
  lu.saving = true; render(true);
  // a nem teljesült multiclass-feltétel az előzményben is látszik (a DM-nek)
  const ok = await saveWithHist(id, p, {at, by: me, reason: 'levelup', from, to: from + 1, hp: how, ...(m.ok ? {} : {mc: {cls: lu.cls, hiany: m.hiany}}), sheet: s});
  if (lu) lu.saving = false;
  if (!ok) { render(true); return; }
  afterSave(id, s, p, at);
  luDrop(id); lu = null; histCache.delete(id); window.scrollTo(0, 0);
  render(true);
  toast(`✓ ${from + 1}. szint elmentve`);
}
function luAct(act, el, s) {
  const plan = lu.cls ? H.levelUpPlan(s, RB(), lu.build) : null, steps = luSteps(plan), i = steps.findIndex(([k]) => k === lu.step);
  if (act === 'luClose') { luStore(); lu = null; render(true); return; }
  if (act === 'luCls') {
    const c = el.dataset.c, m = H.mcCheck(s, RB(), c, calcOf(s));
    if (lu.how === 'roll' || lu.cls === c || !(s.classes.some(x => x.name === c) || luUjOsztalyok(s).includes(c))) return;
    if (!m.ok && !confirm(`A PHB szerint ehhez: ${m.hiany.join('; ')}.\nA DM látni fogja. Így is felveszed: ${c}?`)) return;
    luSetClass(s, c);
  }
  else if (act === 'luHow') {
    if (lu.how === 'roll') return;
    const how = el.dataset.how;
    // a dobás egyszeri: előbb rögzül a piszkozatban, csak utána látszik
    if (how === 'roll') luSetHp('roll', rnd(plan.hp.hd));
    else if (how === 'manual') luSetHp('manual', lu.how === 'manual' ? lu.die : null);
    else luSetHp('avg');
  }
  else if (act === 'luNext') { if (luBlocked(plan)) return; lu.step = steps[i + 1][0]; window.scrollTo(0, 0); }
  else if (act === 'luBack') { if (i > 0) lu.step = steps[i - 1][0]; window.scrollTo(0, 0); }
  else if (act === 'luSave') { if (!lu.saving) luFinish(s); return; }
  luStore(); render(true);
}

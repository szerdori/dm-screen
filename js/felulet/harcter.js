// Harctér (felület): a fő képernyő rajzolása – csempék, részletes adatlap, napló és dobáslinkek, nehézség, mentésjelző, belépő-ablak.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('harcter', N) és az index.html-ben a harcter.js?v=N és a VART_MODULOK.
'use strict';
modul('harcter', 1);

// ---------- fejléc: mentésjelző, emlékeztető a fájlba mentésre, belépő-ablak ----------
const setSaveState = t => $('#saveState').textContent = t;
function renderNag() {
  const el = $('#backupNag'); if (!el) return;
  const last = S.settings.lastExport;
  const days = last ? Math.floor((new Date(localDate()) - new Date(last)) / 86400000) : null;
  const show = hasData() && (days === null || days >= EXPORT_DAYS);
  el.hidden = !show;
  if (show) el.textContent = `💾 Mentés fájlba (${days === null ? 'még sosem volt' : days + ' napja'})`;
}
function renderGate(html) {
  const g = $('#gate');
  g.hidden = !html;
  if (html) g.innerHTML = `<div>${html}</div>`;
}
// ---------- dobások a naplóban és a szövegben (megjelenítés) ----------
const TIP_HIT = 'Támadódobás – kattintás: normál · Shift+kattintás: előny · Ctrl+kattintás: hátrány';
const TIP_DMG = 'Sebzésdobás – kattintás: normál · Shift+kattintás: kritikus (dupla kocka)';
const TIP_RECH = 'Recharge – d6 dobás, ennyi vagy több kell, hogy újra használható legyen';
function log(html, cls = '') {
  logLines.unshift({html, cls});
  logLines = logLines.slice(0, 150);
  $('#log').innerHTML = logLines.map(l => `<div class="le ${l.cls}">${l.html}</div>`).join('');
}

// szövegben lévő dobások kattinthatóvá tétele
const LINK_RE = /(\d+d\d+(?:\s*[+\-−]\s*\d+(?!\s*d))?)|([+\-]\d+)(?= to hit)|(?<=Attack(?: Roll)?:\s?)([+\-]\d+)|(\(Recharge (\d)(?:[–-]6)?\))/g;
function linkify(s) {
  return esc(s).replace(LINK_RE, (m, dice, hit, hit2, rech, rn) => {
    if (dice) return `<span class="roll" data-roll="${dice.replace(/\s/g, '')}" title="${TIP_DMG}">${dice}</span>`;
    if (hit || hit2) return `<span class="roll hit" data-hit="${hit || hit2}" title="${TIP_HIT}">${hit || hit2}</span>`;
    if (rech) return `<span class="roll" data-rech="${rn || 6}" title="${TIP_RECH}">${rech}</span>`;
    return m;
  }).replace(/\n/g, '<br>');
}

// ---------- megjelenítés ----------
function render() {
  $('#roundNo').textContent = S.enc.round || 1;
  renderTiles(); renderDetail(); renderDiff(); renderNag(); broadcast();
}
// a soron következő csempe látszódjon (lep)
function aktivCsempeMutat() { document.querySelector('.tile.active')?.scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
// ---------- nehézség (megjelenítés) ----------
const DIFF_HU = {trivial: 'Triviális', easy: 'Könnyű', medium: 'Közepes', hard: 'Nehéz', deadly: 'Halálos'};
function renderDiff() {
  const d = difficulty(), el = $('#diff');
  el.className = d.rating ? 'd-' + d.rating : '';
  el.textContent = d.rating ? `${DIFF_HU[d.rating]} · ${d.adj} XP` : 'Nehézség: –';
  if (d.noLevel.length || d.noCr.length) el.textContent += ' ⚠';
}
function openDiffInfo() {
  const d = difficulty();
  const lvlNames = ['Könnyű', 'Közepes', 'Nehéz', 'Halálos'], keys = ['easy', 'medium', 'hard', 'deadly'];
  const warn = [
    !d.party.length ? 'Nincs játékos a csapattársak között – a nehézséghez a játékosok szintje kell.' : '',
    !d.enemies.length ? 'Nincs ellenfél az encounterben.' : '',
    d.noLevel.length ? `Ismeretlen szint (nem számolva): ${d.noLevel.join(', ')} – az adatlapon a „CR / szint” mezőbe írd be a szintet.` : '',
    d.noCr.length ? `Ismeretlen CR (nem számolva): ${d.noCr.join(', ')} – az adatlapon add meg a CR-t.` : ''
  ].filter(Boolean);
  openModal(`<h2>Encounter nehézsége</h2>
    ${d.rating ? `<p style="font-size:18px">Eredmény: <b class="d-${d.rating}" style="padding:2px 8px;border-radius:6px">${DIFF_HU[d.rating]}</b> &nbsp; <span class="muted">${d.adj} korrigált XP</span></p>` : ''}
    ${warn.map(w => `<p style="color:var(--orange)">⚠ ${esc(w)}</p>`).join('')}
    <h3>Csapat (${d.party.length} fő) – küszöbök</h3>
    <table class="dt"><tr><th>Játékos</th><th class="n">Szint</th>${lvlNames.map(l => `<th class="n">${l}</th>`).join('')}</tr>
      ${d.party.map(x => { const l = pcLevel(x.c); return `<tr><td>${esc(nameOf(x))}</td><td class="n">${l ?? '?'}</td>${[0, 1, 2, 3].map(i => `<td class="n">${l ? XP_THRESH[l][i] : '–'}</td>`).join('')}</tr>`; }).join('')}
      <tr class="hl"><td>Összesen</td><td></td>${d.thresh.map((v, i) => `<td class="n">${v}</td>`).join('')}</tr></table>
    <h3>Ellenfelek (${d.enemies.length})</h3>
    <table class="dt"><tr><th>Ellenfél</th><th class="n">CR</th><th class="n">XP</th></tr>
      ${d.enemies.map(x => `<tr><td>${esc(nameOf(x))}${x.dead ? ' <span class="muted">(halott)</span>' : ''}</td><td class="n">${esc(x.c.cr || '?')}</td><td class="n">${crXp(x.c.cr) ?? '–'}</td></tr>`).join('')}
      <tr><td>Alap XP (ennyit kap a csapat)</td><td></td><td class="n">${d.base}</td></tr>
      <tr><td>Szorzó (${d.counted} ellenfél, ${d.party.length} fős csapat)</td><td></td><td class="n">×${d.mult}</td></tr>
      <tr class="hl"><td>Korrigált XP (ez számít a nehézséghez)</td><td></td><td class="n">${d.adj}</td></tr></table>
    <p class="hint">A Dungeon Master's Guide (2014) 5. fejezete szerint. A korrigált XP-t a csapat küszöbeivel hasonlítja össze; a szorzó az ellenfelek számától függ, és 3 főnél kisebb csapatnál egy fokkal nő, 6 főnél nagyobbnál egy fokkal csökken.
    Csak a csapattárs <b>játékosok</b> számítanak a csapatba, és minden ellenfél beleszámít (a halottak is, hiszen a harc egészét értékeli). Az ellenfél / csapattárs oldalt a csempe bal alsó gombjával váltod.
    Fejenként ${d.party.length ? Math.floor(d.base / d.party.length) : 0} XP jár a legyőzött ellenfelekért.</p>
    <div class="toolbar"><button data-act="edCancel">Bezárás</button></div>`);
}
function crLabel(c) {
  if (!c.cr) return '';
  return /^[\d\/.]+$/.test(String(c.cr)) ? 'CR ' + c.cr : c.cr;
}
function renderTiles() {
  const o = order();
  if (!o.length) {
    $('#tiles').innerHTML = `<div class="empty">Még nincs senki az encounterben.<br><button class="primary" data-act="openLib">＋ Lények és játékosok hozzáadása</button></div>`;
    return;
  }
  $('#tiles').innerHTML = o.map(tileHtml).join('');
}
function tileHtml(x) {
  const c = x.c, max = c.hp.max || 1;
  const pct = Math.max(0, Math.min(100, x.hp / max * 100));
  const cls = ['tile', 'k-' + c.kind, sideOf(x)];
  if (x.cid === S.enc.active) cls.push('active');
  if (x.cid === selected) cls.push('selected');
  if (x.dead) cls.push('dead');
  if (x.hiddenP) cls.push('hiddenp');
  const hpCls = pct <= 25 ? 'low' : pct <= 50 ? 'mid' : '';
  const tmpPct = x.temp ? Math.min(100, x.temp / max * 100) : 0;
  const chips = (x.conc ? `<span class="chip conc" data-act="toggleConc" title="Koncentráció – kattints a megszüntetéshez">Koncentráció</span>` : '') +
    x.cond.map((k, i) => `<span class="chip" data-act="rmCond" data-i="${i}" title="Kattints az eltávolításhoz">${esc(k.name)}${k.rounds != null ? ' (' + k.rounds + ')' : ''}</span>`).join('');
  const atkRows = [], others = [];
  [...c.actions.map(a => [a, '']), ...c.bonusActions.map(a => [a, 'B'])].forEach(([a, t]) => {
    const inf = atkInfo(a.name + ' ' + a.text);
    const rech = (a.name.match(/Recharge (\d)/) || [])[1];
    if (inf.hit || inf.dice.length) {
      atkRows.push(`<div class="atk" data-label="${esc(a.name)}">${t ? `<span class="tag">${t}</span>` : ''}<span class="an" title="${esc(a.text)}">${esc(a.name.replace(/\s*\(Recharge[^)]*\)/, ''))}</span>` +
        (rech ? `<span class="roll" data-rech="${rech}" title="${TIP_RECH}">⟳${rech}</span>` : '') +
        (inf.hit ? `<span class="roll hit" data-hit="${inf.hit}" title="${TIP_HIT}">${inf.hit}</span>` : '') +
        inf.dice.slice(0, 3).map(d => `<span class="roll" data-roll="${d.expr}" title="${TIP_DMG}">${d.expr}</span>${d.type ? `<small class="muted">${esc(d.type)}</small>` : ''}`).join(' ') + '</div>');
    } else others.push((t ? t + ': ' : '') + a.name);
  });
  c.reactions.forEach(a => others.push('R: ' + a.name));
  const legN = c.legendary.length ? (c.legendaryCount || 3) : 0;
  const pips = legN ? `<span class="pips" title="Legendás akciók">LA ${Array.from({length: legN}, (_, i) => `<span class="pip ${i < x.leg ? 'used' : 'free'}" data-act="leg" data-i="${i}"></span>`).join('')}</span>` : '';
  return `<div class="${esc(cls.join(' '))}" data-cid="${esc(x.cid)}">
    <div class="t-head">
      <input class="init" type="number" value="${esc(x.init ?? '')}" placeholder="${sgn(initBonusOf(c))}" title="Initiative (bónusz: ${sgn(initBonusOf(c))})">
      ${c.portrait ? `<img class="av" src="${esc(c.portrait)}" alt="" data-act="select" onerror="this.style.display='none'">` : ''}
      <div class="t-name" data-act="select" title="Részletek">${esc(nameOf(x))} <small>${esc(crLabel(c))}</small></div>
      <div class="ac" title="AC${c.acNote ? ' – ' + esc(c.acNote) : ''}">🛡 ${esc(c.ac)}</div>
    </div>
    <div class="hpbar ${hpCls}"><div class="fill" style="width:${pct}%"></div>${tmpPct ? `<div class="tmp" style="width:${tmpPct}%"></div>` : ''}<span>${esc(x.hp)} / ${esc(max)}${x.temp ? ' +' + esc(x.temp) : ''}</span></div>
    <div class="hp-ctl">
      <input class="hpin" type="number" placeholder="±HP" title="Pozitív szám = sebzés, negatív (pl. -10) = gyógyítás, Enter-rel alkalmazod">
      <button class="dmg" data-act="dmg" title="Sebzés">−</button>
      <button class="heal" data-act="heal" title="Gyógyítás">+</button>
      <button data-act="temp" title="Temp HP beállítása">T</button>
    </div>
    ${chips ? `<div class="conds">${chips}</div>` : ''}
    ${atkRows.length ? `<div class="atks">${atkRows.slice(0, 6).join('')}</div>` : ''}
    ${others.length ? `<div class="other">${esc(others.join(' · '))}</div>` : ''}
    <div class="t-foot"><button class="sidebtn ${esc(sideOf(x))}" data-act="toggleSide" title="Kattints az oldal váltásához (ellenfél ↔ csapattárs)">${SIDE_HU[sideOf(x)]}</button>${pips}<span class="grow"></span>
      <button class="small ${x.conc ? 'on' : ''}" data-act="toggleConc" title="Koncentráció">C</button>
      <button class="small ${x.hiddenP ? 'on' : ''}" data-act="toggleHidden" title="Elrejtés a játékos képernyőről (pl. lesben álló ellenfél)">🙈</button>
      <button class="small" data-act="toggleDead" title="Halott / él">💀</button>
      <button class="small" data-act="dup" title="Még egy ilyen">⎘</button>
      <button class="small" data-act="remove" title="Eltávolítás">✕</button>
    </div>
  </div>`;
}
function statblock(c) {
  const line = (k, v) => v ? `<p class="line"><b>${k}</b> ${linkify(v)}</p>` : '';
  const saves = ABIL.filter(a => c.saves[a] != null).map(a => `${cap(a)} ${sgn(+c.saves[a])}`).join(', ');
  const sec = k => c[k].length ? `<h3>${SECTION_HU[k]}${k === 'legendary' && c.legendaryCount ? ` (${c.legendaryCount}/kör)` : ''}</h3>` +
    c[k].map(e => `<p data-label="${esc(e.name)}">${e.name ? `<b><i>${linkify(e.name)}.</i></b> ` : ''}${linkify(e.text)}</p>`).join('') : '';
  return `<div class="sb">
    ${c.portrait ? `<img class="portrait" src="${esc(c.portrait)}" alt="" onerror="this.style.display='none'">` : ''}
    <h2>${esc(c.name)}</h2>
    <div class="sub">${esc([[c.size, c.type].filter(Boolean).join(' '), c.alignment].filter(Boolean).join(', '))}${c.source ? ' · ' + esc(c.source) : ''}</div>
    <p class="line"><b>AC</b> ${esc(c.ac)}${c.acNote ? ' (' + esc(c.acNote) + ')' : ''} &nbsp; <b>HP</b> ${esc(c.hp.max)}${c.hp.formula ? ' (' + linkify(c.hp.formula) + ')' : ''} &nbsp;
      <b>Init</b> <span class="roll hit" data-hit="${sgn(initBonusOf(c))}" data-label="Initiative" title="${TIP_HIT}">${sgn(initBonusOf(c))}</span></p>
    ${line('Speed', c.speed)}
    <div class="abil">${ABIL.map(a => `<div data-check="${a}" title="Kattints: ${ABIL_FULL[a]} próba${c.saves[a] != null ? '' : ' / mentő'}"><small>${a.toUpperCase()}</small>${esc(c.abilities[a])} (${sgn(mod(c.abilities[a]))})${c.saves[a] != null ? `<div class="sv" data-save="${a}">mentő ${sgn(+c.saves[a])}</div>` : ''}</div>`).join('')}</div>
    ${line('Saving Throws', saves)}${line('Skills', c.skills)}${line('Damage Vulnerabilities', c.vuln)}${line('Damage Resistances', c.resist)}
    ${line('Damage Immunities', c.immune)}${line('Condition Immunities', c.condImmune)}${line('Senses', c.senses)}${line('Languages', c.languages)}
    ${c.cr ? `<p class="line"><b>${c.kind === 'pc' ? 'Szint' : 'CR'}</b> ${esc(String(c.cr).replace(/^Szint /, ''))}</p>` : ''}
    ${SECTIONS.map(sec).join('')}
    ${c.notes ? `<h3>Jegyzet</h3><p>${linkify(c.notes)}</p>` : ''}
  </div>`;
}
function renderDetail() {
  const x = byId(selected) || byId(S.enc.active);
  if (!x) { $('#detail').innerHTML = `<div class="pad muted">Kattints egy csempe nevére a részletes adatlaphoz.<br><br>
    Gyorsbillentyűk: <span class="kbd">N</span> / <span class="kbd">Szóköz</span> következő, <span class="kbd">P</span> előző, <span class="kbd">Esc</span> ablak bezárása.<br>
    Dobások: kattints a <span class="roll">1d6+2</span> / <span class="roll hit">+4</span> értékekre. Shift = előny / kritikus, Ctrl = hátrány.</div>`; return; }
  const c = x.c;
  $('#detail').innerHTML = `<div data-cid="${esc(x.cid)}">
    <div class="ctl">
      <div class="row"><b style="flex:1">${esc(nameOf(x))}</b><span class="muted">${KIND_HU[c.kind] || ''}</span>
        <select data-f="side">${Object.entries(SIDE_HU).map(([k, l]) => `<option value="${k}" ${sideOf(x) === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${selected && selected !== S.enc.active ? '<button class="small" data-act="deselect">aktuálishoz vissza</button>' : ''}</div>
      <div class="row">
        <label>Init</label><input type="number" data-f="init" value="${esc(x.init ?? '')}" style="width:52px">
        <label>HP</label><input type="number" data-f="hp" value="${esc(x.hp)}"> / <input type="number" data-f="max" value="${esc(c.hp.max)}">
        <label>Temp</label><input type="number" data-f="temp" value="${esc(x.temp)}" style="width:52px">
        <label>AC</label><input type="number" data-f="ac" value="${esc(c.ac)}" style="width:52px">
      </div>
      <div class="row">
        <select id="condSel">${CONDITIONS.map(k => `<option>${k}</option>`).join('')}<option value="">egyéni…</option></select>
        <input id="condCustom" placeholder="egyéni" style="width:90px">
        <input id="condRounds" type="number" min="1" placeholder="kör" title="Hány körig tart (üres = amíg le nem veszed)" style="width:52px">
        <button class="small" data-act="addCond">Állapot +</button>
        <label><input type="checkbox" data-f="conc" ${x.conc ? 'checked' : ''}> Koncentráció</label>
      </div>
      ${x.cond.length || x.conc ? `<div class="conds">${x.conc ? '<span class="chip conc" data-act="toggleConc">Koncentráció</span>' : ''}${x.cond.map((k, i) => `<span class="chip" data-act="rmCond" data-i="${i}">${esc(k.name)}${k.rounds != null ? ' (' + k.rounds + ')' : ''}</span>`).join('')}</div>` : ''}
      <div class="row">
        <label>Játékosok ezt látják:</label><input data-f="pubName" value="${esc(x.publicName || '')}" placeholder="${esc(nameOf(x))}" title="Ha üres, a valódi nevét látják. Pl. „Csuklyás alak” egy még ismeretlen NPC-nél" style="flex:1">
        <label><input type="checkbox" data-f="hiddenP" ${x.hiddenP ? 'checked' : ''}> rejtett</label>
      </div>
      <textarea data-f="notes" rows="2" placeholder="Jegyzet ehhez a harchoz (pl. kinek a célpontja, mit tervez)…">${esc(x.notes)}</textarea>
      <div class="row"><button class="small" data-act="editCombatant">✎ Adatlap szerkesztése</button><button class="small" data-act="saveToLib">📚 Mentés a könyvtárba</button></div>
    </div>
    ${statblock(c)}
  </div>`;
}

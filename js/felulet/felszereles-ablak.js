// 🎁 Szinthez illő felszerelés ablak (felület): az NPC-ből lett játékos karakter előnézete – arany, mágikus tárgyak (egyesével újradobható, kihagyható),
// az osztály kezdő felszerelése (tételenként kihagyható); jóváhagyásra kerül a karakterhez. A logika: js/logika/felszereles.js. Terv: TERV-kezdo-felszereles.md.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('felszereles-ablak', N) és az index.html-ben a felszereles-ablak.js?v=N és a VART_MODULOK.
'use strict';
modul('felszereles-ablak', 1);

let felszAblak = null;  // {terv, rb}
async function openFelszereles(id, uj = false) {
  const c = S.library.find(x => x.id === id);
  if (!c) return;
  let rb = null;
  try { rb = await felhoSzabalyok() || (await getRulebook()).rb; } catch (e) { console.error(e); }
  if (!rb?.classes?.length) { alert('Ehhez a szabálykönyv kell (Menü → 📖 Szabálykönyv), és internet.'); return; }
  felszAblak = {terv: felszerelesTerv(id, rb), rb, uj};
  renderFelszereles();
}
function renderFelszereles() {
  const a = felszAblak; if (!a?.terv) return;
  const t = a.terv, c = S.library.find(x => x.id === t.id), rb = a.rb, all = Sheet.allItems(rb);
  const sor = (bal, jobb, gombok) => `<div class="lrow"><span class="nm">${bal}${jobb ? `<small>${jobb}</small>` : ''}</span>${gombok}</div>`;
  const targyak = t.items.length ? t.items.map((x, i) => { const r = x.n ? Sheet.byRef(all, x.ref, x.n) : null;
    return sor(x.n ? `<b>${esc(x.n)}</b>` : '<i>nincs illő tárgy</i>', esc([x.rar, r ? Sheet.itemLine(r) : ''].filter(Boolean).join(' · ')),
      `<button class="small" data-act="felszUjra" data-i="${i}" title="Másik tárgy ugyanebből a ritkaságból">🎲</button><button class="small" data-act="felszKi" data-i="${i}" title="Kihagyás">✕</button>`); }).join('')
    : '<p class="hint">Ezen a szinten (1–4.) a DMG szerint nem jár mágikus tárgy.</p>';
  const kezdo = t.start.length ? t.start.map((x, i) => sor(`${x.q > 1 ? esc(x.q) + '× ' : ''}${esc(x.n)}`, '', `<button class="small" data-act="felszStartKi" data-i="${i}" title="Kihagyás">✕</button>`)).join('')
    : `<p class="hint">${t.fo ? 'Minden megvan belőle, vagy nincs mit adni.' : 'Osztály nélkül nincs kezdő felszerelés (és a tárgyak sem célzottak).'}</p>`;
  const db = c ? c.inventory.length : 0;
  openModal(`<h2>🎁 Szinthez illő felszerelés – ${esc(c?.name || '')}</h2>
    <p class="hint">${a.uj ? 'NPC-ből játékos lett. ' : ''}${db ? `Már van ${esc(db)} tárgya (${esc(c.inventory.slice(0, 5).map(i => i.name).join(', '))}${db > 5 ? ', …' : ''}). ` : ''}A DMG 2014 38. oldala szerint (Starting at Higher Level): ${esc(t.L)}. szint${t.fo ? ', ' + esc(t.fo) : ''}. Semmi nem kerül fel jóváhagyás nélkül.</p>
    ${felszVoltGeneralas(t.id) ? '<p class="warn">⚠ Ennek a karakternek már generáltál felszerelést: a Hozzáadás az aranyat és a tárgyakat újra hozzáadja.</p>' : ''}
    <label>Mágiaszint <select id="felszMagia">${MAGIA.map(m => `<option value="${m}" ${m === t.magia ? 'selected' : ''}>${esc(MAGIA_HU[m])}</option>`).join('')}</select></label>
    <h3>Arany</h3>${sor(`<b>${esc(t.gold)} gp</b>`, '', t.gold ? '<button class="small" data-act="felszArany" title="Újradobás">🎲</button>' : '')}
    <h3>Mágikus tárgyak</h3><div class="rows">${targyak}</div>
    <h3>Kezdő felszerelés</h3><div class="rows">${kezdo}</div>
    <div class="toolbar" style="margin-top:12px"><button class="primary" data-act="felszMent">Hozzáadás a karakterhez</button><button data-act="felszMegse">Mégse</button></div>`);
}
const felszI = el => +el.dataset.i;
const felszFrissit = f => { felszAblak.terv = f(felszAblak.terv); renderFelszereles(); };

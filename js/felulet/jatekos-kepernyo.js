// Initiative tracker (felület): a második monitornak küldött nézet (publicView) és a BroadcastChannel – formája: SZERZODES.md.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('jatekos-kepernyo', N) és az index.html-ben a jatekos-kepernyo.js?v=N és a VART_MODULOK.
'use strict';
modul('jatekos-kepernyo', 2);

// ---------- Initiative tracker ----------
// csak azt küldjük át, amit a játékosok láthatnak
const chan = 'BroadcastChannel' in window ? new BroadcastChannel(CSATORNA) : null;
function publicView() {
  return {
    round: S.enc.round || 1, started: !!S.enc.active,
    list: order().filter(x => !x.hiddenP).map(x => {
      const c = x.c, max = c.hp.max || 1, ally = sideOf(x) === 'ally';
      // a HP a könyvtári beállítás szerint (pontos / állapot / rejtve; a harcban a könyvtár mostani értéke, ha a lény onnan jött)
      const mod = Szerzodes.hpLathato({kind: c.kind, share: S.library.find(l => l.id === c.libId)?.share || c.share});
      // rejtett HP-nál sincs titok a halál: a legyőzött ellenfél „Halott” (szürkén, és a „Következik:” sor átugorja)
      const le = x.dead || x.hp <= 0;
      const status = mod === 'hidden' ? (le && !ally ? 'dead' : null) : mod !== 'label' ? null : le ? (ally ? 'dying' : 'dead') : x.hp <= max / 2 ? 'bloodied' : x.hp < max ? 'hurt' : 'healthy';
      const exact = mod === 'exact';
      return {
        id: x.cid, name: x.publicName || nameOf(x), kind: c.kind, side: sideOf(x),
        portrait: c.portrait || '', active: x.cid === S.enc.active,
        hp: exact ? x.hp : null, max: exact ? max : null, temp: exact ? x.temp : 0, status,
        cond: [...x.cond.map(k => k.name), ...(x.conc ? ['Koncentráció'] : [])]
      };
    })
  };
}
function broadcast() { try { chan?.postMessage({type: 'state', view: publicView()}); } catch {} }

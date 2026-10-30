// Initiative tracker (felület): a második monitornak küldött nézet (publicView) és a BroadcastChannel – formája: SZERZODES.md.
// Rétegek: docs/dontesek/0006 – a felület csak a logikát hívja, a Tar-t és a DB-t nem. Ha változik, amire más fájl támaszkodik: modul('jatekos-kepernyo', N) és az index.html-ben a jatekos-kepernyo.js?v=N és a VART_MODULOK.
'use strict';
modul('jatekos-kepernyo', 1);

// ---------- Initiative tracker ----------
// csak azt küldjük át, amit a játékosok láthatnak
const chan = 'BroadcastChannel' in window ? new BroadcastChannel(CSATORNA) : null;
function publicView() {
  return {
    round: S.enc.round || 1, started: !!S.enc.active,
    list: order().filter(x => !x.hiddenP).map(x => {
      const c = x.c, max = c.hp.max || 1, pc = c.kind === 'pc', ally = sideOf(x) === 'ally';
      let status = null;
      if (!pc) status = x.dead || x.hp <= 0 ? (ally ? 'dying' : 'dead') : x.hp <= max / 2 ? 'bloodied' : x.hp < max ? 'hurt' : 'healthy';
      return {
        id: x.cid, name: x.publicName || nameOf(x), kind: c.kind, side: sideOf(x),
        portrait: c.portrait || '', active: x.cid === S.enc.active,
        hp: pc ? x.hp : null, max: pc ? max : null, temp: pc ? x.temp : 0, status,
        cond: [...x.cond.map(k => k.name), ...(x.conc ? ['Koncentráció'] : [])]
      };
    })
  };
}
function broadcast() { try { chan?.postMessage({type: 'state', view: publicView()}); } catch {} }

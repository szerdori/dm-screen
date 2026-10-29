// Közös alapok mindhárom oldalnak (index.html, karakter.html, player.html); a sheet.js előtt töltődik.
// Ha változik, az oldalakon a kozos.js?v=N számát is emeld (a böngésző különben a régit adhatja).
'use strict';
const $ = s => document.querySelector(s);
// minden kiírt szöveg ezen megy át (a bejövő adatot más is írhatja: játékos, importált fájl)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// kriptográfiai véletlenszám (Windows rendszer-generátora), elutasításos mintavétellel, hogy minden oldal pontosan egyforma eséllyel jöjjön
function rnd(d) {
  const a = new Uint32Array(1), lim = Math.floor(0x100000000 / d) * d;
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return 1 + (a[0] % d);
}

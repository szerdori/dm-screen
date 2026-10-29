// Közös alapok mindhárom oldalnak (index.html, karakter.html, player.html); a sheet.js előtt töltődik.
// Ha változik, a modul('kozos', N) számát és az oldalakon a kozos.js?v=N-t és a VART_MODULOK-ot is emeld (egy teszt figyeli, hogy egyezzenek).
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

// ---------- verzióőr (docs/dontesek/0005) ----------
// Minden közös fájl bejelenti a változatát (a <script src="név.js?v=N"> N-je); az oldal a VART_MODULOK-kal veti össze.
// Eltérés = a böngésző egy régi, gyorsítótárazott példányt adott: ilyenkor az oldal nem ír a felhőbe, és frissítést kér.
const MODULOK = {};
function modul(nev, v) { MODULOK[nev] = v; }
// a várttól eltérő (vagy be sem jelentett) modulok neve; üres lista = minden rendben
function elteroModulok(vart) { return Object.keys(vart).filter(n => MODULOK[n] !== vart[n]); }
// rövid véletlen azonosító (lények, encounterek, mentések)
const uid = () => Math.random().toString(36).slice(2, 10);
modul('kozos', 3);

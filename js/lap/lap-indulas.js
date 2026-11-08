// Telefonos karakterlap (lap-indulas, a karakter.html része): a Firebase-modul kapuja (KApp), a figyelők felkapcsolása és az első rajzolás (az utolsó betöltött fájl)
// Csak ez a fájl futtat kódot betöltéskor (a többi js/lap/ fájl csak deklarál). Ha változik, amire más fájl támaszkodik: modul('lap-indulas', N) és a karakter.html-ben a lap-indulas.js?v=N és a VART_MODULOK.
'use strict';
modul('lap-indulas', 1);

// a Firebase-modul (lent) hívja; a tesztek közvetlenül is
window.KApp = {
  setAuth(a) {
    me = a.status === 'signedIn' ? String(a.email || '').toLowerCase() : '';
    isDM = a.status === 'signedIn' && !!a.dm;
    if (a.status === 'signedOut') {
      chars = []; sheets = new Map(); render(true);
      gate(`<b class="logo">⚔</b><div>Lépj be a Google-fiókoddal, hogy lásd a karakteredet.</div>
        <button class="primary" data-act="signIn">Belépés Google-fiókkal</button>${a.error ? `<p style="color:var(--red)">${esc(a.error)}</p>` : ''}`);
    } else if (a.status === 'denied') {
      chars = []; sheets = new Map(); render(true);
      gate(`<b class="logo">🔒</b><div>Ez a Google-fiók (<b>${esc(a.email)}</b>) nincs a játékosok között.<br>Kérd meg a DM-et, hogy írja be a karakterednél.</div>
        <button data-act="signOut">Másik fiókkal</button>`);
    } else if (a.status === 'error') gate(`<div>Nem sikerült betölteni az adatokat (${esc(a.message)}).</div><button data-act="reload">Újra</button>`);
    else if (a.status === 'unconfigured') { render(true); gate(null); }
    else { render(true); gate(a.status === 'signedIn' ? null : '<div class="muted">Betöltés…</div>'); }
  },
  setChars(list) { chars = (Array.isArray(list) ? list : []).map(normChar); render(); },
  setSheets(list, err = '') {
    sheetErr = err;
    sheets = new Map((Array.isArray(list) ? list : []).filter(d => isObj(d) && okId(d.id)).map(d => [d.id, H.norm(d)]));
    for (const id of calcSig.keys()) if (!sheets.has(id)) calcSig.delete(id);
    recalcAll();
    render();
  },
  // info: Sheet.loadRulebook eredménye (null = a DM még nem töltötte fel)
  setRulebook(info, err = '') { rbInfo = info?.rb ? info : {rb: null}; rbErr = err; recalcAll(); render(); }
};

// betöltéskor: a régi fájl-ellenőrzés (most már minden fájl bejelentkezett), a figyelők a régi sorrendben, első rajzolás
function lapIndulas() {
  sheetStale = regiFajl();
  utvonalEsemenyek();
  gesztusEsemenyek();
  akciokEsemenyek();
  route();
}
lapIndulas();

// Indulás (az utolsó betöltött fájl): a Firebase-modul kapuja (DMApp), az eseményfigyelők felkapcsolása és az első rajzolás.
// Csak ez a fájl futtat kódot betöltéskor (a többi csak deklarál; docs/dontesek/0001, 0006). Ha változik: modul('indulas', N) és az index.html-ben az indulas.js?v=N és a VART_MODULOK.
'use strict';
modul('indulas', 1);

// a Firebase-modul (index.html alja) hívja, amikor kiderül, be vagy-e lépve
window.DMApp = {
  async setAuth(a) {
    authInfo = a;
    if (a.status === 'signedIn') {
      Tar.kapcsol(a.db);
      renderGate('Adatok betöltése…');
      try {
        await loadFromDb(); renderGate(null); dailyBackup();
        sheetUnsub?.(); sheetUnsub = sheetsWarn ? null : Tar.lapok.figyel(onSheets, () => {});
      }
      catch (e) {
        Tar.kapcsol(null);
        renderGate(e.code === 'permission-denied'
          ? `Ez a Google-fiók (${esc(a.email)}) nem fér hozzá az adatokhoz.<br><button data-act="signOut">Másik fiókkal</button>`
          : `Nem sikerült betölteni az adatokat (${esc(e.code || e.message)}).<br><button data-act="reload">Újra</button>`);
        return;
      }
    } else if (a.status === 'unconfigured') { Tar.kapcsol(null); loadLocal(); renderGate(null); }
    else if (a.status === 'signedOut') {
      Tar.kapcsol(null); sheetUnsub?.(); sheetUnsub = null;
      renderGate(`<b style="font-size:40px;color:var(--accent)">⚔</b><br>Lépj be a Google-fiókoddal, hogy elérd a DM Screen adataidat.<br>
        <button class="primary" data-act="signIn">Belépés Google-fiókkal</button>${a.error ? `<p style="color:var(--red)">${esc(a.error)}</p>` : ''}`);
    }
    render();
  }
};

// a figyelők a régi sorrendben (a régi index.html-szkript sorrendje szerint)
function indulas() {
  window.addEventListener('beforeunload', e => {
    try { localStorage.setItem(HELYI.allapot, JSON.stringify(S)); } catch {}
    if (saveTimer) { doSave(); e.preventDefault(); }
  });
  if (chan) chan.onmessage = e => { if (e.data?.type === 'hello') broadcast(); };
  szerkesztoEsemenyek();
  $('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
  fajlBetoltesEsemenyek();
  akciokEsemenyek();
  render();
}
indulas();

// Adattár (docs/dontesek/0006): az egyetlen, ami a felhős adatbázist (a DB „portot”) hívja és az útvonalakat ismeri.
// A port a Firebase-modulból jön (index.html alja), a tesztekben a makeFakeDb(); Tar.kapcsol(db) állítja be, null = nincs felhő.
// Az írások a port ígéretét (Promise) adják vissza, hogy a hívó összegyűjthesse (doSave: Promise.all).
// Az adatok formája: szerzodes.js (SZERZODES.md). Ha változik: modul('tar', N) és az index.html-ben a tar.js?v=N és a VART_MODULOK.
'use strict';
window.Tar = (() => {
  const {UT} = Szerzodes;
  let db = null;
  // egy gyűjtemény dokumentumai azonosító szerint
  const gyujtemeny = col => ({
    lista: () => db.list(col),
    ir: (id, d) => db.set(col + '/' + id, d),
    torol: id => db.del(col + '/' + id),
  });

  // a karakter nyilvános része (characters/{id}) a könyvtári lényből; formája: Szerzodes.normPublicChar
  // Játékos karakter: a gazdája mindig látja; „csapat” láthatóságnál a többi játékos is.
  // NPC: csak „csapat” láthatóságnál jelenik meg, a HP pontosan vagy csak állapotként, az AC ki-be kapcsolható.
  // A titkos rész (statok, jegyzetek, akciók) a dmscreen_library-ben marad, azt csak a DM olvashatja.
  function nyilvanosResz(library) {
    return library.filter(c => c.kind === 'pc' ? c.owner || c.share.vis === 'party' : c.kind === 'npc' && c.share.vis === 'party').map(c => {
      const pc = c.kind === 'pc', cur = c.hp.cur ?? c.hp.max, exact = pc || c.share.hp === 'exact';
      return {id: c.id, kind: c.kind, owner: c.owner || '', visibility: c.share.vis, name: c.name, portrait: c.portrait || '',
        level: pc ? c.cr : '', ac: pc || c.share.ac ? c.ac : null,
        hp: exact ? {cur, max: c.hp.max} : null, status: exact ? null : Sheet.hpStatus(cur, c.hp.max)};
    });
  }

  if (typeof modul === 'function') modul('tar', 1);
  return {
    kapcsol: port => { db = port || null; },
    kapcsolva: () => !!db,
    // dmscreen/state: {enc, settings}
    allapot: {olvas: () => db.get(UT.allapot), ir: d => db.set(UT.allapot, d)},
    konyvtar: gyujtemeny(UT.konyvtar),
    mentett: gyujtemeny(UT.mentett),
    karakterek: {...gyujtemeny(UT.karakterek), nyilvanosResz},
    jatekosok: {olvas: () => db.get(UT.jatekosok), ir: emails => db.set(UT.jatekosok, {emails})},
    // telefonos karakterlapok: írás mezőnként (mezok, pl. {'hp.cur': 5}) vagy egészben (ir, csak létrehozáskor)
    lapok: {
      lista: () => db.list(UT.lapok),
      ir: (id, lap) => db.set(UT.lap(id), lap),
      mezok: (id, patch) => db.update(UT.lap(id), patch),
      torol: id => db.del(UT.lap(id)),
      figyel: (cb, hiba) => db.watch?.(UT.lapok, cb, hiba) || null,
    },
    // napi felhős mentések: tartalomjegyzék (dmscreen/backups) + pillanatképek (dmscreen_backup/{nap})
    mentesek: {
      tartalom: () => db.get(UT.mentesek),
      tartalomIr: items => db.set(UT.mentesek, {items}),
      olvas: id => db.get(UT.mentes(id)),
      ir: (id, data) => db.set(UT.mentes(id), {data}),
      torol: id => db.del(UT.mentes(id)),
    },
    // szabálykönyv a játékos appnak (rules/meta + rules/{darab}); a meta íródik utoljára
    szabalyok: {
      meta: () => db.get(UT.szabalyMeta),
      metaIr: meta => db.set(UT.szabalyMeta, meta),
      darabIr: (id, data) => db.set(UT.szabalyDarab(id), {data}),
      darabTorol: id => db.del(UT.szabalyDarab(id)),
      betolt: () => Sheet.loadRulebook(db),
    },
  };
})();

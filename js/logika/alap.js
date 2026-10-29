// Alapok és állapot (logika, DOM nélkül): a közös fájlok segédei, a DM Screen állapota (S) és a mindenhol használt kis segédek.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('alap', N) és az index.html-ben az alap.js?v=N és a VART_MODULOK.
'use strict';
modul('alap', 1);

// ---------- alapok ----------
// a sheet.js közös segédei (a karakter.html is ezeket használja)
const {ABIL, ABIL_FULL, SKILLS, skillLabel, EMAIL_RE, num, isObj, safeUrl, sgn, propOf} = Sheet;
// a szerződés (szerzodes.js): útvonalak, a lények formátuma és a bejövő adatok tisztítói
const {HELYI, CSATORNA, SECTIONS, TEMPLATE, KINDS, str, safeId, blankCreature, splitEntry, normInventory, normCreature, normCombatant, sanitizeState} = Szerzodes;
// igaz, ha valamelyik közös fájl régi; a nagyon régi kozos.js-ben az elteroModulok még nincs meg – az is régi
const regiFajl = () => typeof elteroModulok !== 'function' || elteroModulok(VART_MODULOK).length > 0;
const CONDITIONS = ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];
const SECTION_HU = {traits:'Tulajdonságok', actions:'Akciók', bonusActions:'Bónusz akciók', reactions:'Reakciók', legendary:'Legendás akciók'};
const KIND_HU = {monster:'Szörny', npc:'NPC', pc:'Játékos'};
const sideOf = x => x.side === 'enemy' || x.side === 'ally' ? x.side : (x.c.kind === 'monster' ? 'enemy' : 'ally');
const SIDE_HU = {enemy: 'Ellenfél', ally: 'Csapattárs'};
const mod = s => Math.floor(((+s || 10) - 10) / 2);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- állapot ----------
let S = {
  library: [],
  enc: {list: [], round: 1, active: null},
  saved: [],
  settings: structuredClone(Szerzodes.ALAP_BEALLITASOK)
};
let selected = null;
let logLines = [];
const initBonusOf = c => c.initBonus ?? mod(c.abilities.dex);
const nameOf = x => x.c.name + (x.num ? ' ' + x.num : '');
const byId = id => S.enc.list.find(x => x.cid === id);

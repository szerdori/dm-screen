// A sheet.js szabályadat-táblái és magyar szövegei (TERV-refaktor-2.md, 5. lépés): csak adat – függvény és a motorra való hivatkozás nélkül.
// A sheet.js a window.SheetAdat-ból veszi át őket, ugyanezekkel a nevekkel; a Sheet.* exportok nem változtak. Az oldalak a sheet.js előtt töltik.
// Új hatás (FEATURE_FX, TCE_FX) vagy szöveg: ide. Ha változik, amire a sheet.js támaszkodik (új vagy átnevezett tábla): .\verzio.ps1 sheet-adat sheet.
'use strict';
window.SheetAdat = (() => {
  // a skillek rövid magyar leírása (TERV-fejlesztesek-2026-11.md, 2. lépés): saját megfogalmazás, a példák a PHB / SRD 5.1 (CC-BY 4.0) skill-leírásait követik
  const SKILL_INFO = {
    acrobatics: 'Egyensúly és ügyes mozgás: talpon maradni jégen, keskeny párkányon, himbálózó kötélhídon vagy viharos hajófedélzeten; bukfenc, ugrás, kitérés, ügyes kiszabadulás egy szorításból.',
    'animal-handling': 'Állatok kezelése: megnyugtatni egy riadt lovat, irányítani a hátasodat egy nehéz manővernél, megérezni, mit akar egy állat, vagy elhessegetni egy kóbor kutyát.',
    arcana: 'Mágikus tudás: varázslatok, mágikus tárgyak, rúnák és jelek felismerése, a síkok és a mágikus hagyományok ismerete, egy furcsa mágikus jelenség értelmezése.',
    athletics: 'Nyers erő és testi teljesítmény mozgás közben: mászás, ugrás, úszás erős sodrásban, lökés, birkózás, megragadni vagy kiszabadulni egy fogásból.',
    deception: 'Megtévesztés: hazugság, félrevezetés, álruhás szerep fenntartása, kétértelmű válasz, blöff a kártyaasztalnál vagy egy őr előtt.',
    history: 'Történelmi tudás: régi birodalmak, háborúk, uralkodók, legendák, nemesi családok, romok és tárgyak eredete.',
    insight: 'Emberismeret: kiolvasni valaki szándékát a viselkedéséből, észrevenni a hazugságot, az idegességet, vagy megjósolni, mit fog tenni.',
    intimidation: 'Megfélemlítés: fenyegetés, erőfitogtatás, ijesztő fellépés, hogy valaki engedjen, beszéljen vagy elálljon az útból.',
    investigation: 'Nyomozás és következtetés: rejtett ajtó vagy csapda megtalálása kereséssel, nyomokból kikövetkeztetni, mi történt, iratok átnézése, egy szerkezet gyenge pontjának kiszúrása.',
    medicine: 'Gyógyítás és orvosi tudás: haldokló társ stabilizálása, betegség vagy méreg felismerése, egy sérülés vagy halál okának megállapítása.',
    nature: 'Természetismeret: terep, növények, állatok, időjárás és természetes ciklusok ismerete; mérgező bogyó, veszélyes vad vagy közelgő vihar felismerése.',
    perception: 'Észlelés: látni, hallani, szagolni, ami körülötted van – a lopakodó ellenfél, a halk lépések, a távoli füst. Ez a passzív Perception alapja is.',
    performance: 'Előadás: zene, tánc, színjáték, történetmesélés; közönség szórakoztatása, figyelem elterelése, pénzkeresés a fogadóban.',
    persuasion: 'Meggyőzés: tisztességes érveléssel, kedvességgel vagy diplomáciával rávenni valakit valamire; alku, tárgyalás, kérés egy előkelőtől.',
    religion: 'Vallási tudás: istenek, szertartások, szent jelképek, papi rendek, kultuszok, valamint az élőhalottak és más szent vagy átkozott dolgok ismerete.',
    'sleight-of-hand': 'Kézügyesség: zsebtolvajlás, apró tárgy elrejtése vagy becsempészése, bűvésztrükk, észrevétlen csere – amikor a kéz gyorsabb a szemnél.',
    stealth: 'Lopakodás: észrevétlenül osonni, elrejtőzni, csendben elhaladni az őrök mellett vagy rajtaütni az ellenfélen.',
    survival: 'Túlélés a vadonban: nyomkövetés, vadászat, tájékozódás, élelem és menedék keresése, a veszélyes terep és időjárás elkerülése.'
  };

  const FX_LABEL = {spell: 'varázslat', pick: 'választás', ability: 'képességérték-növelés', skills: 'skill-jártasság', expertise: 'expertise', feat: 'feat', asi: 'ASI vagy feat', subclass: 'alosztály',
    saves: 'mentő-jártasság', lang: 'nyelv', tool: 'eszköz-jártasság', subrace: 'alfaj', opt: 'választás', tce: 'TCE opcionális feature', cantrips: 'cantrip', known: 'ismert varázslat', book: 'spellbook'};

  // Circle of the Land: a terep varázslatai 3., 5., 7., 9. druidaszinten (PHB 68–69. o.)
  const LAND_SPELLS = {
    Arctic: [['hold person', 'spike growth'], ['sleet storm', 'slow'], ['freedom of movement', 'ice storm'], ['commune with nature', 'cone of cold']],
    Coast: [['mirror image', 'misty step'], ['water breathing', 'water walk'], ['control water', 'freedom of movement'], ['conjure elemental', 'scrying']],
    Desert: [['blur', 'silence'], ['create food and water', 'protection from energy'], ['blight', 'hallucinatory terrain'], ['insect plague', 'wall of stone']],
    Forest: [['barkskin', 'spider climb'], ['call lightning', 'plant growth'], ['divination', 'freedom of movement'], ['commune with nature', 'tree stride']],
    Grassland: [['invisibility', 'pass without trace'], ['daylight', 'haste'], ['divination', 'freedom of movement'], ['dream', 'insect plague']],
    Mountain: [['spider climb', 'spike growth'], ['lightning bolt', 'meld into stone'], ['stone shape', 'stoneskin'], ['passwall', 'wall of stone']],
    Swamp: [["melf's acid arrow", 'darkness'], ['water walk', 'stinking cloud'], ['freedom of movement', 'locate creature'], ['insect plague', 'scrying']],
    Underdark: [['spider climb', 'web'], ['gaseous form', 'stinking cloud'], ['greater invisibility', 'stone shape'], ['cloudkill', 'insect plague']]
  };
  // Kézi hatástábla: csak mechanika, szabályszöveg nélkül (a szöveg a privát szabálykönyvből jön).
  // Kulcs: 'Osztály|Feature', 'Osztály|Alosztály|Feature', 'race|Faj vagy jellemző', 'feat|Név', 'opt|Név'. Az online teszt ellenőrzi, hogy minden kulcs létezik.
  const FEATURE_FX = {
    'Barbarian|Rage': [{res: {n: 'Rage', max: 'col:Rages', reset: 'long'}}],
    'Barbarian|Unarmored Defense': [{acBase: {add: ['dex', 'con'], ud: true}}],
    'Barbarian|Extra Attack': [{extraAttack: 2}],
    'Barbarian|Fast Movement': [{speed: {v: 10, if: 'noHeavy'}}],
    'Barbarian|Totem Warrior|Totem Spirit': [{pickChoose: {label: 'Totem Spirit', from: ['Bear', 'Eagle', 'Wolf']}}],
    'Barbarian|Totem Warrior|Aspect of the Beast': [{pickChoose: {label: 'Aspect of the Beast', from: ['Bear', 'Eagle', 'Wolf']}}],
    'Barbarian|Totem Warrior|Totemic Attunement': [{pickChoose: {label: 'Totemic Attunement', from: ['Bear', 'Eagle', 'Wolf']}}],
    'Bard|Bardic Inspiration': [{res: {n: 'Bardic Inspiration', max: 'mod:cha', min: 1, reset: 'long', shortAt: 5}}],
    'Bard|Jack of All Trades': [{jack: true}],
    'Bard|Expertise': [{expertise: {n: 2}}],
    'Bard|Lore|Bonus Proficiencies': [{skillChoose: {from: 'any', n: 3}}],
    'Cleric|Channel Divinity': [{res: {n: 'Channel Divinity', max: {lv: {2: 1, 6: 2, 18: 3}}, reset: 'short'}}],
    'Cleric|Life|Bonus Proficiency': [{armor: ['heavy']}],
    'Cleric|Knowledge|Blessings of Knowledge': [{langChoose: {n: 2}}, {skillChoose: {from: ['arcana', 'history', 'nature', 'religion'], n: 2}}, {expertise: {n: 2}}],
    'Cleric|Tempest|Bonus Proficiencies': [{armor: ['heavy']}, {weapon: ['martial']}],
    'Cleric|War|Bonus Proficiencies': [{armor: ['heavy']}, {weapon: ['martial']}],
    'Cleric|War|War Priest': [{res: {n: 'War Priest', max: 'mod:wis', min: 1, reset: 'long'}}],
    'Cleric|Nature|Acolyte of Nature': [{skillChoose: {from: ['animal-handling', 'nature', 'survival'], n: 1}}, {spellChoose: {from: {list: 'Druid', l: 0}, n: 1}}],
    'Cleric|Nature|Bonus Proficiency': [{armor: ['heavy']}],
    'Cleric|Forge|Bonus Proficiency': [{armor: ['heavy']}, {tool: ["smith's tools"]}],
    'Cleric|Twilight|Bonus Proficiencies': [{armor: ['heavy']}, {weapon: ['martial']}],
    'Druid|Wild Shape': [{res: {n: 'Wild Shape', max: 2, reset: 'short'}}],
    'Druid|Land|Natural Recovery': [{res: {n: 'Natural Recovery', max: 1, reset: 'long'}}],
    'Druid|Land|Circle Spells': [{pickChoose: {label: 'Terep', from: Object.keys(LAND_SPELLS), then: Object.fromEntries(Object.entries(LAND_SPELLS).map(([k, t]) => [k, [{spells: t.map((sp, i) => ({t: 'prepared', lvl: 3 + 2 * i, sp}))}]]))}}],
    'Druid|Land|Bonus Cantrip': [{spellChoose: {from: {list: 'Druid', l: 0}, n: 1}}],
    'Fighter|Second Wind': [{res: {n: 'Second Wind', max: 1, reset: 'short'}}],
    'Fighter|Action Surge': [{res: {n: 'Action Surge', max: {lv: {2: 1, 17: 2}}, reset: 'short'}}],
    'Fighter|Indomitable': [{res: {n: 'Indomitable', max: {lv: {9: 1, 13: 2, 17: 3}}, reset: 'long'}}],
    'Fighter|Extra Attack': [{extraAttack: 2}], 'Fighter|Extra Attack (2)': [{extraAttack: 3}], 'Fighter|Extra Attack (3)': [{extraAttack: 4}],
    'Fighter|Champion|Remarkable Athlete': [{remarkable: true}],
    'Fighter|Battle Master|Combat Superiority': [{res: {n: 'Superiority Dice', max: {lv: {3: 4, 7: 5, 15: 6}}, reset: 'short'}}],
    'Fighter|Battle Master|Student of War': [{toolChoose: {n: 1}}],
    'Monk|Unarmored Defense': [{acBase: {add: ['dex', 'wis'], noShield: true, ud: true}}],
    'Monk|Extra Attack': [{extraAttack: 2}],
    'Monk|Martial Arts': [{martialArts: true}],
    'Monk|Ki': [{res: {n: 'Ki', max: 'col:Ki Points', reset: 'short'}}],
    'Monk|Unarmored Movement': [{speed: {v: 'col:Unarmored Movement', if: 'noArmor'}}],
    'Monk|Diamond Soul': [{saveAll: true}],
    'Paladin|Divine Sense': [{res: {n: 'Divine Sense', max: 'mod:cha', add: 1, min: 1, reset: 'long'}}],
    'Paladin|Lay on Hands': [{res: {n: 'Lay on Hands', max: 'lvl*5', reset: 'long'}}],
    // multiclassnál (Cleric + Paladin) a Channel Divinity egy erőforrás: a használatok nem adódnak össze, a nagyobb számít (PHB 164. o.)
    'Paladin|*|Channel Divinity': [{res: {n: 'Channel Divinity', max: 1, reset: 'short'}}],
    // Extra Attack: több forrásból sem halmozódik, a legnagyobb számít (PHB 164. o.; a calc attacksPerAction-je)
    'Paladin|Extra Attack': [{extraAttack: 2}], 'Ranger|Extra Attack': [{extraAttack: 2}],
    'Bard|Valor|Extra Attack': [{extraAttack: 2}], 'Bard|Swords|Extra Attack': [{extraAttack: 2}], 'Wizard|Bladesinging|Extra Attack': [{extraAttack: 2}],
    'Artificer|Battle Smith|Extra Attack': [{extraAttack: 2}], 'Artificer|Armorer|Extra Attack': [{extraAttack: 2}],
    'Paladin|Aura of Protection': [{saveBonus: {ab: 'cha', min: 1}}],
    'Ranger|Favored Enemy': [{todo: 'Favored Enemy: válassz ellenféltípust (és nyelvet)'}],
    'Ranger|Natural Explorer': [{todo: 'Natural Explorer: válassz kedvelt terepet'}],
    'Rogue|Expertise': [{expertise: {n: 2}}],
    'Rogue|Slippery Mind': [{save: ['wis']}],
    'Rogue|Assassin|Bonus Proficiencies': [{tool: ['disguise kit', "poisoner's kit"]}],
    'Sorcerer|Font of Magic': [{res: {n: 'Sorcery Points', max: 'col:Sorcery Points', reset: 'long'}}],
    'Sorcerer|Draconic|Draconic Resilience': [{hpPerClassLevel: 1}, {acBase: {base: 13, add: ['dex']}}],
    'Sorcerer|Draconic|Dragon Ancestor': [{lang: ['Draconic']}, {pickChoose: {label: 'Sárkánytípus', from: ['Black', 'Blue', 'Brass', 'Bronze', 'Copper', 'Gold', 'Green', 'Red', 'Silver', 'White']}}],
    ...Object.fromEntries([6, 7, 8, 9].map(n => [`Warlock|Mystic Arcanum (${n}th level)`, [{todo: `Mystic Arcanum: válassz egy ${n}. szintű warlock varázslatot`}]])),
    'Wizard|Arcane Recovery': [{res: {n: 'Arcane Recovery', max: 1, reset: 'long'}}],
    'Artificer|Flash of Genius': [{res: {n: 'Flash of Genius', max: 'mod:int', min: 1, reset: 'long'}}],
    'race|Dwarf': [{heavyOk: true}],
    'race|Dwarven Toughness': [{hpPerLevel: 1}],
    'race|Relentless Endurance': [{res: {n: 'Relentless Endurance', max: 1, reset: 'long'}}],
    'race|Breath Weapon': [{res: {n: 'Breath Weapon', max: 1, reset: 'short'}}],
    'race|Cantrip': [{spellChoose: {from: {list: 'Wizard', l: 0}, n: 1}}],
    'race|Draconic Ancestry': [{todo: 'Draconic Ancestry: válassz sárkánytípust'}],
    'feat|Alert': [{init: 5}],
    'feat|Tough': [{hpPerLevel: 2}],
    'feat|Mobile': [{speed: {v: 10}}],
    'feat|Observant': [{passive: {perception: 5, investigation: 5}}],
    'feat|Lucky': [{res: {n: 'Lucky', max: 3, reset: 'long'}}],
    'feat|Medium Armor Master': [{mamCap: 3}],
    'feat|Martial Adept': [{res: {n: 'Superiority Die (Martial Adept, d6)', max: 1, reset: 'short'}}],
    'feat|Metamagic Adept': [{res: {n: 'Sorcery Points (Metamagic Adept)', max: 2, reset: 'long'}}],
    'feat|Elemental Adept': [{pickChoose: {label: 'Sebzéstípus', from: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']}}],
    'opt|Defense': [{acBonus: 1}],
    'opt|Archery': [{rangedAtk: 2}],
    'opt|Dueling': [{duelDmg: 2}],
    'Artificer|Alchemist|Tool Proficiency': [{tool: ["alchemist's supplies"]}],
    'Artificer|Armorer|Tools of the Trade': [{armor: ['heavy']}, {tool: ["smith's tools"]}],
    'Artificer|Armorer|Armor Model': [{pickChoose: {label: 'Armor Model', from: ['Guardian', 'Infiltrator']}}],
    'Artificer|Artillerist|Tool Proficiency': [{tool: ["woodcarver's tools"]}],
    'Artificer|Battle Smith|Tool Proficiency': [{tool: ["smith's tools"]}],
    'Artificer|Battle Smith|Battle Ready': [{weapon: ['martial']}],
    'Barbarian|Storm Herald|Storm Aura': [{pickChoose: {label: 'Storm Aura', from: ['Desert', 'Sea', 'Tundra']}}],
    'Bard|Valor|Bonus Proficiencies': [{armor: ['medium', 'shields']}, {weapon: ['martial']}],
    'Bard|Swords|Bonus Proficiencies': [{armor: ['medium']}, {weapon: ['scimitar']}],
    'Cleric|Order|Bonus Proficiencies': [{armor: ['heavy']}, {skillChoose: {from: ['intimidation', 'persuasion'], n: 1}}],
    'Cleric|Peace|Implement of Peace': [{skillChoose: {from: ['insight', 'performance', 'persuasion'], n: 1}}],
    'Druid|Shepherd|Speech of the Woods': [{lang: ['Sylvan']}],
    'Fighter|Arcane Archer|Arcane Archer Lore': [{skillChoose: {from: ['arcana', 'nature'], n: 1}}, {pickChoose: {label: 'Cantrip', from: ['Prestidigitation', 'Druidcraft'], then: {Prestidigitation: [{spells: [{t: 'known', lvl: 3, sp: ['prestidigitation']}]}], Druidcraft: [{spells: [{t: 'known', lvl: 3, sp: ['druidcraft']}]}]}}}],
    'Fighter|Cavalier|Bonus Proficiency': [{skillChoose: {from: ['animal-handling', 'history', 'insight', 'performance', 'persuasion'], n: 1}}],
    'Fighter|Samurai|Bonus Proficiency': [{skillChoose: {from: ['history', 'insight', 'performance', 'persuasion'], n: 1}}],
    'Fighter|Samurai|Elegant Courtier': [{save: ['wis']}],
    'Fighter|Rune Knight|Bonus Proficiencies': [{tool: ["smith's tools"]}, {lang: ['Giant']}],
    'Monk|Drunken Master|Bonus Proficiencies': [{skill: {performance: 1}}, {tool: ["brewer's supplies"]}],
    'Monk|Kensei|Path of the Kensei': [{pickChoose: {label: 'Kensei fegyverek', n: {lv: {3: 2, 6: 3, 11: 4, 17: 5}}, weapon: true, help: {mit: 'Mezőnként egy fegyvertípus. Az első kettőből legyen egy közelharci és egy távolsági, később bármelyik. Simple vagy martial lehet, de nem lehet heavy vagy special tulajdonságú (a longbow megengedett).', sablon: 'A fegyver angol neve, ahogy a szabálykönyvben áll, egyes számban, mezőnként egy.', pelda: 'Longbow'}}}, {toolChoose: {from: ["calligrapher's supplies", "painter's supplies"], n: 1}}],
    'Monk|Mercy|Implements of Mercy': [{skill: {insight: 1, medicine: 1}}, {tool: ['herbalism kit']}],
    "Ranger|Beast Master|Ranger's Companion": [{pickChoose: {label: 'Állattárs', help: {mit: 'Az állattársad. Legfeljebb Medium méretű beast, CR 1/4 vagy kisebb (PHB 93. o.).', sablon: 'Bármilyen szöveg: az állat fajtája, utána zárójelben a neve, ha van.', pelda: 'Wolf (Szürke)'}}}],
    "Ranger|Hunter|Hunter's Prey": [{pickChoose: {label: "Hunter's Prey", from: ['Colossus Slayer', 'Giant Killer', 'Horde Breaker']}}],
    'Ranger|Hunter|Defensive Tactics': [{pickChoose: {label: 'Defensive Tactics', from: ['Escape the Horde', 'Multiattack Defense', 'Steel Will']}}],
    'Ranger|Hunter|Multiattack': [{pickChoose: {label: 'Multiattack', from: ['Volley', 'Whirlwind Attack']}}],
    "Ranger|Hunter|Superior Hunter's Defense": [{pickChoose: {label: "Superior Hunter's Defense", from: ['Evasion', 'Stand Against the Tide', 'Uncanny Dodge']}}],
    'Ranger|Gloom Stalker|Iron Mind': [{save: ['wis']}],
    'Ranger|Fey Wanderer|Otherworldly Glamour': [{skillChoose: {from: ['deception', 'performance', 'persuasion'], n: 1}}],
    'Rogue|Mastermind|Master of Intrigue': [{tool: ['disguise kit', 'forgery kit']}, {toolChoose: {n: 1}}, {langChoose: {n: 2}}],
    'Rogue|Scout|Survivalist': [{skill: {nature: 2, survival: 2}}],
    'Sorcerer|Divine Soul|Divine Magic': [{spellList: ['Cleric']}, {pickChoose: {label: 'Affinity', from: ['Good', 'Evil', 'Law', 'Chaos', 'Neutrality'], then: Object.fromEntries([['Good', 'cure wounds'], ['Evil', 'inflict wounds'], ['Law', 'bless'], ['Chaos', 'bane'], ['Neutrality', 'protection from evil and good']].map(([k, sp]) => [k, [{spells: [{t: 'known', lvl: 1, sp: [sp]}]}]]))}}],
    'Sorcerer|Storm|Wind Speaker': [{lang: ['Primordial']}],
    'Warlock|Hexblade|Hex Warrior': [{armor: ['medium', 'shields']}, {weapon: ['martial']}],
    'Warlock|Genie|The Genie': [{spells: [{t: 'expanded', lvl: 1, sp: ['detect evil and good', 'phantasmal force', 'create food and water', 'phantasmal killer', 'creation', 'wish']}]}, {pickChoose: {label: 'Genie Kind', from: ['Dao', 'Djinni', 'Efreeti', 'Marid'], then: Object.fromEntries(Object.entries({Dao: ['sanctuary', 'spike growth', 'meld into stone', 'stone shape', 'wall of stone'], Djinni: ['thunderwave', 'gust of wind', 'wind wall', 'greater invisibility', 'seeming'], Efreeti: ['burning hands', 'scorching ray', 'fireball', 'fire shield', 'flame strike'], Marid: ['fog cloud', 'blur', 'sleet storm', 'control water', 'cone of cold']}).map(([k, sp]) => [k, [{spells: [{t: 'expanded', lvl: 1, sp}]}]]))}}],
    'Wizard|Bladesinging|Training in War and Song (Bladesinging)': [{armor: ['light']}, {skill: {performance: 1}}, {pickChoose: {label: 'Egykezes fegyver', weapon: true, help: {mit: 'Egy fegyvertípus, amiben jártas leszel. Egykezes, közelharci fegyver legyen.', sablon: 'A fegyver angol neve, ahogy a szabálykönyvben áll, egyes számban.', pelda: 'Rapier'}}}],
    'opt|Pact of the Tome': [{spellChoose: {from: {l: 0}, n: 3}}],
    'opt|Book of Ancient Secrets': [{spellChoose: {from: {l: 1, ri: true}, n: 2}}],
    'opt|Blessed Warrior': [{spellChoose: {from: {list: 'Cleric', l: 0}, n: 2}}],
    'opt|Druidic Warrior': [{spellChoose: {from: {list: 'Druid', l: 0}, n: 2}}],
  };

  // a szabálykönyv hatásai, amelyeket a fenti tábla vált ki: 'all' = az 5e.tools több változatából csak az első került be (pl. Land: az Arctic), 'todo' = az általános ✋ teendő helyett van választás
  const RB_FX_OFF = {'Druid|Land': 'all', 'Sorcerer|Divine Soul': 'all', 'Fighter|Arcane Archer': 'all', 'Warlock|Genie': 'all', 'Bard|Lore': 'todo', 'Cleric|Nature': 'todo',
    'subrace|High': 'todo', 'opt|Pact of the Tome': 'todo', 'opt|Book of Ancient Secrets': 'todo', 'opt|Blessed Warrior': 'todo', 'opt|Druidic Warrior': 'todo'};
  const TCE_LISTA = 'Expanded Spell List';
  const TCE_CSERE = {'Ranger|Favored Enemy': ['Favored Foe'], 'Ranger|Favored Enemy improvement': ['Favored Foe'], 'Ranger|Natural Explorer': ['Deft Explorer'],
    'Ranger|Natural Explorer improvement': ['Deft Explorer'], 'Ranger|Favored Enemy and Natural Explorer improvements': ['Favored Foe', 'Deft Explorer'],
    'Ranger|Primeval Awareness': ['Primal Awareness'], "Ranger|Beast Master|Ranger's Companion": ['Primal Companion'],
    'Cleric|*|Divine Strike': ['Blessed Strikes'], 'Cleric|*|Potent Spellcasting': ['Blessed Strikes']};
  const TCE_KOVET = {'Ranger|Deft Explorer Improvement': 'Deft Explorer'};
  // a TCE-feature-ök mechanikája, szintenként (ugyanaz a név több szinten mást ad); kulcs: 'Osztály|Név|szint'. Az online teszt ellenőrzi, hogy létezik.
  const TCE_FX = {
    'Barbarian|Primal Knowledge|3': [{skillChoose: {from: ['animal-handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'], n: {lv: {3: 1, 10: 2}}}}],   // 3. és 10. szinten egy-egy
    'Cleric|Channel Divinity: Harness Divine Power|2': [{res: {n: 'Harness Divine Power', max: {lv: {2: 1, 6: 2, 18: 3}}, reset: 'long'}}],
    'Ranger|Deft Explorer|1': [{expertise: {n: 1}}, {langChoose: {n: 2}}],
    'Ranger|Deft Explorer Improvement|6': [{speed: {v: 5}}],
    'Ranger|Deft Explorer Improvement|10': [{res: {n: 'Tireless', max: 'pb', reset: 'long'}}],
    'Ranger|Favored Foe|1': [{res: {n: 'Favored Foe', max: 'pb', reset: 'long'}}],
    'Ranger|Primal Awareness|3': [{spells: [{t: 'known', lvl: 3, sp: ['speak with animals']}, {t: 'known', lvl: 5, sp: ['beast sense']}, {t: 'known', lvl: 9, sp: ['speak with plants']},
      {t: 'known', lvl: 13, sp: ['locate creature']}, {t: 'known', lvl: 17, sp: ['commune with nature']}]}],
    "Ranger|Nature's Veil|10": [{res: {n: "Nature's Veil", max: 'pb', reset: 'long'}}]
  };

  // ---------- leírások a felugró „i” ablakhoz (a függvények – todoInfo, freeInfo – a sheet.js-ben) ----------
  const BUILD_HELY = 'Helye: Alapadatok fül → Felépítés → Választások (új karakternél és szintlépésnél a varázsló ugyanezt kéri).';
  const SAJAT_JARTASSAG = 'Alapadatok fül → Saját jártasságok';
  const SAJAT_JELLEMZO = 'Képességek fül alja → Saját jellemző (a név ne egyezzen a jellemző nevével, mert akkor az újraszámoláskor eltűnik), vagy a Jegyzet fül';
  // a ✋ teendők: amit a program nem tud helyetted eldönteni; a szöveg alapján (az első találat számít)
  const KEZI_INFO = [
    [/Mystic Arcanum/, 'app', ['Válassz egy warlock varázslatot a megadott szintről (PHB 108. o.).', 'Varázslat fül → kereső: keresd meg a nevét, így a leírása is a lapra kerül. A szintje a lapon látszik.', 'Utána pipáld ki ezt a teendőt.']],
    [/Favored Enemy/, 'homebrew', ['Válassz ellenféltípust és egy nyelvét (PHB 91. o.).', `A típust írd ide: ${SAJAT_JELLEMZO}. Példa a névre: Kedvelt ellenfél. A nyelvet ide: ${SAJAT_JARTASSAG} → Nyelvek.`, 'Utána pipáld ki ezt a teendőt.']],
    [/Natural Explorer/, 'homebrew', ['Válassz kedvelt terepet (PHB 91. o.).', `Írd ide: ${SAJAT_JELLEMZO}.`, 'Utána pipáld ki ezt a teendőt.']],
    [/Draconic Ancestry/, 'homebrew', ['Válassz sárkánytípust: ez adja a Breath Weapon alakját és sebzéstípusát (PHB 34. o.).', `Az ellenállást írd ide: ${SAJAT_JARTASSAG} → Ellenállások. A Breath Weapont vedd fel saját támadásként (Alapadatok fül alja): a találat üresen marad, mert mentődobásos, a mentő DC-je a megjegyzésbe kerül.`, 'Utána pipáld ki ezt a teendőt.']],
    [/Fegyver-jártasság/, 'homebrew', ['Válassz fegyvert a jellemző leírása szerint.', `Írd ide: ${SAJAT_JARTASSAG} → Fegyverek.`, 'Utána pipáld ki ezt a teendőt.']],
    [/Skill \/ eszköz \/ nyelv/, 'homebrew', ['Válassz a jellemző leírása szerint.', `Skillnél: Alapadatok fül → Számolt értékek → a skill sora → ✎ Felülírás → jártas. Eszköznél és nyelvnél: ${SAJAT_JARTASSAG}.`, 'Utána pipáld ki ezt a teendőt.']],
    [/Ellenállás/, 'homebrew', ['Válassz sebzéstípust a jellemző leírása szerint.', `Írd ide: ${SAJAT_JARTASSAG} → Ellenállások.`, 'Utána pipáld ki ezt a teendőt.']],
    [/varázslat választása/, 'app', ['Válassz varázslatot a jellemző leírása szerint.', 'Varázslat fül → kereső: ha nem látod, vedd le a pipát a „csak az osztályaim listája” elől. Ha nincs a szabálykönyvben, írd a „Saját / homebrew varázslat neve” mezőbe.', 'Utána pipáld ki ezt a teendőt.']]
  ];
  const mezo = (cim, mit, sablon, pelda) => ({cim, mit: [mit], sablon, pelda});
  const MEZO_INFO = {
    plus: mezo('Saját jártasságok', 'Ami a számolt jártasságokon, érzékeken és ellenállásokon felül jár (homebrew, tárgy, DM döntése). A számoltak mellé kerül, azokat nem kell ide beírni.', 'Vesszővel elválasztott lista, angolul. Az üres mező törli.', 'Nyelvek: Aquan, Druidic · Ellenállások: poison · Érzékek: blindsight 10 ft.'),
    speed: mezo('Speed felülírása', 'A számolt speed helyett ez látszik. Üresen hagyva a számolt érték marad.', 'Szám, utána ft., és vesszővel a többi mozgásforma.', '30 ft., fly 30 ft.'),
    attack: mezo('Saját támadás', 'Amit a program nem számol a felszerelt fegyverekből (pl. Breath Weapon, homebrew támadás). A Harc fülön kattintva dob vele.', 'Név: bármi. Találat: előjeles szám, vagy üresen, ha mentődobásos. Sebzés: kockakifejezés, utána a sebzés típusa. Megjegyzés: bármi.', 'Átkozott kard · +5 · 1d8+3 slashing · magic'),
    resource: mezo('Saját erőforrás', 'Amit a program nem számol (pl. homebrew képesség, tárgy töltései). A max a teljes szám, a legördülő mondja meg, mikor töltődik vissza.', 'Név: bármi, a max szám.', 'Wand of Secrets, max 3, long rest'),
    jartassag: mezo('Jártasságok és egyebek', 'Kézi lapon itt tartod nyilván őket. A program nem számol belőlük, csak kiírja: a támadás találatát kézzel írd át.', 'Vesszővel elválasztott lista, angolul.', 'Páncél: light armor, shields · Fegyver: simple weapons, longswords · Érzékek: darkvision 60 ft.'),
    portrait: mezo('Kép linkje', 'A portré webes címe. A kép nem kerül a lapra, csak a link: ha a kép eltűnik a webről, a portré is. Biztosabb a tallózás.', 'http:// vagy https:// kezdetű, képre mutató cím.', 'https://example.com/karakter.jpg'),
    subclass: mezo('Alosztály', 'A szabálykönyvben nem szereplő vagy homebrew alosztály neve.', 'Bármilyen szöveg, angolul, ha lehet.', 'Fiend'),
    spell: mezo('Saját varázslat', 'Ami nincs a szabálykönyvben, vagy a listádon kívül jár (pl. Mystic Arcanum, homebrew).', 'A varázslat neve, mellette a szintje. Ha a szabálykönyvben van, ugyanúgy írd, mint ott, hogy a leírása is meglegyen: a kereső biztosabb.', 'Shadow of Moil'),
    item: mezo('Saját tárgy', 'Ami nincs a szabálykönyvben. A program nem számol belőle AC-t vagy támadást: azt saját támadásként, az AC-t pedig kézzel vagy ✎ felülírással vidd fel.', 'A tárgy neve, mellette a darabszám.', 'Család gyűrűje, 1'),
    feat: mezo('Saját jellemző', 'Ami nincs a szabálykönyvben: homebrew jellemző, vagy egy választásod. A program nem számol belőle, csak kiírja.', 'Név és leírás bármilyen szöveg, de a név ne egyezzen egy számolt jellemző nevével, mert akkor az újraszámoláskor eltűnik. Honnan: a forrás rövid neve.', 'Név: Kedvelt ellenfél · Leírás: undead · Honnan: Ranger 1')
  };

  return {SKILL_INFO, FX_LABEL, LAND_SPELLS, FEATURE_FX, RB_FX_OFF, TCE_LISTA, TCE_CSERE, TCE_KOVET, TCE_FX, BUILD_HELY, SAJAT_JARTASSAG, SAJAT_JELLEMZO, KEZI_INFO, MEZO_INFO};
})();
if (typeof modul === 'function') modul('sheet-adat', 1);

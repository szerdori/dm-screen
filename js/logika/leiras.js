// Flavour text a sebzésdobásokhoz (logika, DOM nélkül): saját, magyar mondatbank – TERV-flavour.md.
// Rétegek: docs/dontesek/0006. Ha változik, amire más fájl támaszkodik: modul('leiras', N) és az index.html-ben a leiras.js?v=N és a VART_MODULOK.
// A célpont humanoid; a véresség közepes (van vér és seb, de nem részletezi) – a felhasználó döntése, kapcsoló nincs.
'use strict';
modul('leiras', 1);

// ---------- testrészek: előre ragozott alakok ----------
// {ba} = -ba/-be (a vállába), {n} = -n (a vállán), {t} = tárgyeset (a vállát), {a} = birtokos alanyeset (a válla)
const TESTRESZ = {
  fej: ['a fejébe', 'a fején', 'a fejét', 'a feje'],
  nyak: ['a nyakába', 'a nyakán', 'a nyakát', 'a nyaka'],
  vall: ['a vállába', 'a vállán', 'a vállát', 'a válla'],
  kar: ['a karjába', 'a karján', 'a karját', 'a karja'],
  alkar: ['az alkarjába', 'az alkarján', 'az alkarját', 'az alkarja'],
  kez: ['a kezébe', 'a kezén', 'a kezét', 'a keze'],
  mellkas: ['a mellkasába', 'a mellkasán', 'a mellkasát', 'a mellkasa'],
  has: ['a hasába', 'a hasán', 'a hasát', 'a hasa'],
  oldal: ['az oldalába', 'az oldalán', 'az oldalát', 'az oldala'],
  hat: ['a hátába', 'a hátán', 'a hátát', 'a háta'],
  csipo: ['a csípőjébe', 'a csípőjén', 'a csípőjét', 'a csípője'],
  comb: ['a combjába', 'a combján', 'a combját', 'a combja'],
  lab: ['a lábába', 'a lábán', 'a lábát', 'a lába'],
  labszar: ['a lábszárába', 'a lábszárán', 'a lábszárát', 'a lábszára'],
};
// a súlyossághoz illő testrészek: a karcolás a végtagokat éri, a krit a fejet, nyakat, törzset
const HELY_FOKOZAT = {
  karc: ['kar', 'alkar', 'comb', 'labszar', 'vall', 'oldal'],
  rendes: ['vall', 'kar', 'oldal', 'comb', 'mellkas', 'hat', 'csipo', 'lab'],
  sulyos: ['mellkas', 'has', 'oldal', 'vall', 'comb', 'hat', 'kar'],
  // fej és nyak nélkül: a „markolatig a nyakába” már halálos seb, túl véres (a felhasználó döntése: közepes véresség); a fejet a mondatok maguk említik, ahol illik
  krit: ['mellkas', 'has', 'vall', 'oldal', 'comb', 'hat'],
};
const FOKOZATOK = ['karc', 'rendes', 'sulyos', 'krit'];
const FOKOZAT_HU = {karc: 'karcolás', rendes: 'találat', sulyos: 'súlyos', krit: 'krit'};
const FIZIKAI = ['slashing', 'piercing', 'bludgeoning'];
// a típusok és a fajták listája a sheet.js-ben (a telefonos dobás is ezeket küldi): Sheet.DMG_TYPES, Sheet.DMG_KINDS

// ---------- mondatbank ----------
// kulcs: fizikai típusnál „típus:kozel|tavol|nat”, energiánál a típus, ismeretlen típusnál fegyver:kozel, fegyver:tavol, varazs, terulet.
// Mentős (területi) varázslatnál csak a testrész nélküli mondatok jönnek szóba – ezért energiánál fokozatonként legalább kettő ilyen kell (teszt nézi).
const LEIRAS = {
  'slashing:kozel': {
    karc: ['A penge épp csak súrolja: vékony, vérző karcolás marad {n}.', 'Az él felhasítja a ruháját {n}, alatta vékony vércsík serken.', 'Egy gyors vágás {t} éri – felszisszen, de inkább dühös, mint sebesült.'],
    rendes: ['A penge {ba} mar, a seb azonnal vérezni kezd.', 'Erős vágás nyílik {n}; megtántorodik, és a sebhez kap.', 'Az él végigszánt {n}, a ruhája gyorsan átázik a vértől.', 'Csattan a penge: {t} mély, vérző vágás csúfítja el.'],
    sulyos: ['A penge mélyen {ba} hasít; felordít, és vér buggyan a sebből.', 'Hatalmas vágás nyitja fel {t} – megtántorodik, a vér sűrűn csorog.', 'Az él mélyen beleharap {ba}; elsápad, és alig áll a lábán.'],
    krit: ['Tökéletes vágás: a penge a páncél résén át {ba} hasít. Vér spriccel, és térdre rogy.', 'Az él villanva lecsap, és szélesen felhasítja {t}. Vér ömlik a földre, ő hörögve hátratántorodik.', 'Egyetlen, iszonyú suhintás – {a} vérben úszik, a fegyvere majdnem kiesik a kezéből.'],
  },
  'slashing:tavol': {
    karc: ['A pörögve repülő penge {t} súrolja, vékony vércsíkot hagyva.', 'A dobott fegyver éle megkarcolja {t}, aztán a földre csörren.', 'Az elsuhanó él felhasítja a ruháját {n}.'],
    rendes: ['A pörgő penge {ba} vágódik, a seb azonnal vérezni kezd.', 'A dobott fegyver éle felhasítja {t}; felszisszen, és a sebhez kap.', 'Az éles penge {ba} mar, mielőtt lehullana. Vér csorog a nyomában.'],
    sulyos: ['A pörgő fegyver mélyen {ba} csapódik, és benne is marad. Felordít, vér buggyan.', 'A dobott penge szélesen felnyitja {t}; megtántorodik, a vér sűrűn folyik.', 'A penge reccsenve {ba} fúródik – egy pillanatra térdre esik.'],
    krit: ['A pörgő penge teljes erővel {ba} vágódik; vér spriccel, ő hátrazuhan.', 'Tökéletes dobás: a penge a páncél résén át mélyen {ba} hatol. Felüvölt, és megtántorodik.', 'A fegyver süvítve érkezik, és mély, tátongó sebet nyit {n} – a vér patakokban ömlik.'],
  },
  'slashing:nat': {
    karc: ['A karmok {t} súrolják, három vékony, vérző csíkot hagyva.', 'Egy karomcsapás felhasítja a ruháját {n}, a bőrén épp csak felserken a vér.', 'A karmok hegye megkarmolja {t}; felszisszen.'],
    rendes: ['A karmok {ba} marnak, és három vérző barázdát szántanak.', 'Erős karomcsapás hasítja fel {t}; megtántorodik a lendülettől.', 'A karmok végigszántanak {n}, a ruhája gyorsan vörösre ázik.'],
    sulyos: ['A karmok mélyen {ba} vájnak, és kitépik magukat – felordít, a vér sűrűn csorog.', 'Egy vad karomcsapás mély, tátongó sebeket hasít {n}; elsápad és megtántorodik.', 'A karmok {ba} akadnak és szaggatnak; alig tudja kitépni magát.'],
    krit: ['A karmok teljes erővel {ba} csapnak, és mélyen felhasítják. Vér spriccel, ő a földre zuhan.', 'Iszonyú karomcsapás: {a} vérben úszik, a sebek szélei tátonganak.', 'A karmok a páncél alá kapnak, és mélyen végigszántanak {n} – üvöltve rogy térdre.'],
  },
  'piercing:kozel': {
    karc: ['A fegyver hegye épp csak megszúrja {t}; egy csepp vér serken.', 'A döfés megcsúszik, de a hegy felsérti {t}.', 'Egy gyors szúrás {t} éri – inkább csíp, mint fáj.'],
    rendes: ['A hegy {ba} fúródik, és vérző sebet hagy maga után.', 'Egy pontos döfés {t} találja; felszisszen, a seb vérezni kezd.', 'A penge hegye {ba} szalad, majd kicsúszik – vér csordul a nyomában.'],
    sulyos: ['A döfés mélyen {ba} hatol; felordít, és a sebhez kap, ujjai közt vér szivárog.', 'A hegy egészen {ba} szalad, a kirántásnál vér buggyan.', 'Egy kegyetlen szúrás {t} járja át – megtántorodik, és elsápad.'],
    krit: ['Tökéletes döfés: a hegy a páncél résén át mélyen {ba} hatol. Vér tör elő, ő térdre rogy.', 'A fegyver egészen markolatig {ba} szalad. Hörögve hátratántorodik, a vér ömlik a sebből.', 'A szúrás pontosan célba ér – {a} vérben úszik, és megroggyan a térde.'],
  },
  'piercing:tavol': {
    karc: ['A nyílvessző {t} súrolja, és vékony, vérző karcolást hagy.', 'A lövedék épp csak felsérti {t}, majd tovasuhan.', 'A vessző a ruhájába akad {n}, a hegye alig karcolja meg a bőrét.'],
    rendes: ['A nyílvessző tompa puffanással {ba} fúródik; felszisszen, a tollak remegnek.', 'A lövedék {ba} csapódik, és vérző sebet szakít.', 'A vessző {t} találja, és megakad benne – vér csorog a szára mentén.'],
    sulyos: ['A nyílvessző mélyen {ba} fúródik; felordít, és megtántorodik.', 'A lövedék átüti a ruháját, és mélyen {ba} hatol. A seb körül sötét folt terjed.', 'A vessző {t} szinte átjárja – vér buggyan, ő elsápad.'],
    krit: ['Tökéletes lövés: a nyílvessző a páncél résén át mélyen {ba} fúródik. Hörögve térdre rogy.', 'A vessző süvítve érkezik, és egészen a tollakig {ba} szalad. Vér tör elő, ő hátratántorodik.', 'A lövedék teljes erővel {ba} csapódik – {a} vérben úszik, a lábai megrogynak.'],
  },
  'piercing:nat': {
    karc: ['A fogak {t} súrolják, és vérző karcolásokat hagynak.', 'Egy kapás épp csak eléri {t}; a fogak nyoma vékonyan vérzik.', 'A harapás megcsúszik a ruháján, de a fogak hegye felsérti {t}.'],
    rendes: ['A fogak {ba} mélyednek; felszisszen, és kirántja magát.', 'Erős harapás {t} éri – a fognyomokból vér szivárog.', 'Az agyarak {ba} vájnak, a seb azonnal vérezni kezd.'],
    sulyos: ['A fogak mélyen {ba} vájnak és rángatnak; felordít, a vér sűrűn csorog.', 'Egy vad harapás satuként szorítja {t} – csak nagy nehezen szabadul, a seb tátong.', 'Az agyarak {ba} mélyednek, és szaggatnak; elsápad, és megtántorodik.'],
    krit: ['Iszonyú harapás: a fogak mélyen {ba} vájnak, és nem eresztik. Vér spriccel, ő üvöltve rángatózik.', 'Az állkapcsok teljes erővel kapják el {t} – valami megreccsen, a vér ömlik.', 'A fogak a páncél alá kapnak, és mélyen {ba} mélyednek. Térdre rogy, az arca eltorzul a fájdalomtól.'],
  },
  'bludgeoning:kozel': {
    karc: ['A csapás {t} éri, de csak súrolja; később szép lila folt lesz belőle.', 'A fegyver tompán koppan {n}; felmordul, de állja.', 'Egy félrecsúszó ütés {t} találja – inkább kibillenti, mint megsebzi.'],
    rendes: ['A csapás tompa puffanással {t} éri; megtántorodik, és felnyög.', 'Az ütés {ba} csapódik, a bőr felreped, vér serken.', 'A fegyver nagyot dobban {n}; elakad a lélegzete a fájdalomtól.'],
    sulyos: ['Az iszonyú ütés {t} éri – valami megreccsen, ő felordít.', 'A csapás erejétől hátratántorodik; {a} azonnal bedagad, vér szivárog a feszülő bőrből.', 'A fegyver teljes súllyal {ba} csapódik; megtántorodik, és alig kap levegőt.'],
    krit: ['Tökéletes csapás: a fegyver teljes erővel {t} találja. Csont reccsen, ő térdre zuhan.', 'Az ütés olyan erővel csapódik {ba}, hogy elsötétül előtte a világ; vér fut végig rajta, és megroggyan.', 'A fegyver hatalmasat dobban {n} – valami eltörik, ő nyögve a földre rogy.'],
  },
  'bludgeoning:tavol': {
    karc: ['A parittyakő {t} súrolja, és egy piros horzsolást hagy.', 'A lövedék tompán koppan {n}, majd lepattan.', 'A repülő kő épp csak eléri {t}; felszisszen.'],
    rendes: ['A kő tompa puffanással {ba} csapódik; megtántorodik, felnyög.', 'A lövedék {t} találja el – a bőr felreped, vér serken.', 'A becsapódás nagyot dobban {n}, a fájdalomtól elakad a lélegzete.'],
    sulyos: ['A lövedék iszonyú erővel {ba} csapódik – valami megreccsen, ő felordít.', 'A kő {t} éri; a csapás erejétől hátratántorodik, és vért köp.', 'A becsapódás nyomán {a} azonnal bedagad, és vérezni kezd.'],
    krit: ['Tökéletes találat: a lövedék teljes erővel {ba} csapódik. Csont reccsen, ő térdre rogy.', 'A kő akkora erővel találja {t}, hogy egy pillanatra elsötétül előtte a világ – vér fut végig rajta.', 'A lövedék süvítve érkezik, és hatalmasat csattan {n}; nyögve a földre zuhan.'],
  },
  'bludgeoning:nat': {
    karc: ['Egy suta csapás {t} éri – inkább meglöki, mint megsebzi.', 'A hatalmas végtag súrolja {t}, és egy lila folt marad utána.', 'A csapás tompán puffan {n}; felmordul, de állva marad.'],
    rendes: ['A súlyos csapás {t} éri; megtántorodik, és felnyög.', 'Az ütés tompa puffanással {ba} csapódik, a bőr felreped.', 'A lendület {t} találja, és fél lépést hátralöki – elakad a lélegzete.'],
    sulyos: ['A hatalmas csapás teljes erővel {t} éri – valami megreccsen, ő felordít.', 'Az ütéstől hátratántorodik egy lépést; {a} azonnal bedagad, vér szivárog.', 'A súlyos végtag {ba} csapódik, és kipréseli belőle a levegőt.'],
    krit: ['Iszonyú csapás: a teremtmény teljes súlyával {t} találja. Csont reccsen, ő a földre zuhan.', 'Az ütés olyan erővel éri {t}, hogy elsötétül előtte a világ – vér fut végig rajta, és megroggyan.', 'A hatalmas csapás felkapja és odébb taszítja; {a} vérzik, és nyögve próbál feltápászkodni.'],
  },
  fire: {
    karc: ['A láng {t} nyalja meg; a bőre kipirosodik, a ruhája füstölni kezd.', 'Forró szikrák égetik {t}, apró hólyagok jelennek meg.', 'A hőség megcsapja; a haja megpörkölődik, és felszisszen.', 'Egy lángnyelv végignyalja a ruháját; gyorsan leveri róla a parazsat.'],
    rendes: ['A tűz {ba} mar; a ruha lángra kap, a bőre vörösen hólyagosodik.', 'Lángok csapnak fel {n}, égett szövet szaga terjeng.', 'A lángok körbenyaldossák; felkiált, és kétségbeesetten csapkodja a ruháját.', 'A tűz végigsöpör rajta, a bőre kivörösödik és hólyagosodni kezd.'],
    sulyos: ['A tűz mélyen {ba} perzsel; felordít, a bőre megpörkölődik és felhólyagzik.', 'Égő seb nyílik {n}, a megperzselt ruha a bőrére tapad.', 'Lángok borítják el; üvöltve tántorog, a ruhája és a haja is ég.', 'A forróság szinte átjárja; a bőre vörösen felhólyagzik, és alig kap levegőt a füsttől.'],
    krit: ['A tűz teljes erővel {ba} csap; a bőr megég, felhólyagzik, ő a földre veti magát.', 'Izzó lángcsóva robban {n} – felüvölt, a sebből füst száll fel.', 'Élő fáklyaként lángol egy pillanatig; üvöltve hempereg, hogy eloltsa magát.', 'A lángok mindenhol elérik; a ruhája elszenesedik, a bőre hólyagos, és térdre rogy.'],
  },
  cold: {
    karc: ['Jeges fuvallat éri {t}; a bőre elfehéredik, a fogai vacogni kezdenek.', 'Dér üli meg {t}, a bőre csípősen zsibbad.', 'Fagyos lehelet csapja meg; borzongva összerázkódik.', 'Vékony dérréteg ül ki a ruháján, a lehelete fehér páraként gomolyog.'],
    rendes: ['A hideg {ba} mar; a bőr kékesfehérre fagy, és megreped.', 'Jégkristályok nőnek {n}, a mozdulatai meggémberednek.', 'A fagy belemar; a mozdulatai lelassulnak, az ajka elkékül.', 'Jeges hullám söpör végig rajta, a bőre megfeszül és megrepedezik.'],
    sulyos: ['A jég mélyen {ba} hatol; {a} merevvé dermed, a bőr vérző repedésekkel szakad fel.', 'Fagyos csapás éri {t} – a ruha ráfagy, a bőr fehér és érzéketlen.', 'A hideg csontig hatol; dideregve tántorog, a lélegzés is fáj.', 'Zúzmara borítja be; a ruhája recsegve ráfagy, és alig bír mozdulni.'],
    krit: ['Iszonyú fagy csap {ba}: a bőr megreped, a vér is megfagy a sebben. Térdre rogy.', 'Jégtüskék sarjadnak {n}, és mélyen a húsába hatolnak – felüvölt.', 'A fagy egy pillanatra teljesen megdermeszti; amikor megmozdul, a bőre vérző repedésekben szakad fel.', 'Jégbe dermed a lélegzete; zúzmarás szempillákkal, remegve rogy térdre.'],
  },
  lightning: {
    karc: ['Kék szikra csípi meg {t}; megrándul, a haja égnek áll.', 'Egy villám csak megcsípi {t}, apró égésnyom marad.', 'Az áramütéstől összerándul, és ózonszag terjeng.', 'Szikrák pattognak körülötte; a haja égnek áll, a fogai összecsikordulnak.'],
    rendes: ['A villám {ba} csap; minden izma görcsbe rándul egy pillanatra.', 'Vakító kisülés éri {t}, a bőrén elágazó, vörös égésnyom marad.', 'Az áram végigfut rajta; rángatózik, a ruhája füstöl.', 'Recsegő villám csap belé; megtántorodik, és a fegyverét is majdnem elejti.'],
    sulyos: ['A villám {ba} csapódik, és végigcikázik a testén; görcsbe rándul, és alig áll a lábán.', 'Elágazó, égett nyomot hagy {n} a kisülés, a ruha füstölögve parázslik.', 'Vakító villanás – rángatózva hátratántorodik, a szíve egy pillanatra kihagy.', 'Az áramütés szinte felemeli; a haja füstöl, és remegve kapkod levegő után.'],
    krit: ['Tomboló villám csap {ba}; a teste ívbe feszül, a bőrén égett, elágazó minták rajzolódnak.', 'A kisülés teljes ereje {t} éri – a ruhája lángra kap, és a földre zuhan.', 'Mennydörgő villanás; a teste görcsbe merevedik, és füstölögve rogy össze.', 'Az áram tombol benne; minden izma rángatózik, a látása egy pillanatra elsötétül.'],
  },
  thunder: {
    karc: ['A hanghullám {t} éri, és meglöki.', 'A dörgés {n} csattan, mint egy hatalmas tenyér.', 'Fülsiketítő dördülés csapja meg; a füle cseng, megtántorodik.', 'A mennydörgés megrázza; egy pillanatra elveszíti az egyensúlyát.'],
    rendes: ['A hanghullám {t} éri, és fél lépést hátralöki; a fülei csengenek.', 'A dörgés {ba} csapódik, mint egy láthatatlan ököl.', 'A robaj átrázza; a füléből vékony vér csordul.', 'Mennydörgő lökés éri; hátratántorodik, és elakad a lélegzete.'],
    sulyos: ['Iszonyú dörgés csap {ba}; valami megreccsen benne, ő felordít.', 'A hanghullám teljes erővel {t} éri – hátrarepül egy lépést, és vért köp.', 'A robajtól egy pillanatra megsiketül; a füléből és az orrából vér szivárog.', 'A dörgés átrázza a csontjait; szédülten tántorog, alig áll a lábán.'],
    krit: ['Robbanásszerű dörgés csap {ba}; hátrarepül, és nagy csattanással a földre zuhan.', 'A hanghullám teljes ereje {t} éri – csont reccsen, a fülei vérzik.', 'A mennydörgés szinte összepréseli; vér fut az orrából és a füléből, és térdre rogy.', 'Fülsiketítő robaj – a földre taszítja, és csak kábultan pislog, a füle zúg.'],
  },
  acid: {
    karc: ['Néhány savcsepp sziszeg {n}, a bőr kipirosodik.', 'A sav {t} marja meg, apró, csípős foltokat hagyva.', 'Savas permet éri; a ruhája apró lyukakkal kezd füstölni.', 'Csípős, maró gőz csapja meg; köhögve hátrál.'],
    rendes: ['A sav {ba} mar; sziszegve füstöl, a bőr felhólyagzik.', 'Maró folyadék fröccsen {t}, a ruha és a bőr is felmaródik.', 'Savas sugár éri; a ruhája füstölögve olvad, a bőre vörösen ég.', 'A sav végigfolyik rajta, sziszeg és habzik, ő fájdalmasan felkiált.'],
    sulyos: ['A sav mélyen {ba} marja magát; a bőr felhólyagzik és felreped, a seb nyersen vérzik.', 'Maró hullám önti el {t}; üvöltve próbálja letörölni, de a sav tovább eszi magát.', 'A sav elborítja; a ruhája szétmállik, a bőre füstölögve felhólyagzik.', 'Fojtó, maró gőz csapja meg; köhögve, könnyezve tántorog.'],
    krit: ['Tömény sav csapódik {ba}; sziszegve, füstölögve marja a húst, ő felüvölt.', 'A sav teljesen elborítja {t} – a bőr felhólyagzik és felreped, vér és füst keveredik.', 'Maró áradat zúdul rá; a páncélja is sziszegve olvad, és térdre rogy a fájdalomtól.', 'A sav mindenhol eléri; füstölögve, vakon tántorog, és üvöltve dörzsöli az arcát.'],
  },
  poison: {
    karc: ['Zöldes méreg éri {t}; a bőr zsibbadni kezd körülötte.', 'A méreg {ba} csíp, és enyhén égetni kezd.', 'Keserű, fojtó szag csapja meg; köhögve hátrál.', 'Enyhe émelygés tör rá, a gyomra összeszorul.'],
    rendes: ['A méreg {ba} szivárog; a környéke elkékül és bedagad.', 'A méreg {n} égeti a bőrt, a seb körül sötét erek rajzolódnak ki.', 'A méreg a vérébe jut; elsápad, és öklendezni kezd.', 'Szédülés és hányinger tör rá, a lába megremeg.'],
    sulyos: ['A méreg {ba} jut, és sötét erek kúsznak szét belőle; remegve öklendezik.', 'Lüktető, zöldes duzzanat nő {n}, a fájdalom szinte megbénítja.', 'A méreg végigárad a testén; görcsösen köhög, és vért köp.', 'Ólmos gyengeség önti el; a látása elhomályosul, alig áll a lábán.'],
    krit: ['Tömény méreg hatol {ba}; a környéke azonnal sötétlilára duzzad, ő görcsbe rándul.', 'A méreg {n} szinte forr – sötét erek futnak szét belőle, és térdre rogy.', 'A méreg lángként árad szét az ereiben; rángatózva öklendezik, és a földre esik.', 'Fojtó, émelyítő roham tör rá; a szája habzik, a szeme könnyezik, alig kap levegőt.'],
  },
  necrotic: {
    karc: ['Hideg, sötét érintés éri {t}; a bőr ott szürkére fakul.', '{a} elzsibbad, mintha egy pillanatra elhalt volna.', 'Halálos hideg fut végig rajta; megborzong, mintha a sír lehelete érte volna.', 'Az ereje egy szempillantásra elszáll, a keze megremeg.'],
    rendes: ['Fekete energia mar {ba}; a bőr ott elszürkül és ráncosra szárad.', 'Sötét erek kúsznak szét {n}, a hús hidegen lüktet.', 'Az élet kiszivárog belőle; elsápad, a szeme alatt sötét karikák jelennek meg.', 'Halotti hideg járja át; a mozdulatai elnehezülnek, mintha éveket öregedett volna.'],
    sulyos: ['A nekrotikus energia mélyen {ba} hatol; a hús elszürkül, és repedezni kezd.', '{a} elszürkül és elhal, ahol az energia érte; nem érez semmit, csak hideget.', 'Az élete elszivárog belőle; megtántorodik, az arca beesett és szürke.', 'Sötét köd szívja ki az erejét; remegve rogy fél térdre.'],
    krit: ['Fekete energia robban {ba}; a hús elszürkül és megreped, ő hörögve összegörnyed.', '{a} pillanatok alatt elszárad és elfeketedik, a fájdalom elviselhetetlen.', 'A halál szinte megérinti; az arca beesik, egy tincse kifehéredik, és térdre zuhan.', 'Az élet egy hatalmas hullámban szakad ki belőle; szürke, remegő kézzel kapaszkodik.'],
  },
  radiant: {
    karc: ['Vakító fény villan {n}, és enyhén megperzseli.', 'Izzó sugár éri {t}; a bőr kipirosodik, mintha napégés érte volna.', 'Ragyogó fény csapja meg; hunyorogva, felszisszenve hátrál.', 'Égető fényesség önti el egy pillanatra; a szeme könnyezik.'],
    rendes: ['Izzó fény mar {ba}; a bőr felhólyagzik, mintha a nap égette volna.', 'Fehér lángként lobban fel a fény {n}, és perzselő sebet hagy.', 'Égető ragyogás járja át; felkiált, és eltakarja a szemét.', 'A szent fény belülről égeti; a bőre izzik, és felhólyagzik.'],
    sulyos: ['Vakító fénysugár csap {ba}; a seb izzik, a bőr megpörkölődik körülötte.', 'Az izzó fény mélyen {ba} ég; felordít, és vakon tántorog.', 'Égető ragyogás borítja el; a bőre felhólyagzik, a szeme könnyben úszik.', 'A fény úgy égeti, mintha a nap zuhant volna rá; üvöltve görnyed össze.'],
    krit: ['Tündöklő fényoszlop csap {ba}; a seb fehéren izzik, ő térdre rogy.', 'A ragyogás teljes ereje {t} éri – a bőr megperzselődik, füst és fény szivárog a sebből.', 'Kegyetlen, szent fény lobban fel benne; belülről izzik, és üvöltve rogy össze.', 'Vakító villanás; egy pillanatra semmit sem lát, a bőre füstölögve hólyagos.'],
  },
  force: {
    karc: ['Láthatatlan erő pöcköli meg {t}; felszisszen.', 'Egy erőhullám {t} éri, és meglöki.', 'Mintha egy láthatatlan kéz taszítaná meg; megtántorodik.', 'Zümmögő erő csapja meg; a levegő remeg körülötte.'],
    rendes: ['Tiszta erő csapódik {ba}, mint egy láthatatlan kalapács.', 'Az erőnyaláb {t} találja, a bőr felreped, vér serken.', 'A láthatatlan lökés hátrataszítja egy lépést; elakad a lélegzete.', 'Vibráló erő préseli össze egy pillanatra; felnyög.'],
    sulyos: ['A tiszta erő iszonyú csapással {ba} vágódik; valami megreccsen benne.', 'Ragyogó erőnyaláb fúródik {ba}, és vérző sebet szakít.', 'A láthatatlan erő felkapja és hátravágja; vért köp.', 'Mintha egy óriás ökle találná telibe; görnyedten kapkod levegő után.'],
    krit: ['Sistergő erő robban {ba}; csont reccsen, ő hátrarepül.', 'Az erő teljes súllyal {t} éri – a bőr felreped, a vér spriccel.', 'A láthatatlan erő a földhöz csapja; nyögve, kábultan próbál feltápászkodni.', 'Vakító erőnyaláb vágja le a lábáról; hatalmasat csattan a földön.'],
  },
  psychic: {
    karc: ['Éles, tűszúrásszerű fájdalom hasít a fejébe; megrázza magát.', 'Idegen suttogás sziszeg az elméjében; egy pillanatra elbizonytalanodik.', 'Lüktető fejfájás tör rá; összeszorítja a fogát.'],
    rendes: ['Égető fájdalom szakad a fejébe; a halántékához kap, és felnyög.', 'Rémisztő képek villannak fel előtte; reszketve hátrál.', 'Az elméje megremeg az idegen erő alatt; az orrából vékony vér csordul.'],
    sulyos: ['Az elméjébe hatoló fájdalom térdre kényszeríti; mindkét kezével a fejét szorítja.', 'Sikoltó hangok tépik az elméjét; az orrából és a füléből vér szivárog.', 'Iszonyú nyomás szorul a koponyájára; a látása elhomályosul, alig áll a lábán.'],
    krit: ['Az elméje egy pillanatra széthullik; üvöltve rogy térdre, az orrából vér ömlik.', 'Elviselhetetlen sikoly hasít az elméjébe; remegve, üres tekintettel bámul a semmibe.', 'A fájdalom fehéren izzik a fejében; vér szivárog az orrából, és összeesik.'],
  },
  'fegyver:kozel': {
    karc: ['A fegyver épp csak eléri {t}; felszisszen.', 'A csapás súrolja {t}, apró sebet hagyva.', 'Egy gyors támadás {t} találja, de alig sérti meg.'],
    rendes: ['A fegyver {t} találja; megtántorodik, a seb vérezni kezd.', 'Erős találat éri {t}; felnyög, és a sebhez kap.', 'A csapás {ba} talál, vér serken a nyomában.'],
    sulyos: ['A fegyver teljes erővel {t} éri; felordít, a vér sűrűn csorog.', 'Kegyetlen találat {n} – megtántorodik, és elsápad.', 'A támadás mélyen {ba} hatol; alig áll a lábán.'],
    krit: ['Tökéletes találat: a fegyver a páncél résén át {ba} hatol. Vér tör elő, ő térdre rogy.', 'Iszonyú csapás éri {t} – hörögve hátratántorodik, a vér ömlik.', 'A támadás pontosan célba ér; {a} vérben úszik, és megroggyan a térde.'],
  },
  'fegyver:tavol': {
    karc: ['A lövedék épp csak súrolja {t}.', 'A lövés felsérti {t}, majd tovasuhan.', 'A lövedék megkarcolja {t}; felszisszen.'],
    rendes: ['A lövedék {ba} csapódik; felszisszen, a seb vérezni kezd.', 'Pontos lövés {t} találja – megtántorodik.', 'A lövedék {n} sebzi meg, vér csordul a nyomában.'],
    sulyos: ['A lövedék mélyen {ba} hatol; felordít, és megtántorodik.', 'Kegyetlen találat {n} – a seb körül sötét folt terjed.', 'A lövés teljes erővel {t} éri; alig áll a lábán.'],
    krit: ['Tökéletes lövés: a lövedék a páncél résén át mélyen {ba} hatol. Hörögve térdre rogy.', 'A lövedék süvítve {ba} csapódik – vér tör elő, ő hátratántorodik.', 'Pontos, kegyetlen találat; {a} vérben úszik, és megroggyan a lába.'],
  },
  varazs: {
    karc: ['A varázslat {t} súrolja; a bőr bizsereg és kipirosodik.', 'Szikrázó energia csípi meg {t}.', 'A mágia megcsapja; felszisszen, és megrázza magát.', 'Bizsergő erő fut végig rajta, de hamar elmúlik.'],
    rendes: ['A varázslat {ba} csapódik; felkiált, és megtántorodik.', 'Vibráló energia mar {ba}, a bőr felreped.', 'A mágia végigsöpör rajta; fájdalmasan felnyög.', 'Az energia átjárja, a teste megrándul.'],
    sulyos: ['A varázslat teljes erővel {t} éri; felordít, a seb füstölög.', 'Tomboló energia hatol {ba}, és mély sebet hagy.', 'A mágia ereje hátrataszítja; vért köp, és alig áll a lábán.', 'Az energia tombol benne; remegve, elsápadva tántorog.'],
    krit: ['A varázslat pontosan célba ér: tomboló energia robban {ba}, ő térdre zuhan.', 'A mágia teljes ereje {t} éri – a bőr felreped, vér és füst tör elő.', 'Az energia egy villanással a földre teríti; nyögve próbál feltápászkodni.', 'A varázslat úgy megrázza, hogy egy pillanatra elsötétül előtte a világ.'],
  },
  terulet: {
    karc: ['A hatás széle éri csak; néhány horzsolással megússza.', 'Félreugrik, de így is kap belőle egy keveset.', 'Apró sebek és karcolások borítják el.'],
    rendes: ['Teljes erővel éri a hatás; felkiált, és megtántorodik.', 'Sebek nyílnak rajta több helyen, a ruhája vérfoltos.', 'A támadás végigsöpör rajta, és fájdalmasan felnyög.'],
    sulyos: ['Nem tud kitérni: a hatás mindenhol eléri, és vérző sebekkel borítja be.', 'A csapás ereje ledönti a lábáról; nyögve tápászkodik.', 'Felordít, ahogy a hatás teljes ereje végigsöpör rajta.'],
    krit: ['Telibe kapja: mindenhol vérzik, és a földre zuhan.', 'A hatás szétszaggatja a ruháját, a bőrét sebek borítják; térdre rogy.', 'Esélye sincs kitérni; vérző sebekkel borítva rogy össze.'],
  },
};
const HELYORZO_RE = /\{(ba|n|t|a)\}/;

// ---------- a támadás felismerése ----------
const TERMESZETES_RE = /\b(bite|claws?|talons?|tail|gore|slam|tentacles?|horns?|hooves|sting|beak|tusks?|pincers?|fist)\b/i;
// a támadás fajtája a nevéből és a szövegéből: mw/rw = közelharci/távolsági fegyver, ms/rs = spell attack, sv = mentős (területi), sp = varázslat, nat = természetes fegyver
function tamadasFajta(nev, szoveg = '') {
  const t = String(szoveg);
  if (TERMESZETES_RE.test(String(nev))) return 'nat';
  if (/melee or ranged weapon attack/i.test(t)) return 'mw';
  if (/melee weapon attack|melee attack roll/i.test(t)) return 'mw';
  if (/ranged weapon attack|ranged attack roll/i.test(t)) return 'rw';
  if (/melee spell attack/i.test(t)) return 'ms';
  if (/ranged spell attack/i.test(t)) return 'rs';
  if (/saving throw/i.test(t)) return 'sv';
  if (/\bspell\b/i.test(t)) return 'sp';
  return '';
}
// a dobás súlyossága a kockák lehetséges tartományához mérve (a krit külön)
function sebzesFokozat(expr, total, crit) {
  if (crit) return 'krit';
  let min = 0, max = 0;
  for (const m of String(expr).replace(/[−–]/g, '-').replace(/\s+/g, '').matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/gi)) {
    const s = m[1] === '-' ? -1 : 1;
    if (m[3]) { const n = +(m[2] || 1), d = +m[3]; if (s > 0) { min += n; max += n * d; } else { min -= n * d; max -= n; } }
    else { min += s * +m[4]; max += s * +m[4]; }
  }
  const t = +total;
  if (!(max > min) || isNaN(t)) return 'rendes';
  const f = (t - min) / (max - min);
  return f < 0.3 ? 'karc' : f >= 0.7 ? 'sulyos' : 'rendes';
}
// a kocka nem sebzés, ha utána hit points / időtartam / távolság áll (pl. „regains 1d4 hit points”, „stunned for 1d4 rounds”) – a saját ellenfeleknél gyakori
const NEM_SEBZES_RE = /^\)?\s*(?:extra\s+|temporary\s+)?(?:hit points?|hp\b|rounds?|minutes?|hours?|turns?|days?|feet|ft\b)/i;
const nemSebzes = utana => NEM_SEBZES_RE.test(String(utana || ''));
// melyik mondatcsoport, és csak testrész nélküli mondat jöhet-e (területi hatás)
function leirasCsoport(type, kind) {
  if (FIZIKAI.includes(type)) {
    if (kind === 'sv') return ['terulet', false];
    if (['ms', 'rs', 'sp'].includes(kind)) return ['varazs', false];  // pl. Ice Knife: varázslat, nem nyílvessző
    return [`${type}:${kind === 'nat' ? 'nat' : kind === 'rw' ? 'tavol' : 'kozel'}`, false];
  }
  if (LEIRAS[type]) return [type, kind === 'sv'];
  if (kind === 'rw') return ['fegyver:tavol', false];
  if (['ms', 'rs'].includes(kind)) return ['varazs', false];
  return ['fegyver:kozel', false];
}

// ---------- a mondat kiválasztása ----------
const leirasUtolso = {};  // csoport:fokozat → a legutóbb használt mondatok sorszáma (hogy ne ismétlődjön)
const veletlenElem = lista => lista[Math.min(lista.length - 1, Math.max(0, rnd(lista.length) - 1))];
// ismeretlen típus vagy fajta = nincs megadva
const leirasBe = o => {
  const type = String(o.type || '').toLowerCase(), kind = String(o.kind || '');
  // mentőnél nincs krit: ott a dobott összeg dönt (a Shift+kattintás duplázott kockáival)
  return {type: Sheet.DMG_TYPES.includes(type) ? type : '', kind: Sheet.DMG_KINDS.includes(kind) ? kind : '',
    fokozat: FOKOZATOK.includes(o.fokozat) ? o.fokozat : sebzesFokozat(o.expr, o.total, o.crit && kind !== 'sv')};
};
// {type, kind, fokozat}: a fokozat helyett expr + total + crit is megadható. Visszatér: a mondat, vagy '' (nincs mihez igazítani)
function sebzesLeiras(o) {
  const {type, kind, fokozat} = leirasBe(o);
  // típus nélkül csak támadásnál: egy varázslat vagy mentő kockája típus nélkül lehet gyógyítás is
  if (!type && !['mw', 'rw', 'ms', 'rs', 'nat', 'w'].includes(kind)) return '';
  const [csoport, helyNelkul] = leirasCsoport(type, kind);
  const mind = LEIRAS[csoport][fokozat].map((s, i) => [s, i]).filter(([s]) => !helyNelkul || !HELYORZO_RE.test(s));
  const kulcs = csoport + ':' + fokozat, volt = leirasUtolso[kulcs] || [];
  const friss = mind.filter(([, i]) => !volt.includes(i));
  const [mondat, i] = veletlenElem(friss.length ? friss : mind);
  leirasUtolso[kulcs] = [i, ...volt].slice(0, Math.max(1, Math.min(2, mind.length - 1)));
  const hely = TESTRESZ[veletlenElem(HELY_FOKOZAT[fokozat])];
  const kesz = mondat.replace(/\{ba\}/g, hely[0]).replace(/\{n\}/g, hely[1]).replace(/\{t\}/g, hely[2]).replace(/\{a\}/g, hely[3]);
  return kesz.charAt(0).toUpperCase() + kesz.slice(1);
}
// a naplósor alá: dőlt betűs leírás és 🔄 (új mondat ugyanarra a dobásra); a data-flv a típus, a fajta és a fokozat
function leirasHtml(o) {
  const {type, kind, fokozat} = leirasBe(o);
  const szoveg = sebzesLeiras({type, kind, fokozat});
  return szoveg ? `<div class="flv" data-flv="${esc([type, kind, fokozat].join('|'))}">${esc(szoveg)} <span class="flvuj" data-act="flvUj" title="Másik leírás (${esc(FOKOZAT_HU[fokozat])})">🔄</span></div>` : '';
}

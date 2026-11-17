// Katalog kostí – názvy CZ / EN / LA, mapování na modely BodyParts3D (FMA ID).
// Používá jej aplikace i build skript (scripts/build-model.mjs).
//
// Pohlaví podstatných jmen slouží ke správné shodě se stranou:
//   cs: 'm' (pravý), 'f' (pravá), 'n' (pravé)
//   la: 'm' (dexter), 'f' (dextra), 'n' (dextrum)

const SIDE = {
  cs: { R: { m: 'pravý', f: 'pravá', n: 'pravé' }, L: { m: 'levý', f: 'levá', n: 'levé' } },
  la: { R: { m: 'dexter', f: 'dextra', n: 'dextrum' }, L: { m: 'sinister', f: 'sinistra', n: 'sinistrum' } },
  en: { R: 'right', L: 'left' },
};

export const GROUPS = {
  neuro: { cs: 'Mozková část lebky', en: 'Neurocranium' },
  viscero: { cs: 'Obličejová část lebky', en: 'Viscerocranium (facial skeleton)' },
  teeth: { cs: 'Zuby', en: 'Teeth' },
  cervical: { cs: 'Krční obratle', en: 'Cervical vertebrae' },
  thoracicV: { cs: 'Hrudní obratle', en: 'Thoracic vertebrae' },
  lumbar: { cs: 'Bederní obratle', en: 'Lumbar vertebrae' },
  sacral: { cs: 'Kost křížová', en: 'Sacrum' },
  discs: { cs: 'Meziobratlové ploténky', en: 'Intervertebral discs' },
  sternum: { cs: 'Hrudní kost', en: 'Sternum' },
  ribs: { cs: 'Žebra', en: 'Ribs' },
  cartilage: { cs: 'Žeberní chrupavky', en: 'Costal cartilages' },
  shoulder: { cs: 'Pletenec horní končetiny', en: 'Shoulder girdle' },
  arm: { cs: 'Paže a předloktí', en: 'Arm and forearm' },
  carpus: { cs: 'Zápěstní kůstky', en: 'Carpal bones' },
  metacarpus: { cs: 'Záprstní kosti', en: 'Metacarpal bones' },
  fingers: { cs: 'Články prstů ruky', en: 'Phalanges of the hand' },
  pelvis: { cs: 'Pánev', en: 'Pelvis' },
  leg: { cs: 'Stehno a bérec', en: 'Thigh and leg' },
  tarsus: { cs: 'Zánártní kosti', en: 'Tarsal bones' },
  metatarsus: { cs: 'Nártní kosti', en: 'Metatarsal bones' },
  toes: { cs: 'Články prstů nohy', en: 'Phalanges of the foot' },
};

export const REGIONS = [
  { key: 'skeleton', cs: 'Celá kostra', en: 'Whole skeleton', icon: '🦴', sided: false },
  { key: 'skull', cs: 'Lebka', en: 'Skull', icon: '💀', sided: false },
  { key: 'spine', cs: 'Páteř', en: 'Spine', icon: '🧬', sided: false },
  { key: 'thorax', cs: 'Hrudník', en: 'Thorax', icon: '🫁', sided: false },
  { key: 'upperLimb', cs: 'Horní končetina', en: 'Upper limb', icon: '💪', sided: true },
  { key: 'hand', cs: 'Ruka', en: 'Hand', icon: '✋', sided: true },
  { key: 'pelvis', cs: 'Pánev', en: 'Pelvis', icon: '🦋', sided: false },
  { key: 'lowerLimb', cs: 'Dolní končetina', en: 'Lower limb', icon: '🦵', sided: true },
  { key: 'foot', cs: 'Noha (chodidlo)', en: 'Foot', icon: '🦶', sided: true },
];

// Které skupiny patří do které oblasti
const GROUP_REGIONS = {
  neuro: ['skull'],
  viscero: ['skull'],
  teeth: ['skull'],
  cervical: ['spine'],
  thoracicV: ['spine', 'thorax'],
  lumbar: ['spine'],
  sacral: ['spine', 'pelvis'],
  discs: ['spine'],
  sternum: ['thorax'],
  ribs: ['thorax'],
  cartilage: ['thorax'],
  shoulder: ['upperLimb'],
  arm: ['upperLimb'],
  carpus: ['upperLimb', 'hand'],
  metacarpus: ['upperLimb', 'hand'],
  fingers: ['upperLimb', 'hand'],
  pelvis: ['pelvis', 'lowerLimb'],
  leg: ['lowerLimb'],
  tarsus: ['lowerLimb', 'foot'],
  metatarsus: ['lowerLimb', 'foot'],
  toes: ['lowerLimb', 'foot'],
};

const ORD_CS = ['', 'první', 'druhý', 'třetí', 'čtvrtý', 'pátý', 'šestý', 'sedmý', 'osmý', 'devátý', 'desátý', 'jedenáctý', 'dvanáctý'];
const ORD_CS_F = ORD_CS.map((s) => s.replace(/ý$/, 'á'));
const ORD_CS_N = ORD_CS.map((s) => s.replace(/ý$/, 'é'));
const ORD_EN = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const ORD_LA_F = ['', 'prima', 'secunda', 'tertia', 'quarta', 'quinta', 'sexta', 'septima', 'octava', 'nona', 'decima', 'undecima', 'duodecima'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const entries = [];

/**
 * @param {string} group
 * @param {object} n  { cs, csG, en, la, laG, alt?: {cs,en,la}, kind? }
 * @param {object} ids  { R, L } nebo { C } (nepárová)
 */
function add(group, n, ids) {
  const kind = n.kind || 'bone';
  for (const [side, id] of Object.entries(ids)) {
    entries.push({
      id,
      side: side === 'C' ? null : side,
      group,
      kind,
      regions: ['skeleton', ...GROUP_REGIONS[group]],
      base: { cs: n.cs, en: n.en, la: n.la },
      gender: { cs: n.csG || 'f', la: n.laG || 'n' },
      alt: { cs: n.alt?.cs || [], en: n.alt?.en || [], la: n.alt?.la || [] },
      info: n.info || null,
    });
  }
}

/** Název včetně strany v daném jazyce. */
export function fullName(e, lang) {
  const b = e.base[lang];
  if (!b) return null;
  if (!e.side) return b;
  if (lang === 'en') return `${SIDE.en[e.side]} ${b}`;
  if (lang === 'cs') return `${SIDE.cs[e.side][e.gender.cs]} ${b}`;
  if (lang === 'la') return `${b} ${SIDE.la[e.side][e.gender.la]}`;
  return b;
}

export function sideLabel(e, lang) {
  if (!e.side) return null;
  return { cs: { R: 'pravá strana', L: 'levá strana' }, en: { R: 'right side', L: 'left side' } }[lang][e.side];
}

// ---------------------------------------------------------------- LEBKA
add('neuro', { cs: 'kost čelní', en: 'frontal bone', la: 'os frontale', alt: { cs: ['čelní kost'] } }, { C: 'FMA52734' });
add('neuro', { cs: 'kost temenní', en: 'parietal bone', la: 'os parietale', alt: { cs: ['temenní kost'] } }, { R: 'FMA52788', L: 'FMA52789' });
add('neuro', { cs: 'kost týlní', en: 'occipital bone', la: 'os occipitale', alt: { cs: ['týlní kost'] } }, { C: 'FMA52735' });
add('neuro', { cs: 'kost spánková', en: 'temporal bone', la: 'os temporale', alt: { cs: ['spánková kost'] } }, { R: 'FMA52738', L: 'FMA52739' });
add('neuro', { cs: 'kost klínová', en: 'sphenoid bone', la: 'os sphenoidale', alt: { cs: ['klínová kost'], en: ['sphenoid'] } }, { C: 'FMA52736' });
add('neuro', { cs: 'kost čichová', en: 'ethmoid bone', la: 'os ethmoidale', alt: { cs: ['čichová kost'], en: ['ethmoid'] } }, { C: 'FMA52740' });

add('viscero', { cs: 'horní čelist', en: 'maxilla', la: 'maxilla', laG: 'f', alt: { cs: ['čelist horní', 'maxila'] } }, { R: 'FMA53649', L: 'FMA53650' });
add('viscero', { cs: 'dolní čelist', en: 'mandible', la: 'mandibula', laG: 'f', alt: { cs: ['čelist dolní', 'mandibula'] } }, { C: 'FMA52748' });
add('viscero', { cs: 'kost lícní', en: 'zygomatic bone', la: 'os zygomaticum', alt: { cs: ['lícní kost'], en: ['cheekbone'] } }, { R: 'FMA52892', L: 'FMA52893' });
add('viscero', { cs: 'kost nosní', en: 'nasal bone', la: 'os nasale', alt: { cs: ['nosní kost'] } }, { R: 'FMA53647', L: 'FMA53648' });
add('viscero', { cs: 'kost slzní', en: 'lacrimal bone', la: 'os lacrimale', alt: { cs: ['slzní kost'] } }, { R: 'FMA53645', L: 'FMA53646' });
add('viscero', { cs: 'kost patrová', en: 'palatine bone', la: 'os palatinum', alt: { cs: ['patrová kost'] } }, { R: 'FMA53655', L: 'FMA53656' });
add('viscero', { cs: 'kost radličná', en: 'vomer', la: 'vomer', laG: 'm', alt: { cs: ['radličná kost', 'radlička'] } }, { C: 'FMA9710' });
add('viscero', { cs: 'dolní skořepa nosní', en: 'inferior nasal concha', la: 'concha nasalis inferior', laG: 'f', alt: { cs: ['skořepa nosní dolní'] } }, { R: 'FMA54737', L: 'FMA54738' });
add('viscero', { cs: 'jazylka', en: 'hyoid bone', la: 'os hyoideum', alt: { en: ['hyoid'], cs: ['kost jazylková'] } }, { C: 'FMA52749' });

// ---------------------------------------------------------------- ZUBY (stálé, bez třetích stoliček)
{
  const types = [
    { cs: 'střední řezák', csG: 'm', en: 'central incisor', la: 'dens incisivus medialis', alt: { cs: ['vnitřní řezák'] } },
    { cs: 'postranní řezák', csG: 'm', en: 'lateral incisor', la: 'dens incisivus lateralis', alt: { cs: ['boční řezák', 'zevní řezák'] } },
    { cs: 'špičák', csG: 'm', en: 'canine', la: 'dens caninus', alt: { en: ['canine tooth'] } },
    { cs: 'první třenový zub', csG: 'm', en: 'first premolar', la: 'dens premolaris primus', alt: { cs: ['první premolár'], la: ['dens praemolaris primus'] } },
    { cs: 'druhý třenový zub', csG: 'm', en: 'second premolar', la: 'dens premolaris secundus', alt: { cs: ['druhý premolár'], la: ['dens praemolaris secundus'] } },
    { cs: 'první stolička', csG: 'f', en: 'first molar', la: 'dens molaris primus', alt: { cs: ['první molár'] } },
    { cs: 'druhá stolička', csG: 'f', en: 'second molar', la: 'dens molaris secundus', alt: { cs: ['druhý molár'] } },
  ];
  const ids = {
    upper: { L: ['FMA55682', 'FMA55683', 'FMA55799', 'FMA55690', 'FMA55691', 'FMA55699', 'FMA55700'], R: ['FMA55681', 'FMA55680', 'FMA55798', 'FMA55689', 'FMA55688', 'FMA55698', 'FMA55697'] },
    lower: { L: ['FMA57143', 'FMA57141', 'FMA55687', 'FMA55693', 'FMA55692', 'FMA55704', 'FMA55703'], R: ['FMA57142', 'FMA57140', 'FMA55686', 'FMA55694', 'FMA55695', 'FMA55705', 'FMA55706'] },
  };
  for (const jaw of ['upper', 'lower']) {
    const csJ = jaw === 'upper' ? 'horní' : 'dolní';
    const enJ = jaw === 'upper' ? 'upper' : 'lower';
    const laJ = jaw === 'upper' ? 'superior' : 'inferior';
    types.forEach((t, i) => {
      add(
        'teeth',
        {
          kind: 'tooth',
          cs: `${csJ} ${t.cs}`,
          csG: t.csG,
          en: `${enJ} ${t.en}`,
          la: `${t.la} ${laJ}`,
          laG: 'm',
          alt: {
            cs: [`${t.cs} ${csJ}`, ...(t.alt?.cs || []).map((a) => `${csJ} ${a}`)],
            en: (t.alt?.en || []).map((a) => `${enJ} ${a}`),
            la: (t.alt?.la || []).map((a) => `${a} ${laJ}`),
          },
        },
        { R: ids[jaw].R[i], L: ids[jaw].L[i] },
      );
    });
  }
}

// ---------------------------------------------------------------- PÁTEŘ
add('cervical', { cs: 'nosič', csG: 'm', en: 'atlas', la: 'atlas', laG: 'm', alt: { cs: ['atlas', 'první krční obratel', '1. krční obratel', 'c1'], en: ['first cervical vertebra', 'c1'], la: ['vertebra cervicalis i', 'vertebra cervicalis prima'] }, info: 'C1' }, { C: 'FMA12519' });
add('cervical', { cs: 'čepovec', csG: 'm', en: 'axis', la: 'axis', laG: 'm', alt: { cs: ['axis', 'druhý krční obratel', '2. krční obratel', 'c2'], en: ['second cervical vertebra', 'c2'], la: ['vertebra cervicalis ii', 'vertebra cervicalis secunda'] }, info: 'C2' }, { C: 'FMA12520' });

function vertebrae(group, csAdj, enAdj, laAdj, letter, ids, start = 1) {
  ids.forEach((id, i) => {
    const k = i + start;
    const extra = {};
    if (letter === 'C' && k === 7) extra.la = ['vertebra prominens'];
    if (letter === 'C' && k === 7) extra.cs = ['vyčnívající obratel'];
    add(group, {
      cs: `${ORD_CS[k]} ${csAdj} obratel`,
      csG: 'm',
      en: `${ORD_EN[k]} ${enAdj} vertebra`,
      la: `vertebra ${laAdj} ${ROMAN[k]}`,
      laG: 'f',
      info: `${letter}${k}`,
      alt: {
        cs: [`${k}. ${csAdj} obratel`, `${letter}${k}`, `obratel ${letter}${k}`, ...(extra.cs || [])],
        en: [`${letter}${k}`, `${letter}${k} vertebra`],
        la: [`vertebra ${laAdj} ${ORD_LA_F[k]}`, ...(extra.la || [])],
      },
    }, { C: id });
  });
}
vertebrae('cervical', 'krční', 'cervical', 'cervicalis', 'C', ['FMA12521', 'FMA12522', 'FMA12523', 'FMA12524', 'FMA12525'], 3);
vertebrae('thoracicV', 'hrudní', 'thoracic', 'thoracica', 'T', ['FMA9165', 'FMA9187', 'FMA9209', 'FMA9248', 'FMA9922', 'FMA9945', 'FMA9968', 'FMA9991', 'FMA10014', 'FMA10037', 'FMA10059', 'FMA10081']);
vertebrae('lumbar', 'bederní', 'lumbar', 'lumbalis', 'L', ['FMA13072', 'FMA13073', 'FMA13074', 'FMA13075', 'FMA13076']);
add('sacral', { cs: 'kost křížová', en: 'sacrum', la: 'os sacrum', alt: { cs: ['křížová kost'], la: ['sacrum'] } }, { C: 'FMA16202' });

{
  const segs = [
    ['C2', 'C3', 'FMA25058'], ['C3', 'C4', 'FMA13896'], ['C4', 'C5', 'FMA13897'], ['C5', 'C6', 'FMA13898'], ['C6', 'C7', 'FMA13899'], ['C7', 'T1', 'FMA13900'],
    ['T1', 'T2', 'FMA10458'], ['T2', 'T3', 'FMA13495'], ['T3', 'T4', 'FMA13500'], ['T4', 'T5', 'FMA13501'], ['T5', 'T6', 'FMA13502'], ['T6', 'T7', 'FMA13503'],
    ['T7', 'T8', 'FMA13504'], ['T8', 'T9', 'FMA13505'], ['T9', 'T10', 'FMA13506'], ['T10', 'T11', 'FMA13507'], ['T11', 'T12', 'FMA13508'], ['T12', 'L1', 'FMA13509'],
    ['L1', 'L2', 'FMA16033'], ['L2', 'L3', 'FMA16034'], ['L3', 'L4', 'FMA16035'], ['L4', 'L5', 'FMA16036'], ['L5', 'S1', 'FMA16037'],
  ];
  for (const [a, b, id] of segs) {
    add('discs', {
      kind: 'disc',
      cs: `meziobratlová ploténka ${a}/${b}`,
      csG: 'f',
      en: `intervertebral disc ${a}/${b}`,
      la: `discus intervertebralis ${a}/${b}`,
      laG: 'm',
      alt: { cs: ['meziobratlová ploténka', 'meziobratlová destička'], en: ['intervertebral disc', 'intervertebral disk'], la: ['discus intervertebralis'] },
    }, { C: id });
  }
}

// ---------------------------------------------------------------- HRUDNÍK
add('sternum', { cs: 'rukověť hrudní kosti', csG: 'f', en: 'manubrium of sternum', la: 'manubrium sterni', alt: { cs: ['rukověť sterna'], en: ['manubrium'] } }, { C: 'FMA7486' });
add('sternum', { cs: 'tělo hrudní kosti', csG: 'n', en: 'body of sternum', la: 'corpus sterni', alt: { cs: ['tělo sterna'] } }, { C: 'FMA7487' });
add('sternum', { cs: 'mečovitý výběžek', csG: 'm', en: 'xiphoid process', la: 'processus xiphoideus', laG: 'm', alt: { cs: ['mečovitý výběžek hrudní kosti'] } }, { C: 'FMA7488' });

{
  const R = ['FMA7857', 'FMA7882', 'FMA7909', 'FMA7957', 'FMA8066', 'FMA8175', 'FMA8229', 'FMA8283', 'FMA8364', 'FMA8445', 'FMA8531', 'FMA8533'];
  const L = ['FMA7987', 'FMA8012', 'FMA8039', 'FMA8148', 'FMA8093', 'FMA8202', 'FMA8256', 'FMA8310', 'FMA8391', 'FMA8472', 'FMA8532', 'FMA8534'];
  for (let k = 1; k <= 12; k++) {
    const kindCs = k <= 7 ? 'pravé žebro (costa vera)' : k <= 10 ? 'nepravé žebro (costa spuria)' : 'volné žebro (costa fluctuans)';
    add('ribs', {
      cs: `${ORD_CS_N[k]} žebro`,
      csG: 'n',
      en: `${ORD_EN[k]} rib`,
      la: `costa ${ROMAN[k]}`,
      laG: 'f',
      info: kindCs,
      alt: { cs: [`${k}. žebro`, `žebro ${k}`], en: [`rib ${k}`, `${k}. rib`], la: [`costa ${ORD_LA_F[k]}`] },
    }, { R: R[k - 1], L: L[k - 1] });
  }
  const cR = ['FMA7875', 'FMA7886', 'FMA7913', 'FMA7976', 'FMA8070', 'FMA8194', 'FMA8248'];
  const cL = ['FMA8005', 'FMA8031', 'FMA8058', 'FMA8167', 'FMA8112', 'FMA8221', 'FMA8275'];
  for (let k = 1; k <= 7; k++) {
    add('cartilage', {
      kind: 'cartilage',
      cs: `žeberní chrupavka ${k}. žebra`,
      csG: 'f',
      en: `${ORD_EN[k]} costal cartilage`,
      la: `cartilago costalis ${ROMAN[k]}`,
      laG: 'f',
      alt: { cs: ['žeberní chrupavka'], en: ['costal cartilage'], la: ['cartilago costalis'] },
    }, { R: cR[k - 1], L: cL[k - 1] });
  }
  add('cartilage', {
    kind: 'cartilage',
    cs: 'žeberní chrupavky 8.–10. žebra',
    csG: 'f',
    en: 'costal cartilages 8–10',
    la: 'cartilagines costales VIII–X',
    laG: 'f',
    alt: { cs: ['žeberní chrupavky', 'žeberní oblouk'], en: ['costal cartilages', 'costal margin'], la: ['cartilagines costales', 'arcus costalis'] },
  }, { R: 'BP28', L: 'BP24' });
}

// ---------------------------------------------------------------- HORNÍ KONČETINA
add('shoulder', { cs: 'klíční kost', en: 'clavicle', la: 'clavicula', laG: 'f', alt: { cs: ['kost klíční'], en: ['collarbone', 'collar bone'] } }, { R: 'FMA13322', L: 'FMA13323' });
add('shoulder', { cs: 'lopatka', en: 'scapula', la: 'scapula', laG: 'f', alt: { en: ['shoulder blade'] } }, { R: 'FMA13395', L: 'FMA13396' });
add('arm', { cs: 'kost pažní', en: 'humerus', la: 'humerus', laG: 'm', alt: { cs: ['pažní kost'] } }, { R: 'FMA23130', L: 'FMA23131' });
add('arm', { cs: 'kost vřetenní', en: 'radius', la: 'radius', laG: 'm', alt: { cs: ['vřetenní kost'] } }, { R: 'FMA23464', L: 'FMA23465' });
add('arm', { cs: 'kost loketní', en: 'ulna', la: 'ulna', laG: 'f', alt: { cs: ['loketní kost'] } }, { R: 'FMA23467', L: 'FMA23468' });

add('carpus', { cs: 'kost člunková', en: 'scaphoid', la: 'os scaphoideum', alt: { cs: ['člunková kost'], en: ['scaphoid bone'] } }, { R: 'FMA24435', L: 'FMA24436' });
add('carpus', { cs: 'kost poloměsíčitá', en: 'lunate', la: 'os lunatum', alt: { cs: ['poloměsíčitá kost'], en: ['lunate bone'] } }, { R: 'FMA24437', L: 'FMA24438' });
add('carpus', { cs: 'kost trojhranná', en: 'triquetrum', la: 'os triquetrum', alt: { cs: ['trojhranná kost'], en: ['triquetral', 'triquetral bone'] } }, { R: 'FMA24439', L: 'FMA24440' });
add('carpus', { cs: 'kost hrášková', en: 'pisiform', la: 'os pisiforme', alt: { cs: ['hrášková kost'], en: ['pisiform bone'] } }, { R: 'FMA24441', L: 'FMA24442' });
add('carpus', { cs: 'kost mnohohranná větší', en: 'trapezium', la: 'os trapezium', alt: { cs: ['větší mnohohranná kost', 'mnohohranná kost větší'], en: ['trapezium bone'] } }, { R: 'FMA24443', L: 'FMA24444' });
add('carpus', { cs: 'kost mnohohranná menší', en: 'trapezoid', la: 'os trapezoideum', alt: { cs: ['menší mnohohranná kost', 'mnohohranná kost menší'], en: ['trapezoid bone'] } }, { R: 'FMA23725', L: 'FMA24445' });
add('carpus', { cs: 'kost hlavatá', en: 'capitate', la: 'os capitatum', alt: { cs: ['hlavatá kost'], en: ['capitate bone'] } }, { R: 'FMA24446', L: 'FMA24447' });
add('carpus', { cs: 'kost hákovitá', en: 'hamate', la: 'os hamatum', alt: { cs: ['hákovitá kost'], en: ['hamate bone'] } }, { R: 'FMA24448', L: 'FMA24449' });

{
  const R = ['FMA24464', 'FMA24466', 'FMA24468', 'FMA24470', 'FMA24472'];
  const L = ['FMA24465', 'FMA24467', 'FMA24469', 'FMA24471', 'FMA24473'];
  for (let k = 1; k <= 5; k++) {
    add('metacarpus', {
      cs: `${ORD_CS_F[k]} záprstní kost`,
      en: `${ORD_EN[k]} metacarpal bone`,
      la: `os metacarpi ${ROMAN[k]}`,
      alt: { cs: [`${k}. záprstní kost`, `záprstní kost ${k}`], en: [`${ORD_EN[k]} metacarpal`, `metacarpal ${k}`], la: [`os metacarpale ${ROMAN[k]}`] },
    }, { R: R[k - 1], L: L[k - 1] });
  }
}

// Články prstů – ruka i noha
const PH = {
  proximal: { cs: 'proximální článek', csAlt: 'základní článek', en: 'proximal phalanx', la: 'phalanx proximalis' },
  middle: { cs: 'střední článek', csAlt: 'prostřední článek', en: 'middle phalanx', la: 'phalanx media' },
  distal: { cs: 'distální článek', csAlt: 'koncový článek', en: 'distal phalanx', la: 'phalanx distalis' },
};
function phalanx(group, type, digit, ids) {
  const p = PH[type];
  const csAlt = [`${p.csAlt} ${digit.cs}`, ...(digit.csAlt || []).flatMap((d) => [`${p.cs} ${d}`, `${p.csAlt} ${d}`])];
  add(group, {
    cs: `${p.cs} ${digit.cs}`,
    csG: 'm',
    en: `${p.en} of ${digit.en}`,
    la: `${p.la} ${digit.la}`,
    laG: 'f',
    alt: {
      cs: csAlt,
      en: (digit.enAlt || []).map((d) => `${p.en} of ${d}`),
      la: (digit.laAlt || []).map((d) => `${p.la} ${d}`),
    },
  }, ids);
}

{
  const fingers = [
    { cs: 'palce ruky', csAlt: ['palce', '1. prstu ruky'], en: 'thumb', enAlt: ['first finger'], la: 'pollicis', laAlt: ['digiti i manus'] },
    { cs: 'ukazováku', csAlt: ['2. prstu ruky'], en: 'index finger', enAlt: ['second finger'], la: 'digiti II manus', laAlt: ['indicis'] },
    { cs: 'prostředníku', csAlt: ['3. prstu ruky'], en: 'middle finger', enAlt: ['third finger'], la: 'digiti III manus', laAlt: ['digiti medii'] },
    { cs: 'prsteníku', csAlt: ['4. prstu ruky'], en: 'ring finger', enAlt: ['fourth finger'], la: 'digiti IV manus', laAlt: ['digiti anularis'] },
    { cs: 'malíku ruky', csAlt: ['malíku', '5. prstu ruky'], en: 'little finger', enAlt: ['fifth finger', 'pinky'], la: 'digiti V manus', laAlt: ['digiti minimi manus'] },
  ];
  const prox = { R: ['FMA24450', 'FMA24451', 'FMA24452', 'FMA24453', 'FMA24454'], L: ['FMA65470', 'FMA71915', 'FMA71908', 'FMA71916', 'FMA66791'] };
  const mid = { R: [null, 'FMA24455', 'FMA24456', 'FMA24457', 'FMA24458'], L: [null, 'FMA23938', 'FMA23940', 'FMA23942', 'FMA23944'] };
  const dist = { R: ['FMA24459', 'FMA24460', 'FMA24461', 'FMA24462', 'FMA24463'], L: ['FMA23951', 'FMA23953', 'FMA23955', 'FMA23957', 'FMA23959'] };
  fingers.forEach((f, i) => {
    phalanx('fingers', 'proximal', f, { R: prox.R[i], L: prox.L[i] });
    if (mid.R[i]) phalanx('fingers', 'middle', f, { R: mid.R[i], L: mid.L[i] });
    phalanx('fingers', 'distal', f, { R: dist.R[i], L: dist.L[i] });
  });
}

// ---------------------------------------------------------------- DOLNÍ KONČETINA
add('pelvis', { cs: 'kost pánevní', en: 'hip bone', la: 'os coxae', alt: { cs: ['pánevní kost', 'kost kyčelní'], en: ['coxal bone', 'innominate bone', 'pelvic bone'] }, info: 'os ilium + os ischii + os pubis' }, { R: 'FMA16586', L: 'FMA16587' });
add('leg', { cs: 'kost stehenní', en: 'femur', la: 'femur', laG: 'n', alt: { cs: ['stehenní kost'], en: ['thigh bone', 'thighbone'] } }, { R: 'FMA24474', L: 'FMA24475' });
add('leg', { cs: 'čéška', en: 'patella', la: 'patella', laG: 'f', alt: { en: ['kneecap', 'knee cap'] } }, { R: 'FMA24486', L: 'FMA24487' });
add('leg', { cs: 'kost holenní', en: 'tibia', la: 'tibia', laG: 'f', alt: { cs: ['holenní kost'], en: ['shinbone', 'shin bone'] } }, { R: 'FMA24477', L: 'FMA24478' });
add('leg', { cs: 'kost lýtková', en: 'fibula', la: 'fibula', laG: 'f', alt: { cs: ['lýtková kost'] } }, { R: 'FMA24480', L: 'FMA24481' });

add('tarsus', { cs: 'kost hlezenní', en: 'talus', la: 'talus', laG: 'm', alt: { cs: ['hlezenní kost', 'hlezno'], en: ['ankle bone', 'astragalus'] } }, { R: 'FMA24482', L: 'FMA24483' });
add('tarsus', { cs: 'kost patní', en: 'calcaneus', la: 'calcaneus', laG: 'm', alt: { cs: ['patní kost'], en: ['heel bone'] } }, { R: 'FMA24497', L: 'FMA24498' });
add('tarsus', { cs: 'kost loďkovitá', en: 'navicular bone', la: 'os naviculare', alt: { cs: ['loďkovitá kost', 'kost člunkovitá'], en: ['navicular'] } }, { R: 'FMA24500', L: 'FMA24501' });
add('tarsus', { cs: 'kost krychlová', en: 'cuboid bone', la: 'os cuboideum', alt: { cs: ['krychlová kost'], en: ['cuboid'] } }, { R: 'FMA24528', L: 'FMA24529' });
add('tarsus', { cs: 'kost klínovitá vnitřní', en: 'medial cuneiform bone', la: 'os cuneiforme mediale', alt: { cs: ['vnitřní klínovitá kost', 'mediální klínovitá kost', 'kost klínovitá mediální'], en: ['medial cuneiform'] } }, { R: 'FMA24521', L: 'FMA24522' });
add('tarsus', { cs: 'kost klínovitá střední', en: 'intermediate cuneiform bone', la: 'os cuneiforme intermedium', alt: { cs: ['střední klínovitá kost', 'kost klínovitá prostřední'], en: ['intermediate cuneiform', 'middle cuneiform'] } }, { R: 'FMA24523', L: 'FMA24524' });
add('tarsus', { cs: 'kost klínovitá zevní', en: 'lateral cuneiform bone', la: 'os cuneiforme laterale', alt: { cs: ['zevní klínovitá kost', 'laterální klínovitá kost', 'kost klínovitá laterální'], en: ['lateral cuneiform'] } }, { R: 'FMA24525', L: 'FMA24526' });

{
  const R = ['FMA24507', 'FMA24509', 'FMA24511', 'FMA24513', 'FMA24515'];
  const L = ['FMA24508', 'FMA24510', 'FMA24512', 'FMA24514', 'FMA24516'];
  for (let k = 1; k <= 5; k++) {
    add('metatarsus', {
      cs: `${ORD_CS_F[k]} nártní kost`,
      en: `${ORD_EN[k]} metatarsal bone`,
      la: `os metatarsi ${ROMAN[k]}`,
      alt: { cs: [`${k}. nártní kost`, `nártní kost ${k}`], en: [`${ORD_EN[k]} metatarsal`, `metatarsal ${k}`], la: [`os metatarsale ${ROMAN[k]}`] },
    }, { R: R[k - 1], L: L[k - 1] });
  }
}

{
  const toes = [
    { cs: 'palce nohy', csAlt: ['1. prstu nohy', 'palce'], en: 'great toe', enAlt: ['big toe', 'first toe', 'hallux'], la: 'hallucis', laAlt: ['digiti i pedis'] },
    { cs: '2. prstu nohy', csAlt: ['druhého prstu nohy', 'druhého prstu'], en: 'second toe', la: 'digiti II pedis' },
    { cs: '3. prstu nohy', csAlt: ['třetího prstu nohy', 'třetího prstu'], en: 'third toe', la: 'digiti III pedis' },
    { cs: '4. prstu nohy', csAlt: ['čtvrtého prstu nohy', 'čtvrtého prstu'], en: 'fourth toe', la: 'digiti IV pedis' },
    { cs: 'malíku nohy', csAlt: ['5. prstu nohy', 'pátého prstu nohy', 'malíku'], en: 'little toe', enAlt: ['fifth toe'], la: 'digiti V pedis', laAlt: ['digiti minimi pedis'] },
  ];
  const prox = { R: ['FMA43253', 'FMA32634', 'FMA32636', 'FMA32638', 'FMA32640'], L: ['FMA43254', 'FMA32635', 'FMA32637', 'FMA32639', 'FMA32641'] };
  const mid = { R: [null, 'FMA32642', 'FMA32644', 'FMA32646', 'FMA230986'], L: [null, 'FMA32643', 'FMA32645', 'FMA32647', 'FMA230988'] };
  const dist = { R: ['FMA32650', 'FMA32652', 'FMA32654', 'FMA32656', 'FMA32658'], L: ['FMA32651', 'FMA32653', 'FMA32655', 'FMA32657', 'FMA32659'] };
  toes.forEach((t, i) => {
    phalanx('toes', 'proximal', t, { R: prox.R[i], L: prox.L[i] });
    if (mid.R[i]) phalanx('toes', 'middle', t, { R: mid.R[i], L: mid.L[i] });
    phalanx('toes', 'distal', t, { R: dist.R[i], L: dist.L[i] });
  });
}
add('toes', { cs: 'sezamská kost nohy', en: 'sesamoid bone of foot', la: 'os sesamoideum pedis', alt: { cs: ['sezamská kost'], en: ['sesamoid bone', 'sesamoid'], la: ['os sesamoideum'] } }, { R: 'FMA45097', L: 'FMA45098' });

export const CATALOG = entries;
export const BY_ID = Object.fromEntries(entries.map((e) => [e.id, e]));

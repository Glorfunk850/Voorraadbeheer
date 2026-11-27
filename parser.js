// Recepttekst omzetten naar een gestructureerd recept, en ingrediënten koppelen aan de voorraad.
// Alles gebeurt in de browser; er wordt niets verstuurd.

const BREUKEN = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅕': 0.2 };
const TELWOORDEN = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  twaalf: 12, 'een halve': 0.5, 'een half': 0.5, 'een hele': 1, half: 0.5, halve: 0.5, anderhalf: 1.5, anderhalve: 1.5, paar: 2,
};

// Eenheid -> alle schrijfwijzen
const EENHEDEN = {
  g: ['g', 'gr', 'gram', 'grammen', 'grs'],
  kg: ['kg', 'kilo', 'kilogram', "kilo's"],
  ml: ['ml', 'milliliter'],
  cl: ['cl', 'centiliter'],
  dl: ['dl', 'deciliter'],
  l: ['l', 'liter', 'ltr', 'liters'],
  el: ['el', 'eetlepel', 'eetlepels', 'eetl', 'tbsp', 'tbs'],
  tl: ['tl', 'theelepel', 'theelepels', 'thl', 'theel', 'tsp'],
  snuf: ['snuf', 'snufje', 'snuifje', 'snuif', 'mespunt', 'mespuntje', 'snufjes'],
  teen: ['teen', 'teentje', 'teentjes', 'tenen'],
  blik: ['blik', 'blikje', 'blikjes', 'blikken'],
  pak: ['pak', 'pakje', 'pakjes', 'pakken'],
  zak: ['zak', 'zakje', 'zakjes', 'zakken'],
  pot: ['pot', 'potje', 'potjes', 'potten'],
  fles: ['fles', 'flesje', 'flessen'],
  takje: ['takje', 'takjes', 'tak', 'takken'],
  bos: ['bos', 'bosje', 'bosjes'],
  kopje: ['kop', 'kopje', 'kopjes', 'kopjes', 'cup', 'cups'],
  plak: ['plak', 'plakje', 'plakjes', 'plakken', 'sneetje', 'sneetjes', 'snee'],
  scheut: ['scheut', 'scheutje', 'scheutjes'],
  handvol: ['handvol', 'handje', 'handjevol'],
  blad: ['blad', 'blaadje', 'blaadjes', 'bladeren'],
  stuks: ['st', 'stuk', 'stuks'],
};
const EENHEID_VAN = {};
for (const [eenheid, vormen] of Object.entries(EENHEDEN)) for (const v of vormen) EENHEID_VAN[v] = eenheid;
// Zelf toegevoegde eenheden (Instellingen → Eenheden), bv. bokaal of tube: ook herkennen in "2 bokaal augurken".
let EIGEN = {};
/** Eigen eenheden doorgeven (enkelvoud); gewone meervouden worden ook herkend: bokalen, tubes, rollen, potjes … */
export function eigenEenhedenZetten(lijst) {
  EIGEN = {};
  for (const e of Array.isArray(lijst) ? lijst : []) {
    const w = String(e || '').toLowerCase().trim();
    if (!w || EENHEID_VAN[w]) continue;
    const vormen = [w, w + 's', w + "'s", w + 'n', w + 'en', w + w.slice(-1) + 'en', w + 'je', w + 'jes'];
    const kort = w.match(/^(.*)([aeou])\2([^aeiou])$/); // bokaal -> bokalen, tafereel -> taferelen
    if (kort) vormen.push(kort[1] + kort[2] + kort[3] + 'en');
    for (const v of vormen) if (!EENHEID_VAN[v] && !EIGEN[v]) EIGEN[v] = w;
  }
}
const eenheidVan = (w) => EENHEID_VAN[w] || EIGEN[w];

// Kopje: alleen het woord, eventueel gevolgd door ":", "(…)" of "voor 4 personen" — niet een zin die met "ingrediënten" begint.
const KOP_INGREDIENTEN = /^(ingredi[eëé]nten|benodigdheden|nodig|wat heb je nodig|je hebt nodig|boodschappen(lijst)?|ingredients)\s*(?:[:(-]|voor\b|$)/i;
const KOP_BEREIDING = /^(bereiding(swijze)?|werkwijze|instructies|zo maak je (het|dit)|aan de slag|bereiden|methode|recept|preparation|method|instructions)\s*[:.]?\s*$/i;
const KOP_ANDERS = /^(tip|tips|variatie|serveertip|voedingswaarden?|voeding|nutritionele waarde|bewaren|bewaartip|wijntip|nutri)/i;

function getalUit(tekst) {
  tekst = tekst.trim().toLowerCase();
  if (tekst in TELWOORDEN) return TELWOORDEN[tekst];
  let m = tekst.match(/^(\d+)\s+(\d+)\/(\d+)$/); // 1 1/2
  if (m) return +m[1] + m[2] / m[3];
  m = tekst.match(/^(\d+)\/(\d+)$/);
  if (m) return m[1] / m[2];
  m = tekst.match(/^(\d+)?([½¼¾⅓⅔⅛⅕])$/);
  if (m) return (+m[1] || 0) + BREUKEN[m[2]];
  m = tekst.match(/^(\d+(?:[.,]\d+)?)\s*(?:[-–]|tot|à|a)\s*(\d+(?:[.,]\d+)?)$/); // 2-3, 200 tot 240, 2 à 3: neem de hoogste
  if (m) return parseFloat(m[2].replace(',', '.'));
  m = tekst.match(/^\d+(?:[.,]\d+)?$/);
  if (m) return parseFloat(tekst.replace(',', '.'));
  return null;
}

const GETAL_PATROON = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*[½¼¾⅓⅔⅛⅕]|\d+(?:[.,]\d+)?\s*(?:[-–]|tot\b|à)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?|(?:een halve|een half|een hele|een|één|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|twaalf|halve|half|anderhalve|anderhalf|paar)(?![a-zà-ÿ]))`;
// (telwoorden alleen als los woord: "zeste" is geen "zes te")

/** Eén ingrediëntregel ontleden: "250 g bloem" -> {hoeveelheid: 250, eenheid: 'g', naam: 'bloem'} */
export function ingredientOntleden(regel) {
  let tekst = regel.replace(/^[\s•·*\-–—>□▪◦●]+(?=\S)/, '').replace(/^[oO0]\s+(?=\D)/, '').replace(/\s+/g, ' ').trim();
  // OCR leest de "l" van liter vaak als | of I
  tekst = tekst.replace(/(\d)\s*[|]\s/g, '$1 l ').replace(/(\d)\s*I\s(?=[a-z])/g, '$1 l ');
  const resultaat = { hoeveelheid: null, eenheid: '', naam: tekst };
  const voorop = new RegExp(String.raw`^(${GETAL_PATROON})(?:\s*([a-zA-Z'.]+))?\s*(.*)$`, 'i');
  let m = tekst.match(voorop);
  if (m && m[1]) {
    const hv = getalUit(m[1]);
    if (hv !== null) {
      resultaat.hoeveelheid = hv;
      let rest = m[3];
      const woord = (m[2] || '').toLowerCase().replace(/\.$/, '');
      if (woord && eenheidVan(woord)) resultaat.eenheid = eenheidVan(woord);
      else if (woord) rest = (m[2] + (rest ? ' ' + rest : '')).replace(/\s+([,;:)])/g, '$1');
      resultaat.naam = rest.replace(/^(van de|van het|van|aan)\s+/i, '').trim();
      if (!resultaat.eenheid) resultaat.eenheid = 'stuks';
      return opschonen(resultaat);
    }
  }
  // achteraan: "bloem 250 g" of "bloem (250 g)"
  const achteraan = new RegExp(String.raw`^(.*?)[\s,:(]+(${GETAL_PATROON})\s*([a-zA-Z.]+)?\)?$`, 'i');
  m = tekst.match(achteraan);
  if (m && m[1] && /[a-z]/i.test(m[1])) {
    const hv = getalUit(m[2]);
    const woord = (m[3] || '').toLowerCase().replace(/\.$/, '');
    if (hv !== null && (!woord || eenheidVan(woord))) {
      return opschonen({ hoeveelheid: hv, eenheid: eenheidVan(woord) || 'stuks', naam: m[1].trim() });
    }
  }
  // "snufje zout", "peper en zout"
  const eerste = tekst.split(' ')[0].toLowerCase();
  if (eenheidVan(eerste) && tekst.includes(' ')) {
    return opschonen({ hoeveelheid: 1, eenheid: eenheidVan(eerste), naam: tekst.slice(eerste.length).trim() });
  }
  return opschonen(resultaat);
}

function opschonen(i) {
  i.naam = i.naam.replace(/^[,:;\s]+|[,:;\s]+$/g, '');
  if (i.hoeveelheid !== null) i.hoeveelheid = Math.round(i.hoeveelheid * 1000) / 1000;
  return i;
}

const ONAF = /\b(en|of|met|van|de|het|een|rode|groene|gele|witte|zwarte|verse|grote|kleine|halve|gehakte|geraspte|gerookte|zure|zoete|volle|magere|fijne|grove|extra|vierge|platte|krokante)$/i;

function lijktIngredient(regel) {
  const t = regel.replace(/^[\s•·*\-–—>□▪◦●]+/, '').replace(/^[oO]\s+/, '').trim();
  if (t.length > 90) return false;
  if (new RegExp(String.raw`^${GETAL_PATROON}\s*\S`, 'i').test(t) && !/^\d+[.)]\s/.test(t)) return true;
  return /^[•·*\-–—▪◦●]/.test(regel.trim()) && t.length < 60;
}

/** Volledige recepttekst ontleden. */
export function receptOntleden(ruw) {
  const regels = ruw
    .replace(/\r/g, '')
    .split('\n')
    .map((r) => r.replace(/\s+/g, ' ').trim())
    // witregels blijven staan: in de bereiding scheiden ze de stappen
    .filter((r) => !r || (!/^[\W_]{1,3}$/.test(r) && !/^(pagina|page)\s*\d+/i.test(r)));

  const recept = { titel: '', personen: null, bereidingstijd: '', ingredienten: [], stappen: [], notities: '' };
  let sectie = 'begin';
  const ingrRegels = [];
  const stapRegels = [];
  const overige = [];
  const notities = [];

  for (const regel of regels) {
    if (!regel) { if (sectie === 'stappen') stapRegels.push(''); continue; }
    const zonderDubbelepunt = regel.replace(/[:.]\s*$/, '');
    // aantal personen en bereidingstijd
    const pers = regel.match(/(?:voor\s+)?(\d+)\s*(?:personen|persoon|pers\b\.?|porties|portie|eters)/i)
      || regel.match(/\b(?:aantal personen|portiegrootte|porties|portie|personen|aantal)\s*[:-]?\s*(\d+)\s*(?:p\b\.?|pers\b\.?)?/i);
    if (pers && !recept.personen && regel.length < 70) recept.personen = parseInt(pers[1], 10);
    const tijd = regel.match(/(?:bereidings|kook|oven|totale |totaal |voorbereidings)?tijd\s*[:-]?\s*(.+)/i);
    if (tijd && !recept.bereidingstijd && regel.length < 70 && /\d/.test(tijd[1])) {
      recept.bereidingstijd = tijd[1].replace(/\s*[|·•].*$/, '').trim();
    }
    // ingrediëntenkop, eventueel met tekst erachter ("Ingrediënten voor 4 personen")
    if (KOP_INGREDIENTEN.test(zonderDubbelepunt) && regel.length < 50) { sectie = 'ingredienten'; continue; }
    if ((pers || tijd) && regel.length < 70 && sectie !== 'stappen') continue;

    if (KOP_BEREIDING.test(regel)) { sectie = 'stappen'; continue; }
    if (KOP_ANDERS.test(regel) && regel.length < 40 && !/:\s*\S/.test(regel)) { sectie = 'notities'; continue; }
    // "Tip: lekker met ..." op één regel
    const tip = regel.match(/^(tip|tips|serveertip|bewaartip|wijntip|variatie)\s*[:-]\s*(.+)$/i);
    if (tip) { notities.push(tip[2]); sectie = 'notities'; continue; }

    if (sectie === 'ingredienten') {
      // tussenkopje zoals "Voor de saus:"
      if (/:$/.test(regel) && regel.length < 40 && !/\d/.test(regel)) continue;
      // lange zin zonder hoeveelheid: waarschijnlijk begint de bereiding zonder kopje
      // (een ingrediënt kan lang zijn als de pdf-regels al samengevoegd zijn; een zin eindigt meestal op een punt)
      if (!lijktIngredient(regel) && (regel.length > 90 || (regel.length > 45 && /[.!?]$/.test(regel)))) { sectie = 'stappen'; stapRegels.push(regel); continue; }
      ingrRegels.push(regel);
    } else if (sectie === 'stappen') stapRegels.push(regel);
    else if (sectie === 'notities') notities.push(regel);
    else overige.push(regel);
  }

  // titel: eerste korte regel die geen ingrediënt is
  const titelIndex = overige.findIndex((r) => r.length >= 3 && r.length <= 80 && !lijktIngredient(r));
  if (titelIndex >= 0) {
    recept.titel = overige.splice(titelIndex, 1)[0];
    // titel over twee regels: "Courgettenbrood met roerei en" + "gezonde coleslaw"
    const volgende = overige[titelIndex];
    if (volgende && volgende.length <= 60 && !lijktIngredient(volgende) && (ONAF.test(recept.titel) || /^[a-zà-ÿ]/.test(volgende))) {
      recept.titel += ' ' + overige.splice(titelIndex, 1)[0];
    }
    recept.titel = recept.titel.replace(/[.:]$/, '');
  }

  // geen kopjes gevonden: raden op basis van de vorm van elke regel
  if (!ingrRegels.length && !stapRegels.length) {
    for (const r of overige) (lijktIngredient(r) ? ingrRegels : stapRegels).push(r);
  } else if (!ingrRegels.length) {
    for (const r of overige) if (lijktIngredient(r)) ingrRegels.push(r);
  } else if (!stapRegels.length) {
    for (const r of overige) if (!lijktIngredient(r) && r.length > 25) stapRegels.push(r);
  }

  // ingrediënten: regels die doorlopen (bv. "1 rode" + "paprika") samenvoegen
  // (afgebroken regels in een pdf worden al bij het inlezen samengevoegd, zie layout.js)
  const samengevoegd = [];
  for (const r of ingrRegels) {
    const vorige = samengevoegd[samengevoegd.length - 1];
    // samenvoegen als de vorige regel duidelijk niet af is ("1 rode" + "paprika", "2 el olie," + "gesmolten",
    // "Peper en zout van de" + "molen") of als de lijst duidelijk uit regels met hoeveelheden bestaat
    const onaf = vorige && (/[,\-–(]$/.test(vorige) || ONAF.test(vorige) || !ingredientOntleden(vorige).naam
      || (/\([^)]*$/.test(vorige)));
    // eindigt de vorige regel op een bijvoeglijk naamwoord ("175 g geraspte"), dan mag het vervolg met een hoofdletter beginnen ("Goudse belegen kaas")
    const hoofdletterMag = vorige && /\b(?:geraspte|gerookte|verse|gedroogde|gehakte|halve|hele|rode|groene|gele|witte|zwarte|extra)$/i.test(vorige);
    if (vorige && /^\d+\s*[+%]$/.test(r)) { // "Goudse belegen kaas" + "48+"
      samengevoegd[samengevoegd.length - 1] = vorige + ' ' + r;
    } else if (onaf && (/^[a-zà-ÿ(]/.test(r) || hoofdletterMag) && !lijktIngredient(r) && r.split(' ').length <= 6) {
      samengevoegd[samengevoegd.length - 1] = vorige + ' ' + r;
    } else samengevoegd.push(r);
  }
  recept.ingredienten = samengevoegd.map(ingredientOntleden).filter((i) => i.naam);

  // stappen: nieuwe stap bij nummering of als de vorige regel met een punt eindigde
  // zijn de stappen genummerd, dan begint alleen een nummer een nieuwe stap (een stap kan meerdere zinnen hebben)
  const NUMMER = /^(stap\s*)?\d+\s*[.):-]\s*/i;
  const genummerd = stapRegels.filter((r) => NUMMER.test(r)).length >= 2;
  // niet genummerd maar wel in alinea's (witregel ertussen): elke alinea is één stap
  const inhoud = stapRegels.map((r) => r !== '');
  const alineas = !genummerd && inhoud.some((v, i) => !v && inhoud.slice(0, i).includes(true) && inhoud.slice(i).includes(true));
  const stappen = [];
  let nieuweAlinea = false;
  for (const r of stapRegels) {
    if (!r) { nieuweAlinea = true; continue; }
    if (alineas) {
      const tekst = r.replace(/^[•·*\-–—▪●]\s*/, '');
      if (nieuweAlinea || !stappen.length || /^[•·*\-–—▪●]\s/.test(r)) stappen.push(tekst); else stappen[stappen.length - 1] += ' ' + tekst;
      nieuweAlinea = false;
      continue;
    }
    const nieuw = NUMMER.test(r) || /^[•·*\-–—▪●]\s/.test(r);
    const tekst = r.replace(NUMMER, '').replace(/^[•·*\-–—▪●]\s*/, '');
    const vorige = stappen[stappen.length - 1];
    if (!tekst) continue;
    if (!nieuw && vorige && (genummerd || !/[.!?)]$/.test(vorige))) stappen[stappen.length - 1] = vorige + ' ' + tekst;
    else stappen.push(tekst);
  }
  // afgebroken woorden aan elkaar ("voorver- warmen"), maar niet "boven- en onderwarmte"
  recept.stappen = stappen.map((s) => s.replace(/([a-zà-ÿ])- (?!(?:en|of|tot|als|t\/m)\b)([a-zà-ÿ])/g, '$1$2'));
  // afgebroken notitieregels samenvoegen ("Hoeveelheid per" + "portie", "Totaal Koolhydraten:" + "52g")
  const notitieRegels = [];
  for (const r of notities) {
    const vorige = notitieRegels[notitieRegels.length - 1];
    const vervolg = vorige && ((/^[a-zà-ÿ(]/.test(r) && !r.includes(':')) || (/:$/.test(vorige) && r.length < 20));
    if (vervolg) notitieRegels[notitieRegels.length - 1] = vorige + ' ' + r; else notitieRegels.push(r);
  }
  recept.notities = notitieRegels.join('\n');
  return recept;
}

// ---------------------------------------------------------------------------
// Ingrediënten koppelen aan voorraadproducten
// ---------------------------------------------------------------------------
const ONREGELMATIG = { eieren: 'ei', eiren: 'ei', kippeneieren: 'ei', bonen: 'boon', erwten: 'erwt', uien: 'ui', sjalotten: 'sjalot' };
const BIJWOORDEN = new Set(['vers', 'verse', 'gehakte', 'fijngehakte', 'gesnipperd', 'gesnipperde', 'grote', 'groot', 'kleine', 'klein',
  'middelgrote', 'gesneden', 'geraspte', 'geraspt', 'gedroogde', 'gedroogd', 'biologische', 'bio', 'koude', 'warme', 'zachte', 'gesmolten',
  'naar', 'smaak', 'eventueel', 'evt', 'ca', 'circa', 'ongeveer', 'en', 'of', 'met', 'van', 'de', 'het', 'een', 'in', 'stukjes', 'blokjes',
  'plakjes', 'reepjes', 'fijn', 'grof', 'heel', 'hele', 'gepelde', 'geschilde', 'ontdooide', 'diepvries']);

export function sleutel(woord) {
  let w = woord.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (ONREGELMATIG[w]) return ONREGELMATIG[w];
  if (w.endsWith("'s")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('en')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w.replace(/([aeou])\1/g, '$1').replace(/([^aeiou])\1$/, '$1');
}

export function sleutelwoorden(naam) {
  return (naam || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[,;]/)[0]
    .split(/[^a-zà-ÿ'-]+/i)
    .filter((w) => w.length > 1 && !BIJWOORDEN.has(w))
    .map(sleutel);
}

// Woorden die alleen iets beschrijven (kleur, smaak, bereiding): een gedeeld woord als "rode" maakt
// van "rode paprika" nog geen "rode biet".
const BESCHRIJVEND = new Set(['rode', 'rood', 'groene', 'groen', 'gele', 'geel', 'witte', 'wit', 'zwarte', 'zwart', 'bruine', 'bruin',
  'oranje', 'paarse', 'paars', 'roze', 'blonde', 'zoete', 'zoet', 'zure', 'zuur', 'zoute', 'zout', 'pittige', 'pittig', 'scherpe',
  'milde', 'jonge', 'jong', 'belegen', 'oude', 'halfvolle', 'volle', 'magere', 'gemalen', 'gerookte', 'gerookt', 'gekookte', 'gekookt',
  'gebakken', 'gegrilde', 'gepofte', 'ingelegde', 'zachte', 'harde', 'lichte', 'donkere', 'fijne', 'grove', 'platte', 'krokante']
  .map((w) => sleutel(w)));

// Woorden die van een groente of ander product iets anders maken: "Paprika poeder" is geen paprika,
// "Tomatensaus" geen tomaat. Ook in samenstellingen ("kippenbouillon" bevat "bouillon").
const VORM = ['poeder', 'saus', 'soep', 'sap', 'siroop', 'puree', 'jam', 'pesto', 'ketchup', 'chips', 'kruiden', 'mix', 'olie',
  'azijn', 'extract', 'aroma', 'concentraat', 'bouillon', 'fond', 'dressing', 'spread', 'vlok', 'pasta', 'crem', 'creme'].map((w) => sleutel(w));
const vormen = (woorden) => VORM.filter((v) => woorden.some((w) => w === v || (w.length > v.length + 2 && w.endsWith(v))));

/** Zoek het best passende voorraadproduct (naam) voor een ingrediënt. */
export function zoekVoorraadnaam(ingredientNaam, productnamen, geleerd = {}) {
  const eigen = sleutelwoorden(ingredientNaam).join(' ');
  if (!eigen) return '';
  if (geleerd[eigen] && productnamen.some((n) => n.toLowerCase() === geleerd[eigen].toLowerCase())) return geleerd[eigen];
  const ingr = new Set(eigen.split(' '));
  let beste = '', score = 0;
  for (const naam of productnamen) {
    const woorden = sleutelwoorden(naam);
    if (!woorden.length) continue;
    // een samengesteld product ("Spinazie met room") is iets anders dan spinazie of room apart
    const samengesteld = /\s(?:met|in|op)\s/i.test(naam.replace(/\(.*?\)/g, ' '));
    const vI = vormen([...ingr]), vP = vormen(woorden);
    let s = 0;
    if (woorden.join(' ') === eigen || woorden.join('') === eigen.replace(/ /g, '')) s = 4; // ook "paprikapoeder" = "Paprika poeder"
    else if (samengesteld || vI.length !== vP.length || vI.some((v) => !vP.includes(v))) s = 0;
    else if (woorden.every((w) => ingr.has(w))) s = 2 + woorden.length / 10; // "melk" in "volle melk"
    else if ([...ingr].every((w) => woorden.includes(w))) s = 1.5;             // "ui" bij "rode ui"
    else if (woorden.some((w) => w.length > 3 && !BESCHRIJVEND.has(w) && ingr.has(w))) s = 1;
    else if (woorden.length === 1 && woorden[0].length >= 3 && [...ingr].some((w) => w.length > woorden[0].length && w.endsWith(woorden[0]))) s = 1; // "slagroom" bij "room"
    if (s > score || (s === score && s > 0 && naam.length < beste.length)) { score = s; beste = naam; }
  }
  return score >= 1 ? beste : '';
}

/**
 * Is een bewaarde koppeling waarschijnlijk vanzelf (verkeerd) gemaakt? Vroeger werd elke voorgestelde koppeling
 * bij het opslaan van een recept bewaard, ook "rode paprika" → "Rode biet" of "room" → "Spinazie met room".
 * Zo'n koppeling (wel een gedeeld woord, maar volgens de huidige regels geen match) tellen we niet meer.
 */
export function koppelingFout(ingredientNaam, product) {
  if (!product) return false;
  if (zoekVoorraadnaam(ingredientNaam, [product])) return false;
  const a = sleutelwoorden(ingredientNaam), b = sleutelwoorden(product);
  return a.some((x) => b.some((y) => x === y || (y.length >= 3 && x.endsWith(y)) || (x.length >= 3 && y.endsWith(x))));
}

// ---------------------------------------------------------------------------
// Eenheden
// ---------------------------------------------------------------------------
const GEWICHT = { g: 1, kg: 1000 };
const VOLUME = { ml: 1, cl: 10, dl: 100, l: 1000, el: 15, tl: 5, kopje: 250 };

export function omrekenen(hoeveelheid, van, naar) {
  if (hoeveelheid === null || hoeveelheid === undefined) return null;
  van = (van || '').toLowerCase().trim();
  naar = (naar || '').toLowerCase().trim();
  if (van === naar || (!van && naar === 'stuks') || (van === 'stuks' && !naar)) return hoeveelheid;
  for (const groep of [GEWICHT, VOLUME]) if (van in groep && naar in groep) return (hoeveelheid * groep[van]) / groep[naar];
  return null;
}

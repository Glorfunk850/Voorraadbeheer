// Voorraad — interface. Praat met api/..., afgehandeld in lokaal.js (opslag op dit toestel).
import { receptOntleden, ingredientOntleden, zoekVoorraadnaam, koppelingFout, sleutelwoorden, omrekenen, eigenEenhedenZetten } from './parser.js';
import { tekstOpmaken, pdfStukjes, paginasStapelen } from './layout.js';
import { HANDLEIDING } from './handleiding.js';

// ---------------------------------------------------------------------------
// Basis
// ---------------------------------------------------------------------------
// Eenheden voor voorraad en boodschappen: standaard deze, zelf aan te passen bij Instellingen → Eenheden.
const STANDAARD_EENHEDEN = ['stuks', 'g', 'kg', 'ml', 'cl', 'dl', 'l', 'pak', 'blik', 'fles', 'pot', 'zak', 'doos'];
const MAAT_EENHEDEN = new Set(['g', 'kg', 'ml', 'cl', 'dl', 'l']);
/** De eenheden om uit te kiezen (uit Instellingen); "stuks" staat er altijd bij. */
const eenheden = () => {
  const l = Array.isArray(S.instellingen.eenheden) && S.instellingen.eenheden.length ? S.instellingen.eenheden : STANDAARD_EENHEDEN;
  return l.includes('stuks') ? l : ['stuks', ...l];
};
const RECEPT_EENHEDEN = ['', 'stuks', 'g', 'kg', 'ml', 'cl', 'dl', 'l', 'el', 'tl', 'snuf', 'teen', 'blik', 'pak', 'zak',
  'pot', 'fles', 'takje', 'bos', 'kopje', 'plak', 'scheut', 'handvol', 'blad'];
// Telbaar = een verpakking of stuk (met eventueel een inhoud per stuk, bv. pak à 500 g). Zelf toegevoegde eenheden
// (bv. bokaal, tube, rol) zijn telbaar; gewichten, volumes en receptmaten (el, tl, snuf …) niet.
const NIET_TELBAAR = new Set(['', 'g', 'kg', 'ml', 'cl', 'dl', 'l', 'el', 'tl', 'snuf', 'teen', 'takje', 'bos', 'kopje', 'plak', 'scheut', 'handvol', 'blad']);
const TELBAAR = { has: (e) => typeof e === 'string' && (!NIET_TELBAAR.has(e) || (!MAAT_EENHEDEN.has(e) && !!e && eenheden().includes(e))) };
/** Eenheden voor een ingrediënt: de receptmaten plus je eigen eenheden. */
const receptEenheden = () => [...RECEPT_EENHEDEN, ...eenheden().filter((e) => !RECEPT_EENHEDEN.includes(e))];
// Basisingrediënten die je meestal niet bijhoudt: tellen niet als "ontbreekt" (tenzij gekoppeld)
const ALTIJD_IN_HUIS = new Set(['water', 'kraanwater', 'heet water', 'koud water', 'lauw water', 'ijsblokjes', 'zout', 'peper',
  'peper en zout', 'zout en peper', 'peper & zout', 'zout & peper', 'peper en zout naar smaak', 'zout en peper naar smaak']);
const MAX_PDF_PAGINAS = 15;
// Zelfde nummer als VERSIE in sw.js; staat onderaan bij Instellingen, zodat je kunt zien of een toestel de nieuwste versie heeft.
const APP_VERSIE = 93;

let S = { producten: [], boodschappen: [], recepten: [], catalogus: [], planning: [], instellingen: {} };
let status = {};
const ui = { view: 'voorraad', week: 0, winkel: '', plaats: '', zoek: '', receptZoek: '', catZoek: '', receptFilter: { fav: false, inHuis: false, soort: '', cat: '' }, uitgeklapt: new Set() };

// filtermenu's (Recepten, Boodschappen) staan standaard open; wie ze dichtklapt, vindt ze dicht terug zolang de app open is
function filterMenuOnthouden() {
  document.querySelectorAll('#inhoud [data-dicht]').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) ui.uitgeklapt.delete('dicht:' + d.dataset.dicht); else ui.uitgeklapt.add('dicht:' + d.dataset.dicht);
  }));
}
const ICOON = {
  kast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M9 7.5h1M9 16.5h1"/></svg>',
  mand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-1.6 10.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8z"/><path d="M8 9l4-6 4 6"/></svg>',
  boek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20v-3"/></svg>',
  tandwiel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  lijst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".6"/><circle cx="4.5" cy="12" r=".6"/><circle cx="4.5" cy="18" r=".6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/></svg>',
  zoek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  sluit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ster: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l7.4 7.4a1.5 1.5 0 0 1 0 2.1l-7.2 7.2a1.5 1.5 0 0 1-2.1 0l-7.6-7.6a1 1 0 0 1-.3-.7z"/><circle cx="8.2" cy="8.2" r="1.3"/></svg>',
  kalender: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/></svg>',
  scherm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3.6"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>',
  sterVol: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
// Voor de hoofdschermen: alleen zoeken binnen #inhoud, nooit in het paneel of de dialogen.
// Zo kan een knop op het scherm nooit per ongeluk een knop in het paneel "overnemen" (of omgekeerd).
// Vangnet: een vast element van de pagina met een id (bv. #bestand-backup, #toast) staat buiten #inhoud.
// Wordt zo'n id niet in #inhoud gevonden, dan het vaste element nemen (nooit iets uit het paneel).
const $m = (s, el = document.getElementById('inhoud')) => {
  const gevonden = el.querySelector(s);
  if (gevonden || !/^#[\w-]+$/.test(s)) return gevonden;
  const vast = document.querySelector(s);
  return vast && !vast.closest('#paneel') ? vast : null;
};
const $$m = (s, el = document.getElementById('inhoud')) => [...el.querySelectorAll(s)];
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const fmt = (n) => (n === null || n === undefined ? '' : (Math.round(n * 100) / 100).toLocaleString('nl-BE', { maximumFractionDigits: 2 }));
const eenheidKort = (e) => (e === 'stuks' ? '' : e || '');
const hoeveelTekst = (n, e) => (n === null || n === undefined ? '' : `${fmt(n)}${eenheidKort(e) ? ' ' + eenheidKort(e) : ''}`);
// Inhoud per verpakking (bv. 2 pak à 500 g). Alleen bij telbare eenheden.
const STANDAARD_INHOUD = ['g', 'kg', 'ml', 'cl', 'dl', 'l'];
/** Eenheden voor de inhoud per stuk of verpakking (uit Instellingen; standaard g, kg, ml, cl, dl, l). */
const inhoudEenheden = () => (Array.isArray(S.instellingen.inhoud_eenheden) && S.instellingen.inhoud_eenheden.length
  ? S.instellingen.inhoud_eenheden : STANDAARD_INHOUD);
/** Keuzelijst voor de eenheid van de inhoud: de bewaarde waarde, anders `standaard` (of de eerste als die verwijderd is). */
const inhoudOpties = (waarde, standaard = 'g') => {
  const l = inhoudEenheden();
  return opties(l, waarde || (l.includes(standaard) ? standaard : l[0])) + NIEUWE_INHOUD;
};
/** Keuzelijst voor de eenheid (stuks, g, pak …), met onderaan "Andere eenheid…". */
const eenheidOpties = (waarde) => opties(eenheden(), waarde) + NIEUWE_EENHEID;
// laatste keuze in een eenhedenlijst: zelf een eenheid toevoegen (zie eenheidToevoegen)
const NIEUW = { eenheden: '__nieuwe_eenheid__', inhoud_eenheden: '__nieuwe_inhoud__' };
const NIEUWE_EENHEID = `<option value="${NIEUW.eenheden}">Andere eenheid…</option>`;
const NIEUWE_INHOUD = `<option value="${NIEUW.inhoud_eenheden}">Andere eenheid…</option>`;
const VASTE_INHOUD = new Set(['g', 'kg', 'mg', 'ml', 'cl', 'dl', 'l']);
/** Naam voor een nieuwe eenheid controleren; geeft een foutmelding terug, of '' als ze goed is. */
function eenheidFout(sleutel, naam, lijst) {
  if (!naam) return 'Typ een eenheid.';
  if (naam.length > 20) return 'Kies een kortere eenheid (hoogstens 20 tekens).';
  if (naam.startsWith('__')) return 'Kies een andere naam.';
  if (lijst.some((x) => zelfde(x, naam))) return `"${naam}" staat al in de lijst.`;
  return '';
}
// Kiest iemand "Andere eenheid…" in een keuzelijst: naam vragen, bij Instellingen bewaren en meteen kiezen.
// Dit gebeurt vóór de andere luisteraars (capture), zodat die nooit de tijdelijke waarde zien.
const eenheidVorige = new WeakMap();
document.addEventListener('focusin', (e) => { if (e.target.tagName === 'SELECT') eenheidVorige.set(e.target, e.target.value); }, true);
document.addEventListener('change', async (e) => {
  const sel = e.target;
  if (sel.tagName !== 'SELECT') return;
  const sleutel = Object.keys(NIEUW).find((k) => NIEUW[k] === sel.value);
  if (!sleutel) { eenheidVorige.set(sel, sel.value); return; }
  e.stopImmediatePropagation();
  const vorige = eenheidVorige.get(sel) ?? sel.options[0]?.value ?? '';
  sel.value = vorige;
  const lijst = sleutel === 'inhoud_eenheden' ? inhoudEenheden() : eenheden();
  const naam = ((await vraag(sleutel === 'inhoud_eenheden' ? 'Nieuwe eenheid voor de inhoud, bv. vel, rol of wasbeurt:' : 'Nieuwe eenheid, bv. bokaal, tube of rol:',
    { invoer: true, ja: 'Toevoegen' })) || '').trim().toLowerCase();
  if (!naam) return;
  const fout = eenheidFout(sleutel, naam, lijst);
  if (fout && !lijst.some((x) => zelfde(x, naam))) return toast(fout);
  if (!fout) await api('PUT', 'instellingen', { [sleutel]: [...lijst, naam] });
  // de keuzelijst kan intussen opnieuw getekend zijn: dezelfde (of de nieuwe) lijst opzoeken
  const doel = sel.isConnected ? sel : (sel.id && document.getElementById(sel.id));
  if (!doel) return;
  if (![...doel.options].some((o) => o.value === naam)) {
    const o = document.createElement('option'); o.value = naam; o.textContent = naam;
    doel.insertBefore(o, [...doel.options].find((x) => x.value === NIEUW[sleutel]) || null);
  }
  doel.value = naam;
  eenheidVorige.set(doel, naam);
  doel.dispatchEvent(new Event('change', { bubbles: true }));
  if (!fout) toast(`Eenheid "${naam}" toegevoegd. Beheren kan bij Instellingen.`);
}, true);
const inhoudVan = (p) => (p && TELBAAR.has(p.eenheid) && p.inhoud > 0 && p.inhoud_eenheid ? { per: p.inhoud, eenheid: p.inhoud_eenheid } : null);
/** Inhoud per verpakking van één boodschap (bv. pak à 500 g); een boodschap zonder eenheid telt als stuks. */
const boodschapInhoudVan = (b) => inhoudVan(b && { ...b, eenheid: b.eenheid || 'stuks' });
const boodschapTekst = (b) => { const i = boodschapInhoudVan(b); return hoeveelTekst(b.hoeveelheid, b.eenheid || 'stuks') + (i ? ` à ${hoeveelTekst(i.per, i.eenheid)}` : ''); };
const voorraadTekst = (p) => { const i = inhoudVan(p); return hoeveelTekst(p.hoeveelheid, p.eenheid) + (i ? ` à ${hoeveelTekst(i.per, i.eenheid)}` : '') + uitlekTekst(p); };
/** Het gewicht is uitlekgewicht (bv. groenten in blik): alleen vermelden als er een gewicht of inhoud staat. */
const uitlekTekst = (p) => (p && p.uitlekgewicht && (inhoudVan(p) || !TELBAAR.has(p.eenheid)) ? ' uitlekgewicht' : '');
/** Gekend merk van een product (uit de catalogus, anders uit de voorraad). */
const merkVan = (naam) => catalogusVan(naam)?.merk || S.producten.find((p) => zelfde(p.naam, naam) && p.merk)?.merk || '';
/** Kleine of grote verpakking ('klein', 'groot'; '' = niet opgegeven). Ze worden nooit samengeteld en hebben elk hun eigen minimum. */
const maatVan = (x) => (x && (x.verpakking === 'klein' || x.verpakking === 'groot') ? x.verpakking : '');
const maatWoord = (m) => (m === 'groot' ? 'grote verpakking' : m === 'klein' ? 'kleine verpakking' : '');
/** Merk (en kleine/grote verpakking) achter de naam in een lijst (bv. Kikkererwten · Bonduelle · groot). */
const merkTekst = (p) => (p && p.merk ? `<span class="merk"> · ${esc(p.merk)}</span>` : '') + (maatVan(p) ? `<span class="maat maat-${maatVan(p)}">${maatVan(p)}</span>` : '');
/** Keuze kleine of grote verpakking in een formulier. */
const maatKeuzeHtml = (id, m) => `<div class="veld"><span class="veld-titel">Verpakking</span>
  <div class="segment drie" id="${id}-maat">${[['', 'Niet opgegeven'], ['klein', 'Klein'], ['groot', 'Groot']].map(([w, t]) =>
    `<button type="button" data-w="${w}"${maatVan({ verpakking: m }) === w ? ' class="aan"' : ''}>${t}</button>`).join('')}</div></div>`;
const maatLezen = (el, id) => { const b = $(`#${id}-maat .aan`, el); return b ? b.dataset.w : ''; };
const maatZetten = (el, id, m) => $$(`#${id}-maat button`, el).forEach((b) => b.classList.toggle('aan', b.dataset.w === maatVan({ verpakking: m })));
/** Knoppen koppelen; `veranderd` wordt opgeroepen met de nieuwe keuze. */
function maatKoppelen(el, id, veranderd = () => {}) {
  $$(`#${id}-maat button`, el).forEach((b) => (b.onclick = () => { maatZetten(el, id, b.dataset.w); minimumVinkjeMaat(el, id); veranderd(b.dataset.w); }));
  minimumVinkjeMaat(el, id, false);
}
/** Vinkje "uitlekgewicht" in een formulier. */
const uitlekVinkje = (id, aan) => `<label class="vink uitlek-vink"><input type="checkbox" id="${id}-uitlek" ${aan ? 'checked' : ''}><span class="vakje"></span>
  <span>Uitlekgewicht <small class="stil">het gewicht zonder vocht, bv. groenten of fruit in blik of bokaal</small></span></label>`;
/** Totaal leesbaar maken: 1000 g wordt 1 kg, 1500 ml wordt 1,5 l. */
function samenTekst(h, e) {
  const groot = { g: 'kg', ml: 'l', cl: 'l', dl: 'l' }[e];
  if (groot && omrekenen(h, e, groot) >= 1) { h = omrekenen(h, e, groot); e = groot; }
  return hoeveelTekst(Math.round(h * 1000) / 1000, e);
}
/** Hoeveelheid h (in eenheid e) omzetten naar de eenheid van product p, desnoods via de inhoud per verpakking. */
function naarProduct(h, e, p) {
  const d = omrekenen(h, e, p.eenheid);
  if (d !== null) return d;
  const i = inhoudVan(p);
  const x = i ? omrekenen(h, e, i.eenheid) : null;
  return x === null ? null : x / i.per;
}
/** Hoeveelheid h van product p (in p.eenheid) omzetten naar eenheid e, desnoods via de inhoud per verpakking. */
function vanProduct(h, p, e) {
  const d = omrekenen(h, p.eenheid, e);
  if (d !== null) return d;
  const i = inhoudVan(p);
  return i ? omrekenen(h * i.per, i.eenheid, e) : null;
}
/** Eenheid in het meervoud, voor de kleine verpakkingen in een grote (bv. 4 zakjes in een doos, 4 potten uit een zak). */
const MEERVOUD = { stuks: 'stuks', pot: 'potten', zak: 'zakjes', pak: 'pakjes', blik: 'blikken', fles: 'flessen', doos: 'dozen' };
const meervoud = (e, n = 2) => (n === 1 ? (e === 'stuks' ? 'stuk' : e === 'zak' ? 'zakje' : e === 'pak' ? 'pakje' : e) : MEERVOUD[e] || e);
const zelfde = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

const isoDatum = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function vandaag(plus = 0) {
  const d = new Date();
  d.setDate(d.getDate() + plus);
  return isoDatum(d);
}
function datumPlus(datum, dagen) {
  const d = new Date(datum + 'T12:00');
  d.setDate(d.getDate() + dagen);
  return isoDatum(d);
}
function dagenTot(datum) {
  const [j, m, d] = datum.split('-').map(Number);
  const nu = new Date();
  return Math.round((Date.UTC(j, m - 1, d) - Date.UTC(nu.getFullYear(), nu.getMonth(), nu.getDate())) / 86400000);
}
const datumNL = (d, jaar = false) => (d ? new Date(d + 'T12:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', ...(jaar ? { year: 'numeric' } : {}) }) : '');
const wanneer = (d) => (d === 0 ? 'vandaag' : d === 1 ? 'morgen' : d === -1 ? 'gisteren' : d < 0 ? `${-d} dagen geleden` : `over ${d} dagen`);
const TYPE_LANG = { THT: 'Ten minste houdbaar tot', TGT: 'Te gebruiken tot' };

/** Houdbaarheid. niveau: 0 ok, 1 THT bijna, 2 THT voorbij, 3 TGT bijna, 4 TGT voorbij */
function houdbaarheid(p) {
  if (!p.vervaldatum || !(p.hoeveelheid > 0)) return { niveau: 0, kleur: '' };
  const d = dagenTot(p.vervaldatum);
  const inst = S.instellingen;
  if (p.datumtype === 'TGT') {
    if (d < 0) return { niveau: 4, kleur: 'rood', kort: 'verlopen', uitleg: 'Niet meer eten' };
    if (d <= (inst.tgt_dagen ?? 2)) return { niveau: 3, kleur: 'rood', kort: wanneer(d), uitleg: 'Te gebruiken tot' };
    return { niveau: 0, kleur: '' };
  }
  if (d < 0) return { niveau: 2, kleur: 'oranje', kort: 'datum voorbij', uitleg: 'Meestal nog goed: kijk, ruik en proef' };
  if (d <= (inst.tht_dagen ?? 3)) return { niveau: 1, kleur: 'oranje', kort: wanneer(d), uitleg: 'Ten minste houdbaar tot' };
  return { niveau: 0, kleur: '' };
}

/** Wat op moet (bijna of al voorbij de datum): eerst "te gebruiken tot", dan de vroegste datum. [{ p, h }] */
const opTeGebruikenVan = (producten) => producten.map((p) => ({ p, h: houdbaarheid(p) })).filter((x) => x.h.niveau > 0)
  .sort((a, b) => (b.h.niveau >= 3) - (a.h.niveau >= 3) || a.p.vervaldatum.localeCompare(b.p.vervaldatum));

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
async function api(methode, pad, body, stil = false) {
  const opties = { method: methode, headers: {} };
  if (body !== undefined) { opties.body = JSON.stringify(body); opties.headers['Content-Type'] = 'application/json'; }
  let antwoord;
  try { antwoord = await fetch('api/' + pad, opties); } catch (f) {
    window.voorraadLog?.fout(`Opdracht ${methode} ${pad} mislukt`, f);
    if (!stil) toast('Er ging iets mis bij het bewaren. Herlaad de app.');
    throw new Error('geen verbinding');
  }
  const data = await antwoord.json().catch(() => ({}));
  if (!antwoord.ok) {
    window.voorraadLog?.schrijf(`Opdracht ${methode} ${pad} gaf fout ${antwoord.status}: ${data.fout || ''}`);
    if (!stil) toast(data.fout || 'Er ging iets mis.');
    throw new Error(data.fout || 'fout');
  }
  if (data.producten) {
    S = data;
    // het is bewaard; lukt het scherm bijwerken niet, dan dat melden (vroeger: "knop doet niets")
    try { tekenen(); if (paneelVernieuwen) paneelVernieuwen(); } catch (f) {
      window.voorraadLog?.fout(`Scherm bijwerken na ${methode} ${pad} (scherm ${ui.view})`, f);
      if (!stil) toast(`Bewaard, maar het scherm bijwerken lukte niet (${f.message}). Kijk bij Instellingen → Probleemlogboek.`, null, null, true);
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Toast, vraag, paneel
// ---------------------------------------------------------------------------
let toastTimer;
function toast(tekst, actieTekst, actie, blijvend = false) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(tekst)}</span>` + (actieTekst ? `<button>${esc(actieTekst)}</button>` : '');
  el.hidden = false;
  if (actie) $('button', el).onclick = () => { el.hidden = true; actie(); };
  clearTimeout(toastTimer);
  if (!blijvend) toastTimer = setTimeout(() => (el.hidden = true), actie ? 6000 : 3200);
}
const toastWeg = () => { clearTimeout(toastTimer); $('#toast').hidden = true; };

function vraag(tekst, { invoer = false, standaard = '', ja = 'OK', gevaar = false, numeriek = false } = {}) {
  return new Promise((klaar) => {
    const dlg = $('#vraag'), veld = $('#vraag-invoer'), knop = $('#vraag-ja');
    $('#vraag-tekst').textContent = tekst;
    veld.hidden = !invoer;
    veld.value = standaard ?? '';
    veld.inputMode = numeriek ? 'decimal' : 'text';
    knop.textContent = ja;
    knop.className = 'knop primair' + (gevaar ? ' gevaar' : '');
    let antwoord = null;
    $('#vraag-form').onsubmit = (e) => { e.preventDefault(); antwoord = invoer ? veld.value : true; dlg.close(); };
    $('#vraag-nee').onclick = () => dlg.close();
    dlg.onclose = () => klaar(antwoord === null ? (invoer ? null : false) : antwoord);
    dlg.showModal();
    if (invoer) setTimeout(() => { veld.focus(); veld.select(); }, 30);
  });
}

let paneelVernieuwen = null;
let vernieuwenNodig = false, vrijTimer = null; // zie vernieuwenAlsVrij
// Toestand van het open paneel (bv. "formulier staat er al"). Bewust GEEN data-attributen op #paneel:
// die kunnen botsen met selectors als [data-recept] en dan knoppen kapen.
let paneelStaat = {};
/** true als dit stuk van het paneel al getekend is; markeert het anders als getekend. */
const alGetekend = (naam) => { if (paneelStaat[naam]) return true; paneelStaat[naam] = true; return false; };
function paneelOpenen(teken, { breed = false } = {}) {
  const p = $('#paneel');
  paneelStaat = {};
  for (const k of Object.keys(p.dataset)) delete p.dataset[k];
  p.classList.toggle('breed', breed);
  p.hidden = false;
  $('#sluier').hidden = false;
  document.body.style.overflow = 'hidden';
  document.body.classList.add('paneel-open');
  paneelVernieuwen = () => { teken(p); };
  schermBijRecept = false; // receptPaneel zet dit zelf weer aan
  teken(p);
  p.scrollTop = 0;
  schermBijwerken();
}
function paneelSluiten() {
  $('#paneel').hidden = true;
  $('#sluier').hidden = true;
  $('#paneel').innerHTML = '';
  $('#paneel').style.bottom = ''; $('#paneel').style.maxHeight = '';
  document.body.style.overflow = '';
  document.body.classList.remove('paneel-open');
  paneelVernieuwen = null;
  paneelStaat = {};
  schermBijRecept = false;
  schermBijwerken();
  vrijNakijken();
}
$('#sluier').onclick = paneelSluiten;

// ---------------------------------------------------------------------------
// Scherm aan laten: het scherm gaat niet op stand-by terwijl je kookt (Screen Wake Lock).
// Per toestel bewaard (niet gesynchroniseerd: op de laptop wil je dat misschien niet):
//   'recept' (standaard): zolang een recept open staat · 'altijd': zolang de app open is · 'uit'.
// In een recept kun je het ook voor dat recept zelf aan- of uitzetten.
// ---------------------------------------------------------------------------
const SCHERM_KEUZES = ['recept', 'altijd', 'uit'];
const schermKan = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
let schermBijRecept = false;   // staat er nu een recept open?
let schermEigen = null;        // { id, aan }: zelf gekozen in het open recept (anders volgt het de instelling)
let schermSlot = null;         // het WakeLockSentinel zolang het scherm aan blijft
let schermKet = Promise.resolve();
function schermKeuze() {
  try { const k = localStorage.getItem('scherm-aan'); if (SCHERM_KEUZES.includes(k)) return k; } catch { if (SCHERM_KEUZES.includes(ui.schermKeuze)) return ui.schermKeuze; }
  return 'recept';
}
function schermKeuzeBewaren(k) { ui.schermKeuze = k; try { localStorage.setItem('scherm-aan', k); } catch { /* */ } schermBijwerken(); }
/** Moet het scherm aan blijven in het recept dat nu open staat? */
const schermInRecept = () => (schermEigen ? schermEigen.aan : schermKeuze() !== 'uit');
const schermGewenst = () => schermKeuze() === 'altijd' || (schermBijRecept && schermInRecept());
const schermIsAan = () => !!schermSlot && !schermSlot.released;
function schermBijwerken() {
  schermKet = schermKet.then(async () => {
    const aan = schermKan && document.visibilityState === 'visible' && schermGewenst();
    if (aan && !schermIsAan()) {
      try {
        schermSlot = await navigator.wakeLock.request('screen');
        schermSlot.addEventListener('release', () => { schermKnopBijwerken(); });
      } catch { schermSlot = null; /* bv. batterijbesparing: dan gaat het scherm gewoon uit zoals altijd */ }
    } else if (!aan && schermSlot) {
      const s = schermSlot; schermSlot = null;
      try { await s.release(); } catch { /* */ }
    }
    schermKnopBijwerken();
  }).catch(() => {});
  return schermKet;
}
/** De knop in het recept toont of het scherm aan blijft. */
function schermKnopBijwerken() {
  const k = document.getElementById('r-scherm');
  if (!k) return;
  const aan = schermInRecept();
  k.classList.toggle('aan', aan);
  k.setAttribute('aria-pressed', aan ? 'true' : 'false');
  k.lastElementChild.textContent = aan ? 'Scherm blijft aan' : 'Scherm aan laten';
}
// verborgen (andere app, scherm vergrendeld) laat de browser het slot los: bij terugkeer opnieuw vragen
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schermBijwerken(); });

// Toetsenbord op de smartphone: het blad boven het toetsenbord houden, anders schuift het uit beeld
const opTelefoon = window.matchMedia('(max-width: 899px)');
function paneelAanToetsenbord() {
  const p = $('#paneel'), vv = window.visualViewport;
  if (!vv || p.hidden || !opTelefoon.matches) { p.style.bottom = ''; p.style.maxHeight = ''; return; }
  const onder = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  p.style.bottom = onder > 1 ? onder + 'px' : '';
  p.style.maxHeight = Math.round(vv.height * (onder > 1 ? 0.96 : 0.92)) + 'px';
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', paneelAanToetsenbord);
  window.visualViewport.addEventListener('scroll', paneelAanToetsenbord);
}
$('#paneel').addEventListener('focusin', (e) => {
  if (!opTelefoon.matches || !e.target.matches('input, textarea, select')) return;
  setTimeout(() => { paneelAanToetsenbord(); e.target.scrollIntoView({ block: 'nearest' }); }, 300);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#paneel').hidden && !$('#vraag').open) paneelSluiten(); });
const paneelKop = (titel, onder = '') => `<div class="paneel-kop"><div><h2>${titel}</h2>${onder ? `<p class="stil">${onder}</p>` : ''}</div>
  <button class="icoon" data-sluit aria-label="Sluiten">${ICOON.sluit}</button></div>`;
function sluitKnoppen(p) { $$('[data-sluit]', p).forEach((b) => (b.onclick = paneelSluiten)); }

// ---------------------------------------------------------------------------
// Hulp voor lijsten
// ---------------------------------------------------------------------------
const uniek = (lijst) => { const m = new Map(); for (const x of lijst) if (x && !m.has(x.toLowerCase())) m.set(x.toLowerCase(), x); return [...m.values()]; };
const productnamen = () => uniek(S.producten.map((p) => p.naam)).sort((a, b) => a.localeCompare(b, 'nl'));
const catalogusnamen = () => uniek([...S.producten.map((p) => p.naam), ...(S.catalogus || []).map((c) => c.naam)]).sort((a, b) => a.localeCompare(b, 'nl'));
const locaties = () => uniek([...(S.instellingen.locaties || []), ...S.producten.map((p) => p.locatie)]);
const categorieen = () => uniek([...(S.instellingen.categorieen || []), ...S.producten.map((p) => p.categorie)]);
const opties = (lijst, gekozen, leeg) => {
  const items = [...lijst];
  if (gekozen && !items.some((x) => zelfde(x, gekozen))) items.push(gekozen);
  return (leeg !== undefined ? `<option value="">${esc(leeg)}</option>` : '')
    + items.map((x) => `<option value="${esc(x)}"${zelfde(x, gekozen) ? ' selected' : ''}>${esc(x || '–')}</option>`).join('');
};

// ---------------------------------------------------------------------------
// Prijzen per winkel. Ze staan per productnaam in de catalogus: { winkel, prijs, per }, prijs in euro per eenheid `per`.
// ---------------------------------------------------------------------------
const winkels = () => S.instellingen.winkels || [];
/** Eenheid waarin je een prijs invult: per kg in plaats van per g, per l in plaats van per ml ... */
const prijsEenheid = (e) => ({ g: 'kg', ml: 'l', cl: 'l', dl: 'l', '': 'stuks' })[e || ''] || e;
const perTekst = (e) => (e === 'stuks' ? 'stuk' : e);
// Eenheden waarin je een prijs kunt invullen (bv. een pak à 500 g, maar de prijs per kg zoals op het prijskaartje)
const prijsEenheden = () => ['kg', 'g', 'l', 'ml', ...eenheden().filter((e) => TELBAAR.has(e)),
  ...inhoudEenheden().filter((e) => !VASTE_INHOUD.has(e) && !eenheden().includes(e))]; // bv. prijs per vel of per wasbeurt
/** Eenheid van de prijzen die er al zijn, anders die die bij de eenheid van het product past. */
const prijsPerVan = (prijzen, eenheid) => (prijzen || []).find((p) => p.per)?.per || prijsEenheid(eenheid);
const euro = (n) => '€ ' + n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const catalogusVan = (naam) => (S.catalogus || []).find((c) => zelfde(c.naam, naam));
/** Minimum voor het hele product van een grootte (klein, groot, of '' = alle groottes zonder eigen minimum). */
const catMinimum = (c, m = '') => (c && c[m ? `minimum_${m}` : 'minimum'] > 0 ? c[m ? `minimum_${m}` : 'minimum'] : 0);
/** Sleutel van de inhoud van een prijs, boodschap of product (bv. "500 g"); leeg zonder inhoud. */
const prijsSleutel = (x) => (x && x.inhoud > 0 && x.inhoud_eenheid ? `${x.inhoud} ${x.inhoud_eenheid}` : '');
const inhoudLabel = (x) => (prijsSleutel(x) ? `à ${hoeveelTekst(x.inhoud, x.inhoud_eenheid)}` : '');
const prijsMerk = (x) => String((x && x.merk) || '').trim().toLowerCase();
/** Sleutel van merk en inhoud samen (bv. "lavazza|500 g"): elk merk en elke inhoud kan een eigen prijs hebben. */
const groepSleutel = (x) => `${prijsMerk(x)}|${prijsSleutel(x)}`;
/**
 * Prijzen van een product. Zonder `inh`: alle prijzen. Met `inh` (iets met merk/inhoud/inhoud_eenheid, of null):
 * de prijzen van dat merk en die inhoud; zijn er geen, dan die van de inhoud zonder merk, dan die zonder inhoud
 * (en zonder inhoud: die van de gewone inhoud van het product).
 */
function prijzenVan(naam, inh) {
  const alle = catalogusVan(naam)?.prijzen || [];
  if (inh === undefined) return alle;
  // kleine of grote verpakking zonder eigen inhoud: de prijzen van de inhoud van die grootte (bv. bokaal à 190 g)
  const maatInh = maatInhouden(naam, inh);
  if (maatInh) {
    const m = prijsMerk(inh);
    return alle.filter((p) => (!m || prijsMerk(p) === m) && maatInh.some((v) => prijsSleutel(p) === prijsSleutel(v) && (!prijsMerk(p) || prijsMerk(p) === prijsMerk(v))));
  }
  const m = prijsMerk(inh), k = prijsSleutel(inh);
  const pogingen = [[m, k], ['', k], ...(k ? [[m, ''], ['', '']] : [[m, prijsSleutel(catalogusVan(naam))], ['', prijsSleutel(catalogusVan(naam))]])];
  for (const [mm, kk] of pogingen) {
    const lijst = alle.filter((p) => prijsMerk(p) === mm && prijsSleutel(p) === kk);
    if (lijst.length) return lijst;
  }
  return [];
}
/**
 * Een boodschap klein of groot, zonder eigen inhoud: welke inhouden (merk + inhoud uit de catalogus) horen bij die grootte?
 * Eerst de catalogusregels met die grootte (bv. Jumbo à 190 g, klein). Heeft geen enkele regel een grootte, dan is klein
 * de kleinste inhoud en groot de grootste. null als dat niet te zeggen is (dan gelden de gewone prijzen).
 */
function maatInhouden(naam, inh) {
  const maat = maatVan(inh), c = catalogusVan(naam);
  if (!maat || prijsSleutel(inh) || !c) return null;
  const vs = variantenVan(c).filter((v) => prijsSleutel(v));
  if (vs.some((v) => maatVan(v))) return vs.filter((v) => maatVan(v) === maat);
  const gram = (v) => omrekenen(v.inhoud, v.inhoud_eenheid, ['ml', 'cl', 'dl', 'l'].includes(v.inhoud_eenheid) ? 'ml' : 'g') ?? v.inhoud;
  const maten = [...new Set(vs.map(gram))].sort((a, b) => a - b);
  if (maten.length < 2) return null;
  const doel = maat === 'klein' ? maten[0] : maten[maten.length - 1];
  return vs.filter((v) => gram(v) === doel);
}
const winkelPlek = (w) => { const i = winkels().findIndex((x) => zelfde(x, w)); return i < 0 ? 9999 : i; };
/** Prijzen van goedkoop naar duur (gelijke prijs: de winkel die bovenaan staat bij Instellingen eerst). */
function prijzenSorteren(lijst) {
  if (!lijst.length) return [];
  const basis = lijst[0].per;
  // alles omrekenen naar dezelfde eenheid (bv. € per kg en € per g), anders de prijs zoals ingevuld
  const vergelijk = (p) => { const f = omrekenen(1, basis, p.per); return f === null ? p.prijs : p.prijs * f; };
  return [...lijst].sort((a, b) => vergelijk(a) - vergelijk(b) || winkelPlek(a.winkel) - winkelPlek(b.winkel));
}
const prijzenGesorteerd = (naam, inh) => prijzenSorteren(prijzenVan(naam, inh === undefined ? null : inh));
const goedkoopste = (naam, inh) => prijzenGesorteerd(naam, inh)[0] || null;
/**
 * Winkel (goedkoopste prijsregel) voor een boodschap. Is er geen prijs voor precies dit merk en deze inhoud,
 * dan die van hetzelfde merk (andere inhoud), en anders alle prijzen van het product: zo komt een boodschap
 * altijd op de lijst van een winkel zodra er ergens een prijs bij het product ingevuld is.
 */
function winkelVoor(naam, inh) {
  const p = goedkoopste(naam, inh);
  if (p) return p;
  // klein of groot: nooit de prijs van een andere inhoud (dan eerst de prijs invullen)
  if (maatInhouden(naam, inh)) return null;
  const alle = prijzenVan(naam), m = prijsMerk(inh);
  const zelfdeMerk = m ? alle.filter((x) => prijsMerk(x) === m) : [];
  return prijzenSorteren(zelfdeMerk.length ? zelfdeMerk : alle)[0] || null;
}
/** Geschatte prijs van een boodschap bij prijsregel p, of null als dat niet te berekenen is. */
function kostprijs(b, p) {
  if (b.hoeveelheid === null || b.hoeveelheid === undefined) return TELBAAR.has(p.per) ? p.prijs : null;
  const e = b.eenheid || 'stuks', c = catalogusVan(b.naam);
  let n = omrekenen(b.hoeveelheid, e, p.per);
  const bi = boodschapInhoudVan(b);
  if (n === null && bi) n = omrekenen(b.hoeveelheid * bi.per, bi.eenheid, p.per); // via de inhoud van deze boodschap
  if (n === null && !bi && TELBAAR.has(e) && p.inhoud > 0) n = omrekenen(b.hoeveelheid * p.inhoud, p.inhoud_eenheid, p.per); // via de inhoud van de prijs
  if (n === null && !bi && c && zelfde(c.eenheid, e)) n = vanProduct(b.hoeveelheid, c, p.per); // via inhoud per verpakking
  return n === null ? null : n * p.prijs;
}
/**
 * Prijzen per merk voor een boodschap (zelfde inhoud en hoeveelheid): per merk de goedkoopste winkel.
 * Alleen merken met een eigen prijs; [{ merk, p, kost }], van goedkoop naar duur.
 */
function merkPrijzen(b) {
  const merken = uniek((catalogusVan(b.naam)?.prijzen || []).map((p) => String(p.merk || '').trim()).filter(Boolean));
  const uit = [];
  for (const merk of merken) {
    const p = prijzenSorteren(prijzenVan(b.naam, { ...b, merk }))[0];
    if (!p || prijsMerk(p) !== merk.toLowerCase()) continue; // geen eigen prijs voor dit merk (en deze inhoud)
    uit.push({ merk, p, kost: kostprijs(b, p) });
  }
  return uit.sort((x, y) => (x.kost ?? Infinity) - (y.kost ?? Infinity) || x.merk.localeCompare(y.merk, 'nl'));
}
const lijstMelding = (naam, inh) => { const g = winkelVoor(naam, inh); return `${naam} staat op de boodschappenlijst${g ? ` (goedkoopst bij ${g.winkel})` : ''}`; };
const prijsRegelTekst = (p) => `${euro(p.prijs)} per ${perTekst(p.per)}`;

/** Invulvelden voor de prijzen: kies de eenheid (per kg, per stuk ...), één regel per winkel uit Instellingen, plus zelf winkels toevoegen. */
function prijzenVeldenHtml(prijzen, eenheid, standaardPer) {
  // een lege groep neemt de eenheid van de andere prijzen over (bv. per kg)
  const per = (prijzen || []).find((p) => p.per)?.per || standaardPer || prijsEenheid(eenheid);
  // een prijs die in een andere eenheid bewaard werd (bv. per g) tonen in de gekozen eenheid (per kg)
  prijzen = prijzen.map((p) => { const f = omrekenen(1, per, p.per); return f === null || p.per === per ? p : { ...p, prijs: Math.round(p.prijs * f * 1000) / 1000 }; });
  const vast = winkels().map((w) => ({ winkel: w, prijs: prijzen.find((p) => zelfde(p.winkel, w))?.prijs ?? null }));
  const extra = prijzen.filter((p) => !winkels().some((w) => zelfde(w, p.winkel)));
  const keuzes = prijsEenheden().includes(per) ? prijsEenheden() : [...prijsEenheden(), per];
  return `<label class="pz-per-rij"><span>Prijs per</span><select class="pz-per" aria-label="Prijs per eenheid">${keuzes.map((e) => `<option value="${esc(e)}"${e === per ? ' selected' : ''}>${esc(perTekst(e))}</option>`).join('')}</select></label>
    <p class="stil pz-uitleg">Bv. per kg zoals op het prijskaartje, ook als je per stuk of pak koopt. Laat leeg als je de prijs niet kent.</p>
    <p class="pz-uitleg pz-hint" hidden></p>
    <div class="pz-lijst">${vast.map((p) => prijsRijHtml(p, true)).join('')}${extra.map((p) => prijsRijHtml(p, false)).join('')}
      ${!vast.length && !extra.length ? prijsRijHtml({ winkel: '', prijs: null }, false) : ''}</div>
    <button type="button" class="chip pz-erbij">+ Andere winkel</button>`;
}
const prijsRijHtml = (p, vast) => `<div class="prijs-rij"${vast ? ` data-winkel="${esc(p.winkel)}"` : ''}>
    ${vast ? `<span class="pz-naam">${esc(p.winkel)}</span>` : `<input class="pz-winkel" placeholder="Winkel" value="${esc(p.winkel || '')}" autocapitalize="sentences" aria-label="Winkel">`}
    <span class="pz-euro"><span>€</span><input class="pz-prijs" inputmode="decimal" placeholder="–" value="${p.prijs !== null && p.prijs !== undefined ? esc(p.prijs.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 3, useGrouping: false })) : ''}" aria-label="Prijs bij ${esc(p.winkel || 'deze winkel')}"></span>
    ${vast ? '<span></span>' : '<button type="button" class="weg" data-pz-weg aria-label="Winkel weghalen">×</button>'}</div>`;
/** Uitleg als de prijs niet om te rekenen is naar wat je koopt (bv. per kg, maar het product per stuk zonder inhoud). */
function prijsHintZetten(el, eenheid, inhoudEenheid) {
  const hint = $('.pz-hint', el), per = $('select.pz-per', el)?.value;
  if (!hint || !per) return;
  const e = eenheid || 'stuks';
  const kan = omrekenen(1, e, per) !== null || (!!inhoudEenheid && TELBAAR.has(e) && omrekenen(1, inhoudEenheid, per) !== null);
  hint.hidden = kan;
  hint.textContent = kan ? '' : TELBAAR.has(e) && ['kg', 'g', 'l', 'ml'].includes(per)
    ? `Vul ook de inhoud per ${perTekst(e)} in (bij Bewerken), dan kan de prijs van je boodschappen berekend worden.`
    : `Een prijs per ${perTekst(per)} kan niet omgerekend worden naar ${perTekst(e)}: de prijs van je boodschappen wordt dan niet berekend.`;
}
/** Knoppen van de prijsvelden koppelen. `product` geeft { eenheid, inhoud_eenheid } van het product (voor de uitleg). */
function prijzenKoppelen(el, product = () => ({})) {
  const lijst = $('.pz-lijst', el), per = $('select.pz-per', el);
  const hint = () => { const p = product() || {}; prijsHintZetten(el, p.eenheid, p.inhoud_eenheid); };
  // zelf een eenheid gekozen: niet meer vanzelf aanpassen als de eenheid van het product verandert
  per.onchange = () => { per.dataset.zelf = '1'; hint(); };
  el.prijsHint = hint;
  hint();
  // zelf iets aangepast: niet meer vanzelf vervangen (bv. als je de inhoud wijzigt)
  if (!el.dataset.gekoppeld) { el.dataset.gekoppeld = '1'; ['input', 'change'].forEach((t) => el.addEventListener(t, (e) => { if (e.target.closest('.prijs-rij, .pz-per')) el.dataset.aangeraakt = '1'; })); }
  $$('.pz-winkel', lijst).forEach((v) => suggesties(v, winkels));
  $('.pz-erbij', el).onclick = () => {
    el.dataset.aangeraakt = '1';
    lijst.insertAdjacentHTML('beforeend', prijsRijHtml({ winkel: '', prijs: null }, false));
    const v = $$('.pz-winkel', lijst).pop();
    suggesties(v, winkels);
    v.focus();
  };
  lijst.onclick = (e) => { const w = e.target.closest('[data-pz-weg]'); if (w) { w.closest('.prijs-rij').remove(); el.dataset.aangeraakt = '1'; } };
}
/** Eenheid van het product veranderd: de prijs-eenheid mee aanpassen (tenzij je die zelf koos). */
const prijsPerZetten = (el, eenheid) => $$('select.pz-per', el).forEach((s) => {
  if (!s.dataset.zelf) {
    const e = prijsEenheid(eenheid);
    if (![...s.options].some((o) => o.value === e)) s.insertAdjacentHTML('beforeend', `<option value="${esc(e)}">${esc(perTekst(e))}</option>`);
    s.value = e;
  }
  const blok = s.closest('details, form, #paneel');
  if (blok && blok.prijsHint) blok.prijsHint();
});
/** Ingevulde prijzen lezen; null (met melding) als er iets niet klopt. */
function prijzenLezen(el, eenheid) {
  const uit = [], per = $('select.pz-per', el)?.value || prijsEenheid(eenheid);
  for (const r of $$('.prijs-rij', el)) {
    const winkel = (r.dataset.winkel || $('.pz-winkel', r)?.value || '').trim(), tekst = $('.pz-prijs', r).value.trim();
    if (!tekst) continue;
    const prijs = num(tekst.replace(/[€\s]/g, ''));
    if (prijs === null || prijs < 0) { toast(`Vul een geldige prijs in${winkel ? ' bij ' + winkel : ''}.`); return null; }
    if (!winkel) { toast('Vul bij elke prijs ook de winkel in.'); return null; }
    if (uit.some((p) => zelfde(p.winkel, winkel))) { toast(`${winkel} staat er twee keer bij.`); return null; }
    uit.push({ winkel, prijs, per });
  }
  return uit;
}
/**
 * Merken en inhouden waarvoor je een prijs kunt invullen: die van de prijzen, de catalogus, je voorraad en je boodschappen.
 * Elk als { merk, inhoud, inhoud_eenheid }; zonder merk en zonder inhoud zit er niet bij.
 */
function bekendeGroepen(naam, metInhoud = true) {
  const c = catalogusVan(naam);
  const telbaar = (x) => metInhoud && (x.prijs !== undefined || x.varianten !== undefined || TELBAAR.has(x.eenheid || 'stuks'));
  const bronnen = [...(c?.prijzen || []), ...(c ? variantenVan(c).map((v) => ({ ...v, varianten: true })) : []),
    ...S.producten.filter((p) => zelfde(p.naam, naam)), ...S.boodschappen.filter((b) => zelfde(b.naam, naam))];
  const uit = new Map();
  for (const x of bronnen) {
    const g = { merk: String(x.merk || '').trim(), ...(prijsSleutel(x) && telbaar(x) ? { inhoud: x.inhoud, inhoud_eenheid: x.inhoud_eenheid } : { inhoud: null, inhoud_eenheid: '' }) };
    if ((g.merk || prijsSleutel(g)) && !uit.has(groepSleutel(g))) uit.set(groepSleutel(g), g);
  }
  const grootte = (x) => (prijsSleutel(x) ? omrekenen(x.inhoud, x.inhoud_eenheid, ['ml', 'cl', 'dl', 'l'].includes(x.inhoud_eenheid) ? 'ml' : 'g') ?? x.inhoud : 0);
  return [...uit.values()].sort((a, b) => a.merk.localeCompare(b.merk, 'nl') || grootte(a) - grootte(b));
}
/** Overzicht van de prijzen van een product (voor het productpaneel en de catalogus), per inhoud. */
function prijzenBlok(naam) {
  const alle = prijzenVan(naam);
  if (!alle.length) return '';
  const c = catalogusVan(naam);
  const verpakking = c && TELBAAR.has(c.eenheid) ? c.eenheid : 'stuks';
  // bv. € 12,50 per kg · € 6,25 per pak (als de inhoud per pak bekend is)
  const perStuk = (p) => {
    if (zelfde(verpakking, p.per)) return '';
    const n = p.inhoud > 0 ? omrekenen(p.inhoud, p.inhoud_eenheid, p.per) : c && TELBAAR.has(c.eenheid) ? vanProduct(1, c, p.per) : null;
    return n === null ? '' : ` · ${euro(n * p.prijs)} per ${perTekst(verpakking)}`;
  };
  const sleutels = [...bekendeGroepen(naam).map(groepSleutel), '|'];
  for (const p of alle) if (!sleutels.includes(groepSleutel(p))) sleutels.splice(-1, 0, groepSleutel(p));
  const groepen = sleutels.map((k) => alle.filter((p) => groepSleutel(p) === k)).filter((l) => l.length);
  const kopjes = groepen.length > 1 || groepSleutel(groepen[0][0]) !== '|';
  const metMerk = alle.some((p) => prijsMerk(p));
  return `<div class="datumblok prijzen-blok"><div><b>Prijzen</b>${groepen.map((groep) => {
    const lijst = prijzenSorteren(groep);
    return (kopjes ? `<div class="pz-groep-titel">${esc(groepTitel(lijst[0], verpakking, metMerk, true))}</div>` : '')
      + lijst.map((p, i) => `<div class="stat"><span>${esc(p.winkel)}${i === 0 && lijst.length > 1 ? ' <small class="goedkoopst">goedkoopst</small>' : ''}</span>
    <span class="stil">${esc(prijsRegelTekst(p) + perStuk(p))}</span></div>`).join('');
  }).join('')}</div></div>`;
}
/** Titel van een groep prijzen: bv. "Lavazza · per pak à 500 g", "Per pak à 1 kg", "Lavazza". */
function groepTitel(inh, eenheid, metMerk = false, kort = false) {
  const merk = (inh && String(inh.merk || '').trim()) || '';
  const inhoud = prijsSleutel(inh) ? `per ${perTekst(TELBAAR.has(eenheid) ? eenheid : 'stuks')} ${inhoudLabel(inh)}` : '';
  const t = [merk, inhoud].filter(Boolean).join(' · ');
  if (t) return t.charAt(0).toUpperCase() + t.slice(1);
  const rest = metMerk ? 'Andere merken en inhouden' : 'Andere inhoud';
  return kort ? rest : `${rest} (zonder eigen prijs)`;
}
/** Eén blok prijsvelden voor één merk en/of inhoud (of zonder) in het prijzenpaneel. */
function prijsGroepHtml(inh, prijzen, eenheid, metKop, standaardPer, metMerk) {
  const k = prijsSleutel(inh), merk = (inh && String(inh.merk || '').trim()) || '';
  return `<section class="pz-groep" data-merk="${esc(merk)}" data-inhoud="${k ? esc(inh.inhoud) : ''}" data-inhoud-eenheid="${k ? esc(inh.inhoud_eenheid) : ''}">
    ${metKop ? `<h3 class="pz-groep-titel">${esc(groepTitel(inh, eenheid, metMerk))}</h3>` : ''}
    ${prijzenVeldenHtml(prijzen, eenheid, standaardPer)}</section>`;
}
/** Merk en inhoud van een groep prijsvelden (null: zonder merk en zonder inhoud). */
const groepInhoud = (g) => (g.dataset.inhoud || g.dataset.merk
  ? { merk: g.dataset.merk || '', ...(g.dataset.inhoud ? { inhoud: num(g.dataset.inhoud), inhoud_eenheid: g.dataset.inhoudEenheid } : { inhoud: null, inhoud_eenheid: '' }) } : null);
/** Paneel om alleen de prijzen van een product aan te passen: per inhoud een eigen prijs. */
function prijzenPaneel(naam, eenheid, terug) {
  paneelOpenen((el) => {
    if (alGetekend('prijzen')) return; // niet opnieuw tekenen terwijl je typt
    const c = catalogusVan(naam);
    const e = c?.eenheid || eenheid || 'stuks';
    const alle = c?.prijzen || [];
    const telbaar = TELBAAR.has(e);
    const bekend = bekendeGroepen(naam, telbaar);
    // prijzen van een merk of inhoud die nergens anders meer voorkomt, toch tonen
    for (const p of alle) if (groepSleutel(p) !== '|' && !bekend.some((g) => groepSleutel(g) === groepSleutel(p))) bekend.push({ merk: p.merk || '', inhoud: p.inhoud || null, inhoud_eenheid: p.inhoud_eenheid || '' });
    // zonder merk en inhoud: alleen tonen als er al zulke prijzen zijn, of als er geen enkel merk of inhoud gekend is
    const groepen = [...bekend, ...(!bekend.length || alle.some((p) => groepSleutel(p) === '|') ? [null] : [])];
    let metKop = groepen.length > 1 || !!groepen[0];
    const metMerk = () => $$('.pz-groep', el).some((g) => g.dataset.merk);
    el.innerHTML = `${paneelKop('Prijzen', esc(naam))}
      <form id="pz-form" autocomplete="off">
        <p class="stil pz-uitleg">${telbaar ? 'Elk merk en elke inhoud heeft zijn eigen prijs: een groot pak is vaak goedkoper per kg.' : 'Elk merk heeft zijn eigen prijs.'}</p>
        <div id="pz-groepen">${groepen.map((g) => prijsGroepHtml(g, alle.filter((p) => groepSleutel(p) === groepSleutel(g || {})), e, metKop, prijsPerVan(alle, e), groepen.some((x) => x && x.merk))).join('')}</div>
        <details class="meer" id="pz-nieuw" style="margin-top:.8rem"><summary>+ Prijs voor een ander merk${telbaar ? ' of een andere inhoud' : ''}</summary>
          <label class="veld"><span>Merk${telbaar ? ' (mag leeg)' : ''}</span><input id="pz-nieuw-merk" placeholder="bv. Lavazza" autocomplete="off" autocapitalize="words"></label>
          ${telbaar ? `<div class="rij2"><label class="veld"><span>Inhoud per ${esc(perTekst(e))} (mag leeg)</span><input id="pz-nieuw-inhoud" inputmode="decimal" placeholder="bv. 1"></label>
            <label class="veld"><span>Eenheid inhoud</span><select id="pz-nieuw-eenheid">${inhoudOpties('', 'kg')}</select></label></div>` : ''}
          <button type="button" class="knop" id="pz-nieuw-ok">Toevoegen</button></details>
        <p class="stil pz-uitleg" style="margin-top:.8rem">Op je boodschappenlijst komt ${esc(naam)} bij de goedkoopste winkel voor het merk en de inhoud die je koopt.</p>
        <div class="paneel-voet"><button type="submit" class="knop primair">Bewaren</button></div></form>`;
    sluitKnoppen(el);
    const koppelen = (g) => prijzenKoppelen(g, () => ({ eenheid: e, inhoud_eenheid: g.dataset.inhoudEenheid || (c?.inhoud > 0 ? c.inhoud_eenheid : '') }));
    $$('.pz-groep', el).forEach(koppelen);
    $('#pz-nieuw-ok', el).onclick = () => {
      const merk = $('#pz-nieuw-merk', el).value.trim();
      const tekst = telbaar ? $('#pz-nieuw-inhoud', el).value.trim() : '', i = num(tekst);
      if (tekst && !(i > 0)) { toast('Vul een geldige inhoud in, of laat het veld leeg.'); $('#pz-nieuw-inhoud', el).focus(); return; }
      if (!merk && !(i > 0)) { toast(telbaar ? 'Vul een merk en/of een inhoud in.' : 'Vul een merk in.'); $('#pz-nieuw-merk', el).focus(); return; }
      const inh = { merk, ...(i > 0 ? { inhoud: i, inhoud_eenheid: $('#pz-nieuw-eenheid', el).value } : { inhoud: null, inhoud_eenheid: '' }) };
      let g = $$('.pz-groep', el).find((x) => groepSleutel(groepInhoud(x) || {}) === groepSleutel(inh));
      if (!g) {
        $('#pz-groepen', el).insertAdjacentHTML('beforeend', prijsGroepHtml(inh, [], e, true, $('select.pz-per', el)?.value || prijsPerVan(alle, e)));
        g = $$('.pz-groep', el).pop();
        koppelen(g);
        // alle groepen krijgen (opnieuw) een kopje, nu er misschien merken bij zijn
        metKop = true;
        $$('.pz-groep', el).forEach((x) => { $('.pz-groep-titel', x)?.remove(); x.insertAdjacentHTML('afterbegin', `<h3 class="pz-groep-titel">${esc(groepTitel(groepInhoud(x), e, metMerk()))}</h3>`); });
      }
      $('#pz-nieuw-merk', el).value = ''; if (telbaar) $('#pz-nieuw-inhoud', el).value = ''; $('#pz-nieuw', el).open = false;
      g.scrollIntoView({ block: 'nearest' });
      $('.pz-prijs', g)?.focus();
    };
    $('#pz-form', el).onsubmit = async (ev) => {
      ev.preventDefault();
      const prijzen = [];
      for (const g of $$('.pz-groep', el)) {
        const lijst = prijzenLezen(g, e);
        if (!lijst) return;
        prijzen.push(...lijst.map((p) => ({ ...p, ...(groepInhoud(g) || {}) })));
      }
      try { await api('POST', 'prijzen', { naam, eenheid: e, prijzen }); } catch { return; }
      toast('Prijzen bewaard');
      if (terug) terug(); else paneelSluiten();
    };
  });
}
/**
 * Prijsvelden in een formulier (product, catalogus, boodschap): ze horen bij het merk en de inhoud die in dat formulier staan.
 * `pz` is het <details>-blok; `inh` het merk en de inhoud ({ merk, inhoud, inhoud_eenheid } of null).
 */
function formPrijzenZetten(pz, naam, eenheid, inh, product) {
  const k = prijsSleutel(inh), merk = (inh && String(inh.merk || '').trim()) || '';
  const voor = [merk, k ? `${perTekst(TELBAAR.has(eenheid) ? eenheid : 'stuks')} ${inhoudLabel(inh)}` : ''].filter(Boolean).join(', ');
  const label = `Prijs per winkel${voor ? ` <small class="stil">voor ${esc(voor)}</small>` : ''}`;
  pz.dataset.merk = merk;
  pz.dataset.inhoud = k ? inh.inhoud : ''; pz.dataset.inhoudEenheid = k ? inh.inhoud_eenheid : '';
  // zelf prijzen ingevuld: die laten staan, ze gelden nu voor de nieuwe inhoud
  if (pz.dataset.aangeraakt && $('summary', pz)) { $('summary', pz).innerHTML = label; pz.prijsHint?.(); return; }
  pz.innerHTML = `<summary>${label}</summary>${prijzenVeldenHtml(naam ? prijzenVan(naam, inh || null) : [], eenheid, naam ? prijsPerVan(prijzenVan(naam), eenheid) : undefined)}`;
  prijzenKoppelen(pz, product);
}
/** Het merk en de inhoud waarvoor de prijsvelden van een formulier gelden, voor de API (`prijzen_inhoud`). */
const formPrijzenInhoud = (pz) => groepInhoud(pz);
/** Merk en inhoud uit de velden van een formulier lezen zonder meldingen (null als beide leeg zijn; een ongeldige inhoud telt als leeg). */
function formInhoud(el, id, eenheid) {
  const i = num($(`#${id}-inhoud`, el)?.value || ''), merk = ($(`#${id}-merk`, el)?.value || '').trim();
  const inh = TELBAAR.has(eenheid || 'stuks') && i > 0 ? { inhoud: i, inhoud_eenheid: $(`#${id}-inhoud-eenheid`, el).value } : null;
  return inh || merk ? { merk, ...(inh || { inhoud: null, inhoud_eenheid: '' }) } : null;
}

/** Suggesties onder een invoerveld: pas na 2 letters, als kleine knoppen (geen uitklapmenu). */
function suggesties(veld, bron, gekozen) {
  const doos = document.createElement('div');
  doos.className = 'suggesties';
  doos.hidden = true;
  veld.insertAdjacentElement('afterend', doos);
  const tonen = () => {
    const q = veld.value.trim().toLowerCase();
    const lijst = q.length < 2 ? [] : bron().filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
      .sort((a, b) => a.toLowerCase().startsWith(q) ? -1 : b.toLowerCase().startsWith(q) ? 1 : 0).slice(0, 5);
    doos.innerHTML = lijst.map((n) => `<button type="button" class="chip">${esc(n)}</button>`).join('');
    doos.hidden = !lijst.length;
    $$('button', doos).forEach((b, i) => {
      b.onmousedown = (e) => e.preventDefault(); // veld niet laten blurren voor de klik
      b.onclick = () => { veld.value = lijst[i]; doos.hidden = true; if (gekozen) gekozen(lijst[i]); };
    });
  };
  veld.addEventListener('input', tonen);
  veld.addEventListener('blur', () => setTimeout(() => (doos.hidden = true), 150));
}
const fijneMuis = () => window.matchMedia('(pointer: fine)').matches;

// ---------------------------------------------------------------------------
// Navigatie
// ---------------------------------------------------------------------------
$$('[data-icoon]').forEach((el) => (el.innerHTML = ICOON[el.dataset.icoon]));
const VIEWS = ['voorraad', 'boodschappen', 'catalogus', 'recepten', 'planner', 'instellingen'];
function naar(view) {
  ui.view = VIEWS.includes(view) ? view : 'voorraad';
  if (location.hash !== '#' + ui.view) history.replaceState(null, '', '#' + ui.view);
  tekenen();
  window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-actie="naar"]');
  if (el) naar(el.dataset.view);
});

function tekenen() {
  eigenEenhedenZetten(eenheden()); // zelf toegevoegde eenheden herkennen bij het typen (bv. "2 bokaal augurken")
  $$('.navigatie button').forEach((b) => b.classList.toggle('actief', b.dataset.view === ui.view));
  const open = S.boodschappen.filter((b) => !b.afgevinkt).length;
  $('#teller').hidden = !open;
  $('#teller').textContent = open;
  const actief = document.activeElement;
  const herstel = actief && actief.id && actief.matches('input') ? { id: actief.id, pos: actief.selectionStart } : null;
  ({ voorraad: tekenVoorraad, boodschappen: tekenBoodschappen, catalogus: tekenCatalogus, recepten: tekenRecepten, planner: tekenPlanner, instellingen: tekenInstellingen })[ui.view]();
  if (herstel) { const el = document.getElementById(herstel.id); if (el) { el.focus(); try { el.setSelectionRange(herstel.pos, herstel.pos); } catch { /* */ } } }
}
/** Inhoud vervangen, maar een zoekveld waarin je typt laten staan (anders sluit het toetsenbord op de smartphone). */
function inhoudZetten(html) {
  const inhoud = $('#inhoud'), actief = document.activeElement;
  const oud = actief && actief.id && actief.matches('.zoek input') && inhoud.contains(actief) ? actief.closest('.zoek') : null;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const nieuw = oud && tmp.querySelector('#' + actief.id)?.closest('.zoek');
  if (!nieuw || nieuw.parentNode !== tmp || oud.parentNode !== inhoud) { inhoud.innerHTML = html; return; }
  const kinderen = [...tmp.childNodes], plek = kinderen.indexOf(nieuw);
  [...inhoud.childNodes].forEach((k) => { if (k !== oud) k.remove(); });
  oud.before(...kinderen.slice(0, plek));
  oud.after(...kinderen.slice(plek + 1));
}
const instellingenKnop = `<button class="icoon alleen-mobiel" data-actie="naar" data-view="instellingen" aria-label="Instellingen">${ICOON.tandwiel}</button>`;

// ---------------------------------------------------------------------------
// VOORRAAD
// ---------------------------------------------------------------------------
// Een geopende verpakking telt als opgebruikt: ze staat nog in je voorraad (om op te maken), maar niet in de aantallen of het minimum.
const geopendTekst = (p) => (p && p.geopend ? `geopend ${dagenTot(p.geopend) === 0 ? 'vandaag' : dagenTot(p.geopend) === -1 ? 'gisteren' : 'op ' + datumNL(p.geopend)}` : '');
/** Hoeveel er (ongeopend) in huis is van een groep voorraadregels, bv. "2 pak à 500 g + 1 pak à 1 kg". */
function groepHoeveelheid(regels) {
  const per = new Map();
  for (const p of regels.filter((x) => !x.geopend && x.hoeveelheid > 0)) {
    const k = `${p.eenheid}|${prijsSleutel(inhoudVan(p) ? p : {})}|${p.uitlekgewicht ? 1 : 0}`;
    if (per.has(k)) per.get(k).hoeveelheid += p.hoeveelheid; else per.set(k, { ...p });
  }
  return [...per.values()].map((p) => voorraadTekst({ ...p, hoeveelheid: Math.round(p.hoeveelheid * 1000) / 1000 })).join(' + ');
}
const opTeGebruikenRij = ({ p, h }) => `<li><button class="rij" data-product="${p.id}">
      <span class="stip ${h.kleur}"></span>
      <span class="naam">${esc(p.naam)}${merkTekst(p)}${p.geopend ? '<span class="geopend-tag">geopend</span>' : ''}<small>${esc(h.uitleg)}</small></span>
      <span class="rechts ${h.kleur}">${esc(h.kort)}</span>
    </button></li>`;
function tekenVoorraad() {
  const zoek = ui.zoek.trim().toLowerCase();
  const passend = S.producten.filter((p) => (!zoek || `${p.naam} ${p.merk || ''} ${p.locatie} ${p.categorie} ${p.notitie} ${p.barcode || ''}${p.geopend ? ' geopend' : ''}`.toLowerCase().includes(zoek)));
  const metH = passend.map((p) => ({ p, h: houdbaarheid(p) }));
  const opTeGebruiken = opTeGebruikenVan(passend);


  // Alle producten per categorie (uitklapbaar), per product en merk één regel met wat er (ongeopend) in huis is.
  // Wat op is (0), staat onderaan bij "Op", elk apart.
  const groepen = new Map();
  for (const { p } of metH.filter((x) => x.p.hoeveelheid > 0)) {
    const k = `${p.naam.trim().toLowerCase()}|${String(p.merk || '').trim().toLowerCase()}|${maatVan(p)}`;
    if (!groepen.has(k)) groepen.set(k, []);
    groepen.get(k).push(p);
  }
  const perCategorie = new Map();
  const op = metH.filter((x) => !(x.p.hoeveelheid > 0)).map((x) => x.p).sort((a, b) => a.naam.localeCompare(b.naam, 'nl') || (a.merk || '').localeCompare(b.merk || '', 'nl'));
  for (const g of groepen.values()) {
    const cat = (g.find((p) => (p.categorie || '').trim())?.categorie || '').trim() || ZONDER_CATEGORIE;
    if (!perCategorie.has(cat)) perCategorie.set(cat, []);
    perCategorie.get(cat).push(g);
  }
  const opNaam = (a, b) => a[0].naam.localeCompare(b[0].naam, 'nl') || (a[0].merk || '').localeCompare(b[0].merk || '', 'nl');
  const cats = [...perCategorie.keys()].sort((a, b) => (a === ZONDER_CATEGORIE) - (b === ZONDER_CATEGORIE) || a.localeCompare(b, 'nl'));
  const groepRij = (g) => {
    const open = g.filter((p) => p.geopend && p.hoeveelheid > 0);
    const hoeveel = groepHoeveelheid(g);
    const onder = open.length ? (open.length === 1 ? geopendTekst(open[0]) : `${open.length} geopend`) : '';
    return `<li><button class="rij${hoeveel ? '' : ' alleen-geopend'}" data-groep="${g.map((p) => p.id).join(',')}">
      <span class="naam">${esc(g[0].naam)}${merkTekst(g[0])}${onder ? `<small class="geopend-tekst">${esc(onder)}</small>` : ''}</span>
      <span class="rechts">${hoeveel ? esc(hoeveel) : 'geopend'}</span></button></li>`;
  };

  let lijst = '';
  if (!S.producten.length) {
    lijst = `<div class="leeg"><b>Nog niets in je voorraad</b>Tik op + om je eerste product toe te voegen.</div>`;
  } else if (!passend.length) {
    lijst = `<div class="leeg">Niets gevonden.</div>`;
  } else {
    if (opTeGebruiken.length) lijst += `<section class="sectie"><div class="sectie-titel">Op te gebruiken</div><ul class="lijst">${opTeGebruiken.map(opTeGebruikenRij).join('')}</ul></section>`;
    // overzicht van alles wat geopend is, het langst geopend bovenaan
    const geopend = metH.filter((x) => x.p.geopend && x.p.hoeveelheid > 0).sort((a, b) => a.p.geopend.localeCompare(b.p.geopend) || a.p.naam.localeCompare(b.p.naam, 'nl'));
    if (geopend.length) lijst += `<section class="sectie voorraad-geopend"><div class="sectie-titel"><span>Geopend</span><span>${geopend.length}</span></div><ul class="lijst">${geopend.map(({ p, h }) => {
      const dagen = -dagenTot(p.geopend);
      const onder = [geopendTekst(p) + (dagen > 1 ? ` (${dagen} dagen)` : ''), h.niveau > 0 ? h.uitleg : ''].filter(Boolean).join(' · ');
      return `<li><button class="rij" data-product="${p.id}">${h.niveau > 0 ? `<span class="stip ${h.kleur}"></span>` : ''}
        <span class="naam">${esc(p.naam)}${merkTekst(p)}<small class="geopend-tekst">${esc(onder)}</small></span>
        <span class="rechts${h.niveau > 0 ? ' ' + h.kleur : ''}">${esc(h.niveau > 0 ? h.kort : voorraadTekst(p))}</span></button></li>`;
    }).join('')}</ul></section>`;
    // elke categorie is uitklapbaar (dicht tot je erop tikt; open/dicht blijft onthouden zolang de app open is);
    // tijdens het zoeken staat alles open, zodat je meteen ziet wat je vond
    if (cats.length) lijst += `<div class="sectie-titel voorraad-alles">Alle producten</div>` + cats.map((k) => {
      const g = perCategorie.get(k).sort(opNaam), sleutel = `voorraad-categorie:${k.toLowerCase()}`;
      return `<details class="sectie uitklap voorraad-groep" data-uitklap="${esc(sleutel)}"${zoek || ui.uitgeklapt.has(sleutel) ? ' open' : ''}>
        <summary><span>${esc(k)}</span><span class="stil">${g.length}</span></summary><ul class="lijst">${g.map(groepRij).join('')}</ul></details>`;
    }).join('');
    if (op.length) lijst += `<section class="sectie"><div class="sectie-titel">Op</div><ul class="lijst">${op.map((p) =>
      `<li><button class="rij op" data-product="${p.id}"><span class="naam">${esc(p.naam)}${merkTekst(p)}</span><span class="rechts">op</span></button></li>`).join('')}</ul></section>`;
  }

  inhoudZetten(`
    <header class="kop"><h1>Voorraad</h1>
      <div class="kop-acties">
        ${instellingenKnop}
        <button class="knop primair" id="nieuw">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}<span>Toevoegen</span></button>
      </div></header>
    <div class="installeer-tip" id="installeer-tip" hidden></div>
    ${S.producten.length ? `
    <div class="zoek">${ICOON.zoek}<input type="search" id="zoek-voorraad" placeholder="Zoeken in voorraad" value="${esc(ui.zoek)}" autocomplete="off"></div>` : ''}
    ${lijst}`);
  installTipTekenen();
  $m('#nieuw').onclick = () => productFormulier(null);
  const z = $m('#zoek-voorraad');
  if (z) z.oninput = () => { ui.zoek = z.value; tekenVoorraad(); };
  $$m('[data-product]').forEach((b) => (b.onclick = () => productPaneel(+b.dataset.product)));
  $$m('[data-groep]').forEach((b) => (b.onclick = () => {
    const ids = b.dataset.groep.split(',').map(Number);
    if (ids.length === 1) productPaneel(ids[0]); else partijenPaneel(ids);
  }));
  if (!zoek) $$m('.voorraad-groep[data-uitklap]').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) ui.uitgeklapt.add(d.dataset.uitklap); else ui.uitgeklapt.delete(d.dataset.uitklap);
  }));
}

// Meerdere partijen van hetzelfde product: kies welke je wilt bekijken
function partijenPaneel(ids) {
  paneelOpenen((el) => {
    const lijst = ids.map((id) => S.producten.find((p) => p.id === id)).filter(Boolean)
      .sort((a, b) => !b.geopend - !a.geopend || (a.vervaldatum || '9999').localeCompare(b.vervaldatum || '9999'));
    if (!lijst.length) return paneelSluiten();
    if (lijst.length === 1) return productPaneel(lijst[0].id);
    el.innerHTML = `${paneelKop(esc(lijst[0].naam), 'Kies welke je wilt bekijken')}
      <ul class="lijst">${lijst.map((p) => `<li><button class="rij" data-partij="${p.id}"><span class="naam">${
        esc(p.vervaldatum ? `${TYPE_LANG[p.datumtype] || TYPE_LANG.THT} ${datumNL(p.vervaldatum, true)}` : 'Geen houdbaarheidsdatum')
      }<small>${esc([geopendTekst(p), p.merk, maatWoord(maatVan(p)), p.locatie, p.categorie].filter(Boolean).join(' · ') || ' ')}</small></span><span class="rechts">${esc(p.hoeveelheid > 0 ? voorraadTekst(p) : 'op')}</span></button></li>`).join('')}</ul>`;
    sluitKnoppen(el);
    $$('[data-partij]', el).forEach((b) => (b.onclick = () => productPaneel(+b.dataset.partij)));
  });
}

// Productpaneel: hoeveelheid, houdbaarheid en acties
function productPaneel(id) {
  paneelOpenen((el) => {
    const p = S.producten.find((x) => x.id === id);
    if (!p) return paneelSluiten();
    const telbaar = TELBAAR.has(p.eenheid);
    const inh = inhoudVan(p);
    const h = houdbaarheid(p);
    const d = p.vervaldatum ? dagenTot(p.vervaldatum) : null;
    let datum = '<div class="datumblok"><span class="stip"></span><div>Geen houdbaarheidsdatum</div></div>';
    if (p.vervaldatum) {
      const uitleg = h.niveau === 4 ? 'Verlopen: niet meer eten.' : h.niveau === 2 ? 'Datum voorbij, maar meestal nog goed: kijk, ruik en proef.'
        : d >= 0 ? wanneer(d).replace(/^./, (c) => c.toUpperCase()) + '.' : '';
      datum = `<div class="datumblok"><span class="stip ${h.kleur || 'groen'}"></span><div>${TYPE_LANG[p.datumtype] || TYPE_LANG.THT} ${esc(datumNL(p.vervaldatum, true))}<small>${esc(uitleg)}</small></div></div>`;
    }
    const delen = !telbaar && p.hoeveelheid > 0 ? [[p.hoeveelheid / 4, '¼'], [p.hoeveelheid / 2, '½'], [null, 'Alles']] : [];
    el.innerHTML = `
      ${paneelKop(esc(p.naam), esc([p.merk, maatWoord(maatVan(p)), p.locatie, p.categorie].filter(Boolean).join(' · ')))}
      ${p.geopend ? `<div class="geopend-blok"><span class="geopend-tag">geopend</span><div>${esc(geopendTekst(p).replace(/^./, (c) => c.toUpperCase()))}<small>Telt als opgebruikt: niet meegeteld in je voorraad en het minimum.</small></div></div>` : ''}
      <div class="hoeveelheid">
        ${telbaar ? `<button class="rond" id="min" aria-label="Eén minder" ${p.hoeveelheid >= 1 ? '' : 'disabled'}>−</button>` : ''}
        <div class="getal">${esc(fmt(p.hoeveelheid))}<span>${esc(p.eenheid === 'stuks' ? (p.hoeveelheid === 1 ? 'stuk' : 'stuks') : p.eenheid)}</span>${inh ? `<small class="inhoud-per">à ${esc(hoeveelTekst(inh.per, inh.eenheid))}${esc(uitlekTekst(p))}${p.hoeveelheid > 0 && p.hoeveelheid !== 1 ? ` · samen ${esc(samenTekst(p.hoeveelheid * inh.per, inh.eenheid))}` : ''}</small>` : uitlekTekst(p) ? '<small class="inhoud-per">uitlekgewicht</small>' : ''}</div>
        ${telbaar ? '<button class="rond" id="plus" aria-label="Eén meer">+</button>' : ''}
      </div>
      ${delen.length ? `<div class="gebruik"><span class="stil" style="align-self:center;margin-right:.2rem">Gebruikt:</span>${delen.map(([w, t]) => `<button class="chip" data-deel="${w ?? ''}">${t}</button>`).join('')}<button class="chip" id="ander">Andere hoeveelheid</button></div>` : ''}
      ${datum}
      ${prijzenBlok(p.naam)}
      <ul class="acties">
        ${p.geopend ? `<li><button id="leeg">Op (weggooien of opgebruikt)</button></li><li><button id="sluiten">Toch niet geopend</button></li>`
          : p.hoeveelheid > 0 ? `<li><button id="openen">${telbaar && p.hoeveelheid > 1 ? `1 ${esc(p.eenheid === 'stuks' ? 'stuk' : meervoud(p.eenheid, 1))} geopend` : 'Geopend'} <small class="stil">telt als opgebruikt</small></button></li>` : ''}
        <li><button id="erbij">Nieuwe verpakking toevoegen</button></li>
        <li><button id="lijst">Op boodschappenlijst</button></li>
        ${p.grootverpakking?.potten && p.eenheid !== 'pot' && p.eenheid !== p.grootverpakking.eenheid ? `<li><button id="groot-erbij">${esc(grootNaam(p.grootverpakking))} erbij <small class="stil">+${esc(fmt(p.grootverpakking.potten))} ${esc(meervoud(p.eenheid, p.grootverpakking.potten))} in je voorraad</small></button></li>` : ''}
        ${p.grootverpakking ? `<li><button id="lijst-groot">Grote verpakking op boodschappenlijst <small class="stil">${esc(grootTekst(p.grootverpakking, p.eenheid))}</small></button></li>` : ''}
        <li><button id="prijzen">${prijzenVan(p.naam).length ? 'Prijzen aanpassen' : 'Prijzen invullen'}</button></li>
        ${p.hoeveelheid > 0 ? '<li><button id="weggooien">Weggooien</button></li>' : ''}
        <li><button id="bewerk">Bewerken</button></li>
        <li><button id="verwijder" class="gevaar">Verwijderen</button></li>
      </ul>`;
    sluitKnoppen(el);
    const knop = (id, f) => { const b = $('#' + id, el); if (b) b.onclick = f; };
    knop('min', () => verbruiken(p, 1, 'verbruikt', false));
    knop('plus', () => api('PUT', `producten/${p.id}`, { hoeveelheid: p.hoeveelheid + 1 }));
    $$('[data-deel]', el).forEach((b) => (b.onclick = () => verbruiken(p, b.dataset.deel ? +b.dataset.deel : null, 'verbruikt', !b.dataset.deel)));
    knop('ander', async () => {
      const w = num(await vraag(`Hoeveel ${p.eenheid} van ${p.naam} heb je gebruikt?`, { invoer: true, numeriek: true, ja: 'Bewaren' }));
      if (w && w > 0) verbruiken(p, Math.min(w, p.hoeveelheid), 'verbruikt', w >= p.hoeveelheid);
    });
    knop('erbij', () => productFormulier(null, { naam: p.naam, categorie: p.categorie, eenheid: p.eenheid, locatie: p.locatie,
      datumtype: p.datumtype, barcode: p.barcode || '', hoeveelheid: telbaar ? 1 : p.hoeveelheid || 1,
      inhoud: p.inhoud || null, inhoud_eenheid: p.inhoud_eenheid || '', uitlekgewicht: !!p.uitlekgewicht, merk: p.merk || '', verpakking: maatVan(p) }));
    knop('lijst', async () => { await api('POST', 'boodschappen', { naam: p.naam, eenheid: p.eenheid, inhoud: p.inhoud || null, inhoud_eenheid: p.inhoud_eenheid || '', merk: p.merk || '', verpakking: maatVan(p), product_id: p.id }); toast(lijstMelding(p.naam, p)); });
    knop('groot-erbij', async () => {
      const n = p.grootverpakking.potten, voor = p.hoeveelheid || 0;
      await api('PUT', `producten/${p.id}`, { hoeveelheid: Math.round((voor + n) * 1000) / 1000 });
      toast(`+${fmt(n)} ${meervoud(p.eenheid, n)} ${p.naam}`, 'Ongedaan maken', () => api('PUT', `producten/${p.id}`, { hoeveelheid: voor }));
    });
    knop('lijst-groot', async () => {
      const g = p.grootverpakking;
      await api('POST', 'boodschappen', { naam: p.naam, hoeveelheid: 1, eenheid: g.eenheid, inhoud: g.inhoud || null, inhoud_eenheid: g.inhoud_eenheid || '', product_id: p.id, potten_voor: p.id });
      toast(`1 ${meervoud(g.eenheid, 1)} ${p.naam} op je lijst`);
    });
    knop('prijzen', () => prijzenPaneel(p.naam, p.eenheid, () => productPaneel(p.id)));
    knop('weggooien', () => verbruiken(p, null, 'weggegooid', true));
    knop('openen', () => openen(p));
    knop('leeg', () => verbruiken(p, null, 'verbruikt', true));
    knop('sluiten', async () => { await api('POST', `producten/${p.id}/sluiten`, {}); paneelSluiten(); toast(`${p.naam} staat weer als ongeopend in je voorraad`); });
    knop('bewerk', () => productFormulier(p));
    knop('verwijder', async () => {
      if (!(await vraag(`${p.naam} verwijderen?`, { ja: 'Verwijderen', gevaar: true }))) return;
      const oud = { ...p };
      paneelSluiten();
      await api('DELETE', `producten/${p.id}`);
      toast(`${oud.naam} verwijderd`, 'Ongedaan maken', () => api('POST', 'producten', oud));
    });
  });
}

// ---------------------------------------------------------------------------
// CATALOGUS: alle producten die ooit werden toegevoegd (eigen tabblad)
// ---------------------------------------------------------------------------
/** Varianten van een catalogusproduct (ander merk en/of andere inhoud); oudere gegevens: één variant uit het product zelf. */
const variantenVan = (c) => (Array.isArray(c.varianten) && c.varianten.length ? c.varianten
  : [{ merk: c.merk || '', inhoud: c.inhoud > 0 ? c.inhoud : null, inhoud_eenheid: c.inhoud > 0 ? c.inhoud_eenheid || '' : '', uitlekgewicht: !!c.uitlekgewicht, ...(maatVan(c) ? { verpakking: maatVan(c) } : {}) }]);
const variantSleutel = (v) => `${String((v && v.merk) || '').trim().toLowerCase()}|${prijsSleutel(v)}${maatVan(v) ? `|${maatVan(v)}` : ''}`;
/** Hoort een voorraadregel bij deze variant? Met maar één variant: alles met die naam. */
const hoortBijVariant = (p, c, v) => zelfde(p.naam, c.naam) && (variantenVan(c).length < 2 || variantSleutel(p) === variantSleutel(v));
/** Heeft dit product meer dan één merk of inhoud in de catalogus? */
const meerVarianten = (naam) => { const c = catalogusVan(naam); return !!c && variantenVan(c).length > 1; };
const variantLabel = (v) => [v.merk, inhoudLabel(v), maatVan(v) ? `(${maatWoord(maatVan(v))})` : ''].filter(Boolean).join(' ') || 'zonder merk';
/** Hoeveel heb je in huis van alle merken en inhouden samen (in de eenheid van het product)? Met `maat`: alleen die grootte. */
function totaalInHuis(naam, maat) {
  const c = catalogusVan(naam), eenheid = c?.eenheid || S.producten.find((p) => zelfde(p.naam, naam))?.eenheid || 'stuks';
  return S.producten.filter((p) => zelfde(p.naam, naam) && !p.geopend && (maat === undefined || maatVan(p) === maat)).reduce((s, p) => s + (omrekenen(p.hoeveelheid || 0, p.eenheid || 'stuks', eenheid)
    ?? (TELBAAR.has(p.eenheid || 'stuks') && TELBAAR.has(eenheid) ? p.hoeveelheid || 0 : 0)), 0);
}
/** Grote verpakking van een product leesbaar, bv. "1 zak à 5 kg · vult ±4 potten". */
const grootTekst = (g, eenheid) => [`1 ${g.eenheid === 'stuks' ? 'stuk' : g.eenheid}${g.inhoud > 0 ? ` à ${hoeveelTekst(g.inhoud, g.inhoud_eenheid)}` : ''}`,
  g.potten ? (eenheid === 'pot' ? `vult ±${fmt(g.potten)} ${meervoud('pot', g.potten)}` : `met ${fmt(g.potten)} ${meervoud(eenheid, g.potten)}`) : ''].filter(Boolean).join(' · ');
/** "Doos", "Zak" ... van een grote verpakking, met hoofdletter. */
const grootNaam = (g) => { const t = g.eenheid === 'stuks' ? 'Verpakking' : g.eenheid; return t.charAt(0).toUpperCase() + t.slice(1); };
/**
 * Geldt het minimum voor alle groottes nog? Niet als kleine en/of grote verpakkingen een eigen minimum hebben en het product
 * niets heeft van de andere groottes (geen voorraadregel, geen variant): dan is het een overblijfsel van vroeger, dat pas
 * weer geldt als je iets van die andere grootte koopt (zoals in lokaal.js, minimumControleren).
 */
function algemeenMinimumGeldt(c) {
  const rest = ['', 'klein', 'groot'].filter((m) => !(m && catMinimum(c, m)));
  return rest.length === 3 || S.producten.some((p) => zelfde(p.naam, c.naam) && rest.includes(maatVan(p)))
    || variantenVan(c).some((v) => rest.includes(maatVan(v)));
}
const minimumTekst = (c) => ['', 'klein', 'groot'].filter((m) => catMinimum(c, m) && (m || algemeenMinimumGeldt(c))).map((m) =>
  `minimum ${hoeveelTekst(catMinimum(c, m), c.eenheid || 'stuks') || fmt(catMinimum(c, m))}${m ? ` ${m === 'groot' ? 'grote' : 'kleine'} verpakkingen` : ''} in huis, alle merken samen`).join(' · ');
// Vinkje "Minimum voor alle merken samen" (in de catalogus, bij voorraad toevoegen en bij boodschappen); het minimum hoort bij het catalogusproduct.
const minimumVinkjeHtml = (id, minimum) => `<label class="vink uitlek-vink"><input type="checkbox" id="${id}-alle-aan" ${minimum > 0 ? 'checked' : ''}><span class="vakje"></span>
    <span><span id="${id}-alle-titel">Minimum voor alle merken samen</span> <small class="stil">alle merken en inhouden tellen samen (kleine en grote verpakkingen elk apart); het tekort komt zonder merk en inhoud op je boodschappenlijst</small></span></label>
  <label class="veld" id="${id}-alle-veld"${minimum > 0 ? '' : ' hidden'}><span>Minimum in huis</span><input id="${id}-alle" inputmode="decimal" value="${minimum > 0 ? esc(fmt(minimum)) : ''}" placeholder="bv. 3"></label>`;
/** Bij een kleine of grote verpakking geldt het minimum alleen voor die grootte: titel aanpassen. */
function minimumVinkjeMaat(el, id, herladen = true) {
  const t = $(`#${id}-alle-titel`, el), aan = $(`#${id}-alle-aan`, el);
  if (!t || !aan) return;
  const m = maatLezen(el, id);
  t.textContent = m ? `Minimum voor alle merken samen, ${m === 'groot' ? 'grote' : 'kleine'} verpakkingen` : 'Minimum voor alle merken samen';
  // het minimum dat in de catalogus staat voor deze grootte tonen (zolang je het zelf niet aanraakte)
  if (herladen && aan.dataset.naam) minimumVinkjeZetten(el, id, aan.dataset.naam);
}
function minimumVinkjeKoppelen(el, id) {
  const aan = $(`#${id}-alle-aan`, el), veld = $(`#${id}-alle`, el);
  if (!aan) return;
  aan.onchange = () => {
    aan.dataset.aangeraakt = '1';
    $(`#${id}-alle-veld`, el).hidden = !aan.checked;
    if (aan.checked) { if (!veld.value) veld.value = '1'; veld.focus(); veld.select(); }
  };
  veld.addEventListener('input', () => { aan.dataset.aangeraakt = '1'; });
}
/** Het vinkje tonen zoals het in de catalogus staat (zolang je het zelf niet aanraakte). */
function minimumVinkjeZetten(el, id, naam, ookAangeraakt = false) {
  const aan = $(`#${id}-alle-aan`, el);
  if (aan) aan.dataset.naam = naam || '';
  if (!aan || (aan.dataset.aangeraakt && !ookAangeraakt)) return;
  const m = (naam && catMinimum(catalogusVan(naam), maatLezen(el, id))) || 0;
  delete aan.dataset.aangeraakt;
  aan.checked = m > 0; $(`#${id}-alle`, el).value = m > 0 ? fmt(m) : ''; $(`#${id}-alle-veld`, el).hidden = !(m > 0);
}
/** undefined: niets aangeraakt; null: ongeldig (melding getoond); anders het minimum (0 = uit). */
function minimumVinkjeLezen(el, id, altijd = false) {
  const aan = $(`#${id}-alle-aan`, el);
  if (!aan || (!aan.dataset.aangeraakt && !altijd)) return undefined;
  if (!aan.checked) return 0;
  const m = num($(`#${id}-alle`, el).value);
  if (!(m > 0)) { $(`#${id}-alle`, el).focus(); toast('Vul een minimum in, of zet het vinkje uit.'); return null; }
  return m;
}

// Grote verpakking (bv. zak die je over potten verdeelt, of doos met losse zakjes): dezelfde velden bij Bewerken
// van je voorraad (`pf`) en in de catalogus (`cf`). Ze geldt voor het hele product, alle voorraadregels met die naam.
const grootVeldenHtml = (id, g) => `<label class="vink uitlek-vink"><input type="checkbox" id="${id}-groot-aan" ${g ? 'checked' : ''}><span class="vakje"></span>
    <span>Bijkopen in een grote verpakking <small class="stil">je koopt bv. een grote zak en verdeelt die thuis over potten, of een doos met losse zakjes (pudding, soep, gist …) die je één voor één gebruikt; onder het minimum komt de grote verpakking op je boodschappenlijst</small></span></label>
  <div id="${id}-groot"${g ? '' : ' hidden'}>
    <div class="rij2">
      <label class="veld"><span>Grote verpakking</span><select id="${id}-groot-eenheid">${opties(eenheden().filter((e) => TELBAAR.has(e)), g?.eenheid || 'zak')}</select></label>
      <label class="veld"><span id="${id}-groot-potten-titel">Vult ongeveer (potten)</span><input id="${id}-groot-potten" inputmode="decimal" value="${g?.potten ? esc(fmt(g.potten)) : ''}" placeholder="bv. 4"></label>
    </div>
    <div class="rij2">
      <label class="veld"><span>Inhoud (mag leeg)</span><input id="${id}-groot-inhoud" inputmode="decimal" value="${g?.inhoud > 0 ? esc(fmt(g.inhoud)) : ''}" placeholder="bv. 5"></label>
      <label class="veld"><span>Eenheid inhoud</span><select id="${id}-groot-inhoud-eenheid">${inhoudOpties(g?.inhoud_eenheid, 'kg')}</select></label>
    </div>
  </div>`;
/** Titel van het aantal: "Vult ongeveer (potten)" of "Aantal zakjes erin", naar de eenheid van het product. */
const grootTitelZetten = (el, id, eenheid) => { $(`#${id}-groot-potten-titel`, el).textContent = eenheid === 'pot' ? 'Vult ongeveer (potten)' : `Aantal ${meervoud(eenheid)} erin`; };
/** Velden invullen (bv. na het kiezen van een gekend product), zolang je het vinkje zelf niet aanraakte. */
function grootVeldenZetten(el, id, g) {
  const aan = $(`#${id}-groot-aan`, el);
  if (!aan || aan.dataset.aangeraakt) return;
  aan.checked = !!g; $(`#${id}-groot`, el).hidden = !g;
  if (!g) return;
  $(`#${id}-groot-eenheid`, el).innerHTML = opties(eenheden().filter((e) => TELBAAR.has(e)), g.eenheid || 'zak');
  $(`#${id}-groot-potten`, el).value = g.potten ? fmt(g.potten) : '';
  $(`#${id}-groot-inhoud`, el).value = g.inhoud > 0 ? fmt(g.inhoud) : '';
  $(`#${id}-groot-inhoud-eenheid`, el).innerHTML = inhoudOpties(g.inhoud_eenheid, 'kg');
}
/** Het vinkje koppelen; `aanGezet` wordt opgeroepen als je het aanzet (bv. om een minimum voor te stellen). */
function grootVeldenKoppelen(el, id, aanGezet) {
  const aan = $(`#${id}-groot-aan`, el);
  aan.onchange = () => {
    aan.dataset.aangeraakt = '1';
    $(`#${id}-groot`, el).hidden = !aan.checked;
    if (aan.checked) aanGezet();
  };
}
/** De grote verpakking uit het formulier: null (vinkje uit), of false bij een fout (melding al getoond). */
function grootVeldenLezen(el, id) {
  if (!$(`#${id}-groot-aan`, el).checked) return null;
  const gi = $(`#${id}-groot-inhoud`, el).value.trim(), gp = $(`#${id}-groot-potten`, el).value.trim();
  if (gi && !(num(gi) > 0)) { toast('Vul een geldige inhoud in voor de grote verpakking, of laat het veld leeg.'); return false; }
  if (gp && !(num(gp) > 0)) { toast(`Vul een geldig aantal in bij "${$(`#${id}-groot-potten-titel`, el).textContent}", of laat het veld leeg.`); return false; }
  return { eenheid: $(`#${id}-groot-eenheid`, el).value, inhoud: num(gi) > 0 ? num(gi) : null,
    inhoud_eenheid: num(gi) > 0 ? $(`#${id}-groot-inhoud-eenheid`, el).value : '', ...(num(gp) > 0 ? { potten: num(gp) } : {}) };
}
/** Gekende grote verpakking van een product (catalogus, anders een voorraadregel). */
const grootVan = (naam) => catalogusVan(naam)?.grootverpakking || S.producten.find((p) => zelfde(p.naam, naam) && p.grootverpakking)?.grootverpakking || null;

// Sortering van de catalogus (op naam of op categorie): onthouden op dit toestel.
const ZONDER_CATEGORIE = 'Zonder categorie';
const catSorteringLezen = () => { try { return localStorage.getItem('catalogus-sortering') === 'categorie' ? 'categorie' : 'naam'; } catch { return ui.catSortering || 'naam'; } };
const catSorteringBewaren = (w) => { ui.catSortering = w; try { localStorage.setItem('catalogus-sortering', w); } catch { /* */ } };
function tekenCatalogus() {
  const q = ui.catZoek.trim().toLowerCase();
  const alles = [...(S.catalogus || [])].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  // elk merk en elke inhoud staat als aparte regel in de lijst
  const regels = alles.flatMap((c) => variantenVan(c).map((v, i) => ({ c, v, i })))
    .sort((a, b) => a.c.naam.localeCompare(b.c.naam, 'nl') || (a.v.merk || '').localeCompare(b.v.merk || '', 'nl') || variantSleutel(a.v).localeCompare(variantSleutel(b.v), 'nl'));
  const items = regels.filter(({ c, v }) => !q || `${c.naam} ${v.merk || ''} ${c.categorie || ''} ${c.locatie || ''} ${c.barcode || ''}`.toLowerCase().includes(q));
  const inHuis = (c, v) => S.producten.some((p) => hoortBijVariant(p, c, v) && p.hoeveelheid > 0);
  // per beginletter gegroepeerd, zodat je in een lange lijst snel vindt wat je zoekt; of per categorie (zonder categorie onderaan)
  const opCategorie = catSorteringLezen() === 'categorie';
  const groepen = new Map();
  const groepVan = (x) => {
    if (opCategorie) return (x.c.categorie || '').trim() || ZONDER_CATEGORIE;
    const l = (x.c.naam.trim().charAt(0) || '#').toLocaleUpperCase('nl').normalize('NFD').replace(/[̀-ͯ]/g, '');
    return /[A-Z]/.test(l) ? l : '#';
  };
  const volgorde = opCategorie ? [...items].sort((a, b) => {
    const ka = groepVan(a), kb = groepVan(b);
    return (ka === ZONDER_CATEGORIE) - (kb === ZONDER_CATEGORIE) || ka.localeCompare(kb, 'nl');
  }) : items;
  for (const x of volgorde) {
    const k = groepVan(x);
    if (!groepen.has(k)) groepen.set(k, []);
    groepen.get(k).push(x);
  }
  // de goedkoopste prijs voor dit merk en deze inhoud (bv. € 9,00 per stuk bij Colruyt)
  const prijsTekst = (c, v) => { const p = goedkoopste(c.naam, v); return p ? `${prijsRegelTekst(p)} bij ${p.winkel}` : ''; };
  const rij = ({ c, v, i }) => `<li><button class="rij" data-cat="${esc(c.naam)}" data-var="${i}">
      <span class="naam">${esc(c.naam)}${merkTekst(v)}<small>${esc([inhoudLabel(v) + (v.uitlekgewicht && prijsSleutel(v) ? ' uitlekgewicht' : ''), c.categorie, c.locatie].filter(Boolean).join(' · ') || ' ')}</small>${prijsTekst(c, v) ? `<small class="cat-prijs">${esc(prijsTekst(c, v))}</small>` : ''}</span>
      <span class="rechts">${inHuis(c, v) ? 'in huis' : ''}</span></button></li>`;
  const lijst = !alles.length
    ? `<div class="leeg"><b>De catalogus is nog leeg</b>Elk product dat je aan je voorraad toevoegt, komt hier vanzelf bij. Zo vind je het later terug, ook als het op is. Met Toevoegen zet je er zelf een product bij.</div>`
    : !items.length ? '<div class="leeg">Niets gevonden.</div>'
    // op categorie: elke categorie is uitklapbaar (dicht tot je erop tikt; open/dicht blijft onthouden zolang de app open is);
    // tijdens het zoeken staat alles open, zodat je meteen ziet wat je vond
    : opCategorie ? [...groepen].map(([k, g]) => {
      const sleutel = `catalogus-categorie:${k.toLowerCase()}`;
      return `<details class="sectie uitklap cat-groep" data-uitklap="${esc(sleutel)}"${q || ui.uitgeklapt.has(sleutel) ? ' open' : ''}>
        <summary><span>${esc(k)}</span><span class="stil">${g.length}</span></summary><ul class="lijst">${g.map(rij).join('')}</ul></details>`;
    }).join('')
    : [...groepen].map(([k, g]) => `<section class="sectie"><div class="sectie-titel">${esc(k)}</div><ul class="lijst">${g.map(rij).join('')}</ul></section>`).join('');
  inhoudZetten(`
    <header class="kop"><h1>Catalogus</h1>
      <div class="kop-acties">
        ${instellingenKnop}
        <button class="knop primair" id="cat-nieuw">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}<span>Toevoegen</span></button>
      </div></header>
    ${alles.length ? `<p class="stil">${alles.length} ${alles.length === 1 ? 'product' : 'producten'} die je ooit toevoegde, ook als ze op zijn.</p>
    <div class="zoek">${ICOON.zoek}<input type="search" id="zoek-catalogus" placeholder="Zoeken in catalogus" value="${esc(ui.catZoek)}" autocomplete="off"></div>
    <label class="cat-sortering"><span>Sorteren</span>
      <select id="cat-sortering" aria-label="Sorteren">
        <option value="naam"${opCategorie ? '' : ' selected'}>Op naam (A–Z)</option>
        <option value="categorie"${opCategorie ? ' selected' : ''}>Op categorie</option></select></label>` : ''}
    ${lijst}`);
  const sorteer = $m('#cat-sortering');
  if (sorteer) sorteer.onchange = () => { catSorteringBewaren(sorteer.value); tekenCatalogus(); };
  const z = $m('#zoek-catalogus');
  if (z) z.oninput = () => { ui.catZoek = z.value; tekenCatalogus(); };
  $m('#cat-nieuw').onclick = () => catalogusFormulier(null);
  $$m('[data-cat]').forEach((b) => (b.onclick = () => { const c = catalogusVan(b.dataset.cat); if (c) catalogusItem(c, +b.dataset.var || 0); }));
  if (!q) $$m('.cat-groep[data-uitklap]').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) ui.uitgeklapt.add(d.dataset.uitklap); else ui.uitgeklapt.delete(d.dataset.uitklap);
  }));
}
/** Catalogusproduct openen; `vi` is de variant (merk en inhoud) die je koos. */
function catalogusItem(c0, vi = 0) {
  paneelOpenen((el) => {
    const c = catalogusVan(c0.naam) || c0;
    const varianten = variantenVan(c), v = varianten[Math.min(vi, varianten.length - 1)];
    const nu = S.producten.filter((p) => hoortBijVariant(p, c, v) && p.hoeveelheid > 0);
    // totaal in huis: verpakkingen samentellen (g en kg, ml en l ... worden omgerekend)
    const totalen = [];
    for (const p of nu) {
      const t = totalen.find((x) => omrekenen(1, p.eenheid, x.eenheid) !== null);
      if (t) t.hoeveelheid += omrekenen(p.hoeveelheid, p.eenheid, t.eenheid);
      else totalen.push({ hoeveelheid: p.hoeveelheid, eenheid: p.eenheid });
    }
    for (const t of totalen) {
      const groot = { g: 'kg', ml: 'l', cl: 'l', dl: 'l' }[t.eenheid];
      if (groot && omrekenen(t.hoeveelheid, t.eenheid, groot) >= 1) { t.hoeveelheid = omrekenen(t.hoeveelheid, t.eenheid, groot); t.eenheid = groot; }
    }
    const anderen = varianten.length - 1;
    const samen = anderen ? totaalInHuis(c.naam, maatVan(v) || undefined) : 0;
    const groot = grootVan(c.naam);
    const info = [anderen && samen ? `alle merken samen${maatVan(v) ? ` (${maatWoord(maatVan(v))})` : ''}: ${hoeveelTekst(samen, c.eenheid || 'stuks') || fmt(samen)}` : '', minimumTekst(c),
      groot ? `bijkopen per ${grootTekst(groot, c.eenheid || 'stuks').replace(/^1 /, '')}` : '', v.uitlekgewicht ? 'gewicht = uitlekgewicht' : '', anderen ? `nog ${anderen} ${anderen === 1 ? 'ander merk of inhoud' : 'andere merken of inhouden'}` : '',
      c.aantal ? `${c.aantal}× toegevoegd` : '', c.laatst ? `laatst op ${datumNL(c.laatst.slice(0, 10), true)}` : ''].filter(Boolean).join(' · ');
    el.innerHTML = `${paneelKop(esc(c.naam), esc([v.merk, inhoudLabel(v), maatWoord(maatVan(v)), c.categorie, c.locatie].filter(Boolean).join(' · ')))}
      <div class="datumblok"><div>${totalen.length ? `In huis: ${esc(totalen.map((t) => hoeveelTekst(t.hoeveelheid, t.eenheid)).join(' en '))}` : 'Nu niet in huis'}
        ${info ? `<small>${esc(info)}</small>` : ''}</div></div>
      ${prijzenBlok(c.naam)}
      <ul class="acties">
        <li><button id="c-voorraad">Aan voorraad toevoegen</button></li>
        <li><button id="c-lijst">Op boodschappenlijst${anderen ? ` (${esc(variantLabel(v))})` : ''}</button></li>
        ${anderen ? '<li><button id="c-lijst-elk">Op boodschappenlijst, elk merk</button></li>' : ''}
        <li><button id="c-bewerk">Bewerken</button></li>
        <li><button id="c-variant">Ander merk of inhoud toevoegen</button></li>
        <li><button id="c-prijzen">${(c.prijzen || []).length ? 'Prijzen aanpassen' : 'Prijzen invullen'}</button></li>
        <li><button id="c-weg" class="gevaar">Uit catalogus verwijderen</button></li>
      </ul>`;
    sluitKnoppen(el);
    const variantNaam = `${c.naam}${v.merk ? ` van ${v.merk}` : ''}${inhoudLabel(v) ? ` ${inhoudLabel(v)}` : ''}${maatVan(v) ? ` (${maatWoord(maatVan(v))})` : ''}`;
    $('#c-voorraad', el).onclick = () => productFormulier(null, { naam: c.naam, eenheid: c.eenheid || 'stuks', categorie: c.categorie || '',
      locatie: c.locatie || locaties()[0] || '', datumtype: c.datumtype || 'THT', barcode: c.barcode || '',
      hoeveelheid: c.hoeveelheid > 0 ? c.hoeveelheid : 1, inhoud: v.inhoud || null, inhoud_eenheid: v.inhoud_eenheid || '', uitlekgewicht: !!v.uitlekgewicht, merk: v.merk || '', verpakking: maatVan(v) });
    $('#c-lijst', el).onclick = async () => { await api('POST', 'boodschappen', { naam: c.naam, eenheid: c.eenheid || 'stuks', inhoud: v.inhoud || null, inhoud_eenheid: v.inhoud_eenheid || '', merk: v.merk || '', verpakking: maatVan(v) }); toast(lijstMelding(c.naam, v)); };
    // met meer merken of inhouden: om het even welk, dan kies je in de winkel
    if (anderen) $('#c-lijst-elk', el).onclick = async () => { await api('POST', 'boodschappen', { naam: c.naam, eenheid: c.eenheid || 'stuks', merk: '' }); toast(lijstMelding(c.naam, null)); };
    $('#c-prijzen', el).onclick = () => prijzenPaneel(c.naam, c.eenheid, () => { const nu = catalogusVan(c.naam); if (nu) catalogusItem(nu, vi); else paneelSluiten(); });
    $('#c-bewerk', el).onclick = () => catalogusFormulier(c, vi);
    $('#c-variant', el).onclick = () => catalogusFormulier(null, 0, { naam: c.naam, eenheid: c.eenheid || 'stuks', categorie: c.categorie || '', locatie: c.locatie || '',
      datumtype: c.datumtype || 'THT', hoeveelheid: c.hoeveelheid, inhoud: null, inhoud_eenheid: v.inhoud_eenheid || '', merk: '', verpakking: '' });
    $('#c-weg', el).onclick = async () => {
      const enkel = varianten.length > 1;
      if (!(await vraag(enkel ? `${variantNaam} uit de catalogus verwijderen? De andere merken en inhouden blijven staan, je voorraad ook.`
        : `${c.naam} uit de catalogus verwijderen? Je voorraad blijft zoals ze is.`, { ja: 'Verwijderen', gevaar: true }))) return;
      await api('DELETE', 'catalogus', { naam: c.naam, ...(enkel ? { variant: v } : {}) });
      toast(`${enkel ? variantNaam : c.naam} uit catalogus verwijderd`);
      paneelSluiten();
    };
  });
}

/** Eén verpakking (of alles, bij gewicht en volume) als geopend aanduiden: telt als opgebruikt. */
async function openen(p) {
  const r = await api('POST', `producten/${p.id}/openen`, { hoeveelheid: 1 });
  const nieuw = r && r.nieuw_id;
  if (nieuw) productPaneel(nieuw); else paneelSluiten();
  toast(`${p.naam} geopend: telt als opgebruikt`, 'Ongedaan maken', () => nieuw && api('POST', `producten/${nieuw}/sluiten`, {}));
}

async function verbruiken(p, hoeveelheid, soort, sluiten) {
  const oud = { ...p };
  const alles = hoeveelheid === null || hoeveelheid >= p.hoeveelheid - 1e-9;
  await api('POST', `producten/${p.id}/verbruik`, { hoeveelheid, soort, verwijderen_als_op: sluiten });
  const nogEr = S.producten.some((x) => x.id === p.id);
  if (!nogEr || sluiten) paneelSluiten();
  const tekst = soort === 'weggegooid' ? `${p.naam} weggegooid` : alles ? `${p.naam} is op` : `${hoeveelTekst(hoeveelheid, p.eenheid) || fmt(hoeveelheid)} ${p.naam} gebruikt`;
  toast(tekst, 'Ongedaan maken', async () => {
    if (S.producten.some((x) => x.id === oud.id)) await api('PUT', `producten/${oud.id}`, { hoeveelheid: oud.hoeveelheid });
    else await api('POST', 'producten', oud);
  });
}

// Catalogusproduct zelf toevoegen of bewerken (los van je voorraad).
// Bij bewerken is `vi` de variant (merk en inhoud) die je bewerkt; `sjabloon` vult een nieuw product (of een nieuwe variant) in.
function catalogusFormulier(bestaand, vi = 0, sjabloon = null) {
  const nieuw = !bestaand;
  const oudeVariant = bestaand ? variantenVan(bestaand)[Math.min(vi, variantenVan(bestaand).length - 1)] : null;
  const c = bestaand ? { ...bestaand, verpakking: '', ...oudeVariant }
    : { naam: ui.catZoek.trim(), eenheid: 'stuks', categorie: '', locatie: '', datumtype: 'THT', inhoud: null, inhoud_eenheid: '', ...(sjabloon || {}) };
  if (nieuw && c.naam) c.naam = c.naam.charAt(0).toUpperCase() + c.naam.slice(1);
  paneelOpenen((el) => {
    if (alGetekend('catformulier')) return; // niet opnieuw tekenen terwijl je typt
    // geen keuze van eenheid: nieuw is altijd per stuk, een bestaand product houdt zijn eenheid
    const eenheid = c.eenheid || 'stuks';
    const inVoorraad = !nieuw && (S.producten.some((p) => zelfde(p.naam, c.naam)) || S.boodschappen.some((b) => zelfde(b.naam, c.naam)));
    el.innerHTML = `
      ${paneelKop(sjabloon ? 'Ander merk of inhoud' : nieuw ? 'Aan catalogus toevoegen' : 'Bewerken',
        sjabloon ? `Nog een ${esc(c.naam)}, met een ander merk en/of een andere inhoud` : nieuw ? 'Komt niet in je voorraad; dat kan later vanuit de catalogus. Bestaat het product al, dan komt het erbij met dit merk en deze inhoud.' : '')}
      <form id="cf" autocomplete="off">
        <label class="veld"><span>Naam</span><input id="cf-naam" value="${esc(c.naam || '')}" required autocomplete="off" autocapitalize="sentences"></label>
        <label class="veld"><span>Merk (mag leeg)</span><input id="cf-merk" value="${esc(c.merk || '')}" autocomplete="off" autocapitalize="words" placeholder="bv. Bonduelle"></label>
        ${inVoorraad ? '<p class="stil" style="margin-top:-.4rem">Een nieuwe naam wordt ook aangepast in je voorraad en op je boodschappenlijst.</p>' : ''}
        ${maatKeuzeHtml('cf', c.verpakking)}
        ${sjabloon ? '' : minimumVinkjeHtml('cf', catMinimum(c, maatVan(c)))}
        ${sjabloon ? '' : grootVeldenHtml('cf', nieuw ? null : grootVan(c.naam))}
        <label class="veld"><span>Aantal${eenheid !== 'stuks' ? ` (${esc(eenheid)})` : ''}</span><input id="cf-hv" inputmode="decimal" value="${c.hoeveelheid > 0 ? esc(fmt(c.hoeveelheid)) : '1'}"></label>
        <p class="stil" style="margin:-.4rem 0 1rem">Wordt ingevuld als je het product vanuit de catalogus aan je voorraad toevoegt.</p>
        <div class="rij2" id="cf-inhoud-rij">
          <label class="veld"><span id="cf-inhoud-titel">Inhoud per stuk</span><input id="cf-inhoud" inputmode="decimal" value="${c.inhoud > 0 ? esc(fmt(c.inhoud)) : ''}" placeholder="bv. 500"></label>
          <label class="veld"><span>Eenheid inhoud</span><select id="cf-inhoud-eenheid">${inhoudOpties(c.inhoud_eenheid, 'g')}</select></label>
        </div>
        ${uitlekVinkje('cf', c.uitlekgewicht)}
        <div class="rij2">
          <label class="veld"><span>Categorie</span><select id="cf-cat">${opties(categorieen(), c.categorie || '', 'Geen')}</select></label>
          <label class="veld"><span>Plaats</span><select id="cf-plaats">${opties(locaties(), c.locatie || '', 'Geen')}</select></label>
        </div>
        <div class="segment" id="cf-type">
          <button type="button" data-w="THT">Ten minste houdbaar tot</button>
          <button type="button" data-w="TGT">Te gebruiken tot</button>
        </div>
        <details class="meer"${!nieuw && prijzenVan(c.naam).length ? ' open' : ''} style="margin-top:.8rem" id="cf-prijzen"></details>
        <div class="paneel-voet"><button type="submit" class="knop primair">${nieuw ? 'Toevoegen' : 'Bewaren'}</button></div>
      </form>`;
    sluitKnoppen(el);
    let type = c.datumtype === 'TGT' ? 'TGT' : 'THT';
    const typeTekenen = () => $$('#cf-type button', el).forEach((b) => b.classList.toggle('aan', b.dataset.w === type));
    typeTekenen();
    $$('#cf-type button', el).forEach((b) => (b.onclick = () => { type = b.dataset.w; typeTekenen(); }));
    $('#cf-inhoud-rij', el).hidden = !TELBAAR.has(eenheid);
    minimumVinkjeKoppelen(el, 'cf');
    if (!sjabloon) minimumVinkjeZetten(el, 'cf', c.naam);
    maatKoppelen(el, 'cf');
    if (!sjabloon) {
      grootTitelZetten(el, 'cf', eenheid);
      grootVeldenKoppelen(el, 'cf', () => {
        // zonder minimum komt de grote verpakking nooit op je lijst: het minimum voor alle merken samen aanzetten met 1
        // (tenzij een voorraadregel al een eigen minimum heeft)
        const alle = $('#cf-alle-aan', el);
        if (alle.checked || S.producten.some((p) => zelfde(p.naam, c.naam) && p.minimum > 0)) return;
        alle.checked = true; alle.dataset.aangeraakt = '1'; $('#cf-alle-veld', el).hidden = false;
        if (!$('#cf-alle', el).value) $('#cf-alle', el).value = '1';
        toast(`Vul bij Minimum in huis in bij hoeveel ${meervoud(eenheid)} je bijkoopt.`);
      });
    }
    $('#cf-inhoud-titel', el).textContent = `Inhoud per ${perTekst(eenheid)} (mag leeg)`;
    const info = () => ({ eenheid, inhoud_eenheid: $('#cf-inhoud', el).value.trim() ? $('#cf-inhoud-eenheid', el).value : '' });
    // de prijzen gelden voor de inhoud die hier staat
    const cfPrijzen = () => formPrijzenZetten($('#cf-prijzen', el), nieuw ? '' : c.naam, eenheid, formInhoud(el, 'cf', eenheid), info);
    cfPrijzen();
    $('#cf-inhoud', el).oninput = cfPrijzen;
    $('#cf-merk', el).oninput = cfPrijzen;
    $('#cf-inhoud-eenheid', el).onchange = cfPrijzen;
    $('#cf', el).onsubmit = async (e) => {
      e.preventDefault();
      const naam = $('#cf-naam', el).value.trim();
      if (!naam) return toast('Vul een naam in.');
      const hv = num($('#cf-hv', el).value);
      if (!(hv > 0)) return toast('Vul een geldig aantal in.');
      const telbaar = TELBAAR.has(eenheid);
      const inhoud = telbaar ? num($('#cf-inhoud', el).value) : null;
      if (telbaar && $('#cf-inhoud', el).value.trim() && !(inhoud > 0)) return toast('Vul een geldige inhoud in, of laat het veld leeg.');
      // vinkje uit: geen minimum voor alle merken samen
      const minimum = minimumVinkjeLezen(el, 'cf', true);
      if (minimum === null) return;
      const grootverpakking = sjabloon ? undefined : grootVeldenLezen(el, 'cf');
      if (grootverpakking === false) return;
      cfPrijzen();
      const pz = $('#cf-prijzen', el), prijzen = prijzenLezen(pz, eenheid);
      if (!prijzen) { pz.open = true; return; }
      const data = { naam, hoeveelheid: hv, eenheid, categorie: $('#cf-cat', el).value, locatie: $('#cf-plaats', el).value, datumtype: type,
        inhoud: inhoud > 0 ? inhoud : null, inhoud_eenheid: inhoud > 0 ? $('#cf-inhoud-eenheid', el).value : '', uitlekgewicht: $('#cf-uitlek', el).checked, merk: $('#cf-merk', el).value.trim(),
        verpakking: maatLezen(el, 'cf'),
        ...(minimum !== undefined ? { minimum } : {}),
        ...(grootverpakking !== undefined ? { grootverpakking } : {}),
        // alleen de prijzen van deze inhoud; niets aangepast: niets bewaren
        ...(pz.dataset.aangeraakt || nieuw ? { prijzen, prijzen_inhoud: formPrijzenInhoud(pz) } : {}) };
      if (!nieuw) { data.oudeNaam = c.naam; data.oudeVariant = oudeVariant; }
      try {
        await api(nieuw ? 'POST' : 'PUT', 'catalogus', data);
        toast(nieuw ? `${naam} toegevoegd aan de catalogus` : `${naam} bewaard`);
        const nu = catalogusVan(naam);
        // de variant die je net bewaarde openen
        if (nu) catalogusItem(nu, Math.max(0, variantenVan(nu).findIndex((x) => variantSleutel(x) === variantSleutel(data)))); else paneelSluiten();
      } catch { /* melding al getoond */ }
    };
    if (nieuw && !c.naam && fijneMuis()) setTimeout(() => $('#cf-naam', el)?.focus(), 60);
  });
}

// Product toevoegen of bewerken: alleen het nodige, de rest onder "Meer"
function productFormulier(bestaand, sjabloon = {}) {
  const nieuw = !bestaand;
  const p = bestaand ? { ...bestaand } : {
    naam: '', hoeveelheid: 1, eenheid: 'stuks', locatie: ui.plaats || locaties()[0] || '', categorie: '',
    aankoopdatum: vandaag(), vervaldatum: '', datumtype: 'THT', minimum: 0, notitie: '', barcode: '', inhoud: null, inhoud_eenheid: '', uitlekgewicht: false, merk: '', ...sjabloon,
  };
  // nieuwe verpakking van een gekend product: de grote verpakking van dat product staat al ingevuld
  if (nieuw && !p.grootverpakking && p.naam) p.grootverpakking = grootVan(p.naam);
  paneelOpenen((el) => {
    if (alGetekend('formulier')) return; // niet opnieuw tekenen terwijl je typt
    el.innerHTML = `
      ${paneelKop(nieuw ? 'Toevoegen' : 'Bewerken')}
      <form id="pf" autocomplete="off">
        <label class="veld"><span>Naam</span><input id="pf-naam" value="${esc(p.naam)}" required autocomplete="off" autocapitalize="sentences"></label>
        ${nieuw ? '<div id="pf-catkeuze" class="catkeuze" hidden></div>' : ''}
        <label class="veld"><span>Merk (mag leeg)</span><input id="pf-merk" value="${esc(p.merk || '')}" autocomplete="off" autocapitalize="words" placeholder="bv. Bonduelle"></label>
        ${maatKeuzeHtml('pf', p.verpakking)}
        ${minimumVinkjeHtml('pf', catMinimum(catalogusVan(p.naam), maatVan(p)))}
        <div class="rij2">
          <label class="veld"><span>Hoeveelheid</span><input id="pf-hv" inputmode="decimal" value="${esc(fmt(p.hoeveelheid))}" required></label>
          <label class="veld"><span>Eenheid</span><select id="pf-eenheid">${eenheidOpties(p.eenheid)}</select></label>
        </div>
        <div class="rij2" id="pf-inhoud-rij">
          <label class="veld"><span id="pf-inhoud-titel">Inhoud per stuk</span><input id="pf-inhoud" inputmode="decimal" value="${p.inhoud > 0 ? esc(fmt(p.inhoud)) : ''}" placeholder="bv. 500"></label>
          <label class="veld"><span>Eenheid inhoud</span><select id="pf-inhoud-eenheid">${inhoudOpties(p.inhoud_eenheid, 'g')}</select></label>
        </div>
        ${uitlekVinkje('pf', p.uitlekgewicht)}
        <div class="veld" style="margin-bottom:1rem"><span class="veld-titel">Plaats</span>
          <div class="chips" id="pf-plaats">${locaties().map((l) => `<button type="button" class="chip${zelfde(l, p.locatie) ? ' aan' : ''}" data-w="${esc(l)}">${esc(l)}</button>`).join('')}</div></div>
        <label class="veld" style="margin-bottom:.4rem"><span>Houdbaar tot</span><input type="date" id="pf-datum" value="${esc(p.vervaldatum || '')}"></label>
        <div class="snel" id="pf-snel" style="margin-bottom:1rem">
          ${[[3, '+3 dagen'], [7, '+1 week'], [30, '+1 maand'], [365, '+1 jaar'], ['', 'Geen datum']].map(([d, t]) => `<button type="button" class="chip" data-d="${d}">${t}</button>`).join('')}
        </div>
        <div class="segment" id="pf-type">
          <button type="button" data-w="THT">Ten minste houdbaar tot</button>
          <button type="button" data-w="TGT">Te gebruiken tot</button>
        </div>
        <p class="segment-uitleg" id="pf-type-uitleg"></p>
        <details class="meer"${nieuw ? '' : ' open'} style="margin-top:.8rem"><summary>Meer</summary>
          <label class="veld"><span>Categorie</span><select id="pf-cat">${opties(categorieen(), p.categorie || '', 'Geen')}</select></label>
          <label class="veld"><span>Minimumvoorraad voor deze inhoud en verpakking (eronder komt het op je boodschappenlijst)</span><input id="pf-min" inputmode="decimal" value="${p.minimum ? esc(fmt(p.minimum)) : ''}" placeholder="Geen"></label>
          <p class="stil" style="margin:-.4rem 0 1rem">Staat het vinkje <i>Minimum voor alle merken samen</i> aan, dan gaat dat voor.</p>
          ${grootVeldenHtml('pf', p.grootverpakking)}
          <label class="veld"><span>Gekocht op</span><input type="date" id="pf-aankoop" value="${esc(p.aankoopdatum || '')}"></label>
          <label class="veld"><span>Notitie</span><input id="pf-notitie" value="${esc(p.notitie || '')}"></label>
        </details>
        <details class="meer"${prijzenVan(p.naam).length ? ' open' : ''} style="margin-top:.8rem" id="pf-prijzen"></details>
        <div class="paneel-voet"><button type="submit" class="knop primair">${nieuw ? 'Toevoegen' : 'Bewaren'}</button></div>
      </form>`;
    sluitKnoppen(el);
    let plaats = p.locatie, type = p.datumtype === 'TGT' ? 'TGT' : 'THT';
    const typeTekenen = () => {
      $$('#pf-type button', el).forEach((b) => b.classList.toggle('aan', b.dataset.w === type));
      $('#pf-type-uitleg', el).textContent = type === 'TGT' ? 'Veiligheidsdatum: daarna niet meer eten. Typisch voor vers vlees, vis en verse zuivel.'
        : 'Kwaliteitsdatum: daarna meestal nog goed. Typisch voor kast- en diepvriesproducten.';
    };
    typeTekenen();
    // inhoud per verpakking: alleen tonen bij telbare eenheden (stuks, pak, fles ...)
    const inhoudTonen = () => {
      const e = $('#pf-eenheid', el).value;
      $('#pf-inhoud-rij', el).hidden = !TELBAAR.has(e);
      $('#pf-inhoud-titel', el).textContent = `Inhoud per ${e === 'stuks' ? 'stuk' : e} (mag leeg)`;
    };
    inhoudTonen();
    // grote verpakking: het getal "vult ongeveer" telt in de eenheid van dit product (potten, stuks ...)
    const grootTitel = () => grootTitelZetten(el, 'pf', $('#pf-eenheid', el).value);
    grootTitel();
    grootVeldenKoppelen(el, 'pf', () => {
      // zonder minimum komt de grote verpakking nooit op je lijst: 1 voorstellen (tenzij er een minimum voor alle merken samen is)
      if (!$('#pf-min', el).value.trim() && !$('#pf-alle-aan', el)?.checked) { $('#pf-min', el).value = '1'; toast(`Vul bij Minimumvoorraad in bij hoeveel ${meervoud($('#pf-eenheid', el).value)} je bijkoopt.`); }
    });
    const productInfo = () => ({ eenheid: $('#pf-eenheid', el).value, inhoud_eenheid: $('#pf-inhoud', el).value.trim() ? $('#pf-inhoud-eenheid', el).value : '' });
    // de prijzen gelden voor de inhoud die hier staat (bv. pak à 500 g)
    const pfPrijzen = () => { const e = $('#pf-eenheid', el).value; formPrijzenZetten($('#pf-prijzen', el), $('#pf-naam', el).value.trim() || p.naam, e, formInhoud(el, 'pf', e), productInfo); };
    pfPrijzen();
    $('#pf-eenheid', el).onchange = () => { inhoudTonen(); grootTitel(); prijsPerZetten(el, $('#pf-eenheid', el).value); pfPrijzen(); };
    $('#pf-inhoud', el).oninput = pfPrijzen;
    $('#pf-merk', el).oninput = pfPrijzen;
    minimumVinkjeKoppelen(el, 'pf');
    minimumVinkjeZetten(el, 'pf', p.naam);
    maatKoppelen(el, 'pf');
    $('#pf-inhoud-eenheid', el).onchange = pfPrijzen;
    $$('#pf-type button', el).forEach((b) => (b.onclick = () => { type = b.dataset.w; typeTekenen(); }));
    $$('#pf-plaats .chip', el).forEach((b) => (b.onclick = () => {
      plaats = b.dataset.w;
      $$('#pf-plaats .chip', el).forEach((c) => c.classList.toggle('aan', c === b));
    }));
    $$('#pf-snel .chip', el).forEach((b) => (b.onclick = () => { $('#pf-datum', el).value = b.dataset.d ? vandaag(+b.dataset.d) : ''; }));
    const invullen = (info) => {
      if (info.naam) $('#pf-naam', el).value = info.naam;
      if (info.hoeveelheid) $('#pf-hv', el).value = fmt(info.hoeveelheid);
      if (info.eenheid) { $('#pf-eenheid', el).innerHTML = eenheidOpties(info.eenheid); inhoudTonen(); grootTitel(); prijsPerZetten(el, info.eenheid); }
      if (info.inhoud > 0 && !$('#pf-inhoud', el).value) {
        $('#pf-inhoud', el).value = fmt(info.inhoud);
        if (info.inhoud_eenheid) $('#pf-inhoud-eenheid', el).innerHTML = inhoudOpties(info.inhoud_eenheid);
      }
      if (info.categorie) $('#pf-cat', el).innerHTML = opties(categorieen(), info.categorie, 'Geen');
      if (info.merk && !$('#pf-merk', el).value) $('#pf-merk', el).value = info.merk;
      if (info.locatie) { plaats = info.locatie; $$('#pf-plaats .chip', el).forEach((c) => c.classList.toggle('aan', zelfde(c.dataset.w, plaats))); }
      if (info.datumtype) { type = info.datumtype === 'TGT' ? 'TGT' : 'THT'; typeTekenen(); }
      if ('uitlekgewicht' in info) $('#pf-uitlek', el).checked = !!info.uitlekgewicht;
    };
    // bekende naam: algemene gegevens van dat product overnemen (eenheid, categorie, plaats ...);
    // merk, inhoud en uitlekgewicht niet: die vul je zelf in of kies je hieronder uit de catalogus
    const bekendeNaam = () => {
      if (!nieuw) return;
      const naam = $('#pf-naam', el).value;
      const b = (S.catalogus || []).find((x) => zelfde(x.naam, naam)) || S.producten.find((x) => zelfde(x.naam, naam));
      minimumVinkjeZetten(el, 'pf', naam);
      if (b) invullen({ eenheid: b.eenheid, categorie: b.categorie, locatie: b.locatie, datumtype: b.datumtype });
      grootVeldenZetten(el, 'pf', grootVan(naam));
      // gekende prijzen overnemen (alleen als je zelf nog niets invulde)
      pfPrijzen();
      if (prijzenVan(naam).length && !$('#pf-prijzen', el).dataset.aangeraakt) $('#pf-prijzen', el).open = true;
    };
    // kiezen uit de catalogus: elk merk en elke inhoud als aparte keuze; pas na je keuze komen merk en inhoud in het formulier
    const catKeuze = $('#pf-catkeuze', el);
    let keuzes = [];
    const variantKiezen = (k) => {
      const { n, v } = keuzes[k];
      $('#pf-naam', el).value = n;
      bekendeNaam();
      $('#pf-merk', el).value = v ? v.merk || '' : '';
      $('#pf-inhoud', el).value = v && v.inhoud > 0 ? fmt(v.inhoud) : '';
      if (v && v.inhoud > 0) $('#pf-inhoud-eenheid', el).innerHTML = inhoudOpties(v.inhoud_eenheid, 'g');
      $('#pf-uitlek', el).checked = !!(v && v.uitlekgewicht);
      maatZetten(el, 'pf', v ? v.verpakking : ''); minimumVinkjeMaat(el, 'pf');
      pfPrijzen();
      catKeuze.hidden = true;
      if (fijneMuis()) { $('#pf-hv', el).focus(); $('#pf-hv', el).select(); }
    };
    const catKeuzeTonen = () => {
      if (!catKeuze) return;
      const q = $('#pf-naam', el).value.trim().toLowerCase();
      keuzes = q.length < 2 ? [] : catalogusnamen().flatMap((n) => { const c = catalogusVan(n); return c ? variantenVan(c).map((v) => ({ n, v })) : [{ n, v: null }]; })
        .filter(({ n, v }) => `${n} ${v ? v.merk || '' : ''}`.toLowerCase().includes(q))
        .sort((a, b) => (b.n.toLowerCase().startsWith(q) - a.n.toLowerCase().startsWith(q)) || a.n.localeCompare(b.n, 'nl')).slice(0, 8);
      catKeuze.innerHTML = keuzes.length ? `<span class="veld-titel">Kies uit je catalogus</span><div class="catkeuze-lijst">${keuzes.map(({ n, v }, i) => {
        const extra = v ? [v.merk, v.inhoud > 0 ? hoeveelTekst(v.inhoud, v.inhoud_eenheid) : '', v.uitlekgewicht ? 'uitlekgewicht' : '', maatWoord(maatVan(v))].filter(Boolean).join(' · ') : '';
        return `<button type="button" class="catkeuze-knop" data-catkies="${i}"><b>${esc(n)}</b><small>${esc(extra || 'zonder merk of inhoud')}</small></button>`;
      }).join('')}</div>` : '';
      catKeuze.hidden = !keuzes.length;
      $$('[data-catkies]', catKeuze).forEach((b) => {
        b.onmousedown = (e) => e.preventDefault(); // veld niet laten blurren voor de klik
        b.onclick = () => variantKiezen(+b.dataset.catkies);
      });
    };
    $('#pf-naam', el).onchange = bekendeNaam;
    if (catKeuze) $('#pf-naam', el).addEventListener('input', catKeuzeTonen);
    else suggesties($('#pf-naam', el), catalogusnamen, bekendeNaam);
    $('#pf', el).onsubmit = async (e) => {
      e.preventDefault();
      const hv = num($('#pf-hv', el).value);
      if (hv === null || hv < 0) return toast('Vul een geldige hoeveelheid in.');
      const telbaar = TELBAAR.has($('#pf-eenheid', el).value);
      const inhoud = telbaar ? num($('#pf-inhoud', el).value) : null;
      if (telbaar && $('#pf-inhoud', el).value.trim() && !(inhoud > 0)) return toast('Vul een geldige inhoud in, of laat het veld leeg.');
      pfPrijzen();
      const pz = $('#pf-prijzen', el), prijzen = prijzenLezen(pz, $('#pf-eenheid', el).value);
      if (!prijzen) { pz.open = true; return; }
      const alleMerken = minimumVinkjeLezen(el, 'pf');
      if (alleMerken === null) return;
      const grootverpakking = grootVeldenLezen(el, 'pf');
      if (grootverpakking === false) return;
      const nieuweNaam = !nieuw && !zelfde($('#pf-naam', el).value, p.naam);
      const data = {
        // alleen de prijzen van deze inhoud, en alleen als je ze aanpaste (zo blijven gekende prijzen staan)
        ...((pz.dataset.aangeraakt || nieuweNaam) && (prijzen.length || !nieuw) ? { prijzen, prijzen_inhoud: formPrijzenInhoud(pz) } : {}),
        inhoud: inhoud > 0 ? inhoud : null, inhoud_eenheid: inhoud > 0 ? $('#pf-inhoud-eenheid', el).value : '', uitlekgewicht: $('#pf-uitlek', el).checked, merk: $('#pf-merk', el).value.trim(),
        verpakking: maatLezen(el, 'pf'),
        naam: $('#pf-naam', el).value.trim(), hoeveelheid: hv, eenheid: $('#pf-eenheid', el).value, locatie: plaats || '',
        vervaldatum: $('#pf-datum', el).value, datumtype: type, categorie: $('#pf-cat', el).value.trim(),
        minimum: num($('#pf-min', el).value) || 0, barcode: p.barcode || '', // barcodes staan voorlopig uit; een bestaande code blijft bewaard
        aankoopdatum: $('#pf-aankoop', el).value, notitie: $('#pf-notitie', el).value.trim(), grootverpakking,
        ...(alleMerken !== undefined ? { catalogus_minimum: alleMerken } : {}),
      };
      try {
        await api(nieuw ? 'POST' : 'PUT', nieuw ? 'producten' : `producten/${p.id}`, data);
        if (nieuw) { paneelSluiten(); toast(`${data.naam} toegevoegd`); } else productPaneel(p.id);
      } catch { /* melding al getoond */ }
    };
    if (nieuw && !p.naam && fijneMuis()) setTimeout(() => $('#pf-naam', el)?.focus(), 60); // op de telefoon geen toetsenbord ongevraagd
  });
  if (sjabloon.melding) toast(sjabloon.melding);
}

// ---------------------------------------------------------------------------
// BOODSCHAPPEN
// ---------------------------------------------------------------------------
function tekenBoodschappen() {
  // Elke boodschap staat op de algemene lijst én op de lijst van de winkel waar ze het goedkoopst is.
  // Het is telkens dezelfde boodschap: afvinken op de ene lijst vinkt ze dus ook af op de andere.
  const metWinkel = S.boodschappen.map((b) => ({ b, p: winkelVoor(b.naam, b) }));
  const telPer = new Map();
  for (const x of metWinkel) if (x.p && !x.b.afgevinkt) telPer.set(x.p.winkel.toLowerCase(), (telPer.get(x.p.winkel.toLowerCase()) || 0) + 1);
  const tabs = uniek(metWinkel.filter((x) => x.p).map((x) => x.p.winkel)).sort((a, b) => winkelPlek(a) - winkelPlek(b) || a.localeCompare(b, 'nl'));
  if (ui.winkel && !tabs.some((w) => zelfde(w, ui.winkel))) ui.winkel = '';
  const hier = metWinkel.filter((x) => !ui.winkel || (x.p && zelfde(x.p.winkel, ui.winkel)));
  const open = hier.filter((x) => !x.b.afgevinkt), af = hier.filter((x) => x.b.afgevinkt);
  const totaal = (lijst) => {
    let som = 0, onbekend = 0;
    for (const x of lijst) { const k = x.p ? kostprijs(x.b, x.p) : null; if (k === null) onbekend++; else som += k; }
    return som > 0 ? `± ${euro(som)}${onbekend ? ` + ${onbekend} zonder prijs` : ''}` : '';
  };
  const rij = ({ b, p }) => {
    const k = p ? kostprijs(b, p) : null;
    const prijs = !p ? 'Prijs invullen' : `${ui.winkel ? '' : p.winkel + ' · '}${k !== null ? euro(k) : prijsRegelTekst(p)}`;
    // prijzen van de merken (als er meer dan één merk een prijs heeft, of de boodschap zelf geen merk heeft): tik om dat merk te kiezen
    const mp = b.afgevinkt ? [] : merkPrijzen(b);
    const toonMerken = mp.length > 1 || (mp.length === 1 && prijsMerk(b) !== mp[0].merk.toLowerCase());
    const merkRegel = toonMerken ? `<span class="merk-prijzen">${mp.map(({ merk, p: mpr, kost }) =>
      `<button type="button" class="merk-prijs${prijsMerk(b) === merk.toLowerCase() ? ' aan' : ''}" data-merkkies="${b.id}" data-merk="${esc(merk)}" aria-label="${esc(`${merk} kiezen voor ${b.naam}`)}">${esc(merk)} ${esc(kost !== null ? euro(kost) : prijsRegelTekst(mpr))}${ui.winkel && zelfde(mpr.winkel, ui.winkel) ? '' : ` <span class="stil">${esc(mpr.winkel)}</span>`}</button>`).join('')}</span>` : '';
    return `<li><label class="rij vink">
      <input type="checkbox" data-vink="${b.id}" ${b.afgevinkt ? 'checked' : ''}><span class="vakje"></span>
      <span class="naam"><button type="button" class="naam-knop" data-bewerk="${b.id}" aria-label="${esc(b.naam)} bewerken">${esc(b.naam)}${merkTekst(b)}</button><small>${b.bron === 'minimum' && !b.afgevinkt ? (b.potten_voor != null ? 'Grote verpakking, onder je minimum · ' : 'Onder je minimumvoorraad · ') : ''}<button type="button" class="prijs-link${p ? '' : ' leeg'}" data-prijs="${b.id}">${esc(prijs)}</button></small>${merkRegel}</span>
      <span class="aantal-stap">
        <button type="button" class="stap${b.hoeveelheid === null ? ' verborgen' : ''}" data-min="${b.id}" aria-label="Minder ${esc(b.naam)}" ${b.hoeveelheid > stapVan(b.eenheid) ? '' : 'disabled'}>−</button>
        <button type="button" class="stap-getal" data-hv="${b.id}" aria-label="Hoeveelheid en eenheid van ${esc(b.naam)} aanpassen">${b.hoeveelheid === null || b.hoeveelheid === undefined ? '' : esc(`${fmt(b.hoeveelheid)} ${b.eenheid || 'stuks'}`)}${boodschapInhoudVan(b) ? `<small class="inhoud-per">à ${esc(hoeveelTekst(boodschapInhoudVan(b).per, boodschapInhoudVan(b).eenheid))}</small>` : ''}</button>
        <button type="button" class="stap" data-plus="${b.id}" aria-label="Meer ${esc(b.naam)}">+</button></span>
      <button class="weg" data-weg="${b.id}" aria-label="Verwijderen">×</button></label></li>`;
  };
  const tabKnop = (w, tekst, n) => `<button type="button" class="chip${zelfde(w, ui.winkel) ? ' aan' : ''}" data-winkel="${esc(w)}">${esc(tekst)}${n ? ` <span class="tab-tel">${n}</span>` : ''}</button>`;
  const totaalOpen = totaal(open);
  $('#inhoud').innerHTML = `
    <header class="kop"><h1>Boodschappen</h1>
      <div class="kop-acties">${instellingenKnop}</div></header>
    <form class="toevoegen" id="b-form" autocomplete="off">
      <div style="flex:1;min-width:0"><input id="b-invoer" placeholder="Toevoegen, bv. 2 l melk" autocomplete="off" autocapitalize="sentences"></div>
      <button class="knop primair" aria-label="Toevoegen">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}</button>
      <button type="button" class="knop" id="b-menu" aria-label="Kiezen uit een lijst">${ICOON.lijst.replace('<svg', '<svg width="18" height="18"')}</button>
    </form>
    ${tabs.length ? `<details class="filter-uitklap winkel-uitklap" data-dicht="boodschappen-winkels"${ui.uitgeklapt.has('dicht:boodschappen-winkels') ? '' : ' open'}>
      <summary>${ICOON.mand}<span>Winkel<small> · ${ui.winkel ? esc(ui.winkel) : 'Alles'}</small></span></summary>
      <div class="chips winkel-tabs" role="tablist">${tabKnop('', 'Alles', S.boodschappen.filter((b) => !b.afgevinkt).length)}${tabs.map((w) => tabKnop(w, w, telPer.get(w.toLowerCase()))).join('')}</div></details>` : ''}
    ${!S.boodschappen.length ? `<div class="leeg"><b>Je lijst is leeg</b>Wat onder je minimumvoorraad zakt, komt hier vanzelf bij.</div>` : ''}
    ${S.boodschappen.length && !open.length && !af.length ? `<div class="leeg">Niets meer te halen bij ${esc(ui.winkel)}.</div>` : ''}
    ${open.length ? `${totaalOpen ? `<div class="sectie-titel lijst-totaal"><span>${ui.winkel ? esc(ui.winkel) : 'Alle winkels'}</span><span>${esc(totaalOpen)}</span></div>` : ''}
      <ul class="lijst">${open.map(rij).join('')}</ul>` : ''}
    ${af.length ? `<section class="sectie"><div class="sectie-titel"><span>In je mandje${ui.winkel ? ' bij ' + esc(ui.winkel) : ''}</span><span>${esc(totaal(af))}</span></div><ul class="lijst">${af.map(rij).join('')}</ul>
      <div style="margin-top:1rem"><button class="knop primair breed" id="klaar">Klaar met winkelen</button></div></section>` : ''}`;
  $m('#b-form').onsubmit = async (e) => {
    e.preventDefault();
    const tekst = $m('#b-invoer').value.trim();
    if (!tekst) return;
    const i = ingredientOntleden(tekst);
    const bekend = S.producten.find((p) => zelfde(p.naam, i.naam));
    const eenheid = i.hoeveelheid === null ? '' : i.eenheid === 'stuks' && bekend ? bekend.eenheid : i.eenheid;
    $m('#b-invoer').value = '';
    await api('POST', 'boodschappen', { naam: i.naam ? i.naam.charAt(0).toUpperCase() + i.naam.slice(1) : tekst, hoeveelheid: i.hoeveelheid, eenheid, product_id: bekend?.id || null });
    if (fijneMuis()) $m('#b-invoer')?.focus();
  };
  suggesties($m('#b-invoer'), productnamen);
  $m('#b-menu').onclick = () => boodschapToevoegen();
  const stappen = (sel, richting) => $$m(sel).forEach((k) => (k.onclick = (e) => {
    e.preventDefault(); // niet afvinken: de knop staat in het label
    const b = S.boodschappen.find((x) => x.id === +k.dataset[richting > 0 ? 'plus' : 'min']);
    if (b) api('PUT', `boodschappen/${b.id}`, { hoeveelheid: volgendeStap(b.hoeveelheid, b.eenheid, richting) });
  }));
  stappen('[data-plus]', 1);
  stappen('[data-min]', -1);
  // winkelkeuze staat standaard open; dichtklappen kan en blijft onthouden zolang de app open is
  filterMenuOnthouden();
  $$m('[data-winkel]').forEach((b) => (b.onclick = () => { ui.winkel = b.dataset.winkel; tekenBoodschappen(); }));
  $$m('[data-bewerk]').forEach((k) => (k.onclick = (e) => { e.preventDefault(); boodschapBewerken(+k.dataset.bewerk); }));
  $$m('[data-vink]').forEach((c) => (c.onchange = () => api('PUT', `boodschappen/${c.dataset.vink}`, { afgevinkt: c.checked })));
  $$m('[data-weg]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); api('DELETE', `boodschappen/${b.dataset.weg}`); }));
  $$m('[data-prijs]').forEach((k) => (k.onclick = (e) => {
    e.preventDefault();
    const b = S.boodschappen.find((x) => x.id === +k.dataset.prijs);
    if (b) prijzenPaneel(b.naam, catalogusVan(b.naam)?.eenheid || S.producten.find((p) => zelfde(p.naam, b.naam))?.eenheid || b.eenheid || 'stuks');
  }));
  $$m('[data-hv]').forEach((s) => (s.onclick = (e) => { e.preventDefault(); hoeveelheidKiezen(+s.dataset.hv); }));
  // een ander merk kiezen voor een boodschap (de prijs wordt opnieuw berekend)
  $$m('[data-merkkies]').forEach((k) => (k.onclick = async (e) => {
    e.preventDefault();
    const b = S.boodschappen.find((x) => x.id === +k.dataset.merkkies);
    if (!b || zelfde(b.merk || '', k.dataset.merk)) return;
    await api('PUT', `boodschappen/${b.id}`, { merk: k.dataset.merk });
    toast(`${b.naam}: ${k.dataset.merk}`);
  }));
  const klaar = $m('#klaar');
  if (klaar) klaar.onclick = () => winkelenAfronden(af.map((x) => x.b.id));
}

/** Aantal én eenheid van een boodschap op de lijst aanpassen (tik op het getal). */
function hoeveelheidKiezen(id) {
  paneelOpenen((el) => {
    const b = S.boodschappen.find((x) => x.id === id);
    if (!b) return paneelSluiten();
    if (alGetekend('hoeveelheid-kiezen')) return; // niet opnieuw tekenen terwijl je typt
    const e0 = b.eenheid || S.producten.find((p) => zelfde(p.naam, b.naam))?.eenheid || catalogusVan(b.naam)?.eenheid || 'stuks';
    const keuzes = eenheden().includes(e0) ? eenheden() : [...eenheden(), e0];
    const bi = boodschapInhoudVan(b);
    el.innerHTML = `${paneelKop(`Hoeveel ${esc(b.naam)}?`, 'Kies het aantal, de eenheid en eventueel de inhoud.')}
      <div style="margin-bottom:1rem"><span class="veld-titel">Hoeveel</span><div class="aantal-kies">
        <button type="button" class="rond" id="hk-min" aria-label="Minder">−</button>
        <input id="hk-hv" inputmode="decimal" value="${esc(fmt(b.hoeveelheid ?? stapVan(e0)))}" aria-label="Hoeveelheid">
        <button type="button" class="rond" id="hk-plus" aria-label="Meer">+</button>
        <select id="hk-eenheid" aria-label="Eenheid">${opties(keuzes, e0)}${NIEUWE_EENHEID}</select></div></div>
      ${inhoudVeldenHtml('hk', e0, bi?.per, bi?.eenheid)}
      <div class="paneel-voet"><button class="knop" data-sluit>Annuleren</button><button class="knop primair" id="hk-ok">Bewaren</button></div>`;
    sluitKnoppen(el);
    const hv = $('#hk-hv', el), eenheid = $('#hk-eenheid', el);
    const minKnopZetten = () => { $('#hk-min', el).disabled = !(num(hv.value) > stapVan(eenheid.value)); };
    $('#hk-plus', el).onclick = () => { hv.value = fmt(volgendeStap(num(hv.value), eenheid.value, 1)); minKnopZetten(); };
    $('#hk-min', el).onclick = () => { hv.value = fmt(volgendeStap(num(hv.value), eenheid.value, -1)); minKnopZetten(); };
    hv.oninput = minKnopZetten;
    // stond het aantal nog op de standaardstap van de vorige eenheid (1 stuk), neem dan die van de nieuwe (100 g ...)
    let vorige = eenheid.value;
    eenheid.onchange = () => { if (num(hv.value) === stapVan(vorige)) hv.value = fmt(stapVan(eenheid.value)); vorige = eenheid.value; minKnopZetten(); inhoudVeldenZetten(el, 'hk', eenheid.value); };
    minKnopZetten();
    $('#hk-ok', el).onclick = async () => {
      const h = num(hv.value);
      const inh = inhoudVeldenLezen(el, 'hk', eenheid.value);
      if (!inh) return;
      await api('PUT', `boodschappen/${b.id}`, { hoeveelheid: h, eenheid: h === null ? '' : eenheid.value, ...inh });
      paneelSluiten();
    };
    if (fijneMuis()) setTimeout(() => { hv.focus(); hv.select(); }, 30);
  });
}

/** Velden "inhoud per stuk/pak" van een boodschap (alleen zichtbaar bij telbare eenheden). */
function inhoudVeldenHtml(id, eenheid, inhoud, inhoudEenheid) {
  const e = eenheid || 'stuks';
  return `<div class="rij2" id="${id}-inhoud-rij"${TELBAAR.has(e) ? '' : ' hidden'}>
    <label class="veld"><span id="${id}-inhoud-titel">Inhoud per ${esc(perTekst(TELBAAR.has(e) ? e : 'stuks'))} (mag leeg)</span><input id="${id}-inhoud" inputmode="decimal" value="${inhoud > 0 ? esc(fmt(inhoud)) : ''}" placeholder="bv. 500"></label>
    <label class="veld"><span>Eenheid inhoud</span><select id="${id}-inhoud-eenheid">${inhoudOpties(inhoudEenheid, 'g')}</select></label></div>`;
}
/** Inhoudvelden tonen of verbergen bij een andere eenheid. */
function inhoudVeldenZetten(el, id, eenheid) {
  const rij = $(`#${id}-inhoud-rij`, el);
  if (!rij) return;
  rij.hidden = !TELBAAR.has(eenheid || 'stuks');
  if (!rij.hidden) $(`#${id}-inhoud-titel`, el).textContent = `Inhoud per ${perTekst(eenheid || 'stuks')} (mag leeg)`;
}
/** De ingevulde inhoud lezen: { inhoud, inhoud_eenheid }, of null (met melding) als ze niet klopt. */
function inhoudVeldenLezen(el, id, eenheid) {
  const tekst = $(`#${id}-inhoud`, el).value.trim(), i = num(tekst);
  if (!TELBAAR.has(eenheid || 'stuks') || !tekst) return { inhoud: null, inhoud_eenheid: '' };
  if (!(i > 0)) { toast('Vul een geldige inhoud in, of laat het veld leeg.'); $(`#${id}-inhoud`, el).focus(); return null; }
  return { inhoud: i, inhoud_eenheid: $(`#${id}-inhoud-eenheid`, el).value };
}

/** Met hoeveel de knoppen − en + een hoeveelheid veranderen. */
const stapVan = (e) => ({ g: 100, ml: 100, cl: 10, kg: 0.5, l: 0.5 })[e] || 1;
function volgendeStap(h, e, richting) {
  const stap = stapVan(e);
  if (h === null || h === undefined) return richting > 0 ? stap : null;
  return Math.max(stap, Math.round((h + richting * stap) * 100) / 100);
}

/** Menu om zelf een boodschap te kiezen of te typen, met het aantal erbij. Blijft open om er meer toe te voegen. */
function boodschapToevoegen() {
  let zoek = '', eenheidZetten = () => {}, meerVullen = () => {}, meerLezen = () => ({}), meerVoor = null;
  const bekendeEenheid = (naam) => S.producten.find((p) => zelfde(p.naam, naam))?.eenheid || catalogusVan(naam)?.eenheid || 'stuks';
  paneelOpenen((el) => {
    const lijstTekenen = () => {
      const q = zoek.trim().toLowerCase();
      // elk merk en elke inhoud uit de catalogus als aparte keuze
      // met meer merken of inhouden ook een keuze "elk merk": je beslist pas in de winkel welk merk het wordt
      const namen = catalogusnamen().flatMap((n) => { const c = catalogusVan(n); if (!c) return [{ n, v: null }];
        const vs = variantenVan(c).map((v) => ({ n, v })); return vs.length > 1 ? [{ n, v: null, elk: true }, ...vs] : vs; })
        .filter(({ n, v, elk }) => !q || `${n} ${elk ? 'elk merk' : v ? v.merk || '' : merkVan(n)}`.toLowerCase().includes(q));
      const opLijst = (n) => S.boodschappen.filter((b) => zelfde(b.naam, n) && !b.afgevinkt);
      // in huis: per merk en inhoud als het product er meer heeft
      const inHuis = (n, v) => { const c = catalogusVan(n); return S.producten.filter((p) => (c && v ? hoortBijVariant(p, c, v) : zelfde(p.naam, n)) && p.hoeveelheid > 0); };
      $('#bt-zoek-blok', el).hidden = !catalogusnamen().length;
      $('#bt-lijst', el).innerHTML = namen.length ? `<ul class="lijst">${namen.map(({ n, v, elk }, i) => {
        const b = opLijst(n), h = inHuis(n, v);
        const onder = b.length ? `Staat op je lijst${b.some((x) => x.hoeveelheid) ? ': ' + b.map((x) => boodschapTekst(x) || '?').join(' + ') : ''}`
          : h.length ? `In huis: ${elk ? hoeveelTekst(totaalInHuis(n), catalogusVan(n)?.eenheid || 'stuks') || fmt(totaalInHuis(n)) : h.map(voorraadTekst).join(' + ')}` : 'Niet in huis';
        const merkDeel = elk ? '<span class="merk"> · elk merk</span>' : merkTekst({ merk: v ? v.merk : merkVan(n) });
        return `<li><button type="button" class="rij" data-kies="${i}"><span class="naam">${esc(n)}${merkDeel}<small>${esc([elk ? 'merk en inhoud om het even' : v && [inhoudLabel(v), maatWoord(maatVan(v))].filter(Boolean).join(' '), onder].filter(Boolean).join(' · '))}</small></span><span class="rechts">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}</span></button></li>`;
      }).join('')}</ul>` : q ? `<div class="leeg">Niets gevonden in je catalogus. Typ het bij Wat en tik op Toevoegen om "${esc(zoek.trim())}" op je lijst te zetten.</div>` : '';
      $$('[data-kies]', el).forEach((k) => (k.onclick = () => {
        const { n, v, elk } = namen[+k.dataset.kies];
        $('#bt-naam', el).value = n; zoek = n; $('#bt-zoek', el).value = ''; $('#bt-merk', el).value = elk ? '' : v ? v.merk || '' : merkVan(n);
        eenheidZetten(bekendeEenheid(n));
        meerVullen(n);
        maatZetten(el, 'bt', v ? v.verpakking : ''); minimumVinkjeMaat(el, 'bt');
        if (v || elk) { // de inhoud van deze variant; bij elk merk geen inhoud
          $('#bt-inhoud', el).value = v && v.inhoud > 0 ? fmt(v.inhoud) : '';
          if (v) $('#bt-inhoud-eenheid', el).value = v.inhoud_eenheid || 'g';
          $('#bt-inhoud', el).dispatchEvent(new Event('input'));
        }
        lijstTekenen();
        if (fijneMuis()) { $('#bt-hv', el).focus(); $('#bt-hv', el).select(); }
      }));
    };
    if (!alGetekend('boodschap-toevoegen')) {
      el.innerHTML = `${paneelKop('Boodschap toevoegen', 'Kies uit je catalogus of typ zelf iets.')}
        <label class="veld"><span>Wat</span><input id="bt-naam" placeholder="bv. Appelsienen" autocomplete="off" autocapitalize="sentences"></label>
        <label class="veld"><span>Merk (mag leeg)</span><input id="bt-merk" placeholder="bv. Bonduelle" autocomplete="off" autocapitalize="words"></label>
        ${maatKeuzeHtml('bt', '')}
        ${minimumVinkjeHtml('bt', 0)}
        <div style="margin-bottom:1rem"><span class="veld-titel">Hoeveel</span><div class="aantal-kies">
          <button type="button" class="rond" id="bt-min" aria-label="Minder">−</button>
          <input id="bt-hv" inputmode="decimal" value="1" aria-label="Hoeveelheid">
          <button type="button" class="rond" id="bt-plus" aria-label="Meer">+</button>
          <select id="bt-eenheid" aria-label="Eenheid">${eenheidOpties('stuks')}</select></div></div>
        ${inhoudVeldenHtml('bt', 'stuks', null, 'g')}
        <details class="meer" id="bt-meer" style="margin-bottom:1rem"><summary>Categorie, plaats, houdbaarheid en prijzen</summary><div id="bt-meer-inhoud"></div></details>
        <div id="bt-zoek-blok"><div class="sectie-titel"><span>Kies uit je catalogus</span></div>
          <div class="zoek">${ICOON.zoek}<input type="search" id="bt-zoek" placeholder="Zoek op naam of merk" autocomplete="off"></div></div>
        <div id="bt-lijst"></div>
        <div class="paneel-voet"><button class="knop" data-sluit>Klaar</button><button class="knop primair" id="bt-ok">Toevoegen</button></div>`;
      sluitKnoppen(el);
      const naam = $('#bt-naam', el), hv = $('#bt-hv', el), eenheid = $('#bt-eenheid', el);
      // Dezelfde gegevens als bij "Aan catalogus toevoegen"; ze worden in de catalogus bewaard (ingevuld voor een gekend product).
      const meer = $('#bt-meer', el);
      let type = 'THT', meerAangeraakt = false, btPrijzen = () => {};
      const productEenheid = () => catalogusVan(meerVoor || '')?.eenheid || eenheid.value || 'stuks';
      meerVullen = (n) => {
        const k = n ? catalogusnamen().find((x) => zelfde(x, n)) || null : null;
        if (k !== null && meerVoor !== null && zelfde(k, meerVoor)) return;
        if (k === null && meerVoor === null && meerAangeraakt) return; // zelf iets nieuws aan het invullen: niet wissen
        meerVoor = k; meerAangeraakt = false;
        minimumVinkjeZetten(el, 'bt', k);
        const c = (k && catalogusVan(k)) || {};
        type = c.datumtype === 'TGT' ? 'TGT' : 'THT';
        const pe = productEenheid();
        if (k && !meerVarianten(k)) { // de inhoud van het gekende product voorstellen; je mag ze voor deze boodschap aanpassen
          $('#bt-inhoud', el).value = c.inhoud > 0 ? fmt(c.inhoud) : '';
          $('#bt-inhoud-eenheid', el).value = c.inhoud_eenheid || 'g';
        }
        $('#bt-meer-inhoud', el).innerHTML = `
          <div class="rij2">
            <label class="veld"><span>Categorie</span><select id="bt-cat">${opties(categorieen(), c.categorie || '', 'Geen')}</select></label>
            <label class="veld"><span>Plaats</span><select id="bt-plaats">${opties(locaties(), c.locatie || '', 'Geen')}</select></label>
          </div>
          <div class="segment" id="bt-type">
            <button type="button" data-w="THT">Ten minste houdbaar tot</button>
            <button type="button" data-w="TGT">Te gebruiken tot</button>
          </div>
          <details class="meer"${k && prijzenVan(k).length ? ' open' : ''} style="margin-top:.8rem" id="bt-prijzen"></details>`;
        const typeTekenen = () => $$('#bt-type button', el).forEach((b) => b.classList.toggle('aan', b.dataset.w === type));
        typeTekenen();
        $$('#bt-type button', el).forEach((b) => (b.onclick = () => { type = b.dataset.w; meerAangeraakt = true; typeTekenen(); }));
        // de prijzen gelden voor de inhoud van deze boodschap (bv. pak à 1 kg)
        btPrijzen = () => formPrijzenZetten($('#bt-prijzen', el), meerVoor || '', productEenheid(), formInhoud(el, 'bt', eenheid.value),
          () => ({ eenheid: productEenheid(), inhoud_eenheid: $('#bt-inhoud', el).value.trim() ? $('#bt-inhoud-eenheid', el).value : '' }));
        btPrijzen();
        $('#bt-inhoud', el).oninput = btPrijzen;
        $('#bt-merk', el).oninput = btPrijzen;
        $('#bt-inhoud-eenheid', el).onchange = btPrijzen;
        const aangeraakt = () => { meerAangeraakt = true; };
        $('#bt-meer-inhoud', el).addEventListener('input', aangeraakt);
        $('#bt-meer-inhoud', el).addEventListener('change', aangeraakt);
        $('#bt-meer-inhoud', el).addEventListener('click', (e) => { if (e.target.closest('[data-pz-weg], .pz-erbij')) aangeraakt(); });
      };
      // null: er klopt iets niet (melding getoond); {}: niets te bewaren; anders de gegevens voor de catalogus
      meerLezen = () => {
        if (!meerAangeraakt) return {};
        const pe = productEenheid();
        btPrijzen();
        const pz = $('#bt-prijzen', el), prijzen = prijzenLezen(pz, pe);
        if (!prijzen) { meer.open = true; pz.open = true; return null; }
        const prijsDeel = pz.dataset.aangeraakt ? { prijzen, prijzen_inhoud: formPrijzenInhoud(pz) } : {};
        // de inhoud hoort bij de boodschap; het product krijgt ze alleen als het er nog geen heeft
        const bi = inhoudVeldenLezen(el, 'bt', eenheid.value) || {};
        const c = catalogusVan(meerVoor || '');
        return { eenheid: pe, categorie: $('#bt-cat', el).value, locatie: $('#bt-plaats', el).value, datumtype: type, ...prijsDeel,
          ...(bi.inhoud > 0 && TELBAAR.has(pe) && !(c?.inhoud > 0) ? bi : {}) };
      };
      // zoeken in de catalogus: via het zoekveld, of gewoon door te typen bij Wat
      $('#bt-zoek', el).oninput = () => { zoek = $('#bt-zoek', el).value; lijstTekenen(); };
      naam.oninput = () => { zoek = naam.value; $('#bt-zoek', el).value = ''; const e = catalogusnamen().find((n) => zelfde(n, naam.value)); if (e) { eenheidZetten(bekendeEenheid(e)); if (!$('#bt-merk', el).value && !meerVarianten(e)) $('#bt-merk', el).value = merkVan(e); } meerVullen(naam.value.trim()); lijstTekenen(); };
      const minKnopZetten = () => { $('#bt-min', el).disabled = !(num(hv.value) > stapVan(eenheid.value)); };
      $('#bt-plus', el).onclick = () => { hv.value = fmt(volgendeStap(num(hv.value), eenheid.value, 1)); minKnopZetten(); };
      $('#bt-min', el).onclick = () => { hv.value = fmt(volgendeStap(num(hv.value), eenheid.value, -1)); minKnopZetten(); };
      hv.oninput = minKnopZetten;
      // stond het aantal nog op de standaardstap van de vorige eenheid (1 stuk), neem dan die van de nieuwe (100 g ...)
      let vorige = eenheid.value;
      eenheidZetten = (e) => { eenheid.value = e; if (num(hv.value) === stapVan(vorige)) hv.value = fmt(stapVan(e)); vorige = e; minKnopZetten(); inhoudVeldenZetten(el, 'bt', e); btPrijzen(); };
      eenheid.onchange = () => {
        eenheidZetten(eenheid.value);
        if (meerVoor === null) prijsPerZetten($('#bt-prijzen', el), productEenheid()); // nieuw product
      };
      minKnopZetten();
      minimumVinkjeKoppelen(el, 'bt');
      maatKoppelen(el, 'bt');
      meerVullen('');
      $('#bt-ok', el).onclick = async () => {
        const tekst = naam.value.trim();
        if (!tekst) { toast('Typ of kies eerst wat je wilt kopen.'); naam.focus(); return; }
        const n = catalogusnamen().find((x) => zelfde(x, tekst)) || tekst.charAt(0).toUpperCase() + tekst.slice(1);
        const h = num(hv.value);
        const inh = inhoudVeldenLezen(el, 'bt', eenheid.value);
        if (!inh) return;
        const extra = meerLezen();
        if (!extra) return;
        const alleMerken = minimumVinkjeLezen(el, 'bt');
        if (alleMerken === null) return;
        try {
          if (Object.keys(extra).length) {
            const bestaat = catalogusVan(n);
            // een gekend product houdt zijn eenheid
            const { eenheid: pe, ...rest } = extra;
            await api(bestaat ? 'PUT' : 'POST', 'catalogus', bestaat ? { naam: n, oudeNaam: bestaat.naam, ...rest } : { naam: n, eenheid: pe, ...rest });
          }
          await api('POST', 'boodschappen', { naam: n, hoeveelheid: h, eenheid: h === null ? '' : eenheid.value, ...inh, merk: $('#bt-merk', el).value.trim(), verpakking: maatLezen(el, 'bt'), product_id: S.producten.find((p) => zelfde(p.naam, n))?.id || null,
            ...(alleMerken !== undefined ? { catalogus_minimum: alleMerken } : {}) });
        } catch { return; /* melding al getoond */ }
        toast(lijstMelding(n, inh));
        naam.value = ''; $('#bt-merk', el).value = ''; $('#bt-zoek', el).value = ''; zoek = ''; hv.value = '1'; eenheid.value = vorige = 'stuks'; minKnopZetten();
        $('#bt-inhoud', el).value = ''; inhoudVeldenZetten(el, 'bt', 'stuks'); maatZetten(el, 'bt', '');
        meerVoor = null; meerAangeraakt = false; meerVullen(''); meer.open = false; minimumVinkjeZetten(el, 'bt', '', true);
        lijstTekenen();
      };
    }
    lijstTekenen();
  });
}

/** Een boodschap op de lijst bewerken: naam, hoeveelheid en eenheid, en doorgaan naar het product zelf. */
function boodschapBewerken(id) {
  paneelOpenen((el) => {
    const b = S.boodschappen.find((x) => x.id === id);
    if (!b) return paneelSluiten();
    if (alGetekend('boodschap-bewerken')) return; // niet opnieuw tekenen terwijl je typt
    const product = S.producten.find((p) => zelfde(p.naam, b.naam));
    el.innerHTML = `${paneelKop('Boodschap bewerken', b.afgevinkt ? 'Ligt al in je mandje' : 'Staat op je boodschappenlijst')}
      <label class="veld"><span>Wat</span><input id="bb-naam" value="${esc(b.naam)}" autocomplete="off" autocapitalize="sentences"></label>
      <label class="veld"><span>Merk (mag leeg)</span><input id="bb-merk" value="${esc(b.merk || '')}" placeholder="bv. Bonduelle" autocomplete="off" autocapitalize="words"></label>
      ${maatKeuzeHtml('bb', b.verpakking)}
      <div style="margin-bottom:1rem"><span class="veld-titel">Hoeveel</span><div class="aantal-kies">
        <button type="button" class="rond" id="bb-min" aria-label="Minder">−</button>
        <input id="bb-hv" inputmode="decimal" value="${esc(fmt(b.hoeveelheid))}" placeholder="–" aria-label="Hoeveelheid">
        <button type="button" class="rond" id="bb-plus" aria-label="Meer">+</button>
        <select id="bb-eenheid" aria-label="Eenheid">${eenheidOpties(b.eenheid || 'stuks')}</select></div></div>
      ${inhoudVeldenHtml('bb', b.eenheid || 'stuks', boodschapInhoudVan(b)?.per, boodschapInhoudVan(b)?.eenheid)}
      <ul class="acties">
        <li><button id="bb-prijs">Prijzen per winkel</button></li>
        <li><button id="bb-product">${product ? 'Product in je voorraad bewerken' : 'Als product in je voorraad zetten'}</button></li>
        <li><button id="bb-weg" class="gevaar">Van de lijst halen</button></li>
      </ul>
      <div class="paneel-voet"><button class="knop" data-sluit>Annuleren</button><button class="knop primair" id="bb-ok">Bewaren</button></div>`;
    sluitKnoppen(el);
    const naam = $('#bb-naam', el), hv = $('#bb-hv', el), eenheid = $('#bb-eenheid', el);
    suggesties(naam, catalogusnamen, (n) => { const e = S.producten.find((p) => zelfde(p.naam, n))?.eenheid || catalogusVan(n)?.eenheid; if (e) { eenheid.value = e; inhoudVeldenZetten(el, 'bb', e); } });
    const minKnopZetten = () => { $('#bb-min', el).disabled = !(num(hv.value) > stapVan(eenheid.value)); };
    $('#bb-plus', el).onclick = () => { hv.value = fmt(volgendeStap(num(hv.value), eenheid.value, 1)); minKnopZetten(); };
    $('#bb-min', el).onclick = () => { hv.value = fmt(volgendeStap(num(hv.value), eenheid.value, -1)); minKnopZetten(); };
    hv.oninput = minKnopZetten;
    eenheid.onchange = () => { minKnopZetten(); inhoudVeldenZetten(el, 'bb', eenheid.value); };
    maatKoppelen(el, 'bb');
    minKnopZetten();
    const bewaren = async () => {
      const n = naam.value.trim();
      if (!n) { toast('Vul een naam in.'); naam.focus(); return false; }
      const h = num(hv.value);
      const inh = inhoudVeldenLezen(el, 'bb', eenheid.value);
      if (!inh) return false;
      await api('PUT', `boodschappen/${b.id}`, { naam: n.charAt(0).toUpperCase() + n.slice(1), hoeveelheid: h, eenheid: h === null ? '' : eenheid.value, ...inh, merk: $('#bb-merk', el).value.trim(), verpakking: maatLezen(el, 'bb') });
      return true;
    };
    $('#bb-ok', el).onclick = async () => { if (await bewaren()) { paneelSluiten(); toast('Bewaard'); } };
    $('#bb-prijs', el).onclick = async () => {
      if (!(await bewaren())) return;
      const nb = S.boodschappen.find((x) => x.id === b.id) || b;
      prijzenPaneel(nb.naam, catalogusVan(nb.naam)?.eenheid || S.producten.find((p) => zelfde(p.naam, nb.naam))?.eenheid || nb.eenheid || 'stuks');
    };
    $('#bb-product', el).onclick = async () => {
      if (!(await bewaren())) return;
      const nb = S.boodschappen.find((x) => x.id === b.id) || b;
      const p = S.producten.find((x) => zelfde(x.naam, nb.naam));
      if (p) productFormulier(p);
      else productFormulier(null, { naam: nb.naam, eenheid: nb.eenheid || 'stuks', hoeveelheid: nb.hoeveelheid ?? 1, inhoud: nb.inhoud || null, inhoud_eenheid: nb.inhoud_eenheid || '', verpakking: maatVan(nb) });
    };
    $('#bb-weg', el).onclick = async () => { await api('DELETE', `boodschappen/${b.id}`); paneelSluiten(); toast(`${b.naam} van je lijst gehaald`); };
  });
}

/** Afgevinkte boodschappen (van de gekozen winkel, of alle) in de voorraad zetten. */
function winkelenAfronden(ids) {
  const items = S.boodschappen.filter((b) => b.afgevinkt && (!ids || ids.includes(b.id))).map((b) => {
    const bekend = S.producten.find((p) => zelfde(p.naam, b.naam));
    // zonder merk en inhoud op de lijst: bij het afronden kies je welk merk en welke inhoud je kocht (uit de catalogus, of zelf ingevuld)
    const c = catalogusVan(b.naam);
    // een kleine of grote verpakking op de lijst: alleen merken en inhouden van die grootte (of zonder grootte)
    const varianten = !b.merk && !boodschapInhoudVan(b) ? (c ? variantenVan(c).filter((v) => (v.merk || prijsSleutel(v)) && (!maatVan(b) || !maatVan(v) || maatVan(v) === maatVan(b))) : []) : null;
    // grote verpakking die je thuis over potten verdeelt: de potten gaan bij die voorraadregel
    const doel = b.potten_voor != null ? S.producten.find((p) => p.id === b.potten_voor) : null;
    const potten = doel?.grootverpakking?.potten ? Math.round(doel.grootverpakking.potten * (b.hoeveelheid ?? 1) * 100) / 100 : null;
    return { b, varianten, doel, potten, eenheid: b.eenheid || bekend?.eenheid || 'stuks', locatie: (doel || bekend)?.locatie || locaties()[0] || '', type: (doel || bekend)?.datumtype || 'THT', datum: '' };
  });
  paneelOpenen((el) => {
    if (alGetekend('af')) return; // niet opnieuw tekenen terwijl je typt
    el.innerHTML = `${paneelKop('In je voorraad zetten', 'Vul een datum in als je die bij de hand hebt.')}
      <div id="af-lijst">${items.map((x, n) => `
        <div class="afronden-rij" data-n="${n}">
          <div class="titel"><span>${esc(x.b.naam)}${maatVan(x.b) ? ` <span class="maat maat-${maatVan(x.b)}">${maatVan(x.b)}</span>` : ''}${boodschapInhoudVan(x.b) ? ` <small class="stil">à ${esc(hoeveelTekst(boodschapInhoudVan(x.b).per, boodschapInhoudVan(x.b).eenheid))}</small>` : ''}</span></div>
          <div class="velden">
            ${x.varianten ? `<select class="af-variant" aria-label="Welk merk en welke inhoud">${['<option value="">Zonder merk of inhoud</option>',
              ...x.varianten.map((v, i) => `<option value="${i}">${esc(variantLabel(v))}</option>`), '<option value="ander">Ander merk of inhoud invullen…</option>'].join('')}</select>
            <div class="af-ander" hidden>
              <input class="af-merk" placeholder="Merk (mag leeg)" aria-label="Merk" autocomplete="off" autocapitalize="words">
              <div class="af-inhoud-rij"><input class="af-inhoud" inputmode="decimal" placeholder="Inhoud per stuk" aria-label="Inhoud per stuk">
                <select class="af-inhoud-eenheid" aria-label="Eenheid inhoud">${inhoudOpties('', 'g')}</select></div>
              <label class="vink uitlek-vink af-uitlek-vink"><input type="checkbox" class="af-uitlek"><span class="vakje"></span><span>Uitlekgewicht</span></label>
            </div>` : ''}
            ${x.doel ? `<label class="veld af-potten-veld"><span>${x.doel.eenheid === 'pot' ? 'Verdeeld over hoeveel potten?' : `Hoeveel ${esc(meervoud(x.doel.eenheid))} zitten erin?`} <small class="stil">leeg: de verpakking zelf in je voorraad zetten</small></span>
              <input class="af-potten" inputmode="decimal" value="${x.potten ? esc(fmt(x.potten)) : ''}" placeholder="bv. 4" aria-label="Aantal ${esc(meervoud(x.doel.eenheid))}"></label>` : ''}
            <input class="af-hv" inputmode="decimal" value="${esc(fmt(x.b.hoeveelheid ?? 1))}" aria-label="Hoeveelheid">
            <select class="af-eenheid" aria-label="Eenheid">${eenheidOpties(x.eenheid)}</select>
            <select class="af-plaats" aria-label="Plaats">${opties(locaties(), x.locatie, 'Plaats')}</select>
            <input type="date" class="af-datum" aria-label="Houdbaar tot">
            <div class="segment af-type">
              <button type="button" data-w="THT" class="${x.type === 'THT' ? 'aan' : ''}">Ten minste houdbaar tot</button>
              <button type="button" data-w="TGT" class="${x.type === 'TGT' ? 'aan' : ''}">Te gebruiken tot</button></div>
          </div></div>`).join('')}</div>
      <div class="paneel-voet"><button class="knop" id="af-alleen">Alleen van lijst halen</button><button class="knop primair" id="af-ok">In voorraad zetten</button></div>`;
    sluitKnoppen(el);
    $$('.af-type', el).forEach((seg) => $$('button', seg).forEach((b) => (b.onclick = () => $$('button', seg).forEach((c) => c.classList.toggle('aan', c === b)))));
    $('#af-alleen', el).onclick = async () => { await api('POST', 'boodschappen/afgevinkte-wissen', { ids: items.map((x) => x.b.id) }); paneelSluiten(); };
    $$('.af-variant', el).forEach((s) => (s.onchange = () => {
      const ander = $('.af-ander', s.closest('.afronden-rij'));
      ander.hidden = s.value !== 'ander';
      if (!ander.hidden) $('.af-merk', ander).focus();
    }));
    // het gekozen merk en de inhoud van een rij; null als de ingevulde inhoud niet klopt
    const variantVan = (r) => {
      const x = items[+r.dataset.n], k = $('.af-variant', r)?.value;
      if (!x.varianten || !k) return {};
      if (k !== 'ander') return { variant: x.varianten[+k] };
      const tekst = $('.af-inhoud', r).value.trim(), i = num(tekst);
      if (tekst && !(i > 0)) { toast('Vul een geldige inhoud in, of laat het veld leeg.'); $('.af-inhoud', r).focus(); return null; }
      return { variant: { merk: $('.af-merk', r).value.trim(), inhoud: i > 0 ? i : null, inhoud_eenheid: i > 0 ? $('.af-inhoud-eenheid', r).value : '', uitlekgewicht: $('.af-uitlek', r).checked } };
    };
    $('#af-ok', el).onclick = async () => {
      const keuzes = $$('.afronden-rij', el).map(variantVan);
      if (keuzes.includes(null)) return;
      const fout = $$('.af-potten', el).find((i) => i.value.trim() && !(num(i.value) > 0));
      if (fout) { toast('Vul een geldig aantal in, of laat het veld leeg.'); fout.focus(); return; }
      const regels = $$('.afronden-rij', el).map((r, n) => ({
        ...keuzes[n],
        ...($('.af-potten', r) && num($('.af-potten', r).value) > 0 ? { potten: num($('.af-potten', r).value) } : {}),
        id: items[+r.dataset.n].b.id, hoeveelheid: num($('.af-hv', r).value) ?? 1, eenheid: $('.af-eenheid', r).value,
        locatie: $('.af-plaats', r).value, vervaldatum: $('.af-datum', r).value, datumtype: $('.af-type .aan', r)?.dataset.w || 'THT',
      }));
      await api('POST', 'boodschappen/afrekenen', { items: regels });
      paneelSluiten();
      toast(`${regels.length} ${regels.length === 1 ? 'product' : 'producten'} in je voorraad gezet`);
    };
  });
}

// ---------------------------------------------------------------------------
// RECEPTEN
// ---------------------------------------------------------------------------
/** De bewaarde koppeling van een ingrediënt, zonder koppelingen die vroeger vanzelf verkeerd bewaard werden. */
const bewaardeKoppeling = (i) => (i.voorraadnaam && !koppelingFout(i.naam, i.voorraadnaam) ? i.voorraadnaam : '');
/** Aan welk voorraadproduct hoort een ingrediënt: zelf gekozen, zelf "niet gekoppeld", of vanzelf gezocht. */
const koppelingVan = (i, namen, geleerd) => (i.geenKoppeling ? '' : bewaardeKoppeling(i) || zoekVoorraadnaam(i.naam, namen, geleerd));

function geleerdeKoppelingen() {
  const k = {};
  for (const r of S.recepten) for (const i of r.ingredienten) { const v = bewaardeKoppeling(i); if (v) k[sleutelwoorden(i.naam).join(' ')] = v; }
  return k;
}
const altijdInHuis = (i) => ALTIJD_IN_HUIS.has((i.naam || '').trim().toLowerCase()) && !bewaardeKoppeling(i);

function beschikbaarheid(ingr, factor = 1, namen = productnamen(), geleerd = geleerdeKoppelingen()) {
  if (altijdInHuis(ingr)) return { st: 'ok', partijen: [], altijd: true };
  const naam = koppelingVan(ingr, namen, geleerd);
  if (!naam) return { st: 'ontbreekt', naam: '' };
  // geopende verpakkingen eerst opmaken
  const partijen = S.producten.filter((p) => zelfde(p.naam, naam) && p.hoeveelheid > 0 && houdbaarheid(p).niveau !== 4)
    .sort((a, b) => !b.geopend - !a.geopend || (a.vervaldatum || '9999').localeCompare(b.vervaldatum || '9999'));
  if (!partijen.length) return { st: 'ontbreekt', naam };
  // eenheid om in te rekenen: die van de voorraad, of de inhoud per verpakking als het recept bv. in gram rekent
  let eenheid = partijen[0].eenheid;
  const re = ingr.eenheid || 'stuks', inh0 = inhoudVan(partijen[0]);
  if (omrekenen(1, re, eenheid) === null && inh0 && omrekenen(1, re, inh0.eenheid) !== null) eenheid = inh0.eenheid;
  const totaal = partijen.reduce((s, p) => s + (vanProduct(p.hoeveelheid, p, eenheid) ?? 0), 0);
  const nodigRecept = ingr.hoeveelheid !== null && ingr.hoeveelheid !== undefined ? ingr.hoeveelheid * factor : null;
  const nodig = omrekenen(nodigRecept, ingr.eenheid || 'stuks', eenheid);
  return { st: nodig !== null && totaal + 1e-9 < nodig ? 'weinig' : 'ok', naam, partijen, eenheid, totaal, nodig, nodigRecept };
}
function dekking(r, namen, geleerd) {
  const telt = r.ingredienten.filter((i) => !altijdInHuis(i));
  return { ok: telt.filter((i) => beschikbaarheid(i, 1, namen, geleerd).st === 'ok').length, totaal: telt.length };
}

// Indeling van recepten: één soort gerecht per recept en categorieën (meerdere mogelijk).
// Beide lijsten pas je zelf aan bij Instellingen; hun volgorde daar is ook de volgorde in de app.
const receptSoorten = () => S.instellingen.recept_soorten || [];
const receptCategorieen = () => S.instellingen.recept_categorieen || [];
// namen ordenen volgens een lijst uit Instellingen (wat er niet in staat achteraan), zonder dubbels
function volgensLijst(namen, lijst) {
  const uit = [];
  for (const x of namen) if (x && !uit.some((y) => zelfde(x, y))) uit.push(x);
  const pos = (x) => { const i = lijst.findIndex((y) => zelfde(x, y)); return i < 0 ? 9999 : i; };
  return uit.sort((a, b) => pos(a) - pos(b) || a.localeCompare(b, 'nl'));
}

function tekenRecepten() {
  const namen = productnamen(), geleerd = geleerdeKoppelingen();
  const dringend = S.producten.filter((p) => [1, 2, 3].includes(houdbaarheid(p).niveau));
  let sugg = [];
  if (dringend.length) {
    sugg = S.recepten.map((r) => {
      const gebruikt = [];
      let score = 0;
      for (const i of r.ingredienten) {
        const naam = koppelingVan(i, namen, geleerd);
        const p = naam && dringend.find((d) => zelfde(d.naam, naam));
        if (p && !gebruikt.includes(p)) { gebruikt.push(p); score += p.datumtype === 'TGT' ? 3 : 1; }
      }
      return { r, gebruikt, score };
    }).filter((x) => x.gebruikt.length).sort((a, b) => b.score - a.score).slice(0, 3);
  }
  const zoek = ui.receptZoek.trim().toLowerCase();
  const f = ui.receptFilter;
  // filters die niet meer bestaan (recept verwijderd of aangepast) vanzelf loslaten
  if (f.soort && !S.recepten.some((r) => zelfde(r.soort, f.soort))) f.soort = '';
  if (f.cat && !S.recepten.some((r) => (r.categorieen || []).some((c) => zelfde(c, f.cat)))) f.cat = '';
  if (f.fav && !S.recepten.some((r) => r.favoriet)) f.fav = false;
  const gefilterd = !!(f.fav || f.inHuis || f.soort || f.cat);
  // alles in huis: elk ingrediënt (behalve zout, water …) ligt in voldoende hoeveelheid in de voorraad
  const allesInHuis = (r) => { const d = dekking(r, namen, geleerd); return d.ok === d.totaal; };
  const lijst = S.recepten.filter((r) => (!zoek || r.titel.toLowerCase().includes(zoek) || (r.soort || '').toLowerCase().includes(zoek)
      || (r.categorieen || []).some((c) => c.toLowerCase().includes(zoek)) || r.ingredienten.some((i) => i.naam.toLowerCase().includes(zoek)))
    && (!f.fav || r.favoriet) && (!f.inHuis || allesInHuis(r)) && (!f.soort || zelfde(r.soort, f.soort)) && (!f.cat || (r.categorieen || []).some((c) => zelfde(c, f.cat))));
  const rij = (r, onder) => {
    const d = dekking(r, namen, geleerd);
    return `<li><button class="rij" data-recept="${r.id}"><span class="naam">${r.favoriet ? `<span class="ster-mini" aria-label="Favoriet">${ICOON.sterVol}</span>` : ''}${esc(r.titel)}<small>${esc(onder)}</small></span>
      <span class="rechts">${d.ok}/${d.totaal}</span></button></li>`;
  };
  const onderschrift = (r, metSoort) => [metSoort && r.soort, r.personen && `${r.personen} personen`, r.bereidingstijd].filter(Boolean).join(' · ');
  // filterknoppen: alleen wat er bij je recepten echt voorkomt
  const soorten = volgensLijst(S.recepten.map((r) => r.soort), receptSoorten());
  const cats = volgensLijst(S.recepten.flatMap((r) => r.categorieen || []), receptCategorieen());
  const chip = (attr, w, tekst, aan) => `<button class="chip${aan ? ' aan' : ''}" ${attr}="${esc(w)}">${tekst}</button>`;
  const filterRij = S.recepten.length
    ? `<div class="chips recept-filter">${S.recepten.some((r) => r.favoriet) ? chip('data-rf', '1', `${ICOON.sterVol}Favorieten`, f.fav) : ''}${chip('data-rh', '1', 'Alles in huis', f.inHuis)}${soorten.map((x) => chip('data-rs', x, esc(x), zelfde(x, f.soort))).join('')}</div>` : '';
  const catRij = cats.length ? `<div class="chips recept-filter">${cats.map((x) => chip('data-rc', x, esc(x), zelfde(x, f.cat))).join('')}</div>` : '';
  // alle filterknoppen samen in één uitklapmenu, zodat je op een smartphone niet opzij hoeft te schuiven
  const actief = [f.fav && 'Favorieten', f.inHuis && 'Alles in huis', f.soort, f.cat].filter(Boolean);
  const filterMenu = filterRij || catRij ? `<details class="filter-uitklap${actief.length ? ' actief' : ''}" data-dicht="recept-filters"${ui.uitgeklapt.has('dicht:recept-filters') ? '' : ' open'}>
      <summary>${ICOON.filter}<span>Filters${actief.length ? `<small> · ${esc(actief.join(', '))}</small>` : ''}</span></summary>${filterRij}${catRij}</details>` : '';
  // zonder zoeken of filter: ingedeeld per soort gerecht
  let secties;
  if (!zoek && !gefilterd && soorten.length) {
    const groepen = [...soorten.map((x) => [x, lijst.filter((r) => zelfde(r.soort, x))]), ['Overige', lijst.filter((r) => !r.soort)]].filter(([, l]) => l.length);
    // elke soort is uitklapbaar; open/dicht blijft onthouden zolang de app open is
    secties = groepen.map(([titel, l]) => {
      const sleutel = `recept-soort:${titel.toLowerCase()}`;
      return `<details class="sectie uitklap recept-groep" data-uitklap="${esc(sleutel)}"${ui.uitgeklapt.has(sleutel) ? ' open' : ''}>
      <summary><span>${esc(titel)}</span><span class="stil">${l.length}</span></summary><ul class="lijst">
      ${l.map((r) => rij(r, onderschrift(r, false))).join('')}</ul></details>`;
    }).join('');
  } else if (lijst.length) {
    secties = `<section class="sectie"><div class="sectie-titel"><span>${zoek || gefilterd ? `Gevonden (${lijst.length})` : 'Alle recepten'}</span><span>in huis</span></div><ul class="lijst">
      ${lijst.map((r) => rij(r, onderschrift(r, true))).join('')}</ul></section>`;
  } else secties = S.recepten.length ? `<div class="leeg">${f.inHuis ? 'Voor geen enkel recept heb je alles in huis.' : 'Niets gevonden.'}${gefilterd ? '<br><button class="tekstknop" id="rf-wis">Filter wissen</button>' : ''}</div>` : '';
  inhoudZetten(`
    <header class="kop"><h1>Recepten</h1>
      <div class="kop-acties">${instellingenKnop}<button class="knop primair" id="r-nieuw">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}<span>Recept</span></button></div></header>
    ${S.recepten.length ? `<div class="zoek">${ICOON.zoek}<input type="search" id="zoek-recept" placeholder="Zoek op recept, categorie of ingrediënt" value="${esc(ui.receptZoek)}" autocomplete="off"></div>` : ''}
    ${filterMenu}
    ${sugg.length && !zoek && !gefilterd ? `<section class="sectie"><div class="sectie-titel">Gebruikt wat op moet</div><ul class="lijst">
      ${sugg.map(({ r, gebruikt }) => `<li><button class="rij" data-recept="${r.id}"><span class="stip ${gebruikt.some((p) => p.datumtype === 'TGT') ? 'rood' : 'oranje'}"></span>
        <span class="naam">${esc(r.titel)}<small>${esc(gebruikt.map((p) => p.naam.toLowerCase()).join(', '))}</small></span></button></li>`).join('')}</ul></section>` : ''}
    ${!S.recepten.length ? `<div class="leeg"><b>Nog geen recepten</b>Importeer een pdf of typ er zelf een.</div>` : ''}
    ${secties}`);
  $$m('[data-rf]').forEach((b) => (b.onclick = () => { f.fav = !f.fav; tekenRecepten(); }));
  $$m('[data-rh]').forEach((b) => (b.onclick = () => { f.inHuis = !f.inHuis; tekenRecepten(); }));
  $$m('[data-uitklap]').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) ui.uitgeklapt.add(d.dataset.uitklap); else ui.uitgeklapt.delete(d.dataset.uitklap);
  }));
  filterMenuOnthouden();
  $$m('[data-rs]').forEach((b) => (b.onclick = () => { f.soort = zelfde(f.soort, b.dataset.rs) ? '' : b.dataset.rs; tekenRecepten(); }));
  $$m('[data-rc]').forEach((b) => (b.onclick = () => { f.cat = zelfde(f.cat, b.dataset.rc) ? '' : b.dataset.rc; tekenRecepten(); }));
  const wis = $m('#rf-wis');
  if (wis) wis.onclick = () => { ui.receptFilter = { fav: false, inHuis: false, soort: '', cat: '' }; tekenRecepten(); };
  $m('#r-nieuw').onclick = receptToevoegenKeuze;
  const z = $m('#zoek-recept');
  if (z) z.oninput = () => { ui.receptZoek = z.value; tekenRecepten(); };
  $$m('[data-recept]').forEach((b) => (b.onclick = () => receptPaneel(+b.dataset.recept)));
}

function receptToevoegenKeuze() {
  paneelOpenen((el) => {
    el.innerHTML = `${paneelKop('Recept toevoegen')}
      <ul class="acties">
        <li><button id="k-bestand">Pdf kiezen<br><small class="stil">De tekst wordt op dit toestel gelezen; het bestand wordt niet bewaard.</small></button></li>
        <li><button id="k-typen">Zelf typen</button></li>
      </ul>`;
    sluitKnoppen(el);
    $('#k-bestand', el).onclick = () => { paneelSluiten(); $('#bestand-recept').click(); };
    $('#k-typen', el).onclick = () => receptBewerken(null);
  });
}

function receptPaneel(id, personen) {
  paneelOpenen((el) => {
    const r = S.recepten.find((x) => x.id === id);
    if (!r) return paneelSluiten();
    const basis = r.personen || 1;
    personen = personen || basis;
    const factor = personen / basis;
    const namen = productnamen(), geleerd = geleerdeKoppelingen();
    const regels = r.ingredienten.map((i) => ({ i, b: beschikbaarheid(i, factor, namen, geleerd) }));
    const ontbreekt = regels.filter(({ b }) => b.st !== 'ok');
    const stappen = (r.stappen || '').split('\n').filter((s) => s.trim());
    const gepland = (S.planning || []).filter((m) => m.recept_id === r.id && !m.klaar && m.datum >= vandaag());
    if (schermEigen && schermEigen.id !== r.id) schermEigen = null; // een ander recept: weer de instelling volgen
    schermBijRecept = true;
    el.innerHTML = `${paneelKop(esc(r.titel))}
      <div class="meta">
        <span class="personen"><button id="p-min" aria-label="Minder personen">−</button><span>${personen} ${personen === 1 ? 'persoon' : 'personen'}</span><button id="p-plus" aria-label="Meer personen">+</button></span>
        ${r.bereidingstijd ? `<span>${esc(r.bereidingstijd)}</span>` : ''}
        <button class="fav-knop${r.favoriet ? ' aan' : ''}" id="r-fav" aria-pressed="${r.favoriet ? 'true' : 'false'}">${r.favoriet ? ICOON.sterVol : ICOON.ster}<span>${r.favoriet ? 'Favoriet' : 'Favoriet maken'}</span></button>
        ${schermKan ? `<button class="fav-knop scherm-knop" id="r-scherm" aria-pressed="false" title="Het scherm gaat niet op stand-by zolang dit recept open staat">${ICOON.scherm}<span>Scherm aan laten</span></button>` : ''}
      </div>
      ${gepland.length ? `<p class="melding">Ingepland: ${gepland.slice(0, 3).map((m) => esc(dagNaam(m.datum).toLowerCase() + (m.maaltijd ? ` (${m.maaltijd.toLowerCase()})` : ''))).join(', ')}${gepland.length > 3 ? ' …' : ''}</p>` : ''}
      ${r.soort || (r.categorieen || []).length ? `<div class="labels">${[r.soort, ...(r.categorieen || [])].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      <ul class="ingr">${regels.map(({ i, b }) => {
        const st = b.altijd ? '' : b.st === 'ontbreekt' ? 'niet in huis' : b.st === 'weinig' ? `te weinig (${hoeveelTekst(b.totaal, b.eenheid)})` : '';
        return `<li class="${b.st === 'ontbreekt' ? 'ontbreekt' : ''}"><span class="hv">${esc(i.hoeveelheid !== null ? hoeveelTekst(i.hoeveelheid * factor, i.eenheid) : '')}</span>
          <span class="nm">${esc(i.naam)}</span><span class="st${b.st === 'weinig' ? ' oranje' : ''}">${esc(st)}</span></li>`;
      }).join('')}</ul>
      <div class="knoppenrij">
        <button class="knop primair" id="gekookt">Gekookt</button>
        <button class="knop" id="naar-lijst">Op boodschappenlijst…</button>
        <button class="knop" id="r-plan">Inplannen…</button>
        ${ontbreekt.length ? '' : '<span class="stil" style="align-self:center">Alles in huis</span>'}
      </div>
      ${stappen.length ? `<h3>Bereiding</h3><ol class="stappen">${stappen.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${r.notities ? `<h3>Notities</h3><p style="white-space:pre-wrap">${esc(r.notities)}</p>` : ''}
      <ul class="acties" style="margin-top:1.4rem"><li><button id="r-bewerk">Bewerken</button></li><li><button id="r-weg" class="gevaar">Verwijderen</button></li></ul>`;
    sluitKnoppen(el);
    $('#p-min', el).onclick = () => receptPaneel(id, Math.max(1, personen - 1));
    $('#p-plus', el).onclick = () => receptPaneel(id, personen + 1);
    $('#gekookt', el).onclick = () => kokenPaneel(r, regels);
    $('#r-bewerk', el).onclick = () => receptBewerken(r);
    schermKnopBijwerken();
    const sk = $('#r-scherm', el);
    if (sk) sk.onclick = () => {
      schermEigen = { id: r.id, aan: !schermInRecept() };
      schermBijwerken();
      toast(schermEigen.aan ? 'Het scherm blijft aan zolang dit recept open staat.' : 'Het scherm gaat weer vanzelf uit, zoals altijd.');
    };
    $('#r-fav', el).onclick = async () => {
      try {
        await api('POST', `recepten/${r.id}/favoriet`, { favoriet: !r.favoriet });
        receptPaneel(id, personen);
      } catch { /* melding al getoond */ }
    };
    $('#r-weg', el).onclick = async () => {
      if (!(await vraag(`Recept "${r.titel}" verwijderen?`, { ja: 'Verwijderen', gevaar: true }))) return;
      paneelSluiten();
      await api('DELETE', `recepten/${r.id}`);
      toast('Recept verwijderd');
    };
    $('#naar-lijst', el).onclick = () => boodschappenKiezen(r.titel, regels, factor, () => receptPaneel(r.id, personen));
    $('#r-plan', el).onclick = () => planFormulier({ recept_id: r.id, personen });
  }, { breed: true });
}

// Zelf kiezen welke ingrediënten van een recept op de boodschappenlijst komen.
// Wat ontbreekt of te weinig is, staat al aangevinkt; de hoeveelheid kun je aanpassen.
// `titel`: waarvoor (recept of week), `terug`: wat de knop Terug doet.
function boodschappenKiezen(titel, regels, factor, terug) {
  const keuzes = regels.map(({ i, b }) => {
    const weinig = b.st === 'weinig' && b.nodig !== null;
    const opLijst = S.boodschappen.some((x) => !x.afgevinkt && zelfde(x.naam, b.naam || i.naam));
    return {
      naam: b.naam || i.naam,
      hoeveelheid: weinig ? Math.ceil((b.nodig - b.totaal) * 100) / 100 : i.hoeveelheid !== null && i.hoeveelheid !== undefined ? Math.round(i.hoeveelheid * factor * 100) / 100 : null,
      eenheid: weinig ? b.eenheid : i.eenheid || '',
      aan: b.st !== 'ok' && !opLijst,
      st: (b.altijd ? 'meestal in huis' : b.st === 'ontbreekt' ? 'niet in huis' : b.st === 'weinig' ? `te weinig: ${hoeveelTekst(b.totaal, b.eenheid)} in huis` : 'in huis')
        + (opLijst ? ' · staat al op je lijst' : '') + (i.bij ? ` · ${i.bij}` : ''),
    };
  });
  paneelOpenen((el) => {
    if (alGetekend('boodschappen-kiezen')) return; // niet opnieuw tekenen terwijl je typt
    el.innerHTML = `${paneelKop('Op boodschappenlijst', esc(titel))}
      <p class="stil" style="margin:0 0 .4rem">Vink aan wat je wilt kopen. Wat ontbreekt, staat al aangevinkt.</p>
      <div>${keuzes.map((k, n) => `<div class="kook-rij kies">
          <label class="vink" style="display:flex;align-items:center;gap:.7rem;flex:1;min-width:0"><input type="checkbox" data-k="${n}" ${k.aan ? 'checked' : ''}><span class="vakje"></span>
            <span class="naam">${esc(k.naam)}<small>${esc(k.st)}</small></span></label>
          <input type="text" inputmode="decimal" data-hv="${n}" value="${esc(k.hoeveelheid === null ? '' : fmt(k.hoeveelheid))}" placeholder="–" aria-label="Hoeveelheid ${esc(k.naam)}"><span class="eenh">${esc(eenheidKort(k.eenheid))}</span></div>`).join('')}</div>
      <div class="snel" style="margin-top:.8rem"><button type="button" class="chip" id="bk-alles">Alles aanvinken</button><button type="button" class="chip" id="bk-niets">Niets aanvinken</button></div>
      <div class="paneel-voet"><button class="knop" id="bk-terug">Terug</button><button class="knop primair" id="bk-toevoegen"></button></div>`;
    sluitKnoppen(el);
    const vinkjes = $$('input[data-k]', el);
    const tellen = () => {
      const n = vinkjes.filter((v) => v.checked).length;
      $('#bk-toevoegen', el).textContent = n ? `${n} toevoegen` : 'Niets gekozen';
    };
    vinkjes.forEach((v) => (v.onchange = tellen));
    // hoeveelheid aanpassen = dat ingrediënt willen kopen
    $$('input[data-hv]', el).forEach((inv) => (inv.oninput = () => { vinkjes[+inv.dataset.hv].checked = true; tellen(); }));
    $('#bk-alles', el).onclick = () => { vinkjes.forEach((v) => (v.checked = true)); tellen(); };
    $('#bk-niets', el).onclick = () => { vinkjes.forEach((v) => (v.checked = false)); tellen(); };
    $('#bk-terug', el).onclick = () => (terug ? terug() : paneelSluiten());
    $('#bk-toevoegen', el).onclick = async () => {
      const items = vinkjes.filter((v) => v.checked).map((v) => {
        const k = keuzes[+v.dataset.k];
        return { naam: k.naam, hoeveelheid: num($(`input[data-hv="${v.dataset.k}"]`, el).value), eenheid: k.eenheid, bron: 'recept' };
      });
      if (!items.length) return toast('Vink eerst aan wat je wilt kopen.');
      await api('POST', 'boodschappen', { items });
      paneelSluiten();
      toast(`${items.length} op je boodschappenlijst gezet`);
    };
    tellen();
  }, { breed: true });
}

function kokenPaneel(r, regels, naKoken) {
  const bruikbaar = regels.filter(({ b }) => b.partijen && b.partijen.length);
  if (!bruikbaar.length && naKoken) {
    return naKoken().then(() => { paneelSluiten(); toast('Als gekookt aangeduid. Geen van de ingrediënten stond in je voorraad.'); }).catch(() => {});
  }
  if (!bruikbaar.length) return toast('Geen van de ingrediënten staat in je voorraad.');
  paneelOpenen((el) => {
    if (alGetekend('koken')) return; // niet opnieuw tekenen terwijl je typt
    el.innerHTML = `${paneelKop('Van je voorraad aftrekken', 'Pas aan wat niet klopt. Wat het eerst vervalt, gaat eerst.')}
      <div>${bruikbaar.map(({ i, b }, n) => {
        const voorstel = b.nodig !== null ? Math.min(b.nodig, b.totaal) : null;
        return `<label class="kook-rij"><span class="naam">${esc(b.naam)}<small>${esc(i.hoeveelheid !== null ? hoeveelTekst(b.nodigRecept, i.eenheid) + ' in recept · ' : '')}${esc(hoeveelTekst(b.totaal, b.eenheid) || fmt(b.totaal))} in huis</small></span>
          <input type="text" inputmode="decimal" data-n="${n}" value="${esc(fmt(voorstel))}" placeholder="0"><span class="eenh">${esc(eenheidKort(b.eenheid) || 'st.')}</span></label>`;
      }).join('')}</div>
      <div class="paneel-voet"><button class="knop" data-sluit>Annuleren</button><button class="knop primair" id="aftrekken">Aftrekken</button></div>`;
    sluitKnoppen(el);
    $('#aftrekken', el).onclick = async () => {
      const aftrekken = [];
      for (const inv of $$('input[data-n]', el)) {
        const { b } = bruikbaar[+inv.dataset.n];
        let rest = num(inv.value);
        if (!rest || rest <= 0) continue;
        for (const p of b.partijen) {
          if (rest <= 1e-9) break;
          const inEenheid = naarProduct(rest, b.eenheid, p);
          if (inEenheid === null) continue;
          const neem = Math.min(inEenheid, p.hoeveelheid);
          aftrekken.push({ product_id: p.id, hoeveelheid: Math.round(neem * 1000) / 1000 });
          rest -= vanProduct(neem, p, b.eenheid);
        }
      }
      await api('POST', `recepten/${r.id}/koken`, { aftrekken });
      if (naKoken) await naKoken().catch(() => {});
      paneelSluiten();
      toast('Smakelijk! Je voorraad is bijgewerkt.');
    };
  });
}

// Recept bewerken (ook het controlescherm na importeren)
function receptBewerken(r, ruweTekst) {
  const bewerkId = r && r.id ? r.id : null;
  const recept = r || { titel: '', personen: 4, bereidingstijd: '', ingredienten: [], stappen: '' };
  const gecontroleerd = ruweTekst !== undefined;
  paneelOpenen((el) => {
    if (alGetekend('recept')) return; // niet opnieuw tekenen terwijl je typt
    el.innerHTML = `${paneelKop(gecontroleerd ? 'Klopt dit?' : bewerkId ? 'Recept bewerken' : 'Nieuw recept')}
      ${gecontroleerd ? '<p class="melding">Kijk na wat er herkend is en verbeter waar nodig. Het bestand zelf is niet bewaard.</p>' : ''}
      <form id="rf" autocomplete="off">
        <label class="veld"><span>Titel</span><input id="rf-titel" required></label>
        <div class="rij2">
          <label class="veld"><span>Personen</span><input id="rf-pers" type="number" min="1" max="99"></label>
          <label class="veld"><span>Bereidingstijd</span><input id="rf-tijd" placeholder="bv. 30 minuten"></label>
        </div>
        <span class="veld-titel">Soort gerecht</span>
        <div class="chips" id="rf-soort"></div>
        <span class="veld-titel" style="margin-top:1rem">Categorieën <span class="stil">(meerdere mogelijk)</span></span>
        <div class="chips" id="rf-cat"></div>
        <div class="cat-nieuw"><input id="rf-cat-nieuw" placeholder="Andere categorie" aria-label="Nieuwe categorie" enterkeyhint="done">
          <button type="button" class="knop" id="rf-cat-erbij" disabled>Toevoegen</button></div>
        <span class="veld-titel">Ingrediënten</span>
        <div id="rf-ingr"></div>
        <button type="button" class="tekstknop" id="rf-erbij">+ Ingrediënt</button>
        <label class="veld" style="margin-top:1.2rem"><span>Bereiding, één stap per regel</span><textarea id="rf-stappen" rows="7"></textarea></label>
        <label class="veld"><span>Notities</span><textarea id="rf-notities" rows="2"></textarea></label>
        ${gecontroleerd ? `<details class="meer"><summary>Herkende tekst</summary>
          <textarea id="rf-ruw" rows="10" style="font-family:ui-monospace,monospace;font-size:.85rem"></textarea>
          <button type="button" class="tekstknop" id="rf-opnieuw">Opnieuw verdelen</button></details>` : ''}
        <div class="paneel-voet"><button type="button" class="knop" data-sluit>Annuleren</button><button type="submit" class="knop primair">Opslaan</button></div>
      </form>`;
    sluitKnoppen(el);
    const namen = productnamen(), geleerd = geleerdeKoppelingen();
    const ingrRij = (i) => {
      const koppel = koppelingVan(i, namen, geleerd);
      const eenheden = receptEenheden().includes(i.eenheid || '') ? receptEenheden() : [...receptEenheden(), i.eenheid];
      const div = document.createElement('div');
      div.className = 'ingr-bewerk';
      div.innerHTML = `<div class="boven">
          <input class="i-hv" inputmode="decimal" value="${esc(fmt(i.hoeveelheid))}" aria-label="Hoeveelheid">
          <select class="i-eenheid" aria-label="Eenheid">${eenheden.map((e) => `<option value="${esc(e)}"${e === (i.eenheid || '') ? ' selected' : ''}>${esc(e || '–')}</option>`).join('')}</select>
          <input class="i-naam" value="${esc(i.naam)}" aria-label="Ingrediënt">
          <button type="button" class="weg" aria-label="Weghalen">×</button></div>
        <div class="koppel"><span>In voorraad als</span><select class="i-koppel">${opties(namen, koppel, '— niet gekoppeld —')}</select></div>`;
      const sel = $('.i-koppel', div);
      if (bewaardeKoppeling(i) || i.geenKoppeling) sel.dataset.handmatig = '1';
      sel.onchange = () => (sel.dataset.handmatig = '1');
      $('.i-naam', div).onchange = (e) => { if (!sel.dataset.handmatig) sel.innerHTML = opties(namen, zoekVoorraadnaam(e.target.value, namen, geleerd), '— niet gekoppeld —'); };
      $('.weg', div).onclick = () => div.remove();
      return div;
    };
    // soort: één keuze (nog eens tikken = geen soort); categorieën: aan/uit
    const chipsZetten = (box, lijst, aan, enkel) => {
      box.innerHTML = lijst.map((w) => `<button type="button" class="chip${aan.some((a) => zelfde(a, w)) ? ' aan' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join('');
      $$('.chip', box).forEach((b) => (b.onclick = () => {
        const nu = !b.classList.contains('aan');
        if (enkel) $$('.chip', box).forEach((c) => c.classList.remove('aan'));
        b.classList.toggle('aan', nu);
      }));
    };
    const gekozen = (box) => $$('.chip.aan', box).map((b) => b.dataset.w);
    const catVeld = $('#rf-cat-nieuw', el), catKnop = $('#rf-cat-erbij', el);
    const catToevoegen = () => {
      const t = catVeld.value.trim();
      if (!t) return;
      const box = $('#rf-cat', el);
      const aan = [...gekozen(box), t];
      chipsZetten(box, volgensLijst([...$$('.chip', box).map((b) => b.dataset.w), t], receptCategorieen()), aan, false);
      catVeld.value = ''; catKnop.disabled = true;
    };
    catVeld.oninput = () => (catKnop.disabled = !catVeld.value.trim());
    catVeld.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); catToevoegen(); } };
    catKnop.onclick = catToevoegen;
    const vullen = (x) => {
      const soort = x.soort || '';
      chipsZetten($('#rf-soort', el), volgensLijst([...receptSoorten(), soort], receptSoorten()), [soort], true);
      chipsZetten($('#rf-cat', el), volgensLijst([...receptCategorieen(), ...(x.categorieen || [])], receptCategorieen()), x.categorieen || [], false);
      $('#rf-titel', el).value = x.titel || '';
      $('#rf-pers', el).value = x.personen || 4;
      $('#rf-tijd', el).value = x.bereidingstijd || '';
      $('#rf-stappen', el).value = Array.isArray(x.stappen) ? x.stappen.join('\n') : x.stappen || '';
      $('#rf-notities', el).value = x.notities || '';
      const box = $('#rf-ingr', el);
      box.innerHTML = '';
      for (const i of x.ingredienten || []) box.appendChild(ingrRij(i));
      if (!(x.ingredienten || []).length) box.appendChild(ingrRij({ hoeveelheid: null, eenheid: '', naam: '' }));
    };
    vullen(recept);
    $('#rf-erbij', el).onclick = () => $('#rf-ingr', el).appendChild(ingrRij({ hoeveelheid: null, eenheid: '', naam: '' }));
    if (gecontroleerd) {
      $('#rf-ruw', el).value = ruweTekst;
      $('#rf-opnieuw', el).onclick = () => vullen({ ...receptOntleden($('#rf-ruw', el).value), soort: gekozen($('#rf-soort', el))[0] || '', categorieen: gekozen($('#rf-cat', el)) });
    }
    $('#rf', el).onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        titel: $('#rf-titel', el).value.trim(), personen: parseInt($('#rf-pers', el).value, 10) || 4, bereidingstijd: $('#rf-tijd', el).value.trim(),
        stappen: $('#rf-stappen', el).value, notities: $('#rf-notities', el).value,
        soort: gekozen($('#rf-soort', el))[0] || '', categorieen: gekozen($('#rf-cat', el)),
        ingredienten: $$('.ingr-bewerk', el).map((d) => ({ hoeveelheid: num($('.i-hv', d).value), eenheid: $('.i-eenheid', d).value,
          // alleen een zelf gekozen koppeling bewaren; een voorstel wordt telkens opnieuw gezocht
          naam: $('.i-naam', d).value.trim(), ...($('.i-koppel', d).dataset.handmatig
            ? ($('.i-koppel', d).value ? { voorraadnaam: $('.i-koppel', d).value } : { geenKoppeling: true }) : {}) })).filter((i) => i.naam),
      };
      try {
        const res = await api(bewerkId ? 'PUT' : 'POST', bewerkId ? `recepten/${bewerkId}` : 'recepten', data);
        if (ui.view !== 'recepten') naar('recepten');
        receptPaneel(bewerkId || res.nieuw_id);
        toast('Recept opgeslagen');
      } catch { /* melding al getoond */ }
    };
  }, { breed: true });
}

// Importeren uit pdf (lokaal; het bestand wordt niet bewaard). Foto's en gescande pdf's (tekstherkenning) staan voorlopig uit.
async function pdfLezen(bestand) {
  // Eigen kopie van pdf.js; ontbreekt die (bv. map vendor niet geüpload), dan dezelfde versie van jsDelivr.
  const CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/';
  let pdfjs, basis = new URL('./vendor/', import.meta.url).href, bouw = basis;
  try { pdfjs = await import('./vendor/pdf.min.mjs'); } catch {
    try { pdfjs = await import(CDN + 'build/pdf.min.mjs'); } catch { throw new Error('De pdf-lezer kon niet geladen worden. Ben je online?'); }
    basis = CDN; bouw = CDN + 'build/';
  }
  pdfjs.GlobalWorkerOptions.workerSrc = bouw + 'pdf.worker.min.mjs';
  const map = (m) => basis + m + '/';
  const taak = pdfjs.getDocument({ data: new Uint8Array(await bestand.arrayBuffer()), isEvalSupported: false, disableFontFace: true,
    enableXfa: false, standardFontDataUrl: map('standard_fonts'), cMapUrl: map('cmaps'), cMapPacked: true, wasmUrl: map('wasm'), iccUrl: map('iccs') });
  const doc = await taak.promise;
  const aantal = Math.min(doc.numPages, MAX_PDF_PAGINAS);
  const delen = [];
  try {
    for (let n = 1; n <= aantal; n++) {
      toast(`Pagina ${n} van ${aantal} lezen…`, null, null, true);
      const pagina = await doc.getPage(n);
      const hoogte = pagina.getViewport({ scale: 1 }).viewBox[3];
      delen.push(pdfStukjes((await pagina.getTextContent()).items, hoogte));
      pagina.cleanup();
    }
  } finally { await taak.destroy(); }
  // alle pagina's samen lezen: een kolom die op de volgende pagina doorloopt, blijft één kolom
  const tekst = tekstOpmaken(paginasStapelen(delen));
  if (tekst.replace(/\s/g, '').length < 30) throw new Error('In deze pdf staat geen leesbare tekst (bv. een scan of foto). Typ het recept zelf.');
  return tekst;
}
async function receptImporteren(invoer) {
  const bestand = invoer.files && invoer.files[0];
  invoer.value = '';
  if (!bestand) return;
  try {
    const isPdf = bestand.type === 'application/pdf' || /\.pdf$/i.test(bestand.name);
    if (!isPdf) throw new Error('Kies een pdf. Foto\'s van recepten kunnen voorlopig niet ingelezen worden.');
    toast('Pdf openen…', null, null, true);
    const tekst = await pdfLezen(bestand);
    toastWeg();
    receptBewerken(receptOntleden(tekst), tekst);
  } catch (f) { toast(f.message || 'Importeren mislukt.'); console.error(f); }
}
$('#bestand-recept').onchange = (e) => receptImporteren(e.target);

// ---------------------------------------------------------------------------
// MAALTIJDPLANNER: per week, per dag de maaltijden (uit je recepten of zelf getypt)
// ---------------------------------------------------------------------------
const maaltijden = () => S.instellingen.maaltijden || [];
const maaltijdPlek = (x) => { const i = maaltijden().findIndex((y) => zelfde(x, y)); return i < 0 ? 9999 : i; };
const dagNaam = (d) => { const t = new Date(d + 'T12:00').toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }); return t[0].toUpperCase() + t.slice(1); };
/** Maandag van de week, `offset` weken van nu. */
function weekBegin(offset = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return isoDatum(d);
}
/** In welke week (t.o.v. nu) ligt deze datum? */
const weekVan = (datum) => Math.floor((dagenTot(datum) + ((new Date().getDay() + 6) % 7)) / 7);
const planRecept = (m) => (m && m.recept_id ? S.recepten.find((r) => r.id === m.recept_id) || null : null);
const planTitel = (m) => planRecept(m)?.titel || m.tekst || 'Maaltijd';
/** Nieuwe maaltijd: de laatste die die dag nog vrij is (meestal het avondeten). */
function standaardMaaltijd(datum) {
  const lijst = maaltijden();
  const vrij = [...lijst].reverse().find((x) => !(S.planning || []).some((m) => m.datum === datum && zelfde(m.maaltijd, x)));
  return vrij ?? lijst[lijst.length - 1] ?? '';
}

function tekenPlanner() {
  const begin = weekBegin(ui.week), dagen = [...Array(7)].map((_, i) => datumPlus(begin, i)), eind = dagen[6];
  const nu = vandaag();
  const inWeek = (S.planning || []).filter((m) => m.datum >= begin && m.datum <= eind);
  const teKoken = inWeek.filter((m) => planRecept(m) && !m.klaar && m.datum >= nu);
  const namen = productnamen(), geleerd = geleerdeKoppelingen();
  const titel = { 0: 'Deze week', 1: 'Volgende week', '-1': 'Vorige week' }[ui.week] || `Week van ${datumNL(begin)}`;
  const rij = (m) => {
    const r = planRecept(m);
    const onder = [m.maaltijd, r && `${m.personen || r.personen || 4} personen`].filter(Boolean).join(' · ');
    let rechts = '';
    if (m.klaar) rechts = '<span class="rechts">gekookt</span>';
    else if (r) { const d = dekking(r, namen, geleerd); rechts = `<span class="rechts${d.ok < d.totaal ? ' oranje' : ''}" title="ingrediënten in huis">${d.ok}/${d.totaal}</span>`; }
    return `<li><button class="rij${m.klaar ? ' op' : ''}" data-plan="${m.id}"><span class="naam">${esc(planTitel(m))}<small>${esc(onder)}</small></span>${rechts}</button></li>`;
  };
  const dag = (d) => {
    const items = inWeek.filter((m) => m.datum === d).sort((a, b) => maaltijdPlek(a.maaltijd) - maaltijdPlek(b.maaltijd) || a.id - b.id);
    return `<section class="plan-dag${d === nu ? ' vandaag' : ''}${d < nu ? ' voorbij' : ''}">
      <div class="plan-dag-kop"><span>${esc(dagNaam(d))}${d === nu ? ' <small>vandaag</small>' : ''}</span>
        <button class="tekstknop" data-plan-nieuw="${d}" aria-label="Maaltijd plannen op ${esc(dagNaam(d).toLowerCase())}">+ Plannen</button></div>
      ${items.length ? `<ul class="lijst">${items.map(rij).join('')}</ul>` : ''}</section>`;
  };
  inhoudZetten(`
    <header class="kop"><h1>Maaltijdplanner</h1><div class="kop-acties">${instellingenKnop}</div></header>
    <div class="plan-week">
      <button class="icoon" id="pw-vorige" aria-label="Vorige week"><span aria-hidden="true">‹</span></button>
      <div class="plan-week-tekst"><b>${esc(titel)}</b><small class="stil">${esc(datumNL(begin))} – ${esc(datumNL(eind, true))}</small></div>
      <button class="icoon" id="pw-volgende" aria-label="Volgende week"><span aria-hidden="true">›</span></button>
    </div>
    ${ui.week !== 0 ? '<div class="plan-nu"><button class="tekstknop" id="pw-nu">Terug naar deze week</button></div>' : ''}
    ${teKoken.length ? `<button class="knop breed" id="pw-boodschappen">Boodschappen voor ${teKoken.length} ${teKoken.length === 1 ? 'maaltijd' : 'maaltijden'}…</button>` : ''}
    ${!S.recepten.length && !inWeek.length ? '<p class="stil plan-uitleg">Plan per dag wat je eet: kies uit je recepten of typ zelf iets (bv. restjes of uit eten).</p>' : ''}
    ${dagen.map(dag).join('')}`);
  $m('#pw-vorige').onclick = () => { ui.week--; tekenPlanner(); };
  $m('#pw-volgende').onclick = () => { ui.week++; tekenPlanner(); };
  const terug = $m('#pw-nu');
  if (terug) terug.onclick = () => { ui.week = 0; tekenPlanner(); };
  const bk = $m('#pw-boodschappen');
  if (bk) bk.onclick = () => weekBoodschappen(teKoken, titel.toLowerCase());
  $$m('[data-plan-nieuw]').forEach((b) => (b.onclick = () => planFormulier({ datum: b.dataset.planNieuw })));
  $$m('[data-plan]').forEach((b) => (b.onclick = () => planPaneel(+b.dataset.plan)));
}

/** Een geplande maaltijd: recept bekijken, gekookt, wijzigen of weghalen. */
function planPaneel(id) {
  paneelOpenen((el) => {
    const m = (S.planning || []).find((x) => x.id === id);
    if (!m) return paneelSluiten();
    const r = planRecept(m);
    const personen = r ? m.personen || r.personen || 4 : null;
    el.innerHTML = `${paneelKop(esc(planTitel(m)), esc([dagNaam(m.datum), m.maaltijd, personen && `${personen} personen`].filter(Boolean).join(' · ')))}
      ${m.klaar ? '<p class="melding">Gekookt.</p>' : ''}
      <ul class="acties">
        ${r ? '<li><button id="pl-recept">Recept bekijken</button></li>' : ''}
        ${r && !m.klaar ? '<li><button id="pl-gekookt">Gekookt</button></li>' : ''}
        ${r && !m.klaar ? '<li><button id="pl-lijst">Ingrediënten op boodschappenlijst…</button></li>' : ''}
        ${m.klaar ? '<li><button id="pl-niet">Toch nog niet gekookt</button></li>' : ''}
        <li><button id="pl-wijzig">Wijzigen of verplaatsen</button></li>
        <li><button id="pl-weg" class="gevaar">Uit de planning halen</button></li>
      </ul>`;
    sluitKnoppen(el);
    const regels = () => { const f = personen / (r.personen || 1); return r.ingredienten.map((i) => ({ i, b: beschikbaarheid(i, f) })); };
    const knop = (sel, f) => { const b = $(sel, el); if (b) b.onclick = f; };
    knop('#pl-recept', () => receptPaneel(r.id, personen));
    knop('#pl-gekookt', () => kokenPaneel(r, regels(), () => api('PUT', `planning/${m.id}`, { klaar: true })));
    knop('#pl-lijst', () => boodschappenKiezen(`${r.titel} · ${dagNaam(m.datum).toLowerCase()}`, regels(), personen / (r.personen || 1), () => planPaneel(id)));
    knop('#pl-niet', () => api('PUT', `planning/${m.id}`, { klaar: false }).catch(() => {}));
    knop('#pl-wijzig', () => planFormulier(m));
    knop('#pl-weg', async () => {
      const oud = { ...m };
      try { await api('DELETE', `planning/${m.id}`); } catch { return; }
      paneelSluiten();
      toast(`${planTitel(oud)} uit de planning gehaald`, 'Ongedaan maken', () => api('POST', 'planning', { ...oud, id: undefined }).catch(() => {}));
    });
  });
}

/** Maaltijd plannen of wijzigen. m0: bestaande maaltijd, of { datum, recept_id, personen } als voorstel. */
function planFormulier(m0 = {}) {
  const nieuw = !m0.id;
  const st = {
    datum: m0.datum || vandaag(), receptId: m0.recept_id || null, personen: m0.personen || null, eigenPersonen: !!m0.personen,
    tekst: m0.tekst || '', zoek: '', modus: m0.recept_id || (!m0.tekst && S.recepten.length) ? 'recept' : 'tekst',
  };
  st.maaltijd = m0.maaltijd ?? standaardMaaltijd(st.datum);
  if (st.receptId && !st.personen) st.personen = planRecept({ recept_id: st.receptId })?.personen || 4;
  paneelOpenen((el) => {
    if (alGetekend('plan')) return; // niet opnieuw tekenen terwijl je typt
    const momenten = st.maaltijd && !maaltijden().some((x) => zelfde(x, st.maaltijd)) ? [...maaltijden(), st.maaltijd] : maaltijden();
    el.innerHTML = `${paneelKop(nieuw ? 'Maaltijd plannen' : 'Maaltijd wijzigen')}
      <form id="plf" autocomplete="off">
        <label class="veld"><span>Dag</span><input type="date" id="plf-datum" value="${esc(st.datum)}" required></label>
        <div class="snel" id="plf-snel" style="margin:-.6rem 0 1rem">${[[0, 'Vandaag'], [1, 'Morgen']].map(([d, t]) => `<button type="button" class="chip${st.datum === vandaag(d) ? ' aan' : ''}" data-d="${d}">${t}</button>`).join('')}</div>
        ${momenten.length ? `<div class="veld" style="margin-bottom:1rem"><span class="veld-titel">Maaltijd</span>
          <div class="chips" id="plf-maaltijd">${momenten.map((x) => `<button type="button" class="chip${zelfde(x, st.maaltijd) ? ' aan' : ''}" data-w="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>` : ''}
        <div class="segment" id="plf-modus"><button type="button" data-w="recept">Uit je recepten</button><button type="button" data-w="tekst">Zelf typen</button></div>
        <div id="plf-recept" class="plan-kies">
          ${S.recepten.length ? `<div class="zoek">${ICOON.zoek}<input type="search" id="plf-zoek" placeholder="Zoek een recept" autocomplete="off"></div>
          <ul class="lijst plan-recepten" id="plf-lijst"></ul>
          <div class="instelling" id="plf-personen-rij"><span>Personen</span><span class="personen">
            <button type="button" id="plf-min" aria-label="Minder personen">−</button><span id="plf-personen" style="min-width:1.6rem;text-align:center"></span>
            <button type="button" id="plf-plus" aria-label="Meer personen">+</button></span></div>`
          : '<p class="stil" style="font-size:.9rem">Je hebt nog geen recepten. Typ zelf wat je eet, of voeg eerst een recept toe.</p>'}
        </div>
        <div id="plf-tekst" class="plan-kies"><label class="veld"><span>Wat eet je?</span>
          <input id="plf-tekst-in" value="${esc(st.tekst)}" placeholder="bv. Restjes, uit eten, frietjes" autocapitalize="sentences"></label></div>
        <div class="paneel-voet"><button type="submit" class="knop primair">${nieuw ? 'Inplannen' : 'Bewaren'}</button></div>
      </form>`;
    sluitKnoppen(el);
    const personenTekenen = () => {
      const rij = $('#plf-personen-rij', el);
      if (!rij) return;
      rij.hidden = !st.receptId;
      $('#plf-personen', el).textContent = st.personen || '';
      $('#plf-min', el).disabled = !(st.personen > 1);
    };
    const lijstTekenen = () => {
      const ul = $('#plf-lijst', el);
      if (!ul) return;
      const q = st.zoek.trim().toLowerCase();
      const lijst = S.recepten.filter((r) => !q || r.titel.toLowerCase().includes(q) || (r.soort || '').toLowerCase().includes(q)
          || (r.categorieen || []).some((c) => c.toLowerCase().includes(q)) || r.ingredienten.some((i) => i.naam.toLowerCase().includes(q)))
        .sort((a, b) => (b.id === st.receptId) - (a.id === st.receptId) || b.favoriet - a.favoriet || a.titel.localeCompare(b.titel, 'nl'));
      ul.innerHTML = lijst.length ? lijst.map((r) => `<li><button type="button" class="rij${r.id === st.receptId ? ' gekozen' : ''}" data-kies="${r.id}" aria-pressed="${r.id === st.receptId}">
          <span class="naam">${r.favoriet ? `<span class="ster-mini" aria-label="Favoriet">${ICOON.sterVol}</span>` : ''}${esc(r.titel)}<small>${esc([r.soort, r.personen && `${r.personen} personen`].filter(Boolean).join(' · '))}</small></span>
          <span class="rechts">${r.id === st.receptId ? '✓' : ''}</span></button></li>`).join('')
        : '<li class="stil" style="padding:.8rem 0">Geen recept gevonden.</li>';
      $$('[data-kies]', ul).forEach((b) => (b.onclick = () => {
        const r = S.recepten.find((x) => x.id === +b.dataset.kies);
        st.receptId = r.id;
        if (!st.eigenPersonen) st.personen = r.personen || 4;
        lijstTekenen(); personenTekenen();
      }));
    };
    const modusTekenen = () => {
      $$('#plf-modus button', el).forEach((b) => b.classList.toggle('aan', b.dataset.w === st.modus));
      $('#plf-recept', el).hidden = st.modus !== 'recept';
      $('#plf-tekst', el).hidden = st.modus !== 'tekst';
    };
    modusTekenen(); lijstTekenen(); personenTekenen();
    $$('#plf-modus button', el).forEach((b) => (b.onclick = () => { st.modus = b.dataset.w; modusTekenen(); if (st.modus === 'tekst' && fijneMuis()) $('#plf-tekst-in', el).focus(); }));
    $$('#plf-maaltijd .chip', el).forEach((b) => (b.onclick = () => {
      st.maaltijd = b.dataset.w;
      $$('#plf-maaltijd .chip', el).forEach((c) => c.classList.toggle('aan', c === b));
    }));
    const snelTekenen = () => $$('#plf-snel .chip', el).forEach((c) => c.classList.toggle('aan', st.datum === vandaag(+c.dataset.d)));
    $$('#plf-snel .chip', el).forEach((b) => (b.onclick = () => { st.datum = vandaag(+b.dataset.d); $('#plf-datum', el).value = st.datum; snelTekenen(); }));
    $('#plf-datum', el).onchange = () => { st.datum = $('#plf-datum', el).value; snelTekenen(); };
    const zoek = $('#plf-zoek', el);
    if (zoek) zoek.oninput = () => { st.zoek = zoek.value; lijstTekenen(); };
    const stap = (n) => { st.personen = Math.max(1, (st.personen || 4) + n); st.eigenPersonen = true; personenTekenen(); };
    if ($('#plf-min', el)) { $('#plf-min', el).onclick = () => stap(-1); $('#plf-plus', el).onclick = () => stap(1); }
    $('#plf', el).onsubmit = async (e) => {
      e.preventDefault();
      st.datum = $('#plf-datum', el).value;
      st.tekst = $('#plf-tekst-in', el).value.trim();
      if (!st.datum) return toast('Kies een dag.');
      if (st.modus === 'recept' && !st.receptId) return toast(S.recepten.length ? 'Kies een recept, of typ zelf wat je eet.' : 'Typ wat je eet.');
      if (st.modus === 'tekst' && !st.tekst) return toast('Typ wat je eet, of kies een recept.');
      const recept = st.modus === 'recept';
      const data = { datum: st.datum, maaltijd: st.maaltijd || '', recept_id: recept ? st.receptId : null, tekst: recept ? '' : st.tekst, personen: recept ? st.personen : null };
      try { await api(nieuw ? 'POST' : 'PUT', nieuw ? 'planning' : `planning/${m0.id}`, data); } catch { return; }
      paneelSluiten();
      const wat = recept ? planRecept({ recept_id: st.receptId })?.titel : st.tekst;
      const wanneer = `${dagNaam(st.datum).toLowerCase()}${st.maaltijd ? ` (${st.maaltijd.toLowerCase()})` : ''}`;
      if (ui.view === 'planner') { ui.week = weekVan(st.datum); tekenPlanner(); toast(`${wat} ingepland op ${wanneer}`); }
      else toast(`${wat} ingepland op ${wanneer}`, 'Planner', () => { ui.week = weekVan(st.datum); naar('planner'); });
    };
  });
}

/** Alle ingrediënten van de geplande recepten samen: zelf kiezen wat op de boodschappenlijst komt. */
function weekBoodschappen(items, wanneer) {
  const namen = productnamen(), geleerd = geleerdeKoppelingen();
  const groepen = [];
  for (const m of items) {
    const r = planRecept(m);
    if (!r) continue;
    const factor = (m.personen || r.personen || 1) / (r.personen || 1);
    for (const i of r.ingredienten) {
      if (altijdInHuis(i)) continue;
      const vn = koppelingVan(i, namen, geleerd) || '';
      const sleutel = (vn || i.naam).trim().toLowerCase();
      const h = i.hoeveelheid !== null && i.hoeveelheid !== undefined ? i.hoeveelheid * factor : null;
      const e = i.eenheid || '';
      // zelfde ingrediënt in meerdere recepten: optellen (als de eenheden om te rekenen zijn)
      const g = groepen.find((x) => x.sleutel === sleutel && (h === null ? x.hoeveelheid === null
        : x.hoeveelheid !== null && omrekenen(1, e || 'stuks', x.eenheid || 'stuks') !== null));
      if (g) {
        if (h !== null) g.hoeveelheid += omrekenen(h, e || 'stuks', g.eenheid || 'stuks');
        if (!g.recepten.includes(r.titel)) g.recepten.push(r.titel);
      } else groepen.push({ sleutel, naam: i.naam, voorraadnaam: vn, hoeveelheid: h, eenheid: e, recepten: [r.titel] });
    }
  }
  if (!groepen.length) return toast('De geplande recepten hebben geen ingrediënten.');
  const regels = groepen.map((g) => {
    const i = { naam: g.naam, voorraadnaam: g.voorraadnaam, hoeveelheid: g.hoeveelheid === null ? null : Math.round(g.hoeveelheid * 100) / 100,
      eenheid: g.eenheid, bij: items.length > 1 ? g.recepten.join(', ') : '' };
    return { i, b: beschikbaarheid(i, 1, namen, geleerd) };
  }).sort((a, b) => (a.b.st === 'ok') - (b.b.st === 'ok') || (a.b.naam || a.i.naam).localeCompare(b.b.naam || b.i.naam, 'nl'));
  boodschappenKiezen(`${items.length} ${items.length === 1 ? 'maaltijd' : 'maaltijden'} ${wanneer}`, regels, 1, null);
}

// ---------------------------------------------------------------------------
// INSTELLINGEN
// ---------------------------------------------------------------------------
// App installeren: knop als de browser het aanbiedt, anders uitleg per toestel
const alsApp = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(navigator.userAgent);
function installUitleg() {
  if (isIOS()) {
    return /crios|fxios|edgios/i.test(navigator.userAgent)
      ? 'Open dit adres in <b>Safari</b>. Tik daar op de deelknop (vierkant met pijl omhoog) en kies <b>Zet op beginscherm</b>.'
      : 'Tik onderaan op de deelknop (vierkant met pijl omhoog) en kies <b>Zet op beginscherm</b>. Zie je het niet staan, scrol dan wat naar beneden in dat menu.';
  }
  if (isAndroid()) {
    return /samsungbrowser/i.test(navigator.userAgent)
      ? 'Tik op het menu <b>≡</b> en kies <b>Pagina toevoegen aan</b> → <b>Startscherm</b>.'
      : 'Tik in Chrome rechtsboven op <b>⋮</b> en kies <b>App installeren</b> of <b>Toevoegen aan startscherm</b>.';
  }
  return 'Klik in Chrome of Edge op het installeer-icoon rechts in de adresbalk, of kies in het menu <b>App installeren</b>.';
}
function installBlokTekenen() {
  const blok = $('#installeer-blok');
  if (!blok) return;
  blok.hidden = alsApp();
  if (blok.hidden) return;
  const kan = window.voorraadKanInstalleren?.();
  blok.innerHTML = `<div class="sectie-titel">App installeren</div>
    <p class="stil" style="font-size:.92rem;line-height:1.6;margin-bottom:.8rem">Zet Voorraad als app op je beginscherm. Ze opent dan zonder adresbalk en werkt ook offline.</p>
    ${kan ? '<div class="knoppenrij"><button class="knop primair" id="i-installeer">App installeren</button></div>'
      : `<p style="font-size:.95rem;line-height:1.6">${installUitleg()}</p>`}`;
  const k = $('#i-installeer', blok);
  if (k) k.onclick = async () => { await window.voorraadInstalleren?.(); installBlokTekenen(); };
}
// Tip op het voorraadscherm zolang de app niet geïnstalleerd is (smartphone en computer)
const tipWeg = () => { try { return localStorage.getItem('installtip-weg') === '1'; } catch { return false; } };
function installTipTekenen() {
  const plek = $('#installeer-tip');
  if (!plek) return;
  const tonen = !alsApp() && !tipWeg();
  plek.hidden = !tonen;
  if (!tonen) return;
  plek.innerHTML = `<span>Installeer Voorraad als app ${isIOS() || isAndroid() ? 'op je beginscherm' : 'op deze computer'}.</span>
    <button class="tekstknop" id="tip-hoe">Hoe?</button><button class="weg" id="tip-weg" aria-label="Tip sluiten">×</button>`;
  $('#tip-hoe', plek).onclick = async () => {
    if (window.voorraadKanInstalleren?.()) { await window.voorraadInstalleren(); installTipTekenen(); } else naar('instellingen');
  };
  $('#tip-weg', plek).onclick = () => { try { localStorage.setItem('installtip-weg', '1'); } catch { /* */ } plek.hidden = true; };
}

// ---------------------------------------------------------------------------
// Gegevens ook bewaren in een bestand op het toestel (Chrome/Edge op computer en Android)
// ---------------------------------------------------------------------------
const B = () => window.voorraadBestand;
// tijdstippen worden in UTC bewaard zonder 'Z' (zie nu() in lokaal.js)
const alsDatum = (t) => new Date(/(Z|[+-]\d\d:?\d\d)$/.test(t) ? t : t + 'Z');
function tijdstipTekst(t) {
  if (!t) return '';
  const d = alsDatum(t), uur = d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  const dagen = Math.round((new Date(new Date().toDateString()) - new Date(d.toDateString())) / 86400000);
  return dagen === 0 ? `vandaag om ${uur}` : dagen === 1 ? `gisteren om ${uur}` : `op ${d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}
const dagenGeleden = (t) => (t ? Math.floor((Date.now() - alsDatum(t)) / 86400000) : null);
function bestandBlokTekenen() {
  const blok = $('#bestand-blok');
  const laatst = $('#backup-laatst');
  if (laatst && B()) {
    const l = B().backupInfo().laatste;
    laatst.textContent = l ? `Laatste back-up: ${tijdstipTekst(l)}.` : 'Je hebt op dit toestel nog geen back-up gemaakt.';
  }
  if (!blok) return;
  const titel = '<div class="sectie-titel">Bewaren in een bestand</div>';
  const p = (tekst) => `<p class="stil" style="margin-bottom:.8rem;font-size:.92rem;line-height:1.55">${tekst}</p>`;
  autoBlokTekenen();
  if (B() && B().android) { blok.hidden = true; return; } // Android: alleen de automatische back-up
  if (!B() || !B().ondersteund) {
    blok.innerHTML = titel + p(`Elke wijziging meteen in een bestand bewaren kan niet in deze browser${isIOS() ? ' (iPhone/iPad laten dat niet toe)' : ': gebruik daarvoor Chrome of Edge'}.`);
    return;
  }
  const k = B().info();
  if (!k) {
    blok.innerHTML = titel + p('Je gegevens staan nu alleen in de opslag van de browser. Laat de app ze ook automatisch bewaren in een bestand op dit toestel, bv. in Documenten of in een map die met Google Drive of OneDrive gesynchroniseerd wordt. Wis je de browsergegevens of verwijder je de app, dan haal je alles terug uit dat bestand.')
      + `<div class="knoppenrij"><button class="knop primair" id="b-nieuw">Nieuw bestand maken</button><button class="knop" id="b-open">Bestaand bestand openen</button></div>`;
  } else if (k.toestemming !== 'granted') {
    blok.innerHTML = titel + p(`Alles wordt ook bewaard in <b>${esc(k.naam)}</b>. De browser vraagt na het openen van de app opnieuw toestemming; dat gebeurt vanzelf bij je eerste wijziging. Je kunt het ook nu al doen.`)
      + `<div class="knoppenrij"><button class="knop primair" id="b-toestemming">Toestemming geven</button><button class="knop" id="b-stop">Stoppen</button></div>`;
  } else {
    blok.innerHTML = titel + p(`Alles wordt ook automatisch bewaard in <b>${esc(k.naam)}</b>${k.laatst ? ` (laatst ${tijdstipTekst(k.laatst)})` : ''}.`
      + (k.fout ? `<br><b style="color:var(--rood, #b42318)">${esc(k.fout)}</b>` : '')
      + '<br>Na het wissen van de browsergegevens of op een nieuw toestel: kies <i>Bestaand bestand openen</i> en daarna dit bestand.')
      + `<div class="knoppenrij"><button class="knop" id="b-nieuw">Ander bestand</button><button class="knop" id="b-stop">Stoppen</button></div>`;
  }
  const knop = (id, f) => { const b = $('#' + id, blok); if (b) b.onclick = f; };
  const fout = (f) => { if (f && f.name === 'AbortError') return; toast(f && f.message ? f.message : 'Dat lukte niet.', null, null, true); };
  knop('b-nieuw', async () => {
    try { await B().nieuw(); toast(`Je gegevens worden nu ook bewaard in ${B().info().naam}.`); } catch (f) { fout(f); }
    bestandBlokTekenen();
  });
  knop('b-open', async () => {
    let r;
    try { r = await B().kiesBestaand(); } catch (f) { return fout(f); }
    if (r.gegevens === undefined) return toast(`"${r.naam}" bevat geen gegevens van Voorraad.`, null, null, true);
    if (r.gegevens) {
      const g = r.gegevens, n = (x) => (Array.isArray(x) ? x.length : 0);
      const inhoud = `${n(g.producten)} producten, ${n(g.recepten)} recepten en ${n(g.boodschappen)} boodschappen`;
      if (!(await vraag(`"${r.naam}" bevat ${inhoud}${g.gemaakt ? `, bewaard ${tijdstipTekst(g.gemaakt)}` : ''}. Je huidige gegevens in de app worden erdoor vervangen. Doorgaan?`, { ja: 'Gebruiken', gevaar: true }))) return;
      try { await api('POST', 'import', g); } catch { return; }
    } else if (!(await vraag(`"${r.naam}" is leeg. Je gegevens voortaan ook in dit bestand bewaren?`, { ja: 'Bewaren' }))) return;
    try { await B().bestaandGebruiken(); toast(`Je gegevens worden nu ook bewaard in ${r.naam}.`); } catch (f) { fout(f); }
    bestandBlokTekenen();
  });
  knop('b-toestemming', async () => { try { await B().toestemmingVragen(); } catch (f) { fout(f); } bestandBlokTekenen(); });
  knop('b-stop', async () => {
    await B().stoppen();
    toast('De app bewaart niet meer in het bestand. Het bestand zelf blijft staan.');
    bestandBlokTekenen();
  });
}
// Scherm aan laten (per toestel)
function schermBlokTekenen() {
  const blok = $m('#scherm-blok');
  if (!blok) return;
  const k = schermKeuze();
  const UITLEG = {
    recept: 'Zolang een recept open staat, gaat het scherm niet op stand-by. Handig tijdens het koken. In het recept zelf kun je het ook aan- of uitzetten.',
    altijd: 'Zolang de app open is, gaat het scherm niet op stand-by. Dat kost meer batterij.',
    uit: 'Het scherm gaat uit zoals je toestel ingesteld is. In een recept kun je het toch aanzetten met <b>Scherm aan laten</b>.',
  };
  blok.innerHTML = `<div class="sectie-titel">Scherm aan laten</div>
    ${schermKan ? `<div class="segment drie" id="scherm-keuze" role="group" aria-label="Scherm aan laten">
      ${[['recept', 'Bij een recept'], ['altijd', 'Altijd'], ['uit', 'Nooit']].map(([w, t]) => `<button type="button" data-scherm="${w}" class="${w === k ? 'aan' : ''}" aria-pressed="${w === k}">${t}</button>`).join('')}
    </div>
    <p class="segment-uitleg" style="font-size:.88rem;line-height:1.5">${UITLEG[k]} Geldt alleen voor dit toestel.</p>`
    : `<p class="stil" style="font-size:.92rem;line-height:1.55">Deze browser kan het scherm niet aan houden. Werk de browser bij, of stel op je toestel zelf in dat het scherm later uitgaat (iPhone: Instellingen → Scherm en helderheid → Automatisch slot; Android: Instellingen → Scherm → Time-out scherm).</p>`}`;
  $$m('[data-scherm]', blok).forEach((b) => (b.onclick = () => {
    schermKeuzeBewaren(b.dataset.scherm);
    schermBlokTekenen();
  }));
}

// ---------------------------------------------------------------------------
// Op te gebruiken melden (per toestel):
//  - een venster bij het openen van de app (hoogstens één keer per dag) met wat bijna of al voorbij de datum is;
//  - als je dat aanzet: een melding op het toestel, ook als de app dicht is. Dat doet de service worker (sw.js)
//    met "periodic background sync" (Chrome en Edge, als de app geïnstalleerd is). Hij leest de keuze en de dag van
//    de laatste melding uit IndexedDB (sleutel 'melding', niet gesynchroniseerd), en de voorraad uit 'gegevens'.
// ---------------------------------------------------------------------------
const MELDING_TAG = 'op-te-gebruiken';
const meldingKan = typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
const lsLezen = (k) => { try { return localStorage.getItem(k); } catch { return ui['ls:' + k] ?? null; } };
const lsZetten = (k, w) => { ui['ls:' + k] = w; try { localStorage.setItem(k, w); } catch { /* */ } };
const vensterBijOpenen = () => lsLezen('op-te-gebruiken-venster') !== 'uit';
let meldingInfo = null; // { aan, laatst } uit IndexedDB, null zolang niet gelezen

/** { aan, laatst } in IndexedDB lezen en eventueel aanvullen met `wijzig`. Geeft null als het niet lukt. */
function meldingStaat(wijzig) {
  return new Promise((ok) => {
    let r;
    try { r = indexedDB.open('voorraadbeheer', 1); } catch { return ok(null); }
    r.onupgradeneeded = () => r.result.createObjectStore('staat');
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      const db = r.result;
      try {
        const t = db.transaction('staat', wijzig ? 'readwrite' : 'readonly'), st = t.objectStore('staat');
        let uit = null;
        const g = st.get('melding');
        g.onsuccess = () => { uit = { ...(g.result || {}), ...(wijzig || {}) }; if (wijzig) st.put(uit, 'melding'); };
        t.oncomplete = () => { db.close(); meldingInfo = uit; ok(uit); };
        t.onerror = t.onabort = () => { db.close(); ok(null); };
      } catch { db.close(); ok(null); }
    };
  });
}

/** Titel en tekst van een melding, bv. "2 producten op te gebruiken" en "Melk: vandaag · Kaas: morgen". */
function meldingTekst(lijst) {
  const titel = lijst.length === 1 ? `${lijst[0].p.naam} op te gebruiken` : `${lijst.length} producten op te gebruiken`;
  const delen = lijst.slice(0, 4).map(({ p, h }) => `${p.naam}: ${h.kort}`);
  return { titel, tekst: delen.join(' · ') + (lijst.length > 4 ? ` · en nog ${lijst.length - 4}` : '') };
}

async function swRegistratie() {
  if (!('serviceWorker' in navigator)) return null;
  try { return (await navigator.serviceWorker.getRegistration()) || null; } catch { return null; }
}
/** Kan de app nakijken terwijl ze dicht is? true / false (bv. iPhone, Firefox, niet geïnstalleerd). */
async function achtergrondKan() {
  const reg = await swRegistratie();
  if (!reg || !reg.periodicSync) return false;
  try { return (await navigator.permissions.query({ name: 'periodic-background-sync' })).state === 'granted'; } catch { return false; }
}
/** Nakijken in de achtergrond aan- of afmelden (ongeveer twee keer per dag; de browser kiest het moment). */
async function achtergrondZetten(aan) {
  const reg = await swRegistratie();
  if (!reg || !reg.periodicSync) return false;
  try {
    if (!aan) { await reg.periodicSync.unregister(MELDING_TAG); return false; }
    if (!(await achtergrondKan())) return false;
    await reg.periodicSync.register(MELDING_TAG, { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch { return false; }
}
async function meldingTonen(titel, tekst) {
  const opties = { body: tekst, icon: 'icoon-192.png', badge: 'icoon-192.png', tag: MELDING_TAG, data: { view: 'voorraad' } };
  const reg = await swRegistratie();
  try {
    if (reg && reg.showNotification) await reg.showNotification(titel, opties);
    else new Notification(titel, opties);
    return true;
  } catch { return false; }
}

/** Venster met alles wat op moet; tik op een product om het te openen. */
function opTeGebruikenVenster() {
  paneelOpenen((el) => {
    const lijst = opTeGebruikenVan(S.producten);
    if (!lijst.length) return paneelSluiten();
    el.innerHTML = `${paneelKop('Op te gebruiken', lijst.length === 1 ? '1 product is bijna of al voorbij de datum' : `${lijst.length} producten zijn bijna of al voorbij de datum`)}
      <ul class="lijst" id="otg-lijst">${lijst.map(opTeGebruikenRij).join('')}</ul>
      <div class="knoppenrij" style="margin-top:1rem"><button class="knop primair" id="otg-voorraad">Naar voorraad</button><button class="knop" data-sluit>Sluiten</button></div>
      <p class="stil" style="font-size:.85rem;line-height:1.5;margin-top:.8rem">Dit venster verschijnt hoogstens één keer per dag als je de app opent. Uitzetten kan bij Instellingen → Meldingen.</p>`;
    sluitKnoppen(el);
    $$('[data-product]', el).forEach((b) => (b.onclick = () => productPaneel(+b.dataset.product)));
    $('#otg-voorraad', el).onclick = () => { paneelSluiten(); naar('voorraad'); };
  });
}
/** Bij het openen (en terugkeren naar) de app: het venster tonen, hoogstens één keer per dag. */
function opTeGebruikenNakijken() {
  if (!vensterBijOpenen() || bezig()) return false;
  const d = vandaag();
  if (lsLezen('op-te-gebruiken-getoond') === d || !opTeGebruikenVan(S.producten).length) return false;
  lsZetten('op-te-gebruiken-getoond', d);
  meldingStaat({ laatst: d }); // je zag het al: vandaag geen melding meer op het toestel
  opTeGebruikenVenster();
  return true;
}

function meldingBlokTekenen() {
  const blok = $m('#melding-blok');
  if (!blok) return;
  const venster = vensterBijOpenen();
  const toestemming = meldingKan ? Notification.permission : 'nee';
  const aan = !!meldingInfo?.aan && toestemming === 'granted';
  blok.innerHTML = `<div class="sectie-titel">Meldingen</div>
    <p class="stil" style="margin-bottom:.6rem;font-size:.92rem;line-height:1.55">Als een product op moet (zoveel dagen vooraf als hierboven ingesteld).</p>
    <div class="instelling"><span>Venster bij het openen van de app</span>
      <div class="segment" id="m-venster" role="group" aria-label="Venster bij het openen" style="min-width:8rem">
        <button type="button" data-venster="aan" class="${venster ? 'aan' : ''}" aria-pressed="${venster}">Aan</button>
        <button type="button" data-venster="uit" class="${venster ? '' : 'aan'}" aria-pressed="${!venster}">Uit</button></div></div>
    <div class="instelling" style="border-bottom:0;flex-wrap:wrap"><span>Melding op dit toestel<small class="stil" id="m-uitleg" style="display:block;font-size:.85rem;line-height:1.5;margin-top:.2rem">${
      !meldingKan ? 'Deze browser kan geen meldingen tonen. Op een iPhone of iPad lukt het alleen als je de app op het beginscherm zet (iOS 16.4 of nieuwer).'
      : toestemming === 'denied' ? 'Meldingen zijn geblokkeerd voor deze app. Sta ze toe in de instellingen van je browser of toestel, en tik dan op Aanzetten.'
      : aan ? 'Aan. Hoogstens één melding per dag.' : 'Uit.'}</small></span>
      <span class="knoppenrij" style="margin:0">${meldingKan ? `${aan ? '<button class="knop" id="m-proef">Proefmelding</button>' : ''}<button class="knop${aan ? '' : ' primair'}" id="m-toestel">${aan ? 'Uitzetten' : 'Aanzetten'}</button>` : ''}</span></div>
    <p class="stil" id="m-achtergrond" style="font-size:.85rem;line-height:1.5" hidden></p>`;
  $$m('[data-venster]', blok).forEach((b) => (b.onclick = () => {
    lsZetten('op-te-gebruiken-venster', b.dataset.venster);
    meldingBlokTekenen();
  }));
  if (aan) achtergrondKan().then((kan) => {
    const p = $('#m-achtergrond', blok);
    if (!p) return;
    p.hidden = false;
    p.textContent = kan ? 'Ook als de app dicht is, kijkt ze ongeveer twee keer per dag na wat op moet (je toestel kiest het juiste moment).'
      : 'Deze browser kan niet nakijken terwijl de app dicht is. Dat lukt alleen in Chrome of Edge (Android of computer) met de app geïnstalleerd. Anders zie je wat op moet in het venster bij het openen.';
  });
  const proef = $('#m-proef', blok);
  if (proef) proef.onclick = async () => {
    const lijst = opTeGebruikenVan(S.producten);
    const m = lijst.length ? meldingTekst(lijst) : { titel: 'Op te gebruiken', tekst: 'Er moet nu niets op. Zo ziet een melding eruit.' };
    if (!(await meldingTonen(m.titel, m.tekst))) toast('De melding kon niet getoond worden.');
  };
  const knop = $('#m-toestel', blok);
  if (knop) knop.onclick = async () => {
    if (aan) {
      await meldingStaat({ aan: false });
      await achtergrondZetten(false);
      toast('Geen meldingen meer op dit toestel.');
      return meldingBlokTekenen();
    }
    let t = Notification.permission;
    if (t === 'default') { try { t = await Notification.requestPermission(); } catch { t = Notification.permission; } }
    if (t !== 'granted') { toast('Geen toestemming voor meldingen gekregen.'); return meldingBlokTekenen(); }
    await meldingStaat({ aan: true });
    const achter = await achtergrondZetten(true);
    toast(achter ? 'Je krijgt een melding als een product op moet.' : 'Meldingen staan aan. Deze browser kijkt alleen na als de app open is.');
    meldingBlokTekenen();
  };
}
// tik op een melding: de service worker vraagt de open app om naar de voorraad te gaan
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => {
  if (e.data && e.data.naar && VIEWS.includes(e.data.naar)) { if (!$('#paneel').hidden) paneelSluiten(); naar(e.data.naar); }
});

// Automatische back-up in Downloads (alle toestellen; aan/uit)
function autoBlokTekenen() {
  const blok = $('#auto-blok');
  if (!blok || !B()) return;
  const aan = B().autoBackupAan(), l = B().backupInfo().laatste;
  blok.innerHTML = `<div class="sectie-titel">Automatische back-up</div>
    <p class="stil" style="margin-bottom:.8rem;font-size:.92rem;line-height:1.55">${aan
      ? `Aan. Elke dag dat je iets wijzigt, zet de app vanzelf een back-up in <b>Downloads</b> (bij de eerste wijziging van de dag). ${l ? `Laatste back-up: ${tijdstipTekst(l)}.` : ''} Oude back-ups mag je verwijderen; de nieuwste is genoeg.`
      : `Uit. Maak dan zelf af en toe een back-up${B().ondersteund ? ', of laat de app je gegevens in een bestand bewaren' : ''}.`}</p>
    <div class="knoppenrij"><button class="knop" id="b-auto">${aan ? 'Uitzetten' : 'Aanzetten'}</button></div>`;
  $('#b-auto', blok).onclick = async () => {
    await api('PUT', 'instellingen', { auto_backup: !aan });
    toast(aan ? 'Automatische back-up staat uit.' : 'Automatische back-up staat aan.');
  };
}

// ---------------------------------------------------------------------------
// Synchroniseren tussen toestellen (versleuteld; zie lokaal.js en sync-server/)
// ---------------------------------------------------------------------------
const V = () => window.voorraadSync;
let qrBelofte = null;
const qrLaden = () => qrBelofte || (qrBelofte = new Promise((ok, nee) => {
  if (window.qrcode) return ok(window.qrcode);
  const s = document.createElement('script');
  s.src = 'vendor/qrcode.js';
  s.onload = () => ok(window.qrcode);
  s.onerror = () => { qrBelofte = null; nee(new Error('QR-code kon niet geladen worden')); };
  document.head.appendChild(s);
}));
const inhoudTekst = (t) => `${t.producten} ${t.producten === 1 ? 'product' : 'producten'}, ${t.recepten} ${t.recepten === 1 ? 'recept' : 'recepten'} en ${t.boodschappen} ${t.boodschappen === 1 ? 'boodschap' : 'boodschappen'}`;
function syncBlokTekenen() {
  const blok = $('#sync-blok');
  if (!blok || !V()) return;
  const titel = '<div class="sectie-titel">Synchroniseren tussen toestellen</div>';
  const p = (tekst) => `<p class="stil" style="margin-bottom:.8rem;font-size:.92rem;line-height:1.55">${tekst}</p>`;
  const z = V().info();
  if (!z) {
    const standaard = V().standaardAdres();
    blok.innerHTML = titel + p('Houd je voorraad, boodschappen, recepten en planning gelijk op al je toestellen. Alles wordt op het toestel zelf versleuteld met een geheime code die alleen jouw toestellen kennen: de server kan je gegevens niet lezen.')
      + (standaard ? '' : `<label class="veld"><span>Adres van je synchronisatieserver (zie LEESMIJ)</span>
        <input id="s-adres" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="https://voorraad-sync.jouwnaam.workers.dev"></label>`)
      + `<div class="knoppenrij"><button class="knop primair" id="s-aan">Synchronisatie aanzetten</button><button class="knop" id="s-scan">QR-code scannen</button><button class="knop" id="s-koppel">Koppelen met een code</button></div>`;
  } else {
    const st = z.bezig ? 'Bezig met synchroniseren…' : z.fout ? '' : z.laatst ? `Aan. Laatst gesynchroniseerd ${tijdstipTekst(z.laatst)}.` : 'Aan.';
    blok.innerHTML = titel + p((st ? esc(st) : '') + (z.fout && !z.bezig ? `<b style="color:var(--rood)">${esc(z.fout)}</b>${z.offline ? ' Je wijzigingen worden verstuurd zodra het weer lukt.' : ''}` : '')
      + '<br>Je gegevens worden versleuteld; de server kan ze niet lezen.')
      + (ui.syncCode ? `<div class="sync-code">
          <p style="font-size:.92rem;line-height:1.55;margin-bottom:.6rem">Op je andere toestel: open Voorraad → Instellingen → <b>QR-code scannen</b> en richt de camera op deze QR-code. Of kies daar <b>Koppelen met een code</b> en typ de code.</p>
          <div class="sync-qr" id="s-qr"></div>
          <div class="sync-tekst">${esc(z.code)}</div>
          <p class="stil" style="font-size:.85rem;line-height:1.5;margin:.6rem 0">Houd deze code geheim: wie ze heeft, kan je gegevens lezen. Bewaar ze ook op een veilige plek: verlies je al je toestellen, dan haal je er alles mee terug.</p>
          <div class="knoppenrij"><button class="knop" id="s-kopieer">Code kopiëren</button><button class="knop" id="s-verberg">Verbergen</button></div></div>`
        : '')
      + `<div class="knoppenrij">${ui.syncCode ? '' : '<button class="knop primair" id="s-toon">Toestel koppelen</button>'}<button class="knop" id="s-nu">Nu synchroniseren</button><button class="knop" id="s-stop">Stoppen</button></div>`;
    if (ui.syncCode) qrLaden().then((qr) => {
      const plek = $('#s-qr', blok);
      if (!plek) return;
      const q = qr(0, 'M'); q.addData(z.link); q.make();
      plek.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    }).catch(() => { const plek = $('#s-qr', blok); if (plek) plek.hidden = true; });
  }
  const knop = (id, f) => { const b = $('#' + id, blok); if (b) b.onclick = f; };
  const fout = (f) => toast(f && f.message ? f.message : 'Dat lukte niet.', null, null, true);
  const adres = () => V().standaardAdres() || ($('#s-adres', blok)?.value || '').trim();
  knop('s-aan', async () => {
    if (!adres()) { toast('Vul eerst het adres van je synchronisatieserver in. Hoe je die maakt, staat in de LEESMIJ.'); $('#s-adres', blok)?.focus(); return; }
    toast('Synchronisatie aanzetten…', null, null, true);
    try { await V().aanzetten(adres()); } catch (f) { return fout(f); }
    ui.syncCode = true;
    toast('Synchronisatie staat aan. Koppel nu je andere toestellen met de code.');
    syncBlokTekenen();
  });
  knop('s-koppel', () => syncKoppelen('', adres()));
  knop('s-scan', () => qrScannen(adres()));
  knop('s-toon', () => { ui.syncCode = true; syncBlokTekenen(); });
  knop('s-verberg', () => { ui.syncCode = false; syncBlokTekenen(); });
  knop('s-kopieer', async () => {
    try { await navigator.clipboard.writeText(z.code); toast('Code gekopieerd.'); } catch { toast(`De code is ${z.code}`, null, null, true); }
  });
  knop('s-nu', async () => {
    try { await V().nu(); toast('Gesynchroniseerd.'); } catch (f) { fout(f); }
    syncBlokTekenen();
  });
  knop('s-stop', async () => {
    if (!(await vraag('Synchronisatie op dit toestel stoppen? Je gegevens blijven op dit toestel staan; je andere toestellen blijven gewoon synchroniseren.', { ja: 'Stoppen' }))) return;
    const wissen = await vraag('Ook alles van de server wissen? Doe dit alleen als je op geen enkel toestel meer wilt synchroniseren: je andere toestellen stoppen dan ook (hun gegevens blijven wel staan).', { ja: 'Ook wissen', gevaar: true });
    try { if (wissen) await V().wissen(); else await V().stoppen(); } catch (f) { return fout(f); }
    ui.syncCode = false;
    toast(wissen ? 'Gestopt en van de server gewist.' : 'Synchronisatie gestopt op dit toestel.');
    syncBlokTekenen();
  });
}
// QR-code van een ander toestel scannen met de camera, in de app zelf (ook op iPhone, waar de camera-app
// de link in Safari zou openen). BarcodeDetector als de browser het heeft, anders jsQR (vendor/jsQR.js).
let jsqrBelofte = null;
const jsqrLaden = () => jsqrBelofte || (jsqrBelofte = new Promise((ok, nee) => {
  if (window.jsQR) return ok(window.jsQR);
  const s = document.createElement('script');
  s.src = 'vendor/jsQR.js';
  s.onload = () => ok(window.jsQR);
  s.onerror = () => { jsqrBelofte = null; nee(new Error('laden')); };
  document.head.appendChild(s);
}));
/** Tekst uit een QR-code: de link (#koppelen=…&server=…) of alleen de code. */
function koppelGegevens(tekst) {
  const t = String(tekst || '').trim();
  const i = t.indexOf('#koppelen=');
  if (i >= 0) { const q = new URLSearchParams(t.slice(i + 1)); return { code: q.get('koppelen') || '', server: q.get('server') || '' }; }
  return /^[0-9a-z\s-]{32,40}$/i.test(t) ? { code: t, server: '' } : null;
}
async function qrScannen(adres) {
  const dlg = document.createElement('dialog');
  dlg.className = 'vraag scanner';
  dlg.innerHTML = `<p>Richt de camera op de QR-code op je andere toestel (Instellingen → Toestel koppelen).</p>
    <div class="scanner-beeld"><video playsinline muted autoplay></video><span class="scanner-kader"></span></div>
    <p class="stil scanner-status" style="font-size:.85rem;margin:.6rem 0 0">Camera openen…</p>
    <div class="vraag-knoppen"><button type="button" class="knop">Annuleren</button></div>`;
  document.body.appendChild(dlg);
  const video = $('video', dlg), status = $('.scanner-status', dlg);
  let stroom = null, klaar = false, timer = null;
  const sluiten = () => {
    klaar = true; clearTimeout(timer);
    if (stroom) stroom.getTracks().forEach((t) => t.stop());
    if (dlg.open) dlg.close();
    dlg.remove();
  };
  $('button', dlg).onclick = sluiten;
  dlg.addEventListener('cancel', sluiten);
  dlg.showModal();
  if (!navigator.mediaDevices?.getUserMedia) {
    sluiten();
    return toast('Deze browser kan de camera niet gebruiken. Typ de code met "Koppelen met een code".', null, null, true);
  }
  try {
    stroom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch (f) {
    sluiten();
    const nee = f && (f.name === 'NotAllowedError' || f.name === 'SecurityError');
    return toast(nee ? 'De app mag de camera niet gebruiken. Geef toestemming in de instellingen van je browser, of typ de code met "Koppelen met een code".'
      : 'De camera kon niet geopend worden. Typ de code met "Koppelen met een code".', null, null, true);
  }
  if (klaar) { stroom.getTracks().forEach((t) => t.stop()); return; }
  video.srcObject = stroom;
  try { await video.play(); } catch { /* autoplay: begint vanzelf */ }
  let lezer = null;
  try {
    if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
      const d = new window.BarcodeDetector({ formats: ['qr_code'] });
      lezer = async () => ((await d.detect(video))[0] || {}).rawValue || null;
    }
  } catch { lezer = null; }
  if (!lezer) {
    let jsQR;
    try { jsQR = await jsqrLaden(); } catch { sluiten(); return toast('De QR-lezer kon niet geladen worden. Typ de code met "Koppelen met een code".', null, null, true); }
    const doek = document.createElement('canvas'), cx = doek.getContext('2d', { willReadFrequently: true });
    lezer = async () => {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return null;
      const f = Math.min(1, 720 / Math.max(w, h));
      doek.width = Math.round(w * f); doek.height = Math.round(h * f);
      cx.drawImage(video, 0, 0, doek.width, doek.height);
      const r = jsQR(cx.getImageData(0, 0, doek.width, doek.height).data, doek.width, doek.height, { inversionAttempts: 'attemptBoth' });
      return r ? r.data : null;
    };
  }
  status.textContent = 'Zoeken naar een QR-code…';
  let fout = false;
  const kijken = async () => {
    if (klaar) return;
    let tekst = null;
    try { tekst = await lezer(); } catch { /* volgend beeld */ }
    if (klaar) return;
    if (tekst) {
      const g = koppelGegevens(tekst);
      if (g && g.code) { sluiten(); return syncKoppelen(g.code, g.server || adres); }
      if (!fout) { fout = true; status.textContent = 'Dit is geen QR-code van Voorraad. Scan de code bij Instellingen → Toestel koppelen op je andere toestel.'; }
    }
    timer = setTimeout(kijken, 200);
  };
  kijken();
}

/** Dit toestel koppelen aan een bestaande synchronisatie (code getypt, of uit een gescande link). */
async function syncKoppelen(code, adres) {
  const viaSafari = isIOS() && !alsApp();
  code = await vraag((viaSafari ? 'Let op: dit opent in Safari. Wil je de app op je beginscherm koppelen, open dan die app en typ daar deze code. ' : '')
    + 'Typ de code die je andere toestel toont (Instellingen → Synchroniseren → Toestel koppelen):', { invoer: true, standaard: code, ja: 'Verder' });
  if (!code || !code.trim()) return;
  adres = adres || V().standaardAdres();
  if (!adres) {
    adres = ((await vraag('Adres van je synchronisatieserver (hetzelfde als op je andere toestel):', { invoer: true, ja: 'Verder' })) || '').trim();
    if (!adres) return;
  }
  toast('Gegevens ophalen…', null, null, true);
  let r;
  try { r = await V().bekijken(code, adres); } catch (f) { return toast(f.message || 'Dat lukte niet.', null, null, true); }
  toastWeg();
  const lokaal = r.lokaal.producten + r.lokaal.recepten + r.lokaal.boodschappen + r.lokaal.planning;
  let wijze = 'vervangen';
  if (lokaal) {
    if (await vraag(`Op je andere toestellen staan ${inhoudTekst(r.extern)}. Op dit toestel staan ook al ${inhoudTekst(r.lokaal)}. Alles samenvoegen? (Wat op beide staat, kan dan dubbel staan.)`, { ja: 'Samenvoegen' })) wijze = 'samenvoegen';
    else if (!(await vraag('Dan de gegevens op dit toestel vervangen door die van je andere toestellen?', { ja: 'Vervangen', gevaar: true }))) return;
  } else if (!(await vraag(`Op je andere toestellen staan ${inhoudTekst(r.extern)}. Dit toestel koppelen?`, { ja: 'Koppelen' }))) return;
  try { await V().koppelen(wijze); } catch (f) { return toast(f.message || 'Dat lukte niet.', null, null, true); }
  await api('GET', 'alles', undefined, true).catch(() => {});
  toast('Gekoppeld. Wijzigingen op je toestellen worden voortaan vanzelf gesynchroniseerd.');
  if (ui.view === 'instellingen') tekenen();
}
// een opdracht duurt al 5 s (zie lokaal.js): laten weten dat de app nog bezig is, niet vastzit
document.addEventListener('traag', () => toast('Even geduld, de app is nog aan het bewaren…'));
document.addEventListener('syncstatus', (e) => {
  if (ui.view === 'instellingen') syncBlokTekenen();
  if (e.detail?.melding) toast(e.detail.melding, null, null, true);
});
// gegevens kwamen binnen van een ander toestel: scherm bijwerken (niet midden in het invullen van iets)
document.addEventListener('syncgewijzigd', () => vernieuwenAlsVrij());

// De app kon niet zelf om toestemming vragen (of kreeg nee): één keer per sessie een melding met een knop
let toestemmingGemeld = false;
document.addEventListener('bestandstatus', (e) => {
  if (ui.view === 'instellingen') bestandBlokTekenen();
  const k = B() && B().info();
  if (!e.detail?.nodig || !k || k.toestemming === 'granted' || toestemmingGemeld) return;
  toestemmingGemeld = true;
  toast(`Je wijzigingen staan in de app, maar nog niet in ${k.naam}.`, 'Toestemming geven', async () => {
    try { await B().toestemmingVragen(); } catch { /* */ }
    if (B().info()?.toestemming !== 'granted') toast('Geen toestemming gekregen. Je kunt het opnieuw proberen bij Instellingen.');
    else toestemmingGemeld = false;
    if (ui.view === 'instellingen') bestandBlokTekenen();
  }, true);
});

// Bij het openen herinneren aan een back-up (hoogstens één keer per dag), als er geen bestand gekoppeld is.
// Is er een bestand gekoppeld zonder toestemming, dan wordt die pas gevraagd bij de eerste wijziging (zie lokaal.js).
function bestandHerinneren() {
  if (!B()) return;
  const k = B().info();
  if (k) return;
  if (B().autoBackupAan?.()) return; // back-up gebeurt vanzelf
  const { laatste, sinds } = B().backupInfo();
  const oud = laatste ? dagenGeleden(laatste) : dagenGeleden(sinds);
  if (oud === null || oud < 14) return;
  const vandaagS = new Date().toDateString();
  try { if (localStorage.getItem('backup-herinnerd') === vandaagS) return; localStorage.setItem('backup-herinnerd', vandaagS); } catch { /* */ }
  const tekst = laatste ? `Je laatste back-up is ${oud} dagen oud.` : 'Je hebt nog geen back-up gemaakt.';
  if (B().ondersteund) toast(`${tekst} Laat de app je gegevens automatisch in een bestand bewaren.`, 'Instellen', () => naar('instellingen'));
  else toast(tekst, 'Back-up maken', () => {
    const a = document.createElement('a'); a.href = 'api/export.json'; a.hidden = true;
    document.body.appendChild(a); a.click(); a.remove();
  });
}

/**
 * De handleiding opdelen per hoofdthema (elke h2): bovenaan een inhoudstafel om naar een thema te springen,
 * elk thema uitklapbaar, en binnen een thema de onderwerpen (h3) om naar te springen.
 * De pdf en het afdrukken gebruiken de volledige tekst (HANDLEIDING), niet deze indeling.
 */
function handleidingThemas() {
  const bron = document.createElement('div');
  bron.innerHTML = HANDLEIDING;
  const themas = [];
  for (const knoop of [...bron.childNodes]) {
    if (knoop.nodeName === 'H2') themas.push({ titel: knoop.textContent.trim(), delen: [] });
    else if (themas.length) themas[themas.length - 1].delen.push(knoop);
  }
  return themas.map((t, n) => {
    const inhoud = document.createElement('div');
    t.delen.forEach((d) => inhoud.appendChild(d));
    const onderwerpen = $$('h3', inhoud).map((h, i) => { h.id = `hl-${n}-${i}`; return { id: h.id, titel: h.textContent.trim() }; });
    return { ...t, id: `hl-${n}`, onderwerpen, html: inhoud.innerHTML };
  });
}
function handleidingPaneel(openThema) {
  paneelOpenen((el) => {
    const themas = handleidingThemas();
    el.innerHTML = `${paneelKop('Handleiding', 'Tik op een thema om het te openen.')}
      <div class="handleiding">
        <nav class="hl-inhoud" aria-label="Inhoud van de handleiding">
          <div class="hl-inhoud-kop"><span class="veld-titel">Inhoud</span><button type="button" class="hl-alles" id="hl-alles">Alles openklappen</button></div>
          <div class="hl-inhoud-lijst">${themas.map((t) => `<button type="button" class="hl-inhoud-knop" data-hl-naar="${t.id}">${esc(t.titel)}</button>`).join('')}</div>
        </nav>
        ${themas.map((t) => `<details class="hl-thema" id="${t.id}">
          <summary><span>${esc(t.titel)}</span>${t.onderwerpen.length ? `<small>${t.onderwerpen.length} ${t.onderwerpen.length === 1 ? 'onderwerp' : 'onderwerpen'}</small>` : ''}</summary>
          <div class="hl-thema-inhoud">
            ${t.onderwerpen.length > 1 ? `<div class="hl-onderwerpen">${t.onderwerpen.map((o) => `<button type="button" class="chip" data-hl-naar="${o.id}">${esc(o.titel)}</button>`).join('')}</div>` : ''}
            ${t.html}
            <button type="button" class="hl-terug" data-hl-terug>↑ Naar de inhoud</button>
          </div></details>`).join('')}
      </div>
      <div class="paneel-voet"><button class="knop" data-handleiding-pdf>Pdf downloaden</button>
      <button class="knop" data-handleiding-afdrukken>Afdrukken</button><button class="knop" data-sluit>Sluiten</button></div>`;
    sluitKnoppen(el);
    handleidingKnoppen(el);
    const thema = $$('.hl-thema', el);
    const allesKnop = () => { $('#hl-alles', el).textContent = thema.every((d) => d.open) ? 'Alles dichtklappen' : 'Alles openklappen'; };
    thema.forEach((d) => d.addEventListener('toggle', allesKnop));
    $('#hl-alles', el).onclick = () => { const open = !thema.every((d) => d.open); thema.forEach((d) => (d.open = open)); allesKnop(); };
    // naar een thema of onderwerp springen: het thema openklappen en ernaartoe scrollen
    const naar = (id) => {
      const doel = el.querySelector(`#${id}`);
      if (!doel) return;
      const d = doel.closest('.hl-thema');
      if (d) d.open = true;
      allesKnop();
      requestAnimationFrame(() => doel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    $$('[data-hl-naar]', el).forEach((b) => (b.onclick = () => naar(b.dataset.hlNaar)));
    $$('[data-hl-terug]', el).forEach((b) => (b.onclick = () => $('.hl-inhoud', el).scrollIntoView({ behavior: 'smooth', block: 'start' })));
    // schermafbeelding aantikken: groter tonen (nog eens tikken: weer klein)
    $$('figure.hl-foto img', el).forEach((img) => {
      img.setAttribute('role', 'button'); img.tabIndex = 0;
      const wissel = () => img.closest('figure').classList.toggle('groot');
      img.onclick = wissel;
      img.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wissel(); } };
    });
    if (openThema) naar(themas.find((t) => zelfde(t.titel, openThema))?.id || '');
  }, { breed: true });
}

/** Knoppen "Pdf downloaden" en "Afdrukken" van de handleiding koppelen (in het paneel en bij Instellingen). */
function handleidingKnoppen(el) {
  $$('[data-handleiding-pdf]', el).forEach((b) => (b.onclick = handleidingDownloaden));
  $$('[data-handleiding-afdrukken]', el).forEach((b) => (b.onclick = handleidingAfdrukken));
}

/** De handleiding als pdf-bestand downloaden (gemaakt op het toestel zelf, ook zonder internet). */
async function handleidingDownloaden() {
  try {
    const { handleidingPdf } = await import('./handleiding-pdf.js');
    const datum = new Date().toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });
    // de schermafbeeldingen ophalen (offline uit de cache); lukt er een niet, dan komt alleen de uitleg in de pdf
    const afbeeldingen = {};
    await Promise.all([...new Set(HANDLEIDING.match(/handleiding\/[\w-]+\.jpg/g) || [])].map(async (src) => {
      try { const r = await fetch(src); if (r.ok) afbeeldingen[src] = new Uint8Array(await r.arrayBuffer()); } catch { /* zonder afbeelding */ }
    }));
    const pdf = handleidingPdf(HANDLEIDING, { titel: 'Handleiding Voorraad', onderschrift: `Versie ${APP_VERSIE} · ${datum}`, afbeeldingen });
    const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = `Handleiding Voorraad (versie ${APP_VERSIE}).pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('Handleiding gedownload als pdf');
  } catch (e) {
    console.error(e);
    toast('De pdf kon niet gemaakt worden. Probeer Afdrukken en kies daar Opslaan als pdf.');
  }
}

/** De handleiding afdrukken: alleen de handleiding komt op papier, niet de rest van de app. */
function handleidingAfdrukken() {
  document.getElementById('afdruk')?.remove();
  const blok = document.createElement('div');
  blok.id = 'afdruk';
  blok.className = 'handleiding';
  blok.innerHTML = `<h1>Handleiding Voorraad</h1><p class="afdruk-versie">Versie ${APP_VERSIE}</p>${HANDLEIDING}`;
  document.body.appendChild(blok);
  document.body.classList.add('afdrukken');
  const opruimen = () => { document.body.classList.remove('afdrukken'); blok.remove(); window.removeEventListener('afterprint', opruimen); };
  window.addEventListener('afterprint', opruimen);
  if (typeof window.print !== 'function') { opruimen(); toast('Afdrukken kan niet in deze browser. Download de pdf en druk die af.'); return; }
  // wachten tot de schermafbeeldingen geladen zijn (hoogstens 3 seconden) en de afdrukversie getekend is (nodig op iPhone)
  const geladen = Promise.all($$('img', blok).map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));
  Promise.race([geladen, new Promise((ok) => setTimeout(ok, 3000))]).then(() => setTimeout(() => {
    try { window.print(); } catch { opruimen(); toast('Afdrukken lukte niet. Download de pdf en druk die af.'); }
  }, 50));
}

async function tekenInstellingen() {
  const inst = S.instellingen;
  const telling = (veld, naam) => veld === 'recept_soort' ? S.recepten.filter((r) => zelfde(r.soort, naam)).length
    : veld === 'recept_categorie' ? S.recepten.filter((r) => (r.categorieen || []).some((c) => zelfde(c, naam))).length
    : veld === 'winkel' ? (S.catalogus || []).filter((c) => (c.prijzen || []).some((p) => zelfde(p.winkel, naam))).length
    : veld === 'maaltijd' ? (S.planning || []).filter((m) => zelfde(m.maaltijd, naam)).length
    : veld === 'eenheid' ? S.producten.filter((p) => p.eenheid === naam || p.grootverpakking?.eenheid === naam).length
    : veld === 'inhoud_eenheid' ? S.producten.filter((p) => p.inhoud_eenheid === naam || p.grootverpakking?.inhoud_eenheid === naam).length
    : S.producten.filter((p) => zelfde(p[veld], naam)).length;
  const isRecept = (veld) => veld.startsWith('recept_');
  const aantalTekst = (veld, n) => !n ? '' : veld === 'maaltijd' ? `${n} gepland` : isRecept(veld) ? `${n} ${n === 1 ? 'recept' : 'recepten'}` : `${n} ${n === 1 ? 'product' : 'producten'}`;
  const lijstBlok = (titel, sleutel, veld, voorbeeld, uitleg = '') => `
    <details class="sectie uitklap" data-uitklap="${sleutel}"${ui.uitgeklapt.has(sleutel) ? ' open' : ''}>
      <summary><span>${titel}</span><span class="stil">${(inst[sleutel] || []).length}</span></summary>
      <p class="stil" style="font-size:.82rem;margin:.2rem 0 .3rem">${uitleg || 'Tik op een naam om die te wijzigen.'} Wijzigingen worden meteen bewaard.</p>
      <ul class="lijst">${(inst[sleutel] || []).map((n, i) => {
        const aantal = telling(veld, n);
        return `<li class="rij beheer" data-lijst="${sleutel}" data-i="${i}">
          <button class="naam beheer-naam" data-hernoem>${esc(n)}</button>
          <span class="rechts">${aantalTekst(veld, aantal)}</span>
          <span class="beheer-knoppen">
            <button class="weg" data-omhoog aria-label="Omhoog" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="weg" data-wis aria-label="${esc(n)} verwijderen">×</button>
          </span></li>`;
      }).join('')}</ul>
      <form class="toevoegen beheer-nieuw" data-nieuw="${sleutel}" autocomplete="off">
        <input placeholder="${voorbeeld}" autocapitalize="${veld.includes('eenheid') ? 'none' : 'sentences'}">
        <button class="knop" aria-label="Toevoegen">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}</button>
      </form></details>`;
  const dagen = (titel, sleutel) => `<div class="instelling"><span>${titel}</span>
      <span class="personen"><button data-dagen="${sleutel}" data-stap="-1" aria-label="Minder">−</button>
      <span style="min-width:5.5rem;text-align:center">${inst[sleutel] ?? 0} ${(inst[sleutel] ?? 0) === 1 ? 'dag' : 'dagen'}</span>
      <button data-dagen="${sleutel}" data-stap="1" aria-label="Meer">+</button></span></div>`;
  $('#inhoud').innerHTML = `
    <header class="kop"><h1>Instellingen</h1></header>
    <section class="sectie" id="installeer-blok" hidden></section>
    <section class="sectie"><div class="sectie-titel">Handleiding</div>
      <p class="stil" style="margin-bottom:.8rem;font-size:.92rem">Uitleg over alle schermen en knoppen, ook zonder internet.</p>
      <div class="knoppenrij"><button class="knop" id="i-handleiding">Handleiding lezen</button>
      <button class="knop" data-handleiding-pdf>Pdf downloaden</button><button class="knop" data-handleiding-afdrukken>Afdrukken</button></div></section>
    <section class="sectie" id="scherm-blok"></section>
    <section class="sectie"><div class="sectie-titel">Waarschuwen, zoveel dagen vooraf</div>
      ${dagen('Te gebruiken tot', 'tgt_dagen')}${dagen('Ten minste houdbaar tot', 'tht_dagen')}</section>
    <section class="sectie" id="melding-blok"></section>
    ${lijstBlok('Plaatsen', 'locaties', 'locatie', 'Nieuwe plaats, bv. Kelder')}
    ${lijstBlok('Productcategorieën', 'categorieen', 'categorie', 'Nieuwe categorie, bv. Babyvoeding')}
    ${lijstBlok('Winkels', 'winkels', 'winkel', 'Nieuwe winkel, bv. Colruyt')}
    ${lijstBlok('Soorten gerechten', 'recept_soorten', 'recept_soort', 'Nieuwe soort, bv. Tapas')}
    ${lijstBlok('Receptcategorieën', 'recept_categorieen', 'recept_categorie', 'Nieuwe categorie, bv. Italiaans')}
    ${lijstBlok('Maaltijden in de planner', 'maaltijden', 'maaltijd', 'Nieuwe maaltijd, bv. Vieruurtje')}
    ${lijstBlok('Eenheden', 'eenheden', 'eenheid', 'Nieuwe eenheid, bv. bokaal',
      'De eenheden die je kiest bij je voorraad en boodschappen. Een eigen eenheid (bv. bokaal, tube, rol) telt als verpakking: je kunt er een inhoud per stuk bij invullen. Tik op een eigen eenheid om ze te hernoemen.')}
    ${lijstBlok('Eenheden voor de inhoud', 'inhoud_eenheden', 'inhoud_eenheid', 'Nieuwe eenheid, bv. vel',
      'De eenheden bij <b>Eenheid inhoud</b>, bv. pak à 500 g of rol à 200 vel. Een eigen eenheid (bv. vel, wasbeurt, tablet) rekent de app niet om naar g of l, maar je kunt er wel een prijs per vel of per wasbeurt voor invullen. Tik op een eigen eenheid om ze te hernoemen.')}
    <section class="sectie"><div class="sectie-titel">Overzicht</div><div id="stats" class="stil">Laden…</div></section>
    <section class="sectie" id="sync-blok"></section>
    <section class="sectie" id="auto-blok"></section>
    <section class="sectie" id="bestand-blok"></section>
    <section class="sectie"><div class="sectie-titel">Back-up</div>
      <p class="stil" style="margin-bottom:.8rem;font-size:.92rem">Met een back-up zet je alles over naar een ander toestel. <span id="backup-laatst"></span></p>
      <div class="knoppenrij"><a class="knop" href="api/export.json" download>Back-up downloaden</a><a class="knop" href="api/export.csv" download>Voorraad als CSV</a>
      <button class="knop" id="i-terug">Back-up terugzetten</button></div></section>
    <section class="sectie"><div class="sectie-titel">Over</div>
      <p class="stil" style="font-size:.92rem;line-height:1.6">Alles draait op dit toestel, ook zonder internet. Er wordt niets naar buiten gestuurd (behalve als je synchronisatie aanzet: dan gaan je gegevens versleuteld naar je eigen server) en er wordt geen AI gebruikt; ingelezen pdf's verlaten het toestel niet.<br>Versie ${APP_VERSIE}${status.opslag === false ? '<br><b style="color:var(--rood, #b42318)">Let op: deze browser bewaart je gegevens niet. Open de app niet in een privévenster.</b>' : ''}</p></section>
    <details class="sectie uitklap" data-uitklap="logboek"${ui.uitgeklapt.has('logboek') ? ' open' : ''}>
      <summary><span>Probleemlogboek</span><span class="stil">${(window.voorraadLog?.lezen() || []).length}</span></summary>
      <p class="stil" style="font-size:.82rem;margin:.2rem 0 .5rem">Loopt de app vast of gebeurt er iets vreemds, dan staat hier wat er gebeurde (alleen op dit toestel). Tik op <b>Kopiëren</b> en stuur het door naar wie je helpt.</p>
      <pre id="logboek" style="white-space:pre-wrap;word-break:break-word;font-size:.75rem;max-height:16rem;overflow:auto;background:var(--vlak, rgba(127,127,127,.08));padding:.5rem;border-radius:8px">${esc((window.voorraadLog?.lezen() || []).slice().reverse().join('\n') || 'Niets genoteerd.')}</pre>
      <div class="knoppenrij"><button class="knop" id="log-kopie">Kopiëren</button><button class="knop" id="log-wis">Wissen</button></div>
    </details>`;
  installBlokTekenen();
  bestandBlokTekenen();
  syncBlokTekenen();
  schermBlokTekenen();
  meldingBlokTekenen();
  if (!meldingInfo) meldingStaat().then(() => meldingBlokTekenen());
  $m('#i-handleiding').onclick = () => handleidingPaneel();
  const logInfo = () => `Voorraad versie ${APP_VERSIE} · ${navigator.userAgent}${matchMedia('(display-mode: standalone)').matches ? ' · geïnstalleerd' : ''}\n` + (window.voorraadLog?.lezen() || []).join('\n');
  $m('#log-kopie').onclick = async () => {
    try { await navigator.clipboard.writeText(logInfo()); toast('Gekopieerd. Plak het in een bericht.'); }
    catch { const r = document.createRange(); r.selectNodeContents($m('#logboek')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Kopiëren lukte niet vanzelf: de tekst is geselecteerd, kopieer ze zelf.'); }
  };
  $m('#log-wis').onclick = () => { window.voorraadLog?.wissen(); tekenen(); };
  handleidingKnoppen($('#inhoud'));

  // open/dicht onthouden, ook als het scherm opnieuw getekend wordt
  $$m('[data-uitklap]').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) ui.uitgeklapt.add(d.dataset.uitklap); else ui.uitgeklapt.delete(d.dataset.uitklap);
  }));
  const bewaar = (wijziging) => api('PUT', 'instellingen', wijziging);
  $$m('[data-dagen]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.dagen;
    bewaar({ [k]: Math.min(60, Math.max(0, (inst[k] ?? 0) + +b.dataset.stap)) });
  }));
  const VELD = { locaties: 'locatie', categorieen: 'categorie', winkels: 'winkel', recept_soorten: 'recept_soort', recept_categorieen: 'recept_categorie', maaltijden: 'maaltijd', eenheden: 'eenheid', inhoud_eenheden: 'inhoud_eenheid' };
  const SOORT = { locaties: 'plaats', categorieen: 'categorie', winkels: 'winkel', recept_soorten: 'soort', recept_categorieen: 'categorie', maaltijden: 'maaltijd', eenheden: 'eenheid', inhoud_eenheden: 'eenheid' };
  const HOOFD = { plaats: 'Plaats', categorie: 'Categorie', soort: 'Soort', winkel: 'Winkel', maaltijd: 'Maaltijd', eenheid: 'Eenheid' };
  // eenheden altijd in kleine letters; de standaardeenheden (g, kg, l …) rekent de app om, die hernoem je niet
  const isEenheid = (k) => k === 'eenheden' || k === 'inhoud_eenheden';
  const netjes = (k, naam) => (isEenheid(k) ? naam.toLowerCase() : naam);
  const vastEenheid = (k, naam) => (k === 'eenheden' && STANDAARD_EENHEDEN.includes(naam)) || (k === 'inhoud_eenheden' && VASTE_INHOUD.has(naam));
  $$m('[data-nieuw]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const k = f.dataset.nieuw, naam = netjes(k, $m('input', f).value.trim());
    if (!naam) return;
    if (isEenheid(k) && eenheidFout(k, naam, [])) return toast(eenheidFout(k, naam, []));
    if ((inst[k] || []).some((x) => zelfde(x, naam))) return toast(`"${naam}" bestaat al.`);
    await bewaar({ [k]: [...(inst[k] || []), naam] });
    toast(`${naam} toegevoegd`);
  }));
  $$m('.beheer').forEach((rij) => {
    const k = rij.dataset.lijst, i = +rij.dataset.i, lijst = [...(inst[k] || [])], naam = lijst[i];
    $m('[data-hernoem]', rij).onclick = async () => {
      if (vastEenheid(k, naam)) return toast(`"${naam}" is een standaardeenheid; die kun je niet hernoemen. Verwijderen of een nieuwe toevoegen kan wel.`);
      const nieuw = netjes(k, ((await vraag(`Nieuwe naam voor ${SOORT[k]} "${naam}":`, { invoer: true, standaard: naam, ja: 'Bewaren' })) || '').trim());
      if (!nieuw || nieuw === naam) return;
      if (isEenheid(k) && eenheidFout(k, nieuw, [])) return toast(eenheidFout(k, nieuw, []));
      if ((k === 'eenheden' && (STANDAARD_EENHEDEN.includes(nieuw) || RECEPT_EENHEDEN.includes(nieuw))) || (k === 'inhoud_eenheden' && VASTE_INHOUD.has(nieuw)))
        return toast(`"${nieuw}" is een standaardeenheid. Kies een andere naam.`);
      if (lijst.some((x, j) => j !== i && zelfde(x, nieuw))) return toast(`"${nieuw}" bestaat al.`);
      lijst[i] = nieuw;
      await bewaar({ [k]: lijst });
      await api('POST', 'hernoemen', { veld: VELD[k], van: naam, naar: nieuw });
    };
    $m('[data-omhoog]', rij).onclick = () => { [lijst[i - 1], lijst[i]] = [lijst[i], lijst[i - 1]]; bewaar({ [k]: lijst }); };
    $m('[data-wis]', rij).onclick = async () => {
      if (k === 'eenheden' && naam === 'stuks') return toast('"stuks" kun je niet verwijderen: dat is de eenheid als je niets kiest.');
      if (k === 'inhoud_eenheden' && lijst.length === 1) return toast('Er moet minstens één eenheid voor de inhoud overblijven.');
      const aantal = telling(VELD[k], naam);
      const wie = isRecept(VELD[k]) ? (aantal === 1 ? 'recept heeft' : 'recepten hebben') : (aantal === 1 ? 'product heeft' : 'producten hebben');
      const tekst = !aantal ? `${HOOFD[SOORT[k]]} "${naam}" verwijderen?`
        : VELD[k] === 'maaltijd' ? `Maaltijd "${naam}" verwijderen? ${aantal} ${aantal === 1 ? 'geplande maaltijd blijft' : 'geplande maaltijden blijven'} in de planner staan, zonder dit moment.`
        : isEenheid(k) ? `Eenheid "${naam}" verwijderen? Je kunt ze daarna niet meer kiezen. ${aantal} ${aantal === 1 ? 'product houdt' : 'producten houden'} wel deze eenheid tot je ze aanpast.`
        : VELD[k] === 'winkel' ? `Winkel "${naam}" verwijderen? De prijzen bij deze winkel (${aantal} ${aantal === 1 ? 'product' : 'producten'}) worden gewist.`
        : `${HOOFD[SOORT[k]]} "${naam}" verwijderen? ${aantal} ${wie} daarna ${VELD[k] === 'recept_categorie' ? 'deze categorie niet' : `geen ${SOORT[k]}`} meer.`;
      if (!(await vraag(tekst, { ja: 'Verwijderen', gevaar: true }))) return;
      lijst.splice(i, 1);
      await bewaar({ [k]: lijst });
      if (aantal && !isEenheid(k)) await api('POST', 'hernoemen', { veld: VELD[k], van: naam, naar: '' });
    };
  });
  $m('#i-terug').onclick = () => $('#bestand-backup').click();
  try {
    const st = await api('GET', 'statistieken', undefined, true);
    if (ui.view !== 'instellingen' || !$m('#stats')) return;
    const blok = (titel, items) => items.length ? `<h3 style="margin-top:.6rem">${titel}</h3>${items.slice(0, 5).map((x) => `<div class="stat"><span>${esc(x.naam)}</span><span class="stil">${x.aantal}×</span></div>`).join('')}` : '';
    const html = blok('Vaakst weggegooid', st.weggegooid) + blok('Vaakst gekocht', st.gekocht) + blok('Vaakst gekookt', st.gekookt);
    $m('#stats').innerHTML = html || 'Nog niets om te tonen.';
    $m('#stats').classList.toggle('stil', !html);
  } catch { /* stil */ }
}
$('#bestand-backup').onchange = async (e) => {
  const bestand = e.target.files[0];
  e.target.value = '';
  if (!bestand) return;
  let tekst = '';
  try { tekst = (await bestand.text()).replace(/^﻿/, '').trim(); } catch { return toast('Dit bestand kon niet gelezen worden.', null, null, true); }
  if (tekst.startsWith('SQLite format')) {
    return toast('Dit is een databasebestand (voorraad.db) van de oude app. Kies het back-upbestand dat eindigt op .json.', null, null, true);
  }
  let data;
  try { data = JSON.parse(tekst); } catch {
    return toast(`"${bestand.name}" is geen back-up van Voorraad. Kies het bestand voorraad-backup-….json.`, null, null, true);
  }
  const g = data && typeof data === 'object' ? (Array.isArray(data.producten) || Array.isArray(data.recepten) ? data : data.gegevens || data.data || data) : {};
  const aantal = (x) => (Array.isArray(x) ? x.length : 0);
  if (!Array.isArray(g.producten) && !Array.isArray(g.recepten)) {
    return toast(`"${bestand.name}" is geen back-up van Voorraad. Kies het bestand voorraad-backup-….json.`, null, null, true);
  }
  const inhoud = `${aantal(g.producten)} producten, ${aantal(g.recepten)} recepten en ${aantal(g.boodschappen)} boodschappen`;
  if (!(await vraag(`Deze back-up bevat ${inhoud}. Al je huidige gegevens op dit toestel worden erdoor vervangen. Doorgaan?`, { ja: 'Terugzetten', gevaar: true }))) return;
  try { await api('POST', 'import', g); } catch { return; /* melding al getoond */ }
  ui.zoek = ''; ui.receptZoek = '';
  naar('voorraad');
  toast(`Back-up teruggezet: ${inhoud}. Zoek een product om het te bekijken.`, null, null, true);
  setTimeout(toastWeg, 8000);
};

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function start() {
  // gescande QR-code van een ander toestel: #koppelen=<code>&server=<adres>
  const koppel = location.hash.startsWith('#koppelen=') ? new URLSearchParams(location.hash.slice(1)) : null;
  if (koppel) history.replaceState(null, '', '#instellingen'); // de code niet in de adresbalk laten staan
  ui.view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'voorraad';
  schermBijwerken(); // "Scherm aan laten: Altijd" meteen toepassen
  window.voorraadLog?.schrijf(`App geopend (versie ${APP_VERSIE}${matchMedia('(display-mode: standalone)').matches ? ', geïnstalleerd' : ''})`);
  try { status = await fetch('api/status').then((r) => r.json()); } catch { /* */ }
  try { await api('GET', 'alles'); } catch {
    $('#inhoud').innerHTML = '<div class="leeg"><b>De app kon niet starten</b>Herlaad de pagina. Gebruik geen privévenster.</div>';
    return;
  }
  if (koppel && V()) {
    if (V().info()) toast('Dit toestel synchroniseert al. Stop eerst bij Instellingen als je een andere code wilt gebruiken.', null, null, true);
    else await syncKoppelen(koppel.get('koppelen') || '', koppel.get('server') || '');
    return;
  }
  opTeGebruikenNakijken();
  bestandHerinneren();
  // meldingen staan aan: opnieuw aanmelden om na te kijken (bv. nadat de app intussen geïnstalleerd werd)
  meldingStaat().then((m) => { if (m?.aan && meldingKan && Notification.permission === 'granted') achtergrondZetten(true); });
}
const bezig = () => !$('#paneel').hidden || $('#vraag').open || document.activeElement?.matches('input, textarea');
document.addEventListener('installeerbaar', () => { installBlokTekenen(); installTipTekenen(); });
// Nieuwe gegevens (van een ander toestel, of na het terugkomen in de app): scherm bijwerken. Ben je net iets aan het
// invullen, dan pas zodra je klaar bent (paneel of venster dicht), anders moest je zelf vernieuwen.
function vernieuwenAlsVrij(nakijken = false) {
  if (bezig()) { vernieuwenNodig = true; return; }
  vernieuwenNodig = false;
  api('GET', 'alles', undefined, true).then(() => { if (nakijken) opTeGebruikenNakijken(); }).catch(() => {});
}
function vrijNakijken() { if (!vernieuwenNodig) return; clearTimeout(vrijTimer); vrijTimer = setTimeout(() => { if (vernieuwenNodig) vernieuwenAlsVrij(); }, 400); }
document.addEventListener('focusout', vrijNakijken);
$('#vraag').addEventListener('close', vrijNakijken);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') vernieuwenAlsVrij(true); });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== ui.view) naar(v); });
start();

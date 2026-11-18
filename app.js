// Voorraad — interface. Praat met api/..., afgehandeld in lokaal.js (opslag op dit toestel).
import { receptOntleden, ingredientOntleden, zoekVoorraadnaam, sleutelwoorden, omrekenen } from './parser.js';
import { tekstOpmaken, pdfStukjes, paginasStapelen } from './layout.js';
import { HANDLEIDING } from './handleiding.js';

// ---------------------------------------------------------------------------
// Basis
// ---------------------------------------------------------------------------
const EENHEDEN = ['stuks', 'g', 'kg', 'ml', 'cl', 'dl', 'l', 'pak', 'blik', 'fles', 'pot', 'zak', 'doos'];
const TELBAAR = new Set(['stuks', 'pak', 'blik', 'fles', 'pot', 'zak', 'doos']);
const RECEPT_EENHEDEN = ['', 'stuks', 'g', 'kg', 'ml', 'cl', 'dl', 'l', 'el', 'tl', 'snuf', 'teen', 'blik', 'pak', 'zak',
  'pot', 'fles', 'takje', 'bos', 'kopje', 'plak', 'scheut', 'handvol', 'blad'];
// Basisingrediënten die je meestal niet bijhoudt: tellen niet als "ontbreekt" (tenzij gekoppeld)
const ALTIJD_IN_HUIS = new Set(['water', 'kraanwater', 'heet water', 'koud water', 'lauw water', 'ijsblokjes', 'zout', 'peper',
  'peper en zout', 'zout en peper', 'peper & zout', 'zout & peper', 'peper en zout naar smaak', 'zout en peper naar smaak']);
const MAX_PDF_PAGINAS = 15;
// Zelfde nummer als VERSIE in sw.js; staat onderaan bij Instellingen, zodat je kunt zien of een toestel de nieuwste versie heeft.
const APP_VERSIE = 48;

let S = { producten: [], boodschappen: [], recepten: [], catalogus: [], planning: [], instellingen: {} };
let status = {};
const ui = { view: 'voorraad', week: 0, winkel: '', plaats: '', zoek: '', receptZoek: '', catZoek: '', receptFilter: { fav: false, inHuis: false, soort: '', cat: '' }, uitgeklapt: new Set() };

const ICOON = {
  kast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M9 7.5h1M9 16.5h1"/></svg>',
  mand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-1.6 10.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8z"/><path d="M8 9l4-6 4 6"/></svg>',
  boek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20v-3"/></svg>',
  tandwiel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  lijst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".6"/><circle cx="4.5" cy="12" r=".6"/><circle cx="4.5" cy="18" r=".6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  zoek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  sluit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ster: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l7.4 7.4a1.5 1.5 0 0 1 0 2.1l-7.2 7.2a1.5 1.5 0 0 1-2.1 0l-7.6-7.6a1 1 0 0 1-.3-.7z"/><circle cx="8.2" cy="8.2" r="1.3"/></svg>',
  kalender: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/></svg>',
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
const INHOUD_EENHEDEN = ['g', 'kg', 'ml', 'cl', 'dl', 'l'];
const inhoudVan = (p) => (p && TELBAAR.has(p.eenheid) && p.inhoud > 0 && p.inhoud_eenheid ? { per: p.inhoud, eenheid: p.inhoud_eenheid } : null);
/** Inhoud per verpakking van één boodschap (bv. pak à 500 g); een boodschap zonder eenheid telt als stuks. */
const boodschapInhoudVan = (b) => inhoudVan(b && { ...b, eenheid: b.eenheid || 'stuks' });
const boodschapTekst = (b) => { const i = boodschapInhoudVan(b); return hoeveelTekst(b.hoeveelheid, b.eenheid || 'stuks') + (i ? ` à ${hoeveelTekst(i.per, i.eenheid)}` : ''); };
const voorraadTekst = (p) => { const i = inhoudVan(p); return hoeveelTekst(p.hoeveelheid, p.eenheid) + (i ? ` à ${hoeveelTekst(i.per, i.eenheid)}` : '') + uitlekTekst(p); };
/** Het gewicht is uitlekgewicht (bv. groenten in blik): alleen vermelden als er een gewicht of inhoud staat. */
const uitlekTekst = (p) => (p && p.uitlekgewicht && (inhoudVan(p) || !TELBAAR.has(p.eenheid)) ? ' uitlekgewicht' : '');
/** Gekend merk van een product (uit de catalogus, anders uit de voorraad). */
const merkVan = (naam) => catalogusVan(naam)?.merk || S.producten.find((p) => zelfde(p.naam, naam) && p.merk)?.merk || '';
/** Merk achter de naam in een lijst (bv. Kikkererwten · Bonduelle). */
const merkTekst = (p) => (p && p.merk ? `<span class="merk"> · ${esc(p.merk)}</span>` : '');
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

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
async function api(methode, pad, body, stil = false) {
  const opties = { method: methode, headers: {} };
  if (body !== undefined) { opties.body = JSON.stringify(body); opties.headers['Content-Type'] = 'application/json'; }
  let antwoord;
  try { antwoord = await fetch('api/' + pad, opties); } catch {
    if (!stil) toast('Er ging iets mis bij het bewaren. Herlaad de app.');
    throw new Error('geen verbinding');
  }
  const data = await antwoord.json().catch(() => ({}));
  if (!antwoord.ok) {
    if (!stil) toast(data.fout || 'Er ging iets mis.');
    throw new Error(data.fout || 'fout');
  }
  if (data.producten) { S = data; tekenen(); if (paneelVernieuwen) paneelVernieuwen(); }
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
  teken(p);
  p.scrollTop = 0;
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
}
$('#sluier').onclick = paneelSluiten;

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
const PRIJS_EENHEDEN = ['kg', 'g', 'l', 'ml', 'stuks', 'pak', 'blik', 'fles', 'pot', 'zak', 'doos'];
/** Eenheid van de prijzen die er al zijn, anders die die bij de eenheid van het product past. */
const prijsPerVan = (prijzen, eenheid) => (prijzen || []).find((p) => p.per)?.per || prijsEenheid(eenheid);
const euro = (n) => '€ ' + n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const catalogusVan = (naam) => (S.catalogus || []).find((c) => zelfde(c.naam, naam));
/** Sleutel van de inhoud van een prijs, boodschap of product (bv. "500 g"); leeg zonder inhoud. */
const prijsSleutel = (x) => (x && x.inhoud > 0 && x.inhoud_eenheid ? `${x.inhoud} ${x.inhoud_eenheid}` : '');
const inhoudLabel = (x) => (prijsSleutel(x) ? `à ${hoeveelTekst(x.inhoud, x.inhoud_eenheid)}` : '');
/**
 * Prijzen van een product. Zonder `inh`: alle prijzen. Met `inh` (iets met inhoud/inhoud_eenheid, of null):
 * de prijzen van die inhoud; zijn er geen, dan de prijzen zonder inhoud (en zonder inhoud: die van de gewone inhoud van het product).
 */
function prijzenVan(naam, inh) {
  const alle = catalogusVan(naam)?.prijzen || [];
  if (inh === undefined) return alle;
  const met = (k) => alle.filter((p) => prijsSleutel(p) === k);
  const k = prijsSleutel(inh);
  let lijst = met(k);
  if (!lijst.length && k) lijst = met('');
  if (!lijst.length && !k) lijst = met(prijsSleutel(catalogusVan(naam)));
  return lijst;
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
const lijstMelding = (naam, inh) => { const g = goedkoopste(naam, inh); return `${naam} staat op de boodschappenlijst${g ? ` (goedkoopst bij ${g.winkel})` : ''}`; };
const prijsRegelTekst = (p) => `${euro(p.prijs)} per ${perTekst(p.per)}`;

/** Invulvelden voor de prijzen: kies de eenheid (per kg, per stuk ...), één regel per winkel uit Instellingen, plus zelf winkels toevoegen. */
function prijzenVeldenHtml(prijzen, eenheid, standaardPer) {
  // een lege groep neemt de eenheid van de andere prijzen over (bv. per kg)
  const per = (prijzen || []).find((p) => p.per)?.per || standaardPer || prijsEenheid(eenheid);
  // een prijs die in een andere eenheid bewaard werd (bv. per g) tonen in de gekozen eenheid (per kg)
  prijzen = prijzen.map((p) => { const f = omrekenen(1, per, p.per); return f === null || p.per === per ? p : { ...p, prijs: Math.round(p.prijs * f * 1000) / 1000 }; });
  const vast = winkels().map((w) => ({ winkel: w, prijs: prijzen.find((p) => zelfde(p.winkel, w))?.prijs ?? null }));
  const extra = prijzen.filter((p) => !winkels().some((w) => zelfde(w, p.winkel)));
  const keuzes = PRIJS_EENHEDEN.includes(per) ? PRIJS_EENHEDEN : [...PRIJS_EENHEDEN, per];
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
/** Inhouden waarvoor je een prijs kunt invullen: die van de prijzen, het product, je voorraad en je boodschappen. */
function bekendeInhouden(naam) {
  const c = catalogusVan(naam);
  const telbaar = (x) => x.prijs !== undefined || TELBAAR.has(x.eenheid || 'stuks');
  const bronnen = [...(c?.prijzen || []), ...(c ? [c] : []), ...S.producten.filter((p) => zelfde(p.naam, naam)), ...S.boodschappen.filter((b) => zelfde(b.naam, naam))];
  const uit = new Map();
  for (const x of bronnen) if (prijsSleutel(x) && telbaar(x) && !uit.has(prijsSleutel(x))) uit.set(prijsSleutel(x), { inhoud: x.inhoud, inhoud_eenheid: x.inhoud_eenheid });
  const grootte = (x) => omrekenen(x.inhoud, x.inhoud_eenheid, ['ml', 'cl', 'dl', 'l'].includes(x.inhoud_eenheid) ? 'ml' : 'g') ?? x.inhoud;
  return [...uit.values()].sort((a, b) => grootte(a) - grootte(b));
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
  const groepen = [...bekendeInhouden(naam).map(prijsSleutel), ''].map((k) => alle.filter((p) => prijsSleutel(p) === k)).filter((l) => l.length);
  const kopjes = groepen.length > 1 || !!prijsSleutel(groepen[0][0]);
  return `<div class="datumblok prijzen-blok"><div><b>Prijzen</b>${groepen.map((groep) => {
    const lijst = prijzenSorteren(groep);
    return (kopjes ? `<div class="pz-groep-titel">${esc(prijsSleutel(lijst[0]) ? `${perTekst(verpakking)} ${inhoudLabel(lijst[0])}` : 'Andere inhoud')}</div>` : '')
      + lijst.map((p, i) => `<div class="stat"><span>${esc(p.winkel)}${i === 0 && lijst.length > 1 ? ' <small class="goedkoopst">goedkoopst</small>' : ''}</span>
    <span class="stil">${esc(prijsRegelTekst(p) + perStuk(p))}</span></div>`).join('');
  }).join('')}</div></div>`;
}
const groepTitel = (inh, eenheid) => (prijsSleutel(inh) ? `Per ${perTekst(TELBAAR.has(eenheid) ? eenheid : 'stuks')} ${inhoudLabel(inh)}` : 'Andere inhoud (zonder eigen prijs)');
/** Eén blok prijsvelden voor één inhoud (of zonder inhoud) in het prijzenpaneel. */
function prijsGroepHtml(inh, prijzen, eenheid, metKop, standaardPer) {
  const k = prijsSleutel(inh);
  return `<section class="pz-groep" data-inhoud="${k ? esc(inh.inhoud) : ''}" data-inhoud-eenheid="${k ? esc(inh.inhoud_eenheid) : ''}">
    ${metKop ? `<h3 class="pz-groep-titel">${esc(groepTitel(inh, eenheid))}</h3>` : ''}
    ${prijzenVeldenHtml(prijzen, eenheid, standaardPer)}</section>`;
}
const groepInhoud = (g) => (g.dataset.inhoud ? { inhoud: num(g.dataset.inhoud), inhoud_eenheid: g.dataset.inhoudEenheid } : null);
/** Paneel om alleen de prijzen van een product aan te passen: per inhoud een eigen prijs. */
function prijzenPaneel(naam, eenheid, terug) {
  paneelOpenen((el) => {
    if (alGetekend('prijzen')) return; // niet opnieuw tekenen terwijl je typt
    const c = catalogusVan(naam);
    const e = c?.eenheid || eenheid || 'stuks';
    const alle = c?.prijzen || [];
    const inhouden = TELBAAR.has(e) ? bekendeInhouden(naam) : [];
    // zonder inhoud: alleen tonen als er al zulke prijzen zijn, of als er geen enkele inhoud gekend is
    const groepen = [...inhouden, ...(!inhouden.length || alle.some((p) => !prijsSleutel(p)) ? [null] : [])];
    let metKop = groepen.length > 1 || !!groepen[0];
    el.innerHTML = `${paneelKop('Prijzen', esc(naam))}
      <form id="pz-form" autocomplete="off">
        ${TELBAAR.has(e) ? '<p class="stil pz-uitleg">Elke inhoud heeft zijn eigen prijs: een groot pak is vaak goedkoper per kg.</p>' : ''}
        <div id="pz-groepen">${groepen.map((g) => prijsGroepHtml(g, alle.filter((p) => prijsSleutel(p) === prijsSleutel(g)), e, metKop, prijsPerVan(alle, e))).join('')}</div>
        ${TELBAAR.has(e) ? `<details class="meer" id="pz-nieuw" style="margin-top:.8rem"><summary>+ Prijs voor een andere inhoud</summary>
          <div class="rij2"><label class="veld"><span>Inhoud per ${esc(perTekst(e))}</span><input id="pz-nieuw-inhoud" inputmode="decimal" placeholder="bv. 1"></label>
            <label class="veld"><span>Eenheid inhoud</span><select id="pz-nieuw-eenheid">${opties(INHOUD_EENHEDEN, 'kg')}</select></label></div>
          <button type="button" class="knop" id="pz-nieuw-ok">Inhoud toevoegen</button></details>` : ''}
        <p class="stil pz-uitleg" style="margin-top:.8rem">Op je boodschappenlijst komt ${esc(naam)} bij de goedkoopste winkel voor de inhoud die je koopt.</p>
        <div class="paneel-voet"><button type="submit" class="knop primair">Bewaren</button></div></form>`;
    sluitKnoppen(el);
    const koppelen = (g) => prijzenKoppelen(g, () => ({ eenheid: e, inhoud_eenheid: g.dataset.inhoudEenheid || (c?.inhoud > 0 ? c.inhoud_eenheid : '') }));
    $$('.pz-groep', el).forEach(koppelen);
    const nieuwOk = $('#pz-nieuw-ok', el);
    if (nieuwOk) nieuwOk.onclick = () => {
      const i = num($('#pz-nieuw-inhoud', el).value), ie = $('#pz-nieuw-eenheid', el).value;
      if (!(i > 0)) { toast('Vul een geldige inhoud in.'); $('#pz-nieuw-inhoud', el).focus(); return; }
      const inh = { inhoud: i, inhoud_eenheid: ie };
      let g = $$('.pz-groep', el).find((x) => prijsSleutel(groepInhoud(x)) === prijsSleutel(inh));
      if (!g) {
        // de bestaande groep krijgt nu ook een kopje
        if (!metKop) $$('.pz-groep', el).forEach((x) => x.insertAdjacentHTML('afterbegin', `<h3 class="pz-groep-titel">${esc(groepTitel(groepInhoud(x), e))}</h3>`));
        metKop = true;
        $('#pz-groepen', el).insertAdjacentHTML('beforeend', prijsGroepHtml(inh, [], e, true, $('select.pz-per', el)?.value || prijsPerVan(alle, e)));
        g = $$('.pz-groep', el).pop();
        koppelen(g);
      }
      $('#pz-nieuw-inhoud', el).value = ''; $('#pz-nieuw', el).open = false;
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
 * Prijsvelden in een formulier (product, catalogus, boodschap): ze horen bij de inhoud die in dat formulier staat.
 * `pz` is het <details>-blok; `inh` de inhoud ({ inhoud, inhoud_eenheid } of null).
 */
function formPrijzenZetten(pz, naam, eenheid, inh, product) {
  const k = prijsSleutel(inh);
  const label = `Prijs per winkel${k ? ` <small class="stil">voor ${esc(perTekst(TELBAAR.has(eenheid) ? eenheid : 'stuks'))} ${esc(inhoudLabel(inh))}</small>` : ''}`;
  pz.dataset.inhoud = k ? inh.inhoud : ''; pz.dataset.inhoudEenheid = k ? inh.inhoud_eenheid : '';
  // zelf prijzen ingevuld: die laten staan, ze gelden nu voor de nieuwe inhoud
  if (pz.dataset.aangeraakt && $('summary', pz)) { $('summary', pz).innerHTML = label; pz.prijsHint?.(); return; }
  pz.innerHTML = `<summary>${label}</summary>${prijzenVeldenHtml(naam ? prijzenVan(naam, inh || null) : [], eenheid, naam ? prijsPerVan(prijzenVan(naam), eenheid) : undefined)}`;
  prijzenKoppelen(pz, product);
}
/** De inhoud waarvoor de prijsvelden van een formulier gelden, voor de API (`prijzen_inhoud`). */
const formPrijzenInhoud = (pz) => (pz.dataset.inhoud ? { inhoud: num(pz.dataset.inhoud), inhoud_eenheid: pz.dataset.inhoudEenheid } : null);
/** Inhoud uit de velden van een formulier lezen zonder meldingen (null als ze leeg of ongeldig is). */
function formInhoud(el, id, eenheid) {
  const i = num($(`#${id}-inhoud`, el)?.value || '');
  return TELBAAR.has(eenheid || 'stuks') && i > 0 ? { inhoud: i, inhoud_eenheid: $(`#${id}-inhoud-eenheid`, el).value } : null;
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
function tekenVoorraad() {
  const zoek = ui.zoek.trim().toLowerCase();
  const passend = S.producten.filter((p) => (!zoek || `${p.naam} ${p.merk || ''} ${p.locatie} ${p.categorie} ${p.notitie} ${p.barcode || ''}`.toLowerCase().includes(zoek)));
  const metH = passend.map((p) => ({ p, h: houdbaarheid(p) }));
  const opTeGebruiken = metH.filter((x) => x.h.niveau > 0)
    .sort((a, b) => (b.h.niveau >= 3) - (a.h.niveau >= 3) || a.p.vervaldatum.localeCompare(b.p.vervaldatum));
  const rest = metH.filter((x) => x.h.niveau === 0 && x.p.hoeveelheid > 0);
  const op = metH.filter((x) => !(x.p.hoeveelheid > 0));

  const rij = ({ p, h }, metStatus) => `<li><button class="rij${p.hoeveelheid > 0 ? '' : ' op'}" data-product="${p.id}">
      ${metStatus ? `<span class="stip ${h.kleur}"></span>` : ''}
      <span class="naam">${esc(p.naam)}${merkTekst(p)}${metStatus ? `<small>${esc(h.uitleg)}</small>` : ''}</span>
      <span class="rechts${metStatus ? ' ' + h.kleur : ''}">${metStatus ? esc(h.kort) : p.hoeveelheid > 0 ? esc(voorraadTekst(p)) : 'op'}</span>
    </button></li>`;

  let lijst = '';
  if (!S.producten.length) {
    lijst = `<div class="leeg"><b>Nog niets in je voorraad</b>Tik op + om je eerste product toe te voegen.</div>`;
  } else if (!passend.length) {
    lijst = `<div class="leeg">Niets gevonden.</div>`;
  } else {
    if (opTeGebruiken.length) lijst += `<section class="sectie"><div class="sectie-titel">Op te gebruiken</div><ul class="lijst">${opTeGebruiken.map((x) => rij(x, true)).join('')}</ul></section>`;
    // De rest van de voorraad verschijnt alleen bij zoeken
    if (zoek && rest.length) {
      // Elk product maar één keer tonen (meerdere partijen van hetzelfde product samen), zonder aantallen
      const groepen = new Map();
      for (const x of rest) {
        const k = x.p.naam.trim().toLowerCase();
        if (!groepen.has(k)) groepen.set(k, []);
        groepen.get(k).push(x.p);
      }
      const items = [...groepen.values()].sort((a, b) => a[0].naam.localeCompare(b[0].naam, 'nl'));
      lijst += `<section class="sectie"><div class="sectie-titel">Gevonden</div><ul class="lijst">${items.map((g) =>
        `<li><button class="rij" data-groep="${g.map((p) => p.id).join(',')}"><span class="naam">${esc(g[0].naam)}</span></button></li>`).join('')}</ul></section>`;
    }
    if (!zoek && !opTeGebruiken.length) {
      lijst += `<div class="leeg"><b>Niets dat binnenkort op moet</b>Zoek een product om het te bekijken of aan te passen.</div>`;
    }
    if (op.length) lijst += `<section class="sectie"><div class="sectie-titel">Op</div><ul class="lijst">${op.map((x) => rij(x, false)).join('')}</ul></section>`;
  }

  inhoudZetten(`
    <header class="kop"><h1>Voorraad</h1>
      <div class="kop-acties">
        ${instellingenKnop}
        <button class="knop primair" id="nieuw">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}<span>Toevoegen</span></button>
      </div></header>
    <div class="installeer-tip" id="installeer-tip" hidden></div>
    ${S.producten.length ? `
    <div class="zoek">${ICOON.zoek}<input type="search" id="zoek-voorraad" placeholder="Zoeken" value="${esc(ui.zoek)}" autocomplete="off"></div>` : ''}
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
}

// Meerdere partijen van hetzelfde product: kies welke je wilt bekijken
function partijenPaneel(ids) {
  paneelOpenen((el) => {
    const lijst = ids.map((id) => S.producten.find((p) => p.id === id)).filter(Boolean)
      .sort((a, b) => (a.vervaldatum || '9999').localeCompare(b.vervaldatum || '9999'));
    if (!lijst.length) return paneelSluiten();
    if (lijst.length === 1) return productPaneel(lijst[0].id);
    el.innerHTML = `${paneelKop(esc(lijst[0].naam), 'Kies welke je wilt bekijken')}
      <ul class="lijst">${lijst.map((p) => `<li><button class="rij" data-partij="${p.id}"><span class="naam">${
        esc(p.vervaldatum ? `${TYPE_LANG[p.datumtype] || TYPE_LANG.THT} ${datumNL(p.vervaldatum, true)}` : 'Geen houdbaarheidsdatum')
      }<small>${esc([p.merk, p.locatie, p.categorie].filter(Boolean).join(' · ') || ' ')}</small></span><span class="rechts">›</span></button></li>`).join('')}</ul>`;
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
      ${paneelKop(esc(p.naam), esc([p.merk, p.locatie, p.categorie].filter(Boolean).join(' · ')))}
      <div class="hoeveelheid">
        ${telbaar ? `<button class="rond" id="min" aria-label="Eén minder" ${p.hoeveelheid >= 1 ? '' : 'disabled'}>−</button>` : ''}
        <div class="getal">${esc(fmt(p.hoeveelheid))}<span>${esc(p.eenheid === 'stuks' ? (p.hoeveelheid === 1 ? 'stuk' : 'stuks') : p.eenheid)}</span>${inh ? `<small class="inhoud-per">à ${esc(hoeveelTekst(inh.per, inh.eenheid))}${esc(uitlekTekst(p))}${p.hoeveelheid > 0 && p.hoeveelheid !== 1 ? ` · samen ${esc(samenTekst(p.hoeveelheid * inh.per, inh.eenheid))}` : ''}</small>` : uitlekTekst(p) ? '<small class="inhoud-per">uitlekgewicht</small>' : ''}</div>
        ${telbaar ? '<button class="rond" id="plus" aria-label="Eén meer">+</button>' : ''}
      </div>
      ${delen.length ? `<div class="gebruik"><span class="stil" style="align-self:center;margin-right:.2rem">Gebruikt:</span>${delen.map(([w, t]) => `<button class="chip" data-deel="${w ?? ''}">${t}</button>`).join('')}<button class="chip" id="ander">Andere hoeveelheid</button></div>` : ''}
      ${datum}
      ${prijzenBlok(p.naam)}
      <ul class="acties">
        <li><button id="erbij">Nieuwe verpakking toevoegen</button></li>
        <li><button id="lijst">Op boodschappenlijst</button></li>
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
      inhoud: p.inhoud || null, inhoud_eenheid: p.inhoud_eenheid || '', uitlekgewicht: !!p.uitlekgewicht, merk: p.merk || '' }));
    knop('lijst', async () => { await api('POST', 'boodschappen', { naam: p.naam, eenheid: p.eenheid, inhoud: p.inhoud || null, inhoud_eenheid: p.inhoud_eenheid || '', merk: p.merk || '', product_id: p.id }); toast(lijstMelding(p.naam, p)); });
    knop('prijzen', () => prijzenPaneel(p.naam, p.eenheid, () => productPaneel(p.id)));
    knop('weggooien', () => verbruiken(p, null, 'weggegooid', true));
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
function tekenCatalogus() {
  const q = ui.catZoek.trim().toLowerCase();
  const alles = [...(S.catalogus || [])].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  const items = alles.filter((c) => !q || `${c.naam} ${c.merk || ''} ${c.categorie || ''} ${c.locatie || ''} ${c.barcode || ''}`.toLowerCase().includes(q));
  const inHuis = (naam) => S.producten.some((p) => zelfde(p.naam, naam) && p.hoeveelheid > 0);
  // per beginletter gegroepeerd, zodat je in een lange lijst snel vindt wat je zoekt
  const groepen = new Map();
  for (const c of items) {
    const l = (c.naam.trim().charAt(0) || '#').toLocaleUpperCase('nl').normalize('NFD').replace(/[̀-ͯ]/g, '');
    const k = /[A-Z]/.test(l) ? l : '#';
    if (!groepen.has(k)) groepen.set(k, []);
    groepen.get(k).push(c);
  }
  const rij = (c) => `<li><button class="rij" data-cat="${esc(c.naam)}">
      <span class="naam">${esc(c.naam)}${merkTekst(c)}<small>${esc([c.categorie, c.locatie].filter(Boolean).join(' · ') || ' ')}</small></span>
      <span class="rechts">${inHuis(c.naam) ? 'in huis' : ''}</span></button></li>`;
  const lijst = !alles.length
    ? `<div class="leeg"><b>De catalogus is nog leeg</b>Elk product dat je aan je voorraad toevoegt, komt hier vanzelf bij. Zo vind je het later terug, ook als het op is. Met Toevoegen zet je er zelf een product bij.</div>`
    : !items.length ? '<div class="leeg">Niets gevonden.</div>'
    : [...groepen].map(([k, g]) => `<section class="sectie"><div class="sectie-titel">${esc(k)}</div><ul class="lijst">${g.map(rij).join('')}</ul></section>`).join('');
  inhoudZetten(`
    <header class="kop"><h1>Catalogus</h1>
      <div class="kop-acties">
        ${instellingenKnop}
        <button class="knop primair" id="cat-nieuw">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}<span>Toevoegen</span></button>
      </div></header>
    ${alles.length ? `<p class="stil">${alles.length} ${alles.length === 1 ? 'product' : 'producten'} die je ooit toevoegde, ook als ze op zijn.</p>
    <div class="zoek">${ICOON.zoek}<input type="search" id="zoek-catalogus" placeholder="Zoeken in catalogus" value="${esc(ui.catZoek)}" autocomplete="off"></div>` : ''}
    ${lijst}`);
  const z = $m('#zoek-catalogus');
  if (z) z.oninput = () => { ui.catZoek = z.value; tekenCatalogus(); };
  $m('#cat-nieuw').onclick = () => catalogusFormulier(null);
  $$m('[data-cat]').forEach((b) => (b.onclick = () => { const c = catalogusVan(b.dataset.cat); if (c) catalogusItem(c); }));
}
function catalogusItem(c0) {
  paneelOpenen((el) => {
    const c = catalogusVan(c0.naam) || c0;
    const nu = S.producten.filter((p) => zelfde(p.naam, c.naam) && p.hoeveelheid > 0);
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
    const info = [c.uitlekgewicht ? 'gewicht = uitlekgewicht' : '', c.aantal ? `${c.aantal}× toegevoegd` : '', c.laatst ? `laatst op ${datumNL(c.laatst.slice(0, 10), true)}` : '']
      .filter(Boolean).join(' · ');
    el.innerHTML = `${paneelKop(esc(c.naam), esc([c.merk, c.categorie, c.locatie].filter(Boolean).join(' · ')))}
      <div class="datumblok"><div>${totalen.length ? `In huis: ${esc(totalen.map((t) => hoeveelTekst(t.hoeveelheid, t.eenheid)).join(' en '))}` : 'Nu niet in huis'}
        ${info ? `<small>${esc(info)}</small>` : ''}</div></div>
      ${prijzenBlok(c.naam)}
      <ul class="acties">
        <li><button id="c-voorraad">Aan voorraad toevoegen</button></li>
        <li><button id="c-lijst">Op boodschappenlijst</button></li>
        <li><button id="c-bewerk">Bewerken</button></li>
        <li><button id="c-prijzen">${(c.prijzen || []).length ? 'Prijzen aanpassen' : 'Prijzen invullen'}</button></li>
        <li><button id="c-weg" class="gevaar">Uit catalogus verwijderen</button></li>
      </ul>`;
    sluitKnoppen(el);
    $('#c-voorraad', el).onclick = () => productFormulier(null, { naam: c.naam, eenheid: c.eenheid || 'stuks', categorie: c.categorie || '',
      locatie: c.locatie || locaties()[0] || '', datumtype: c.datumtype || 'THT', barcode: c.barcode || '',
      hoeveelheid: c.hoeveelheid > 0 ? c.hoeveelheid : 1, inhoud: c.inhoud || null, inhoud_eenheid: c.inhoud_eenheid || '', uitlekgewicht: !!c.uitlekgewicht, merk: c.merk || '' });
    $('#c-lijst', el).onclick = async () => { await api('POST', 'boodschappen', { naam: c.naam, eenheid: c.eenheid || 'stuks', inhoud: c.inhoud || null, inhoud_eenheid: c.inhoud_eenheid || '', merk: c.merk || '' }); toast(lijstMelding(c.naam, c)); };
    $('#c-prijzen', el).onclick = () => prijzenPaneel(c.naam, c.eenheid, () => { const nu = catalogusVan(c.naam); if (nu) catalogusItem(nu); else paneelSluiten(); });
    $('#c-bewerk', el).onclick = () => catalogusFormulier(c);
    $('#c-weg', el).onclick = async () => {
      if (!(await vraag(`${c.naam} uit de catalogus verwijderen? Je voorraad blijft zoals ze is.`, { ja: 'Verwijderen', gevaar: true }))) return;
      await api('DELETE', 'catalogus', { naam: c.naam });
      toast(`${c.naam} uit catalogus verwijderd`);
      paneelSluiten();
    };
  });
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

// Catalogusproduct zelf toevoegen of bewerken (los van je voorraad)
function catalogusFormulier(bestaand) {
  const nieuw = !bestaand;
  const c = bestaand ? { ...bestaand } : { naam: ui.catZoek.trim(), eenheid: 'stuks', categorie: '', locatie: '', datumtype: 'THT', inhoud: null, inhoud_eenheid: '' };
  if (nieuw && c.naam) c.naam = c.naam.charAt(0).toUpperCase() + c.naam.slice(1);
  paneelOpenen((el) => {
    if (alGetekend('catformulier')) return; // niet opnieuw tekenen terwijl je typt
    // geen keuze van eenheid: nieuw is altijd per stuk, een bestaand product houdt zijn eenheid
    const eenheid = c.eenheid || 'stuks';
    const inVoorraad = !nieuw && (S.producten.some((p) => zelfde(p.naam, c.naam)) || S.boodschappen.some((b) => zelfde(b.naam, c.naam)));
    el.innerHTML = `
      ${paneelKop(nieuw ? 'Aan catalogus toevoegen' : 'Bewerken', nieuw ? 'Komt niet in je voorraad; dat kan later vanuit de catalogus' : '')}
      <form id="cf" autocomplete="off">
        <label class="veld"><span>Naam</span><input id="cf-naam" value="${esc(c.naam || '')}" required autocomplete="off" autocapitalize="sentences"></label>
        <label class="veld"><span>Merk (mag leeg)</span><input id="cf-merk" value="${esc(c.merk || '')}" autocomplete="off" autocapitalize="words" placeholder="bv. Bonduelle"></label>
        ${inVoorraad ? '<p class="stil" style="margin-top:-.4rem">Een nieuwe naam wordt ook aangepast in je voorraad en op je boodschappenlijst.</p>' : ''}
        <label class="veld"><span>Aantal${eenheid !== 'stuks' ? ` (${esc(eenheid)})` : ''}</span><input id="cf-hv" inputmode="decimal" value="${c.hoeveelheid > 0 ? esc(fmt(c.hoeveelheid)) : '1'}"></label>
        <p class="stil" style="margin:-.4rem 0 1rem">Wordt ingevuld als je het product vanuit de catalogus aan je voorraad toevoegt.</p>
        <div class="rij2" id="cf-inhoud-rij">
          <label class="veld"><span id="cf-inhoud-titel">Inhoud per stuk</span><input id="cf-inhoud" inputmode="decimal" value="${c.inhoud > 0 ? esc(fmt(c.inhoud)) : ''}" placeholder="bv. 500"></label>
          <label class="veld"><span>Eenheid inhoud</span><select id="cf-inhoud-eenheid">${opties(INHOUD_EENHEDEN, c.inhoud_eenheid || 'g')}</select></label>
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
    $('#cf-inhoud-titel', el).textContent = `Inhoud per ${perTekst(eenheid)} (mag leeg)`;
    const info = () => ({ eenheid, inhoud_eenheid: $('#cf-inhoud', el).value.trim() ? $('#cf-inhoud-eenheid', el).value : '' });
    // de prijzen gelden voor de inhoud die hier staat
    const cfPrijzen = () => formPrijzenZetten($('#cf-prijzen', el), nieuw ? '' : c.naam, eenheid, formInhoud(el, 'cf', eenheid), info);
    cfPrijzen();
    $('#cf-inhoud', el).oninput = cfPrijzen;
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
      cfPrijzen();
      const pz = $('#cf-prijzen', el), prijzen = prijzenLezen(pz, eenheid);
      if (!prijzen) { pz.open = true; return; }
      const data = { naam, hoeveelheid: hv, eenheid, categorie: $('#cf-cat', el).value, locatie: $('#cf-plaats', el).value, datumtype: type,
        inhoud: inhoud > 0 ? inhoud : null, inhoud_eenheid: inhoud > 0 ? $('#cf-inhoud-eenheid', el).value : '', uitlekgewicht: $('#cf-uitlek', el).checked, merk: $('#cf-merk', el).value.trim(),
        // alleen de prijzen van deze inhoud; niets aangepast: niets bewaren
        ...(pz.dataset.aangeraakt || nieuw ? { prijzen, prijzen_inhoud: formPrijzenInhoud(pz) } : {}) };
      if (!nieuw) data.oudeNaam = c.naam;
      try {
        await api(nieuw ? 'POST' : 'PUT', 'catalogus', data);
        toast(nieuw ? `${naam} toegevoegd aan de catalogus` : `${naam} bewaard`);
        const nu = catalogusVan(naam);
        if (nu) catalogusItem(nu); else paneelSluiten();
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
  paneelOpenen((el) => {
    if (alGetekend('formulier')) return; // niet opnieuw tekenen terwijl je typt
    el.innerHTML = `
      ${paneelKop(nieuw ? 'Toevoegen' : 'Bewerken')}
      <form id="pf" autocomplete="off">
        <label class="veld"><span>Naam</span><input id="pf-naam" value="${esc(p.naam)}" required autocomplete="off" autocapitalize="sentences"></label>
        <label class="veld"><span>Merk (mag leeg)</span><input id="pf-merk" value="${esc(p.merk || '')}" autocomplete="off" autocapitalize="words" placeholder="bv. Bonduelle"></label>
        <div class="rij2">
          <label class="veld"><span>Hoeveelheid</span><input id="pf-hv" inputmode="decimal" value="${esc(fmt(p.hoeveelheid))}" required></label>
          <label class="veld"><span>Eenheid</span><select id="pf-eenheid">${opties(EENHEDEN, p.eenheid)}</select></label>
        </div>
        <div class="rij2" id="pf-inhoud-rij">
          <label class="veld"><span id="pf-inhoud-titel">Inhoud per stuk</span><input id="pf-inhoud" inputmode="decimal" value="${p.inhoud > 0 ? esc(fmt(p.inhoud)) : ''}" placeholder="bv. 500"></label>
          <label class="veld"><span>Eenheid inhoud</span><select id="pf-inhoud-eenheid">${opties(INHOUD_EENHEDEN, p.inhoud_eenheid || 'g')}</select></label>
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
          <label class="veld"><span>Minimumvoorraad voor deze inhoud (eronder komt het op je boodschappenlijst)</span><input id="pf-min" inputmode="decimal" value="${p.minimum ? esc(fmt(p.minimum)) : ''}" placeholder="Geen"></label>
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
    const productInfo = () => ({ eenheid: $('#pf-eenheid', el).value, inhoud_eenheid: $('#pf-inhoud', el).value.trim() ? $('#pf-inhoud-eenheid', el).value : '' });
    // de prijzen gelden voor de inhoud die hier staat (bv. pak à 500 g)
    const pfPrijzen = () => { const e = $('#pf-eenheid', el).value; formPrijzenZetten($('#pf-prijzen', el), $('#pf-naam', el).value.trim() || p.naam, e, formInhoud(el, 'pf', e), productInfo); };
    pfPrijzen();
    $('#pf-eenheid', el).onchange = () => { inhoudTonen(); prijsPerZetten(el, $('#pf-eenheid', el).value); pfPrijzen(); };
    $('#pf-inhoud', el).oninput = pfPrijzen;
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
      if (info.eenheid) { $('#pf-eenheid', el).innerHTML = opties(EENHEDEN, info.eenheid); inhoudTonen(); prijsPerZetten(el, info.eenheid); }
      if (info.inhoud > 0 && !$('#pf-inhoud', el).value) {
        $('#pf-inhoud', el).value = fmt(info.inhoud);
        if (info.inhoud_eenheid) $('#pf-inhoud-eenheid', el).innerHTML = opties(INHOUD_EENHEDEN, info.inhoud_eenheid);
      }
      if (info.categorie) $('#pf-cat', el).innerHTML = opties(categorieen(), info.categorie, 'Geen');
      if (info.merk && !$('#pf-merk', el).value) $('#pf-merk', el).value = info.merk;
      if (info.locatie) { plaats = info.locatie; $$('#pf-plaats .chip', el).forEach((c) => c.classList.toggle('aan', zelfde(c.dataset.w, plaats))); }
      if (info.datumtype) { type = info.datumtype === 'TGT' ? 'TGT' : 'THT'; typeTekenen(); }
      if ('uitlekgewicht' in info) $('#pf-uitlek', el).checked = !!info.uitlekgewicht;
    };
    // bekende naam: gegevens van dat product overnemen
    const bekendeNaam = () => {
      if (!nieuw) return;
      const naam = $('#pf-naam', el).value;
      const b = S.producten.find((x) => zelfde(x.naam, naam)) || (S.catalogus || []).find((x) => zelfde(x.naam, naam));
      if (b) invullen({ eenheid: b.eenheid, categorie: b.categorie, locatie: b.locatie, datumtype: b.datumtype, inhoud: b.inhoud, inhoud_eenheid: b.inhoud_eenheid, uitlekgewicht: !!b.uitlekgewicht, merk: b.merk || '' });
      // gekende prijzen overnemen (alleen als je zelf nog niets invulde)
      pfPrijzen();
      if (prijzenVan(naam).length && !$('#pf-prijzen', el).dataset.aangeraakt) $('#pf-prijzen', el).open = true;
    };
    $('#pf-naam', el).onchange = bekendeNaam;
    suggesties($('#pf-naam', el), catalogusnamen, bekendeNaam);
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
      const nieuweNaam = !nieuw && !zelfde($('#pf-naam', el).value, p.naam);
      const data = {
        // alleen de prijzen van deze inhoud, en alleen als je ze aanpaste (zo blijven gekende prijzen staan)
        ...((pz.dataset.aangeraakt || nieuweNaam) && (prijzen.length || !nieuw) ? { prijzen, prijzen_inhoud: formPrijzenInhoud(pz) } : {}),
        inhoud: inhoud > 0 ? inhoud : null, inhoud_eenheid: inhoud > 0 ? $('#pf-inhoud-eenheid', el).value : '', uitlekgewicht: $('#pf-uitlek', el).checked, merk: $('#pf-merk', el).value.trim(),
        naam: $('#pf-naam', el).value.trim(), hoeveelheid: hv, eenheid: $('#pf-eenheid', el).value, locatie: plaats || '',
        vervaldatum: $('#pf-datum', el).value, datumtype: type, categorie: $('#pf-cat', el).value.trim(),
        minimum: num($('#pf-min', el).value) || 0, barcode: p.barcode || '', // barcodes staan voorlopig uit; een bestaande code blijft bewaard
        aankoopdatum: $('#pf-aankoop', el).value, notitie: $('#pf-notitie', el).value.trim(),
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
  const metWinkel = S.boodschappen.map((b) => ({ b, p: goedkoopste(b.naam, b) }));
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
    return `<li><label class="rij vink">
      <input type="checkbox" data-vink="${b.id}" ${b.afgevinkt ? 'checked' : ''}><span class="vakje"></span>
      <span class="naam"><button type="button" class="naam-knop" data-bewerk="${b.id}" aria-label="${esc(b.naam)} bewerken">${esc(b.naam)}${merkTekst(b)}</button><small>${b.bron === 'minimum' && !b.afgevinkt ? 'Onder je minimumvoorraad · ' : ''}<button type="button" class="prijs-link${p ? '' : ' leeg'}" data-prijs="${b.id}">${esc(prijs)}</button></small></span>
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
    ${tabs.length ? `<div class="chips winkel-tabs" role="tablist">${tabKnop('', 'Alles', S.boodschappen.filter((b) => !b.afgevinkt).length)}${tabs.map((w) => tabKnop(w, w, telPer.get(w.toLowerCase()))).join('')}</div>` : ''}
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
    const keuzes = EENHEDEN.includes(e0) ? EENHEDEN : [...EENHEDEN, e0];
    const bi = boodschapInhoudVan(b);
    el.innerHTML = `${paneelKop(`Hoeveel ${esc(b.naam)}?`, 'Kies het aantal, de eenheid en eventueel de inhoud.')}
      <div style="margin-bottom:1rem"><span class="veld-titel">Hoeveel</span><div class="aantal-kies">
        <button type="button" class="rond" id="hk-min" aria-label="Minder">−</button>
        <input id="hk-hv" inputmode="decimal" value="${esc(fmt(b.hoeveelheid ?? stapVan(e0)))}" aria-label="Hoeveelheid">
        <button type="button" class="rond" id="hk-plus" aria-label="Meer">+</button>
        <select id="hk-eenheid" aria-label="Eenheid">${opties(keuzes, e0)}</select></div></div>
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
    <label class="veld"><span>Eenheid inhoud</span><select id="${id}-inhoud-eenheid">${opties(INHOUD_EENHEDEN, inhoudEenheid || 'g')}</select></label></div>`;
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
      const namen = catalogusnamen().filter((n) => !q || `${n} ${merkVan(n)}`.toLowerCase().includes(q));
      const opLijst = (n) => S.boodschappen.filter((b) => zelfde(b.naam, n) && !b.afgevinkt);
      const inHuis = (n) => S.producten.filter((p) => zelfde(p.naam, n) && p.hoeveelheid > 0);
      $('#bt-lijst', el).innerHTML = namen.length ? `<div class="sectie-titel"><span>Kies uit je catalogus</span></div><ul class="lijst">${namen.map((n, i) => {
        const b = opLijst(n), h = inHuis(n);
        const onder = b.length ? `Staat op je lijst${b.some((x) => x.hoeveelheid) ? ': ' + b.map((x) => boodschapTekst(x) || '?').join(' + ') : ''}` : h.length ? `In huis: ${h.map(voorraadTekst).join(' + ')}` : 'Niet in huis';
        return `<li><button type="button" class="rij" data-kies="${i}"><span class="naam">${esc(n)}${merkTekst({ merk: merkVan(n) })}<small>${esc(onder)}</small></span><span class="rechts">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}</span></button></li>`;
      }).join('')}</ul>` : q ? `<div class="leeg">Nog niet gekend. Tik op Toevoegen om "${esc(zoek.trim())}" op je lijst te zetten.</div>` : '';
      $$('[data-kies]', el).forEach((k) => (k.onclick = () => {
        const n = namen[+k.dataset.kies];
        $('#bt-naam', el).value = n; zoek = n; $('#bt-merk', el).value = merkVan(n);
        eenheidZetten(bekendeEenheid(n));
        meerVullen(n);
        lijstTekenen();
        if (fijneMuis()) { $('#bt-hv', el).focus(); $('#bt-hv', el).select(); }
      }));
    };
    if (!alGetekend('boodschap-toevoegen')) {
      el.innerHTML = `${paneelKop('Boodschap toevoegen', 'Kies uit je catalogus of typ zelf iets.')}
        <label class="veld"><span>Wat</span><input id="bt-naam" placeholder="bv. Appelsienen" autocomplete="off" autocapitalize="sentences"></label>
        <label class="veld"><span>Merk (mag leeg)</span><input id="bt-merk" placeholder="bv. Bonduelle" autocomplete="off" autocapitalize="words"></label>
        <div style="margin-bottom:1rem"><span class="veld-titel">Hoeveel</span><div class="aantal-kies">
          <button type="button" class="rond" id="bt-min" aria-label="Minder">−</button>
          <input id="bt-hv" inputmode="decimal" value="1" aria-label="Hoeveelheid">
          <button type="button" class="rond" id="bt-plus" aria-label="Meer">+</button>
          <select id="bt-eenheid" aria-label="Eenheid">${opties(EENHEDEN, 'stuks')}</select></div></div>
        ${inhoudVeldenHtml('bt', 'stuks', null, 'g')}
        <details class="meer" id="bt-meer" style="margin-bottom:1rem"><summary>Categorie, plaats, houdbaarheid en prijzen</summary><div id="bt-meer-inhoud"></div></details>
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
        const c = (k && catalogusVan(k)) || {};
        type = c.datumtype === 'TGT' ? 'TGT' : 'THT';
        const pe = productEenheid();
        if (k) { // de inhoud van het gekende product voorstellen; je mag ze voor deze boodschap aanpassen
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
      naam.oninput = () => { zoek = naam.value; const e = catalogusnamen().find((n) => zelfde(n, naam.value)); if (e) { eenheidZetten(bekendeEenheid(e)); if (!$('#bt-merk', el).value) $('#bt-merk', el).value = merkVan(e); } meerVullen(naam.value.trim()); lijstTekenen(); };
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
        try {
          if (Object.keys(extra).length) {
            const bestaat = catalogusVan(n);
            // een gekend product houdt zijn eenheid
            const { eenheid: pe, ...rest } = extra;
            await api(bestaat ? 'PUT' : 'POST', 'catalogus', bestaat ? { naam: n, oudeNaam: bestaat.naam, ...rest } : { naam: n, eenheid: pe, ...rest });
          }
          await api('POST', 'boodschappen', { naam: n, hoeveelheid: h, eenheid: h === null ? '' : eenheid.value, ...inh, merk: $('#bt-merk', el).value.trim(), product_id: S.producten.find((p) => zelfde(p.naam, n))?.id || null });
        } catch { return; /* melding al getoond */ }
        toast(lijstMelding(n, inh));
        naam.value = ''; $('#bt-merk', el).value = ''; zoek = ''; hv.value = '1'; eenheid.value = vorige = 'stuks'; minKnopZetten();
        $('#bt-inhoud', el).value = ''; inhoudVeldenZetten(el, 'bt', 'stuks');
        meerVoor = null; meerAangeraakt = false; meerVullen(''); meer.open = false;
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
      <div style="margin-bottom:1rem"><span class="veld-titel">Hoeveel</span><div class="aantal-kies">
        <button type="button" class="rond" id="bb-min" aria-label="Minder">−</button>
        <input id="bb-hv" inputmode="decimal" value="${esc(fmt(b.hoeveelheid))}" placeholder="–" aria-label="Hoeveelheid">
        <button type="button" class="rond" id="bb-plus" aria-label="Meer">+</button>
        <select id="bb-eenheid" aria-label="Eenheid">${opties(EENHEDEN, b.eenheid || 'stuks')}</select></div></div>
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
    minKnopZetten();
    const bewaren = async () => {
      const n = naam.value.trim();
      if (!n) { toast('Vul een naam in.'); naam.focus(); return false; }
      const h = num(hv.value);
      const inh = inhoudVeldenLezen(el, 'bb', eenheid.value);
      if (!inh) return false;
      await api('PUT', `boodschappen/${b.id}`, { naam: n.charAt(0).toUpperCase() + n.slice(1), hoeveelheid: h, eenheid: h === null ? '' : eenheid.value, ...inh, merk: $('#bb-merk', el).value.trim() });
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
      else productFormulier(null, { naam: nb.naam, eenheid: nb.eenheid || 'stuks', hoeveelheid: nb.hoeveelheid ?? 1, inhoud: nb.inhoud || null, inhoud_eenheid: nb.inhoud_eenheid || '' });
    };
    $('#bb-weg', el).onclick = async () => { await api('DELETE', `boodschappen/${b.id}`); paneelSluiten(); toast(`${b.naam} van je lijst gehaald`); };
  });
}

/** Afgevinkte boodschappen (van de gekozen winkel, of alle) in de voorraad zetten. */
function winkelenAfronden(ids) {
  const items = S.boodschappen.filter((b) => b.afgevinkt && (!ids || ids.includes(b.id))).map((b) => {
    const bekend = S.producten.find((p) => zelfde(p.naam, b.naam));
    return { b, eenheid: b.eenheid || bekend?.eenheid || 'stuks', locatie: bekend?.locatie || locaties()[0] || '', type: bekend?.datumtype || 'THT', datum: '' };
  });
  paneelOpenen((el) => {
    if (alGetekend('af')) return; // niet opnieuw tekenen terwijl je typt
    el.innerHTML = `${paneelKop('In je voorraad zetten', 'Vul een datum in als je die bij de hand hebt.')}
      <div id="af-lijst">${items.map((x, n) => `
        <div class="afronden-rij" data-n="${n}">
          <div class="titel"><span>${esc(x.b.naam)}${boodschapInhoudVan(x.b) ? ` <small class="stil">à ${esc(hoeveelTekst(boodschapInhoudVan(x.b).per, boodschapInhoudVan(x.b).eenheid))}</small>` : ''}</span></div>
          <div class="velden">
            <input class="af-hv" inputmode="decimal" value="${esc(fmt(x.b.hoeveelheid ?? 1))}" aria-label="Hoeveelheid">
            <select class="af-eenheid" aria-label="Eenheid">${opties(EENHEDEN, x.eenheid)}</select>
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
    $('#af-ok', el).onclick = async () => {
      const regels = $$('.afronden-rij', el).map((r) => ({
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
function geleerdeKoppelingen() {
  const k = {};
  for (const r of S.recepten) for (const i of r.ingredienten) if (i.voorraadnaam) k[sleutelwoorden(i.naam).join(' ')] = i.voorraadnaam;
  return k;
}
const altijdInHuis = (i) => ALTIJD_IN_HUIS.has((i.naam || '').trim().toLowerCase()) && !i.voorraadnaam;

function beschikbaarheid(ingr, factor = 1, namen = productnamen(), geleerd = geleerdeKoppelingen()) {
  if (altijdInHuis(ingr)) return { st: 'ok', partijen: [], altijd: true };
  const naam = ingr.voorraadnaam || zoekVoorraadnaam(ingr.naam, namen, geleerd);
  if (!naam) return { st: 'ontbreekt', naam: '' };
  const partijen = S.producten.filter((p) => zelfde(p.naam, naam) && p.hoeveelheid > 0 && houdbaarheid(p).niveau !== 4)
    .sort((a, b) => (a.vervaldatum || '9999').localeCompare(b.vervaldatum || '9999'));
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
        const naam = i.voorraadnaam || zoekVoorraadnaam(i.naam, namen, geleerd);
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
    ${filterRij}${catRij}
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
    el.innerHTML = `${paneelKop(esc(r.titel))}
      <div class="meta">
        <span class="personen"><button id="p-min" aria-label="Minder personen">−</button><span>${personen} ${personen === 1 ? 'persoon' : 'personen'}</span><button id="p-plus" aria-label="Meer personen">+</button></span>
        ${r.bereidingstijd ? `<span>${esc(r.bereidingstijd)}</span>` : ''}
        <button class="fav-knop${r.favoriet ? ' aan' : ''}" id="r-fav" aria-pressed="${r.favoriet ? 'true' : 'false'}">${r.favoriet ? ICOON.sterVol : ICOON.ster}<span>${r.favoriet ? 'Favoriet' : 'Favoriet maken'}</span></button>
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
      const koppel = i.voorraadnaam ?? zoekVoorraadnaam(i.naam, namen, geleerd);
      const eenheden = RECEPT_EENHEDEN.includes(i.eenheid || '') ? RECEPT_EENHEDEN : [...RECEPT_EENHEDEN, i.eenheid];
      const div = document.createElement('div');
      div.className = 'ingr-bewerk';
      div.innerHTML = `<div class="boven">
          <input class="i-hv" inputmode="decimal" value="${esc(fmt(i.hoeveelheid))}" aria-label="Hoeveelheid">
          <select class="i-eenheid" aria-label="Eenheid">${eenheden.map((e) => `<option value="${esc(e)}"${e === (i.eenheid || '') ? ' selected' : ''}>${esc(e || '–')}</option>`).join('')}</select>
          <input class="i-naam" value="${esc(i.naam)}" aria-label="Ingrediënt">
          <button type="button" class="weg" aria-label="Weghalen">×</button></div>
        <div class="koppel"><span>In voorraad als</span><select class="i-koppel">${opties(namen, koppel, '— niet gekoppeld —')}</select></div>`;
      const sel = $('.i-koppel', div);
      if (i.voorraadnaam) sel.dataset.handmatig = '1';
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
          naam: $('.i-naam', d).value.trim(), voorraadnaam: $('.i-koppel', d).value })).filter((i) => i.naam),
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
      const vn = i.voorraadnaam || zoekVoorraadnaam(i.naam, namen, geleerd) || '';
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
document.addEventListener('syncstatus', (e) => {
  if (ui.view === 'instellingen') syncBlokTekenen();
  if (e.detail?.melding) toast(e.detail.melding, null, null, true);
});
// gegevens kwamen binnen van een ander toestel: scherm bijwerken (niet midden in het invullen van iets)
document.addEventListener('syncgewijzigd', () => { if (!bezig()) api('GET', 'alles', undefined, true).catch(() => {}); });

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

/** De handleiding in een breed paneel (Instellingen → Handleiding lezen). */
function handleidingPaneel() {
  paneelOpenen((el) => {
    el.innerHTML = `${paneelKop('Handleiding')}<div class="handleiding">${HANDLEIDING}</div>
      <div class="paneel-voet"><button class="knop" data-handleiding-pdf>Pdf downloaden</button>
      <button class="knop" data-handleiding-afdrukken>Afdrukken</button><button class="knop" data-sluit>Sluiten</button></div>`;
    sluitKnoppen(el);
    handleidingKnoppen(el);
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
    const pdf = handleidingPdf(HANDLEIDING, { titel: 'Handleiding Voorraad', onderschrift: `Versie ${APP_VERSIE} · ${datum}` });
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
  // even wachten zodat de afdrukversie getekend is (nodig op iPhone)
  setTimeout(() => { try { window.print(); } catch { opruimen(); toast('Afdrukken lukte niet. Download de pdf en druk die af.'); } }, 50);
}

async function tekenInstellingen() {
  const inst = S.instellingen;
  const telling = (veld, naam) => veld === 'recept_soort' ? S.recepten.filter((r) => zelfde(r.soort, naam)).length
    : veld === 'recept_categorie' ? S.recepten.filter((r) => (r.categorieen || []).some((c) => zelfde(c, naam))).length
    : veld === 'winkel' ? (S.catalogus || []).filter((c) => (c.prijzen || []).some((p) => zelfde(p.winkel, naam))).length
    : veld === 'maaltijd' ? (S.planning || []).filter((m) => zelfde(m.maaltijd, naam)).length
    : S.producten.filter((p) => zelfde(p[veld], naam)).length;
  const isRecept = (veld) => veld.startsWith('recept_');
  const aantalTekst = (veld, n) => !n ? '' : veld === 'maaltijd' ? `${n} gepland` : isRecept(veld) ? `${n} ${n === 1 ? 'recept' : 'recepten'}` : `${n} ${n === 1 ? 'product' : 'producten'}`;
  const lijstBlok = (titel, sleutel, veld, voorbeeld) => `
    <details class="sectie uitklap" data-uitklap="${sleutel}"${ui.uitgeklapt.has(sleutel) ? ' open' : ''}>
      <summary><span>${titel}</span><span class="stil">${(inst[sleutel] || []).length}</span></summary>
      <p class="stil" style="font-size:.82rem;margin:.2rem 0 .3rem">Tik op een naam om die te wijzigen. Wijzigingen worden meteen bewaard.</p>
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
        <input placeholder="${voorbeeld}" autocapitalize="sentences">
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
    <section class="sectie"><div class="sectie-titel">Waarschuwen, zoveel dagen vooraf</div>
      ${dagen('Te gebruiken tot', 'tgt_dagen')}${dagen('Ten minste houdbaar tot', 'tht_dagen')}</section>
    ${lijstBlok('Plaatsen', 'locaties', 'locatie', 'Nieuwe plaats, bv. Kelder')}
    ${lijstBlok('Productcategorieën', 'categorieen', 'categorie', 'Nieuwe categorie, bv. Babyvoeding')}
    ${lijstBlok('Winkels', 'winkels', 'winkel', 'Nieuwe winkel, bv. Colruyt')}
    ${lijstBlok('Soorten gerechten', 'recept_soorten', 'recept_soort', 'Nieuwe soort, bv. Tapas')}
    ${lijstBlok('Receptcategorieën', 'recept_categorieen', 'recept_categorie', 'Nieuwe categorie, bv. Italiaans')}
    ${lijstBlok('Maaltijden in de planner', 'maaltijden', 'maaltijd', 'Nieuwe maaltijd, bv. Vieruurtje')}
    <section class="sectie"><div class="sectie-titel">Overzicht</div><div id="stats" class="stil">Laden…</div></section>
    <section class="sectie" id="sync-blok"></section>
    <section class="sectie" id="auto-blok"></section>
    <section class="sectie" id="bestand-blok"></section>
    <section class="sectie"><div class="sectie-titel">Back-up</div>
      <p class="stil" style="margin-bottom:.8rem;font-size:.92rem">Met een back-up zet je alles over naar een ander toestel. <span id="backup-laatst"></span></p>
      <div class="knoppenrij"><a class="knop" href="api/export.json" download>Back-up downloaden</a><a class="knop" href="api/export.csv" download>Voorraad als CSV</a>
      <button class="knop" id="i-terug">Back-up terugzetten</button></div></section>
    <section class="sectie"><div class="sectie-titel">Over</div>
      <p class="stil" style="font-size:.92rem;line-height:1.6">Alles draait op dit toestel, ook zonder internet. Er wordt niets naar buiten gestuurd (behalve als je synchronisatie aanzet: dan gaan je gegevens versleuteld naar je eigen server) en er wordt geen AI gebruikt; ingelezen pdf's verlaten het toestel niet.<br>Versie ${APP_VERSIE}${status.opslag === false ? '<br><b style="color:var(--rood, #b42318)">Let op: deze browser bewaart je gegevens niet. Open de app niet in een privévenster.</b>' : ''}</p></section>`;
  installBlokTekenen();
  bestandBlokTekenen();
  syncBlokTekenen();
  $m('#i-handleiding').onclick = handleidingPaneel;
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
  const VELD = { locaties: 'locatie', categorieen: 'categorie', winkels: 'winkel', recept_soorten: 'recept_soort', recept_categorieen: 'recept_categorie', maaltijden: 'maaltijd' };
  const SOORT = { locaties: 'plaats', categorieen: 'categorie', winkels: 'winkel', recept_soorten: 'soort', recept_categorieen: 'categorie', maaltijden: 'maaltijd' };
  const HOOFD = { plaats: 'Plaats', categorie: 'Categorie', soort: 'Soort', winkel: 'Winkel', maaltijd: 'Maaltijd' };
  $$m('[data-nieuw]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const k = f.dataset.nieuw, naam = $m('input', f).value.trim();
    if (!naam) return;
    if ((inst[k] || []).some((x) => zelfde(x, naam))) return toast(`"${naam}" bestaat al.`);
    await bewaar({ [k]: [...(inst[k] || []), naam] });
    toast(`${naam} toegevoegd`);
  }));
  $$m('.beheer').forEach((rij) => {
    const k = rij.dataset.lijst, i = +rij.dataset.i, lijst = [...(inst[k] || [])], naam = lijst[i];
    $m('[data-hernoem]', rij).onclick = async () => {
      const nieuw = ((await vraag(`Nieuwe naam voor ${SOORT[k]} "${naam}":`, { invoer: true, standaard: naam, ja: 'Bewaren' })) || '').trim();
      if (!nieuw || nieuw === naam) return;
      if (lijst.some((x, j) => j !== i && zelfde(x, nieuw))) return toast(`"${nieuw}" bestaat al.`);
      lijst[i] = nieuw;
      await bewaar({ [k]: lijst });
      await api('POST', 'hernoemen', { veld: VELD[k], van: naam, naar: nieuw });
    };
    $m('[data-omhoog]', rij).onclick = () => { [lijst[i - 1], lijst[i]] = [lijst[i], lijst[i - 1]]; bewaar({ [k]: lijst }); };
    $m('[data-wis]', rij).onclick = async () => {
      const aantal = telling(VELD[k], naam);
      const wie = isRecept(VELD[k]) ? (aantal === 1 ? 'recept heeft' : 'recepten hebben') : (aantal === 1 ? 'product heeft' : 'producten hebben');
      const tekst = !aantal ? `${HOOFD[SOORT[k]]} "${naam}" verwijderen?`
        : VELD[k] === 'maaltijd' ? `Maaltijd "${naam}" verwijderen? ${aantal} ${aantal === 1 ? 'geplande maaltijd blijft' : 'geplande maaltijden blijven'} in de planner staan, zonder dit moment.`
        : VELD[k] === 'winkel' ? `Winkel "${naam}" verwijderen? De prijzen bij deze winkel (${aantal} ${aantal === 1 ? 'product' : 'producten'}) worden gewist.`
        : `${HOOFD[SOORT[k]]} "${naam}" verwijderen? ${aantal} ${wie} daarna ${VELD[k] === 'recept_categorie' ? 'deze categorie niet' : `geen ${SOORT[k]}`} meer.`;
      if (!(await vraag(tekst, { ja: 'Verwijderen', gevaar: true }))) return;
      lijst.splice(i, 1);
      await bewaar({ [k]: lijst });
      if (aantal) await api('POST', 'hernoemen', { veld: VELD[k], van: naam, naar: '' });
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
  bestandHerinneren();
}
const bezig = () => !$('#paneel').hidden || $('#vraag').open || document.activeElement?.matches('input, textarea');
document.addEventListener('installeerbaar', () => { installBlokTekenen(); installTipTekenen(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !bezig()) api('GET', 'alles', undefined, true).catch(() => {}); });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== ui.view) naar(v); });
start();

// Voorraad — interface. Praat met api/..., afgehandeld in lokaal.js (opslag op dit toestel).
import { receptOntleden, ingredientOntleden, zoekVoorraadnaam, sleutelwoorden, omrekenen } from './parser.js';
import { barcodeUitBestand, controleOk } from './barcode.js';
import { tekstOpmaken, pdfStukjes } from './layout.js';

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

let S = { producten: [], boodschappen: [], recepten: [], instellingen: {} };
let status = {};
const ui = { view: 'voorraad', plaats: '', zoek: '', receptZoek: '', uitgeklapt: new Set() };

const ICOON = {
  kast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M9 7.5h1M9 16.5h1"/></svg>',
  mand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-1.6 10.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8z"/><path d="M8 9l4-6 4 6"/></svg>',
  boek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20v-3"/></svg>',
  tandwiel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/></svg>',
  zoek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  sluit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const fmt = (n) => (n === null || n === undefined ? '' : (Math.round(n * 100) / 100).toLocaleString('nl-BE', { maximumFractionDigits: 2 }));
const eenheidKort = (e) => (e === 'stuks' ? '' : e || '');
const hoeveelTekst = (n, e) => (n === null || n === undefined ? '' : `${fmt(n)}${eenheidKort(e) ? ' ' + eenheidKort(e) : ''}`);
const zelfde = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

function vandaag(plus = 0) {
  const d = new Date();
  d.setDate(d.getDate() + plus);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
function paneelOpenen(teken, { breed = false } = {}) {
  const p = $('#paneel');
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
const locaties = () => uniek([...(S.instellingen.locaties || []), ...S.producten.map((p) => p.locatie)]);
const categorieen = () => uniek([...(S.instellingen.categorieen || []), ...S.producten.map((p) => p.categorie)]);
const opties = (lijst, gekozen, leeg) => {
  const items = [...lijst];
  if (gekozen && !items.some((x) => zelfde(x, gekozen))) items.push(gekozen);
  return (leeg !== undefined ? `<option value="">${esc(leeg)}</option>` : '')
    + items.map((x) => `<option value="${esc(x)}"${zelfde(x, gekozen) ? ' selected' : ''}>${esc(x || '–')}</option>`).join('');
};
const codeNormaal = (c) => { c = (c || '').replace(/\D/g, ''); return c.length === 12 ? '0' + c : c; };

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
const VIEWS = ['voorraad', 'boodschappen', 'recepten', 'instellingen'];
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
  ({ voorraad: tekenVoorraad, boodschappen: tekenBoodschappen, recepten: tekenRecepten, instellingen: tekenInstellingen })[ui.view]();
  if (herstel) { const el = document.getElementById(herstel.id); if (el) { el.focus(); try { el.setSelectionRange(herstel.pos, herstel.pos); } catch { /* */ } } }
}
const instellingenKnop = `<button class="icoon alleen-mobiel" data-actie="naar" data-view="instellingen" aria-label="Instellingen">${ICOON.tandwiel}</button>`;

// ---------------------------------------------------------------------------
// VOORRAAD
// ---------------------------------------------------------------------------
function tekenVoorraad() {
  const zoek = ui.zoek.trim().toLowerCase();
  const passend = S.producten.filter((p) => (!zoek || `${p.naam} ${p.locatie} ${p.categorie} ${p.notitie} ${p.barcode || ''}`.toLowerCase().includes(zoek)));
  const metH = passend.map((p) => ({ p, h: houdbaarheid(p) }));
  const opTeGebruiken = metH.filter((x) => x.h.niveau > 0)
    .sort((a, b) => (b.h.niveau >= 3) - (a.h.niveau >= 3) || a.p.vervaldatum.localeCompare(b.p.vervaldatum));
  const rest = metH.filter((x) => x.h.niveau === 0 && x.p.hoeveelheid > 0);
  const op = metH.filter((x) => !(x.p.hoeveelheid > 0));

  const rij = ({ p, h }, metStatus) => `<li><button class="rij${p.hoeveelheid > 0 ? '' : ' op'}" data-product="${p.id}">
      ${metStatus ? `<span class="stip ${h.kleur}"></span>` : ''}
      <span class="naam">${esc(p.naam)}${metStatus ? `<small>${esc(h.uitleg)}</small>` : ''}</span>
      <span class="rechts${metStatus ? ' ' + h.kleur : ''}">${metStatus ? esc(h.kort) : p.hoeveelheid > 0 ? esc(hoeveelTekst(p.hoeveelheid, p.eenheid)) : 'op'}</span>
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
      const items = rest.sort((a, b) => a.p.naam.localeCompare(b.p.naam, 'nl'));
      lijst += `<section class="sectie"><div class="sectie-titel">Gevonden</div><ul class="lijst">${items.map((x) => rij(x, false)).join('')}</ul></section>`;
    }
    if (!zoek && !opTeGebruiken.length) {
      lijst += `<div class="leeg"><b>Niets dat binnenkort op moet</b>Zoek een product om het te bekijken of aan te passen.</div>`;
    }
    if (op.length) lijst += `<section class="sectie"><div class="sectie-titel">Op</div><ul class="lijst">${op.map((x) => rij(x, false)).join('')}</ul></section>`;
  }

  $('#inhoud').innerHTML = `
    <header class="kop"><h1>Voorraad</h1>
      <div class="kop-acties">
        <button class="icoon" id="scan" aria-label="Barcode scannen" title="Barcode scannen">${ICOON.scan}</button>
        ${instellingenKnop}
        <button class="knop primair" id="nieuw">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}<span>Toevoegen</span></button>
      </div></header>
    ${S.producten.length ? `
    <div class="zoek">${ICOON.zoek}<input type="search" id="zoek-voorraad" placeholder="Zoeken" value="${esc(ui.zoek)}" autocomplete="off"></div>` : ''}
    ${lijst}`;
  $('#nieuw').onclick = () => productFormulier(null);
  $('#scan').onclick = () => scanStarten('voorraad');
  const z = $('#zoek-voorraad');
  if (z) z.oninput = () => { ui.zoek = z.value; tekenVoorraad(); };
  $$('[data-product]').forEach((b) => (b.onclick = () => productPaneel(+b.dataset.product)));
}

// Productpaneel: hoeveelheid, houdbaarheid en acties
function productPaneel(id) {
  paneelOpenen((el) => {
    const p = S.producten.find((x) => x.id === id);
    if (!p) return paneelSluiten();
    const telbaar = TELBAAR.has(p.eenheid);
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
      ${paneelKop(esc(p.naam), esc([p.locatie, p.categorie].filter(Boolean).join(' · ')))}
      <div class="hoeveelheid">
        ${telbaar ? `<button class="rond" id="min" aria-label="Eén minder" ${p.hoeveelheid >= 1 ? '' : 'disabled'}>−</button>` : ''}
        <div class="getal">${esc(fmt(p.hoeveelheid))}<span>${esc(p.eenheid === 'stuks' ? (p.hoeveelheid === 1 ? 'stuk' : 'stuks') : p.eenheid)}</span></div>
        ${telbaar ? '<button class="rond" id="plus" aria-label="Eén meer">+</button>' : ''}
      </div>
      ${delen.length ? `<div class="gebruik"><span class="stil" style="align-self:center;margin-right:.2rem">Gebruikt:</span>${delen.map(([w, t]) => `<button class="chip" data-deel="${w ?? ''}">${t}</button>`).join('')}<button class="chip" id="ander">Andere hoeveelheid</button></div>` : ''}
      ${datum}
      <ul class="acties">
        <li><button id="erbij">Nieuwe verpakking toevoegen</button></li>
        <li><button id="lijst">Op boodschappenlijst</button></li>
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
      datumtype: p.datumtype, barcode: p.barcode || '', hoeveelheid: telbaar ? 1 : p.hoeveelheid || 1 }));
    knop('lijst', async () => { await api('POST', 'boodschappen', { naam: p.naam, eenheid: p.eenheid, product_id: p.id }); toast(`${p.naam} staat op de boodschappenlijst`); });
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

// Product toevoegen of bewerken: alleen het nodige, de rest onder "Meer"
function productFormulier(bestaand, sjabloon = {}) {
  const nieuw = !bestaand;
  const p = bestaand ? { ...bestaand } : {
    naam: '', hoeveelheid: 1, eenheid: 'stuks', locatie: ui.plaats || locaties()[0] || '', categorie: '',
    aankoopdatum: vandaag(), vervaldatum: '', datumtype: 'THT', minimum: 0, notitie: '', barcode: '', ...sjabloon,
  };
  paneelOpenen((el) => {
    if (el.dataset.formulier) return; // niet opnieuw tekenen terwijl je typt
    el.dataset.formulier = '1';
    el.innerHTML = `
      ${paneelKop(nieuw ? 'Toevoegen' : 'Bewerken')}
      <form id="pf" autocomplete="off">
        ${nieuw ? `<button type="button" class="knop breed" id="pf-scan" style="margin-bottom:1.1rem">${ICOON.scan.replace('<svg', '<svg width="20" height="20"')} Barcode scannen</button>` : ''}
        <label class="veld"><span>Naam</span><input id="pf-naam" value="${esc(p.naam)}" required autocomplete="off" autocapitalize="sentences"></label>
        <div class="rij2">
          <label class="veld"><span>Hoeveelheid</span><input id="pf-hv" inputmode="decimal" value="${esc(fmt(p.hoeveelheid))}" required></label>
          <label class="veld"><span>Eenheid</span><select id="pf-eenheid">${opties(EENHEDEN, p.eenheid)}</select></label>
        </div>
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
          <label class="veld"><span>Minimumvoorraad (eronder komt het op je boodschappenlijst)</span><input id="pf-min" inputmode="decimal" value="${p.minimum ? esc(fmt(p.minimum)) : ''}" placeholder="Geen"></label>
          <label class="veld"><span>Barcode</span><input id="pf-code" inputmode="numeric" value="${esc(p.barcode || '')}" placeholder="Geen"></label>
          <label class="veld"><span>Gekocht op</span><input type="date" id="pf-aankoop" value="${esc(p.aankoopdatum || '')}"></label>
          <label class="veld"><span>Notitie</span><input id="pf-notitie" value="${esc(p.notitie || '')}"></label>
        </details>
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
    $$('#pf-type button', el).forEach((b) => (b.onclick = () => { type = b.dataset.w; typeTekenen(); }));
    $$('#pf-plaats .chip', el).forEach((b) => (b.onclick = () => {
      plaats = b.dataset.w;
      $$('#pf-plaats .chip', el).forEach((c) => c.classList.toggle('aan', c === b));
    }));
    $$('#pf-snel .chip', el).forEach((b) => (b.onclick = () => { $('#pf-datum', el).value = b.dataset.d ? vandaag(+b.dataset.d) : ''; }));
    const invullen = (info) => {
      if (info.naam) $('#pf-naam', el).value = info.naam;
      if (info.hoeveelheid) $('#pf-hv', el).value = fmt(info.hoeveelheid);
      if (info.eenheid) $('#pf-eenheid', el).innerHTML = opties(EENHEDEN, info.eenheid);
      if (info.categorie) $('#pf-cat', el).innerHTML = opties(categorieen(), info.categorie, 'Geen');
      if (info.merk && !$('#pf-notitie', el).value) $('#pf-notitie', el).value = info.merk;
      if (info.locatie) { plaats = info.locatie; $$('#pf-plaats .chip', el).forEach((c) => c.classList.toggle('aan', zelfde(c.dataset.w, plaats))); }
      if (info.datumtype) { type = info.datumtype === 'TGT' ? 'TGT' : 'THT'; typeTekenen(); }
      if (info.code) $('#pf-code', el).value = info.code;
    };
    // bekende naam: gegevens van dat product overnemen
    const bekendeNaam = () => {
      if (!nieuw) return;
      const b = S.producten.find((x) => zelfde(x.naam, $('#pf-naam', el).value));
      if (b) invullen({ eenheid: b.eenheid, categorie: b.categorie, locatie: b.locatie, datumtype: b.datumtype });
    };
    $('#pf-naam', el).onchange = bekendeNaam;
    suggesties($('#pf-naam', el), productnamen, bekendeNaam);
    const scan = $('#pf-scan', el);
    if (scan) scan.onclick = () => scanStarten('formulier', invullen);
    $('#pf', el).onsubmit = async (e) => {
      e.preventDefault();
      const hv = num($('#pf-hv', el).value);
      if (hv === null || hv < 0) return toast('Vul een geldige hoeveelheid in.');
      const data = {
        naam: $('#pf-naam', el).value.trim(), hoeveelheid: hv, eenheid: $('#pf-eenheid', el).value, locatie: plaats || '',
        vervaldatum: $('#pf-datum', el).value, datumtype: type, categorie: $('#pf-cat', el).value.trim(),
        minimum: num($('#pf-min', el).value) || 0, barcode: $('#pf-code', el).value.replace(/\D/g, ''),
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
// BARCODES
// ---------------------------------------------------------------------------
let scanDoel = null;
function scanStarten(doel, invullen) {
  scanDoel = { doel, invullen };
  $('#bestand-scan').click();
}
$('#bestand-scan').onchange = async (e) => {
  const bestand = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!bestand || !scanDoel) return;
  const { doel, invullen } = scanDoel;
  toast('Barcode lezen…', null, null, true);
  let code = null;
  try { code = await barcodeUitBestand(bestand); } catch (f) { console.error(f); }
  toastWeg();
  if (!code) {
    const ingetypt = await vraag('Geen barcode herkend. Maak een scherpere foto van dichtbij, of typ de cijfers onder de streepjes:', { invoer: true, numeriek: true, ja: 'Opzoeken' });
    if (ingetypt === null) return;
    code = codeNormaal(ingetypt);
    if (![8, 13].includes(code.length) || !controleOk(code)) return toast('Dat lijkt geen geldige barcode.');
  }
  code = codeNormaal(code);

  if (doel === 'voorraad') {
    const al = S.producten.filter((p) => codeNormaal(p.barcode) === code)
      .sort((a, b) => (b.hoeveelheid > 0) - (a.hoeveelheid > 0) || (a.vervaldatum || '9').localeCompare(b.vervaldatum || '9'));
    if (al.length) return productPaneel(al[0].id);
  }
  const info = await barcodeInfo(code);
  const gegevens = info && info.gevonden ? { ...info, code } : { code };
  if (doel === 'boodschappen') {
    const bekend = S.producten.find((p) => codeNormaal(p.barcode) === code);
    const naam = bekend?.naam || (info && info.gevonden ? info.naam : null);
    if (!naam) return toast('Onbekende barcode. Typ de naam zelf.');
    await api('POST', 'boodschappen', { naam, product_id: bekend?.id || null });
    return toast(`${naam} staat op je lijst`);
  }
  const melding = info && !info.gevonden ? 'Product niet gevonden. Vul het zelf in; de app onthoudt het voor de volgende keer.'
    : info && info.bron === 'off' ? 'Gevonden in Open Food Facts. Kijk het even na.' : '';
  if (doel === 'formulier' && invullen) { invullen(gegevens); if (melding) toast(melding); return; }
  productFormulier(null, {
    barcode: code, naam: gegevens.naam || '', categorie: gegevens.categorie || '', eenheid: gegevens.eenheid || 'stuks',
    hoeveelheid: gegevens.hoeveelheid || 1, datumtype: gegevens.datumtype || 'THT', notitie: gegevens.merk || '',
    ...(gegevens.locatie ? { locatie: gegevens.locatie } : {}), melding,
  });
};
async function barcodeInfo(code) {
  try { return await api('GET', 'barcode/' + code, undefined, true); } catch (f) { toast(f.message); return null; }
}

// ---------------------------------------------------------------------------
// BOODSCHAPPEN
// ---------------------------------------------------------------------------
function tekenBoodschappen() {
  const open = S.boodschappen.filter((b) => !b.afgevinkt);
  const af = S.boodschappen.filter((b) => b.afgevinkt);
  const rij = (b) => `<li><label class="rij vink">
      <input type="checkbox" data-vink="${b.id}" ${b.afgevinkt ? 'checked' : ''}><span class="vakje"></span>
      <span class="naam">${esc(b.naam)}${b.bron === 'minimum' && !b.afgevinkt ? '<small>Onder je minimumvoorraad</small>' : ''}</span>
      <span class="rechts" data-hv="${b.id}">${esc(hoeveelTekst(b.hoeveelheid, b.eenheid))}</span>
      <button class="weg" data-weg="${b.id}" aria-label="Verwijderen">×</button></label></li>`;
  $('#inhoud').innerHTML = `
    <header class="kop"><h1>Boodschappen</h1>
      <div class="kop-acties"><button class="icoon" id="scan-b" aria-label="Barcode scannen" title="Barcode scannen">${ICOON.scan}</button>${instellingenKnop}</div></header>
    <form class="toevoegen" id="b-form" autocomplete="off">
      <div style="flex:1;min-width:0"><input id="b-invoer" placeholder="Toevoegen, bv. 2 l melk" autocomplete="off" autocapitalize="sentences"></div>
      <button class="knop primair" aria-label="Toevoegen">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}</button>
    </form>
    ${!S.boodschappen.length ? `<div class="leeg"><b>Je lijst is leeg</b>Wat onder je minimumvoorraad zakt, komt hier vanzelf bij.</div>` : ''}
    ${open.length ? `<ul class="lijst">${open.map(rij).join('')}</ul>` : ''}
    ${af.length ? `<section class="sectie"><div class="sectie-titel"><span>In je mandje</span></div><ul class="lijst">${af.map(rij).join('')}</ul>
      <div style="margin-top:1rem"><button class="knop primair breed" id="klaar">Klaar met winkelen</button></div></section>` : ''}`;
  $('#b-form').onsubmit = async (e) => {
    e.preventDefault();
    const tekst = $('#b-invoer').value.trim();
    if (!tekst) return;
    const i = ingredientOntleden(tekst);
    const bekend = S.producten.find((p) => zelfde(p.naam, i.naam));
    const eenheid = i.hoeveelheid === null ? '' : i.eenheid === 'stuks' && bekend ? bekend.eenheid : i.eenheid;
    $('#b-invoer').value = '';
    await api('POST', 'boodschappen', { naam: i.naam ? i.naam.charAt(0).toUpperCase() + i.naam.slice(1) : tekst, hoeveelheid: i.hoeveelheid, eenheid, product_id: bekend?.id || null });
    if (fijneMuis()) $('#b-invoer')?.focus();
  };
  $('#scan-b').onclick = () => scanStarten('boodschappen');
  suggesties($('#b-invoer'), productnamen);
  $$('[data-vink]').forEach((c) => (c.onchange = () => api('PUT', `boodschappen/${c.dataset.vink}`, { afgevinkt: c.checked })));
  $$('[data-weg]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); api('DELETE', `boodschappen/${b.dataset.weg}`); }));
  $$('[data-hv]').forEach((s) => (s.onclick = async (e) => {
    e.preventDefault();
    const b = S.boodschappen.find((x) => x.id === +s.dataset.hv);
    const w = await vraag(`Hoeveel ${b.naam}${b.eenheid && b.eenheid !== 'stuks' ? ' (' + b.eenheid + ')' : ''}?`, { invoer: true, numeriek: true, standaard: fmt(b.hoeveelheid), ja: 'Bewaren' });
    if (w !== null) api('PUT', `boodschappen/${b.id}`, { hoeveelheid: num(w) });
  }));
  const klaar = $('#klaar');
  if (klaar) klaar.onclick = winkelenAfronden;
}

function winkelenAfronden() {
  const items = S.boodschappen.filter((b) => b.afgevinkt).map((b) => {
    const bekend = S.producten.find((p) => zelfde(p.naam, b.naam));
    return { b, eenheid: b.eenheid || bekend?.eenheid || 'stuks', locatie: bekend?.locatie || locaties()[0] || '', type: bekend?.datumtype || 'THT', datum: '' };
  });
  paneelOpenen((el) => {
    if (el.dataset.af) return;
    el.dataset.af = '1';
    el.innerHTML = `${paneelKop('In je voorraad zetten', 'Vul een datum in als je die bij de hand hebt.')}
      <div id="af-lijst">${items.map((x, n) => `
        <div class="afronden-rij" data-n="${n}">
          <div class="titel"><span>${esc(x.b.naam)}</span></div>
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
    $('#af-alleen', el).onclick = async () => { await api('POST', 'boodschappen/afgevinkte-wissen', {}); paneelSluiten(); };
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
  const eenheid = partijen[0].eenheid;
  const totaal = partijen.reduce((s, p) => s + (omrekenen(p.hoeveelheid, p.eenheid, eenheid) ?? 0), 0);
  const nodigRecept = ingr.hoeveelheid !== null && ingr.hoeveelheid !== undefined ? ingr.hoeveelheid * factor : null;
  const nodig = omrekenen(nodigRecept, ingr.eenheid || 'stuks', eenheid);
  return { st: nodig !== null && totaal + 1e-9 < nodig ? 'weinig' : 'ok', naam, partijen, eenheid, totaal, nodig, nodigRecept };
}
function dekking(r, namen, geleerd) {
  const telt = r.ingredienten.filter((i) => !altijdInHuis(i));
  return { ok: telt.filter((i) => beschikbaarheid(i, 1, namen, geleerd).st === 'ok').length, totaal: telt.length };
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
  const lijst = S.recepten.filter((r) => !zoek || r.titel.toLowerCase().includes(zoek) || r.ingredienten.some((i) => i.naam.toLowerCase().includes(zoek)));
  const rij = (r, onder) => {
    const d = dekking(r, namen, geleerd);
    return `<li><button class="rij" data-recept="${r.id}"><span class="naam">${esc(r.titel)}<small>${esc(onder)}</small></span>
      <span class="rechts">${d.ok}/${d.totaal}</span></button></li>`;
  };
  $('#inhoud').innerHTML = `
    <header class="kop"><h1>Recepten</h1>
      <div class="kop-acties">${instellingenKnop}<button class="knop primair" id="r-nieuw">${ICOON.plus.replace('<svg', '<svg width="18" height="18"')}<span>Recept</span></button></div></header>
    ${S.recepten.length ? `<div class="zoek">${ICOON.zoek}<input type="search" id="zoek-recept" placeholder="Zoek op recept of ingrediënt" value="${esc(ui.receptZoek)}" autocomplete="off"></div>` : ''}
    ${sugg.length && !zoek ? `<section class="sectie"><div class="sectie-titel">Gebruikt wat op moet</div><ul class="lijst">
      ${sugg.map(({ r, gebruikt }) => `<li><button class="rij" data-recept="${r.id}"><span class="stip ${gebruikt.some((p) => p.datumtype === 'TGT') ? 'rood' : 'oranje'}"></span>
        <span class="naam">${esc(r.titel)}<small>${esc(gebruikt.map((p) => p.naam.toLowerCase()).join(', '))}</small></span></button></li>`).join('')}</ul></section>` : ''}
    ${!S.recepten.length ? `<div class="leeg"><b>Nog geen recepten</b>Importeer een pdf of foto, of typ er zelf een.</div>` : ''}
    ${lijst.length ? `<section class="sectie"><div class="sectie-titel"><span>${zoek ? 'Gevonden' : 'Alle recepten'}</span><span>in huis</span></div><ul class="lijst">
      ${lijst.map((r) => rij(r, [r.personen && `${r.personen} personen`, r.bereidingstijd].filter(Boolean).join(' · '))).join('')}</ul></section>`
    : S.recepten.length ? '<div class="leeg">Niets gevonden.</div>' : ''}`;
  $('#r-nieuw').onclick = receptToevoegenKeuze;
  const z = $('#zoek-recept');
  if (z) z.oninput = () => { ui.receptZoek = z.value; tekenRecepten(); };
  $$('[data-recept]').forEach((b) => (b.onclick = () => receptPaneel(+b.dataset.recept)));
}

function receptToevoegenKeuze() {
  paneelOpenen((el) => {
    el.innerHTML = `${paneelKop('Recept toevoegen')}
      <ul class="acties">
        <li><button id="k-bestand">Pdf of afbeelding kiezen<br><small class="stil">De tekst wordt op dit toestel gelezen; het bestand wordt niet bewaard.</small></button></li>
        <li><button id="k-camera">Foto maken van een recept</button></li>
        <li><button id="k-typen">Zelf typen</button></li>
      </ul>`;
    sluitKnoppen(el);
    $('#k-bestand', el).onclick = () => { paneelSluiten(); $('#bestand-recept').click(); };
    $('#k-camera', el).onclick = () => { paneelSluiten(); $('#bestand-camera').click(); };
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
    el.innerHTML = `${paneelKop(esc(r.titel))}
      <div class="meta">
        <span class="personen"><button id="p-min" aria-label="Minder personen">−</button><span>${personen} ${personen === 1 ? 'persoon' : 'personen'}</span><button id="p-plus" aria-label="Meer personen">+</button></span>
        ${r.bereidingstijd ? `<span>${esc(r.bereidingstijd)}</span>` : ''}
      </div>
      <ul class="ingr">${regels.map(({ i, b }) => {
        const st = b.altijd ? '' : b.st === 'ontbreekt' ? 'niet in huis' : b.st === 'weinig' ? `te weinig (${hoeveelTekst(b.totaal, b.eenheid)})` : '';
        return `<li class="${b.st === 'ontbreekt' ? 'ontbreekt' : ''}"><span class="hv">${esc(i.hoeveelheid !== null ? hoeveelTekst(i.hoeveelheid * factor, i.eenheid) : '')}</span>
          <span class="nm">${esc(i.naam)}</span><span class="st${b.st === 'weinig' ? ' oranje' : ''}">${esc(st)}</span></li>`;
      }).join('')}</ul>
      <div class="knoppenrij">
        <button class="knop primair" id="gekookt">Gekookt</button>
        ${ontbreekt.length ? `<button class="knop" id="naar-lijst">${ontbreekt.length} op boodschappenlijst</button>` : '<span class="stil" style="align-self:center">Alles in huis</span>'}
      </div>
      ${stappen.length ? `<h3>Bereiding</h3><ol class="stappen">${stappen.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${r.notities ? `<h3>Notities</h3><p style="white-space:pre-wrap">${esc(r.notities)}</p>` : ''}
      <ul class="acties" style="margin-top:1.4rem"><li><button id="r-bewerk">Bewerken</button></li><li><button id="r-weg" class="gevaar">Verwijderen</button></li></ul>`;
    sluitKnoppen(el);
    $('#p-min', el).onclick = () => receptPaneel(id, Math.max(1, personen - 1));
    $('#p-plus', el).onclick = () => receptPaneel(id, personen + 1);
    $('#gekookt', el).onclick = () => kokenPaneel(r, regels);
    $('#r-bewerk', el).onclick = () => receptBewerken(r);
    $('#r-weg', el).onclick = async () => {
      if (!(await vraag(`Recept "${r.titel}" verwijderen?`, { ja: 'Verwijderen', gevaar: true }))) return;
      paneelSluiten();
      await api('DELETE', `recepten/${r.id}`);
      toast('Recept verwijderd');
    };
    const nl = $('#naar-lijst', el);
    if (nl) nl.onclick = async () => {
      const items = ontbreekt.map(({ i, b }) => (b.st === 'weinig' && b.nodig !== null
        ? { naam: b.naam, hoeveelheid: Math.ceil((b.nodig - b.totaal) * 100) / 100, eenheid: b.eenheid, bron: 'recept' }
        : { naam: b.naam || i.naam, hoeveelheid: i.hoeveelheid !== null ? Math.round(i.hoeveelheid * factor * 100) / 100 : null, eenheid: i.eenheid, bron: 'recept' }));
      await api('POST', 'boodschappen', { items });
      toast(`${items.length} op je boodschappenlijst gezet`);
    };
  }, { breed: true });
}

function kokenPaneel(r, regels) {
  const bruikbaar = regels.filter(({ b }) => b.partijen && b.partijen.length);
  if (!bruikbaar.length) return toast('Geen van de ingrediënten staat in je voorraad.');
  paneelOpenen((el) => {
    if (el.dataset.koken) return;
    el.dataset.koken = '1';
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
          const inEenheid = omrekenen(rest, b.eenheid, p.eenheid);
          if (inEenheid === null) continue;
          const neem = Math.min(inEenheid, p.hoeveelheid);
          aftrekken.push({ product_id: p.id, hoeveelheid: Math.round(neem * 1000) / 1000 });
          rest -= omrekenen(neem, p.eenheid, b.eenheid);
        }
      }
      await api('POST', `recepten/${r.id}/koken`, { aftrekken });
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
    if (el.dataset.recept) return;
    el.dataset.recept = '1';
    el.innerHTML = `${paneelKop(gecontroleerd ? 'Klopt dit?' : bewerkId ? 'Recept bewerken' : 'Nieuw recept')}
      ${gecontroleerd ? '<p class="melding">Kijk na wat er herkend is en verbeter waar nodig. Het bestand zelf is niet bewaard.</p>' : ''}
      <form id="rf" autocomplete="off">
        <label class="veld"><span>Titel</span><input id="rf-titel" required></label>
        <div class="rij2">
          <label class="veld"><span>Personen</span><input id="rf-pers" type="number" min="1" max="99"></label>
          <label class="veld"><span>Bereidingstijd</span><input id="rf-tijd" placeholder="bv. 30 minuten"></label>
        </div>
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
    const vullen = (x) => {
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
      $('#rf-opnieuw', el).onclick = () => vullen(receptOntleden($('#rf-ruw', el).value));
    }
    $('#rf', el).onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        titel: $('#rf-titel', el).value.trim(), personen: parseInt($('#rf-pers', el).value, 10) || 4, bereidingstijd: $('#rf-tijd', el).value.trim(),
        stappen: $('#rf-stappen', el).value, notities: $('#rf-notities', el).value,
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

// Importeren uit pdf of afbeelding (lokaal; het bestand wordt niet bewaard)
async function tekstHerkennen(blob) {
  const a = await fetch('api/ocr', { method: 'POST', body: blob, headers: { 'Content-Type': 'image/png' } });
  const data = await a.json().catch(() => ({}));
  if (!a.ok) throw new Error(data.fout || 'Tekstherkenning mislukt.');
  if (data.woorden && data.woorden.length) return tekstOpmaken(data.woorden);
  return data.tekst || '';
}
const naarPng = (c) => new Promise((ok, nee) => c.toBlob((b) => (b ? ok(b) : nee(new Error('Afbeelding kon niet verwerkt worden.'))), 'image/png'));
// Zwart-wit maken met een plaatselijke drempel: schaduwen en ongelijk licht op een foto
// worden zo wit, letters blijven zwart. (Tesseract gebruikt anders één drempel voor de hele foto.)
function zwartWit(ctx, w, h) {
  const beeld = ctx.getImageData(0, 0, w, h), px = beeld.data;
  const grijs = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) grijs[i] = px[i * 4];
  const som = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rij = 0;
    for (let x = 0; x < w; x++) { rij += grijs[y * w + x]; som[(y + 1) * (w + 1) + x + 1] = som[y * (w + 1) + x + 1] + rij; }
  }
  const r = Math.max(8, Math.round(Math.max(w, h) / 40));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const gem = (som[y1 * (w + 1) + x1] - som[y0 * (w + 1) + x1] - som[y1 * (w + 1) + x0] + som[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      const v = grijs[y * w + x] < gem * 0.88 ? 0 : 255;
      const i = (y * w + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
    }
  }
  ctx.putImageData(beeld, 0, 0);
}
async function afbeeldingLezen(bestand) {
  let beeld;
  try { beeld = await createImageBitmap(bestand, { imageOrientation: 'from-image' }); } catch {
    const url = URL.createObjectURL(bestand);
    try { beeld = new Image(); beeld.src = url; await beeld.decode(); } catch { throw new Error('Deze afbeelding kan niet geopend worden. Probeer jpg of png.'); } finally { URL.revokeObjectURL(url); }
  }
  const lang = Math.max(beeld.width, beeld.height);
  const schaal = lang < 1800 ? 1800 / lang : lang > 3200 ? 3200 / lang : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(beeld.width * schaal); c.height = Math.round(beeld.height * schaal);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.filter = 'grayscale(1)';
  ctx.drawImage(beeld, 0, 0, c.width, c.height);
  ctx.filter = 'none';
  if (beeld.close) beeld.close();
  zwartWit(ctx, c.width, c.height);
  toast('Tekst herkennen… de eerste keer duurt dit wat langer', null, null, true);
  const png = await naarPng(c);
  c.width = c.height = 0;
  return tekstHerkennen(png);
}
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
      let tekst = tekstOpmaken(pdfStukjes((await pagina.getTextContent()).items, hoogte));
      if (tekst.replace(/\s/g, '').length < 30) {
        toast(`Pagina ${n} van ${aantal}: tekst herkennen…`, null, null, true);
        const vp = pagina.getViewport({ scale: Math.min(4, 2200 / pagina.getViewport({ scale: 1 }).width) });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await pagina.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise;
        tekst = await tekstHerkennen(await naarPng(c));
        c.width = c.height = 0;
      }
      delen.push(tekst);
      pagina.cleanup();
    }
  } finally { await taak.destroy(); }
  return delen.join('\n');
}
async function receptImporteren(invoer) {
  const bestand = invoer.files && invoer.files[0];
  invoer.value = '';
  if (!bestand) return;
  try {
    const isPdf = bestand.type === 'application/pdf' || /\.pdf$/i.test(bestand.name);
    const isBeeld = bestand.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/i.test(bestand.name);
    if (!isPdf && !isBeeld) throw new Error('Kies een pdf of een afbeelding.');
    toast(isPdf ? 'Pdf openen…' : 'Afbeelding voorbereiden…', null, null, true);
    const tekst = isPdf ? await pdfLezen(bestand) : await afbeeldingLezen(bestand);
    if (!tekst.trim()) throw new Error('Geen tekst gevonden. Probeer een scherpere foto, recht van boven en goed belicht.');
    toastWeg();
    receptBewerken(receptOntleden(tekst), tekst);
  } catch (f) { toast(f.message || 'Importeren mislukt.'); console.error(f); }
}
$('#bestand-recept').onchange = (e) => receptImporteren(e.target);
$('#bestand-camera').onchange = (e) => receptImporteren(e.target);

// ---------------------------------------------------------------------------
// INSTELLINGEN
// ---------------------------------------------------------------------------
async function tekenInstellingen() {
  const inst = S.instellingen;
  const telling = (veld, naam) => S.producten.filter((p) => zelfde(p[veld], naam)).length;
  const lijstBlok = (titel, sleutel, veld, voorbeeld) => `
    <details class="sectie uitklap" data-uitklap="${sleutel}"${ui.uitgeklapt.has(sleutel) ? ' open' : ''}>
      <summary><span>${titel}</span><span class="stil">${(inst[sleutel] || []).length}</span></summary>
      <p class="stil" style="font-size:.82rem;margin:.2rem 0 .3rem">Tik op een naam om die te wijzigen. Wijzigingen worden meteen bewaard.</p>
      <ul class="lijst">${(inst[sleutel] || []).map((n, i) => {
        const aantal = telling(veld, n);
        return `<li class="rij beheer" data-lijst="${sleutel}" data-i="${i}">
          <button class="naam beheer-naam" data-hernoem>${esc(n)}</button>
          <span class="rechts">${aantal ? `${aantal} ${aantal === 1 ? 'product' : 'producten'}` : ''}</span>
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
    <section class="sectie"><div class="sectie-titel">Waarschuwen, zoveel dagen vooraf</div>
      ${dagen('Te gebruiken tot', 'tgt_dagen')}${dagen('Ten minste houdbaar tot', 'tht_dagen')}</section>
    ${lijstBlok('Plaatsen', 'locaties', 'locatie', 'Nieuwe plaats, bv. Kelder')}
    ${lijstBlok('Categorieën', 'categorieen', 'categorie', 'Nieuwe categorie, bv. Babyvoeding')}
    <section class="sectie"><div class="sectie-titel">Overzicht</div><div id="stats" class="stil">Laden…</div></section>
    <section class="sectie"><div class="sectie-titel">Back-up</div>
      <p class="stil" style="margin-bottom:.8rem;font-size:.92rem">Je gegevens staan alleen op dit toestel, in de app. Maak af en toe een back-up; daarmee zet je alles ook over naar een ander toestel.</p>
      <div class="knoppenrij"><a class="knop" href="api/export.json" download>Back-up downloaden</a><a class="knop" href="api/export.csv" download>Voorraad als CSV</a>
      <button class="knop" id="i-terug">Back-up terugzetten</button></div></section>
    <section class="sectie"><div class="sectie-titel">Over</div>
      <p class="stil" style="font-size:.92rem;line-height:1.6">Alles draait op dit toestel, ook zonder internet. Alleen om een onbekende barcode op te zoeken, wordt de barcode naar Open Food Facts gestuurd (open productdatabank, geen AI). Tekstherkenning (Tesseract, geen AI) wordt bij het eerste gebruik eenmalig gedownload; je foto's en pdf's verlaten het toestel niet.<br>
      ${navigator.onLine ? '' : 'Offline: barcodes opzoeken kan nu niet.'}${status.opslag === false ? '<br><b style="color:var(--rood, #b42318)">Let op: deze browser bewaart je gegevens niet. Open de app niet in een privévenster.</b>' : ''}</p>
      <div class="knoppenrij" id="installeer-rij" ${window.voorraadKanInstalleren?.() ? '' : 'hidden'} style="margin-top:.8rem"><button class="knop primair" id="i-installeer">App installeren</button></div></section>`;
  $('#i-installeer') && ($('#i-installeer').onclick = async () => { await window.voorraadInstalleren?.(); $('#installeer-rij').hidden = true; });

  // open/dicht onthouden, ook als het scherm opnieuw getekend wordt
  $$('[data-uitklap]').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) ui.uitgeklapt.add(d.dataset.uitklap); else ui.uitgeklapt.delete(d.dataset.uitklap);
  }));
  const bewaar = (wijziging) => api('PUT', 'instellingen', wijziging);
  $$('[data-dagen]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.dagen;
    bewaar({ [k]: Math.min(60, Math.max(0, (inst[k] ?? 0) + +b.dataset.stap)) });
  }));
  const VELD = { locaties: 'locatie', categorieen: 'categorie' };
  const SOORT = { locaties: 'plaats', categorieen: 'categorie' };
  $$('[data-nieuw]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const k = f.dataset.nieuw, naam = $('input', f).value.trim();
    if (!naam) return;
    if ((inst[k] || []).some((x) => zelfde(x, naam))) return toast(`"${naam}" bestaat al.`);
    await bewaar({ [k]: [...(inst[k] || []), naam] });
    toast(`${naam} toegevoegd`);
  }));
  $$('.beheer').forEach((rij) => {
    const k = rij.dataset.lijst, i = +rij.dataset.i, lijst = [...(inst[k] || [])], naam = lijst[i];
    $('[data-hernoem]', rij).onclick = async () => {
      const nieuw = ((await vraag(`Nieuwe naam voor ${SOORT[k]} "${naam}":`, { invoer: true, standaard: naam, ja: 'Bewaren' })) || '').trim();
      if (!nieuw || nieuw === naam) return;
      if (lijst.some((x, j) => j !== i && zelfde(x, nieuw))) return toast(`"${nieuw}" bestaat al.`);
      lijst[i] = nieuw;
      await bewaar({ [k]: lijst });
      await api('POST', 'hernoemen', { veld: VELD[k], van: naam, naar: nieuw });
    };
    $('[data-omhoog]', rij).onclick = () => { [lijst[i - 1], lijst[i]] = [lijst[i], lijst[i - 1]]; bewaar({ [k]: lijst }); };
    $('[data-wis]', rij).onclick = async () => {
      const aantal = telling(VELD[k], naam);
      const tekst = aantal ? `${SOORT[k] === 'plaats' ? 'Plaats' : 'Categorie'} "${naam}" verwijderen? ${aantal} ${aantal === 1 ? 'product heeft' : 'producten hebben'} daarna geen ${SOORT[k]} meer.`
        : `${SOORT[k] === 'plaats' ? 'Plaats' : 'Categorie'} "${naam}" verwijderen?`;
      if (!(await vraag(tekst, { ja: 'Verwijderen', gevaar: true }))) return;
      lijst.splice(i, 1);
      await bewaar({ [k]: lijst });
      if (aantal) await api('POST', 'hernoemen', { veld: VELD[k], van: naam, naar: '' });
    };
  });
  $('#i-terug').onclick = () => $('#bestand-backup').click();
  try {
    const st = await api('GET', 'statistieken', undefined, true);
    if (ui.view !== 'instellingen' || !$('#stats')) return;
    const blok = (titel, items) => items.length ? `<h3 style="margin-top:.6rem">${titel}</h3>${items.slice(0, 5).map((x) => `<div class="stat"><span>${esc(x.naam)}</span><span class="stil">${x.aantal}×</span></div>`).join('')}` : '';
    const html = blok('Vaakst weggegooid', st.weggegooid) + blok('Vaakst gekocht', st.gekocht) + blok('Vaakst gekookt', st.gekookt);
    $('#stats').innerHTML = html || 'Nog niets om te tonen.';
    $('#stats').classList.toggle('stil', !html);
  } catch { /* stil */ }
}
$('#bestand-backup').onchange = async (e) => {
  const bestand = e.target.files[0];
  e.target.value = '';
  if (!bestand) return;
  let data;
  try { data = JSON.parse(await bestand.text()); } catch { return toast('Dit is geen geldig back-upbestand.'); }
  if (!(await vraag('Al je huidige gegevens worden vervangen door deze back-up. Doorgaan?', { ja: 'Terugzetten', gevaar: true }))) return;
  await api('POST', 'import', data);
  toast('Back-up teruggezet');
};

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function start() {
  ui.view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'voorraad';
  try { status = await fetch('api/status').then((r) => r.json()); } catch { /* */ }
  try { await api('GET', 'alles'); } catch {
    $('#inhoud').innerHTML = '<div class="leeg"><b>De app kon niet starten</b>Herlaad de pagina. Gebruik geen privévenster.</div>';
  }
}
const bezig = () => !$('#paneel').hidden || $('#vraag').open || document.activeElement?.matches('input, textarea');
document.addEventListener('installeerbaar', () => { const r = $('#installeer-rij'); if (r) r.hidden = false; });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !bezig()) api('GET', 'alles', undefined, true).catch(() => {}); });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== ui.view) naar(v); });
start();

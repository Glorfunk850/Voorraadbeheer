// Op een smal telefoonscherm mag niets buiten het scherm (of buiten het paneel) uitsteken.
// Opent elk scherm en elk paneel dat een knop opent (één niveau diep, zoals test/knoppen.test.cjs) op 320 px breed,
// met extra lange teksten (bv. "1 blik à 140 g uitlekgewicht", lange namen, merken en plaatsen),
// en meet of er een element rechts (of links) buiten valt. Nieuwe schermen en panelen worden vanzelf mee getest.
//
// Uitvoeren:  node test/breedte.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const nepBestand = require('./nep-bestand.cjs');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
const KNOP = 'button:not([disabled]), a.knop, label.vink';
const VIEWS = ['voorraad', 'boodschappen', 'catalogus', 'recepten', 'planner', 'instellingen'];
const BREEDTE = 320; // smalste gangbare telefoon

function server() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      if (req.url.split('?')[0] === '/sync-adres.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end("window.VOORRAAD_SYNC_ADRES = '';"); }
      let pad = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!pad.startsWith(ROOT) || !fs.existsSync(pad) || fs.statSync(pad).isDirectory()) pad = path.join(ROOT, 'index.html');
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(pad)] || 'application/octet-stream' });
      res.end(fs.readFileSync(pad));
    });
    s.listen(0, () => ok(s));
  });
}

async function voorbeelddata(page) {
  await page.evaluate(async () => {
    const api = (m, p, b) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    await api('PUT', 'instellingen', { winkels: ['Colruyt', 'Albert Heijn Hypermarkt'] });
    // twee partijen van hetzelfde product met uitlekgewicht: lange tekst rechts in "Kies welke je wilt bekijken"
    for (const [n, v] of [[1, 1400], [3, 2]]) await api('POST', 'producten', { naam: 'Maïs', hoeveelheid: n, eenheid: 'blik', inhoud: 140, inhoud_eenheid: 'g',
      uitlekgewicht: true, merk: 'Jumbo', verpakking: 'klein', locatie: 'Dressoir deur 1', categorie: 'Conserven', vervaldatum: dag(v), datumtype: 'THT' });
    const may = await api('POST', 'producten', { naam: 'Mayonaise met eieren en citroen', hoeveelheid: 2, eenheid: 'bokaal', inhoud: 470, inhoud_eenheid: 'g',
      merk: 'Vandemoortele', verpakking: 'groot', locatie: 'Koelkast bovenste plank', categorie: 'Sauzen', minimum: 3 });
    await api('POST', `producten/${may.nieuw_id}/openen`, { hoeveelheid: 1 });
    await api('POST', 'producten', { naam: 'Kikkererwten gekookt in blik', hoeveelheid: 12, eenheid: 'blik', inhoud: 400, inhoud_eenheid: 'g', uitlekgewicht: true,
      merk: 'Boni Selection', locatie: 'Kelder rek links', categorie: 'Conserven', vervaldatum: dag(-3), datumtype: 'THT' });
    await api('POST', 'producten', { naam: 'Melk', hoeveelheid: 2, eenheid: 'l', vervaldatum: dag(1), datumtype: 'TGT' });
    await api('POST', 'producten', { naam: 'Eieren', hoeveelheid: 0, eenheid: 'stuks' });
    const rp = await api('POST', 'recepten', { titel: 'Pasta met kikkererwten, maïs en een romige mayonaisesaus', personen: 4, stappen: 'Koken\nMengen', notities: 'Lekker',
      ingredienten: [{ naam: 'kikkererwten gekookt in blik', hoeveelheid: 800, eenheid: 'g' }, { naam: 'maïs', hoeveelheid: 280, eenheid: 'g' }, { naam: 'mayonaise met eieren en citroen', hoeveelheid: 2, eenheid: 'el' }] });
    await api('POST', 'planning', { datum: dag(0), maaltijd: 'Avondeten', recept_id: rp.nieuw_id, personen: 4 });
    await api('POST', 'prijzen', { naam: 'Maïs', eenheid: 'blik', prijzen: [{ winkel: 'Albert Heijn Hypermarkt', prijs: 1.29, per: 'blik' }] });
    await api('POST', 'boodschappen', { naam: 'Maïs', hoeveelheid: 3, eenheid: 'blik', inhoud: 140, inhoud_eenheid: 'g', uitlekgewicht: true, merk: 'Jumbo' });
    await api('POST', 'boodschappen', { naam: 'Mayonaise met eieren en citroen', hoeveelheid: 1, eenheid: 'bokaal', inhoud: 470, inhoud_eenheid: 'g', merk: 'Vandemoortele', verpakking: 'groot' });
  });
}

// Elementen die buiten het scherm uitsteken (binnen een bewust horizontaal scrollende strook mag het wel)
const uitsteken = (page) => page.evaluate(() => {
  const W = document.documentElement.clientWidth;
  const fout = [];
  const beschrijf = (e) => `<${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList.length ? '.' + [...e.classList].join('.') : ''}> "${(e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)}"`;
  if (document.documentElement.scrollWidth > W + 1) fout.push(`pagina is ${document.documentElement.scrollWidth} px breed i.p.v. ${W}`);
  const paneel = document.querySelector('#paneel');
  if (paneel && paneel.getClientRects().length && paneel.scrollWidth > paneel.clientWidth + 1) fout.push(`paneel schuift zijwaarts (${paneel.scrollWidth} px inhoud in ${paneel.clientWidth} px)`);
  const vrij = (e) => { // ligt in een eigen horizontaal scrollende strook (bv. chips, tabel in de handleiding)?
    for (let a = e.parentElement; a && a !== document.body && a !== paneel; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
    return false;
  };
  const buiten = [];
  for (const e of document.querySelectorAll('#inhoud *, #paneel *, #vraag[open] *')) {
    if (buiten.length > 6) break;
    const r = e.getBoundingClientRect();
    if (!r.width || !e.getClientRects().length) continue;
    // alleen het buitenste element melden
    if ((r.right > W + 1 || r.left < -1) && !vrij(e) && !buiten.some((b) => b.el.contains(e)))
      buiten.push({ el: e, tekst: `${beschrijf(e)} loopt van ${Math.round(r.left)} tot ${Math.round(r.right)} px (scherm ${W} px)` });
  }
  return fout.concat(buiten.map((b) => b.tekst));
});

async function zichtbaar(page, binnen) {
  const uit = [];
  for (const k of await page.$$(`${binnen} :is(${KNOP})`)) if (await k.isVisible()) uit.push(k);
  return uit;
}

async function main() {
  const srv = await server();
  const basis = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const fouten = [];
  let gemeten = 0;

  async function vers(view) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: BREEDTE, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await ctx.addInitScript(nepBestand);
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage();
    await page.goto(basis + '#' + view);
    await page.waitForFunction(() => document.querySelector('#inhoud').children.length > 0);
    await voorbeelddata(page);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#inhoud').children.length > 0);
    await page.evaluate(() => document.querySelectorAll('#inhoud details').forEach((d) => { d.open = true; })); // categorieën open
    await page.waitForTimeout(150);
    return page;
  }
  async function meet(page, naam) {
    gemeten++;
    await page.waitForTimeout(300); // animatie van het paneel afwachten
    for (const f of await uitsteken(page)) fouten.push(`${naam}: ${f}`);
  }
  async function klik(page, binnen, n) {
    const k = (await zichtbaar(page, binnen))[n];
    if (!k) return null;
    const naam = await k.evaluate((e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40));
    try { await k.click({ timeout: 3000 }); return naam; } catch { return null; }
  }

  // alle schermen tegelijk (elk in hun eigen, losse browsercontext): veel sneller
  await Promise.all(VIEWS.map(async (view) => {
    let page = await vers(view);
    await meet(page, `[${view}]`);
    const hoofd = (await zichtbaar(page, '#inhoud')).length;
    await page.context().close();
    for (let i = 0; i < hoofd; i++) {
      page = await vers(view);
      const k = await klik(page, '#inhoud', i);
      if (k === null) { await page.context().close(); continue; }
      const naam = `[${view}] "${k}"`;
      await meet(page, naam);
      const paneel = (await page.isVisible('#paneel')) ? (await zichtbaar(page, '#paneel')).length : 0;
      await page.context().close();
      for (let j = 0; j < paneel; j++) {
        page = await vers(view);
        await klik(page, '#inhoud', i);
        await page.waitForTimeout(300);
        const p = await klik(page, '#paneel', j);
        if (p !== null) await meet(page, `${naam} → "${p}"`);
        await page.context().close();
      }
    }
  }));
  await browser.close();
  srv.close();

  console.log(`${gemeten} schermen en panelen gemeten op ${BREEDTE} px breed.`);
  if (fouten.length) {
    const uniek = [...new Set(fouten)].sort();
    console.log(`\n${uniek.length} probleem/problemen:\n- ` + uniek.join('\n- '));
    process.exit(1);
  }
  console.log('Niets steekt buiten het scherm uit.');
}
main().catch((e) => { console.error(e); process.exit(1); });

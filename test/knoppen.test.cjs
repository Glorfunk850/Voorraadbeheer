// Klikt automatisch op ELKE knop van elk scherm, en op elke knop in de panelen die daaruit openen.
// Een knop faalt als er een JavaScript-fout optreedt, of als er na de klik niets gebeurt
// (scherm onveranderd, geen paneel, geen vraag, geen bestandskiezer, geen download).
// Nieuwe knoppen worden vanzelf mee getest: er hoeft niets aan deze test toegevoegd te worden.
//
// Uitvoeren:  node test/knoppen.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
const KNOP = 'button:not([disabled]), a.knop, label.vink';
const VIEWS = ['voorraad', 'boodschappen', 'recepten', 'instellingen'];
// Knoppen die terecht niets zichtbaars doen in de testsituatie (bv. datum wissen terwijl er nog geen datum is)
const MAG_NIETS_DOEN = ['Geen datum'];

function server() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const pad = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!pad.startsWith(ROOT) || !fs.existsSync(pad) || fs.statSync(pad).isDirectory()) {
        const index = path.join(ROOT, 'index.html');
        if (req.url === '/' || req.url.startsWith('/#')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(index)); }
        res.writeHead(404); return res.end();
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(pad)] || 'application/octet-stream' });
      res.end(fs.readFileSync(pad));
    });
    s.listen(0, () => ok(s));
  });
}

async function voorbeelddata(page) {
  await page.evaluate(async () => {
    const api = (m, p, b) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await api('POST', 'producten', { naam: 'Melk', hoeveelheid: 2, eenheid: 'l', locatie: '', vervaldatum: morgen, datumtype: 'TGT' });
    await api('POST', 'producten', { naam: 'Rijst', hoeveelheid: 500, eenheid: 'g', locatie: '', vervaldatum: morgen, datumtype: 'THT' });
    await api('POST', 'producten', { naam: 'Eieren', hoeveelheid: 0, eenheid: 'stuks', locatie: '' });
    await api('POST', 'recepten', { titel: 'Rijstpap', personen: 2, stappen: 'Koken', notities: 'Lekker',
      ingredienten: [{ naam: 'melk', hoeveelheid: 1, eenheid: 'l' }, { naam: 'rijst', hoeveelheid: 100, eenheid: 'g' }, { naam: 'suiker', hoeveelheid: 50, eenheid: 'g' }] });
    await api('PUT', 'instellingen', { winkels: ['Colruyt', 'Aldi'] });
    await api('POST', 'prijzen', { naam: 'Melk', eenheid: 'l', prijzen: [{ winkel: 'Colruyt', prijs: 1.05, per: 'l' }, { winkel: 'Aldi', prijs: 1.15, per: 'l' }] });
    await api('POST', 'prijzen', { naam: 'Kaas', eenheid: 'stuks', prijzen: [{ winkel: 'Aldi', prijs: 3.2, per: 'stuks' }] });
    await api('POST', 'boodschappen', { naam: 'Melk', hoeveelheid: 2, eenheid: 'l' });
    await api('POST', 'boodschappen', { naam: 'Brood' });
    const d = await api('POST', 'boodschappen', { naam: 'Kaas', hoeveelheid: 1, eenheid: 'stuks' });
    const kaas = d.boodschappen.find((b) => b.naam === 'Kaas');
    await api('PUT', `boodschappen/${kaas.id}`, { afgevinkt: true });
  });
}

// Zichtbare knoppen, in vaste volgorde (dezelfde telling bij het opsommen en bij het klikken)
async function zichtbaar(page, binnen) {
  const uit = [];
  for (const k of await page.$$(`${binnen} :is(${KNOP})`)) if (await k.isVisible()) uit.push(k);
  return uit;
}
const zichtbareKnoppen = async (page, binnen) => Promise.all((await zichtbaar(page, binnen)).map((k) =>
  k.evaluate((e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50))));

async function main() {
  const srv = await server();
  const basis = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const fouten = [];
  let getest = 0;

  // Nieuwe, schone app met voorbeelddata op scherm `view`
  async function vers(view) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
    const page = await ctx.newPage();
    page.jsFouten = [];
    page.on('pageerror', (e) => page.jsFouten.push(e.message));
    await page.goto(basis + '#' + view);
    await page.waitForFunction(() => document.querySelector('#inhoud').children.length > 0);
    await voorbeelddata(page);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#inhoud').children.length > 0);
    await page.waitForTimeout(150);
    return page;
  }

  // Klik en kijk of er iets gebeurt
  async function klik(page, binnen, n, naam) {
    getest++;
    const gebeurd = [];
    page.on('filechooser', () => gebeurd.push('bestandskiezer'));
    page.on('download', () => gebeurd.push('download'));
    const knoppen = await zichtbaar(page, binnen);
    const knop = knoppen[n];
    if (!knop) { fouten.push(`${naam}: knop niet meer gevonden`); return; }
    // Al geselecteerde keuzeknop (bv. huidige plaats): opnieuw kiezen hoeft niets te veranderen
    const alGekozen = await knop.evaluate((e, uitz) => e.classList.contains('aan') || uitz.includes(e.textContent.trim()), MAG_NIETS_DOEN);
    // Verzendknop: lege tekstvelden van het formulier eerst invullen, anders houdt de browser het tegen
    await knop.evaluate((e) => {
      const f = e.form || e.closest('form');
      if (!f || (e.type && e.type !== 'submit')) return;
      for (const v of f.querySelectorAll('input:not([type]), input[type=text], input[type=search]'))
        if (!v.value && v.offsetParent !== null) v.value = v.inputMode === 'decimal' ? '1' : 'Testproduct';
    });
    const toestand = () => page.evaluate(() => document.body.innerHTML + location.hash + document.querySelector('#vraag').open
      + [...document.querySelectorAll('input, select, textarea')].map((v) => v.type === 'checkbox' ? v.checked : v.value).join('|'));
    const voor = await toestand();
    try { await knop.click({ timeout: 3000 }); } catch (e) { fouten.push(`${naam}: kon niet klikken (${e.message.split('\n')[0]})`); return; }
    await page.waitForTimeout(350);
    const na = await toestand();
    if (process.env.UITGEBREID) console.log('  ', naam);
    if (page.jsFouten.length) fouten.push(`${naam}: JavaScript-fout: ${page.jsFouten.join(' | ')}`);
    else if (voor === na && !gebeurd.length && !alGekozen) fouten.push(`${naam}: er gebeurt niets na klikken`);
  }

  for (const view of VIEWS) {
    let page = await vers(view);
    const hoofd = await zichtbareKnoppen(page, '#inhoud');
    await page.context().close();
    for (let i = 0; i < hoofd.length; i++) {
      const naam = `[${view}] "${hoofd[i]}"`;
      page = await vers(view);
      await klik(page, '#inhoud', i, naam);
      const paneelOpen = await page.isVisible('#paneel');
      const paneelKnoppen = paneelOpen ? await zichtbareKnoppen(page, '#paneel') : [];
      await page.context().close();
      // Knoppen in het paneel dat deze knop opende (één niveau diep)
      for (let j = 0; j < paneelKnoppen.length; j++) {
        page = await vers(view);
        await klik(page, '#inhoud', i, naam);
        await klik(page, '#paneel', j, `${naam} → "${paneelKnoppen[j]}"`);
        await page.context().close();
      }
    }
  }
  await browser.close();
  srv.close();

  console.log(`${getest} klikken getest.`);
  if (fouten.length) {
    console.log(`\n${fouten.length} probleem/problemen:\n- ` + fouten.join('\n- '));
    process.exit(1);
  }
  console.log('Alle knoppen werken.');
}
main().catch((e) => { console.error(e); process.exit(1); });

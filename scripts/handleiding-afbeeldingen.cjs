// Maakt de schermafbeeldingen voor de handleiding (map handleiding/) opnieuw, met voorbeeldgegevens.
// Gebruik dit als het uiterlijk van de app verandert:  node scripts/handleiding-afbeeldingen.cjs
// Vereist Playwright (npm install --no-save playwright). Schrijft JPEG-bestanden: die kan ook de pdf-versie
// van de handleiding (handleiding-pdf.js) rechtstreeks overnemen.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const UIT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'handleiding');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

function server() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const pad = path.join(ROOT, p);
      if (!pad.startsWith(ROOT) || !fs.existsSync(pad) || fs.statSync(pad).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(pad)] || 'application/octet-stream' });
      res.end(fs.readFileSync(pad));
    });
    s.listen(0, () => ok(s));
  });
}

const dag = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

async function main() {
  fs.mkdirSync(UIT, { recursive: true });
  const srv = await server();
  const basis = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch({ args: ['--lang=nl-BE'] });
  // telefoon, licht thema, scherp genoeg om te lezen
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 }, deviceScaleFactor: 2,
    colorScheme: 'light', locale: 'nl-BE', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('JS-fout:', e.message));
  const api = (m, p, b) => page.evaluate(([m, p, b]) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' },
    body: b === undefined ? undefined : JSON.stringify(b) }).then((r) => r.json()), [m, p, b]);

  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#inhoud h1');
  await page.evaluate(() => { localStorage.setItem('installtip-weg', '1'); localStorage.setItem('op-te-gebruiken-venster', 'uit'); });

  // voorbeeldgegevens
  await api('PUT', 'instellingen', { winkels: ['Colruyt', 'Aldi'], auto_backup: false });
  const P = (d) => api('POST', 'producten', { locatie: 'Voorraadkast', ...d });
  await P({ naam: 'Melk', hoeveelheid: 2, eenheid: 'l', locatie: 'Koelkast', categorie: 'Zuivel & eieren', vervaldatum: dag(1), datumtype: 'TGT' });
  await P({ naam: 'Yoghurt', hoeveelheid: 4, eenheid: 'stuks', merk: 'Danone', inhoud: 125, inhoud_eenheid: 'g', locatie: 'Koelkast', categorie: 'Zuivel & eieren', vervaldatum: dag(-1), datumtype: 'TGT' });
  await P({ naam: 'Kipfilet', hoeveelheid: 500, eenheid: 'g', locatie: 'Koelkast', categorie: 'Vlees & vis', vervaldatum: dag(2), datumtype: 'TGT' });
  await P({ naam: 'Spaghetti', hoeveelheid: 2, eenheid: 'pak', inhoud: 500, inhoud_eenheid: 'g', merk: 'Barilla', categorie: 'Pasta, rijst & granen', vervaldatum: dag(300), datumtype: 'THT' });
  await P({ naam: 'Tomatensaus', hoeveelheid: 1, eenheid: 'pot', inhoud: 400, inhoud_eenheid: 'g', vervaldatum: dag(4), datumtype: 'THT' });
  await P({ naam: 'Rijst', hoeveelheid: 3, eenheid: 'pot', categorie: 'Pasta, rijst & granen', minimum: 2 });
  await P({ naam: 'Eieren', hoeveelheid: 0, eenheid: 'stuks', locatie: 'Koelkast', categorie: 'Zuivel & eieren' });
  await P({ naam: 'Boter', hoeveelheid: 0, eenheid: 'stuks', locatie: 'Koelkast', categorie: 'Zuivel & eieren' });
  await api('POST', 'prijzen', { naam: 'Melk', eenheid: 'l', prijzen: [{ winkel: 'Colruyt', prijs: 1.05, per: 'l' }, { winkel: 'Aldi', prijs: 1.15, per: 'l' }] });
  await api('POST', 'prijzen', { naam: 'Eieren', eenheid: 'stuks', prijzen: [{ winkel: 'Colruyt', prijs: 0.52, per: 'stuks' }, { winkel: 'Aldi', prijs: 0.49, per: 'stuks' }] });
  await api('POST', 'boodschappen', { naam: 'Eieren', hoeveelheid: 6, eenheid: 'stuks' });
  await api('POST', 'boodschappen', { naam: 'Melk', hoeveelheid: 2, eenheid: 'l' });
  await api('POST', 'boodschappen', { naam: 'Appels', hoeveelheid: 1, eenheid: 'kg' });
  await api('POST', 'boodschappen', { naam: 'Boter', hoeveelheid: 1, eenheid: 'stuks' });
  const rp = await api('POST', 'recepten', { titel: 'Spaghetti bolognese', personen: 4, soort: 'Hoofdgerecht', categorieen: ['Pasta', 'Vlees'],
    stappen: 'Bak het gehakt bruin.\nVoeg de tomatensaus toe en laat 20 minuten sudderen.\nKook de spaghetti en serveer met de saus.',
    ingredienten: [{ naam: 'spaghetti', hoeveelheid: 400, eenheid: 'g' }, { naam: 'gehakt', hoeveelheid: 500, eenheid: 'g' },
      { naam: 'tomatensaus', hoeveelheid: 1, eenheid: 'pot' }, { naam: 'ui', hoeveelheid: 1, eenheid: 'stuks' }] });
  await api('POST', 'recepten', { titel: 'Pannenkoeken', personen: 4, soort: 'Dessert', categorieen: ['Vegetarisch', 'Snel'], stappen: 'Bakken.',
    ingredienten: [{ naam: 'melk', hoeveelheid: 0.5, eenheid: 'l' }, { naam: 'eieren', hoeveelheid: 2, eenheid: 'stuks' }, { naam: 'bloem', hoeveelheid: 250, eenheid: 'g' }] });
  await api('POST', 'recepten', { titel: 'Kip met rijst', personen: 2, soort: 'Hoofdgerecht', categorieen: ['Snel'], stappen: 'Koken.',
    ingredienten: [{ naam: 'kipfilet', hoeveelheid: 300, eenheid: 'g' }, { naam: 'rijst', hoeveelheid: 1, eenheid: 'pot' }] });
  await api('POST', 'planning', { datum: dag(0), maaltijd: 'Avondeten', recept_id: rp.nieuw_id, personen: 4 });
  await api('POST', 'planning', { datum: dag(1), maaltijd: 'Ontbijt', tekst: 'Boterhammen' });

  const herladen = async (hash, sel) => { await page.goto(basis + hash); await page.reload(); await page.waitForSelector(sel); await page.waitForTimeout(300); };
  const foto = async (naam, opties = {}) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(UIT, naam + '.jpg'), type: 'jpeg', quality: 72, ...opties });
    console.log('gemaakt:', naam);
  };
  const paneelFoto = async (naam) => {
    await page.waitForSelector('#paneel:not([hidden])'); await page.waitForTimeout(450);
    await foto(naam);
  };
  await require('./handleiding-stappen.cjs')({ page, herladen, foto, paneelFoto, api });
  await browser.close(); srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });

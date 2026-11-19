// Minimum voor een heel product (alle merken en inhouden samen) en boodschappen met "elk merk".
//
// Uitvoeren:  node test/minimum.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

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

const fouten = [];
const controle = (ok, tekst) => { console.log(ok ? 'OK  ' : 'FOUT', tekst); if (!ok) fouten.push(tekst); };

async function main() {
  const srv = await server();
  const basis = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const jsFouten = [];
  page.on('pageerror', (e) => jsFouten.push(e.message));
  const api = (m, p, b) => page.evaluate(([m, p, b]) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' },
    body: b === undefined ? undefined : JSON.stringify(b) }).then((r) => r.json()), [m, p, b]);
  await page.goto(basis + '#catalogus');
  await page.waitForSelector('#inhoud h1');

  // twee merken van hetzelfde product, met een andere inhoud
  await api('POST', 'catalogus', { naam: 'Doperwten en wortelen', eenheid: 'stuks', merk: 'Everyday', inhoud: 530, inhoud_eenheid: 'g' });
  await api('POST', 'catalogus', { naam: 'Doperwten en wortelen', eenheid: 'stuks', merk: 'Jumbo', inhoud: 450, inhoud_eenheid: 'g' });
  await api('POST', 'producten', { naam: 'Doperwten en wortelen', hoeveelheid: 1, eenheid: 'stuks', merk: 'Everyday', inhoud: 530, inhoud_eenheid: 'g' });
  await api('POST', 'producten', { naam: 'Doperwten en wortelen', hoeveelheid: 1, eenheid: 'stuks', merk: 'Jumbo', inhoud: 450, inhoud_eenheid: 'g' });
  await page.reload(); await page.waitForSelector('#inhoud h1');

  // minimum 3 voor alle merken samen, via het catalogusformulier
  await page.click('[data-cat="Doperwten en wortelen"][data-var="0"]');
  await page.click('#c-bewerk');
  await page.fill('#cf-min', '3');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  let d = await api('GET', 'alles');
  const c = d.catalogus.find((x) => x.naam === 'Doperwten en wortelen');
  controle(c.minimum === 3 && c.varianten.length === 2, 'minimum 3 bewaard voor het hele product');
  let b = d.boodschappen.filter((x) => x.naam === 'Doperwten en wortelen');
  controle(b.length === 1 && b[0].hoeveelheid === 1 && !b[0].merk && !b[0].inhoud && b[0].bron === 'minimum',
    `1 in huis van Everyday + 1 van Jumbo = 2: tekort van 1 op de lijst, zonder merk en inhoud (${JSON.stringify(b)})`);
  controle((await page.textContent('#paneel')).includes('alle merken samen: 2'), 'catalogus toont wat er van alle merken samen in huis is');

  // een blik opgebruikt: tekort wordt 2
  const jumbo = d.producten.find((p) => p.merk === 'Jumbo');
  await api('POST', `producten/${jumbo.id}/verbruik`, { hoeveelheid: 1 });
  d = await api('GET', 'alles');
  b = d.boodschappen.filter((x) => x.naam === 'Doperwten en wortelen');
  controle(b.length === 1 && b[0].hoeveelheid === 2, 'na verbruik: tekort van 2');

  // afvinken en in de winkel een ander merk kopen (Jumbo à 450 g): telt mee voor het minimum
  await api('PUT', `boodschappen/${b[0].id}`, { afgevinkt: 1 });
  await page.goto(basis + '#boodschappen'); await page.reload(); await page.waitForSelector('#inhoud h1');
  await page.click('#klaar');
  await page.waitForSelector('.af-variant');
  const opties = await page.$$eval('.af-variant option', (o) => o.map((x) => x.textContent));
  controle(opties.some((t) => t.includes('Jumbo')) && opties.some((t) => t.includes('Everyday')), `bij afronden kies je het merk (${opties.join(', ')})`);
  await page.selectOption('.af-variant', { label: opties.find((t) => t.includes('Jumbo')) });
  await page.click('#af-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const rijen = d.producten.filter((p) => p.naam === 'Doperwten en wortelen');
  const j = rijen.find((p) => p.merk === 'Jumbo'), e = rijen.find((p) => p.merk === 'Everyday');
  controle(j && j.hoeveelheid === 2 && j.inhoud === 450 && e && e.hoeveelheid === 1, `gekocht bij het merk Jumbo bijgeteld, Everyday ongemoeid (${rijen.map((p) => p.merk + ':' + p.hoeveelheid).join(', ')})`);
  controle(!d.boodschappen.some((x) => x.naam === 'Doperwten en wortelen'), '3 in huis: niets meer op de lijst');

  // boodschap toevoegen met "elk merk"
  await api('POST', `producten/${e.id}/verbruik`, { hoeveelheid: 1 });
  await api('DELETE', `boodschappen/${(await api('GET', 'alles')).boodschappen[0].id}`);
  await page.reload(); await page.waitForSelector('#inhoud h1');
  await page.click('#b-menu');
  await page.fill('#bt-zoek', 'doperwten');
  const keuzes = await page.$$eval('#bt-lijst [data-kies]', (k) => k.map((x) => x.textContent));
  controle(keuzes.length === 3 && keuzes[0].includes('elk merk'), `keuze "elk merk" bovenaan (${keuzes.join(' | ')})`);
  await page.click('#bt-lijst [data-kies="0"]');
  controle((await page.inputValue('#bt-merk')) === '' && (await page.inputValue('#bt-inhoud')) === '', 'elk merk: geen merk en geen inhoud ingevuld');
  await page.click('#bt-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  b = d.boodschappen.filter((x) => x.naam === 'Doperwten en wortelen');
  controle(b.length === 1 && !b[0].merk && !b[0].inhoud, 'boodschap zonder merk en inhoud op de lijst');

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

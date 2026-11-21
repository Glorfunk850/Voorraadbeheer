// De app mag niet vastlopen als de opslag op het toestel (IndexedDB) stilvalt, zoals op een gsm nadat de app
// een tijd op de achtergrond stond: de verbinding wordt gesloten, of een opdracht krijgt nooit antwoord.
// En gegevens die binnenkomen terwijl je iets invult, verschijnen zodra je klaar bent (zonder zelf te vernieuwen).
//
// Uitvoeren:  node test/opslag.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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
  // Haakje om de opslag te saboteren: 'dicht' = de volgende transactie gooit InvalidStateError (verbinding gesloten),
  // 'hangt' = de volgende transactie krijgt nooit antwoord.
  await ctx.addInitScript(() => {
    window.__sabotage = null;
    const echt = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...a) {
      const s = window.__sabotage; window.__sabotage = null;
      if (s === 'dicht') throw new DOMException('The database connection is closing.', 'InvalidStateError');
      const t = echt.apply(this, a);
      if (s === 'hangt') {
        // gebeurtenissen nooit doorgeven: de transactie lijkt eindeloos bezig
        Object.defineProperty(t, 'oncomplete', { set() {}, get() { return null; } });
        Object.defineProperty(t, 'onerror', { set() {}, get() { return null; } });
        Object.defineProperty(t, 'onabort', { set() {}, get() { return null; } });
      }
      return t;
    };
  });
  const page = await ctx.newPage();
  const jsFouten = [];
  page.on('pageerror', (e) => jsFouten.push(e.message));
  const api = (m, p, b) => page.evaluate(([m, p, b]) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' },
    body: b === undefined ? undefined : JSON.stringify(b) }).then((r) => r.status), [m, p, b]);
  await page.goto(basis + '#voorraad'); await page.waitForSelector('#inhoud h1');

  // verbinding gesloten: de app maakt een nieuwe en bewaart toch
  await page.evaluate(() => { window.__sabotage = 'dicht'; });
  controle((await api('POST', 'producten', { naam: 'Melk', hoeveelheid: 1, eenheid: 'fles' })) === 200, 'verbinding gesloten: product toch bewaard');

  // opdracht hangt: na enkele seconden opnieuw, en daarna werkt alles gewoon verder
  await page.evaluate(() => { window.__sabotage = 'hangt'; });
  const t0 = Date.now();
  const st = await api('PUT', 'instellingen', { locaties: ['Koelkast', 'Diepvries', 'Voorraadkast', 'Kelder'] });
  controle(st === 200 && Date.now() - t0 < 20000, `opslag hing: plaats toch bewaard na ${Math.round((Date.now() - t0) / 1000)} s`);
  controle((await api('POST', 'producten', { naam: 'Kaas', hoeveelheid: 1, eenheid: 'stuks', locatie: 'Kelder' })) === 200, 'daarna: volgend product meteen bewaard');

  // echt bewaard: na herladen staat alles er nog
  await page.reload(); await page.waitForSelector('#inhoud h1');
  const d = await page.evaluate(() => fetch('api/alles').then((r) => r.json()));
  controle(['Melk', 'Kaas'].every((n) => d.producten.some((p) => p.naam === n)), 'na herladen: producten staan er nog');
  controle(d.instellingen.locaties.includes('Kelder'), 'na herladen: nieuwe plaats staat er nog');

  // gegevens van een ander toestel komen binnen terwijl een paneel open staat: getoond zodra het paneel dicht is
  await page.evaluate(() => { document.querySelector('#paneel').hidden = false; document.querySelector('#sluier').hidden = false; }); // "bezig"
  // rechtstreeks bewaard, buiten het scherm om (zoals wat een ander toestel stuurt): het scherm weet het nog niet
  await api('POST', 'producten', { naam: 'Appelsap', hoeveelheid: 2, eenheid: 'fles' });
  const getoond = () => page.evaluate(() => document.querySelector('#inhoud').textContent.includes('Appelsap'));
  await page.evaluate(() => document.dispatchEvent(new Event('syncgewijzigd')));
  await page.waitForTimeout(500);
  controle(!(await getoond()), 'paneel open: scherm nog niet bijgewerkt');
  await page.click('#sluier');
  await page.waitForFunction(() => document.querySelector('#inhoud').textContent.includes('Appelsap'), null, { timeout: 3000 }).catch(() => {});
  controle(await getoond(), 'paneel dicht: nieuwe gegevens vanzelf getoond');

  controle(!jsFouten.length, `geen JavaScript-fouten (${jsFouten.join(' | ')})`);
  await browser.close(); srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en)`); process.exit(1); }
  console.log('\nAlles in orde');
}
main().catch((f) => { console.error(f); process.exit(1); });

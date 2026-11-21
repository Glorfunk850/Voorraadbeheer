// Afbeeldingen in de handleiding.
// Controleert: elke afbeelding bestaat, staat in de offline-lijst van sw.js, wordt in de app getoond,
// en komt in de pdf (de pdf blijft ook geldig als een afbeelding ontbreekt).
//
// Uitvoeren:  node test/handleiding.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
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

const fouten = [];
const controle = (ok, tekst) => { console.log(ok ? 'OK  ' : 'FOUT', tekst); if (!ok) fouten.push(tekst); };

async function main() {
  // bestanden en offline-lijst
  const tekst = fs.readFileSync(path.join(ROOT, 'handleiding.js'), 'utf8');
  const bronnen = [...new Set(tekst.match(/handleiding\/[\w-]+\.jpg/g) || [])];
  controle(bronnen.length >= 5, `de handleiding heeft afbeeldingen (${bronnen.length})`);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const b of bronnen) {
    const pad = path.join(ROOT, b);
    const bytes = fs.existsSync(pad) ? fs.readFileSync(pad) : null;
    controle(!!bytes && bytes[0] === 0xff && bytes[1] === 0xd8, `${b} bestaat en is een JPEG`);
    controle(sw.includes(`'${path.basename(b, '.jpg')}'`), `${b} staat in de offline-lijst van sw.js`);
  }
  controle(/<img(?![^>]*\balt=")/.test(tekst) === false, 'elke afbeelding heeft een beschrijving (alt)');

  const srv = await server();
  const basis = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const jsFouten = [];
  page.on('pageerror', (e) => jsFouten.push(e.message));

  // in de app: alles openklappen, elke afbeelding geladen
  await page.goto(basis + '#instellingen');
  await page.waitForSelector('#i-handleiding');
  await page.click('#i-handleiding');
  await page.waitForSelector('.hl-thema');
  await page.click('#hl-alles');
  const imgs = page.locator('#paneel figure.hl-foto img');
  await page.waitForFunction(() => [...document.querySelectorAll('#paneel figure.hl-foto img')].every((i) => i.complete), null, { timeout: 10000 });
  const geladen = await imgs.evaluateAll((els) => els.map((i) => ({ src: i.getAttribute('src'), w: i.naturalWidth, zichtbaar: i.getBoundingClientRect().width > 50 })));
  controle(geladen.length === bronnen.length, `alle afbeeldingen staan in het paneel (${geladen.length})`);
  controle(geladen.every((g) => g.w > 0), `alle afbeeldingen zijn geladen${geladen.filter((g) => !g.w).map((g) => ' – niet: ' + g.src).join('')}`);
  controle(geladen.every((g) => g.zichtbaar), 'alle afbeeldingen zijn zichtbaar');
  controle(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'geen horizontaal scrollen op de telefoon');
  const eerste = imgs.first();
  const klein = (await eerste.boundingBox()).width;
  await eerste.click();
  const groot = (await eerste.boundingBox()).width;
  controle(groot > klein * 1.5, `aantikken toont de afbeelding groter (${Math.round(klein)} → ${Math.round(groot)} px)`);
  await eerste.click();
  controle(Math.abs((await eerste.boundingBox()).width - klein) < 2, 'nog eens aantikken: weer klein');

  // pdf met afbeeldingen
  const pdfLezen = async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#paneel [data-handleiding-pdf]')]);
    return fs.readFileSync(await dl.path()).toString('latin1');
  };
  let pdf = await pdfLezen();
  const aantal = (pdf.match(/\/Subtype \/Image/g) || []).length;
  controle(aantal === bronnen.length, `de pdf bevat alle afbeeldingen (${aantal})`);
  controle(/\/Filter \/DCTDecode/.test(pdf) && /\/Im1 Do/.test(pdf), 'afbeeldingen staan als JPEG op een pagina');
  const xref = +pdf.match(/startxref\n(\d+)/)[1];
  controle(pdf.slice(xref, xref + 4) === 'xref', 'de verwijzingstabel van de pdf klopt');
  const lengtesKloppen = [...pdf.matchAll(/\/Length (\d+) >>\nstream\n/g)].every((m) => pdf.slice(m.index + m[0].length + +m[1], m.index + m[0].length + +m[1] + 10) === '\nendstream');
  controle(lengtesKloppen, 'elke stroom in de pdf heeft de juiste lengte');

  // ontbreekt een afbeelding (bv. map niet geüpload), dan toch een pdf, zonder die afbeelding
  await page.route('**/handleiding/voorraad.jpg', (r) => r.fulfill({ status: 404, body: '' }));
  pdf = await pdfLezen();
  controle((pdf.match(/\/Subtype \/Image/g) || []).length === bronnen.length - 1, 'ontbreekt een afbeelding, dan komt de pdf er toch, zonder die afbeelding');

  controle(!jsFouten.length, `geen JavaScript-fouten${jsFouten.length ? ': ' + jsFouten.join(' | ') : ''}`);
  await browser.close(); srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en)`); process.exit(1); }
  console.log('\nAlles in orde');
}
main().catch((e) => { console.error(e); process.exit(1); });

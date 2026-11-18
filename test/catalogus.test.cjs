// Catalogus: zelf producten toevoegen, bewerken (ook hernoemen) en verwijderen via het tabblad Catalogus.
//
// Uitvoeren:  node test/catalogus.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
// Uitvoeren:  node test/winkels.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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

  // toevoegen via de knop
  await page.click('#cat-nieuw');
  await page.fill('#cf-naam', 'Rijst');
  await page.fill('#cf-hv', '3');
  await page.selectOption('#cf-eenheid', 'pak');
  await page.fill('#cf-inhoud', '1');
  await page.selectOption('#cf-inhoud-eenheid', 'kg');
  await page.click('#cf-type [data-w="THT"]');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  let d = await api('GET', 'alles');
  let rijst = d.catalogus.find((c) => c.naam === 'Rijst');
  controle(rijst && rijst.hoeveelheid === 3 && rijst.eenheid === 'pak' && rijst.inhoud === 1 && rijst.inhoud_eenheid === 'kg', 'product toegevoegd aan catalogus');
  controle(!d.producten.length, 'toevoegen aan catalogus zet niets in de voorraad');
  controle(await page.isVisible('#c-bewerk'), 'na toevoegen opent het catalogusproduct');
  await page.click('#c-voorraad');
  controle((await page.inputValue('#pf-hv')) === '3' && (await page.inputValue('#pf-eenheid')) === 'pak', 'hoeveelheid uit catalogus ingevuld bij aan voorraad toevoegen');
  await page.click('#paneel [data-sluit]');
  controle(await page.isVisible('[data-cat="Rijst"]'), 'product staat in de lijst');

  // dubbele naam wordt geweigerd
  await page.click('#cat-nieuw');
  await page.fill('#cf-naam', 'rijst');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.catalogus.length === 1, 'dubbele naam niet toegevoegd');
  await page.click('#paneel [data-sluit]');

  // bewerken en hernoemen: ook in voorraad en op de lijst
  await api('POST', 'producten', { naam: 'Rijst', hoeveelheid: 2, eenheid: 'pak' });
  await api('POST', 'boodschappen', { naam: 'Rijst', eenheid: 'pak' });
  await page.click('[data-cat="Rijst"]');
  await page.click('#c-bewerk');
  await page.fill('#cf-naam', 'Basmatirijst');
  await page.click('#cf-prijzen summary');
  await page.fill('#cf-prijzen .pz-winkel', 'Colruyt');
  await page.fill('#cf-prijzen .pz-prijs', '2,40');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const b = d.catalogus.find((c) => c.naam === 'Basmatirijst');
  controle(b && !d.catalogus.some((c) => c.naam === 'Rijst') && d.catalogus.length === 1, 'hernoemd in catalogus');
  controle(b && b.prijzen.length === 1 && b.prijzen[0].prijs === 2.4, 'prijs bewaard bij bewerken');
  controle(d.producten[0].naam === 'Basmatirijst' && d.boodschappen[0].naam === 'Basmatirijst', 'nieuwe naam ook in voorraad en op de lijst');

  // verwijderen
  await page.click('#c-weg');
  await page.click('#vraag-ja');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(!d.catalogus.length, 'uit catalogus verwijderd');
  controle(d.producten.length === 1, 'voorraad blijft bij verwijderen');

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

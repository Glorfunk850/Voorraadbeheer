// Geopende verpakkingen (tellen als opgebruikt) en de voorraad per categorie, uitklapbaar en met zoeken.
//
// Uitvoeren:  node test/geopend.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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
  await page.goto(basis + '#voorraad'); await page.waitForSelector('#inhoud h1');

  // 3 flessen melk met minimum 3, en rijst in gram
  await api('POST', 'producten', { naam: 'Melk', hoeveelheid: 3, eenheid: 'fles', categorie: 'Zuivel & eieren', minimum: 3 });
  await api('POST', 'producten', { naam: 'Rijst', hoeveelheid: 500, eenheid: 'g', categorie: 'Pasta, rijst & peulvruchten' });
  await api('POST', 'producten', { naam: 'Zout', hoeveelheid: 1, eenheid: 'stuks' });
  let d = await api('GET', 'alles');
  const melk = d.producten.find((p) => p.naam === 'Melk');
  controle(!d.boodschappen.some((b) => b.naam === 'Melk'), 'minimum gehaald: melk niet op de lijst');

  // categorieën uitklapbaar, dicht tot je erop tikt
  await page.reload(); await page.waitForSelector('#inhoud h1');
  const titels = await page.$$eval('.voorraad-groep summary span:first-child', (x) => x.map((e) => e.textContent));
  controle(JSON.stringify(titels) === JSON.stringify(['Pasta, rijst & peulvruchten', 'Zuivel & eieren', 'Zonder categorie']), `categorieën in volgorde, zonder categorie onderaan (${titels})`);
  controle(!(await page.isVisible('[data-groep]')), 'categorieën staan dicht');
  await page.click('.voorraad-groep summary:has-text("Zuivel")');
  controle((await page.textContent('.voorraad-groep[open]')).includes('3 fles'), 'uitgeklapt: melk met 3 fles');

  // één fles geopend via het productpaneel
  await page.click('.voorraad-groep[open] [data-groep]');
  await page.click('#openen');
  await page.waitForTimeout(200);
  d = await api('GET', 'alles');
  const ml = d.producten.filter((p) => p.naam === 'Melk');
  const dicht = ml.find((p) => !p.geopend), open = ml.find((p) => p.geopend);
  controle(dicht && dicht.hoeveelheid === 2 && open && open.hoeveelheid === 1 && open.minimum === 0, `1 fles apart als geopend, 2 ongeopend (${JSON.stringify(ml.map((p) => [p.hoeveelheid, p.geopend]))})`);
  const b = d.boodschappen.filter((x) => x.naam === 'Melk');
  controle(b.length === 1 && b[0].hoeveelheid === 1, 'geopend telt als opgebruikt: 1 fles op de lijst (minimum 3)');
  controle((await page.textContent('#paneel')).includes('Geopend vandaag'), 'paneel toont dat de fles geopend is');

  // tegel in de categorie: 2 fles, en "geopend vandaag"
  await page.click('#paneel [data-sluit]');
  const tegel = await page.textContent('.voorraad-groep[open] [data-groep]');
  controle(tegel.includes('2 fles') && tegel.includes('geopend vandaag'), `regel toont 2 fles en geopend (${tegel.trim().replace(/\s+/g, ' ')})`);

  // toch niet geopend: terug bij de andere flessen, niet meer op de lijst
  await api('POST', `producten/${open.id}/sluiten`, {});
  d = await api('GET', 'alles');
  controle(d.producten.filter((p) => p.naam === 'Melk').length === 1 && d.producten.find((p) => p.naam === 'Melk').hoeveelheid === 3, 'toch niet geopend: terug 3 flessen');
  controle(!d.boodschappen.some((x) => x.naam === 'Melk'), 'en niet meer op de lijst');

  // geopend en op: de geopende fles verdwijnt
  let r = await api('POST', `producten/${melk.id}/openen`, {});
  await api('POST', `producten/${r.nieuw_id}/verbruik`, { hoeveelheid: null, verwijderen_als_op: true });
  d = await api('GET', 'alles');
  controle(!d.producten.some((p) => p.geopend), 'geopende fles op: weg uit de voorraad');

  // gewicht: alles geopend; de regel zonder minimum verdwijnt, de geopende blijft
  const rijst = d.producten.find((p) => p.naam === 'Rijst');
  r = await api('POST', `producten/${rijst.id}/openen`, { hoeveelheid: 100 });
  d = await api('GET', 'alles');
  const rs = d.producten.filter((p) => p.naam === 'Rijst');
  controle(rs.length === 1 && rs[0].geopend && rs[0].hoeveelheid === 500, 'rijst (gram): heel het pak geopend');

  // afronden van boodschappen telt nooit bij een geopende regel
  await api('POST', 'boodschappen', { naam: 'Rijst', hoeveelheid: 500, eenheid: 'g' });
  d = await api('GET', 'alles');
  await api('POST', 'boodschappen/afrekenen', { items: [{ id: d.boodschappen.find((x) => x.naam === 'Rijst').id, hoeveelheid: 500, eenheid: 'g', locatie: '' }] });
  d = await api('GET', 'alles');
  controle(d.producten.filter((p) => p.naam === 'Rijst').length === 2, 'gekochte rijst komt op een aparte (ongeopende) regel');

  // zoeken: alles open, alleen wat past
  await page.reload(); await page.waitForSelector('#zoek-voorraad');
  await page.fill('#zoek-voorraad', 'rijst');
  await page.waitForTimeout(100);
  const zicht = await page.$$eval('.voorraad-groep', (x) => x.map((e) => [e.open, e.querySelector('summary span').textContent]));
  controle(zicht.length === 1 && zicht[0][0] && zicht[0][1].startsWith('Pasta'), `zoeken: alleen de passende categorie, open (${JSON.stringify(zicht)})`);
  const regel = await page.textContent('.voorraad-groep [data-groep]');
  controle(regel.includes('500 g') && regel.includes('geopend'), `rijst: 500 g ongeopend + geopend (${regel.trim().replace(/\s+/g, ' ')})`);


  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

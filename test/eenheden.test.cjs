// Eigen eenheden bij Instellingen → Eenheden: toevoegen, kiezen, herkennen bij het typen, hernoemen en verwijderen.
//
// Uitvoeren:  node test/eenheden.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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
  await page.goto(basis + '#instellingen');
  await page.waitForSelector('#inhoud h1');
  page.on('dialog', (d) => d.accept());

  // eenheid toevoegen (kleine letters)
  await page.click('[data-uitklap="eenheden"] summary');
  await page.fill('[data-nieuw="eenheden"] input', 'Bokaal');
  await page.click('[data-nieuw="eenheden"] button');
  await page.waitForTimeout(200);
  let d = await api('GET', 'alles');
  controle(d.instellingen.eenheden.includes('bokaal'), 'eenheid "bokaal" toegevoegd');

  // te kiezen bij een nieuw product, telbaar (inhoud per stuk)
  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#nieuw');
  await page.click('#nieuw');
  const keuzes = await page.$$eval('#pf-eenheid option', (l) => l.map((o) => o.value));
  controle(keuzes.includes('bokaal'), 'bokaal staat bij de eenheden van een product');
  await page.fill('#pf-naam', 'Augurken');
  await page.fill('#pf-hv', '2');
  await page.selectOption('#pf-eenheid', 'bokaal');
  controle(await page.isVisible('#pf-inhoud-rij'), 'inhoud per bokaal kan ingevuld worden');
  await page.fill('#pf-inhoud', '350');
  await page.selectOption('#pf-inhoud-eenheid', 'g');
  await page.click('#pf button[type=submit]');
  for (let i = 0; i < 40; i++) { d = await api('GET', 'alles'); if (d.producten.some((p) => p.naam === 'Augurken')) break; await page.waitForTimeout(100); }
  const aug = d.producten.find((p) => p.naam === 'Augurken');
  controle(aug && aug.eenheid === 'bokaal' && aug.inhoud === 350, 'product bewaard als 2 bokaal à 350 g');

  // herkend bij het typen op de boodschappenlijst
  await page.goto(basis + '#boodschappen');
  await page.waitForSelector('#b-invoer');
  await page.fill('#b-invoer', '3 bokalen rode kool');
  await page.press('#b-invoer', 'Enter');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const kool = d.boodschappen.find((b) => /rode kool/i.test(b.naam));
  controle(kool && kool.eenheid === 'bokaal' && kool.hoeveelheid === 3, `"3 bokalen rode kool" herkend (${kool && kool.hoeveelheid} ${kool && kool.eenheid})`);

  // hernoemen: overal mee aangepast
  await page.goto(basis + '#instellingen');
  await page.waitForSelector('[data-uitklap="eenheden"]');
  if (!(await page.isVisible('[data-nieuw="eenheden"] input'))) await page.click('[data-uitklap="eenheden"] summary');
  await page.click('[data-lijst="eenheden"]:has-text("bokaal") [data-hernoem]');
  await page.fill('#vraag-invoer', 'Glas');
  await page.click('#vraag-ja');
  await page.waitForTimeout(300);
  d = await api('GET', 'alles');
  controle(d.instellingen.eenheden.includes('glas') && !d.instellingen.eenheden.includes('bokaal'), 'eenheid hernoemd naar "glas"');
  controle(d.producten.find((p) => p.naam === 'Augurken').eenheid === 'glas', 'product mee hernoemd');
  controle(d.boodschappen.find((b) => /rode kool/i.test(b.naam)).eenheid === 'glas', 'boodschap mee hernoemd');

  // standaardeenheid hernoemen kan niet
  await page.click('[data-lijst="eenheden"]:has-text("kg") [data-hernoem]');
  await page.waitForTimeout(150);
  controle(!(await page.isVisible('#vraag')), 'standaardeenheid "kg" hernoemen wordt geweigerd');

  // stuks verwijderen kan niet; een andere wel, het product houdt zijn eenheid
  await page.click('[data-lijst="eenheden"] >> nth=0 >> [data-wis]');
  await page.waitForTimeout(150);
  d = await api('GET', 'alles');
  controle(d.instellingen.eenheden.includes('stuks'), '"stuks" blijft');
  await page.click('[data-lijst="eenheden"]:has-text("glas") [data-wis]');
  await page.click('#vraag-ja');
  await page.waitForTimeout(300);
  d = await api('GET', 'alles');
  controle(!d.instellingen.eenheden.includes('glas'), 'eenheid "glas" verwijderd');
  controle(d.producten.find((p) => p.naam === 'Augurken').eenheid === 'glas', 'product houdt de verwijderde eenheid');
  await page.click('[data-lijst="eenheden"]:has-text("doos") [data-wis]');
  await page.click('#vraag-ja');
  await page.waitForTimeout(300);
  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#nieuw');
  await page.click('#nieuw');
  const na = await page.$$eval('#pf-eenheid option', (l) => l.map((o) => o.value));
  controle(!na.includes('doos') && !na.includes('glas'), 'verwijderde eenheden niet meer te kiezen');

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

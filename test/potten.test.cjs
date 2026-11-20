// Grote verpakking, thuis verdeeld over voorraadpotten (bv. een zak rijst van 5 kg over 4 potten).
// Controleert: instellen in het productformulier, de grote verpakking op de lijst onder het minimum,
// zelf op de lijst zetten, en bij het afronden de potten bijtellen (of de verpakking zelf in de voorraad zetten).
//
// Uitvoeren:  node test/potten.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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
  const herladen = async (hash, sel) => { await page.goto(basis + hash); await page.reload(); await page.waitForSelector(sel); };
  // op het voorraadscherm staat alleen wat binnenkort op moet: het product eerst opzoeken
  const productOpenen = async (id) => {
    await herladen('#voorraad', '#zoek-voorraad');
    await page.fill('#zoek-voorraad', 'Rijst');
    await page.click(`[data-groep="${id}"]`);
  };

  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#inhoud h1');
  await api('POST', 'producten', { naam: 'Rijst', hoeveelheid: 3, eenheid: 'pot', locatie: 'Kast' });
  let d = await api('GET', 'alles');
  const rijst = d.producten.find((p) => p.naam === 'Rijst');

  // instellen via het formulier: minimum 2 potten, grote verpakking zak à 5 kg die ±4 potten vult
  await productOpenen(rijst.id);
  await page.click('#bewerk');
  await page.waitForSelector('#pf-min');
  controle(await page.isHidden('#pf-groot'), 'velden van de grote verpakking zijn verborgen zolang het vinkje uit staat');
  await page.click('label:has(#pf-groot-aan)');
  controle(await page.isVisible('#pf-groot'), 'vinkje aan: velden verschijnen');
  controle((await page.inputValue('#pf-min')) === '1', 'zonder minimum wordt 1 voorgesteld');
  controle((await page.textContent('#pf-groot-potten-titel')).includes('potten'), 'het aantal telt in potten');
  await page.fill('#pf-min', '2');
  await page.selectOption('#pf-groot-eenheid', 'zak');
  await page.fill('#pf-groot-inhoud', '5');
  await page.selectOption('#pf-groot-inhoud-eenheid', 'kg');
  await page.fill('#pf-groot-potten', '4');
  await page.click('#pf button[type="submit"]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  let p = d.producten.find((x) => x.id === rijst.id);
  controle(JSON.stringify(p.grootverpakking) === '{"eenheid":"zak","inhoud":5,"inhoud_eenheid":"kg","potten":4}' && p.minimum === 2,
    `grote verpakking bewaard (${JSON.stringify(p.grootverpakking)})`);
  controle(!d.boodschappen.length, '3 potten, minimum 2: niets op de lijst');

  // potten opgebruikt: 1 zak à 5 kg op de lijst, niet het tekort aan potten
  await api('POST', `producten/${rijst.id}/verbruik`, { hoeveelheid: 2 });
  d = await api('GET', 'alles');
  let b = d.boodschappen.filter((x) => x.naam === 'Rijst');
  controle(b.length === 1 && b[0].hoeveelheid === 1 && b[0].eenheid === 'zak' && b[0].inhoud === 5 && b[0].inhoud_eenheid === 'kg'
    && b[0].potten_voor === rijst.id && b[0].bron === 'minimum', `1 zak à 5 kg op de lijst (${JSON.stringify(b)})`);
  await api('POST', `producten/${rijst.id}/verbruik`, { hoeveelheid: 1 });
  d = await api('GET', 'alles');
  b = d.boodschappen.filter((x) => x.naam === 'Rijst');
  controle(b.length === 1 && b[0].hoeveelheid === 1 && b[0].eenheid === 'zak', 'nog een pot op: blijft 1 zak (niet 2 potten)');

  // op het scherm
  await herladen('#boodschappen', '#inhoud .lijst .rij');
  const tekst = (await page.textContent('#inhoud .lijst')).replace(/\s+/g, ' ');
  controle(tekst.includes('Grote verpakking') && tekst.includes('1 zak') && tekst.includes('à 5 kg'), `lijst toont de grote verpakking (${tekst.trim()})`);

  // afvinken en afronden: verdeeld over 4 potten (voorgesteld), die gaan bij de potten
  await api('PUT', `boodschappen/${b[0].id}`, { afgevinkt: 1 });
  await herladen('#boodschappen', '#klaar');
  await page.click('#klaar');
  await page.waitForSelector('.af-potten');
  controle((await page.inputValue('.af-potten')) === '4', 'bij afronden worden 4 potten voorgesteld');
  controle((await page.inputValue('.af-plaats')) === 'Kast', 'plaats van de potten voorgesteld');
  await page.fill('.af-potten', '5');
  await page.click('#af-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const rijen = d.producten.filter((x) => x.naam === 'Rijst');
  controle(rijen.length === 1 && rijen[0].hoeveelheid === 5 && rijen[0].eenheid === 'pot', `5 potten in huis, geen losse zak (${rijen.map((x) => x.hoeveelheid + ' ' + x.eenheid).join(', ')})`);
  controle(!d.boodschappen.some((x) => x.naam === 'Rijst'), 'genoeg potten: niets meer op de lijst');

  // zelf op de lijst zetten vanuit het product
  await productOpenen(rijst.id);
  await page.waitForSelector('#lijst-groot');
  controle((await page.textContent('#lijst-groot')).includes('1 zak à 5 kg · vult ±4 potten'), 'knop toont de grote verpakking');
  await page.click('#lijst-groot');
  await page.waitForTimeout(200);
  d = await api('GET', 'alles');
  b = d.boodschappen.filter((x) => x.naam === 'Rijst');
  controle(b.length === 1 && b[0].eenheid === 'zak' && b[0].inhoud === 5 && b[0].potten_voor === rijst.id && b[0].bron === 'handmatig', 'zelf op de lijst gezet');

  // afronden met een leeg veld: de zak zelf komt in de voorraad
  await api('PUT', `boodschappen/${b[0].id}`, { afgevinkt: 1 });
  await herladen('#boodschappen', '#klaar');
  await page.click('#klaar');
  await page.waitForSelector('.af-potten');
  await page.fill('.af-potten', '');
  await page.click('#af-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const na = d.producten.filter((x) => x.naam === 'Rijst').map((x) => `${x.hoeveelheid} ${x.eenheid}${x.inhoud ? ' à ' + x.inhoud + ' ' + x.inhoud_eenheid : ''}`).sort();
  controle(JSON.stringify(na) === '["1 zak à 5 kg","5 pot"]', `leeg veld: de zak apart in de voorraad (${na.join(', ')})`);

  // vinkje uit: weer het gewone tekort aan potten
  await api('PUT', `producten/${rijst.id}`, { grootverpakking: null, hoeveelheid: 0 });
  d = await api('GET', 'alles');
  p = d.producten.find((x) => x.id === rijst.id);
  b = d.boodschappen.filter((x) => x.naam === 'Rijst');
  controle(!p.grootverpakking && b.length === 1 && b[0].hoeveelheid === 2 && b[0].eenheid === 'pot' && !b[0].potten_voor,
    `zonder grote verpakking: 2 potten tekort op de lijst (${JSON.stringify(b)})`);
  // en weer aan: de regel wordt een grote verpakking
  await api('PUT', `producten/${rijst.id}`, { grootverpakking: { eenheid: 'zak', inhoud: 5, inhoud_eenheid: 'kg', potten: 4 } });
  d = await api('GET', 'alles');
  b = d.boodschappen.filter((x) => x.naam === 'Rijst');
  controle(b.length === 1 && b[0].eenheid === 'zak' && b[0].hoeveelheid === 1 && b[0].potten_voor === rijst.id, 'weer aan: de regel wordt 1 zak');

  controle(!jsFouten.length, `geen JavaScript-fouten (${jsFouten.join(' | ')})`);
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en)`); process.exit(1); }
  console.log('\nAlles in orde');
}
main().catch((e) => { console.error(e); process.exit(1); });

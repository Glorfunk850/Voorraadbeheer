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
  controle(!(await page.isVisible('#cf-alle')), 'minimumveld verborgen zolang het vinkje uit staat');
  await page.click('label:has(#cf-alle-aan)');
  await page.fill('#cf-alle', '3');
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

  // vinkje uitzetten: geen minimum meer voor alle merken samen
  await page.goto(basis + '#catalogus'); await page.reload(); await page.waitForSelector('#inhoud h1');
  await page.click('[data-cat="Doperwten en wortelen"][data-var="0"]');
  await page.click('#c-bewerk');
  controle(await page.isChecked('#cf-alle-aan') && (await page.inputValue('#cf-alle')) === '3', 'vinkje staat aan met minimum 3');
  await page.click('label:has(#cf-alle-aan)');
  controle(!(await page.isVisible('#cf-alle')), 'vinkje uit: minimumveld verdwijnt');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(!d.catalogus.find((x) => x.naam === 'Doperwten en wortelen').minimum, 'vinkje uit: minimum weg uit de catalogus');

  // hetzelfde vinkje bij voorraad toevoegen
  await page.reload(); await page.waitForSelector('#inhoud h1');
  await page.click('[data-cat="Doperwten en wortelen"][data-var="0"]');
  await page.click('#c-voorraad');
  controle(!(await page.isChecked('#pf-alle-aan')) && !(await page.isVisible('#pf-alle')), 'voorraad toevoegen: vinkje staat uit');
  await page.click('label:has(#pf-alle-aan)');
  await page.fill('#pf-alle', '4');
  await page.click('#pf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.catalogus.find((x) => x.naam === 'Doperwten en wortelen').minimum === 4, 'voorraad toevoegen: minimum 4 voor alle merken bewaard in de catalogus');

  // en bij de boodschappen: het vinkje staat aan zodra je het product kiest; uitzetten haalt het minimum weg
  await page.goto(basis + '#boodschappen'); await page.reload(); await page.waitForSelector('#inhoud h1');
  await page.click('#b-menu');
  controle(!(await page.isChecked('#bt-alle-aan')), 'boodschappen: vinkje uit zolang er niets gekozen is');
  await page.fill('#bt-zoek', 'doperwten');
  await page.click('#bt-lijst [data-kies="0"]');
  controle(await page.isChecked('#bt-alle-aan') && (await page.inputValue('#bt-alle')) === '4', 'boodschappen: vinkje aan met het minimum uit de catalogus');
  await page.fill('#bt-alle', '5');
  await page.click('#bt-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.catalogus.find((x) => x.naam === 'Doperwten en wortelen').minimum === 5, 'boodschappen: minimum aangepast naar 5');
  controle(!(await page.isChecked('#bt-alle-aan')), 'boodschappen: na toevoegen staat het vinkje weer uit voor de volgende');
  await page.fill('#bt-zoek', 'doperwten');
  await page.click('#bt-lijst [data-kies="0"]');
  await page.click('label:has(#bt-alle-aan)');
  await page.click('#bt-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(!d.catalogus.find((x) => x.naam === 'Doperwten en wortelen').minimum, 'boodschappen: vinkje uit haalt het minimum weg');

  // minimum per inhoud (Everyday à 530 g): de boodschap komt toch zonder merk en inhoud op de lijst
  for (const x of (await api('GET', 'alles')).boodschappen) await api('DELETE', `boodschappen/${x.id}`);
  const ev = (await api('GET', 'alles')).producten.find((p) => p.naam === 'Doperwten en wortelen' && p.merk === 'Everyday');
  await api('PUT', `producten/${ev.id}`, { minimum: 10 });
  d = await api('GET', 'alles');
  b = d.boodschappen.filter((x) => x.naam === 'Doperwten en wortelen');
  controle(b.length === 1 && b[0].bron === 'minimum' && !b[0].merk && !b[0].inhoud, `minimum per inhoud: boodschap zonder merk en inhoud (${JSON.stringify(b)})`);
  // na het winkelen: zelf een nieuw merk en een nieuwe inhoud invullen
  await api('PUT', `boodschappen/${b[0].id}`, { afgevinkt: 1 });
  await page.goto(basis + '#boodschappen'); await page.reload(); await page.waitForSelector('#inhoud h1');
  await page.click('#klaar');
  await page.waitForSelector('.af-variant');
  const opt2 = await page.$$eval('.af-variant option', (o) => o.map((x) => x.textContent));
  controle(opt2[0] === 'Zonder merk of inhoud' && opt2.some((t) => t.includes('Everyday')) && opt2[opt2.length - 1].startsWith('Ander merk'), `keuzes na het winkelen (${opt2.join(', ')})`);
  controle(!(await page.isVisible('.af-merk')), 'velden voor een ander merk pas na die keuze');
  await page.selectOption('.af-variant', 'ander');
  await page.fill('.af-merk', 'Bonduelle');
  await page.fill('.af-inhoud', '400');
  await page.click('#af-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const bon = d.producten.find((p) => p.naam === 'Doperwten en wortelen' && p.merk === 'Bonduelle');
  controle(bon && bon.inhoud === 400 && bon.inhoud_eenheid === 'g', 'ander merk en inhoud in de voorraad gezet');
  controle(d.catalogus.find((x) => x.naam === 'Doperwten en wortelen').varianten.some((v) => v.merk === 'Bonduelle' && v.inhoud === 400), 'ander merk en inhoud komen in de catalogus');
  // zonder keuze: geen merk of inhoud van een ander product overnemen
  await api('POST', 'boodschappen', { naam: 'Doperwten en wortelen', hoeveelheid: 1, eenheid: 'stuks' });
  d = await api('GET', 'alles');
  const zb = d.boodschappen.find((x) => x.naam === 'Doperwten en wortelen' && !x.merk);
  await api('POST', 'boodschappen/afrekenen', { items: [{ id: zb.id, hoeveelheid: 1, eenheid: 'stuks', locatie: '' }] });
  d = await api('GET', 'alles');
  const zonder = d.producten.filter((p) => p.naam === 'Doperwten en wortelen' && !p.merk && !p.inhoud);
  controle(zonder.length === 1 && zonder[0].hoeveelheid >= 1, 'zonder keuze: in de voorraad zonder merk en inhoud');


  // dezelfde verpakking op twee plaatsen (kruidenkast en witte kast), de ene met inhoud of in potjes, de andere niet:
  // samen 1 in huis, dus na het openen van één niets op de lijst
  for (const [naam, a, b] of [['Paprikapoeder', {}, { inhoud: 40, inhoud_eenheid: 'g' }], ['Dille', { inhoud: 20, inhoud_eenheid: 'g' }, {}], ['Kerrie', {}, { eenheid: 'pot' }]]) {
    await api('POST', 'producten', { naam, hoeveelheid: 1, eenheid: 'stuks', locatie: 'Kruidenkast', minimum: 1, ...a });
    await api('POST', 'producten', { naam, hoeveelheid: 1, eenheid: 'stuks', locatie: 'Witte kast', ...b });
    d = await api('GET', 'alles');
    const kast = d.producten.find((p) => p.naam === naam && p.locatie === 'Kruidenkast');
    d = await api('POST', `producten/${kast.id}/openen`, {});
    controle(!d.boodschappen.some((x) => x.naam === naam), `${naam}: 1 geopend, nog 1 op een andere plaats: niet op de lijst`);
    const wit = d.producten.find((p) => p.naam === naam && p.locatie === 'Witte kast');
    d = await api('POST', `producten/${wit.id}/verbruik`, { hoeveelheid: 1 });
    controle(d.boodschappen.some((x) => x.naam === naam && x.bron === 'minimum' && x.hoeveelheid === 1), `${naam}: ook die op: 1 op de lijst`);
  }

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

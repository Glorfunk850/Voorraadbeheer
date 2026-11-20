// Prijzen per winkel en winkellijsten op het boodschappenscherm, via de echte knoppen.
// Controleert: prijzen invullen bij een product, de boodschap komt bij de goedkoopste winkel én op de
// algemene lijst, en afvinken op de ene lijst vinkt ook af op de andere (in beide richtingen).
//
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
  await page.goto(basis + '#instellingen');
  await page.waitForSelector('#inhoud h1');

  // winkels toevoegen bij Instellingen
  await page.click('[data-uitklap="winkels"] summary');
  for (const w of ['Colruyt', 'Aldi']) {
    await page.fill('[data-nieuw="winkels"] input', w);
    await page.click('[data-nieuw="winkels"] button');
    await page.waitForTimeout(150);
  }
  let d = await api('GET', 'alles');
  controle(JSON.stringify(d.instellingen.winkels) === '["Colruyt","Aldi"]', 'winkels toegevoegd bij Instellingen');

  // product met prijzen bij twee winkels (en een derde, nieuwe winkel) via het formulier
  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#nieuw');
  await page.click('#nieuw');
  await page.fill('#pf-naam', 'Kaas');
  await page.fill('#pf-hv', '500');
  await page.selectOption('#pf-eenheid', 'g');
  await page.click('#pf-prijzen summary');
  controle((await page.inputValue('#pf-prijzen select.pz-per')) === 'kg', 'prijs bij gram wordt per kg gevraagd');
  await page.fill('#pf-prijzen [data-winkel="Colruyt"] .pz-prijs', '12,50');
  await page.fill('#pf-prijzen [data-winkel="Aldi"] .pz-prijs', '10,80');
  await page.click('#pf-prijzen .pz-erbij');
  await page.fill('#pf-prijzen .pz-winkel', 'Delhaize');
  await page.fill('#pf-prijzen .prijs-rij:last-child .pz-prijs', '13');
  await page.click('#pf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const kaas = d.catalogus.find((c) => c.naam === 'Kaas');
  controle(kaas && kaas.prijzen.length === 3 && kaas.prijzen.find((p) => p.winkel === 'Aldi').prijs === 10.8 && kaas.prijzen[0].per === 'kg',
    'drie prijzen bewaard (per kg)');
  controle(d.instellingen.winkels.includes('Delhaize'), 'nieuwe winkel komt vanzelf bij Instellingen');

  // tweede product: het goedkoopst bij Colruyt
  await api('POST', 'producten', { naam: 'Melk', hoeveelheid: 1, eenheid: 'l', prijzen: [{ winkel: 'Colruyt', prijs: 1.05, per: 'l' }, { winkel: 'Aldi', prijs: 1.15, per: 'l' }] });
  await api('POST', 'boodschappen', { naam: 'Kaas', hoeveelheid: 250, eenheid: 'g' });
  await api('POST', 'boodschappen', { naam: 'Melk', hoeveelheid: 2, eenheid: 'l' });
  await api('POST', 'boodschappen', { naam: 'Brood' });

  await page.goto(basis + '#boodschappen');
  await page.reload();
  await page.waitForSelector('.winkel-uitklap');
  const tabs = await page.$$eval('.winkel-tabs .chip', (l) => l.map((b) => b.dataset.winkel));
  controle(JSON.stringify(tabs) === '["","Colruyt","Aldi"]', `tabbladen Alles, Colruyt, Aldi (${tabs.join(', ')})`);
  const namen = async () => page.$$eval('#inhoud .lijst:not(.sectie .lijst) .naam', (l) => l.map((x) => x.firstChild.textContent.trim()));
  controle((await namen()).length === 3, 'algemene lijst toont alle 3 boodschappen');
  const kaasRegel = await page.textContent('.lijst .rij:has-text("Kaas") small');
  controle(kaasRegel.includes('Aldi') && kaasRegel.includes('2,70'), `kaas bij Aldi, ± € 2,70 (${kaasRegel.trim()})`);

  // winkels staan in een uitklapmenu (standaard open); dichtgeklapt: eerst openklappen
  const kiesWinkel = async (w) => {
    if (!(await page.$('.winkel-uitklap[open]'))) await page.click('.winkel-uitklap summary');
    await page.click(`.winkel-tabs [data-winkel="${w}"]`);
  };
  controle(await page.isVisible('.winkel-tabs'), 'winkelmenu staat standaard open');
  await kiesWinkel('Aldi');
  controle((await page.isVisible('.winkel-tabs')) && (await page.textContent('.winkel-uitklap summary')).includes('Aldi'), 'na kiezen: menu blijft open, gekozen winkel zichtbaar');
  await page.click('.winkel-uitklap summary');
  await page.goto(basis + '#recepten');
  await page.goto(basis + '#boodschappen');
  await page.waitForSelector('.winkel-uitklap');
  controle(!(await page.isVisible('.winkel-tabs')), 'dichtgeklapt menu blijft dicht bij terugkeren');
  await page.click('.winkel-uitklap summary');
  controle(JSON.stringify(await namen()) === '["Kaas"]', 'lijst van Aldi toont alleen kaas');
  await kiesWinkel('Colruyt');
  controle(JSON.stringify(await namen()) === '["Melk"]', 'lijst van Colruyt toont alleen melk');

  // afvinken bij de winkel → weg van de algemene lijst
  await page.click('.rij:has-text("Melk") .vakje');
  await page.waitForTimeout(200);
  await kiesWinkel('');
  let open = await namen();
  controle(!open.includes('Melk') && open.length === 2, 'melk afgevinkt bij Colruyt is weg van de algemene lijst');

  // afvinken op de algemene lijst → weg van de lijst van de winkel
  await page.click('.rij:has-text("Kaas") .vakje');
  await page.waitForTimeout(200);
  await kiesWinkel('Aldi');
  controle((await namen()).length === 0, 'kaas afgevinkt op de algemene lijst is weg van de lijst van Aldi');
  controle(await page.isVisible('.sectie:has-text("In je mandje bij Aldi") .rij:has-text("Kaas")'), 'kaas staat in het mandje bij Aldi');

  // terug aanvinken werkt ook op beide lijsten
  await page.click('.rij:has-text("Kaas") .vakje');
  await page.waitForTimeout(200);
  await kiesWinkel('');
  controle((await namen()).includes('Kaas'), 'kaas terug op de algemene lijst na het uitvinken bij Aldi');

  // klaar met winkelen bij Colruyt: alleen de melk gaat in de voorraad
  await kiesWinkel('Colruyt');
  await page.click('#klaar');
  await page.click('#af-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(!d.boodschappen.some((b) => b.naam === 'Melk') && d.boodschappen.some((b) => b.naam === 'Kaas'), 'klaar bij Colruyt: melk weg, kaas blijft op de lijst');

  // prijs invullen vanaf de boodschappenlijst (Brood had nog geen prijs)
  await kiesWinkel('').catch(() => {});
  await page.click('.rij:has-text("Brood") [data-prijs]');
  await page.fill('#paneel [data-winkel="Delhaize"] .pz-prijs', '2,40');
  await page.click('#pz-form button[type=submit]');
  await page.waitForTimeout(250);
  const broodRegel = await page.textContent('.lijst .rij:has-text("Brood") small');
  controle(broodRegel.includes('Delhaize') && broodRegel.includes('2,40'), `brood nu bij Delhaize (${broodRegel.trim()})`);

  // prijs per kg kiezen voor een product dat je per pak koopt
  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#nieuw');
  await page.click('#nieuw');
  await page.fill('#pf-naam', 'Koffie');
  await page.fill('#pf-hv', '2');
  await page.selectOption('#pf-eenheid', 'pak');
  await page.click('#pf-prijzen summary');
  controle((await page.inputValue('#pf-prijzen select.pz-per')) === 'pak', 'product per pak: prijs standaard per pak');
  await page.selectOption('#pf-prijzen select.pz-per', 'kg');
  controle(await page.isVisible('#pf-prijzen .pz-hint'), 'prijs per kg zonder inhoud per pak: uitleg getoond');
  await page.fill('#pf-inhoud', '500');
  await page.selectOption('#pf-inhoud-eenheid', 'g');
  controle(!(await page.isVisible('#pf-prijzen .pz-hint')), 'inhoud ingevuld: uitleg weg');
  await page.selectOption('#pf-eenheid', 'pak'); // eenheid opnieuw kiezen mag de zelf gekozen prijs-eenheid niet terugzetten
  controle((await page.inputValue('#pf-prijzen select.pz-per')) === 'kg', 'zelf gekozen prijs-eenheid blijft staan');
  await page.fill('#pf-prijzen [data-winkel="Colruyt"] .pz-prijs', '10');
  await page.click('#pf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const koffie = d.catalogus.find((c) => c.naam === 'Koffie');
  controle(koffie && koffie.prijzen.length === 1 && koffie.prijzen[0].per === 'kg' && koffie.prijzen[0].prijs === 10, 'prijs bewaard per kg');
  await api('POST', 'boodschappen', { naam: 'Koffie', hoeveelheid: 1, eenheid: 'pak' });
  await page.goto(basis + '#boodschappen');
  await page.reload();
  await page.waitForSelector('.winkel-uitklap');
  const koffieRegel = await page.textContent('.lijst .rij:has-text("Koffie") small');
  controle(koffieRegel.includes('Colruyt') && koffieRegel.includes('5,00'), `1 pak koffie à 500 g bij € 10 per kg = € 5,00 (${koffieRegel.trim()})`);

  // prijzen alleen bij een merk en een inhoud: een boodschap zonder merk (of met een andere inhoud) komt toch op de lijst van een winkel
  await api('POST', 'producten', { naam: 'Speculoos', hoeveelheid: 1, eenheid: 'pak' });
  await api('POST', 'prijzen', { naam: 'Speculoos', eenheid: 'pak', prijzen: [
    { winkel: 'Aldi', prijs: 2.1, per: 'pak', merk: 'Lotus', inhoud: 250, inhoud_eenheid: 'g' },
    { winkel: 'Colruyt', prijs: 1.9, per: 'pak', merk: 'Lotus', inhoud: 250, inhoud_eenheid: 'g' }] });
  await api('POST', 'boodschappen', { naam: 'Speculoos', hoeveelheid: 1, eenheid: 'pak' });
  await api('POST', 'boodschappen', { naam: 'Speculoos', hoeveelheid: 1, eenheid: 'pak', merk: 'Lotus', inhoud: 500, inhoud_eenheid: 'g' });
  await page.goto(basis + '#boodschappen');
  await page.reload();
  await page.waitForSelector('.winkel-uitklap');
  await page.click('.winkel-tabs [data-winkel="Colruyt"]');
  const speculoos = await page.$$eval('#inhoud .lijst .naam', (l) => l.filter((x) => x.textContent.includes('Speculoos')).length);
  controle(speculoos === 2, `speculoos zonder merk en met een andere inhoud staat op de lijst van Colruyt (${speculoos}×)`);
  await page.click('.winkel-tabs [data-winkel=""]');

  // winkel hernoemen past de prijzen mee aan
  await api('PUT', 'instellingen', { winkels: ['Colruyt', 'Lidl', 'Delhaize'] });
  d = await api('POST', 'hernoemen', { veld: 'winkel', van: 'Aldi', naar: 'Lidl' });
  controle(d.catalogus.find((c) => c.naam === 'Kaas').prijzen.some((p) => p.winkel === 'Lidl'), 'winkel hernoemd: prijzen mee hernoemd');

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

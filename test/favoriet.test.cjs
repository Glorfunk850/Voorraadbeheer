// Favoriete winkel per product en de keuze van de goedkoopste winkel op de boodschappenlijst.
// Controleert: een boodschap zonder merk komt bij het goedkoopste merk, prijzen per kg en per bokaal worden vergeleken
// op wat de boodschap kost, een favoriete winkel wint van de goedkoopste, en alles blijft op de algemene lijst.
//
// Uitvoeren:  node test/favoriet.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const jsFouten = [];
  page.on('pageerror', (e) => jsFouten.push(e.message));
  const api = (m, p, b) => page.evaluate(([m, p, b]) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' },
    body: b === undefined ? undefined : JSON.stringify(b) }).then((r) => r.json()), [m, p, b]);
  await page.goto(basis + '#boodschappen');
  await page.waitForSelector('#inhoud h1');
  await api('PUT', 'instellingen', { winkels: ['Colruyt', 'Jumbo', 'Aldi'] });

  // 1. boodschap zonder merk: ook een merk dat goedkoper is telt mee (vroeger alleen prijzen zonder merk)
  await api('POST', 'prijzen', { naam: 'Rijst', eenheid: 'pak', prijzen: [
    { winkel: 'Jumbo', prijs: 2.4, per: 'pak' }, { winkel: 'Colruyt', prijs: 1.9, per: 'pak', merk: 'Boni' }] });
  await api('POST', 'boodschappen', { naam: 'Rijst', hoeveelheid: 1, eenheid: 'pak' });
  // 2. prijzen in eenheden die niet om te rekenen zijn (per bokaal en per kg): wat de boodschap echt kost telt
  await api('POST', 'catalogus', { naam: 'Appelmoes', eenheid: 'bokaal', hoeveelheid: 1, inhoud: 350, inhoud_eenheid: 'g' });
  await api('POST', 'prijzen', { naam: 'Appelmoes', eenheid: 'bokaal', prijzen: [
    { winkel: 'Colruyt', prijs: 3.63, per: 'kg', inhoud: 350, inhoud_eenheid: 'g' }, { winkel: 'Jumbo', prijs: 1.39, per: 'bokaal', inhoud: 350, inhoud_eenheid: 'g' }] });
  await api('POST', 'boodschappen', { naam: 'Appelmoes', hoeveelheid: 1, eenheid: 'bokaal' });
  // 3. gewoon product, het goedkoopst bij Aldi
  await api('POST', 'prijzen', { naam: 'Melk', eenheid: 'l', prijzen: [{ winkel: 'Colruyt', prijs: 1.05, per: 'l' }, { winkel: 'Aldi', prijs: 0.99, per: 'l' }] });
  await api('POST', 'boodschappen', { naam: 'Melk', hoeveelheid: 2, eenheid: 'l' });
  await api('POST', 'boodschappen', { naam: 'Brood' });

  const open = async () => { await page.goto(basis + '#boodschappen'); await page.reload(); await page.waitForSelector('.winkel-uitklap'); };
  const regel = (naam) => page.textContent(`#inhoud .lijst .rij:has-text("${naam}") .prijs-link`).then((t) => t.trim());
  const lijstVan = async (w) => {
    await page.click(`.winkel-tabs [data-winkel="${w}"]`);
    const n = await page.$$eval('#inhoud .lijst .naam-knop', (l) => l.map((x) => x.firstChild.textContent.trim()));
    await page.click('.winkel-tabs [data-winkel=""]');
    return n;
  };
  await open();
  let r = await regel('Rijst');
  controle(r.startsWith('Colruyt') && r.includes('1,90'), `rijst zonder merk bij Colruyt, Boni € 1,90 (${r})`);
  r = await regel('Appelmoes');
  controle(r.startsWith('Colruyt') && r.includes('1,27'), `appelmoes: € 3,63 per kg × 350 g = € 1,27 bij Colruyt, niet € 1,39 bij Jumbo (${r})`);
  r = await regel('Melk');
  controle(r.startsWith('Aldi'), `melk bij Aldi (${r})`);
  let alles = await page.$$eval('#inhoud .lijst .naam-knop', (l) => l.length);
  controle(alles === 4, `algemene lijst toont alle 4 boodschappen (${alles})`);

  // favoriete winkel kiezen via de prijs onder de boodschap
  await page.click('#inhoud .lijst .rij:has-text("Melk") .prijs-link');
  await page.waitForSelector('#pz-form .fav-winkel');
  controle((await page.inputValue('#pz-form .fav-winkel')) === '', 'nog geen favoriete winkel');
  await page.selectOption('#pz-form .fav-winkel', 'Colruyt');
  await page.click('#pz-form button[type=submit]');
  await page.waitForTimeout(300);
  let d = await api('GET', 'alles');
  controle(d.catalogus.find((c) => c.naam === 'Melk').favoriete_winkel === 'Colruyt', 'favoriete winkel bewaard');
  controle(d.catalogus.find((c) => c.naam === 'Melk').prijzen.length === 2, 'prijzen bleven staan');
  await open();
  r = await regel('Melk');
  controle(r.startsWith('★ Colruyt') && r.includes('2,10'), `melk nu bij Colruyt (favoriet), € 2,10 (${r})`);
  controle((await lijstVan('Colruyt')).includes('Melk') && !(await page.$('.winkel-tabs [data-winkel="Aldi"]')), 'melk op de lijst van Colruyt, Aldi-tab weg (geen boodschappen meer)');
  alles = await page.$$eval('#inhoud .lijst .naam-knop', (l) => l.length);
  controle(alles === 4, 'algemene lijst toont nog altijd alle 4 boodschappen');

  // favoriete winkel zonder prijs daar: toch op die lijst
  await api('POST', 'favoriet', { naam: 'Brood', winkel: 'Aldi' });
  await open();
  r = await regel('Brood');
  controle(r === '★ Aldi · Prijs invullen', `brood zonder prijs op de lijst van Aldi (${r})`);
  controle(JSON.stringify(await lijstVan('Aldi')) === '["Brood"]', 'lijst van Aldi toont brood');

  // afvinken bij de favoriete winkel vinkt ook af op de algemene lijst
  await page.click('.winkel-tabs [data-winkel="Colruyt"]');
  await page.click('#inhoud .lijst .rij:has-text("Melk") .vakje');
  await page.waitForTimeout(250);
  await page.click('.winkel-tabs [data-winkel=""]');
  const openNamen = await page.$$eval('#inhoud > .lijst .naam-knop', (l) => l.map((x) => x.firstChild.textContent.trim()));
  controle(!openNamen.includes('Melk') && openNamen.length === 3, 'melk afgevinkt bij Colruyt is ook afgevinkt op de algemene lijst');
  await page.click('.rij:has-text("Melk") .vakje');
  await page.waitForTimeout(250);

  // favoriete winkel kiezen in het productformulier
  await api('POST', 'producten', { naam: 'Koffie', hoeveelheid: 0, eenheid: 'pak', prijzen: [{ winkel: 'Colruyt', prijs: 5, per: 'pak' }, { winkel: 'Jumbo', prijs: 6, per: 'pak' }] });
  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#inhoud h1');
  await page.reload(); // de app de nieuwe stand laten inlezen
  const pid = (await api('GET', 'alles')).producten.find((p) => p.naam === 'Koffie').id;
  await page.waitForSelector(`[data-product="${pid}"]`);
  await page.click(`[data-product="${pid}"]`);
  await page.click('#bewerk');
  await page.waitForSelector('#pf-prijzen');
  if (!(await page.$('#pf-prijzen[open]'))) await page.click('#pf-prijzen summary');
  controle((await page.inputValue('#pf-prijzen .fav-winkel')) === '', 'productformulier: keuze favoriete winkel, nog leeg');
  await page.selectOption('#pf-prijzen .fav-winkel', 'Jumbo');
  await page.click('#pf button[type=submit]');
  await page.waitForTimeout(300);
  d = await api('GET', 'alles');
  controle(d.catalogus.find((c) => c.naam === 'Koffie').favoriete_winkel === 'Jumbo', 'favoriete winkel gekozen in het productformulier');
  await api('POST', 'boodschappen', { naam: 'Koffie', hoeveelheid: 1, eenheid: 'pak' });
  await open();
  r = await regel('Koffie');
  controle(r.startsWith('★ Jumbo') && r.includes('6,00'), `koffie bij Jumbo, de favoriete winkel (${r})`);

  // winkel hernoemd: favoriet mee hernoemd; winkel verwijderd: weer de goedkoopste
  d = await api('POST', 'hernoemen', { veld: 'winkel', van: 'Jumbo', naar: 'Lidl' });
  controle(d.catalogus.find((c) => c.naam === 'Koffie').favoriete_winkel === 'Lidl', 'winkel hernoemd: favoriete winkel mee hernoemd');
  d = await api('POST', 'hernoemen', { veld: 'winkel', van: 'Lidl', naar: '' });
  controle(!d.catalogus.find((c) => c.naam === 'Koffie').favoriete_winkel, 'winkel verwijderd: geen favoriete winkel meer');
  // favoriet weghalen: terug naar de goedkoopste
  await api('POST', 'favoriet', { naam: 'Melk', winkel: '' });
  await open();
  r = await regel('Melk');
  controle(r.startsWith('Aldi'), `zonder favoriet weer bij de goedkoopste, Aldi (${r})`);
  r = await regel('Koffie');
  controle(r.startsWith('Colruyt'), `koffie weer bij de goedkoopste, Colruyt (${r})`);

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

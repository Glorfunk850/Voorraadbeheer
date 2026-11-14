// Back-up maken op toestel A en terugzetten op een nieuw, leeg toestel B, via de echte knoppen.
// Controleert ook dat de gegevens er na het herstarten van de app nog zijn, en dat oudere of
// rare bestanden (BOM, id's als tekst, ingrediënten apart) en foute bestanden goed afgehandeld worden.
//
// Uitvoeren:  node test/backup.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'voorraad-backup-'));
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
  const toestel = async () => {
    const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
    const page = await ctx.newPage();
    page.jsFouten = [];
    page.on('pageerror', (e) => page.jsFouten.push(e.message));
    await page.goto(basis + '#instellingen');
    await page.waitForSelector('#i-terug');
    return page;
  };
  const api = (page, m, p, b) => page.evaluate(([m, p, b]) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json()), [m, p, b]);
  const terugzetten = async (page, bestand, bevestigen = true) => {
    await page.goto(basis + '#instellingen');
    await page.reload(); // eventueel open paneel weg
    await page.waitForSelector('#i-terug');
    const [kiezer] = await Promise.all([page.waitForEvent('filechooser'), page.click('#i-terug')]);
    await kiezer.setFiles(bestand);
    await page.waitForTimeout(400);
    if (bevestigen && await page.evaluate(() => document.querySelector('#vraag').open)) await page.click('#vraag-ja');
    await page.waitForTimeout(500);
  };
  const tellen = (page) => page.evaluate(() => fetch('api/alles').then((r) => r.json()))
    .then((d) => ({ p: d.producten.length, r: d.recepten.length, b: d.boodschappen.length, d }));

  // --- Toestel A: gegevens maken en back-up downloaden
  const a = await toestel();
  await api(a, 'POST', 'producten', { naam: 'Melk', hoeveelheid: 2, eenheid: 'l', locatie: 'Koelkast' });
  await api(a, 'POST', 'producten', { naam: 'Rijst', hoeveelheid: 500, eenheid: 'g', locatie: 'Voorraadkast' });
  await api(a, 'POST', 'recepten', { titel: 'Rijstpap', personen: 2, ingredienten: [{ naam: 'melk', hoeveelheid: 1, eenheid: 'l' }] });
  await api(a, 'POST', 'boodschappen', { naam: 'Brood' });
  await a.goto(basis + '#instellingen');
  await a.waitForSelector('#i-terug');
  const [dl] = await Promise.all([a.waitForEvent('download'), a.click('text=Back-up downloaden')]);
  const backup = path.join(TMP, 'voorraad-backup.json');
  await dl.saveAs(backup);
  controle(fs.statSync(backup).size > 100, 'back-up gedownload op toestel A');

  // --- Toestel B: nieuw en leeg, back-up terugzetten
  const b = await toestel();
  controle((await tellen(b)).p === 0, 'toestel B is leeg');
  await b.goto(basis + '#instellingen');
  await b.waitForSelector('#i-terug');
  const [kiezer] = await Promise.all([b.waitForEvent('filechooser'), b.click('#i-terug')]);
  await kiezer.setFiles(backup);
  await b.waitForTimeout(400);
  const vraagTekst = await b.textContent('#vraag-tekst');
  controle(/2 producten, 1 recepten en 1 boodschappen/.test(vraagTekst), `vraag toont inhoud: "${vraagTekst}"`);
  await b.click('#vraag-ja');
  await b.waitForTimeout(500);
  controle((await b.textContent('#toast')).includes('Back-up teruggezet'), 'melding "Back-up teruggezet"');
  let t = await tellen(b);
  controle(t.p === 2 && t.r === 1 && t.b === 1, `gegevens op toestel B (${t.p} producten, ${t.r} recepten, ${t.b} boodschappen)`);
  await b.reload();
  await b.waitForTimeout(500);
  t = await tellen(b);
  controle(t.p === 2 && t.r === 1 && t.b === 1, 'gegevens zijn er nog na herstarten van de app');
  await b.goto(basis + '#recepten');
  await b.waitForTimeout(300);
  await b.click('#inhoud [data-recept]');
  await b.click('#r-bewerk');
  controle((await b.textContent('#paneel h2')) === 'Recept bewerken', 'teruggezet recept is te bewerken');

  // --- Bestand met BOM, id's als tekst, ingrediënten als aparte lijst, in een extra laag
  const oud = path.join(TMP, 'oud.json');
  fs.writeFileSync(oud, '﻿' + JSON.stringify({ gegevens: {
    producten: [{ id: '7', naam: 'Kaas', hoeveelheid: 1, eenheid: 'stuks' }],
    recepten: [{ id: '3', titel: 'Croque' }],
    ingredienten: [{ id: '9', recept_id: '3', naam: 'kaas', hoeveelheid: 1, eenheid: 'plak' }],
    boodschappen: [],
  } }));
  const c = await toestel();
  await terugzetten(c, oud);
  t = await tellen(c);
  controle(t.p === 1 && t.r === 1 && t.d.recepten[0].ingredienten.length === 1, 'oudere/afwijkende back-up wordt ingelezen');
  controle(t.d.producten[0].id === 7, "id's als tekst worden getallen");
  await c.goto(basis + '#voorraad');
  await c.fill('#zoek-voorraad', 'Kaas');
  await c.waitForTimeout(200);
  await c.click('#inhoud [data-groep]');
  await c.click('#plus');
  await c.waitForTimeout(200);
  controle((await c.textContent('.getal')).startsWith('2'), 'teruggezet product is aan te passen');

  // --- Fout bestand: duidelijke melding, niets gewist
  const fout = path.join(TMP, 'foto.txt');
  fs.writeFileSync(fout, 'dit is geen back-up');
  await terugzetten(b, fout, false);
  controle(/geen back-up/.test(await b.textContent('#toast')), 'fout bestand geeft duidelijke melding');
  controle((await tellen(b)).p === 2, 'na fout bestand blijft alles staan');

  for (const p of [a, b, c]) if (p.jsFouten.length) controle(false, 'JavaScript-fout: ' + p.jsFouten.join(' | '));
  await browser.close();
  srv.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  if (fouten.length) { console.log(`\n${fouten.length} probleem/problemen.`); process.exit(1); }
  console.log('\nBack-up terugzetten werkt.');
}
main().catch((e) => { console.error(e); process.exit(1); });

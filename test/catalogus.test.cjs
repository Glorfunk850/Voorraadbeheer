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
  await page.fill('#cf-inhoud', '1');
  await page.selectOption('#cf-inhoud-eenheid', 'kg');
  await page.click('#cf-type [data-w="THT"]');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  let d = await api('GET', 'alles');
  let rijst = d.catalogus.find((c) => c.naam === 'Rijst');
  controle(rijst && rijst.hoeveelheid === 3 && rijst.eenheid === 'stuks' && rijst.inhoud === 1 && rijst.inhoud_eenheid === 'kg', 'product toegevoegd aan catalogus (per stuk)');
  controle(!d.producten.length, 'toevoegen aan catalogus zet niets in de voorraad');
  controle(await page.isVisible('#c-bewerk'), 'na toevoegen opent het catalogusproduct');
  await page.click('#c-voorraad');
  controle((await page.inputValue('#pf-hv')) === '3' && (await page.inputValue('#pf-eenheid')) === 'stuks', 'hoeveelheid uit catalogus ingevuld bij aan voorraad toevoegen');
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

  // boodschap toevoegen met dezelfde gegevens als in de catalogus
  await page.goto(basis + '#boodschappen');
  await page.waitForSelector('#b-menu');
  await page.click('#b-menu');
  await page.fill('#bt-naam', 'Pasta');
  await page.click('#bt-meer summary');
  await page.fill('#bt-inhoud', '500');
  await page.selectOption('#bt-inhoud-eenheid', 'g');
  await page.click('#bt-type [data-w="TGT"]');
  await page.click('#bt-prijzen summary');
  await page.click('#bt-prijzen .pz-erbij');
  await page.fill('#bt-prijzen .pz-winkel >> nth=-1', 'Delhaize');
  await page.fill('#bt-prijzen .prijs-rij:last-child .pz-prijs', '1,80');
  await page.click('#bt-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const pasta = d.catalogus.find((c) => c.naam === 'Pasta');
  controle(pasta && pasta.inhoud === 500 && pasta.inhoud_eenheid === 'g' && pasta.datumtype === 'TGT' && pasta.eenheid === 'stuks', 'boodschap: inhoud en datumsoort in de catalogus bewaard');
  controle(pasta && pasta.prijzen.length === 1 && pasta.prijzen[0].prijs === 1.8 && pasta.prijzen[0].winkel === 'Delhaize', 'boodschap: prijs per winkel bewaard');
  controle(d.boodschappen.some((b) => b.naam === 'Pasta'), 'boodschap staat op de lijst');
  controle((await page.inputValue('#bt-naam')) === '' && (await page.inputValue('#bt-inhoud')) === '', 'velden leeg na toevoegen');
  // een gekend product kiezen vult de gegevens in
  await page.fill('#bt-naam', 'pasta');
  await page.waitForTimeout(100);
  controle((await page.inputValue('#bt-inhoud')) === '500', 'gekend product: inhoud ingevuld');
  // zonder iets aan te passen blijft de catalogus zoals hij was
  await page.fill('#bt-naam', 'Melk');
  await page.click('#bt-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(!d.catalogus.some((c) => c.naam === 'Melk') && d.boodschappen.some((b) => b.naam === 'Melk'), 'zonder extra gegevens alleen op de lijst');

  // uitlekgewicht: vinkje in de catalogus, wordt overgenomen naar de voorraad en getoond
  await page.goto(basis + '#catalogus');
  await page.reload();
  await page.waitForSelector('#cat-nieuw');
  await page.click('#cat-nieuw');
  await page.fill('#cf-naam', 'Kikkererwten');
  await page.fill('#cf-inhoud', '240');
  await page.selectOption('#cf-inhoud-eenheid', 'g');
  await page.click('label:has(#cf-uitlek)');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.catalogus.find((c) => c.naam === 'Kikkererwten')?.uitlekgewicht === true, 'uitlekgewicht bewaard in catalogus');
  await page.click('#c-voorraad');
  controle(await page.isChecked('#pf-uitlek'), 'uitlekgewicht aangevinkt bij aan voorraad toevoegen');
  await page.click('#pf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const kik = d.producten.find((p) => p.naam === 'Kikkererwten');
  controle(kik && kik.uitlekgewicht === true, 'uitlekgewicht bewaard in voorraad');
  await page.goto(basis + '#voorraad');
  await page.reload();
  await page.fill('#zoek-voorraad', 'Kikker');
  await page.click(`[data-groep="${kik.id}"]`);
  await page.waitForSelector('#paneel .hoeveelheid');
  controle((await page.textContent('#paneel .hoeveelheid')).includes('à 240 g uitlekgewicht'), 'uitlekgewicht getoond bij het product');
  await page.click('#bewerk');
  await page.click('label:has(#pf-uitlek)');
  await page.click('#pf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.producten.find((p) => p.naam === 'Kikkererwten').uitlekgewicht === false && d.catalogus.find((c) => c.naam === 'Kikkererwten').uitlekgewicht === false, 'uitlekgewicht uitvinken bewaard');

  // merk: invullen in de catalogus, overnemen naar de voorraad, tonen en zoeken
  await page.goto(basis + '#catalogus');
  await page.reload();
  await page.click('[data-cat="Kikkererwten"]');
  await page.click('#c-bewerk');
  await page.fill('#cf-merk', 'Bonduelle');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.catalogus.find((c) => c.naam === 'Kikkererwten').merk === 'Bonduelle', 'merk bewaard in catalogus');
  await page.click('#c-voorraad');
  controle((await page.inputValue('#pf-merk')) === 'Bonduelle', 'merk ingevuld bij aan voorraad toevoegen');
  await page.click('#pf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.producten.filter((p) => p.naam === 'Kikkererwten').some((p) => p.merk === 'Bonduelle'), 'merk bewaard in voorraad');
  await page.goto(basis + '#voorraad');
  await page.reload();
  await page.fill('#zoek-voorraad', 'bonduelle');
  controle(await page.isVisible('[data-groep]'), 'zoeken op merk vindt het product');
  await page.goto(basis + '#catalogus');
  await page.reload();
  controle((await page.textContent('[data-cat="Kikkererwten"]')).includes('Bonduelle'), 'merk staat achter de naam in de catalogus');

  // boodschap toevoegen: kiezen uit de catalogus (ook zoeken op merk) en het merk invullen
  await page.goto(basis + '#boodschappen');
  await page.reload();
  await page.click('#b-menu');
  await page.fill('#bt-naam', 'bonduel');
  await page.dispatchEvent('#bt-naam', 'input');
  controle((await page.textContent('#bt-lijst')).includes('Kikkererwten'), 'boodschap: zoeken op merk toont het catalogusproduct');
  await page.fill('#bt-naam', '');
  await page.dispatchEvent('#bt-naam', 'input');
  await page.fill('#bt-zoek', 'kikker');
  await page.dispatchEvent('#bt-zoek', 'input');
  controle((await page.$$('#bt-lijst [data-kies]')).length === 1 && (await page.textContent('#bt-lijst')).includes('Kikkererwten'), 'boodschap: zoekveld filtert de catalogus');
  await page.fill('#bt-zoek', 'bestaatniet');
  await page.dispatchEvent('#bt-zoek', 'input');
  controle((await page.textContent('#bt-lijst')).includes('Niets gevonden'), 'boodschap: zoekveld zonder resultaat');
  await page.fill('#bt-zoek', 'bonduelle');
  await page.dispatchEvent('#bt-zoek', 'input');
  await page.click('#bt-lijst [data-kies]');
  controle((await page.inputValue('#bt-zoek')) === '', 'boodschap: zoekveld leeg na kiezen');
  controle((await page.inputValue('#bt-naam')) === 'Kikkererwten' && (await page.inputValue('#bt-merk')) === 'Bonduelle', 'boodschap: kiezen uit catalogus vult naam en merk in');
  await page.click('#bt-ok');
  await page.waitForTimeout(250);
  await page.fill('#bt-naam', 'Tomatenpuree');
  await page.fill('#bt-merk', 'Heinz');
  await page.click('#bt-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.boodschappen.find((b) => b.naam === 'Kikkererwten')?.merk === 'Bonduelle' && d.boodschappen.find((b) => b.naam === 'Tomatenpuree')?.merk === 'Heinz', 'boodschap: merk bewaard');
  controle((await page.inputValue('#bt-merk')) === '', 'boodschap: merkveld leeg na toevoegen');
  await page.click('#paneel [data-sluit]');
  controle((await page.textContent('#inhoud')).includes('Heinz'), 'boodschap: merk staat op de lijst');
  const tp = d.boodschappen.find((b) => b.naam === 'Tomatenpuree');
  await api('POST', 'boodschappen/afrekenen', { items: [{ id: tp.id, hoeveelheid: 1, eenheid: 'stuks', locatie: '' }] });
  d = await api('GET', 'alles');
  controle(d.producten.find((p) => p.naam === 'Tomatenpuree')?.merk === 'Heinz' && d.catalogus.find((c) => c.naam === 'Tomatenpuree')?.merk === 'Heinz', 'boodschap: merk gaat mee naar voorraad en catalogus');

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

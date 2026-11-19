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

  // hetzelfde product met dezelfde inhoud (en hetzelfde merk) wordt geweigerd
  await page.click('#cat-nieuw');
  await page.fill('#cf-naam', 'rijst');
  await page.fill('#cf-inhoud', '1');
  await page.selectOption('#cf-inhoud-eenheid', 'kg');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.catalogus.length === 1 && d.catalogus[0].varianten.length === 1, 'dubbel product (zelfde inhoud) niet toegevoegd');
  await page.click('#paneel [data-sluit]');

  // bewerken en hernoemen: ook in voorraad en op de lijst
  await api('POST', 'producten', { naam: 'Rijst', hoeveelheid: 2, eenheid: 'pak' });
  await api('POST', 'boodschappen', { naam: 'Rijst', eenheid: 'pak' });
  await page.click('[data-cat="Rijst"] >> nth=0');
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

  // verwijderen: eerst één variant (merk en inhoud), dan het laatste
  controle(b && b.varianten.length === 2, 'pak zonder inhoud staat als aparte variant naast pak à 1 kg');
  await page.click('#c-weg');
  await page.click('#vraag-ja');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.catalogus.length === 1 && d.catalogus[0].varianten.length === 1, 'één variant uit catalogus verwijderd, de andere blijft');
  await page.click('[data-cat="Basmatirijst"]');
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

  // hetzelfde product met een ander merk en/of een andere inhoud: aparte regels in de catalogus
  await page.goto(basis + '#catalogus');
  await page.reload();
  await page.click('#cat-nieuw');
  await page.fill('#cf-naam', 'Koffie');
  await page.fill('#cf-merk', 'Douwe');
  await page.fill('#cf-inhoud', '250');
  await page.selectOption('#cf-inhoud-eenheid', 'g');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  await page.click('#c-variant');
  controle((await page.inputValue('#cf-naam')) === 'Koffie' && (await page.inputValue('#cf-merk')) === '', 'ander merk of inhoud: naam ingevuld, merk leeg');
  await page.fill('#cf-merk', 'Lavazza');
  await page.fill('#cf-inhoud', '1');
  await page.selectOption('#cf-inhoud-eenheid', 'kg');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  controle((await page.textContent('#paneel .paneel-kop, #paneel')).includes('Lavazza'), 'na bewaren opent de nieuwe variant');
  await page.click('#paneel [data-sluit]');
  // ook via Toevoegen met een gekende naam: zelfde merk, andere inhoud
  await page.click('#cat-nieuw');
  await page.fill('#cf-naam', 'koffie');
  await page.fill('#cf-merk', 'Douwe');
  await page.fill('#cf-inhoud', '500');
  await page.selectOption('#cf-inhoud-eenheid', 'g');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  await page.click('#paneel [data-sluit]');
  d = await api('GET', 'alles');
  const koffie = d.catalogus.filter((c) => c.naam === 'Koffie');
  controle(koffie.length === 1 && koffie[0].varianten.length === 3, 'koffie: één product met drie varianten');
  controle((await page.$$('[data-cat="Koffie"]')).length === 3, 'koffie: drie regels in de catalogus');
  const regels = await page.$$eval('[data-cat="Koffie"]', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  controle(regels.some((t) => t.includes('Douwe') && t.includes('250 g')) && regels.some((t) => t.includes('Douwe') && t.includes('500 g')) && regels.some((t) => t.includes('Lavazza') && t.includes('1 kg')), 'koffie: merk en inhoud per regel');
  // dezelfde variant nog eens: geweigerd
  await page.click('#cat-nieuw');
  await page.fill('#cf-naam', 'Koffie');
  await page.fill('#cf-merk', 'lavazza');
  await page.fill('#cf-inhoud', '1');
  await page.selectOption('#cf-inhoud-eenheid', 'kg');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.catalogus.find((c) => c.naam === 'Koffie').varianten.length === 3, 'koffie: zelfde merk en inhoud niet dubbel');
  await page.click('#paneel [data-sluit]');
  // aan voorraad toevoegen vanuit een variant neemt merk en inhoud over
  await page.click('[data-cat="Koffie"]:has-text("Lavazza")');
  await page.click('#c-voorraad');
  controle((await page.inputValue('#pf-merk')) === 'Lavazza' && (await page.inputValue('#pf-inhoud')) === '1' && (await page.inputValue('#pf-inhoud-eenheid')) === 'kg', 'variant: merk en inhoud ingevuld bij aan voorraad toevoegen');
  await page.click('#pf button[type=submit]');
  await page.waitForTimeout(250);
  await page.goto(basis + '#catalogus');
  await page.reload();
  const inHuis = await page.$$eval('[data-cat="Koffie"]', (l) => l.map((x) => x.textContent.includes('in huis')));
  controle(inHuis.filter(Boolean).length === 1, 'variant: alleen Lavazza staat in huis');
  // voorraadlijst: zoekresultaten per merk, met het merk achter de naam
  await api('POST', 'producten', { naam: 'Koffie', hoeveelheid: 1, eenheid: 'stuks', merk: 'Douwe', inhoud: 500, inhoud_eenheid: 'g' });
  await page.goto(basis + '#voorraad');
  await page.reload();
  await page.fill('#zoek-voorraad', 'koffie');
  const gevonden = await page.$$eval('[data-groep]', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  controle(gevonden.length === 2 && gevonden.includes('Koffie · Douwe') && gevonden.includes('Koffie · Lavazza'), 'voorraad: merk in de zoekresultaten: ' + gevonden.join(' | '));
  await page.goto(basis + '#catalogus');
  await page.reload();
  // bewerken van één variant laat de andere staan
  await page.click('[data-cat="Koffie"]:has-text("250 g")');
  await page.click('#c-bewerk');
  controle((await page.inputValue('#cf-inhoud')) === '250' && (await page.inputValue('#cf-merk')) === 'Douwe', 'variant bewerken: velden van die variant');
  await page.fill('#cf-inhoud', '200');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const kv = d.catalogus.find((c) => c.naam === 'Koffie').varianten.map((v) => `${v.merk} ${v.inhoud} ${v.inhoud_eenheid}`).sort();
  controle(JSON.stringify(kv) === JSON.stringify(['Douwe 200 g', 'Douwe 500 g', 'Lavazza 1 kg']), 'variant bewerken: alleen die variant aangepast');
  await page.click('#paneel [data-sluit]');
  // boodschap: elke variant is een aparte keuze, met merk en inhoud (en bovenaan "elk merk")
  await page.goto(basis + '#boodschappen');
  await page.reload();
  await page.click('#b-menu');
  await page.fill('#bt-zoek', 'koffie');
  await page.dispatchEvent('#bt-zoek', 'input');
  controle((await page.$$('#bt-lijst [data-kies]')).length === 4, 'boodschap: drie keuzes voor koffie, plus elk merk');
  await page.click('#bt-lijst [data-kies]:has-text("Douwe"):has-text("à 500 g")');
  controle((await page.inputValue('#bt-merk')) === 'Douwe' && (await page.inputValue('#bt-inhoud')) === '500', 'boodschap: merk en inhoud van de gekozen variant ingevuld');

  // prijzen per merk (en per inhoud) in het venster Prijzen
  await page.goto(basis + '#catalogus');
  await page.reload();
  await page.click('[data-cat="Koffie"]:has-text("Lavazza")');
  await page.click('#c-prijzen');
  controle(!!(await page.$('.pz-groep[data-merk="Lavazza"][data-inhoud="1"]')) && !!(await page.$('.pz-groep[data-merk="Douwe"][data-inhoud="500"]')), 'prijzen: een blok per merk en inhoud');
  controle((await page.textContent('.pz-groep[data-merk="Lavazza"] .pz-groep-titel')).includes('Lavazza'), 'prijzen: merk in de titel');
  // prijs invullen bij een winkel: een vaste winkel uit Instellingen, of een nieuwe regel
  const prijsZetten = async (groep, winkel, prijs) => {
    const vast = await page.$(`${groep} .prijs-rij[data-winkel="${winkel}"] .pz-prijs`);
    if (vast) return vast.fill(prijs);
    await page.click(`${groep} .pz-erbij`);
    await page.fill(`${groep} .pz-winkel >> nth=-1`, winkel);
    await page.fill(`${groep} .prijs-rij:last-child .pz-prijs`, prijs);
  };
  await prijsZetten('.pz-groep[data-merk="Lavazza"]', 'Colruyt', '9');
  await prijsZetten('.pz-groep[data-merk="Douwe"][data-inhoud="500"]', 'Colruyt', '5');
  // een merk zonder inhoud toevoegen
  await page.click('#pz-nieuw summary');
  await page.fill('#pz-nieuw-merk', 'Huismerk');
  await page.click('#pz-nieuw-ok');
  controle(!!(await page.$('.pz-groep[data-merk="Huismerk"]')), 'prijzen: blok voor een nieuw merk toegevoegd');
  await prijsZetten('.pz-groep[data-merk="Huismerk"]', 'Aldi', '3');
  await page.click('#pz-form button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const kp = d.catalogus.find((c) => c.naam === 'Koffie').prijzen;
  controle(kp.some((p) => p.merk === 'Lavazza' && p.inhoud === 1 && p.inhoud_eenheid === 'kg' && p.prijs === 9)
    && kp.some((p) => p.merk === 'Douwe' && p.inhoud === 500 && p.prijs === 5)
    && kp.some((p) => p.merk === 'Huismerk' && !p.inhoud && p.prijs === 3 && p.winkel === 'Aldi'), 'prijzen: per merk bewaard');
  controle((await page.textContent('#paneel .prijzen-blok')).includes('Lavazza'), 'prijzen: overzicht per merk');
  // in de catalogus-lijst: per merk en inhoud de goedkoopste prijs
  await page.click('#paneel [data-sluit]');
  const catRegels = await page.$$eval('[data-cat="Koffie"]', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  controle(catRegels.some((t) => t.includes('Lavazza') && t.includes('€ 9,00 per stuk bij Colruyt'))
    && catRegels.some((t) => t.includes('Douwe') && t.includes('500 g') && t.includes('€ 5,00 per stuk bij Colruyt'))
    && catRegels.some((t) => t.includes('Douwe') && t.includes('200 g') && !t.includes('€')), 'catalogus: prijs per merk in de lijst: ' + catRegels.join(' | '));
  await page.click('[data-cat="Koffie"]:has-text("Lavazza")');
  // het formulier toont de prijs van het merk en de inhoud die erin staan
  await page.click('#c-voorraad');
  controle((await page.textContent('#pf-prijzen summary')).includes('Lavazza') && (await page.inputValue('#pf-prijzen .prijs-rij[data-winkel="Colruyt"] .pz-prijs')) === '9,00', 'formulier: prijs van dit merk ingevuld');
  await page.fill('#pf-merk', 'Huismerk');
  await page.fill('#pf-inhoud', '');
  await page.dispatchEvent('#pf-inhoud', 'input');
  controle((await page.$$eval('#pf-prijzen .pz-prijs', (l) => l.map((x) => x.value))).includes('3,00'), 'formulier: ander merk, andere prijs');
  await page.click('#paneel [data-sluit]');
  // boodschappen: de prijs van het merk dat je koopt
  await api('POST', 'boodschappen', { naam: 'Koffie', hoeveelheid: 1, eenheid: 'stuks', merk: 'Lavazza', inhoud: 1, inhoud_eenheid: 'kg' });
  await api('POST', 'boodschappen', { naam: 'Koffie', hoeveelheid: 2, eenheid: 'stuks', merk: 'Huismerk' });
  await page.goto(basis + '#boodschappen');
  await page.reload();
  const lijstTekst = (await page.textContent('#inhoud')).replace(/\s+/g, ' ');
  controle(lijstTekst.includes('Colruyt · € 9,00') && lijstTekst.includes('Aldi · € 6,00'), 'boodschappen: prijs per merk berekend');
  // prijzen per merk op de lijst: 2 stuks koffie van elk merk met een prijs (zonder inhoud: alleen Huismerk heeft er een)
  d = await api('GET', 'alles');
  const huis = d.boodschappen.find((b) => b.naam === 'Koffie' && b.merk === 'Huismerk');
  await api('PUT', `boodschappen/${huis.id}`, { inhoud: 500, inhoud_eenheid: 'g' });
  await page.reload();
  const knoppen = await page.$$eval(`[data-merkkies="${huis.id}"]`, (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  controle(knoppen.length === 2 && knoppen[0].startsWith('Huismerk € 6,00') && knoppen[1].startsWith('Douwe € 10,00'), 'boodschappen: prijzen per merk onder de boodschap: ' + knoppen.join(' | '));
  await page.click(`[data-merkkies="${huis.id}"][data-merk="Douwe"]`);
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.boodschappen.find((b) => b.id === huis.id).merk === 'Douwe', 'boodschappen: merk kiezen via de prijs');
  controle(!!(await page.$(`[data-merkkies="${huis.id}"][data-merk="Douwe"].aan`)), 'boodschappen: gekozen merk aangeduid');

  // voorraad toevoegen: een gekende naam typen vult geen merk of inhoud in; kiezen uit de catalogus wel
  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#nieuw');
  await page.click('#nieuw');
  await page.fill('#pf-naam', 'Koffie');
  await page.dispatchEvent('#pf-naam', 'change');
  controle((await page.inputValue('#pf-merk')) === '' && (await page.inputValue('#pf-inhoud')) === '', 'toevoegen: gekende naam, merk en inhoud blijven leeg');
  const keuzes = await page.$$eval('#pf-catkeuze [data-catkies]', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  controle(keuzes.length === 3 && keuzes.some((t) => t.includes('Lavazza') && t.includes('1 kg')), 'toevoegen: varianten uit de catalogus om te kiezen: ' + keuzes.join(' | '));
  await page.click('#pf-catkeuze [data-catkies]:has-text("Lavazza")');
  controle((await page.inputValue('#pf-merk')) === 'Lavazza' && (await page.inputValue('#pf-inhoud')) === '1' && (await page.inputValue('#pf-inhoud-eenheid')) === 'kg', 'toevoegen: gekozen variant ingevuld');
  controle(await page.isHidden('#pf-catkeuze'), 'toevoegen: keuzelijst weg na kiezen');
  await page.fill('#pf-naam', 'lava');
  controle((await page.$$('#pf-catkeuze [data-catkies]')).length === 1, 'toevoegen: zoeken op merk');
  await page.click('#paneel [data-sluit]');

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

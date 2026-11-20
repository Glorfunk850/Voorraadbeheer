// Grote verpakking, thuis verdeeld over voorraadpotten (bv. een zak rijst van 5 kg over 4 potten).
// Controleert: instellen in het productformulier, de grote verpakking op de lijst onder het minimum,
// zelf op de lijst zetten, en bij het afronden de potten bijtellen (of de verpakking zelf in de voorraad zetten).
// Ook: een doos met losse zakjes (vanillepudding), per zakje gebruikt en per doos bijgekocht.
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

  // ---- doos met losse zakjes (bv. vanillepudding): voorraad per zakje, bijkopen per doos
  await api('POST', 'producten', { naam: 'Vanillepudding', hoeveelheid: 4, eenheid: 'zak', inhoud: 40, inhoud_eenheid: 'g', locatie: 'Kast' });
  d = await api('GET', 'alles');
  const pud = d.producten.find((x) => x.naam === 'Vanillepudding');
  const puddingOpenen = async () => {
    await herladen('#voorraad', '#zoek-voorraad');
    await page.fill('#zoek-voorraad', 'Vanillepudding');
    await page.click(`[data-groep="${pud.id}"]`);
  };
  await puddingOpenen();
  controle(!(await page.$('#groot-erbij')), 'zonder grote verpakking: geen knop "Doos erbij"');
  await page.click('#bewerk');
  await page.waitForSelector('#pf-min');
  await page.click('label:has(#pf-groot-aan)');
  controle((await page.textContent('#pf-groot-potten-titel')) === 'Aantal zakjes erin', `titel in zakjes (${await page.textContent('#pf-groot-potten-titel')})`);
  await page.fill('#pf-min', '1');
  await page.selectOption('#pf-groot-eenheid', 'doos');
  await page.fill('#pf-groot-inhoud', '');
  await page.fill('#pf-groot-potten', '4');
  await page.click('#pf button[type="submit"]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  p = d.producten.find((x) => x.id === pud.id);
  controle(JSON.stringify(p.grootverpakking) === '{"eenheid":"doos","potten":4}' && p.minimum === 1, `doos met 4 zakjes bewaard (${JSON.stringify(p.grootverpakking)})`);

  // een zakje gebruikt met − in het productpaneel
  await puddingOpenen();
  await page.waitForSelector('#groot-erbij');
  controle((await page.textContent('#lijst-groot')).includes('1 doos · met 4 zakjes'), `knop toont de doos (${await page.textContent('#lijst-groot')})`);
  controle((await page.textContent('#groot-erbij')).replace(/\s+/g, ' ').includes('Doos erbij +4 zakjes'), `knop "Doos erbij" (${await page.textContent('#groot-erbij')})`);
  await page.click('#min');
  await page.waitForTimeout(200);
  d = await api('GET', 'alles');
  controle(d.producten.find((x) => x.id === pud.id).hoeveelheid === 3, '− : nog 3 zakjes');

  // recept met 1 zakje vanillepudding koken
  d = await api('POST', 'recepten', { titel: 'Pudding', personen: 2, ingredienten: [{ naam: 'vanillepudding', hoeveelheid: 1, eenheid: 'zak' }] });
  await page.goto(basis + '#recepten'); await page.reload();
  await page.waitForSelector(`[data-recept="${d.nieuw_id}"]`);
  await page.click(`[data-recept="${d.nieuw_id}"]`);
  await page.click('#gekookt');
  await page.waitForSelector('.kook-rij input');
  controle((await page.inputValue('.kook-rij input')) === '1', `recept stelt 1 zakje voor (${await page.inputValue('.kook-rij input')})`);
  await page.click('#aftrekken');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.producten.find((x) => x.id === pud.id).hoeveelheid === 2, 'na het koken: nog 2 zakjes');
  controle(!d.boodschappen.some((x) => x.naam === 'Vanillepudding'), 'boven het minimum: niets op de lijst');

  // laatste zakjes op: 1 doos op de lijst
  await api('POST', `producten/${pud.id}/verbruik`, { hoeveelheid: 2 });
  d = await api('GET', 'alles');
  b = d.boodschappen.filter((x) => x.naam === 'Vanillepudding');
  controle(b.length === 1 && b[0].hoeveelheid === 1 && b[0].eenheid === 'doos' && b[0].potten_voor === pud.id, `1 doos op de lijst (${JSON.stringify(b)})`);

  // afronden: 4 zakjes voorgesteld en bijgeteld
  await api('PUT', `boodschappen/${b[0].id}`, { afgevinkt: 1 });
  await herladen('#boodschappen', '#klaar');
  await page.click('#klaar');
  await page.waitForSelector('.af-potten');
  controle((await page.textContent('.af-potten-veld')).includes('Hoeveel zakjes zitten erin?'), 'vraag in zakjes bij afronden');
  controle((await page.inputValue('.af-potten')) === '4', '4 zakjes voorgesteld');
  await page.click('#af-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const pr = d.producten.filter((x) => x.naam === 'Vanillepudding');
  controle(pr.length === 1 && pr[0].hoeveelheid === 4 && pr[0].eenheid === 'zak', `4 zakjes in huis (${pr.map((x) => x.hoeveelheid + ' ' + x.eenheid).join(', ')})`);

  // zonder lijst een doos gekocht: Doos erbij
  await puddingOpenen();
  await page.click('#groot-erbij');
  await page.waitForTimeout(200);
  d = await api('GET', 'alles');
  controle(d.producten.find((x) => x.id === pud.id).hoeveelheid === 8, 'Doos erbij: 8 zakjes');

  // ---- in de catalogus bewerken: dezelfde instelling, geldt voor het hele product
  const catOpenen = async (naam) => {
    await herladen('#catalogus', '#zoek-catalogus');
    await page.fill('#zoek-catalogus', naam);
    await page.click(`[data-cat="${naam}"]`);
    await page.click('#c-bewerk');
    await page.waitForSelector('#cf-groot-aan', { state: 'attached' });
  };
  await catOpenen('Vanillepudding');
  controle(await page.isChecked('#cf-groot-aan') && (await page.inputValue('#cf-groot-eenheid')) === 'doos' && (await page.inputValue('#cf-groot-potten')) === '4',
    'catalogus toont de doos met 4 zakjes van de voorraad');
  controle((await page.textContent('#cf-groot-potten-titel')) === 'Aantal zakjes erin', 'titel in zakjes in de catalogus');

  await api('POST', 'producten', { naam: 'Chocoladepudding', hoeveelheid: 3, eenheid: 'zak', locatie: 'Kast' });
  await catOpenen('Chocoladepudding');
  controle(!(await page.isChecked('#cf-groot-aan')) && await page.isHidden('#cf-groot'), 'nog geen grote verpakking: vinkje uit');
  await page.click('label:has(#cf-groot-aan)');
  controle(await page.isChecked('#cf-alle-aan') && (await page.inputValue('#cf-alle')) === '1', 'vinkje aan: minimum voor alle merken samen 1 voorgesteld');
  await page.selectOption('#cf-groot-eenheid', 'doos');
  await page.fill('#cf-groot-inhoud', '');
  await page.fill('#cf-groot-potten', '6');
  await page.click('#cf button[type="submit"]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const choc = d.producten.find((x) => x.naam === 'Chocoladepudding'), cChoc = d.catalogus.find((x) => x.naam === 'Chocoladepudding');
  controle(JSON.stringify(cChoc.grootverpakking) === '{"eenheid":"doos","potten":6}' && cChoc.minimum === 1, `bewaard in de catalogus (${JSON.stringify(cChoc.grootverpakking)}, minimum ${cChoc.minimum})`);
  controle(JSON.stringify(choc.grootverpakking) === '{"eenheid":"doos","potten":6}', 'ook bij de voorraad gezet');
  controle((await page.textContent('#paneel')).includes('bijkopen per doos · met 6 zakjes'), 'catalogusproduct toont de doos');
  await api('POST', `producten/${choc.id}/verbruik`, { hoeveelheid: 3 });
  d = await api('GET', 'alles');
  b = d.boodschappen.filter((x) => x.naam === 'Chocoladepudding');
  controle(b.length === 1 && b[0].eenheid === 'doos' && b[0].hoeveelheid === 1 && b[0].potten_voor === choc.id, `op: 1 doos op de lijst (${JSON.stringify(b)})`);

  // nieuwe verpakking toevoegen: de doos staat al ingevuld
  await api('PUT', `producten/${choc.id}`, { hoeveelheid: 2 });
  await herladen('#voorraad', '#zoek-voorraad');
  await page.fill('#zoek-voorraad', 'Chocoladepudding');
  await page.click(`[data-groep="${choc.id}"]`);
  await page.click('#erbij');
  await page.waitForSelector('#pf-groot-aan', { state: 'attached' });
  controle(await page.isChecked('#pf-groot-aan') && (await page.inputValue('#pf-groot-potten')) === '6', 'nieuwe verpakking: grote verpakking al ingevuld');

  // in de catalogus uitzetten: ook uit bij de voorraad
  await catOpenen('Chocoladepudding');
  await page.click('label:has(#cf-groot-aan)');
  await page.click('#cf button[type="submit"]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(!d.catalogus.find((x) => x.naam === 'Chocoladepudding').grootverpakking && !d.producten.find((x) => x.naam === 'Chocoladepudding').grootverpakking,
    'uitgezet in de catalogus: ook weg bij de voorraad');

  controle(!jsFouten.length, `geen JavaScript-fouten (${jsFouten.join(' | ')})`);
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en)`); process.exit(1); }
  console.log('\nAlles in orde');
}
main().catch((e) => { console.error(e); process.exit(1); });

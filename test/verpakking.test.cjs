// Kleine en grote verpakkingen: nooit samengeteld, elk een eigen minimum, terug op de lijst in dezelfde grootte.
//
// Uitvoeren:  node test/verpakking.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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
  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#inhoud h1');
  const N = 'Shampoo';
  const van = (d, m) => d.producten.filter((p) => p.naam === N && (p.verpakking || '') === m);
  const lijst = (d) => d.boodschappen.filter((x) => x.naam === N && !x.afgevinkt);

  // via het formulier: een grote fles toevoegen (keuze Groot onder Merk) met minimum 2
  await page.click('#nieuw');
  await page.fill('#pf-naam', N);
  await page.click('#pf-maat [data-w="groot"]');
  await page.fill('#pf-hv', '3');
  await page.click('#pf details.meer summary');
  await page.fill('#pf-min', '2');
  await page.click('#pf button[type=submit]');
  await page.waitForTimeout(250);
  let d = await api('GET', 'alles');
  controle(van(d, 'groot').length === 1 && van(d, 'groot')[0].hoeveelheid === 3 && van(d, 'groot')[0].minimum === 2, 'grote verpakking via het formulier bewaard');
  // kleine flesjes, minimum 4
  await api('POST', 'producten', { naam: N, hoeveelheid: 5, eenheid: 'stuks', verpakking: 'klein', minimum: 4 });
  d = await api('GET', 'alles');
  const c = d.catalogus.find((x) => x.naam === N);
  controle(c.varianten.length === 2 && c.varianten.some((v) => v.verpakking === 'groot') && c.varianten.some((v) => v.verpakking === 'klein'), `klein en groot staan apart in de catalogus (${JSON.stringify(c.varianten)})`);
  controle(!lijst(d).length, 'genoeg van beide: niets op de lijst');

  // 2 grote gebruikt: 1 groot over (minimum 2) -> 1 grote verpakking op de lijst; de 5 kleine tellen niet mee
  const g = van(d, 'groot')[0];
  await api('POST', `producten/${g.id}/verbruik`, { hoeveelheid: 2 });
  d = await api('GET', 'alles');
  let b = lijst(d);
  controle(b.length === 1 && b[0].verpakking === 'groot' && b[0].hoeveelheid === 1 && b[0].bron === 'minimum', `onder het minimum van groot: grote verpakking op de lijst (${JSON.stringify(b)})`);

  // kleine onder hun minimum: aparte boodschap, als kleine verpakking
  const k = van(d, 'klein')[0];
  await api('POST', `producten/${k.id}/verbruik`, { hoeveelheid: 3 });
  d = await api('GET', 'alles');
  b = lijst(d);
  const bk = b.find((x) => x.verpakking === 'klein'), bg = b.find((x) => x.verpakking === 'groot');
  controle(b.length === 2 && bk && bk.hoeveelheid === 2 && bg && bg.hoeveelheid === 1, `klein en groot elk apart op de lijst (${JSON.stringify(b)})`);

  // zelf een grote toevoegen: telt bij de grote boodschap, niet bij de kleine
  await api('POST', 'boodschappen', { naam: N, hoeveelheid: 1, eenheid: 'stuks', verpakking: 'groot' });
  d = await api('GET', 'alles');
  b = lijst(d);
  controle(b.length === 2 && b.find((x) => x.verpakking === 'groot').hoeveelheid === 2 && b.find((x) => x.verpakking === 'klein').hoeveelheid === 2, 'boodschappen worden alleen met dezelfde grootte samengeteld');

  // na het winkelen: de grote bij de grote, de kleine bij de kleine
  for (const x of b) await api('PUT', `boodschappen/${x.id}`, { afgevinkt: 1 });
  await page.goto(basis + '#boodschappen'); await page.reload(); await page.waitForSelector('#inhoud h1');
  controle((await page.$$('#inhoud .maat-groot')).length === 1 && (await page.$$('#inhoud .maat-klein')).length === 1, 'op de lijst staat klein en groot achter de naam');
  await page.click('#klaar');
  await page.waitForSelector('#af-ok');
  await page.click('#af-ok');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(van(d, 'groot').length === 1 && van(d, 'groot')[0].hoeveelheid === 3, `2 grote bijgeteld bij de grote (${JSON.stringify(van(d, 'groot').map((p) => p.hoeveelheid))})`);
  controle(van(d, 'klein').length === 1 && van(d, 'klein')[0].hoeveelheid === 4, `2 kleine bijgeteld bij de kleine (${JSON.stringify(van(d, 'klein').map((p) => p.hoeveelheid))})`);
  controle(!lijst(d).length, 'na het winkelen niets meer op de lijst');

  // minimum voor alle merken samen, alleen voor grote verpakkingen (via de catalogus)
  await api('PUT', `producten/${van(d, 'groot')[0].id}`, { minimum: 0 });
  await api('PUT', `producten/${van(d, 'klein')[0].id}`, { minimum: 0 });
  await page.goto(basis + '#catalogus'); await page.reload(); await page.waitForSelector('#inhoud h1');
  const rijen = await page.$$eval(`[data-cat="${N}"]`, (r) => r.map((x) => ({ t: x.textContent, v: x.dataset.var })));
  const gr = rijen.find((x) => x.t.includes('groot'));
  await page.click(`[data-cat="${N}"][data-var="${gr.v}"]`);
  await page.click('#c-bewerk');
  controle((await page.textContent('#cf-alle-titel')).includes('grote verpakkingen'), 'catalogus: minimum voor alle merken samen geldt voor grote verpakkingen');
  await page.click('label:has(#cf-alle-aan)');
  await page.fill('#cf-alle', '5');
  await page.click('#cf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const c2 = d.catalogus.find((x) => x.naam === N);
  controle(c2.minimum_groot === 5 && !c2.minimum && !c2.minimum_klein, `minimum alleen voor groot bewaard (${JSON.stringify({ m: c2.minimum, g: c2.minimum_groot, k: c2.minimum_klein })})`);
  b = lijst(d);
  controle(b.length === 1 && b[0].verpakking === 'groot' && b[0].hoeveelheid === 2, `3 grote in huis, minimum 5: 2 grote op de lijst; de 4 kleine tellen niet (${JSON.stringify(b)})`);

  // kleine verpakking kiezen in het formulier: het vinkje toont het minimum van de kleine (geen)
  await page.click('#c-bewerk');
  await page.click('#cf-maat [data-w="klein"]');
  controle(!(await page.isChecked('#cf-alle-aan')) && (await page.textContent('#cf-alle-titel')).includes('kleine'), 'klein gekozen: vinkje toont het minimum van de kleine verpakkingen');
  await page.click('#paneel [data-sluit]');

  // bestaande gegevens zonder grootte werken zoals vroeger
  await api('POST', 'producten', { naam: 'Rijst', hoeveelheid: 1, eenheid: 'stuks', minimum: 2 });
  d = await api('GET', 'alles');
  b = d.boodschappen.filter((x) => x.naam === 'Rijst');
  controle(b.length === 1 && !b[0].verpakking && b[0].hoeveelheid === 1, 'zonder grootte: minimum zoals vroeger');

  // Overblijfsel van vroeger: een minimum voor alle merken samen ZONDER grootte (3), en later een minimum voor de kleine
  // verpakkingen (1). Alle Maïs is klein en er is genoeg klein in huis: Maïs mag NIET op de lijst
  // (het oude minimum gold voor "zonder grootte", en daarvan heb je niets).
  const mais = { naam: 'Maïs', eenheid: 'blik', inhoud: 140, inhoud_eenheid: 'g', uitlekgewicht: true, categorie: 'Conserven' };
  d = await api('POST', 'producten', { ...mais, hoeveelheid: 1, merk: 'Jumbo', catalogus_minimum: 3 });
  controle(d.boodschappen.some((x) => x.naam === 'Maïs'), 'zonder grootte, 1 blik, minimum 3 alle merken samen: op de lijst');
  const jumbo = d.producten.find((x) => x.naam === 'Maïs');
  d = await api('PUT', `producten/${jumbo.id}`, { verpakking: 'klein', catalogus_minimum: 1 });
  d = await api('POST', 'producten', { ...mais, hoeveelheid: 2, merk: 'Noliko', inhoud: 230, verpakking: 'klein' });
  let cm = d.catalogus.find((x) => x.naam === 'Maïs');
  controle(cm.varianten.length === 2 && cm.varianten.every((v) => v.verpakking === 'klein'), `grootte verbeterd naar klein: geen variant zonder grootte achtergebleven (${JSON.stringify(cm.varianten)})`);
  controle(cm.minimum === 3 && cm.minimum_klein === 1, `catalogus: oud minimum 3 (zonder grootte) en minimum 1 klein (${cm.minimum}, ${cm.minimum_klein})`);
  controle(!d.boodschappen.some((x) => x.naam === 'Maïs'), `alles klein, 3 in huis, minimum klein 1: Maïs niet op de lijst (${JSON.stringify(d.boodschappen.filter((x) => x.naam === 'Maïs'))})`);
  // klein zakt onder zijn minimum: wel op de lijst, als kleine verpakking
  for (const p of d.producten.filter((x) => x.naam === 'Maïs')) d = await api('POST', `producten/${p.id}/verbruik`, { hoeveelheid: p.hoeveelheid });
  b = d.boodschappen.filter((x) => x.naam === 'Maïs');
  controle(b.length === 1 && b[0].verpakking === 'klein' && b[0].hoeveelheid === 1, `geen klein meer in huis: 1 kleine op de lijst (${JSON.stringify(b)})`);
  // komt er toch weer Maïs zonder grootte bij, dan geldt het oude minimum daarvoor opnieuw
  d = await api('POST', 'producten', { ...mais, hoeveelheid: 1, merk: 'Bonduelle' });
  b = d.boodschappen.filter((x) => x.naam === 'Maïs' && !x.verpakking);
  controle(b.length === 1 && b[0].hoeveelheid === 2, `Maïs zonder grootte: oud minimum 3 geldt weer, 2 op de lijst (${JSON.stringify(b)})`);

  // Verkeerde boodschap uit een oudere versie (bv. uit een back-up) verdwijnt vanzelf, ook na opnieuw openen
  const oud = await api('GET', 'alles');
  oud.producten = oud.producten.filter((x) => !(x.naam === 'Maïs' && x.merk === 'Bonduelle'));
  for (const p of oud.producten) if (p.naam === 'Maïs') p.hoeveelheid = 2;
  // ook een achtergebleven variant zonder grootte (van een oudere versie) naast dezelfde kleine
  const cv = oud.catalogus.find((x) => x.naam === 'Maïs');
  cv.varianten = [...cv.varianten.filter((v) => v.merk !== 'Bonduelle'), { merk: 'Jumbo', inhoud: 140, inhoud_eenheid: 'g', uitlekgewicht: true }];
  oud.boodschappen = [...oud.boodschappen.filter((x) => x.naam !== 'Maïs'),
    { id: 999001, naam: 'Maïs', hoeveelheid: 3, eenheid: 'blik', minimum_maat: '', product_id: null, afgevinkt: 0, bron: 'minimum' }];
  d = await api('POST', 'import', oud);
  controle(!d.boodschappen.some((x) => x.naam === 'Maïs'), `back-up met verkeerde Maïs op de lijst: na terugzetten weg (${JSON.stringify(d.boodschappen.filter((x) => x.naam === 'Maïs'))})`);
  cm = d.catalogus.find((x) => x.naam === 'Maïs');
  controle(cm.varianten.length === 2 && cm.varianten.every((v) => v.verpakking === 'klein'), `achtergebleven variant zonder grootte opgeruimd (${JSON.stringify(cm.varianten)})`);
  await page.reload(); await page.waitForSelector('#inhoud h1');
  d = await api('GET', 'alles');
  controle(!d.boodschappen.some((x) => x.naam === 'Maïs'), 'ook na opnieuw openen niet op de lijst');

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

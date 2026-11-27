// Minimum per grootte: een voorraadregel telt mee in de grootte van haar variant in de catalogus.
// Bv. schorseneren: Everyday à 320 g werd in de catalogus "groot", maar de voorraadregel bleef zonder grootte; dan telde
// ze niet mee voor het minimum van 3 grote, en gold er nog een oud minimum van 4 voor alle groottes.
//
// Uitvoeren:  node test/minimum-grootte.test.cjs   (vereist Playwright)
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
  await page.goto(basis + '#boodschappen');
  await page.waitForSelector('#inhoud h1');
  const lijst = (d, n) => d.boodschappen.filter((b) => b.naam === n && !b.afgevinkt).map((b) => `${b.hoeveelheid} ${b.verpakking || '-'}`).sort();

  // 1. Zoals bij schorseneren: gegevens van vroeger. De variant werd in de catalogus "groot", de voorraadregel bleef
  //    zonder grootte, en er staat nog een oud minimum van 4 voor alle groottes naast het minimum van 3 grote.
  const N = 'Schorseneren';
  const v = { naam: N, eenheid: 'bokaal', inhoud: 320, inhoud_eenheid: 'g', uitlekgewicht: true };
  await api('POST', 'import', { producten: [{ id: 'p1', ...v, merk: 'Everyday', hoeveelheid: 2, minimum: 0 }],
    catalogus: [{ naam: N, eenheid: 'bokaal', minimum: 4, minimum_groot: 3, aantal: 2,
      varianten: [{ merk: 'Everyday', inhoud: 320, inhoud_eenheid: 'g', uitlekgewicht: true, verpakking: 'groot' },
        { merk: "King's Crown", inhoud: 320, inhoud_eenheid: 'g', uitlekgewicht: true, verpakking: 'groot' }] }],
    boodschappen: [{ id: 'b1', naam: N, hoeveelheid: 3, eenheid: 'bokaal', verpakking: 'groot', minimum_maat: 'groot', bron: 'minimum', afgevinkt: 0 },
      { id: 'b2', naam: N, hoeveelheid: 2, eenheid: 'bokaal', minimum_maat: '', bron: 'minimum', afgevinkt: 0 }],
    recepten: [], planning: [] });
  let d = await api('GET', 'alles');
  controle(d.producten.find((p) => p.naam === N)?.verpakking === 'groot', 'voorraadregel krijgt de grootte van haar variant in de catalogus (groot)');
  controle(JSON.stringify(lijst(d, N)) === JSON.stringify(['1 groot']), `minimum 3 grote, 2 in huis: 1 grote bokaal op de lijst (${lijst(d, N).join(', ')})`);
  // het oude minimum van 4 blijft bewaard (het geldt weer als je iets zonder grootte koopt), maar staat niet meer bij het product
  await page.goto(basis + '#catalogus'); await page.waitForSelector('#inhoud h1');
  await page.reload(); await page.waitForSelector('#inhoud h1');
  await page.click(`[data-cat="${N}"][data-var="0"]`);
  await page.waitForTimeout(300);
  const info = await page.textContent('.paneel, .blad, dialog[open], #paneel').catch(() => '');
  controle(info.includes('minimum 3 bokaal grote verpakkingen') && !info.includes('minimum 4'), `bij het product: alleen "minimum 3 … grote verpakkingen" (${(/minimum[^·]*/g.exec(info) || [''])[0].trim()})`);
  controle(!info.includes('Nu niet in huis'), `de 2 bokalen tellen als in huis (${info.replace(/\s+/g, ' ').slice(0, 120)})`);
  await page.goto(basis + '#boodschappen'); await page.waitForSelector('#inhoud h1');

  // 2. Voortaan: de grootte van een variant in de catalogus veranderen → de voorraadregels van die variant volgen
  const M = 'Rode kool';
  await api('POST', 'producten', { naam: M, hoeveelheid: 1, eenheid: 'bokaal', merk: 'Boni Bio', inhoud: 680, inhoud_eenheid: 'g' });
  await api('PUT', 'catalogus', { naam: M, oudeNaam: M, merk: 'Boni Bio', inhoud: 680, inhoud_eenheid: 'g', verpakking: 'groot', minimum: 2,
    oudeVariant: { merk: 'Boni Bio', inhoud: 680, inhoud_eenheid: 'g' } });
  d = await api('GET', 'alles');
  controle(d.producten.find((p) => p.naam === M)?.verpakking === 'groot', 'catalogus: grootte op groot gezet → voorraadregel ook groot');
  controle(d.catalogus.find((x) => x.naam === M).minimum_groot === 2, 'minimum 2 grote bewaard');
  controle(JSON.stringify(lijst(d, M)) === JSON.stringify(['1 groot']), `minimum 2 grote, 1 in huis: 1 grote bokaal op de lijst (${lijst(d, M).join(', ')})`);

  // 3. Een regel met een eigen variant zonder grootte blijft zonder grootte
  const K = 'Kikkererwten';
  await api('POST', 'producten', { naam: K, hoeveelheid: 1, eenheid: 'blik', merk: 'Jumbo', inhoud: 400, inhoud_eenheid: 'g' });
  await api('POST', 'catalogus', { naam: K, eenheid: 'blik', merk: 'Jumbo', inhoud: 400, inhoud_eenheid: 'g', verpakking: 'groot' });
  await page.reload(); await page.waitForSelector('#inhoud h1');
  d = await api('GET', 'alles');
  controle(!d.producten.find((p) => p.naam === K)?.verpakking, 'regel met eigen variant zonder grootte blijft zonder grootte');

  // 4. Eén minimum per product: een minimum voor grote verpakkingen vervangt dat voor alle groottes, en omgekeerd
  const A = 'Ananas';
  await api('POST', 'producten', { naam: A, hoeveelheid: 1, eenheid: 'blik', merk: 'Del Monte' });
  await api('PUT', 'catalogus', { naam: A, oudeNaam: A, merk: 'Del Monte', minimum: 3, oudeVariant: { merk: 'Del Monte' } });
  await api('POST', 'catalogus', { naam: A, eenheid: 'blik', merk: 'Jumbo', verpakking: 'groot', minimum: 1, minimum_maat: 'groot' });
  d = await api('GET', 'alles');
  let ca = d.catalogus.find((x) => x.naam === A);
  controle(!ca.minimum && ca.minimum_groot === 1, `minimum alleen grote vervangt minimum voor alle groottes (${ca.minimum}, ${ca.minimum_groot})`);
  await api('PUT', 'catalogus', { naam: A, oudeNaam: A, merk: 'Jumbo', verpakking: 'groot', minimum: 2, minimum_maat: '', oudeVariant: { merk: 'Jumbo', verpakking: 'groot' } });
  d = await api('GET', 'alles');
  ca = d.catalogus.find((x) => x.naam === A);
  controle(ca.minimum === 2 && !ca.minimum_groot, `"alle groottes" gekozen bij een grote verpakking: minimum 2 voor alles (${ca.minimum}, ${ca.minimum_groot})`);
  controle(JSON.stringify(lijst(d, A)) === JSON.stringify(['1 -']), `alle groottes, minimum 2, 1 in huis: 1 op de lijst, de oude grote boodschap weg (${lijst(d, A).join(', ')})`);

  // 5. Doperwten zoals vroeger: minimum 3 voor alle groottes én 3 grote; 2 klein + 1 groot in huis
  const D = 'Doperwten';
  await api('POST', 'import', { producten: [
      { id: 'd1', naam: D, merk: 'All Seasons', hoeveelheid: 2, eenheid: 'stuks', inhoud: 280, inhoud_eenheid: 'g', verpakking: 'klein', minimum: 0 },
      { id: 'd2', naam: D, merk: 'Boni', hoeveelheid: 1, eenheid: 'bokaal', inhoud: 445, inhoud_eenheid: 'g', verpakking: 'groot', minimum: 0 },
      { id: 'l1', naam: 'Linzen', merk: '', hoeveelheid: 1, eenheid: 'blik', inhoud: 265, inhoud_eenheid: 'g', minimum: 0 }],
    catalogus: [{ naam: D, eenheid: 'stuks', minimum: 3, minimum_groot: 3, varianten: [
        { merk: 'Boni', inhoud: 445, inhoud_eenheid: 'g', verpakking: 'groot' }, { merk: 'All Seasons', inhoud: 280, inhoud_eenheid: 'g', verpakking: 'klein' }] },
      { naam: 'Linzen', eenheid: 'blik', minimum_groot: 3, varianten: [{ merk: "Plan't", inhoud: 265, inhoud_eenheid: 'g', verpakking: 'groot' }] }],
    boodschappen: [{ id: 'x1', naam: D, hoeveelheid: 2, eenheid: 'stuks', verpakking: 'groot', minimum_maat: 'groot', bron: 'minimum', afgevinkt: 0 },
      { id: 'x2', naam: D, hoeveelheid: 1, eenheid: 'stuks', minimum_maat: '', bron: 'minimum', afgevinkt: 0 }],
    recepten: [], planning: [] });
  d = await api('GET', 'alles');
  const cd = d.catalogus.find((x) => x.naam === D);
  controle(!cd.minimum && cd.minimum_groot === 3, `doperwten: alleen het minimum 3 grote blijft (${cd.minimum}, ${cd.minimum_groot})`);
  controle(JSON.stringify(lijst(d, D)) === JSON.stringify(['2 groot']), `doperwten: 2 grote op de lijst, geen tweede regel (${lijst(d, D).join(', ')})`);
  const lz = d.producten.find((p) => p.naam === 'Linzen');
  controle(!lz.merk && !lz.verpakking, `blik linzen zonder merk en grootte blijft zoals het is: die gegevens vul je zelf aan (${lz.merk || '-'}, ${lz.verpakking || '-'})`);

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

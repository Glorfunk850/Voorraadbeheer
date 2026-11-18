// Hetzelfde product meermaals op de boodschappenlijst, met een andere hoeveelheid en inhoud per verpakking.
// Controleert: toevoegen via het menu, samentellen bij dezelfde inhoud, prijs per regel, bewerken en afrekenen.
//
// Uitvoeren:  node test/boodschappen.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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
  await api('POST', 'catalogus', { naam: 'Rijst', eenheid: 'pak', inhoud: 500, inhoud_eenheid: 'g',
    prijzen: [{ winkel: 'Colruyt', prijs: 4, per: 'kg' }] });
  await page.reload();
  await page.waitForSelector('#b-menu');

  // via het menu: 2 pak à 500 g (voorgesteld uit de catalogus) en 1 pak à 1 kg
  const toevoegen = async (aantal, inhoud, eenheid) => {
    await page.fill('#bt-naam', 'Rijst');
    await page.dispatchEvent('#bt-naam', 'input');
    controle(await page.isVisible('#bt-inhoud'), 'inhoud is zichtbaar bij een pak');
    await page.fill('#bt-hv', aantal);
    if (inhoud) { await page.fill('#bt-inhoud', inhoud); await page.selectOption('#bt-inhoud-eenheid', eenheid); }
    await page.click('#bt-ok');
    await page.waitForTimeout(200);
  };
  await page.click('#b-menu');
  await page.waitForSelector('#bt-naam');
  await page.fill('#bt-naam', 'Rijst');
  await page.dispatchEvent('#bt-naam', 'input');
  controle((await page.inputValue('#bt-inhoud')) === '500', 'inhoud van het product wordt voorgesteld');
  await toevoegen('2');
  await toevoegen('1', '1', 'kg');
  await toevoegen('1', '500', 'g'); // zelfde inhoud: wordt bijgeteld
  let d = await api('GET', 'alles');
  let rijst = d.boodschappen.filter((b) => b.naam === 'Rijst');
  controle(rijst.length === 2, `rijst staat twee keer op de lijst (${rijst.length})`);
  const r500 = rijst.find((b) => b.inhoud === 500), r1 = rijst.find((b) => b.inhoud === 1);
  controle(r500 && r500.hoeveelheid === 3 && r500.inhoud_eenheid === 'g', '3 pak à 500 g (bijgeteld)');
  controle(r1 && r1.hoeveelheid === 1 && r1.inhoud_eenheid === 'kg', '1 pak à 1 kg apart');
  const onder = await page.textContent('#bt-lijst .rij:has-text("Rijst") small');
  controle(onder.includes('500 g') && onder.includes('1 kg'), `menu toont beide regels (${onder.trim()})`);
  await page.click('[data-sluit]');

  // op het scherm: twee regels, elk met eigen prijs
  await page.waitForTimeout(200);
  const regels = await page.$$eval('#inhoud .lijst .rij', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ')));
  controle(regels.length === 2 && regels.some((t) => t.includes('à 500 g') && t.includes('6,00')) && regels.some((t) => t.includes('à 1 kg') && t.includes('4,00')),
    `twee regels met eigen inhoud en prijs (${regels.join(' | ')})`);

  // bewerken: inhoud aanpassen
  await page.click(`[data-bewerk="${r1.id}"]`);
  await page.waitForSelector('#bb-inhoud');
  controle((await page.inputValue('#bb-inhoud')) === '1', 'bewerken toont de inhoud');
  await page.fill('#bb-inhoud', '2');
  await page.click('#bb-ok');
  await page.waitForTimeout(200);
  d = await api('GET', 'alles');
  controle(d.boodschappen.find((b) => b.id === r1.id).inhoud === 2, 'inhoud bewaard bij bewerken');

  // ook vanuit een recept of de API: een andere inhoud komt op een aparte regel
  await api('POST', 'boodschappen', { naam: 'Rijst', hoeveelheid: 1, eenheid: 'pak', inhoud: 5, inhoud_eenheid: 'kg' });
  d = await api('GET', 'alles');
  controle(d.boodschappen.filter((b) => b.naam === 'Rijst').length === 3, 'derde regel met 5 kg');

  // afrekenen: elke inhoud wordt een eigen voorraadregel
  for (const b of d.boodschappen) await api('PUT', `boodschappen/${b.id}`, { afgevinkt: true });
  d = await api('GET', 'alles');
  await api('POST', 'boodschappen/afrekenen', { items: d.boodschappen.map((b) => ({ id: b.id, hoeveelheid: b.hoeveelheid, eenheid: b.eenheid })) });
  d = await api('GET', 'alles');
  const voorraad = d.producten.filter((p) => p.naam === 'Rijst').map((p) => `${p.hoeveelheid}x${p.inhoud}${p.inhoud_eenheid}`).sort();
  controle(JSON.stringify(voorraad) === '["1x2kg","1x5kg","3x500g"]', `voorraad per inhoud (${voorraad.join(', ')})`);

  controle(!jsFouten.length, `geen JavaScript-fouten (${jsFouten.join(' | ')})`);
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en)`); process.exit(1); }
  console.log('\nAlles in orde');
}
main().catch((e) => { console.error(e); process.exit(1); });

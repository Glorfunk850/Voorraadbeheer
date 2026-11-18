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

  // minimumvoorraad per inhoud: pak à 500 g en pak à 5 kg hebben elk hun eigen minimum
  const id500 = d.producten.find((p) => p.naam === 'Rijst' && p.inhoud === 500).id;
  const id5 = d.producten.find((p) => p.naam === 'Rijst' && p.inhoud === 5).id;
  await api('PUT', `producten/${id500}`, { minimum: 2 }); // 3 in huis: genoeg
  d = await api('GET', 'alles');
  controle(!d.boodschappen.some((b) => b.naam === 'Rijst'), 'genoeg pakken à 500 g: niets op de lijst (de andere inhouden tellen niet mee)');
  await api('PUT', `producten/${id5}`, { minimum: 3 }); // 1 in huis: 2 tekort, ook al is er veel rijst in andere pakken
  d = await api('GET', 'alles');
  let auto = d.boodschappen.filter((b) => b.naam === 'Rijst' && b.bron === 'minimum');
  controle(auto.length === 1 && auto[0].hoeveelheid === 2 && auto[0].inhoud === 5 && auto[0].inhoud_eenheid === 'kg',
    `tekort aan pakken à 5 kg komt met die inhoud op de lijst (${JSON.stringify(auto)})`);
  await api('POST', `producten/${id500}/verbruik`, { hoeveelheid: 2 }); // nog 1 pak à 500 g, minimum 2
  d = await api('GET', 'alles');
  auto = d.boodschappen.filter((b) => b.naam === 'Rijst' && b.bron === 'minimum').map((b) => `${b.hoeveelheid}x${b.inhoud}${b.inhoud_eenheid}`).sort();
  controle(JSON.stringify(auto) === '["1x500g","2x5kg"]', `elke inhoud een eigen regel (${auto.join(', ')})`);
  await api('PUT', `producten/${id5}`, { minimum: 0 });
  d = await api('GET', 'alles');
  auto = d.boodschappen.filter((b) => b.naam === 'Rijst' && b.bron === 'minimum').map((b) => `${b.hoeveelheid}x${b.inhoud}${b.inhoud_eenheid}`);
  controle(JSON.stringify(auto) === '["1x500g"]', `minimum 5 kg weg: alleen die regel verdwijnt (${auto.join(', ')})`);

  // prijs per inhoud: een pak à 1 kg heeft een andere prijs per kg dan een pak à 500 g
  for (const b of (await api('GET', 'alles')).boodschappen) await api('DELETE', `boodschappen/${b.id}`);
  await api('POST', 'boodschappen', { naam: 'Rijst', hoeveelheid: 2, eenheid: 'pak', inhoud: 500, inhoud_eenheid: 'g' });
  await api('POST', 'boodschappen', { naam: 'Rijst', hoeveelheid: 1, eenheid: 'pak', inhoud: 1, inhoud_eenheid: 'kg' });
  await api('POST', 'prijzen', { naam: 'Rijst', eenheid: 'pak', prijzen_inhoud: { inhoud: 1, inhoud_eenheid: 'kg' },
    prijzen: [{ winkel: 'Colruyt', prijs: 3, per: 'kg' }, { winkel: 'Aldi', prijs: 2.5, per: 'kg' }] });
  d = await api('GET', 'alles');
  const pr = d.catalogus.find((c) => c.naam === 'Rijst').prijzen.map((p) => `${p.winkel}:${p.prijs}/${p.per}:${p.inhoud || ''}${p.inhoud_eenheid || ''}`).sort();
  controle(JSON.stringify(pr) === '["Aldi:2.5/kg:1kg","Colruyt:3/kg:1kg","Colruyt:4/kg:"]', `prijzen per inhoud bewaard, de algemene blijft (${pr.join(', ')})`);
  await page.reload();
  await page.waitForSelector('#b-menu');
  let rijen = await page.$$eval('#inhoud .lijst .rij', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ')));
  controle(rijen.some((t) => t.includes('à 1 kg') && t.includes('Aldi') && t.includes('2,50')), `pak à 1 kg: eigen prijs, goedkoopst bij Aldi (${rijen.join(' | ')})`);
  controle(rijen.some((t) => t.includes('à 500 g') && t.includes('Colruyt') && t.includes('4,00')), 'pak à 500 g zonder eigen prijs: de algemene prijs');

  // in het venster Prijzen: elke inhoud een eigen blok
  const r500b = d.boodschappen.find((b) => b.inhoud === 500);
  await page.click(`[data-prijs="${r500b.id}"]`);
  await page.waitForSelector('#pz-form');
  const titels = await page.$$eval('.pz-groep-titel', (l) => l.map((x) => x.textContent.trim()));
  controle(titels.some((t) => t.includes('500 g')) && titels.some((t) => t.includes('1 kg')) && titels.some((t) => t.includes('zonder eigen prijs')),
    `prijzenvenster toont elke inhoud (${titels.join(' | ')})`);
  const groep500 = '.pz-groep[data-inhoud="500"]';
  await page.fill(`${groep500} .prijs-rij[data-winkel="Colruyt"] .pz-prijs`, '5');
  // een nieuwe inhoud toevoegen
  await page.click('#pz-nieuw summary');
  await page.fill('#pz-nieuw-inhoud', '5');
  await page.selectOption('#pz-nieuw-eenheid', 'kg');
  await page.click('#pz-nieuw-ok');
  await page.fill('.pz-groep[data-inhoud="5"] .prijs-rij[data-winkel="Colruyt"] .pz-prijs', '2');
  await page.click('#pz-form button[type="submit"]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const pr2 = d.catalogus.find((c) => c.naam === 'Rijst').prijzen.map((p) => `${p.winkel}:${p.prijs}:${p.inhoud || ''}${p.inhoud_eenheid || ''}`).sort();
  controle(JSON.stringify(pr2) === '["Aldi:2.5:1kg","Colruyt:2:5kg","Colruyt:3:1kg","Colruyt:4:","Colruyt:5:500g"]', `prijzen per inhoud bewaard via het venster (${pr2.join(', ')})`);
  rijen = await page.$$eval('#inhoud .lijst .rij', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ')));
  controle(rijen.some((t) => t.includes('à 500 g') && t.includes('5,00')), `pak à 500 g nu met eigen prijs: 2 × 0,5 kg × € 5 (${rijen.join(' | ')})`);

  // in het productformulier gelden de prijzen voor de inhoud die erboven staat
  const pid = d.producten.find((p) => p.naam === 'Rijst' && p.inhoud === 2).id;
  await api('PUT', `producten/${pid}`, { hoeveelheid: 0 }); // staat dan onder "Op" en is aan te tikken
  await page.goto(basis + '#voorraad');
  await page.reload(); // de app de nieuwe stand laten inlezen
  await page.waitForSelector(`[data-product="${pid}"]`);
  await page.click(`[data-product="${pid}"]`);
  await page.click('#bewerk');
  await page.waitForSelector('#pf-prijzen');
  controle((await page.textContent('#pf-prijzen summary')).includes('2 kg'), 'formulier: prijzen voor pak à 2 kg');
  await page.fill('#pf-inhoud', '1');
  await page.selectOption('#pf-inhoud-eenheid', 'kg');
  await page.waitForTimeout(100);
  controle((await page.inputValue('#pf-prijzen .prijs-rij[data-winkel="Aldi"] .pz-prijs')) === '2,50', 'andere inhoud gekozen: de prijzen van pak à 1 kg verschijnen');
  await page.fill('#pf-prijzen .prijs-rij[data-winkel="Aldi"] .pz-prijs', '2,4');
  await page.click('#pf button[type="submit"]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const pr3 = d.catalogus.find((c) => c.naam === 'Rijst').prijzen.map((p) => `${p.winkel}:${p.prijs}:${p.inhoud || ''}${p.inhoud_eenheid || ''}`).sort();
  controle(JSON.stringify(pr3) === '["Aldi:2.4:1kg","Colruyt:2:5kg","Colruyt:3:1kg","Colruyt:4:","Colruyt:5:500g"]', `formulier past alleen de prijzen van die inhoud aan (${pr3.join(', ')})`);

  controle(!jsFouten.length, `geen JavaScript-fouten (${jsFouten.join(' | ')})`);
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en)`); process.exit(1); }
  console.log('\nAlles in orde');
}
main().catch((e) => { console.error(e); process.exit(1); });

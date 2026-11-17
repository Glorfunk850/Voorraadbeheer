// Maaltijdplanner, via de echte knoppen: een recept en een zelf getypte maaltijd inplannen,
// wijzigen, gekookt aanduiden, boodschappen voor de week, en wat er gebeurt als een recept verwijderd wordt.
//
// Uitvoeren:  node test/planner.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
  await page.goto(basis + '#planner');
  await page.waitForSelector('#inhoud h1');

  await api('POST', 'producten', { naam: 'Melk', hoeveelheid: 2, eenheid: 'l' });
  await api('POST', 'producten', { naam: 'Rijst', hoeveelheid: 100, eenheid: 'g' });
  let d = await api('POST', 'recepten', { titel: 'Rijstpap', personen: 2, ingredienten: [
    { naam: 'melk', hoeveelheid: 1, eenheid: 'l' }, { naam: 'rijst', hoeveelheid: 100, eenheid: 'g' }, { naam: 'suiker', hoeveelheid: 50, eenheid: 'g' }] });
  const pap = d.nieuw_id;
  d = await api('POST', 'recepten', { titel: 'Pannenkoeken', personen: 4, ingredienten: [
    { naam: 'melk', hoeveelheid: 500, eenheid: 'ml' }, { naam: 'bloem', hoeveelheid: 250, eenheid: 'g' }] });
  const pannenkoek = d.nieuw_id;
  await page.reload();
  await page.waitForSelector('.plan-week');

  const vandaag = iso(new Date());
  controle((await page.$$('.plan-dag')).length === 7, 'week met 7 dagen');
  controle(await page.isVisible('.plan-dag.vandaag'), 'vandaag is aangeduid');

  // recept inplannen vanaf de dag van vandaag
  await page.click('.plan-dag.vandaag [data-plan-nieuw]');
  await page.waitForSelector('#plf');
  controle((await page.$$('#plf-lijst [data-kies]')).length === 2, 'beide recepten om uit te kiezen');
  await page.fill('#plf-zoek', 'pap');
  controle((await page.$$('#plf-lijst [data-kies]')).length === 1, 'zoeken in de recepten');
  await page.click(`#plf-lijst [data-kies="${pap}"]`);
  controle((await page.textContent('#plf-personen')).trim() === '2', 'personen van het recept overgenomen');
  await page.click('#plf-plus'); await page.click('#plf-plus');
  await page.click('#plf-maaltijd [data-w="Ontbijt"]');
  await page.click('#plf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const m1 = d.planning.find((m) => m.recept_id === pap);
  controle(m1 && m1.datum === vandaag && m1.maaltijd === 'Ontbijt' && m1.personen === 4, 'rijstpap ingepland: vandaag, ontbijt, 4 personen');
  controle(await page.isVisible('.plan-dag.vandaag .rij:has-text("Rijstpap")'), 'rijstpap staat bij vandaag');

  // zelf typen, morgen
  await page.click('.plan-dag.vandaag [data-plan-nieuw]');
  await page.waitForSelector('#plf');
  await page.click('#plf-modus [data-w="tekst"]');
  await page.click('#plf-snel [data-d="1"]');
  await page.fill('#plf-tekst-in', 'Restjes');
  await page.click('#plf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const morgen = new Date(); morgen.setDate(morgen.getDate() + 1);
  const m2 = d.planning.find((m) => m.tekst === 'Restjes');
  controle(m2 && m2.datum === iso(morgen) && m2.recept_id === null && m2.maaltijd === 'Avondeten', 'restjes ingepland voor morgen (avondeten)');

  // vanuit een recept inplannen
  await page.goto(basis + '#recepten');
  await page.click(`[data-recept="${pannenkoek}"]`);
  await page.click('#r-plan');
  await page.waitForSelector('#plf');
  controle(await page.isVisible(`#plf-lijst .gekozen[data-kies="${pannenkoek}"]`), 'vanuit het recept: recept al gekozen');
  await page.click('#plf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  const m3 = d.planning.find((m) => m.recept_id === pannenkoek);
  controle(m3 && m3.datum === vandaag && m3.personen === 4, 'pannenkoeken ingepland voor vandaag');

  // boodschappen voor de week: melk samengeteld (4 personen rijstpap = 2 l + 0,5 l), bloem en suiker ontbreken
  await page.goto(basis + '#planner');
  await page.waitForSelector('#pw-boodschappen');
  await page.click('#pw-boodschappen');
  await page.waitForSelector('#bk-toevoegen');
  const rijen = await page.$$eval('#paneel .kook-rij', (l) => l.map((r) => ({ naam: r.querySelector('.naam').firstChild.textContent.trim(),
    aan: r.querySelector('input[type=checkbox]').checked, hv: r.querySelector('input[data-hv]').value })));
  const melk = rijen.find((r) => /melk/i.test(r.naam));
  controle(rijen.length === 4, `4 ingrediënten samen (${rijen.map((r) => r.naam).join(', ')})`);
  controle(melk && melk.aan && melk.hv === '0,5', `melk: 2,5 l nodig, 2 l in huis → 0,5 l kopen (${melk && melk.hv})`);
  controle(rijen.filter((r) => r.aan).map((r) => r.naam.toLowerCase()).sort().join(',') === 'bloem,melk,rijst,suiker', 'wat ontbreekt staat aangevinkt');
  await page.click('#bk-toevoegen');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(['bloem', 'suiker', 'melk', 'rijst'].every((n) => d.boodschappen.some((b) => b.naam.toLowerCase() === n)), 'op de boodschappenlijst gezet');

  // gekookt aanduiden
  await page.click('.rij:has-text("Rijstpap")');
  await page.click('#pl-gekookt');
  await page.waitForSelector('#aftrekken');
  await page.click('#aftrekken');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.planning.find((m) => m.id === m1.id).klaar, 'rijstpap als gekookt aangeduid');
  controle(d.producten.find((p) => p.naam === 'Rijst').hoeveelheid === 0, 'rijst van de voorraad afgetrokken');

  // wijzigen: verplaatsen naar morgen
  await page.click('.rij:has-text("Pannenkoeken")');
  await page.click('#pl-wijzig');
  await page.waitForSelector('#plf');
  await page.click('#plf-snel [data-d="1"]');
  await page.click('#plf button[type=submit]');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.planning.find((m) => m.id === m3.id).datum === iso(morgen) && d.planning.length === 3, 'pannenkoeken verplaatst naar morgen');

  // volgende week en terug
  await page.click('#pw-volgende');
  controle((await page.textContent('.plan-week-tekst b')) === 'Volgende week' && !(await page.$('.plan-dag .rij:has-text("Rijstpap")')), 'volgende week is leeg');
  await page.click('#pw-nu');
  controle((await page.textContent('.plan-week-tekst b')) === 'Deze week', 'terug naar deze week');

  // recept verwijderen: de geplande maaltijd blijft, met de titel
  await api('DELETE', `recepten/${pannenkoek}`);
  d = await api('GET', 'alles');
  const weg = d.planning.find((m) => m.id === m3.id);
  controle(weg && weg.recept_id === null && weg.tekst === 'Pannenkoeken', 'recept verwijderd: maaltijd blijft staan als tekst');

  // uit de planning halen en ongedaan maken
  await page.reload();
  await page.waitForSelector('.plan-week');
  if (new Date().getDay() === 0) await page.click('#pw-volgende'); // zondag: morgen valt in volgende week
  await page.click('.rij:has-text("Restjes")');
  await page.click('#pl-weg');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(!d.planning.some((m) => m.tekst === 'Restjes'), 'restjes uit de planning gehaald');
  await page.click('#toast button');
  await page.waitForTimeout(250);
  d = await api('GET', 'alles');
  controle(d.planning.some((m) => m.tekst === 'Restjes' && m.datum === iso(morgen)), 'ongedaan maken zet ze terug');

  // maaltijd hernoemen bij Instellingen past de planning aan
  await page.goto(basis + '#instellingen');
  await page.click('[data-uitklap="maaltijden"] summary');
  await page.fill('[data-nieuw="maaltijden"] input', 'Vieruurtje');
  await page.click('[data-nieuw="maaltijden"] button');
  await page.waitForTimeout(200);
  await api('PUT', 'instellingen', { maaltijden: ['Ontbijt', 'Lunch', 'Diner', 'Vieruurtje'] });
  await api('POST', 'hernoemen', { veld: 'maaltijd', van: 'Avondeten', naar: 'Diner' });
  d = await api('GET', 'alles');
  controle(JSON.stringify(d.instellingen.maaltijden) === '["Ontbijt","Lunch","Diner","Vieruurtje"]', 'maaltijden aan te passen bij Instellingen');
  controle(d.planning.find((m) => m.tekst === 'Restjes').maaltijd === 'Diner', 'maaltijd hernoemd: planning mee aangepast');

  // back-up bevat de planning
  const backup = await page.evaluate(() => new Promise((ok) => {
    const echt = URL.createObjectURL;
    URL.createObjectURL = (blob) => { blob.text().then(ok); return echt(blob); };
    document.querySelector('a[href="api/export.json"]')?.click() || (() => { const a = document.createElement('a'); a.href = 'api/export.json'; document.body.appendChild(a); a.click(); })();
  }));
  const b = JSON.parse(backup);
  controle(Array.isArray(b.planning) && b.planning.length === 3, 'planning zit in de back-up');

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

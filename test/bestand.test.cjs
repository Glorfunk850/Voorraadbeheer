// Gegevens ook bewaren in een bestand op het toestel (Chrome/Edge op computer en Android).
// De bestandskiezer van het systeem wordt vervangen door een nagemaakt bestand (zie nep-bestand.cjs). Gecontroleerd wordt:
// - een bestand koppelen zet er meteen alle gegevens in, en elke wijziging komt er daarna vanzelf bij;
// - de koppeling blijft na het herstarten van de app;
// - na het wissen van de app-gegevens haal je alles terug met "Bestaand bestand openen";
// - toestemming kwijt (Chrome op Android na het sluiten): geen melding bij het openen, de app vraagt ze zelf bij de
//   eerste wijziging; lukt dat niet of zegt de gebruiker nee, dan één melding met "Toestemming geven";
// - "Stoppen" schrijft niet meer naar het bestand;
// - een browser zonder bestandskiezer (iPhone): uitleg en een herinnering om een back-up te maken.
//
// Uitvoeren:  node test/bestand.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const nepBestand = require('./nep-bestand.cjs');

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

  // --- Toestel met bestandskiezer
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.addInitScript(nepBestand);
  const page = await ctx.newPage();
  const jsFouten = [];
  page.on('pageerror', (e) => jsFouten.push(e.message));
  const api = (m, p, b) => page.evaluate(([m, p, b]) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json()), [m, p, b]);
  const bestand = () => page.evaluate(async () => {
    const h = await (await navigator.storage.getDirectory()).getFileHandle('voorraad-gegevens.json', { create: true });
    const t = await (await h.getFile()).text();
    return t ? JSON.parse(t) : null;
  });
  const namen = (d) => (d && d.producten ? d.producten.map((p) => p.naam).sort().join(',') : '');
  const instellingen = async () => { await page.goto(basis + '#instellingen'); await page.reload(); await page.waitForSelector('#bestand-blok .sectie-titel'); };

  await page.goto(basis + '#instellingen');
  await page.waitForSelector('#bestand-blok .sectie-titel');
  await api('POST', 'producten', { naam: 'Melk', hoeveelheid: 2, eenheid: 'l' });
  await api('POST', 'recepten', { titel: 'Pannenkoeken', personen: 4, stappen: 'Bakken', ingredienten: [{ naam: 'melk', hoeveelheid: 0.5, eenheid: 'l' }] });
  await instellingen();
  controle(await page.isVisible('#b-nieuw') && await page.isVisible('#b-open'), 'knoppen "Nieuw bestand maken" en "Bestaand bestand openen" staan bij Instellingen');

  await page.click('#b-nieuw');
  await page.waitForTimeout(400);
  let d = await bestand();
  controle(namen(d) === 'Melk' && d.recepten.length === 1, 'na het koppelen staan alle gegevens meteen in het bestand');
  controle(/voorraad-gegevens\.json/.test(await page.textContent('#bestand-blok')), 'Instellingen toont in welk bestand bewaard wordt');

  await api('POST', 'producten', { naam: 'Rijst', hoeveelheid: 500, eenheid: 'g' });
  await page.waitForTimeout(1200);
  controle(namen(await bestand()) === 'Melk,Rijst', 'een wijziging komt vanzelf in het bestand');

  // herstarten van de app
  await page.reload();
  await page.waitForTimeout(400);
  controle(await page.evaluate(() => window.voorraadBestand.info()?.toestemming) === 'granted', 'na herstarten is het bestand nog gekoppeld');
  await api('POST', 'producten', { naam: 'Kaas', hoeveelheid: 1, eenheid: 'stuks' });
  await page.waitForTimeout(1200);
  controle(namen(await bestand()) === 'Kaas,Melk,Rijst', 'na herstarten komen wijzigingen nog in het bestand');

  // naar de achtergrond: meteen schrijven (niet wachten)
  await api('POST', 'producten', { naam: 'Boter', hoeveelheid: 1, eenheid: 'stuks' });
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(250);
  controle(namen(await bestand()) === 'Boter,Kaas,Melk,Rijst', 'app naar de achtergrond: de laatste wijziging staat meteen in het bestand');

  // toestemming kwijt (Chrome op Android na het sluiten van de app)
  const herstart = async (view = 'instellingen') => { await page.goto(basis + '#' + view); await page.reload(); await page.waitForTimeout(500); };
  const gevraagd = () => page.evaluate(() => window.toestemmingGevraagd || 0);
  const tgt = async () => ((await bestand()).instellingen || {}).tgt_dagen;
  await page.evaluate(() => localStorage.setItem('test-toestemming', 'prompt'));
  await herstart('voorraad');
  controle(!(await page.isVisible('#toast')), 'zonder toestemming: geen melding bij het openen van de app');
  // wijziging met een tik: de app vraagt zelf toestemming, zonder melding
  await herstart();
  let voor = await tgt();
  await page.click('[data-dagen="tgt_dagen"][data-stap="1"]');
  await page.waitForTimeout(600);
  controle(await gevraagd() === 1, 'eerste wijziging (tik): de app vraagt de browser zelf om toestemming');
  controle(await tgt() === voor + 1, 'na toestemming staat de wijziging meteen in het bestand');
  controle(!(await page.isVisible('#toast')) || !/nog niet in/.test(await page.textContent('#toast')), 'daarbij geen extra melding van de app');
  // wijziging zonder tik (bv. vanuit een ander venster): melding met knop
  await page.evaluate(() => localStorage.setItem('test-toestemming', 'prompt'));
  await herstart('voorraad');
  // Playwright telt zijn eigen opdrachten als een tik: dat hier uitzetten
  await page.evaluate(() => Object.defineProperty(navigator.userActivation, 'isActive', { get: () => false, configurable: true }));
  await api('POST', 'producten', { naam: 'Appels', hoeveelheid: 6, eenheid: 'stuks' });
  await page.waitForTimeout(800);
  controle(await page.isVisible('#toast') && /nog niet in voorraad-gegevens\.json/.test(await page.textContent('#toast')), 'wijziging zonder tik: melding met "Toestemming geven"');
  controle(!/Appels/.test(namen(await bestand())), 'zonder toestemming wordt het bestand niet aangeraakt');
  await page.click('#toast button');
  await page.waitForTimeout(500);
  controle(/Appels/.test(namen(await bestand())), '"Toestemming geven": ook de tussentijdse wijzigingen staan in het bestand');
  // nee zeggen: niet bij elke tik opnieuw vragen
  await page.evaluate(() => { localStorage.setItem('test-toestemming', 'prompt'); localStorage.setItem('test-weigeren', '1'); });
  await herstart();
  voor = await tgt();
  await page.click('[data-dagen="tgt_dagen"][data-stap="1"]');
  await page.waitForTimeout(600);
  controle(await gevraagd() === 1 && /nog niet in/.test(await page.textContent('#toast')), 'nee gezegd: één melding met "Toestemming geven"');
  await page.click('[data-dagen="tgt_dagen"][data-stap="1"]');
  await page.waitForTimeout(600);
  controle(await gevraagd() === 1, 'nee gezegd: bij de volgende tik niet opnieuw gevraagd');
  controle(await tgt() === voor, 'nee gezegd: bestand niet aangeraakt');
  await page.evaluate(() => localStorage.removeItem('test-weigeren'));
  await page.click('#b-toestemming');
  await page.waitForTimeout(600);
  controle(await tgt() === voor + 2 && await page.isVisible('#b-stop'), 'toch toestemming via Instellingen: bestand bijgewerkt');

  // app-gegevens wissen (zoals "websitegegevens wissen"; het bestand op het toestel blijft)
  await page.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('voorraadbeheer'); r.onsuccess = r.onerror = r.onblocked = ok; setTimeout(ok, 1500); }));
  await page.goto('about:blank');
  await page.goto(basis + '#instellingen');
  await page.waitForSelector('#bestand-blok .sectie-titel');
  let alles = await api('GET', 'alles');
  controle(alles.producten.length === 0 && await page.isVisible('#b-open'), 'na het wissen is de app leeg en niet meer gekoppeld');
  await page.click('#b-open');
  await page.waitForTimeout(400);
  const vraagTekst = await page.textContent('#vraag-tekst');
  controle(/5 producten, 1 recepten/.test(vraagTekst), `"Bestaand bestand openen" toont wat erin zit (${vraagTekst.trim()})`);
  await page.click('#vraag-ja');
  await page.waitForTimeout(800);
  alles = await api('GET', 'alles');
  controle(alles.producten.length === 5 && alles.recepten.length === 1, 'alles is teruggehaald uit het bestand');
  controle(await page.evaluate(() => window.voorraadBestand.info()?.toestemming) === 'granted', 'en het bestand is weer gekoppeld');
  await api('POST', 'producten', { naam: 'Peren', hoeveelheid: 3, eenheid: 'stuks' });
  await page.waitForTimeout(1200);
  controle(/Peren/.test(namen(await bestand())), 'nieuwe wijzigingen komen weer in het bestand');

  // stoppen
  await instellingen();
  await page.click('#b-stop');
  await page.waitForTimeout(300);
  controle(await page.isVisible('#b-nieuw') && await page.evaluate(() => window.voorraadBestand.info()) === null, '"Stoppen" haalt de koppeling weg');
  await api('POST', 'producten', { naam: 'Kiwi', hoeveelheid: 3, eenheid: 'stuks' });
  await page.waitForTimeout(1200);
  controle(!/Kiwi/.test(namen(await bestand())) && /Peren/.test(namen(await bestand())), 'na "Stoppen" blijft het bestand staan maar verandert het niet meer');
  await page.reload();
  await page.waitForTimeout(400);
  controle(await page.evaluate(() => window.voorraadBestand.info()) === null, 'na "Stoppen" en herstarten blijft de koppeling weg');
  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await ctx.close();

  // --- Browser zonder bestandskiezer (bv. iPhone): uitleg en back-upherinnering
  const ctx2 = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  await ctx2.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; delete Window.prototype.showSaveFilePicker; delete Window.prototype.showOpenFilePicker; });
  const p2 = await ctx2.newPage();
  const jsFouten2 = [];
  p2.on('pageerror', (e) => jsFouten2.push(e.message));
  await p2.goto(basis + '#instellingen');
  await p2.waitForSelector('#bestand-blok .sectie-titel');
  controle(!(await p2.isVisible('#b-nieuw')) && /back-up/i.test(await p2.textContent('#bestand-blok')), 'zonder bestandskiezer: uitleg, geen knoppen');
  // een back-up van 20 dagen geleden terugzetten
  const oud = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 19);
  await p2.evaluate((oud) => fetch('api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ producten: [{ id: 1, naam: 'Melk', hoeveelheid: 1, eenheid: 'l' }], recepten: [], laatste_backup: oud, volgendId: 2 }) }), oud);
  await p2.goto(basis + '#voorraad');
  await p2.reload();
  await p2.waitForTimeout(500);
  controle(/20 dagen oud/.test(await p2.textContent('#toast')), 'herinnering bij het openen als de laatste back-up oud is');
  const [dl] = await Promise.all([p2.waitForEvent('download', { timeout: 3000 }).catch(() => null), p2.click('#toast button')]);
  controle(!!dl && /voorraad-backup-.*\.json/.test(dl.suggestedFilename()), '"Back-up maken" in de herinnering downloadt een back-up');
  await p2.waitForTimeout(300); // datum van de back-up laten bewaren
  await p2.reload();
  await p2.waitForTimeout(500);
  controle(!(await p2.isVisible('#toast')) || !/oud/.test(await p2.textContent('#toast')), 'na de back-up geen herinnering meer');
  await p2.goto(basis + '#instellingen');
  await p2.waitForSelector('#backup-laatst');
  const laatsteTekst = await p2.textContent('#backup-laatst');
  controle(/Laatste back-up: vandaag/.test(laatsteTekst), `Instellingen toont wanneer de laatste back-up gemaakt is (${laatsteTekst})`);
  controle(!jsFouten2.length, 'geen JavaScript-fouten zonder bestandskiezer' + (jsFouten2.length ? ': ' + jsFouten2.join(' | ') : ''));
  await ctx2.close();

  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nBewaren in een bestand werkt.');
}
main().catch((e) => { console.error(e); process.exit(1); });

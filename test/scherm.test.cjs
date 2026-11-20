// Scherm aan laten (Screen Wake Lock): aan zolang een recept open staat, zelf aan/uit in het recept,
// en de keuze bij Instellingen (Bij een recept / Altijd / Nooit). navigator.wakeLock wordt nagebootst.
//
// Uitvoeren:  node test/scherm.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
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

// nagebootste Wake Lock: window.__slot telt hoeveel sloten er nu actief zijn
const NEP = () => {
  window.__slot = 0;
  const wakeLock = { request: async () => {
    window.__slot++;
    const s = new EventTarget();
    s.released = false; s.type = 'screen';
    s.release = async () => { if (!s.released) { s.released = true; window.__slot--; s.dispatchEvent(new Event('release')); } };
    return s;
  } };
  Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true });
};

async function main() {
  const srv = await server();
  const basis = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.addInitScript(NEP);
  const page = await ctx.newPage();
  const jsFouten = [];
  page.on('pageerror', (e) => jsFouten.push(e.message));
  const api = (m, p, b) => page.evaluate(([m, p, b]) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' },
    body: b === undefined ? undefined : JSON.stringify(b) }).then((r) => r.json()), [m, p, b]);
  const slot = () => page.evaluate(() => window.__slot);
  const even = () => page.waitForTimeout(150);

  await page.goto(basis + '#recepten');
  await page.waitForSelector('#inhoud h1');
  const d = await api('POST', 'recepten', { titel: 'Soep', personen: 2, ingredienten: [{ naam: 'wortel', hoeveelheid: 2, eenheid: 'stuk' }], stappen: 'Snijden\nKoken' });
  await api('POST', 'recepten', { titel: 'Pap', personen: 1, ingredienten: [] });
  await page.reload();
  await page.waitForSelector('#inhoud h1');
  controle(await slot() === 0, 'scherm niet vastgehouden zonder recept open');

  // recept openen: scherm blijft aan (standaard)
  await page.click('text=Soep');
  await page.waitForSelector('#r-scherm');
  await even();
  controle(await slot() === 1, 'recept open: scherm blijft aan');
  controle(await page.getAttribute('#r-scherm', 'aria-pressed') === 'true', 'knop toont "aan"');
  controle((await page.textContent('#r-scherm')).includes('Scherm blijft aan'), 'knoptekst "Scherm blijft aan"');

  // personen wijzigen: slot blijft (geen tweede)
  await page.click('#p-plus');
  await even();
  controle(await slot() === 1, 'personen wijzigen: nog steeds één slot');

  // zelf uitzetten in het recept
  await page.click('#r-scherm');
  await even();
  controle(await slot() === 0, 'zelf uitgezet: scherm mag weer uit');
  controle(await page.getAttribute('#r-scherm', 'aria-pressed') === 'false', 'knop toont "uit"');
  await page.click('#p-plus');
  await even();
  controle(await slot() === 0, 'eigen keuze blijft na opnieuw tekenen');
  await page.click('#r-scherm');
  await even();
  controle(await slot() === 1, 'zelf weer aangezet');

  // paneel sluiten: slot los
  await page.click('#sluier', { position: { x: 5, y: 5 } }).catch(async () => page.evaluate(() => document.getElementById('sluier').click()));
  await even();
  controle(await slot() === 0, 'recept gesloten: scherm mag weer uit');

  // instelling Nooit
  await page.goto(basis + '#instellingen');
  await page.waitForSelector('[data-scherm="uit"]');
  controle(await page.getAttribute('[data-scherm="recept"]', 'aria-pressed') === 'true', 'standaard "Bij een recept"');
  await page.click('[data-scherm="uit"]');
  controle(await page.getAttribute('[data-scherm="uit"]', 'aria-pressed') === 'true', '"Nooit" gekozen');
  await page.click('.navigatie [data-view="recepten"]').catch(() => page.goto(basis + '#recepten'));
  await page.waitForSelector('text=Pap');
  await page.click('text=Pap');
  await page.waitForSelector('#r-scherm');
  await even();
  controle(await slot() === 0, 'Nooit: recept open zonder slot');
  controle(await page.getAttribute('#r-scherm', 'aria-pressed') === 'false', 'Nooit: knop toont "uit"');
  await page.click('#r-scherm');
  await even();
  controle(await slot() === 1, 'Nooit, maar in recept toch aangezet');
  await page.evaluate(() => document.getElementById('sluier').click());
  await even();

  // instelling Altijd, blijft bewaard na herladen
  await page.goto(basis + '#instellingen');
  await page.waitForSelector('[data-scherm="altijd"]');
  await page.click('[data-scherm="altijd"]');
  await even();
  controle(await slot() === 1, 'Altijd: scherm blijft aan zonder recept');
  await page.reload();
  await page.waitForSelector('[data-scherm="altijd"]');
  await even();
  controle(await page.getAttribute('[data-scherm="altijd"]', 'aria-pressed') === 'true', 'keuze bewaard na herladen');
  controle(await slot() === 1, 'Altijd: na herladen weer aan');
  await page.click('[data-scherm="recept"]');
  await even();
  controle(await slot() === 0, 'terug naar "Bij een recept": slot los');

  // browser zonder Wake Lock: uitleg in plaats van knoppen, geen knop in recept
  const ctx2 = await browser.newContext({ serviceWorkers: 'block' });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => jsFouten.push(e.message));
  await p2.addInitScript(() => { try { delete Navigator.prototype.wakeLock; } catch { /* */ } });
  await p2.goto(basis + '#instellingen');
  await p2.waitForSelector('#scherm-blok .sectie-titel');
  controle(!(await p2.$('[data-scherm]')) && (await p2.textContent('#scherm-blok')).includes('kan het scherm niet aan houden'), 'zonder Wake Lock: uitleg bij Instellingen');

  controle(!d.fout, 'recept aangemaakt');
  controle(jsFouten.length === 0, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en)`); process.exit(1); }
  console.log('\nAlles in orde');
}
main().catch((e) => { console.error(e); process.exit(1); });

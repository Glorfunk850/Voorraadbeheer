// Kleine en grote verpakking zonder eigen inhoud op de boodschappenlijst: de prijs is die van de inhoud van die grootte.
// Bv. appelmoes van Jumbo in een bokaal à 190 g (klein) en à 350 g (groot), prijzen per kg: de kleine bokaal
// krijgt de prijs van 190 g, de grote die van 350 g. Een merk zonder kleine bokaal staat niet bij de kleine.
//
// Uitvoeren:  node test/maat-prijzen.test.cjs   (vereist Playwright)
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


async function scenario(page, api, metMaat) {
  const N = metMaat ? 'Appelmoes' : 'Compote';
  const v = (merk, g, maat) => ({ merk, inhoud: g, inhoud_eenheid: 'g', ...(metMaat ? { verpakking: maat } : {}) });
  await api('POST', 'catalogus', { naam: N, eenheid: 'bokaal', ...v('Jumbo', 190, 'klein') });
  await api('POST', 'catalogus', { naam: N, eenheid: 'bokaal', ...v('Jumbo', 350, 'groot') });
  await api('POST', 'catalogus', { naam: N, eenheid: 'bokaal', ...v('Boni Bio', 350, 'groot') });
  await api('POST', 'prijzen', { naam: N, eenheid: 'bokaal', prijzen: [
    { winkel: 'Colruyt', prijs: 3.63, per: 'kg', merk: 'Boni Bio', inhoud: 350, inhoud_eenheid: 'g' },
    { winkel: 'Jumbo', prijs: 7.21, per: 'kg', merk: 'Jumbo', inhoud: 190, inhoud_eenheid: 'g' },
    { winkel: 'Jumbo', prijs: 3.97, per: 'kg', merk: 'Jumbo', inhoud: 350, inhoud_eenheid: 'g' }] });
  await api('POST', 'boodschappen', { naam: N, hoeveelheid: 1, eenheid: 'bokaal', verpakking: 'klein' });
  await api('POST', 'boodschappen', { naam: N, hoeveelheid: 1, eenheid: 'bokaal', verpakking: 'groot' });
  await page.reload();
  await page.waitForSelector('.prijs-link');
  const r = await page.$$eval('#inhoud .lijst .rij', (l, n) => l.filter((x) => x.querySelector('.naam-knop')?.textContent.startsWith(n))
    .map((x) => ({ maat: x.querySelector('.maat')?.textContent, tekst: x.querySelector('.naam').textContent.replace(/\s+/g, ' ') })), N);
  const klein = r.find((x) => x.maat === 'klein')?.tekst || '', groot = r.find((x) => x.maat === 'groot')?.tekst || '';
  const wie = metMaat ? 'grootte in de catalogus' : 'kleinste/grootste inhoud';
  controle(klein.includes('Jumbo · € 1,37') && !klein.includes('Boni Bio'), `${wie}: kleine bokaal Jumbo € 1,37, geen Boni Bio (${klein})`);
  controle(groot.includes('Colruyt · € 1,27') && groot.includes('Jumbo € 1,39'), `${wie}: grote bokaal Colruyt € 1,27, Jumbo € 1,39 (${groot})`);
}

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
  await api('PUT', 'instellingen', { winkels: ['Jumbo', 'Colruyt'] });
  await scenario(page, api, true);
  await scenario(page, api, false);

  // zonder kleine bokaal met een prijs: geen prijs van de grote tonen
  await api('POST', 'catalogus', { naam: 'Choco', eenheid: 'pot', merk: 'Nutella', inhoud: 200, inhoud_eenheid: 'g', verpakking: 'klein' });
  await api('POST', 'catalogus', { naam: 'Choco', eenheid: 'pot', merk: 'Nutella', inhoud: 750, inhoud_eenheid: 'g', verpakking: 'groot' });
  await api('POST', 'prijzen', { naam: 'Choco', eenheid: 'pot', prijzen: [{ winkel: 'Colruyt', prijs: 6, per: 'kg', merk: 'Nutella', inhoud: 750, inhoud_eenheid: 'g' }] });
  await api('POST', 'boodschappen', { naam: 'Choco', hoeveelheid: 1, eenheid: 'pot', verpakking: 'klein' });
  await page.reload();
  await page.waitForSelector('.prijs-link');
  const choco = await page.textContent('#inhoud .lijst .rij:has-text("Choco") small');
  controle(choco.includes('Prijs invullen'), `kleine pot zonder eigen prijs: Prijs invullen (${choco.trim()})`);

  controle(!jsFouten.length, 'geen JavaScript-fouten' + (jsFouten.length ? ': ' + jsFouten.join(' | ') : ''));
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en).`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

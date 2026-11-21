// Op te gebruiken melden: het venster bij het openen van de app (hoogstens één keer per dag, uit te zetten),
// de melding op het toestel bij Instellingen (Notification wordt nagebootst), en de service worker die in de
// achtergrond nakijkt (sw.js, met een nagebootste IndexedDB en registration).
//
// Uitvoeren:  node test/melding.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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
const dag = (n) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// nagebootste meldingen: window.__meldingen houdt bij wat getoond werd
const NEP = () => {
  window.__meldingen = [];
  class Nep { constructor(titel, opties) { window.__meldingen.push({ titel, tekst: opties && opties.body }); } }
  // de toestemming blijft bewaard na herladen, zoals in een echte browser
  Object.defineProperty(Nep, 'permission', { get: () => localStorage.getItem('__toestemming') || 'default', set: (w) => localStorage.setItem('__toestemming', w) });
  Nep.requestPermission = async () => (Nep.permission = 'granted');
  Object.defineProperty(window, 'Notification', { value: Nep, configurable: true, writable: true });
};

// ---- service worker (sw.js) in een eigen omgeving, met een eenvoudige IndexedDB
async function serviceWorkerTesten() {
  const opslag = {}, getoond = [], geopend = [];
  const later = (f) => setTimeout(f, 0);
  const db = {
    close() {},
    transaction() {
      const t = {};
      t.objectStore = () => ({
        get(k) { const r = {}; later(() => { r.result = opslag[k]; r.onsuccess && r.onsuccess(); }); return r; },
        put(v, k) { opslag[k] = JSON.parse(JSON.stringify(v)); later(() => t.oncomplete && t.oncomplete()); },
      });
      return t;
    },
  };
  const luisteraars = {};
  const self = {
    addEventListener: (n, f) => { luisteraars[n] = f; },
    registration: { showNotification: async (titel, o) => { getoond.push({ titel, tekst: o.body }); } },
    clients: { matchAll: async () => [], openWindow: async (u) => { geopend.push(u); } },
    location: { origin: 'http://x' },
    Notification: { permission: 'granted' },
  };
  const ctx = vm.createContext({ self, indexedDB: { open() { const r = { result: db }; later(() => r.onsuccess()); return r; } }, caches: {}, fetch: () => {}, URL, setTimeout, console, Date, Math, Promise });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), ctx);
  const sync = async () => { let w; luisteraars.periodicsync({ tag: 'op-te-gebruiken', waitUntil: (p) => (w = p) }); await w; };

  opslag.gegevens = { instellingen: { tgt_dagen: 2, tht_dagen: 3 }, producten: [
    { naam: 'Kaas', hoeveelheid: 1, vervaldatum: dag(10), datumtype: 'THT' },
    { naam: 'Yoghurt', hoeveelheid: 2, vervaldatum: dag(-2), datumtype: 'THT' },
    { naam: 'Melk', hoeveelheid: 1, vervaldatum: dag(1), datumtype: 'TGT' },
    { naam: 'Room', hoeveelheid: 0, vervaldatum: dag(0), datumtype: 'TGT' },
  ] };
  await sync();
  controle(getoond.length === 0, 'service worker: geen melding zolang meldingen uit staan');
  opslag.melding = { aan: true, laatst: dag(-1) };
  await sync();
  controle(getoond.length === 1 && getoond[0].titel === '2 producten op te gebruiken', `service worker: melding "2 producten op te gebruiken" (${getoond[0] && getoond[0].titel})`);
  controle(getoond[0] && getoond[0].tekst === 'Melk: morgen · Yoghurt: datum voorbij', `service worker: eerst "te gebruiken tot", zonder wat al op is (${getoond[0] && getoond[0].tekst})`);
  controle(opslag.melding.laatst === dag(0) && opslag.melding.aan, 'service worker: dag van de melding bewaard');
  await sync();
  controle(getoond.length === 1, 'service worker: hoogstens één melding per dag');
  opslag.melding.laatst = dag(-1);
  opslag.gegevens.producten = [{ naam: 'Kaas', hoeveelheid: 1, vervaldatum: dag(10), datumtype: 'THT' }];
  await sync();
  controle(getoond.length === 1, 'service worker: geen melding als er niets op moet');
  let w;
  luisteraars.notificationclick({ notification: { close() {}, data: { view: 'voorraad' } }, waitUntil: (p) => (w = p) });
  await w;
  controle(geopend[0] === './#voorraad', 'tik op de melding: app opent op Voorraad');
}

async function main() {
  await serviceWorkerTesten();

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
  const herladen = async () => { await page.reload(); await page.waitForSelector('#inhoud h1'); await page.waitForTimeout(200); };

  await page.goto(basis + '#voorraad');
  await page.waitForSelector('#inhoud h1');
  controle(!(await page.isVisible('#paneel')), 'lege voorraad: geen venster');
  await api('POST', 'producten', { naam: 'Kaas', hoeveelheid: 1, eenheid: 'stuks', vervaldatum: dag(10), datumtype: 'THT' });
  await herladen();
  controle(!(await page.isVisible('#paneel')), 'niets op te gebruiken: geen venster');

  await api('POST', 'producten', { naam: 'Yoghurt', hoeveelheid: 2, eenheid: 'stuks', vervaldatum: dag(-2), datumtype: 'THT' });
  await api('POST', 'producten', { naam: 'Melk', hoeveelheid: 1, eenheid: 'l', vervaldatum: dag(1), datumtype: 'TGT' });
  await herladen();
  controle(await page.isVisible('#otg-lijst'), 'bij het openen: venster "Op te gebruiken"');
  const rijen = await page.$$eval('#otg-lijst .naam', (r) => r.map((x) => x.firstChild.textContent.trim()));
  controle(JSON.stringify(rijen) === '["Melk","Yoghurt"]', `venster toont Melk (te gebruiken tot) en dan Yoghurt, geen Kaas (${rijen})`);
  controle((await page.textContent('#paneel')).includes('2 producten'), 'venster telt 2 producten');
  await page.click('#otg-lijst >> text=Melk');
  await page.waitForTimeout(150);
  controle(!(await page.isVisible('#otg-lijst')) && (await page.textContent('#paneel')).includes('Te gebruiken tot'), 'tik op een product: productpaneel opent');
  await page.click('#paneel [data-sluit]');

  await herladen();
  controle(!(await page.isVisible('#paneel')), 'tweede keer openen dezelfde dag: geen venster meer');
  await page.evaluate(() => localStorage.removeItem('op-te-gebruiken-getoond')); // "nieuwe dag"
  await herladen();
  controle(await page.isVisible('#otg-lijst'), 'nieuwe dag: venster weer');
  await page.click('#otg-voorraad');
  controle(!(await page.isVisible('#paneel')), 'Naar voorraad sluit het venster');
  const idb = await page.evaluate(() => new Promise((ok) => {
    const r = indexedDB.open('voorraadbeheer', 1);
    r.onsuccess = () => { const g = r.result.transaction('staat').objectStore('staat').get('melding'); g.onsuccess = () => { ok(g.result || null); r.result.close(); }; };
  }));
  const vandaag = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  controle(idb && idb.laatst === vandaag, 'venster gezien: vandaag geen melding meer op het toestel');

  // Instellingen: venster uitzetten
  await page.goto(basis + '#instellingen');
  await page.waitForSelector('#melding-blok [data-venster]');
  await page.click('#melding-blok [data-venster="uit"]');
  controle(await page.evaluate(() => localStorage.getItem('op-te-gebruiken-venster')) === 'uit', 'venster uitgezet bij Instellingen');
  await page.evaluate(() => localStorage.removeItem('op-te-gebruiken-getoond'));
  await page.goto(basis + '#voorraad'); await herladen();
  controle(!(await page.isVisible('#paneel')), 'venster uit: niets bij het openen');

  // Instellingen: melding op dit toestel
  await page.goto(basis + '#instellingen');
  await page.waitForSelector('#m-toestel');
  controle((await page.textContent('#m-toestel')).trim() === 'Aanzetten', 'melding op dit toestel staat eerst uit');
  await page.click('#m-toestel');
  await page.waitForSelector('#m-proef');
  controle((await page.textContent('#m-uitleg')).startsWith('Aan.'), 'na Aanzetten (toestemming gegeven): aan');
  await page.waitForTimeout(150);
  controle(await page.isVisible('#m-achtergrond'), 'uitleg of de app ook dicht kan nakijken');
  await page.click('#m-proef');
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => window.__meldingen);
  controle(m.length === 1 && m[0].titel === '2 producten op te gebruiken' && m[0].tekst === 'Melk: morgen · Yoghurt: datum voorbij',
    `proefmelding met wat op moet (${JSON.stringify(m)})`);
  await herladen();
  await page.waitForSelector('#m-proef');
  controle(true, 'aan blijft bewaard na herladen');
  await page.click('#m-toestel');
  await page.waitForSelector('#m-toestel:text("Aanzetten")');
  const uit = await page.evaluate(() => new Promise((ok) => {
    const r = indexedDB.open('voorraadbeheer', 1);
    r.onsuccess = () => { const g = r.result.transaction('staat').objectStore('staat').get('melding'); g.onsuccess = () => { ok(g.result || null); r.result.close(); }; };
  }));
  controle(uit && uit.aan === false, 'Uitzetten: geen meldingen meer');

  // geblokkeerd
  await page.evaluate(() => { window.Notification.permission = 'denied'; });
  await page.goto(basis + '#voorraad'); await page.goto(basis + '#instellingen');
  await page.waitForSelector('#m-uitleg');
  controle((await page.textContent('#m-uitleg')).includes('geblokkeerd'), 'meldingen geblokkeerd: uitleg hoe toestaan');

  controle(!jsFouten.length, `geen JavaScript-fouten (${jsFouten.join('; ')})`);
  await browser.close();
  srv.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en)`); process.exit(1); }
  console.log('\nAlles in orde.');
}
main().catch((e) => { console.error(e); process.exit(1); });

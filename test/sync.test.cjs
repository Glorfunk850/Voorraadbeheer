// Synchroniseren tussen toestellen (versleuteld, via de eigen server in sync-server/worker.mjs).
// De echte servercode draait hier lokaal, met een nagemaakte Cloudflare-opslag. Gecontroleerd wordt:
// - samenvoegen (samenvoegen.js): wijzigingen aan beide kanten, wissen tegenover wijzigen, lijsten, gebeurtenissen;
// - de server: versies, botsingen (412), toegang (401), wissen;
// - toestel A zet synchronisatie aan; op de server staat alleen onleesbare (versleutelde) data;
// - toestel B koppelt met de code (en voegt zijn eigen gegevens samen), toestel C via de link uit de QR-code;
// - een wijziging gaat vanzelf naar de andere toestellen; gelijktijdige wijzigingen aan hetzelfde product gaan niet verloren;
// - een verkeerde code geeft een duidelijke melding;
// - stoppen en wissen van de server: de andere toestellen stoppen ook, hun gegevens blijven.
//
// Uitvoeren:  node test/sync.test.cjs   (vereist Playwright; op GitHub gebeurt dit automatisch)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { samenvoegen, gelijk, nieuweIds } = require('../samenvoegen.js');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const fouten = [];
const controle = (ok, tekst) => { console.log(ok ? 'OK  ' : 'FOUT', tekst); if (!ok) fouten.push(tekst); };

function appServer() {
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

// Nagemaakte Durable Objects: zelfde gedrag als bij Cloudflare (opslag per ruimte, één verzoek tegelijk).
function nepCloudflare(Ruimte) {
  const ruimtes = new Map(), opslagen = new Map();
  const opslag = (naam) => {
    if (!opslagen.has(naam)) opslagen.set(naam, new Map());
    const m = opslagen.get(naam);
    return {
      async get(k) { if (Array.isArray(k)) return new Map(k.filter((x) => m.has(x)).map((x) => [x, structuredClone(m.get(x))])); return structuredClone(m.get(k)); },
      async put(k, v) { if (typeof k === 'object') { for (const [a, b] of Object.entries(k)) m.set(a, structuredClone(b)); } else m.set(k, structuredClone(v)); },
      async delete(k) { for (const x of Array.isArray(k) ? k : [k]) m.delete(x); },
      async deleteAll() { m.clear(); },
    };
  };
  return {
    opslagen,
    RUIMTE: {
      idFromName: (n) => n,
      get(n) {
        if (!ruimtes.has(n)) {
          let ketting = Promise.resolve();
          const state = { storage: opslag(n), blockConcurrencyWhile(f) { const r = ketting.then(f); ketting = r.catch(() => {}); return r; } };
          ruimtes.set(n, new Ruimte(state));
        }
        return ruimtes.get(n);
      },
    },
  };
}

async function syncServer() {
  const worker = await import(path.join(ROOT, 'sync-server', 'worker.mjs'));
  const env = nepCloudflare(worker.Ruimte);
  const s = http.createServer(async (req, res) => {
    const delen = [];
    for await (const d of req) delen.push(d);
    const body = Buffer.concat(delen);
    const r = await worker.default.fetch(new Request('http://localhost' + req.url, {
      method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise((ok) => s.listen(0, ok));
  return { s, env, adres: `http://localhost:${s.address().port}` };
}

function samenvoegenTesten() {
  const basis = { volgendId: 3, producten: [{ id: 1, naam: 'Melk', hoeveelheid: 1, locatie: '' }, { id: 2, naam: 'Rijst', hoeveelheid: 500 }],
    instellingen: { locaties: ['Koelkast', 'Kast'], tgt_dagen: 2 }, gebeurtenissen: [{ soort: 'gekocht', naam: 'Melk', tijdstip: '2026-01-01T10:00:00' }],
    catalogus: [{ naam: 'Melk', aantal: 1 }], barcodes: {} };
  const lokaal = structuredClone(basis), extern = structuredClone(basis);
  lokaal.producten[0].hoeveelheid = 3; // lokaal: hoeveelheid
  extern.producten[0].locatie = 'Koelkast'; // extern: plaats van hetzelfde product
  lokaal.producten.push({ id: 10, naam: 'Appel' });
  extern.producten.push({ id: 11, naam: 'Peer' });
  extern.producten = extern.producten.filter((p) => p.id !== 2); // extern gewist …
  lokaal.instellingen.locaties.push('Kelder');
  extern.instellingen.locaties = ['Koelkast', 'Diepvries']; // Kast weg, Diepvries erbij
  extern.instellingen.tgt_dagen = 4;
  lokaal.gebeurtenissen.push({ soort: 'gekookt', naam: 'Pap', tijdstip: '2026-01-02T10:00:00' });
  extern.gebeurtenissen.push({ soort: 'gekocht', naam: 'Brood', tijdstip: '2026-01-01T12:00:00' });
  const m = samenvoegen(basis, lokaal, extern);
  const melk = m.producten.find((p) => p.id === 1);
  controle(melk.hoeveelheid === 3 && melk.locatie === 'Koelkast', 'samenvoegen: twee velden van hetzelfde product aan elk een kant gewijzigd → beide blijven');
  controle(m.producten.some((p) => p.naam === 'Appel') && m.producten.some((p) => p.naam === 'Peer'), 'samenvoegen: nieuwe producten van beide kanten');
  controle(!m.producten.some((p) => p.id === 2), 'samenvoegen: aan één kant gewist → weg');
  controle(m.instellingen.locaties.join() === 'Koelkast,Kelder,Diepvries', `samenvoegen: lijst van plaatsen (${m.instellingen.locaties.join()})`);
  controle(m.instellingen.tgt_dagen === 4, 'samenvoegen: instelling alleen extern gewijzigd → overgenomen');
  controle(m.gebeurtenissen.map((g) => g.naam).join() === 'Melk,Brood,Pap', 'samenvoegen: gebeurtenissen van beide kanten, op tijd gesorteerd');

  const l2 = structuredClone(basis), r2 = structuredClone(basis);
  l2.producten = l2.producten.filter((p) => p.id !== 2);
  r2.producten[1].hoeveelheid = 250;
  controle(samenvoegen(basis, l2, r2).producten.some((p) => p.id === 2 && p.hoeveelheid === 250), 'samenvoegen: lokaal gewist maar extern gewijzigd → blijft (niets verloren)');
  const l3 = structuredClone(basis), r3 = structuredClone(basis);
  l3.producten[0].hoeveelheid = 7; r3.producten[0].hoeveelheid = 9;
  controle(samenvoegen(basis, l3, r3).producten[0].hoeveelheid === 7, 'samenvoegen: zelfde veld aan beide kanten anders → dit toestel wint');
  controle(gelijk({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }) && !gelijk({ a: 1 }, { a: 2 }), 'gelijk: volgorde van sleutels telt niet');
  let n = 100;
  const ni = nieuweIds({ producten: [{ id: 1 }], recepten: [{ id: 2, ingredienten: [{ id: 3, recept_id: 2 }] }],
    boodschappen: [{ id: 4, product_id: 1 }], planning: [{ id: 5, recept_id: 2 }] }, () => n++);
  controle(ni.boodschappen[0].product_id === ni.producten[0].id && ni.planning[0].recept_id === ni.recepten[0].id
    && ni.recepten[0].ingredienten[0].recept_id === ni.recepten[0].id && ni.producten[0].id >= 100, 'nieuweIds: verwijzingen blijven kloppen');
}

async function serverTesten(adres) {
  const url = adres + '/r/' + 'a'.repeat(32), token = 'x'.repeat(43);
  const v = (h) => fetch(url, h);
  let r = await v({ method: 'GET' });
  controle(r.status === 404, 'server: lege ruimte → 404');
  r = await v({ method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'If-None-Match': '*' }, body: 'een' });
  controle(r.status === 200 && r.headers.get('ETag') === '"1"', 'server: nieuwe ruimte → versie 1');
  r = await v({ method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'If-Match': '"0"' }, body: 'twee' });
  controle(r.status === 412, 'server: oude versie → 412 (eerst ophalen)');
  r = await v({ method: 'PUT', headers: { Authorization: 'Bearer ' + 'y'.repeat(43), 'If-Match': '"1"' }, body: 'twee' });
  controle(r.status === 401, 'server: ander token → 401');
  r = await v({ method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'If-Match': '"1"' }, body: 'x'.repeat(300000) });
  controle(r.status === 200 && r.headers.get('ETag') === '"2"', 'server: groot pakket (in stukken) → versie 2');
  r = await v({ method: 'GET', headers: { 'If-None-Match': '"2"' } });
  controle(r.status === 304, 'server: niets nieuws → 304');
  r = await v({ method: 'GET' });
  controle((await r.text()).length === 300000 && r.headers.get('Access-Control-Allow-Origin') === '*', 'server: pakket komt volledig terug (met CORS)');
  r = await v({ method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  controle(r.status === 204 && (await v({ method: 'GET' })).status === 404, 'server: wissen');
  r = await fetch(adres + '/');
  controle((await r.text()).includes('voorraad-sync'), 'server: startpagina zegt dat hij werkt');
}

async function main() {
  samenvoegenTesten();
  const app = await appServer();
  const sync = await syncServer();
  await serverTesten(sync.adres);
  const basis = `http://localhost:${app.address().port}/`;
  const browser = await chromium.launch();

  async function toestel(naam, hash = '#voorraad') {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: basis.slice(0, -1) });
    const page = await ctx.newPage();
    page.jsFouten = [];
    page.on('pageerror', (e) => page.jsFouten.push(`${naam}: ${e.message}`));
    await page.goto(basis + hash);
    await page.waitForFunction(() => document.querySelector('#inhoud').children.length > 0 || document.querySelector('#vraag').open);
    page.api = (m, p, b) => page.evaluate(([m, p, b]) => fetch('api/' + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json()), [m, p, b]);
    page.namen = async () => (await page.api('GET', 'alles')).producten.map((p) => p.naam).sort().join(',');
    page.nu = () => page.evaluate(() => window.voorraadSync.nu());
    page.info = () => page.evaluate(() => window.voorraadSync.info());
    page.toast = (tekst) => page.waitForFunction((t) => !document.querySelector('#toast').hidden && document.querySelector('#toast').textContent.includes(t), tekst, { timeout: 8000 });
    page.vraag = async (invoer, knop) => {
      await page.waitForFunction(() => document.querySelector('#vraag').open);
      if (invoer !== null) await page.fill('#vraag-invoer', invoer);
      if (knop) controle((await page.textContent('#vraag-ja')).trim() === knop, `${naam}: vraag met knop "${knop}"`);
      await page.click('#vraag-ja');
      await page.waitForFunction(() => !document.querySelector('#vraag').open);
    };
    return page;
  }

  // --- Toestel A zet synchronisatie aan
  const A = await toestel('A', '#instellingen');
  await A.api('POST', 'producten', { naam: 'Melk', hoeveelheid: 1, eenheid: 'l', minimum: 2 });
  await A.api('POST', 'producten', { naam: 'Rijst', hoeveelheid: 500, eenheid: 'g' });
  await A.api('POST', 'recepten', { titel: 'Rijstpap', personen: 2, ingredienten: [{ naam: 'melk', hoeveelheid: 1, eenheid: 'l' }] });
  await A.reload();
  await A.waitForSelector('#sync-blok #s-aan');
  await A.click('#s-aan');
  await A.toast('Vul eerst het adres');
  await A.fill('#s-adres', 'http://localhost:1'); // niets op dit adres
  await A.click('#s-aan');
  await A.toast('niet bereikbaar');
  await A.fill('#s-adres', sync.adres);
  await A.click('#s-aan');
  await A.toast('Synchronisatie staat aan');
  const code = (await A.textContent('.sync-tekst')).trim();
  controle(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/.test(code), `A: koppelcode getoond (${code})`);
  await A.waitForSelector('#s-qr svg');
  controle(true, 'A: QR-code getoond');
  await A.click('#s-kopieer');
  await A.toast('Code gekopieerd');

  // op de server staat alleen versleutelde data
  const ruimtes = [...sync.env.opslagen.values()].filter((m) => m.has('meta'));
  const bytes = Buffer.concat(ruimtes.flatMap((m) => [...m.entries()].filter(([k]) => k.startsWith('deel:')).map(([, v]) => Buffer.from(v))));
  controle(ruimtes.length === 1 && bytes.length > 20, 'server: één ruimte met gegevens');
  controle(!bytes.toString('latin1').includes('Melk') && !bytes.toString('latin1').includes('Rijstpap'), 'server: de gegevens zijn onleesbaar (versleuteld)');

  // --- Toestel B heeft al eigen gegevens en koppelt met de getypte code (samenvoegen)
  const B = await toestel('B', '#instellingen');
  await B.api('POST', 'producten', { naam: 'Kaas', hoeveelheid: 1, eenheid: 'stuks' });
  await B.reload();
  await B.waitForSelector('#s-koppel');
  await B.click('#s-koppel');
  await B.vraag(code.slice(0, -1) + (code.endsWith('0') ? '1' : '0'), 'Verder'); // één teken fout
  await B.vraag(sync.adres, 'Verder');
  await B.toast('niets op de server');
  controle(true, 'B: verkeerde code → duidelijke melding');
  await B.click('#s-koppel');
  await B.vraag(code.toLowerCase().replace(/-/g, ' '), 'Verder'); // kleine letters en spaties mogen
  await B.vraag(sync.adres, 'Verder');
  await B.vraag(null, 'Samenvoegen');
  await B.toast('Gekoppeld');
  controle(await B.namen() === 'Kaas,Melk,Rijst', `B: gegevens van A erbij, eigen product behouden (${await B.namen()})`);
  await A.nu();
  controle(await A.namen() === 'Kaas,Melk,Rijst', `A: product van B binnengekomen (${await A.namen()})`);
  const melkB = (await B.api('GET', 'alles')).boodschappen.filter((b) => b.naam === 'Melk' && b.bron === 'minimum');
  controle(melkB.length === 1, 'B: automatische boodschap (minimum) maar één keer');

  // --- Toestel C koppelt via de link uit de QR-code (leeg toestel)
  const link = (await A.info()).link;
  const C = await toestel('C', link.slice(link.indexOf('#')).replace(/server=[^&]*/, 'server=' + encodeURIComponent(sync.adres)));
  await C.vraag(null, 'Verder'); // code is al ingevuld
  await C.vraag(null, 'Koppelen');
  await C.toast('Gekoppeld');
  controle(await C.namen() === 'Kaas,Melk,Rijst', `C: via de link gekoppeld (${await C.namen()})`);
  controle(!(await C.evaluate(() => location.hash)).includes('koppelen'), 'C: code niet meer in de adresbalk');

  // --- Een wijziging gaat vanzelf naar de server
  await A.api('POST', 'producten', { naam: 'Brood', hoeveelheid: 1, eenheid: 'stuks' });
  await A.waitForTimeout(2500);
  await B.nu();
  controle((await B.namen()).includes('Brood'), 'B: wijziging op A kwam vanzelf door');
  await B.goto(basis + '#boodschappen'); await B.reload();
  await B.waitForSelector('#inhoud .kop');
  await A.api('POST', 'boodschappen', { naam: 'Wc-papier' });
  await A.nu();
  await B.nu();
  await B.waitForFunction(() => document.querySelector('#inhoud').textContent.includes('Wc-papier'), null, { timeout: 5000 }).catch(() => {});
  controle(await B.evaluate(() => document.querySelector('#inhoud').textContent.includes('Wc-papier')), 'B: boodschap van A verschijnt meteen op het scherm');

  // --- Gelijktijdige wijzigingen
  const melkId = (await A.api('GET', 'alles')).producten.find((p) => p.naam === 'Melk').id;
  await A.api('PUT', `producten/${melkId}`, { hoeveelheid: 5 });
  await B.api('PUT', `producten/${melkId}`, { locatie: 'Koelkast' });
  await A.api('POST', 'producten', { naam: 'Appel', hoeveelheid: 1, eenheid: 'stuks' });
  await B.api('POST', 'producten', { naam: 'Peer', hoeveelheid: 1, eenheid: 'stuks' });
  await Promise.all([A.nu(), B.nu()]);
  await A.nu(); await B.nu(); await C.nu();
  for (const [n, t] of [['A', A], ['B', B], ['C', C]]) {
    const d = await t.api('GET', 'alles');
    const melk = d.producten.find((p) => p.id === melkId);
    controle(melk && melk.hoeveelheid === 5 && melk.locatie === 'Koelkast', `${n}: hoeveelheid (A) én plaats (B) van Melk bewaard`);
    controle(['Appel', 'Peer'].every((x) => d.producten.some((p) => p.naam === x)), `${n}: Appel (A) en Peer (B) allebei aanwezig`);
    controle(new Set(d.producten.map((p) => p.id)).size === d.producten.length, `${n}: geen dubbele id's`);
  }
  const rijstId = (await B.api('GET', 'alles')).producten.find((p) => p.naam === 'Rijst').id;
  await B.api('DELETE', `producten/${rijstId}`);
  await B.nu(); await A.nu();
  controle(!(await A.namen()).includes('Rijst'), 'A: op B gewist product is ook hier weg');

  // --- Na herstarten blijft de koppeling
  await C.reload();
  await C.waitForFunction(() => window.voorraadSync && window.voorraadSync.info());
  await C.nu();
  controle(!(await C.namen()).includes('Rijst') && (await C.info()).adres === sync.adres, 'C: na herstarten nog gekoppeld en bijgewerkt');

  // --- A stopt en wist de server
  await A.goto(basis + '#instellingen'); await A.reload();
  await A.waitForSelector('#s-stop');
  await A.click('#s-stop');
  await A.vraag(null, 'Stoppen');
  await A.vraag(null, 'Ook wissen');
  await A.toast('van de server gewist');
  controle((await A.info()) === null && (await A.namen()).includes('Melk'), 'A: gestopt, gegevens blijven op het toestel');
  await B.nu().catch(() => {});
  controle((await B.info()) === null && (await B.namen()).includes('Melk'), 'B: stopt ook (server gewist), gegevens blijven');
  controle(![...sync.env.opslagen.values()].some((m) => m.has('meta')), 'server: niets meer bewaard');

  for (const p of [A, B, C]) controle(!p.jsFouten.length, `geen JavaScript-fouten ${p.jsFouten.join(' | ')}`);
  await browser.close();
  app.close(); sync.s.close();
  if (fouten.length) { console.log(`\n${fouten.length} fout(en):\n- ` + fouten.join('\n- ')); process.exit(1); }
  console.log('\nSynchroniseren werkt.');
}
main().catch((e) => { console.error(e); process.exit(1); });

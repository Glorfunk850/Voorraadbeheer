// Service worker: laat de app installeren en offline werken.
// Verhoog VERSIE bij elke nieuwe uitgave, zodat toestellen de nieuwe bestanden ophalen.
// Verhoog ook APP_VERSIE in app.js naar hetzelfde nummer (test/versie.test.cjs controleert dat).
const VERSIE = 'voorraad-v87';
const EXTERN = 'voorraad-extern-v1'; // tekstherkenning (Tesseract.js + taalbestanden), na eerste gebruik offline
const BESTANDEN = [
  './', 'index.html', 'style.css', 'app.js', 'lokaal.js', 'samenvoegen.js', 'parser.js', 'layout.js', 'handleiding.js', 'handleiding-pdf.js', 'manifest.webmanifest',
  'icoon.svg', 'icoon.png', 'icoon-192.png', 'icoon-512.png', 'icoon-maskable-512.png',
];
// pdf-lezer, QR-codes en het serveradres: los bewaard, zodat één ontbrekend bestand de installatie niet tegenhoudt
const PDF_BESTANDEN = [
  'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs',
  'vendor/standard_fonts/LiberationSans-Regular.ttf', 'vendor/standard_fonts/LiberationSans-Bold.ttf',
  'vendor/standard_fonts/LiberationSans-Italic.ttf', 'vendor/standard_fonts/LiberationSans-BoldItalic.ttf',
  'vendor/wasm/jbig2.wasm', 'vendor/wasm/openjpeg.wasm', 'vendor/wasm/qcms_bg.wasm',
  'vendor/wasm/jbig2_nowasm_fallback.js', 'vendor/wasm/openjpeg_nowasm_fallback.js',
  'sync-adres.js', 'vendor/qrcode.js', 'vendor/jsQR.js', // ook los: ontbreekt sync-adres.js, dan werkt de app gewoon
  // schermafbeeldingen in de handleiding (ook los: zonder afbeelding blijft de uitleg leesbaar)
  ...['voorraad', 'product-toevoegen', 'product', 'boodschappen', 'winkelen', 'catalogus', 'recepten', 'recept', 'planner', 'instellingen']
    .map((n) => `handleiding/${n}.jpg`),
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // nieuwe versie meteen in gebruik nemen
  e.waitUntil(caches.open(VERSIE).then(async (c) => {
    await c.addAll(BESTANDEN);
    await Promise.all(PDF_BESTANDEN.map((b) => c.add(b).catch(() => console.warn('Niet gevonden:', b))));
  }));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const naam of await caches.keys()) if (naam !== VERSIE && naam !== EXTERN) await caches.delete(naam);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tesseract.js en taalbestanden: eerst uit de cache, anders ophalen en bewaren
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith((async () => {
      const c = await caches.open(EXTERN);
      const bewaard = await c.match(req);
      if (bewaard) return bewaard;
      const antwoord = await fetch(req);
      if (antwoord.ok || antwoord.type === 'opaque') c.put(req, antwoord.clone());
      return antwoord;
    })());
    return;
  }
  if (url.origin !== self.location.origin) return; // bv. Open Food Facts: gewoon online

  // Eigen bestanden: eerst de nieuwste versie van internet (zodat een toestel nooit een oude app toont),
  // zonder internet of als het te lang duurt: de bewaarde versie.
  e.respondWith((async () => {
    const c = await caches.open(VERSIE);
    const sleutel = req.mode === 'navigate' ? 'index.html' : req;
    const vers = fetch(req, { cache: 'no-cache' }).then((a) => {
      if (a.ok) c.put(sleutel, a.clone());
      return a.ok ? a : null;
    }).catch(() => null);
    const traag = new Promise((ok) => setTimeout(() => ok(null), 4000));
    const antwoord = await Promise.race([vers, traag]);
    if (antwoord) return antwoord;
    e.waitUntil(vers);
    return (await c.match(sleutel, { ignoreSearch: true })) || (await vers) || (await c.match('index.html')) || Response.error();
  })());
});

// ---------------------------------------------------------------------------
// Melding als een product op moet, ook als de app dicht is (zie "Op te gebruiken melden" in app.js).
// De browser roept 'periodicsync' af en toe op (Chrome en Edge, als de app geïnstalleerd is).
// Hoogstens één melding per dag; heb je de app vandaag al geopend (en het venster gezien), dan geen melding.
// ---------------------------------------------------------------------------
const MELDING_TAG = 'op-te-gebruiken';
const isoVandaag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function dagenTot(datum) {
  const [j, m, d] = datum.split('-').map(Number);
  const nu = new Date();
  return Math.round((Date.UTC(j, m - 1, d) - Date.UTC(nu.getFullYear(), nu.getMonth(), nu.getDate())) / 86400000);
}
const wanneer = (d) => (d === 0 ? 'vandaag' : d === 1 ? 'morgen' : d === -1 ? 'gisteren' : d < 0 ? `${-d} dagen geleden` : `over ${d} dagen`);
// zelfde regels als houdbaarheid() in app.js; geeft { niveau, kort } of null als het (nog) niet op moet
function houdbaarheid(p, inst) {
  if (!p || !p.vervaldatum || !(p.hoeveelheid > 0)) return null;
  const d = dagenTot(p.vervaldatum);
  if (p.datumtype === 'TGT') {
    if (d < 0) return { niveau: 4, kort: 'verlopen' };
    return d <= (inst.tgt_dagen ?? 2) ? { niveau: 3, kort: wanneer(d) } : null;
  }
  if (d < 0) return { niveau: 2, kort: 'datum voorbij' };
  return d <= (inst.tht_dagen ?? 3) ? { niveau: 1, kort: wanneer(d) } : null;
}
function dbOpenen() {
  return new Promise((ok, nee) => {
    const r = indexedDB.open('voorraadbeheer', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('staat');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => nee(r.error);
  });
}
const dbLezen = (db, sleutel) => new Promise((ok, nee) => {
  const r = db.transaction('staat').objectStore('staat').get(sleutel);
  r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error);
});
const dbZetten = (db, sleutel, waarde) => new Promise((ok, nee) => {
  const t = db.transaction('staat', 'readwrite');
  t.objectStore('staat').put(waarde, sleutel);
  t.oncomplete = ok; t.onerror = () => nee(t.error);
});
async function opTeGebruikenMelden() {
  if (self.Notification && self.Notification.permission !== 'granted') return;
  const db = await dbOpenen();
  try {
    const melding = (await dbLezen(db, 'melding')) || {};
    const d = isoVandaag();
    if (!melding.aan || melding.laatst === d) return;
    const gegevens = (await dbLezen(db, 'gegevens')) || {};
    const inst = gegevens.instellingen || {};
    const lijst = (gegevens.producten || []).map((p) => ({ p, h: houdbaarheid(p, inst) })).filter((x) => x.h)
      .sort((a, b) => (b.h.niveau >= 3) - (a.h.niveau >= 3) || a.p.vervaldatum.localeCompare(b.p.vervaldatum));
    if (!lijst.length) return;
    const titel = lijst.length === 1 ? `${lijst[0].p.naam} op te gebruiken` : `${lijst.length} producten op te gebruiken`;
    const tekst = lijst.slice(0, 4).map(({ p, h }) => `${p.naam}: ${h.kort}`).join(' · ') + (lijst.length > 4 ? ` · en nog ${lijst.length - 4}` : '');
    await self.registration.showNotification(titel, { body: tekst, icon: 'icoon-192.png', badge: 'icoon-192.png', tag: MELDING_TAG, data: { view: 'voorraad' } });
    await dbZetten(db, 'melding', { ...melding, laatst: d });
  } finally { db.close(); }
}
self.addEventListener('periodicsync', (e) => { if (e.tag === MELDING_TAG) e.waitUntil(opTeGebruikenMelden().catch(() => {})); });

// tik op de melding: de app openen (of naar voren halen) op het tabblad Voorraad
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const view = (e.notification.data && e.notification.data.view) || 'voorraad';
    const ramen = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const r of ramen) {
      if (new URL(r.url).origin !== self.location.origin) continue;
      r.postMessage({ naar: view });
      if ('focus' in r) return r.focus();
    }
    return self.clients.openWindow('./#' + view);
  })());
});

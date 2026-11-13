// Service worker: laat de app installeren en offline werken.
// Verhoog VERSIE bij elke nieuwe uitgave, zodat toestellen de nieuwe bestanden ophalen.
const VERSIE = 'voorraad-v6';
const EXTERN = 'voorraad-extern-v1'; // tekstherkenning (Tesseract.js + taalbestanden), na eerste gebruik offline
const BESTANDEN = [
  './', 'index.html', 'style.css', 'app.js', 'lokaal.js', 'parser.js', 'layout.js', 'barcode.js', 'manifest.webmanifest',
  'icoon.svg', 'icoon.png', 'icoon-192.png', 'icoon-512.png', 'icoon-maskable-512.png',
];
// pdf-lezer: los bewaard, zodat één ontbrekend bestand de installatie niet tegenhoudt
const PDF_BESTANDEN = [
  'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs',
  'vendor/standard_fonts/LiberationSans-Regular.ttf', 'vendor/standard_fonts/LiberationSans-Bold.ttf',
  'vendor/standard_fonts/LiberationSans-Italic.ttf', 'vendor/standard_fonts/LiberationSans-BoldItalic.ttf',
  'vendor/wasm/jbig2.wasm', 'vendor/wasm/openjpeg.wasm', 'vendor/wasm/qcms_bg.wasm',
  'vendor/wasm/jbig2_nowasm_fallback.js', 'vendor/wasm/openjpeg_nowasm_fallback.js',
];

self.addEventListener('install', (e) => {
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

  // Eigen bestanden: meteen uit de cache, op de achtergrond verversen
  e.respondWith((async () => {
    const c = await caches.open(VERSIE);
    const sleutel = req.mode === 'navigate' ? 'index.html' : req;
    const bewaard = await c.match(sleutel, { ignoreSearch: true });
    const vers = fetch(req).then((a) => { if (a.ok && req.mode !== 'navigate') c.put(req, a.clone()); return a; }).catch(() => null);
    if (bewaard) { e.waitUntil(vers); return bewaard; }
    return (await vers) || (await c.match('index.html')) || Response.error();
  })());
});

// Voorraadbeheer — synchronisatieserver (Cloudflare Worker met een Durable Object).
//
// Werkt zoals de synchronisatie van DuckDuckGo: de app versleutelt alles op het toestel zelf, met een sleutel
// die afgeleid is van de koppelcode. Die code komt nooit op de server. De server bewaart per "ruimte" alleen
// één versleuteld pakket (onleesbare bytes) met een versienummer, en kan de inhoud dus niet lezen.
//
//   GET    /r/<ruimte>   het pakket ophalen (304 als de versie in If-None-Match nog de nieuwste is)
//   PUT    /r/<ruimte>   een nieuw pakket bewaren; If-Match "<versie>" (of If-None-Match * voor een nieuwe ruimte)
//                        → 412 als een ander toestel intussen iets bewaarde: dan eerst ophalen en samenvoegen
//   DELETE /r/<ruimte>   alles van de server wissen
// Schrijven en wissen vragen "Authorization: Bearer <token>". Ook dat token is afgeleid van de koppelcode;
// de server bewaart er alleen een hash van.
//
// Een Durable Object per ruimte zorgt dat twee toestellen nooit tegelijk schrijven (geen verloren wijzigingen).

const MAX_GROOTTE = 10 * 1024 * 1024; // 10 MB versleuteld (gecomprimeerd) per ruimte: ruim voldoende
const DEEL = 128 * 1024; // opgeslagen in stukken (een waarde in de opslag mag niet onbeperkt groot zijn)
const RUIMTE = /^\/r\/([0-9a-f]{32})$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
  'Access-Control-Max-Age': '86400',
};

const antwoord = (status, tekst = null, extra = {}) =>
  new Response(tekst, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

async function hash(tekst) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tekst));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const tokenUit = (req) => (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();

export class Ruimte {
  constructor(state) {
    this.state = state;
    this.opslag = state.storage;
  }

  // één verzoek tegelijk per ruimte: lezen-vergelijken-schrijven kan zo nooit door elkaar lopen
  fetch(req) {
    return this.state.blockConcurrencyWhile(() => this.verwerken(req));
  }

  async verwerken(req) {
    const meta = (await this.opslag.get('meta')) || null; // { versie, token, delen, grootte, gewijzigd }
    const etag = meta ? `"${meta.versie}"` : null;

    if (req.method === 'GET') {
      if (!meta) return antwoord(404, 'Niet gevonden');
      if (req.headers.get('If-None-Match') === etag) return antwoord(304, null, { ETag: etag });
      const sleutels = Array.from({ length: meta.delen }, (_, i) => 'deel:' + i);
      const delen = sleutels.length ? await this.opslag.get(sleutels) : new Map();
      const uit = new Uint8Array(meta.grootte);
      let plek = 0;
      for (const s of sleutels) {
        const d = new Uint8Array(delen.get(s));
        uit.set(d, plek);
        plek += d.byteLength;
      }
      return new Response(uit, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', ETag: etag } });
    }

    const token = tokenUit(req);
    if (token.length < 20) return antwoord(401, 'Geen toegang');
    const tokenHash = await hash(token);
    if (meta && meta.token !== tokenHash) return antwoord(401, 'Geen toegang');

    if (req.method === 'DELETE') {
      if (!meta) return antwoord(404, 'Niet gevonden');
      await this.opslag.deleteAll();
      return antwoord(204);
    }

    if (req.method === 'PUT') {
      // alleen schrijven als het toestel de nieuwste versie kende
      if (meta ? req.headers.get('If-Match') !== etag : req.headers.get('If-None-Match') !== '*') {
        return antwoord(412, 'Intussen gewijzigd', etag ? { ETag: etag } : {});
      }
      const lengte = +req.headers.get('Content-Length') || 0;
      if (lengte > MAX_GROOTTE) return antwoord(413, 'Te groot');
      const body = new Uint8Array(await req.arrayBuffer());
      if (!body.byteLength) return antwoord(400, 'Leeg');
      if (body.byteLength > MAX_GROOTTE) return antwoord(413, 'Te groot');

      const nieuw = { versie: (meta ? meta.versie : 0) + 1, token: tokenHash, delen: Math.ceil(body.byteLength / DEEL),
        grootte: body.byteLength, gewijzigd: new Date().toISOString() };
      const teSchrijven = {};
      for (let i = 0; i < nieuw.delen; i++) teSchrijven['deel:' + i] = body.slice(i * DEEL, (i + 1) * DEEL).buffer;
      teSchrijven.meta = nieuw;
      // hoogstens 128 sleutels per keer
      const lijst = Object.entries(teSchrijven);
      for (let i = 0; i < lijst.length; i += 100) await this.opslag.put(Object.fromEntries(lijst.slice(i, i + 100)));
      const oud = meta ? meta.delen : 0;
      if (oud > nieuw.delen) await this.opslag.delete(Array.from({ length: oud - nieuw.delen }, (_, i) => 'deel:' + (nieuw.delen + i)));
      return antwoord(200, 'Bewaard', { ETag: `"${nieuw.versie}"` });
    }
    return antwoord(405, 'Niet toegestaan');
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    let a;
    if (url.pathname === '/' || url.pathname === '') {
      a = antwoord(200, 'voorraad-sync: deze synchronisatieserver voor Voorraadbeheer werkt.');
    } else {
      const m = url.pathname.match(RUIMTE);
      if (!m) a = antwoord(404, 'Niet gevonden');
      else a = await env.RUIMTE.get(env.RUIMTE.idFromName(m[1])).fetch(req);
    }
    const uit = new Response(a.body, a);
    for (const [k, v] of Object.entries(CORS)) uit.headers.set(k, v);
    return uit;
  },
};

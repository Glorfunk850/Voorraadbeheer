// Maakt van de handleiding (de HTML in handleiding.js) een pdf-bestand, helemaal op het toestel zelf:
// geen bibliotheek en geen internet nodig. Gebruikt de standaardlettertypen die elke pdf-lezer kent
// (Helvetica en Courier), dus het bestand blijft klein.

// Breedtes (per 1000 eenheden) van de tekens 32..255 in Windows-1252, voor Helvetica en Helvetica-Bold.
const BREEDTE_GEWOON = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const BREEDTE_VET = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

// Tekens die niet in Windows-1252 staan, vervangen door iets dat er wel in staat
const VERVANG = { '→': '›', '←': '‹', '↑': '^', '↓': 'v', '−': '-', '⋮': '...', '✓': 'v', '\u00a0': ' ', '\u200b': '' };
// Unicode-tekens die in Windows-1252 op een andere plaats staan dan in Latin-1
const CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };

/** Tekst omzetten naar Windows-1252-codes (één teken per code). */
function codeer(tekst) {
  let uit = '';
  for (const t of tekst) {
    const v = VERVANG[t] ?? t;
    for (const c of v) {
      const n = c.codePointAt(0);
      if (CP1252[c]) uit += String.fromCharCode(CP1252[c]);
      else if ((n >= 32 && n < 127) || (n >= 0xa0 && n <= 0xff)) uit += c;
      else if (n === 10 || n === 9) uit += ' ';
      else uit += '?';
    }
  }
  return uit;
}

const LETTER = { gewoon: 'F1', vet: 'F2', schuin: 'F3', code: 'F4' };

/** Breedte in punten van al gecodeerde tekst. */
function breedte(tekst, stijl, grootte) {
  if (stijl === 'code') return tekst.length * 600 * grootte / 1000;
  const tabel = stijl === 'vet' ? BREEDTE_VET : BREEDTE_GEWOON;
  let b = 0;
  for (let i = 0; i < tekst.length; i++) b += tabel[tekst.charCodeAt(i) - 32] || 556;
  return b * grootte / 1000;
}

const escape = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);

// A4 in punten
const BREED = 595.28, HOOG = 841.89, MARGE = 56, ONDER = 60;
const INHOUD = BREED - 2 * MARGE;
const KLEUR_TEKST = '0.12 0.12 0.13', KLEUR_STIL = '0.42 0.42 0.45', KLEUR_LIJN = '0.82 0.82 0.84', KLEUR_ACCENT = '0.10 0.43 0.27';

/** Inline-inhoud van een element als lijst stukjes {tekst, stijl}. */
function stukjes(el, stijl = 'gewoon') {
  const uit = [];
  for (const n of el.childNodes) {
    if (n.nodeType === 3) uit.push({ tekst: n.textContent.replace(/\s+/g, ' '), stijl });
    else if (n.nodeType === 1) {
      const tag = n.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol' || tag === 'table') continue; // blokken binnen een opsomming apart
      if (tag === 'br') { uit.push({ tekst: '\n', stijl }); continue; }
      const s = tag === 'b' || tag === 'strong' || tag === 'th' ? 'vet'
        : tag === 'i' || tag === 'em' ? (stijl === 'vet' ? 'vet' : 'schuin')
        : tag === 'code' ? 'code' : stijl;
      uit.push(...stukjes(n, s));
    }
  }
  return uit;
}

/** Stukjes over regels verdelen. Geeft regels terug: elk een lijst {tekst, stijl, x}. */
function regels(stuks, grootte, max) {
  // in woorden splitsen; spaties horen bij het woord ervoor
  const woorden = [];
  for (const s of stuks) {
    if (s.tekst === '\n') { woorden.push({ breuk: true }); continue; }
    const delen = codeer(s.tekst).split(/(?<= )/);
    for (const d of delen) if (d) woorden.push({ tekst: d, stijl: s.stijl });
  }
  const uit = [];
  let regel = [], x = 0;
  const klaar = () => {
    // spatie aan het einde van de regel weghalen
    const laatste = regel[regel.length - 1];
    if (laatste) laatste.tekst = laatste.tekst.replace(/ +$/, '');
    uit.push(regel.filter((w) => w.tekst)); regel = []; x = 0;
  };
  for (const w of woorden) {
    if (w.breuk) { klaar(); continue; }
    if (!regel.length) w.tekst = w.tekst.replace(/^ +/, '');
    if (!w.tekst) continue;
    const b = breedte(w.tekst.replace(/ +$/, ''), w.stijl, grootte);
    if (regel.length && x + b > max) klaar();
    if (!regel.length) w.tekst = w.tekst.replace(/^ +/, '');
    // een woord dat langer is dan de regel: zo laten (komt in deze handleiding niet voor)
    regel.push({ tekst: w.tekst, stijl: w.stijl, x });
    x += breedte(w.tekst, w.stijl, grootte);
  }
  if (regel.length) klaar();
  // aaneengesloten stukjes met dezelfde stijl samenvoegen (kleiner bestand)
  return uit.map((r) => r.reduce((acc, w) => {
    const v = acc[acc.length - 1];
    if (v && v.stijl === w.stijl) v.tekst += w.tekst; else acc.push({ ...w });
    return acc;
  }, []));
}

/** Breedte en hoogte (in pixels) van een JPEG-bestand, of null als het geen bruikbare JPEG is. */
export function jpegMaat(b) {
  if (!b || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], lengte = (b[i + 2] << 8) | b[i + 3];
    // SOF0..SOF15, behalve DHT (c4), JPG (c8) en DAC (cc)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { hoog: (b[i + 5] << 8) | b[i + 6], breed: (b[i + 7] << 8) | b[i + 8], kleuren: b[i + 9] };
    }
    i += 2 + lengte;
  }
  return null;
}

const FOTO_BREED = 150; // breedte van een schermafbeelding in de pdf (punten), de uitleg komt ernaast

class Opmaak {
  constructor(afbeeldingen = {}) { this.paginas = []; this.afbeeldingen = afbeeldingen; this.gebruikt = []; this.nieuwePagina(); }
  nieuwePagina() { this.inhoud = []; this.paginas.push(this.inhoud); this.y = HOOG - MARGE; this.leeg = true; }
  ruimte(h) { if (this.y - h < ONDER && !this.leeg) this.nieuwePagina(); }
  tekstRegel(regel, x, y, grootte, kleur = KLEUR_TEKST) {
    this.inhoud.push(`${kleur} rg`);
    for (const w of regel) this.inhoud.push(`BT /${LETTER[w.stijl]} ${grootte} Tf ${(x + w.x).toFixed(2)} ${y.toFixed(2)} Td (${escape(w.tekst)}) Tj ET`);
    this.leeg = false;
  }
  lijn(x1, y1, x2, y2, kleur = KLEUR_LIJN, dikte = 0.6) {
    this.inhoud.push(`${kleur} RG ${dikte} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }
  /** Een alinea (of opsommingspunt) zetten. */
  alinea(stuks, { grootte = 10, x = MARGE, breed = INHOUD, voor = 0, na = 6, kleur, teken, tekenX } = {}) {
    const lh = grootte * 1.42;
    const rs = regels(stuks, grootte, breed);
    if (!rs.length) return;
    this.y -= voor;
    // kop nooit alleen onderaan een pagina: ruimte vragen voor de kop plus wat tekst erna
    this.ruimte(lh * Math.min(rs.length, 2) + (kleur === KLEUR_ACCENT || stuks.kop ? 40 : 0));
    rs.forEach((r, i) => {
      this.ruimte(lh);
      this.y -= lh;
      if (i === 0 && teken) this.tekstRegel([{ tekst: codeer(teken), stijl: 'gewoon', x: 0 }], tekenX, this.y + grootte * 0.3, grootte, kleur);
      this.tekstRegel(r, x, this.y + grootte * 0.3, grootte, kleur);
    });
    this.y -= na;
  }
  tabel(el) {
    const rijen = [...el.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => ({ stuks: stukjes(c, c.tagName === 'TH' ? 'vet' : 'gewoon'), kop: c.tagName === 'TH' })));
    if (!rijen.length) return;
    const n = Math.max(...rijen.map((r) => r.length));
    const g = 9, lh = g * 1.4, pad = 5;
    // natuurlijke breedte per kolom (alles op één regel), daarna eerlijk verdelen
    const natuur = Array.from({ length: n }, (_, k) => Math.max(30, ...rijen.map((r) => r[k]
      ? r[k].stuks.reduce((s, w) => s + breedte(codeer(w.tekst), w.stijl, g), 0) + 2 * pad : 0)));
    let kol = natuur.map(() => INHOUD / n);
    const totaal = natuur.reduce((a, b) => a + b, 0);
    if (totaal <= INHOUD) kol = natuur.map((b) => b * INHOUD / totaal);
    else {
      kol = natuur.map((b) => Math.min(b, INHOUD / n));
      const rest = INHOUD - kol.reduce((a, b) => a + b, 0);
      const tekort = natuur.map((b, i) => b - kol[i]);
      const som = tekort.reduce((a, b) => a + b, 0) || 1;
      kol = kol.map((b, i) => b + rest * tekort[i] / som);
    }
    this.y -= 4;
    for (const rij of rijen) {
      const cellen = rij.map((c, k) => ({ ...c, regels: regels(c.stuks, g, kol[k] - 2 * pad) }));
      const h = Math.max(1, ...cellen.map((c) => c.regels.length)) * lh + 2 * pad - 2;
      this.ruimte(h);
      let x = MARGE;
      cellen.forEach((c, k) => {
        c.regels.forEach((r, i) => this.tekstRegel(r, x + pad, this.y - pad - (i + 1) * lh + g * 0.35, g, c.kop ? KLEUR_STIL : KLEUR_TEKST));
        x += kol[k];
      });
      this.y -= h;
      this.lijn(MARGE, this.y, MARGE + INHOUD, this.y, KLEUR_LIJN, cellen[0]?.kop ? 0.9 : 0.5);
      this.leeg = false;
    }
    this.y -= 8;
  }
  lijst(el, x, diepte = 0) {
    const genummerd = el.tagName === 'OL';
    let nr = 1;
    for (const li of el.children) {
      if (li.tagName !== 'LI') continue;
      const teken = genummerd ? `${nr++}.` : (diepte ? '-' : '•');
      this.alinea(stukjes(li), { x: x + 16, breed: INHOUD - (x - MARGE) - 16, na: 3, teken, tekenX: x + 2 });
      for (const sub of li.children) {
        if (sub.tagName === 'UL' || sub.tagName === 'OL') this.lijst(sub, x + 16, diepte + 1);
        else if (sub.tagName === 'TABLE') this.tabel(sub);
      }
    }
    this.y -= 4;
  }
  /** Een schermafbeelding (figure met img en figcaption): links de afbeelding, rechts de uitleg. */
  figuur(el) {
    const img = el.querySelector('img');
    const bytes = img && this.afbeeldingen[img.getAttribute('src')];
    const maat = jpegMaat(bytes);
    const onder = el.querySelector('figcaption');
    if (!maat) { if (onder) this.alinea(stukjes(onder), { grootte: 9, kleur: KLEUR_STIL }); return; } // geen afbeelding: alleen de uitleg
    let naam = this.gebruikt.findIndex((a) => a.bytes === bytes);
    if (naam < 0) { this.gebruikt.push({ bytes, ...maat }); naam = this.gebruikt.length - 1; }
    const b = FOTO_BREED, h = b * maat.hoog / maat.breed;
    this.y -= 4;
    this.ruimte(h + 8);
    const y = this.y - h;
    this.inhoud.push(`q ${b.toFixed(2)} 0 0 ${h.toFixed(2)} ${MARGE.toFixed(2)} ${y.toFixed(2)} cm /Im${naam + 1} Do Q`);
    this.inhoud.push(`${KLEUR_LIJN} RG 0.6 w ${MARGE.toFixed(2)} ${y.toFixed(2)} ${b.toFixed(2)} ${h.toFixed(2)} re S`);
    this.leeg = false;
    if (onder) {
      const x = MARGE + b + 16, breed = INHOUD - b - 16, g = 9.5, lh = g * 1.42;
      const rs = regels(stukjes(onder), g, breed);
      let ty = this.y - Math.max(0, (h - rs.length * lh) / 2);
      for (const r of rs) { ty -= lh; this.tekstRegel(r, x, ty + g * 0.3, g, KLEUR_STIL); }
    }
    this.y = y - 12;
  }
  blokken(root) {
    for (const el of root.children) {
      const tag = el.tagName;
      if (tag === 'H1' || tag === 'H2') {
        const s = stukjes(el, 'vet'); s.kop = true;
        if (!this.leeg) {
          this.ruimte(80);
          if (!this.leeg) { this.y -= 14; this.lijn(MARGE, this.y, MARGE + INHOUD, this.y); }
        }
        this.alinea(s, { grootte: 15, voor: this.leeg ? 0 : 6, na: 6, kleur: KLEUR_ACCENT });
      } else if (/^H[3-6]$/.test(tag)) {
        const s = stukjes(el, 'vet'); s.kop = true;
        this.alinea(s, { grootte: 11.5, voor: 8, na: 3 });
      } else if (tag === 'P') this.alinea(stukjes(el));
      else if (tag === 'UL' || tag === 'OL') this.lijst(el, MARGE);
      else if (tag === 'TABLE') this.tabel(el);
      else if (tag === 'FIGURE') this.figuur(el);
      else if (el.children.length) this.blokken(el);
      else if (el.textContent.trim()) this.alinea(stukjes(el));
    }
  }
}

/** Alle onderdelen samenvoegen tot een pdf-bestand (als Uint8Array). */
function pdfBestand(paginas, titel, afbeeldingen = []) {
  const obj = [];
  const nieuw = (inhoud) => { obj.push(inhoud); return obj.length; };
  const catalogus = nieuw(null), boom = nieuw(null);
  const font = (naam) => nieuw(`<< /Type /Font /Subtype /Type1 /BaseFont /${naam} /Encoding /WinAnsiEncoding >>`);
  const f = { F1: font('Helvetica'), F2: font('Helvetica-Bold'), F3: font('Helvetica-Oblique'), F4: font('Courier') };
  const binair = (bytes) => { let t = ''; for (let i = 0; i < bytes.length; i += 8192) t += String.fromCharCode(...bytes.subarray(i, i + 8192)); return t; };
  const beelden = afbeeldingen.map((a) => nieuw(`<< /Type /XObject /Subtype /Image /Width ${a.breed} /Height ${a.hoog} `
    + `/ColorSpace /${a.kleuren === 1 ? 'DeviceGray' : a.kleuren === 4 ? 'DeviceCMYK' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode `
    + `/Length ${a.bytes.length} >>\nstream\n${binair(a.bytes)}\nendstream`));
  const xobj = beelden.length ? ` /XObject << ${beelden.map((n, i) => `/Im${i + 1} ${n} 0 R`).join(' ')} >>` : '';
  const bronnen = `<< /Font << ${Object.entries(f).map(([k, v]) => `/${k} ${v} 0 R`).join(' ')} >>${xobj} >>`;
  const kinderen = paginas.map((inhoud) => {
    const stroom = inhoud.join('\n');
    const s = nieuw(`<< /Length ${stroom.length} >>\nstream\n${stroom}\nendstream`);
    return nieuw(`<< /Type /Page /Parent ${boom} 0 R /MediaBox [0 0 ${BREED} ${HOOG}] /Resources ${bronnen} /Contents ${s} 0 R >>`);
  });
  obj[boom - 1] = `<< /Type /Pages /Kids [${kinderen.map((k) => `${k} 0 R`).join(' ')}] /Count ${kinderen.length} >>`;
  obj[catalogus - 1] = `<< /Type /Catalog /Pages ${boom} 0 R /Lang (nl) >>`;
  const info = nieuw(`<< /Title (${escape(codeer(titel))}) /Producer (Voorraad) >>`);
  let uit = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const plaats = [];
  obj.forEach((o, i) => { plaats.push(uit.length); uit += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = uit.length;
  uit += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n${plaats.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  uit += `trailer\n<< /Size ${obj.length + 1} /Root ${catalogus} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(uit.length);
  for (let i = 0; i < uit.length; i++) bytes[i] = uit.charCodeAt(i) & 0xff;
  return bytes;
}

/**
 * De handleiding-HTML omzetten naar een pdf.
 * @param {string} html  de handleiding (HTML-fragment)
 * @param {{titel?: string, onderschrift?: string, afbeeldingen?: Object<string, Uint8Array>}} opties
 *   afbeeldingen: per src (zoals in de HTML) de bytes van het JPEG-bestand; ontbreekt er een, dan komt alleen de uitleg in de pdf
 * @returns {Uint8Array}
 */
export function handleidingPdf(html, { titel = 'Handleiding Voorraad', onderschrift = '', afbeeldingen = {} } = {}) {
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, 'text/html');
  const o = new Opmaak(afbeeldingen);
  o.alinea([{ tekst: titel, stijl: 'vet' }], { grootte: 22, na: 2, kleur: KLEUR_ACCENT });
  if (onderschrift) o.alinea([{ tekst: onderschrift, stijl: 'gewoon' }], { grootte: 9.5, na: 6, kleur: KLEUR_STIL });
  o.y -= 10;
  o.lijn(MARGE, o.y, MARGE + INHOUD, o.y, KLEUR_ACCENT, 1.2);
  o.y -= 10;
  o.leeg = true; // de eerste kop hoeft geen extra scheidingslijn
  o.blokken(doc.body);
  // paginanummers onderaan
  const totaal = o.paginas.length;
  o.paginas.forEach((p, i) => {
    const tekst = codeer(`${titel}  ·  pagina ${i + 1} van ${totaal}`);
    const x = BREED / 2 - breedte(tekst, 'gewoon', 8) / 2;
    p.push(`${KLEUR_STIL} rg BT /F1 8 Tf ${x.toFixed(2)} 32 Td (${escape(tekst)}) Tj ET`);
  });
  return pdfBestand(o.paginas, titel, o.gebruikt);
}

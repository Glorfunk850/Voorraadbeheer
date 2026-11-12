// Barcodes (EAN-13, EAN-8, UPC-A) lezen uit een foto. Werkt volledig in de browser.
//
// Werkwijze: we trekken veel horizontale en verticale lijnen door de foto, zetten elke lijn om
// naar zwart/wit, meten de breedtes van de strepen en vergelijken die met de EAN-patronen.
// Alleen codes met een geldig controlecijfer worden aanvaard; de code die op de meeste lijnen
// gevonden wordt, wint.

// Breedtes (in modules) per cijfer: L-code (ruimte, streep, ruimte, streep)
const L = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'].map((s) => [...s].map(Number));
const G = L.map((p) => [...p].reverse());
const PARITEIT = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function cijferZoeken(breedtes, metG) {
  const som = breedtes[0] + breedtes[1] + breedtes[2] + breedtes[3];
  const n = breedtes.map((b) => (b * 7) / som);
  // Afstanden tussen gelijke randen (ruimte+streep) blijven kloppen als strepen door onscherpte
  // of inkt breder lijken; de breedtes zelf gebruiken we om 1/7 en 2/8 uit elkaar te houden.
  const r0 = n[0] + n[1], r1 = n[1] + n[2], r2 = n[2] + n[3];
  let beste = null;
  const proberen = (tabel, soort) => {
    for (let c = 0; c < 10; c++) {
      const p = tabel[c];
      const rand = Math.abs(r0 - p[0] - p[1]) + Math.abs(r1 - p[1] - p[2]) + Math.abs(r2 - p[2] - p[3]);
      const breed = Math.abs(n[0] - p[0]) + Math.abs(n[1] - p[1]) + Math.abs(n[2] - p[2]) + Math.abs(n[3] - p[3]);
      const fout = rand + 0.35 * breed;
      if (!beste || fout < beste.fout) beste = { cijfer: c, soort, fout };
    }
  };
  proberen(L, 'L');
  if (metG) proberen(G, 'G');
  return beste && beste.fout < 2.2 ? beste : null;
}

function wachterOk(runs, i, aantal, module) {
  for (let k = 0; k < aantal; k++) {
    const r = runs[i + k] / module;
    if (r < 0.35 || r > 2.1) return false;
  }
  return true;
}

export function controleOk(code) {
  const c = [...code].map(Number);
  const n = c.length;
  let som = 0;
  for (let i = 0; i < n - 1; i++) som += c[i] * ((n - 1 - i) % 2 === 1 ? 3 : 1);
  return (10 - (som % 10)) % 10 === c[n - 1];
}

function ean13(seg) {
  let totaal = 0;
  for (let k = 0; k < 59; k++) totaal += seg[k];
  const module = totaal / 95;
  if (!wachterOk(seg, 0, 3, module) || !wachterOk(seg, 27, 5, module) || !wachterOk(seg, 56, 3, module)) return null;
  const cijfers = [];
  let pariteit = '';
  for (let d = 0; d < 6; d++) {
    const r = cijferZoeken(seg.slice(3 + d * 4, 7 + d * 4), true);
    if (!r) return null;
    cijfers.push(r.cijfer);
    pariteit += r.soort;
  }
  for (let d = 0; d < 6; d++) {
    const r = cijferZoeken(seg.slice(32 + d * 4, 36 + d * 4), false);
    if (!r) return null;
    cijfers.push(r.cijfer);
  }
  const eerste = PARITEIT.indexOf(pariteit);
  if (eerste < 0) return null;
  const code = eerste + cijfers.join('');
  return controleOk(code) ? code : null;
}

function ean8(seg) {
  let totaal = 0;
  for (let k = 0; k < 43; k++) totaal += seg[k];
  const module = totaal / 67;
  if (!wachterOk(seg, 0, 3, module) || !wachterOk(seg, 19, 5, module) || !wachterOk(seg, 40, 3, module)) return null;
  const cijfers = [];
  for (const begin of [3, 24]) {
    for (let d = 0; d < 4; d++) {
      const r = cijferZoeken(seg.slice(begin + d * 4, begin + 4 + d * 4), false);
      if (!r || r.fout > 1.5) return null;
      cijfers.push(r.cijfer);
    }
  }
  const code = cijfers.join('');
  return controleOk(code) ? code : null;
}

/** Probeer vanaf positie i (run i is een streep) een EAN-13 of EAN-8 te lezen, in beide richtingen. */
function lezenVanaf(runs, i) {
  if (i + 59 <= runs.length) {
    const seg = runs.slice(i, i + 59);
    const na = runs[i + 59];
    const module = seg.reduce((a, b) => a + b, 0) / 95;
    if (na === undefined || na > 3 * module) {
      const code = ean13(seg) || ean13(seg.slice().reverse()); // omgekeerd = foto ondersteboven
      if (code) return code;
    }
  }
  if (i + 43 <= runs.length) {
    const seg = runs.slice(i, i + 43);
    const na = runs[i + 43];
    const module = seg.reduce((a, b) => a + b, 0) / 67;
    // een stille zone erna voorkomt dat een stuk van een EAN-13 als EAN-8 gelezen wordt
    if (na === undefined || na > 3 * module) return ean8(seg) || ean8(seg.slice().reverse());
  }
  return null;
}

/** Eén lijn (grijswaarden) ontcijferen met een gegeven drempel-functie. */
function lijnLezen(waarden, drempel, gevonden) {
  const n = waarden.length;
  // runs maken met randen op subpixelniveau; de eerste run is altijd licht (eventueel lengte 0)
  const runs = [];
  let donker = false, vorigeRand = 0;
  for (let x = 0; x < n; x++) {
    const t = drempel(x);
    const d = waarden[x] < t;
    if (d !== donker) {
      let rand = x;
      if (x > 0) {
        const a = waarden[x - 1] - t, b = waarden[x] - t;
        if (a !== b) rand = x - 1 + a / (a - b);
      }
      runs.push(Math.max(0.01, rand - vorigeRand));
      vorigeRand = rand;
      donker = d;
    }
  }
  runs.push(n - vorigeRand);
  // runs[1], runs[3], ... zijn donker
  for (let i = 1; i < runs.length - 42; i += 2) {
    const module = (runs[i] + runs[i + 1] + runs[i + 2]) / 3;
    if (runs[i - 1] < 3 * module) continue; // stille zone vóór de barcode nodig
    const code = lezenVanaf(runs, i);
    if (code) gevonden.set(code, (gevonden.get(code) || 0) + 1);
  }
}

function lijnAnalyseren(w, gevonden) {
  const n = w.length;
  // 1) vaste drempel: midden tussen donkerste en lichtste waarden (goed bij onscherpe foto's)
  const gesorteerd = Float32Array.from(w).sort();
  const laag = gesorteerd[Math.floor(n * 0.05)], hoog = gesorteerd[Math.floor(n * 0.95)];
  if (hoog - laag < 25) return; // te weinig contrast: geen barcode op deze lijn
  const midden = (laag + hoog) / 2;
  lijnLezen(w, () => midden, gevonden);
  // 2) plaatselijke drempel: gemiddelde van de omgeving (goed bij kleine barcodes, schaduw en verloop)
  const som = new Float64Array(n + 1);
  for (let x = 0; x < n; x++) som[x + 1] = som[x] + w[x];
  for (const venster of [Math.max(6, Math.round(n / 30)), Math.max(10, Math.round(n / 15))]) {
    lijnLezen(w, (x) => {
      const a = Math.max(0, x - venster), b = Math.min(n, x + venster + 1);
      return (som[b] - som[a]) / (b - a);
    }, gevonden);
  }
}

/**
 * Lees een barcode uit grijswaarden (Uint8Array/Uint8ClampedArray, breedte x hoogte).
 * Geeft de code terug als tekst, of null.
 */
export function barcodeLezen(grijs, breedte, hoogte) {
  const gevonden = new Map();
  const lijnenPerRichting = 48;
  const lijn = new Float32Array(Math.max(breedte, hoogte));
  // Elke lijn is het gemiddelde van 5 naast elkaar liggende pixelrijen: dat vermindert ruis
  // zonder de strepen zelf te vervagen.
  const R = 2;
  // horizontale lijnen
  for (let k = 1; k < lijnenPerRichting; k++) {
    const y = Math.round((k / lijnenPerRichting) * (hoogte - 1));
    const l = lijn.subarray(0, breedte);
    l.fill(0);
    let rijen = 0;
    for (let yy = Math.max(0, y - R); yy <= Math.min(hoogte - 1, y + R); yy++, rijen++) {
      for (let x = 0; x < breedte; x++) l[x] += grijs[yy * breedte + x];
    }
    for (let x = 0; x < breedte; x++) l[x] /= rijen;
    lijnAnalyseren(l, gevonden);
    if (beste(gevonden, 3)) return beste(gevonden, 3);
  }
  // verticale lijnen (foto gedraaid)
  for (let k = 1; k < lijnenPerRichting; k++) {
    const x = Math.round((k / lijnenPerRichting) * (breedte - 1));
    const l = lijn.subarray(0, hoogte);
    l.fill(0);
    const x0 = Math.max(0, x - R), x1 = Math.min(breedte - 1, x + R);
    for (let y = 0; y < hoogte; y++) {
      let t = 0;
      for (let xx = x0; xx <= x1; xx++) t += grijs[y * breedte + xx];
      l[y] = t / (x1 - x0 + 1);
    }
    lijnAnalyseren(l, gevonden);
    if (beste(gevonden, 3)) return beste(gevonden, 3);
  }
  // Eén enkele treffer aanvaarden we alleen voor EAN-13 (bij EAN-8 is de kans op een toevalstreffer te groot)
  const code = beste(gevonden, 1);
  if (code && (code.length === 13 || gevonden.get(code) >= 2)) return code;
  return null;
}

function beste(gevonden, minimum) {
  let code = null, aantal = 0;
  for (const [c, n] of gevonden) if (n > aantal) { code = c; aantal = n; }
  return aantal >= minimum ? code : null;
}

/** Barcode lezen uit een fotobestand (in de browser). */
export async function barcodeUitBestand(bestand) {
  let beeld;
  try {
    beeld = await createImageBitmap(bestand, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(bestand);
    try { beeld = new Image(); beeld.src = url; await beeld.decode(); } finally { URL.revokeObjectURL(url); }
  }
  const pogingen = [1400, 2400, 900];
  try {
    for (const maxZijde of pogingen) {
      const schaal = Math.min(1, maxZijde / Math.max(beeld.width, beeld.height));
      const b = Math.max(1, Math.round(beeld.width * schaal)), h = Math.max(1, Math.round(beeld.height * schaal));
      const canvas = document.createElement('canvas');
      canvas.width = b; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(beeld, 0, 0, b, h);
      const rgba = ctx.getImageData(0, 0, b, h).data;
      const grijs = new Uint8Array(b * h);
      for (let i = 0, j = 0; j < grijs.length; i += 4, j++) grijs[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
      const code = barcodeLezen(grijs, b, h);
      if (code) return code;
      if (Math.max(beeld.width, beeld.height) <= maxZijde) break; // groter proberen heeft geen zin
    }
  } finally {
    if (beeld.close) beeld.close();
  }
  return null;
}

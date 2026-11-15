// Leesvolgorde herstellen voor pdf's en foto's met kolommen.
// Invoer: woorden of tekststukjes met een kader {x0, y0, x1, y1, str} (y loopt naar beneden).
// Werkwijze:
//  1. stukjes op dezelfde hoogte worden een regel; een grote witruimte binnen een regel splitst die in segmenten;
//  2. de pagina wordt recursief opgedeeld: eerst in kolommen (een verticale witte strook zonder tekst),
//     anders in horizontale banden, maar alleen waar dat een kolomindeling mogelijk maakt
//     (bv. een titel over de hele breedte boven twee kolommen);
//  3. elk blok wordt van boven naar onder gelezen, kolommen van links naar rechts.

const mediaan = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

function regelsMaken(stukjes, fs) {
  const gesorteerd = stukjes.filter((s) => s.str && s.str.trim()).sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2 || a.x0 - b.x0);
  const regels = [];
  for (const s of gesorteerd) {
    const mid = (s.y0 + s.y1) / 2;
    const h = Math.max(1, s.y1 - s.y0);
    // zoek een regel waarvan het midden dichtbij ligt (laatste regels eerst)
    let doel = null;
    for (let i = regels.length - 1; i >= 0 && i >= regels.length - 4; i--) {
      const r = regels[i];
      if (Math.abs(r.mid - mid) < Math.max(Math.min(h, r.h), fs) * 0.45) { doel = r; break; }
    }
    if (doel) { doel.stukjes.push(s); doel.mid = (doel.mid * (doel.stukjes.length - 1) + mid) / doel.stukjes.length; doel.h = Math.max(doel.h, h); }
    else regels.push({ mid, h, stukjes: [s] });
  }
  // segmenten: binnen een regel splitsen bij grote witruimte
  const segmenten = [];
  for (const r of regels) {
    r.stukjes.sort((a, b) => a.x0 - b.x0);
    let huidig = null;
    for (const s of r.stukjes) {
      const grens = Math.max(fs, r.h) * 1.4;
      if (huidig && s.x0 - huidig.x1 <= grens) {
        const tussen = s.x0 - huidig.x1 > Math.max(fs, r.h) * 0.12 && !huidig.str.endsWith(' ') && !s.str.startsWith(' ') ? ' ' : '';
        huidig.str += tussen + s.str;
        huidig.x1 = Math.max(huidig.x1, s.x1); huidig.y0 = Math.min(huidig.y0, s.y0); huidig.y1 = Math.max(huidig.y1, s.y1);
      } else {
        huidig = { str: s.str, x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1, mid: r.mid };
        segmenten.push(huidig);
      }
    }
  }
  for (const s of segmenten) s.str = s.str.replace(/\s+/g, ' ').trim();
  return segmenten.filter((s) => s.str);
}

// verticale witte stroken in een verzameling segmenten
function kolomGrens(seg, fs) {
  if (seg.length < 4) return null;
  const xs = [...seg].sort((a, b) => a.x0 - b.x0);
  let rechts = xs[0].x1, beste = null;
  for (let i = 1; i < xs.length; i++) {
    const gat = xs[i].x0 - rechts;
    if (gat >= fs * 1.2) {
      const grens = (rechts + xs[i].x0) / 2;
      const links = seg.filter((s) => s.x1 <= grens), rechtsDeel = seg.filter((s) => s.x0 >= grens);
      // beide kanten moeten echte tekstkolommen zijn, geen kolommetje met enkel hoeveelheden
      const tekens = (d) => mediaan(d.map((s) => s.str.length));
      const regelsVan = (d) => new Set(d.map((s) => Math.round(s.mid / fs))).size;
      if (regelsVan(links) >= 2 && regelsVan(rechtsDeel) >= 2 && tekens(links) >= 8 && tekens(rechtsDeel) >= 8) {
        if (!beste || gat > beste.gat) beste = { grens, gat };
      }
    }
    rechts = Math.max(rechts, xs[i].x1);
  }
  return beste ? beste.grens : null;
}

function horizontaleGaten(seg) {
  const ys = [...seg].sort((a, b) => a.y0 - b.y0);
  const gaten = [];
  let onder = ys[0].y1;
  for (let i = 1; i < ys.length; i++) {
    if (ys[i].y0 > onder) gaten.push({ y: (onder + ys[i].y0) / 2, grootte: ys[i].y0 - onder });
    onder = Math.max(onder, ys[i].y1);
  }
  return gaten.sort((a, b) => b.grootte - a.grootte);
}

function lezen(seg, fs, diepte = 0) {
  if (!seg.length) return [];
  if (diepte < 12) {
    const x = kolomGrens(seg, fs);
    if (x !== null) {
      return [...lezen(seg.filter((s) => (s.x0 + s.x1) / 2 < x), fs, diepte + 1), '',
        ...lezen(seg.filter((s) => (s.x0 + s.x1) / 2 >= x), fs, diepte + 1)];
    }
    for (const gat of horizontaleGaten(seg).slice(0, 40)) {
      const boven = seg.filter((s) => s.y1 <= gat.y), onder = seg.filter((s) => s.y0 >= gat.y);
      if (kolomGrens(boven, fs) !== null || kolomGrens(onder, fs) !== null) {
        return [...lezen(boven, fs, diepte + 1), ...lezen(onder, fs, diepte + 1)];
      }
    }
  }
  // geen kolommen: regels van boven naar onder; witregel bij een duidelijke tussenruimte
  const regels = [];
  const opRegel = new Map();
  for (const s of seg) {
    const sleutel = [...opRegel.keys()].find((k) => Math.abs(k - s.mid) < fs * 0.5);
    if (sleutel === undefined) opRegel.set(s.mid, [s]); else opRegel.get(sleutel).push(s);
  }
  let vorigeOnder = null;
  for (const k of [...opRegel.keys()].sort((a, b) => a - b)) {
    const delen = opRegel.get(k).sort((a, b) => a.x0 - b.x0);
    const boven = Math.min(...delen.map((d) => d.y0));
    if (vorigeOnder !== null && boven - vorigeOnder > fs * 0.9) regels.push('');
    regels.push(delen.map((d) => d.str).join('  '));
    vorigeOnder = Math.max(...delen.map((d) => d.y1));
  }
  return regels;
}

export function tekstOpmaken(stukjes) {
  const hoogtes = stukjes.filter((s) => s.str && s.str.trim()).map((s) => s.y1 - s.y0).filter((h) => h > 0);
  const fs = Math.max(1, mediaan(hoogtes));
  const regels = lezen(regelsMaken(stukjes, fs), fs);
  return regels.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Pagina's onder elkaar plakken tot één lange pagina, zodat kolommen die op de volgende pagina
 * doorlopen (ingrediënten links, bereiding rechts) ook als één kolom gelezen worden.
 * De witruimte tussen twee pagina's wordt teruggebracht tot een gewone regelafstand.
 */
export function paginasStapelen(paginas) {
  const uit = [];
  let onder = null;
  for (const stukjes of paginas) {
    const tekst = stukjes.filter((s) => s.str && s.str.trim());
    if (!tekst.length) continue;
    const boven = Math.min(...tekst.map((s) => s.y0));
    const regel = Math.max(1, mediaan(tekst.map((s) => s.y1 - s.y0)));
    const verschuiving = onder === null ? 0 : onder + regel * 0.6 - boven;
    for (const s of tekst) uit.push({ ...s, y0: s.y0 + verschuiving, y1: s.y1 + verschuiving });
    onder = Math.max(...tekst.map((s) => s.y1 + verschuiving));
  }
  return uit;
}

/** pdf.js textContent-items (één pagina) omzetten. */
export function pdfStukjes(items, paginaHoogte) {
  const uit = [];
  for (const it of items) {
    if (typeof it.str !== 'string' || !it.str.trim() || !it.transform) continue;
    const [a, b, , d, e, f] = it.transform;
    const grootte = Math.hypot(a, b) || Math.abs(d) || it.height || 10;
    const y = paginaHoogte - f; // basislijn, van boven gemeten
    uit.push({ str: it.str, x0: e, x1: e + (it.width || it.str.length * grootte * 0.5), y0: y - grootte * 0.8, y1: y + grootte * 0.2 });
  }
  return uit;
}

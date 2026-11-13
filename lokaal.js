// Voorraad — opslag en logica in de browser zelf (installeerbare webapp).
// Alle gegevens staan in IndexedDB op dit toestel. Er is geen server.
// De interface (app.js) praat met "api/..."; die verzoeken worden hier afgehandeld.
// Naar buiten gaat alleen: een barcode naar Open Food Facts, en het eenmalig ophalen van
// de tekstherkenning (Tesseract.js, open source, geen AI-dienst). Bestanden blijven op het toestel.
(function () {
  const DB_NAAM = 'voorraadbeheer', DB_TABEL = 'staat', SLEUTEL = 'gegevens';
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  const datum = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const vandaag = () => datum(new Date());
  const nu = () => new Date().toISOString().slice(0, 19);
  const zelfde = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  const GEWICHT = { g: 1, kg: 1000 }, VOLUME = { ml: 1, cl: 10, dl: 100, l: 1000, el: 15, tl: 5 };
  const omrekenen = (h, van, naar) => {
    if (h == null) return null;
    van = (van || '').toLowerCase(); naar = (naar || '').toLowerCase();
    if (van === naar) return h;
    for (const g of [GEWICHT, VOLUME]) if (van in g && naar in g) return (h * g[van]) / g[naar];
    return null;
  };
  const getal = (v) => (v === null || v === undefined || v === '' ? null : parseFloat(String(v).replace(',', '.')));

  const STANDAARD = () => ({
    volgendId: 1,
    producten: [], boodschappen: [], recepten: [], gebeurtenissen: [], barcodes: {},
    instellingen: {
      tgt_dagen: 2, tht_dagen: 3, locaties: ['Koelkast', 'Diepvries', 'Voorraadkast'],
      categorieen: ['Groenten', 'Fruit', 'Zuivel & eieren', 'Vlees & vis', 'Brood & granen', 'Pasta, rijst & peulvruchten',
        'Conserven', 'Kruiden & sauzen', 'Snacks & zoet', 'Dranken', 'Diepvriesproducten', 'Overig'],
    },
  });
  let S = STANDAARD();
  const id = () => S.volgendId++;

  // ------------------------------------------------------------------ opslag
  let dbBelofte = null;
  const db = () => dbBelofte || (dbBelofte = new Promise((ok, nee) => {
    const r = indexedDB.open(DB_NAAM, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DB_TABEL);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => nee(r.error);
  }));
  async function laden() {
    try {
      const d = await db();
      const waarde = await new Promise((ok, nee) => {
        const r = d.transaction(DB_TABEL).objectStore(DB_TABEL).get(SLEUTEL);
        r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error);
      });
      if (waarde) S = normaliseren(waarde);
    } catch (f) { console.error('Laden mislukt', f); opslagWerkt = false; }
  }
  let opslagWerkt = true, schrijfKetting = Promise.resolve();
  function bewaren() {
    const kopie = JSON.parse(JSON.stringify(S));
    schrijfKetting = schrijfKetting.then(async () => {
      const d = await db();
      await new Promise((ok, nee) => {
        const t = d.transaction(DB_TABEL, 'readwrite');
        t.objectStore(DB_TABEL).put(kopie, SLEUTEL);
        t.oncomplete = ok; t.onerror = () => nee(t.error);
      });
    }).catch((f) => { console.error('Bewaren mislukt', f); opslagWerkt = false; });
    return schrijfKetting;
  }
  // Andere tabbladen/vensters van de app op hetzelfde toestel laten weten dat er iets veranderde.
  const kanaal = 'BroadcastChannel' in self ? new BroadcastChannel('voorraadbeheer') : null;

  function normaliseren(d) {
    const s = STANDAARD();
    const uit = {
      ...s, ...d,
      instellingen: { ...s.instellingen, ...(d.instellingen || {}) },
      producten: Array.isArray(d.producten) ? d.producten : [],
      boodschappen: Array.isArray(d.boodschappen) ? d.boodschappen : [],
      recepten: Array.isArray(d.recepten) ? d.recepten : [],
      gebeurtenissen: Array.isArray(d.gebeurtenissen) ? d.gebeurtenissen : [],
      barcodes: d.barcodes && typeof d.barcodes === 'object' && !Array.isArray(d.barcodes) ? { ...d.barcodes } : {},
    };
    // barcodes uit een oudere back-up (lijst) omzetten
    if (Array.isArray(d.barcodes)) for (const b of d.barcodes) if (b && b.code) uit.barcodes[String(b.code)] = { ...b, bron: 'eigen' };
    for (const r of uit.recepten) if (!Array.isArray(r.ingredienten)) r.ingredienten = [];
    let max = 0;
    const zie = (x) => { if (x && +x.id > max) max = +x.id; };
    uit.producten.forEach(zie); uit.boodschappen.forEach(zie);
    uit.recepten.forEach((r) => { zie(r); r.ingredienten.forEach(zie); });
    uit.volgendId = Math.max(+d.volgendId || 1, max + 1);
    return uit;
  }

  // ------------------------------------------------------------------ logica
  function minimumControleren(naam) {
    const regels = S.producten.filter((p) => zelfde(p.naam, naam));
    const auto = S.boodschappen.find((b) => zelfde(b.naam, naam) && !b.afgevinkt && b.bron === 'minimum');
    if (!regels.length) { if (auto) S.boodschappen = S.boodschappen.filter((b) => b !== auto); return; }
    const hoofd = regels.reduce((a, b) => ((b.minimum || 0) > (a.minimum || 0) ? b : a));
    if (!(hoofd.minimum > 0)) { if (auto) S.boodschappen = S.boodschappen.filter((b) => b !== auto); return; }
    const totaal = regels.reduce((s, r) => s + (omrekenen(r.hoeveelheid || 0, r.eenheid, hoofd.eenheid) ?? 0), 0);
    if (totaal < hoofd.minimum) {
      const tekort = Math.round((hoofd.minimum - totaal) * 100) / 100;
      if (auto) auto.hoeveelheid = tekort;
      else if (!S.boodschappen.some((b) => zelfde(b.naam, naam) && !b.afgevinkt)) {
        S.boodschappen.push({ id: id(), naam: hoofd.naam, hoeveelheid: tekort, eenheid: hoofd.eenheid, product_id: hoofd.id, afgevinkt: 0, bron: 'minimum' });
      }
    } else if (auto) S.boodschappen = S.boodschappen.filter((b) => b !== auto);
  }
  const gebeurtenis = (soort, naam) => S.gebeurtenissen.push({ soort, naam, tijdstip: nu() });

  const alles = () => JSON.parse(JSON.stringify({
    producten: [...S.producten].sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl')),
    boodschappen: [...S.boodschappen].sort((a, b) => a.afgevinkt - b.afgevinkt || (a.naam || '').localeCompare(b.naam || '', 'nl')),
    recepten: [...S.recepten].sort((a, b) => (a.titel || '').localeCompare(b.titel || '', 'nl')),
    instellingen: S.instellingen,
  }));
  const fout = (status, bericht) => { const e = new Error(bericht); e.status = status; throw e; };
  const VELDEN = ['naam', 'categorie', 'hoeveelheid', 'eenheid', 'locatie', 'aankoopdatum', 'vervaldatum', 'datumtype', 'minimum', 'notitie', 'barcode'];

  // ------------------------------------------------------------------ barcode (Open Food Facts)
  const CAT_WOORDEN = [
    ['Zuivel & eieren', ['dairies', 'milk', 'cheese', 'yogurt', 'eggs', 'butter', 'cream', 'zuivel']],
    ['Vlees & vis', ['meats', 'fish', 'seafood', 'poultry', 'sausages', 'vlees']],
    ['Fruit', ['fruits', 'fruit']], ['Groenten', ['vegetables', 'groenten']],
    ['Brood & granen', ['breads', 'cereals', 'flours', 'breakfast', 'brood']],
    ['Pasta, rijst & peulvruchten', ['pastas', 'rices', 'legumes', 'noodles']],
    ['Conserven', ['canned']], ['Kruiden & sauzen', ['sauces', 'condiments', 'spices', 'herbs', 'oils', 'vinegars', 'salts']],
    ['Snacks & zoet', ['snacks', 'sweet', 'chocolate', 'biscuits', 'confectioneries', 'spreads', 'desserts']],
    ['Dranken', ['beverages', 'drinks', 'waters', 'juices', 'coffees', 'teas']], ['Diepvriesproducten', ['frozen']],
  ];
  function categorieRaden(tags) {
    const t = (tags || []).join(' ').toLowerCase();
    if (/frozen/.test(t)) return 'Diepvriesproducten';
    for (const [cat, woorden] of CAT_WOORDEN) if (woorden.some((w) => t.includes(w))) return S.instellingen.categorieen.includes(cat) ? cat : '';
    return '';
  }
  function hoeveelheidLezen(q) {
    const m = String(q || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|l|cl|ml|dl)\b/i);
    if (!m) return { hoeveelheid: 1, eenheid: 'stuks' };
    let e = m[2].toLowerCase(); if (e === 'gr') e = 'g';
    return { hoeveelheid: parseFloat(m[1]), eenheid: e };
  }
  async function barcodeOpzoeken(code) {
    if (S.barcodes[code]) return { code, gevonden: true, ...S.barcodes[code], bron: 'eigen' };
    const eigen = S.producten.find((p) => p.barcode === code);
    if (eigen) return { code, gevonden: true, naam: eigen.naam, merk: '', categorie: eigen.categorie, hoeveelheid: eigen.hoeveelheid,
      eenheid: eigen.eenheid, datumtype: eigen.datumtype, locatie: eigen.locatie, bron: 'eigen' };
    if (!navigator.onLine) fout(503, 'Geen internet: deze barcode kan nu niet opgezocht worden. Vul het product zelf in.');
    let j;
    try {
      const velden = 'product_name,product_name_nl,generic_name_nl,brands,quantity,categories_tags';
      const a = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${velden}`, { headers: { Accept: 'application/json' } });
      if (a.status === 404) return { code, gevonden: false, bron: 'off' };
      if (!a.ok) throw new Error(a.status);
      j = await a.json();
    } catch { fout(503, 'Open Food Facts is niet bereikbaar. Vul het product zelf in.'); }
    const p = j && j.status === 1 ? j.product : null;
    const naam = p && (p.product_name_nl || p.product_name || p.generic_name_nl || '').trim();
    if (!naam) return { code, gevonden: false, bron: 'off' };
    return { code, gevonden: true, naam, merk: (p.brands || '').split(',')[0].trim(), categorie: categorieRaden(p.categories_tags),
      ...hoeveelheidLezen(p.quantity), datumtype: 'THT', locatie: '', bron: 'off' };
  }

  // ------------------------------------------------------------------ tekstherkenning (Tesseract.js, in de browser)
  let ocrWerker = null;
  function scriptLaden(src) {
    return new Promise((ok, nee) => {
      if (window.Tesseract) return ok();
      const s = document.createElement('script');
      s.src = src; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = ok; s.onerror = () => nee(new Error('laden'));
      document.head.appendChild(s);
    });
  }
  async function werker() {
    if (ocrWerker) return ocrWerker;
    ocrWerker = (async () => {
      try { await scriptLaden(TESSERACT_URL); } catch {
        throw Object.assign(new Error('Tekstherkenning kon niet geladen worden. De eerste keer heb je internet nodig; daarna werkt het ook offline.'), { status: 503 });
      }
      return window.Tesseract.createWorker(['nld', 'eng'], 1, { logger: () => {} });
    })();
    ocrWerker.catch(() => { ocrWerker = null; });
    return ocrWerker;
  }
  async function tekstUitAfbeelding(blob) {
    const w = await werker();
    const { data } = await w.recognize(blob);
    // losse woorden met hun plaats, zodat de app kolommen in de juiste volgorde kan zetten
    const woorden = ((data && data.words) || [])
      .filter((x) => x.text && x.text.trim() && !(x.confidence < 25 && !/[a-z0-9]/i.test(x.text)))
      .map((x) => ({ str: x.text, x0: x.bbox.x0, y0: x.bbox.y0, x1: x.bbox.x1, y1: x.bbox.y1 }));
    return { tekst: (data && data.text) || '', woorden };
  }

  // ------------------------------------------------------------------ export
  function csvMaken() {
    const kol = ['naam', 'hoeveelheid', 'eenheid', 'locatie', 'categorie', 'vervaldatum', 'datumtype', 'minimum', 'aankoopdatum', 'notitie', 'barcode'];
    const cel = (v) => { const t = v == null ? '' : String(v); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const regels = [kol.join(';'), ...alles().producten.map((p) => kol.map((k) => cel(k === 'hoeveelheid' || k === 'minimum' ? String(p[k] ?? '').replace('.', ',') : p[k])).join(';'))];
    return '﻿' + regels.join('\r\n');
  }
  function downloaden(naam, inhoud, type) {
    const url = URL.createObjectURL(new Blob([inhoud], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = naam; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="api/export"]');
    if (!a) return;
    e.preventDefault();
    const d = vandaag();
    if (a.getAttribute('href').endsWith('.csv')) downloaden(`voorraad-${d}.csv`, csvMaken(), 'text/csv;charset=utf-8');
    else downloaden(`voorraad-backup-${d}.json`, JSON.stringify({ app: 'Voorraadbeheer', versie: 2, gemaakt: nu(), ...S }, null, 1), 'application/json');
  });

  // ------------------------------------------------------------------ api
  async function api(methode, pad, data, ruw) {
    const delen = pad.split('/');
    const [bron] = delen;
    const ident = delen[1] && /^\d+$/.test(delen[1]) ? +delen[1] : null;
    const actie = delen[2] || (delen[1] && ident === null ? delen[1] : null);

    if (bron === 'status') return { ocr: true, talen: 'nld+eng', internet: navigator.onLine, telefoonadres: null, opslag: opslagWerkt, pwa: true };
    if (bron === 'alles') return alles();
    if (bron === 'ocr') return tekstUitAfbeelding(ruw);
    if (bron === 'barcode') return barcodeOpzoeken(delen[1].replace(/\D/g, ''));
    if (bron === 'statistieken') {
      const top = (soort) => Object.entries(S.gebeurtenissen.filter((g) => g.soort === soort).reduce((m, g) => ((m[g.naam] = (m[g.naam] || 0) + 1), m), {}))
        .map(([naam, aantal]) => ({ naam, aantal })).sort((a, b) => b.aantal - a.aantal).slice(0, 10);
      return { weggegooid: top('weggegooid'), gekocht: top('gekocht'), gekookt: top('gekookt'), sinds: S.gebeurtenissen[0]?.tijdstip?.slice(0, 10) || null };
    }
    if (bron === 'instellingen') { Object.assign(S.instellingen, data); return alles(); }
    if (bron === 'import') {
      if (!data || !Array.isArray(data.producten)) fout(400, 'Dit is geen geldig back-upbestand.');
      S = normaliseren(data);
      return alles();
    }
    if (bron === 'hernoemen') {
      const veld = data.veld === 'categorie' ? 'categorie' : 'locatie';
      for (const p of S.producten) if (zelfde(p[veld], data.van)) p[veld] = data.naar || '';
      return alles();
    }

    if (bron === 'producten') {
      if (methode === 'POST' && ident === null) {
        if (!(data.naam || '').trim()) fout(400, 'Geef het product een naam.');
        const p = { id: id(), aangemaakt: nu(), gewijzigd: nu(), notitie: '', barcode: '' };
        for (const k of VELDEN) if (k in data) p[k] = data[k];
        p.naam = p.naam.trim();
        p.hoeveelheid = getal(p.hoeveelheid) || 0; p.minimum = getal(p.minimum) || 0;
        S.producten.push(p);
        if (p.barcode) S.barcodes[p.barcode] = { naam: p.naam, merk: '', categorie: p.categorie, hoeveelheid: p.hoeveelheid, eenheid: p.eenheid, datumtype: p.datumtype, locatie: p.locatie };
        minimumControleren(p.naam);
        return alles();
      }
      const p = S.producten.find((x) => x.id === ident);
      if (!p) fout(404, 'Dit product bestaat niet (meer).');
      if (methode === 'PUT') {
        const oudeNaam = p.naam;
        for (const k of VELDEN) if (k in data) p[k] = data[k];
        if ('hoeveelheid' in data) p.hoeveelheid = getal(data.hoeveelheid) || 0;
        if ('minimum' in data) p.minimum = getal(data.minimum) || 0;
        p.gewijzigd = nu();
        if (p.barcode) S.barcodes[p.barcode] = { naam: p.naam, merk: '', categorie: p.categorie, hoeveelheid: p.hoeveelheid || 1, eenheid: p.eenheid, datumtype: p.datumtype, locatie: p.locatie };
        minimumControleren(oudeNaam); minimumControleren(p.naam);
        return alles();
      }
      if (methode === 'POST' && actie === 'verbruik') {
        const soort = data.soort === 'weggegooid' ? 'weggegooid' : 'verbruikt';
        const h = getal(data.hoeveelheid) ?? p.hoeveelheid;
        p.hoeveelheid = Math.max(0, Math.round((p.hoeveelheid - h) * 1000) / 1000);
        gebeurtenis(soort, p.naam);
        if (p.hoeveelheid === 0 && !p.minimum && data.verwijderen_als_op) S.producten = S.producten.filter((x) => x !== p);
        minimumControleren(p.naam);
        return alles();
      }
      if (methode === 'DELETE') { S.producten = S.producten.filter((x) => x !== p); minimumControleren(p.naam); return alles(); }
    }

    if (bron === 'boodschappen') {
      if (methode === 'POST' && actie === 'afrekenen') {
        for (const item of data.items || []) {
          const b = S.boodschappen.find((x) => x.id === item.id);
          if (!b) continue;
          const h = getal(item.hoeveelheid) || 0;
          const bestaand = S.producten.find((p) => zelfde(p.naam, b.naam) && omrekenen(1, item.eenheid, p.eenheid) !== null
            && (!item.vervaldatum || p.vervaldatum === item.vervaldatum || !p.hoeveelheid));
          if (bestaand) {
            bestaand.hoeveelheid = Math.round((bestaand.hoeveelheid + omrekenen(h, item.eenheid, bestaand.eenheid)) * 1000) / 1000;
            if (item.vervaldatum) { bestaand.vervaldatum = item.vervaldatum; bestaand.datumtype = item.datumtype; }
            if (item.locatie) bestaand.locatie = item.locatie;
            bestaand.aankoopdatum = vandaag(); bestaand.gewijzigd = nu();
          } else {
            const voorbeeld = S.producten.find((p) => zelfde(p.naam, b.naam));
            S.producten.push({ id: id(), naam: b.naam, categorie: voorbeeld?.categorie || '', hoeveelheid: h, eenheid: item.eenheid,
              locatie: item.locatie || voorbeeld?.locatie || '', aankoopdatum: vandaag(), vervaldatum: item.vervaldatum || '',
              datumtype: item.datumtype || 'THT', minimum: 0, notitie: '', barcode: voorbeeld?.barcode || '', aangemaakt: nu(), gewijzigd: nu() });
          }
          gebeurtenis('gekocht', b.naam);
          S.boodschappen = S.boodschappen.filter((x) => x !== b);
          minimumControleren(b.naam);
        }
        return alles();
      }
      if (methode === 'POST' && actie === 'afgevinkte-wissen') { S.boodschappen = S.boodschappen.filter((b) => !b.afgevinkt); return alles(); }
      if (methode === 'POST') {
        for (const item of data.items || [data]) {
          const naam = (item.naam || '').trim();
          if (!naam) continue;
          const bestaand = S.boodschappen.find((b) => zelfde(b.naam, naam) && !b.afgevinkt);
          const h = getal(item.hoeveelheid);
          if (bestaand) {
            const erbij = omrekenen(h, item.eenheid, bestaand.eenheid);
            if (h !== null && bestaand.hoeveelheid !== null && erbij !== null) bestaand.hoeveelheid = Math.round((bestaand.hoeveelheid + erbij) * 100) / 100;
            continue;
          }
          S.boodschappen.push({ id: id(), naam, hoeveelheid: h, eenheid: item.eenheid || '', product_id: item.product_id || null, afgevinkt: 0, bron: item.bron || 'handmatig' });
        }
        return alles();
      }
      const b = S.boodschappen.find((x) => x.id === ident);
      if (b && methode === 'PUT') {
        if ('afgevinkt' in data) b.afgevinkt = data.afgevinkt ? 1 : 0;
        if ('hoeveelheid' in data) b.hoeveelheid = getal(data.hoeveelheid);
        return alles();
      }
      if (b && methode === 'DELETE') { S.boodschappen = S.boodschappen.filter((x) => x !== b); return alles(); }
      if (!b) fout(404, 'Dit staat niet (meer) op je lijst.');
    }

    if (bron === 'recepten') {
      const opslaan = (r) => {
        if (!(data.titel || '').trim()) fout(400, 'Geef het recept een titel.');
        Object.assign(r, { titel: data.titel.trim(), personen: parseInt(data.personen, 10) || 4, bereidingstijd: data.bereidingstijd || '',
          stappen: data.stappen || '', notities: data.notities || '', gewijzigd: nu() });
        r.ingredienten = (data.ingredienten || []).filter((i) => i.naam).map((i, n) => ({ id: id(), recept_id: r.id, volgorde: n,
          hoeveelheid: getal(i.hoeveelheid), eenheid: i.eenheid || '', naam: i.naam, voorraadnaam: i.voorraadnaam || '' }));
      };
      if (methode === 'POST' && ident === null) {
        const r = { id: id(), aangemaakt: nu() };
        opslaan(r); S.recepten.push(r);
        return { ...alles(), nieuw_id: r.id };
      }
      const r = S.recepten.find((x) => x.id === ident);
      if (!r) fout(404, 'Dit recept bestaat niet (meer).');
      if (methode === 'PUT') { opslaan(r); return alles(); }
      if (methode === 'DELETE') { S.recepten = S.recepten.filter((x) => x !== r); return alles(); }
      if (methode === 'POST' && actie === 'koken') {
        const namen = new Set();
        for (const regel of data.aftrekken || []) {
          const p = S.producten.find((x) => x.id === regel.product_id);
          const h = getal(regel.hoeveelheid);
          if (!p || !h) continue;
          p.hoeveelheid = Math.max(0, Math.round((p.hoeveelheid - h) * 1000) / 1000);
          gebeurtenis('verbruikt', p.naam);
          namen.add(p.naam);
        }
        gebeurtenis('gekookt', r.titel);
        namen.forEach(minimumControleren);
        return alles();
      }
    }
    fout(404, 'Onbekende opdracht.');
  }

  // ------------------------------------------------------------------ fetch onderscheppen
  const klaar = laden().then(() => {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  });
  const LEZEN = new Set(['status', 'alles', 'statistieken', 'barcode', 'ocr']);
  const echteFetch = window.fetch.bind(window);
  let wachtrij = Promise.resolve();
  window.fetch = (url, opties = {}) => {
    const u = typeof url === 'string' ? url : url.url;
    if (!u.startsWith('api/')) return echteFetch(url, opties);
    const methode = (opties.method || 'GET').toUpperCase();
    const pad = u.slice(4).split('?')[0].replace(/\/$/, '');
    const bron = pad.split('/')[0];
    let data = {};
    if (opties.body && typeof opties.body === 'string') { try { data = JSON.parse(opties.body); } catch { data = {}; } }
    const uitvoeren = async () => {
      await klaar;
      try {
        const antwoord = await api(methode, pad, data, opties.body);
        const wijzigt = methode !== 'GET' && !LEZEN.has(bron);
        if (wijzigt) { await bewaren(); if (kanaal) kanaal.postMessage('gewijzigd'); }
        return new Response(JSON.stringify(antwoord), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        if (!e.status) console.error(e);
        return new Response(JSON.stringify({ fout: e.status ? e.message : 'Er ging iets mis: ' + e.message }), { status: e.status || 500, headers: { 'Content-Type': 'application/json' } });
      }
    };
    // trage opdrachten (tekstherkenning, barcode opzoeken) houden de rest niet op
    if (bron === 'ocr' || bron === 'barcode') return uitvoeren();
    const r = wachtrij.then(uitvoeren);
    wachtrij = r.catch(() => {});
    return r;
  };

  // gewijzigd in een ander venster van de app: opnieuw inlezen
  if (kanaal) kanaal.onmessage = async () => { await laden(); document.dispatchEvent(new Event('visibilitychange')); };

  // ------------------------------------------------------------------ installeren / offline
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nieuw = reg.installing;
          nieuw && nieuw.addEventListener('statechange', () => {
            if (nieuw.state === 'installed' && navigator.serviceWorker.controller) {
              const t = document.getElementById('toast');
              t.innerHTML = '<span>Er is een nieuwe versie.</span><button>Vernieuwen</button>';
              t.hidden = false;
              t.querySelector('button').onclick = () => location.reload();
            }
          });
        });
      }).catch((f) => console.warn('Service worker niet geregistreerd', f));
    });
  }
  let installVraag = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installVraag = e; document.dispatchEvent(new Event('installeerbaar')); });
  window.voorraadInstalleren = async () => { if (!installVraag) return false; installVraag.prompt(); await installVraag.userChoice; installVraag = null; return true; };
  window.voorraadKanInstalleren = () => !!installVraag;
})();

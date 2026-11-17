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
  // wat bij een recept gebruikt wordt maar (nog) niet in de lijst bij Instellingen staat, achteraan toevoegen
  const lijstAanvullen = (inst, sleutel, namen) => {
    const lijst = Array.isArray(inst[sleutel]) ? inst[sleutel].filter((x) => typeof x === 'string' && x.trim()) : [];
    for (const n of namen) if (n && !lijst.some((x) => zelfde(x, n))) lijst.push(n);
    inst[sleutel] = lijst;
  };
  // categorieën van een recept: getrimd, zonder dubbels (hoofdletters tellen niet)
  const categorieLijst = (v) => {
    const uit = [];
    for (const c of Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []) {
      const t = String(c || '').trim();
      if (t && !uit.some((x) => zelfde(x, t))) uit.push(t);
    }
    return uit;
  };
  // prijzen van een product: [{ winkel, prijs, per }] — prijs in euro per eenheid `per`, één regel per winkel
  const prijzenLijst = (v) => {
    const uit = [];
    for (const x of Array.isArray(v) ? v : []) {
      const winkel = String((x && x.winkel) || '').trim(), prijs = getal(x && x.prijs);
      if (!winkel || !(prijs >= 0) || uit.some((y) => zelfde(y.winkel, winkel))) continue;
      uit.push({ winkel, prijs: Math.round(prijs * 1000) / 1000, per: String((x && x.per) || '').trim() });
    }
    return uit;
  };

  // één geplande maaltijd opschonen: velden uit `data`, aangevuld met wat er al was (`oud`)
  const planItem = (data, oud = {}) => {
    const veld = (k) => (k in data ? data[k] : oud[k]);
    const rid = veld('recept_id');
    return {
      id: oud.id, datum: String(veld('datum') || '').slice(0, 10), maaltijd: String(veld('maaltijd') || '').trim(),
      recept_id: rid !== null && rid !== undefined && rid !== '' && Number.isFinite(+rid) ? +rid : null,
      tekst: String(veld('tekst') || '').trim(), personen: parseInt(veld('personen'), 10) > 0 ? parseInt(veld('personen'), 10) : null,
      klaar: !!veld('klaar'),
    };
  };

  const STANDAARD = () => ({
    volgendId: 1,
    producten: [], boodschappen: [], recepten: [], gebeurtenissen: [], barcodes: {}, catalogus: [],
    planning: [], // maaltijdplanner: [{ id, datum, maaltijd, recept_id | null, tekst, personen, klaar }]
    instellingen: {
      tgt_dagen: 2, tht_dagen: 3, locaties: ['Koelkast', 'Diepvries', 'Voorraadkast'],
      categorieen: ['Groenten', 'Fruit', 'Zuivel & eieren', 'Vlees & vis', 'Brood & granen', 'Pasta, rijst & peulvruchten',
        'Conserven', 'Kruiden & sauzen', 'Snacks & zoet', 'Dranken', 'Diepvriesproducten', 'Overig'],
      // indeling van recepten (zelf aan te passen bij Instellingen)
      recept_soorten: ['Ontbijt', 'Lunch', 'Voorgerecht', 'Soep', 'Salade', 'Hoofdgerecht', 'Bijgerecht', 'Dessert', 'Gebak', 'Snack', 'Saus', 'Drank'],
      recept_categorieen: ['Vegetarisch', 'Vlees', 'Vis', 'Pasta', 'Snel', 'Feestelijk'],
      winkels: [], // waar je boodschappen doet (zelf aan te vullen); prijzen per winkel staan in de catalogus
      maaltijden: ['Ontbijt', 'Lunch', 'Avondeten'], // momenten in de maaltijdplanner
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
  /** Bewaart S. De belofte faalt als het bewaren mislukt, zodat de app dat kan melden (niet stil verloren gaan). */
  function bewaren() {
    const kopie = JSON.parse(JSON.stringify(S));
    const schrijf = schrijfKetting.then(async () => {
      const d = await db();
      await new Promise((ok, nee) => {
        const t = d.transaction(DB_TABEL, 'readwrite');
        t.objectStore(DB_TABEL).put(kopie, SLEUTEL);
        t.oncomplete = ok; t.onerror = () => nee(t.error); t.onabort = () => nee(t.error || new Error('afgebroken'));
      });
      opslagWerkt = true;
      bestandPlannen();
    });
    schrijfKetting = schrijf.catch((f) => { console.error('Bewaren mislukt', f); opslagWerkt = false; });
    return schrijf;
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
    uit.planning = (Array.isArray(d.planning) ? d.planning : []).filter((m) => m && /^\d{4}-\d{2}-\d{2}$/.test(m.datum || ''))
      .map((m) => planItem(m, m));
    uit.catalogus = Array.isArray(d.catalogus) ? d.catalogus.filter((c) => c && (c.naam || '').trim()) : null;
    // barcodes uit een oudere back-up (lijst) omzetten
    if (Array.isArray(d.barcodes)) for (const b of d.barcodes) if (b && b.code) uit.barcodes[String(b.code)] = { ...b, bron: 'eigen' };
    // ingrediënten als aparte lijst (oudere back-up): bij hun recept zetten
    const losseIngr = Array.isArray(d.ingredienten) ? d.ingredienten : [];
    for (const r of uit.recepten) {
      if (!Array.isArray(r.ingredienten)) r.ingredienten = losseIngr.filter((i) => String(i.recept_id) === String(r.id))
        .sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0));
      // indeling en favoriet (ontbreken in oudere gegevens)
      r.soort = typeof r.soort === 'string' ? r.soort : '';
      r.categorieen = categorieLijst(r.categorieen);
      r.favoriet = !!r.favoriet;
    }
    lijstAanvullen(uit.instellingen, 'recept_soorten', uit.recepten.map((r) => r.soort));
    lijstAanvullen(uit.instellingen, 'recept_categorieen', uit.recepten.flatMap((r) => r.categorieen));
    // id's altijd als getal (anders vindt de app items met een id als tekst niet terug)
    const getalId = (x) => { if (x && x.id != null && x.id !== '' && Number.isFinite(+x.id)) x.id = +x.id; };
    uit.producten.forEach(getalId); uit.boodschappen.forEach(getalId); uit.planning.forEach(getalId);
    uit.recepten.forEach((r) => { getalId(r); r.ingredienten.forEach(getalId); });
    // geplande maaltijd met een recept dat er niet (meer) is: de titel als tekst houden
    for (const m of uit.planning) if (m.recept_id !== null && !uit.recepten.some((r) => r.id === m.recept_id)) m.recept_id = null;
    lijstAanvullen(uit.instellingen, 'maaltijden', uit.planning.map((m) => m.maaltijd));
    for (const b of uit.boodschappen) if (b.product_id != null && b.product_id !== '' && Number.isFinite(+b.product_id)) b.product_id = +b.product_id;
    // items zonder id krijgen er een (anders zijn ze niet te bewerken of te verwijderen)
    let hoogste = 0;
    for (const x of [...uit.producten, ...uit.boodschappen, ...uit.recepten, ...uit.planning]) if (+x.id > hoogste) hoogste = +x.id;
    for (const r of uit.recepten) for (const i of r.ingredienten) if (+i.id > hoogste) hoogste = +i.id;
    for (const x of [...uit.producten, ...uit.boodschappen, ...uit.recepten, ...uit.planning]) if (!Number.isFinite(x.id)) x.id = ++hoogste;
    let max = 0;
    const zie = (x) => { if (x && +x.id > max) max = +x.id; };
    uit.producten.forEach(zie); uit.boodschappen.forEach(zie); uit.planning.forEach(zie);
    uit.recepten.forEach((r) => { zie(r); r.ingredienten.forEach(zie); });
    uit.volgendId = Math.max(+d.volgendId || 1, max + 1);
    // catalogus ontbreekt (oudere gegevens): opbouwen uit wat er al is
    if (!uit.catalogus) {
      uit.catalogus = [];
      const vorige = S; S = uit;
      for (const p of uit.producten) catalogusBijwerken(p, false);
      for (const [code, b] of Object.entries(uit.barcodes)) if (b && b.naam) catalogusBijwerken({ ...b, barcode: code }, false);
      S = vorige;
    }
    for (const c of uit.catalogus) c.prijzen = prijzenLijst(c.prijzen);
    lijstAanvullen(uit.instellingen, 'winkels', uit.catalogus.flatMap((c) => c.prijzen.map((p) => p.winkel)));
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
  // Catalogus: elk product dat ooit werd toegevoegd, ook als het later op is of verwijderd werd
  function catalogusBijwerken(p, teller = true, oudeNaam = null) {
    const naam = (p.naam || '').trim();
    if (!naam) return;
    let c = S.catalogus.find((x) => zelfde(x.naam, naam));
    if (!c && oudeNaam && !zelfde(oudeNaam, naam)) {
      c = S.catalogus.find((x) => zelfde(x.naam, oudeNaam));
      if (c && S.producten.some((x) => x !== p && zelfde(x.naam, oudeNaam))) c = null; // oude naam nog in gebruik
    }
    if (!c) { c = { naam, aantal: 0, eerst: nu() }; S.catalogus.push(c); }
    c.naam = naam;
    for (const k of ['eenheid', 'categorie', 'locatie', 'datumtype', 'barcode']) if (p[k]) c[k] = p[k];
    if (p.hoeveelheid > 0) c.hoeveelheid = p.hoeveelheid;
    if ('inhoud' in p) { c.inhoud = p.inhoud > 0 ? p.inhoud : null; c.inhoud_eenheid = p.inhoud > 0 ? p.inhoud_eenheid || '' : ''; }
    if (teller) c.aantal = (c.aantal || 0) + 1;
    c.laatst = nu();
  }
  // prijzen van een product (per naam, in de catalogus) vervangen
  function prijzenZetten(naam, prijzen, eenheid) {
    naam = (naam || '').trim();
    if (!naam) return;
    let c = S.catalogus.find((x) => zelfde(x.naam, naam));
    if (!c) { catalogusBijwerken({ naam, eenheid: eenheid || '' }, false); c = S.catalogus.find((x) => zelfde(x.naam, naam)); }
    c.prijzen = prijzenLijst(prijzen);
    lijstAanvullen(S.instellingen, 'winkels', c.prijzen.map((p) => p.winkel));
  }
  const gebeurtenis = (soort, naam) => S.gebeurtenissen.push({ soort, naam, tijdstip: nu() });

  const alles = () => JSON.parse(JSON.stringify({
    producten: [...S.producten].sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl')),
    boodschappen: [...S.boodschappen].sort((a, b) => a.afgevinkt - b.afgevinkt || (a.naam || '').localeCompare(b.naam || '', 'nl')),
    recepten: [...S.recepten].sort((a, b) => (a.titel || '').localeCompare(b.titel || '', 'nl')),
    catalogus: [...S.catalogus].sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl')),
    planning: [...S.planning].sort((a, b) => a.datum.localeCompare(b.datum)),
    instellingen: S.instellingen,
  }));
  const fout = (status, bericht) => { const e = new Error(bericht); e.status = status; throw e; };
  const VELDEN = ['naam', 'categorie', 'hoeveelheid', 'eenheid', 'locatie', 'aankoopdatum', 'vervaldatum', 'datumtype', 'minimum', 'notitie', 'barcode', 'inhoud', 'inhoud_eenheid'];

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
    const kol = ['naam', 'hoeveelheid', 'eenheid', 'inhoud', 'inhoud_eenheid', 'locatie', 'categorie', 'vervaldatum', 'datumtype', 'minimum', 'aankoopdatum', 'notitie', 'barcode'];
    const cel = (v) => { const t = v == null ? '' : String(v); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const regels = [kol.join(';'), ...alles().producten.map((p) => kol.map((k) => cel(k === 'hoeveelheid' || k === 'minimum' || k === 'inhoud' ? String(p[k] ?? '').replace('.', ',') : p[k])).join(';'))];
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
    else backupDownloaden();
  });
  function backupDownloaden() {
    downloaden(`voorraad-backup-${vandaag()}.json`, backupTekst(), 'application/json');
    S.laatste_backup = nu();
    bewaren().catch(() => {});
    meldBestand();
  }
  // Automatische back-up in Downloads: hoogstens één per dag, bij de eerste wijziging van de dag (tijdens die tik,
  // zodat de browser de download toelaat). Aan/uit bij Instellingen; standaard aan, behalve op iPhone/iPad
  // (Safari vraagt daar bij elke download om bevestiging).
  // Op Android is er geen bestandskoppeling: Chrome vergeet daar bij elk herstarten de toestemming voor het bestand.
  const ANDROID = /android/i.test(navigator.userAgent);
  const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const autoBackupAan = () => (typeof S.instellingen.auto_backup === 'boolean' ? S.instellingen.auto_backup : !IOS);
  // tijdstippen staan in UTC zonder 'Z' (zie nu())
  const lokaleDag = (t) => (t ? datum(new Date(/(Z|[+-]\d\d:?\d\d)$/.test(t) ? t : t + 'Z')) : '');
  function autoBackup() {
    if (!autoBackupAan() || lokaleDag(S.laatste_backup) === vandaag()) return;
    if (!S.producten.length && !S.recepten.length && !S.boodschappen.length) return; // nog niets om te bewaren
    backupDownloaden();
  }

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
      // ook een back-up die in een extra laag zit (bv. { gegevens: {...} }) of alleen recepten heeft
      const d = data && (Array.isArray(data.producten) || Array.isArray(data.recepten) ? data : data.gegevens || data.data);
      if (!d || (!Array.isArray(d.producten) && !Array.isArray(d.recepten))) fout(400, 'Dit is geen geldig back-upbestand.');
      S = normaliseren(d);
      return alles();
    }
    if (bron === 'hernoemen') {
      if (data.veld === 'recept_soort') {
        for (const r of S.recepten) if (zelfde(r.soort, data.van)) r.soort = data.naar || '';
        return alles();
      }
      if (data.veld === 'recept_categorie') {
        for (const r of S.recepten) {
          if (!(r.categorieen || []).some((c) => zelfde(c, data.van))) continue;
          r.categorieen = categorieLijst(r.categorieen.map((c) => (zelfde(c, data.van) ? data.naar || '' : c)));
        }
        return alles();
      }
      if (data.veld === 'maaltijd') {
        for (const m of S.planning) if (zelfde(m.maaltijd, data.van)) m.maaltijd = data.naar || '';
        return alles();
      }
      if (data.veld === 'winkel') {
        // winkel hernoemd of verwijderd (naar leeg): prijzen bij die winkel mee aanpassen
        for (const c of S.catalogus) {
          if (!(c.prijzen || []).some((p) => zelfde(p.winkel, data.van))) continue;
          c.prijzen = prijzenLijst(c.prijzen.map((p) => (zelfde(p.winkel, data.van) ? { ...p, winkel: data.naar || '' } : p)));
        }
        return alles();
      }
      const veld = data.veld === 'categorie' ? 'categorie' : 'locatie';
      for (const p of S.producten) if (zelfde(p[veld], data.van)) p[veld] = data.naar || '';
      return alles();
    }

    if (bron === 'prijzen') { prijzenZetten(data.naam, data.prijzen, data.eenheid); return alles(); }
    if (bron === 'catalogus' && methode === 'DELETE') {
      S.catalogus = S.catalogus.filter((c) => !zelfde(c.naam, data && data.naam));
      return alles();
    }

    if (bron === 'planning') {
      const controleren = (m) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(m.datum)) fout(400, 'Kies een dag.');
        if (m.recept_id !== null && !S.recepten.some((r) => r.id === m.recept_id)) fout(404, 'Dit recept bestaat niet (meer).');
        if (m.recept_id === null && !m.tekst) fout(400, 'Kies een recept of typ wat je eet.');
        if (m.recept_id !== null) m.tekst = '';
        lijstAanvullen(S.instellingen, 'maaltijden', [m.maaltijd]);
        return m;
      };
      if (methode === 'POST' && ident === null) {
        const m = controleren(planItem(data, { id: id() }));
        S.planning.push(m);
        return { ...alles(), nieuw_id: m.id };
      }
      const i = S.planning.findIndex((x) => x.id === ident);
      if (i < 0) fout(404, 'Deze maaltijd staat niet (meer) in je planning.');
      if (methode === 'PUT') { S.planning[i] = controleren(planItem(data, S.planning[i])); return alles(); }
      if (methode === 'DELETE') { S.planning.splice(i, 1); return alles(); }
    }

    if (bron === 'producten') {
      if (methode === 'POST' && ident === null) {
        if (!(data.naam || '').trim()) fout(400, 'Geef het product een naam.');
        const p = { id: id(), aangemaakt: nu(), gewijzigd: nu(), notitie: '', barcode: '' };
        for (const k of VELDEN) if (k in data) p[k] = data[k];
        p.naam = p.naam.trim();
        p.hoeveelheid = getal(p.hoeveelheid) || 0; p.minimum = getal(p.minimum) || 0;
        p.inhoud = getal(p.inhoud) || null; if (!p.inhoud) p.inhoud_eenheid = '';
        S.producten.push(p);
        catalogusBijwerken(p);
        if (Array.isArray(data.prijzen)) prijzenZetten(p.naam, data.prijzen, p.eenheid);
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
        if ('inhoud' in data) { p.inhoud = getal(data.inhoud) || null; if (!p.inhoud) p.inhoud_eenheid = ''; }
        p.gewijzigd = nu();
        if (VELDEN.some((k) => k !== 'hoeveelheid' && k in data)) catalogusBijwerken(p, false, oudeNaam);
        if (Array.isArray(data.prijzen)) prijzenZetten(p.naam, data.prijzen, p.eenheid);
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
            catalogusBijwerken(bestaand);
          } else {
            const voorbeeld = S.producten.find((p) => zelfde(p.naam, b.naam));
            S.producten.push({ id: id(), naam: b.naam, categorie: voorbeeld?.categorie || '', hoeveelheid: h, eenheid: item.eenheid,
              locatie: item.locatie || voorbeeld?.locatie || '', aankoopdatum: vandaag(), vervaldatum: item.vervaldatum || '',
              datumtype: item.datumtype || 'THT', minimum: 0, notitie: '', barcode: voorbeeld?.barcode || '', aangemaakt: nu(), gewijzigd: nu(),
              ...(voorbeeld?.inhoud > 0 && voorbeeld.eenheid === item.eenheid ? { inhoud: voorbeeld.inhoud, inhoud_eenheid: voorbeeld.inhoud_eenheid } : {}) });
            catalogusBijwerken(S.producten[S.producten.length - 1]);
          }
          gebeurtenis('gekocht', b.naam);
          S.boodschappen = S.boodschappen.filter((x) => x !== b);
          minimumControleren(b.naam);
        }
        return alles();
      }
      if (methode === 'POST' && actie === 'afgevinkte-wissen') {
        const ids = Array.isArray(data.ids) ? data.ids.map(Number) : null; // alleen die van één winkel, of alles
        S.boodschappen = S.boodschappen.filter((b) => !b.afgevinkt || (ids && !ids.includes(b.id)));
        return alles();
      }
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
        if ('eenheid' in data) b.eenheid = data.eenheid || '';
        if ('naam' in data && String(data.naam || '').trim() && !zelfde(data.naam, b.naam)) {
          b.naam = String(data.naam).trim();
          b.product_id = S.producten.find((p) => zelfde(p.naam, b.naam))?.id || null;
          if (b.bron === 'minimum') b.bron = 'handmatig'; // zelf hernoemd: niet meer vanzelf weghalen
        }
        return alles();
      }
      if (b && methode === 'DELETE') { S.boodschappen = S.boodschappen.filter((x) => x !== b); return alles(); }
      if (!b) fout(404, 'Dit staat niet (meer) op je lijst.');
    }

    if (bron === 'recepten') {
      const opslaan = (r) => {
        if (!(data.titel || '').trim()) fout(400, 'Geef het recept een titel.');
        Object.assign(r, { titel: data.titel.trim(), personen: parseInt(data.personen, 10) || 4, bereidingstijd: data.bereidingstijd || '',
          stappen: data.stappen || '', notities: data.notities || '', gewijzigd: nu(),
          soort: (data.soort || '').trim(), categorieen: categorieLijst(data.categorieen),
          favoriet: 'favoriet' in data ? !!data.favoriet : !!r.favoriet });
        lijstAanvullen(S.instellingen, 'recept_soorten', [r.soort]);
        lijstAanvullen(S.instellingen, 'recept_categorieen', r.categorieen);
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
      if (methode === 'DELETE') {
        S.recepten = S.recepten.filter((x) => x !== r);
        // ingeplande maaltijden blijven staan, met de titel als tekst
        for (const m of S.planning) if (m.recept_id === r.id) { m.recept_id = null; m.tekst = r.titel; }
        return alles();
      }
      if (methode === 'POST' && actie === 'favoriet') { r.favoriet = !!data.favoriet; return alles(); }
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
  // ------------------------------------------------------------------ ook bewaren in een bestand op het toestel
  // Op Chrome/Edge (computer en Android) kan de app een gewoon bestand (bv. in Documenten) bijhouden.
  // Na elke wijziging wordt dat bestand overschreven met alle gegevens, in hetzelfde formaat als een back-up.
  // Worden de browsergegevens gewist, dan haal je alles terug met "Bestaand bestand openen" (of "Back-up terugzetten").
  const BESTAND_SLEUTEL = 'bestand';
  const kanBestand = !ANDROID && typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
  let koppeling = null; // { handle, naam, toestemming: 'granted' | 'prompt' | 'denied', laatst, fout }
  let bestandTimer = null, bestandKetting = Promise.resolve(), gekozen = null;
  const JSON_TYPE = [{ description: 'Voorraad-gegevens', accept: { 'application/json': ['.json'] } }];
  const backupTekst = () => JSON.stringify({ app: 'Voorraadbeheer', versie: 2, gemaakt: nu(), ...S }, null, 1);
  const idb = async (sleutel, waarde, wissen) => {
    const d = await db();
    return new Promise((ok, nee) => {
      const t = d.transaction(DB_TABEL, waarde === undefined && !wissen ? 'readonly' : 'readwrite');
      const st = t.objectStore(DB_TABEL);
      const r = wissen ? st.delete(sleutel) : waarde === undefined ? st.get(sleutel) : st.put(waarde, sleutel);
      t.oncomplete = () => ok(r.result); t.onerror = () => nee(t.error); t.onabort = () => nee(t.error || new Error('afgebroken'));
    });
  };
  /** nodig: de app kon niet zelf om toestemming vragen (of kreeg nee) — de gebruiker moet op een knop tikken */
  const meldBestand = (nodig = false) => document.dispatchEvent(new CustomEvent('bestandstatus', { detail: { nodig } }));
  const toestemming = async (handle, vragen) => {
    try {
      const o = { mode: 'readwrite' };
      if (vragen && handle.requestPermission) return await handle.requestPermission(o);
      return handle.queryPermission ? await handle.queryPermission(o) : 'granted';
    } catch { return 'prompt'; }
  };
  async function bestandLaden() {
    if (!kanBestand) {
      // koppeling uit een vorige versie (Android): opruimen, die vraagt bij elk herstarten om toestemming
      if (ANDROID) idb(BESTAND_SLEUTEL, undefined, true).catch(() => {});
      return;
    }
    try {
      const k = await idb(BESTAND_SLEUTEL);
      if (!k || !k.handle) return;
      koppeling = { handle: k.handle, naam: k.handle.name, laatst: k.laatst || null, fout: null, toestemming: await toestemming(k.handle) };
    } catch (f) { console.warn('Bestandskoppeling niet geladen', f); }
  }
  async function naarBestand() {
    if (!koppeling || koppeling.toestemming !== 'granted') return;
    const k = koppeling;
    try {
      const w = await k.handle.createWritable();
      await w.write(backupTekst());
      await w.close();
      k.laatst = nu(); k.fout = null;
      idb(BESTAND_SLEUTEL, { handle: k.handle, laatst: k.laatst }).catch(() => {});
    } catch (f) {
      console.error('Bewaren in bestand mislukt', f);
      k.toestemming = await toestemming(k.handle);
      k.fout = k.toestemming !== 'granted' ? 'Geen toestemming meer om in het bestand te bewaren.'
        : f && f.name === 'NotFoundError' ? 'Het bestand is verplaatst of verwijderd. Kies het opnieuw.'
        : 'Bewaren in het bestand lukte niet.';
    }
    meldBestand();
  }
  const bestandNu = () => { clearTimeout(bestandTimer); bestandTimer = null; return (bestandKetting = bestandKetting.then(naarBestand)); };
  // Chrome op Android (en soms op de computer) vergeet de toestemming als de app sluit. Daarom niet bij het
  // openen storen, maar pas bij de eerste wijziging: die komt van een tik, en tijdens een tik mag de app
  // de browser om toestemming vragen. Lukt dat niet (of zegt de gebruiker nee), dan één melding met een knop.
  let vraagBezig = false, nietMeerVragen = false;
  async function toestemmingTerug() {
    if (!koppeling || vraagBezig) return;
    const tik = !navigator.userActivation || navigator.userActivation.isActive;
    if (nietMeerVragen || !tik) return meldBestand(true);
    vraagBezig = true;
    const k = koppeling;
    k.toestemming = await toestemming(k.handle, true);
    vraagBezig = false;
    if (k.toestemming === 'granted') { k.fout = null; await bestandNu(); return; }
    nietMeerVragen = true;
    meldBestand(true);
  }
  function bestandPlannen() {
    if (!koppeling) return;
    if (koppeling.toestemming !== 'granted') { toestemmingTerug(); return; }
    clearTimeout(bestandTimer);
    bestandTimer = setTimeout(bestandNu, 700); // vele snelle wijzigingen na elkaar: één keer schrijven
  }
  // app gaat naar de achtergrond of wordt gesloten: wat nog moet, meteen schrijven
  const bijVerlaten = () => { if (bestandTimer) bestandNu(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') bijVerlaten(); });
  window.addEventListener('pagehide', bijVerlaten);

  async function koppelen(handle) {
    nietMeerVragen = false;
    koppeling = { handle, naam: handle.name, laatst: null, fout: null, toestemming: 'granted' };
    await idb(BESTAND_SLEUTEL, { handle, laatst: null });
    await bestandNu();
    if (koppeling && koppeling.fout) throw new Error(koppeling.fout);
  }
  window.voorraadBestand = {
    ondersteund: kanBestand,
    android: ANDROID,
    autoBackupAan: () => autoBackupAan(),
    /** Wanneer de laatste back-up gedownload werd, en sinds wanneer de app gebruikt wordt. */
    backupInfo: () => ({ laatste: S.laatste_backup || null, sinds: (S.gebeurtenissen[0] && S.gebeurtenissen[0].tijdstip) || null }),
    info: () => (koppeling ? { naam: koppeling.naam, toestemming: koppeling.toestemming, laatst: koppeling.laatst, fout: koppeling.fout } : null),
    /** Nieuw bestand kiezen (of een bestaand overschrijven) en er meteen alle gegevens in zetten. */
    async nieuw() {
      const handle = await window.showSaveFilePicker({ suggestedName: 'voorraad-gegevens.json', types: JSON_TYPE });
      await koppelen(handle);
    },
    /** Bestaand bestand kiezen en lezen. Geeft { naam, gegevens } (gegevens null als het bestand leeg is). */
    async kiesBestaand() {
      const [handle] = await window.showOpenFilePicker({ types: JSON_TYPE });
      const tekst = (await (await handle.getFile()).text()).replace(/^\uFEFF/, '').trim();
      let gegevens = null;
      if (tekst) {
        let d;
        try { d = JSON.parse(tekst); } catch { d = null; }
        gegevens = d && typeof d === 'object' && (Array.isArray(d.producten) || Array.isArray(d.recepten)) ? d : undefined;
      }
      gekozen = handle;
      return { naam: handle.name, gegevens };
    },
    /** Het gekozen bestaande bestand koppelen (na een klik: dan mag de app om schrijftoestemming vragen). */
    async bestaandGebruiken() {
      if (!gekozen) throw new Error('Geen bestand gekozen.');
      const handle = gekozen; gekozen = null;
      if ((await toestemming(handle, true)) !== 'granted') throw new Error('Zonder toestemming kan de app niet in dit bestand bewaren.');
      await koppelen(handle);
    },
    /** Opnieuw toestemming vragen (na het herstarten van de browser). Moet vanuit een klik. */
    async toestemmingVragen() {
      if (!koppeling) return false;
      koppeling.toestemming = await toestemming(koppeling.handle, true);
      if (koppeling.toestemming === 'granted') { nietMeerVragen = false; koppeling.fout = null; await bestandNu(); } else meldBestand();
      return koppeling.toestemming === 'granted';
    },
    async stoppen() {
      clearTimeout(bestandTimer); bestandTimer = null;
      koppeling = null;
      await idb(BESTAND_SLEUTEL, undefined, true).catch(() => {});
      meldBestand();
    },
  };

  const klaar = laden().then(bestandLaden).then(() => {
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
        if (wijzigt) {
          try { await bewaren(); } catch {
            fout(507, 'Je gegevens konden niet bewaard worden op dit toestel. Open de app niet in een privévenster en kijk of er nog opslagruimte vrij is.');
          }
          if (kanaal) kanaal.postMessage('gewijzigd');
          autoBackup();
        }
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
  // geen preventDefault: zo toont Chrome op Android ook zelf de balk "App installeren"
  window.addEventListener('beforeinstallprompt', (e) => { installVraag = e; document.dispatchEvent(new Event('installeerbaar')); });
  window.voorraadInstalleren = async () => { if (!installVraag) return false; installVraag.prompt(); await installVraag.userChoice; installVraag = null; return true; };
  window.voorraadKanInstalleren = () => !!installVraag;
  window.addEventListener('appinstalled', () => { installVraag = null; document.dispatchEvent(new Event('installeerbaar')); });
})();

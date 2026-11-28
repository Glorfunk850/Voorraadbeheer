// Voorraad — opslag en logica in de browser zelf (installeerbare webapp).
// Alle gegevens staan in IndexedDB op dit toestel. Er is geen server.
// De interface (app.js) praat met "api/..."; die verzoeken worden hier afgehandeld.
// Naar buiten gaat alleen: een barcode naar Open Food Facts, en het eenmalig ophalen van
// de tekstherkenning (Tesseract.js, open source, geen AI-dienst). Bestanden blijven op het toestel.
(function () {
  const DB_NAAM = 'voorraadbeheer', DB_TABEL = 'staat', SLEUTEL = 'gegevens';
  // ------------------------------------------------------------------ probleemlogboek
  // Fouten en trage opdrachten worden genoteerd (alleen op dit toestel, de laatste 60), zodat je bij een probleem
  // kunt nakijken wat er gebeurde: Instellingen → Probleemlogboek → Kopiëren.
  const LOG_SLEUTEL = 'voorraad-logboek';
  const logLezen = () => { try { const l = JSON.parse(localStorage.getItem(LOG_SLEUTEL) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } };
  function log(tekst) {
    const t = new Date(), tijd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${t.toTimeString().slice(0, 8)}`;
    const regel = `${tijd} ${String(tekst).slice(0, 600)}`;
    try { localStorage.setItem(LOG_SLEUTEL, JSON.stringify([...logLezen(), regel].slice(-60))); } catch { /* */ }
    try { console.warn('[logboek]', regel); } catch { /* */ }
  }
  const foutTekst = (f) => (f && (f.stack || f.message)) ? `${f.name || 'Fout'}: ${f.message}${f.stack ? ' | ' + String(f.stack).split('\n').slice(1, 4).map((x) => x.trim()).join(' | ') : ''}` : String(f);
  window.addEventListener('error', (e) => log(`JS-fout: ${e.error ? foutTekst(e.error) : e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => log(`Niet opgevangen fout: ${foutTekst(e.reason)}`));
  window.voorraadLog = {
    schrijf: log, fout: (wat, f) => log(`${wat}: ${foutTekst(f)}`),
    lezen: () => logLezen(), wissen: () => { try { localStorage.removeItem(LOG_SLEUTEL); } catch { /* */ } },
  };
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
  // prijzen van een product: [{ winkel, prijs, per, merk?, inhoud?, inhoud_eenheid? }] — prijs in euro per eenheid `per`.
  // Met een merk en/of inhoud geldt de prijs alleen voor dat merk en die verpakking (bv. Lavazza, pak à 500 g);
  // zonder merk en inhoud voor alles zonder eigen prijs. Eén regel per winkel, per merk en per inhoud.
  const prijsSleutel = (x) => (x && getal(x.inhoud) > 0 && x.inhoud_eenheid ? `${getal(x.inhoud)} ${x.inhoud_eenheid}` : '');
  const prijsMerk = (x) => String((x && x.merk) || '').trim();
  const prijsGroep = (x) => `${prijsMerk(x).toLowerCase()}|${prijsSleutel(x)}`;
  const prijzenLijst = (v) => {
    const uit = [];
    for (const x of Array.isArray(v) ? v : []) {
      const winkel = String((x && x.winkel) || '').trim(), prijs = getal(x && x.prijs), sleutel = prijsSleutel(x), groep = prijsGroep(x);
      if (!winkel || !(prijs >= 0) || uit.some((y) => zelfde(y.winkel, winkel) && prijsGroep(y) === groep)) continue;
      uit.push({ winkel, prijs: Math.round(prijs * 1000) / 1000, per: String((x && x.per) || '').trim(),
        ...(prijsMerk(x) ? { merk: prijsMerk(x) } : {}),
        ...(sleutel ? { inhoud: getal(x.inhoud), inhoud_eenheid: String(x.inhoud_eenheid) } : {}) });
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
      // eenheden voor voorraad en boodschappen (zelf aan te passen bij Instellingen)
      eenheden: ['stuks', 'g', 'kg', 'ml', 'cl', 'dl', 'l', 'pak', 'blik', 'fles', 'pot', 'zak', 'doos'],
      // eenheden voor de inhoud per stuk of verpakking (bv. pak à 500 g); zelf aan te vullen, bv. vel of wasbeurt
      inhoud_eenheden: ['g', 'kg', 'ml', 'cl', 'dl', 'l'],
    },
  });
  let S = STANDAARD();
  // Met synchronisatie maken meerdere toestellen items aan: een id op basis van de tijd (in microseconden, plus
  // toeval) botst dan niet. Zonder synchronisatie gewoon doortellen.
  const id = () => {
    const n = syncAan() ? Math.max(S.volgendId, Date.now() * 1000 + Math.floor(Math.random() * 1000)) : S.volgendId;
    S.volgendId = n + 1;
    return n;
  };

  // ------------------------------------------------------------------ opslag
  // Op een gsm kan de browser de verbinding met de opslag stil sluiten of laten hangen (bv. als de app een tijd op de
  // achtergrond stond; op iPhone soms tot je de app herstart). Dan wachtte alles daarna: de app "blokkeerde".
  // Daarom: een verbinding die gesloten wordt, vergeten; een opdracht die te lang duurt (of mislukt) nog één keer
  // proberen met een nieuwe verbinding. Lukt dat ook niet, dan geldt de opslag als "stuk": de app wacht er niet meer
  // op en bewaart meteen in een noodopslag (localStorage). Op de achtergrond (en bij het terugkomen in de app) wordt
  // nagekeken of de gewone opslag weer werkt; dan gaat alles daar terug naartoe.
  const DB_WACHT = 4000, NOOD_SLEUTEL = 'voorraad-noodopslag';
  let dbBelofte = null, opslagStuk = false;
  const dbVergeten = (d) => {
    const oud = dbBelofte; dbBelofte = null;
    try { if (d) d.close(); } catch { /* al dicht */ }
    if (oud && !d) oud.then((x) => { try { x.close(); } catch { /* */ } }, () => {});
  };
  const db = () => dbBelofte || (dbBelofte = new Promise((ok, nee) => {
    let r;
    try { r = indexedDB.open(DB_NAAM, 1); } catch (f) { dbBelofte = null; return nee(f); }
    const klok = setTimeout(() => { dbBelofte = null; nee(new Error('De opslag op dit toestel reageert niet.')); }, DB_WACHT);
    r.onupgradeneeded = () => r.result.createObjectStore(DB_TABEL);
    r.onsuccess = () => {
      clearTimeout(klok);
      const d = r.result;
      d.onclose = () => { if (dbBelofte) dbBelofte = null; };
      d.onversionchange = () => dbVergeten(d);
      ok(d);
    };
    r.onerror = () => { clearTimeout(klok); dbBelofte = null; nee(r.error); };
    r.onblocked = () => console.warn('Opslag geblokkeerd door een ander venster van de app');
  }));
  /** Eén poging: werk(store) geeft een IDBRequest (of niets); de belofte geeft het resultaat ervan. */
  async function opslagKeer(modus, werk) {
    const d = await db();
    return new Promise((ok, nee) => {
      let t, r;
      try { t = d.transaction(DB_TABEL, modus); r = werk(t.objectStore(DB_TABEL)); } catch (f) { dbVergeten(d); return nee(f); } // verbinding was dicht
      const klok = setTimeout(() => { try { t.abort(); } catch { /* */ } dbVergeten(d); nee(new Error('De opslag op dit toestel reageert niet.')); }, DB_WACHT);
      t.oncomplete = () => { clearTimeout(klok); ok(r && r.result); };
      t.onerror = () => { clearTimeout(klok); nee(t.error); };
      t.onabort = () => { clearTimeout(klok); nee(t.error || new Error('afgebroken')); };
    });
  }
  /** Eén opdracht op de opslag; mislukt ze, nog één keer met een nieuwe verbinding. Is de opslag stuk: meteen een fout. */
  async function opslag(modus, werk) {
    if (opslagStuk) { herstelPlannen(); throw new Error('De opslag op dit toestel werkt even niet.'); }
    try { return await opslagKeer(modus, werk); } catch (f) {
      console.warn('Opslag: opnieuw proberen', f);
      log(`Opslag: ${modus} mislukt, opnieuw (${foutTekst(f).slice(0, 200)})`);
      dbVergeten();
      try { return await opslagKeer(modus, werk); } catch (f2) {
        opslagStuk = true; herstelPlannen();
        log(`Opslag stuk: ${foutTekst(f2).slice(0, 200)}`);
        throw f2;
      }
    }
  }
  // noodopslag: alleen zolang de gewone opslag niet werkt; verdwijnt zodra alles weer in de gewone opslag staat
  const noodLezen = () => { try { const t = localStorage.getItem(NOOD_SLEUTEL); return t ? JSON.parse(t) : null; } catch { return null; } };
  const noodSchrijven = (tekst) => { localStorage.setItem(NOOD_SLEUTEL, tekst); };
  const noodWissen = () => { try { localStorage.removeItem(NOOD_SLEUTEL); } catch { /* */ } };
  let herstelTimer = null, herstelBezig = false;
  function herstelPlannen(wacht = 15000) {
    if (!opslagStuk || herstelBezig) return;
    clearTimeout(herstelTimer);
    herstelTimer = setTimeout(herstellen, wacht);
  }
  /** Kijken of de gewone opslag weer werkt (zonder de app op te houden); zo ja: wat in de noodopslag staat erin zetten. */
  async function herstellen() {
    if (!opslagStuk || herstelBezig) return;
    herstelBezig = true; herstelTimer = null;
    dbVergeten();
    try {
      await opslagKeer('readonly', (st) => st.count());
      opslagStuk = false;
      console.info('Opslag werkt weer'); log('Opslag werkt weer');
      if (ladenMislukt) {
        // bij het openen kon niets gelezen worden: nu de echte gegevens lezen, samen met wat je intussen invoerde
        await inWachtrij(async () => {
          await schrijfKetting;
          await laden();
        }, 'opslag herstellen');
        if (kanaal) kanaal.postMessage('gewijzigd');
        document.dispatchEvent(new Event('syncgewijzigd'));
      } else if (noodLezen()) bewaren().catch(() => {});
    } catch { /* nog niet */ }
    herstelBezig = false;
    if (opslagStuk) herstelPlannen(30000);
  }
  // terug in de app: meteen nakijken (dan wacht de volgende tik niet)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && opslagStuk) herstelPlannen(0); });
  // Kon de app bij het openen niets lezen (opslag stuk), dan start ze leeg. Wat je dan invoert, mag je echte gegevens
  // later niet overschrijven: zodra de opslag weer werkt, worden ze samengevoegd (zie herstellen).
  let ladenMislukt = false;
  async function laden() {
    let waarde, gelezen = false;
    try { waarde = await opslag('readonly', (st) => st.get(SLEUTEL)); gelezen = true; } catch (f) { console.error('Laden mislukt', f); }
    if (gelezen) ladenMislukt = false; else if (!ladenMislukt) ladenMislukt = S.producten.length === 0 && S.recepten.length === 0 && S.boodschappen.length === 0;
    // wat in de noodopslag staat, is nieuwer dan de gewone opslag (bij het eerstvolgende goede bewaren wordt ze gewist)
    const nood = noodLezen();
    const metNood = !!(nood && nood.gegevens);
    if (metNood) waarde = nood.leegBegonnen && gelezen && waarde ? metEcht(nood.gegevens, waarde) : nood.gegevens;
    if (waarde) { S = normaliseren(waarde); minimumBoodschappenNakijken(); }
    if (metNood && gelezen) bewaren().catch(() => {}); // terug naar de gewone opslag (de noodopslag wordt dan gewist)
  }
  /** Ingevoerd op een lege app (opslag was stuk bij het openen) samenvoegen met de echte gegevens: alles blijft. */
  function metEcht(ingevoerd, echt) {
    let n = Math.max(+echt.volgendId || 1, Date.now() * 1000);
    const eigen = M.nieuweIds(syncDeel(ingevoerd), () => n++);
    // basis: de lege app zoals ze begon; zo winnen je echte instellingen, behalve wat je intussen zelf veranderde
    const uit = M.samenvoegen(syncDeel(STANDAARD()), eigen, syncDeel(echt));
    uit.volgendId = n;
    if (echt.laatste_backup) uit.laatste_backup = echt.laatste_backup;
    return uit;
  }
  let opslagWerkt = true, schrijfKetting = Promise.resolve();
  /** Bewaart S. De belofte faalt alleen als ook de noodopslag mislukt, zodat de app dat kan melden (niet stil verloren gaan). */
  function bewaren() {
    const tekst = JSON.stringify(S), kopie = JSON.parse(tekst);
    const schrijf = schrijfKetting.then(async () => {
      try {
        if (ladenMislukt) throw new Error('eerst de echte gegevens lezen');
        await opslag('readwrite', (st) => { st.put(kopie, SLEUTEL); });
        noodWissen();
      } catch (f) {
        console.warn('Gewone opslag werkt niet; bewaard in de noodopslag', f);
        noodSchrijven(JSON.stringify({ tijd: nu(), ...(ladenMislukt ? { leegBegonnen: true } : {}), gegevens: kopie })); // gooit een fout als ook dit niet lukt
      }
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
  // Inhoud per verpakking van één boodschap (bv. pak à 500 g): alleen bij telbare eenheden.
  // Telbaar: stuks, verpakkingen en zelf toegevoegde eenheden (bv. bokaal); niet: gewichten, volumes en receptmaten.
  const NIET_TELBAAR = new Set(['', 'g', 'kg', 'ml', 'cl', 'dl', 'l', 'el', 'tl', 'snuf', 'teen', 'takje', 'bos', 'kopje', 'plak', 'scheut', 'handvol', 'blad']);
  const MAAT = new Set(['g', 'kg', 'ml', 'cl', 'dl', 'l']);
  const TELBARE = { has: (e) => typeof e === 'string' && (!NIET_TELBAAR.has(e)
    || (!!e && !MAAT.has(e) && Array.isArray(S.instellingen.eenheden) && S.instellingen.eenheden.includes(e))) };
  function boodschapInhoud(eenheid, inhoud, inhoudEenheid) {
    const i = getal(inhoud);
    return TELBARE.has(eenheid || 'stuks') && i > 0 && inhoudEenheid ? { inhoud: i, inhoud_eenheid: inhoudEenheid } : {};
  }
  const inhoudSleutel = (x) => (x && x.inhoud > 0 && x.inhoud_eenheid ? `${x.inhoud} ${x.inhoud_eenheid}` : '');
  // Kleine of grote verpakking (bv. een klein flesje en een grote fles shampoo): `verpakking` = 'klein' of 'groot',
  // ontbreekt = niet opgegeven. Kleine en grote verpakkingen zijn aparte voorraden: ze worden nooit samengeteld,
  // elk heeft zijn eigen minimum, en wat onder het minimum zakt, komt terug op de lijst in dezelfde grootte.
  const MATEN = ['', 'klein', 'groot'];
  const maatVan = (x) => (x && (x.verpakking === 'klein' || x.verpakking === 'groot') ? x.verpakking : '');
  const maatVeld = (m) => (m ? { verpakking: m } : {});
  const metMaat = (m, sleutel) => (m ? `${m}|${sleutel}` : sleutel);
  // inhoud per verpakking van een voorraadregel als sleutel (bv. "500 g", of "groot|500 g"); leeg zonder inhoud
  const productSleutel = (p) => metMaat(maatVan(p), inhoudSleutel(boodschapInhoud(p.eenheid, p.inhoud, p.inhoud_eenheid)));
  const boodschapSleutel = (b) => metMaat(maatVan(b), inhoudSleutel(b));
  // De minimumvoorraad geldt per inhoud: 2 pak à 500 g en 1 pak à 1 kg zijn aparte voorraden met elk hun eigen minimum.
  // Staat er in de catalogus een minimum voor het hele product (alle merken en inhouden samen), dan geldt dat:
  // bv. 3 blikken doperwten in huis, om het even van welk merk of welke inhoud. Het tekort komt zonder merk en inhoud op je lijst.
  // Een automatische boodschap (minimum) komt zonder merk en inhoud op je lijst: die kies je na het winkelen.
  // Voor welke inhoud ze dient, staat in `minimum_sleutel` (oudere boodschappen: in hun eigen inhoud).
  const minimumSleutel = (b) => (typeof b.minimum_sleutel === 'string' ? b.minimum_sleutel : boodschapSleutel(b));
  // minimum voor het hele product in de catalogus: `minimum` (alle groottes), `minimum_klein` en `minimum_groot`
  const catMinimumVeld = (m) => (m ? `minimum_${m}` : 'minimum');
  // Grote verpakking: je koopt bv. een zak rijst van 5 kg en verdeelt die thuis over potten. Zakt het aantal potten
  // onder het minimum, dan komt 1 grote verpakking op de lijst (niet het tekort aan potten). Bij het afronden kies je
  // over hoeveel potten je ze verdeeld hebt; die worden bij de potten geteld (`potten_voor` = id van de voorraadregel).
  function grootUit(g) {
    if (!g || typeof g !== 'object') return null;
    const eenheid = TELBARE.has(g.eenheid) ? g.eenheid : 'zak';
    const potten = getal(g.potten);
    return { eenheid, ...boodschapInhoud(eenheid, g.inhoud, g.inhoud_eenheid), ...(potten > 0 ? { potten } : {}) };
  }
  // De grote verpakking hoort bij het product: ze staat ook in de catalogus en geldt voor al je voorraadregels met die naam
  // (in de catalogus of bij een voorraadregel bewerken komt op hetzelfde neer). g: null of leeg = uit.
  function grootZetten(naam, g) {
    const c = S.catalogus.find((x) => zelfde(x.naam, naam));
    if (c) { if (g) c.grootverpakking = { ...g }; else delete c.grootverpakking; }
    // niet bij een regel die zelf de grote verpakking is (bv. een zak rijst die je nog niet over potten verdeelde)
    for (const p of S.producten) if (zelfde(p.naam, naam)) { if (g && p.eenheid !== g.eenheid) p.grootverpakking = { ...g }; else delete p.grootverpakking; }
  }
  const grootBoodschap = (p, sleutel) => ({ id: id(), naam: p.naam, hoeveelheid: 1, eenheid: p.grootverpakking.eenheid,
    ...boodschapInhoud(p.grootverpakking.eenheid, p.grootverpakking.inhoud, p.grootverpakking.inhoud_eenheid),
    ...(typeof sleutel === 'string' ? { minimum_sleutel: sleutel } : {}), product_id: p.id, potten_voor: p.id, afgevinkt: 0, bron: 'minimum' });
  // Een automatische boodschap mag je zelf verhogen (bv. 2 i.p.v. het tekort van 1). Het tekort waarvoor ze laatst
  // berekend werd, staat in `minimum_tekort`; wat je er zelf bovenop zette, blijft behouden als het tekort verandert.
  // Onder het tekort gaan kan niet: het minimum blijft gerespecteerd.
  function tekortZetten(b, tekort) {
    const vorig = b.minimum_tekort > 0 ? b.minimum_tekort : null;
    const extra = vorig !== null && b.hoeveelheid > vorig ? b.hoeveelheid - vorig : 0;
    b.hoeveelheid = Math.round((tekort + extra) * 100) / 100;
    b.minimum_tekort = tekort;
  }
  const autoBoodschappen = (naam) => S.boodschappen.filter((b) => zelfde(b.naam, naam) && !b.afgevinkt && b.bron === 'minimum');
  function minimumControleren(naam) {
    const c = S.catalogus.find((x) => zelfde(x.naam, naam));
    // Eerst de minima voor het hele product (catalogus): per grootte, en het algemene voor de groottes zonder eigen minimum.
    // Wat daar niet onder valt, volgt het minimum van de voorraadregels zelf (per inhoud en grootte).
    const vrij = new Set(MATEN), actief = new Set(), taken = [];
    for (const m of ['klein', 'groot']) if (c && c[catMinimumVeld(m)] > 0) { vrij.delete(m); actief.add(m); taken.push([m, [m]]); }
    // Het algemene minimum geldt voor de groottes zonder eigen minimum. Heeft het product daarvan niets (geen voorraadregel
    // en geen variant in de catalogus, bv. alles is klein en klein heeft een eigen minimum), dan is het een overblijfsel
    // van vroeger: niet tellen, anders staat het product altijd op de lijst (0 in huis van een grootte die je nooit koopt).
    if (c && c.minimum > 0) {
      const rest = [...vrij];
      const heeftRest = rest.length === MATEN.length || S.producten.some((p) => zelfde(p.naam, naam) && rest.includes(maatVan(p)))
        || variantenVan(c).some((v) => rest.includes(maatVan(v)));
      if (heeftRest) { vrij.clear(); actief.add(''); taken.push(['', rest]); }
    }
    // eerst: automatische boodschap van een catalogusminimum dat er niet meer is weg (bv. minimum van "alleen grote"
    // naar "alle groottes" gezet); anders houdt ze de nieuwe tegen. Het minimum per inhoud neemt het over.
    S.boodschappen = S.boodschappen.filter((b) => !(zelfde(b.naam, naam) && !b.afgevinkt && b.bron === 'minimum'
      && typeof b.minimum_maat === 'string' && !actief.has(b.minimum_maat)));
    for (const [m, groep] of taken) minimumTotaal(naam, c, m, groep);
    if (!vrij.size) return;
    const sleutels = new Set([...S.producten.filter((p) => zelfde(p.naam, naam) && vrij.has(maatVan(p)) && telt(p)).map(productSleutel),
      ...autoBoodschappen(naam).filter((b) => typeof b.minimum_maat !== 'string' && vrij.has(maatVan(b))).map(minimumSleutel)]);
    for (const sleutel of sleutels) minimumPerInhoud(naam, sleutel);
  }
  // Een geopende verpakking telt als opgebruikt: ze staat nog in je voorraad (om op te maken), maar telt niet mee voor het minimum.
  const telt = (p) => !p.geopend;
  // Dezelfde verpakking staat soms op twee plaatsen (bv. dille in de kruidenkast en in de witte kast), en dan heeft de ene
  // regel soms een inhoud en de andere niet. Een regel zonder inhoud telt mee bij het enige minimum van die grootte,
  // en heeft dat minimum zelf geen inhoud, dan tellen alle regels van die grootte (en eenheid) zonder eigen minimum mee.
  const sleutelMaat = (s) => (/^(klein|groot)\|/.exec(s) || [])[1] || '';
  function regelsVoorMinimum(naam, sleutel) {
    const maat = sleutelMaat(sleutel), leeg = metMaat(maat, '');
    const alle = S.producten.filter((p) => zelfde(p.naam, naam) && maatVan(p) === maat && telt(p));
    const eigen = alle.filter((p) => productSleutel(p) === sleutel);
    const actief = new Set(alle.filter((p) => p.minimum > 0).map(productSleutel));
    if (actief.size !== 1 || !actief.has(sleutel)) return eigen;
    // alleen in dezelfde eenheid (of omrekenbaar): een zak rijst à 5 kg telt niet als een pot
    const eenheid = eigen.find((p) => p.minimum > 0).eenheid;
    return [...eigen, ...alle.filter((p) => productSleutel(p) !== sleutel && (sleutel === leeg || productSleutel(p) === leeg)
      && omrekenen(1, p.eenheid, eenheid) !== null)];
  }
  function minimumPerInhoud(naam, sleutel) {
    const regels = regelsVoorMinimum(naam, sleutel);
    const auto = autoBoodschappen(naam).find((b) => typeof b.minimum_maat !== 'string' && minimumSleutel(b) === sleutel);
    const weg = () => { if (auto) S.boodschappen = S.boodschappen.filter((b) => b !== auto); };
    if (!regels.length) return weg();
    const hoofd = regels.reduce((a, b) => ((b.minimum || 0) > (a.minimum || 0) ? b : a));
    if (!(hoofd.minimum > 0)) return weg();
    const maat = maatVan(hoofd);
    // verpakkingen tellen per stuk (pot, stuks, zakje ... samen); gewicht en volume worden omgerekend
    const tel = (r) => omrekenen(r.hoeveelheid || 0, r.eenheid, hoofd.eenheid)
      ?? (TELBARE.has(r.eenheid || 'stuks') && TELBARE.has(hoofd.eenheid || 'stuks') ? r.hoeveelheid || 0 : 0);
    const totaal = regels.reduce((s, r) => s + tel(r), 0);
    if (totaal < hoofd.minimum) {
      const tekort = Math.round((hoofd.minimum - totaal) * 100) / 100;
      const groot = regels.find((r) => r.grootverpakking);
      if (groot) {
        // al op de lijst als grote verpakking: laten staan (het aantal pas je zelf aan)
        if (auto && auto.potten_voor) return;
        if (auto) S.boodschappen = S.boodschappen.filter((b) => b !== auto);
        else if (S.boodschappen.some((b) => zelfde(b.naam, naam) && !b.afgevinkt && (b.potten_voor === groot.id || boodschapSleutel(b) === sleutel))) return;
        S.boodschappen.push(grootBoodschap(groot, sleutel));
        return;
      }
      if (auto && auto.potten_voor) { auto.hoeveelheid = tekort; auto.minimum_tekort = tekort; auto.eenheid = hoofd.eenheid; delete auto.potten_voor; delete auto.inhoud; delete auto.inhoud_eenheid; Object.assign(auto, maatVeld(maat)); }
      else if (auto) { if (auto.eenheid !== hoofd.eenheid) delete auto.minimum_tekort; tekortZetten(auto, tekort); }
      else if (!S.boodschappen.some((b) => zelfde(b.naam, naam) && !b.afgevinkt && (boodschapSleutel(b) === sleutel || (b.bron === 'minimum' && minimumSleutel(b) === sleutel)))) {
        S.boodschappen.push({ id: id(), naam: hoofd.naam, hoeveelheid: tekort, eenheid: hoofd.eenheid, ...maatVeld(maat),
          minimum_sleutel: sleutel, minimum_tekort: tekort, product_id: hoofd.id, afgevinkt: 0, bron: 'minimum' });
      }
    } else weg();
  }
  /** Minimum voor het hele product (alle merken en inhouden samen) van grootte `m` ('' = algemeen), voor de voorraadregels met een grootte uit `groep`. */
  function minimumTotaal(naam, c, m, groep) {
    const minimum = c[catMinimumVeld(m)];
    const eenheid = c.eenheid || S.producten.find((p) => zelfde(p.naam, naam))?.eenheid || 'stuks';
    // verpakkingen tellen per stuk (blik, pot, pak ... samen); gewicht en volume worden omgerekend
    const tel = (p) => omrekenen(p.hoeveelheid || 0, p.eenheid || 'stuks', eenheid) ?? (TELBARE.has(p.eenheid || 'stuks') && TELBARE.has(eenheid) ? p.hoeveelheid || 0 : 0);
    const regels = S.producten.filter((p) => zelfde(p.naam, naam) && groep.includes(maatVan(p)) && telt(p));
    const totaal = regels.reduce((s, p) => s + tel(p), 0);
    // de automatische boodschappen van dit minimum (oudere: alles van deze groottes)
    const autos = autoBoodschappen(naam).filter((b) => (typeof b.minimum_maat === 'string' ? b.minimum_maat === m : groep.includes(maatVan(b))));
    const houden = totaal < minimum ? autos[0] : null;
    if (autos.length) S.boodschappen = S.boodschappen.filter((b) => !autos.includes(b) || b === houden);
    if (totaal >= minimum) return;
    const tekort = Math.round((minimum - totaal) * 100) / 100;
    // staat er zelf al iets van deze grootte op de lijst, dan niets bijzetten
    const alOpLijst = () => S.boodschappen.some((b) => zelfde(b.naam, naam) && !b.afgevinkt && b !== houden && groep.includes(maatVan(b)));
    const groot = regels.find((p) => p.grootverpakking);
    if (groot) {
      if (houden && houden.potten_voor) { houden.minimum_maat = m; return; }
      if (houden) S.boodschappen = S.boodschappen.filter((b) => b !== houden);
      else if (alOpLijst()) return;
      S.boodschappen.push({ ...grootBoodschap(groot), minimum_maat: m });
      return;
    }
    if (houden && (houden.potten_voor || houden.eenheid !== eenheid)) { delete houden.potten_voor; delete houden.inhoud; delete houden.inhoud_eenheid; delete houden.minimum_tekort; }
    if (houden) { tekortZetten(houden, tekort); houden.eenheid = eenheid; houden.minimum_maat = m; delete houden.verpakking; Object.assign(houden, maatVeld(m)); return; }
    if (alOpLijst()) return; // staat er zelf al op
    S.boodschappen.push({ id: id(), naam: c.naam, hoeveelheid: tekort, eenheid, ...maatVeld(m), minimum_maat: m, minimum_tekort: tekort,
      product_id: (regels[0] || S.producten.find((p) => zelfde(p.naam, naam)))?.id || null, afgevinkt: 0, bron: 'minimum' });
  }
  /** Minimum voor alle merken samen zetten (0: uit); maakt het catalogusproduct aan als het er nog niet is. */
  function catalogusMinimumZetten(naam, minimum, eenheid, maat = '') {
    if (minimum === undefined || !(naam || '').trim()) return;
    if (!S.catalogus.some((x) => zelfde(x.naam, naam))) catalogusBijwerken({ naam: naam.trim(), eenheid: eenheid || 'stuks' }, false);
    minimumInCatalogus(S.catalogus.find((x) => zelfde(x.naam, naam)), minimum, maat);
  }
  /**
   * Minimum voor het hele product zetten. Eén keuze per product: ofwel alle groottes samen (`maat` leeg), ofwel alleen
   * grote en/of kleine verpakkingen. Nooit allebei: een minimum voor alle groottes naast een minimum voor de grote
   * verpakkingen telde dubbel (bv. doperwten: 3 voor alles en 3 grote zette te veel op de lijst).
   */
  function minimumInCatalogus(c, minimum, maat = '') {
    const m = getal(minimum), mt = maatVan({ verpakking: maat }), veld = catMinimumVeld(mt);
    if (!(m > 0)) { delete c[veld]; return; }
    c[veld] = m;
    if (mt) delete c.minimum; else { delete c.minimum_klein; delete c.minimum_groot; }
  }
  /** Grootte waarvoor een minimum uit een formulier geldt: wat je koos bij "Wat telt mee", anders de grootte van de verpakking. */
  const minimumMaatUit = (data, veld, standaard) => (typeof data[veld] === 'string' ? maatVan({ verpakking: data[veld] }) : standaard);
  // Catalogus: elk product dat ooit werd toegevoegd, ook als het later op is of verwijderd werd
  // Varianten van een catalogusproduct: hetzelfde product met een ander merk en/of een andere inhoud
  // (bv. Rijst van Lassie à 1 kg en Rijst van Boni à 500 g). Categorie, plaats, prijzen ... gelden voor alle varianten.
  // Oudere gegevens zonder lijst: één variant uit merk en inhoud van het product zelf.
  const variantSleutel = (v) => `${String((v && v.merk) || '').trim().toLowerCase()}|${inhoudSleutel(v)}${maatVan(v) ? `|${maatVan(v)}` : ''}`;
  function variantenVan(c) {
    if (Array.isArray(c.varianten) && c.varianten.length) return c.varianten;
    return [{ merk: c.merk || '', inhoud: c.inhoud > 0 ? c.inhoud : null, inhoud_eenheid: c.inhoud > 0 ? c.inhoud_eenheid || '' : '', uitlekgewicht: !!c.uitlekgewicht, ...maatVeld(maatVan(c)) }];
  }
  const variantUit = (x) => {
    const i = getal(x.inhoud);
    return { merk: String(x.merk || '').trim(), inhoud: i > 0 ? i : null, inhoud_eenheid: i > 0 ? x.inhoud_eenheid || '' : '', uitlekgewicht: !!x.uitlekgewicht, ...maatVeld(maatVan(x)) };
  };
  /** Variant v bewaren (in de plaats van `oud`, als die gegeven is); ze wordt ook de standaard van het product. */
  function variantBewaren(c, v, oud = null, lijst = Array.isArray(c.varianten) ? c.varianten : variantenVan(c)) {
    lijst = lijst.map((x) => ({ ...x }));
    if (oud) lijst = lijst.filter((x) => variantSleutel(x) !== variantSleutel(oud));
    const bestaand = lijst.find((x) => variantSleutel(x) === variantSleutel(v));
    if (bestaand) { delete bestaand.verpakking; Object.assign(bestaand, v); } else lijst.push({ ...v });
    c.varianten = lijst;
    Object.assign(c, { merk: v.merk, inhoud: v.inhoud, inhoud_eenheid: v.inhoud_eenheid, uitlekgewicht: v.uitlekgewicht });
    delete c.verpakking; Object.assign(c, maatVeld(maatVan(v)));
  }
  function catalogusBijwerken(p, teller = true, oudeNaam = null, oudeVariant = null) {
    const naam = (p.naam || '').trim();
    if (!naam) return;
    let c = S.catalogus.find((x) => zelfde(x.naam, naam));
    if (!c && oudeNaam && !zelfde(oudeNaam, naam)) {
      c = S.catalogus.find((x) => zelfde(x.naam, oudeNaam));
      if (c && S.producten.some((x) => x !== p && zelfde(x.naam, oudeNaam))) c = null; // oude naam nog in gebruik
    }
    if (!c) { c = { naam, aantal: 0, eerst: nu(), varianten: [] }; S.catalogus.push(c); }
    c.naam = naam;
    for (const k of ['eenheid', 'categorie', 'locatie', 'datumtype', 'barcode']) if (p[k]) c[k] = p[k];
    if (p.hoeveelheid > 0) c.hoeveelheid = p.hoeveelheid;
    if ('inhoud' in p || 'merk' in p || 'verpakking' in p) {
      // elk merk, elke inhoud en elke grootte die je ooit had, blijft als variant in de catalogus staan
      const v = variantUit({ merk: 'merk' in p ? p.merk : c.merk, inhoud: 'inhoud' in p ? p.inhoud : c.inhoud,
        inhoud_eenheid: 'inhoud' in p ? p.inhoud_eenheid : c.inhoud_eenheid, uitlekgewicht: 'uitlekgewicht' in p ? p.uitlekgewicht : c.uitlekgewicht,
        verpakking: 'verpakking' in p ? p.verpakking : c.verpakking });
      // Alleen de grootte van een voorraadregel veranderd (bv. van "niet opgegeven" naar klein): dat is een verbetering,
      // geen ander product. De oude variant vervangen als geen andere voorraadregel ze nog heeft; anders blijft er een
      // variant zonder grootte staan die je niet (meer) koopt, en blijft een oud minimum daarvoor gelden.
      const zonderMaat = (x) => variantSleutel({ ...x, verpakking: '' });
      const vervang = oudeVariant && variantSleutel(oudeVariant) !== variantSleutel(v) && zonderMaat(oudeVariant) === zonderMaat(v)
        && !S.producten.some((x) => x !== p && zelfde(x.naam, naam) && variantSleutel(variantUit(x)) === variantSleutel(oudeVariant));
      variantBewaren(c, v, vervang ? oudeVariant : null);
    } else if ('uitlekgewicht' in p) c.uitlekgewicht = !!p.uitlekgewicht;
    if (teller) c.aantal = (c.aantal || 0) + 1;
    c.laatst = nu();
  }
  // prijzen van een product (per naam, in de catalogus) vervangen.
  // Met `voor` ({ merk, inhoud, inhoud_eenheid }, of null voor zonder merk en inhoud) alleen de prijzen van dat merk en die inhoud.
  function prijzenZetten(naam, prijzen, eenheid, voor) {
    naam = (naam || '').trim();
    if (!naam) return;
    let c = S.catalogus.find((x) => zelfde(x.naam, naam));
    if (!c) { catalogusBijwerken({ naam, eenheid: eenheid || '' }, false); c = S.catalogus.find((x) => zelfde(x.naam, naam)); }
    if (voor === undefined) c.prijzen = prijzenLijst(prijzen);
    else {
      const sleutel = prijsSleutel(voor), groep = prijsGroep(voor);
      const v = { merk: prijsMerk(voor), ...(sleutel ? { inhoud: getal(voor.inhoud), inhoud_eenheid: voor.inhoud_eenheid } : { inhoud: null, inhoud_eenheid: '' }) };
      c.prijzen = prijzenLijst([...(c.prijzen || []).filter((p) => prijsGroep(p) !== groep), ...prijzen.map((p) => ({ ...p, ...v }))]);
    }
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
  const VELDEN = ['naam', 'categorie', 'hoeveelheid', 'eenheid', 'locatie', 'aankoopdatum', 'vervaldatum', 'datumtype', 'minimum', 'notitie', 'barcode', 'inhoud', 'inhoud_eenheid', 'uitlekgewicht', 'merk', 'verpakking'];

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
    if (eigen) return { code, gevonden: true, naam: eigen.naam, merk: eigen.merk || '', categorie: eigen.categorie, hoeveelheid: eigen.hoeveelheid,
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
    const kol = ['naam', 'merk', 'hoeveelheid', 'eenheid', 'inhoud', 'inhoud_eenheid', 'locatie', 'categorie', 'vervaldatum', 'datumtype', 'minimum', 'aankoopdatum', 'notitie', 'barcode', 'uitlekgewicht'];
    const cel = (v) => { const t = v == null ? '' : String(v); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const regels = [kol.join(';'), ...alles().producten.map((p) => kol.map((k) => cel(k === 'hoeveelheid' || k === 'minimum' || k === 'inhoud' ? String(p[k] ?? '').replace('.', ',') : k === 'uitlekgewicht' ? (p[k] ? 'ja' : '') : p[k])).join(';'))];
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
      minimumBoodschappenNakijken(); // back-up van een oudere versie: verkeerde minimum-boodschappen weg
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
      if (data.veld === 'eenheid') {
        // eigen eenheid hernoemd (bv. bokaal → bokaal glas): overal mee aanpassen
        const van = data.van, naar = data.naar;
        if (!van || !naar) return alles();
        for (const x of [...S.producten, ...S.boodschappen, ...S.catalogus]) {
          if (x.eenheid === van) x.eenheid = naar;
          if (x.grootverpakking && x.grootverpakking.eenheid === van) x.grootverpakking.eenheid = naar;
        }
        for (const c of S.catalogus) for (const pr of c.prijzen || []) if (pr.per === van) pr.per = naar;
        for (const r of S.recepten) for (const i of r.ingredienten || []) if (i.eenheid === van) i.eenheid = naar;
        return alles();
      }
      if (data.veld === 'inhoud_eenheid') {
        // eigen eenheid voor de inhoud hernoemd (bv. vel → vellen): overal mee aanpassen
        const van = data.van, naar = data.naar;
        if (!van || !naar) return alles();
        const pas = (x) => { if (x && x.inhoud_eenheid === van) x.inhoud_eenheid = naar; };
        for (const x of [...S.producten, ...S.boodschappen, ...S.catalogus]) {
          pas(x); pas(x.grootverpakking);
          for (const v of Array.isArray(x.varianten) ? x.varianten : []) pas(v);
        }
        for (const c of S.catalogus) for (const pr of c.prijzen || []) { pas(pr); if (pr.per === van) pr.per = naar; }
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

    if (bron === 'prijzen') { prijzenZetten(data.naam, data.prijzen, data.eenheid, data.prijzen_inhoud); return alles(); }
    if (bron === 'catalogus' && methode === 'DELETE') {
      // met `variant`: alleen dat merk en die inhoud weghalen (zolang er nog andere zijn)
      const c = S.catalogus.find((x) => zelfde(x.naam, data && data.naam));
      const rest = c && data.variant ? variantenVan(c).filter((x) => variantSleutel(x) !== variantSleutel(variantUit(data.variant))) : [];
      if (c && rest.length) variantBewaren(c, rest[0], null, rest);
      else S.catalogus = S.catalogus.filter((x) => x !== c);
      if (c) minimumControleren(c.naam);
      return alles();
    }
    // Catalogus: zelf een product toevoegen (POST) of bewerken (PUT, met oudeNaam), los van je voorraad
    if (bron === 'catalogus' && (methode === 'POST' || methode === 'PUT')) {
      const naam = ((data && data.naam) || '').trim();
      if (!naam) fout(400, 'Vul een naam in.');
      const oudeNaam = methode === 'PUT' ? ((data && data.oudeNaam) || '').trim() : '';
      // Hetzelfde product mag meermaals in de catalogus, met een ander merk en/of een andere inhoud (een variant).
      const v = variantUit(data), oud = methode === 'PUT' && data.oudeVariant ? variantUit(data.oudeVariant) : null;
      let c = S.catalogus.find((x) => zelfde(x.naam, methode === 'PUT' ? oudeNaam : naam)) || null;
      if (methode === 'PUT' && !c) fout(404, 'Dit product staat niet (meer) in de catalogus.');
      const al = c && (methode === 'POST' || !oud || variantSleutel(oud) !== variantSleutel(v)) && variantenVan(c).some((x) => variantSleutel(x) === variantSleutel(v));
      if (al) fout(409, `${naam}${v.merk ? ` van ${v.merk}` : ''}${v.inhoud ? ` à ${String(v.inhoud).replace('.', ',')} ${v.inhoud_eenheid}` : ''}${maatVan(v) ? ` (${maatVan(v)}e verpakking)` : ''} staat al in de catalogus.`);
      if (S.catalogus.some((x) => x !== c && zelfde(x.naam, naam))) fout(409, `${naam} staat al in de catalogus.`);
      const nieuwProduct = !c;
      if (!c) { c = { naam, aantal: 0, eerst: nu(), varianten: [] }; S.catalogus.push(c); }
      if (oudeNaam && !zelfde(oudeNaam, naam)) {
        // nieuwe naam: ook in je voorraad, op je boodschappenlijst en bij de barcodes
        for (const p of S.producten) if (zelfde(p.naam, oudeNaam)) p.naam = naam;
        for (const b of S.boodschappen) if (zelfde(b.naam, oudeNaam)) b.naam = naam;
        for (const b of Object.values(S.barcodes)) if (b && zelfde(b.naam, oudeNaam)) b.naam = naam;
      }
      if (methode === 'PUT' || nieuwProduct) c.naam = naam; // een nieuwe variant houdt de naam van het product
      // een nieuwe variant van een gekend product houdt de eenheid van dat product
      for (const k of ['eenheid', 'categorie', 'locatie', 'datumtype']) if (k in data && !(k === 'eenheid' && methode === 'POST' && !nieuwProduct)) c[k] = (data[k] || '').trim();
      if ('hoeveelheid' in data) { const h = getal(data.hoeveelheid); if (h > 0) c.hoeveelheid = h; }
      // minimum voor het hele product: alle merken en inhouden samen (van de gekozen grootte: klein, groot of alle)
      if ('minimum' in data) minimumInCatalogus(c, data.minimum, minimumMaatUit(data, 'minimum_maat', maatVan(data)));
      if ('grootverpakking' in data) grootZetten(c.naam, grootUit(data.grootverpakking));
      if ('inhoud' in data || 'merk' in data || 'verpakking' in data) {
        variantBewaren(c, v, oud);
        // alleen de grootte veranderd (bv. van "niet opgegeven" naar groot): je voorraadregels van die variant volgen,
        // anders tellen ze niet mee voor het minimum van die grootte
        const zonderMaat = (x) => variantSleutel({ ...x, verpakking: '' });
        if (oud && variantSleutel(oud) !== variantSleutel(v) && zonderMaat(oud) === zonderMaat(v)) {
          for (const p of S.producten) if (zelfde(p.naam, c.naam) && variantSleutel(variantUit(p)) === variantSleutel(oud)) { delete p.verpakking; Object.assign(p, maatVeld(maatVan(v))); }
        }
      }
      else if ('uitlekgewicht' in data) c.uitlekgewicht = !!data.uitlekgewicht;
      c.laatst = nu();
      if (Array.isArray(data.prijzen)) prijzenZetten(naam, data.prijzen, c.eenheid, data.prijzen_inhoud);
      minimumControleren(c.naam);
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
        p.uitlekgewicht = !!p.uitlekgewicht; p.merk = String(p.merk || '').trim();
        delete p.verpakking; Object.assign(p, maatVeld(maatVan(data)));
        const g = grootUit(data.grootverpakking); if (g) p.grootverpakking = g;
        if (data.geopend && /^\d{4}-\d{2}-\d{2}$/.test(data.geopend)) p.geopend = data.geopend; // ongedaan maken van een geopende verpakking
        S.producten.push(p);
        catalogusBijwerken(p);
        // grote verpakking: meegegeven (ook null = uit) geldt voor het hele product; anders die uit de catalogus of van een andere voorraadregel
        if ('grootverpakking' in data) grootZetten(p.naam, g);
        else {
          const bekend = S.catalogus.find((x) => zelfde(x.naam, p.naam))?.grootverpakking || S.producten.find((x) => x !== p && zelfde(x.naam, p.naam) && x.grootverpakking)?.grootverpakking;
          if (bekend) grootZetten(p.naam, bekend);
        }
        if (Array.isArray(data.prijzen)) prijzenZetten(p.naam, data.prijzen, p.eenheid, data.prijzen_inhoud);
        if (p.barcode) S.barcodes[p.barcode] = { naam: p.naam, merk: p.merk || '', categorie: p.categorie, hoeveelheid: p.hoeveelheid, eenheid: p.eenheid, datumtype: p.datumtype, locatie: p.locatie };
        catalogusMinimumZetten(p.naam, data.catalogus_minimum, p.eenheid, minimumMaatUit(data, 'catalogus_minimum_maat', maatVan(p)));
        minimumControleren(p.naam);
        return alles();
      }
      const p = S.producten.find((x) => x.id === ident);
      if (!p) fout(404, 'Dit product bestaat niet (meer).');
      if (methode === 'PUT') {
        const oudeNaam = p.naam, oudeVariant = variantUit(p);
        for (const k of VELDEN) if (k in data) p[k] = data[k];
        if ('hoeveelheid' in data) p.hoeveelheid = getal(data.hoeveelheid) || 0;
        if ('minimum' in data) p.minimum = getal(data.minimum) || 0;
        if ('inhoud' in data) { p.inhoud = getal(data.inhoud) || null; if (!p.inhoud) p.inhoud_eenheid = ''; }
        if ('uitlekgewicht' in data) p.uitlekgewicht = !!data.uitlekgewicht;
        if ('merk' in data) p.merk = String(data.merk || '').trim();
        if ('verpakking' in data) { delete p.verpakking; Object.assign(p, maatVeld(maatVan(data))); }
        if ('grootverpakking' in data) { const g = grootUit(data.grootverpakking); if (g) p.grootverpakking = g; else delete p.grootverpakking; }
        p.gewijzigd = nu();
        if (VELDEN.some((k) => k !== 'hoeveelheid' && k in data)) catalogusBijwerken(p, false, oudeNaam, zelfde(oudeNaam, p.naam) ? oudeVariant : null);
        if ('grootverpakking' in data) grootZetten(p.naam, p.grootverpakking || null);
        if (Array.isArray(data.prijzen)) prijzenZetten(p.naam, data.prijzen, p.eenheid, data.prijzen_inhoud);
        if (p.barcode) S.barcodes[p.barcode] = { naam: p.naam, merk: p.merk || '', categorie: p.categorie, hoeveelheid: p.hoeveelheid || 1, eenheid: p.eenheid, datumtype: p.datumtype, locatie: p.locatie };
        catalogusMinimumZetten(p.naam, data.catalogus_minimum, p.eenheid, minimumMaatUit(data, 'catalogus_minimum_maat', maatVan(p)));
        minimumControleren(oudeNaam); minimumControleren(p.naam);
        return alles();
      }
      // Geopend: `hoeveelheid` verpakkingen (telbaar, standaard 1) of alles (gewicht, volume) gaan naar een aparte regel
      // met `geopend` = datum. Die telt als opgebruikt: ze gaat van je voorraad af en telt niet mee voor het minimum.
      // De oorspronkelijke regel blijft (ook op 0) als ze een minimum heeft; anders verdwijnt ze als ze leeg is.
      if (methode === 'POST' && actie === 'openen') {
        if (p.geopend) fout(400, 'Dit is al geopend.');
        if (!(p.hoeveelheid > 0)) fout(400, 'Hiervan is niets meer in huis.');
        const n = TELBARE.has(p.eenheid) ? Math.min(p.hoeveelheid, getal(data.hoeveelheid) > 0 ? getal(data.hoeveelheid) : 1) : p.hoeveelheid;
        const open = { ...JSON.parse(JSON.stringify(p)), id: id(), hoeveelheid: n, minimum: 0, geopend: vandaag(), gesloten_id: p.id, aangemaakt: nu(), gewijzigd: nu() };
        p.hoeveelheid = Math.max(0, Math.round((p.hoeveelheid - n) * 1000) / 1000); p.gewijzigd = nu();
        S.producten.push(open);
        if (p.hoeveelheid === 0 && !p.minimum) S.producten = S.producten.filter((x) => x !== p);
        gebeurtenis('geopend', p.naam);
        minimumControleren(p.naam);
        return { ...alles(), nieuw_id: open.id };
      }
      // Toch niet geopend: terug bij de ongeopende regel (dezelfde, of een met hetzelfde merk, dezelfde inhoud, grootte en datum)
      if (methode === 'POST' && actie === 'sluiten') {
        if (!p.geopend) return alles();
        const doel = S.producten.find((x) => x.id === p.gesloten_id && !x.geopend)
          || S.producten.find((x) => x !== p && !x.geopend && zelfde(x.naam, p.naam) && zelfde(x.merk, p.merk) && x.eenheid === p.eenheid
            && productSleutel(x) === productSleutel(p) && (x.vervaldatum || '') === (p.vervaldatum || ''));
        if (doel) {
          doel.hoeveelheid = Math.round(((doel.hoeveelheid || 0) + (p.hoeveelheid || 0)) * 1000) / 1000; doel.gewijzigd = nu();
          S.producten = S.producten.filter((x) => x !== p);
        } else { delete p.geopend; delete p.gesloten_id; p.gewijzigd = nu(); }
        minimumControleren(p.naam);
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
          // grote verpakking die je thuis over potten verdeelde: de potten bijtellen bij die voorraadregel
          const potten = getal(item.potten), doel = b.potten_voor != null && S.producten.find((p) => p.id === b.potten_voor);
          if (doel && potten > 0) {
            doel.hoeveelheid = Math.round(((doel.hoeveelheid || 0) + potten) * 1000) / 1000;
            if (item.vervaldatum) { doel.vervaldatum = item.vervaldatum; doel.datumtype = item.datumtype; }
            if (item.locatie) doel.locatie = item.locatie;
            doel.aankoopdatum = vandaag(); doel.gewijzigd = nu();
            gebeurtenis('gekocht', b.naam);
            S.boodschappen = S.boodschappen.filter((x) => x !== b);
            minimumControleren(b.naam);
            continue;
          }
          // stond er geen merk of inhoud op de lijst, dan kies je bij het afronden welk merk en welke inhoud je kocht
          const gekozen = item.variant && typeof item.variant === 'object' ? variantUit(item.variant) : null;
          const merk = gekozen ? gekozen.merk : String(b.merk || '').trim();
          const inh = gekozen ? boodschapInhoud(item.eenheid, gekozen.inhoud, gekozen.inhoud_eenheid) : boodschapInhoud(item.eenheid, b.inhoud, b.inhoud_eenheid);
          // kleine of grote verpakking: zoals gekozen bij het afronden, anders zoals op de lijst
          const maat = 'verpakking' in item ? maatVan(item) : gekozen && maatVan(gekozen) ? maatVan(gekozen) : maatVan(b);
          // alleen bijtellen bij een voorraadregel met hetzelfde merk, dezelfde inhoud en dezelfde grootte (ook: allebei zonder);
          // nooit vanzelf een merk of inhoud overnemen die je niet koos
          const bestaand = S.producten.find((p) => zelfde(p.naam, b.naam) && !p.geopend && omrekenen(1, item.eenheid, p.eenheid) !== null
            && productSleutel(p) === metMaat(maat, inhoudSleutel(inh)) && zelfde(p.merk, merk)
            && (!item.vervaldatum || p.vervaldatum === item.vervaldatum || !p.hoeveelheid));
          if (bestaand) {
            bestaand.hoeveelheid = Math.round((bestaand.hoeveelheid + omrekenen(h, item.eenheid, bestaand.eenheid)) * 1000) / 1000;
            if (item.vervaldatum) { bestaand.vervaldatum = item.vervaldatum; bestaand.datumtype = item.datumtype; }
            if (item.locatie) bestaand.locatie = item.locatie;
            bestaand.aankoopdatum = vandaag(); bestaand.gewijzigd = nu();
            catalogusBijwerken(bestaand);
          } else {
            const voorbeeld = S.producten.find((p) => zelfde(p.naam, b.naam));
            S.producten.push({ uitlekgewicht: gekozen ? gekozen.uitlekgewicht : false, merk, id: id(), naam: b.naam, categorie: voorbeeld?.categorie || '', hoeveelheid: h, eenheid: item.eenheid,
              locatie: item.locatie || voorbeeld?.locatie || '', aankoopdatum: vandaag(), vervaldatum: item.vervaldatum || '',
              datumtype: item.datumtype || 'THT', minimum: 0, notitie: '', barcode: voorbeeld?.barcode || '', aangemaakt: nu(), gewijzigd: nu(),
              ...(inh.inhoud ? inh : { inhoud: null, inhoud_eenheid: '' }), ...maatVeld(maat) });
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
          const h = getal(item.hoeveelheid);
          const inh = boodschapInhoud(item.eenheid, item.inhoud, item.inhoud_eenheid);
          // Hetzelfde product mag meermaals op de lijst, met een andere inhoud (bv. 2 pak à 500 g en 1 pak à 1 kg).
          // Alleen samentellen met een regel met dezelfde inhoud en een eenheid die om te rekenen is.
          // en alleen met dezelfde grootte: een kleine en een grote verpakking blijven aparte boodschappen
          const bestaand = S.boodschappen.find((b) => zelfde(b.naam, naam) && !b.afgevinkt && maatVan(b) === maatVan(item)
            && inhoudSleutel(b) === inhoudSleutel(inh) && (h === null || b.hoeveelheid === null || omrekenen(h, item.eenheid, b.eenheid) !== null));
          const merk = String(item.merk || '').trim();
          if (bestaand) {
            if (merk && !bestaand.merk) bestaand.merk = merk;
            if (item.potten_voor != null && bestaand.potten_voor == null && S.producten.some((p) => p.id === +item.potten_voor)) bestaand.potten_voor = +item.potten_voor;
            const erbij = omrekenen(h, item.eenheid, bestaand.eenheid);
            if (h !== null && bestaand.hoeveelheid !== null && erbij !== null) bestaand.hoeveelheid = Math.round((bestaand.hoeveelheid + erbij) * 100) / 100;
            continue;
          }
          // grote verpakking voor een product dat je thuis over potten verdeelt
          const voor = item.potten_voor != null && S.producten.find((p) => p.id === +item.potten_voor) ? { potten_voor: +item.potten_voor } : {};
          S.boodschappen.push({ id: id(), naam, hoeveelheid: h, eenheid: item.eenheid || '', ...inh, ...maatVeld(maatVan(item)), ...(merk ? { merk } : {}), ...voor, product_id: item.product_id || null, afgevinkt: 0, bron: item.bron || 'handmatig' });
        }
        // minimum voor alle merken samen, aangezet bij het toevoegen van een boodschap
        for (const item of data.items || [data]) if ('catalogus_minimum' in item && (item.naam || '').trim()) {
          catalogusMinimumZetten(item.naam, item.catalogus_minimum, item.eenheid, minimumMaatUit(item, 'catalogus_minimum_maat', maatVan(item)));
          minimumControleren(item.naam);
        }
        return alles();
      }
      const b = S.boodschappen.find((x) => x.id === ident);
      if (b && methode === 'PUT') {
        if ('afgevinkt' in data) b.afgevinkt = data.afgevinkt ? 1 : 0;
        if ('hoeveelheid' in data) b.hoeveelheid = getal(data.hoeveelheid);
        if ('eenheid' in data && (data.eenheid || '') !== b.eenheid) delete b.minimum_tekort; // andere eenheid: tekort telt niet meer zo
        if ('eenheid' in data) b.eenheid = data.eenheid || '';
        // een automatische boodschap gaat niet onder het tekort: het minimum blijft gerespecteerd
        if (b.bron === 'minimum' && !b.afgevinkt && b.minimum_tekort > 0 && b.hoeveelheid !== null && b.hoeveelheid < b.minimum_tekort) b.hoeveelheid = b.minimum_tekort;
        if ('merk' in data) b.merk = String(data.merk || '').trim();
        if ('verpakking' in data && maatVan(data) !== maatVan(b)) {
          delete b.verpakking; Object.assign(b, maatVeld(maatVan(data)));
          if (b.bron === 'minimum') b.bron = 'handmatig'; // zelf een andere grootte gekozen: niet meer vanzelf aanpassen
        }
        if ('inhoud' in data || 'eenheid' in data) {
          const inh = boodschapInhoud(b.eenheid, 'inhoud' in data ? data.inhoud : b.inhoud, 'inhoud' in data ? data.inhoud_eenheid : b.inhoud_eenheid);
          delete b.inhoud; delete b.inhoud_eenheid; Object.assign(b, inh);
        }
        if ('naam' in data && String(data.naam || '').trim() && !zelfde(data.naam, b.naam)) {
          b.naam = String(data.naam).trim();
          b.product_id = S.producten.find((p) => zelfde(p.naam, b.naam))?.id || null;
          if (b.bron === 'minimum') b.bron = 'handmatig'; // zelf hernoemd: niet meer vanzelf weghalen
          delete b.potten_voor;
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
          hoeveelheid: getal(i.hoeveelheid), eenheid: i.eenheid || '', naam: i.naam, voorraadnaam: i.voorraadnaam || '', ...(i.geenKoppeling ? { geenKoppeling: true } : {}) }));
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
  const idb = (sleutel, waarde, wissen) => opslag(waarde === undefined && !wissen ? 'readonly' : 'readwrite',
    (st) => (wissen ? st.delete(sleutel) : waarde === undefined ? st.get(sleutel) : st.put(waarde, sleutel)));
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

  // ------------------------------------------------------------------ synchroniseren tussen toestellen
  // Zoals bij DuckDuckGo: een willekeurige koppelcode (160 bits) is het enige geheim. Daaruit worden op het toestel
  // afgeleid: het nummer van de "ruimte" op de server, een schrijftoken en de sleutel om te versleutelen (AES-GCM).
  // De server (sync-server/worker.mjs, op Cloudflare) krijgt alleen versleutelde bytes en kent de code niet.
  // Andere toestellen koppelen met dezelfde code (typen, of de QR-code/link scannen).
  // Bij elke wijziging (en bij het openen, en elke halve minuut zolang de app open staat) wordt opgehaald wat
  // nieuw is op de server, samengevoegd met dit toestel (samenvoegen.js) en het resultaat terug bewaard.
  const SYNC_SLEUTEL = 'sync';
  const ALFABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: geen I, L, O, U (niet te verwarren)
  const M = window.voorraadSamenvoegen;
  let Z = null; // { adres, code, versie, basis, laatst, fout } — staat alleen op dit toestel (IndexedDB)
  let K = null; // sleutels afgeleid van Z.code
  let syncTimer = null, syncKetting = Promise.resolve(), syncBezig = false, voorstel = null;
  function syncAan() { return !!(Z && K); }
  const enc = (t) => new TextEncoder().encode(t);
  const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const b64url = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  function naarCode(bytes) {
    let bits = 0, w = 0, uit = '';
    for (const x of bytes) { w = ((w << 8) | x) & 0xffff; bits += 8; while (bits >= 5) { uit += ALFABET[(w >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits) uit += ALFABET[(w << (5 - bits)) & 31];
    return uit;
  }
  /** Code zoals getypt (met of zonder streepjes, kleine letters, O voor 0 …) → 20 bytes, of null als ze niet klopt. */
  function codeBytes(tekst) {
    const t = String(tekst || '').toUpperCase().replace(/[\s\-–.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (t.length !== 32 || [...t].some((c) => !ALFABET.includes(c))) return null;
    const uit = new Uint8Array(20);
    let bits = 0, w = 0, i = 0;
    for (const c of t) { w = ((w << 5) | ALFABET.indexOf(c)) & 0xffff; bits += 5; if (bits >= 8) { uit[i++] = (w >>> (bits - 8)) & 255; bits -= 8; } }
    return uit;
  }
  const codeNetjes = (bytes) => naarCode(bytes).match(/.{4}/g).join('-');
  async function sleutelsMaken(bytes) {
    const basis = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveBits', 'deriveKey']);
    const hkdf = (info) => ({ name: 'HKDF', hash: 'SHA-256', salt: enc('voorraadbeheer-sync-v1'), info: enc(info) });
    return {
      ruimte: hex(await crypto.subtle.deriveBits(hkdf('ruimte'), basis, 128)),
      token: b64url(await crypto.subtle.deriveBits(hkdf('schrijven'), basis, 256)),
      aes: await crypto.subtle.deriveKey(hkdf('versleutelen'), basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    };
  }
  const zip = async (bytes, in_) => new Uint8Array(await new Response(new Blob([bytes]).stream()
    .pipeThrough(in_ ? new CompressionStream('gzip') : new DecompressionStream('gzip'))).arrayBuffer());
  // pakket: 'V', formaat 1, gecomprimeerd (0/1), 12 bytes iv, versleutelde gegevens
  async function versleutelen(gegevens, k) {
    let ruw = enc(JSON.stringify(gegevens)), gz = 0;
    if (typeof CompressionStream === 'function') { ruw = await zip(ruw, true); gz = 1; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const geheim = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc(k.ruimte) }, k.aes, ruw));
    const uit = new Uint8Array(15 + geheim.length);
    uit.set([86, 1, gz]); uit.set(iv, 3); uit.set(geheim, 15);
    return uit;
  }
  async function ontsleutelen(buffer, k) {
    const b = new Uint8Array(buffer);
    if (b[0] !== 86 || b[1] !== 1) throw Object.assign(new Error('Dit pakket op de server is niet van Voorraad, of van een nieuwere versie van de app. Werk de app bij.'), { syncFout: true });
    let ruw;
    try { ruw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(3, 15), additionalData: enc(k.ruimte) }, k.aes, b.slice(15))); } catch {
      throw Object.assign(new Error('De gegevens op de server konden niet ontsleuteld worden. Klopt de code?'), { syncFout: true });
    }
    if (b[2] === 1) ruw = await zip(ruw, false);
    return JSON.parse(new TextDecoder().decode(ruw));
  }
  const adresNetjes = (a) => {
    let t = String(a || '').trim().replace(/\/+$/, '');
    if (t && !/^https?:\/\//i.test(t)) t = 'https://' + t;
    return t;
  };
  async function server(adres, k, methode, { versie = 0, nieuw = false, body } = {}) {
    const h = {};
    if (methode !== 'GET') h.Authorization = 'Bearer ' + k.token;
    if (methode === 'GET' && versie) h['If-None-Match'] = `"${versie}"`;
    if (methode === 'PUT') { h['Content-Type'] = 'application/octet-stream'; if (nieuw) h['If-None-Match'] = '*'; else h['If-Match'] = `"${versie}"`; }
    let r;
    // zonder antwoord binnen 30 s opgeven (op een gsm met slecht bereik hing de synchronisatie anders lang vast)
    const stop = new AbortController(), klok = setTimeout(() => stop.abort(), 30000);
    try { r = await echteFetch(`${adres}/r/${k.ruimte}`, { method: methode, headers: h, body, cache: 'no-store', signal: stop.signal }); } catch {
      clearTimeout(klok);
      throw Object.assign(new Error(navigator.onLine ? 'De synchronisatieserver is niet bereikbaar.' : 'Geen internet.'), { netwerk: true });
    }
    clearTimeout(klok);
    const et = r.headers.get('ETag');
    return { status: r.status, versie: et ? +et.replace(/\D/g, '') : 0, r };
  }
  // wat gesynchroniseerd wordt: alles behalve wat per toestel is
  function syncDeel(d) {
    const uit = JSON.parse(JSON.stringify(d));
    delete uit.laatste_backup;
    if (uit.instellingen) delete uit.instellingen.auto_backup;
    return uit;
  }
  /** Samengevoegde gegevens in gebruik nemen (met wat per toestel is) en opschonen. */
  function inGebruik(m) {
    const d = JSON.parse(JSON.stringify(m));
    if (S.laatste_backup) d.laatste_backup = S.laatste_backup;
    d.instellingen = d.instellingen || {};
    if (typeof S.instellingen.auto_backup === 'boolean') d.instellingen.auto_backup = S.instellingen.auto_backup;
    S = normaliseren(d);
    regelGroottesHerstellen();
    // beide toestellen zagen dat iets bijna op was en zetten het op de lijst: één keer houden
    const gezien = new Set();
    S.boodschappen = S.boodschappen.filter((b) => {
      if (b.bron !== 'minimum' || b.afgevinkt) return true;
      const k = (b.naam || '').trim().toLowerCase() + '|' + boodschapSleutel(b);
      if (gezien.has(k)) return false;
      gezien.add(k); return true;
    });
    for (const n of new Set([...S.producten.filter((p) => p.minimum > 0).map((p) => p.naam), ...S.catalogus.filter((c) => MATEN.some((m) => c[catMinimumVeld(m)] > 0)).map((c) => c.naam)])) minimumControleren(n);
  }
  /** Na het laden: de automatische boodschappen (minimum) opnieuw nakijken, zodat een verkeerde van een oudere versie
   *  vanzelf verdwijnt. Alleen producten die al zo'n boodschap hebben: wat je zelf van de lijst haalde, komt niet terug. */
  /**
   * Een voorraadregel zonder grootte waarvan de variant in de catalogus intussen een grootte kreeg (bv. Everyday à 320 g
   * werd in de catalogus "groot"): de regel krijgt die grootte ook, anders telt ze niet mee voor het minimum van die grootte.
   * Alleen als de catalogus die variant niet meer zonder grootte heeft en er precies één grootte voor is. Geeft de namen terug.
   */
  function regelGroottesHerstellen() {
    const namen = new Set();
    const zonderMaat = (x) => variantSleutel({ ...x, verpakking: '' });
    for (const p of S.producten) {
      const c = S.catalogus.find((x) => zelfde(x.naam, p.naam));
      if (!c || maatVan(p)) continue;
      const vs = variantenVan(c);
      if (vs.some((v) => variantSleutel(v) === variantSleutel(variantUit(p)))) continue; // de variant bestaat: niets te doen
      // zelfde merk en inhoud, alleen de grootte ontbreekt
      // (een regel zonder merk of met een andere inhoud blijft zoals ze is: die gegevens vul je zelf aan)
      const k = zonderMaat(variantUit(p)), zelfdeMI = vs.filter((v) => zonderMaat(v) === k);
      const maten = new Set(zelfdeMI.map(maatVan));
      if (zelfdeMI.length && maten.size === 1 && !maten.has('')) { p.verpakking = [...maten][0]; namen.add(p.naam); }
    }
    // dubbel minimum van vroeger: een minimum voor alle groottes naast een (later gezet) minimum voor grote en/of kleine
    // verpakkingen. Het minimum per grootte geldt; het oude voor alle groottes vervalt (zie minimumInCatalogus).
    for (const c of S.catalogus) if (c.minimum > 0 && (c.minimum_klein > 0 || c.minimum_groot > 0)) { delete c.minimum; namen.add(c.naam); }
    return namen;
  }
  function minimumBoodschappenNakijken() {
    // overblijfsel van een oudere versie: een variant zonder grootte naast dezelfde (merk en inhoud) mét grootte,
    // terwijl geen enkele voorraadregel nog zonder grootte is: dat was een verbetering van de grootte, geen ander product
    for (const c of S.catalogus) {
      if (!Array.isArray(c.varianten) || c.varianten.length < 2) continue;
      const zonderMaat = (x) => variantSleutel({ ...x, verpakking: '' });
      c.varianten = c.varianten.filter((v) => maatVan(v) || !c.varianten.some((w) => maatVan(w) && zonderMaat(w) === zonderMaat(v))
        || S.producten.some((x) => zelfde(x.naam, c.naam) && variantSleutel(variantUit(x)) === variantSleutel(v)));
    }
    const hersteld = regelGroottesHerstellen();
    for (const n of new Set([...hersteld, ...S.boodschappen.filter((b) => b.bron === 'minimum' && !b.afgevinkt).map((b) => b.naam)])) minimumControleren(n);
  }
  const syncMeld = (melding) => document.dispatchEvent(new CustomEvent('syncstatus', { detail: { melding } }));
  const zBewaren = () => idb(SYNC_SLEUTEL, Z ? JSON.parse(JSON.stringify(Z)) : undefined, !Z).catch((f) => console.warn('Synchronisatie niet bewaard', f));

  /** Eén ronde: ophalen, samenvoegen, versturen. Bij een botsing (ander toestel was sneller) opnieuw. */
  async function syncRonde() {
    if (!syncAan()) return;
    // een ander venster van de app kan intussen gesynchroniseerd (of gestopt) hebben: diens stand overnemen
    const opgeslagen = await idb(SYNC_SLEUTEL).catch(() => false);
    if (opgeslagen === undefined && Z.versie) { Z = null; K = null; syncMeld(); return; }
    if (opgeslagen && opgeslagen.code === Z.code && (opgeslagen.versie || 0) > (Z.versie || 0)) Object.assign(Z, opgeslagen);
    const z = Z, k = K;
    for (let poging = 0; poging < 5; poging++) {
      const a = await server(z.adres, k, 'GET', { versie: z.versie });
      if (Z !== z) return; // intussen gestopt
      let extern, versie;
      if (a.status === 304) { extern = z.basis; versie = z.versie; }
      else if (a.status === 200) { extern = await ontsleutelen(await a.r.arrayBuffer(), k); versie = a.versie; }
      else if (a.status === 404 && z.versie) {
        // een ander toestel heeft alles van de server gewist
        await syncStoppen();
        syncMeld('De synchronisatie is gestopt: de gegevens werden op een ander toestel van de server gewist. Je gegevens op dit toestel blijven staan.');
        return;
      } else if (a.status === 404) { extern = null; versie = 0; }
      else throw new Error(`De synchronisatieserver gaf een fout (${a.status}).`);

      // samenvoegen in de wachtrij van de app: niet tegelijk met een wijziging op dit toestel
      const samen = await inWachtrij(async () => {
        const lokaal = syncDeel(S);
        if (extern) {
          const m = M.samenvoegen(z.basis || {}, lokaal, extern);
          inGebruik(m);
          if (!M.gelijk(syncDeel(S), lokaal)) {
            await bewaren();
            if (kanaal) kanaal.postMessage('gewijzigd');
            document.dispatchEvent(new Event('syncgewijzigd'));
          }
        }
        z.basis = extern; z.versie = versie; // dit is nu verwerkt
        await zBewaren();
        return syncDeel(S);
      });
      if (extern && M.gelijk(samen, extern)) { z.laatst = nu(); z.fout = null; await zBewaren(); return; } // niets nieuws te versturen
      const b = await server(z.adres, k, 'PUT', { versie, nieuw: !extern, body: await versleutelen(samen, k) });
      if (b.status === 200) { z.basis = samen; z.versie = b.versie; z.laatst = nu(); z.fout = null; await zBewaren(); return; }
      if (b.status === 412) continue; // een ander toestel bewaarde intussen iets: opnieuw ophalen en samenvoegen
      if (b.status === 401) throw Object.assign(new Error('De server weigert de wijzigingen. Koppel dit toestel opnieuw.'), { syncFout: true });
      if (b.status === 413) throw Object.assign(new Error('Je gegevens zijn te groot voor de synchronisatieserver.'), { syncFout: true });
      throw new Error(`De synchronisatieserver gaf een fout (${b.status}).`);
    }
    throw new Error('Synchroniseren lukte niet: de gegevens veranderden steeds opnieuw. Probeer het zo nog eens.');
  }
  function syncNu() {
    clearTimeout(syncTimer); syncTimer = null;
    if (!syncAan()) return Promise.resolve();
    const r = syncKetting.then(async () => {
      if (!syncAan()) return;
      syncBezig = true; syncMeld();
      try { await syncRonde(); } catch (f) {
        if (Z) { Z.fout = f.message || 'Synchroniseren lukte niet.'; Z.foutNetwerk = !!f.netwerk; zBewaren(); }
        if (!f.netwerk) console.error('Synchroniseren', f);
        log(`Synchroniseren: ${f.netwerk ? f.message : foutTekst(f)}`);
        throw f;
      } finally { syncBezig = false; syncMeld(); }
    });
    syncKetting = r.catch(() => {});
    return r;
  }
  function syncPlannen(wacht = 1500) {
    if (!syncAan()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNu().catch(() => {}), wacht);
  }
  async function syncStarten(z) {
    const bytes = codeBytes(z.code);
    if (!bytes) throw new Error('Deze code klopt niet: ze heeft 32 tekens (cijfers en letters).');
    K = await sleutelsMaken(bytes);
    Z = z;
  }
  async function syncStoppen() {
    clearTimeout(syncTimer); syncTimer = null;
    Z = null; K = null;
    await zBewaren();
    syncMeld();
  }
  async function syncLaden() {
    try {
      const z = await idb(SYNC_SLEUTEL);
      if (z && z.code && z.adres) await syncStarten(z);
    } catch (f) { console.warn('Synchronisatie niet geladen', f); }
  }
  async function serverControleren(adres) {
    if (!/^https:\/\/[^/\s]+\.[^/\s]+|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(adres)) throw new Error('Dit is geen geldig adres. Het ziet er uit als https://voorraad-sync.jouwnaam.workers.dev');
    let t = '';
    try { t = await (await echteFetch(adres + '/', { cache: 'no-store' })).text(); } catch {
      throw new Error(navigator.onLine ? `${adres} is niet bereikbaar. Klopt het adres?` : 'Geen internet.');
    }
    if (!t.includes('voorraad-sync')) throw new Error(`Op ${adres} staat geen synchronisatieserver van Voorraad.`);
  }
  // opnieuw synchroniseren bij het openen van de app, als het internet terug is, en elke halve minuut
  document.addEventListener('visibilitychange', (e) => { if (!e.isTrusted || !syncAan()) return; if (document.visibilityState === 'visible') syncPlannen(100); else if (syncTimer) syncNu().catch(() => {}); });
  window.addEventListener('online', () => syncPlannen(100));
  setInterval(() => { if (syncAan() && document.visibilityState === 'visible' && !syncTimer && !syncBezig) syncNu().catch(() => {}); }, 30000);

  const telling = (d) => ({ producten: (d.producten || []).length, recepten: (d.recepten || []).length,
    boodschappen: (d.boodschappen || []).length, planning: (d.planning || []).length });
  window.voorraadSync = {
    /** Adres van de eigen server, ingevuld in sync-adres.js (leeg = zelf in te vullen). */
    standaardAdres: () => adresNetjes(window.VOORRAAD_SYNC_ADRES || ''),
    info() {
      if (!Z) return null;
      const bytes = codeBytes(Z.code);
      const code = bytes ? codeNetjes(bytes) : '';
      const link = `${location.origin}${location.pathname}#koppelen=${naarCode(bytes || [])}&server=${encodeURIComponent(Z.adres)}`;
      return { adres: Z.adres, laatst: Z.laatst || null, fout: Z.fout || null, offline: !!Z.foutNetwerk, bezig: syncBezig, code, link };
    },
    /** Synchronisatie aanzetten met een nieuwe code; alles op dit toestel gaat versleuteld naar de server. */
    async aanzetten(adres) {
      adres = adresNetjes(adres);
      await serverControleren(adres);
      const bytes = crypto.getRandomValues(new Uint8Array(20));
      await syncStarten({ adres, code: naarCode(bytes), versie: 0, basis: null, laatst: null, fout: null });
      try { await syncNu(); } catch (f) { await syncStoppen(); throw f; }
    },
    /** Stap 1 van koppelen: met de code ophalen wat er op de server staat. Geeft het aantal items terug. */
    async bekijken(code, adres) {
      adres = adresNetjes(adres);
      const bytes = codeBytes(code);
      if (!bytes) throw new Error('Deze code klopt niet: ze heeft 32 tekens (cijfers en letters). Kijk ze nog eens na.');
      await serverControleren(adres);
      const k = await sleutelsMaken(bytes);
      const a = await server(adres, k, 'GET');
      if (a.status === 404) throw new Error('Met deze code staat er niets op de server. Kijk de code nog eens na.');
      if (a.status !== 200) throw new Error(`De synchronisatieserver gaf een fout (${a.status}).`);
      const extern = await ontsleutelen(await a.r.arrayBuffer(), k);
      voorstel = { adres, code: naarCode(bytes), versie: a.versie, extern };
      return { extern: telling(extern), lokaal: telling(S) };
    },
    /** Stap 2: koppelen. 'vervangen' = dit toestel krijgt de gegevens van de andere; 'samenvoegen' = beide houden. */
    async koppelen(wijze) {
      if (!voorstel) throw new Error('Typ eerst de code.');
      const v = voorstel; voorstel = null;
      await syncStarten({ adres: v.adres, code: v.code, versie: v.versie, basis: v.extern, laatst: null, fout: null });
      await inWachtrij(async () => {
        if (wijze === 'samenvoegen') {
          // eigen items nieuwe id's geven, zodat ze niet botsen met die van de andere toestellen
          const eigen = M.nieuweIds(syncDeel(S), id);
          inGebruik(M.samenvoegen(null, eigen, v.extern));
        } else inGebruik(v.extern);
        await bewaren();
        await zBewaren();
        if (kanaal) kanaal.postMessage('gewijzigd');
      }, 'koppelen');
      try { await syncNu(); } catch { /* staat in de status; volgende keer opnieuw */ }
    },
    nu: () => syncNu(),
    /** Stoppen op dit toestel; de gegevens blijven op het toestel (en op de server voor de andere toestellen). */
    stoppen: () => syncStoppen(),
    /** Alles van de server wissen; alle gekoppelde toestellen stoppen dan met synchroniseren. */
    async wissen() {
      if (!syncAan()) return;
      const a = await server(Z.adres, K, 'DELETE');
      if (a.status !== 204 && a.status !== 404) throw new Error(`Wissen lukte niet (fout ${a.status}).`);
      await syncStoppen();
    },
  };

  const klaar = laden().then(bestandLaden).then(syncLaden).then(() => {
    if (syncAan()) syncPlannen(300);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  });
  const LEZEN = new Set(['status', 'alles', 'statistieken', 'barcode', 'ocr']);
  const echteFetch = window.fetch.bind(window);
  let wachtrij = Promise.resolve();
  // wat er nu in de wachtrij bezig is (en in welke stap), voor het logboek als iets te lang duurt
  let bezigMet = '';
  /** Iets doen met de gegevens, na de opdrachten van de app die al wachten (en niet tegelijk ermee). */
  function inWachtrij(f, naam = 'synchroniseren: samenvoegen') {
    const r = wachtrij.then(async () => { bezigMet = naam; try { return await f(); } finally { bezigMet = ''; } });
    wachtrij = r.catch(() => {});
    return r;
  }
  window.fetch = (url, opties = {}) => {
    const u = typeof url === 'string' ? url : url.url;
    if (!u.startsWith('api/')) return echteFetch(url, opties);
    const methode = (opties.method || 'GET').toUpperCase();
    const pad = u.slice(4).split('?')[0].replace(/\/$/, '');
    const bron = pad.split('/')[0];
    let data = {};
    if (opties.body && typeof opties.body === 'string') { try { data = JSON.parse(opties.body); } catch { data = {}; } }
    const naam = `${methode} ${pad}`, begin = Date.now();
    let stap = 'wacht op vorige opdracht';
    // waakhond: duurt het te lang, dan noteren waarop gewacht wordt en de app laten weten (melding "Even geduld")
    const waak = methode === 'GET' ? null : setTimeout(() => {
      log(`Traag: ${naam} duurt al 5 s (stap: ${stap}${stap === 'wacht op vorige opdracht' ? `; bezig: ${bezigMet || 'niets'}` : ''}; opslag ${opslagStuk ? 'stuk' : 'ok'}; sync ${syncBezig ? 'bezig' : 'niet bezig'})`);
      document.dispatchEvent(new CustomEvent('traag', { detail: { stap } }));
    }, 5000);
    const uitvoeren = async () => {
      bezigMet = naam; stap = 'opstarten';
      await klaar;
      try {
        stap = 'verwerken';
        const antwoord = await api(methode, pad, data, opties.body);
        const wijzigt = methode !== 'GET' && !LEZEN.has(bron);
        if (wijzigt) {
          stap = 'bewaren';
          try { await bewaren(); } catch (f) {
            log(`Bewaren mislukt bij ${naam}: ${foutTekst(f)}`);
            fout(507, 'Je gegevens konden niet bewaard worden op dit toestel. Open de app niet in een privévenster en kijk of er nog opslagruimte vrij is.');
          }
          if (kanaal) kanaal.postMessage('gewijzigd');
          autoBackup();
          syncPlannen();
        }
        return new Response(JSON.stringify(antwoord), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        if (!e.status) { console.error(e); log(`Fout bij ${naam}: ${foutTekst(e)}`); }
        return new Response(JSON.stringify({ fout: e.status ? e.message : 'Er ging iets mis: ' + e.message }), { status: e.status || 500, headers: { 'Content-Type': 'application/json' } });
      }
    };
    // trage opdrachten (tekstherkenning, barcode opzoeken) houden de rest niet op
    const klaarMet = (r) => {
      clearTimeout(waak); bezigMet = '';
      const duur = Date.now() - begin;
      if (duur > 5000) log(`${naam} klaar na ${Math.round(duur / 1000)} s`);
      return r;
    };
    if (bron === 'ocr' || bron === 'barcode') return uitvoeren().finally(() => clearTimeout(waak));
    const r = wachtrij.then(uitvoeren).then(klaarMet, (f) => { klaarMet(); throw f; });
    wachtrij = r.catch(() => {});
    return r;
  };

  // gewijzigd in een ander venster van de app: opnieuw inlezen
  // (in de wachtrij: niet midden in een opdracht van dit venster de gegevens vervangen)
  if (kanaal) kanaal.onmessage = async () => {
    log('Ander venster van de app wijzigde iets: opnieuw inlezen');
    await inWachtrij(() => laden(), 'ander venster: opnieuw inlezen').catch(() => {});
    document.dispatchEvent(new Event('visibilitychange'));
  };

  // ------------------------------------------------------------------ installeren / offline
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        if (!reg) return;
        // een geïnstalleerde app op de gsm wordt vaak alleen uit de achtergrond teruggehaald (niet opnieuw geopend):
        // dan ook nakijken of er een nieuwe versie is
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
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

// Voorraad — gegevens van twee toestellen samenvoegen bij het synchroniseren.
//
// Drie-weg samenvoegen: `basis` is wat dit toestel en de server laatst gemeen hadden, `lokaal` is dit toestel,
// `extern` is wat nu op de server staat. Wat alleen aan één kant veranderde, wordt overgenomen. Veranderde
// hetzelfde item aan beide kanten, dan worden de velden apart samengevoegd (bv. op de laptop de hoeveelheid,
// op de telefoon de plaats: beide blijven). Alleen als hetzelfde veld aan beide kanten anders werd, wint dit toestel.
// Een item dat aan de ene kant gewist en aan de andere kant gewijzigd werd, blijft bestaan (niets gaat verloren).
//
// Werkt in de browser (window.voorraadSamenvoegen) en in Node (voor de tests).
(function (wereld) {
  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

  /** Diep vergelijken; de volgorde van de sleutels in een object telt niet, undefined telt als afwezig. */
  function gelijk(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => gelijk(x, b[i]));
    if (isObj(a)) {
      if (!isObj(b)) return false;
      const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined);
      return ka.length === kb.length && ka.every((k) => gelijk(a[k], b[k]));
    }
    return false;
  }

  /** Eén waarde (een item, een veld): b = basis, l = lokaal, r = extern; undefined = bestaat niet (meer). */
  function waarde(b, l, r) {
    if (gelijk(l, r)) return l;
    if (gelijk(l, b)) return r; // alleen extern gewijzigd
    if (gelijk(r, b)) return l; // alleen lokaal gewijzigd
    // aan beide kanten anders
    if (l === undefined) return r; // lokaal gewist, extern gewijzigd: houden
    if (r === undefined) return l;
    if (isObj(l) && isObj(r)) return object(isObj(b) ? b : {}, l, r);
    return l;
  }

  function object(b = {}, l = {}, r = {}) {
    const uit = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const v = waarde(b[k], l[k], r[k]);
      if (v !== undefined) uit[k] = v;
    }
    return uit;
  }

  /** Lijst van items met een sleutel (id of naam): per item samenvoegen. */
  function items(b, l, r, sleutel) {
    const kaart = (a) => new Map((Array.isArray(a) ? a : []).filter(isObj).map((x) => [sleutel(x), x]));
    const B = kaart(b), L = kaart(l), R = kaart(r), uit = [], gezien = new Set();
    for (const k of [...L.keys(), ...R.keys()]) {
      if (gezien.has(k)) continue;
      gezien.add(k);
      const v = waarde(B.get(k), L.get(k), R.get(k));
      if (v !== undefined) uit.push(v);
    }
    return uit;
  }

  const klein = (x) => String(x ?? '').trim().toLowerCase();

  /** Lijst van namen (plaatsen, winkels, …): toevoegingen en verwijderingen van beide kanten. */
  function namen(b, l, r) {
    b = Array.isArray(b) ? b : []; l = Array.isArray(l) ? l : []; r = Array.isArray(r) ? r : [];
    if (gelijk(l, r)) return l;
    if (gelijk(l, b)) return r;
    if (gelijk(r, b)) return l;
    const in_ = (a, x) => a.some((y) => klein(y) === klein(x));
    const uit = l.filter((x) => !(in_(b, x) && !in_(r, x))); // extern verwijderd
    for (const x of r) if (!in_(b, x) && !in_(uit, x)) uit.push(x); // extern toegevoegd
    return uit;
  }
  const isNamenlijst = (a) => Array.isArray(a) && a.every((x) => typeof x === 'string');

  function instellingen(b = {}, l = {}, r = {}) {
    const uit = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const v = [b[k], l[k], r[k]].some(isNamenlijst) && [b[k], l[k], r[k]].every((x) => x === undefined || isNamenlijst(x))
        ? namen(b[k], l[k], r[k]) : waarde(b[k], l[k], r[k]);
      if (v !== undefined) uit[k] = v;
    }
    return uit;
  }

  /** Gebeurtenissen (gekocht, gekookt, …) worden alleen toegevoegd: alles van beide kanten houden. */
  function gebeurtenissen(b, l, r) {
    const sl = (g) => `${g.soort}|${g.naam}|${g.tijdstip}`;
    const tel = (a) => (Array.isArray(a) ? a : []).filter(isObj).reduce((m, g) => m.set(sl(g), (m.get(sl(g)) || 0) + 1), new Map());
    const B = tel(b), L = tel(l);
    const uit = (Array.isArray(l) ? l : []).filter(isObj).slice();
    const extra = new Map();
    for (const g of (Array.isArray(r) ? r : []).filter(isObj)) {
      const k = sl(g), n = (extra.get(k) || 0) + 1;
      extra.set(k, n);
      // nieuw op de server = meer keren dan in de basis; staat het lokaal al (even vaak), dan niet nog eens
      if (n > (B.get(k) || 0) && n > (L.get(k) || 0)) uit.push(g);
    }
    return uit.sort((x, y) => String(x.tijdstip || '').localeCompare(String(y.tijdstip || '')));
  }

  const OP_ID = ['producten', 'boodschappen', 'recepten', 'planning'];

  /** Alle gegevens samenvoegen. basis mag null zijn (dan wordt alles van beide kanten gehouden). */
  function samenvoegen(basis, lokaal, extern) {
    const b = basis || {}, l = lokaal || {}, r = extern || {};
    const uit = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      let v;
      if (OP_ID.includes(k)) v = items(b[k], l[k], r[k], (x) => String(x.id));
      else if (k === 'catalogus') v = items(b[k], l[k], r[k], (x) => klein(x.naam));
      else if (k === 'gebeurtenissen') v = gebeurtenissen(b[k], l[k], r[k]);
      else if (k === 'barcodes') v = object(isObj(b[k]) ? b[k] : {}, isObj(l[k]) ? l[k] : {}, isObj(r[k]) ? r[k] : {});
      else if (k === 'instellingen') v = instellingen(b[k] || {}, l[k] || {}, r[k] || {});
      else if (k === 'volgendId') v = Math.max(+l[k] || 1, +r[k] || 1);
      else v = waarde(b[k], l[k], r[k]);
      if (v !== undefined) uit[k] = v;
    }
    return uit;
  }

  /**
   * Alle items een nieuw, uniek id geven (verwijzingen mee aanpassen). Nodig als een toestel met eigen gegevens
   * aan een bestaande synchronisatie gekoppeld wordt: beide toestellen nummerden vanaf 1, de id's zouden botsen.
   */
  function nieuweIds(d, nieuwId) {
    const uit = JSON.parse(JSON.stringify(d || {}));
    const prod = new Map(), rec = new Map();
    for (const p of uit.producten || []) { const n = nieuwId(); prod.set(String(p.id), n); p.id = n; }
    for (const r of uit.recepten || []) {
      const n = nieuwId(); rec.set(String(r.id), n); r.id = n;
      for (const i of r.ingredienten || []) { i.id = nieuwId(); i.recept_id = n; }
    }
    for (const b of uit.boodschappen || []) {
      b.id = nieuwId();
      if (b.product_id != null) b.product_id = prod.get(String(b.product_id)) ?? null;
    }
    for (const m of uit.planning || []) {
      m.id = nieuwId();
      if (m.recept_id != null) m.recept_id = rec.get(String(m.recept_id)) ?? null;
    }
    return uit;
  }

  const api = { samenvoegen, gelijk, nieuweIds };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else wereld.voorraadSamenvoegen = api;
})(typeof window !== 'undefined' ? window : globalThis);

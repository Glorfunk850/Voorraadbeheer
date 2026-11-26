// Brug tussen de webapp en Android (alleen in de apk; de webapp zelf blijft ongewijzigd).
// Vult aan wat de Android-WebView niet kan: downloads, afdrukken, scherm aan laten en meldingen.
(function () {
  if (window.__voorraadApp || !window.VoorraadApp) return;
  window.__voorraadApp = 1;
  var A = window.VoorraadApp;

  // downloads (blob:/data: met a.download) naar de map Downloads
  var klik = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var h = this.href || '';
    if (this.hasAttribute('download') && (h.indexOf('blob:') === 0 || h.indexOf('data:') === 0)) {
      var naam = this.getAttribute('download') || 'bestand';
      fetch(h).then(function (r) { return r.blob(); }).then(function (b) {
        var fr = new FileReader();
        fr.onload = function () { var d = String(fr.result); A.opslaan(naam, b.type || 'application/octet-stream', d.substring(d.indexOf(',') + 1)); };
        fr.readAsDataURL(b);
      }).catch(function (e) { A.melding('Opslaan lukte niet: ' + e); });
      return;
    }
    return klik.apply(this, arguments);
  };

  // afdrukken via Android
  window.print = function () { A.afdrukken(); };

  // scherm aan laten (Screen Wake Lock bestaat niet in de WebView)
  if (!('wakeLock' in navigator)) {
    var tel = 0;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: function () {
      tel++; A.schermAan(true);
      var s = { released: false, type: 'screen', onrelease: null, _l: [],
        addEventListener: function (t, f) { this._l.push(f); },
        removeEventListener: function (t, f) { this._l = this._l.filter(function (g) { return g !== f; }); },
        release: function () {
          if (s.released) return Promise.resolve();
          s.released = true;
          if (--tel <= 0) { tel = 0; A.schermAan(false); }
          var ev = { type: 'release', target: s };
          if (s.onrelease) s.onrelease(ev);
          s._l.forEach(function (f) { f(ev); });
          return Promise.resolve();
        } };
      return Promise.resolve(s);
    } } });
  }

  // ---- meldingen ----
  // toestemming: 'granted', 'denied' of 'default' (zoals de webfunctie Notification.permission)
  var wachtend = [];
  window.__voorraadToestemming = function (t) { var w = wachtend; wachtend = []; w.forEach(function (f) { f(t); }); };
  function Melding(titel, opties) { A.toon(String(titel), String((opties && opties.body) || '')); }
  Object.defineProperty(Melding, 'permission', { get: function () { return A.toestemming(); } });
  Melding.requestPermission = function (terug) {
    return new Promise(function (ok) {
      wachtend.push(function (t) { if (typeof terug === 'function') terug(t); ok(t); });
      A.vraagToestemming();
    });
  };
  window.Notification = Melding;

  if (window.ServiceWorkerRegistration) {
    var P = ServiceWorkerRegistration.prototype;
    P.showNotification = function (titel, opties) { A.toon(String(titel), String((opties && opties.body) || '')); return Promise.resolve(); };
    P.getNotifications = function () { return Promise.resolve([]); };
    // "periodic background sync": Android kijkt zelf ongeveer twee keer per dag na wat op moet
    var sync = {
      register: function () { A.achtergrond(true); doorgeven(); return Promise.resolve(); },
      unregister: function () { A.achtergrond(false); return Promise.resolve(); },
      getTags: function () { return Promise.resolve(A.achtergrondAan() ? ['op-te-gebruiken'] : []); }
    };
    Object.defineProperty(P, 'periodicSync', { configurable: true, get: function () { return sync; } });
    // meldingen werken ook zonder (of vóór) de service worker: dan een vervangende registratie
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      var vervang = { showNotification: P.showNotification, getNotifications: P.getNotifications, periodicSync: sync,
        update: function () { return Promise.resolve(); } };
      var echte = navigator.serviceWorker.getRegistration.bind(navigator.serviceWorker);
      navigator.serviceWorker.getRegistration = function () {
        return echte.apply(null, arguments).then(function (r) { return r || vervang; }, function () { return vervang; });
      };
    }
  }
  if (navigator.permissions && navigator.permissions.query) {
    var vraag = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function (d) {
      var n = d && d.name;
      if (n === 'periodic-background-sync') return Promise.resolve({ name: n, state: 'granted', onchange: null });
      if (n === 'notifications') {
        var t = A.toestemming();
        return Promise.resolve({ name: n, state: t === 'default' ? 'prompt' : t, onchange: null });
      }
      return vraag(d);
    };
  }

  // de voorraad (alleen wat nodig is voor de melding) en de keuze aan/uit doorgeven aan Android
  function lezen(db, sleutel) {
    return new Promise(function (ok) {
      try {
        var r = db.transaction('staat').objectStore('staat').get(sleutel);
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { ok(null); };
      } catch (e) { ok(null); }
    });
  }
  var vorige = '';
  function doorgeven() {
    var r;
    try { r = indexedDB.open('voorraadbeheer', 1); } catch (e) { return; }
    r.onupgradeneeded = function () { r.result.createObjectStore('staat'); };
    r.onerror = function () {};
    r.onsuccess = function () {
      var db = r.result;
      Promise.all([lezen(db, 'gegevens'), lezen(db, 'melding')]).then(function (uit) {
        db.close();
        var g = uit[0] || {}, m = uit[1] || {}, inst = g.instellingen || {};
        var producten = (g.producten || []).filter(function (p) { return p && p.vervaldatum && p.hoeveelheid > 0; })
          .map(function (p) { return { naam: String(p.naam || ''), vervaldatum: String(p.vervaldatum), datumtype: p.datumtype === 'TGT' ? 'TGT' : 'THT' }; });
        var staat = JSON.stringify({ aan: !!m.aan, laatst: m.laatst || '', tgt_dagen: inst.tgt_dagen == null ? 2 : inst.tgt_dagen,
          tht_dagen: inst.tht_dagen == null ? 3 : inst.tht_dagen, producten: producten });
        if (staat !== vorige) { vorige = staat; A.staat(staat); }
      }, function () { db.close(); });
    };
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) doorgeven(); });
  window.addEventListener('pagehide', doorgeven);
  window.addEventListener('load', function () { setTimeout(doorgeven, 2000); });
  setInterval(doorgeven, 30000);
})();

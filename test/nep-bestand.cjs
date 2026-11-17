// Gedeeld door de tests: vervangt de bestandskiezer van het systeem (die in een test niet open kan)
// door een nagemaakt bestand dat zijn inhoud in de afgeschermde testopslag van de browser (OPFS) bewaart.
// Een echt OPFS-bestand kan niet gebruikt worden: de testbrowser crasht als hij dat uit IndexedDB terugleest.
// Daarom wordt het nagemaakte bestand in IndexedDB als naam bewaard en bij het lezen terug omgezet.
// localStorage 'test-toestemming' = 'prompt' bootst na dat de toestemming kwijt is (zoals na het herstarten van de browser).
module.exports = function nepBestand() {
  const opfs = async (naam) => (await navigator.storage.getDirectory()).getFileHandle(naam, { create: true });
  class NepBestand {
    constructor(naam) { this.name = naam; this.kind = 'file'; }
    async queryPermission() { return localStorage.getItem('test-toestemming') === 'prompt' ? 'prompt' : 'granted'; }
    async requestPermission() { localStorage.removeItem('test-toestemming'); window.toestemmingGevraagd = true; return 'granted'; }
    async getFile() { return (await opfs(this.name)).getFile(); }
    async createWritable() { return (await opfs(this.name)).createWritable(); }
  }
  window.showSaveFilePicker = async () => new NepBestand('voorraad-gegevens.json');
  window.showOpenFilePicker = async () => [new NepBestand('voorraad-gegevens.json')];
  const put = IDBObjectStore.prototype.put, get = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.put = function (v, k) {
    if (v && v.handle instanceof NepBestand) v = { ...v, handle: { nepBestand: v.handle.name } };
    return put.call(this, v, k);
  };
  IDBObjectStore.prototype.get = function (k) {
    const r = get.call(this, k);
    r.addEventListener('success', () => { const v = r.result; if (v && v.handle && v.handle.nepBestand) v.handle = new NepBestand(v.handle.nepBestand); });
    return r;
  };
};

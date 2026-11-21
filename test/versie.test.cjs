// Het versienummer staat op twee plaatsen en moet overal hetzelfde zijn:
//  - VERSIE in sw.js ('voorraad-v81'): zorgt dat toestellen de nieuwe bestanden ophalen;
//  - APP_VERSIE in app.js (81): staat onderaan bij Instellingen, zodat je ziet welke versie een toestel heeft.
// Vergeet je er één op te hogen, dan faalt deze test (en de controle op GitHub).
//
// Uitvoeren: node test/versie.test.cjs   (geen browser nodig)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const VERSIE = 'voorraad-v(\d+)'/);
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const APP_VERSIE = (\d+);/);

if (!sw || !app) {
  console.log('FOUT versienummer niet gevonden in', !sw ? 'sw.js' : 'app.js');
  process.exit(1);
}
if (sw[1] !== app[1]) {
  console.log(`FOUT versie in sw.js (${sw[1]}) en in app.js (${app[1]}) verschillen: maak ze gelijk`);
  process.exit(1);
}
console.log(`OK   sw.js en app.js hebben allebei versie ${sw[1]}`);

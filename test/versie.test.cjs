// Controleert dat het versienummer overal hetzelfde is (index.html, app.js, sw.js).
// Anders kan een toestel een nieuwe index.html met een oude app.js laden.
// Uitvoeren:  node test/versie.test.cjs
const fs = require('fs');
const path = require('path');
const lees = (b) => fs.readFileSync(path.join(__dirname, '..', b), 'utf8');
const index = lees('index.html'), app = lees('app.js'), sw = lees('sw.js');
const v = sw.match(/const V = (\d+);/)[1];
const fouten = [];
// sync-adres.js (het serveradres) wordt bewust zonder versie geladen
const moet = (ok, wat) => { console.log(`${ok ? 'OK  ' : 'FOUT'} ${wat}`); if (!ok) fouten.push(wat); };
moet(index.includes(`data-versie="${v}"`), `index.html data-versie="${v}"`);
moet(app.includes(`const APP_VERSIE = ${v};`), `app.js APP_VERSIE = ${v}`);
for (const m of index.matchAll(/(?:src|href)="([\w-]+\.(?:js|css))(\?v=\d+)?"/g)) if (m[1] !== 'sync-adres.js') moet(m[2] === `?v=${v}`, `index.html laadt ${m[1]}?v=${v}`);
for (const m of app.matchAll(/(?:from |import\()'(\.\/[\w-]+\.js)(\?v=\d+)?'/g)) moet(m[2] === `?v=${v}`, `app.js laadt ${m[1]}?v=${v}`);
if (fouten.length) { console.log(`\n${fouten.length} fout(en): verhoog overal hetzelfde versienummer.`); process.exit(1); }
console.log('\nVersienummers kloppen.');

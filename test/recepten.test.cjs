// Test voor het inlezen van recepten uit pdf's (layout.js + parser.js), zonder browser.
// De recepten hieronder zijn verzonnen, maar de opmaak bootst echte recept-pdf's na die eerder misliepen:
//  - twee kolommen (ingrediënten links, bereiding rechts) die op de volgende pagina doorlopen;
//  - een smalle goot tussen de kolommen (15 pt bij 11 pt-letters);
//  - afgebroken ingrediëntregels: 13 pt binnen een ingrediënt, 15 pt tussen twee ingrediënten;
//  - een blok "Voeding" onder de ingrediënten;
//  - genummerde stappen en stappen in alinea's zonder nummer.
// Mislukt een pdf in de toekomst, voeg dan hier een verzonnen recept met dezelfde opmaak toe.
// Uitvoeren: node test/recepten.test.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const laad = (f) => import(pathToFileURL(path.join(__dirname, '..', f)).href);

// --- hulpmiddelen om een pdf-pagina na te bootsen (zelfde vorm als pdfStukjes in layout.js) ---
const BREEDTE = 0.44; // gemiddelde letterbreedte als deel van de lettergrootte (gemeten in echte recept-pdf's)
function stukje(str, x, basislijn, grootte = 11) {
  return { str, x0: x, x1: x + str.length * grootte * BREEDTE, y0: basislijn - grootte * 0.8, y1: basislijn + grootte * 0.2 };
}
/**
 * Een kolom: lijst van items; elk item is een lijst regels (afgebroken = meerdere regels).
 * binnen = afstand tussen regels van één item, tussen = afstand tussen items, alinea = extra witruimte bij een '' als item.
 */
function kolom(x, y, items, { binnen = 13, tussen = 15, alinea = 30, grootte = 11 } = {}) {
  const uit = [];
  let eerste = true;
  for (const item of items) {
    if (item === '') { y += alinea - tussen; continue; }
    if (!eerste) y += tussen;
    item.forEach((regel, i) => { if (i) y += binnen; uit.push(stukje(regel, x, y, grootte)); });
    eerste = false;
  }
  return uit;
}

let fouten = 0;
async function test(naam, fn) {
  try { await fn(); console.log('✓', naam); } catch (f) { fouten++; console.log('✗', naam, '\n ', f.message); }
}

(async () => {
  const { tekstOpmaken, paginasStapelen } = await laad('layout.js');
  const { receptOntleden } = await laad('parser.js');
  const inlezen = (paginas) => receptOntleden(tekstOpmaken(paginasStapelen(paginas)));
  const namen = (r) => r.ingredienten.map((i) => [i.hoeveelheid, i.eenheid, i.naam].join(' ').trim());

  await test('Twee kolommen die op pagina 2 doorlopen, genummerde stappen', () => {
    const p1 = [
      stukje('Pompoenbrood met kruidenboter en', 72, 220, 20), stukje('frisse salade', 130, 244, 20),
      stukje('Portiegrootte: 4P | Kooktijd: 30 min', 119, 300),
      stukje('Ingrediënten', 49, 330, 15), stukje('Bereiding', 171, 330, 15),
      ...kolom(49, 352, [['300 g volkoren', 'tarwemeel (plus extra', 'om te bestuiven)'], ['8 g bakpoeder'],
        ['1 pompoen, geraspt', 'en uitgeknepen'], ['30 g zonnebloempitten'], ['2 sjalotten,']]),
      ...kolom(171, 352, [['1. Oven voorverwarmen op 180°C', '(boven- en onderwarmte).'], '',
        ['2. Meel en bakpoeder mengen in een', 'kom.'], '', ['3. Pompoen toevoegen en goed mengen met de']]),
    ];
    const p2 = [
      ...kolom(49, 60, [['fijngesneden'], ['200 ml melk of', 'water'], ['Peper en zout van de', 'molen'],
        ['40 g geraspte', 'Oude kaas 48+'], ['½ bosje dille,', 'fijngehakt']]),
      ...kolom(171, 60, [['ingrediënten samen met de melk. Kneed', 'kort tot een bol.'], '',
        ['4. Bakken: 35 minuten in de oven.', 'Laat afkoelen op een rooster.']]),
    ];
    const r = inlezen([p1, p2]);
    assert.strictEqual(r.titel, 'Pompoenbrood met kruidenboter en frisse salade');
    assert.strictEqual(r.personen, 4);
    assert.strictEqual(r.bereidingstijd, '30 min');
    assert.deepStrictEqual(namen(r), [
      '300 g volkoren tarwemeel (plus extra om te bestuiven)', '8 g bakpoeder', '1 stuks pompoen, geraspt en uitgeknepen',
      '30 g zonnebloempitten', '2 stuks sjalotten, fijngesneden', '200 ml melk of water', 'Peper en zout van de molen',
      '40 g geraspte Oude kaas 48+', '0.5 bos dille, fijngehakt']);
    assert.strictEqual(r.stappen.length, 4, r.stappen.join(' | '));
    assert.strictEqual(r.stappen[0], 'Oven voorverwarmen op 180°C (boven- en onderwarmte).');
    assert.ok(r.stappen[2].startsWith('Pompoen toevoegen') && r.stappen[2].endsWith('kort tot een bol.'), r.stappen[2]);
  });

  await test('Smalle goot tussen de kolommen, stappen in alinea\'s zonder nummer', () => {
    const p1 = [
      stukje('Linzentaart met paprika', 89, 70, 20),
      stukje('Portiegrootte:', 55, 130), stukje('6 personen |', 127, 130), stukje('Bereidingstijd:', 197, 130),
      stukje('20 min |', 272, 130), stukje('Kooktijd:', 321, 130), stukje('40 min', 192, 143),
      stukje('Ingrediënten', 49, 175, 15), stukje('Bereiding', 171, 175, 15),
      // "1 grote ui, gesnipperd" eindigt 15 pt voor de bereidingskolom
      ...kolom(49, 196, [['4 eetlepels olijfolie'], ['1 grote ui, gesnipperd'], ['2 tenen knoflook,', 'fijngehakt'],
        ['1 eetlepel gerookte', 'paprikapoeder'], ['250 g rode linzen'], ['4 eieren'], ['zeste van 1 citroen'],
        ['zwarte peper'], ['Ronde bakvorm (Ø', '24 cm), ingevet']]),
      ...kolom(171, 196, [['Verwarm de olie in een pan en fruit', 'de ui zachtjes glazig. Voeg de linzen', 'toe.', 'Laat 15 minuten koken.'], '',
        ['Klop de eieren los en meng alles.', 'Giet in de vorm.'], '',
        ['Bak 40 minuten in de oven.']], { binnen: 13, tussen: 13 }),
    ];
    const r = inlezen([p1]);
    assert.strictEqual(r.titel, 'Linzentaart met paprika');
    assert.strictEqual(r.personen, 6);
    assert.deepStrictEqual(namen(r), [
      '4 el olijfolie', '1 stuks grote ui, gesnipperd', '2 teen knoflook, fijngehakt', '1 el gerookte paprikapoeder',
      '250 g rode linzen', '4 stuks eieren', 'zeste van 1 citroen', 'zwarte peper', 'Ronde bakvorm (Ø 24 cm), ingevet']);
    assert.deepStrictEqual(r.stappen, [
      'Verwarm de olie in een pan en fruit de ui zachtjes glazig. Voeg de linzen toe. Laat 15 minuten koken.',
      'Klop de eieren los en meng alles. Giet in de vorm.', 'Bak 40 minuten in de oven.']);
  });

  await test('Blok "Voeding" onder de ingrediënten, bereik "200 tot 240 g"', () => {
    const p1 = [
      stukje('Snelle groentepasta', 63, 70, 20), stukje('Portiegrootte: 2 | Kooktijd: 1 uur', 126, 120),
      stukje('Ingrediënten', 49, 150, 15), stukje('Bereiding', 171, 150, 15),
      ...kolom(49, 171, [['200 tot 240 g', 'penne'], ['600 g gemengde', 'groente'], ['1 el olie'], '',
        ['Voeding'], '', ['Hoeveelheid per', 'portie'], ['calorieën: 500'], ['Totaal vet: 20g']], { tussen: 15, binnen: 13 }),
      ...kolom(171, 171, [['1. Kook de pasta.'], '', ['2. Bak de groente 5 min. in de olie.'], '', ['3. Meng en serveer.']]),
    ];
    const r = inlezen([p1]);
    assert.deepStrictEqual(namen(r), ['240 g penne', '600 g gemengde groente', '1 el olie']);
    assert.strictEqual(r.stappen.length, 3);
    assert.ok(/calorieën: 500/.test(r.notities) && !/calorieën/.test(namen(r).join()), r.notities);
  });

  await test('Getypt recept met kopjes, ingrediënten zonder hoeveelheid', () => {
    const r = receptOntleden('Pasta pesto\nIngrediënten voor 4 personen:\n300 g pasta\n1 rode\npaprika\nzout\npeper\nBereiding\nKook de pasta. Giet af.\nMeng met pesto en\nserveer.');
    assert.strictEqual(r.personen, 4);
    assert.deepStrictEqual(namen(r), ['300 g pasta', '1 stuks rode paprika', 'zout', 'peper']);
    assert.deepStrictEqual(r.stappen, ['Kook de pasta. Giet af.', 'Meng met pesto en serveer.']);
  });

  await test('Getypt recept met opsomming, genummerde stappen en tip', () => {
    const r = receptOntleden('Soep\nIngrediënten\n- ui\n- wortel\n- bouillon\nWerkwijze\n1. Snipper de ui. Fruit ze.\n2. Voeg de rest toe.\nTip: lekker met brood');
    assert.deepStrictEqual(namen(r), ['ui', 'wortel', 'bouillon']);
    assert.deepStrictEqual(r.stappen, ['Snipper de ui. Fruit ze.', 'Voeg de rest toe.']);
    assert.strictEqual(r.notities, 'lekker met brood');
  });

  await test('Ingrediënten koppelen: een gedeelde kleur of een samengesteld product is geen match', async () => {
    const { zoekVoorraadnaam: z } = await laad('parser.js');
    const p = ['Rode biet', 'Champignons', 'Spinazie met room', 'Rode ui', 'Halfvolle melk'];
    assert.strictEqual(z('rode paprika', p), '');           // niet "Rode biet"
    assert.strictEqual(z('room', p), '');                   // niet "Spinazie met room"
    assert.strictEqual(z('spinazie', p), '');
    assert.strictEqual(z('spinazie met room', p), 'Spinazie met room');
    assert.strictEqual(z('rode biet', p), 'Rode biet');
    assert.strictEqual(z('ui', p), 'Rode ui');
    assert.strictEqual(z('melk', p), 'Halfvolle melk');
    assert.strictEqual(z('champignons', p), 'Champignons');
  });

  if (fouten) { console.log(`\n${fouten} test(s) mislukt.`); process.exit(1); }
  console.log('\nAlle recepten worden goed ingelezen.');
})();

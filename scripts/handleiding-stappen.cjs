// Welke schermen gefotografeerd worden voor de handleiding (gebruikt door handleiding-afbeeldingen.cjs).
module.exports = async ({ page, herladen, foto, paneelFoto, api }) => {
  await herladen('#voorraad', '#zoek-voorraad');
  await foto('voorraad');

  await page.click('#nieuw:visible, [aria-label="Toevoegen"]:visible');
  await paneelFoto('product-toevoegen');

  await herladen('#voorraad', '#zoek-voorraad');
  await page.fill('#zoek-voorraad', 'Spaghetti');
  await page.click('[data-groep]');
  await paneelFoto('product');

  const d = await api('GET', 'alles');
  await api('PUT', `boodschappen/${d.boodschappen.find((b) => b.naam === 'Melk').id}`, { afgevinkt: true });
  await herladen('#boodschappen', '#inhoud h1');
  await foto('boodschappen');

  await page.click('#klaar');
  await page.waitForSelector('.af-datum');
  const over = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  await page.$$eval('.af-datum', (els, v) => els.forEach((e) => { e.value = v; }), over);
  await paneelFoto('winkelen');

  await herladen('#catalogus', '#inhoud h1');
  await foto('catalogus');

  await herladen('#recepten', '[data-recept]');
  await foto('recepten');
  await page.locator("summary", { hasText: "Hoofdgerecht" }).first().click();
  await page.locator("[data-recept]:visible", { hasText: "Spaghetti bolognese" }).first().click();
  await paneelFoto('recept');

  await herladen('#planner', '#inhoud h1');
  await foto('planner');

  await herladen('#instellingen', '#inhoud h1');
  const plaatsen = page.locator('[data-uitklap="locaties"]');
  await plaatsen.locator('summary').click();
  await plaatsen.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24));
  await foto('instellingen');
};

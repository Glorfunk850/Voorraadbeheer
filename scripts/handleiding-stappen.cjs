// Welke schermen gefotografeerd worden voor de handleiding (gebruikt door handleiding-afbeeldingen.cjs).
module.exports = async ({ page, herladen, foto, paneelFoto, api }) => {
  // alleen een deel van een scherm: van de bovenkant van `van` tot de bovenkant van `tot` (beide functies die een element geven)
  const deelFoto = async (naam, van, tot) => {
    await page.addStyleTag({ content: '.navigatie { visibility: hidden !important; }' });
    const r = await page.evaluate(([v, t]) => {
      const a = eval(v)().getBoundingClientRect(), b = eval(t)().getBoundingClientRect();
      return { y: a.top + window.scrollY, h: b.top - a.top };
    }, [van.toString(), tot.toString()]);
    await foto(naam, { fullPage: true, clip: { x: 0, y: Math.max(0, r.y - 16), width: 390, height: r.h + 8 } });
  };
  // in een paneel naar een element scrollen, met wat ruimte erboven
  const paneelScroll = (sel) => page.locator(sel).first().evaluate((e) => {
    e.scrollIntoView({ block: 'start' });
    let s = e.parentElement; while (s && s.scrollHeight <= s.clientHeight) s = s.parentElement;
    if (s) s.scrollTop -= 20;
  });
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

  // back-up en synchroniseren bij Instellingen
  const overSectie = () => [...document.querySelectorAll('section.sectie')].find((x) => x.querySelector('.sectie-titel')?.textContent.trim() === 'Over');
  await deelFoto('synchroniseren', () => document.querySelector('#sync-blok'), () => document.querySelector('#auto-blok'));
  await deelFoto('backup', () => document.querySelector('#auto-blok'), overSectie);

  // boodschap kiezen uit de catalogus
  await herladen('#boodschappen', '#b-menu');
  await page.click('#b-menu');
  await page.waitForSelector('#bt-zoek-blok');
  await paneelScroll('#bt-zoek-blok');
  await paneelFoto('boodschap-uit-lijst');

  // prijzen per winkel van een product
  await herladen('#voorraad', '#zoek-voorraad');
  await page.fill('#zoek-voorraad', 'Melk');
  await page.click('[data-groep]');
  await page.waitForSelector('#paneel #prijzen');
  await page.click('#paneel #prijzen');
  await paneelFoto('prijzen');

  // minimumvoorraad en grote verpakking (rijst in potten, bijkopen per zak)
  let d2 = await api('GET', 'alles');
  const rijst = d2.producten.find((p) => p.naam === 'Rijst');
  await api('PUT', `producten/${rijst.id}`, { grootverpakking: { eenheid: 'zak', inhoud: 5, inhoud_eenheid: 'kg', potten: 4 } });
  await herladen('#voorraad', '#zoek-voorraad');
  await page.fill('#zoek-voorraad', 'Rijst');
  await page.click('[data-groep]');
  await page.click('#paneel #bewerk');
  await page.waitForSelector('#pf-min');
  await page.locator('#paneel details.meer').first().evaluate((e) => { e.open = true; });
  await paneelScroll('label:has(#pf-min)');
  await paneelFoto('grote-verpakking');

  // een recept toevoegen
  await herladen('#recepten', '#r-nieuw');
  await page.click('#r-nieuw:visible');
  await paneelFoto('recept-toevoegen');

  // een maaltijd plannen en boodschappen voor de week
  await herladen('#planner', '[data-plan-nieuw]');
  await page.locator('[data-plan-nieuw]').last().click();
  await paneelFoto('maaltijd-plannen');
  await herladen('#planner', '#pw-boodschappen');
  await page.click('#pw-boodschappen');
  await paneelFoto('week-boodschappen');

  // geopende verpakkingen (als laatste: verandert het voorraadscherm)
  d2 = await api('GET', 'alles');
  await api('POST', `producten/${d2.producten.find((p) => p.naam === 'Spaghetti').id}/openen`, { hoeveelheid: 1 });
  await api('POST', `producten/${d2.producten.find((p) => p.naam === 'Tomatensaus').id}/openen`, {});
  await herladen('#voorraad', '.voorraad-geopend');
  await deelFoto('geopend', () => document.querySelector('.voorraad-geopend'), () => document.querySelector('.voorraad-geopend').nextElementSibling);
};

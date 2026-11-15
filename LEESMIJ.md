# Voorraadbeheer – installeerbare webapp

Alles werkt in de browser: je gegevens staan op het toestel zelf (ook offline).
Er is geen server en geen AI-dienst; er wordt niets naar buiten gestuurd.

Voorlopig uitgeschakeld: barcodes scannen en recepten inlezen vanaf een foto (of een gescande pdf).
Recepten toevoegen kan door een pdf met tekst te kiezen of door het recept zelf te typen.
(Het bestand `barcode.js` wordt niet meer gebruikt en is bewaard voor later.)

## Prijzen en winkels

- Vul bij een product (Bewerken → **Prijs per winkel**) de prijs per eenheid in bij één of meer winkels
  (per kg of per l bij gewicht of volume, anders per stuk, pak, fles …). Winkels beheer je bij Instellingen → **Winkels**.
- Op de boodschappenlijst staat elk product op de **algemene lijst** (Alles) én op de lijst van de winkel
  waar het het goedkoopst is. Het is telkens dezelfde boodschap: afvinken op de ene lijst vinkt ze ook af op de andere.
- Tik op de prijs (of op "Prijs invullen") onder een boodschap om de prijzen meteen aan te passen.

## Online zetten met GitHub Pages (gratis, eenmalig ±10 minuten)

1. Maak een gratis account op https://github.com (als je er nog geen hebt).
2. Klik rechtsboven op **+** → **New repository**. Naam bv. `voorraad`, kies **Public**, klik **Create repository**.
3. Klik op **uploading an existing file**. Pak de zip uit en sleep **de inhoud** van de map
   (index.html, app.js, de map vendor, …) in het venster. Klik **Commit changes**.
   (Belangrijk: index.html moet bovenaan staan, niet in een submap. Sleep ook de map **vendor** mee:
   via "choose your files" kun je geen mappen kiezen, via slepen wel.)
4. Ga naar **Settings** → **Pages**. Kies bij *Branch* `main` en map `/ (root)`, klik **Save**.
5. Na een minuut staat er bovenaan: *Your site is live at* `https://<jouwnaam>.github.io/voorraad/`.

## Installeren

- **Android (Chrome):** open het adres → menu ⋮ → **App installeren**.
- **iPhone (Safari):** open het adres → deelknop → **Zet op beginscherm**.
- **Computer (Chrome/Edge):** installeer-icoon in de adresbalk, of Instellingen in de app → **App installeren**.

## Gegevens

- Elk toestel heeft zijn eigen voorraad. Overzetten: Instellingen → **Back-up downloaden**,
  en op het andere toestel **Back-up terugzetten**.
- Maak af en toe een back-up. Verwijder je de app of wis je de websitegegevens, dan is de voorraad weg.
- Bij het terugzetten zie je eerst hoeveel producten, recepten en boodschappen in de back-up zitten.
  Op het voorraadscherm staat daarna alleen wat binnenkort op moet; zoek een product om de rest te zien.
- Een back-up uit de vorige versie (de app met voorraad.db) kun je proberen terug te zetten; lukt het niet, laat het weten.
- Welke versie een toestel heeft, zie je onderaan bij Instellingen ("Versie …").

## Een nieuwe versie zetten

Upload de gewijzigde bestanden opnieuw naar dezelfde repository. Verhoog in `sw.js` het
nummer in `VERSIE` (bv. `voorraad-v16`) en in `app.js` hetzelfde nummer in `APP_VERSIE`. Toestellen met internet krijgen
de nieuwe versie dan meteen bij het volgende openen.

## Automatische knoppentest

Bij elke wijziging op GitHub klikt een test (`test/knoppen.test.cjs`) automatisch op álle knoppen van de app,
ook op nieuwe knoppen. Werkt een knop niet (een fout, of er gebeurt niets), dan zie je bij de wijziging een
rood kruisje in plaats van een groen vinkje (tabblad **Actions**). Zet dan geen nieuwe versie online.

## Automatische recepttest

`test/recepten.test.cjs` controleert bij elke wijziging of recepten uit pdf's goed ingelezen worden
(twee kolommen, kolommen die op de volgende pagina doorlopen, afgebroken ingrediëntregels, voedingswaarden, …).
De recepten in die test zijn verzonnen, maar hebben dezelfde opmaak als echte pdf's die eerder misliepen.
Wordt een pdf niet goed ingelezen, dan wordt die opmaak na de oplossing aan de test toegevoegd,
zodat hetzelfde probleem niet terugkomt.

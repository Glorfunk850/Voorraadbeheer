# Voorraadbeheer – installeerbare webapp

Alles werkt in de browser: je gegevens staan op het toestel zelf (ook offline).
Er is geen server en geen AI-dienst. Alleen:
- een onbekende barcode wordt opgezocht bij Open Food Facts;
- de tekstherkenning (Tesseract) wordt bij het eerste gebruik één keer gedownload.

## Online zetten met GitHub Pages (gratis, eenmalig ±10 minuten)

1. Maak een gratis account op https://github.com (als je er nog geen hebt).
2. Klik rechtsboven op **+** → **New repository**. Naam bv. `voorraad`, kies **Public**, klik **Create repository**.
3. Klik op **uploading an existing file**. Pak de zip uit en sleep **de inhoud** van de map
   (index.html, app.js, de map vendor, …) in het venster. Klik **Commit changes**.
   (Belangrijk: index.html moet bovenaan staan, niet in een submap.)
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
- Een back-up uit de vorige versie (de app met voorraad.db) kun je proberen terug te zetten; lukt het niet, laat het weten.

## Een nieuwe versie zetten

Upload de gewijzigde bestanden opnieuw naar dezelfde repository. Verhoog in `sw.js` het
nummer in `VERSIE` (bv. `voorraad-v2`). De app meldt dan zelf "Er is een nieuwe versie".

# Voorraadbeheer – installeerbare webapp

Alles werkt in de browser: je gegevens staan op het toestel zelf (ook offline).
Er is geen AI-dienst en er wordt niets naar buiten gestuurd. Alleen als je **synchroniseren tussen toestellen**
aanzet, gaan je gegevens naar je eigen server, en dan versleuteld: die server kan ze niet lezen (zie verder).

Voorlopig uitgeschakeld: barcodes scannen en recepten inlezen vanaf een foto (of een gescande pdf).
Recepten toevoegen kan door een pdf met tekst te kiezen of door het recept zelf te typen.
(Het bestand `barcode.js` wordt niet meer gebruikt en is bewaard voor later.)

## Boodschappen toevoegen

- Typ bovenaan iets in (bv. `2 l melk`) en tik op **+**, of tik op de knop met het **lijstje** ernaast.
  Daar kies je uit je producten (of typ je zelf iets), stel je het aantal in met **−** en **+** en kies je de eenheid.
  Het menu blijft open, zodat je meteen meer kunt toevoegen; tik op **Klaar** als je klaar bent.
- Op de lijst verander je het aantal met **−** en **+** naast elke boodschap
  (per stuk, of per 100 g / 100 ml / 0,5 kg / 0,5 l). Tik op het getal zelf om een ander aantal te typen.
- Tik op de **naam** van een boodschap om ze te bewerken: naam, aantal en eenheid aanpassen, de prijzen per winkel,
  het product in je voorraad bewerken (of er een product van maken), of ze van de lijst halen.
  Afvinken doe je door op het rondje te tikken.

## Prijzen en winkels

- Vul bij een product (Bewerken → **Prijs per winkel**) de prijs in bij één of meer winkels.
  Kies bij **Prijs per** zelf de eenheid: per kg, per l, per stuk, per pak … (bv. per kg zoals op het prijskaartje,
  ook als je koffie per pak koopt). Vul dan ook de inhoud per pak in (bv. 500 g), zodat de prijs van je boodschappen
  berekend kan worden. Winkels beheer je bij Instellingen → **Winkels**.
- Op de boodschappenlijst staat elk product op de **algemene lijst** (Alles) én op de lijst van de winkel
  waar het het goedkoopst is. Het is telkens dezelfde boodschap: afvinken op de ene lijst vinkt ze ook af op de andere.
- Tik op de prijs (of op "Prijs invullen") onder een boodschap om de prijzen meteen aan te passen.

## Maaltijdplanner

- Tik onderaan op **Planner**. Je ziet de week van maandag tot zondag; met **‹** en **›** ga je naar een andere week.
- Tik bij een dag op **+ Plannen**: kies de maaltijd (ontbijt, lunch, avondeten …) en kies een recept uit je recepten
  (met zoeken en het aantal personen), of typ zelf iets (bv. restjes of uit eten).
  Vanuit een recept kan het ook: **Inplannen…**.
- Tik op een geplande maaltijd om het recept te bekijken, ze als **gekookt** aan te duiden (ingrediënten gaan dan van je voorraad af),
  ze te verplaatsen of uit de planning te halen. Het getal rechts (bv. 3/5) toont hoeveel ingrediënten je in huis hebt.
- **Boodschappen voor … maaltijden** telt de ingrediënten van alle recepten die deze week nog gekookt moeten worden samen
  en toont wat ontbreekt; jij kiest wat op de boodschappenlijst komt.
- De maaltijden (ontbijt, lunch, avondeten) pas je aan bij Instellingen → **Maaltijden in de planner**.

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

- Je gegevens staan op het toestel, in de opslag van de browser.
- **Laptop (Chrome of Edge): ook bewaren in een bestand.** Instellingen → **Bewaren in een bestand** →
  **Nieuw bestand maken**. Kies waar het bestand komt (bv. Documenten, of een map die met Google Drive of OneDrive
  gesynchroniseerd wordt). Daarna schrijft de app elke wijziging vanzelf ook in dat bestand.
  - Wis je de browsergegevens, verwijder je de app of neem je een nieuwe laptop: kies **Bestaand bestand openen**
    en dan dat bestand. Alles staat terug en de app bewaart weer in hetzelfde bestand.
  - Vraagt Chrome na het herstarten opnieuw toestemming, dan gebeurt dat vanzelf bij je eerste wijziging.
    Kies **Toestaan bij elk bezoek**, dan wordt het niet meer gevraagd. Zeg je nee, dan krijg je één melding met
    **Toestemming geven**; tot dan staan wijzigingen wel in de app, maar nog niet in het bestand.
  - Het bestand is een gewone back-up: je kunt het ook met **Back-up terugzetten** inlezen.
  - Gebruik niet tegelijk op twee toestellen hetzelfde gesynchroniseerde bestand: het toestel dat het laatst iets
    wijzigt, overschrijft het bestand.
- **Automatische back-up (laptop en Android).** Elke dag dat je iets wijzigt, zet de app vanzelf een back-up in
  **Downloads** (bij de eerste wijziging van de dag). Oude back-ups mag je verwijderen; de nieuwste is genoeg.
  Terugzetten met **Back-up terugzetten**. Uit- of aanzetten bij Instellingen → **Automatische back-up**.
  Standaard aan, behalve op iPhone/iPad (Safari vraagt daar bij elke download om bevestiging).
- Op Android is er geen koppeling met een bestand: Chrome vergeet daar bij elk herstarten de toestemming.
- Een bestand koppelen kan niet op een iPhone/iPad (Apple laat het niet toe). Staat de automatische back-up uit en
  is je laatste back-up meer dan 14 dagen oud, dan herinnert de app je eraan bij het openen, met een knop om meteen
  een back-up te maken.
- Elk toestel heeft zijn eigen voorraad, tenzij je **synchroniseren tussen toestellen** aanzet (zie hieronder).
  Eenmalig overzetten kan ook: Instellingen → **Back-up downloaden**, en op het andere toestel **Back-up terugzetten**.
- Maak af en toe een back-up. Verwijder je de app of wis je de websitegegevens, dan is de voorraad weg.
- Bij het terugzetten zie je eerst hoeveel producten, recepten en boodschappen in de back-up zitten.
  Op het voorraadscherm staat daarna alleen wat binnenkort op moet; zoek een product om de rest te zien.
- Een back-up uit de vorige versie (de app met voorraad.db) kun je proberen terug te zetten; lukt het niet, laat het weten.
- Welke versie een toestel heeft, zie je onderaan bij Instellingen ("Versie …").

## Synchroniseren tussen toestellen

Houd je voorraad, boodschappen, recepten en planning gelijk op je telefoon, tablet en laptop. Het werkt zoals de
synchronisatie van DuckDuckGo:

- Je koppelt toestellen met een **geheime code** (32 tekens, ook als QR-code). Er is geen account, e-mail of wachtwoord.
- Alles wordt **op het toestel zelf versleuteld** met die code (AES-256). De code zelf gaat nooit naar de server.
- De server bewaart alleen het versleutelde pakket. Wie de server beheert (ook Cloudflare), kan je gegevens niet lezen.
- De server is van jou: een gratis Cloudflare Worker op je eigen account (map `sync-server`).

### Eenmalig: de server plaatsen (±15 minuten)

1. Maak een gratis account op https://dash.cloudflare.com/sign-up en bevestig je e-mailadres.
2. Klik in Cloudflare links op **Workers & Pages** (bij sommige accounts onder **Compute**). Vraagt Cloudflare om een
   *subdomein* voor workers.dev te kiezen, kies er dan een (bv. je naam). Rechts op die pagina staat je **Account ID**:
   kopieer het.
3. Klik rechtsboven op je profiel → **My Profile** → **API Tokens** → **Create Token**. Kies bij de sjabloon
   **Edit Cloudflare Workers** op **Use template**. Kies bij *Account Resources* je account en bij *Zone Resources*
   **All zones**. Klik **Continue to summary** → **Create Token** en kopieer de token (je ziet hem maar één keer).
4. Ga in GitHub naar je repository → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**. Maak er twee:
   - naam `CLOUDFLARE_API_TOKEN`, met de token van stap 3;
   - naam `CLOUDFLARE_ACCOUNT_ID`, met het Account ID van stap 2.
5. Ga naar het tabblad **Actions** → links **Synchronisatieserver plaatsen** → **Run workflow** → **Run workflow**.
   Na een minuut staat er een groen vinkje. De actie zet het adres van je server (bv.
   `https://voorraad-sync.jouwnaam.workers.dev`) vanzelf in `sync-adres.js`; de app kent het daarna op elk toestel.
   Open je dat adres in de browser, dan zie je: *deze synchronisatieserver voor Voorraadbeheer werkt*.

Zonder GitHub-actie kan het ook met de opdrachtregel: `cd sync-server` en `npx wrangler deploy`. Vul het adres dan in
`sync-adres.js` in, of typ het in de app (er verschijnt een veld zolang `sync-adres.js` leeg is).

Het gratis abonnement van Cloudflare is ruim genoeg: 100.000 verzoeken per dag, en je gegevens nemen (gecomprimeerd)
meestal minder dan 1 MB in.

### Toestellen koppelen

1. Op je eerste toestel: Instellingen → **Synchroniseren tussen toestellen** → **Synchronisatie aanzetten**.
   Je ziet een QR-code en de code (bv. `D09C-QAQQ-…`).
2. Op elk ander toestel: Instellingen → **Koppelen met een code** en typ de code (hoofdletters, streepjes en spaties
   maken niet uit). Of scan de QR-code met de camera: op Android opent de geïnstalleerde app dan meteen.
   **iPhone/iPad:** de camera opent de QR-code in Safari, niet in de app op je beginscherm. Typ de code daarom in de app zelf.
3. Staan er op het nieuwe toestel al gegevens, dan kies je: **Samenvoegen** (alles van beide toestellen houden; wat op
   beide stond, kan dubbel staan) of **Vervangen** (het nieuwe toestel krijgt de gegevens van de andere).

Later nog een toestel koppelen: Instellingen → **Toestel koppelen** toont de code opnieuw.

### Hoe het werkt

- Na elke wijziging (na ±1,5 seconde), bij het openen van de app en elke halve minuut zolang de app open staat,
  haalt de app op wat nieuw is, voegt het samen met dit toestel en stuurt het resultaat terug.
- Zonder internet werk je gewoon verder; je wijzigingen gaan mee zodra er weer verbinding is.
- Wijzig je op twee toestellen tegelijk, dan gaat er niets verloren: elke wijziging wordt apart samengevoegd.
  Op de laptop de hoeveelheid melk en op de telefoon de plaats aangepast? Beide blijven. Alleen als je hetzelfde veld van
  hetzelfde product op twee toestellen anders invult voordat ze synchroniseerden, wint het toestel dat als laatste synchroniseert.
  Een product dat op het ene toestel verwijderd en op het andere gewijzigd werd, blijft staan.
- Per toestel (niet gesynchroniseerd): de automatische back-up (aan/uit), de laatste back-up en het bestand bij
  *Bewaren in een bestand*.
- **Houd de code geheim**: wie ze heeft, kan je gegevens lezen. Bewaar ze ook op een veilige plek (bv. in je
  wachtwoordbeheerder): ben je al je toestellen kwijt, dan haal je met de code alles terug op een nieuw toestel.
- **Stoppen**: Instellingen → **Stoppen**. Je gegevens blijven op het toestel. Kies je daarna ook **Ook wissen**, dan
  wordt alles van de server gewist en stoppen ook je andere toestellen (hun gegevens blijven wel staan).

## Een nieuwe versie zetten

Upload de gewijzigde bestanden opnieuw naar dezelfde repository. Verhoog in `sw.js` het
nummer in `VERSIE` (bv. `voorraad-v33`) en in `app.js` hetzelfde nummer in `APP_VERSIE`. Toestellen met internet krijgen
de nieuwe versie dan meteen bij het volgende openen.

## Automatische knoppentest

Bij elke wijziging op GitHub klikt een test (`test/knoppen.test.cjs`) automatisch op álle knoppen van de app,
ook op nieuwe knoppen. Werkt een knop niet (een fout, of er gebeurt niets), dan zie je bij de wijziging een
rood kruisje in plaats van een groen vinkje (tabblad **Actions**). Zet dan geen nieuwe versie online.

## Automatische test: bewaren in een bestand

`test/bestand.test.cjs` controleert dat het gekozen bestand meteen gevuld wordt en bij elke wijziging bijgewerkt,
dat de koppeling blijft na het herstarten, dat alles terugkomt na het wissen van de app-gegevens, het opnieuw
vragen van toestemming, "Stoppen", en de back-upherinnering in browsers zonder bestandskiezer.

## Automatische test: synchroniseren

`test/sync.test.cjs` start de echte servercode lokaal en controleert het samenvoegen, dat op de server alleen onleesbare
gegevens staan, koppelen met de code en via de QR-link, gelijktijdige wijzigingen op twee toestellen, een verkeerde code,
en stoppen en wissen.

## Automatische recepttest

`test/recepten.test.cjs` controleert bij elke wijziging of recepten uit pdf's goed ingelezen worden
(twee kolommen, kolommen die op de volgende pagina doorlopen, afgebroken ingrediëntregels, voedingswaarden, …).
De recepten in die test zijn verzonnen, maar hebben dezelfde opmaak als echte pdf's die eerder misliepen.
Wordt een pdf niet goed ingelezen, dan wordt die opmaak na de oplossing aan de test toegevoegd,
zodat hetzelfde probleem niet terugkomt.

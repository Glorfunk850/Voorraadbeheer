// Handleiding, getoond via Instellingen → Handleiding. Overgenomen uit het document "Handleiding Voorraad".
// Pas de tekst hier aan als de app verandert.
export const HANDLEIDING = `
<h2>Wat is Voorraad?</h2>
<p>Voorraad houdt bij wat je in huis hebt, wat binnenkort op moet, wat je moet kopen en wat je gaat koken. De handleiding hoort bij versie 88; je versie zie je onderaan bij <b>Instellingen</b>.</p>
<p>Alles staat op je toestel zelf en werkt ook zonder internet. Er gaat niets naar buiten en er wordt geen AI gebruikt. Elk toestel heeft zijn eigen gegevens, tenzij je <b>synchroniseren tussen toestellen</b> aanzet: dan gaan je gegevens versleuteld naar je eigen server, die ze niet kan lezen (zie <i>Synchroniseren tussen toestellen</i>).</p>

<h3>Installeren</h3>
<ul>
  <li><b>Android (Chrome):</b> open het adres van de app, tik op <b>⋮</b> en kies <b>App installeren</b>.</li>
  <li><b>iPhone of iPad (Safari):</b> open het adres, tik op de deelknop (vierkant met pijl omhoog) en kies <b>Zet op beginscherm</b>.</li>
  <li><b>Computer (Chrome of Edge):</b> klik op het installeer-icoon rechts in de adresbalk, of op <b>App installeren</b> bij Instellingen.</li>
</ul>
<p>Zolang de app niet geïnstalleerd is, staat er een tip bovenaan het voorraadscherm. Tik op <b>Hoe?</b> voor uitleg, of op <b>×</b> om de tip weg te halen.</p>

<h3>De vijf schermen</h3>
<p>Op de telefoon staan de knoppen onderaan, op de computer links.</p>
<table>
  <tr><th>Scherm</th><th>Waarvoor</th></tr>
  <tr><td>Voorraad</td><td>Wat binnenkort op moet, al je producten per categorie, wat op is, en zoeken</td></tr>
  <tr><td>Boodschappen</td><td>Je boodschappenlijst, per winkel en met prijzen. Het getal op de knop is het aantal open boodschappen</td></tr>
  <tr><td>Catalogus</td><td>Alle producten die je ooit toevoegde, ook als ze op zijn, met merken, inhouden en prijzen</td></tr>
  <tr><td>Recepten</td><td>Je recepten, met hoeveel ingrediënten je in huis hebt</td></tr>
  <tr><td>Planner</td><td>Wat je deze week eet</td></tr>
</table>
<p><b>Instellingen</b> (lijsten, waarschuwingen, back-ups) open je op de telefoon met het <b>tandwiel</b> rechtsboven; op de computer staat het onderaan in de balk links.</p>
<p>Bijna alles opent in een paneel dat van onderen inschuift (telefoon) of rechts verschijnt (computer). Sluiten doe je met <b>×</b>, door ernaast te tikken of met Esc.</p>

<h2>Voorraad</h2>
<p>Het voorraadscherm toont bovenaan <b>Op te gebruiken</b> (datum komt eraan of is voorbij). Daaronder staat <b>Geopend</b>: een overzicht van alle geopende verpakkingen, het langst geopend bovenaan, met wanneer je ze opende (bv. <i>geopend op 12 november (8 dagen)</i>). Tik erop om ze als <b>Op</b> aan te duiden. Daaronder staan bij <b>Alle producten</b> al je producten per <b>categorie</b>. Elke categorie is <b>uitklapbaar</b>: tik erop om ze te openen of te sluiten; achter de naam staat hoeveel producten erin zitten. Producten zonder categorie staan onderaan bij <i>Zonder categorie</i>. Elk product staat er één keer per merk (en per grootte: <i>klein</i> of <i>groot</i>), met rechts hoeveel je (ongeopend) in huis hebt en eronder of er een verpakking <i>geopend</i> is; tik erop om de verpakkingen van dat merk te zien. Helemaal onderaan staat <b>Op</b> (producten waarvan je niets meer hebt).</p>
<figure class="hl-foto"><img src="handleiding/voorraad.jpg" alt="Het voorraadscherm met Op te gebruiken en Alle producten per categorie" width="390" height="780"><figcaption>Het voorraadscherm: bovenaan zoeken, daaronder wat op moet (rood: datum komt eraan of is voorbij) en al je producten per categorie; tik op een categorie om ze open te klappen. Met <b>+</b> rechtsboven voeg je een product toe.</figcaption></figure>
<p>Met het <b>zoekveld</b> bovenaan zoek je op naam, merk, plaats, categorie of notitie (of op <i>geopend</i>). Tijdens het zoeken staan alleen de categorieën met iets dat past, en die staan open.</p>

<h3>Een product toevoegen</h3>
<ol>
  <li>Tik op <b>Toevoegen</b>.</li>
  <li>Typ de <b>naam</b>. Na twee letters verschijnt eronder <b>Kies uit je catalogus</b>: elk merk en elke inhoud staat er apart, bv. <i>Doperwten en wortelen – Everyday · 530 g · uitlekgewicht</i> (je kunt ook op merk zoeken). Kies je er een, dan worden merk, inhoud, uitlekgewicht en verpakking (klein of groot) ingevuld, samen met eenheid, plaats, categorie, datumtype en prijzen. Typ je alleen een gekende naam zonder te kiezen, dan blijven merk en inhoud leeg; die vul je dan zelf in (of laat je leeg).<br><b>Nieuw product, nog niet in je catalogus?</b> Dan verschijnt er geen lijst (of alleen producten met een gelijkaardige naam: kies er dan geen). Typ de naam volledig en vul de rest zelf in zoals hieronder. Na <b>Toevoegen</b> komt het product vanzelf in je catalogus, zodat je het de volgende keer wel kunt kiezen.</li>
  <li>Vul <b>hoeveelheid</b> en <b>eenheid</b> in (stuks, g, kg, l, pak, blik …). Bij telbare eenheden kun je ook de <b>inhoud per stuk</b> invullen, bv. 2 pak à 500 g. Is het gewicht een <b>uitlekgewicht</b> (bv. groenten of fruit in blik of bokaal), zet dan het vinkje <b>Uitlekgewicht</b> aan; dat staat dan overal bij het gewicht. Bij <b>Merk</b> vul je eventueel het merk in; dat staat achter de naam en je kunt erop zoeken.</li>
  <li>Kies bij <b>Verpakking</b> (net onder Merk) eventueel <b>Klein</b> of <b>Groot</b> als je het product in twee groottes koopt (zie <i>Kleine en grote verpakkingen</i>). Laat je <b>Niet opgegeven</b> staan, dan maakt de grootte niet uit.</li>
  <li>Kies de <b>plaats</b> (Koelkast, Diepvries, Voorraadkast …).</li>
  <li>Vul <b>Houdbaar tot</b> in, of tik op een snelknop: +3 dagen, +1 week, +1 maand, +1 jaar of Geen datum.</li>
  <li>Kies het soort datum (zie hieronder).</li>
  <li>Onder <b>Meer</b> staan categorie, minimumvoorraad, aankoopdatum en notitie. Onder <b>Prijs per winkel</b> vul je prijzen in.</li>
  <li>Tik op <b>Toevoegen</b>.</li>
</ol>

<figure class="hl-foto"><img src="handleiding/product-toevoegen.jpg" alt="Het venster Toevoegen met naam, merk, verpakking, hoeveelheid en eenheid" width="390" height="780"><figcaption>Een product toevoegen. Alleen de naam is nodig; de rest mag leeg blijven.</figcaption></figure>

<h3>Twee soorten datums</h3>
<table>
  <tr><th>Datum</th><th>Betekenis</th><th>Typisch voor</th><th>Kleur</th></tr>
  <tr><td>Ten minste houdbaar tot (THT)</td><td>Kwaliteitsdatum: daarna meestal nog goed. Kijk, ruik en proef</td><td>Kast- en diepvriesproducten</td><td>Oranje</td></tr>
  <tr><td>Te gebruiken tot (TGT)</td><td>Veiligheidsdatum: daarna niet meer eten</td><td>Vers vlees, vis, verse zuivel</td><td>Rood</td></tr>
</table>
<p>Hoeveel dagen vooraf de app waarschuwt, stel je in bij Instellingen (standaard 2 dagen voor TGT, 3 voor THT). TGT-producten staan altijd bovenaan.</p>

<h3>Een melding als een product op moet</h3>
<p>Moet er iets op (de datum komt eraan of is voorbij), dan verschijnt bij het openen van de app een venster <b>Op te gebruiken</b> met die producten, <i>Te gebruiken tot</i> bovenaan. Tik op een product om het te openen, of op <b>Naar voorraad</b>. Het venster komt hoogstens één keer per dag.</p>
<p>Je kunt ook een <b>melding op je toestel</b> krijgen, zoals een bericht van een andere app, bv. <i>2 producten op te gebruiken – Melk: morgen · Yoghurt: datum voorbij</i>. Zet dat aan bij Instellingen → <b>Meldingen</b> → <b>Aanzetten</b> en geef toestemming. Tik op de melding om de app op het tabblad Voorraad te openen. Ook als de app dicht is, kijkt ze ongeveer twee keer per dag na wat op moet, maar dat lukt alleen in <b>Chrome of Edge</b> (Android of computer) met de app <b>geïnstalleerd</b>. Op een iPhone of iPad (en in Firefox) kan een webapp zonder eigen server niet nakijken terwijl ze dicht is: daar zie je het in het venster bij het openen. Je krijgt hoogstens één melding per dag, en geen meer als je de app die dag al opende.</p>

<h3>Een product gebruiken of aanpassen</h3>
<p>Tik op een product om het paneel te openen:</p>
<ul>
  <li><b>− en +</b> (bij stuks, pakken …): één minder of meer.</li>
  <li><b>Gebruikt: ¼, ½, Alles of Andere hoeveelheid</b> (bij gram, liter …).</li>
  <li><b>Geopend</b> (of <b>1 fles geopend</b>, <b>1 pak geopend</b> … als je er meer hebt): zie hieronder.</li>
  <li><b>Nieuwe verpakking toevoegen</b>: zelfde product met een andere datum, bv. een tweede pak melk.</li>
  <li><b>Op boodschappenlijst</b>, <b>Prijzen invullen</b>, <b>Weggooien</b>, <b>Bewerken</b> of <b>Verwijderen</b>.</li>
</ul>
<p>Is het een kleine of grote verpakking, dan staat dat bovenaan in het paneel. <b>Nieuwe verpakking toevoegen</b> en <b>Op boodschappenlijst</b> nemen die grootte over: een grote fles komt dus als grote fles op je lijst.</p>
<figure class="hl-foto"><img src="handleiding/product.jpg" alt="Een geopend product met − en +, de houdbaarheidsdatum en de knoppen eronder" width="390" height="780"><figcaption>Een product geopend: met <b>−</b> en <b>+</b> pas je het aantal aan; daaronder de datum en wat je nog met het product kunt doen.</figcaption></figure>
<p>Na gebruiken, weggooien of verwijderen verschijnt onderaan <b>Ongedaan maken</b>. Heb je meerdere verpakkingen van hetzelfde product, dan kies je eerst welke je wilt bekijken.</p>

<h3>Geopend</h3>
<p>Open je een verpakking, tik dan op het product en op <b>Geopend</b>. Een geopende verpakking <b>telt als opgebruikt</b>: ze gaat van je voorraad af en telt niet mee voor de <b>minimumvoorraad</b>. Heb je bv. minimum 3 flessen melk en open je er een van de 3, dan komt er 1 fles op je boodschappenlijst.</p>
<ul>
  <li>Bij stuks, flessen, pakken … wordt telkens <b>één</b> verpakking geopend; de rest blijft ongeopend. Bij gram, liter … is het de hele verpakking.</li>
  <li>De geopende verpakking blijft in je voorraad staan, met <i>geopend vandaag</i> (of de datum) erbij, zodat je weet dat je ze nog moet opmaken. Recepten gebruiken eerst wat geopend is.</li>
  <li>Is ze leeg: tik erop en kies <b>Op</b>. Per vergissing geopend: <b>Toch niet geopend</b> (of <b>Ongedaan maken</b>), dan telt ze weer mee.</li>
  <li>Wat je na het winkelen in je voorraad zet, wordt nooit bij een geopende verpakking geteld.</li>
</ul>

<figure class="hl-foto breed"><img src="handleiding/geopend.jpg" alt="Het blok Geopend op het voorraadscherm met twee geopende verpakkingen" width="390" height="187"><figcaption>Het blok <b>Geopend</b> op het voorraadscherm: wat open is, met wanneer je het opende.</figcaption></figure>

<h3>Minimumvoorraad</h3>
<p>Vul bij <b>Meer → Minimumvoorraad</b> in hoeveel je altijd in huis wilt hebben. Zakt je voorraad eronder, dan komt het tekort vanzelf op je boodschappenlijst.
Het minimum geldt per inhoud en per verpakking (klein of groot): heb je bv. rijst in pakken à 500 g en à 1 kg, dan vul je bij elk zijn eigen minimum in. Elke inhoud en elke grootte wordt apart geteld. Het tekort komt <b>zonder merk en inhoud</b> op je lijst: na het winkelen kies je zelf welk merk en welke inhoud je kocht. Koop je een ander merk of een andere inhoud, dan telt dat niet mee voor dit minimum; wil je dat wel, gebruik dan het minimum voor alle merken samen.</p>
<p><b>Op verschillende plaatsen.</b> Staat hetzelfde product op twee plaatsen (bv. dille in de kruidenkast en in de witte kast), dan telt alles samen voor het minimum: de plaats maakt niet uit. Heeft de ene regel een inhoud en de andere niet, of staat de ene in stuks en de andere in potjes, dan tellen ze ook samen. Alleen twee verschillende inhouden (bv. 40 g en 50 g) blijven apart; wil je die ook samentellen, gebruik dan het minimum voor alle merken samen.</p>
<p><b>Minimum voor alle merken samen.</b> Maakt het niet uit welk merk of welke inhoud je in huis hebt (bv. je wilt altijd 3 blikken doperwten en wortelen, van Everyday of van Jumbo), tik dan in de <b>Catalogus</b> op het product, kies <b>Bewerken</b>, zet het vinkje <b>Minimum voor alle merken samen</b> aan (net onder Merk) en vul het minimum in. Zet je het vinkje weer uit, dan geldt het niet meer. Hetzelfde vinkje staat ook bij <b>Toevoegen</b> en <b>Bewerken</b> van je voorraad en in het boodschappenmenu (net onder Merk); het is overal hetzelfde minimum. Alles van dat product wordt dan samengeteld, om het even welk merk of welke inhoud: 1 blik à 530 g en 2 blikken à 450 g zijn samen 3. Heb je minder, dan komt het tekort <b>zonder merk en inhoud</b> op je lijst; in de winkel kies je zelf. Dit minimum gaat voor op het minimum per inhoud bij dat product. Koop je het product in een kleine en een grote verpakking, kies dan eerst <b>Klein</b> of <b>Groot</b>: het vinkje heet dan <i>Minimum voor alle merken samen, grote verpakkingen</i> (of kleine) en geldt alleen voor die grootte. Zo kun je voor elke grootte een eigen minimum zetten.</p>

<h3>Kleine en grote verpakkingen</h3>
<p>Koop je hetzelfde product soms in een kleine en soms in een grote verpakking (bv. een klein en een groot flesje shampoo, of een kleine en een grote pot choco), kies dan bij <b>Verpakking</b> (net onder Merk) <b>Klein</b> of <b>Groot</b>. Dat kan bij <b>Toevoegen</b> en <b>Bewerken</b> van je voorraad, in de <b>Catalogus</b> (elke grootte staat er als aparte regel) en bij een boodschap. In de lijsten staat dan <i>klein</i> of <i>groot</i> achter de naam. Laat je <b>Niet opgegeven</b> staan, dan werkt alles zoals vroeger.</p>
<ul>
  <li><b>Nooit samen.</b> Grote verpakkingen worden alleen met grote samengeteld, kleine alleen met kleine. Ook op de boodschappenlijst blijven ze aparte regels, en na het winkelen gaat een grote verpakking bij je grote verpakkingen.</li>
  <li><b>Elk een eigen minimum.</b> Het minimum dat je invult bij een grote verpakking geldt alleen voor de grote verpakkingen; dat bij een kleine alleen voor de kleine. Dat geldt voor het minimum bij <b>Meer → Minimumvoorraad</b> én voor het vinkje <b>Minimum voor alle merken samen</b>: kies eerst Klein of Groot, dan staat er bv. <i>Minimum voor alle merken samen, grote verpakkingen</i>.</li>
  <li><b>Terug in dezelfde grootte.</b> Zakken je grote verpakkingen onder hun minimum, dan komt het tekort op je boodschappenlijst als <b>grote verpakking</b>; bij kleine verpakkingen als <b>kleine verpakking</b>.</li>
</ul>
<p>Dit staat los van <b>Bijkopen in een grote verpakking</b> hieronder (een grote zak die je thuis over potten verdeelt).</p>

<h3>Grote verpakking, verdeeld over voorraadpotten</h3>
<p>Koop je bv. een grote zak rijst en verdeel je die thuis over voorraadpotten, dan kan de app de <b>grote verpakking</b> op je boodschappenlijst zetten als je potten bijna op zijn (en niet het aantal potten).</p>
<p><b>Eenmalig instellen</b></p>
<ol>
  <li>Zet het product in je voorraad met als eenheid <b>pot</b>, bv. <i>Rijst – 3 pot</i>.</li>
  <li>Tik op het product en kies <b>Bewerken</b>. Klap <b>Meer</b> open.</li>
  <li>Vul bij <b>Minimumvoorraad</b> in bij hoeveel potten je wilt bijkopen, bv. 2.</li>
  <li>Zet het vinkje <b>Bijkopen in een grote verpakking</b> aan en kies de verpakking (bv. zak), de inhoud (bv. 5 kg, mag leeg) en hoeveel potten één verpakking ongeveer vult (bv. 4).</li>
  <li>Tik op <b>Bewaren</b>.</li>
</ol>
<p><b>Er is een pot op</b></p>
<ol>
  <li>Ga naar <b>Voorraad</b>, zoek het product en tik erop. Je ziet het aantal potten, bv. <i>3 pot</i>.</li>
  <li>Tik op <b>−</b> links van het getal: er staat nu <i>2 pot</i>. Te veel weggetikt? Zet het terug met <b>+</b> of met <b>Ongedaan maken</b> onderaan.</li>
</ol>
<p>Zakt het aantal potten onder je minimum, dan komt de grote verpakking vanzelf op je boodschappenlijst, bv. <i>1 zak à 5 kg</i>, met de vermelding <i>Grote verpakking, onder je minimum</i>. Is je minimum 2, dan gebeurt dat pas bij 1 pot: 2 potten is nog genoeg. Gaat er nog een pot op, dan blijft het bij 1 zak. Wil je de grote verpakking eerder op je lijst, tik dan op het product en kies <b>Grote verpakking op boodschappenlijst</b>.</p>
<p><b>Na het winkelen</b></p>
<ol>
  <li>Vink de zak af op je boodschappenlijst en tik op <b>Klaar met winkelen</b>.</li>
  <li>Vul bij <b>Verdeeld over hoeveel potten?</b> in hoeveel potten je gevuld hebt (het aantal uit je instelling staat al ingevuld).</li>
  <li>Tik op <b>In voorraad zetten</b>. De potten worden bij je potten opgeteld.</li>
</ol>
<p>Heb je de zak nog niet verdeeld, laat het veld dan leeg: de zak komt dan als aparte regel in je voorraad. Zet je het vinkje <b>Bijkopen in een grote verpakking</b> weer uit, dan komt het tekort aan potten op je lijst, zoals bij elk ander minimum.</p>

<figure class="hl-foto"><img src="handleiding/grote-verpakking.jpg" alt="Bewerken van rijst in potten: minimum 2 en Bijkopen in een grote verpakking: zak van 5 kg die ongeveer 4 potten vult" width="390" height="780"><figcaption>Rijst in potten: onder <b>Meer</b> het minimum (2 potten) en <b>Bijkopen in een grote verpakking</b>: een zak van 5 kg vult ongeveer 4 potten.</figcaption></figure>

<h3>Doos met losse zakjes (bv. vanillepudding)</h3>
<p>Zit er in één verpakking meer dan één portie, bv. een doos vanillepudding met 4 zakjes, soep in zakjes of gist, dan houd je je voorraad bij <b>per zakje</b> en koop je bij <b>per doos</b>. Zo gebruik je de zakjes op verschillende momenten en weet de app altijd hoeveel er nog zijn.</p>
<p><b>Eenmalig instellen</b></p>
<ol>
  <li>Zet het product in je voorraad met als eenheid <b>zak</b> en als aantal het aantal zakjes, bv. <i>Vanillepudding – 4 zak</i>. Vul eventueel de inhoud per zakje in (bv. 40 g), dan kan een recept ook in gram rekenen.</li>
  <li>Tik op het product, kies <b>Bewerken</b> en klap <b>Meer</b> open.</li>
  <li>Vul bij <b>Minimumvoorraad</b> in vanaf hoeveel zakjes je een nieuwe doos wilt, bv. 1 (de doos komt op je lijst als het laatste zakje op is) of 2.</li>
  <li>Zet het vinkje <b>Bijkopen in een grote verpakking</b> aan, kies bij <b>Grote verpakking</b> <i>doos</i> en vul bij <b>Aantal zakjes erin</b> in hoeveel zakjes er in één doos zitten, bv. 4.</li>
  <li>Tik op <b>Bewaren</b>.</li>
</ol>
<p><b>Een zakje gebruikt</b></p>
<ol>
  <li>Tik op het product en dan op <b>−</b> links van het getal: er is één zakje minder. Kook je een recept uit de planner met <i>1 zakje vanillepudding</i>, dan gaat dat zakje er vanzelf af.</li>
</ol>
<p>Zakt het aantal zakjes onder je minimum, dan komt <b>1 doos</b> op je boodschappenlijst (niet het aantal zakjes). Na het winkelen vink je de doos af en tik je op <b>Klaar met winkelen</b>: bij <b>Hoeveel zakjes zitten erin?</b> staat het aantal al ingevuld, en die zakjes worden bij je voorraad geteld.</p>
<p><b>Ook in de catalogus.</b> Dezelfde instelling vind je bij <b>Catalogus</b> → het product → <b>Bewerken</b>. Ze geldt voor het hele product: wat je daar instelt, staat ook bij Bewerken in je voorraad, en omgekeerd. Zet je ze aan zonder minimum, dan wordt het vinkje <b>Minimum voor alle merken samen</b> aangezet met 1. Voeg je later een nieuwe verpakking van dat product toe, dan staat de grote verpakking al ingevuld.</p>
<p><b>Een doos gekocht zonder je lijst?</b> Tik op het product en kies <b>Doos erbij</b>: het aantal zakjes van één doos wordt meteen bij je voorraad geteld.</p>

<h3>Catalogus</h3>
<p>Het tabblad <b>Catalogus</b> toont alle producten die je ooit toevoegde, ook als ze op zijn, met een zoekveld. Onder het zoekveld kies je bij <b>Sorteren</b> (een uitklapmenu) hoe de lijst gesorteerd is: <b>Op naam (A–Z)</b> of <b>Op categorie</b>. Op categorie is elke categorie <b>uitklapbaar</b>: tik op een categorie om ze te openen of te sluiten; achter de naam staat hoeveel producten erin zitten. Producten zonder categorie staan onderaan bij <i>Zonder categorie</i>. Zoek je, dan staan alle categorieën open. Je keuze blijft bewaard op dit toestel. Bij wat je nu in huis hebt, staat <i>in huis</i>. Met <b>Toevoegen</b> zet je er zelf een product bij, zonder dat het in je voorraad komt. Tik op een product: van daaruit zet je het terug in je voorraad of op je lijst, <b>bewerk</b> je het (naam, aantal, verpakking klein of groot, categorie, plaats, inhoud, prijzen), of haal je het uit de catalogus. Geef je een product een nieuwe naam, dan verandert die ook in je voorraad en op je boodschappenlijst.</p>
<figure class="hl-foto"><img src="handleiding/catalogus.jpg" alt="De catalogus met zoekveld, sorteren en producten met hun prijs" width="390" height="780"><figcaption>De catalogus: alles wat je ooit toevoegde. Bij wat je nu hebt, staat <i>in huis</i>; in het groen de goedkoopste prijs en winkel.</figcaption></figure>
<p>Hetzelfde product mag <b>meermaals</b> in de catalogus, met een <b>ander merk</b>, een <b>andere inhoud</b> en/of een andere <b>verpakking</b> (klein of groot): bv. koffie van Douwe à 250 g, van Douwe à 500 g en van Lavazza à 1 kg, of een kleine en een grote fles shampoo. Elk staat als aparte regel in de lijst, met <i>klein</i> of <i>groot</i> achter de naam. Tik op een product en kies <b>Ander merk of inhoud toevoegen</b>, of gebruik <b>Toevoegen</b> met een naam die al bestaat. Categorie, plaats, houdbaarheid en prijzen gelden voor alle merken en inhouden samen (prijzen blijven per inhoud). Precies hetzelfde merk met dezelfde inhoud en dezelfde grootte kan maar één keer. De prijzen gelden per merk en inhoud, niet per grootte: geef een kleine en een grote verpakking dus best elk hun inhoud, dan krijgt elk een eigen prijs. Wat je aan je voorraad toevoegt met een nieuw merk of een nieuwe inhoud, komt vanzelf als extra regel in de catalogus.</p>

<h2>Boodschappen</h2>
<p>Op je boodschappenlijst komt wat je zelf toevoegt, wat onder je minimumvoorraad zakt en wat je vanuit een recept of de planner kiest.</p>

<h3>Toevoegen</h3>
<ul>
  <li><b>Snel:</b> typ bovenaan iets, bv. <code>2 l melk</code> of <code>6 eieren</code>, en tik op <b>+</b>. Hoeveelheid en eenheid worden herkend.</li>
  <li><b>Uit een lijst:</b> tik op de knop met het <b>lijstje</b>. Kies uit de producten in je catalogus (je ziet meteen het merk, de inhoud en wat je daarvan in huis hebt, per merk en inhoud; zoek met het <b>zoekveld</b> boven de lijst of door te typen bij <b>Wat</b>, ook op merk) of typ zelf iets, vul eventueel het <b>merk</b> in, kies bij <b>Verpakking</b> eventueel <b>Klein</b> of <b>Groot</b> (bij een product uit de catalogus staat dat al ingevuld), stel het aantal in met <b>−</b> en <b>+</b>, kies de eenheid en vul eventueel de <b>inhoud per stuk of pak</b> in (bv. pak à 500 g). Bij een gekend product staat die inhoud al ingevuld, maar je mag ze voor deze boodschap aanpassen. Heeft een product meer merken of inhouden, dan staat bovenaan ook <b>elk merk</b>: kies dat als je nog niet weet in welke winkel je gaat; de boodschap komt dan zonder merk en inhoud op je lijst. Vanuit de catalogus kan het ook, met <b>Op boodschappenlijst, elk merk</b>. Onder <b>Categorie, plaats, houdbaarheid en prijzen</b> vul je hetzelfde in als bij <b>Aan catalogus toevoegen</b>; dat wordt in de catalogus bewaard. Tik op <b>Toevoegen</b>. Het menu blijft open voor de volgende; tik op <b>Klaar</b> als je klaar bent.</li>
</ul>

<figure class="hl-foto"><img src="handleiding/boodschap-uit-lijst.jpg" alt="Het venster Boodschap toevoegen met de lijst Kies uit je catalogus, met wat je in huis hebt en wat al op je lijst staat" width="390" height="780"><figcaption>Met het <b>lijstje</b> naast <b>+</b>: kies uit je catalogus. Onder elk product staat wat je in huis hebt of wat al op je lijst staat; tik op <b>+</b> om het toe te voegen.</figcaption></figure>

<h3>Op de lijst</h3>
<ul>
  <li><b>− en +</b> naast een boodschap veranderen het aantal: per stuk, per 100 g of 100 ml, per 0,5 kg of 0,5 l.</li>
  <li>Tik op het <b>getal met de eenheid</b> (bv. 2 stuks, 500 g) om het aantal te typen en de eenheid te kiezen: stuks, g, kg, ml, l, pak, fles ...</li>
  <li>Tik op de <b>naam</b> om de boodschap te bewerken: naam, aantal, eenheid, inhoud, verpakking (klein of groot), prijzen per winkel, het product in je voorraad bewerken (of er een product van maken), of ze van de lijst halen.</li>
  <li><b>×</b> haalt een boodschap meteen weg.</li>
  <li>Een product mag <b>meermaals</b> op de lijst, met een andere hoeveelheid en inhoud: bv. 2 pak rijst à 500 g én 1 pak à 1 kg. Elke regel krijgt zijn eigen prijs. Voeg je iets toe met dezelfde inhoud, dan wordt het bij die regel bijgeteld. Na het winkelen komt elke inhoud als aparte regel in je voorraad.</li>
  <li>Een <b>kleine</b> en een <b>grote verpakking</b> blijven altijd aparte regels (met <i>klein</i> of <i>groot</i> achter de naam); ze worden nooit bij elkaar geteld. Wat onder je minimum zakt, komt op de lijst in dezelfde grootte.</li>
</ul>

<figure class="hl-foto"><img src="handleiding/boodschappen.jpg" alt="De boodschappenlijst met winkelknoppen, prijzen en − en + naast elke boodschap" width="390" height="780"><figcaption>De boodschappenlijst: bovenaan typ je een boodschap of kies je uit de lijst, daaronder de winkels. Tik op het rondje als iets in je mandje ligt.</figcaption></figure>

<h3>Winkels en prijzen</h3>
<ol>
  <li>Zet je winkels bij <b>Instellingen → Winkels</b> (bv. Colruyt, Delhaize, Aldi).</li>
  <li>Vul bij een product de prijs per winkel in: bij <b>Bewerken → Prijs per winkel</b>, of door op de prijs (of <b>Prijs invullen</b>) onder een boodschap te tikken.</li>
  <li>Kies bij <b>Prijs per</b> de eenheid zoals op het prijskaartje: per kg, per l, per stuk, per pak … Koop je per pak maar staat de prijs per kg, vul dan ook de inhoud per pak in, anders kan de app de prijs niet berekenen.</li>
  <li>De prijs geldt <b>per inhoud</b>: een pak à 500 g kan per kg duurder zijn dan een pak à 1 kg. In het venster <b>Prijzen</b> staat elke inhoud apart; met <b>+ Prijs voor een andere inhoud</b> voeg je er een toe. In een formulier gelden de prijzen voor de inhoud die erboven staat. Heeft een inhoud geen eigen prijs, dan gebruikt de app de prijs zonder inhoud (als die er is).</li>
  <li>Je kunt ook een prijs <b>per merk</b> invullen: koffie van Lavazza is vaak duurder dan die van het huismerk. In het venster <b>Prijzen</b> staat elk merk (en elke inhoud) apart; met <b>+ Prijs voor een ander merk of een andere inhoud</b> voeg je er een toe. In een formulier gelden de prijzen voor het merk en de inhoud die erboven staan. Heeft een merk geen eigen prijs, dan gebruikt de app de prijs zonder merk. Op de <b>boodschappenlijst</b> staan onder een boodschap de prijzen van de merken (goedkoopste winkel per merk, voor dezelfde hoeveelheid); tik op een merk om het voor die boodschap te kiezen. Ook in de <b>catalogus</b> staat bij elk merk en elke inhoud de goedkoopste prijs en winkel; tik erop voor alle prijzen per merk.</li>
</ol>
<figure class="hl-foto"><img src="handleiding/prijzen.jpg" alt="Het venster Prijzen van melk met de prijs per liter bij Colruyt en Aldi" width="390" height="780"><figcaption>Prijzen invullen: kies bij <b>Prijs per</b> de eenheid van het prijskaartje en vul per winkel de prijs in.</figcaption></figure>
<p>Daarna verschijnt bovenaan een grijs kader <b>Winkel</b> met knoppen: <b>Alles</b> en één per winkel. Het staat standaard open; met <b>Verbergen</b> klap je het dicht (de gekozen winkel blijft ernaast staan), met <b>Tonen</b> weer open. Elk product staat op Alles én bij de winkel waar het het goedkoopst is. Een product komt op de lijst van een winkel zodra er bij dat product een prijs ingevuld is, bij één of meer winkels. Heeft het merk of de inhoud van de boodschap geen eigen prijs (bv. de boodschap staat er zonder merk, of je vulde alleen een prijs in voor een pak à 250 g), dan kiest de app de goedkoopste winkel van hetzelfde merk, of anders van het product. Het blijft dezelfde boodschap: afvinken op de ene lijst vinkt ze ook af op de andere. Boven de lijst staat de geschatte totaalprijs.</p>

<h3>Winkelen</h3>
<ol>
  <li>Vink af wat in je mandje ligt door op het <b>rondje</b> te tikken. Het schuift naar <b>In je mandje</b>.</li>
  <li>Tik op <b>Klaar met winkelen</b>.</li>
  <li>Controleer per product hoeveelheid, eenheid en plaats, en vul de houdbaarheidsdatum in als je die bij de hand hebt. Staat een product er zonder merk en inhoud op (bv. <b>elk merk</b> of door je minimumvoorraad), kies dan wat je gekocht hebt: <b>Zonder merk of inhoud</b>, een merk en inhoud uit je catalogus, of <b>Ander merk of inhoud invullen…</b>. Bij dat laatste vul je zelf merk, inhoud per stuk en eventueel uitlekgewicht in; dat komt dan ook in je catalogus. Staat er <i>klein</i> of <i>groot</i> bij, dan zie je alleen merken en inhouden van die grootte. Het product wordt alleen bijgeteld bij een voorraadregel met hetzelfde merk, dezelfde inhoud en dezelfde grootte (een grote verpakking dus bij je grote verpakkingen); de app neemt nooit vanzelf een merk of inhoud over die je niet koos.</li>
  <li>Tik op <b>In voorraad zetten</b>. Wil je de producten niet in je voorraad, tik dan op <b>Alleen van lijst halen</b>.</li>
</ol>
<figure class="hl-foto"><img src="handleiding/winkelen.jpg" alt="Het venster In je voorraad zetten na Klaar met winkelen" width="390" height="780"><figcaption>Na <b>Klaar met winkelen</b>: controleer per product het aantal, de plaats en de datum, en tik op <b>In voorraad zetten</b>.</figcaption></figure>
<p>Sta je op een winkeltabblad, dan rond je alleen de producten van die winkel af.</p>

<h2>Recepten</h2>
<p>Bij elk recept toont de app hoeveel ingrediënten je in huis hebt, bv. <b>5/7</b>. Zout, peper en water tellen niet mee.</p>

<figure class="hl-foto"><img src="handleiding/recepten.jpg" alt="Het receptenscherm met zoekveld, filters en recepten per soort" width="390" height="780"><figcaption>Het receptenscherm: zoeken, filters en bovenaan de recepten die gebruiken wat binnenkort op moet. Met <b>+</b> voeg je een recept toe.</figcaption></figure>

<h3>Een recept toevoegen</h3>
<p>Tik op <b>Recept</b> en kies:</p>
<ul>
  <li><b>Pdf kiezen:</b> de tekst wordt op je toestel gelezen (hoogstens 15 pagina's); het bestand zelf wordt niet bewaard. Daarna zie je <b>Klopt dit?</b> met wat herkend is: verbeter waar nodig. Onder <b>Herkende tekst</b> kun je de ruwe tekst aanpassen en op <b>Opnieuw verdelen</b> tikken.</li>
  <li><b>Zelf typen:</b> vul alles zelf in.</li>
</ul>
<p>Foto's en gescande pdf's kunnen voorlopig niet ingelezen worden. Krijg je de melding dat er geen leesbare tekst in de pdf staat, typ het recept dan zelf.</p>

<figure class="hl-foto"><img src="handleiding/recept-toevoegen.jpg" alt="Het venster Recept toevoegen met Pdf kiezen en Zelf typen" width="390" height="780"><figcaption>Een recept toevoegen: uit een pdf of zelf typen.</figcaption></figure>

<h3>Wat je invult</h3>
<ul>
  <li><b>Titel</b>, <b>personen</b> en <b>bereidingstijd</b>.</li>
  <li><b>Soort gerecht</b>: één keuze, bv. Hoofdgerecht of Soep. Nog eens tikken = geen soort.</li>
  <li><b>Categorieën</b>: meerdere mogelijk, bv. Vegetarisch en Snel. Een nieuwe typ je onder <b>Andere categorie</b>.</li>
  <li><b>Ingrediënten</b>: hoeveelheid, eenheid en naam. Met <b>In voorraad als</b> koppel je een ingrediënt aan een product, bv. "verse room" aan "Room". De app onthoudt die koppeling voor andere recepten.</li>
  <li><b>Bereiding</b>: één stap per regel. En eventueel <b>notities</b>.</li>
</ul>

<h3>Recepten vinden</h3>
<ul>
  <li><b>Zoeken</b> op titel, soort, categorie of ingrediënt.</li>
  <li><b>Filters</b>: de filterknoppen staan in een grijs kader bovenaan, standaard open. Met <b>Verbergen</b> klap je ze dicht (het actieve filter blijft ernaast staan), met <b>Tonen</b> weer open: Favorieten, <b>Alles in huis</b> (recepten waarvoor je niets moet kopen), een soort gerecht of een categorie. Nog eens tikken zet een filter uit.</li>
  <li>Zonder zoeken of filter staan je recepten per soort gerecht; tik op een soort om ze open of dicht te klappen.</li>
  <li><b>Gebruikt wat op moet</b> toont tot drie recepten met producten die binnenkort vervallen.</li>
</ul>

<h3>Een recept openen</h3>
<ul>
  <li>Pas het aantal <b>personen</b> aan met <b>−</b> en <b>+</b>; de hoeveelheden rekenen mee.</li>
  <li>Bij elk ingrediënt zie je of het <b>niet in huis</b> is of dat je <b>te weinig</b> hebt.</li>
  <li><b>Favoriet maken</b>: de ster.</li>
  <li><b>Scherm blijft aan</b>: zolang het recept open staat, gaat het scherm niet op stand-by, zodat je tijdens het koken niets hoeft aan te raken. Tik erop om het voor dit recept uit (of aan) te zetten. Wat standaard gebeurt, kies je bij Instellingen → <b>Scherm aan laten</b>.</li>
  <li><b>Gekookt</b>: kies hoeveel van elk ingrediënt van je voorraad afgaat en tik op <b>Aftrekken</b>. Wat het eerst vervalt, gaat eerst.</li>
  <li><b>Op boodschappenlijst…</b>: wat ontbreekt staat al aangevinkt. Pas aan, tik op <b>Alles aanvinken</b> of <b>Niets aanvinken</b> en dan op <b>… toevoegen</b>.</li>
  <li><b>Inplannen…</b>: zet het recept in de maaltijdplanner.</li>
  <li><b>Bewerken</b> of <b>Verwijderen</b> staan onderaan.</li>
</ul>

<figure class="hl-foto"><img src="handleiding/recept.jpg" alt="Een geopend recept met personen, Scherm blijft aan, ingrediënten en de knoppen Gekookt, Op boodschappenlijst en Inplannen" width="390" height="780"><figcaption>Een recept geopend: wat <i>niet in huis</i> is, staat in het grijs. Daaronder <b>Gekookt</b>, <b>Op boodschappenlijst…</b> en <b>Inplannen…</b>.</figcaption></figure>

<h2>Maaltijdplanner</h2>
<p>De planner toont één week, van maandag tot zondag. Met <b>‹</b> en <b>›</b> ga je naar een andere week; <b>Terug naar deze week</b> brengt je terug.</p>

<h3>Een maaltijd plannen</h3>
<ol>
  <li>Tik bij een dag op <b>+ Plannen</b>, of open een recept en tik op <b>Inplannen…</b>.</li>
  <li>Kies de dag (of <b>Vandaag</b> / <b>Morgen</b>) en de maaltijd: Ontbijt, Lunch of Avondeten. Standaard staat de laatste vrije maaltijd van die dag aangeduid.</li>
  <li>Kies <b>Uit je recepten</b> (zoek een recept en stel het aantal personen in) of <b>Zelf typen</b>, bv. restjes of uit eten.</li>
  <li>Tik op <b>Inplannen</b>.</li>
</ol>
<figure class="hl-foto"><img src="handleiding/maaltijd-plannen.jpg" alt="Het venster Maaltijd plannen met dag, maaltijd en een lijst recepten" width="390" height="780"><figcaption>Een maaltijd plannen: kies de dag, de maaltijd en een recept (of typ zelf iets), en tik op <b>Inplannen</b>.</figcaption></figure>
<p>Rechts van een geplande maaltijd staat hoeveel ingrediënten je in huis hebt, bv. <b>3/5</b>. Oranje betekent dat er iets ontbreekt.</p>

<figure class="hl-foto"><img src="handleiding/planner.jpg" alt="De maaltijdplanner met een week, Plannen per dag en geplande maaltijden" width="390" height="780"><figcaption>De planner: per dag <b>+ Plannen</b>. Rechts van een maaltijd hoeveel ingrediënten je in huis hebt (oranje: er ontbreekt iets).</figcaption></figure>
<h3>Een geplande maaltijd</h3>
<p>Tik erop om:</p>
<ul>
  <li>het <b>recept te bekijken</b>;</li>
  <li>ze als <b>Gekookt</b> aan te duiden: de ingrediënten gaan van je voorraad af (zoals bij een recept);</li>
  <li>de <b>ingrediënten op je boodschappenlijst</b> te zetten;</li>
  <li>ze te <b>wijzigen of verplaatsen</b> naar een andere dag of maaltijd;</li>
  <li>ze <b>uit de planning te halen</b> (met Ongedaan maken).</li>
</ul>
<p>Per ongeluk op gekookt gezet? Tik dan op <b>Toch nog niet gekookt</b>.</p>

<h3>Boodschappen voor de hele week</h3>
<p>Tik bovenaan op <b>Boodschappen voor … maaltijden</b>. De app telt de ingrediënten van alle recepten die deze week nog gekookt moeten worden samen, rekening houdend met het aantal personen. Wat ontbreekt, staat aangevinkt; jij kiest wat op de lijst komt.</p>
<p>De maaltijden zelf (bv. een Vieruurtje erbij) pas je aan bij <b>Instellingen → Maaltijden in de planner</b>.</p>

<figure class="hl-foto"><img src="handleiding/week-boodschappen.jpg" alt="Het venster Op boodschappenlijst voor de maaltijden van deze week, met aangevinkt wat ontbreekt" width="390" height="780"><figcaption>Boodschappen voor de week: wat ontbreekt staat aangevinkt, wat je in huis hebt niet. Pas aan en tik op <b>… toevoegen</b>.</figcaption></figure>

<h2>Instellingen</h2>
<p>Bij <b>Instellingen</b> stel je de waarschuwingen in en beheer je je eigen lijsten. Wijzigingen worden meteen bewaard.</p>

<h3>Scherm aan laten</h3>
<p>Kies of het scherm van dit toestel niet op stand-by mag gaan: <b>Bij een recept</b> (standaard: zolang een recept open staat, handig tijdens het koken), <b>Altijd</b> (zolang de app open is; kost meer batterij) of <b>Nooit</b>. Dit geldt alleen voor het toestel waarop je het instelt. Ga je naar een andere app of vergrendel je zelf het scherm, dan gaat het gewoon uit; kom je terug in het recept, dan blijft het weer aan. Lukt het niet (oude browser, of batterijbesparing staat aan), dan staat dat bij Instellingen; stel dan op je toestel zelf in dat het scherm later uitgaat.</p>

<h3>Waarschuwen, zoveel dagen vooraf</h3>
<p>Met <b>−</b> en <b>+</b> kies je hoeveel dagen voor de datum een product bij <b>Op te gebruiken</b> verschijnt: apart voor <i>Te gebruiken tot</i> en <i>Ten minste houdbaar tot</i> (0 tot 60 dagen).</p>

<h3>Meldingen</h3>
<p>Bij <b>Venster bij het openen van de app</b> kies je <b>Aan</b> (standaard) of <b>Uit</b>. Bij <b>Melding op dit toestel</b> tik je op <b>Aanzetten</b> om een melding te krijgen als een product op moet (zie <i>Een melding als een product op moet</i>), en met <b>Proefmelding</b> zie je meteen hoe ze eruitziet. Daaronder staat of dit toestel ook kan nakijken als de app dicht is. Beide gelden alleen voor het toestel waarop je ze instelt. Staat er dat meldingen <i>geblokkeerd</i> zijn, sta ze dan toe in de instellingen van je browser of toestel (bij de site of de app Voorraad).</p>

<h3>Je lijsten</h3>
<p>Acht lijsten klap je open door erop te tikken. Ze werken allemaal op dezelfde manier.</p>
<table>
  <tr><th>Lijst</th><th>Waarvoor</th><th>Bij de start</th></tr>
  <tr><td>Plaatsen</td><td>Waar een product ligt</td><td>Koelkast, Diepvries, Voorraadkast</td></tr>
  <tr><td>Productcategorieën</td><td>Soort product</td><td>Groenten, Fruit, Zuivel &amp; eieren …</td></tr>
  <tr><td>Winkels</td><td>Prijzen en winkeltabbladen</td><td>Leeg</td></tr>
  <tr><td>Soorten gerechten</td><td>Indeling van recepten (één per recept)</td><td>Ontbijt, Soep, Hoofdgerecht, Dessert …</td></tr>
  <tr><td>Receptcategorieën</td><td>Extra labels voor recepten</td><td>Vegetarisch, Vlees, Vis, Pasta, Snel, Feestelijk</td></tr>
  <tr><td>Maaltijden in de planner</td><td>Momenten per dag</td><td>Ontbijt, Lunch, Avondeten</td></tr>
  <tr><td>Eenheden</td><td>Waarin je voorraad en boodschappen telt</td><td>stuks, g, kg, ml, cl, dl, l, pak, blik, fles, pot, zak, doos</td></tr>
  <tr><td>Eenheden voor de inhoud</td><td>De inhoud per stuk of verpakking (bv. pak à 500 g)</td><td>g, kg, ml, cl, dl, l</td></tr>
</table>
<p><b>Eenheden</b>: voeg je eigen eenheid toe, bv. <i>bokaal</i>, <i>tube</i> of <i>rol</i>. Die kun je daarna overal kiezen (voorraad, boodschappen, prijs per …, recepten) en herkent de app ook als je bovenaan bij Boodschappen <code>2 bokaal augurken</code> typt. Een eigen eenheid telt als verpakking: je kunt er een inhoud per stuk bij invullen (bv. bokaal à 350 g). Een eigen eenheid kun je hernoemen; de standaardeenheden (g, kg, l …) niet, want daarmee rekent de app. Verwijder je een eenheid, dan kun je ze niet meer kiezen, maar producten die ze al hebben, houden ze. <i>stuks</i> kun je niet verwijderen.</p>
<p><b>Eenheden voor de inhoud</b>: dit zijn de eenheden bij <b>Eenheid inhoud</b>. Voeg er zelf toe, bv. <i>vel</i> (rol à 200 vel), <i>wasbeurt</i> (doos à 40 wasbeurten) of <i>tablet</i>. Zo'n eigen eenheid rekent de app niet om naar g of l, maar je kunt er wel een prijs per vel of per wasbeurt voor invullen. Hernoemen en verwijderen werkt zoals bij Eenheden; er moet er minstens één overblijven.</p>
<p><b>Meteen in een formulier</b>: in elke keuzelijst voor een eenheid of de eenheid van de inhoud staat onderaan <b>Andere eenheid…</b>. Kies die, typ de naam en tik op <b>Toevoegen</b>: de eenheid wordt meteen gekozen en bewaard bij Instellingen, zodat je ze later weer kunt kiezen. Verwijderen doe je bij Instellingen.</p>
<figure class="hl-foto"><img src="handleiding/instellingen.jpg" alt="De lijst Plaatsen opengeklapt bij Instellingen, met hernoemen, pijltjes en kruisjes" width="390" height="780"><figcaption>Een lijst opengeklapt bij Instellingen: tik op een naam om die te wijzigen, <b>↑</b> zet hem hoger, <b>×</b> verwijdert hem.</figcaption></figure>
<ul>
  <li><b>Toevoegen</b>: typ onderaan een naam en tik op <b>+</b>.</li>
  <li><b>Hernoemen</b>: tik op een naam. De nieuwe naam komt ook bij al je producten of recepten.</li>
  <li><b>Volgorde</b>: met <b>↑</b> zet je een naam hoger. In die volgorde verschijnt hij overal in de app.</li>
  <li><b>Verwijderen</b>: tik op <b>×</b>. Wordt de naam gebruikt, dan zegt de app eerst hoeveel producten of recepten het raakt. Een winkel verwijderen wist ook de prijzen bij die winkel.</li>
</ul>

<h3>Overzicht</h3>
<p>Onder <b>Overzicht</b> zie je wat je het vaakst weggooit, koopt en kookt.</p>

<h3>De handleiding lezen</h3>
<p>Tik bij <b>Instellingen</b> op <b>Handleiding lezen</b>. Bovenaan staat de <b>inhoud</b>: tik op een thema (bv. Boodschappen) om het te openen. Je kunt ook op de titel van een thema tikken om het open of dicht te klappen. In een geopend thema staan bovenaan de onderwerpen; tik erop om er meteen naartoe te gaan. Met <b>Alles openklappen</b> zie je de hele handleiding, met <b>↑ Naar de inhoud</b> ga je terug naar boven. De <b>schermafbeeldingen</b> tonen hoe het eruitziet; tik op een afbeelding om ze groter te zien, en nog eens om ze weer klein te maken.</p>

<h3>Handleiding downloaden of afdrukken</h3>
<p>Bij <b>Instellingen → Handleiding</b>, en onderaan de handleiding zelf, staan twee knoppen. De pdf en de afgedrukte versie bevatten altijd de volledige handleiding.</p>
<ul>
  <li><b>Pdf downloaden</b>: bewaart deze handleiding als pdf-bestand op je toestel, bv. om door te sturen of later te lezen. De pdf wordt op je toestel zelf gemaakt, ook zonder internet.</li>
  <li><b>Afdrukken</b>: opent het afdrukvenster met alleen de handleiding, zonder de rest van de app. Daar kun je ook <b>Opslaan als pdf</b> kiezen.</li>
</ul>

<h2>Je gegevens bewaren</h2>
<p>Je gegevens staan in de opslag van de browser op dit toestel. Verwijder je de app of wis je de websitegegevens, dan zijn ze weg. Zorg dus altijd voor een back-up.</p>

<h3>Wat kan op welk toestel</h3>
<table>
  <tr><th>Manier</th><th>Laptop (Chrome/Edge)</th><th>Android</th><th>iPhone/iPad</th></tr>
  <tr><td>Automatische back-up in Downloads</td><td>Ja, standaard aan</td><td>Ja, standaard aan</td><td>Kan, standaard uit</td></tr>
  <tr><td>Bewaren in een bestand</td><td>Ja</td><td>Nee</td><td>Nee</td></tr>
  <tr><td>Zelf een back-up downloaden</td><td>Ja</td><td>Ja</td><td>Ja</td></tr>
  <tr><td>Synchroniseren tussen toestellen</td><td>Ja</td><td>Ja</td><td>Ja</td></tr>
</table>

<h3>Automatische back-up</h3>
<p>Elke dag dat je iets wijzigt, zet de app bij de eerste wijziging van die dag een back-up in <b>Downloads</b>. Oude back-ups mag je verwijderen; de nieuwste is genoeg. Aan- of uitzetten: <b>Instellingen → Automatische back-up</b>.</p>

<h3>Bewaren in een bestand (laptop)</h3>
<ol>
  <li>Ga naar <b>Instellingen → Bewaren in een bestand → Nieuw bestand maken</b>.</li>
  <li>Kies waar het bestand komt, bv. Documenten of een map die met Google Drive of OneDrive gesynchroniseerd wordt.</li>
  <li>Daarna schrijft de app elke wijziging vanzelf ook in dat bestand.</li>
</ol>
<p>Vraagt Chrome na het herstarten opnieuw toestemming, kies dan <b>Toestaan bij elk bezoek</b>. Gebruik hetzelfde bestand niet tegelijk op twee toestellen: het toestel dat het laatst iets wijzigt, overschrijft het.</p>

<figure class="hl-foto"><img src="handleiding/backup.jpg" alt="Bij Instellingen: Automatische back-up, Bewaren in een bestand en Back-up" width="390" height="691"><figcaption>Bij Instellingen: <b>Automatische back-up</b>, <b>Bewaren in een bestand</b> en daaronder <b>Back-up downloaden</b> en <b>Back-up terugzetten</b>.</figcaption></figure>

<h3>Zelf een back-up maken of terugzetten</h3>
<ul>
  <li><b>Back-up downloaden</b> maakt een bestand <code>voorraad-backup-….json</code>.</li>
  <li><b>Voorraad als CSV</b> geeft je voorraad als tabel, bv. voor Excel.</li>
  <li><b>Back-up terugzetten</b>: kies het .json-bestand. Je ziet eerst hoeveel producten, recepten en boodschappen erin zitten. Let op: al je huidige gegevens op dat toestel worden vervangen.</li>
</ul>
<p>Is je laatste back-up meer dan 14 dagen oud en staat de automatische back-up uit, dan herinnert de app je eraan bij het openen.</p>

<h3>Synchroniseren tussen toestellen</h3>
<p>Houd je voorraad, boodschappen, recepten en planning gelijk op al je toestellen. Je koppelt ze met een geheime code; er is geen account of wachtwoord. Alles wordt op het toestel zelf versleuteld, de server kan je gegevens niet lezen. De server moet eenmalig geplaatst worden (zie de LEESMIJ).</p>
<ol>
  <li>Op je eerste toestel: <b>Instellingen → Synchroniseren tussen toestellen → Synchronisatie aanzetten</b>. Je ziet een QR-code en een code van 32 tekens.</li>
  <li>Op elk ander toestel: <b>Instellingen → QR-code scannen</b> en richt de camera op de QR-code van je eerste toestel. De app vraagt de eerste keer toestemming om de camera te gebruiken. Of kies <b>Koppelen met een code</b> en typ de code.</li>
  <li>Staan er op het nieuwe toestel al gegevens, kies dan <b>Samenvoegen</b> (alles houden) of <b>Vervangen</b> (de gegevens van je andere toestellen nemen).</li>
</ol>
<ul>
  <li>Daarna gaat elke wijziging vanzelf naar je andere toestellen. Zonder internet werk je gewoon verder; je wijzigingen gaan mee zodra er weer verbinding is.</li>
  <li>Wijzig je op twee toestellen tegelijk, dan gaat er niets verloren: elke wijziging wordt apart samengevoegd.</li>
  <li>Scan de QR-code met <b>QR-code scannen</b> in de app, niet met de gewone camera-app: op een iPhone opent die de code in Safari in plaats van in de app.</li>
  <li>Later nog een toestel koppelen: <b>Toestel koppelen</b> toont de code opnieuw.</li>
  <li>Houd de code geheim: wie ze heeft, kan je gegevens lezen. Bewaar ze wel op een veilige plek: ben je al je toestellen kwijt, dan haal je er alles mee terug.</li>
  <li>Een gezin dat één voorraad deelt, koppelt alle toestellen met dezelfde code. Wie apart wil, zet zelf synchronisatie aan en krijgt een eigen code.</li>
  <li><b>Stoppen</b> stopt alleen dit toestel. Kies je daarna ook <b>Ook wissen</b>, dan gaat alles van de server en stoppen ook je andere toestellen; hun gegevens blijven staan.</li>
</ul>

<figure class="hl-foto breed"><img src="handleiding/synchroniseren.jpg" alt="Bij Instellingen: Synchroniseren tussen toestellen met Synchronisatie aanzetten, QR-code scannen en Koppelen met een code" width="390" height="325"><figcaption>Bij Instellingen: <b>Synchronisatie aanzetten</b> op je eerste toestel; op een ander toestel <b>QR-code scannen</b> of <b>Koppelen met een code</b>.</figcaption></figure>

<h3>Moet ik opnieuw koppelen?</h3>
<p>Nee. Je koppelt een toestel één keer. De app onthoudt de koppeling op het toestel en synchroniseert daarna vanzelf, ook na het sluiten van de app, het herstarten van het toestel of een nieuwe versie van de app.</p>
<p>Alleen in deze gevallen koppel je opnieuw:</p>
<ul>
  <li><b>De opslag van de app is gewist</b>: je hebt de app verwijderd, de websitegegevens gewist, of je hebt een nieuw toestel. Dan zijn de koppeling én de gegevens op dat toestel weg. Koppel opnieuw met de code: alles komt terug van de server.</li>
  <li><b>Iemand koos op een toestel Stoppen → Ook wissen.</b> Dan stoppen alle toestellen. Zet de synchronisatie opnieuw aan; je krijgt een nieuwe code.</li>
  <li><b>Je hebt zelf Stoppen gekozen</b> op een toestel. Dan stopt alleen dat toestel.</li>
</ul>
<p><b>iPhone/iPad:</b> gebruik de app vanaf je beginscherm, niet in Safari. Safari wist de gegevens van een website die je een week niet geopend hebt; een app op het beginscherm niet.</p>
<p><b>Tip:</b> bewaar de code op een veilige plek, bv. in je wachtwoordbeheerder. Ben je ze kwijt maar heb je nog een gekoppeld toestel, dan toont <b>Toestel koppelen</b> daar de code opnieuw.</p>

<h3>Eenmalig naar een ander toestel</h3>
<p>Zonder synchronisatie heeft elk toestel zijn eigen voorraad. Maak op het ene toestel een back-up, stuur het bestand naar het andere toestel (bv. via mail of Drive) en kies daar <b>Back-up terugzetten</b>. Op een nieuwe laptop met een gekoppeld bestand kies je <b>Bestaand bestand openen</b>.</p>

<h3>Nieuwe versie</h3>
<p>Komt er een nieuwe versie van de app, dan verschijnt de melding <b>Er is een nieuwe versie</b>. Tik op <b>Vernieuwen</b>. Je gegevens blijven gewoon staan.</p>

<h2>Vragen en problemen</h2>
<table>
  <tr><th>Probleem</th><th>Oplossing</th></tr>
  <tr><td>Ik zie mijn producten niet op het voorraadscherm</td><td>Normaal: daar staat alleen wat op moet of op is. Zoek bovenaan op de naam, of open het tabblad Catalogus.</td></tr>
  <tr><td>Mijn pdf wordt niet ingelezen</td><td>Bevat de pdf alleen een scan of foto, dan is er geen leesbare tekst. Typ het recept zelf.</td></tr>
  <tr><td>Het recept is verkeerd verdeeld</td><td>Verbeter het in het scherm <b>Klopt dit?</b>, of pas de <b>Herkende tekst</b> aan en tik op <b>Opnieuw verdelen</b>.</td></tr>
  <tr><td>Een ingrediënt staat op "niet in huis" terwijl ik het heb</td><td>Bewerk het recept en kies bij <b>In voorraad als</b> het juiste product.</td></tr>
  <tr><td>De prijs van een boodschap wordt niet berekend</td><td>Vul bij het product de inhoud per stuk of pak in, of kies een prijs-eenheid die past (bv. per stuk).</td></tr>
  <tr><td>Op mijn telefoon staan andere gegevens dan op mijn laptop</td><td>Zet synchroniseren tussen toestellen aan, of zet de gegevens over met een back-up. Synchroniseer je al: kijk bij Instellingen of er een foutmelding staat en tik op <b>Nu synchroniseren</b>.</td></tr>
  <tr><td>Melding "deze browser bewaart je gegevens niet"</td><td>Je gebruikt een privévenster. Open de app in een gewoon venster of installeer ze.</td></tr>
  <tr><td>"De app kon niet starten"</td><td>Herlaad de pagina en gebruik geen privévenster.</td></tr>
  <tr><td>Het scherm gaat uit tijdens het koken</td><td>Kijk in het recept of <b>Scherm blijft aan</b> groen is en of bij Instellingen → <b>Scherm aan laten</b> niet op <b>Nooit</b> staat. Staat batterijbesparing aan, dan kan het toestel het scherm toch uitzetten.</td></tr>
  <tr><td>Mijn kleine en grote verpakkingen worden niet samengeteld, of staan twee keer op de lijst</td><td>Zo hoort het: een kleine en een grote verpakking zijn aparte voorraden, elk met een eigen minimum. Wil je ze toch samen tellen, kies dan bij <b>Bewerken</b> → <b>Verpakking</b> voor allebei <b>Niet opgegeven</b>.</td></tr>
  <tr><td>Iets per ongeluk weggegooid of verwijderd</td><td>Tik meteen op <b>Ongedaan maken</b> in de melding onderaan.</td></tr>
</table>
<p>Barcodes scannen en recepten van een foto inlezen staan in deze versie uit.</p>
`;

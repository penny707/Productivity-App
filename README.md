# Productivity App

Lokale schooltaak-tracker. Je houdt je taken per vak bij, met harde deadlines
en persoonlijke streefmomenten. Alles wordt opgeslagen in een SQLite-database
(`data.db`) in deze map. Er gaat niets naar het internet.

## Eerste keer instellen

1. Installeer **Python 3.8 of nieuwer** via https://www.python.org/downloads/
   en vink tijdens de installatie **"Add Python to PATH"** aan.
2. Dubbelklik op **`snelkoppeling_maken.bat`**.
   Er verschijnt een icoon **"Productivity App"** op je bureaublad.

## Starten en stoppen

- **Starten:** dubbelklik op het bureaubladicoon. De app opent in een eigen
  venster (Microsoft Edge in app-modus, zonder adresbalk). Er verschijnt geen
  zwart venster: de server draait onzichtbaar op de achtergrond.
- **Nog eens dubbelklikken** terwijl de app draait opent gewoon een nieuw
  venster. Er start geen tweede server.
- **Venster sluiten** = de app blijft op de achtergrond klaarstaan (verbruikt
  bijna niets). Dubbelklik op het icoon en je bent meteen terug.
- **Echt afsluiten:** de aan/uit-knop onderaan in de zijbalk. Bij het
  afmelden of herstarten van je pc stopt de app ook vanzelf.

Voor foutzoeken: `start_app.bat` start de app mét zwart consolevenster, zodat
je eventuele foutmeldingen ziet.

## Je gegevens en backups

- Je gegevens staan in `data.db` in deze map.
- **Automatische backup:** bij het starten (en daarna elk uur dat de app
  draait) wordt één backup per dag gemaakt in de map `backups/`, bv.
  `backups/data-2026-10-23.db`. De laatste 14 worden bewaard.
- **Backup terugzetten:** sluit de app af, kopieer de gewenste backup naar
  deze map en hernoem die naar `data.db`.
- Wil je extra veilig zijn, kopieer dan af en toe de map `backups/` naar
  OneDrive of een USB-stick.
- `data.db` en `backups/` staan in `.gitignore`: je gegevens komen nooit
  op GitHub.

## Gebruik

- **Overzicht:** blokken per vak met voortgangsbalk en percentage.
  Klik op een blok om het vak te openen.
- **Vak:** klik op een onderdeel om het open of dicht te klappen.
  Voeg onderdelen en sub-onderdelen toe (zo diep als je wilt).
- **Taken:** per onderdeel. Type = opdracht / theorie / labo.
  Vink af wanneer klaar. Wijzigen via het potlood-icoon.
- **Deadline** = moet echt af zijn. **Streefmoment** = je persoonlijke doel.
  Beide zijn optioneel en staan los van elkaar.
- **Deadlines-pagina:** twee tabs, een voor harde deadlines en een voor
  streefmomenten.
- **Thema:** knop onderaan in de zijbalk wisselt tussen Grey / Light / Dark.
- **Zijbalk:** de knop linksboven klapt de navigatie in en uit.

## Mapstructuur

```
Productivity App\
  app.py                  de server (alleen Python-standaardbibliotheek)
  start_app.pyw           starter zonder consolevenster (voor het icoon)
  start_app.bat           starter mét consolevenster (voor foutzoeken)
  maak_snelkoppeling.py   maakt het bureaubladicoon
  snelkoppeling_maken.bat dubbelklik-versie van het script hierboven
  data.db                 jouw gegevens (niet in git)
  backups\                automatische dagelijkse backups (niet in git)
  static\
    index.html, style.css, app.js
    icon.ico, icon.png    app-icoon
```

## Problemen?

- **Er gebeurt niets bij dubbelklikken:** start `start_app.bat` en lees de
  melding in het zwarte venster. Fouten van de icoon-starter komen in
  `fout.log`.
- **"Python is niet gevonden":** installeer Python met "Add Python to PATH",
  of herstart je pc.
- **"Poort 8765 is al in gebruik":** een ander programma gebruikt die poort.
  Herstart je pc.
- **"Geen verbinding met de app":** de server is gestopt. Dubbelklik op het
  icoon om ze opnieuw te starten.
- **Icoon werkt niet meer na het verplaatsen van deze map:** dubbelklik
  opnieuw op `snelkoppeling_maken.bat`.

## Privacy

De app luistert alleen op 127.0.0.1 (je eigen pc) en aanvaardt enkel
verzoeken die van daar komen. Er is geen internetverbinding nodig.

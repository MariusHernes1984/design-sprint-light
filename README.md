# Design Sprint Light

Digital plattform for AI-assisterte Design Sprint Light-workshops. Bygget for Atea-konsulenter som fasiliterer AI-workshops med kommuner og virksomheter.

Plattformen digitaliserer hele workshop-flyten: fra hjemmelekse og utfordringsinnsamling, via AI-assistert klynging og HKV-generering, til idemyldring, prioritering og idecanvas.

## Teknisk stack

| Komponent | Teknologi |
|-----------|-----------|
| Frontend | React 19, TypeScript, Vite 6 |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 16, Prisma 6 ORM |
| Sanntid | Socket.IO 4 (WebSocket) |
| AI | Azure OpenAI (via OpenAI SDK) |
| PDF-eksport | jsPDF + jspdf-autotable |
| Autentisering | JWT + bcryptjs |
| Hosting | Azure App Service (B2 Linux) |

## Kom i gang

### Forutsetninger

- Node.js 20+
- Docker (for lokal PostgreSQL)
- Azure OpenAI-tilgang

### 1. Installer avhengigheter

```bash
npm install
```

### 2. Start database

```bash
docker-compose up -d
```

Dette starter PostgreSQL 16 pa `localhost:5432` med database `design_sprint_light`.

### 3. Konfigurer miljovariabler

```bash
cp .env.example .env
```

Rediger `.env` med dine verdier:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/design_sprint_light"
JWT_SECRET="endre-til-en-tilfeldig-hemmelighet"
AZURE_OPENAI_ENDPOINT="https://din-ressurs.openai.azure.com"
AZURE_OPENAI_API_KEY="din-api-nokkel"
AZURE_OPENAI_DEPLOYMENT="gpt-4o"
AZURE_OPENAI_API_VERSION="2024-10-21"
PORT=3001
```

> **Viktig:** `JWT_SECRET` er paakrevd. Appen vil ikke starte uten denne variabelen.

### 4. Kjor migrasjoner

```bash
npm run db:migrate
```

### 5. Start utviklingsserver

```bash
npm run dev
```

Frontend kjorer pa `http://localhost:5173`, backend pa `http://localhost:3001`. Vite proxyer API-kall og WebSocket automatisk.

## Bygg for produksjon

```bash
npm run build
npm start
```

## Deployment til Azure

Appen er satt opp for Azure App Service (Linux, Node.js 20). Serveren bundles til en enkelt fil med esbuild (alle avhengigheter unntatt Prisma inkludert).

```bash
# Bygg
npm run build

# Lag deploy-zip
python create_zip.py

# Deploy
az webapp deploy --resource-group <rg> --name <app-name> --src-path deploy.zip --type zip
```

Pase at disse App Settings er satt i Azure:
- `DATABASE_URL`
- `JWT_SECRET`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

## NPM-scripts

| Script | Beskrivelse |
|--------|-------------|
| `npm run dev` | Starter server + klient samtidig |
| `npm run build` | Bygger for produksjon |
| `npm start` | Kjorer produksjonsbygget |
| `npm run db:migrate` | Kjorer Prisma-migrasjoner |
| `npm run db:studio` | Apner Prisma Studio |
| `npm run typecheck` | TypeScript-validering |

---

## Brukerguide: Dashboard for fasilitator

### Innlogging

1. Ga til applikasjonen og klikk **Fasilitator**.
2. Forste gang: klikk **Registrer ny konto**, fyll inn navn, e-post og passord.
3. Etter registrering blir du sendt rett til dashboardet.

### Dashboardet - Oversikt

Etter innlogging lander du pa **Oversikt**. Her ser du:

- **Statistikk-kort** overst: totalt antall workshops, aktive workshops, deltakere og utfordringer.
- **Aktive workshops**: Workshops med status Utkast eller Aktiv.
- **Fullforte workshops**: Workshops som er ferdigstilt.

I **venstre sidepanel** har du to menyvalg:
- **Oversikt** - hovedsiden med alle workshops
- **Arkiv** - arkiverte workshops du har lagt bort

### Opprette ny workshop

1. Klikk **+ Ny workshop** oppe til hoyre.
2. Fyll inn:
   - **Tittel** - f.eks. "AI-workshop Tonsberg"
   - **Kundenavn** - f.eks. "Tonsberg kommune"
   - **Okter** - skriv en okt per linje. La feltet tomt for standard-okter.
3. Klikk **Opprett workshop**.

Du blir sendt til workshopens kontrollpanel.

### Workshop-kontrollpanelet

Kontrollpanelet er arbeidsflaten der du styrer hele workshopen. Overst ser du **okt-faner** for de tematiske oktene du opprettet, pluss en **Samlet oppsummering**-fane.

Hver okt gar gjennom 9 steg uavhengig av hverandre:

#### Steg 1: Hjemmelekse
- Deltakere sender inn utfordringer pa forhand via presentasjonsvisningen.

#### Steg 2: Utfordringer
- Skriv utfordringer i tekstfeltet og trykk **Enter** for raskt a legge til.
- Hver utfordring vises som et kort med mulighet for sletting.
- Deltakere kan ogsa sende inn utfordringer i sanntid.

#### Steg 3: Problemklynging
- Grupper utfordringer i tematiske klynger.
- Bruk **dropdown pa hver lapp** for a plassere den i en klynge manuelt.
- Klikk **AI: Foresla klynger** for a la AI automatisk gruppere utfordringene.
- Du kan ogsa opprette egne klynger manuelt.

#### Steg 4: Hvordan kan vi...? (HKV)
- For hver klynge kan du generere HKV-sporsmaal.
- Klikk **AI-forslag** pa en klynge for a fa 2-3 HKV-sporsmaal generert av AI.
- Hvert sporsmaal har tre deler: Problem, Gevinst og Begrensning.
- Godkjenn sporsmaalene du vil bruke videre.
- Du kan ogsa skrive egne HKV-sporsmaal manuelt.

#### Steg 5: Idemyldring
- Velg et HKV-sporsmaal fra nedtrekkslisten.
- Skriv tittel og beskrivelse for ideer, trykk **Enter**.
- Klikk **AI-forslag** for a la AI generere 3-5 losningsideer per HKV.
- Deltakere kan ogsa sende inn egne ideer.

#### Steg 6: Prioritering
- Hver ide far en score for **Nytteverdi** (H/M/L) og **Gjennomforbarhet** (H/M/L).
- Klikk H, M eller L for a sette score pa hver ide.

#### Steg 7: Prioriteringsmatrise
- Ideene plasseres automatisk i en 2x2-matrise basert pa scoring:
  - **Prioriter na** (hoy nytte + hoy gjennomforbarhet)
  - **Strategiske satsinger** (hoy nytte + lav gjennomforbarhet)
  - **Raske gevinster** (lav nytte + hoy gjennomforbarhet)
  - **Parker** (lav nytte + lav gjennomforbarhet)

#### Steg 8: Idecanvas
- For hver prioritert ide (i "Prioriter na"-kvadranten) kan du fylle ut et idecanvas.
- Klikk **AI-utkast** for a la AI generere et forsteutkast basert pa ideen, HKV og kontekst.
- Rediger feltene: Problemstilling, Losning, Databehov, Forste steg, Forventet resultat.
- Klikk **Lagre** for a lagre canvaset.

#### Steg 9: Resultater
- Oppsummering av okten med statistikk.
- Prioriterte ideer er **klikkbare** - klikk for a se full detalj med utfordringer, HKV, scoring og canvas.
- Bruk pil-navigasjon i modalen for a bla mellom prioriterte ideer.

### Samlet oppsummering

Klikk **Samlet oppsummering**-fanen for a se data fra alle okter samlet:

- Totalstatistikk pa tvers av alle okter.
- Per-okt-kort med matrise og prioriterte ideer.
- Samlet prioriteringsmatrise med alle scorede ideer.
- Klikkbare prioriterte ideer med full detaljvisning.

### PDF-eksport

I **Resultater**-steget eller i **Samlet oppsummering** finner du en **Last ned PDF**-knapp. Rapporten inneholder:

- Forside med workshop-info
- Per-okt-oppsummering med utfordringer, klynger, HKV og ideer
- Prioriteringsmatrise-oversikt
- Idecanvas for prioriterte ideer

### Arkivering

- Pa hvert workshop-kort i dashboardet er det en **arkiver-knapp** (boks-ikon oppe til hoyre).
- Klikk for a arkivere workshopen. Den forsvinner fra oversikten.
- Ga til **Arkiv** i venstremenyen for a se arkiverte workshops.
- Herfra kan du **Gjenopprette** en workshop (setter den tilbake til Fullfort) eller **Se innhold**.

### Presentasjonsvisning

For a vise workshopen pa storskjerm/projektor for deltakerne:

1. Ga til forsiden og klikk **Presentasjonsvisning**.
2. Skriv inn 6-tegns **deltakerkode** (vises i workshop-kortene og i sidepanelet).
3. Visningen folger workshopen i sanntid via WebSocket — alle endringer fasilitator gjor vises umiddelbart uten refresh.

Presentasjonsvisningen viser sanntidsoppdateringer for:
- Steg-endringer og okt-bytte
- Utfordringer, klynger og klyngetilordning
- HKV-sporsmaal
- Ideer og scoring
- Prioriteringsmatrise
- Idecanvas
- AI-prosesseringsresultater

---

## Arkitektur

### Sanntidskommunikasjon

Appen bruker Socket.IO for sanntidsoppdateringer mellom fasilitator-dashboard og presentasjonsvisning. Alle dataendringer sendes som WebSocket-events, slik at presentasjonsvisningen alltid viser oppdatert data uten manuell refresh.

### Session-scoped arkitektur

Hver workshop kan ha flere **okter** (f.eks. "Administrasjon", "Drift", "Vei og trafikk"). Hver okt gar uavhengig gjennom alle 9 steg. Data (utfordringer, klynger, HKV, ideer) er scopet til sin okt, men kan ses samlet i oppsummeringsvisningen.

### Feilhandtering

Alle server-ruter er pakket i try-catch for a forhindre at uhendterte feil krasjer Node.js-prosessen. Feil logges til konsoll og returnerer en trygg feilmelding til klienten.

---

## Prosjektstruktur

```
src/
  client/                  # React frontend
    components/            # Layout, Matrix2x2, PostIt, ScoreInput, StepIndicator
    contexts/              # AuthContext, SocketContext
    hooks/                 # useSocket
    lib/                   # api (HTTP-klient), socket (Socket.IO-klient)
    pages/
      facilitator/         # Dashboard, Archive, WorkshopManage, Login
      participant/         # Join, ParticipantView
      shared/              # Landing
    styles/                # globals.css
    utils/                 # generateReport (PDF)
  server/                  # Express backend
    middleware/            # auth (JWT)
    routes/                # workshops, challenges, clusters, hkv, ideas, canvas, ai, sessions, report, auth
    services/              # aiService (Azure OpenAI), joinCodeService
    socket/                # Socket.IO rom-handtering
  shared/                  # Delte TypeScript-typer
prisma/
  schema.prisma            # Datamodell
  migrations/              # SQL-migrasjoner
```

## Lisens

Privat prosjekt - Atea Norge AS

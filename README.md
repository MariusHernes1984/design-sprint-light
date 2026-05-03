# Design Sprint Light

Design Sprint Light er en digital plattform for AI-assisterte workshops. Den hjelper fasilitatorer med å samle inn utfordringer, strukturere innsikt, generere «Hvordan kan vi ...?»-spørsmål, utvikle løsningsideer og prioritere tiltak i én samlet arbeidsflate.

Plattformen er laget for Atea-konsulenter som fasiliterer AI-workshops med kommuner og virksomheter, og støtter både fasilitatorvisning og presentasjonsvisning for deltakere.

## Hovedfunksjoner

- **Fasilitator-dashboard** for å opprette, administrere, arkivere og gjenoppta workshops.
- **Deltaker- og presentasjonsvisning** med 6-tegns deltakerkode og sanntidsoppdateringer.
- **Flere økter per workshop**, der hver økt kan jobbes gjennom uavhengig.
- **AI-assistert klynging**, HKV-generering, idéutvikling og idecanvas.
- **Prioriteringsflyt** med nytteverdi, gjennomførbarhet og 2x2-matrise.
- **Samlet oppsummering** på tvers av økter.
- **PDF-eksport** av workshopresultater.
- **Autentisering** med JWT og passordhashing.

## Teknisk stack

| Område | Teknologi |
|--------|-----------|
| Frontend | React 19, TypeScript, Vite 6 |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 16, Prisma 6 ORM |
| Sanntid | Socket.IO 4 |
| AI | Azure OpenAI via OpenAI SDK |
| PDF-eksport | jsPDF + jspdf-autotable |
| Autentisering | JWT + bcryptjs |
| Hosting | Azure App Service (Linux) |

## Kom i gang lokalt

### Forutsetninger

- Node.js 20 eller nyere
- Docker og Docker Compose for lokal PostgreSQL
- Azure OpenAI-ressurs med deployment-navn

### 1. Installer avhengigheter

```bash
npm install
```

### 2. Start lokal database

```bash
docker-compose up -d
```

Dette starter PostgreSQL på `localhost:5432` med databasen `design_sprint_light`.

### 3. Konfigurer miljøvariabler

```bash
cp .env.example .env
```

Oppdater `.env` med lokale verdier:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/design_sprint_light"
JWT_SECRET="endre-til-en-lang-tilfeldig-hemmelighet"
AZURE_OPENAI_ENDPOINT="https://din-ressurs.openai.azure.com"
AZURE_OPENAI_API_KEY="din-api-nokkel"
AZURE_OPENAI_DEPLOYMENT="gpt-4o"
AZURE_OPENAI_API_VERSION="2024-10-21"
PORT=3001
```

> **Viktig:** `JWT_SECRET` er påkrevd. Applikasjonen starter ikke uten denne variabelen.

### 4. Kjør databaseoppsett

```bash
npm run db:migrate
```

Ved behov kan Prisma-klienten genereres separat:

```bash
npm run db:generate
```

### 5. Start utviklingsmiljøet

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

Vite proxyer API-kall og WebSocket-trafikk til backend under lokal utvikling.

## NPM-scripts

| Script | Beskrivelse |
|--------|-------------|
| `npm run dev` | Starter klient og server samtidig |
| `npm run dev:client` | Starter Vite-utviklingsserver |
| `npm run dev:server` | Starter Express-server med watch-modus |
| `npm run build` | Genererer Prisma-klient, bygger frontend og bundler server |
| `npm start` | Kjører produksjonsbygget fra `dist/server/index.js` |
| `npm run typecheck` | Kjører TypeScript-validering uten emit |
| `npm run db:migrate` | Kjører Prisma-migrasjoner lokalt |
| `npm run db:generate` | Genererer Prisma-klient |
| `npm run db:seed` | Kjører seed-script |
| `npm run db:studio` | Åpner Prisma Studio |

## Bygg og produksjon

```bash
npm run build
npm start
```

Produksjonsbygget legger klient og server i `dist/`. Serveren bygges med `build-server.mjs` og serverer den statiske frontend-applikasjonen fra samme Express-prosess.

## Deployment til Azure App Service

Applikasjonen er satt opp for Azure App Service på Linux med Node.js 20.

```bash
# Bygg applikasjonen
npm run build

# Lag deploy-zip
python create_zip.py

# Deploy til Azure
az webapp deploy \
  --resource-group <resource-group> \
  --name <app-name> \
  --src-path deploy.zip \
  --type zip
```

Sett disse App Settings i Azure:

- `DATABASE_URL`
- `JWT_SECRET`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`
- `PORT`

## Workshop-flyt

En workshop består av én eller flere økter. Hver økt går gjennom samme arbeidsflyt:

1. **Hjemmelekse** – deltakere sender inn utfordringer på forhånd.
2. **Utfordringer** – fasilitator og deltakere samler og redigerer utfordringer.
3. **Problemklynging** – utfordringer grupperes manuelt eller med AI-forslag.
4. **Hvordan kan vi ...? (HKV)** – AI eller fasilitator formulerer spørsmål basert på klynger.
5. **Idémyldring** – ideer registreres manuelt eller genereres med AI.
6. **Prioritering** – ideer scores på nytteverdi og gjennomførbarhet.
7. **Prioriteringsmatrise** – scorede ideer plasseres i 2x2-matrise.
8. **Idecanvas** – prioriterte ideer detaljeres med problem, løsning, databehov og første steg.
9. **Resultater** – økten oppsummeres, og prioriterte ideer kan eksporteres.

## Brukerguide

### Fasilitator

1. Gå til forsiden og velg **Fasilitator**.
2. Registrer en ny konto eller logg inn.
3. Opprett en workshop med tittel, kundenavn og ønskede økter.
4. Åpne workshopens kontrollpanel.
5. Jobb gjennom stegene for hver økt.
6. Bruk **Samlet oppsummering** for å se resultater på tvers av økter.
7. Last ned PDF-rapport fra resultatsiden eller samlet oppsummering.

### Deltakere og presentasjonsvisning

1. Gå til forsiden og velg **Presentasjonsvisning**.
2. Skriv inn workshopens 6-tegns deltakerkode.
3. Følg workshopens aktive steg i sanntid.

Presentasjonsvisningen oppdateres automatisk når fasilitator endrer steg, økt, utfordringer, klynger, HKV-spørsmål, ideer, scoringer, matriseplasseringer og idecanvas.

### Arkivering

- Workshops kan arkiveres fra dashboardet.
- Arkiverte workshops finnes under **Arkiv**.
- Fra arkivet kan en workshop gjenopprettes eller åpnes for innsyn.

## Arkitektur

### Frontend

React-applikasjonen ligger i `src/client` og bruker React Router for navigasjon mellom:

- landing-side
- innlogging og registrering
- fasilitator-dashboard
- workshop-kontrollpanel
- arkiv
- presentasjonsvisning

### Backend

Express-serveren ligger i `src/server` og eksponerer REST-endepunkter under `/api`. Rutene er delt etter domene:

- autentisering
- workshops
- økter
- utfordringer
- klynger
- HKV-spørsmål
- ideer
- idecanvas
- AI-funksjoner
- rapport/PDF

### Sanntid

Socket.IO brukes til sanntidskommunikasjon mellom fasilitatorvisning og presentasjonsvisning. Når data endres i workshop-kontrollpanelet, sendes relevante events til klientene som følger samme workshop.

### Datamodell

Prisma-modellen ligger i `prisma/schema.prisma`. Sentrale entiteter er:

- `Facilitator`
- `Workshop`
- `Session`
- `Participant`
- `Challenge`
- `Cluster`
- `HkvQuestion`
- `Idea`
- `IdeaScore`
- `IdeaCanvas`

## Prosjektstruktur

```text
.
├── build-server.mjs        # Bundler backend til produksjon
├── create_zip.py           # Lager deploy.zip for Azure
├── docker-compose.yml      # Lokal PostgreSQL
├── prisma/
│   ├── schema.prisma       # Prisma datamodell
│   └── migrations/         # Database-migrasjoner
├── src/
│   ├── client/             # React frontend
│   │   ├── components/     # Gjenbrukbare UI-komponenter
│   │   ├── contexts/       # Auth- og Socket-kontekster
│   │   ├── hooks/          # Klient-hooks
│   │   ├── lib/            # API- og Socket.IO-klient
│   │   ├── pages/          # Sider for fasilitator, deltaker og felles flyt
│   │   ├── styles/         # Global styling
│   │   └── utils/          # PDF-generering
│   ├── server/             # Express backend
│   │   ├── middleware/     # Autentisering
│   │   ├── routes/         # REST-ruter
│   │   ├── services/       # AI og deltakerkode
│   │   └── socket/         # Socket.IO-oppsett
│   └── shared/             # Delte TypeScript-typer
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Feilsøking

| Problem | Sjekk |
|---------|-------|
| Applikasjonen starter ikke | Kontroller at `.env` finnes og at `JWT_SECRET` er satt |
| Databasefeil ved oppstart | Kontroller `DATABASE_URL` og at Docker-databasen kjører |
| Prisma-klient mangler | Kjør `npm run db:generate` |
| AI-funksjoner feiler | Kontroller Azure OpenAI-endepunkt, API-nøkkel, deployment og API-versjon |
| Presentasjonsvisning oppdateres ikke | Kontroller at backend kjører og at WebSocket-trafikk ikke blokkeres |

## Lisens

Privat prosjekt – Atea Norge AS

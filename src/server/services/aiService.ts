import { AzureOpenAI } from 'openai';
import { config } from '../config.js';

let client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI {
  if (!client) {
    client = new AzureOpenAI({
      endpoint: config.azureOpenAI.endpoint,
      apiKey: config.azureOpenAI.apiKey,
      apiVersion: config.azureOpenAI.apiVersion,
    });
  }
  return client;
}

async function chatCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  const ai = getClient();
  const response = await ai.chat.completions.create({
    model: config.azureOpenAI.deployment,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content || '{}';
}

// ---- Vision: Read post-it notes from image ----
export interface PostItReading {
  texts: string[];
}

export async function readPostItsFromImage(
  base64Image: string,
  context: 'hkv' | 'ideas',
): Promise<PostItReading> {
  const ai = getClient();
  const contextPrompt = context === 'hkv'
    ? 'Hver lapp inneholder et HKV-spørsmål eller en problemstilling. Skriv ut fullstendig tekst fra hver lapp.'
    : 'Hver lapp inneholder en idé eller et forslag. Skriv ut fullstendig tekst fra hver lapp.';

  const response = await ai.chat.completions.create({
    model: config.azureOpenAI.deployment,
    messages: [
      {
        role: 'system',
        content: `Du leser post-it-lapper fra et bilde. ${contextPrompt}
Returner som JSON: { "postits": ["tekst fra lapp 1", "tekst fra lapp 2", ...] }
Behold originalteksten så nøyaktig som mulig. Fiks åpenbare skrivefeil. Ignorer tomme lapper.`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Les alle post-it-lapper i dette bildet:' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const result = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(result);
  return { texts: parsed.postits || [] };
}

export interface ClusterSuggestion {
  name: string;
  summary: string;
  challengeIds: string[];
}

export async function suggestClusters(
  challenges: { id: string; text: string }[],
  organizationContext?: string,
): Promise<ClusterSuggestion[]> {
  const numbered = challenges.map((c, i) => `${i + 1}. [${c.id}] "${c.text}"`).join('\n');

  const result = await chatCompletion(
    `Du er en ekspert-fasilitator som hjelper med å gruppere utfordringer fra workshops i tematiske klynger. Svar alltid på norsk. Returner JSON.`,
    `Her er utfordringer samlet inn fra en workshop${organizationContext ? ` med ${organizationContext}` : ''}:

${numbered}

Grupper disse utfordringene i 3-7 tematiske klynger.
For hver klynge, gi:
- "name": Et kort, beskrivende navn (2-4 ord, nøytralt, handlingsorientert)
- "summary": En kort oppsummering av fellesnevneren (1-2 setninger)
- "challengeIds": Liste over ID-er (i hakeparentes-format) som hører til klyngen

Returner som JSON: { "clusters": [{ "name": "...", "summary": "...", "challengeIds": ["id1", "id2"] }] }`,
  );

  const parsed = JSON.parse(result);
  return parsed.clusters || [];
}

export interface HkvSuggestion {
  problem: string;
  benefit: string;
  constraint: string;
  fullText: string;
}

export async function suggestHkv(
  clusterName: string,
  challenges: string[],
): Promise<HkvSuggestion[]> {
  const listed = challenges.map((c, i) => `${i + 1}. "${c}"`).join('\n');

  const result = await chatCompletion(
    `Du er en design thinking-fasilitator. Lag "Hvordan kan vi"-spørsmål fra problemklynger. Følg denne malen:
"Hvordan kan vi [problem], slik at [gevinst], uten at [begrensning]?"
Svar på norsk. Returner JSON.
VIKTIG: Bruk kort og enkelt språk. Hver del (problem, gevinst, begrensning) skal være maks 5-8 ord. Unngå fagspråk og lange setninger.`,
    `Klynge: "${clusterName}"
Utfordringer i klyngen:
${listed}

Lag 2-3 HKV-spørsmål som dekker essensen av disse utfordringene.
Vær konkret og handlingsorientert. Hold det kort og lettlest.

Eksempel på god lengde:
- problem: "forenkle rapporteringen"
- benefit: "ansatte sparer tid"
- constraint: "kvaliteten synker"

Returner som JSON: { "questions": [{ "problem": "...", "benefit": "...", "constraint": "...", "fullText": "Hvordan kan vi ..., slik at ..., uten at ...?" }] }`,
  );

  const parsed = JSON.parse(result);
  return parsed.questions || [];
}

export interface IdeaSuggestion {
  title: string;
  description: string;
  technology: string;
}

export async function suggestIdeas(
  hkvQuestion: string,
  organizationContext?: string,
): Promise<IdeaSuggestion[]> {
  const result = await chatCompletion(
    `Du er en innovasjonsrådgiver med ekspertise på AI og digitalisering i offentlig sektor. Foreslå konkrete løsningsideer. Svar på norsk. Returner JSON.`,
    `HKV-spørsmål: "${hkvQuestion}"
${organizationContext ? `Kontekst: ${organizationContext}` : ''}

Foreslå 3-5 konkrete løsningsideer som bruker AI eller digital teknologi.
For hver idé:
- "title": Kort tittel (3-6 ord)
- "description": 2-3 setningers beskrivelse
- "technology": Hvilken teknologi/tilnærming som benyttes

Vær realistisk og praktisk. Prioriter idéer som kan gi rask verdi.

Returner som JSON: { "ideas": [{ "title": "...", "description": "...", "technology": "..." }] }`,
  );

  const parsed = JSON.parse(result);
  return parsed.ideas || [];
}

export interface FeasibilityAssessment {
  dataAvailability: string;
  systemReadiness: string;
  timeHorizon: string;
  utilityValue: string;
  feasibility: string;
  reasoning: string;
}

export async function assessFeasibility(
  ideaText: string,
  context?: string,
): Promise<FeasibilityAssessment> {
  const result = await chatCompletion(
    `Du er en teknisk rådgiver. Vurder gjennomførbarheten av en løsningsidé for en norsk virksomhet. Svar på norsk. Returner JSON.`,
    `Idé: "${ideaText}"
${context ? `Kontekst: ${context}` : ''}

Vurder:
1. Datatilgjengelighet (finnes dataene, er de tilgjengelige?)
2. Systemmodenhet (finnes verktøy/plattformer, integrasjonsbehov)
3. Tidshorisont (0-3 mnd, 3-12 mnd, 12+ mnd)
4. Samlet vurdering av nytteverdi (HIGH/MEDIUM/LOW) og gjennomførbarhet (HIGH/MEDIUM/LOW)

Returner som JSON: { "dataAvailability": "...", "systemReadiness": "...", "timeHorizon": "...", "utilityValue": "HIGH|MEDIUM|LOW", "feasibility": "HIGH|MEDIUM|LOW", "reasoning": "..." }`,
  );

  return JSON.parse(result);
}

export interface CanvasDraft {
  problemStatement: string;
  solutionSummary: string;
  dataNeeds: string;
  stakeholders: string;
  firstSteps: string;
  expectedOutcome: string;
}

// AI sometimes returns arrays/objects for string fields — normalize
function toStr(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('\n');
  if (typeof val === 'object') {
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');
  }
  return String(val);
}

export async function generateCanvasDraft(
  ideaTitle: string,
  ideaDescription: string,
  hkvQuestion: string,
): Promise<CanvasDraft> {
  const result = await chatCompletion(
    `Du lager strukturerte idékort for AI/digitaliseringsprosjekter. Svar på norsk. Returner JSON. VIKTIG: Alle verdier skal være vanlige tekststrenger, IKKE arrays eller objekter.`,
    `Idé: "${ideaTitle}" - ${ideaDescription}
HKV: "${hkvQuestion}"

Fyll ut et idékort med:
- "problemStatement": Problemformulering (2-3 setninger, som én sammenhengende tekst)
- "solutionSummary": Løsningsbeskrivelse (3-5 setninger, som én sammenhengende tekst)
- "dataNeeds": Databehov (hvilke data trengs, hvor finnes de — som én sammenhengende tekst)
- "stakeholders": Interessenter (hvem påvirkes, hvem må involveres — som én sammenhengende tekst)
- "firstSteps": Første steg (3-5 konkrete handlinger, som nummerert tekst: "1. ... 2. ... 3. ...")
- "expectedOutcome": Forventet gevinst (konkret, målbart om mulig — som én sammenhengende tekst)

Returner som JSON der ALLE verdier er enkle tekststrenger (strings), aldri arrays eller objekter.`,
  );

  const parsed = JSON.parse(result);
  return {
    problemStatement: toStr(parsed.problemStatement),
    solutionSummary: toStr(parsed.solutionSummary),
    dataNeeds: toStr(parsed.dataNeeds),
    stakeholders: toStr(parsed.stakeholders),
    firstSteps: toStr(parsed.firstSteps),
    expectedOutcome: toStr(parsed.expectedOutcome),
  };
}

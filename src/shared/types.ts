// Workshop status and step enums (mirrors Prisma enums)
export type WorkshopStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export type WorkshopStep =
  | 'PREWORK'
  | 'SESSIONS'
  | 'CLUSTERING'
  | 'HKV'
  | 'IDEATION'
  | 'PRIORITIZATION'
  | 'MATRIX'
  | 'CANVAS'
  | 'RESULTS';

export type ChallengeSource = 'PREWORK' | 'SESSION';
export type ValueLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type MatrixQuadrant =
  | 'PRIORITER_NA'
  | 'STRATEGISKE_SATSINGER'
  | 'RASKE_GEVINSTER'
  | 'PARKER';

export const STEP_ORDER: WorkshopStep[] = [
  'PREWORK',
  'SESSIONS',
  'CLUSTERING',
  'HKV',
  'IDEATION',
  'PRIORITIZATION',
  'MATRIX',
  'CANVAS',
  'RESULTS',
];

// Steps within each session (2-9)
export const SESSION_STEP_ORDER: WorkshopStep[] = [
  'SESSIONS',
  'CLUSTERING',
  'HKV',
  'IDEATION',
  'PRIORITIZATION',
  'MATRIX',
  'CANVAS',
  'RESULTS',
];

export const STEP_LABELS: Record<WorkshopStep, string> = {
  PREWORK: 'Hjemmelekse',
  SESSIONS: 'Utfordringer',
  CLUSTERING: 'Klynging',
  HKV: 'HKV-sporsmaal',
  IDEATION: 'Idemyldring',
  PRIORITIZATION: 'Prioritering',
  MATRIX: 'Matrise',
  CANVAS: 'Idecanvas',
  RESULTS: 'Resultater',
};

// API response types
export interface WorkshopSummary {
  id: string;
  title: string;
  customerName: string | null;
  joinCode: string;
  status: WorkshopStatus;
  currentStep: WorkshopStep;
  participantCount: number;
  challengeCount: number;
  createdAt: string;
}

export interface WorkshopDetail extends WorkshopSummary {
  description: string | null;
  sessions: SessionData[];
  participants: ParticipantData[];
}

export interface SessionData {
  id: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  currentStep: WorkshopStep;
  challengeCount: number;
}

export interface ParticipantData {
  id: string;
  name: string;
  joinedAt: string;
}

export interface ChallengeData {
  id: string;
  text: string;
  source: ChallengeSource;
  participantId: string;
  participantName: string;
  sessionId: string | null;
  clusterId: string | null;
  createdAt: string;
}

export interface ClusterData {
  id: string;
  name: string;
  summary: string | null;
  sortOrder: number;
  sessionId: string;
  challenges: ChallengeData[];
  hkvQuestions: HkvQuestionData[];
}

export interface HkvQuestionData {
  id: string;
  problem: string;
  benefit: string;
  constraint: string;
  fullText: string;
  isAiGenerated: boolean;
  isApproved: boolean;
  clusterId: string;
  sessionId: string;
  ideaCount: number;
}

export interface IdeaData {
  id: string;
  title: string;
  description: string | null;
  isAiGenerated: boolean;
  hkvQuestionId: string;
  sessionId: string;
  participantId?: string | null;
  participantName: string | null;
  score: IdeaScoreData | null;
  createdAt: string;
}

export interface IdeaScoreData {
  utilityValue: ValueLevel;
  feasibility: ValueLevel;
  dataAvailability: string | null;
  systemReadiness: string | null;
  timeHorizon: string | null;
  matrixQuadrant: MatrixQuadrant;
}

export interface IdeaCanvasData {
  id: string;
  problemStatement: string;
  solutionSummary: string;
  dataNeeds: string;
  stakeholders: string | null;
  firstSteps: string;
  expectedOutcome: string | null;
  isAiDraft: boolean;
}

// Socket.IO event types
export interface ServerToClientEvents {
  'workshop:stepChanged': (data: { step: WorkshopStep }) => void;
  'session:stepChanged': (data: { sessionId: string; step: WorkshopStep }) => void;
  'workshop:sessionActivated': (data: { sessionId: string }) => void;
  'challenge:added': (data: ChallengeData) => void;
  'challenge:updated': (data: ChallengeData) => void;
  'challenge:clustered': (data: { challengeId: string; clusterId: string | null }) => void;
  'cluster:created': (data: ClusterData) => void;
  'cluster:updated': (data: ClusterData) => void;
  'cluster:deleted': (data: { clusterId: string }) => void;
  'hkv:added': (data: HkvQuestionData) => void;
  'hkv:updated': (data: HkvQuestionData) => void;
  'idea:added': (data: IdeaData) => void;
  'score:updated': (data: { ideaId: string; score: IdeaScoreData }) => void;
  'canvas:updated': (data: { ideaId: string }) => void;
  'ai:processing': (data: { type: string; status: 'started' | 'completed' }) => void;
  'participants:updated': (data: ParticipantData[]) => void;
}

export interface ClientToServerEvents {
  'join:workshop': (data: { workshopId: string; token: string }) => void;
}

// Auth
export interface AuthPayload {
  id: string;
  role: 'facilitator' | 'participant';
  workshopId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface JoinRequest {
  joinCode: string;
  name: string;
}

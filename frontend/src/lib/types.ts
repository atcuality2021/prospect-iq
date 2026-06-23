export interface Lead {
  url?: string;
  name?: string;
  company?: string;
  linkedinUrl?: string;
  youtubeChannel?: string;
  channel?: 'email' | 'linkedin' | 'twitter';
  tone?: 'professional' | 'casual' | 'friendly';
}

export interface Citation {
  text: string;
  url?: string;
}

export interface ResearchData {
  source: 'website' | 'linkedin' | 'news' | 'youtube';
  raw: string;
  citations: Citation[];
  error?: string;
  skipped?: boolean;
}

export interface VerifiedFact {
  claim: string;
  source: 'website' | 'linkedin' | 'news' | 'youtube';
  evidenceQuote: string;
  sourceUrl?: string;
  confidence: number;
}

export interface VerificationResult {
  verifiedFacts: VerifiedFact[];
  discardedClaims: string[];
  qualityScore: number;
}

export interface Signal {
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  relevance: 'high' | 'medium' | 'low';
  confidence: number;
  evidenceQuote: string;
}

export interface ProspectProfile {
  name: string;
  company: string;
  role?: string;
  industry?: string;
  location?: string;
  summary: string;
  signals: Signal[];
  painPoints: string[];
  opportunities: string[];
}

export interface CatalogEntry {
  _id?: string;
  name: string;
  description: string;
  category: string;
  targetAudience: string;
  painPointsAddressed: string[];
  deliverables: string[];
  pricing?: string;
  keywords: string[];
}

export interface ServiceMatch {
  service: CatalogEntry;
  score: number;
  reasoning: string;
  matchedSignals: string[];
  confidence: number;
}

export interface Pitch {
  channel: 'email' | 'linkedin' | 'twitter';
  subject?: string;
  body: string;
  callToAction: string;
  personalizationPoints: string[];
  reflectionNotes?: string;
  revised?: boolean;
  score?: number;
}

export type RunStatus = 'queued' | 'researching' | 'verifying' | 'synthesizing' | 'matching' | 'pitching' | 'reflecting' | 'completed' | 'failed';

export interface RunEvent {
  type: string;
  phase?: string;
  agent?: string;
  gate?: string;
  data?: unknown;
  error?: string;
  timestamp: string;
}

export interface Project {
  projectId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PlanTask {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  rationale: string;
  status: TaskStatus;
  childRunId?: string;
  gatePassed?: boolean;
  resultSummary?: string;
}

export interface OrchestrationEvent {
  type: string;
  taskId?: string;
  data?: unknown;
  message?: string;
  timestamp: string;
}

export interface OrchestrationRun {
  orchestrationId: string;
  goal: string;
  hints?: Record<string, unknown>;
  status: string;
  plan: PlanTask[];
  iterations: number;
  maxIterations: number;
  goalMet: boolean;
  partial: boolean;
  finalAnswer?: string;
  events: OrchestrationEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Run {
  runId: string;
  lead: Lead;
  status: RunStatus;
  research?: {
    website?: ResearchData;
    linkedin?: ResearchData;
    news?: ResearchData;
    youtube?: ResearchData;
  };
  profile?: ProspectProfile;
  matches?: ServiceMatch[];
  pitch?: Pitch;
  events: RunEvent[];
  error?: string;
  lowConfidence?: boolean;
  saved?: boolean;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

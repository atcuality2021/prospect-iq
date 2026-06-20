export interface Lead {
  url?: string;
  name?: string;
  company?: string;
  linkedinUrl?: string;
  youtubeChannel?: string;
  channel?: 'email' | 'linkedin' | 'twitter';
  tone?: 'professional' | 'casual' | 'friendly';
}

export interface ResearchData {
  source: 'website' | 'linkedin' | 'news' | 'youtube';
  raw: string;
  citations: Citation[];
  error?: string;
  skipped?: boolean;
}

export interface Citation {
  text: string;
  url?: string;
}

// Paper: evidence chains — every verified fact traces back to exact source text
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
}

// Paper: adds 'verifying' (evidence chain) and 'reflecting' (reflexive loop)
export type RunStatus = 'queued' | 'researching' | 'verifying' | 'synthesizing' | 'matching' | 'pitching' | 'reflecting' | 'completed' | 'failed';

export interface RunEvent {
  type: 'agent_start' | 'agent_complete' | 'agent_error' | 'phase_start' | 'phase_complete' | 'run_complete' | 'run_failed';
  phase?: string;
  agent?: string;
  data?: unknown;
  error?: string;
  timestamp: Date;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
  verification?: VerificationResult;
  profile?: ProspectProfile;
  matches?: ServiceMatch[];
  pitch?: Pitch;
  events: RunEvent[];
  error?: string;
  saved?: boolean;
  savedAt?: Date;
  notes?: string;
  chatHistory?: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrchestratorState {
  runId: string;
  lead: Lead;
  research: {
    website?: ResearchData;
    linkedin?: ResearchData;
    news?: ResearchData;
    youtube?: ResearchData;
  };
  verification?: VerificationResult;
  profile?: ProspectProfile;
  matches: ServiceMatch[];
  pitch?: Pitch;
  events: RunEvent[];
  errors: string[];
}

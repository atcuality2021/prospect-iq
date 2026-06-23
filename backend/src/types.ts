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
  score?: number;        // final pitch-quality score from Gate 2
}

// Structurally identical to GateAttempt[] in orchestrator/gate.ts — defined here to
// avoid a gate.ts → types.ts → gate.ts import cycle.
export interface GatesRecord {
  research?: { attempt: number; score: number; pass: boolean; feedback: string; timestamp: Date }[];
  pitch?:    { attempt: number; score: number; pass: boolean; feedback: string; timestamp: Date }[];
}

// Paper: adds 'verifying' (evidence chain) and 'reflecting' (reflexive loop)
export type RunStatus = 'queued' | 'researching' | 'verifying' | 'synthesizing' | 'matching' | 'pitching' | 'reflecting' | 'completed' | 'failed';

export interface RunEvent {
  type:
    | 'agent_start' | 'agent_complete' | 'agent_error'
    | 'phase_start' | 'phase_complete'
    | 'gate_start' | 'gate_attempt' | 'gate_pass' | 'gate_fail'
    | 'run_complete' | 'run_failed';
  phase?: string;
  agent?: string;
  gate?: string;
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
  gates?: GatesRecord;
  lowConfidence?: boolean;
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
  gates?: GatesRecord;
  lowConfidence?: boolean;
}

// ── Dynamic orchestrator (BILTIQ-001) ─────────────────────────────────────────
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PlanTask {
  id: string;                    // stable within the orchestration
  tool: 'run_research_pipeline'; // Increment 1: only this tool
  args: Record<string, unknown>; // e.g. { lead: { company, url, linkedinUrl } }
  rationale: string;             // why the planner added this task
  status: TaskStatus;
  childRunId?: string;           // the Run produced by this task, if any
  gatePassed?: boolean;          // result of the goal-level gate check
  resultSummary?: string;        // short text the synthesizer/grader can read
}

// 'executing' | 'replanning' | 'grading' are reserved for finer-grained status
// reporting in a later increment; Inc 1 transitions queued → planning → completed|failed.
export type OrchestrationStatus =
  | 'queued' | 'planning' | 'executing' | 'replanning' | 'grading' | 'completed' | 'failed';

export interface OrchestrationEvent {
  type:
    | 'orchestration_start'
    | 'plan_created' | 'plan_revised'
    | 'task_start' | 'task_complete' | 'task_failed'
    | 'gate_check'
    | 'goal_graded'
    | 'orchestration_complete' | 'orchestration_failed';
  taskId?: string;
  data?: unknown;
  message?: string;
  timestamp: Date;
}

export interface OrchestrationRun {
  orchestrationId: string;
  goal: string;
  hints?: Record<string, unknown>;
  status: OrchestrationStatus;
  plan: PlanTask[];
  iterations: number;
  maxIterations: number;
  goalMet: boolean;
  partial: boolean;              // capped before goal fully met (mirrors lowConfidence)
  finalAnswer?: string;
  events: OrchestrationEvent[];
  createdAt: Date;
  updatedAt: Date;
}

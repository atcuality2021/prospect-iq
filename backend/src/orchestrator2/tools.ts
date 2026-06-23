import { v4 as uuidv4 } from 'uuid';
import { Lead, OrchestrationEvent, RunEvent } from '../types';
import { RunModel } from '../db/models/run';
import { ProspectOrchestrator } from '../orchestrator';
import { gradePipelineResult } from './result-gate';

export interface ToolContext {
  emit: (e: OrchestrationEvent) => Promise<void>;
  orchestrationId: string;
}

export interface ToolResult {
  childRunId?: string;
  summary: string;   // short, LLM-readable
  ok: boolean;
}

export type Tool = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;

// Type-guard so we can narrow planner output (untyped JSON) without `any`.
function inSet<T extends string>(set: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (set as readonly string[]).includes(v);
}

// Narrow the planner's untyped args into a Lead at the trust boundary.
export function asLead(args: Record<string, unknown>): Lead {
  const raw = (args.lead && typeof args.lead === 'object' ? args.lead : args) as Record<string, unknown>;
  const str = (k: string): string | undefined => (typeof raw[k] === 'string' ? (raw[k] as string) : undefined);
  return {
    url:            str('url'),
    name:           str('name'),
    company:        str('company'),
    linkedinUrl:    str('linkedinUrl'),
    youtubeChannel: str('youtubeChannel'),
    channel: inSet(['email', 'linkedin', 'twitter'] as const, raw.channel) ? raw.channel : 'email',
    tone:    inSet(['professional', 'casual', 'friendly'] as const, raw.tone) ? raw.tone : 'professional',
  };
}

export const runResearchPipelineTool: Tool = async (args) => {
  const lead = asLead(args);
  if (!lead.url && !lead.name && !lead.company) {
    return { ok: false, summary: 'No usable lead (need url, name, or company).' };
  }

  const childRunId = uuidv4();
  await RunModel.create({ runId: childRunId, lead, status: 'researching', events: [] });

  const orchestrator = new ProspectOrchestrator(childRunId, lead, async (event: RunEvent) => {
    await RunModel.updateOne({ runId: childRunId }, { $push: { events: event } });
  });

  const finalState = await orchestrator.run();
  const failed = finalState.errors.length > 0 && !finalState.pitch;

  await RunModel.updateOne({ runId: childRunId }, {
    status: failed ? 'failed' : 'completed',
    research: finalState.research,
    verification: finalState.verification,
    profile: finalState.profile,
    matches: finalState.matches,
    pitch: finalState.pitch,
    gates: finalState.gates,
    lowConfidence: finalState.lowConfidence ?? false,
    ...(failed && { error: finalState.errors.join('; ') }),
  });

  const gate = gradePipelineResult({ pitch: finalState.pitch, lowConfidence: finalState.lowConfidence });
  const signals = finalState.profile?.signals.length ?? 0;
  const target = lead.company || lead.name || lead.url;
  const summary =
    `Researched ${target}: ${signals} signals, pitch ${finalState.pitch ? 'drafted' : 'missing'}` +
    `${finalState.pitch?.score != null ? ` (score ${finalState.pitch.score})` : ''}` +
    `${finalState.lowConfidence ? ', LOW CONFIDENCE' : ''}.`;

  return { childRunId, summary, ok: gate.pass && !failed };
};

// Increment 1: only this tool. Later increments add registry entries here.
export const TOOLS: Record<string, Tool> = {
  run_research_pipeline: runResearchPipelineTool,
};

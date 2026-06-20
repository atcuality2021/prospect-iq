import { OrchestratorState, ProspectProfile, RunEvent } from '../../types';
import { callWithTool, callText } from '../../llm/client';

export async function synthesisNode(
  state: OrchestratorState,
  emit: (event: RunEvent) => Promise<void>,
): Promise<Partial<OrchestratorState>> {
  await emit({ type: 'phase_start', phase: 'synthesis', timestamp: new Date() });

  const verifiedFacts = state.verification?.verifiedFacts ?? [];
  const qualityScore = state.verification?.qualityScore ?? 0;

  const factsText = verifiedFacts.length > 0
    ? verifiedFacts
        .sort((a, b) => b.confidence - a.confidence)
        .map((f) => `• [${f.source}] (${f.confidence}%) ${f.claim}\n  Quote: "${f.evidenceQuote}"`)
        .join('\n')
    : 'No verified facts — build a minimal profile from lead info only.';

  // Step 1 — Think: reason about evidence before committing to schema
  const reasoning = await callText(
    [
      {
        role: 'user',
        content: `You are building a prospect profile for: ${state.lead.name || state.lead.company || state.lead.url}

VERIFIED FACTS (each backed by a source quote):
${factsText}

Research quality: ${qualityScore}/100

Before generating the profile, reason through:
1. Who is this person / company and what do they actually do?
2. Which signals are most significant (highest confidence + business relevance)?
3. What pain points can you DIRECTLY infer from verified evidence — not generic industry assumptions?
4. What concrete opportunities exist based on these specific facts?

Only reference facts from the verified list. Think step by step.`,
      },
    ],
    800,
  );

  // Step 2 — Act: generate structured profile grounded in the reasoning
  const profile = await callWithTool<ProspectProfile>(
    [
      {
        role: 'user',
        content: `Build the structured profile based on your analysis:

YOUR ANALYSIS:
${reasoning}

VERIFIED FACTS (for evidence quotes):
${factsText}

Lead info: ${JSON.stringify(state.lead)}

CRITICAL: Every signal's evidenceQuote must be verbatim from the verified facts. Do not include signals not grounded in that list.`,
      },
    ],
    {
      name: 'create_prospect_profile',
      description: 'Create a structured profile. Every signal must include an evidenceQuote verbatim from the verified facts.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          company: { type: 'string' },
          role: { type: 'string' },
          industry: { type: 'string' },
          location: { type: 'string' },
          summary: { type: 'string', description: '2-3 sentences derived only from verified facts' },
          signals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                source: { type: 'string' },
                sourceUrl: { type: 'string' },
                relevance: { type: 'string', enum: ['high', 'medium', 'low'] },
                confidence: { type: 'number', description: '0-100 from the verified fact' },
                evidenceQuote: { type: 'string', description: 'Verbatim excerpt from source proving this signal' },
              },
              required: ['title', 'description', 'source', 'relevance', 'confidence', 'evidenceQuote'],
            },
          },
          painPoints: { type: 'array', items: { type: 'string' } },
          opportunities: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'company', 'summary', 'signals', 'painPoints', 'opportunities'],
      },
    },
    2000,
  );

  await emit({ type: 'phase_complete', phase: 'synthesis', data: { profile }, timestamp: new Date() });
  return { profile };
}

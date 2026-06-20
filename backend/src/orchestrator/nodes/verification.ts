import { OrchestratorState, VerificationResult, RunEvent } from '../../types';
import { callWithTool } from '../../llm/client';

export async function verificationNode(
  state: OrchestratorState,
  emit: (event: RunEvent) => Promise<void>,
): Promise<Partial<OrchestratorState>> {
  await emit({ type: 'phase_start', phase: 'verifying', timestamp: new Date() });

  const sources = Object.entries(state.research)
    .filter(([, data]) => data && !data.skipped && data.raw)
    .map(([source, data]) => ({ source, text: data!.raw }));

  if (sources.length === 0) {
    const result: VerificationResult = { verifiedFacts: [], discardedClaims: [], qualityScore: 0 };
    await emit({ type: 'phase_complete', phase: 'verifying', data: { verification: result }, timestamp: new Date() });
    return { verification: result };
  }

  const verification = await callWithTool<VerificationResult>(
    [
      {
        role: 'user',
        content: `You are a fact-checker. Extract ONLY facts explicitly stated in the source text.

RULES:
1. Every fact needs a verbatim quote from the source proving it
2. Discard anything requiring inference or assumption
3. Only include facts with confidence ≥ 60

SOURCE MATERIAL:
${sources.map((s) => `=== ${s.source.toUpperCase()} ===\n${s.text}`).join('\n\n')}`,
      },
    ],
    {
      name: 'extract_verified_facts',
      description: 'Extract only facts explicitly present in the source text. Each fact requires a verbatim evidence quote.',
      schema: {
        type: 'object',
        properties: {
          verifiedFacts: {
            type: 'array',
            description: 'Facts with direct textual evidence',
            items: {
              type: 'object',
              properties: {
                claim: { type: 'string' },
                source: { type: 'string', description: 'website | linkedin | news | youtube' },
                evidenceQuote: { type: 'string', description: 'Verbatim excerpt from the source proving this claim' },
                sourceUrl: { type: 'string' },
                confidence: { type: 'number', description: '60-100 only' },
              },
              required: ['claim', 'source', 'evidenceQuote', 'confidence'],
            },
          },
          discardedClaims: {
            type: 'array',
            items: { type: 'string' },
            description: 'Plausible claims that lacked direct textual support',
          },
          qualityScore: {
            type: 'number',
            description: '0-100 based on source coverage and fact density',
          },
        },
        required: ['verifiedFacts', 'discardedClaims', 'qualityScore'],
      },
    },
    2500,
  );

  await emit({ type: 'phase_complete', phase: 'verifying', data: { verification }, timestamp: new Date() });
  return { verification };
}

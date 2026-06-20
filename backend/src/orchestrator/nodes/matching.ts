import { OrchestratorState, ServiceMatch, RunEvent } from '../../types';
import { CatalogModel } from '../../db/models/catalog';
import { callWithTool } from '../../llm/client';

export async function matchingNode(
  state: OrchestratorState,
  emit: (event: RunEvent) => Promise<void>,
): Promise<Partial<OrchestratorState>> {
  await emit({ type: 'phase_start', phase: 'matching', timestamp: new Date() });

  const catalog = await CatalogModel.find({}).lean();

  if (catalog.length === 0) {
    await emit({ type: 'phase_complete', phase: 'matching', data: { matches: [] }, timestamp: new Date() });
    return { matches: [] };
  }

  const result = await callWithTool<{
    matches: Array<{ serviceId: string; score: number; confidence: number; reasoning: string; matchedSignals: string[] }>;
  }>(
    [
      {
        role: 'user',
        content: `Match these services to this prospect. Only recommend services that genuinely fit based on verified signals.

PROSPECT PROFILE:
${JSON.stringify(state.profile, null, 2)}

SERVICE CATALOG:
${catalog
  .map(
    (s) =>
      `ID: ${s._id}\nName: ${s.name}\nDescription: ${s.description}\nTarget: ${s.targetAudience}\nPain points addressed: ${s.painPointsAddressed.join(', ')}`,
  )
  .join('\n\n---\n\n')}`,
      },
    ],
    {
      name: 'rank_service_matches',
      description: 'Rank services by fit. Each match must cite specific signals from the profile.',
      schema: {
        type: 'object',
        properties: {
          matches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                serviceId: { type: 'string' },
                score: { type: 'number', description: '0-100 fit score' },
                confidence: { type: 'number', description: '0-100 confidence this match is genuinely relevant' },
                reasoning: { type: 'string', description: 'Why this service fits, citing specific signal titles' },
                matchedSignals: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Signal titles that triggered this match',
                },
              },
              required: ['serviceId', 'score', 'confidence', 'reasoning', 'matchedSignals'],
            },
          },
        },
        required: ['matches'],
      },
    },
    2000,
  );

  const matches: ServiceMatch[] = result.matches
    .flatMap((m) => {
      const service = catalog.find((s) => s._id?.toString() === m.serviceId);
      if (!service) return [];
      const match: ServiceMatch = {
        service: {
          _id: service._id?.toString(),
          name: service.name,
          description: service.description,
          category: service.category,
          targetAudience: service.targetAudience,
          painPointsAddressed: service.painPointsAddressed,
          deliverables: service.deliverables,
          pricing: service.pricing,
          keywords: service.keywords,
        },
        score: m.score,
        confidence: m.confidence,
        reasoning: m.reasoning,
        matchedSignals: m.matchedSignals,
      };
      return [match];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  await emit({ type: 'phase_complete', phase: 'matching', data: { matches }, timestamp: new Date() });
  return { matches };
}

import { OrchestratorState, RunEvent } from '../../types';
import { runWebsiteAgent } from '../../agents/website';
import { runLinkedInAgent } from '../../agents/linkedin';
import { runNewsAgent } from '../../agents/news';
import { runYouTubeAgent } from '../../agents/youtube';

export async function researchNode(
  state: OrchestratorState,
  emit: (event: RunEvent) => Promise<void>,
): Promise<Partial<OrchestratorState>> {
  await emit({ type: 'phase_start', phase: 'research', timestamp: new Date() });

  const agents = [
    { name: 'website', fn: () => runWebsiteAgent(state.lead) },
    { name: 'linkedin', fn: () => runLinkedInAgent(state.lead) },
    { name: 'news', fn: () => runNewsAgent(state.lead) },
    { name: 'youtube', fn: () => runYouTubeAgent(state.lead) },
  ] as const;

  const results = await Promise.all(
    agents.map(async (agent) => {
      await emit({ type: 'agent_start', agent: agent.name, phase: 'research', timestamp: new Date() });
      try {
        const data = await agent.fn();
        await emit({ type: 'agent_complete', agent: agent.name, phase: 'research', data, timestamp: new Date() });
        return [agent.name, data] as const;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await emit({ type: 'agent_error', agent: agent.name, phase: 'research', error: message, timestamp: new Date() });
        return [agent.name, { source: agent.name as 'website', raw: '', citations: [], error: message }] as const;
      }
    }),
  );

  const research = Object.fromEntries(results) as OrchestratorState['research'];
  await emit({ type: 'phase_complete', phase: 'research', timestamp: new Date() });

  return { research };
}

import { OrchestratorState, Pitch, RunEvent } from '../../types';
import { callWithTool } from '../../llm/client';

export async function pitchNode(
  state: OrchestratorState,
  emit: (event: RunEvent) => Promise<void>,
): Promise<Partial<OrchestratorState>> {
  await emit({ type: 'phase_start', phase: 'pitching', timestamp: new Date() });

  const channel = state.lead.channel || 'email';
  const tone = state.lead.tone || 'professional';
  const topMatches = state.matches.slice(0, 2);

  const channelGuide =
    channel === 'email'
      ? 'Write a subject line + body email.'
      : channel === 'linkedin'
      ? 'Write a LinkedIn DM (keep it under 300 words, conversational).'
      : 'Write a Twitter/X DM (under 280 characters, punchy and direct).';

  const pitchData = await callWithTool<{
    subject?: string;
    body: string;
    callToAction: string;
    personalizationPoints: string[];
  }>(
    [
      {
        role: 'user',
        content: `Draft a ${tone} ${channel} pitch for this prospect.

RULE: Every sentence must tie back to a specific signal from their profile. No generic boilerplate.

PROSPECT:
${JSON.stringify(state.profile, null, 2)}

RECOMMENDED SERVICES:
${topMatches.map((m) => `${m.service.name}: ${m.reasoning}`).join('\n\n')}

Channel: ${channel} — ${channelGuide}
Tone: ${tone}`,
      },
    ],
    {
      name: 'draft_pitch',
      description: 'Draft a personalized outreach pitch. Reference specific signals, not generic platitudes.',
      schema: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Email subject line (email channel only)' },
          body: { type: 'string', description: 'Main pitch body — every paragraph tied to a real signal' },
          callToAction: { type: 'string', description: 'Clear, specific next step for the prospect' },
          personalizationPoints: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific details from research used to personalize this pitch',
          },
        },
        required: ['body', 'callToAction', 'personalizationPoints'],
      },
    },
    1500,
  );

  const pitch: Pitch = {
    channel,
    subject: pitchData.subject,
    body: pitchData.body,
    callToAction: pitchData.callToAction,
    personalizationPoints: pitchData.personalizationPoints,
  };

  await emit({ type: 'phase_complete', phase: 'pitching', data: { pitch }, timestamp: new Date() });
  return { pitch };
}

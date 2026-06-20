import { OrchestratorState, Pitch, RunEvent } from '../../types';
import { callWithTool } from '../../llm/client';

export async function reflectionNode(
  state: OrchestratorState,
  emit: (event: RunEvent) => Promise<void>,
): Promise<Partial<OrchestratorState>> {
  if (!state.pitch) return {};

  await emit({ type: 'phase_start', phase: 'reflecting', timestamp: new Date() });

  const critique = await callWithTool<{
    genericLanguageIssues: string[];
    missingSignalRefs: string[];
    ctaStrength: 'strong' | 'weak' | 'missing';
    overallQuality: number;
    needsRevision: boolean;
    summaryNotes: string;
  }>(
    [
      {
        role: 'user',
        content: `You are a pitch critic. Flag any sentence that could be sent to ANY prospect unchanged.

PITCH:
${state.pitch.subject ? `Subject: ${state.pitch.subject}\n\n` : ''}${state.pitch.body}

PROSPECT SIGNALS (should be referenced):
${state.profile?.signals.map((s) => `• [${s.relevance}] ${s.title}: ${s.description}`).join('\n') || '(no profile)'}`,
      },
    ],
    {
      name: 'critique_pitch',
      description: 'Evaluate pitch quality — detect generic language, missing signal refs, weak CTAs.',
      schema: {
        type: 'object',
        properties: {
          genericLanguageIssues: {
            type: 'array',
            items: { type: 'string' },
            description: 'Phrases that are generic boilerplate, not tied to specific signals',
          },
          missingSignalRefs: {
            type: 'array',
            items: { type: 'string' },
            description: 'High-relevance signals from the profile NOT referenced in the pitch',
          },
          ctaStrength: { type: 'string', enum: ['strong', 'weak', 'missing'] },
          overallQuality: { type: 'number', description: '0-100' },
          needsRevision: { type: 'boolean', description: 'true if quality < 70 or generic language found' },
          summaryNotes: { type: 'string', description: 'One-paragraph assessment shown to the user' },
        },
        required: ['genericLanguageIssues', 'missingSignalRefs', 'ctaStrength', 'overallQuality', 'needsRevision', 'summaryNotes'],
      },
    },
    1000,
  );

  let finalPitch: Pitch = { ...state.pitch, reflectionNotes: critique.summaryNotes, revised: false };

  if (critique.needsRevision) {
    const revised = await callWithTool<{
      subject?: string;
      body: string;
      callToAction: string;
      personalizationPoints: string[];
    }>(
      [
        {
          role: 'user',
          content: `Revise this pitch to fix the critic's feedback. Every sentence must earn its place with a specific signal.

CRITIC FEEDBACK:
- Generic language to remove: ${critique.genericLanguageIssues.join('; ') || 'none'}
- Missing signal references: ${critique.missingSignalRefs.join('; ') || 'none'}
- CTA: ${critique.ctaStrength}${critique.ctaStrength !== 'strong' ? ' — strengthen it' : ''}
- Notes: ${critique.summaryNotes}

ORIGINAL PITCH:
${state.pitch.subject ? `Subject: ${state.pitch.subject}\n\n` : ''}${state.pitch.body}

PROSPECT PROFILE:
${JSON.stringify(state.profile, null, 2)}`,
        },
      ],
      {
        name: 'draft_pitch',
        description: 'Revised pitch addressing all critic feedback.',
        schema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            body: { type: 'string' },
            callToAction: { type: 'string' },
            personalizationPoints: { type: 'array', items: { type: 'string' } },
          },
          required: ['body', 'callToAction', 'personalizationPoints'],
        },
      },
      1500,
    );

    finalPitch = {
      ...finalPitch,
      subject: revised.subject ?? finalPitch.subject,
      body: revised.body,
      callToAction: revised.callToAction,
      personalizationPoints: revised.personalizationPoints,
      revised: true,
    };
  }

  await emit({ type: 'phase_complete', phase: 'reflecting', data: { pitch: finalPitch, critique }, timestamp: new Date() });
  return { pitch: finalPitch };
}

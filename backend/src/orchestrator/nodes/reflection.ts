import { OrchestratorState, Pitch, RunEvent } from '../../types';
import { callWithTool } from '../../llm/client';
import { config } from '../../config';
import { runGate } from '../gate';
import { evaluatePitchCritique, PitchCritique } from '../grading';

export async function critiquePitch(state: OrchestratorState): Promise<PitchCritique> {
  return callWithTool<PitchCritique>(
    [
      {
        role: 'user',
        content: `You are a pitch critic. Flag any sentence that could be sent to ANY prospect unchanged.

PITCH:
${state.pitch!.subject ? `Subject: ${state.pitch!.subject}\n\n` : ''}${state.pitch!.body}

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
          genericLanguageIssues: { type: 'array', items: { type: 'string' }, description: 'Phrases that are generic boilerplate, not tied to specific signals' },
          missingSignalRefs: { type: 'array', items: { type: 'string' }, description: 'High-relevance signals from the profile NOT referenced in the pitch' },
          ctaStrength: { type: 'string', enum: ['strong', 'weak', 'missing'] },
          overallQuality: { type: 'number', description: '0-100' },
          needsRevision: { type: 'boolean', description: 'true if quality below threshold or generic language found' },
          summaryNotes: { type: 'string', description: 'One-paragraph assessment shown to the user' },
        },
        required: ['genericLanguageIssues', 'missingSignalRefs', 'ctaStrength', 'overallQuality', 'needsRevision', 'summaryNotes'],
      },
    },
    1000,
  );
}

export async function revisePitchDraft(state: OrchestratorState, critique: PitchCritique): Promise<Partial<Pitch>> {
  return callWithTool<Partial<Pitch>>(
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
${state.pitch!.subject ? `Subject: ${state.pitch!.subject}\n\n` : ''}${state.pitch!.body}

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
}

export async function reflectionNode(
  state: OrchestratorState,
  emit: (event: RunEvent) => Promise<void>,
): Promise<Partial<OrchestratorState>> {
  if (!state.pitch) return {};

  await emit({ type: 'phase_start', phase: 'reflecting', timestamp: new Date() });

  const threshold = config.gates.pitchQualityThreshold;

  const gate = await runGate(state, {
    name: 'pitch',
    grader: async (s) => evaluatePitchCritique(await critiquePitch(s), threshold),
    reviser: async (s, result) => {
      const critique = result.details as PitchCritique;
      const revised = await revisePitchDraft(s, critique);
      const newPitch: Pitch = {
        ...s.pitch!,
        subject: revised.subject ?? s.pitch!.subject,
        body: revised.body ?? s.pitch!.body,
        callToAction: revised.callToAction ?? s.pitch!.callToAction,
        personalizationPoints: revised.personalizationPoints ?? s.pitch!.personalizationPoints,
        revised: true,
      };
      return { pitch: newPitch };
    },
    maxRevisions: config.gates.pitchRevisions,
    emit,
  });

  const last = gate.attempts[gate.attempts.length - 1];
  const finalPitch: Pitch = {
    ...gate.state.pitch!,
    reflectionNotes: last.feedback,
    score: last.score,
  };

  await emit({ type: 'phase_complete', phase: 'reflecting', data: { pitch: finalPitch, attempts: gate.attempts }, timestamp: new Date() });
  return { pitch: finalPitch, gates: { ...gate.state.gates, pitch: gate.attempts } };
}

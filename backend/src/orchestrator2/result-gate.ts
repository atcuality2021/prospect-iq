import { Run } from '../types';
import { GateResult } from '../orchestrator/gate';

// Deterministic gate over a completed child Run. Reuses the Phase A GateResult
// shape so the engine can drive a bounded re-run via runGate if desired.
export function gradePipelineResult(run: Pick<Run, 'pitch' | 'lowConfidence'>): GateResult {
  const hasPitch = !!run.pitch;
  const pass = hasPitch && !run.lowConfidence;
  return {
    pass,
    score: run.pitch?.score ?? 0,
    feedback: !hasPitch
      ? 'Pipeline produced no pitch.'
      : run.lowConfidence
        ? 'Pipeline completed but flagged low confidence (too few verified signals).'
        : 'Pipeline produced a confident pitch.',
  };
}

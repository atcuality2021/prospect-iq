import { OrchestratorState, RunEvent, Lead } from '../types';
import { researchNode } from './nodes/research';
import { verificationNode } from './nodes/verification';
import { synthesisNode } from './nodes/synthesis';
import { matchingNode } from './nodes/matching';
import { pitchNode } from './nodes/pitch';
import { reflectionNode } from './nodes/reflection';
import { config } from '../config';
import { runGate } from './gate';
import { gradeResearch } from './grading';

const RELAXED_CONFIDENCE_FLOOR = 40;

// Pipeline (paper architecture):
//   research → verify (evidence chains) → synthesize (think-before-act)
//            → match → pitch → reflect (reflexive loop) → done
export class ProspectOrchestrator {
  private state: OrchestratorState;
  private emitFn: (event: RunEvent) => Promise<void>;

  constructor(runId: string, lead: Lead, emitFn: (event: RunEvent) => Promise<void>) {
    this.state = {
      runId,
      lead,
      research: {},
      matches: [],
      events: [],
      errors: [],
    };
    this.emitFn = emitFn;
  }

  private async emit(event: RunEvent): Promise<void> {
    this.state.events.push(event);
    await this.emitFn(event);
  }

  async run(): Promise<OrchestratorState> {
    try {
      const researchUpdate = await researchNode(this.state, this.emit.bind(this));
      this.state = { ...this.state, ...researchUpdate };

      const verificationUpdate = await verificationNode(this.state, this.emit.bind(this));
      this.state = { ...this.state, ...verificationUpdate };

      // Gate 1 — research sufficiency. Reviser re-runs verification on the SAME
      // research at a relaxed confidence floor (recovers borderline facts without
      // re-scraping, which is deterministic). On exhaustion, flag lowConfidence and
      // continue best-effort rather than abort.
      const researchGate = await runGate(this.state, {
        name: 'research',
        grader: async (s) =>
          gradeResearch(s.verification?.verifiedFacts.length ?? 0, config.gates.minVerifiedFacts),
        reviser: async (s) =>
          verificationNode(s, this.emit.bind(this), { confidenceFloor: RELAXED_CONFIDENCE_FLOOR }),
        maxRevisions: config.gates.researchRevisions,
        emit: this.emit.bind(this),
      });
      this.state = researchGate.state;
      this.state.gates = { ...this.state.gates, research: researchGate.attempts };
      if (!researchGate.passed) this.state.lowConfidence = true;

      const synthesisUpdate = await synthesisNode(this.state, this.emit.bind(this));
      this.state = { ...this.state, ...synthesisUpdate };

      const matchingUpdate = await matchingNode(this.state, this.emit.bind(this));
      this.state = { ...this.state, ...matchingUpdate };

      const pitchUpdate = await pitchNode(this.state, this.emit.bind(this));
      this.state = { ...this.state, ...pitchUpdate };

      const reflectionUpdate = await reflectionNode(this.state, this.emit.bind(this));
      this.state = { ...this.state, ...reflectionUpdate };

      await this.emit({ type: 'run_complete', timestamp: new Date() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.state.errors.push(message);
      await this.emit({ type: 'run_failed', error: message, timestamp: new Date() });
    }

    return this.state;
  }
}

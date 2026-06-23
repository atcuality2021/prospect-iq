import { RunEvent } from '../types';

export interface GateResult {
  pass: boolean;
  score: number;       // 0-100 (or a raw count for deterministic gates)
  feedback: string;    // why it failed/passed; fed to the reviser
  details?: unknown;   // grader-specific payload (e.g. the critique object)
}

export interface GateAttempt {
  attempt: number;     // 1-based
  score: number;
  pass: boolean;
  feedback: string;
  timestamp: Date;
}

export interface GateConfig<S> {
  name: string;        // 'research' | 'pitch'
  grader: (state: S) => Promise<GateResult>;
  reviser: (state: S, result: GateResult) => Promise<Partial<S>>;
  maxRevisions: number; // max revise calls; grading runs maxRevisions + 1 times
  emit: (event: RunEvent) => Promise<void>;
}

export interface GateOutcome<S> {
  state: S;
  attempts: GateAttempt[];
  passed: boolean;
}

// grade → if pass, return → else revise → re-grade → loop until pass OR
// revision count reaches maxRevisions. maxRevisions = 0 grades once, never revises.
export async function runGate<S>(state: S, cfg: GateConfig<S>): Promise<GateOutcome<S>> {
  const { name, grader, reviser, maxRevisions, emit } = cfg;
  let current = state;
  const attempts: GateAttempt[] = [];

  await emit({ type: 'gate_start', gate: name, timestamp: new Date() });

  for (let revisions = 0; ; revisions++) {
    const result = await grader(current);
    const attempt: GateAttempt = {
      attempt: revisions + 1,
      score: result.score,
      pass: result.pass,
      feedback: result.feedback,
      timestamp: new Date(),
    };
    attempts.push(attempt);
    await emit({ type: 'gate_attempt', gate: name, data: attempt, timestamp: new Date() });

    if (result.pass) {
      await emit({ type: 'gate_pass', gate: name, data: { score: result.score, attempts: attempts.length }, timestamp: new Date() });
      return { state: current, attempts, passed: true };
    }

    if (revisions >= maxRevisions) {
      await emit({ type: 'gate_fail', gate: name, data: { score: result.score, attempts: attempts.length }, timestamp: new Date() });
      return { state: current, attempts, passed: false };
    }

    const update = await reviser(current, result);
    current = { ...current, ...update };
  }
}

# Phase A — L2 Verification Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close ProspectIQ's single-pass research and pitch steps into real grade→revise→re-grade verification loops, so weak runs are caught and either repaired or flagged instead of silently shipped.

**Architecture:** One generic `runGate<S>` control-flow helper (grade → if fail, revise → re-grade → loop until pass or `maxRevisions`) applied at two points in the existing linear-await orchestrator: a deterministic research-sufficiency gate (after verification) and an agentic pitch-quality gate (wrapping reflection). Gate config comes from `config.ts`/env (the worker is a separate process from the server, so live UI settings are invisible to it). Every gate writes an attempt log to the run document — the observability win and the seed for Phase B's trace substrate.

**Tech Stack:** TypeScript, Express + ts-node, BullMQ worker, Mongoose, Next.js frontend. No new runtime dependencies.

## Global Constraints

- **Runtime flag:** all backend scripts run with `TS_NODE_TRANSPILE_ONLY=true` (Mongoose generic strictness — see project memory). Test/typecheck commands below include it.
- **No new deps:** native TS only. Unit tests follow the existing hand-rolled script convention (`src/test-system.ts`), not a new test framework.
- **Gate config source:** `config.ts` / env vars, NOT `settings.ts` module state (worker runs in a separate process and cannot read server memory).
- **Defaults (verbatim from spec §4.5):** `minVerifiedFacts = 2`, `researchRevisions = 1`, `pitchRevisions = 2`, `pitchQualityThreshold = 70`. Any revision count of `0` disables that gate (restores today's single-pass behavior).
- **Reconciliations from the spec, locked here:**
  - Gate 1 grades on `verification.verifiedFacts.length` (signals don't exist until synthesis, which runs *after* this gate).
  - Gate 1's reviser re-runs **verification with a relaxed confidence floor (40 instead of 60)** on the existing research — it does NOT re-scrape (re-scraping is deterministic and would return identical input). News-query broadening is deferred to a later enhancement.
  - The final pitch score is recorded on `pitch.score` (no separate top-level `pitchScore` field needed).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `backend/src/orchestrator/gate.ts` | Generic `runGate` primitive + gate types | Create |
| `backend/src/orchestrator/grading.ts` | Pure graders (`gradeResearch`, `evaluatePitchCritique`) | Create |
| `backend/src/types.ts` | Add gate event types, `gate?` field, `score?` on Pitch, `gates`/`lowConfidence` on state+Run | Modify |
| `backend/src/config.ts` | Add `gates` config block from env | Modify |
| `backend/src/routes/settings.ts` | Surface gate config in GET response | Modify |
| `backend/src/orchestrator/nodes/verification.ts` | Extract `buildVerificationPrompt`, accept `confidenceFloor` opt | Modify |
| `backend/src/orchestrator/nodes/reflection.ts` | Split into `critiquePitch`/`revisePitchDraft`, drive via `runGate` | Modify |
| `backend/src/orchestrator/index.ts` | Wire Gate 1 after verification | Modify |
| `backend/src/db/models/run.ts` | Persist `gates`, `lowConfidence`, gate event field | Modify |
| `backend/src/queue/worker.ts` | Write `gates`/`lowConfidence` to run doc | Modify |
| `backend/src/test-units.ts` | LLM-free unit tests (grows per task) | Create |
| `backend/package.json` | Add `test:units` + `typecheck` scripts | Modify |
| `frontend/src/lib/types.ts` | Add `gate?` to RunEvent, `lowConfidence?`/`score?` | Modify |
| `frontend/src/components/RunTimeline.tsx` | Low-confidence badge + retry chips | Modify |

---

## Task 1: Gate primitive + event types + unit-test harness

**Files:**
- Create: `backend/src/orchestrator/gate.ts`
- Create: `backend/src/test-units.ts`
- Modify: `backend/src/types.ts:94-101` (RunEvent union + `gate?` field)
- Modify: `backend/package.json:4-10` (scripts)

**Interfaces:**
- Produces: `runGate<S>(state, cfg)` returning `{ state: S; attempts: GateAttempt[]; passed: boolean }`; types `GateResult`, `GateAttempt`, `GateConfig<S>`, `GateOutcome<S>`.

- [ ] **Step 1: Add gate event types and `gate` field to `RunEvent`**

In `backend/src/types.ts`, replace the `RunEvent` interface (lines 94-101):

```ts
export interface RunEvent {
  type:
    | 'agent_start' | 'agent_complete' | 'agent_error'
    | 'phase_start' | 'phase_complete'
    | 'gate_start' | 'gate_attempt' | 'gate_pass' | 'gate_fail'
    | 'run_complete' | 'run_failed';
  phase?: string;
  agent?: string;
  gate?: string;
  data?: unknown;
  error?: string;
  timestamp: Date;
}
```

- [ ] **Step 2: Add `test:units` and `typecheck` scripts**

In `backend/package.json`, add to `scripts` (after line 9):

```json
    "test:units": "TS_NODE_TRANSPILE_ONLY=true ts-node -r tsconfig-paths/register src/test-units.ts",
    "typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Write the failing unit tests**

Create `backend/src/test-units.ts`:

```ts
/**
 * LLM-free unit tests for Phase A gate logic.
 * Run: npm run test:units   (from backend/)
 */
import { runGate } from './orchestrator/gate';
import { RunEvent } from './types';

let passed = 0;
let failed = 0;

function assert(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? `  →  ${detail}` : ''}`);
  cond ? passed++ : failed++;
}

// ── gate primitive ──────────────────────────────────────────────────────────
type S = { value: number };

async function gateTests() {
  // 1. pass on first grade → no revision
  {
    const events: RunEvent[] = [];
    let reviserCalls = 0;
    const out = await runGate<S>({ value: 5 }, {
      name: 'g',
      grader: async (s) => ({ pass: s.value >= 3, score: s.value, feedback: 'ok' }),
      reviser: async (s) => { reviserCalls++; return { value: s.value + 1 }; },
      maxRevisions: 2,
      emit: async (e) => { events.push(e); },
    });
    assert('pass-first: passed=true', out.passed === true);
    assert('pass-first: 1 attempt', out.attempts.length === 1, `got ${out.attempts.length}`);
    assert('pass-first: reviser never called', reviserCalls === 0);
    assert('pass-first: emits gate_start + gate_attempt + gate_pass',
      events.map((e) => e.type).join(',') === 'gate_start,gate_attempt,gate_pass',
      events.map((e) => e.type).join(','));
  }

  // 2. fail then pass after revisions
  {
    let reviserCalls = 0;
    const out = await runGate<S>({ value: 1 }, {
      name: 'g',
      grader: async (s) => ({ pass: s.value >= 3, score: s.value, feedback: 'x' }),
      reviser: async (s) => { reviserCalls++; return { value: s.value + 1 }; },
      maxRevisions: 3,
      emit: async () => {},
    });
    assert('fail-then-pass: passed=true', out.passed === true);
    assert('fail-then-pass: 3 attempts', out.attempts.length === 3, `got ${out.attempts.length}`);
    assert('fail-then-pass: 2 revisions', reviserCalls === 2, `got ${reviserCalls}`);
    assert('fail-then-pass: final state value=3', out.state.value === 3, `got ${out.state.value}`);
  }

  // 3. never pass → exhausts to maxRevisions
  {
    let reviserCalls = 0;
    const events: RunEvent[] = [];
    const out = await runGate<S>({ value: 0 }, {
      name: 'g',
      grader: async (s) => ({ pass: false, score: s.value, feedback: 'never' }),
      reviser: async (s) => { reviserCalls++; return { value: s.value }; },
      maxRevisions: 2,
      emit: async (e) => { events.push(e); },
    });
    assert('exhaust: passed=false', out.passed === false);
    assert('exhaust: 3 attempts (1 + 2 revisions)', out.attempts.length === 3, `got ${out.attempts.length}`);
    assert('exhaust: reviser called twice', reviserCalls === 2, `got ${reviserCalls}`);
    assert('exhaust: terminal event is gate_fail',
      events[events.length - 1].type === 'gate_fail', events[events.length - 1].type);
  }

  // 4. maxRevisions=0 → single pass, never revises
  {
    let reviserCalls = 0;
    const out = await runGate<S>({ value: 0 }, {
      name: 'g',
      grader: async (s) => ({ pass: false, score: s.value, feedback: 'single' }),
      reviser: async (s) => { reviserCalls++; return { value: s.value }; },
      maxRevisions: 0,
      emit: async () => {},
    });
    assert('disabled: 1 attempt', out.attempts.length === 1, `got ${out.attempts.length}`);
    assert('disabled: reviser never called', reviserCalls === 0);
    assert('disabled: passed=false', out.passed === false);
  }
}

async function main() {
  await gateTests();
  console.log(`\n${passed}/${passed + failed} passed${failed ? ` — ${failed} FAILED` : ' 🎉'}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd backend && npm run test:units`
Expected: FAIL — `Cannot find module './orchestrator/gate'` (file not created yet).

- [ ] **Step 5: Implement `gate.ts`**

Create `backend/src/orchestrator/gate.ts`:

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && npm run test:units`
Expected: PASS — all assertions ✅, `15/15 passed 🎉`.

- [ ] **Step 7: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: no output (exit 0).

- [ ] **Step 8: Commit**

```bash
git add backend/src/orchestrator/gate.ts backend/src/test-units.ts backend/src/types.ts backend/package.json
git commit -m "feat(gates): add generic runGate primitive + gate events + unit harness"
```

---

## Task 2: Gate config in `config.ts` + surface in settings

**Files:**
- Modify: `backend/src/config.ts:9-26`
- Modify: `backend/src/routes/settings.ts:20-43`

**Interfaces:**
- Produces: `config.gates = { minVerifiedFacts: number; researchRevisions: number; pitchRevisions: number; pitchQualityThreshold: number }`.
- Consumes: nothing.

- [ ] **Step 1: Add `gates` block to config**

In `backend/src/config.ts`, inside the `export const config = { ... }` object, add after `frontendUrl` (line 25):

```ts
  gates: {
    minVerifiedFacts:     parseInt(process.env.GATE_MIN_VERIFIED_FACTS   || '2', 10),
    researchRevisions:    parseInt(process.env.GATE_RESEARCH_REVISIONS   || '1', 10),
    pitchRevisions:       parseInt(process.env.GATE_PITCH_REVISIONS      || '2', 10),
    pitchQualityThreshold: parseInt(process.env.GATE_PITCH_QUALITY       || '70', 10),
  },
```

- [ ] **Step 2: Write the failing test**

Append to `backend/src/test-units.ts`, inside `main()` before the summary `console.log`, add a call `await configTests();` and define above `main()`:

```ts
import { config } from './config';

async function configTests() {
  assert('config.gates.minVerifiedFacts default 2', config.gates.minVerifiedFacts === 2, `got ${config.gates.minVerifiedFacts}`);
  assert('config.gates.researchRevisions default 1', config.gates.researchRevisions === 1, `got ${config.gates.researchRevisions}`);
  assert('config.gates.pitchRevisions default 2', config.gates.pitchRevisions === 2, `got ${config.gates.pitchRevisions}`);
  assert('config.gates.pitchQualityThreshold default 70', config.gates.pitchQualityThreshold === 70, `got ${config.gates.pitchQualityThreshold}`);
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && npm run test:units`
Expected: FAIL — TS error or assertion failure on `config.gates` (block not yet added) if run before Step 1, otherwise the 4 new assertions PASS once Step 1 is in. (If you wrote Step 1 first, run shows the 4 new assertions green — that is acceptable; the point is they exercise the new config.)

- [ ] **Step 4: Surface gate config in settings GET**

In `backend/src/routes/settings.ts`, add `import { config } from '../config'` is already present (line 2). Inside the `res.json({ ... })` object in the GET handler, add after the `prompts:` line (line 42):

```ts
    gates: {
      minVerifiedFacts:      config.gates.minVerifiedFacts,
      researchRevisions:     config.gates.researchRevisions,
      pitchRevisions:        config.gates.pitchRevisions,
      pitchQualityThreshold: config.gates.pitchQualityThreshold,
    },
```

(Read-only display: these are worker-process config, not editable from the UI — same pattern as the read-only LLM keys.)

- [ ] **Step 5: Run tests + typecheck**

Run: `cd backend && npm run test:units && npm run typecheck`
Expected: all ✅, typecheck exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config.ts backend/src/routes/settings.ts backend/src/test-units.ts
git commit -m "feat(gates): add gate config knobs from env + surface in settings"
```

---

## Task 3: State, types, and run-model fields for gate results

**Files:**
- Modify: `backend/src/types.ts` (Pitch, OrchestratorState, Run)
- Modify: `backend/src/db/models/run.ts`

**Interfaces:**
- Produces: `Pitch.score?`, `OrchestratorState.gates?`, `OrchestratorState.lowConfidence?`, `Run.gates?`, `Run.lowConfidence?`; Mongoose persistence for these.
- Consumes: `GateAttempt` from `gate.ts`.

- [ ] **Step 1: Extend `Pitch`, `OrchestratorState`, and `Run` types**

In `backend/src/types.ts`:

Add `score` to `Pitch` (after line 88 `revised?: boolean;`):

```ts
  score?: number;        // final pitch-quality score from Gate 2
```

Add a shared import-free alias near the top of the gate block — reuse `GateAttempt` by importing it. At the top of `types.ts` add nothing (avoid circular import: `gate.ts` imports from `types.ts`). Instead define the persisted attempt shape inline in `types.ts`:

```ts
export interface GatesRecord {
  research?: { attempt: number; score: number; pass: boolean; feedback: string; timestamp: Date }[];
  pitch?:    { attempt: number; score: number; pass: boolean; feedback: string; timestamp: Date }[];
}
```

Then in `OrchestratorState` (after line 147 `errors: string[];`):

```ts
  gates?: GatesRecord;
  lowConfidence?: boolean;
```

And in `Run` (after line 128 `chatHistory?: ChatMessage[];`):

```ts
  gates?: GatesRecord;
  lowConfidence?: boolean;
```

> Note: `gate.ts`'s `GateAttempt` is structurally identical to the entries in `GatesRecord`, so assigning `GateAttempt[]` to `GatesRecord['research']` typechecks. This avoids a `gate.ts` → `types.ts` → `gate.ts` import cycle.

- [ ] **Step 2: Persist the new fields in the Mongoose schema**

In `backend/src/db/models/run.ts`:

Add `gate: String` to `RunEventSchema` (after line 9 `agent: String,`):

```ts
  gate: String,
```

Add a `GateAttemptSchema` after `ChatMessageSchema` (after line 39):

```ts
const GateAttemptSchema = new Schema({
  attempt:   Number,
  score:     Number,
  pass:      Boolean,
  feedback:  String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });
```

Add to `RunSchema` (after line 55 `chatHistory: [ChatMessageSchema],`):

```ts
  gates: {
    research: [GateAttemptSchema],
    pitch:    [GateAttemptSchema],
  },
  lowConfidence: { type: Boolean, default: false },
```

- [ ] **Step 3: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: no output (exit 0). No new test needed — these are type/schema declarations exercised by Tasks 5–7.

- [ ] **Step 4: Commit**

```bash
git add backend/src/types.ts backend/src/db/models/run.ts
git commit -m "feat(gates): add gates/lowConfidence/pitch.score to state, types, run model"
```

---

## Task 4: Verification node — extract prompt builder + accept confidence floor

**Files:**
- Modify: `backend/src/orchestrator/nodes/verification.ts`
- Modify: `backend/src/test-units.ts`

**Interfaces:**
- Produces: `buildVerificationPrompt(sources, confidenceFloor): string`; `verificationNode(state, emit, opts?: { confidenceFloor?: number })` (floor defaults to 60).
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test for `buildVerificationPrompt`**

Append to `backend/src/test-units.ts`. Add `await verificationTests();` in `main()` and define:

```ts
import { buildVerificationPrompt } from './orchestrator/nodes/verification';

async function verificationTests() {
  const sources = [{ source: 'website', text: 'Acme builds rockets.' }];
  const p60 = buildVerificationPrompt(sources, 60);
  const p40 = buildVerificationPrompt(sources, 40);
  assert('prompt includes floor 60', p60.includes('confidence ≥ 60'), p60.slice(0, 0));
  assert('relaxed prompt includes floor 40', p40.includes('confidence ≥ 40'));
  assert('prompt includes source header', p60.includes('=== WEBSITE ==='));
  assert('prompt includes source text', p60.includes('Acme builds rockets.'));
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npm run test:units`
Expected: FAIL — `buildVerificationPrompt` is not exported yet.

- [ ] **Step 3: Refactor `verification.ts`**

In `backend/src/orchestrator/nodes/verification.ts`, add the exported builder above `verificationNode`:

```ts
export function buildVerificationPrompt(
  sources: { source: string; text: string }[],
  confidenceFloor: number,
): string {
  return `You are a fact-checker. Extract ONLY facts explicitly stated in the source text.

RULES:
1. Every fact needs a verbatim quote from the source proving it
2. Discard anything requiring inference or assumption
3. Only include facts with confidence ≥ ${confidenceFloor}

SOURCE MATERIAL:
${sources.map((s) => `=== ${s.source.toUpperCase()} ===\n${s.text}`).join('\n\n')}`;
}
```

Change the signature (line 4-7) to accept opts:

```ts
export async function verificationNode(
  state: OrchestratorState,
  emit: (event: RunEvent) => Promise<void>,
  opts: { confidenceFloor?: number } = {},
): Promise<Partial<OrchestratorState>> {
  const confidenceFloor = opts.confidenceFloor ?? 60;
```

Replace the inline prompt `content` (lines 23-32) with:

```ts
        content: buildVerificationPrompt(sources, confidenceFloor),
```

Update the confidence schema description (line 51) to reflect the floor:

```ts
                confidence: { type: 'number', description: `${confidenceFloor}-100 only` },
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd backend && npm run test:units && npm run typecheck`
Expected: all ✅, typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/orchestrator/nodes/verification.ts backend/src/test-units.ts
git commit -m "feat(gates): extract buildVerificationPrompt + accept confidence floor"
```

---

## Task 5: Gate 1 — research sufficiency, wired into the orchestrator

**Files:**
- Create: `backend/src/orchestrator/grading.ts`
- Modify: `backend/src/orchestrator/index.ts`
- Modify: `backend/src/test-units.ts`

**Interfaces:**
- Produces: `gradeResearch(verifiedFactCount, minVerifiedFacts): GateResult`.
- Consumes: `runGate` (Task 1), `verificationNode` with `confidenceFloor` (Task 4), `config.gates` (Task 2), `OrchestratorState.gates`/`lowConfidence` (Task 3).

- [ ] **Step 1: Write the failing test for `gradeResearch`**

Append to `backend/src/test-units.ts`. Add `await gradingTests();` in `main()` and define:

```ts
import { gradeResearch } from './orchestrator/grading';

async function gradingTests() {
  const fail = gradeResearch(0, 2);
  assert('gradeResearch 0/2 fails', fail.pass === false);
  assert('gradeResearch fail score = count', fail.score === 0);
  const pass = gradeResearch(3, 2);
  assert('gradeResearch 3/2 passes', pass.pass === true);
  const edge = gradeResearch(2, 2);
  assert('gradeResearch 2/2 passes (>=)', edge.pass === true);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npm run test:units`
Expected: FAIL — `./orchestrator/grading` not found.

- [ ] **Step 3: Create `grading.ts` with `gradeResearch`**

Create `backend/src/orchestrator/grading.ts`:

```ts
import { GateResult } from './gate';

export function gradeResearch(verifiedFactCount: number, minVerifiedFacts: number): GateResult {
  const pass = verifiedFactCount >= minVerifiedFacts;
  return {
    pass,
    score: verifiedFactCount,
    feedback: pass
      ? `${verifiedFactCount} verified facts (≥ ${minVerifiedFacts} required)`
      : `Only ${verifiedFactCount} verified facts; need ${minVerifiedFacts}. Relaxing confidence floor to recover borderline facts.`,
  };
}
```

- [ ] **Step 4: Wire Gate 1 into the orchestrator**

In `backend/src/orchestrator/index.ts`:

Add imports at the top (after line 7):

```ts
import { config } from '../config';
import { runGate } from './gate';
import { gradeResearch } from './grading';

const RELAXED_CONFIDENCE_FLOOR = 40;
```

Replace the verification call block (lines 38-39) with the gated version:

```ts
      const verificationUpdate = await verificationNode(this.state, this.emit.bind(this));
      this.state = { ...this.state, ...verificationUpdate };

      const researchGate = await runGate(this.state, {
        name: 'research',
        grader: async (s) =>
          gradeResearch(s.verification?.verifiedFacts.length ?? 0, config.gates.minVerifiedFacts),
        // Reviser re-runs verification on the SAME research with a relaxed confidence
        // floor — recovers borderline facts without re-scraping (which is deterministic).
        reviser: async (s) =>
          verificationNode(s, this.emit.bind(this), { confidenceFloor: RELAXED_CONFIDENCE_FLOOR }),
        maxRevisions: config.gates.researchRevisions,
        emit: this.emit.bind(this),
      });
      this.state = researchGate.state;
      this.state.gates = { ...this.state.gates, research: researchGate.attempts };
      if (!researchGate.passed) this.state.lowConfidence = true;
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd backend && npm run test:units && npm run typecheck`
Expected: all ✅ (4 new grading assertions green), typecheck exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/orchestrator/grading.ts backend/src/orchestrator/index.ts backend/src/test-units.ts
git commit -m "feat(gates): Gate 1 research-sufficiency — retry verification at relaxed floor, flag lowConfidence"
```

---

## Task 6: Gate 2 — pitch quality, refactor reflection into a real loop

**Files:**
- Modify: `backend/src/orchestrator/nodes/reflection.ts`
- Modify: `backend/src/orchestrator/grading.ts`
- Modify: `backend/src/test-units.ts`

**Interfaces:**
- Produces: `evaluatePitchCritique(critique, threshold): GateResult`; `critiquePitch(state): Promise<PitchCritique>`; `revisePitchDraft(state, critique): Promise<Partial<Pitch>>`; `reflectionNode` now loops via `runGate`.
- Consumes: `runGate`, `config.gates.pitchQualityThreshold`, `config.gates.pitchRevisions`.

- [ ] **Step 1: Write the failing test for `evaluatePitchCritique`**

Append to `backend/src/test-units.ts`. Add to `gradingTests()`:

```ts
import { evaluatePitchCritique } from './orchestrator/grading';

  // (append inside gradingTests)
  const base = { missingSignalRefs: [], ctaStrength: 'strong' as const, needsRevision: false, summaryNotes: 'n' };
  const good = evaluatePitchCritique({ ...base, genericLanguageIssues: [], overallQuality: 80 }, 70);
  assert('pitch 80>=70 & no generic → pass', good.pass === true);
  assert('pitch pass score=80', good.score === 80);
  const lowScore = evaluatePitchCritique({ ...base, genericLanguageIssues: [], overallQuality: 60 }, 70);
  assert('pitch 60<70 → fail', lowScore.pass === false);
  const generic = evaluatePitchCritique({ ...base, genericLanguageIssues: ['Dear Sir'], overallQuality: 90 }, 70);
  assert('pitch high score but generic language → fail', generic.pass === false);
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npm run test:units`
Expected: FAIL — `evaluatePitchCritique` not exported.

- [ ] **Step 3: Add `evaluatePitchCritique` + `PitchCritique` to `grading.ts`**

Append to `backend/src/orchestrator/grading.ts`:

```ts
export interface PitchCritique {
  genericLanguageIssues: string[];
  missingSignalRefs: string[];
  ctaStrength: 'strong' | 'weak' | 'missing';
  overallQuality: number;
  needsRevision: boolean;
  summaryNotes: string;
}

export function evaluatePitchCritique(c: PitchCritique, threshold: number): GateResult {
  const pass = c.overallQuality >= threshold && c.genericLanguageIssues.length === 0;
  return { pass, score: c.overallQuality, feedback: c.summaryNotes, details: c };
}
```

- [ ] **Step 4: Refactor `reflection.ts` to drive the gate**

Replace the entire body of `backend/src/orchestrator/nodes/reflection.ts` with:

```ts
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
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd backend && npm run test:units && npm run typecheck`
Expected: all ✅ (3 new pitch-critique assertions green), typecheck exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/orchestrator/nodes/reflection.ts backend/src/orchestrator/grading.ts backend/src/test-units.ts
git commit -m "feat(gates): Gate 2 pitch-quality — critique→revise→re-critique loop with score"
```

---

## Task 7: Persist gate results in the worker + surface in the UI

**Files:**
- Modify: `backend/src/queue/worker.ts:44-52`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/components/RunTimeline.tsx`

**Interfaces:**
- Consumes: `finalState.gates`, `finalState.lowConfidence` (Task 5/6); gate events (`gate_attempt`, `gate_fail`).
- Produces: persisted `gates`/`lowConfidence` on the run; UI badge + retry chips.

- [ ] **Step 1: Persist gate fields in the worker**

In `backend/src/queue/worker.ts`, extend the final `RunModel.updateOne` (lines 44-52) to include the gate fields:

```ts
      await RunModel.updateOne({ runId }, {
        status: failed ? 'failed' : 'completed',
        research: finalState.research,
        verification: finalState.verification,
        profile: finalState.profile,
        matches: finalState.matches,
        pitch: finalState.pitch,
        gates: finalState.gates,
        lowConfidence: finalState.lowConfidence ?? false,
        ...(failed && { error: finalState.errors.join('; ') }),
      });
```

- [ ] **Step 2: Add gate fields to frontend types**

In `frontend/src/lib/types.ts`:

Add `gate?` to `RunEvent` (after line 95 `agent?: string;`):

```ts
  gate?: string;
```

Add `score` to `Pitch` (after line 87 `revised?: boolean;`):

```ts
  score?: number;
```

Add `lowConfidence` to `Run` (after line 116 `error?: string;`):

```ts
  lowConfidence?: boolean;
```

- [ ] **Step 3: Add low-confidence badge + retry chips to the timeline**

In `frontend/src/components/RunTimeline.tsx`, inside the `RunTimeline` component, after the `agentState` helper (line 65), add two derived helpers:

```ts
  const gateAttempts = (gate: string) =>
    events.filter((e) => e.type === 'gate_attempt' && e.gate === gate).length;
  const lowConfidence = events.some((e) => e.type === 'gate_fail' && e.gate === 'research');
```

In the header block, add the badge next to the progress count. Replace the `<span className="text-xs font-mono text-gray-400">{completedCount}/{PHASES.length}</span>` line (line 81) with:

```tsx
          {lowConfidence && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              ⚠ low confidence
            </span>
          )}
          <span className="text-xs font-mono text-gray-400">{completedCount}/{PHASES.length}</span>
```

Add a "retried" chip on the verification and reflection phases. Inside the phase `.map`, after the `done` badge block (after line 140, the closing `)}` of the `ps === 'done'` block), add:

```tsx
                    {(() => {
                      const gateKey = phase.key === 'verifying' ? 'research' : phase.key === 'reflecting' ? 'pitch' : null;
                      const attempts = gateKey ? gateAttempts(gateKey) : 0;
                      return attempts > 1 ? (
                        <span className="text-[11px] text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full">
                          🔁 retried {attempts - 1}×
                        </span>
                      ) : null;
                    })()}
```

- [ ] **Step 4: Update the reflection phase description copy**

In `RunTimeline.tsx`, the `PHASES` array `reflecting` entry (line 15) hardcodes "revises if quality < 70". Change its `desc` to read from the gate's behavior generically:

```ts
  { key: 'reflecting', label: 'Reflection',         icon: '◎', desc: 'Critic scores the pitch and re-revises until it clears the quality bar'},
```

- [ ] **Step 5: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 6: Backend typecheck (regression)**

Run: `cd backend && npm run typecheck && npm run test:units`
Expected: typecheck exit 0; all unit assertions ✅.

- [ ] **Step 7: Commit**

```bash
git add backend/src/queue/worker.ts frontend/src/lib/types.ts frontend/src/components/RunTimeline.tsx
git commit -m "feat(gates): persist gate results + show low-confidence badge & retry chips"
```

---

## Final Verification (manual, requires live LLM + Mongo + Redis)

After Task 7, run the existing end-to-end script to confirm nothing regressed and the loops engage on real data:

```bash
cd backend && TS_NODE_TRANSPILE_ONLY=true npx ts-node -r tsconfig-paths/register src/test-system.ts
```

Expected: the 13 existing checks still pass. For a live pipeline run (backend + worker + frontend up per project memory), pick a sparse prospect and confirm: the run timeline shows a `🔁 retried` chip if research/pitch looped, and a `⚠ low confidence` badge if research stayed below `minVerifiedFacts` after the retry.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §4.1 generic gate → Task 1 ✅
- §4.2 Gate 1 research sufficiency (deterministic grader, relaxed-floor reviser, continue-but-flag) → Tasks 4 + 5 ✅
- §4.3 Gate 2 pitch quality (close the loop, threshold-driven, re-critique) → Task 6 ✅
- §4.4 data model (`gates`, `lowConfidence`, pitch score) → Task 3 ✅ (score lives on `pitch.score` per locked reconciliation)
- §4.5 config knobs + defaults → Task 2 ✅
- §4.6 events + UI badge → Tasks 1 (events) + 7 (UI) ✅
- §4.7 cost envelope (caps, opt-out via 0) → enforced by `maxRevisions` in Task 1, config in Task 2 ✅
- §4.8 testing (gate unit tests, gradeResearch, pitch critique) → Tasks 1/5/6 ✅
- §6 success criteria 1-5 → covered; criterion 5 (retries=0 restores single pass) verified by Task 1 test #4.

**Reconciliations made explicit** (Global Constraints): Gate 1 grades on `verifiedFacts` not signals; reviser relaxes floor instead of re-scraping; gate config from `config.ts` not UI settings (process boundary); score on `pitch.score`.

**Type consistency:** `GateResult`/`GateAttempt` (gate.ts) ↔ `GatesRecord` (types.ts) are structurally identical to avoid an import cycle; `runGate`, `gradeResearch`, `evaluatePitchCritique`, `critiquePitch`, `revisePitchDraft` signatures match across producing and consuming tasks.

**No placeholders:** every code step contains complete code; every run step has an exact command + expected output.

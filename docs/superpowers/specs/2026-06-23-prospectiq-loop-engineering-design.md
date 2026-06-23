# ProspectIQ — Loop Engineering Design

**Date:** 2026-06-23
**Author:** Harish K (with Claude)
**Status:** Approved design — Phase A ready for implementation planning
**Source inspiration:** "The Art of Loop Engineering" (LangChain) — stacked agent loops

---

## 1. Context & Motivation

ProspectIQ is a multi-agent lead-research platform: a 6-phase orchestrator
(`research → verify → synthesize → match → pitch → reflect`) that turns a company/person
into a tailored sales pitch matched against a service catalog. The orchestrator is a
hand-rolled sequential `await` chain (`backend/src/orchestrator/index.ts`), **not** LangGraph.
Each node is a pure `(state) => Partial<state>` function.

Mapping the system onto the four-loop stack from the loop-engineering article:

| Loop | Idea | ProspectIQ today |
|------|------|------------------|
| 1. Agent | Model + tools in a loop | ✅ Have it — 9 agents, ~12 LLM calls/run |
| 2. Verification | Grader checks output, feeds failures back | 🟡 Partial — `reflection.ts` critiques + revises **once**, no re-check, no gate |
| 3. Event-driven | Webhook/cron/event fires the agent | ❌ Manual runs only |
| 4. Hill-climbing | Analyze traces → improve harness | ❌ No trace capture/analysis |

**Two observed failure modes (2026-06-20 run history) motivate Phase A:**
1. **Generic pitches** — what `reflection.ts` already targets, but it ships even when revision doesn't fix it.
2. **Zero-signal runs** — Freshworks and Manipal Hospitals returned 0 signals yet still ran the full
   downstream pipeline and shipped empty pitches.

## 2. Foundational Decisions

- **Implementation:** Native TypeScript in the existing custom orchestrator. No LangChain/LangGraph/LangSmith.
  Rationale: minimal new deps, full control, preserves the on-prem-friendly posture (LangSmith is cloud SaaS).
- **Scope:** Full four-loop roadmap, built incrementally. This spec details **Phase A** fully; B/C/D are
  captured as intents and each gets its own spec when reached.

## 3. Roadmap (sequence & rationale)

```
Phase A — L2 Verification gates      ← this spec
Phase B — Trace substrate            ← record every run + gate decision (enables L4)
Phase C — L3 Event triggers          ← cron / webhook / Slack fire runs automatically
Phase D — L4 Hill-climbing           ← analysis agent reads traces → proposes prompt/rubric edits
```

**Why this order:** A is cheapest and highest-impact, building directly on `reflection.ts`. A's
gate-decision records (attempts, scores, feedback) are the first slice of B's trace substrate, so A
naturally seeds B. D depends on B's traces. C is independent but most valuable once A guarantees
output quality (don't auto-fire unreviewed work).

### Phase B/C/D intents (not yet specced)

- **B — Trace substrate:** Persist a normalized trace per run: inputs, every LLM call (prompt, model,
  tokens, latency), tool calls, gate attempts, final scores. Stored in Mongo (or a dedicated collection).
  Phase A's `gates` records are the seed; B generalizes capture across all nodes.
- **C — Event triggers:** A trigger layer that enqueues runs without UI interaction — cron ("refresh
  these prospects weekly"), webhook ("new lead in CRM"), and a Slack channel listener. Reuses the existing
  BullMQ queue; adds a scheduler + result-delivery/notification path.
- **D — Hill-climbing:** An analysis agent (own LLM client) reads B's traces, detects systematic failures
  across many runs (e.g., a phase whose gate keeps failing on a pattern), and proposes edits to the
  editable prompts (`/settings/prompts`) or gate rubrics. Output is a reviewable suggestion, not an auto-apply.

---

## 4. Phase A — Detailed Design

### 4.1 Architecture: one reusable gate, two uses

Add a single generic control-flow helper and apply it at two points. Localized change:
one new file (`orchestrator/gate.ts`) plus edits to `orchestrator/index.ts`.

```ts
// backend/src/orchestrator/gate.ts  (new)
export interface GateResult {
  pass: boolean;
  score: number;        // 0-100
  feedback: string;     // why it failed / passed; fed to the reviser
  details?: unknown;    // grader-specific payload (e.g., critique object)
}

export interface GateAttempt {
  attempt: number;      // 1-based
  score: number;
  pass: boolean;
  feedback: string;
  timestamp: Date;
}

type Grader<S>  = (state: S) => Promise<GateResult>;
type Reviser<S> = (state: S, g: GateResult) => Promise<Partial<S>>;

interface GateConfig<S> {
  name: string;                 // 'research' | 'pitch'
  grader: Grader<S>;
  reviser: Reviser<S>;
  maxRevisions: number;         // max revise calls; grading runs maxRevisions + 1 times
  emit: (event: RunEvent) => Promise<void>;
}

// Control flow: grade → if pass, return → else revise → re-grade → loop until
// pass OR revision count reaches maxRevisions. Always returns the best state reached
// plus the full attempt log. With maxRevisions = 0 the gate grades once and never
// revises (restores today's single-pass behavior).
export async function runGate<S>(
  state: S,
  cfg: GateConfig<S>,
): Promise<{ state: S; attempts: GateAttempt[]; passed: boolean }>;
```

Every gate produces an **attempt log** written to the run document — the observability win and the
Phase B trace seed.

### 4.2 Gate 1 — Research sufficiency (the zero-signal fix)

- **Position:** after `verificationNode`, before `synthesisNode`.
- **Grader — deterministic, no LLM:** count verified signals; `pass = signals.length >= minSignals`
  (new setting, default **2**). Free on the happy path — no token cost.
- **Reviser on fail:** re-invoke `researchNode` with a `broaden` directive — loosen LinkedIn/news
  queries (company-only, drop person constraint, add domain variants). Cap **1 retry** (re-scraping is slow).
- **On exhaustion:** set `lowConfidence: true` and **continue** best-effort (still produce a flagged
  pitch) rather than aborting. The flag is shown in the UI and filterable in `/runs`.

Rationale for a deterministic grader: re-running scrapers costs latency, so gate on a free signal-count
check and only spend the expensive retry when genuinely empty. (Graders may be deterministic or agentic;
cost dictates the choice.)

### 4.3 Gate 2 — Pitch quality (close the existing loop)

- **Position:** wraps the current `reflectionNode` logic.
- **Grader — agentic:** reuse the existing `critique_pitch` call. `pass = overallQuality >= bar &&
  genericLanguageIssues.length === 0`. **`bar` reads from the existing `/settings/agents` quality
  threshold** — no new hardcoded constant.
- **Reviser on fail:** the existing `draft_pitch` revision call.
- **The fix:** today it critiques → revises → ships. New: critique → revise → **re-critique** → loop
  until pass or **maxAttempts = 2 revisions**. The shipped pitch carries its final score and attempt count.

### 4.4 Data model (`backend/src/db/models/run.ts`)

Add fields without re-introducing the `Schema<RunDoc>` generic (the reason `TS_NODE_TRANSPILE_ONLY`
is required — see project memory):

```ts
gates: {
  research: GateAttempt[];
  pitch: GateAttempt[];
};
lowConfidence: boolean;   // set true when Gate 1 exhausted retries
pitchScore: number;       // final pitch score after Gate 2
```

### 4.5 Config (`/settings/agents` + backend settings route)

Surface alongside the existing quality threshold:

| Setting | Default | Meaning |
|---------|---------|---------|
| `minSignals` | 2 | Gate 1 pass bar (signal count) |
| `researchRetries` | 1 | Gate 1 max research re-runs |
| `pitchRetries` | 2 | Gate 2 max revision loops |
| (existing) quality threshold | — | Gate 2 score bar |

Setting any retry count to `0` disables that gate (opt-out, bounds cost).

### 4.6 Events & UI

New events emitted through the existing emitter so the live `RunTimeline` shows retries:
`gate_start`, `gate_attempt`, `gate_pass`, `gate_fail`. Visible proof the loop is working — and a
`lowConfidence` badge on the run.

### 4.7 Cost envelope

Worst case adds 1 research retry + ~2 extra critique/revise calls per run. Bounded by the caps;
fully opt-out via caps = 0. Happy-path Gate 1 adds zero tokens (deterministic).

### 4.8 Testing

- **Unit — `runGate`** with mock graders: pass-first (no revise), fail-then-pass (one revise),
  never-pass (exhausts to `maxAttempts`, returns best state + full log).
- **Integration — Gate 1:** a 0-signal state trips the gate; after exhausted retries the run is
  flagged `lowConfidence` and still completes.
- **Integration — Gate 2:** a low-score pitch loops then ships with a recorded final score.

---

## 5. Out of Scope (Phase A)

- LangChain/LangGraph/LangSmith adoption.
- Phases B/C/D implementation (specced separately).
- Per-phase rubrics for synthesis/matching (only research + pitch are gated; revisit if traces show
  those phases failing).
- Auto-applying any prompt/rubric changes (that's Phase D, and remains human-reviewed).

## 6. Success Criteria

1. A run with < `minSignals` signals triggers a research retry, and if still empty completes flagged
   `lowConfidence` (no silent empty pitch).
2. A pitch scoring below the threshold is revised and **re-graded**, looping up to the cap, and ships
   with its final score recorded.
3. Every gated run records a complete `gates` attempt log on its run document.
4. The live run timeline visibly shows gate attempts.
5. Setting retries to 0 restores today's single-pass behavior (safe opt-out).

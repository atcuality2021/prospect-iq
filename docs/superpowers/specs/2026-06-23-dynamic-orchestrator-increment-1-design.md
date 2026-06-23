# Dynamic Orchestrator — Increment 1 (Orchestrator Core) Design

**Date:** 2026-06-23
**Status:** Approved design — ready for implementation planning
**Parent initiative:** Loop 1 Upgrade (dynamic planner-orchestrator on top of the fixed pipeline)
**Depends on:** Phase A — L2 Verification Gates (reuses the `runGate` primitive)

---

## 1. Context & Motivation

ProspectIQ today runs a **fixed** 6-phase pipeline (`research→verify→synthesize→match→pitch→reflect`)
hardcoded in `backend/src/orchestrator/index.ts`. The user gives a structured lead (url/company/linkedin)
and always gets the same sequence. There is no planning — the steps never change with the goal.

We are adding a **dynamic orchestrator**: the user states a free-form *goal*, and an LLM planner decides
what to do, runs it through sub-agents, quality-checks each result, adapts the remaining plan based on what
it learns, and loops until the goal is met. The existing pipeline becomes one **tool** the planner can call.

**Decided architecture (from brainstorming):**
- Planner style: **hybrid plan + adapt** (initial plan → execute + gate → replan remaining → repeat).
- Tool palette (full initiative): research pipeline, multi-target fan-out, granular phases, web search.
- The pipeline is **wrapped as a tool**, not replaced. Today's `/new` structured flow stays.

**This spec covers Increment 1 only:** the full agentic loop with a **single tool** —
`run_research_pipeline` — to de-risk the control flow, data model, and UI before widening the palette.

## 2. Scope

**In scope (Increment 1):**
- New `OrchestrationRun` concept and Mongo model (distinct from the existing per-pipeline `Run`).
- Planner → Executor → Gate → Replanner → Goal-Grader → Synthesizer loop, bounded.
- One tool: `run_research_pipeline(lead)` wrapping the existing `ProspectOrchestrator`.
- Backend routes + a BullMQ job to run orchestrations in the worker.
- Frontend `/orchestrate` page: goal input + live "plan board".

**Out of scope (later increments):** `fan_out` parallel sub-agents (Inc 2), granular phase tools (Inc 3),
`web_search` (Inc 4). Also out: editing the plan by hand, auth, multi-user.

## 3. Glossary / Data Model

A **Run** (existing) = one execution of the fixed pipeline for one lead.
An **OrchestrationRun** (new) = one goal-driven session that *contains* a plan and zero-or-more child Runs.

```ts
// backend/src/types.ts (new)
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PlanTask {
  id: string;                 // stable within the orchestration
  tool: 'run_research_pipeline';   // Increment 1: only this tool
  args: Record<string, unknown>;   // e.g. { lead: { company, url, linkedinUrl } }
  rationale: string;          // why the planner added this task
  status: TaskStatus;
  childRunId?: string;        // the Run produced by this task, if any
  gatePassed?: boolean;       // result of the goal-level gate check
  resultSummary?: string;     // short text the synthesizer/grader can read
}

export type OrchestrationStatus =
  | 'queued' | 'planning' | 'executing' | 'replanning' | 'grading' | 'completed' | 'failed';

export interface OrchestrationRun {
  orchestrationId: string;
  goal: string;               // the free-form user goal
  hints?: Record<string, unknown>;  // optional structured hints from the form
  status: OrchestrationStatus;
  plan: PlanTask[];           // grows/changes across replans
  iterations: number;         // planner/replanner cycles used
  maxIterations: number;      // cap (default 6)
  goalMet: boolean;
  partial: boolean;           // true when capped before goal fully met (mirrors lowConfidence)
  finalAnswer?: string;       // synthesizer output
  events: OrchestrationEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrchestrationEvent {
  type:
    | 'orchestration_start'
    | 'plan_created' | 'plan_revised'
    | 'task_start' | 'task_complete' | 'task_failed'
    | 'gate_check'
    | 'goal_graded'
    | 'orchestration_complete' | 'orchestration_failed';
  taskId?: string;
  data?: unknown;
  message?: string;
  timestamp: Date;
}
```

## 4. Architecture

```
POST /api/orchestrations { goal, hints }
   → create OrchestrationRun (status 'queued')
   → enqueue BullMQ job on a new 'orchestration' queue
        │
   worker: OrchestrationEngine.run()
        │
   ┌────▼─── plan ───────────────────────────────────────────┐
   │  planner(goal, hints) → PlanTask[]   (status 'planning') │
   └────┬────────────────────────────────────────────────────┘
   loop (until goalMet OR iterations >= maxIterations):
        │  pick next 'pending' task  (Inc 1: sequential)
        │  execute task: run_research_pipeline → child Run     ('executing')
        │  gate-check the child Run's result (reuse runGate)   ('gate_check')
        │  replan remaining tasks given results so far         ('replanning')
        │  goal-grade: LLM judge — is the goal met?            ('grading')
        │     iterations++
   end loop
        │
   synthesize finalAnswer from all task results
   persist OrchestrationRun (status 'completed', goalMet/partial)
```

### 4.1 Components (all new, `backend/src/orchestrator2/`)

A new directory `orchestrator2/` keeps the dynamic layer separate from the fixed `orchestrator/`.

- **`planner.ts`** — `planGoal(goal, hints): Promise<PlanTask[]>`. LLM call: given the goal, produce an
  ordered list of `run_research_pipeline` tasks (Increment 1: usually one task per target the goal implies).
  Uses `callWithTool` with a schema forcing `{ tasks: [{ tool, args, rationale }] }`.
- **`replanner.ts`** — `replan(goal, plan, completedResults): Promise<PlanTask[]>`. LLM call: given the goal,
  the current plan, and results so far, return the revised list of *remaining* tasks (may add/drop/reorder
  pending tasks; never touches done tasks). Returns `[]` to signal "no more work needed".
- **`goal-grader.ts`** — `gradeGoal(goal, results): Promise<{ met: boolean; reasoning: string; score: number }>`.
  LLM judge against the goal. This is the orchestration-level twin of the L2 pitch grader.
- **`tools.ts`** — `runResearchPipelineTool(args, emit): Promise<{ run: Run; summary: string }>`. Wraps the
  existing `ProspectOrchestrator`, persists a child `Run`, returns a short summary (e.g. signal count,
  pitch score). Increment 1's only registered tool.
- **`result-gate.ts`** — `gradePipelineResult(run): GateResult`. Deterministic: pass if the child Run produced
  a pitch and was not `lowConfidence`. Reuses the `GateResult` type and `runGate` from Phase A to allow a
  bounded re-run of a failed task.
- **`synthesizer.ts`** — `synthesize(goal, results): Promise<string>`. LLM call: assemble a final answer
  addressing the goal from all task results.
- **`engine.ts`** — `OrchestrationEngine` class: owns the loop above, emits `OrchestrationEvent`s, enforces
  `maxIterations`, sets `goalMet`/`partial`.

### 4.2 Tool interface

```ts
// orchestrator2/tools.ts
export interface ToolContext {
  emit: (e: OrchestrationEvent) => Promise<void>;
  orchestrationId: string;
}
export interface ToolResult {
  childRunId?: string;
  summary: string;            // short, LLM-readable
  ok: boolean;
}
export type Tool = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;

export const TOOLS: Record<string, Tool> = {
  run_research_pipeline: runResearchPipelineTool,
};
```

The registry shape means Increments 2–4 add entries to `TOOLS` and tool names to the planner schema enum —
no engine changes.

### 4.3 Termination & cost bounds

- `maxIterations` default **6** (config: `ORCH_MAX_ITERATIONS`). Loop exits when `gradeGoal` returns
  `met: true` OR iterations hit the cap.
- On cap-without-completion: `goalMet=false`, `partial=true`, still synthesize a best-effort answer.
- Per-task pipeline cost is already bounded by Phase A gates. The orchestration adds at most
  `maxIterations` × (1 planner + 1 replanner + 1 grader) LLM calls beyond the pipeline runs.

## 5. Backend surface

- **`POST /api/orchestrations`** `{ goal: string, hints?: object }` → `{ orchestrationId }`. Creates the doc,
  enqueues the job.
- **`GET /api/orchestrations/:id`** → the `OrchestrationRun`.
- **`GET /api/orchestrations/:id/events`** (SSE) → live `OrchestrationEvent` stream (reuse the
  `runEventBus` pattern from `events/emitter.ts`, keyed `orchestration:<id>`).
- **`GET /api/orchestrations`** → list (for a history view; optional in Inc 1, include if cheap).
- **New BullMQ queue** `'orchestration'`; worker handler builds `OrchestrationEngine` and runs it, persisting
  status transitions and events exactly like the existing `Run` worker does.

## 6. Frontend surface

- **New page `/orchestrate`** — a goal textarea + optional hint fields (company/url) + "Run" button. On submit,
  POST and route to a live view.
- **Live view** — a **plan board**: the goal at top; the task list rendered as cards with status
  (pending/running/done/failed), each task's rationale, and (when present) a link to its child Run detail
  (`/runs/[id]`). A banner shows replans ("plan revised — added 1 task") and the final answer + a
  "goal partially met" badge when `partial`.
- **Sidebar** — add an "Orchestrate" entry next to "New Research".
- Reuses existing SSE/polling approach from the run detail page.

## 7. Testing

- **Unit (LLM-free, in `backend/src/test-units.ts`):**
  - `gradePipelineResult(run)`: pass when run has a pitch and `!lowConfidence`; fail otherwise.
  - Engine loop logic with **mock planner/replanner/grader/tool** (injected): verifies it (a) stops when
    grader says met, (b) stops at `maxIterations` setting `partial=true`, (c) applies replan output to the
    pending task list, (d) marks task status transitions correctly. The engine takes its planner/replanner/
    grader/tools as injectable dependencies so this runs without any LLM.
- **Integration (live, manual):** one real orchestration with a simple goal ("Research Stripe and draft an
  outreach email") asserting it produces a child Run with a pitch and a non-empty `finalAnswer`.

## 8. Out of Scope (Increment 1)

- `fan_out`, granular phase tools, `web_search` (Increments 2–4).
- Parallel task execution (Inc 1 runs tasks sequentially; the engine is structured so Inc 2 adds parallelism).
- Human-in-the-loop plan editing/approval before execution.
- Auth, multi-user, persistence of orchestration history beyond the basic list.

## 9. Success Criteria

1. Submitting a goal at `/orchestrate` creates an `OrchestrationRun`, runs in the worker, and streams live
   plan/task events to the page.
2. The engine produces an initial plan, executes each task as a gated child Run, replans between tasks, and
   stops when the goal grader returns `met` or `maxIterations` is hit.
3. A capped-without-completion run ends `partial=true` with a best-effort `finalAnswer` and a UI badge.
4. The injectable engine passes its LLM-free unit tests (stop-on-met, stop-on-cap, replan-applied, status
   transitions).
5. Adding a new tool in a later increment requires only a `TOOLS` registry entry + planner-schema enum
   value — no engine changes (verified by code structure, not a test).

# ADR 0002: Separate `OrchestrationRun` model, distinct from `Run`

**Status:** accepted
**Date:** 2026-06-23
**Deciders:** @harish
**Related task:** BILTIQ-001

## Context

The dynamic orchestrator (BILTIQ-001) introduces a goal-driven session that plans, executes, gates, and
replans a set of tasks. Each task that runs the research pipeline produces a full pipeline execution — which
the codebase already models as a `Run` (`backend/src/db/models/run.ts`). We need a place to store the goal,
the evolving plan, iteration count, gate outcomes, and the synthesized answer. The question is whether to
extend the existing `Run` model or introduce a new one.

## Decision

Introduce a new `OrchestrationRun` model in its own Mongo collection (`orchestrationruns`). An
`OrchestrationRun` *contains* a plan (`PlanTask[]`) and references zero-or-more child `Run`s via
`PlanTask.childRunId`. A `Run` remains exactly what it is today: one execution of the fixed pipeline.

## Alternatives considered

1. **Extend `Run` with orchestration fields** — Rejected: conflates two cardinalities (one orchestration → many
   pipeline runs), bloats the already-`Mixed`-heavy `Run` schema, and would force every existing `/runs` query
   and view to reason about a nullable plan. Higher regression surface on a shipped feature.
2. **Embed child run data inline in `OrchestrationRun`** — Rejected: duplicates the pipeline result shape,
   loses reuse of the existing `/runs/[id]` detail view, and breaks the "link to child Run" UX (AC5).
3. **No persistence; stream-only** — Rejected: no history, no resumability, no way to render a completed
   orchestration; violates AC1/AC3.

## Consequences

**Positive:**
- Clean separation of concerns; existing `Run`/`/runs` code is untouched (additive, low regression).
- Child Runs are reachable via the existing run-detail page for free.
- No migration of existing `runs` data; the new collection is independent.

**Negative / risks:**
- A second collection to operate and back up.
- Reads that want "the whole orchestration with all child runs expanded" require a join/lookup by `childRunId`.

**Tech debt accepted:**
- Increment 1 stores child-Run linkage by id only (no denormalized summary beyond `PlanTask.resultSummary`);
  acceptable until a history/list view needs richer aggregation.

## References

- Spec: `docs/specs/BILTIQ-001/spec.html`
- Design: `docs/specs/BILTIQ-001/design.html`
- Existing model: `backend/src/db/models/run.ts`

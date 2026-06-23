# ADR 0003: Dedicated `orchestration` BullMQ queue + worker

**Status:** accepted
**Date:** 2026-06-23
**Deciders:** @harish
**Related task:** BILTIQ-001

## Context

Orchestrations are long-running (multiple pipeline runs + planner/replanner/grader LLM calls across up to
`maxIterations` cycles) and must run off the request thread, like the existing pipeline. The current system
has one BullMQ queue, `prospect-research`, drained by `backend/src/queue/worker.ts` at concurrency 3. We need
to decide whether orchestrations share that queue (as a new job type) or get their own.

## Decision

Add a dedicated `orchestration` BullMQ queue with its own worker handler
(`backend/src/queue/orchestrationWorker.ts`). The existing `prospect-research` queue and its worker are
unchanged. An orchestration's *child pipeline runs* execute in-process inside the orchestration worker (the
`run_research_pipeline` tool constructs `ProspectOrchestrator` directly) rather than being re-enqueued onto
`prospect-research`.

## Alternatives considered

1. **Single queue, new job type** — Rejected: an orchestration job can take minutes and itself spawn pipeline
   work; mixing it into the same concurrency-3 pool as fast pipeline jobs causes head-of-line blocking and
   makes per-workload scaling impossible.
2. **Child runs re-enqueued onto `prospect-research`** — Rejected for Increment 1: introduces cross-queue
   coordination (the orchestration must await job completion across a queue boundary), added latency, and
   distributed failure handling — premature before the core loop is proven. Reconsider for Increment 2
   (`fan_out`), where parallel child runs may justify it.
3. **Run orchestration synchronously in the API request** — Rejected: blocks the HTTP request for minutes;
   no resumability; no live event stream.

## Consequences

**Positive:**
- Independent concurrency/scaling per workload; pipeline jobs stay snappy.
- Reuses the existing BullMQ + Redis infrastructure and the worker persistence pattern — no new dependency.
- Failure isolation: a stuck orchestration can't starve pipeline runs.

**Negative / risks:**
- A second worker process to deploy and monitor (mirrors the existing `start:worker` script with a new one).
- In-process child runs mean an orchestration worker holds pipeline execution; sized by `maxIterations` (bounded).

**Tech debt accepted:**
- Sequential child runs in Increment 1 (no parallel fan-out); the engine is structured so Increment 2 can add
  parallelism without re-architecting the queue.

## References

- Spec: `docs/specs/BILTIQ-001/spec.html`
- Design: `docs/specs/BILTIQ-001/design.html`
- Existing queue/worker: `backend/src/queue/index.ts`, `backend/src/queue/worker.ts`

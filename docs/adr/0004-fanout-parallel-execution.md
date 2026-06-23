# ADR 0004: Fan-out via bounded-parallel execution in the engine

**Status:** accepted
**Date:** 2026-06-23
**Deciders:** @harish
**Related task:** BILTIQ-002

## Context

Increment 2 lets the orchestrator handle multi-target goals ("research these 8 companies"). Targets are
independent full pipeline runs (~12 LLM calls each). We needed to decide where parallelism lives and how to
bound it.

## Decision

Run fan-out as **bounded-parallel execution inside the engine**. The planner emits one
`run_research_pipeline` task per target; the engine's execute step runs `pending` tasks through a
`runPool(tasks, K, fn)` helper that keeps at most `K = ORCH_FANOUT_CONCURRENCY` (default 4) tasks in flight.
Each task keeps its own result gate and events. A pure `rankResults` step orders completed results best-first
before the synthesizer runs. Target count is capped at `ORCH_MAX_TARGETS` (default 10).

## Alternatives considered

1. **Dedicated `fan_out(entities, subtool)` tool** — Rejected: duplicates the run/gate/persist logic the
   engine already owns, and child runs would bypass the engine's gate + event model.
2. **Unbounded `Promise.all` over all targets** — Rejected: N×~12 concurrent LLM calls would overload the
   inference endpoint and blow cost with no ceiling.
3. **Keep sequential, just faster** — Rejected: doesn't address the core "slow serial crawl" pain.

## Consequences

**Positive:**
- Reuses Inc 1's task model, gates, events, SSE, and plan board unchanged.
- Cost/load bounded by two env-tunable caps; `ORCH_FANOUT_CONCURRENCY=1` restores sequential behavior.
- Ranking gives a targets-best-first final answer.

**Negative / risks:**
- Parallel tasks push to a shared `results` array — safe under Node's single-threaded event loop (no true
  parallelism), and `runPool` awaits all before grading, so no torn reads.
- Planner-expanded (descriptive) lists can be stale; flagged in output, explicit lists bypass expansion.

**Tech debt accepted:**
- No resume of a partially-failed fan-out (deferred). No cross-target dedup beyond ranking.

## References

- Spec/design: `docs/specs/BILTIQ-002/`
- Engine: `backend/src/orchestrator2/engine.ts` (`runPool`), `aggregate.ts` (`rankResults`)

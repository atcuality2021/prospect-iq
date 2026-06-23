# Changelog

All notable changes to this project are documented here. Format mirrors [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

- feat(gates): L2 verification gates — research-sufficiency + pitch-quality loops with `runGate` primitive, `lowConfidence` flag, and UI badges/retry chips (Phase A)
- feat(orchestrator): dynamic orchestrator Increment 1 (BILTIQ-001) — goal → plan → execute → gate → replan → grade → synthesize loop wrapping the pipeline as the `run_research_pipeline` tool; new `OrchestrationRun` model, `orchestration` queue/worker, `/api/orchestrations` routes + SSE, and `/orchestrate` plan-board UI
- feat(orchestrator): multi-target fan-out (BILTIQ-002) — planner emits one task per target (explicit list or knowledge-based expansion, no web); engine runs them bounded-parallel (`ORCH_FANOUT_CONCURRENCY`, cap `ORCH_MAX_TARGETS`); `rankResults` aggregation; coverage-aware goal grader (ADR-0004)
- (next change goes here)

## [0.1.0] - YYYY-MM-DD

- feat: initial repo bootstrap (BILTIQ-000)

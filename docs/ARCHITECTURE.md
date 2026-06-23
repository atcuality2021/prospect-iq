# ProspectIQ — Architecture

> Complete architecture and data-flow reference for ProspectIQ as of the `feat/loop-engineering`
> branch (Phase A + BILTIQ-001…004). Covers the loop stack, processes, components, data model,
> and end-to-end flows.

---

## 1. What ProspectIQ is

A multi-agent lead-research platform. You give it a **prospect** (or a free-form **goal**); it researches
across the public web, grounds every claim in verbatim evidence, matches the prospect to a service catalog,
and drafts a tailored outreach pitch — then lets you organize, reuse, and chat over that research.

The system is built as a **stack of loops** (the "loop engineering" idea): each loop adds capability on top
of the one below.

```
┌──────────────────────────────────────────────────────────────────┐
│  Loop 1.5  Dynamic Orchestrator   goal → plan → run → adapt        │  BILTIQ-001/002
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Loop 2  Verification Gates    grade → revise → re-grade     │   │  Phase A
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  Loop 1  Agent Pipeline   model + tools in a sequence  │   │   │  (original)
│  │  │  research → verify → synthesize → match → pitch → reflect│   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
        + Projects workspace (organize / reuse / chat)                  BILTIQ-003/004
```

---

## 2. Runtime topology (processes)

Four long-lived processes + two datastores. The workers are **separate processes** from the API — they read
config from env, not from server memory (an important constraint: live UI settings don't reach the worker).

```
            ┌─────────────┐         ┌──────────────────────┐
 browser ──▶│  Next.js     │  /api/* │   Express API        │
  :3000     │  frontend    │────────▶│   :3001 (or :3002)   │
            │  (SSR + CSR) │  rewrite│                      │
            └─────────────┘         │  routes:             │
                  ▲                 │   /runs  /leads       │
                  │ SSE / poll      │   /orchestrations     │
                  └─────────────────│   /projects /catalog  │
                                    │   /settings           │
                                    └───────┬──────┬────────┘
                                            │ enqueue (BullMQ)
                          ┌─────────────────┘      │
                   ┌──────▼───────┐         ┌───────▼────────────┐
                   │ research      │         │ orchestration       │
                   │ worker        │         │ worker              │
                   │ (worker.ts)   │         │ (orchestrationWorker│
                   │ drains        │         │  .ts) drains        │
                   │ 'prospect-    │         │ 'orchestration'     │
                   │  research' Q  │         │  Q; runs the engine │
                   └──────┬────────┘         └───────┬────────────┘
                          │  runs ProspectOrchestrator│  runs OrchestrationEngine
                          │  (the 6-phase pipeline)   │  (which calls the pipeline as a tool)
                          ▼                            ▼
                   ┌───────────────┐          ┌──────────────┐
                   │   MongoDB      │◀────────▶│   Redis       │
                   │  runs,         │          │  BullMQ queues│
                   │  orchestrations│          └──────────────┘
                   │  projects,     │
                   │  companychats, │     LLM: OpenAI  ── or ──  on-prem vLLM
                   │  catalog       │     (one switchable adapter: backend/src/llm/client.ts)
                   └───────────────┘
```

**Why two workers:** orchestrations are long (many pipeline runs + planner/grader calls) and must not
block fast single-prospect research. Each queue scales independently (ADR-0003).

---

## 3. The Agent Pipeline (Loop 1)

The original fixed pipeline, a linear chain of pure `(state) => Partial<state>` nodes in
`backend/src/orchestrator/index.ts`:

```
            research            verify          synthesize        match           pitch           reflect
          ┌──────────┐      ┌───────────┐    ┌────────────┐   ┌──────────┐    ┌──────────┐    ┌───────────┐
 lead ───▶│ 4 agents │─────▶│ extract   │───▶│ think →     │──▶│ rank     │───▶│ draft    │───▶│ critique →│──▶ pitch
          │ parallel │      │ verified  │    │ profile +   │   │ catalog  │    │ pitch    │    │ revise    │
          │ web/li/  │      │ facts +   │    │ signals     │   │ vs       │    │ tied to  │    │ loop      │
          │ news/yt  │      │ evidence  │    │             │   │ signals  │    │ evidence │    │ (Gate 2)  │
          └──────────┘      └─────┬─────┘    └────────────┘   └──────────┘    └──────────┘    └───────────┘
                                  │ Gate 1 (research sufficiency) sits here
```

Each node emits `RunEvent`s → the event bus → SSE → the live timeline UI.

---

## 4. The Verification Gates (Loop 2 — Phase A)

A single generic control-flow primitive, `runGate<S>` in `backend/src/orchestrator/gate.ts`:

```
  state ──▶ grade ──pass?──▶ yes ──▶ return (passed)
              ▲                no
              │                 │
              └── revise ◀──────┘   (until pass OR revisions == maxRevisions → return best-effort)
```

Applied at two points:
- **Gate 1 — research sufficiency** (`grading.ts: gradeResearch`): deterministic count of verified facts.
  Reviser re-runs verification at a **relaxed confidence floor (40 vs 60)** — recovers borderline facts
  without re-scraping. On exhaustion → `lowConfidence = true`, continue best-effort.
- **Gate 2 — pitch quality** (`grading.ts: evaluatePitchCritique`): agentic. Reviser re-drafts the pitch.
  Loops critique → revise → **re-critique** (the pre-Phase-A code revised once and shipped).

Every gate writes an attempt log to the run; the UI renders `⚠ low confidence` / `🔁 retried` badges.

---

## 5. The Dynamic Orchestrator (Loop 1.5 — BILTIQ-001/002)

A planning layer in `backend/src/orchestrator2/` that sits *above* the pipeline. The pipeline is **wrapped
as a tool** (`run_research_pipeline`), never forked.

```
  goal ─▶ planner ─▶ plan: [task per target]
                       │
            ┌──────────▼────────────────────────────────────────────┐
            │  loop (≤ maxIterations):                                │
            │    execute pending tasks  ── bounded-parallel (runPool) │  ← BILTIQ-002 fan-out
            │      each task: run_research_pipeline → child Run        │
            │                → result gate (reuse Phase A)             │
            │    rankResults (best-first by pitch score)               │  ← BILTIQ-002
            │    grade goal  (coverage-aware)                          │  ← BILTIQ-002
            │    if met → break ; else → replan remaining tasks        │
            └──────────┬─────────────────────────────────────────────┘
                       ▼
                 synthesize final answer   (partial=true if capped before met)
```

**Engine design (`engine.ts`):** `OrchestrationEngine` takes its `planner / replanner / grader /
synthesizer / tools` as **injected `EngineDeps`**. The worker wires the real LLM-backed implementations;
unit tests wire mocks — so the entire control loop (stop-on-met, stop-on-cap, replan-applied, parallelism
cap, status transitions) is verified with **zero LLM/DB calls**.

LLM-backed deps (`planner.ts`, `replanner.ts`, `goal-grader.ts`, `synthesizer.ts`) all route through
`callWithTool` / `callText` — never a raw client (the on-prem compliance boundary).

---

## 6. Projects workspace (BILTIQ-003/004)

A **Project → Company → Run** hierarchy layered on top, without a Company collection.

```
  Project (collection)
    └─ runs tagged with projectId
         └─ grouped at read time by normalized lead.company  (groupByCompany.ts — pure)
              └─ Company group  (derived, "Unassigned" bucket for blanks)
                   ├─ Run, Run, Run …  → /runs/[id]
                   └─ CompanyChat (collection, keyed by projectId+companyKey)   ← BILTIQ-004
                        reasons over buildCompanyContext(all the company's runs)
```

- Runs **and** orchestration child runs carry an optional `projectId` (threaded into orchestration child
  runs via `ToolContext`).
- **Company is derived**, not stored — `GET /api/projects/:id` groups the project's runs by normalized
  company name (ADR-0005).
- **Company chat** aggregates all of a company's runs into one context (merged/deduped signals, capped),
  calls the LLM, and persists history per (project, company) (ADR-0006).

---

## 7. Data model

```
 Project                Run                              OrchestrationRun
 ───────                ───                              ────────────────
 projectId (uniq)       runId (uniq)                     orchestrationId (uniq)
 name                   lead { company, url, … }         goal, hints
 description            status                           projectId?  ─┐ inherited by
 timestamps             research / verification          status        │ child runs via
                        profile { signals[] }            plan: PlanTask[]│ ToolContext
                        matches[] / pitch { score }      iterations / maxIterations
                        gates { research[], pitch[] }    goalMet / partial
                        lowConfidence                    finalAnswer
                        projectId?  ◀────────────────────┘ events[]
                        events[]

 CompanyChat                          Catalog
 ───────────                          ───────
 projectId + companyKey (uniq)        service entries matched against signals
 company (display)
 history: ChatMessage[]
```

Relationships: a `Project` has many `Run`s (by `projectId`); an `OrchestrationRun` produces many child
`Run`s (by `childRunId` on each `PlanTask`); a `CompanyChat` is scoped to one (project, company) pair.

---

## 8. End-to-end flows

### 8a. New Research (direct, known prospect)
```
/new form (+ optional Project) ─▶ POST /api/runs ─▶ create Run(queued) ─▶ enqueue 'prospect-research'
  ─▶ research worker: ProspectOrchestrator.run()
       research → verify ─[Gate 1]→ synthesize → match → pitch ─[Gate 2]→ reflect
       (emits events → SSE → live timeline)
  ─▶ persist final Run (profile, pitch, gates, lowConfidence)
  ─▶ /runs/[id] shows pitch + timeline + per-run chat
```

### 8b. Orchestrate (goal-driven, single or batch)
```
/orchestrate goal (+ optional Project) ─▶ POST /api/orchestrations ─▶ create OrchestrationRun(queued)
  ─▶ enqueue 'orchestration' ─▶ orchestration worker: OrchestrationEngine.run()
       plan → [run_research_pipeline per target, bounded-parallel, each gated]
            → rank → grade(coverage) → replan/loop → synthesize
       (emits OrchestrationEvents → SSE → live plan board)
  ─▶ persist plan + finalAnswer ; child Runs (tagged with projectId) appear in /runs and under the project
  ─▶ /orchestrate/[id] plan board: task cards, child-run links, goal-met / partial badge
```

### 8c. Projects
```
/projects ─ create Project ─▶ POST /api/projects
/projects/[id] ─▶ GET /api/projects/:id ─▶ project + companies (runs grouped by company)
  each company card → links to its runs + a "💬 Chat" button
```

### 8d. Company chat
```
"💬 Chat" on a company ─▶ CompanyChatDrawer
  GET  /api/projects/:id/companies/:company/chat  → history
  POST … {message} ─▶ aggregate all company runs ─▶ buildCompanyContext
                    ─▶ callText(context + history + message) ─▶ reply
                    ─▶ upsert CompanyChat history
```

---

## 9. Frontend map (`frontend/src/app`)

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — stats, pipeline health, top prospects |
| `/new` | New Research form (structured lead + Project selector) |
| `/orchestrate`, `/orchestrate/[id]` | Goal form + live plan board |
| `/projects`, `/projects/[id]` | Projects list/create + detail (companies → runs, company chat) |
| `/runs`, `/runs/saved`, `/runs/[id]` | Run list / saved / detail (timeline, pitch, per-run chat) |
| `/catalog` | Service catalog CRUD |
| `/settings/{llm,agents,prompts}` | Config (read-only keys, gate knobs, editable prompts) |

Live views use SSE (`/:id/events`) where available, falling back to polling.

---

## 10. Compliance & quality posture

- **Compliance mode `on_prem_preferred`** (`AGENT_RULES.md`): every LLM call goes through the switchable
  adapter (`llm/client.ts`) — OpenAI default, on-prem vLLM optional. No LangChain/LangGraph/LangSmith
  (kept the on-prem path open). No new external dependency was introduced by any increment.
- **Bounded cost:** gate retry caps, `maxIterations`, `ORCH_FANOUT_CONCURRENCY`, `ORCH_MAX_TARGETS`.
- **Testing:** 88 LLM-free unit tests (`cd backend && npm run test:units`); strict typecheck on backend +
  frontend; each increment was code-reviewed and browser-validated via Playwright.

---

## 11. Increment history (all on `feat/loop-engineering`)

| Increment | Adds | ADRs |
|-----------|------|------|
| Phase A | L2 verification gates (`runGate`, Gate 1/2, `lowConfidence`) | — |
| BILTIQ-001 | Dynamic orchestrator core (engine, tools, routes, plan board) | 0002, 0003 |
| BILTIQ-002 | Multi-target fan-out (bounded parallel, ranking, coverage grader) | 0004 |
| BILTIQ-003 | Projects MVP (model, grouping, pages, selectors) | 0005 |
| BILTIQ-004 | Company-level chat (aggregator, drawer) | 0006 |

**Designed but not yet built:** P3 (new research builds on prior signals), P4 (project synthesis/ranking),
Loop 3 (event/cron/webhook triggers), Loop 4 (hill-climbing — auto-improve prompts from run traces).

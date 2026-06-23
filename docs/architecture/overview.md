# Architecture Overview

**Repo:** ProspectIQ
**Last reviewed:** 2026-06-23

## What this system does (1-paragraph)

ProspectIQ turns a prospect (company/person) — or, in the in-progress dynamic-orchestrator
increment, a free-form sales goal — into a tailored, evidence-grounded outreach pitch. A 6-phase
pipeline gathers public web signals, verifies every claim against verbatim source text, synthesizes
a structured prospect profile, matches it against a configurable service catalog, drafts a
channel-specific pitch, and runs a reflexive critic over the result. It is used internally by
ATCuality's sales/research function via a web UI.

## Components

- **frontend** (`frontend/`) — Next.js 14 App Router UI: dashboard, new-research form, run detail
  with a live pipeline timeline, saved runs, service-catalog CRUD, and settings (LLM / agents /
  prompts). Talks to the backend over REST + SSE.
- **backend API** (`backend/src/server.ts`, `routes/`) — Express app exposing runs, catalog, leads,
  and settings endpoints; enqueues research jobs.
- **worker** (`backend/src/queue/worker.ts`) — separate BullMQ process that runs the orchestrator and
  persists results. Runs in its own process, so it reads config from env, not server module state.
- **orchestrator** (`backend/src/orchestrator/`) — the fixed 6-phase pipeline (`index.ts`) plus per-phase
  nodes (`nodes/`). Pure `(state) => Partial<state>` functions chained sequentially.
- **agents** (`backend/src/agents/`) — four parallel research scrapers: website, linkedin, news
  (SerpAPI), youtube (YouTube Data API).
- **llm adapter** (`backend/src/llm/client.ts`) — switchable provider (OpenAI default / on-prem vLLM /
  Anthropic) exposing `callText` and `callWithTool`.
- **event bus** (`backend/src/events/emitter.ts`) — in-process pub/sub that streams `RunEvent`s to the
  SSE endpoint for the live timeline.

## Data flow

```
[browser] → POST /api/leads → [Express API] → enqueue BullMQ job → [worker]
   worker → ProspectOrchestrator.run():
     research (4 parallel agents) → verify → synthesize → match → pitch → reflect
       each node emits RunEvent → event bus → SSE → [browser live timeline]
   worker persists final state → MongoDB
[browser] ← GET /api/runs/:id (poll) / SSE events
```

## Deployment topology

Four moving parts: Next.js frontend, Express backend API, BullMQ worker (separate process), and
MongoDB + Redis. Deployable as Vercel (frontend) + Render (backend + worker, 2 services) + MongoDB
Atlas + Upstash Redis, **or** fully on-prem (with vLLM for inference). No containers yet — Render/Vercel
build commands drive deploys.

## Dependencies

External services this repo depends on:
- OpenAI API (default LLM) **or** on-prem vLLM at `reason.atcuality.com/v1` (Qwen)
- SerpAPI (news search; optional), YouTube Data API (optional)
- MongoDB (Atlas or self-hosted), Redis (Upstash or self-hosted)

Internal services this repo depends on:
- None (self-contained)

Services that depend on this repo:
- None (leaf application)

## Failure modes

| Dependency | Failure | This system's behavior |
|---|---|---|
| MongoDB | unavailable | worker job fails; run marked `failed`; API read endpoints error |
| LLM endpoint | timeout | the failing node throws; orchestrator catches, records the error, emits `run_failed` |
| Research agent (scraper/API) | 5xx / restricted | agent returns `{ skipped:true }` or an `error` field; pipeline continues with fewer sources |
| Redis | unavailable | jobs can't enqueue/dequeue; new runs don't start |

## Where new code goes

- A new API endpoint → `backend/src/routes/...` (registered in `server.ts`)
- A new background job → `backend/src/queue/...`
- A new external integration → `backend/src/agents/...` or `backend/src/llm/...`
- A new data model → `backend/src/db/models/...` (changes require an ADR)
- A new pipeline phase → `backend/src/orchestrator/nodes/...` (wired in `orchestrator/index.ts`)
- The dynamic orchestrator (in progress) → `backend/src/orchestrator2/`
- A new shared type → `backend/src/types.ts`

## Audit cadence

This file is reviewed monthly. Material changes (new component, dropped dependency, deploy topology
change) require a same-PR update.

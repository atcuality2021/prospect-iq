# BiltIQ Engineering — AGENT_RULES.md

# Canonical rules for any AI coding IDE (Claude Code default; Cursor, Windsurf, others compatible).
# Drop this in repo root. IDE-specific config files (CLAUDE.md, .cursorrules, .windsurfrules) point to this file.

## Project context

ProspectIQ is a multi-agent lead-research platform. A user supplies a company/person (or, in the in-progress dynamic-orchestrator increment, a free-form goal) and the system runs a 6-phase pipeline — research → verify → synthesize → match → pitch → reflect — that gathers public signals across the web, grounds every claim in verbatim evidence, matches the prospect against a configurable service catalog, and drafts a tailored outreach pitch. Used internally by ATCuality's sales/research function.

Deployment model: Next.js 14 frontend + Express/ts-node backend + a BullMQ/Redis worker (separate process) + MongoDB. LLM inference is pluggable via a switchable adapter — OpenAI by default, on-prem vLLM (Qwen at reason.atcuality.com) optional. Deployable to Vercel (frontend) + Render (backend/worker) + Atlas + Upstash, or fully on-prem.

## Compliance

**Mode:** `on_prem_preferred`

- `on_prem_required` — strict. No external AI / cloud LLM calls in production code paths. Local inference only — vLLM, internal MCP, local embeddings. **Default for healthcare with NHA / DPDP-sensitive workloads, defence (iDEX, ADITI, DRISHTI), government B2G, BFSI with regulated data, or any client contract that mandates data sovereignty.** Auto-block on violation.
- `on_prem_preferred` — external AI calls allowed only with an ADR documenting why local inference doesn't work, what data crosses the boundary, what fallback exists, and what the rollback plan is. An adapter / wrapper module must isolate the cloud call. Default for most BiltIQ products.
- `cloud_ok` — cloud APIs allowed. Any new AI dependency still requires an ADR for cost and lock-in tracking. Default for internal dev tools, prototypes, and deployments where the client has explicitly approved cloud AI in writing.

If this section is missing or unset, agents must default to `on_prem_preferred` and surface the missing declaration.

**Healthcare project:** `false`

(ProspectIQ may research healthcare *companies* as sales prospects, but it never handles clinical, diagnostic, or patient data. `_llm_client.medical()` calls are refused.)

- `false` (default) — `_llm_client.medical()` calls are refused; the medgemma endpoint is unreachable from this repo. Generic medical knowledge questions still go to the standard chat endpoint.
- `true` — `_llm_client.medical()` calls permitted. Requires: documented data-handling policy in `SECURITY.md`, audit log for every medical call (`memory-stream.jsonl` event type `medical_inference`), no patient identifiers in prompts unless a per-call ADR justifies it.

Runtime gate: `_llm_client.medical()` checks the `BILTIQ_HEALTHCARE_PROJECT=1` environment variable. The AGENT_RULES.md field above is the canonical declaration; the env var is the runtime enforcement. Both must align.

**Specific external services explicitly allowed for this project:**

- **OpenAI** (default LLM provider via the switchable adapter `backend/src/llm/client.ts`) — approved as the cloud fallback when on-prem vLLM is not configured. ADR required when the default is relied on in a production path.
- **On-prem vLLM** (Qwen at `reason.atcuality.com/v1`) — preferred local-inference path; no ADR needed.
- **SerpAPI** (news search; optional) and **YouTube Data API** (optional) — public-data retrieval, no PII boundary crossing.
- **LangChain / LangGraph / LangSmith** are explicitly NOT adopted — the orchestrator is native TS to keep the on-prem path open (see loop-engineering spec).

## Stack

- Language: TypeScript 5.4 (backend: ts-node / transpile-only; frontend: Next.js 14 App Router)
- Web framework: Express 4 (backend API); Next.js 14 + React + Tailwind (frontend)
- Database: MongoDB via Mongoose 8
- Vector store: none (signals are stored as structured docs, not embeddings)
- Object storage: none
- Cache: Redis (via ioredis 5)
- Queue: BullMQ 5 (separate worker process)
- LLM serving: OpenAI SDK 4 (default) / on-prem vLLM (OpenAI-compatible) — switchable adapter in `backend/src/llm/client.ts`; Anthropic SDK also wired
- Container: none yet (deployed via Render/Vercel build commands)

## Working pattern (mandatory)

Every implementation task follows the BiltIQ Attack Loop: **Think → Plan → Build → Review → Test → Ship → Reflect.** When asked to implement a task:

1. **Read first.** Open `/docs/specs/<task-id>/spec.md`, `design.md`, `plan.md`. If any are missing, stop and tell the dev. Read `/docs/architecture/stack.md` to know what wrappers and utilities exist before writing new code.
2. **One step at a time.** Implement the next atomic step from `plan.md`. Don't jump ahead.
3. **Code + tests + docs in same pass.** Generate all three before declaring the step done.
4. **Commit message format:** `<task-id>: <step description>` (e.g., `BILTIQ-123: add document upload endpoint`).
5. **No silent assumptions.** If `spec.md` is ambiguous, ask. Do not guess.
6. **Clean up after yourself.** If you create a test file, throwaway script, or experimental version, delete it before committing — no `*_v2.*`, `*_new.*`, `*_old.*`, `*.bak` files left behind.

## Anti-patterns — these are defects in BiltIQ code

The agent must actively avoid all 11. The dev must scan for them in Review.

The canonical list of the 11 anti-patterns — #1–#10 are polyglot code defects (descriptions, detection signals, and per-language examples spanning Python, TypeScript / JavaScript, Java, C# / .NET, Go, Rust, C / C++, PHP, Ruby, Solidity) plus a blockchain-specific appendix; #11 is the HTML/MD artifact-format boundary — lives in **`/docs/architecture/anti-patterns.md`**. That file is the single source of truth; this section is a stub that points there.

Quick reference (full text in canonical):

1. **Duplication** — reuse existing utilities; check `stack.md` first.
2. **Abstraction Bypass** — use the project wrapper, not the raw library.
3. **Error Handling Gaps** — no catch-all handlers that swallow errors; decide explicitly.
4. **Type Safety Violations** — no escape-hatch types; no unjustified type-checker overrides.
5. **Security Anti-Patterns** — parameterized queries, no hardcoded secrets, validate at trust boundaries.
6. **Dead Code / Over-engineering** — build what `spec.md` requires.
7. **Debugging Residue** — no shadow-version files, debug prints, or commented-out code in committed PRs.
8. **Async Misuse** — no blocking I/O on event-loop / coroutine boundaries.
9. **Deprecated API Usage** — check `/docs/architecture/approved-versions.md`.
10. **Fake Test Coverage** — each test asserts one behavior tied to a spec criterion.
11. **HTML/MD boundary violation** — human-facing artifacts (`spec`, `design`, `plan`, `reflect`, reports, EOD summaries) must be `.html` files. Any of these delivered as `.md` under `docs/specs/` is auto-blocked in `code-reviewer` (same severity as #5 and #7). Agent-facing files (`SKILL.md`, `commands/*.md`, `MEMORY.md`, `AGENT_RULES.md`) remain Markdown.

## Code conventions

- **Type hints:** required on all public functions. Strict mode in CI.
- **Error handling:** all I/O, network, and external calls wrapped with explicit error handling. No bare `except`.
- **Logging:** use `logging` module. No `print()` in production code. Log at appropriate level (DEBUG verbose, INFO state changes, WARNING recoverable, ERROR failures).
- **Secrets:** never in code or config files. Read from env or secret manager.
- **PII:** never log PII. If unsure whether a field is PII, treat it as PII.
- **Docstrings:** Google style for Python; JSDoc for JS/TS.

## Banned vocabulary in any output (code comments, docs, commit messages)

The full banned-vocabulary list (with "why" + "say this instead" for each term) lives in **`/docs/architecture/anti-patterns.md` § Banned vocabulary**.

The list is canonical there. Locked terms include "cutting-edge", "revolutionary", "empowering", "seamless", "future-ready" plus an expanded set of consultant-speak and vendor-hype terms. Use plain, specific language — describe what the code does, not how impressive it is.

## Banned in product specs

- Cloud AI models listed as components (GPT-4, Claude Cloud API, Gemini in production paths) — unless the project's compliance mode is `cloud_ok` and an ADR documents the use.
- Unverified compliance claims (SOC 2, ISO 27001, HIPAA, GDPR, FedRAMP).
- Stock-photo style hyperbole.

## Architectural decisions

- Any new dependency requires an ADR before merge.
- Any schema change requires an ADR + migration plan.
- Any new external service integration requires an ADR + threat model note.
- Any cloud AI usage in `on_prem_preferred` mode requires an ADR.
- Any new AI dependency in any mode requires an ADR.

## Test rules

- Every public function: at least one unit test (happy path) AND at least one failure-path test.
- Every API endpoint: at least one integration test.
- Tests must run without network or hardware (mock vLLM, mock external services).
- For `on_prem_required` projects: include a test asserting no external AI API call is made.
- No more than 50% of dependencies mocked in any single test.

## When asked to generate documentation

- Use the `doc-generator` skill (in plugin `biltiq-engineering`).
- Update CHANGELOG.md, README.md, API docs, and ADRs as applicable in the same pass.
- No marketing language.

## When asked to review a plan

- Use the `plan-reviewer` skill.
- Output verdict: `approved` or `needs revision` with specific issues.

## When asked to review code

- Use the `code-reviewer` skill.
- Check the diff against `design.md` AND the 11 anti-patterns above.
- Output verdict and specific file:line issues.

## When asked to scan for anti-patterns

- Use the `anti-pattern-scanner` skill.
- For large scopes, dispatch the `biltiq-anti-pattern-auditor` subagent in parallel.

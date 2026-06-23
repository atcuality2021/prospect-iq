# ADR 0006: Company chat as a keyed collection

**Status:** accepted
**Date:** 2026-06-23
**Deciders:** @harish
**Related task:** BILTIQ-004

## Context

Per-run chat exists (`/runs/:id/chat`). Company-level chat (P2) must reason over ALL of a company's runs
within a project and persist its own conversation. Where should that history live?

## Decision

A dedicated `CompanyChat` collection, one document per (`projectId`, normalized `companyKey`), holding the
message `history`. The chat endpoint aggregates the company's runs at request time via a pure
`buildCompanyContext(runs)` helper (merged/deduped signals, summaries, latest pitch), calls `callText`, and
upserts the appended history. The company key reuses `normalizeCompany` so chat and the project's company
grouping stay consistent.

## Alternatives considered

1. **History as a map on the Project doc** — Rejected: unbounded growth on one document; per-key documents
   scale and index cleanly.
2. **Reuse `/runs/:id/chat` against a synthetic merged run** — Rejected: pollutes the run model; a dedicated
   aggregator is clearer and independently testable.

## Consequences

**Positive:** additive (one collection); reuses the existing chat pattern + `normalizeCompany`; context
builder is a pure, unit-tested function; per-run chat untouched.
**Negative / risks:** context size on large companies — mitigated by capping merged signals (12) in the helper.
**Tech debt accepted:** no cross-project company chat; no streaming responses (deferred).

## References

- `backend/src/db/models/companyChat.ts`, `backend/src/util/companyContext.ts`, `backend/src/routes/projects.ts`
- Spec/design: `docs/specs/BILTIQ-004/`

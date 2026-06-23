# ADR 0005: Projects with derived (not first-class) company grouping

**Status:** accepted
**Date:** 2026-06-23
**Deciders:** @harish
**Related task:** BILTIQ-003

## Context

Research was a flat list of runs organized by how it was started. Users want it organized by subject —
Projects → Companies → Runs — to reuse and build on prior research. The question was how to model the
"Company" level.

## Decision

Add a first-class `Project` collection and tag runs/orchestrations with an optional `projectId`. **Company
is a derived grouping**, not a collection: `GET /api/projects/:id` loads the project's runs and groups them
by normalized `lead.company` (trim + case-insensitive) via a pure `groupRunsByCompany` helper. Blank
companies collapse into an "Unassigned" bucket.

## Alternatives considered

1. **First-class `Company` collection** — Rejected for v1: runs already carry `lead.company`; a separate
   collection introduces a sync/identity problem (which run belongs to which Company record) with no v1 payoff.
2. **Flat tags instead of a hierarchy** — Rejected: users explicitly want the project→company→run structure.
3. **Migrate existing runs into a default project** — Rejected: unnecessary and destructive-ish; legacy runs
   simply render under "Unassigned" with `projectId` absent.

## Consequences

**Positive:**
- Additive: new `projects` collection + optional `projectId`; no migration of the existing 14 runs.
- Grouping logic is a pure, unit-tested function (no DB coupling).
- `projectId` threads to orchestration child runs via `ToolContext` (optional; undefined preserves Inc-1/2 behavior).

**Negative / risks:**
- Company grouping is only as good as `normalizeCompany` — "Stripe" vs "Stripe Inc" stay separate (v1 accepts this).
- No cross-project company identity until a future `Company` model (deferred).

**Tech debt accepted:**
- Company de-dup/merge and a dedicated company page are deferred (P2+).

## References

- Spec/design: `docs/specs/BILTIQ-003/`
- `backend/src/util/groupByCompany.ts`, `backend/src/routes/projects.ts`

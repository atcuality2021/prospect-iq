# Approved Versions & Deprecated APIs

**Purpose:** Anti-Pattern #9 defense. AI agents are trained on historical code and don't distinguish current from deprecated. This file is the source of truth for what is current and what is banned.

**Update rules:**
- When a dependency is upgraded across a major version, add a row.
- When an API method is deprecated upstream (or by us), add a row.
- The `code-reviewer` skill and the `biltiq-gates.yml` CI both consult this file. Keep it accurate.

---

## Locked dependency versions (auto-derived)

<!-- biltiq-derive:approved-versions BEGIN -->
_No exact-pinned dependencies detected. Run after adding a lockfile._
<!-- biltiq-derive:approved-versions END -->

## Currently approved (use these)

### Python

| API | Use | Notes |
|---|---|---|
| `datetime.now(timezone.utc)` | UTC timestamps | `core.time.now_utc()` wraps this |
| `importlib.metadata` | Read package metadata | Replaces `pkg_resources` |
| `asyncio.timeout` | Async timeouts (3.11+) | Replaces `asyncio.wait_for` |
| `pathlib.Path` | Path manipulation | Prefer over `os.path` |
| `dataclasses.dataclass(slots=True)` | Data classes | `slots=True` recommended for hot paths |
| `pydantic.BaseModel` v2 API | Validation models | `model_validate`, `model_dump` (not `.parse_obj` / `.dict`) |
| `httpx.AsyncClient` (via `core.http.BaseHTTPClient`) | HTTP client | Never import `httpx` directly in deploy paths |

### TypeScript / React

| API | Use | Notes |
|---|---|---|
| Function components + hooks | All components | No class components |
| `useEffect` with explicit deps | Side effects | Lint rule: `react-hooks/exhaustive-deps` |
| `import * as React from 'react'` or named imports | React | `tsconfig` `jsx: react-jsx` for newer projects |
| `URL` / `URLSearchParams` | Build URLs | No string concatenation |

### Database

| API | Use | Notes |
|---|---|---|
| Parameterized queries | All SQL | Never string-format values into SQL |
| `BEGIN ... COMMIT` for transactions | Multi-statement writes | Wrapper: `core.db.transaction()` context manager |
| Migrations via Alembic / Flyway | Schema change | Schema change requires ADR + migration file in same PR |

[PROJECT: extend with project-specific approvals.]

---

## Deprecated (do not use)

### Python

| Deprecated API | Replacement | Reason |
|---|---|---|
| `datetime.utcnow()` | `datetime.now(timezone.utc)` | Naive datetime, deprecated in 3.12 |
| `pkg_resources` | `importlib.metadata` | Slow, deprecated |
| `imp` module | `importlib` | Removed in 3.12 |
| `distutils` | `setuptools` / `build` | Removed in 3.12 |
| `asyncio.coroutine` decorator | `async def` | Removed in 3.11 |
| `requests` (sync) in async paths | `httpx` (async) via `core.http` | Anti-Pattern #8 trap |
| Bare `except:` | Specific exception, or `except Exception:` with explicit propagation | Anti-Pattern #3 |
| `print()` in production code | `core.log.get_logger(__name__).info()` | No structured output, no level |

### React / TypeScript

| Deprecated | Replacement | Reason |
|---|---|---|
| Class components | Function components + hooks | Modern React |
| `componentWillMount` | `useEffect(..., [])` | Removed in 17 |
| `UNSAFE_*` lifecycles | Hooks equivalents | Removed in 18 |
| `findDOMNode` | Refs | Removed in 19 |
| `defaultProps` on function components | Default parameters | Deprecated 18 |
| `new Buffer(x)` | `Buffer.from(x)` / `Buffer.alloc(x)` | Removed in Node 22 |

### Project-specific

[PROJECT: list any internal API or wrapper that is now deprecated and what replaces it.]

| Deprecated | Replacement | Removal target |
|---|---|---|
| (e.g. `legacy.http.fetch()`) | `core.http.BaseHTTPClient` | YYYY-MM (ADR-NNNN) |

---

## How this file is enforced

- The `code-reviewer` skill greps the diff against the deprecated patterns.
- The `anti-pattern-scanner` skill includes these in its #9 (Deprecated APIs) section.
- CI (`.github/workflows/biltiq-gates.yml`) runs lint rules that block known-deprecated calls — `ruff` rules `DTZ`, `UP`, `B`, plus project-specific custom rules.
- Pre-commit hook (`.pre-commit-config.yaml`) catches the most common ones locally before they reach CI.

If you find an API in production code that is on the deprecated list, the fix is a separate task with its own spec — don't bundle removal into an unrelated PR.

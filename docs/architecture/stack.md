# Stack — Libraries, Wrappers, and Utilities

**Purpose:** The catalog of what already exists in this repo. Read this **before writing any new utility, client, or wrapper** — Anti-Pattern #1 (Duplication) and #2 (Abstraction Bypass) defenses.

**Update rules:**
- Every new utility / wrapper added to the repo gets an entry here in the same PR.
- Every wrapper that becomes deprecated moves to `## Deprecated` with the replacement noted.
- Reviewed at the Friday architecture review.

---

## Detected stack (auto-derived)

<!-- biltiq-derive:stack BEGIN -->
_No ecosystems detected._
<!-- biltiq-derive:stack END -->

## Languages & runtimes

[PROJECT: list with version pin]

- Python 3.11+
- TypeScript 5.x (if applicable)
- Node 20 LTS (if applicable)

---

## Web / API framework

[PROJECT]

- FastAPI 0.110+ — primary REST framework
- Starlette — used directly only for low-level middleware

---

## Database & storage

[PROJECT]

- PostgreSQL 16 + pgvector
- Qdrant — vector store
- Redis — cache + Celery broker
- MinIO — object storage

---

## LLM serving

[PROJECT]

- vLLM at internal IPs (see `MEMORY.md` for the current node map)
- Local embeddings via sentence-transformers / BGE
- For `cloud_ok` projects only: list the approved external SDKs here, each with the ADR that authorizes it.

---

## Internal wrappers — use these, do not import the raw library

| What | Wrapper module | Wraps | Why |
|---|---|---|---|
| HTTP client | `core.http.BaseHTTPClient` | `httpx.AsyncClient` | Adds logging, retries, timeouts, internal-CA trust |
| DB session | `core.db.session()` | `psycopg / SQLAlchemy session` | Connection pooling, request-scoped session, audit log |
| Vector ops | `core.vectors.QdrantClient` | `qdrant-client` | Collection-name validation, dimension check, metric pinning |
| Object storage | `core.storage.S3Client` | `minio.Minio` | Bucket-name normalization, retry policy |
| Queue jobs | `core.jobs.task()` decorator | `celery.task` | Retry policy, structured logging, DLQ on failure |
| LLM call | `core.llm.complete(prompt)` | OpenAI-compatible client | base_url from env (vLLM-local), token-budget guard, prompt-caching |
| Embeddings | `core.embeddings.embed(text)` | sentence-transformers | Batch size cap, dimension assertion |

[PROJECT: replace the rows above with the actual wrappers in this repo. If a wrapper does not exist for a category, that's an ADR-worthy gap — flag it.]

---

## Shared utilities

| What | Module | Use when |
|---|---|---|
| ULID generation | `core.ids.new_ulid()` | Any new entity ID. Do not `uuid.uuid4()`. |
| Datetime UTC | `core.time.now_utc()` | Any timestamp. Do not `datetime.utcnow()` (deprecated). |
| Structured logger | `core.log.get_logger(__name__)` | Any logging. Do not `print()` or raw `logging.getLogger`. |
| Config | `core.config.settings` | Any env-var read. Do not `os.environ[]` directly. |
| PII redactor | `core.pii.redact(text)` | Before logging anything that may contain PII. |

[PROJECT: replace with this repo's actual utilities.]

---

## Test fixtures

| Fixture | Module | Provides |
|---|---|---|
| `db_session` | `tests/fixtures/db.py` | Transaction-rolled-back DB session per test |
| `http_client` | `tests/fixtures/http.py` | `BaseHTTPClient` with mocked transport |
| `vllm_mock` | `tests/fixtures/llm.py` | Local vLLM endpoint mock, asserts no cloud calls fire |
| `qdrant_in_memory` | `tests/fixtures/qdrant.py` | In-memory Qdrant for vector tests |

[PROJECT: replace.]

---

## Deprecated

[PROJECT: when something moves out of active use, note it here and the replacement.]

| Deprecated | Replacement | Removal target |
|---|---|---|
| `legacy.http.fetch()` | `core.http.BaseHTTPClient` | YYYY-MM (see ADR-NNNN) |

---

## When to add a new wrapper

Add a wrapper when:
- The same external library is used in 3+ files with the same setup boilerplate.
- The external library has cross-cutting concerns (logging, retry, auth) that should be centralized.
- A behavior would change project-wide if the library were swapped (good test: "could we move from `httpx` to `aiohttp` without rewriting every caller?" — if no, the wrapper is missing).

When you add one, list it in this file in the same PR. The `code-reviewer` skill checks for new wrappers and flags missing entries here.

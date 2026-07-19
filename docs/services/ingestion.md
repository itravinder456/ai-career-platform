# Ingestion Service (`services/ingestion`)

**Role in the flow:** offline, not in the request path. Turns `data/` source files (markdown, text,
PDF) into vectors in Qdrant that `services/runtime`'s retrieval tool queries. Today it's the only
piece of the platform's RAG pipeline (`ARCHITECTURE.md` Phase 2) that exists.

## What it does

A callable Python pipeline — not a server — that walks `data/{resume,projects,blogs,certificates}/`,
extracts text via a per-extension reader (see below), chunks each document semantically, embeds
the chunks (provider-agnostic, see below), and upserts them into a Qdrant collection. Invoked via
`make ingest` (a `python -m app.cli` entrypoint), or importable as `run_ingestion()` for a future
scheduler/admin route to call directly.

## Stack

`qdrant-client`, `pypdf` (PDF text extraction), `ravinder-ai-core` for settings/logging **and**
embeddings (`core.embeddings` provides the OpenAI/Ollama call itself — this service no longer talks
to an embedding provider directly). No web framework — deliberately not a FastAPI service (see
tradeoffs).

## Structure

```
services/ingestion/app/
├── readers/
│   ├── __init__.py   READERS registry {".md": ..., ".txt": ..., ".pdf": ...} + get_reader(suffix)
│   ├── text.py        read_text_file() — plain UTF-8 read, for .md/.txt
│   └── pdf.py          read_pdf_file() — pypdf, joins non-blank page text
├── loader.py      load_documents() — walks data/, dispatches each file to get_reader(path.suffix)
│                  → Document(text, source_path, doc_type, title); unsupported extensions skipped
├── chunker.py     chunk_documents() — semantic chunking + content-hash dedup → Chunk
├── store.py       Qdrant singleton client, ensure_collection(), upsert_chunks()
├── pipeline.py     run_ingestion() — orchestrates load → chunk → embed (via core.embeddings) → upsert
└── cli.py          `python -m app.cli` entrypoint — logging, run, print summary, close clients
```

**Adding a new document type** (e.g. `.docx`): write `read_docx_file(path: Path) -> str` in
`app/readers/docx.py`, add one line to `READERS` in `app/readers/__init__.py`. `loader.py` never
needs to change — it only knows "ask the registry for a reader, skip if there isn't one."

## Flow

```
load_documents()
  → walk data/{resume,projects,blogs,certificates}/*  → get_reader(path.suffix), skip if none
  → Document(text, source_path, doc_type, title)   [title = first non-empty line, "#" stripped]

chunk_documents(documents)
  → per document: chunk_text() — tiered semantic split: try "\n\n", fall back to "\n", fall back to ". "
  → greedily pack pieces up to 500 chars, carrying the last 50 chars into the next chunk on overflow
  → id = uuid.UUID(bytes=sha256(text)[:16])  — deterministic; identical text across files dedups to one chunk
  → returns (unique chunks, total generated before dedup)

ensure_collection()  → create Qdrant collection "ravinder" (1536-dim, cosine) if it doesn't exist yet

core.embeddings.embed_texts([chunk.text, ...])
  → dispatches on EMBEDDING_PROVIDER: OpenAI batch call, or Ollama POST /api/embed — see below

upsert_chunks(chunks, embeddings)
  → PointStruct(id, vector, payload={text, source, doc_type, title}) per chunk → client.upsert(...)
```

## Chunking strategy in detail

- **Separators tried in order:** `"\n\n"` (paragraphs) → `"\n"` (lines) → `". "` (sentences). The
  first separator that actually splits the text into more than one piece wins — matches the tiered
  approach in `ARCHITECTURE.md` §5, hand-rolled rather than pulled from a library (see tradeoffs).
- **`CHUNK_SIZE=500`, `CHUNK_OVERLAP=50`** (characters, not tokens) — pieces are packed greedily up
  to 500 chars; when the next piece would overflow, the chunk closes and the last 50 characters
  carry into the start of the next chunk, so a fact split across a boundary isn't lost from either
  side.
- **A single piece already over 500 chars is kept whole**, not hard-cut — favors not truncating a
  sentence mid-word over strict size compliance.
- **Chunk IDs are content hashes** (`sha256(text)` truncated to 16 bytes, formatted as a UUID —
  Qdrant point IDs must be an unsigned int or a UUID, not an arbitrary string). Same text always
  produces the same ID, which gives two things for free: cross-document dedup (identical boilerplate
  in two files collapses to one point) and idempotent re-ingestion (re-running `make ingest`
  overwrites existing points instead of duplicating them).

## Embedding provider & model, and changing them

Embedding logic isn't in this service at all anymore — both `services/ingestion` and
`services/runtime`'s retrieval tool call the same `shared/core` factory,
`core.embeddings.embed_texts()`/`embed_query()` (`shared/core/core/embeddings/factory.py`), which
dispatches on `EMBEDDING_PROVIDER` exactly like `services/runtime`'s `_build_llm()` dispatches on
`LLM_PROVIDER` for chat models. Two providers today:

- **`openai`** (default) — `text-embedding-3-small`, 1536 dimensions
- **`ollama`** — any local embedding model, e.g. `mxbai-embed-large` (1024 dimensions); calls
  `POST {OLLAMA_BASE_URL}/api/embed`

Defaults (`EMBEDDING_DEFAULT_PROVIDER`, `EMBEDDING_DEFAULT_MODEL`, `EMBEDDING_VECTOR_SIZE`) live in
`shared/core/core/config/constants.py`, not hardcoded in this service.

To switch provider and/or model:

1. Set `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, **and** `QDRANT_VECTOR_SIZE` — **in both**
   `services/ingestion/.env` and `services/runtime/.env` (these are two separate `.env` files;
   nothing enforces they match — see `docs/services/shared-core.md`'s Known Gaps). `QDRANT_VECTOR_SIZE`
   must equal the new model's real output dimension (1024 for `mxbai-embed-large`, 1536 for
   `text-embedding-3-small` — these are read independently from the model name, `embed_texts()`
   doesn't know or check the collection's configured size).
2. **Drop the existing collection first**: `ensure_collection()` only creates it if missing, it
   never migrates an existing collection's vector size. Skipping this step means the next upsert
   fails with a Qdrant dimension-mismatch error. `curl -X DELETE http://localhost:6333/collections/ravinder`.
3. Re-run `make ingest`. Chunk IDs are content-hash-based (independent of embedding model), so this
   is a clean full replace, not duplication.
4. To compare two providers/models side by side instead of replacing, use a different
   `QDRANT_COLLECTION` name per one — one collection is fixed to one vector size.

## Design tradeoffs

| Decision                                                                                                            | Alternative considered                                                                                   | Why this way                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Callable pipeline (CLI entrypoint + importable `run_ingestion()`), no FastAPI server**                            | A microservice with its own `/ingest` route, port, and Dockerfile like `api`/`runtime`                   | For a single-operator portfolio there's no multi-tenant upload flow to serve yet; `ARCHITECTURE.md`'s own build order treats ingestion as a pipeline (Phase 2), separate from the admin route (Phase 9) that will eventually trigger it. Explicit user direction: keep it a pipeline for now, promote to a real service later if a scheduler/admin needs to call it over the network instead of in-process.          |
| **Hand-rolled semantic chunker**, not `langchain-text-splitters`' `RecursiveCharacterTextSplitter`                  | Depend on LangChain's splitter (already a transitive dependency in `runtime`, but not in `ingestion`)    | Avoids pulling in a LangChain dependency purely for one function; the tiered-separator logic `ARCHITECTURE.md` documents is small enough (~30 lines) to own directly, and it's the one piece of this service's logic worth unit-testing in isolation without mocking anything.                                                                                                                                       |
| **Content-hash (deterministic) point IDs**, not random UUIDs per chunk                                              | `uuid4()` per chunk on every run                                                                         | Makes re-ingestion idempotent (same content → same point, overwritten not duplicated) and gives cross-document dedup for free — two files repeating the same paragraph collapse to one vector instead of wasting an embedding call and a duplicate search result.                                                                                                                                                    |
| **Embedding logic centralized in `shared/core` (`core.embeddings`)**, not owned per-service like Qdrant clients are | Duplicate the embed call in both `ingestion` and `runtime` (as originally built), or keep it OpenAI-only | Unlike Qdrant/Postgres/Redis clients — where each service's usage genuinely differs, so per-service ownership is the convention — `ingestion` and `runtime` need the exact same embedding call. Centralizing it means `EMBEDDING_PROVIDER=openai\|ollama` is a `.env` change in _both_ services, never a code change in either. Mirrors `services/runtime`'s existing `LLM_PROVIDER` factory pattern (`_build_llm`). |
| **`ensure_collection()` creates-if-missing, never migrates**                                                        | Auto-detect a vector-size mismatch and recreate the collection automatically                             | Silently dropping and recreating a collection on a detected mismatch risks silently destroying data (or masking a real config mistake) without an operator decision. Requiring an explicit `DELETE` before a model swap is a deliberate speed bump.                                                                                                                                                                  |
| **Own Qdrant client singleton** (`store.py`), not a shared `core.db.qdrant` module                                  | Move the client pattern from `services/api/app/db/qdrant.py` into `shared/core` for reuse                | Matches the existing repo convention: each service owns its own db clients today (`api` doesn't share its Postgres/Redis clients either) — promoting it to `shared/core` is a reasonable future refactor once a third consumer actually needs it, not before.                                                                                                                                                        |
| **Extension → reader registry** (`app/readers/`), not a growing if/elif in `loader.py`                              | Branch on `path.suffix` directly inside `load_documents()` (as originally built, `.md`/`.txt` only)      | Adding a document type (PDF now, DOCX/HTML later) means adding one file under `app/readers/` and one dict entry — `loader.py` itself never changes. The registry is the extension point; `load_documents()` only knows "ask for a reader, skip if none."                                                                                                                                                             |
| **`pypdf` for PDF text extraction**, not `pdfplumber`/`PyMuPDF`                                                     | Heavier libraries with better layout/table fidelity                                                      | Pure-Python, minimal dependency footprint, sufficient for text-heavy documents (resumes, certificates, project write-ups) where layout fidelity doesn't matter — this pipeline only needs extracted text for embedding, not visual structure. Tradeoff: no OCR, so a scanned (image-only) PDF yields empty text silently, same as any other unextractable page.                                                      |

## Known gaps

- `data/blogs/` and `data/certificates/` are still empty — the loader handles missing/empty source
  dirs gracefully, but there's no real content there yet (certificates are the obvious next
  candidate now that PDF is supported).
- PDF extraction has no OCR fallback — a scanned/image-only PDF (no embedded text layer) silently
  yields empty text and gets skipped, same as an empty file. No warning is logged for this case
  today.
- `runtime` queries this collection via mandatory RAG retrieval (`retrieve_context`, see
  [runtime.md](./runtime.md)) for every career-related question — `runtime`'s static content is now
  identity-only (name/location/contact), so this collection is the sole source of career facts, not
  a supplement to hardcoded data.
- Not wired into `docker-compose.yml` or a scheduler — must be run manually via `make ingest`.
- Source files live on local disk (`data/`), not cloud storage, and there's no metadata registry
  tracking what's been ingested vs. changed since — see `ARCHITECTURE.md`'s Content & Document
  Architecture for the planned Drive + `documents` table evolution that would enable admin-panel
  upload/replace and automatic re-ingestion.
- `mypy --strict` on this service hits the same pre-existing `shared/core` "missing py.typed
  marker" gap documented in [shared-core.md](./shared-core.md) — not specific to this service.

## Run & test

```bash
make install-ingestion
make dev-infra                     # starts Qdrant
# EMBEDDING_PROVIDER=openai (default): put a real key in services/ingestion/.env: OPENAI_API_KEY=...
# EMBEDDING_PROVIDER=ollama: set EMBEDDING_MODEL to a locally-pulled embedding model (e.g. nomic-embed-text)
make ingest                        # runs the real pipeline, prints a summary
cd services/ingestion && uv run pytest tests/ -v   # chunker + pipeline unit tests, all mocked, no network calls
```

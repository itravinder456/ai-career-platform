# Per-Service Deep Dives

Each doc covers one implemented service: what it does, how it's built, the request/data flow, and
— unlike [`CODEBASE.md`](../CODEBASE.md)'s terse walkthrough — the specific design tradeoffs made
in that service and its known gaps.

| Service | Covers |
|---|---|
| [frontend.md](./frontend.md) | Next.js chat UI, SSE client, widget rendering |
| [api.md](./api.md) | FastAPI gateway — chat proxy, health checks |
| [runtime.md](./runtime.md) | LangGraph career graph, checkpointer, LLM provider factory |
| [shared-core.md](./shared-core.md) | `ravinder-ai-core` — the shared config/logging/exceptions package |
| [ingestion.md](./ingestion.md) | RAG ingestion pipeline — chunking, embeddings, Qdrant upsert |

For a single request-by-request trace across all of them, see
[`../CODEBASE.md`](../CODEBASE.md). For platform-wide stack decisions (Qdrant vs Pinecone, FastAPI
vs Node, etc.), see [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §10.

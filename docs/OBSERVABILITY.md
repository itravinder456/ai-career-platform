# Observability: Logging, Tracing, and LangSmith

A recap of what's wired up, why, and what it actually looks like in practice — written
as a learning log while building this out hands-on, not just a reference. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the system this instruments, and
[LOCAL_SETUP.md](./LOCAL_SETUP.md) to run it.

## Status

| Layer | Tool | State | Where |
|---|---|---|---|
| Logs | `structlog` | Wired, request-correlated | `api`, `runtime` |
| Traces | OpenTelemetry | Wired, cross-service | `api`, `runtime` |
| LLM/agent tracing | LangSmith | Wired | `runtime` only (only service running LangChain/LangGraph) |
| Metrics | — | Not started | — |
| Prompt eval / Ragas | `ragas` | Wired, one real fix found + validated | `runtime` (`evals/ragas_eval.py`, dev-only, not a running service) |

`shared/core/core/telemetry/setup.py` and the `langsmith_*` fields in
`shared/core/core/config/base.py` existed before this work but were never called from
any service — this was scaffolding built and abandoned, not a fresh design.

---

## 1. Logging — `structlog`

`shared/core/core/logging/setup.py`: `configure_logging(service, level)` replaces the
**root** Python logger's handler with a JSON formatter, and `get_logger(__name__)` gives
each module a bound logger. Because it patches the root logger, every dependency that
uses stdlib `logging` — `httpx`, `psycopg`, `uvicorn` — gets swept into the same
structured JSON output automatically, tagged with whatever context is currently bound,
without those libraries knowing anything about our logging setup.

### The correlation bug we found and fixed

`services/api/app/middleware/logging.py` generates a `request_id` per request and logs
`request.start` / `request.end` around it. Originally it passed `request_id` as an
**explicit kwarg** to those two log calls only — anything logged deeper in the call stack
during that request (a route handler, a DB error, a third-party library) had no
`request_id` at all. No way to correlate a `health.redis.fail` warning back to the
request that triggered it.

Fix: bind it via `structlog.contextvars.bound_contextvars(request_id=request_id)` around
the whole `call_next(request)` instead of passing it explicitly:

```python
with structlog.contextvars.bound_contextvars(request_id=request_id):
    log.info("request.start", method=request.method, path=request.url.path)
    response = await call_next(request)
    log.info("request.end", status=response.status_code, duration_ms=duration_ms)
```

`structlog.contextvars.merge_contextvars` (first processor in `configure_logging`) pulls
bound values out of a `contextvars.ContextVar` and injects them into **every** log call
on that async task — proven live: even `httpx`'s own internal request log
(`"logger": "httpx"`) picked up `request_id` automatically, with zero changes to `httpx`
or to any route handler.

**Scope**: this only correlates logs within one process. It does not survive an HTTP
call to another service — that's what tracing (below) is for.

---

## 2. Tracing — OpenTelemetry

### What's wired

- `configure_telemetry(service_name, otel_endpoint)` called from both `api`'s
  `app/core/lifespan.py` and `runtime`'s `app/main.py` lifespan. Empty `OTEL_ENDPOINT`
  (the default) → spans print to console via `ConsoleSpanExporter`; set it → spans
  export over OTLP/gRPC to a real backend.
- `FastAPIInstrumentor.instrument_app(app)` in both services — auto-creates a `SERVER`
  span per inbound request.
- `HTTPXClientInstrumentor().instrument()` in both services — auto-creates a `CLIENT`
  span per outbound `httpx` call, and **injects a `traceparent` header** into it so the
  receiving service continues the same trace instead of starting a new one.

### Span anatomy

A span is one timed unit of work:

```json
{
  "name": "GET /api/v1/health",
  "context": {"trace_id": "0x554b31...", "span_id": "0xa28a0e..."},
  "kind": "SpanKind.SERVER",
  "parent_id": null,
  "start_time": "...", "end_time": "...",
  "status": {"status_code": "UNSET"},
  "attributes": {"http.method": "GET", "http.status_code": 200, ...},
  "resource": {"attributes": {"service.name": "ravinder-ai-api"}}
}
```

- **`trace_id`** — shared by every span belonging to one logical operation. The
  cross-process analogue of `request_id` above, except it survives HTTP hops because
  it's carried in a header, not a process-local contextvar.
- **`span_id` / `parent_id`** — build the actual call tree (who caused whom), not just a
  flat correlation tag.
- **`kind`** — the span's role relative to a network boundary:

  | kind | means | example seen |
  |---|---|---|
  | `SERVER` | received a synchronous inbound request | `api` handling `/chat` |
  | `CLIENT` | made a synchronous outbound call | `api` calling `runtime`'s `/run` |
  | `INTERNAL` | stayed inside the process | ASGI `http.response.start`/`body` events |
  | `PRODUCER` / `CONSUMER` | async message queue send/receive | not used here (no queue) |

- **`status`** — `UNSET` unless code explicitly calls `span.set_status(...)`, or an
  unhandled exception auto-flips it to `ERROR`. `UNSET` on a successful call is normal,
  not a gap.

### Cross-service propagation, proven live

One real browser chat request produced a single `trace_id` spanning **three hops**:

```
browser → api      SERVER  "POST /api/v1/chat"        parent_id = null
api      → runtime CLIENT  "POST" → :8001/api/v1/run   parent_id = api's SERVER span_id
runtime            SERVER  "POST /api/v1/run"          parent_id = api's CLIENT span_id  ← different process
```

`runtime`'s `SERVER` span's `parent_id` exactly matches `api`'s `CLIENT` span_id — two
separate OS processes, two separate terminals, linked purely by the `traceparent` header
`HTTPXClientInstrumentor` injected and `FastAPIInstrumentor` read on arrival. Neither
`chat.py` nor `run.py` contains a line of tracing code — it's all auto-instrumentation.

### What tracing does *not* give you

Generic HTTP instrumentation only sees "bytes went to this URL." Before LangSmith was
wired up, the LLM call inside `runtime` was fully untraced — `HTTPXClientInstrumentor`
was only added to `api`. Even with it added to `runtime`, the span would just be:

```
CLIENT  POST https://api.openai.com/v1/messages   status=200   duration=1.2s
```

No prompt, no completion, no token count, no cost, no model name, no which LangGraph
node called it. That gap is what LangSmith fills — see below.

---

## 3. LangSmith

### Zero-code integration

Unlike OpenTelemetry, LangChain's tracer reads `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`,
`LANGSMITH_PROJECT` **directly from the OS environment** and auto-attaches to every
chain/graph run — no `configure_*()` call, no instrumentor. The config fields already
existed unused in `shared/core/core/config/base.py`; turning it on was env vars only.

### The gotcha: pydantic-settings doesn't touch `os.environ`

`AppSettings(env_file=".env")` parses `.env` privately to populate our own settings
object — it never calls `os.environ.update(...)`. Since LangSmith's SDK reads
`os.environ` directly (not our settings object), `LANGSMITH_TRACING=true` sitting in
`.env` would silently do **nothing** — no error, just zero traces ever sent. Fixed with
an explicit bridge in `services/runtime/app/main.py`, right after `get_settings()`:

```python
if _settings.langsmith_tracing:
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_PROJECT"] = _settings.langsmith_project
    if _settings.langsmith_api_key:
        os.environ["LANGSMITH_API_KEY"] = _settings.langsmith_api_key.get_secret_value()
```

Also: the exact env var name matters — `LANGSMITH_PROJECT`, not `LANGSMITH_PROJECT_ID`
(easy typo; the SDK silently ignores unrecognized names and falls back to a default
project rather than erroring).

### Vendor landscape — LLM/agent tracing specifically

This is a different market from general infra observability (§5) — these tools
understand *chains, prompts, and tokens* as first-class concepts, not just HTTP spans.

| Vendor | Position | Best fit |
|---|---|---|
| **LangSmith** | Native to LangChain/LangGraph — what's wired up here | Already the right choice for this repo; outside a LangChain stack, integration overhead rises a lot |
| **Langfuse** | Leading open-source / self-hosted option — acquired by ClickHouse (Jan 2026); self-hosted is free with no usage limits | Data control / self-hosting matters more than convenience |
| **Arize (Phoenix)** | OTel-native — uses OpenInference (built on OTLP) instead of a proprietary protocol; open-source eval library | Already standardized on OpenTelemetry elsewhere and want one protocol for both infra and LLM traces |
| **Braintrust** | Treats observability and evaluation as one workflow, not two tools; most generous free tier (1M spans/mo, 10K eval runs) | Evaluation-driven development, CI-gated prompt regressions |

Given this project already runs LangGraph, LangSmith stays the right call — the
alternatives matter more if evaluation (Ragas, below) outgrows what LangSmith's own
eval/dataset features offer, or if the stack ever moves off LangChain.

### What it revealed

Clicking into a real trace showed the graph's actual runtime shape, which didn't match
what the SSE `step` event labels (`plan`, `retrieve`, `verify`, `respond`) implied:

```
plan_tasks → fan_out_tasks (Send × N, 0.00s — just dispatch) → execute_task (parallel) → respond
```

`fan_out_tasks`'s Output panel showed the literal dispatch object:

```
Send(node='execute_task', arg={'task': {'intent': 'skills', 'query': '...'}})
```

— confirming `plan_tasks` classifies the question into an `intent` and rewrites it into
a structured task, then `Send` fans it out. A single-intent question produces one `Send`;
a compound question should produce several, visible as parallel `execute_task` branches.

Per-node, per-call visibility that OTel can't provide: exact prompt sent, raw completion,
input/output token counts, cost, latency — all itemized (e.g. one full turn: `9.8K
tokens / $0.0059`).

**Open question surfaced, not yet resolved**: every LLM call in the trace showed
`ChatGroq`, despite `services/runtime/.env` having `LLM_PROVIDER=openai` /
`OPENAI_MODEL=gpt-4.1-mini`. Not yet confirmed whether this is intentional (Groq used
deliberately for planner/executor sub-steps, a different provider for something else) or
a real misconfiguration. Check `app/graphs/career.py` / wherever each node constructs its
model client.

---

## 4. Bugs this work surfaced (the actual point of observability)

Signals in one layer pointing at real bugs, found incidentally while building the
instrumentation, not while looking for them:

1. **`request_id` not propagating past the middleware** (fixed) — see §1.
2. **Concurrent-request race on the checkpointer connection** — `psycopg` warning
   `"another command is already in progress"` + `"discarding closed connection: [BAD]"`,
   surfaced in `runtime`'s logs when two chat requests landed close together and both hit
   `career_graph.aupdate_state(...)` in `run.py`'s cache-hit path. Self-healing (pool
   discards the bad connection) but a real signal of a race under concurrent requests to
   the same session. **Not yet fixed.**
3. **Frontend: one click sending two chat turns** (fixed) — `ChatWindow.tsx`'s
   `askSignal` effect fires on mount with a real side effect (a network call) and no
   de-dup guard. React 18 StrictMode (on by default, `next.config.ts` doesn't override
   it) deliberately double-invokes dev mounts — mount → effects → unmount → mount →
   effects again — specifically to catch exactly this kind of unguarded side effect.
   Production builds never double-invoke, which is why it wasn't visible outside `next
   dev`. Fixed by keying the effect off `askSignal.nonce` via a ref (`lastNonceRef`), so
   it's idempotent regardless of how many times React invokes it — not a debounce/throttle
   fix, since the problem was never about timing (React always double-invokes exactly
   twice, deterministically), it was about the same logical event being replayed. A
   companion timing race in `send()`/`retry()` (guard read a ref that only updated a
   render cycle after the real state change) was fixed the same way: set the ref
   synchronously instead of relying on the `useEffect` mirror.
4. **Stale duplicate baked into checkpoint history** — a session that hit bug #3 before
   the fix has the duplicate permanently in its Postgres-persisted message history; the
   checkpointer replays full prior state on every turn, so it kept showing up in new
   LangSmith traces for that `session_id` even after the code fix shipped. Confirmed by
   starting a fresh session — no duplicate. The lesson: a code fix doesn't retroactively
   clean already-persisted state.
5. **Provider discrepancy** (open) — see LangSmith section above.

---

## 5. Going beyond local/console

Everything above runs against console output or a local terminal — nothing is shipped
anywhere yet. Given the deployment target (single free-tier EC2 box, see
`infrastructure/docker/docker-compose.prod.yml`), self-hosting a Loki/Tempo/Prometheus
stack on the same box is a bad idea — it'll compete with the app for the ~1GB of RAM.
A SaaS free tier is the right call.

**Market context**: OpenTelemetry itself is now the industry-standard wire format —
vendor lock-in is mostly at the *backend/UI* layer, not the instrumentation layer, so
switching vendors later mainly means changing `OTLP_ENDPOINT`, not re-instrumenting code.
By market share/analyst positioning, **Datadog leads on adoption**, with Dynatrace and
Splunk as the other big enterprise incumbents (Splunk is the only vendor named a Leader
in both Gartner's Observability and SIEM Magic Quadrants); **Elastic** has been named a
Gartner Observability Leader three years running. None of the enterprise incumbents have
a meaningful free tier suited to a solo/hobby project, though.

| Vendor | Position | Fit here |
|---|---|---|
| **Grafana Cloud** | Open-source-rooted (the LGTM stack: Loki/Tempo/Mimir/Grafana), most generous hobby-scale free tier | Best fit — code already speaks OTLP natively (`opentelemetry-exporter-otlp-proto-grpc` already a dependency), so it's `OTEL_ENDPOINT` + an auth header, done. Free tier: 10k metric series, 50GB logs, 50GB traces. |
| Better Stack | OTel-native, unified log/metric/trace model, nicer solo-dev UX | ~0.5TB/month free |
| Axiom | OTel-native, less polished dashboards than Grafana | 500GB/month free |
| Datadog / Dynatrace / Splunk / Elastic | Enterprise market leaders, richest AI-assisted investigation features | Overkill and not economical at this scale — worth knowing they exist, not worth adopting here |

To wire up: add `OTLP_ENDPOINT`/`OTLP_HEADERS` to each service's `.env.prod`, no code
changes needed beyond what's already there (`configure_telemetry` already branches on
whether an endpoint is set). Optionally add an OTel Collector container as a local
buffer/batcher later if needed — not required to start.

Logs currently go to stdout → Docker's log driver only. Simplest path to ship them
without touching app code: an OTel Collector or Grafana Alloy sidecar container tailing
stdout from the other containers.

Both vendor tables above reflect market positioning as of mid-2026; re-check before
committing budget since this space moves fast (Langfuse's ClickHouse acquisition, for
one, happened this January).

---

## 6. Ragas — RAG evaluation

### What it is, and isn't

Not a service — `ragas` is a Python library, imported only by a standalone dev script
(`services/runtime/evals/ragas_eval.py`, a `--group dev` dependency, never touched by the
running app). It scores `(question, retrieved_contexts, answer)` triples with an LLM
acting as judge, not exact-match:

- **`Faithfulness`** — is the answer grounded in what was retrieved, or fabricated?
- **`ResponseRelevancy`** — does the answer actually address the question asked?
- **`LLMContextPrecisionWithoutReference`** — are the retrieved chunks relevant to the
  question? (the "WithoutReference" variant needs no hand-written ground-truth answer —
  the only reason all three metrics here were usable without building a golden dataset
  first.)

### A real upstream bug, worked around, not avoided

`ragas==0.4.3` (what `uv add ragas` resolves by default) hard-imports
`langchain_community.chat_models.vertexai` at module load — a path `langchain-community`
has since deleted. Confirmed via two open issues on ragas's own GitHub, not specific to
this repo. Downgrading to `ragas==0.3.9` does **not** dodge it — same crash. Fix, at the
top of `ragas_eval.py`, before `ragas` is imported at all:

```python
import sys, types
_fake_vertexai = types.ModuleType("langchain_community.chat_models.vertexai")
_fake_vertexai.ChatVertexAI = object
sys.modules["langchain_community.chat_models.vertexai"] = _fake_vertexai
```

A `sys.modules` stub — never touches the installed package, never uses VertexAI, just
satisfies an eager import so the rest of `ragas` loads.

### The eval script's actual scope

`build_sample()` runs: `plan_tasks`' real query rewrite (imports and calls
`PLAN_SYSTEM_PROMPT` from `app/prompts/career.py` directly — not a reimplementation that
can drift) → `retrieve_context()` → one grounded-answer LLM call. Deliberately **not**
the full graph — no `fan_out_tasks` parallel execution, no sufficiency-check/reformulate
retry loop, no `respond`'s actual synthesis prompt. An earlier version of this script
skipped even the `plan_tasks` step; that turned out to matter a lot (below) — skipping
the rest of the graph is a reasonable simplification for isolating retrieval quality,
but skipping the query rewrite silently measured a *weaker* pipeline than what's actually
deployed.

### Judge decoupled from generator

Generation stays on whatever `LLM_PROVIDER` is actually configured (Groq, matching
production). The judge uses a separate `ChatOpenAI(model="gpt-4.1-mini")` rather than
reusing that same Groq client. Reason: the first full run (3 metrics × 6 questions = 18
judge calls) exhausted Groq's free-tier 100k-token/day quota mid-run — shared with every
other test that day — and came back `RateLimitError` on most calls, `NaN` on most
metrics. The judge's job (scoring an already-generated answer) has nothing to do with
which model produced that answer, so there's no representativeness cost to a more
reliable model just for judging.

### The investigation, in order

1. **Baseline** (`nomic-embed-text` via Ollama, the local-dev embedding default):
   faithfulness 0.94, answer_relevancy 0.27, context_precision 0.51.
2. Switched `EMBEDDING_PROVIDER` to `openai` (`text-embedding-3-small`) + re-ingested.
   First re-run was invalidated by the Groq quota exhaustion above (before the judge was
   decoupled) — most metrics came back `NaN`.
3. After decoupling the judge: context_precision average nearly doubled (0.51 → 0.90) —
   "Explain your RAG platform architecture" went from 0.0 to 0.92, the single biggest
   win. But two *other* questions ("most complex project," "what systems have you
   built?") got *worse* on this same run (0.50→0.25, 0.83→0.25).
4. Diagnosed the regression with a purpose-built script, `evals/rank_check.py` — queries
   Qdrant directly at `top_k=15` (production only ever sees `RESULT_LIMIT=4`) and prints
   the full ranked list with scores. For "most complex project," the chunk that actually
   describes the most architecturally complex project (`elsa-ai-assistant`) ranked
   **#13**, and the *entire* score band across all 15 results was flat (0.31–0.40) — no
   chunk stood out, because "complex" isn't a concept anything in the corpus is literally
   tagged with. Raising `RESULT_LIMIT` would not have fixed this — it would have just
   handed the model more equally-irrelevant chunks.
5. Root cause: not retrieval quality, not embedding quality — a **query-formulation
   gap**. `plan_tasks` was passing subjective/superlative language ("most complex,"
   "daily") through to retrieval close to verbatim, and embedding search has nothing to
   match a word like "complex" against literal indexed text.
6. Fix: extended `PLAN_SYSTEM_PROMPT` (`app/prompts/career.py`) with an explicit
   instruction — for superlative/vague language, rewrite the query around the *concrete
   technical signals* that would indicate that judgment, not just rephrase the sentence
   around the vague word. A first attempt (prose instruction only, no example) changed
   nothing — the model just rephrased the sentence while keeping "most complex" verbatim.
   Adding a concrete right/wrong example fixed it immediately:

   ```
   Example — input: "walk me through your most complex project"
   Wrong (still vague): "Can you walk me through your most complex project, explaining..."
   Right (concrete signals instead): "project involving multi-agent orchestration,
   distributed or event-driven architecture, and the largest production scope"
   ```

   Verified with `rank_check.py` before trusting the full eval again: with the rewritten
   query, `elsa-ai-assistant` jumped from rank **#13** (score 0.32) to rank **#1** (score
   0.59), and the whole distribution sharpened (0.31–0.40 flat → 0.37–0.59 with a clear
   winner). The embedding model was never the problem — it just had nothing concrete to
   discriminate against.
7. Same pattern, same fix, applied to "which tools do you work with daily?" — extended
   the prompt further to map vague "tools" language to concrete categories (software,
   frameworks, AI copilots, dev platforms) and to drop untracked framing like
   "daily"/"regularly." Retrieval improved (flat 0.27–0.40 band → a real 0.45–0.55 spread
   with skills content dominating the top-4) — but the final answer *still* scored 0.0
   relevancy, for a genuinely different reason (below).

### Final scores, after both prompt fixes

| Question | Faithfulness | Answer Relevancy | Context Precision |
|---|---|---|---|
| Walk me through your most complex project | 1.00 | 0.73 | 1.00 |
| What's your tech stack? | 1.00 | 0.78 | 1.00 |
| How deep is your LangGraph experience? | 1.00 | 0.77 | 1.00 |
| What systems have you built? | 1.00 | 0.66 | 0.75 |
| Explain your RAG platform architecture | 0.95 | 0.90 | 1.00 |
| Which tools do you work with daily? | 1.00 | 0.00 | 0.33–0.50 |

Context precision average across the full set: **0.57 → 0.90** from baseline to final.

### The one holdout, and why it's a different bug than it looks like

"Tools daily" still scores 0.0 answer_relevancy even with retrieval now working. Cause
this time: the eval script's answer-generation step passes the **original** question
(with "daily" intact) into the final answer prompt, not the rewritten retrieval query —
see `build_sample()`. The knowledge base has no frequency-of-use data for any tool, so
the model correctly declines the literal "daily" claim rather than fabricating one — 1.0
faithfulness, honest hedging, not a defect. Whether the final answer *should* interpret
"daily" loosely (the way a person would read it colloquially) is a separate, deliberate
product decision about `respond`'s own prompt — not a retrieval or eval-harness bug, and
not yet decided.

### Cache toggles added along the way

Iterating on eval results while swapping embedding providers and re-ingesting kept
getting shadowed by two independent Redis caches already in the chat flow (see
`app/tools/retrieval.py` and `app/core/response_cache.py`) — a stale entry from before a
change would silently keep serving the old result. Added independently-toggleable env
vars for both, gated inside the module that owns each cache rather than at call sites:

| Layer | Env var | A hit skips |
|---|---|---|
| `response_cache.py` (outer) | `RESPONSE_CACHE_ENABLED` | the entire graph — plan_tasks, retrieval, execute_task, respond |
| `retrieval.py` (inner) | `RAG_CACHE_ENABLED` | just the Qdrant search |

Both default `true` (production keeps caching); both `false` in local `.env` during this
investigation so provider/prompt changes were felt on the very next query rather than
masked by a 24h-TTL cache entry from before the change.

---

## 7. Where this picks back up

Ragas is now a working, validated tool for this repo, not just wired up — it found a
real query-formulation bug and confirmed the fix quantitatively. Still open:

- **The "daily tools" product decision** above — make it, then re-run the eval to confirm.
- **Eval harness fidelity** — `ragas_eval.py` still skips `fan_out_tasks`' parallel
  execution, the sufficiency-check/reformulate retry loop, and `respond`'s real synthesis
  prompt. Worth closing that gap if a future regression hides in exactly those parts.
- **A golden-dataset regression harness** — turn `ragas_eval.py`'s ad-hoc question list
  into a real fixture, run it in CI or before shipping a prompt change, catch regressions
  automatically instead of re-running by hand. LangSmith Datasets (already wired up, §3)
  is a natural home for this.
- **Metrics** (Prometheus/Grafana dashboards) — not started at all.

# Runtime Service (`services/runtime`)

**Role in the flow:** the brain. Owns the LangGraph agent graph, conversation memory, LLM provider selection, and the only copy of Ravinder's knowledge base today.

## What it does

Runs one LangGraph state machine per chat turn ("the career graph"): classifies intent, retrieves
real career facts from Qdrant (mandatory RAG — never static/hardcoded data), streams the LLM's
answer to the client token-by-token, and parses out an optional UI widget instruction from the
response. Conversation history is not passed in by the caller — it's loaded and saved automatically
by a Postgres-backed checkpointer keyed on `session_id`.

## Stack

FastAPI (internal-only, not public), LangGraph, LangChain (`langchain-anthropic`, `langchain-groq`,
`langchain-ollama` — provider adapters), `langgraph-checkpoint-postgres`, `psycopg[binary,pool]`.

## Structure

```
services/runtime/app/
├── main.py                  builds career_graph from the checkpointer at startup, stores on app.state
├── api/v1/run.py             POST /run (SSE), DELETE /run/{session_id}
├── graphs/career.py           the LangGraph graph itself: intent taxonomy, context assembly,
│                              topology — nothing reusable by a future second graph lives here
├── prompts/career.py          BASE_SYSTEM, WIDGET_INSTRUCTION, parse_widget_block() — this graph's
│                              prompt templates + its WIDGET-marker protocol parser, kept together
├── core/llm.py                build_llm(settings, tools) — graph-agnostic LLM provider factory
│                              (groq|anthropic|ollama), reusable by any future graph
├── state/agent_state.py       TypedDict AgentState (messages, intent, context, response, widgets)
├── knowledge/profile.py       PROFILE — identity only (name, location, contact); no career facts
├── memory/checkpointer.py     AsyncPostgresSaver singleton — init/get/close
├── tools/retrieval.py          retrieve_context() — mandatory RAG call; search_knowledge_base tool
│                               wrapper also lives here, unused by the graph today (see Known gaps)
├── streaming.py                emit_step(), TokenWidgetSplitter — see Streaming section below
└── executor/, agents/          scaffolded, empty (.gitkeep) — see Known gaps
```

`graphs/`, `prompts/`, and (eventually) `agents/` are all one-package-per-domain, mirroring each
other — `graphs/interview.py` would sit alongside `graphs/career.py`, with its own
`prompts/interview.py` next to it, each reusing the same `core/llm.py`.

## The career graph (`graphs/career.py`)

```
START
  └─ classify_intent           keyword match on user_input → project | skills | resume
  │  emit_step("classify")                                  | jd_match | architecture | general
  └─ [intent node]              e.g. load_skills_context — mandatory retrieve_context(user_input),
  │  emit_step("retrieve")       result goes into state["context"]["retrieved"] (RAG-only, ALL six
  │  (all six intents)           intents including "general" — see app.knowledge.profile / app.prompts.career)
  └─ respond
        emit_step("respond")
        system = BASE_SYSTEM (identity only) + context_block (retrieved facts) + WIDGET_INSTRUCTION
        ai_message = await llm.ainvoke(messages)     # no tools bound — see Known gaps
        parse "WIDGET:<type>:<json>" out of the text, return {response, widgets}
  └─ END
```

No tool-calling is bound to this LLM call — see "Tool-calling: deliberately removed" below.

### Retrieval (`tools/retrieval.py`)

`retrieve_context(query)` embeds the query via `core.embeddings.embed_query()` — the same
provider-agnostic factory [`services/ingestion`](./ingestion.md) uses, so `EMBEDDING_PROVIDER=
openai|ollama` and `EMBEDDING_MODEL` must match what ingestion used to populate the collection —
and runs `AsyncQdrantClient.query_points()` against the `ravinder` collection, returning the top 4
chunks formatted as `[source] text`. Called automatically (mandatory) by **all six** context-loader
nodes, including `load_general_context` — using the user's own question as the query, never
optional and never left to the LLM's discretion. This is deliberately universal rather than
intent-gated: `classify_intent` is a keyword match and will miss real career questions phrased
unexpectedly (e.g. "tell me about yourself" matches no keyword and falls to "general" — with zero
retrieved content, the model would sometimes fabricate a plausible-sounding bio instead of honestly
saying it didn't know, since it had nothing to be honest *about*). Retrieving unconditionally closes
that loophole: every turn has either real grounding to answer from, or a clear basis to say
"not covered" instead of guessing. Wrapped in try/except: any failure (Qdrant down, embedding provider error) returns
a plain string ("The knowledge base is temporarily unavailable.") instead of raising, so a chat turn
never crashes because the knowledge base is unreachable — same non-fatal-if-infra-down spirit as
`api`'s `lifespan.py`. Both clients are process-lifetime singletons (`get_qdrant_client()`/
`core.embeddings`' own client), closed on shutdown in `main.py`.

A `search_knowledge_base` `@tool`-wrapped version of the same function also lives in this module
(delegates to `retrieve_context`) but isn't bound to the graph's LLM today — see Known gaps.

Widget parsing is a plain string split on the literal marker `"WIDGET:"`, not structured tool
output — see tradeoffs below.

## Streaming (`app/streaming.py`)

`api/v1/run.py` streams the graph with `career_graph.astream(state, config, stream_mode=
["messages", "custom"])` instead of `ainvoke` — real per-token deltas, not one blocking call that
dumps the whole answer at once.

- **`emit_step(step_id)`** — called at the top of `classify_intent`, each retrieval context loader,
  and `respond`, via LangGraph's `get_stream_writer()` (the `"custom"` stream mode). Emits
  `{"type":"step","id":...,"label":STEP_LABELS[id],"status":"running"}`. `STEP_LABELS` is a plain
  dict (`{"classify": "Understanding your question", "retrieve": "Searching knowledge base",
  "respond": "Composing answer", ...}`) — reword display text there without touching any other
  layer. No-ops safely (never raises) when called outside a streaming run, so direct unit-test calls
  to the node functions are unaffected.
- **`TokenWidgetSplitter`** — pure, stateful, no LangGraph/network deps. Consumes token deltas from
  the `"messages"` stream (filtered to `meta["langgraph_node"] == "respond"` — the only node that
  calls an LLM), holding back just enough trailing text to detect the `WIDGET:` marker even when
  it's split across separate streamed chunks, then switches to silent accumulation and parses the
  widget out via `parse_widget_block` once the stream ends.

The SSE envelope (`api/v1/run.py` → `services/api`'s proxy → frontend) is one flat `{type: ...}`
shape: `step`, `token`, `widget`, `done`, `error`. `step` is deliberately generic — a future tool
call or sub-agent is just another `step` with a different `id` (e.g. `"tool"`, `"agent:resume"`),
not a new event type, so this protocol doesn't need to change when multi-agent/tool-calling work
lands.

## Conversation memory (`memory/checkpointer.py`)

The graph is compiled with `checkpointer=AsyncPostgresSaver(pool)`, invoked with
`config={"configurable": {"thread_id": session_id}}`. LangGraph loads the thread's prior messages
before running and persists the updated state after — callers only ever send the newest
`HumanMessage`. `DELETE /run/{session_id}` calls `checkpointer.adelete_thread(session_id)`.

**Windows-specific note:** `psycopg`'s async mode can't run on the default `ProactorEventLoop`.
`run_dev.py` sets `WindowsSelectorEventLoopPolicy` before `uvicorn.run(...)` — a no-op on
Linux/Docker. Local dev on Windows must use `python run_dev.py`, not a bare `uvicorn app.main:app`.

## LLM provider factory (`core/llm.py`'s `build_llm`)

```python
LLM_PROVIDER=groq       → ChatGroq(model, api_key)        # default in .env.example
LLM_PROVIDER=anthropic  → ChatAnthropic(model, api_key, max_tokens)
LLM_PROVIDER=ollama     → ChatOllama(model, base_url)      # local, no API key
```
Switching providers is a `.env` change, not a code change.

## Design tradeoffs

| Decision | Alternative considered | Why this way |
|---|---|---|
| **Real token streaming via `astream(stream_mode=["messages","custom"])`**, not `ainvoke` | Keep the original single-shot `ainvoke` + one `token` event (what this service shipped with initially) | The original design point-blank waited out the full LLM latency in silence before showing anything. `TokenWidgetSplitter` solves the reason streaming was deferred (Groq can split `"WIDGET:"` across chunks) by buffering just the marker-detection tail live, rather than buffering the whole response. |
| **Standardized `step` SSE event** (`id`/`label`/`status`), one shape for nodes, tools, and future sub-agents | A bespoke event type per kind of progress (`node_step`, `tool_call`, `agent_step`, ...) | The upcoming multi-agent/tool-calling work needs to add progress visibility without renegotiating the wire protocol — a tool is `step id:"tool"`, a sub-agent `step id:"agent:resume"`, no new type. |
| **Tool-calling removed from `respond`'s LLM call** (no `bind_tools`, no `ToolNode`/`tools_condition`, plain `respond → END`) | Keep `search_knowledge_base` bound as an LLM-callable tool (original design) | Two reasons: (1) retrieval is already mandatory via the context-loader nodes, so the base LLM rarely needed to call a tool itself; (2) Groq's streaming + bound-tools combination threw intermittent `groq.APIError: tool call validation failed` mid-stream (~50% failure rate in testing) — removing the binding eliminated it entirely (0 failures across 8 repeated live runs). Real agentic tool-calling returns with the planner/executor work, likely via a different mechanism than a bound tool on the same streamed call. |
| **Widget-as-string-marker** (`"WIDGET:<type>:<json>"` parsed by `str.split`) | A dedicated `emit_widget` tool the LLM calls, returned as structured tool output | Simpler to prompt for and to parse; no tool-calling machinery required (see above) to get structured UI data out of a plain chat completion. |
| **Career facts RAG-only; static `profile.py` is identity-only** (name/location/contact) | Keep career facts (skills, projects, experience) hardcoded in the system prompt, retrieval as a supplemental tool (original design) | The static blob couldn't be kept in sync with the real, changing résumé, and its own wording ("answer ONLY from profile data") actively discouraged trusting retrieved facts that went beyond it. Mandatory retrieval per intent (see above) makes the real ingested résumé the actual source of truth. |
| **Retrieval runs for all six intents, including `general`** | Keep `general` retrieval-free for latency (original design after the RAG-only change) | Caught live: "tell me about yourself" matches no `classify_intent` keyword, fell to `general`, and with zero retrieved content the model non-deterministically fabricated a plausible-sounding bio (wrong years of experience, wrong university) roughly as often as it honestly declined. Keyword-based intent classification will always have coverage gaps; gating retrieval on it turns those gaps into fabrication risk. Retrieving unconditionally trades a bit of latency on pure small talk for zero fabrication risk anywhere. |
| **`AsyncQdrantClient.query_points()`, not `.search()`** | Keep using the older `.search()` method | `qdrant-client` 1.18 removed `.search()` from `AsyncQdrantClient` entirely — `query_points()` (the unified Query API) is the only option, but it requires a Qdrant **server** ≥1.10. This forced bumping the pinned server image in `docker-compose.yml` from `v1.9.3` to `v1.12.4` — discovered via a live 404 when the client tried to query a 1.9.3 server. |
| **Keyword-match intent classification**, not an LLM call | An LLM-based classifier/router node | Zero extra latency and zero extra cost per turn; the six intents map cleanly onto simple keyword sets today. Revisit only if intent accuracy becomes a measured problem. |
| **Postgres-backed checkpointer**, not Redis | Redis (already used for `api`'s health check plumbing) | LangGraph's official checkpoint savers favor Postgres for durable, queryable conversation state (`ARCHITECTURE.md` §10.5: Redis for ephemeral/TTL data, Postgres for anything meant to persist/be queried). |
| **Multi-provider LLM factory** (Groq default, Anthropic, Ollama) | Pin to a single provider | Groq is the default for cost/latency during development; Anthropic (Claude) is the "real" target per the platform's stated positioning; Ollama gives a fully offline/local dev path. One `LLM_PROVIDER` env var switch, no code fork. |
| **`career.py` split into `graphs/career.py` + `prompts/career.py` + `core/llm.py`** | Keep everything in one `career.py` file (as originally built) | The original file mixed six concerns (prompts, intent taxonomy, context assembly, LLM provider selection, widget parsing, graph topology). `build_llm` was the clearest offender — fully graph-agnostic, so trapped in `career.py` it couldn't be reused by a future second graph without an awkward cross-graph import. Split along reusability: `core/llm.py` (reusable by any graph), `prompts/career.py` (this graph's domain content), `graphs/career.py` (topology + genuinely graph-specific nodes). |
| **No numeric `skill_graph` widget offered** | Keep offering it, tighten the anti-fabrication instruction | Real résumés don't state proficiency percentages; the model fabricated them (90/80/70%) despite an explicit instruction not to. Removing it from the offered widget list is a stronger guarantee than an instruction a weaker model can ignore — skills use `tech_stack` (plain lists) instead. |

## Known gaps

- **No tool-calling bound to the LLM right now.** `app/tools/retrieval.py` still defines
  `search_knowledge_base` as an `@tool`-wrapped function (tested, ready), but `respond` doesn't bind
  it — see the tradeoffs row above. `app/executor/`, `app/agents/` are still empty `.gitkeep`
  stubs — the multi-agent planner/executor pattern documented in `ARCHITECTURE.md` §3.1 (separate
  resume/project/github/interview agents, each presumably with its own tool access) isn't
  implemented yet; today it's one graph with mandatory-retrieval context-loader nodes, not separate
  sub-agents with tool access.
- Retrieval works end-to-end with real embeddings (verified against local Ollama/`nomic-embed-text`
  and a real uploaded résumé PDF), but `data/blogs`/`data/certificates` are still empty — retrieval
  becomes more valuable as more real source documents are added there.
- No retry/backoff around the LLM call — a transient provider error surfaces as a generic SSE
  error event.
- Widget population quality can drift now that `resume_preview`/`project_card` are reconstructed by
  the LLM from retrieved prose instead of a precise static dict — worth an eye on real chat output,
  not something a unit test fully captures.

## Run & test

```bash
make dev-runtime   # starts postgres/redis/qdrant, then `python run_dev.py` on :8001
make test          # includes services/runtime/tests (currently empty)
```

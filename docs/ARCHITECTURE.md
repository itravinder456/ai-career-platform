# Ravinder AI Career Platform — Complete Architecture

---

## 1. System Vision

```
NOT a portfolio website.
NOT a chatbot.

An agentic AI platform that represents
Ravinder to recruiters, hiring managers,
and the world — autonomously.
```

---

## Content & Document Architecture (Current + Planned)

Two independent tracks, deliberately kept separate rather than merged into one datastore:

**Track 1 — Structured facts (Postgres, `services/api`).** Anything the UI needs to render
directly and predictably: the `profile`, `social_links`, and `profile_stats` tables
(Alembic-migrated, `services/api/app/db/models/`). Owned and edited through the admin panel
(`/admin`, key-gated via `ADMIN_SECRET_KEY`), read publicly via `GET /api/v1/profile`. This is the
source for the landing page's name/headline/stats/links — `Profile` is deliberately the right
tool here, not a document parsed at request time, because it needs to be fast, precisely
renderable field-by-field, and directly editable without touching prose. The runtime's
system-prompt identity block (`services/runtime/app/knowledge/profile.py`) reads this same table
directly, so there is exactly one place that knows Ravinder's name, location, and links.

An earlier pass also gave `experiences`/`projects`/`skills` this same structured, admin-CRUD
treatment. That was removed: those are career *facts* (what Ravinder actually built, worked on,
knows), which Track 2 below already covers via RAG over the real resume — a second, structured
copy of the same facts risked drifting out of sync with the source of truth every time one was
updated and the other wasn't. `profile`/`social_links`/`profile_stats` survive that cut because
they have no RAG equivalent — nothing else knows the hero's stats or link URLs.

**Track 2 — Narrative source documents (Qdrant, via `services/ingestion`).** Free-form written
material — resume, project write-ups, blog posts, certificates — for the chat's deep/narrative
answers ("walk me through your architecture", "why did you choose X"). Critically, this is a
**two-stage pipeline, not a live read**:

```
data/{resume,projects,blogs,certificates}/  (files: .md, .txt, .pdf)
        │
        │  services/ingestion — offline, manual (`make ingest`)
        │  load → chunk → embed → upsert
        ▼
    Qdrant (vector store)
        │
        │  services/runtime — online, per chat request
        │  embed the query → semantic search → top-k chunks as LLM context
        ▼
   Chat response
```

`services/runtime` **never reads `data/` directly** and never talks to `services/ingestion` at
request time — it only ever queries Qdrant. Ingestion is what turns raw files into searchable
vectors, entirely offline, ahead of any chat request; runtime's retrieval tool
(`app/tools/retrieval.py`) only knows how to search an already-populated Qdrant collection. If a
file is added or edited under `data/` but `make ingest` hasn't been re-run, the chat simply won't
know about the change — there is no fallback path that reads the file directly. See
[docs/services/ingestion.md](./services/ingestion.md) for the pipeline itself and
[docs/services/runtime.md](./services/runtime.md) for the retrieval tool.

**Why two tracks, not one:** structured facts need to be fast and directly editable field-by-field
— Postgres is the right tool. Narrative material needs semantic search over unstructured prose —
a vector store is the right tool. Making one serve both jobs (rendering UI from parsed documents,
or semantic search over structured rows) fights the grain of both.

### Document source — current state

Source files live in `data/{resume,projects,blogs,certificates}/` (markdown/text/PDF), read by
`services/ingestion/app/loader.py` and embedded into Qdrant — never read by `services/runtime`
directly (see the pipeline diagram above). Ingestion is triggered manually (`make ingest`) — no
scheduler, no admin trigger yet. This is deliberate for now, not a gap: see
[docs/services/ingestion.md](./services/ingestion.md)'s Known Gaps.

### Document source — planned evolution

1. **Move the storage backend from local disk to cloud storage** (Google Drive or similar). The
   document bytes stop living in the git-adjacent `data/` folder; `services/ingestion` reads from
   a backend-agnostic location instead of a hardcoded local path. The pipeline shape doesn't
   change: ingestion is still the only thing that ever reads a raw document, still embeds into
   Qdrant, and `services/runtime` still only ever queries Qdrant — swapping the storage backend
   is invisible to runtime.
2. **Introduce a `documents` metadata registry table in Postgres** — not the document content
   itself (that stays in the storage backend), just the registry of *what exists*: `doc_type`,
   title, storage backend (`local` | `drive` | ...), the backend-specific reference (a local path
   today, a Drive file ID later), a content hash (to detect "has this actually changed since last
   ingestion"), and `last_ingested_at`. This is the layer that makes "replace this file from the
   admin panel" possible without needing to know the original filename — the admin panel resolves
   "the resume" or "the X project write-up" to a stable row in this table, not a raw path.
3. **Admin panel gains a Documents tab** — once the registry exists: list registered documents,
   upload a new file to replace one in place (same `doc_type`/slug, new content), which updates
   the registry row and flags it for re-ingestion.
4. **Ingestion stays manual for now** — deliberately deferred, matching this project's existing
   pattern of shipping one admin-panel entity at a time rather than building ahead of need.
   Auto-triggering re-ingestion on upload, or on a schedule, is a natural next step once the
   registry exists, not before.

This mirrors the two-track split one level down: the `documents` table is itself a *structured
fact* about a *narrative asset* — small, queryable metadata in Postgres, pointing at unstructured
content wherever it actually lives. Not built yet — documented here as the agreed direction before
implementation.

---

## 2. Full System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                  │
│              Next.js 14 · Vercel CDN                │
│  Landing Page │ Chat UI (SSE) │ Admin Panel          │
└─────────────────────────┬───────────────────────────┘
                          │ HTTPS / WSS
┌─────────────────────────▼───────────────────────────┐
│                   GATEWAY LAYER                      │
│              AWS API Gateway v2 (HTTP)               │
│       Rate Limiting │ CORS │ JWT Auth │ Logging      │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│                 APPLICATION LAYER                    │
│          FastAPI · Python 3.11 · AWS ECS             │
│    /chat/stream │ /admin/* │ /health │ /ingest       │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│                INTELLIGENCE LAYER                    │
│                  LangGraph Runtime                   │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │              PLANNER (Supervisor)               │ │
│  │   classify intent → plan steps → route agents  │ │
│  └────────────────┬───────────────────────────────┘ │
│                   │                                  │
│    ┌──────────────┼──────────────────────┐          │
│    ▼              ▼              ▼        ▼    ▼     │
│  Resume        Project        GitHub  Interview Career│
│  Agent         Agent          Agent   Agent   Agent  │
│    │              │              │        │      │   │
│    ▼              ▼              ▼        ▼      ▼   │
│  Resume MCP   Project MCP   GitHub MCP  ...   ...   │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │              EXECUTOR LAYER                      │ │
│  │   RAG retrieval │ Tool calling │ LLM generation  │ │
│  └─────────────────────────────────────────────────┘ │
└──────────┬───────────────┬──────────────┬────────────┘
           │               │              │
┌──────────▼──┐  ┌─────────▼──┐  ┌───────▼────────┐
│   Qdrant     │  │   Redis     │  │   PostgreSQL   │
│  Vector DB   │  │   Sessions  │  │  Chat History  │
│  (RAG Store) │  │   Memory    │  │  Analytics     │
└─────────────┘  └────────────┘  └────────────────┘
┌─────────────────────────────────────────────────────┐
│               OBSERVABILITY LAYER                    │
│  LangSmith │ OpenTelemetry │ CloudWatch │ RAGAS      │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER                   │
│  AWS ECS │ Docker │ GitHub Actions │ CloudFormation  │
└─────────────────────────────────────────────────────┘
```

---

## 3. Agentic AI Patterns

### 3.1 Planner–Executor Pattern

```
This is the core intelligence pattern.

PLANNER (Supervisor):
  - Receives user message
  - Classifies intent
  - Breaks into subtasks
  - Decides which agents to run
  - Decides order of execution
  - Does NOT execute directly

EXECUTOR (Sub-agents):
  - Receives specific subtask
  - Executes using tools (MCP)
  - Returns structured result
  - Does NOT plan

WHY THIS PATTERN?
  - Separation of concerns
  - Each agent is focused
  - Easier to debug
  - Easier to test individually
  - Can run executors in parallel
```

```python
# planner — supervisor_agent.py
class SupervisorAgent:
    """
    Plans what to do. Never executes directly.
    """
    def plan(self, message: str) -> ExecutionPlan:
        intent = self.classify_intent(message)

        # Build a plan based on intent
        if intent == "about_me":
            return ExecutionPlan(
                agents=["resume_agent"],
                parallel=False,
                reasoning="Simple profile query"
            )

        elif intent == "project_deep_dive":
            return ExecutionPlan(
                agents=["project_agent", "github_agent"],
                parallel=True,   # run both at once
                reasoning="Need project + code evidence"
            )

        elif intent == "jd_match":
            return ExecutionPlan(
                agents=["resume_agent", "career_agent"],
                parallel=False,  # career needs resume result
                reasoning="Match requires full profile first"
            )

# executor — resume_agent.py
class ResumeAgent:
    """
    Executes resume queries. Never plans.
    """
    async def execute(self, task: AgentTask) -> AgentResult:
        # Step 1 — retrieve
        chunks = await self.rag.search(task.query)

        # Step 2 — use MCP tool if needed
        if task.requires_structured_data:
            data = await self.mcp.call(
                "get_experience",
                {"filter": task.filter}
            )

        # Step 3 — generate
        response = await self.llm.generate(
            context=chunks,
            structured_data=data,
            query=task.query
        )

        return AgentResult(
            content=response,
            sources=chunks,
            agent="resume_agent"
        )
```

---

### 3.2 Multi-Step Reasoning Pattern

```
For complex queries that need
multiple reasoning steps.

Example query:
"Compare Ravinder's skills with
 this Senior ML Engineer JD"

Multi-step plan:
Step 1 → Extract JD requirements
Step 2 → Retrieve Ravinder's skills
Step 3 → Retrieve project evidence
Step 4 → Compare and score
Step 5 → Generate gap analysis
Step 6 → Synthesize recommendation

Each step informed by previous.
```

```python
# multi_step_reasoning.py
class MultiStepReasoner:

    async def reason(
        self,
        query: str,
        context: dict
    ) -> ReasoningResult:

        steps = []
        current_context = context

        # Chain of thought
        for step_num in range(self.max_steps):

            # Think about next step
            thought = await self.llm.think(
                query=query,
                previous_steps=steps,
                current_context=current_context,
                instruction="What do I need to figure out next?"
            )

            # Execute the step
            result = await self.execute_step(
                thought=thought,
                context=current_context
            )

            steps.append(ReasoningStep(
                step_num=step_num,
                thought=thought,
                action=result.action,
                observation=result.observation
            ))

            # Update context with new info
            current_context.update(result.new_context)

            # Check if done
            if result.is_final_answer:
                break

        return ReasoningResult(
            steps=steps,
            final_answer=steps[-1].observation,
            reasoning_trace=steps
        )
```

---

### 3.3 ReAct Pattern (Reasoning + Acting)

```
Agent alternates between:
THINK → ACT → OBSERVE → THINK...

Used in every sub-agent.
```

```python
# react_agent.py
async def react_loop(
    query: str,
    tools: list[Tool],
    max_iterations: int = 5
) -> str:

    history = []

    for i in range(max_iterations):

        # THINK — what should I do?
        thought = await llm.generate(f"""
            Query: {query}
            History: {history}

            Think step by step:
            - What do I know so far?
            - What do I still need?
            - Which tool should I use next?
            - Or do I have enough to answer?

            Thought:
        """)

        if "FINAL ANSWER:" in thought:
            return thought.split("FINAL ANSWER:")[1]

        # ACT — call the right tool
        tool_call = parse_tool_call(thought)
        tool = find_tool(tool_call.name, tools)

        # OBSERVE — what did I get back?
        observation = await tool.execute(
            tool_call.inputs
        )

        history.append({
            "thought": thought,
            "action": tool_call,
            "observation": observation
        })

    return generate_final_answer(history)
```

---

### 3.4 Follow-up Generation Pattern

```
After every response, agent generates
contextual follow-up questions.

This keeps recruiters engaged and
guides them to explore deeper.
```

```python
# followup_generator.py
class FollowUpGenerator:

    async def generate(
        self,
        query: str,
        response: str,
        context: list[Chunk]
    ) -> list[str]:

        prompt = f"""
        User asked: {query}
        We answered: {response}

        Generate 3 natural follow-up questions
        a recruiter might ask next.

        Rules:
        - Each question explores a different angle
        - Questions should be specific, not generic
        - Based on what was just discussed
        - Format: JSON list of strings

        Examples of good follow-ups:
        - "How did you handle scaling this to 200+ users?"
        - "What was the hardest part of building the MCP server?"
        - "How does this compare to what AWS released recently?"
        """

        result = await self.llm.generate(
            prompt,
            response_format="json"
        )

        return result["follow_ups"]
```

---

## 4. LangGraph State Machine

```python
# agents/runtime.py
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

class AgentState(TypedDict):
    # Input
    session_id:     str
    user_message:   str
    chat_history:   list[dict]

    # Planning
    intent:         str
    execution_plan: dict
    current_step:   int

    # Reasoning
    reasoning_steps: Annotated[list, operator.add]
    thoughts:        Annotated[list, operator.add]

    # Tool results
    retrieved_chunks:   list[dict]
    tool_results:       Annotated[list, operator.add]

    # Output
    partial_response:   str
    final_response:     str
    citations:          list[dict]
    follow_up_questions: list[str]

    # Control
    error:          str | None
    should_retry:   bool
    iteration_count: int


def build_agent_graph() -> StateGraph:

    graph = StateGraph(AgentState)

    # Add all nodes
    graph.add_node("classify",      classify_intent)
    graph.add_node("plan",          create_execution_plan)
    graph.add_node("retrieve",      rag_retrieval)
    graph.add_node("resume_agent",  run_resume_agent)
    graph.add_node("project_agent", run_project_agent)
    graph.add_node("github_agent",  run_github_agent)
    graph.add_node("interview_agent", run_interview_agent)
    graph.add_node("career_agent",  run_career_agent)
    graph.add_node("synthesize",    synthesize_response)
    graph.add_node("followups",     generate_followups)
    graph.add_node("error_handler", handle_error)

    # Entry point
    graph.set_entry_point("classify")

    # Routing logic
    graph.add_edge("classify", "plan")
    graph.add_conditional_edges(
        "plan",
        route_to_agents,
        {
            "resume":    "resume_agent",
            "project":   "project_agent",
            "github":    "github_agent",
            "interview": "interview_agent",
            "career":    "career_agent",
            "multi":     "retrieve",   # multi-agent path
        }
    )

    # All agents converge to synthesize
    for agent in ["resume_agent", "project_agent",
                  "github_agent", "interview_agent",
                  "career_agent", "retrieve"]:
        graph.add_conditional_edges(
            agent,
            check_error_or_continue,
            {
                "continue": "synthesize",
                "error":    "error_handler",
                "retry":    agent   # retry same agent
            }
        )

    graph.add_edge("synthesize", "followups")
    graph.add_edge("followups", END)
    graph.add_edge("error_handler", END)

    return graph.compile(
        checkpointer=RedisCheckpointer()  # persistence
    )
```

---

## 5. RAG Pipeline — Complete

```python
# rag/pipeline.py

class RAGPipeline:
    """
    Full retrieval-augmented generation pipeline.
    """

    # ── INGESTION (offline) ──────────────────────

    async def ingest(self, document: Document):

        # Step 1 — Load
        text = await self.loader.load(document)

        # Step 2 — Chunk (semantic)
        chunks = self.chunker.chunk(
            text=text,
            strategy="semantic",    # not fixed-size
            chunk_size=500,
            overlap=50,
            separators=["\n\n", "\n", ". "]
        )

        # Step 3 — Deduplicate
        unique_chunks = self.deduplicator.filter(chunks)

        # Step 4 — Embed (batch)
        embeddings = await self.embedder.embed_batch(
            texts=[c.text for c in unique_chunks],
            model="text-embedding-ada-002",
            batch_size=100
        )

        # Step 5 — Store in Qdrant
        await self.qdrant.upsert(
            collection="portfolio",
            points=[
                {
                    "id":     chunk.id,      # sha256 hash
                    "vector": embedding,
                    "payload": {
                        "text":     chunk.text,
                        "source":   document.source,
                        "section":  chunk.section,
                        "metadata": chunk.metadata
                    }
                }
                for chunk, embedding in
                zip(unique_chunks, embeddings)
            ]
        )

    # ── RETRIEVAL (online) ───────────────────────

    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        filter: dict = None
    ) -> list[Chunk]:

        # Step 1 — Embed query
        query_embedding = await self.embedder.embed(query)

        # Step 2 — Semantic search
        results = await self.qdrant.search(
            collection="portfolio",
            query_vector=query_embedding,
            limit=top_k,
            query_filter=filter
        )

        # Step 3 — Rerank (cross-encoder)
        reranked = await self.reranker.rerank(
            query=query,
            documents=results,
            top_n=4   # keep best 4 after reranking
        )

        return reranked

    # ── GENERATION ───────────────────────────────

    async def generate(
        self,
        query: str,
        chunks: list[Chunk],
        history: list[Message]
    ) -> GenerationResult:

        context = self.build_context(chunks)

        prompt = f"""You are Ravinder's AI assistant.
Answer questions about Ravinder using ONLY the
context provided. If information isn't in the
context, say so clearly. Always cite your sources.

Context:
{context}

Chat history:
{format_history(history)}

Question: {query}

Rules:
- Be specific and use exact details from context
- Cite source for each claim [source: X]
- If asked about skills, give evidence from projects
- Never make up information
"""
        response = await self.llm.generate(
            prompt=prompt,
            stream=True,           # SSE streaming
            temperature=0.1,       # factual, not creative
            max_tokens=1000
        )

        return GenerationResult(
            content=response,
            chunks_used=chunks,
            prompt_tokens=count_tokens(prompt)
        )
```

---

## 6. MCP Server Architecture

```python
# mcp/base_server.py
from mcp.server import Server
from mcp.types import Tool, TextContent

class BaseMCPServer:
    """
    Base class for all MCP servers.
    All servers inherit from this.
    """

    def __init__(self, name: str):
        self.server = Server(name)
        self.register_tools()

    def register_tools(self):
        raise NotImplementedError

    async def validate_input(
        self,
        tool_name: str,
        inputs: dict
    ) -> dict:
        """Input validation before ANY tool execution"""
        schema = self.get_schema(tool_name)
        validated = schema.validate(inputs)
        self.check_injection(validated)  # security
        return validated

    def check_injection(self, inputs: dict):
        """Prevent prompt injection via tool inputs"""
        dangerous = [
            "ignore previous",
            "system prompt",
            "forget your instructions"
        ]
        for val in str(inputs).lower().split():
            if any(d in val for d in dangerous):
                raise SecurityError("Injection attempt detected")

    async def log_tool_call(
        self,
        tool_name: str,
        inputs: dict,
        result: dict,
        latency_ms: int
    ):
        """Audit log every single tool call"""
        await self.audit_logger.log({
            "tool":       tool_name,
            "inputs":     inputs,
            "result":     result,
            "latency_ms": latency_ms,
            "timestamp":  utcnow()
        })


# mcp/resume_mcp.py
class ResumeMCPServer(BaseMCPServer):

    def register_tools(self):

        @self.server.tool()
        async def get_skills(category: str = None):
            """
            Returns Ravinder's technical skills by category.
            Use when asked about skills, technologies, or
            what Ravinder knows. Category can be: ai_llm,
            backend, frontend, cloud, databases, or None
            for all skills.
            """
            skills = await self.db.get_skills(
                category=category
            )
            return TextContent(
                type="text",
                text=format_skills(skills)
            )

        @self.server.tool()
        async def get_experience(company: str = None):
            """
            Returns work history with role, company,
            duration, and key achievements with metrics.
            Use when asked about work history, companies,
            or career progression.
            """
            experience = await self.db.get_experience(
                company=company
            )
            return TextContent(
                type="text",
                text=format_experience(experience)
            )

        @self.server.tool()
        async def match_with_jd(job_description: str):
            """
            Compares Ravinder's profile against a job
            description. Returns match score (0-100),
            matching strengths, and skill gaps.
            Use ONLY when recruiter explicitly provides
            a job description for matching.
            """
            profile = await self.db.get_full_profile()
            analysis = await self.llm.analyze_match(
                profile=profile,
                jd=job_description
            )
            return TextContent(
                type="text",
                text=format_match_result(analysis)
            )
```

---

## 7. Streaming Architecture (SSE)

```python
# api/routes/chat.py
from fastapi import Request
from fastapi.responses import StreamingResponse
import asyncio, json

@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    req: Request
):
    """
    SSE endpoint — streams tokens as they generate.
    Client receives: data: {token} \n\n
    """

    async def event_generator():
        try:
            # Start agent run
            agent = build_agent_graph()

            async for event in agent.astream_events(
                input={
                    "session_id":  request.session_id,
                    "user_message": request.message,
                    "chat_history": await get_history(
                        request.session_id
                    )
                },
                config={"recursion_limit": 10}
            ):

                event_type = event["event"]

                # Stream LLM tokens
                if event_type == "on_chat_model_stream":
                    token = event["data"]["chunk"].content
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

                # Stream tool calls (transparency)
                elif event_type == "on_tool_start":
                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': event['name']})}\n\n"

                # Stream citations
                elif event_type == "on_chain_end":
                    if "citations" in event["data"].get("output", {}):
                        yield f"data: {json.dumps({'type': 'citations', 'data': event['data']['output']['citations']})}\n\n"

                # Stream follow-up questions
                elif event_type == "on_chain_end":
                    if "follow_ups" in event["data"].get("output", {}):
                        yield f"data: {json.dumps({'type': 'follow_ups', 'data': event['data']['output']['follow_ups']})}\n\n"

            # Signal completion
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
```

```typescript
// frontend/lib/streaming.ts
export async function streamChat(
  message: string,
  sessionId: string,
  onToken: (token: string) => void,
  onCitations: (citations: Citation[]) => void,
  onFollowUps: (questions: string[]) => void,
  onDone: () => void,
) {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      const event = JSON.parse(line.slice(6));

      switch (event.type) {
        case "token":
          onToken(event.content);
          break;
        case "citations":
          onCitations(event.data);
          break;
        case "follow_ups":
          onFollowUps(event.data);
          break;
        case "done":
          onDone();
          break;
      }
    }
  }
}
```

---

## 8. Observability — Complete

### 8.1 LangSmith Tracing

```python
# observability/langsmith.py
from langsmith import traceable
from langsmith.wrappers import wrap_openai

# Wrap OpenAI client — auto-traces all LLM calls
openai_client = wrap_openai(openai.AsyncOpenAI())

# Trace any function
@traceable(name="rag_retrieval", tags=["rag", "retrieval"])
async def retrieve_chunks(query: str) -> list[Chunk]:
    # Every call logged: query, results, latency
    ...

@traceable(name="supervisor_plan", tags=["planning"])
async def create_plan(message: str) -> ExecutionPlan:
    # Logs intent classification and plan
    ...

# What LangSmith captures automatically:
# - Input/output of every traced function
# - LLM prompt and completion
# - Token usage and cost
# - Latency at each step
# - Errors and exceptions
# - Full execution tree
```

### 8.2 OpenTelemetry Traces

```python
# observability/otel.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter \
    import OTLPSpanExporter

tracer = trace.get_tracer("ravinder.portfolio")

async def traced_agent_run(message: str, session_id: str):

    with tracer.start_as_current_span("agent.run") as span:
        span.set_attribute("session.id",    session_id)
        span.set_attribute("message.length", len(message))

        with tracer.start_as_current_span("rag.retrieve"):
            chunks = await retrieve(message)
            span.set_attribute("chunks.count", len(chunks))

        with tracer.start_as_current_span("llm.generate"):
            response = await generate(message, chunks)
            span.set_attribute("tokens.used", response.tokens)

        return response
```

### 8.3 Metrics Dashboard

```python
# observability/metrics.py
from prometheus_client import Counter, Histogram, Gauge

# Request metrics
REQUESTS_TOTAL = Counter(
    'chat_requests_total',
    'Total chat requests',
    ['intent', 'agent']
)

RESPONSE_LATENCY = Histogram(
    'response_latency_seconds',
    'End-to-end response latency',
    buckets=[0.5, 1.0, 2.0, 3.0, 5.0, 10.0]
)

TOKEN_USAGE = Counter(
    'llm_tokens_total',
    'Total LLM tokens consumed',
    ['model', 'type']  # type: input | output
)

ACTIVE_SESSIONS = Gauge(
    'active_sessions',
    'Currently active chat sessions'
)

RAG_RETRIEVAL_SCORE = Histogram(
    'rag_retrieval_score',
    'Top chunk similarity scores',
    buckets=[0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

# Usage in code
@RESPONSE_LATENCY.time()
async def handle_chat(request):
    REQUESTS_TOTAL.labels(
        intent=request.intent,
        agent=request.agent
    ).inc()
    ...
```

### 8.4 RAGAS Evaluation

```python
# observability/evaluation.py
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_recall,
    context_precision
)

async def evaluate_response(
    question: str,
    answer: str,
    contexts: list[str],
    ground_truth: str = None
) -> EvaluationResult:
    """
    Run RAGAS evaluation on every response.
    Store scores in PostgreSQL for tracking.
    """

    dataset = {
        "question":  [question],
        "answer":    [answer],
        "contexts":  [contexts],
        "ground_truths": [ground_truth] if ground_truth else None
    }

    result = evaluate(
        dataset=Dataset.from_dict(dataset),
        metrics=[
            faithfulness,        # answer grounded in context?
            answer_relevancy,    # answer relevant to question?
            context_precision,   # retrieved right chunks?
            context_recall       # missed any important chunks?
        ]
    )

    # Store for tracking over time
    await db.store_eval_result({
        "question":          question,
        "faithfulness":      result["faithfulness"],
        "answer_relevancy":  result["answer_relevancy"],
        "context_precision": result["context_precision"],
        "context_recall":    result["context_recall"],
        "timestamp":         utcnow()
    })

    return result
```

---

## 9. Memory Architecture

```python
# memory/session.py
import redis.asyncio as redis
import json

class SessionMemory:
    """
    Short-term memory per conversation.
    Stored in Redis with 2hr TTL.
    """

    async def get_history(
        self,
        session_id: str
    ) -> list[Message]:
        data = await self.redis.get(
            f"session:{session_id}:history"
        )
        return json.loads(data) if data else []

    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str
    ):
        history = await self.get_history(session_id)
        history.append({
            "role":    role,
            "content": content,
            "ts":      utcnow().isoformat()
        })

        # Keep last 20 messages (sliding window)
        history = history[-20:]

        await self.redis.setex(
            name=f"session:{session_id}:history",
            time=7200,   # 2 hours TTL
            value=json.dumps(history)
        )


# memory/checkpointer.py
class RedisCheckpointer:
    """
    LangGraph checkpointing.
    Saves agent state between steps.
    Enables resuming interrupted conversations.
    """

    async def put(
        self,
        config: dict,
        checkpoint: dict
    ):
        key = f"checkpoint:{config['session_id']}"
        await self.redis.setex(
            name=key,
            time=3600,
            value=json.dumps(checkpoint)
        )

    async def get(self, config: dict) -> dict | None:
        key = f"checkpoint:{config['session_id']}"
        data = await self.redis.get(key)
        return json.loads(data) if data else None
```

---

## 10. Tradeoffs — Every Decision Explained

### 10.1 LangGraph vs LangChain

| Aspect              | LangGraph                | LangChain          |
| ------------------- | ------------------------ | ------------------ |
| Execution           | Graph-based (any order)  | Linear chains      |
| State               | Full TypedDict state     | Limited            |
| Debugging           | Visual graph + LangSmith | Hard to trace      |
| Conditional routing | Native                   | Manual workarounds |
| Multi-agent         | First-class              | Plugin-based       |
| Learning curve      | Higher                   | Lower              |
| **Winner**          | **LangGraph**            | -                  |

**Decision: LangGraph**
Reason: Complex multi-agent orchestration with
conditional routing needs graph structure.
LangChain chains break when agents need to
communicate, share state, or route conditionally.

---

### 10.2 SSE vs WebSockets

| Aspect          | SSE                  | WebSockets           |
| --------------- | -------------------- | -------------------- |
| Direction       | Server → Client only | Bidirectional        |
| Complexity      | Simple HTTP          | Complex protocol     |
| Reconnect       | Auto built-in        | Manual               |
| Next.js support | Native               | Extra setup          |
| Proxy support   | Works everywhere     | Some proxies block   |
| Use case        | LLM streaming        | Real-time chat games |
| **Winner**      | **SSE**              | -                    |

**Decision: SSE**
Reason: LLM streaming is one direction only
(server → client). SSE is simpler, has auto-reconnect,
and works with Next.js API routes natively.

---

### 10.3 Qdrant vs Pinecone vs ChromaDB

| Aspect      | Qdrant             | Pinecone  | ChromaDB |
| ----------- | ------------------ | --------- | -------- |
| Cost        | Free (self-hosted) | Paid      | Free     |
| Scale       | 100M+ vectors      | Unlimited | ~10M     |
| Performance | Excellent          | Excellent | Good     |
| Filtering   | Advanced           | Good      | Basic    |
| Hosting     | Docker/Cloud       | SaaS only | Docker   |
| Control     | Full               | Limited   | Full     |
| **Winner**  | **Qdrant**         | -         | -        |

**Decision: Qdrant**
Reason: Free, high performance, advanced filtering,
can run locally in Docker and in AWS ECS in production.
Pinecone costs money and locks you in. ChromaDB lacks
advanced filtering and production-grade performance.

---

### 10.4 FastAPI vs Node.js Backend

| Aspect           | FastAPI (Python)   | Node.js       |
| ---------------- | ------------------ | ------------- |
| LLM libraries    | Native (LangChain) | Wrappers      |
| LangGraph        | Native             | Not available |
| Performance      | Async, excellent   | Excellent     |
| Type safety      | Pydantic           | TypeScript    |
| AI ecosystem     | Best in class      | Limited       |
| Team familiarity | High               | High          |
| **Winner**       | **FastAPI**        | -             |

**Decision: FastAPI**
Reason: Python's AI ecosystem (LangGraph, LangChain,
RAGAS, transformers) is far superior. FastAPI matches
Node.js performance with async/await. No good LangGraph
equivalent exists in Node.js.

---

### 10.5 Redis vs PostgreSQL for Sessions

| Aspect      | Redis          | PostgreSQL        |
| ----------- | -------------- | ----------------- |
| Speed       | ~1ms           | ~5-10ms           |
| TTL support | Native         | Manual cleanup    |
| Persistence | Optional       | Always            |
| Query power | Key-value only | Full SQL          |
| Use for     | Sessions/cache | History/analytics |

**Decision: Both**
Redis for active sessions (speed, TTL).
PostgreSQL for permanent chat history (queryable).

---

### 10.6 Semantic vs Fixed-Size Chunking

| Aspect             | Semantic          | Fixed-Size        |
| ------------------ | ----------------- | ----------------- |
| Quality            | High              | Medium            |
| Speed              | Slower            | Fast              |
| Context            | Preserves meaning | May cut sentences |
| Implementation     | Complex           | Simple            |
| Retrieval accuracy | 30-40% better     | Baseline          |

**Decision: Semantic chunking**
Reason: The whole point of RAG is accuracy.
Fixed-size chunking breaks semantic units mid-sentence.
Semantic chunking preserves meaning at cost of
slightly more processing time during ingestion.

---

### 10.7 Planner–Executor vs Single Agent

| Aspect           | Planner–Executor           | Single Agent     |
| ---------------- | -------------------------- | ---------------- |
| Complexity       | Higher                     | Lower            |
| Debuggability    | High (each agent isolated) | Low              |
| Specialization   | Each agent focused         | General          |
| Parallelism      | Possible                   | Sequential       |
| Testing          | Unit-testable              | Integration only |
| Failure handling | Per-agent                  | All-or-nothing   |

**Decision: Planner–Executor**
Reason: At production scale with 5 different domains
(resume, projects, github, interview, career),
a single monolithic agent would be slow, hard to debug,
and impossible to optimize per domain.

---

## 11. Error Handling Strategy

```python
# Error types and handling
class ErrorStrategy:

    # Transient errors (network, API timeout)
    # → Retry with exponential backoff
    TRANSIENT = [
        "ConnectionError",
        "TimeoutError",
        "RateLimitError"
    ]

    # Permanent errors (bad input, not found)
    # → Fail fast, inform user gracefully
    PERMANENT = [
        "ValidationError",
        "NotFoundError",
        "AuthError"
    ]

    # Partial errors (one agent fails)
    # → Continue with other agents, note gap
    PARTIAL = [
        "AgentError",
        "ToolError",
        "MCPError"
    ]

async def safe_agent_run(
    agent_fn,
    *args,
    max_retries: int = 3
):
    for attempt in range(max_retries):
        try:
            return await agent_fn(*args)

        except TransientError as e:
            if attempt == max_retries - 1:
                return AgentResult(
                    error=str(e),
                    fallback="I couldn't retrieve that info right now. "
                             "Please try again in a moment."
                )
            await asyncio.sleep(2 ** attempt)  # backoff

        except PermanentError as e:
            return AgentResult(
                error=str(e),
                fallback="I don't have information about that."
            )

        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return AgentResult(
                error=str(e),
                fallback="Something unexpected happened. "
                         "The error has been logged."
            )
```

---

## 12. Security Architecture

```
Public endpoints:
POST /chat/stream   → Rate limited (10/min per IP)
GET  /health        → No limits

Admin endpoints (JWT protected):
POST /admin/upload  → Only Ravinder
GET  /admin/sessions
DELETE /admin/chunk

Rate limiting:
→ AWS API Gateway: 10 req/min per IP
→ Per session: 50 messages/hour
→ Per IP daily: 200 messages

Data privacy:
→ IP addresses: SHA256 hashed before storage
→ No PII collected
→ Sessions expire: 2 hours
→ Audit logs: 30-day retention

Input security:
→ Schema validation on all tool inputs
→ Prompt injection detection
→ Max message length: 2000 chars
→ Content moderation on inputs

Infrastructure:
→ OIDC-based IAM (no stored AWS keys)
→ Secrets in AWS Secrets Manager
→ VPC for all internal services
→ HTTPS only (TLS 1.3)
```

---

## 13. Build Order (File by File)

```
Phase 1 — Foundation (Week 1)
├── docker-compose.yml          ← start here
├── backend/main.py             ← FastAPI entry
├── backend/config.py           ← settings
├── backend/db/qdrant.py        ← vector DB client
├── backend/db/redis.py         ← session client
├── backend/db/postgres.py      ← history client
└── backend/api/routes/health.py ← /health endpoint

Phase 2 — RAG (Week 1-2)
├── backend/rag/chunker.py      ← semantic chunking
├── backend/rag/embedder.py     ← OpenAI embeddings
├── backend/rag/retriever.py    ← Qdrant search
├── backend/rag/reranker.py     ← cross-encoder rerank
├── backend/rag/pipeline.py     ← orchestrate above
└── backend/ingestion/pipeline.py ← ingest documents

Phase 3 — Agents (Week 2-3)
├── backend/agents/runtime.py    ← LangGraph graph
├── backend/agents/supervisor.py ← planner
├── backend/agents/resume_agent.py
├── backend/agents/project_agent.py
├── backend/agents/github_agent.py
├── backend/agents/interview_agent.py
└── backend/agents/career_agent.py

Phase 4 — MCP (Week 3)
├── backend/mcp/server.py        ← base server
├── backend/mcp/resume_mcp.py
├── backend/mcp/project_mcp.py
├── backend/mcp/github_mcp.py
├── backend/mcp/interview_mcp.py
└── backend/mcp/career_mcp.py

Phase 5 — Memory (Week 3)
├── backend/memory/session.py    ← Redis sessions
└── backend/memory/checkpointer.py ← LangGraph state

Phase 6 — Streaming API (Week 3-4)
└── backend/api/routes/chat.py   ← SSE endpoint

Phase 7 — Observability (Week 4)
├── backend/observability/langsmith.py
├── backend/observability/otel.py
├── backend/observability/metrics.py
└── backend/observability/evaluation.py

Phase 8 — Frontend (Week 4-5)
├── frontend/app/page.tsx         ← landing page
├── frontend/components/landing/Hero.tsx
├── frontend/components/chat/ChatWindow.tsx
├── frontend/components/chat/StreamingText.tsx
└── frontend/lib/streaming.ts     ← SSE client

Phase 9 — Admin (Week 5)
├── frontend/app/admin/page.tsx
├── frontend/components/admin/FileUpload.tsx
└── backend/api/routes/admin.py

Phase 10 — Infrastructure (Week 6)
├── infrastructure/docker/Dockerfile.backend
├── infrastructure/docker/Dockerfile.frontend
├── infrastructure/aws/cloudformation/ecs.yml
└── infrastructure/github-actions/deploy.yml
```

---

_This document is the single source of truth for
the Ravinder AI Career Platform architecture._
_Every file in the codebase maps to a section here._

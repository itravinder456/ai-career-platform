# Clarifying Questions — Plan

**Status:** proposed, not implemented. This document is for review before any code changes.

## Not the same thing as the existing "follow-up chips"

The frontend already has something called "follow-up" — `FollowUpChips.tsx` +
`lib/questions.ts`'s `pickFollowUps()`, the static suggestion chips shown *after* a
completed answer ("What was the hardest technical challenge?", etc.), picked from a
fixed pool, unrelated to what was actually asked, rendered inline in the message list.
**This is a different feature, both in when it triggers and how it looks.** What's being
designed here is the model itself recognizing, *before* answering, that the question is
too open-ended to answer well, and asking a short clarifying question with concrete
selectable options *instead of* guessing — and it's presented as a distinct prompt card
anchored to the input area (see §7), not as inline pill chips. Naming reflects the
user's own framing of it ("selectable agent prompt"), not "follow-up," to keep the two
unambiguous in the codebase: component `AgentPromptModal`, SSE event type `"prompt"`.

## Context

Some recruiter questions are genuinely too vague to answer well as asked — "tell me
about your experience" could mean technical experience, leadership, a specific company,
years of tenure, or something else entirely. Answering broadly risks a generic,
padded-feeling response; picking one interpretation risks answering the wrong thing.
The better move, same as a human would, is a short clarifying question with a few
concrete options to pick from.

**The constraint that shapes this whole design**: no new LLM call. `plan_tasks`
(`app/graphs/career.py`) already makes exactly one LLM call per turn to decide how to
break the question down — the idea is to let that *same* call also decide "actually,
this needs clarification" as an alternative output, rather than adding a dedicated
"should I ask a clarifying question?" node making its own separate call. Concretely
validated this session: a single LangGraph conditional-edge routing function can return
either `END` directly *or* a `list[Send]` for the normal fan-out — tested against a real
compiled graph, not assumed — so `plan_tasks` can decide the fork and the graph can act
on it with zero new nodes.

## Design

### 1. `plan_tasks`'s output becomes dual-mode

Currently `PLAN_SYSTEM_PROMPT` (`app/prompts/career.py`) always asks for a bare JSON
array of tasks, parsed by `parse_plan`. Change the expected shape to a JSON *object*
with a discriminating `"action"` field:

```json
{"action": "answer", "tasks": [{"intent": "...", "query": "..."}, ...]}
```
or
```json
{"action": "needs_clarification", "question": "...", "options": ["...", "...", "..."]}
```

New prompt guidance (calibration matters a lot here — over-triggering this reads as
evasive, not helpful):

> Use "needs_clarification" **rarely** — only when the question is genuinely too open-ended to give
> a good answer, not just because it's broad. "Tell me about yourself" is NOT ambiguous
> (it has an obvious, natural answer). "Tell me about your experience" with nothing else
> to go on genuinely could mean several different things. When in doubt, answer
> directly — a clarifying question that wasn't needed is worse than a broad-but-useful
> answer.

`parse_plan` becomes `parse_plan_response(text, fallback_query) -> tuple[list[Task],
Clarification | None]` — exactly one of the two is populated. Fails open the same way
`parse_plan` already does: any parse error, missing/invalid `action`, empty `question`,
or an `options` list that doesn't validate → the existing safe fallback (`[{"intent":
"general", "query": fallback_query}]`, no clarification). **Clarification only ever
happens on a clear, well-formed model decision — never as an error fallback.** Getting
a malformed response and defaulting to "ask a question" would be a real UX regression
(the model already fails toward "just answer generally" today; that should stay true).
Cap `options` at 4 (`MAX_CLARIFICATION_OPTIONS`, mirroring `MAX_TASKS`/the widget cap).

### 2. New `AgentState` field

```python
class Clarification(TypedDict):
    question: str
    options: list[str]

class AgentState(TypedDict):
    ...
    clarification_agent_prompt: Clarification | None
```

### 3. `plan_tasks` and the routing function

```python
async def plan_tasks(state: AgentState) -> dict:
    emit_step("plan")
    llm = build_llm(get_settings())
    ai_message = await llm.ainvoke([...])
    tasks, clarification_agent_prompt = parse_plan_response(str(ai_message.content), state["user_input"])

    if clarification_agent_prompt is not None:
        emit_agent_prompt(clarification_agent_prompt["question"], clarification_agent_prompt["options"])
        log.info("plan.needs_clarification", options_count=len(clarification_agent_prompt["options"]))
        return {
            "tasks": [],
            "clarification_agent_prompt": clarification_agent_prompt,
            # A clean, customer-facing AIMessage — NOT the raw JSON planning output —
            # so the checkpointer's history stays readable and the NEXT plan_tasks call
            # (once the user picks an option) actually remembers what it just asked.
            "messages": [AIMessage(content=clarification_agent_prompt["question"])],
            "response": clarification_agent_prompt["question"],
            "widgets": [],
        }

    if not tasks:
        tasks = [{"intent": "general", "query": state["user_input"]}]
    return {"tasks": tasks, "clarification_agent_prompt": None}


def route_after_planning(state: AgentState) -> list[Send] | str:
    if state.get("clarification_agent_prompt"):
        return END
    return [Send("execute_task", {"task": task}) for task in state["tasks"]]
```

`build_career_graph` swaps `fan_out_tasks` for `route_after_planning` in the
`add_conditional_edges("plan_tasks", ...)` call, path map extended with `END`. No new
node — `execute_task` and `respond` are simply never reached on a clarify turn, so
**retrieval and the final answer LLM call are both skipped too**, not just avoided as a
separate node. A clarification turn is cheaper than a normal one, not more expensive.

### 4. New streaming primitive: `emit_agent_prompt`

`app/streaming.py` already has `emit_step()` — a thin wrapper over LangGraph's
`get_stream_writer()` pushing a custom event that `app/api/v1/run.py` forwards verbatim
(`if mode == "custom": yield _sse(payload)`). Add a sibling:

```python
def emit_agent_prompt(question: str, options: list[str]) -> None:
    writer = get_stream_writer()
    if writer is None:
        return
    writer({"type": "prompt", "question": question, "options": options})
```

Unlike a `widget` event (which only ever decorates text that's *also* streaming
separately via `token` events), this one carries `question` directly — the UI needs the
question text available immediately as the modal's header (see §7), not assembled
token-by-token, and `plan_tasks` isn't calling `.astream()` in the first place (see §5),
so there's no separate token stream to source it from anyway.

### 5. The question still appears in the chat transcript too

`plan_tasks` calls `llm.ainvoke()` (non-streaming), not `.astream()` — there's no
natural token-by-token stream for it today, unlike `respond()`. The question text is
still pushed through the normal `token` event as one shot right after `emit_agent_prompt`
(`writer({"type": "token", "content": clarification["question"]})`, via the same
"custom" channel `run.py` already forwards verbatim) so it lands in the assistant's
message bubble exactly like any other answer, and stays there permanently in scrollback.
The prompt modal (§7) is the *active* surface for picking an option while this is the
latest turn; the chat bubble is the durable record that the question was asked, same as
any other reply.

### 6. `services/api`'s SSE proxy — a real gap, not optional

`services/api/app/api/v1/chat.py`'s `_stream()` relays runtime's raw SSE events through
an `if/elif` chain (`step` / `token` / `widget` / `done` / `error`) with **no `else`
branch** — any event type not explicitly handled is silently dropped. A `prompt` event
would never reach the frontend without adding a case here. Needs:

- New schema in `services/api/app/schemas/chat.py`:
  ```python
  class SSEAgentPrompt(AppModel):
      type: Literal["prompt"] = "prompt"
      question: str
      options: list[str]
  ```
- New `elif event_type == "prompt": yield SSEAgentPrompt(question=event.get("question", ""), options=event.get("options", [])).model_dump_json()` in `chat.py`'s `_stream`.

### 7. Frontend — a prompt card anchored to the input, not inline chips

Explicitly **not** `FollowUpChips`' pattern (small pill buttons wrapped inline after a
message). This renders like the `AskUserQuestion` UI in this very conversation: a
card with the question as a header and the options as a vertically-stacked selectable
list, anchored to the input area — appearing to rise up from where the user types, sitting
*above* `InputBar` in `ChatWindow.tsx`'s fixed-bottom `{/* Input */}` block (not inside
the scrollable message list). The normal text input stays fully usable alongside it —
picking an option is a shortcut, not the only way to respond; typing a custom reply
instead works exactly like it always has, with no dedicated "other" affordance needed in
the card itself.

- `frontend/src/types/chat.ts` — add `clarificationAgentPrompt?: { question: string; options: string[] }`
  to `Message` (kept as one object, not two separate optional fields, since they only
  ever exist together).
- `frontend/src/services/chat.ts` — add `onAgentPrompt: (question: string, options: string[]) => void`
  to `StreamCallbacks`, new `case "prompt":` in the SSE switch.
- `frontend/src/components/chat/ChatWindow.tsx`'s `send()` — mirror the existing
  `collectedWidgets` pattern: a local variable captured from `onAgentPrompt`, attached to
  the message in `onDone` (`clarificationAgentPrompt: capturedPrompt`).
- New `frontend/src/components/chat/AgentPromptModal.tsx` — question as a header, options
  as a vertical list of full-width selectable rows (not wrapped pill chips). Rendered in
  `ChatWindow.tsx` just above `<InputBar>`, only when the *latest* message is an assistant
  message with `clarificationAgentPrompt` set and the turn isn't `isStreaming` — i.e. it reflects
  whatever the most recent turn asked, and stops rendering the moment a new message is
  sent (a fresh `send()` call naturally supersedes "latest message"). `onPick(option)`
  behavior: identical effect to `FollowUpChips`' `onPick` — call `send(option)` — picking
  an option is just a normal next user message, no special backend handling needed, since
  the checkpointer already has the clarifying question in history from this turn.
- `ChatWindow.tsx`'s generic `showFollowUps`/`pickFollowUps()` suggestions (the *other*
  feature) should be suppressed whenever `AgentPromptModal` is showing — a generic FAQ
  chip row appearing at the same time as "please pick one of these options" would be
  actively confusing about which ones actually relate to what was just asked.

## Interaction with existing features

- **Response cache (Tier 2, `app/core/response_cache.py`)** — untouched, no interaction.
  `needs_clarification` short-circuits inside `plan_tasks`, before the code path that would ever
  call `set_cached_turn` even runs. A clarifying question is deliberately never cached —
  it's meta-conversation, not a reusable answer.
- **Retrieval cache (Tier 1)** — also untouched; retrieval never runs on a clarify turn
  at all (see §3), so there's nothing to cache either way.
- **`_is_cacheable_query`'s word-count gate** — no interaction with this design; that
  gate is about whether a *question* gets a cached *answer*, unrelated to whether the
  question itself needs clarifying first.

## Known limitations (deliberately out of scope)

- **All-or-nothing per message, not per sub-task.** If a compound question mixes a clear
  part and a vague part ("what's your tech stack, and tell me about your experience"),
  the model can't currently ask for clarification on just the vague half while answering
  the clear half — `plan_tasks` decides `answer` or `clarify` for the whole message.
  Supporting partial clarification would need real additional design (a task-level
  clarify flag, then still fanning out the clear tasks while surfacing a clarifying
  question for the ambiguous one) — real complexity, not attempted here.
- **No "clarification loop" handling.** If the user's picked option (or their own typed
  reply) is *still* ambiguous, the model can ask again — nothing prevents that — but
  there's no explicit UI treatment for "this is the second clarifying question in a
  row" (no visual distinction, no cap on how many times it can happen back to back).
  Acceptable given `plan_tasks`'s own "use rarely" calibration should make repeats
  uncommon; revisit if it turns out not to be.
- **Prompt calibration is a judgment call, not a measured one.** Like
  `MIN_CACHEABLE_WORDS` in the caching work, the exact wording/examples steering when
  the model reaches for `needs_clarification` will need real usage to tune — expect to
  revisit after seeing actual `plan.needs_clarification` log volume.

## Testing plan (once implemented)

- `parse_plan_response`: valid `answer` shape, valid `needs_clarification` shape,
  malformed JSON (fails open to a general task, no clarification), an `answer` action
  missing `tasks`, a `needs_clarification` action missing `question`/`options`, an
  `options` list over the 4-item cap gets truncated, empty-string options get dropped.
- `plan_tasks`: a `needs_clarification`-shaped LLM reply results in
  `state["clarification_agent_prompt"]` set, `state["tasks"] == []`, and a clean
  `AIMessage(content=question)` (not the raw JSON) appended to `messages`.
- `route_after_planning`: `clarification_agent_prompt` set → routes to `END`; not set →
  returns the expected `list[Send]`, mirroring the existing `fan_out_tasks` tests.
- Integration (same style as `test_career_graph.py`'s existing `Send`/fan-in test):
  a full `build_career_graph(...).ainvoke(...)` run with a `needs_clarification`-shaped
  fake LLM reply confirms `execute_task`/`respond` never ran (no `results` populated) and the final
  state's `response` equals the clarifying question.
- `services/api`: a proxy test asserting a `prompt` event from runtime becomes an
  `SSEAgentPrompt` on the wire (the existing `if/elif` chain has no test coverage today
  per a quick look — worth adding basic coverage for the whole chain while touching it,
  not just the new branch, since it's currently silently-drops-unknown-events by
  construction).
- Frontend: `AgentPromptModal` render/onPick test; `ChatWindow.send()` test confirming
  `agentPrompt` lands on the right message and doesn't fire when `onAgentPrompt` was
  never called; a test confirming it renders above `InputBar` only for the latest
  message and disappears once a new message is sent.
- Manual: ask something genuinely ambiguous ("tell me about your experience"), confirm
  the prompt card appears above the input with the question and options, and picking one
  produces a real, on-topic answer next turn; ask something clear ("what's your tech
  stack"), confirm it answers directly with no clarification triggered.

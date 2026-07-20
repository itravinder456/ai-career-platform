# Product Vision

## What this is

A recruiter or hiring manager lands on the site and, instead of scrolling a static resume,
talks to an AI that actually knows the platform owner's career in depth — projects,
technical decisions, work history, skills — and can answer follow-up questions the way a
knowledgeable colleague would, not a keyword-matched FAQ bot.

The chat isn't a gimmick bolted onto a portfolio; it's the primary interface. The landing
page exists to get someone into a conversation quickly, not to be read top-to-bottom.

## Who it's for

Recruiters and hiring managers doing a first pass — the people who'd otherwise skim a PDF
resume for 30 seconds. The bar this needs to clear: a genuinely useful, specific answer to
"tell me about a time you dealt with X" or "how does this compare to Y," grounded in real
project detail, in less time than reading a resume would take.

## Why an agent, not a static site with a search box

A static portfolio answers exactly the questions it was written to answer, in the order it
was written. Real conversations don't work that way — a recruiter with a specific JD in
hand asks specific, compound, sometimes unpredictable questions ("what's your experience
with distributed systems, and how does that compare to what this JD wants?"). Answering
that well needs something that can decompose the question, go retrieve the relevant
evidence for each part, and synthesize a single coherent answer — not a lookup table.

## Design principles this project holds itself to

- **Answers are grounded, not generated from vibes.** Every substantive claim the agent
  makes about the platform owner's work comes from retrieval over real source documents
  (resume, project write-ups), not the model's own guess. See
  [ARCHITECTURE.md](./ARCHITECTURE.md)'s content model.
- **Ask rather than guess when a question is genuinely ambiguous.** A vague question
  answered broadly reads as padded and generic; guessing the wrong interpretation reads as
  not listening. The better move — same as a human would — is a short clarifying question.
  See [AGENT_PROMPT.md](./AGENT_PROMPT.md) for how this is designed to work without adding
  a separate LLM call.
- **Cheap and fast beats clever when they conflict.** Caching, parallel sub-task
  execution, and picking the smaller/cheaper model where quality allows it all exist
  because a recruiter doing a first pass won't wait 10 seconds or tolerate a slow demo —
  and because this runs on free-tier infrastructure, not a funded backend.
- **Fail open, never break the conversation.** Every infrastructure-touching path
  (retrieval, caching, the profile lookup) degrades to a safe fallback rather than
  surfacing an error to the person chatting — a recruiter should never see a stack trace.
- **Ship one thing at a time, not ahead of need.** Structured admin-editable data exists
  only where it earns its keep (profile/links/stats); anything that's already covered by
  retrieval over real documents doesn't get a redundant structured copy. Tool-calling and
  real sub-agents are deliberately deferred rather than half-built.

## Where this is headed

- **Clarifying questions** (in design — see [AGENT_PROMPT.md](./AGENT_PROMPT.md)):
  the planner recognizes a genuinely ambiguous question and asks for the missing detail
  with selectable options, instead of guessing.
- **Real tool-calling / sub-agents**: today the agent's only "action" is retrieval,
  running automatically ahead of the final answer. A later phase is expected to let the
  agent decide its own actions — e.g. pulling live GitHub activity — rather than
  everything being pre-fetched.
- **A documents registry**: moving source documents out of the git-adjacent `data/`
  folder into a real content-management flow (upload from the admin panel, track what's
  been ingested, detect staleness) — see [ARCHITECTURE.md](./ARCHITECTURE.md)'s content
  model for the specific planned shape.

None of the above is implemented yet — they're the direction, not a promise of what
exists today. What's actually built is documented as fact in
[ARCHITECTURE.md](./ARCHITECTURE.md); this document is scope and intent, not a changelog.

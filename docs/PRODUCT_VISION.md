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
  only where it earns its keep — profile/links/stats, and (since real filtering/ranking
  needs surfaced, see below) projects/experience/skills. It's never a *redundant* second
  copy of the same facts: `services/ingestion` derives Qdrant's RAG index directly from
  these same Postgres rows rather than a separately-authored write-up, so there's nothing
  to drift out of sync. Tool-calling and real sub-agents are deliberately deferred rather
  than half-built.

## Where this is headed

- **Clarifying questions** (in design — see [AGENT_PROMPT.md](./AGENT_PROMPT.md)):
  the planner recognizes a genuinely ambiguous question and asks for the missing detail
  with selectable options, instead of guessing.
- **Real tool-calling / sub-agents**: today the agent's only "action" is retrieval,
  running automatically ahead of the final answer. A later phase is expected to let the
  agent decide its own actions — e.g. pulling live GitHub activity — rather than
  everything being pre-fetched.
- **Resume generation from a JD**: upload a target job description and have the agent
  select/rank the most relevant `projects`/`experiences`/`skills` rows and write a
  tailored resume against a fixed template. This is the reason those three got real
  structured columns instead of staying narrative-only — a resume generator needs to
  filter/rank on `tech_stack`, dates, and impact, not re-parse prose. Retrieval strategy,
  template rendering, and where the flow lives are all still open.
- **Staleness detection for ingestion**: `make ingest` is still a manual, all-or-nothing
  re-embed with no notion of "what actually changed since last time" — a content-hash or
  `updated_at` comparison per row would make it incremental.
- **Production hosting for the resume PDF**: the admin panel can already replace the
  resume (`POST /api/v1/documents/resume/upload`), but it writes to `data/resume/` on
  the `api` container's filesystem, which isn't shared with the `frontend` container
  that actually serves it in production — see [ARCHITECTURE.md](./ARCHITECTURE.md)'s
  content model for the specific gap and the two fixes under consideration.

The documents registry described in earlier drafts of this section — admin-edited
content instead of git-adjacent files, with per-row tracking — is the part that's now
built: `projects`/`experiences`/`skills`/`documents` all live in Postgres, admin-edited,
with `services/ingestion` deriving Qdrant from those rows directly. What's still open is
listed above, not the registry itself.

What's actually built is documented as fact in [ARCHITECTURE.md](./ARCHITECTURE.md);
this document is scope and intent, not a changelog.

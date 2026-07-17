# Frontend

**Role in the flow:** the only piece the recruiter ever touches — renders the landing page, drives the chat UI, and turns the `api` service's SSE stream into typed text + widgets on screen.

## What it does

A single-page Next.js app with two states: a landing `Hero` and a `ChatWindow`. There's no server-side rendering of chat content and no backend-for-frontend layer — the browser talks to `services/api` directly over `fetch`.

## Stack

Next.js 16.2, React 19.2, TailwindCSS v4, Framer Motion. No state management library (component state + `sessionStorage` only) and no SSE/query library (`fetch` + hand-rolled stream parsing).

## Structure

```
frontend/src/
├── app/
│   ├── page.tsx              renders <Hero> or <ChatWindow> based on AppState
│   ├── layout.tsx
│   └── globals.css           CSS vars, dot-grid background, aurora/drift animations
├── components/
│   ├── landing/Hero.tsx, Particles.tsx
│   ├── chat/
│   │   ├── ChatWindow.tsx    orchestrates send(), message state, greeting effect
│   │   ├── MessageBubble.tsx markdown renderer + widget slot
│   │   ├── InputBar.tsx      auto-resize textarea, send on Enter
│   │   └── TypingIndicator.tsx
│   ├── widgets/               one component per WIDGET type (see below)
│   └── ui/Navbar.tsx
├── services/
│   ├── chat.ts                streamChat(), clearSession() — the SSE client
│   └── mockAI.ts
└── types/chat.ts               Message, Widget, AppState
```

## Flow — one chat turn

```
ChatWindow.send(input)
  ├── optimistic-append user message + placeholder AI message to local state
  └── streamChat(sessionId, input, callbacks)
        ├── fetch POST /api/v1/chat  (JSON body: {session_id, message})
        ├── manual SSE parse loop over response.body.getReader()
        │     "data: {...}"  parsed per line, buffered across chunk boundaries
        │     type=token   → onToken(content)     → appended to AI message
        │     type=widget  → onWidget(widget)      → collected, attached on done
        │     type=done    → onDone()               → message marked complete
        │     type=error   → onError(message)       → shown in the AI bubble
        └── MessageBubble renders MarkdownContent + WidgetRenderer(widgets)
```

`WidgetRenderer` dispatches on `widget.type` to `ProjectCard`, `SkillGraph`, `TechStack`, `ResumePreview`, or `ArchitectureCard` — one React component per `WIDGET:<type>:<json>` block the runtime's LLM can emit (see [runtime.md](./runtime.md)).

## Design tradeoffs

| Decision | Alternative considered | Why this way |
|---|---|---|
| Manual `fetch` + `ReadableStream` parsing in `chat.ts` | Native `EventSource` | `EventSource` only supports GET with no request body; the chat call needs to POST `{session_id, message}`. A hand-rolled reader is the standard workaround for POST-based SSE. |
| `sessionStorage["ai_session_id"]` for session identity | Cookie-based session, server-issued ID | Keeps the frontend stateless of auth/cookies; stable across refreshes, naturally cleared when the tab closes — matches the "no login" recruiter-facing use case. |
| Widgets as a typed union rendered by one dispatcher (`WidgetRenderer`) | Let the LLM return raw HTML/JSX-like markup | Keeps rendering fully controlled/sandboxed — the LLM only ever chooses a widget *type* + structured JSON, never arbitrary markup, so there's no injection surface in the chat bubble. |
| No state management library | Redux/Zustand/Context | Single-screen app with one owning component (`ChatWindow`); a library would add ceremony without solving a real cross-component state-sharing problem yet. |
| Client-side markdown parser (`MarkdownContent`) rather than a library like `react-markdown` | `react-markdown` + remark/rehype plugins | Only a small subset of markdown is ever produced (bold, code, lists) since the system prompt constrains LLM output style — a full markdown AST pipeline is more dependency weight than the actual surface area needs. |

## Known gaps

- No automated tests (unit or e2e) for the chat flow yet.
- `README.md` at repo root still says "Next.js 14" / Tailwind unspecified — stale, actual is Next.js 16.2 / Tailwind v4.
- No retry/backoff on a dropped SSE connection — a network blip mid-stream surfaces as `onError` with no auto-reconnect.

## Run & test

```bash
make dev-frontend        # npm run dev, expects services/api on :8000 (NEXT_PUBLIC_API_URL)
```
No test suite exists yet (`npm run lint` only).

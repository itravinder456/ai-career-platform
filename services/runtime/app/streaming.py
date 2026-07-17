"""
Streaming primitives for the SSE layer (api/v1/run.py):

- emit_step(): announce a processing step from inside a graph node, via LangGraph's
  custom stream. Standardized event shape {type:"step", id, label, status} — the same
  envelope a future tool call or sub-agent uses (just a different `id`), so the
  multi-agent work doesn't need a new event type.
- TokenWidgetSplitter: splits a live token stream into user-visible text vs a trailing
  WIDGET block, holding back just enough tail to detect the "WIDGET:" marker before it
  leaks to the client. Pure and stateful — no LangGraph/network deps, unit-tested directly.
"""

from app.prompts.career import parse_widget_block
from core.logging.setup import get_logger

log = get_logger(__name__)

WIDGET_MARKER = "WIDGET:"

# Placeholder step labels — machine `id`s stay stable; reword these freely later.
STEP_LABELS: dict[str, str] = {
    "classify": "Understanding your question",
    "retrieve": "Searching knowledge base",
    "respond": "Composing answer",
    "tool": "Looking up details",
}


def emit_step(step_id: str) -> None:
    """Announce a step from inside a graph node. No-ops safely when there's no active
    streaming run (e.g. unit tests calling nodes directly), so it never raises."""
    try:
        from langgraph.config import get_stream_writer

        writer = get_stream_writer()
    except Exception:
        return
    if writer is None:
        return

    writer(
        {
            "type": "step",
            "id": step_id,
            "label": STEP_LABELS.get(step_id, step_id),
            "status": "running",
        }
    )


def _longest_marker_prefix_suffix(text: str) -> int:
    """Length of the longest suffix of `text` that is a (partial) prefix of WIDGET_MARKER —
    i.e. how many trailing chars we must hold back in case they begin the marker."""
    max_len = min(len(text), len(WIDGET_MARKER) - 1)
    for n in range(max_len, 0, -1):
        if WIDGET_MARKER.startswith(text[-n:]):
            return n
    return 0


class TokenWidgetSplitter:
    """Feed streamed text deltas; get back text that's safe to show now, with any
    trailing `WIDGET:<type>:<json>` block withheld and parsed out at finish()."""

    def __init__(self) -> None:
        self._pending = ""  # safe-text tail not yet flushed (may start the marker)
        self._in_widget = False
        self._widget_raw = ""  # everything after the marker, once seen

    def feed(self, delta: str) -> str:
        if not delta:
            return ""

        if self._in_widget:
            self._widget_raw += delta
            return ""

        self._pending += delta

        marker_idx = self._pending.find(WIDGET_MARKER)
        if marker_idx != -1:
            before = self._pending[:marker_idx]
            self._widget_raw = self._pending[marker_idx + len(WIDGET_MARKER) :]
            self._in_widget = True
            self._pending = ""
            return before

        # No full marker yet — hold back a tail that could be its start.
        hold = _longest_marker_prefix_suffix(self._pending)
        if hold == 0:
            emit = self._pending
            self._pending = ""
            return emit

        emit = self._pending[:-hold]
        self._pending = self._pending[-hold:]
        return emit

    def finish(self) -> tuple[str, dict | None]:
        """Returns (trailing_text_to_emit, widget_or_none)."""
        if self._in_widget:
            _, widgets = parse_widget_block(WIDGET_MARKER + self._widget_raw)
            return "", (widgets[0] if widgets else None)

        trailing = self._pending
        self._pending = ""
        return trailing, None

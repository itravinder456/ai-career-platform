from app.streaming import TokenWidgetSplitter, emit_step


def _feed_all(deltas: list[str]) -> tuple[str, list[dict]]:
    """Run deltas through a splitter, return (all emitted text, widgets)."""
    splitter = TokenWidgetSplitter()
    emitted = "".join(splitter.feed(d) for d in deltas)
    trailing, widgets = splitter.finish()
    return emitted + trailing, widgets


def test_plain_text_streamed_in_small_deltas_is_reassembled():
    full = "Ravinder is a Senior AI Platform Engineer with 6+ years of experience."
    deltas = [full[i : i + 3] for i in range(0, len(full), 3)]

    text, widgets = _feed_all(deltas)

    assert text == full
    assert widgets == []


def test_text_then_widget_in_single_delta():
    text, widgets = _feed_all(
        ['Here are my skills.\nWIDGET:tech_stack:{"categories":[{"label":"AI","items":["RAG"]}]}']
    )

    # Whitespace before the marker streams through as-is (can't un-send it live);
    # harmless in the rendered markdown.
    assert text == "Here are my skills.\n"
    assert widgets == [
        {
            "type": "widget",
            "widget_type": "tech_stack",
            "data": {"categories": [{"label": "AI", "items": ["RAG"]}]},
        }
    ]


def test_widget_marker_split_across_deltas_never_leaks():
    text, widgets = _feed_all(
        ["Answer text. ", "WID", "GET:skill", "_graph:", '{"skills":', '[]}']
    )

    assert "WIDGET" not in text
    assert text == "Answer text. "
    assert widgets == [{"type": "widget", "widget_type": "skill_graph", "data": {"skills": []}}]


def test_widget_like_word_that_is_not_the_marker_is_flushed():
    # "WIDGETS" (no colon) must not be mistaken for the WIDGET: marker.
    text, widgets = _feed_all(["I love WIDG", "ETS and dashboards"])

    assert text == "I love WIDGETS and dashboards"
    assert widgets == []


def test_malformed_widget_json_yields_no_widget_and_no_leak():
    text, widgets = _feed_all(["My answer.\nWIDGET:skill_graph:{not valid json}"])

    assert text == "My answer.\n"
    assert widgets == []


def test_multiple_widgets_across_deltas_all_recovered():
    text, widgets = _feed_all(
        [
            "Two facets. ",
            "WIDGET:tech_stack:",
            '{"categories":[{"label":"AI","items":["RAG"]}]}\n',
            "WIDGET:project_card:",
            '{"name":"Elsa","description":"d","status":"live","tech":[],"impact":[],"github":null}',
        ]
    )

    assert "WIDGET" not in text
    assert text == "Two facets. "
    assert widgets == [
        {
            "type": "widget",
            "widget_type": "tech_stack",
            "data": {"categories": [{"label": "AI", "items": ["RAG"]}]},
        },
        {
            "type": "widget",
            "widget_type": "project_card",
            "data": {
                "name": "Elsa",
                "description": "d",
                "status": "live",
                "tech": [],
                "impact": [],
                "github": None,
            },
        },
    ]


def test_empty_deltas_are_ignored():
    text, widgets = _feed_all(["", "hello", "", " world", ""])

    assert text == "hello world"
    assert widgets == []


def test_emit_step_no_ops_outside_streaming_run():
    # Called directly (no active LangGraph stream) — must not raise.
    emit_step("plan")
    emit_step("unknown_id")

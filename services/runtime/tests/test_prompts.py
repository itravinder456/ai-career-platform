import pytest

from app.prompts.career import INTENT_LABELS, parse_plan, parse_widget_block


def test_parse_plan_single_task():
    tasks = parse_plan(
        '[{"intent": "project", "query": "what have you built"}]', fallback_query="fallback"
    )

    assert tasks == [{"intent": "project", "query": "what have you built"}]


def test_parse_plan_multiple_tasks():
    tasks = parse_plan(
        '[{"intent": "project", "query": "what have you built"}, '
        '{"intent": "skills", "query": "tech stack"}]',
        fallback_query="fallback",
    )

    assert tasks == [
        {"intent": "project", "query": "what have you built"},
        {"intent": "skills", "query": "tech stack"},
    ]


def test_parse_plan_strips_markdown_code_fence():
    tasks = parse_plan(
        '```json\n[{"intent": "skills", "query": "tech stack"}]\n```', fallback_query="fallback"
    )

    assert tasks == [{"intent": "skills", "query": "tech stack"}]


def test_parse_plan_malformed_json_falls_back_to_general():
    tasks = parse_plan("not json at all", fallback_query="the original message")

    assert tasks == [{"intent": "general", "query": "the original message"}]


def test_parse_plan_not_a_list_falls_back_to_general():
    tasks = parse_plan('{"intent": "project", "query": "x"}', fallback_query="the original message")

    assert tasks == [{"intent": "general", "query": "the original message"}]


def test_parse_plan_invalid_intent_falls_back_to_general_for_that_item_only():
    tasks = parse_plan(
        '[{"intent": "not_a_real_intent", "query": "some question"}]',
        fallback_query="fallback",
    )

    assert tasks == [{"intent": "general", "query": "some question"}]


def test_parse_plan_drops_items_missing_a_query():
    tasks = parse_plan(
        '[{"intent": "project", "query": ""}, {"intent": "skills", "query": "tech stack"}]',
        fallback_query="fallback",
    )

    assert tasks == [{"intent": "skills", "query": "tech stack"}]


def test_parse_plan_empty_after_validation_falls_back_to_general():
    tasks = parse_plan('[{"intent": "project", "query": ""}]', fallback_query="the original")

    assert tasks == [{"intent": "general", "query": "the original"}]


def test_parse_plan_collapses_duplicate_intents_keeping_first():
    tasks = parse_plan(
        '[{"intent": "project", "query": "first ask"}, '
        '{"intent": "project", "query": "second ask, same intent"}]',
        fallback_query="fallback",
    )

    assert tasks == [{"intent": "project", "query": "first ask"}]


def test_parse_plan_caps_at_max_tasks():
    # Six distinct intents (one of each) so intent-deduplication doesn't collapse this
    # down on its own — this test is specifically about the MAX_TASKS=4 cap.
    items = ", ".join(f'{{"intent": "{intent}", "query": "q-{intent}"}}' for intent in INTENT_LABELS)
    tasks = parse_plan(f"[{items}]", fallback_query="fallback")

    assert len(tasks) == 4
    assert [t["intent"] for t in tasks] == list(INTENT_LABELS[:4])


@pytest.mark.parametrize("intent", INTENT_LABELS)
def test_parse_plan_accepts_every_valid_intent_label(intent):
    tasks = parse_plan(f'[{{"intent": "{intent}", "query": "some question"}}]', fallback_query="fallback")

    assert tasks == [{"intent": intent, "query": "some question"}]


def test_parse_widget_block_no_marker_returns_text_unchanged():
    text, widgets = parse_widget_block("Just a plain response.")

    assert text == "Just a plain response."
    assert widgets == []


def test_parse_widget_block_parses_valid_widget():
    text, widgets = parse_widget_block(
        'Here are my skills.\nWIDGET:skill_graph:{"skills":[{"name":"Python","level":95}]}'
    )

    assert text == "Here are my skills."
    assert widgets == [
        {
            "type": "widget",
            "widget_type": "skill_graph",
            "data": {"skills": [{"name": "Python", "level": 95}]},
        }
    ]


def test_parse_widget_block_malformed_json_drops_widget_keeps_text():
    text, widgets = parse_widget_block("My answer.\nWIDGET:skill_graph:{not valid json}")

    assert text == "My answer."
    assert widgets == []


def test_parse_widget_block_parses_multiple_widgets():
    text, widgets = parse_widget_block(
        "Two facets.\n"
        'WIDGET:tech_stack:{"categories":[{"label":"AI","items":["RAG"]}]}\n'
        'WIDGET:project_card:{"name":"Elsa","description":"d","status":"live",'
        '"tech":[],"impact":[],"github":null}'
    )

    assert text == "Two facets."
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


def test_parse_widget_block_keeps_earlier_widgets_when_a_later_one_is_malformed():
    text, widgets = parse_widget_block(
        "Two facets.\n"
        'WIDGET:tech_stack:{"categories":[{"label":"AI","items":["RAG"]}]}\n'
        "WIDGET:project_card:{not valid json}"
    )

    assert text == "Two facets."
    assert widgets == [
        {
            "type": "widget",
            "widget_type": "tech_stack",
            "data": {"categories": [{"label": "AI", "items": ["RAG"]}]},
        }
    ]


def test_parse_widget_block_handles_marker_substring_inside_json_string_value():
    text, widgets = parse_widget_block(
        "Answer.\n"
        'WIDGET:project_card:{"name":"Contains WIDGET: literally in a value",'
        '"description":"d","status":"live","tech":[],"impact":[],"github":null}'
    )

    assert text == "Answer."
    assert widgets == [
        {
            "type": "widget",
            "widget_type": "project_card",
            "data": {
                "name": "Contains WIDGET: literally in a value",
                "description": "d",
                "status": "live",
                "tech": [],
                "impact": [],
                "github": None,
            },
        }
    ]

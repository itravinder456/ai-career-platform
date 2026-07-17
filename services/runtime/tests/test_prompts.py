from app.prompts.career import parse_widget_block


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

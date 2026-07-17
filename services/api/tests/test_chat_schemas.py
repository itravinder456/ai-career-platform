from app.schemas.chat import ChatRequest, SSEToken


def test_sse_token_preserves_leading_space():
    # A leading space marks a new word boundary in the streamed token protocol —
    # AppModel's default str_strip_whitespace=True must not apply here (regression
    # test for a bug where every word in streamed answers ran together with no
    # spaces, because every token's leading space was silently stripped).
    assert SSEToken(content=" am").content == " am"


def test_sse_token_preserves_trailing_space():
    assert SSEToken(content="am ").content == "am "


def test_sse_token_preserves_lone_space():
    # The real stream does emit whole tokens that are just a single space — this is
    # the case that fails loudest: str_strip_whitespace would collapse it to "",
    # vanishing entirely rather than just losing formatting.
    assert SSEToken(content=" ").content == " "


def test_sse_token_json_roundtrip_keeps_whitespace():
    assert SSEToken(content=" Rav").model_dump_json() == '{"type":"token","content":" Rav"}'


def test_chat_request_still_strips_whitespace():
    # Confirms the fix is scoped to SSEToken only — AppModel's platform-wide
    # str_strip_whitespace default still applies to ordinary request models.
    assert ChatRequest(session_id="s1", message="  hello  ").message == "hello"

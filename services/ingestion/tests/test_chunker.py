from app.chunker import chunk_documents, chunk_text
from app.loader import Document


def test_chunk_text_splits_on_paragraphs_within_size():
    text = ("This is a sentence about Ravinder's experience. " * 3 + "\n\n") * 4

    chunks = chunk_text(text, chunk_size=200, overlap=20)

    assert len(chunks) > 1
    assert all(chunk.strip() for chunk in chunks)


def test_chunk_text_recurses_into_oversized_pieces():
    # Only one "\n\n" in the whole text (like PDF-extracted resume text often is) —
    # the top-level separator alone would yield 2 giant pieces; each must still get
    # subdivided further by "\n" / ". " rather than being kept whole.
    section_a = ("This is a sentence about Ravinder's experience. " * 10).strip()
    section_b = ("This is a sentence about Ravinder's skills. " * 10).strip()
    text = f"{section_a}\n\n{section_b}"

    chunks = chunk_text(text, chunk_size=200, overlap=20)

    assert len(chunks) > 2
    assert all(len(chunk) <= 200 for chunk in chunks)


def test_chunk_text_keeps_oversized_single_piece_whole():
    huge_sentence = "word " * 300  # a single unsplittable piece under our separators

    chunks = chunk_text(huge_sentence, chunk_size=100, overlap=10, separators=())

    assert chunks == [huge_sentence.strip()]


def test_chunk_documents_deduplicates_identical_chunks():
    duplicate_text = "Ravinder is a Senior AI Platform Engineer."
    documents = [
        Document(text=duplicate_text, source_path="resume/a.md", doc_type="resume", title="A"),
        Document(text=duplicate_text, source_path="resume/b.md", doc_type="resume", title="B"),
    ]

    chunks, total_generated = chunk_documents(documents)

    assert total_generated == 2
    assert len(chunks) == 1


def test_chunk_documents_produces_deterministic_ids():
    documents = [
        Document(text="Same content", source_path="resume/a.md", doc_type="resume", title="A"),
    ]

    chunks_first, _ = chunk_documents(documents)
    chunks_second, _ = chunk_documents(documents)

    assert chunks_first[0].id == chunks_second[0].id

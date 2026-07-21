from unittest.mock import MagicMock

from app.readers.pdf import read_pdf_file


def test_read_pdf_file_joins_page_text(monkeypatch, tmp_path):
    page_one = MagicMock()
    page_one.extract_text.return_value = "Page one text."
    page_two = MagicMock()
    page_two.extract_text.return_value = "Page two text."

    fake_reader = MagicMock()
    fake_reader.pages = [page_one, page_two]
    monkeypatch.setattr("app.readers.pdf.PdfReader", lambda path: fake_reader)

    result = read_pdf_file(tmp_path / "cert.pdf")

    assert result == "Page one text.\n\nPage two text."


def test_read_pdf_file_skips_blank_pages(monkeypatch, tmp_path):
    blank_page = MagicMock()
    blank_page.extract_text.return_value = "   "
    real_page = MagicMock()
    real_page.extract_text.return_value = "Real content."

    fake_reader = MagicMock()
    fake_reader.pages = [blank_page, real_page]
    monkeypatch.setattr("app.readers.pdf.PdfReader", lambda path: fake_reader)

    result = read_pdf_file(tmp_path / "cert.pdf")

    assert result == "Real content."


def test_read_pdf_file_handles_none_extract_text(monkeypatch, tmp_path):
    # pypdf's extract_text() can return None for un-extractable pages (e.g. scanned images)
    unreadable_page = MagicMock()
    unreadable_page.extract_text.return_value = None

    fake_reader = MagicMock()
    fake_reader.pages = [unreadable_page]
    monkeypatch.setattr("app.readers.pdf.PdfReader", lambda path: fake_reader)

    result = read_pdf_file(tmp_path / "scanned.pdf")

    assert result == ""

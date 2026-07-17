from pathlib import Path

from pypdf import PdfReader


def read_pdf_file(path: Path) -> str:
    reader = PdfReader(path)
    pages = (page.extract_text() or "" for page in reader.pages)
    return "\n\n".join(page.strip() for page in pages if page.strip())

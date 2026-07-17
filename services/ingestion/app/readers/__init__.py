"""
Extension -> reader registry. To support a new document type: write a
`read_x_file(path: Path) -> str` function in its own module here, then add one
line to READERS below — nothing in app/loader.py needs to change.
"""

from collections.abc import Callable
from pathlib import Path

from app.readers.pdf import read_pdf_file
from app.readers.text import read_text_file

Reader = Callable[[Path], str]

READERS: dict[str, Reader] = {
    ".md": read_text_file,
    ".txt": read_text_file,
    ".pdf": read_pdf_file,
}


def get_reader(suffix: str) -> Reader | None:
    return READERS.get(suffix.lower())

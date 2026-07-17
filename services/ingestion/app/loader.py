from pathlib import Path

from core.models.base import AppModel

from app.readers import get_reader

# services/ingestion/app/loader.py -> parents[3] is the repo root
DEFAULT_DATA_DIR = Path(__file__).resolve().parents[3] / "data"

DOC_TYPES = ("resume", "projects", "blogs", "certificates")


class Document(AppModel):
    text: str
    source_path: str
    doc_type: str
    title: str


def _title_from_text(text: str, fallback: str) -> str:
    for line in text.splitlines():
        stripped = line.strip().lstrip("#").strip()
        if stripped:
            return stripped
    return fallback


def load_documents(data_dir: Path = DEFAULT_DATA_DIR) -> list[Document]:
    """Walk data/{resume,projects,blogs,certificates} and load every file with a
    registered reader (see app/readers) — unsupported extensions are skipped."""
    documents: list[Document] = []

    for doc_type in DOC_TYPES:
        type_dir = data_dir / doc_type
        if not type_dir.is_dir():
            continue

        for path in sorted(type_dir.iterdir()):
            reader = get_reader(path.suffix)
            if reader is None:
                continue

            text = reader(path).strip()
            if not text:
                continue

            documents.append(
                Document(
                    text=text,
                    source_path=str(path.relative_to(data_dir)),
                    doc_type=doc_type,
                    title=_title_from_text(text, fallback=path.stem),
                )
            )

    return documents

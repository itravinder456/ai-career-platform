from pathlib import Path

from app.loader import load_documents


def test_load_documents_dispatches_by_extension_and_skips_unsupported(tmp_path):
    resume_dir = tmp_path / "resume"
    resume_dir.mkdir()
    (resume_dir / "profile.md").write_text("# Profile\n\nSome text.", encoding="utf-8")
    (resume_dir / "notes.rtf").write_text("unsupported format", encoding="utf-8")

    documents = load_documents(data_dir=tmp_path)

    assert len(documents) == 1
    assert documents[0].source_path == str(Path("resume", "profile.md"))
    assert documents[0].doc_type == "resume"
    assert documents[0].title == "Profile"


def test_load_documents_skips_empty_files(tmp_path):
    certificates_dir = tmp_path / "certificates"
    certificates_dir.mkdir()
    (certificates_dir / "empty.txt").write_text("   ", encoding="utf-8")

    documents = load_documents(data_dir=tmp_path)

    assert documents == []


def test_load_documents_skips_missing_doc_type_dirs(tmp_path):
    documents = load_documents(data_dir=tmp_path)

    assert documents == []


def test_load_documents_falls_back_to_filename_when_no_titleable_line(tmp_path):
    # Content that survives the outer "not text" skip (non-whitespace overall) but
    # whose only line strips to nothing once "#" characters are stripped from it.
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    (projects_dir / "my-project.txt").write_text("####", encoding="utf-8")

    documents = load_documents(data_dir=tmp_path)

    assert documents[0].title == "my-project"

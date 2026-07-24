"""Tests for tools/build_search_index.py — the search index generator."""
import json
from pathlib import Path

import pytest

from build_search_index import build_index


def _project_fixture(tmp_path: Path) -> Path:
    """Minimal project tree: articles/ with registry + two markdown files."""
    articles = tmp_path / "articles"
    articles.mkdir()

    (articles / "first-article.md").write_text(
        "# First Article\n\n"
        "Body paragraph one.\n\n"
        "```sh\nblockcode_token --flag\n```\n\n"
        "Paragraph two with **bold** and `inline_token` kept.\n"
    )
    (articles / "future-article.md").write_text(
        "# Future\n\nNot yet public text.\n"
    )
    (articles / "articles.json").write_text(json.dumps({
        "first-article.md": {
            "title": "First Article", "date": "2026-05-02", "tags": ["test"],
        },
        "future-article.md": {
            "title": "Future", "date": "2099-01-01", "tags": ["test"],
            "unlisted": True,
        },
    }))
    return tmp_path


def test_index_maps_slug_to_plain_text(tmp_path):
    index = build_index(_project_fixture(tmp_path))
    assert set(index) == {"first-article", "future-article"}
    assert "Body paragraph one." in index["first-article"]


def test_markdown_syntax_stripped(tmp_path):
    index = build_index(_project_fixture(tmp_path))
    text = index["first-article"]
    assert "**" not in text
    assert "bold" in text


def test_h1_title_excluded(tmp_path):
    # Server-side parity rule: h1 is the article title, not body text.
    index = build_index(_project_fixture(tmp_path))
    assert "First Article" not in index["first-article"]


def test_block_code_excluded_inline_code_kept(tmp_path):
    index = build_index(_project_fixture(tmp_path))
    text = index["first-article"]
    assert "blockcode_token" not in text
    assert "inline_token" in text


def test_future_and_unlisted_articles_included(tmp_path):
    # Client gates visibility; the index deliberately includes everything.
    index = build_index(_project_fixture(tmp_path))
    assert "Not yet public text." in index["future-article"]


def test_missing_markdown_fails(tmp_path):
    project = _project_fixture(tmp_path)
    (project / "articles" / "first-article.md").unlink()
    with pytest.raises(FileNotFoundError, match="first-article.md"):
        build_index(project)

"""Tests for tools/build_share_pages.py — static per-article pages.

Since the 2026-07 SEO rework these are real content pages (Google indexes
them), not meta-refresh redirect stubs. The tests pin the properties Search
Console complained about: no redirect, self-canonical, and gating via noindex
for future-dated/unlisted articles.
"""
import json
from pathlib import Path

import pytest

from build_share_pages import build_share_pages


def _project_fixture(tmp_path: Path) -> Path:
    articles = tmp_path / "articles"
    articles.mkdir()

    (articles / "first-article.md").write_text(
        "# First Article\n\n"
        "Body paragraph one.\n\n"
        "![diagram](pix/diagram.png)\n\n"
        "![parent-relative](../pix/d2.png)\n\n"
        "A [link](https://example.com/x) stays absolute.\n"
    )
    (articles / "future-article.md").write_text("# Future\n\nNot yet public.\n")
    (articles / "hidden-article.md").write_text("# Hidden\n\nUnlisted body.\n")
    (articles / "articles.json").write_text(json.dumps({
        "first-article.md": {
            "title": "First Article", "date": "2026-05-02", "tags": ["testing"],
            "summary": "A test article.",
            "audio": "audio/first-article.ogg",
            "timings": "audio/first-article.timings.json",
        },
        "future-article.md": {
            "title": "Future", "date": "2099-01-01", "tags": ["testing"],
        },
        "hidden-article.md": {
            "title": "Hidden", "date": "2026-05-02", "tags": ["testing"],
            "unlisted": True,
        },
    }))
    return tmp_path


@pytest.fixture()
def first_page(tmp_path) -> str:
    build_share_pages(_project_fixture(tmp_path))
    return (tmp_path / "a" / "first-article" / "index.html").read_text()


def test_page_is_not_a_redirect(first_page):
    assert "http-equiv=\"refresh\"" not in first_page
    assert "location.replace" not in first_page


def test_page_contains_rendered_body(first_page):
    assert "<p>Body paragraph one.</p>" in first_page


def test_canonical_points_to_page_itself(first_page):
    assert '<link rel="canonical" href="https://timbeach.com/a/first-article/" />' in first_page


def test_og_and_twitter_tags_preserved(first_page):
    assert '<meta property="og:title" content="First Article" />' in first_page
    assert '<meta property="og:image"' in first_page
    assert '<meta name="twitter:card" content="summary_large_image" />' in first_page


def test_relative_image_srcs_become_root_absolute(first_page):
    assert 'src="/pix/diagram.png"' in first_page
    assert 'src="/pix/d2.png"' in first_page
    assert "../pix" not in first_page


def test_absolute_link_untouched(first_page):
    assert 'href="https://example.com/x"' in first_page


def test_audio_article_links_to_interactive_reader(first_page):
    # The "Listen" action is the human's path into the SPA reader (read-aloud).
    assert 'href="/#/article/first-article"' in first_page


def test_no_listen_link_without_audio(tmp_path):
    build_share_pages(_project_fixture(tmp_path))
    page = (tmp_path / "a" / "hidden-article" / "index.html").read_text()
    assert "article-actions" not in page


def test_published_listed_article_is_indexable(first_page):
    assert 'name="robots"' not in first_page


def test_future_dated_article_gets_noindex(tmp_path):
    build_share_pages(_project_fixture(tmp_path))
    page = (tmp_path / "a" / "future-article" / "index.html").read_text()
    assert '<meta name="robots" content="noindex" />' in page


def test_unlisted_article_gets_noindex(tmp_path):
    build_share_pages(_project_fixture(tmp_path))
    page = (tmp_path / "a" / "hidden-article" / "index.html").read_text()
    assert '<meta name="robots" content="noindex" />' in page

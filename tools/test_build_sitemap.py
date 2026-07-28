"""Tests for tools/build_sitemap.py — sitemap.xml generator."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

from build_sitemap import build_sitemap

NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def _project_fixture(tmp_path: Path) -> Path:
    articles = tmp_path / "articles"
    articles.mkdir()
    (articles / "articles.json").write_text(json.dumps({
        "first-article.md": {"title": "First", "date": "2026-05-02"},
        "future-article.md": {"title": "Future", "date": "2099-01-01"},
        "hidden-article.md": {"title": "Hidden", "date": "2026-05-02", "unlisted": True},
    }))
    return tmp_path


def _locs(tmp_path):
    out = tmp_path / "sitemap.xml"
    build_sitemap(_project_fixture(tmp_path), out)
    root = ET.parse(out).getroot()
    return {
        url.findtext("sm:loc", namespaces=NS): url.findtext("sm:lastmod", namespaces=NS)
        for url in root.findall("sm:url", NS)
    }


def test_homepage_and_published_articles_listed(tmp_path):
    locs = _locs(tmp_path)
    assert "https://timbeach.com/" in locs
    assert locs["https://timbeach.com/a/first-article/"] == "2026-05-02"


def test_future_and_unlisted_excluded(tmp_path):
    locs = _locs(tmp_path)
    assert "https://timbeach.com/a/future-article/" not in locs
    assert "https://timbeach.com/a/hidden-article/" not in locs

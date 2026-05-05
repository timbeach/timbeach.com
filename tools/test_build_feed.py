"""Tests for tools/build_feed.py — the RSS 2.0 generator."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from build_feed import build_feed, render_article_html


def _articles_fixture(tmp_path: Path) -> Path:
    """Set up a minimal articles/ directory with two articles."""
    articles = tmp_path / "articles"
    articles.mkdir()

    (articles / "first-article.md").write_text(
        "# First Article\n\n"
        "Body paragraph one.\n\n"
        "## A subsection\n\n"
        "Body paragraph two with **bold**.\n"
    )
    (articles / "second-article.md").write_text(
        "# Second Article\n\nA single paragraph.\n"
    )
    (articles / "articles.json").write_text(json.dumps({
        "first-article.md": {
            "title": "First Article",
            "date": "2026-05-02",
            "tags": ["test", "first"],
            "summary": "The first one.",
        },
        "second-article.md": {
            "title": "Second Article",
            "date": "2026-04-01",
            "tags": ["test"],
            "summary": "The second one.",
        },
    }))
    return tmp_path


def test_build_feed_produces_valid_xml(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    tree = ET.parse(out)
    root = tree.getroot()
    assert root.tag == "rss"
    assert root.attrib.get("version") == "2.0"


def test_feed_has_channel_metadata(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    root = ET.parse(out).getroot()
    channel = root.find("channel")
    assert channel is not None
    assert channel.findtext("title") == "Timothy D Beach"
    assert channel.findtext("link") == "https://timbeach.com"
    assert channel.findtext("description")  # any non-empty value
    assert channel.findtext("lastBuildDate")  # RFC 822 date


def test_feed_items_sorted_newest_first(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    items = ET.parse(out).getroot().find("channel").findall("item")
    titles = [it.findtext("title") for it in items]
    assert titles == ["First Article", "Second Article"]


def test_feed_item_has_link_pubdate_guid(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    item = ET.parse(out).getroot().find("channel/item")
    assert item.findtext("link") == "https://timbeach.com/#/article/first-article"
    assert item.findtext("pubDate")  # RFC 822
    assert item.findtext("guid") == "https://timbeach.com/#/article/first-article"
    assert item.findtext("description") == "The first one."


def test_feed_item_has_content_encoded(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    # Use the namespace map to find content:encoded
    NS = {"content": "http://purl.org/rss/1.0/modules/content/"}
    item = ET.parse(out).getroot().find("channel/item")
    encoded = item.find("content:encoded", NS)
    assert encoded is not None
    assert "<p>" in encoded.text  # rendered HTML
    assert "<strong>bold</strong>" in encoded.text


def test_render_article_html_strips_h1(tmp_path):
    project = _articles_fixture(tmp_path)
    html = render_article_html(project / "articles" / "first-article.md")
    assert "<h1>" not in html      # H1 stripped (it's the article title, in <title>)
    assert "<h2>A subsection</h2>" in html
    assert "<p>Body paragraph one.</p>" in html

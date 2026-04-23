from render_article import extract_paragraphs


def test_simple_paragraphs():
    md = "Hello world.\n\nSecond paragraph."
    assert extract_paragraphs(md) == ["Hello world.", "Second paragraph."]


def test_skips_h1_keeps_h2_h3_h4():
    md = "# Title\n\n## Section\n\nBody.\n\n### Sub\n\nMore.\n\n#### Deep\n\nEnd."
    assert extract_paragraphs(md) == ["Section", "Body.", "Sub", "More.", "Deep", "End."]


def test_strips_inline_code():
    md = "Run `foo` now."
    # matches client: removing <code> leaves adjacent spaces; textContent has two spaces.
    assert extract_paragraphs(md) == ["Run  now."]


def test_strips_images():
    md = "Before ![alt](x.png) after."
    assert extract_paragraphs(md) == ["Before  after."]


def test_skips_fenced_code_blocks():
    md = "```\nsome code\n```\n\nReal paragraph."
    assert extract_paragraphs(md) == ["Real paragraph."]


def test_list_items():
    md = "Intro\n\n- one\n- two\n- three\n\nOutro"
    assert extract_paragraphs(md) == ["Intro", "one", "two", "three", "Outro"]


def test_bold_italic_preserved():
    md = "This is **bold** and *italic*."
    assert extract_paragraphs(md) == ["This is bold and italic."]


def test_empty_and_title_only():
    assert extract_paragraphs("") == []
    assert extract_paragraphs("# Only a title") == []

import json
import subprocess
import numpy as np
from render_article import extract_paragraphs, render_paragraphs, write_timings_json, update_articles_json, encode_opus


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


def _fake_synth_factory(sr=24000, seconds_per_para=1.0):
    """Returns a fake synth that produces silence of fixed duration."""
    n_samples = int(sr * seconds_per_para)
    def synth(text, voice):
        return np.zeros(n_samples, dtype=np.float32), sr
    return synth


def test_concat_two_paragraphs_tracks_offsets():
    synth = _fake_synth_factory(sr=24000, seconds_per_para=1.0)
    samples, sr, timings = render_paragraphs(
        ["First paragraph.", "Second paragraph."],
        voice="bm_lewis",
        synth=synth,
    )
    assert sr == 24000
    assert len(samples) == 48000   # 2 seconds total
    assert len(timings) == 2
    assert timings[0] == {"idx": 0, "start": 0.0, "end": 1.0, "text": "First paragraph."}
    assert timings[1] == {"idx": 1, "start": 1.0, "end": 2.0, "text": "Second paragraph."}


def test_concat_single_paragraph():
    synth = _fake_synth_factory(sr=22050, seconds_per_para=2.5)
    samples, sr, timings = render_paragraphs(["Only one."], voice="bm_lewis", synth=synth)
    assert sr == 22050
    assert len(samples) == int(22050 * 2.5)
    assert timings == [{"idx": 0, "start": 0.0, "end": 2.5, "text": "Only one."}]


def test_concat_empty_list_returns_empty():
    synth = _fake_synth_factory()
    samples, sr, timings = render_paragraphs([], voice="bm_lewis", synth=synth)
    assert len(samples) == 0
    assert timings == []


def test_variable_length_paragraphs_compute_correct_offsets():
    # Simulate paragraphs of different lengths by varying the synth output.
    sr = 24000
    lengths_in_samples = [24000, 48000, 12000]  # 1s, 2s, 0.5s
    idx = [0]
    def synth(text, voice):
        n = lengths_in_samples[idx[0]]
        idx[0] += 1
        return np.zeros(n, dtype=np.float32), sr
    samples, sr_out, timings = render_paragraphs(
        ["a", "b", "c"], voice="bm_lewis", synth=synth,
    )
    assert sr_out == 24000
    assert len(samples) == sum(lengths_in_samples)
    assert timings[0]["start"] == 0.0 and timings[0]["end"] == 1.0
    assert timings[1]["start"] == 1.0 and timings[1]["end"] == 3.0
    assert timings[2]["start"] == 3.0 and timings[2]["end"] == 3.5


def test_write_timings_json_shape(tmp_path):
    out = tmp_path / "slug.timings.json"
    timings = [
        {"idx": 0, "start": 0.0, "end": 1.5, "text": "Hello."},
        {"idx": 1, "start": 1.5, "end": 3.2, "text": "World."},
    ]
    write_timings_json(out, voice="bm_lewis", duration=3.2, timings=timings)
    data = json.loads(out.read_text())
    assert data == {
        "voice": "bm_lewis",
        "duration": 3.2,
        "paragraphs": timings,
    }


def test_update_articles_json_adds_fields(tmp_path):
    aj = tmp_path / "articles.json"
    aj.write_text(json.dumps({
        "foo.md": {"title": "Foo", "date": "2026-01-01", "tags": ["a"]},
        "bar.md": {"title": "Bar", "date": "2026-01-02", "tags": ["b"]},
    }, indent=2))
    update_articles_json(
        aj,
        filename="bar.md",
        audio="audio/bar.ogg",
        timings="audio/bar.timings.json",
        voice="bm_lewis",
        duration=42.5,
    )
    data = json.loads(aj.read_text())
    assert data["foo.md"] == {"title": "Foo", "date": "2026-01-01", "tags": ["a"]}
    assert data["bar.md"] == {
        "title": "Bar",
        "date": "2026-01-02",
        "tags": ["b"],
        "audio": "audio/bar.ogg",
        "timings": "audio/bar.timings.json",
        "voice": "bm_lewis",
        "duration": 42.5,
    }


def test_update_articles_json_unknown_slug_raises(tmp_path):
    aj = tmp_path / "articles.json"
    aj.write_text(json.dumps({"foo.md": {"title": "Foo"}}))
    import pytest
    with pytest.raises(KeyError):
        update_articles_json(aj, filename="missing.md", audio="x", timings="y", voice="z", duration=1.0)


def test_update_articles_json_preserves_formatting(tmp_path):
    """Output should be 2-space indented with trailing newline (matches existing file)."""
    aj = tmp_path / "articles.json"
    aj.write_text(json.dumps({"foo.md": {"title": "Foo"}}, indent=2) + "\n")
    update_articles_json(aj, filename="foo.md", audio="a", timings="t", voice="v", duration=1.0)
    text = aj.read_text()
    assert text.endswith("\n")
    assert '  "foo.md"' in text  # 2-space indent preserved


def test_encode_opus_smoke(tmp_path):
    """End-to-end: sine-wave float32 → .ogg that ffprobe can read."""
    sr = 24000
    duration = 0.5
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    samples = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    out = tmp_path / "out.ogg"
    encode_opus(samples, sr, out)
    assert out.exists()
    assert out.stat().st_size > 500  # sanity: non-empty output
    # Verify ffprobe recognizes it as Opus
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=codec_name", "-of", "default=noprint_wrappers=1:nokey=1",
         str(out)],
        capture_output=True, text=True,
    )
    assert probe.stdout.strip() == "opus"

import numpy as np
from render_article import extract_paragraphs, render_paragraphs


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

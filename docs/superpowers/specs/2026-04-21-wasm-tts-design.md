# WASM Neural TTS for timbeach.com — Design

**Date:** 2026-04-21
**Status:** design approved, ready for implementation plan
**Branch:** `ui-redesign`

## Problem

The site has a "read aloud" feature that uses the Web Speech API. On Chromium-family browsers on Linux (including Brave — the owner's daily driver), `speechSynthesis.getVoices()` returns an empty array unless `speech-dispatcher` is installed system-wide. Result: the button produces a silent "loading voices…" state and never speaks. Any Linux visitor without speech-dispatcher hits the same wall.

## Goal

Read-aloud works in every modern browser on every OS with zero per-user system dependencies, while preserving the zero-cost native path for users whose browser already has TTS voices.

## Locked decisions

1. **Coexistence:** native Web Speech API remains the default; a new "load HQ voice" button swaps to a WASM neural engine on demand.
2. **Model:** Kokoro-82M v1.0 (ONNX, q8 quantization, ~80 MB).
3. **First-load UX:** the button is labeled honestly upfront (`HQ · ~80MB`); one click initiates download with progress.
4. **Voices offered after HQ loads:** three Kokoro voices — `af_bella` (American female), `am_michael` (American male), `bm_george` (British male).
5. **Model hosting:** HuggingFace CDN primary; `timbeach.com/models/` local mirror as automatic fallback when HF is unreachable.
6. **Chunking:** paragraph-at-a-time with one-paragraph look-ahead (prefetch `i+1` while `i` plays).
7. **Code structure:** engine abstraction. `nativeEngine` and `kokoroEngine` conform to the same interface; a playback controller above both orchestrates the queue.

## Non-goals

- Audio pre-rendering / offline mode.
- Mid-paragraph voice swap (current paragraph finishes in old voice).
- Multi-tab coordination.
- A formal test framework — the site has none and this feature doesn't justify introducing one.

---

## §1 — Architecture & module layout

All new code lives in `index.html`. No build step, no package.json, no new files (except the local-mirror model files on the VPS, which are outside the repo).

### Engine interface

Both backends implement:

```
{
  name: 'native' | 'kokoro',
  init(): Promise<void>,            // load voices (native) or model (kokoro)
  voices: [{ id, label, lang }],    // populates the voice dropdown
  synth(text, voiceId, rate): Promise<HTMLAudioElement>,
  cancel(): void,
}
```

**`nativeEngine`** wraps `window.speechSynthesis`. `synth()` returns a Promise that resolves to a pseudo-audio-element exposing the subset of `HTMLAudioElement` used by the playback controller (`play`, `pause`, `playbackRate`, `addEventListener('ended', …)`). Internally it uses `SpeechSynthesisUtterance` and the existing Chromium `onend`-without-speaking retry shim.

**`kokoroEngine`** wraps `kokoro-js` (loaded via dynamic ESM import from jsDelivr). `synth()` calls the model, receives a `Float32Array` of PCM samples, wraps it in a `WAV`-encoded `Blob`, creates an `HTMLAudioElement` from a blob URL, and returns it.

Returning a uniform `HTMLAudioElement` (or a pseudo-element that quacks the same) from both engines means the playback controller doesn't branch on engine type.

### Playback controller

```
tts.queue = {
  current: { idx, audio, status },   // 'synthesizing' | 'ready' | 'playing'
  next:    { idx, audio, status },
  inflight: Map<idx, { promise, abort }>,
}
```

Sits above `tts.engine` (the currently-active engine). Owns paragraph iteration, highlight, look-ahead, and transport control routing.

### Engine switching

User action (click HQ button, click HQ-when-active to revert) sets `tts.engine = <engine>`. The UI layer doesn't know or care which is active beyond reading `tts.engine.voices` for the dropdown.

---

## §2 — UI changes to the TTS bar

**Current bar layout:** `[▶][■] · status · [speed] · [voice▾] · [×]`

**New bar layout:** `[▶][■] · status · [speed] · [HQ] · [voice▾] · [×]`

Single new control: the HQ button, positioned between the speed slider and voice dropdown. Uses the existing `.tts-btn` class conventions plus a new `.tts-hq` class.

### HQ button states

| State | Text | Class | Interaction |
|-------|------|-------|-------------|
| Idle (native active) | `HQ · ~80MB` | `.tts-hq` | Click: start download + swap engine |
| Downloading | `loading… 42%` | `.tts-hq.loading` (disabled) | No-op |
| Ready (kokoro active) | `HQ ✓` | `.tts-hq.ready` (glow) | Click: revert to native engine |
| Promoted (native-less) | `load HQ · ~80MB` | `.tts-hq.promoted` (pulse) | Click: same as idle |

### Voice dropdown contents

- Native engine: existing behavior (system voices).
- Kokoro engine: exactly three options — `Bella (US)`, `Michael (US)`, `George (UK)`.

### Status text vocabulary

| Message | When |
|---------|------|
| `reading paragraph N of M` | Normal playback |
| `downloading high-quality voice… NN%` | Kokoro download in progress |
| `synthesizing…` | First paragraph synth before playback (only if > ~500ms) |
| `buffering next…` | Look-ahead hasn't finished when current paragraph ends |
| `no system voices — click HQ to enable read-aloud` | Native-less fallback |
| `voice download failed — try again later` | Both HF and local mirror failed |
| `skipped paragraph N (synthesis error)` | Transient per-paragraph failure; flashes for 2s |

### Native-less fallback behavior

On `ttsOpen()`, call `nativeEngine.init()`. If after 1 second `nativeEngine.voices.length === 0`:

- Promote the HQ button to `.tts-hq.promoted` (subtle pulse animation).
- Set status text to `no system voices — click HQ to enable read-aloud`.
- Disable transport controls and speed slider until an engine is available.
- Voice dropdown shows disabled `(no voices)`.

This replaces the current silent "loading voices…" hang.

### Mobile layout

The existing `@media (max-width: 768px)` wraps the bar contents. The HQ button uses the same sizing as other buttons, no new media rules needed.

---

## §3 — Model loading & fallback flow

### First click of HQ button (`loadKokoro()`)

1. Disable HQ button, transport controls, speed slider. Status text → `downloading high-quality voice…`. Progress bar (top edge of TTS bar) → 0%.
2. Dynamic import: `await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.0/+esm')` (pin a specific version — `@latest` is brittle and breaks reproducibility). On failure (offline, shields blocking jsDelivr) → error state (see §5), native stays.
3. Import `@huggingface/transformers` env (shipped by kokoro-js). Default config points at HuggingFace.
4. Instantiate the model:
   ```js
   const tts = await KokoroTTS.from_pretrained(
     'onnx-community/Kokoro-82M-v1.0-ONNX',
     { dtype: 'q8', progress_callback: onProgress }
   );
   ```
5. `onProgress` receives `{file, loaded, total}` per weight file. Aggregate across all files, update the top progress bar and the HQ button label.
6. **On HF failure** (network error, timeout, CORS, 404):
   - Catch, log, briefly show status text `huggingface unreachable, trying mirror…`.
   - Set `env.remoteHost = location.origin` (so library fetches from `/models/onnx-community/Kokoro-82M-v1.0-ONNX/…`).
   - Retry `from_pretrained()`.
7. **On both failing:** error state (see §5). Re-enable HQ button for retry.
8. **On success:**
   - `tts.engine = kokoroEngine`.
   - HQ button → `HQ ✓`.
   - Voice dropdown repopulates with the 3 voices (default: `af_bella`).
   - `localStorage.setItem('tts-prefer-hq', '1')`.
   - Playback resumes from the paragraph the user intended when they clicked HQ.

### Subsequent visits

`transformers.js` caches weights in IndexedDB. `from_pretrained()` resolves from cache without network calls. Observable as a ~200ms flash of `loading high-quality voice…` before `HQ ✓`.

### Persisted-preference auto-switch

On `ttsOpen()`:
- If `localStorage.getItem('tts-prefer-hq') === '1'`, and IndexedDB contains the model (probe cheaply — any one weight file is sufficient), start `loadKokoro()` automatically as soon as the TTS bar opens. Skip the native engine entirely.
- If IndexedDB cache has been cleared, fall back to native + show HQ button in idle state. User clicks HQ to re-download.
- Reverting to native (clicking `HQ ✓`) clears the preference: `localStorage.removeItem('tts-prefer-hq')`.

### Local mirror setup (one-time, out-of-band)

The local mirror lives at `/models/onnx-community/Kokoro-82M-v1.0-ONNX/` on the VPS, outside the repo.

Setup procedure (documented in the implementation plan, not automated):
1. Clone the HF model files locally: `git clone https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX`
2. `scp -r Kokoro-82M-v1.0-ONNX/ user@timbeach.com:~/www/models/onnx-community/`
3. Verify reachable: `curl -sI https://timbeach.com/models/onnx-community/Kokoro-82M-v1.0-ONNX/config.json`

`deploy.sh` already excludes nothing that matters; the `models/` dir is outside the rsync source. Add `models/` to `.gitignore` as a belt-and-suspenders measure.

---

## §4 — Playback & look-ahead pipeline

### Flow on `ttsPlay()` starting at paragraph `i`

1. Kick off `engine.synth(text[i], voice, rate)` → store promise in `queue.current` with `status: 'synthesizing'`. Add to `inflight` with an `AbortController`.
2. **Immediately** kick off `engine.synth(text[i+1], …)` → `queue.next`. Runs in parallel.
3. When `queue.current.audio` resolves:
   - `status = 'ready'` then `'playing'`.
   - `audio.play()`, apply `playbackRate = tts.rate`.
   - Highlight DOM paragraph `i` via `.tts-reading`.
   - Status text → `reading paragraph i+1 of N`.
   - Attach `audio.addEventListener('ended', advance)`.

### `advance()`

- `queue.current = queue.next`.
- Kick off `synth(i+2)` → new `queue.next`.
- If new `queue.current.audio` is `ready`: `play()` immediately.
- If still `synthesizing`: status text → `buffering next…`, attach handler to its `.then()` to play once resolved.
- Revoke the previous `current.audio`'s blob URL (`URL.revokeObjectURL`).

### Transport interactions

| Control | Behavior |
|---------|----------|
| **Pause** | `current.audio.pause()`. `next` synth continues (already committed, cheap). |
| **Resume** | `current.audio.play()`. |
| **Stop** | `current.audio.pause()`; abort all `inflight` synths via `AbortController`; revoke blob URLs; reset queue; clear highlight. |
| **Speed slider** | `current.audio.playbackRate = newRate`. Applied uniformly to both engines. We intentionally do NOT use Kokoro's native `speed` param — `playbackRate` is instant and avoids re-synth. |
| **Voice dropdown** | Invalidate `queue.next` (was synthesized with old voice); abort its inflight synth; resynth with new voice on next `advance()`. Current paragraph finishes in old voice. |
| **HQ toggle** | Stop current playback; swap `tts.engine`; restart from `queue.current.idx` with new engine. |

### Short-paragraph edge case

If paragraph duration < synthesis time for next, look-ahead misses. Status briefly shows `buffering next…`. No special handling — the UX dip is acceptable and rare.

---

## §5 — Error handling & edge cases

### Model download failures

| Failure | Handling |
|---------|----------|
| HF 4xx/5xx/timeout | Try local mirror (see §3 step 6). |
| Local mirror also fails | Status text → `voice download failed — try again later`. Re-enable HQ button. Native engine active. |
| Connection drops mid-download | `transformers.js` raises. Catch, wipe partial IndexedDB entry (`indexedDB.deleteDatabase` scoped to the model), allow retry. |
| `QuotaExceededError` | Status text → `browser storage full — free space and retry`. |
| jsDelivr unreachable (library itself blocked) | Status text → `failed to load voice library. check connection`. Native stays. |

### Browser compatibility

Feature-detect WASM SIMD before attempting Kokoro load. If unsupported:
- Disable HQ button permanently for this session.
- Status text → `browser too old for HQ voice`.
- Native engine still works (if voices are available).

**Combined worst case — no WASM SIMD AND no native voices:** read-aloud cannot function. The TTS bar opens with status text `read-aloud unavailable in this browser — try Chrome, Firefox, or Safari` and all controls disabled. This is rare (requires an old browser AND missing speech-dispatcher on Linux) but worth handling cleanly rather than leaving the bar half-broken.

WebGPU is optional acceleration; the library auto-falls-back to plain WASM. No explicit handling.

### Synthesis-time errors

- `engine.synth(text)` throws (malformed input, OOM on pathologically long paragraphs): catch inside `advance()`, log, skip that paragraph, continue. Status flashes `skipped paragraph N (synthesis error)` for 2s.
- Empty/whitespace-only text: skip without calling synth.

### Preserved native-engine quirks

- Chromium `onend`-fires-immediately-without-speaking bug: keep the existing retry shim inside `nativeEngine.synth()`.
- `onvoiceschanged` async voice-list population: keep.
- The 3-second "loading voices…" give-up loop: **remove** — replaced by the §2 native-less fallback behavior.

### User-initiated interrupts

- **Stop mid-download:** `AbortController.abort()` on the fetch; wipe partial IndexedDB entry; revert to native.
- **HQ click while loading:** button is disabled — no-op.
- **Close tab mid-download:** browser handles; on next attempt, cache integrity check re-downloads from scratch.

### Memory

All blob URLs from Kokoro `synth()` outputs are `URL.revokeObjectURL()`'d when the paragraph advances out of the queue. Prevents bloat on long articles.

### Concurrency

- Only one active engine at a time.
- **Engine swap procedure** (HQ toggle mid-playback): (1) call `tts.engine.cancel()` on the outgoing engine; (2) pause `queue.current.audio`; (3) abort all `inflight` synths; (4) reassign `tts.engine = <new engine>`; (5) clear the queue; (6) restart from the current paragraph index via a fresh `ttsSpeakCurrent()` call. The new engine sees an empty queue and begins synth from scratch.
- `inflight` map prevents duplicate synth for the same paragraph.

### Explicitly out of scope

- Mid-paragraph voice swap.
- Offline pre-rendering.
- Cross-tab coordination.

---

## §6 — Testing approach

No new test framework. Manual smoke tests, reproducible from this matrix.

### Manual test matrix

| # | Scenario | Environment | Expected |
|---|----------|-------------|----------|
| 1 | Open article, click ▶ | Mac + Safari (has system voices) | Reads in native voice. Native path unchanged from today. |
| 2 | Click HQ, download, hear Kokoro | Brave/Linux (no speech-dispatcher) | Progress fills, status updates, Bella speaks. |
| 3 | Reload same article | Same as #2, with `localStorage` flag set | Auto-switches to HQ, near-instant (IndexedDB cache hit). |
| 4 | Swap voice dropdown mid-read | HQ active | Current paragraph finishes in old voice; next uses new voice; no audio glitch. |
| 5 | Click Stop mid-download | During state 2 of §2 | AbortController fires, progress clears, native engine returns. |
| 6 | Skip forward via paragraph click | HQ active | `next` queue invalidated, resynth fires, no audio overlap. |
| 7 | Kill network mid-download | HQ not-yet-loaded | After HF timeout, falls back to `/models/`. Works or clean error. |
| 8 | Force HF failure via Brave shields block | HQ not-yet-loaded | Falls back to local mirror. |
| 9 | Long article (12+ paragraphs) with HQ | Any | Look-ahead keeps up; no "buffering next…" after first paragraph. |
| 10 | Speed slider mid-read | HQ active | Playback rate changes immediately, no re-synth. |
| 11 | Revert HQ → native via HQ button toggle | HQ active | Swaps engines, playback continues from current paragraph in native voice. |
| 12 | `?ttsDebug=1` URL param | Any | Console logs engine init, progress events, synth timings. |

### Instrumented logging

Behind a `?ttsDebug=1` query parameter. Logs:
- Engine init start/end, voice counts.
- Per-file download progress events.
- Synth start/end with timing per paragraph.
- Cache hits/misses.
- All caught errors with source.

No perf cost when the flag isn't set (one boolean check at log sites).

### Regression guard

This test matrix is the regression guard. Before merging implementation to `main`, run all 12 scenarios and confirm pass.

---

## Open questions / TBDs

None. All decisions locked during brainstorming.

## Next step

Hand off to `superpowers:writing-plans` for implementation plan.

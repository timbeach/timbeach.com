// Kokoro TTS Web Worker — isolates WASM inference from the main thread.
// Without this, synth blocks paint and audio-ended callbacks, causing
// "page unresponsive" warnings and multi-second gaps between paragraphs.
//
// Messages in:  {cmd: 'init'} | {cmd: 'synth', reqId, text, voiceId}
// Messages out: {type: 'progress', file, loaded, total}
//               {type: 'ready'}
//               {type: 'error', message}
//               {type: 'synth', reqId, samples, sampleRate}
//               {type: 'synth-error', reqId, message}

let ttsInstance = null;

const log = (...a) => console.log('[tts:worker]', ...a);

async function init() {
  log('init: importing kokoro-js…');
  const t0 = performance.now();
  let KokoroTTS, env;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.0/+esm');
    KokoroTTS = mod.KokoroTTS;
    env = mod.env;
    log(`init: import done in ${((performance.now()-t0)/1000).toFixed(1)}s`);
  } catch (e) {
    log('init: import FAILED', e);
    self.postMessage({ type: 'error', message: 'failed to load voice library (jsDelivr unreachable?): ' + e.message });
    return;
  }

  const progressCallback = (evt) => {
    if (evt.total && evt.file) {
      self.postMessage({ type: 'progress', file: evt.file, loaded: evt.loaded, total: evt.total });
    }
  };

  const attemptLoad = async () => {
    ttsInstance = await KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      { dtype: 'q8', progress_callback: progressCallback }
    );
  };

  if (env) env.remoteHost = 'https://huggingface.co';
  log('init: from_pretrained (HF)…');
  const tLoad = performance.now();
  try {
    await attemptLoad();
    log(`init: model loaded in ${((performance.now()-tLoad)/1000).toFixed(1)}s`);
  } catch (hfErr) {
    log('init: HF failed, trying local mirror', hfErr);
    self.postMessage({ type: 'progress', file: '__retry__', loaded: 0, total: 1 });
    if (env) env.remoteHost = self.location.origin;
    try {
      await attemptLoad();
      log('init: model loaded from local mirror');
    } catch (localErr) {
      log('init: local mirror also failed', localErr);
      self.postMessage({
        type: 'error',
        message: `both huggingface and local mirror failed (hf: ${hfErr?.message || hfErr}; local: ${localErr?.message || localErr})`,
      });
      return;
    }
  }

  self.postMessage({ type: 'ready' });
}

async function synth(reqId, text, voiceId) {
  log(`synth #${reqId} (${text.length} chars, voice=${voiceId})`);
  const t0 = performance.now();
  try {
    const { audio, sampling_rate } = await ttsInstance.generate(text, {
      voice: voiceId || 'af_bella',
      speed: 1.0,
    });
    const samples = audio instanceof Float32Array ? audio : new Float32Array(audio);
    const dur = ((performance.now()-t0)/1000).toFixed(2);
    const audioSec = (samples.length / sampling_rate).toFixed(1);
    log(`synth #${reqId} done in ${dur}s (${audioSec}s of audio, ${samples.length} samples @ ${sampling_rate}Hz)`);
    self.postMessage(
      { type: 'synth', reqId, samples, sampleRate: sampling_rate },
      [samples.buffer]
    );
  } catch (e) {
    log(`synth #${reqId} FAILED`, e);
    self.postMessage({ type: 'synth-error', reqId, message: e?.message || String(e) });
  }
}

self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.cmd === 'init') init();
  else if (msg.cmd === 'synth') synth(msg.reqId, msg.text, msg.voiceId);
  // 'cancel' is a no-op: WASM generate() is not interruptible. Stale
  // results are discarded on the main thread via reqId matching.
};

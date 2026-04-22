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

async function init() {
  let KokoroTTS, env;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.0/+esm');
    KokoroTTS = mod.KokoroTTS;
    env = mod.env;
  } catch (e) {
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
  try {
    await attemptLoad();
  } catch (hfErr) {
    // Signal the UI to reset progress for the retry attempt.
    self.postMessage({ type: 'progress', file: '__retry__', loaded: 0, total: 1 });
    if (env) env.remoteHost = self.location.origin;
    try {
      await attemptLoad();
    } catch (localErr) {
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
  try {
    const { audio, sampling_rate } = await ttsInstance.generate(text, {
      voice: voiceId || 'af_bella',
      speed: 1.0,
    });
    const samples = audio instanceof Float32Array ? audio : new Float32Array(audio);
    self.postMessage(
      { type: 'synth', reqId, samples, sampleRate: sampling_rate },
      [samples.buffer]
    );
  } catch (e) {
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

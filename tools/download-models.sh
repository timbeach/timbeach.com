#!/bin/sh
# Downloads Kokoro ONNX weights + voice embeddings into tools/models/.
# Idempotent: skips files that already exist.
set -e
DIR="$(dirname "$0")/models"
mkdir -p "$DIR"
cd "$DIR"

BASE="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"

if [ ! -f kokoro-v1.0.onnx ]; then
  echo "→ kokoro-v1.0.onnx (~310 MB)"
  wget -q --show-progress "$BASE/kokoro-v1.0.onnx"
fi

if [ ! -f voices-v1.0.bin ]; then
  echo "→ voices-v1.0.bin (~27 MB)"
  wget -q --show-progress "$BASE/voices-v1.0.bin"
fi

echo "done."

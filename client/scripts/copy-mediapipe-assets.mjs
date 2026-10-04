// Runs automatically after `npm install` (the "postinstall" script).
//
// MediaPipe needs two kinds of files at runtime:
//   1. The WebAssembly runtime (.wasm + its JS loader). These ship inside the
//      npm package, so we just copy them into public/ where Vite serves them.
//   2. The face model (face_landmarker.task, ~3.7 MB). It isn't in the npm
//      package, so we download it once from Google's model storage.
//
// Self-hosting both means the app never loads code from a third-party CDN at
// runtime, and the service worker can cache them for offline use.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'mediapipe');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const modelPath = join(outDir, 'face_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

mkdirSync(outDir, { recursive: true });

cpSync(wasmSrc, join(outDir, 'wasm'), { recursive: true });
console.log('[mediapipe] copied wasm files to public/mediapipe/wasm');

if (existsSync(modelPath)) {
  console.log('[mediapipe] model already present, skipping download');
} else {
  console.log('[mediapipe] downloading face_landmarker.task ...');
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: HTTP ${res.status}`);
  writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
  console.log('[mediapipe] saved public/mediapipe/face_landmarker.task');
}

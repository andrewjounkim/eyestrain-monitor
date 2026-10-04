// Creates the MediaPipe FaceLandmarker. Used by both the main thread and the worker.

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { CONFIG } from './config.js';

// `inWorker` matters because of how MediaPipe loads its WebAssembly glue script:
// on a page it adds a <script> tag; in a classic worker it uses importScripts().
// Our worker is a MODULE worker, where importScripts() is not allowed, so we ask
// for the ES-module build of the glue script instead (useModule = true).
export async function createFaceLandmarker({ inWorker }) {
  // Absolute URL so it resolves the same from the page and from the worker.
  const wasmUrl = new URL(CONFIG.WASM_PATH, self.location.origin).href;
  const fileset = await FilesetResolver.forVisionTasks(wasmUrl, inWorker);

  const options = (delegate) => ({
    baseOptions: { modelAssetPath: CONFIG.MODEL_PATH, delegate },
    runningMode: 'VIDEO', // we pass a stream of frames with timestamps
    numFaces: 1,
    minFaceDetectionConfidence: CONFIG.MIN_FACE_DETECTION_CONFIDENCE,
    minFacePresenceConfidence: CONFIG.MIN_FACE_PRESENCE_CONFIDENCE,
    minTrackingConfidence: CONFIG.MIN_TRACKING_CONFIDENCE,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });

  try {
    const landmarker = await FaceLandmarker.createFromOptions(fileset, options(CONFIG.DELEGATE));
    return { landmarker, delegate: CONFIG.DELEGATE };
  } catch (err) {
    if (CONFIG.DELEGATE === 'CPU') throw err;
    // GPU (WebGL) can be unavailable, e.g. blocklisted drivers or no WebGL in workers.
    console.warn('GPU delegate failed, falling back to CPU:', err);
    // MediaPipe runs its wasm loader script once per attempt and then clears the
    // global it defined. In a module worker the loader is loaded with import(),
    // which caches modules and won't run the same URL twice, so the retry needs a
    // different URL (a query string is enough).
    const retryFileset = { ...fileset, wasmLoaderPath: `${fileset.wasmLoaderPath}?retry` };
    const landmarker = await FaceLandmarker.createFromOptions(retryFileset, options('CPU'));
    return { landmarker, delegate: 'CPU' };
  }
}

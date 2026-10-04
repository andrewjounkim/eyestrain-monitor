// DETECTION WEB WORKER (module worker, started by detector-worker.js)
//
// Why a worker: browsers stop requestAnimationFrame and throttle timers on hidden
// tabs / minimized windows, so a main-thread loop misses blinks. This worker
// doesn't use rAF or timers at all. It just waits for the next camera frame from
// a stream, so it runs whenever the camera produces frames.
//
// Messages IN  (from the page):
//   { type: 'init', readable, baseline }  readable = ReadableStream of VideoFrames
//   { type: 'recalibrate' }
// Messages OUT (to the page):
//   { type: 'ready', delegate }           model loaded
//   { type: 'result', ... }               one per frame (see frame-processor.js)
//   { type: 'stats', at, frames, fps }    ~once per second
//   { type: 'note', message }             informational
//   { type: 'error', stage, message }

import { createFaceLandmarker } from './landmarker.js';
import { FrameProcessor } from './frame-processor.js';

const send = (msg) => self.postMessage(msg);

let processor = null;

self.onmessage = async (event) => {
  const msg = event.data;
  if (msg.type === 'init') {
    let landmarker;
    try {
      const created = await createFaceLandmarker({ inWorker: true });
      landmarker = created.landmarker;
      send({ type: 'ready', delegate: created.delegate });
    } catch (err) {
      send({ type: 'error', stage: 'model', message: String(err?.message || err) });
      return;
    }
    processor = new FrameProcessor(send, { baseline: msg.baseline });
    readFrames(msg.readable, landmarker);
  } else if (msg.type === 'recalibrate') {
    processor?.recalibrate();
  }
};

// Which image type to give MediaPipe.
// detectForVideo() accepts any "TexImageSource" (anything WebGL can upload as a
// texture). In Chrome, VideoFrame is one of those, and MediaPipe reads its size
// from frame.displayWidth/displayHeight. So we pass the VideoFrame directly:
// no extra copy. If that ever throws (other browser / version), we switch to
// createImageBitmap(frame), which makes an ImageBitmap copy that is always
// accepted, at the cost of one extra copy per frame.
let useBitmap = false;

async function detect(landmarker, frame, t) {
  if (!useBitmap) {
    try {
      return { result: landmarker.detectForVideo(frame, t), source: frame };
    } catch (err) {
      useBitmap = true;
      send({ type: 'note', message: `VideoFrame input failed (${err?.message || err}); using ImageBitmap instead.` });
    }
  }
  const bitmap = await createImageBitmap(frame);
  try {
    // On success the caller closes the bitmap, after the brightness check used it.
    return { result: landmarker.detectForVideo(bitmap, t), source: bitmap };
  } catch (err) {
    bitmap.close();
    throw err;
  }
}

async function readFrames(readable, landmarker) {
  const reader = readable.getReader();
  let lastTimestamp = 0;

  while (true) {
    // Waits until the camera delivers the next frame. If we're slower than the
    // camera, MediaStreamTrackProcessor drops old frames instead of queueing them,
    // so we always process a recent frame and never fall behind.
    const { value: frame, done } = await reader.read();
    if (done) break; // camera track stopped

    let source = null;
    try {
      // frame.timestamp is in microseconds; MediaPipe wants milliseconds, strictly increasing.
      const t = Math.max(frame.timestamp / 1000, lastTimestamp + 1);
      lastTimestamp = t;
      const detected = await detect(landmarker, frame, t);
      source = detected.source;
      processor.handle(detected.result, t, frame.displayWidth, frame.displayHeight, source);
    } catch (err) {
      send({ type: 'error', stage: 'detect', message: String(err?.message || err) });
    } finally {
      // IMPORTANT: a VideoFrame holds a camera/GPU buffer that garbage collection
      // does not free quickly. The camera has only a small pool of buffers; if we
      // don't close() every frame, it runs out within seconds and the stream stalls
      // (Chrome also logs a warning). Same for the ImageBitmap copy, if we made one.
      if (source && source !== frame) source.close();
      frame.close();
    }
  }
  landmarker.close();
}

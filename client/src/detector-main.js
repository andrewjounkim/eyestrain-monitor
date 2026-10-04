// Main-thread detector: the simple approach, and the fallback.
//
// The loop is driven by video.requestVideoFrameCallback(), which fires once for
// each NEW frame the <video> shows (if unsupported: requestAnimationFrame, ~60/s).
// Both are tied to screen painting, and browsers PAUSE them when the tab is
// hidden or the window is minimized, so this detector stops while you're in
// another window. That's why it is the "control" in the background experiment.

import { createFaceLandmarker } from './landmarker.js';
import { FrameProcessor } from './frame-processor.js';

export async function startMainDetector(video, { onMessage, baseline }) {
  let landmarker;
  try {
    const created = await createFaceLandmarker({ inWorker: false });
    landmarker = created.landmarker;
    onMessage({ type: 'ready', delegate: created.delegate });
  } catch (err) {
    onMessage({ type: 'error', stage: 'model', message: String(err?.message || err) });
    return { recalibrate() {}, stop() {} };
  }

  const processor = new FrameProcessor(onMessage, { baseline });
  let running = true;
  let lastVideoTime = -1;
  let lastTimestamp = 0;

  const hasVideoFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const scheduleNext = () =>
    hasVideoFrameCallback ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);

  function loop() {
    if (!running) return;
    // With the rAF fallback, skip repaints where the video hasn't changed.
    // (Not exact for live camera streams, where currentTime can advance without
    // a new frame; that's why requestVideoFrameCallback is preferred.)
    if (video.readyState >= 2 && (hasVideoFrameCallback || video.currentTime !== lastVideoTime)) {
      lastVideoTime = video.currentTime;
      // MediaPipe VIDEO mode requires strictly increasing timestamps.
      const t = Math.max(performance.now(), lastTimestamp + 1);
      lastTimestamp = t;
      try {
        const result = landmarker.detectForVideo(video, t);
        processor.handle(result, t, video.videoWidth, video.videoHeight, video);
      } catch (err) {
        onMessage({ type: 'error', stage: 'detect', message: String(err?.message || err) });
      }
    }
    scheduleNext();
  }
  scheduleNext();

  return {
    recalibrate: () => processor.recalibrate(),
    stop() {
      running = false;
      landmarker.close();
    },
  };
}

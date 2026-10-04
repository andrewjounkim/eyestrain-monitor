// Main-thread detector: the simple approach, and the fallback.
//
// requestAnimationFrame runs our loop before each screen repaint (~60 times/s).
// Browsers PAUSE requestAnimationFrame when the tab is hidden or the window is
// minimized, so this detector stops while you're in another window. That's why
// it is the "control" in the background experiment.

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

  function loop() {
    if (!running) return;
    // rAF fires ~60/s but the camera gives ~30 frames/s: only run the model when
    // the video has actually advanced to a new frame.
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
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
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    recalibrate: () => processor.recalibrate(),
    stop() {
      running = false;
      landmarker.close();
    },
  };
}

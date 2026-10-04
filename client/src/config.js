// Every tunable number in one place. Change these while watching the EAR graph.
// This file has no DOM code, so both the page and the Web Worker import it.

export const CONFIG = {
  // ---- Camera ----
  // Requested resolution / frame rate. The browser picks the closest the camera
  // supports. 640x480 is plenty for eye landmarks and keeps detection fast.
  CAMERA_WIDTH: 640,
  CAMERA_HEIGHT: 480,
  CAMERA_FPS: 30,

  // ---- Face model (MediaPipe FaceLandmarker) ----
  // Files are served from /public/mediapipe (copied there by `npm install`).
  WASM_PATH: '/mediapipe/wasm',
  MODEL_PATH: '/mediapipe/face_landmarker.task',
  // 'GPU' runs the model with WebGL (faster). If that fails we fall back to 'CPU'.
  DELEGATE: 'GPU',
  // How sure the model must be (0–1) that it found / is still tracking a face.
  // Higher = fewer false faces, but the face is "lost" more easily in poor light.
  MIN_FACE_DETECTION_CONFIDENCE: 0.5,
  MIN_FACE_PRESENCE_CONFIDENCE: 0.5,
  MIN_TRACKING_CONFIDENCE: 0.5,

  // ---- Calibration ----
  // How long (seconds of time with a face visible) to record your normal
  // open-eye EAR before counting blinks. Time without a face doesn't count.
  CALIBRATION_SECONDS: 25,
  // Calibration only finishes if it collected at least this many frames
  // (protects against a very low frame rate producing a meaningless baseline).
  MIN_CALIBRATION_SAMPLES: 100,

  // ---- Blink detection ----
  // Thresholds are RELATIVE to your calibrated open-eye EAR ("baseline"), because
  // EAR differs between people, cameras and head angles.
  //   closed threshold = baseline * CLOSED_RATIO
  //   reopen threshold = baseline * REOPEN_RATIO
  // The eye counts as closed when EAR drops below the closed threshold, and as
  // open again only once it rises above the (higher) reopen threshold. Using two
  // thresholds ("hysteresis") stops noise around one line from counting twice.
  CLOSED_RATIO: 0.65,
  REOPEN_RATIO: 0.8,
  // A closure shorter than this is treated as noise (one jittery frame).
  // Keep it below one frame time (~33 ms at 30 fps) unless you see false blinks.
  MIN_BLINK_MS: 30,
  // A closure longer than this is not a blink (eyes deliberately closed, or
  // looking down at a keyboard). Normal blinks last roughly 100–400 ms.
  MAX_BLINK_MS: 700,
  // Blinks per minute = blinks in this many most recent seconds, scaled to 1 minute.
  BLINK_RATE_WINDOW_SECONDS: 60,

  // ---- Lighting ----
  // Average frame brightness (0 = black, 255 = white) below which we warn that
  // it is too dark for reliable detection.
  MIN_BRIGHTNESS: 40,
  // How often to measure brightness (it's cheap, but not needed every frame).
  BRIGHTNESS_CHECK_MS: 1000,

  // ---- Diagnostics / UI ----
  // How often the detector reports processed frames per second.
  STATS_INTERVAL_MS: 1000,
  // Seconds of history shown in the live EAR graph, and its vertical range.
  GRAPH_SECONDS: 10,
  GRAPH_MAX_EAR: 0.5,
};

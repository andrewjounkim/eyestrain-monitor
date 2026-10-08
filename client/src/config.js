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
  // A blink counts as FULL if, at its lowest point, EAR fell to this fraction of
  // your open-eye baseline or below (e.g. baseline 0.30 x 0.4 = 0.12).
  // Blinks that only reach the closed threshold but not this one are "incomplete".
  FULL_BLINK_RATIO: 0.4,
  // Blinks per minute = blinks in this many most recent seconds, scaled to 1 minute.
  BLINK_RATE_WINDOW_SECONDS: 60,

  // ---- Session summary ----
  // Reference blink rates for the end-of-session summary (blinks per minute).
  // A relaxed blink rate is roughly 15–20/min; during focused screen work it
  // often drops to 5–7/min, which dries the eyes. Average at or above HEALTHY
  // is rated "good", below LOW is rated "low", anything between is "fair".
  HEALTHY_BLINKS_PER_MIN: 15,
  LOW_BLINKS_PER_MIN: 10,
  // A minute is only given a rate in the summary chart if your face was visible
  // for at least this many seconds of it (otherwise the rate would be noise).
  SUMMARY_MIN_FACE_SECONDS: 20,
  // The whole session needs at least this much face-visible time to be rated.
  SUMMARY_MIN_TOTAL_FACE_SECONDS: 60,

  // ---- Distance & comfort (widget color, tips) ----
  // Distance is estimated from the size of your iris in the image: almost all
  // adult irises are about 11.7 mm wide, so the smaller it looks, the farther
  // away you are. We don't know the webcam's lens, so we assume a typical
  // horizontal field of view; if distances look off, adjust CAMERA_HFOV_DEG
  // (a wider lens = larger value). Treat the result as approximate.
  IRIS_DIAMETER_MM: 11.7,
  CAMERA_HFOV_DEG: 60,
  // Closer than this counts as "too close" (recommended: about arm's length, 50–70 cm).
  DISTANCE_TOO_CLOSE_CM: 45,
  // A new comfort state must last this long before the widget changes color,
  // so a glance away or one slow moment never makes it flicker.
  COMFORT_HOLD_SECONDS: 5,

  // ---- Nudges (nudge.js) ----
  // A nudge is shown IN the widget and on the Monitor page (not as a system
  // notification, which many people have turned off). It appears when the
  // comfort state has been 'act' (blink rate low / too close) for this long...
  NUDGE_AFTER_SECONDS: 45,
  // ...stays until the problem is fixed or this many seconds pass...
  NUDGE_MAX_SECONDS: 30,
  // ...and then waits at least this long before nudging again.
  NUDGE_COOLDOWN_MINUTES: 5,

  // ---- Planned, not used yet: 20-20-20 breaks and the guided break ----
  // 20-20-20 rule: every 20 minutes at the screen, look 20 feet away for 20 seconds.
  BREAK_INTERVAL_MINUTES: 20,
  // Step 1: this many FULL blinks, checked by the camera.
  BREAK_BLINKS: 10,
  // Step 2: seconds of looking away from the screen (the timer only runs while
  // the camera sees you looking away).
  BREAK_LOOK_AWAY_SECONDS: 20,

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

// Where you're looking, where your head is, and roughly how far you are from
// the screen, from the face landmarks. Pure functions, no DOM: runs in the
// worker and on the main thread, like ear.js.
//
// The 478-point face model includes iris landmarks:
//   468 = right iris center, 469..472 = points around it (469/471 left/right edges)
//   473 = left iris center,  474..477 = points around it (474/476 left/right edges)

import { CONFIG } from './config.js';

const clamp = (v, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v));

// Eye corners and lids for each eye (same points as ear.js), plus its iris.
const EYES = [
  { corners: [33, 133], upper: [160, 158], lower: [144, 153], iris: 468, irisEdges: [469, 471] }, // right
  { corners: [362, 263], upper: [385, 387], lower: [380, 373], iris: 473, irisEdges: [474, 476] }, // left
];

export function measurePose(landmarks, width, height) {
  // Work in pixels so x and y use the same units (see the note in ear.js).
  const px = (i) => ({ x: landmarks[i].x * width, y: landmarks[i].y * height });
  const avgY = (ids) => ids.reduce((sum, i) => sum + px(i).y, 0) / ids.length;

  let gazeH = 0;
  let gazeV = 0;
  let irisWidth = 0;
  for (const eye of EYES) {
    const [a, b] = eye.corners.map(px);
    const iris = px(eye.iris);
    // 0 = iris at the left corner, 1 = at the right corner (image coordinates).
    gazeH += (iris.x - Math.min(a.x, b.x)) / Math.abs(b.x - a.x);
    // 0 = at the upper lid, 1 = at the lower lid.
    const top = avgY(eye.upper);
    const bottom = avgY(eye.lower);
    gazeV += bottom > top ? (iris.y - top) / (bottom - top) : 0.5;
    const [e1, e2] = eye.irisEdges.map(px);
    irisWidth += Math.hypot(e2.x - e1.x, e2.y - e1.y);
  }
  gazeH /= 2;
  gazeV /= 2;
  irisWidth /= 2;

  // Distance (pinhole camera): size_in_pixels = focal_length * real_size / distance.
  // Focal length in pixels comes from the assumed field of view.
  const focalPx = width / 2 / Math.tan(((CONFIG.CAMERA_HFOV_DEG / 2) * Math.PI) / 180);
  const distanceCm = irisWidth > 0 ? (focalPx * CONFIG.IRIS_DIAMETER_MM) / irisWidth / 10 : null;

  // Output in MIRROR coordinates (-1..1), the way the user sees themself:
  // +x = toward the right of the screen, +y = down. The camera image is not
  // mirrored, so the horizontal values are flipped.
  // The iris only moves a little inside the eye, so gaze is amplified.
  const bridge = landmarks[168]; // point between the eyes
  return {
    gazeX: clamp((0.5 - gazeH) * 3.5),
    gazeY: clamp((gazeV - 0.5) * 2.5),
    headX: clamp((0.5 - bridge.x) * 2),
    headY: clamp((bridge.y - 0.45) * 2),
    distanceCm,
  };
}

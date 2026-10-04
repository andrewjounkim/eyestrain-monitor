// Eye aspect ratio (EAR): how open an eye is, as a single number.
//
// Six landmarks per eye, in this order:
//
//          p2    p3
//    p1                p4        p1/p4 = eye corners
//          p6    p5              p2,p3 = upper lid, p6,p5 = lower lid
//
//   EAR = (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
//
// i.e. average eyelid opening height divided by eye width. Dividing by the width
// makes it independent of how far you sit from the camera. Open eyes are roughly
// 0.25–0.35; a closed eye drops close to 0.05–0.1.
//
// Pure functions, no DOM: used by both the Web Worker and the main-thread loop.

// MediaPipe Face Mesh landmark indices (478-point model). "Right"/"left" are the
// person's own eyes, so the right eye appears on the left of an unmirrored image.
export const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
export const LEFT_EYE = [362, 385, 387, 263, 373, 380];

// MediaPipe landmarks are normalized: x is divided by the image WIDTH and y by the
// image HEIGHT. For a 640x480 image the two units differ, so we convert back to
// pixels before measuring distances. Otherwise the vertical distances would be
// stretched relative to the horizontal one and EAR would be skewed.
function distance(a, b, width, height) {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
}

export function eyeAspectRatio(landmarks, indices, width, height) {
  const [p1, p2, p3, p4, p5, p6] = indices.map((i) => landmarks[i]);
  const vertical = distance(p2, p6, width, height) + distance(p3, p5, width, height);
  const horizontal = distance(p1, p4, width, height);
  return horizontal > 0 ? vertical / (2 * horizontal) : 0;
}

// Computes both eyes at once. Also returns the 12 eye points (normalized x,y,
// flattened into one array) so the page can draw them over the video.
export function measureEyes(landmarks, width, height) {
  const earRight = eyeAspectRatio(landmarks, RIGHT_EYE, width, height);
  const earLeft = eyeAspectRatio(landmarks, LEFT_EYE, width, height);
  const eyePoints = [...RIGHT_EYE, ...LEFT_EYE].flatMap((i) => [landmarks[i].x, landmarks[i].y]);
  return {
    earLeft,
    earRight,
    // Averaging both eyes reduces noise. (Winks would be missed, which is fine here.)
    ear: (earLeft + earRight) / 2,
    eyePoints,
  };
}

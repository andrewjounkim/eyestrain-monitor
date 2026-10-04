// Rough "is it too dark?" check: shrink the frame to 32x24 pixels and average
// the brightness. Works with a <video> element (main thread) and with a
// VideoFrame (worker), because canvas drawImage() accepts both.

let ctx = null;

export function averageBrightness(source) {
  // OffscreenCanvas exists both on the page and in workers. Created once, reused.
  if (!ctx) ctx = new OffscreenCanvas(32, 24).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, 32, 24);
  const { data } = ctx.getImageData(0, 0, 32, 24); // RGBA bytes
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Perceived brightness: green looks brightest to us, blue darkest.
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / (data.length / 4);
}

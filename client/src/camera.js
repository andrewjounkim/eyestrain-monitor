// Webcam access. The stream only ever goes to the <video> element and to our own
// detection code on this device; nothing is uploaded.

import { CONFIG } from './config.js';

export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    // Also happens on plain http:// (camera needs https or localhost).
    const err = new Error('Camera API not available');
    err.name = 'NotSupportedError';
    throw err;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: CONFIG.CAMERA_WIDTH },
      height: { ideal: CONFIG.CAMERA_HEIGHT },
      frameRate: { ideal: CONFIG.CAMERA_FPS },
    },
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

// getUserMedia rejects with a DOMException whose `name` tells us what went wrong.
export function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Click the camera icon in the address bar (or the site settings) to allow it, then reload.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found. Connect a webcam and try again.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is in use by another app (Zoom, FaceTime…) or could not be started. Close the other app and try again.';
    case 'NotSupportedError':
      return 'This browser cannot access the camera here. Use Chrome on https:// or http://localhost.';
    default:
      return `Could not start the camera: ${err?.message || err}`;
  }
}

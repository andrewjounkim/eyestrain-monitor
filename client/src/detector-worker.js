// Page side of worker mode: turns the camera track into a stream of VideoFrames
// and hands that stream to worker.js.

export function supportsWorkerMode() {
  // MediaStreamTrackProcessor is part of "insertable streams" (Chrome/Edge).
  // Not available in Firefox/Safari pages at the time of writing.
  return typeof MediaStreamTrackProcessor === 'function';
}

export function startWorkerDetector(stream, { onMessage, baseline }) {
  // Clone the track so the worker's consumer is independent of the <video>
  // preview: stopping one doesn't stop the other.
  const track = stream.getVideoTracks()[0].clone();

  // processor.readable is a ReadableStream that yields one VideoFrame per camera frame.
  const processor = new MediaStreamTrackProcessor({ track });

  // `type: 'module'` lets the worker use import. The `new URL(..., import.meta.url)`
  // pattern is what Vite looks for to bundle the worker file.
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => onMessage(event.data);
  worker.onerror = (event) => {
    onMessage({ type: 'error', stage: 'worker', message: event.message || 'Detection worker crashed' });
  };

  // The second argument is the "transfer list": the stream is MOVED to the worker
  // rather than copied. After this line the page can no longer read from it, and
  // frames flow camera -> worker without passing through the main thread.
  worker.postMessage({ type: 'init', readable: processor.readable, baseline }, [processor.readable]);

  return {
    recalibrate: () => worker.postMessage({ type: 'recalibrate' }),
    stop() {
      worker.terminate();
      track.stop(); // stops only the clone; the preview keeps running
    },
  };
}

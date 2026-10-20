/**
 * Record the stage with its sound: canvas.captureStream() for the picture, a
 * MediaStreamDestination on the audio engine for the sound, one MediaRecorder for both.
 * The clip starts and stops at the audio-clock times of a clipPlan(), so it holds exactly
 * the bars the plan says.
 *
 * Browser APIs are always called as methods on their own objects, never detached
 * (Chrome throws "Illegal invocation" otherwise).
 */
import { pickMimeType } from './core/clip.js';

export const VIDEO_FPS = 60;
export const VIDEO_BITS_PER_SECOND = 8_000_000;

export function recorderSupported() {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaStream !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

/**
 * Record `plan.start`..`plan.stop` (audio-clock seconds) of `canvas` plus `engine`'s output.
 * Resolves with a Blob (video/webm). `onStart` fires when the recorder actually starts.
 * The returned promise has a cancel() that stops early and still resolves with what was
 * captured.
 */
export function recordClip({ canvas, engine, plan, fps = VIDEO_FPS, onStart }) {
  const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
  const video = canvas.captureStream(fps);
  const audio = engine.capture();
  const stream = new MediaStream([...video.getVideoTracks(), ...audio.stream.getAudioTracks()]);
  const options = { videoBitsPerSecond: VIDEO_BITS_PER_SECOND };
  if (mimeType) options.mimeType = mimeType;
  const rec = new MediaRecorder(stream, options);
  const chunks = [];
  const ctx = engine.ctx;
  const msUntil = (t) => Math.max(0, (t - ctx.currentTime) * 1000);
  let startTimer = null;
  let stopTimer = null;

  rec.addEventListener('dataavailable', (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });

  function cleanup() {
    clearTimeout(startTimer);
    clearTimeout(stopTimer);
    for (const t of video.getTracks()) t.stop();
    audio.release();
  }

  let settle = null;
  const promise = new Promise((resolve, reject) => {
    settle = resolve;
    rec.addEventListener('stop', () => {
      cleanup();
      resolve(new Blob(chunks, { type: rec.mimeType || mimeType || 'video/webm' }));
    });
    rec.addEventListener('error', (e) => {
      cleanup();
      reject(e.error || new Error('recording failed'));
    });
    startTimer = setTimeout(() => {
      try {
        rec.start();
      } catch (err) {
        cleanup();
        reject(err);
        return;
      }
      if (onStart) onStart();
      stopTimer = setTimeout(() => {
        if (rec.state !== 'inactive') rec.stop();
      }, msUntil(plan.stop));
    }, msUntil(plan.start));
  });

  promise.cancel = () => {
    clearTimeout(startTimer);
    if (rec.state === 'inactive') {
      cleanup();
      settle(new Blob(chunks, { type: rec.mimeType || mimeType || 'video/webm' }));
    } else rec.stop();
  };
  promise.mimeType = mimeType;
  return promise;
}

/** Trigger a download of a Blob under `filename`. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

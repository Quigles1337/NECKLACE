import { pattern } from './core/euclid.js';
import { defaultState, colorOf, clampTempo, addNecklace, removeNecklace, LIMITS, encode, decode } from './core/state.js';
import { createRenderer } from './render.js';
import { ensureAudio, getEngine } from './audio/engine.js';
import { playVoice } from './audio/voices.js';
import { createTransport } from './scheduler.js';
import { mountPanel } from './ui/controls.js';
import { barDuration } from './core/schedule.js';
import { clipPlan } from './core/clip.js';
import { recorderSupported, recordClip, saveBlob } from './recorder.js';

// The URL hash is the save file: load it, keep it current, follow it when it changes.
const state = decode(location.hash) || defaultState();
const PANS = [-0.35, 0.35, -0.15, 0.15];
const FLASH_SECONDS = 0.28;

const canvas = document.getElementById('stage');
const hint = document.getElementById('hint');
const playBtn = document.getElementById('play');
const tempoInput = document.getElementById('tempo');
const tempoOut = document.getElementById('tempo-out');
const addBtn = document.getElementById('add');
const shareBtn = document.getElementById('share');
const recordBtn = document.getElementById('record');
const recBars = document.getElementById('rec-bars');
const recBadge = document.getElementById('rec-badge');
const recText = document.getElementById('rec-text');
const toast = document.getElementById('toast');
const renderer = createRenderer(canvas);

let lastHash = '';
function writeHash() {
  const h = '#' + encode(state);
  if (h === lastHash) return;
  lastHash = h;
  history.replaceState(null, '', h);
}

let toastTimer = null;
function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// Onsets scheduled on the audio clock, waiting to light up when their time comes.
const pending = [];
const flashes = new Map();

const transport = createTransport({
  engine: ensureAudio,
  getTempo: () => state.tempo,
  getNecklaces: () => state.necklaces.map((nk) => ({ id: nk.id, n: nk.n })),
  onEvent(ev) {
    const i = state.necklaces.findIndex((nk) => nk.id === ev.id);
    if (i < 0) return;
    const nk = state.necklaces[i];
    const bits = pattern(nk.k, nk.n, nk.rot);
    if (!bits[ev.step]) return;
    const engine = getEngine();
    if (!nk.mute) playVoice(engine, nk.voice, ev.time, { dest: engine.bus(i, PANS[i] || 0) });
    pending.push({ key: `${nk.id}:${ev.step}`, time: ev.time });
  },
});

function changed() {
  addBtn.disabled = state.necklaces.length >= LIMITS.maxNecklaces;
  writeHash();
}

const panel = mountPanel(document.getElementById('panel'), {
  getState: () => state,
  onChange: changed,
  onRemove(id) {
    if (removeNecklace(state, id)) {
      changed();
      panel.sync();
    }
  },
});

addBtn.addEventListener('click', () => {
  if (addNecklace(state)) {
    changed();
    panel.sync();
  }
});

function audioNow() {
  const engine = getEngine();
  return engine ? engine.ctx.currentTime - engine.latency() : 0;
}

function updateFlashes(now) {
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].time <= now) {
      flashes.set(pending[i].key, pending[i].time);
      pending.splice(i, 1);
    }
  }
  for (const [key, t] of flashes) if (now - t > FLASH_SECONDS) flashes.delete(key);
}

function flashArray(nk, now) {
  const arr = new Array(nk.n).fill(0);
  if (flashes.size === 0) return arr;
  for (let s = 0; s < nk.n; s++) {
    const t = flashes.get(`${nk.id}:${s}`);
    if (t !== undefined) arr[s] = Math.pow(Math.max(0, 1 - (now - t) / FLASH_SECONDS), 1.6);
  }
  return arr;
}

function frame() {
  const playing = transport.playing;
  const now = audioNow();
  if (playing) updateFlashes(now);
  renderer.draw({
    rings: state.necklaces.map((nk, i) => ({
      bits: pattern(nk.k, nk.n, nk.rot),
      color: colorOf(i),
      muted: nk.mute,
      flash: playing ? flashArray(nk, now) : null,
    })),
    phase: playing ? transport.phase(now) : 0,
    playing,
  });
  requestAnimationFrame(frame);
}

function setPlaying(on) {
  if (on) transport.start();
  else {
    transport.stop();
    pending.length = 0;
    flashes.clear();
    cancelRecording();
  }
  playBtn.textContent = transport.playing ? 'Stop' : 'Play';
  playBtn.setAttribute('aria-pressed', String(transport.playing));
}

function syncTempo() {
  tempoInput.value = String(state.tempo);
  tempoOut.textContent = String(state.tempo);
}

playBtn.addEventListener('click', () => setPlaying(!transport.playing));
canvas.addEventListener('pointerdown', () => setPlaying(!transport.playing));

tempoInput.addEventListener('input', () => {
  state.tempo = clampTempo(tempoInput.value);
  syncTempo();
  changed();
});

shareBtn.addEventListener('click', async () => {
  writeHash();
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link copied. It holds everything on screen.');
  } catch {
    showToast('Copy the address bar: the link holds everything on screen.');
  }
});

// Record: exactly N bars of the stage with sound, aligned to the next bar boundary.
let recording = null;
let recordingCancelled = false;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function cancelRecording() {
  if (!recording) return;
  recordingCancelled = true;
  recording.cancel();
}

/** Returns the clip Blob (also used from window.NECKLACE for scripted checks). */
async function record({ bars = recBars.value, download = true } = {}) {
  if (recording) return recording;
  if (!recorderSupported()) {
    showToast('Recording needs MediaRecorder and canvas capture: try Chrome, Edge or Firefox.');
    return null;
  }
  const engine = ensureAudio();
  if (!transport.playing) setPlaying(true);
  const now = engine.ctx.currentTime;
  const bar = transport.barAt(now) || { start: now, dur: barDuration(state.tempo) };
  const plan = clipPlan(state, bars, { now, barStart: bar.start, barDur: bar.dur, minLead: 0.05 });
  recordingCancelled = false;
  recordBtn.disabled = true;
  recordBtn.setAttribute('aria-busy', 'true');
  recBars.disabled = true;
  tempoInput.disabled = true;
  recBadge.hidden = false;
  recBadge.classList.remove('live');
  recText.textContent = `ARMED · ${plural(plan.bars, 'bar')} from the next bar`;
  recording = recordClip({
    canvas,
    engine,
    plan,
    onStart() {
      recBadge.classList.add('live');
      recText.textContent = `REC · ${plural(plan.bars, 'bar')}`;
    },
  });
  try {
    const blob = await recording;
    if (recordingCancelled) {
      showToast('Recording cancelled.');
      return null;
    }
    if (download) {
      saveBlob(blob, plan.filename);
      showToast(`Saved ${plan.filename} · ${(blob.size / 1e6).toFixed(1)} MB`);
    }
    return blob;
  } catch (err) {
    showToast(`Recording failed: ${err && err.message ? err.message : err}`);
    return null;
  } finally {
    recording = null;
    recordBtn.disabled = false;
    recordBtn.removeAttribute('aria-busy');
    recBars.disabled = false;
    tempoInput.disabled = false;
    recBadge.hidden = true;
    recBadge.classList.remove('live');
  }
}

if (!recorderSupported()) {
  recordBtn.disabled = true;
  recordBtn.title = 'Recording needs MediaRecorder and canvas capture (Chrome, Edge, Firefox)';
}
recordBtn.addEventListener('click', () => record());

window.addEventListener('hashchange', () => {
  if (location.hash === lastHash) return;
  const s = decode(location.hash);
  if (!s) return;
  state.tempo = s.tempo;
  state.necklaces.splice(0, state.necklaces.length, ...s.necklaces);
  lastHash = location.hash;
  syncTempo();
  changed();
  panel.sync();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    setPlaying(!transport.playing);
  }
});

hint.textContent = 'space · play / stop';
syncTempo();
changed();
panel.sync();
new ResizeObserver(() => renderer.resize()).observe(canvas);
renderer.resize();
frame();

// Scripting hook: window.NECKLACE.record({ bars: 1, download: false }) resolves with the Blob.
window.NECKLACE = Object.freeze({ record, state });

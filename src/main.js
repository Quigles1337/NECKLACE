import { pattern } from './core/euclid.js';
import { defaultState, colorOf, clampTempo, addNecklace, removeNecklace, LIMITS, encode, decode } from './core/state.js';
import { createRenderer } from './render.js';
import { ensureAudio, getEngine } from './audio/engine.js';
import { playVoice } from './audio/voices.js';
import { createTransport } from './scheduler.js';
import { mountPanel } from './ui/controls.js';

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

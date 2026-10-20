import { pattern } from './core/euclid.js';
import { createRenderer } from './render.js';
import { ensureAudio, getEngine } from './audio/engine.js';
import { playVoice } from './audio/voices.js';
import { createTransport } from './scheduler.js';

const state = {
  tempo: 120,
  necklaces: [
    { id: 1, n: 8, k: 3, rot: 0, voice: 'wood', mute: false, color: '#f7b733' },
    { id: 2, n: 8, k: 5, rot: 0, voice: 'tick', mute: false, color: '#4fd1e5' },
  ],
};
const PANS = [-0.35, 0.35, -0.15, 0.15];
const FLASH_SECONDS = 0.28;

const canvas = document.getElementById('stage');
const hint = document.getElementById('hint');
const playBtn = document.getElementById('play');
const tempoInput = document.getElementById('tempo');
const tempoOut = document.getElementById('tempo-out');
const renderer = createRenderer(canvas);

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
    rings: state.necklaces.map((nk) => ({
      bits: pattern(nk.k, nk.n, nk.rot),
      color: nk.color,
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

playBtn.addEventListener('click', () => setPlaying(!transport.playing));
canvas.addEventListener('pointerdown', () => setPlaying(!transport.playing));

tempoInput.addEventListener('input', () => {
  state.tempo = Number(tempoInput.value);
  tempoOut.textContent = String(state.tempo);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    setPlaying(!transport.playing);
  }
});

hint.textContent = 'space · play / stop';
new ResizeObserver(() => renderer.resize()).observe(canvas);
renderer.resize();
frame();

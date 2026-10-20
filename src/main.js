import { pattern } from './core/euclid.js';
import { createRenderer } from './render.js';
import { ensureAudio } from './audio/engine.js';
import { playVoice } from './audio/voices.js';

// Static preview: the two necklaces of the paper's Figure 1, tresillo and cinquillo.
const necklaces = [
  { n: 8, k: 3, rot: 0, color: '#f7b733', voice: 'wood' },
  { n: 8, k: 5, rot: 0, color: '#4fd1e5', voice: 'tick' },
];
const PANS = [-0.35, 0.35, -0.15, 0.15];

const canvas = document.getElementById('stage');
const hint = document.getElementById('hint');
const renderer = createRenderer(canvas);

function frame() {
  renderer.draw({
    rings: necklaces.map((nk) => ({ bits: pattern(nk.k, nk.n, nk.rot), color: nk.color, muted: false, flash: null })),
    phase: 0,
    playing: false,
  });
  requestAnimationFrame(frame);
}

// Audition: until the scheduler lands, clicking the necklace plays each voice once.
canvas.addEventListener('pointerdown', () => {
  const engine = ensureAudio();
  const t = engine.ctx.currentTime + 0.03;
  necklaces.forEach((nk, i) => playVoice(engine, nk.voice, t + i * 0.3, { dest: engine.bus(i, PANS[i]) }));
  hint.textContent = `${necklaces.map((nk) => nk.voice).join(' · ')}`;
});

new ResizeObserver(() => renderer.resize()).observe(canvas);
renderer.resize();
frame();

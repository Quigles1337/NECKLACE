import { pattern } from './core/euclid.js';
import { createRenderer } from './render.js';

// Static preview: the two necklaces of the paper's Figure 1, tresillo and cinquillo.
const necklaces = [
  { n: 8, k: 3, rot: 0, color: '#f7b733' },
  { n: 8, k: 5, rot: 0, color: '#4fd1e5' },
];

const canvas = document.getElementById('stage');
const renderer = createRenderer(canvas);

function frame() {
  renderer.draw({
    rings: necklaces.map((nk) => ({ bits: pattern(nk.k, nk.n, nk.rot), color: nk.color, muted: false, flash: null })),
    phase: 0,
    playing: false,
  });
  requestAnimationFrame(frame);
}

new ResizeObserver(() => renderer.resize()).observe(canvas);
renderer.resize();
frame();

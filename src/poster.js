/**
 * Paint the poster: the pure layout and words come from src/core/poster.js, the
 * necklaces are drawn by the same routine as the stage, at print size.
 */
import { posterLayout, posterText, POSTER_SIZES, POSTER_FILENAME } from './core/poster.js';
import { pattern } from './core/euclid.js';
import { colorOf } from './core/state.js';
import { drawNecklaces } from './render.js';

export { POSTER_FILENAME };

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif';
const MONO = 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace';
const FG = '#e8ecf4';
const MUTED = '#8b93a7';
const BG = '#0a0c12';

/** Centred text with letter-spacing, drawn glyph by glyph (ctx.letterSpacing is not everywhere). */
function drawTracked(ctx, text, x, y, tracking) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + tracking;
  });
}

/** Box notation with onsets in the necklace colour and rests dimmed; returns its width. */
function drawBox(ctx, box, x, y, color, tracking) {
  let cx = x;
  for (const ch of box) {
    ctx.fillStyle = ch === 'x' ? color : 'rgba(255,255,255,0.3)';
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  return cx - x;
}

function background(ctx, width, height) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  const g1 = ctx.createRadialGradient(width * 0.25, -height * 0.05, 0, width * 0.25, -height * 0.05, width * 0.75);
  g1.addColorStop(0, '#1b2036');
  g1.addColorStop(1, 'rgba(27,32,54,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, width, height);
  const g2 = ctx.createRadialGradient(width * 1.1, height * 1.1, 0, width * 1.1, height * 1.1, width * 0.6);
  g2.addColorStop(0, '#1a1322');
  g2.addColorStop(1, 'rgba(26,19,34,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw the poster for `state` onto `canvas` (resized to the poster size). `base` is the
 * page URL without its hash; the share link printed is base#<state>. Returns the layout.
 */
export function drawPoster(canvas, state, { base = '', size = 'portrait' } = {}) {
  const dims = POSTER_SIZES[size] || POSTER_SIZES.portrait;
  const { width, height } = dims;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const L = posterLayout({ width, height, count: state.necklaces.length });
  const T = posterText(state, base);

  background(ctx, width, height);

  // title and subtitle
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = FG;
  ctx.font = `700 ${L.title.size}px ${SANS}`;
  drawTracked(ctx, T.title, L.title.x, L.title.y, L.title.tracking * L.title.size);
  ctx.fillStyle = MUTED;
  ctx.font = `${L.subtitle.size}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(T.subtitle, L.subtitle.x, L.subtitle.y);

  // the necklaces, as drawn on the stage
  drawNecklaces(
    ctx,
    {
      rings: state.necklaces.map((nk, i) => ({ bits: pattern(nk.k, nk.n, nk.rot), color: colorOf(i), muted: nk.mute, flash: null })),
      phase: 0,
      playing: false,
      playhead: false,
    },
    { cx: L.stage.cx, cy: L.stage.cy, R: L.stage.R, scale: L.stage.scale },
  );

  // one line per necklace: swatch, E(k,n), name, interval vector; box notation at the right
  ctx.textAlign = 'left';
  T.necklaces.forEach((nk, i) => {
    const line = L.lines[i];
    const gap = line.size * 0.55;
    let x = line.x;
    ctx.globalAlpha = nk.muted ? 0.45 : 1;
    ctx.beginPath();
    ctx.arc(x + line.swatch, line.y - line.size * 0.33, line.swatch, 0, Math.PI * 2);
    ctx.fillStyle = nk.color;
    ctx.shadowColor = nk.color;
    ctx.shadowBlur = line.swatch * 1.6;
    ctx.fill();
    ctx.shadowBlur = 0;
    x += line.swatch * 2 + gap;
    ctx.font = `600 ${line.size}px ${MONO}`;
    ctx.fillStyle = nk.color;
    ctx.fillText(nk.ekn, x, line.y);
    x += ctx.measureText(nk.ekn).width + gap;
    if (nk.name) {
      ctx.font = `${line.size}px ${SANS}`;
      ctx.fillStyle = FG;
      ctx.fillText(nk.name, x, line.y);
      x += ctx.measureText(nk.name).width + gap;
    }
    ctx.font = `${line.size * 0.8}px ${MONO}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(nk.iv, x, line.y);
    // box notation, right-aligned
    ctx.font = `${line.size * 0.8}px ${MONO}`;
    const tracking = line.size * 0.1;
    let w = 0;
    for (const ch of nk.box) w += ctx.measureText(ch).width + tracking;
    drawBox(ctx, nk.box, L.width - L.margin - w + tracking, line.y, nk.color, tracking);
    ctx.globalAlpha = 1;
  });

  // tempo
  ctx.font = `${L.tempo.size}px ${SANS}`;
  ctx.fillStyle = FG;
  ctx.textAlign = 'left';
  ctx.fillText(T.tempo, L.tempo.x, L.tempo.y);

  // credit, right-aligned on the tempo line
  ctx.font = `${L.credit.size}px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'right';
  ctx.fillText(T.credit, L.credit.x, L.credit.y);

  // footer: the share link, shrunk if a long scene would overflow the line
  ctx.textAlign = 'left';
  let urlSize = L.url.size;
  ctx.font = `${urlSize}px ${MONO}`;
  const urlWidth = ctx.measureText(T.url).width;
  if (urlWidth > L.url.maxWidth) {
    urlSize = Math.max(12, Math.floor((urlSize * L.url.maxWidth) / urlWidth));
    ctx.font = `${urlSize}px ${MONO}`;
  }
  ctx.fillText(T.url, L.url.x, L.url.y);
  return L;
}

/** Render the poster offscreen and resolve with a PNG Blob. */
export function renderPoster(state, opts = {}) {
  const canvas = document.createElement('canvas');
  drawPoster(canvas, state, opts);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('could not encode the poster'))), 'image/png');
  });
}

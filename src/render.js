/**
 * Canvas renderer for rhythm necklaces.
 *
 * draw(scene) where scene = {
 *   rings: [{ bits, color, muted, flash }],  // flash: array of per-step intensities 0..1 (or null)
 *   phase,                                     // bar phase 0..1 for the playhead
 *   playing,
 *   beats,                                     // beat ticks around the outer ring (default 4)
 * }
 * Rings are drawn concentric, ring 0 outermost. One playhead sweeps them all, because
 * every necklace shares the same bar.
 */
import { TAU, stepAngle, pointAt, ringRadius, playheadAngle, polygonPoints, dotRadius } from './core/geometry.js';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function withAlpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 1;
  let height = 1;
  let dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  function drawRing(ring, r, cx, cy) {
    const { bits, color } = ring;
    const n = bits.length;
    const flash = ring.flash || null;
    let energy = 0;
    if (flash) for (let i = 0; i < n; i++) if (flash[i] > energy) energy = flash[i];

    ctx.save();
    ctx.globalAlpha = ring.muted ? 0.3 : 1;

    // ring guide
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // polygon
    const verts = polygonPoints(bits, cx, cy, r);
    if (verts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      if (verts.length >= 3) {
        ctx.fillStyle = withAlpha(color, 0.13 + 0.22 * energy);
        ctx.fill();
      }
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = withAlpha(color, 0.9);
      ctx.shadowColor = color;
      ctx.shadowBlur = 6 + 18 * energy;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (verts.length === 1) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(verts[0].x, verts[0].y);
      ctx.lineWidth = 2;
      ctx.strokeStyle = withAlpha(color, 0.6);
      ctx.stroke();
    }

    // dots
    const dr = dotRadius(n, r);
    for (let i = 0; i < n; i++) {
      const p = pointAt(stepAngle(i, n), cx, cy, r);
      if (!bits[i]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.8, dr * 0.4), 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fill();
        continue;
      }
      const f = flash ? flash[i] : 0;
      if (f > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, dr + 26 * f, 0, TAU);
        ctx.fillStyle = withAlpha(color, 0.28 * f);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, dr + 5 * f, 0, TAU);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 + 14 * f;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (f > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, (dr + 5 * f) * 0.55, 0, TAU);
        ctx.fillStyle = `rgba(255,255,255,${0.9 * f})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function draw(scene) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const R = Math.min(width, height) / 2 - 30;
    if (R < 20) return;
    const rings = scene.rings || [];
    const phase = scene.phase || 0;
    const beats = scene.beats || 4;

    // sweep trail behind the playhead
    const angle = playheadAngle(phase);
    if (scene.playing && typeof ctx.createConicGradient === 'function') {
      const trail = 0.16;
      const g = ctx.createConicGradient(angle - trail * TAU, cx, cy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(trail, 'rgba(255,255,255,0.07)');
      g.addColorStop(Math.min(1, trail + 0.001), 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R + 4, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // beat ticks outside the outer ring
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    for (let b = 0; b < beats; b++) {
      const a = stepAngle(b, beats);
      const p1 = pointAt(a, cx, cy, R + 12);
      const p2 = pointAt(a, cx, cy, R + 20);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let i = 0; i < rings.length; i++) {
      drawRing(rings[i], ringRadius(i, rings.length, R), cx, cy);
    }

    // playhead
    const tip = pointAt(angle, cx, cy, R + 8);
    ctx.save();
    ctx.globalAlpha = scene.playing ? 0.9 : 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = scene.playing ? 14 : 0;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    ctx.restore();
  }

  return { resize, draw };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAU, stepAngle, pointAt, ringPoints, polygonPoints, ringRadius, playheadAngle, polygonArea, dotRadius } from '../src/core/geometry.js';
import { pattern } from '../src/core/euclid.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`);

test('step 0 is at 12 o\'clock and steps run clockwise', () => {
  near(stepAngle(0, 8), -Math.PI / 2);
  const top = pointAt(stepAngle(0, 4), 0, 0, 10);
  near(top.x, 0);
  near(top.y, -10);
  const right = pointAt(stepAngle(1, 4), 0, 0, 10);
  near(right.x, 10);
  near(right.y, 0);
  const bottom = pointAt(stepAngle(2, 4), 0, 0, 10);
  near(bottom.y, 10);
  near(stepAngle(8, 8) - stepAngle(0, 8), TAU);
});

test('ringPoints spaces n points evenly on the circle', () => {
  const pts = ringPoints(12, 100, 100, 50);
  assert.equal(pts.length, 12);
  for (const p of pts) near(Math.hypot(p.x - 100, p.y - 100), 50);
  for (let i = 0; i < 12; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % 12];
    near(Math.hypot(p.x - q.x, p.y - q.y), 2 * 50 * Math.sin(Math.PI / 12));
  }
});

test('polygonPoints picks the onset vertices in order', () => {
  const pts = polygonPoints(pattern(3, 8), 0, 0, 1);
  assert.equal(pts.length, 3);
  near(pts[0].x, 0);
  near(pts[0].y, -1);
  const expected = pointAt(stepAngle(3, 8), 0, 0, 1);
  near(pts[1].x, expected.x);
  near(pts[1].y, expected.y);
});

test('ringRadius: outer ring is R, rings shrink evenly and stay outside the inner bound', () => {
  assert.equal(ringRadius(0, 1, 300), 300);
  assert.equal(ringRadius(0, 4, 300), 300);
  const r = [0, 1, 2, 3].map((i) => ringRadius(i, 4, 300));
  for (let i = 1; i < 4; i++) assert.ok(r[i] < r[i - 1]);
  near(r[1] - r[2], r[2] - r[3]);
  assert.ok(r[3] >= 150);
  near(ringRadius(1, 2, 100), 83);
});

test('playheadAngle sweeps one turn per bar', () => {
  near(playheadAngle(0), -Math.PI / 2);
  near(playheadAngle(0.25), 0);
  near(playheadAngle(0.5), Math.PI / 2);
});

test('polygonArea: inscribed square and equilateral triangle', () => {
  near(polygonArea(polygonPoints(pattern(4, 4), 0, 0, 1)), 2);
  near(polygonArea(polygonPoints(pattern(3, 3), 0, 0, 1)), (3 * Math.sqrt(3)) / 4);
  near(polygonArea(polygonPoints(pattern(2, 8), 0, 0, 1)), 0);
  near(polygonArea([]), 0);
});

test('dotRadius stays within legible bounds', () => {
  for (const n of [3, 8, 16, 32]) {
    for (const r of [60, 150, 300]) {
      const d = dotRadius(n, r);
      assert.ok(d >= 2.5 && d <= 7, `n=${n} r=${r} -> ${d}`);
    }
  }
  assert.ok(dotRadius(3, 300) > dotRadius(32, 150));
});

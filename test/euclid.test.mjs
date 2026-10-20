import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bjorklund, toBox, fromBox, onsets, intervals, rotate, pattern, canonical, isRotation, gcd } from '../src/core/euclid.js';

// Every rhythm Toussaint (2005) prints, in the exact form the paper prints it.
const PAPER = [
  [1, 2, 'x.'], [1, 3, 'x..'], [1, 4, 'x...'],
  [2, 3, 'x.x'], [2, 5, 'x.x..'],
  [3, 4, 'x.xx'], [3, 5, 'x.x.x'], [3, 7, 'x.x.x..'], [3, 8, 'x..x..x.'],
  [4, 7, 'x.x.x.x'], [4, 9, 'x.x.x.x..'], [4, 11, 'x..x..x..x.'], [4, 12, 'x..x..x..x..'],
  [5, 6, 'x.xxxx'], [5, 7, 'x.xx.xx'], [5, 8, 'x.xx.xx.'], [5, 9, 'x.x.x.x.x'],
  [5, 11, 'x.x.x.x.x..'], [5, 12, 'x..x.x..x.x.'], [5, 13, 'x..x.x..x.x..'], [5, 16, 'x..x..x..x..x...'],
  [7, 8, 'x.xxxxxx'], [7, 12, 'x.xx.x.xx.x.'], [7, 16, 'x..x.x.x..x.x.x.'],
  [9, 16, 'x.xx.x.x.xx.x.x.'],
  [11, 24, 'x..x.x.x.x.x..x.x.x.x.x.'],
  [13, 24, 'x.xx.x.x.x.x.xx.x.x.x.x.'],
];

test('bjorklund reproduces all 27 patterns printed in Toussaint (2005)', () => {
  assert.equal(PAPER.length, 27);
  for (const [k, n, box] of PAPER) {
    assert.equal(toBox(bjorklund(k, n)), box, `E(${k},${n})`);
  }
});

test('the distribution loop runs at least once: E(3,4) is x.xx, not xxx.', () => {
  assert.equal(toBox(bjorklund(3, 4)), 'x.xx');
  assert.equal(toBox(bjorklund(5, 6)), 'x.xxxx');
  assert.equal(toBox(bjorklund(7, 8)), 'x.xxxxxx');
});

test('interval vectors match the paper', () => {
  const IV = {
    '3,8': [3, 3, 2], '5,8': [2, 1, 2, 1, 2], '4,9': [2, 2, 2, 3], '7,12': [2, 1, 2, 2, 1, 2, 2],
    '5,16': [3, 3, 3, 3, 4], '7,16': [3, 2, 2, 3, 2, 2, 2], '13,24': [2, 1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2],
  };
  for (const [key, iv] of Object.entries(IV)) {
    const [k, n] = key.split(',').map(Number);
    assert.deepEqual(intervals(bjorklund(k, n)), iv, `E(${k},${n})`);
  }
});

test('every E(k,n) has length n and exactly k onsets', () => {
  for (let n = 1; n <= 48; n++) {
    for (let k = 0; k <= n; k++) {
      const bits = bjorklund(k, n);
      assert.equal(bits.length, n);
      assert.equal(bits.reduce((a, b) => a + b, 0), k);
      assert.equal(onsets(bits).length, k);
    }
  }
});

test('argument validation', () => {
  assert.throws(() => bjorklund(5, 4), RangeError);
  assert.throws(() => bjorklund(1, 0), RangeError);
  assert.throws(() => bjorklund(-1, 4), RangeError);
  assert.throws(() => bjorklund(1.5, 4), TypeError);
  assert.deepEqual(bjorklund(0, 4), [0, 0, 0, 0]);
  assert.deepEqual(bjorklund(4, 4), [1, 1, 1, 1]);
});

test('box notation round-trips', () => {
  assert.deepEqual(fromBox('x.x'), [1, 0, 1]);
  assert.equal(toBox(fromBox('x..x..x.')), 'x..x..x.');
});

test('rotate is a left rotation and tolerates any integer', () => {
  const t = fromBox('x..x..x.');
  assert.equal(toBox(rotate(t, 3)), 'x..x.x..');
  assert.equal(toBox(rotate(t, 11)), 'x..x.x..');
  assert.equal(toBox(rotate(t, -5)), 'x..x.x..');
  assert.equal(toBox(rotate(t, 0)), 'x..x..x.');
  assert.deepEqual(rotate([], 3), []);
});

test('pattern(k, n, rot) is the rotated Euclidean rhythm', () => {
  assert.equal(toBox(pattern(3, 8)), 'x..x..x.');
  assert.equal(toBox(pattern(5, 16, 6)), 'x..x..x...x..x..'); // bossa nova as actually played
  assert.equal(toBox(pattern(7, 12, 3)), 'x.x.xx.x.x.x'); // the Bembe bell
});

test('canonical picks the lexicographically largest rotation', () => {
  assert.equal(toBox(canonical(fromBox('..x..x.x'))), 'x.x..x..');
  assert.equal(toBox(canonical(fromBox('x..x..x.'))), 'x.x..x..');
  assert.equal(toBox(canonical(fromBox('x.xx.xx.'))), 'xx.xx.x.');
});

test('isRotation and gcd', () => {
  assert.ok(isRotation([3, 3, 2], [2, 3, 3]));
  assert.ok(!isRotation([3, 3, 2], [3, 2, 2]));
  assert.ok(!isRotation([1, 2], [1, 2, 3]));
  assert.equal(gcd(8, 5), 1);
  assert.equal(gcd(12, 8), 4);
});

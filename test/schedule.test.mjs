import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEATS_PER_BAR, barDuration, stepTime, firstStepAtOrAfter, Sequencer } from '../src/core/schedule.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`);

test('bar duration', () => {
  assert.equal(BEATS_PER_BAR, 4);
  assert.equal(barDuration(120), 2);
  assert.equal(barDuration(60), 4);
  near(stepTime(10, 2, 8, 3), 10.75);
});

test('firstStepAtOrAfter', () => {
  assert.equal(firstStepAtOrAfter(0, 2, 4, 0), 0);
  assert.equal(firstStepAtOrAfter(0, 2, 4, -1), 0);
  assert.equal(firstStepAtOrAfter(0, 2, 4, 0.5), 1);
  assert.equal(firstStepAtOrAfter(0, 2, 4, 0.51), 2);
  assert.equal(firstStepAtOrAfter(0, 2, 4, 1.99), 4);
  assert.equal(firstStepAtOrAfter(0, 2, 4, 2.5), 4);
});

test('one necklace: events before the horizon, bars roll over', () => {
  const seq = new Sequencer({ tempo: 120, startTime: 0 });
  const a = seq.advance(0, 1.0, [{ id: 'a', n: 4 }]);
  assert.deepEqual(a.map((e) => [e.step, e.time]), [[0, 0], [1, 0.5]]);
  const b = seq.advance(0.9, 2.1, [{ id: 'a', n: 4 }]);
  assert.deepEqual(b.map((e) => [e.bar, e.step, e.time]), [[0, 2, 1.0], [0, 3, 1.5], [1, 0, 2.0]]);
  assert.equal(seq.barIndex, 1);
  assert.deepEqual(seq.advance(0.9, 2.1, [{ id: 'a', n: 4 }]), [], 'nothing is emitted twice');
});

test('polyrhythm: 3 against 4 over one shared bar', () => {
  const seq = new Sequencer({ tempo: 120, startTime: 0 });
  const ev = seq.advance(0, 2.0, [{ id: 'three', n: 3 }, { id: 'four', n: 4 }]);
  const three = ev.filter((e) => e.id === 'three').map((e) => e.time);
  const four = ev.filter((e) => e.id === 'four').map((e) => e.time);
  assert.equal(three.length, 3);
  assert.equal(four.length, 4);
  near(three[1], 2 / 3);
  near(three[2], 4 / 3);
  assert.deepEqual(four, [0, 0.5, 1, 1.5]);
  assert.equal(seq.barIndex, 0, 'horizon equal to the bar end does not roll the bar');
});

test('tempo changes take effect at the next bar', () => {
  const seq = new Sequencer({ tempo: 120, startTime: 0 });
  seq.advance(0, 1.0, [{ id: 'a', n: 2 }]);
  seq.setTempo(60);
  assert.equal(seq.bar.dur, 2, 'current bar keeps its duration');
  const ev = seq.advance(1.9, 2.1, [{ id: 'a', n: 2 }]);
  assert.equal(seq.bar.dur, 4);
  assert.deepEqual(ev.map((e) => [e.bar, e.step, e.time]), [[1, 0, 2.0]]);
  const next = seq.advance(3.9, 4.1, [{ id: 'a', n: 2 }]);
  assert.deepEqual(next.map((e) => [e.bar, e.step, e.time]), [[1, 1, 4.0]]);
});

test('a necklace added mid-bar joins at its next step, never in the past', () => {
  const seq = new Sequencer({ tempo: 120, startTime: 0 });
  seq.advance(0, 0.6, [{ id: 'a', n: 4 }]);
  const none = seq.advance(0.6, 0.7, [{ id: 'a', n: 4 }, { id: 'b', n: 4 }]);
  assert.deepEqual(none, []);
  const ev = seq.advance(0.9, 1.1, [{ id: 'a', n: 4 }, { id: 'b', n: 4 }]);
  assert.deepEqual(ev.map((e) => [e.id, e.step, e.time]), [['a', 2, 1.0], ['b', 2, 1.0]]);
});

test('a stalled clock skips steps older than maxLate instead of bursting them', () => {
  const seq = new Sequencer({ tempo: 120, startTime: 0, maxLate: 0.25 });
  seq.advance(0, 0.1, [{ id: 'a', n: 8 }]);
  // the loop stalls for 1.3 s; steps at 0.25 .. 1.0 are long gone, 1.25 is 0.05 s late
  const ev = seq.advance(1.3, 1.6, [{ id: 'a', n: 8 }]);
  assert.deepEqual(ev.map((e) => [e.step, e.time]), [[5, 1.25], [6, 1.5]]);
  assert.equal(seq.cursors.get('a').idx, 7, 'skipped steps still advance the cursor');
});

test('removing a necklace drops its cursor', () => {
  const seq = new Sequencer({ tempo: 120, startTime: 0 });
  seq.advance(0, 0.1, [{ id: 'a', n: 4 }, { id: 'b', n: 3 }]);
  assert.equal(seq.cursors.size, 2);
  seq.advance(0.2, 0.3, [{ id: 'a', n: 4 }]);
  assert.equal(seq.cursors.size, 1);
  assert.ok(seq.cursors.has('a'));
});

test('changing n mid-bar re-aligns to the new grid without repeating', () => {
  const seq = new Sequencer({ tempo: 120, startTime: 0 });
  const first = seq.advance(0, 0.6, [{ id: 'a', n: 4 }]);
  assert.deepEqual(first.map((e) => e.time), [0, 0.5]);
  const ev = seq.advance(0.6, 1.1, [{ id: 'a', n: 8 }]);
  assert.deepEqual(ev.map((e) => [e.n, e.step, e.time]), [[8, 3, 0.75], [8, 4, 1.0]]);
});

test('phaseAt follows the bar that contains t', () => {
  const seq = new Sequencer({ tempo: 120, startTime: 1 });
  seq.advance(0, 5.5, [{ id: 'a', n: 1 }]);
  assert.equal(seq.phaseAt(0.5), 0);
  near(seq.phaseAt(1.5), 0.25);
  near(seq.phaseAt(3.5), 0.25);
  near(seq.phaseAt(5.0), 0);
});

test('long run: every (id, bar, step) is emitted exactly once, in order', () => {
  const seq = new Sequencer({ tempo: 137, startTime: 0.3 });
  const necklaces = [{ id: 'a', n: 5 }, { id: 'b', n: 16 }, { id: 'c', n: 3 }];
  const seen = new Set();
  const last = new Map();
  let now = 0;
  let rng = 12345;
  const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 2000; i++) {
    now += 0.01 + rand() * 0.04;
    const ev = seq.advance(now, now + 0.1 + rand() * 0.05, necklaces);
    for (const e of ev) {
      const key = `${e.id}:${e.bar}:${e.step}`;
      assert.ok(!seen.has(key), `duplicate ${key}`);
      seen.add(key);
      assert.ok(e.time >= now - 1e-9, 'never in the past');
      assert.ok(!(last.has(e.id)) || e.time > last.get(e.id), 'monotone per necklace');
      last.set(e.id, e.time);
    }
  }
  const bars = seq.barIndex;
  assert.ok(bars > 10);
  const perBar = (id, n) => [...seen].filter((k) => k.startsWith(id + ':')).length / n;
  assert.ok(perBar('b', 16) >= bars, 'b has emitted at least every step of every completed bar');
});

test('barAt finds the bar containing a time', () => {
  const seq = new Sequencer({ tempo: 120, startTime: 10 });
  assert.deepEqual(seq.barAt(10), { start: 10, dur: 2 });
  assert.deepEqual(seq.barAt(11.5), { start: 10, dur: 2 });
  assert.deepEqual(seq.barAt(3), { start: 10, dur: 2 }, 'before the start: the first bar');
  seq.setTempo(60);
  seq.advance(11.9, 12.1, [{ id: 'a', n: 4 }]);
  assert.deepEqual(seq.barAt(11.99), { start: 10, dur: 2 });
  assert.deepEqual(seq.barAt(12), { start: 12, dur: 4 });
  assert.deepEqual(seq.barAt(15.9), { start: 12, dur: 4 });
  assert.deepEqual(seq.barAt(99), { start: 12, dur: 4 }, 'past the horizon: the last known bar');
});

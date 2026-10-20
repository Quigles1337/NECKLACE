import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIP_BARS, DEFAULT_CLIP_BARS, CLIP_MIME_TYPES, pickMimeType, clampClipBars, clipFilename, clipPlan } from '../src/core/clip.js';
import { defaultState, normalize } from '../src/core/state.js';

const near = (a, b, msg = '') => assert.ok(Math.abs(a - b) < 1e-9, `${a} ~ ${b} ${msg}`);

test('clip bar choices', () => {
  assert.deepEqual([...CLIP_BARS], [1, 2, 4]);
  assert.equal(DEFAULT_CLIP_BARS, 2);
  assert.equal(clampClipBars('4'), 4);
  assert.equal(clampClipBars(1), 1);
  assert.equal(clampClipBars(3), 2);
  assert.equal(clampClipBars('lots'), 2);
  assert.equal(clampClipBars(undefined), 2);
});

test('pickMimeType prefers vp9/opus, falls back to plain webm, then to the browser default', () => {
  assert.equal(CLIP_MIME_TYPES[0], 'video/webm;codecs=vp9,opus');
  assert.equal(pickMimeType(() => true), 'video/webm;codecs=vp9,opus');
  assert.equal(pickMimeType((t) => t === 'video/webm'), 'video/webm');
  assert.equal(pickMimeType(() => false), '');
  assert.equal(
    pickMimeType(() => {
      throw new Error('no MediaRecorder');
    }),
    '',
  );
});

test('clipFilename names every necklace and the tempo', () => {
  assert.equal(clipFilename(defaultState()), 'necklace-E3-8_E4-4-120bpm.webm');
  const s = normalize({ tempo: 96, necklaces: [{ k: 7, n: 12, rot: 3 }, { k: 5, n: 16 }, { k: 11, n: 24 }] });
  assert.equal(clipFilename(s), 'necklace-E7-12_E5-16_E11-24-96bpm.webm');
  assert.equal(clipFilename(s, 'png'), 'necklace-E7-12_E5-16_E11-24-96bpm.png');
});

test('clipPlan: N bars at the tempo, from the next bar boundary', () => {
  const s = defaultState(); // 120 bpm: a bar is 2 s
  const p = clipPlan(s, 2, { now: 1.3, barStart: 0, barDur: 2 });
  assert.equal(p.bars, 2);
  near(p.start, 2);
  near(p.stop, 6);
  near(p.duration, 4);
  near(p.barDur, 2);
  assert.equal(p.filename, 'necklace-E3-8_E4-4-120bpm.webm');
  // one and four bars
  near(clipPlan(s, 1, { now: 1.3, barStart: 0, barDur: 2 }).stop, 4);
  near(clipPlan(s, 4, { now: 1.3, barStart: 0, barDur: 2 }).stop, 10);
  // an invalid bar count becomes the default
  assert.equal(clipPlan(s, 7, { now: 1.3, barStart: 0, barDur: 2 }).bars, 2);
  // the bar containing now may be a later one
  near(clipPlan(s, 1, { now: 9.9, barStart: 8, barDur: 2 }).start, 10);
});

test('clipPlan: exactly on a boundary starts now; before the first bar starts at the first bar', () => {
  const s = defaultState();
  near(clipPlan(s, 1, { now: 4, barStart: 4, barDur: 2 }).start, 4);
  // the sequencer starts 80 ms in the future when the transport has just started
  const p = clipPlan(s, 1, { now: 10, barStart: 10.08, barDur: 2 });
  near(p.start, 10.08);
  near(p.stop, 12.08);
  // no clock at all: start at 0
  near(clipPlan(s).start, 0);
  near(clipPlan(s).stop, 4);
  assert.equal(clipPlan(s).bars, DEFAULT_CLIP_BARS);
});

test('clipPlan: minLead skips a boundary that is too close to arm for', () => {
  const s = defaultState();
  // 20 ms before the bar at 2: too close, so wait for the bar at 4
  near(clipPlan(s, 1, { now: 1.98, barStart: 0, barDur: 2, minLead: 0.05 }).start, 4);
  // 80 ms before it is fine
  near(clipPlan(s, 1, { now: 1.92, barStart: 0, barDur: 2, minLead: 0.05 }).start, 2);
  // before the first bar, with the first bar too close: the second bar
  near(clipPlan(s, 1, { now: 10, barStart: 10.01, barDur: 2, minLead: 0.05 }).start, 12.01);
});

test('clipPlan: a tempo change pending at the bar end is accounted for', () => {
  // the current bar still runs at 120 bpm (2 s); the state now says 60 bpm (4 s bars)
  const s = normalize({ tempo: 60, necklaces: [{ k: 3, n: 8 }] });
  const p = clipPlan(s, 2, { now: 1.5, barStart: 0, barDur: 2 });
  near(p.start, 2, 'starts when the old bar ends');
  near(p.duration, 8, 'two bars at the new tempo');
  near(p.stop, 10);
  assert.equal(p.filename, 'necklace-E3-8-60bpm.webm');
  // skipping the too-close boundary moves by one bar at the NEW tempo
  near(clipPlan(s, 1, { now: 1.99, barStart: 0, barDur: 2, minLead: 0.05 }).start, 6);
});

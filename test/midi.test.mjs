import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NOTES,
  DEFAULT_CHANNEL,
  DEFAULT_VELOCITY,
  DEFAULT_GATE,
  clampNote,
  clampChannel,
  clampVelocity,
  noteOn,
  noteOff,
  noteFor,
  midiEventsFor,
  midiTimestamp,
} from '../src/core/midi.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ~ ${b}`);

test('defaults: GM drums on channel 10', () => {
  assert.deepEqual([...DEFAULT_NOTES], [36, 38, 42, 39]);
  assert.equal(DEFAULT_CHANNEL, 10);
  assert.equal(DEFAULT_VELOCITY, 100);
  assert.ok(DEFAULT_GATE > 0 && DEFAULT_GATE < 0.2);
});

test('clamps', () => {
  assert.equal(clampNote(200), 127);
  assert.equal(clampNote(-5), 0);
  assert.equal(clampNote('60.4'), 60);
  assert.equal(clampNote('x', 42), 42);
  assert.equal(clampChannel(0), 1);
  assert.equal(clampChannel(99), 16);
  assert.equal(clampChannel(undefined), 10);
  assert.equal(clampVelocity(0), 1);
  assert.equal(clampVelocity(1000), 127);
  assert.equal(clampVelocity(null), 100);
});

test('status bytes carry the channel', () => {
  assert.deepEqual(noteOn(10, 36, 100), [0x99, 36, 100]);
  assert.deepEqual(noteOff(10, 36), [0x89, 36, 0]);
  assert.deepEqual(noteOn(1, 60), [0x90, 60, DEFAULT_VELOCITY]);
  assert.deepEqual(noteOn(16, 127, 127), [0x9f, 127, 127]);
  assert.deepEqual(noteOff(16, 0), [0x8f, 0, 0]);
});

test('noteFor falls back to the GM default by position', () => {
  assert.equal(noteFor(0), 36);
  assert.equal(noteFor(3), 39);
  assert.equal(noteFor(1, [60, 61]), 61);
  assert.equal(noteFor(2, [60, 61]), 42);
  assert.equal(noteFor(0, ['bad']), 36);
  assert.equal(noteFor(4), 36, 'wraps past four');
});

test('midiEventsFor: note-on at the onset, note-off a gate later, in time order', () => {
  const ev = midiEventsFor([{ index: 1, time: 10 }, { index: 0, time: 10.5 }], { channel: 10 });
  assert.deepEqual(
    ev.map((e) => [e.time, ...e.data]),
    [
      [10, 0x99, 38, 100],
      [10 + DEFAULT_GATE, 0x89, 38, 0],
      [10.5, 0x99, 36, 100],
      [10.5 + DEFAULT_GATE, 0x89, 36, 0],
    ],
  );
  assert.deepEqual(midiEventsFor([]), []);
});

test('midiEventsFor honours notes, channel, velocity and gate', () => {
  const ev = midiEventsFor([{ index: 2, time: 1 }], { notes: [60, 62, 64, 65], channel: 3, velocity: 80, gate: 0.25 });
  assert.deepEqual(
    ev.map((e) => [e.time, ...e.data]),
    [
      [1, 0x92, 64, 80],
      [1.25, 0x82, 64, 0],
    ],
  );
});

test('midiEventsFor shortens the gate so a note-off never crosses the next step', () => {
  // 32 steps at 240 bpm: a step is 1/32 s, the gate must shrink to half that
  const ev = midiEventsFor([{ index: 0, time: 2, dur: 1 / 32 }], { gate: 0.06 });
  near(ev[1].time - ev[0].time, 1 / 64);
  // a long step keeps the full gate
  const slow = midiEventsFor([{ index: 0, time: 2, dur: 1 }], { gate: 0.06 });
  near(slow[1].time - slow[0].time, 0.06);
});

test('simultaneous events: note-on before note-off at the same instant', () => {
  const ev = midiEventsFor([{ index: 0, time: 0 }, { index: 0, time: DEFAULT_GATE }]);
  assert.deepEqual(
    ev.map((e) => [e.time, e.data[0]]),
    [
      [0, 0x99],
      [DEFAULT_GATE, 0x89],
      [DEFAULT_GATE, 0x99],
      [2 * DEFAULT_GATE, 0x89],
    ],
  );
});

test('midiTimestamp maps the audio clock onto performance.now()', () => {
  near(midiTimestamp(10.5, 10.0, 5000), 5500);
  near(midiTimestamp(9.9, 10.0, 5000), 4900);
  near(midiTimestamp(10.0, 10.0, 5000), 5000);
});

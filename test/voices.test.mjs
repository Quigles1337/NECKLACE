import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VOICES, VOICE_IDS, playVoice } from '../src/audio/voices.js';
import { createEngine } from '../src/audio/engine.js';

// A minimal fake of the Web Audio API: enough to exercise every synth's scheduling
// path, and strict where browsers are strict (exponential ramps to <= 0 throw).
class Param {
  constructor(value) {
    this.value = value;
    this.events = [];
  }
  setValueAtTime(v, t) {
    this.events.push(['set', v, t]);
    return this;
  }
  linearRampToValueAtTime(v, t) {
    this.events.push(['lin', v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0)) throw new RangeError('exponential ramp target must be positive');
    this.events.push(['exp', v, t]);
    return this;
  }
  setTargetAtTime(v, t, k) {
    this.events.push(['target', v, t, k]);
    return this;
  }
}

class Node {
  constructor(ctx) {
    this.ctx = ctx;
    this.outputs = [];
    this.disconnected = false;
  }
  connect(n) {
    if (n === undefined || n === null) throw new TypeError('connect(undefined)');
    this.outputs.push(n);
    return n;
  }
  disconnect() {
    this.outputs = [];
    this.disconnected = true;
  }
}
class Source extends Node {
  start(t) {
    this.started = t;
    this.ctx.sources.push(this);
  }
  stop(t) {
    this.stopped = t;
  }
}
class FakeAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = new Node(this);
    this.sources = [];
  }
  createGain() {
    const n = new Node(this);
    n.gain = new Param(1);
    return n;
  }
  createOscillator() {
    const n = new Source(this);
    n.type = 'sine';
    n.frequency = new Param(440);
    n.detune = new Param(0);
    return n;
  }
  createBufferSource() {
    const n = new Source(this);
    n.buffer = null;
    n.loop = false;
    n.playbackRate = new Param(1);
    return n;
  }
  createBiquadFilter() {
    const n = new Node(this);
    n.type = 'lowpass';
    n.frequency = new Param(350);
    n.Q = new Param(1);
    n.gain = new Param(0);
    return n;
  }
  createStereoPanner() {
    const n = new Node(this);
    n.pan = new Param(0);
    return n;
  }
  createDynamicsCompressor() {
    const n = new Node(this);
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0);
    return n;
  }
  createBuffer(channels, length, sampleRate) {
    const data = new Float32Array(length);
    return { length, sampleRate, numberOfChannels: channels, getChannelData: () => data };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

test('voice table is well formed', () => {
  assert.ok(VOICES.length >= 4);
  for (const v of VOICES) assert.ok(v.id && v.label && v.hint, JSON.stringify(v));
  assert.deepEqual(VOICE_IDS, VOICES.map((v) => v.id));
  for (const id of ['tick', 'wood', 'bell', 'kick']) assert.ok(VOICE_IDS.includes(id), id);
});

test('engine builds its graph and fills the noise buffer', () => {
  const e = createEngine(FakeAudioContext);
  assert.ok(e.ctx instanceof FakeAudioContext);
  assert.ok(e.master.outputs.length === 1);
  assert.ok(e.noise.getChannelData(0).some((x) => x !== 0));
  const b0 = e.bus(0, -0.3);
  assert.equal(b0.pan.value, -0.3);
  assert.equal(e.bus(0, 0.1), b0, 'buses are cached per index');
  assert.notEqual(e.bus(1), b0);
  assert.equal(typeof e.latency(), 'number');
});

test('every voice schedules sources that start at t and stop after it', () => {
  for (const id of VOICE_IDS) {
    const e = createEngine(FakeAudioContext);
    const t = 1.25;
    playVoice(e, id, t, { dest: e.bus(0, 0), gain: 0.8 });
    const srcs = e.ctx.sources;
    assert.ok(srcs.length > 0, `${id} started nothing`);
    for (const s of srcs) {
      assert.equal(s.started, t, `${id} starts at t`);
      assert.ok(s.stopped > t, `${id} stops after t`);
      assert.ok(s.outputs.length > 0, `${id} source is connected`);
    }
    // the hit cleans up after its primary source ends
    const owner = srcs.find((s) => typeof s.onended === 'function');
    assert.ok(owner, `${id} installs cleanup`);
    owner.onended();
  }
});

test('playVoice falls through to master and rejects unknown voices', () => {
  const e = createEngine(FakeAudioContext);
  playVoice(e, 'tick', 0);
  assert.ok(e.ctx.sources.length > 0);
  assert.throws(() => playVoice(e, 'cowbell', 0), RangeError);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, LIMITS, PRESETS, clampInt, clampTempo, clampNecklace, makeNecklace, colorOf, normalize, defaultState } from '../src/core/state.js';
import { VOICE_IDS } from '../src/audio/voices.js';
import { toBox, pattern } from '../src/core/euclid.js';

test('clampInt', () => {
  assert.equal(clampInt('12', 3, 32, 8), 12);
  assert.equal(clampInt(99, 3, 32, 8), 32);
  assert.equal(clampInt(-4, 3, 32, 8), 3);
  assert.equal(clampInt('zzz', 3, 32, 8), 8);
  assert.equal(clampInt(7.6, 3, 32, 8), 8);
  assert.equal(clampTempo(1000), LIMITS.tempoMax);
  assert.equal(clampTempo(undefined), 120);
});

test('clampNecklace keeps k <= n, rot in [0, n), voice known, mute boolean', () => {
  const a = clampNecklace({ n: 8, k: 12, rot: -3, voice: 'kazoo', mute: 'yes' });
  assert.equal(a.n, 8);
  assert.equal(a.k, 8);
  assert.equal(a.rot, 5);
  assert.equal(a.voice, VOICE_IDS[0]);
  assert.equal(a.mute, true);
  const b = clampNecklace({ n: 100, k: 0 });
  assert.equal(b.n, LIMITS.nMax);
  assert.equal(b.k, 1);
  assert.equal(b.rot, 0);
  assert.equal(b.mute, false);
  const c = clampNecklace({});
  assert.equal(c.n, 8);
  assert.equal(c.k, 3);
  assert.ok(Number.isInteger(c.id));
  assert.equal(clampNecklace({ id: 42, n: 8, k: 3 }).id, 42);
  assert.notEqual(clampNecklace({}).id, clampNecklace({}).id);
});

test('presets are the paper\'s rhythms as actually played', () => {
  assert.equal(PRESETS.length, 4);
  for (const p of PRESETS) assert.ok(VOICE_IDS.includes(p.voice));
  assert.equal(toBox(pattern(PRESETS[0].k, PRESETS[0].n, PRESETS[0].rot)), 'x..x..x.');
  assert.equal(toBox(pattern(PRESETS[1].k, PRESETS[1].n, PRESETS[1].rot)), 'xxxx');
  assert.equal(toBox(pattern(PRESETS[2].k, PRESETS[2].n, PRESETS[2].rot)), 'x.x.xx.x.x.x');
  assert.equal(toBox(pattern(PRESETS[3].k, PRESETS[3].n, PRESETS[3].rot)), 'x..x..x...x..x..');
  const m = makeNecklace(5, { voice: 'bell' });
  assert.equal(m.n, PRESETS[1].n);
  assert.equal(m.voice, 'bell');
});

test('normalize coerces anything into a valid state', () => {
  const s = normalize({ tempo: '300', necklaces: [{ n: 5, k: 9 }, null, undefined, { n: 3 }, { n: 7 }, { n: 9 }, { n: 11 }] });
  assert.equal(s.tempo, 240);
  assert.equal(s.necklaces.length, LIMITS.maxNecklaces);
  assert.equal(s.necklaces[0].k, 5);
  const empty = normalize({});
  assert.equal(empty.necklaces.length, 1);
  assert.equal(empty.tempo, 120);
  assert.equal(normalize(null).necklaces.length, 1);
  assert.equal(normalize({ necklaces: 'nope' }).necklaces.length, 1);
});

test('defaultState and colours', () => {
  const s = defaultState();
  assert.equal(s.tempo, 120);
  assert.equal(s.necklaces.length, 2);
  assert.equal(s.necklaces[0].voice, 'wood');
  assert.equal(s.necklaces[1].voice, 'kick');
  assert.equal(PALETTE.length, LIMITS.maxNecklaces);
  assert.equal(colorOf(0), PALETTE[0]);
  assert.equal(colorOf(5), PALETTE[1]);
  for (const c of PALETTE) assert.match(c, /^#[0-9a-f]{6}$/);
});

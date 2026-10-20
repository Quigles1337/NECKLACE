import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAMILIES, TEMPO_RANGE, mulberry32, shuffle, candidates, pools, surprise } from '../src/core/surprise.js';
import { normalize, LIMITS } from '../src/core/state.js';
import { identify } from '../src/core/rhythms.js';
import { VOICE_IDS } from '../src/audio/voices.js';

const plain = (s) => ({ tempo: s.tempo, necklaces: s.necklaces.map(({ n, k, rot, voice, mute }) => ({ n, k, rot, voice, mute })) });

test('families nest: every step count divides the largest', () => {
  for (const f of FAMILIES) {
    const top = Math.max(...f);
    for (const n of f) assert.equal(top % n, 0, `${n} divides ${top}`);
  }
  assert.ok(TEMPO_RANGE.min >= LIMITS.tempoMin && TEMPO_RANGE.max <= LIMITS.tempoMax);
});

test('mulberry32 is deterministic and uniform-ish in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const xs = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(
    xs.slice(0, 5),
    Array.from({ length: 5 }, () => b()),
  );
  for (const x of xs) assert.ok(x >= 0 && x < 1);
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(Math.abs(mean - 0.5) < 0.05, `mean ${mean}`);
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('shuffle is a permutation and leaves the input alone', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(input, mulberry32(7));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(out.slice().sort((a, b) => a - b), input);
  assert.notDeepEqual(out, input);
});

test('candidates and pools: named, on-screen, at least two onsets, two rhythms per family', () => {
  for (const e of candidates()) {
    assert.ok(e.n >= LIMITS.nMin && e.n <= LIMITS.nMax);
    assert.ok(e.k >= 2);
    assert.ok(identify(e.k, e.n, e.rot).exact, `${e.name} is in the paper's orientation`);
  }
  const ps = pools();
  assert.ok(ps.length >= 4, 'the 16 and 24 families, plus 5, 7, 9 and 11');
  for (const p of ps) {
    const family = FAMILIES.find((f) => f.includes(p[0].n));
    for (const e of p) assert.ok(family.includes(e.n));
    assert.ok(new Set(p.map((e) => `${e.k}/${e.n}`)).size >= 2);
  }
});

test('surprise: seeded, valid, 2-3 distinct named rhythms of one family on distinct voices', () => {
  const seen = { counts: new Set(), tops: new Set() };
  for (let seed = 0; seed < 400; seed++) {
    const s = surprise(mulberry32(seed));
    assert.deepEqual(plain(normalize(s)), plain(s), `seed ${seed}: valid state`);
    assert.ok(s.necklaces.length >= 2 && s.necklaces.length <= 3, `seed ${seed}: ${s.necklaces.length} necklaces`);
    assert.ok(s.tempo >= TEMPO_RANGE.min && s.tempo <= TEMPO_RANGE.max);
    const kn = new Set(s.necklaces.map((nk) => `${nk.k}/${nk.n}`));
    assert.equal(kn.size, s.necklaces.length, `seed ${seed}: distinct rhythms`);
    const voices = new Set(s.necklaces.map((nk) => nk.voice));
    assert.equal(voices.size, s.necklaces.length, `seed ${seed}: distinct voices`);
    for (const v of voices) assert.ok(VOICE_IDS.includes(v));
    const top = Math.max(...s.necklaces.map((nk) => nk.n));
    const family = FAMILIES.find((f) => f.includes(top));
    for (const nk of s.necklaces) {
      assert.ok(family.includes(nk.n), `seed ${seed}: ${nk.n} shares a family with ${top}`);
      assert.equal(top % nk.n, 0);
      assert.ok(nk.k >= 2);
      assert.equal(nk.mute, false);
      const id = identify(nk.k, nk.n, nk.rot);
      assert.ok(id && id.exact, `seed ${seed}: E(${nk.k},${nk.n}) rot ${nk.rot} is a named rhythm as the paper plays it`);
    }
    for (let i = 1; i < s.necklaces.length; i++) assert.ok(s.necklaces[i - 1].n >= s.necklaces[i].n, 'most steps outermost');
    seen.counts.add(s.necklaces.length);
    seen.tops.add(top);
  }
  assert.deepEqual([...seen.counts].sort(), [2, 3], 'both sizes come up');
  assert.ok(seen.tops.has(16) && seen.tops.has(24), 'both big families come up');
  assert.ok([5, 7, 9, 11].some((n) => seen.tops.has(n)), 'the odd families come up too');
});

test('surprise is reproducible from a seed and varies across seeds', () => {
  assert.deepEqual(plain(surprise(mulberry32(123))), plain(surprise(mulberry32(123))));
  const scenes = new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(plain(surprise(mulberry32(i))))));
  assert.ok(scenes.size > 40, `${scenes.size} distinct scenes from 50 seeds`);
  // Math.random by default
  const s = surprise();
  assert.ok(s.necklaces.length >= 2);
});

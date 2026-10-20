import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedRequested, embedSource, stateHash, fullPageUrl, embedSnippet } from '../src/core/embed.js';
import { defaultState, decode, encode } from '../src/core/state.js';

test('embedRequested reads the query string or the hash', () => {
  assert.equal(embedRequested('?embed=1', ''), true);
  assert.equal(embedRequested('?x=2&embed=1', '#t=120&r=3.8.0.wood'), true);
  assert.equal(embedRequested('?embed', ''), true, 'a bare flag counts');
  assert.equal(embedRequested('?embed=true', ''), true);
  assert.equal(embedRequested('', '#t=120&r=3.8.0.wood&embed=1'), true);
  assert.equal(embedRequested('', 't=120&embed=1'), true, 'with or without the #');
  assert.equal(embedRequested('?embed=0', ''), false);
  assert.equal(embedRequested('?embed=no', '#embed=0'), false);
  assert.equal(embedRequested('', ''), false);
  assert.equal(embedRequested(undefined, null), false);
  assert.equal(embedRequested('?embedded=1', ''), false, 'exact key only');
});

test('embedSource says where the flag lives', () => {
  assert.equal(embedSource('?embed=1', '#embed=1'), 'search');
  assert.equal(embedSource('', '#t=120&r=3.8.0.wood&embed=1'), 'hash');
  assert.equal(embedSource('?v=2', '#t=120'), null);
});

test('decode ignores the embed flag in the hash', () => {
  const s = decode('#t=96&r=3.8.0.wood&embed=1');
  assert.equal(s.tempo, 96);
  assert.equal(s.necklaces.length, 1);
  assert.equal(encode(s), 't=96&r=3.8.0.wood', 'embed is not part of the scene');
});

test('stateHash keeps the flag only when asked', () => {
  const s = defaultState();
  assert.equal(stateHash(s), 't=120&r=3.8.0.wood&r=4.4.0.kick');
  assert.equal(stateHash(s, true), 't=120&r=3.8.0.wood&r=4.4.0.kick&embed=1');
  assert.ok(embedRequested('', '#' + stateHash(s, true)));
  assert.deepEqual(decode('#' + stateHash(s, true)).necklaces.length, 2);
});

test('fullPageUrl and embedSnippet', () => {
  const base = 'https://quigles1337.github.io/NECKLACE/';
  const s = defaultState();
  assert.equal(fullPageUrl(base, s), `${base}#t=120&r=3.8.0.wood&r=4.4.0.kick`);
  const snippet = embedSnippet(base, s);
  assert.equal(
    snippet,
    '<iframe src="https://quigles1337.github.io/NECKLACE/?embed=1#t=120&r=3.8.0.wood&r=4.4.0.kick" width="480" height="480" title="NECKLACE" loading="lazy" allow="autoplay" style="border:0;border-radius:12px;background:#0a0c12"></iframe>',
  );
  assert.match(embedSnippet(base, s, { width: 640, height: 360 }), /width="640" height="360"/);
  const src = snippet.match(/src="([^"]+)"/)[1];
  const u = new URL(src);
  assert.ok(embedRequested(u.search, u.hash));
  assert.equal(decode(u.hash).tempo, 120);
});

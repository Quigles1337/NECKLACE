import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSTER_SIZES, POSTER_FILENAME, posterLayout, posterText, shareUrl } from '../src/core/poster.js';
import { defaultState, normalize, PALETTE, encode } from '../src/core/state.js';

test('poster sizes and filename', () => {
  assert.deepEqual(POSTER_SIZES.portrait, { width: 1600, height: 2000 });
  assert.deepEqual(POSTER_SIZES.square, { width: 1600, height: 1600 });
  assert.equal(POSTER_FILENAME, 'necklace-poster.png');
});

test('posterLayout keeps every element inside the page and off each other', () => {
  for (const { width, height } of Object.values(POSTER_SIZES)) {
    for (let count = 1; count <= 4; count++) {
      const L = posterLayout({ width, height, count });
      const { stage, margin } = L;
      assert.equal(L.lines.length, count);
      // title block above the stage
      assert.ok(L.title.y < L.subtitle.y, 'title above subtitle');
      assert.ok(L.subtitle.y < stage.cy - stage.R - stage.pad, `subtitle clears the stage (${width}x${height}, ${count})`);
      // stage inside the margins, and big
      assert.ok(stage.cx - stage.R - stage.pad >= margin - 1);
      assert.ok(stage.cx + stage.R + stage.pad <= width - margin + 1);
      const floor = height > width ? 0.3 : 0.22; // portrait is the default; square gives the captions more
      assert.ok(stage.R >= width * floor, `stage radius ${stage.R} is big enough for ${width}x${height}`);
      assert.ok(stage.scale > 1, 'strokes are scaled up for print');
      // caption lines below the stage, evenly spaced, in order
      const firstTop = L.lines[0].y - L.lines[0].size;
      assert.ok(firstTop > stage.cy + stage.R + stage.pad, 'captions clear the stage');
      for (let i = 1; i < count; i++) {
        assert.equal(L.lines[i].y - L.lines[i - 1].y, L.lines[1].y - L.lines[0].y, 'even spacing');
        assert.ok(L.lines[i].y - L.lines[i].size >= L.lines[i - 1].y, 'no overlap');
      }
      for (const line of L.lines) assert.equal(line.x, margin);
      // tempo under the lines, footer at the bottom margin, nothing past the page
      assert.ok(L.tempo.y - L.tempo.size >= L.lines[count - 1].y, 'tempo clears the last line');
      assert.ok(L.url.y - L.url.size >= L.tempo.y, 'footer clears the tempo');
      assert.equal(L.url.y, height - margin);
      assert.equal(L.url.maxWidth, width - 2 * margin, 'the link may use the whole footer line');
      assert.equal(L.credit.y, L.tempo.y, 'the credit shares the tempo line, right-aligned');
      assert.equal(L.credit.x, width - margin);
      assert.ok(L.url.y <= height);
      for (const v of [L.title.size, L.subtitle.size, L.tempo.size, L.url.size, L.lines[0].size]) assert.ok(v > 0);
    }
  }
});

test('posterLayout clamps the count and scales with width', () => {
  assert.equal(posterLayout({ count: 0 }).lines.length, 1);
  assert.equal(posterLayout({ count: 9 }).lines.length, 4);
  assert.equal(posterLayout({ count: 'two' }).lines.length, 1);
  const a = posterLayout({ width: 1600, height: 2000, count: 2 });
  const b = posterLayout({ width: 800, height: 1000, count: 2 });
  assert.equal(b.margin * 2, a.margin);
  assert.equal(b.title.size * 2, a.title.size);
  assert.ok(Math.abs(b.stage.R * 2 - a.stage.R) <= 2);
});

test('posterText names every necklace, the tempo and the link', () => {
  const base = 'https://quigles1337.github.io/NECKLACE/';
  const s = normalize({
    tempo: 112,
    necklaces: [
      { k: 3, n: 8, rot: 0, voice: 'wood' },
      { k: 7, n: 12, rot: 3, voice: 'bell', mute: true },
      { k: 7, n: 12, rot: 1, voice: 'tick' },
      { k: 5, n: 14, rot: 0, voice: 'hat' },
    ],
  });
  const T = posterText(s, base);
  assert.equal(T.title, 'NECKLACE');
  assert.equal(T.necklaces.length, 4);
  assert.deepEqual(T.necklaces[0], { ekn: 'E(3,8)', name: 'Tresillo', iv: '(3 3 2)', box: 'x..x..x.', color: PALETTE[0], muted: false });
  assert.equal(T.necklaces[1].name, 'Bembé bell');
  assert.equal(T.necklaces[1].muted, true);
  assert.equal(T.necklaces[1].color, PALETTE[1]);
  assert.equal(T.necklaces[2].name, 'West African bell necklace', 'a rotation the paper does not name reads as the necklace');
  assert.equal(T.necklaces[3].name, '', 'E(5,14) is not in the paper');
  assert.equal(T.necklaces[3].iv, '(3 3 3 3 2)');
  assert.equal(T.tempo, '112 bpm · 4 beats to the bar');
  assert.equal(T.url, `${base}#${encode(s)}`);
  assert.equal(T.url, 'https://quigles1337.github.io/NECKLACE/#t=112&r=3.8.0.wood&r=7.12.3.bell.m&r=7.12.1.tick&r=5.14.0.hat');
  assert.equal(shareUrl('x', defaultState()), 'x#t=120&r=3.8.0.wood&r=4.4.0.kick');
  assert.match(T.credit, /Toussaint/);
});

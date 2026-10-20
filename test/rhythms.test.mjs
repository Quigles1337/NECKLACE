import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bjorklund, toBox, pattern } from '../src/core/euclid.js';
import { RHYTHMS, findRhythm, rotationForStart, identify, pickerEntries, pickerGroups } from '../src/core/rhythms.js';

test('the table holds the 27 rhythms of the paper, each generated exactly', () => {
  assert.equal(RHYTHMS.length, 27);
  const seen = new Set();
  for (const r of RHYTHMS) {
    assert.equal(toBox(bjorklund(r.k, r.n)), r.box, `E(${r.k},${r.n})`);
    assert.ok(r.name && r.origin, `E(${r.k},${r.n}) is named`);
    assert.ok(r.start >= 1 && r.start <= r.k, `E(${r.k},${r.n}) start in range`);
    for (const a of r.alts || []) assert.ok(a.start >= 1 && a.start <= r.k && a.name, `${a.name} start in range`);
    const key = `${r.k},${r.n}`;
    assert.ok(!seen.has(key), `duplicate ${key}`);
    seen.add(key);
  }
});

test('the paper\'s orientations: bossa nova, samba, Bembe, Aka', () => {
  const bossa = findRhythm(5, 16);
  assert.equal(toBox(pattern(5, 16, rotationForStart(5, 16, bossa.start))), 'x..x..x...x..x..');
  const samba = findRhythm(7, 16);
  assert.equal(toBox(pattern(7, 16, rotationForStart(7, 16, samba.start))), 'x.x..x.x.x..x.x.');
  const bembe = findRhythm(7, 12).alts.find((a) => a.name === 'Bembé bell');
  assert.equal(toBox(pattern(7, 12, rotationForStart(7, 12, bembe.start))), 'x.x.xx.x.x.x');
  assert.equal(rotationForStart(11, 24, findRhythm(11, 24).start), 14);
  assert.equal(rotationForStart(13, 24, findRhythm(13, 24).start), 5);
  assert.equal(rotationForStart(3, 8, 1), 0);
  assert.equal(rotationForStart(2, 5, 2), 2); // Take Five = [x . . x .]
  assert.equal(toBox(pattern(2, 5, 2)), 'x..x.');
});

test('identify names what is on screen', () => {
  assert.deepEqual(identify(3, 8, 0), { name: 'Tresillo', origin: findRhythm(3, 8).origin, exact: true });
  assert.equal(identify(3, 8, 3).exact, false);
  assert.equal(identify(3, 8, 3).name, 'Tresillo');
  assert.equal(identify(5, 8, 2).name, 'Spanish Tango');
  assert.equal(identify(7, 12, 3).name, 'Bembé bell');
  assert.equal(identify(7, 12, 15).name, 'Bembé bell'); // rotation is taken mod n
  assert.equal(identify(5, 16, 6).name, 'Bossa nova');
  assert.equal(identify(5, 16, 6).exact, true);
  assert.equal(identify(5, 16, 0).exact, false);
  assert.equal(identify(6, 17, 0), null);
});

test('picker entries cover every rhythm and every alternate, with distinct ids', () => {
  const entries = pickerEntries();
  const alts = RHYTHMS.reduce((s, r) => s + (r.alts ? r.alts.length : 0), 0);
  assert.equal(entries.length, 27 + alts);
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
  const bossa = entries.find((e) => e.name === 'Bossa nova');
  assert.equal(bossa.box, 'x..x..x...x..x..');
  assert.equal(bossa.rot, 6);
  for (const e of entries) assert.equal(e.box, toBox(pattern(e.k, e.n, e.rot)));
});

test('picker groups are ordered by n then k and lose nothing', () => {
  const groups = pickerGroups();
  const ns = groups.map((g) => g.n);
  assert.deepEqual(ns, [...ns].sort((a, b) => a - b));
  assert.equal(new Set(ns).size, ns.length);
  let total = 0;
  for (const g of groups) {
    for (let i = 1; i < g.entries.length; i++) assert.ok(g.entries[i].k >= g.entries[i - 1].k, `n=${g.n} sorted by k`);
    for (const e of g.entries) assert.equal(e.n, g.n);
    total += g.entries.length;
  }
  assert.equal(total, pickerEntries().length);
  const eight = groups.find((g) => g.n === 8);
  assert.deepEqual(eight.entries.map((e) => e.name), ['Tresillo', 'Cinquillo', 'Spanish Tango', 'Bendir']);
});

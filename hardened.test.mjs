#!/usr/bin/env node
// Each test encodes an actual bug the audits found — so this suite is the regression memory of the
// whole audit loop, distilled into the primitive that prevents it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strongHash, unitHash, guard, isFiniteNumber, asArray, finiteOr, safeString, clamp01, codeCompare, byKey, uniqueId } from './hardened.mjs';

test('strongHash is 128-bit, deterministic, and object-safe (distinct objects ≠ collide)', () => {
  assert.match(strongHash('x'), /^[0-9a-f]{32}$/);
  assert.equal(strongHash('abc'), strongHash('abc'));
  assert.notEqual(strongHash('abc'), strongHash('abd'));
  assert.notEqual(strongHash({ a: 1 }), strongHash({ a: 2 }), 'distinct objects get distinct addresses');
  assert.notEqual(strongHash({ a: 1 }), strongHash('[object Object]'), 'not String()-flattened');
});

test('strongHash throws on unserialisable content (caller isolates, never collides them)', () => {
  const circ = {}; circ.self = circ;
  assert.throws(() => strongHash(circ));
});

// GOLDEN VALUES — pin the exact hash output so the hash LOOP is guarded, not just its shape. Without these,
// mutating `i < s.length` → `i <= s.length` produces a different-but-well-formed hash that format/determinism
// checks miss (a real test-theatre gap the estate rail caught: strongHash content-addresses the whole estate).
test('strongHash / unitHash are pinned to golden values — the hash loop is exact, not merely well-formed', () => {
  assert.equal(strongHash('abc'), '1cc93dbce5d5c79f54bb0031268bd56b');
  assert.equal(unitHash('abc'), 0.1124456962570548);
});

test('unitHash is well-distributed in [0,1)', () => {
  const vals = Array.from({ length: 1000 }, (_, i) => unitHash(`k${i}`));
  assert.ok(vals.every(v => v >= 0 && v < 1));
  const inFirstDecile = vals.filter(v => v < 0.1).length;
  assert.ok(inFirstDecile > 60 && inFirstDecile < 140, `~10% land in the first decile (got ${inFirstDecile})`);
});

test('guard turns a throwing function into one that returns the fallback (never-throw boundary)', () => {
  const risky = x => { if (x < 0) throw new Error('boom'); return x * 2; };
  const safe = guard(risky, -1);
  assert.equal(safe(5), 10);
  assert.equal(safe(-5), -1, 'the throw becomes the fallback');
  // the exact classes that crashed verify()/classify() in the audits:
  assert.equal(guard(v => v.seq + 1n, 'bad')(NaN), 'bad');           // BigInt mix
  assert.equal(guard(v => String(v.id), 'bad')({ get id() { throw 1; } }), 'bad'); // toxic getter
});

test('guard is async-aware — a rejected promise resolves to the fallback', async () => {
  const safe = guard(async () => { throw new Error('async boom'); }, { valid: false });
  assert.deepEqual(await safe(), { valid: false });
  const ok = guard(async () => ({ valid: true }), { valid: false });
  assert.deepEqual(await ok(), { valid: true });
});

test('defensive readers handle hostile values', () => {
  assert.equal(isFiniteNumber(5), true);
  assert.equal(isFiniteNumber(NaN), false);
  assert.equal(isFiniteNumber('5'), false);
  assert.deepEqual(asArray('nope'), []);
  assert.deepEqual(asArray([1]), [1]);
  assert.equal(finiteOr(NaN, 7), 7);
  assert.equal(finiteOr(3, 7), 3);
  assert.equal(safeString({ toString() { throw new Error('toxic'); } }), '', 'a toxic toString yields empty, not a crash');
  assert.equal(clamp01(1.5), 1);
  assert.equal(clamp01(-2), 0);
  assert.equal(clamp01('bad'), 0);
});

test('codeCompare is a total order and locale-independent', () => {
  assert.equal(codeCompare('a', 'b'), -1);
  assert.equal(codeCompare('b', 'a'), 1);
  assert.equal(codeCompare('a', 'a'), 0);
  assert.equal(codeCompare(1, '1'), 0, 'stringified equal keys tie');
});

test('byKey sorts by an extracted key, numbers and strings', () => {
  const nums = [{ n: 3 }, { n: 1 }, { n: 2 }].sort(byKey(o => o.n));
  assert.deepEqual(nums.map(o => o.n), [1, 2, 3]);
  const desc = [{ n: 1 }, { n: 3 }, { n: 2 }].sort(byKey(o => o.n, -1));
  assert.deepEqual(desc.map(o => o.n), [3, 2, 1]);
});

// Single-digit keys sort the same numerically or lexically, so they don't guard the numeric branch. These
// pin it: 2 < 10 numerically but "2" > "10" lexically (kills `typeof===` → `!==`), and a mixed-type pair
// must fall back to codeCompare, not compute 2 - "x" = NaN (kills `&&` → `||`).
test('byKey compares numeric keys NUMERICALLY, and falls back to codeCompare on mixed types', () => {
  const cmp = byKey(o => o.n);
  assert.equal(cmp({ n: 2 }, { n: 10 }), -8, 'numeric: 2 < 10 even though "2" > "10" lexically');
  assert.equal(cmp({ n: 10 }, { n: 2 }), 8);
  assert.equal(byKey(o => o.n, -1)({ n: 2 }, { n: 10 }), 8, 'dir reverses');
  assert.equal(cmp({ n: 2 }, { n: 'x' }), -1, 'mixed types use codeCompare, never (2 - "x") = NaN');
});

test('uniqueId disambiguates duplicates — including ids that collide with the suffix pattern', () => {
  const used = new Set();
  assert.equal(uniqueId('x', used), 'x');
  assert.equal(uniqueId('x', used), 'x#0', 'second x disambiguated');
  assert.equal(uniqueId('x', used), 'x#1');
  // a crafted id equal to an existing suffix must still get a unique result
  const used2 = new Set(['a', 'a#0']);
  const got = uniqueId('a', used2);
  assert.ok(!['a', 'a#0'].includes(got), `crafted collision avoided (got ${got})`);
});

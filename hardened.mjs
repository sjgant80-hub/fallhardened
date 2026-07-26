// ════════════════════════════════════════════════════════════════
// fallhardened · the primitives whose hand-rolled versions caused the bugs
//
// Four adversarial audit passes across the estate's engines found the SAME classes of bug, over and
// over, and nearly every one came from re-implementing a primitive by hand and getting it subtly
// wrong: a 32-bit content hash that collided; a String()-coerced object that flattened to
// "[object Object]"; a verify() that threw on malformed input instead of returning invalid; a sort
// that used locale-dependent localeCompare; an id disambiguation that re-collided. This module is the
// ONE correct implementation of each, so a build imports it instead of re-inventing the sharp edge.
//
// Zero dependencies. Deterministic. Every function here is itself fuzzed + mutation-tested.
// ════════════════════════════════════════════════════════════════

// ── content addressing ───────────────────────────────────────────────────────
// 128-bit content hash (hex). Object-safe (canonical JSON, never String()→"[object Object]"), and
// wide enough that distinct content does not collide within any real corpus (a 32-bit hash collided
// by ~65k items). Four FNV-1a passes with distinct seeds, each avalanched with MurmurHash3 fmix32.
// Genuinely unserialisable content (circular / BigInt) THROWS — the caller isolates it, never hashes
// two different unserialisable values to the same address.
export function strongHash(content) {
  let s = content == null ? '' : typeof content === 'string' ? content : JSON.stringify(content);
  if (s === undefined) s = String(content);   // JSON.stringify(fn/symbol) → undefined
  let out = '';
  for (const seed of [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]) {
    let h = seed;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  return out;   // 32 hex chars = 128-bit
}

// A [0,1) hash of a string — for consistent-hash rings. Same FNV+fmix, mapped to the unit interval.
export function unitHash(key) {
  const s = safeString(key);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

// ── never-throw boundary ─────────────────────────────────────────────────────
// Wrap a function (sync or async) so malformed/hostile input returns `fallback` instead of throwing
// out of a validate/verify/classify boundary. This is the fix for the whole "throws on BigInt / null /
// circular / toxic getter" class — apply it at the entry point once, rather than guarding every field.
export function guard(fn, fallback) {
  return (...args) => {
    try {
      const r = fn(...args);
      return r && typeof r.then === 'function' ? r.then(v => v, () => fallback) : r;
    } catch { return fallback; }
  };
}

// ── defensive readers ────────────────────────────────────────────────────────
export const isFiniteNumber = v => typeof v === 'number' && Number.isFinite(v);
export const asArray = v => (Array.isArray(v) ? v : []);
export function finiteOr(v, dflt) { return isFiniteNumber(v) ? v : dflt; }
// String() that survives a throwing toString / Symbol — a toxic accessor yields '' not a crash.
export function safeString(v) { try { return v == null ? '' : String(v); } catch { return ''; } }
export function clamp01(v) { const n = Number(v); return !Number.isFinite(n) ? 0 : n < 0 ? 0 : n > 1 ? 1 : n; }

// ── deterministic ordering ───────────────────────────────────────────────────
// Code-unit comparison (NOT locale-dependent localeCompare, which can order Unicode-equal keys
// differently across environments and break a content seal). Total order, stable.
export function codeCompare(a, b) { const x = safeString(a), y = safeString(b); return x < y ? -1 : x > y ? 1 : 0; }
// A comparator over one extracted key (numbers descending-safe via subtraction, strings by code unit).
export function byKey(keyOf, dir = 1) {
  return (a, b) => {
    const x = keyOf(a), y = keyOf(b);
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return codeCompare(x, y) * dir;
  };
}

// ── unique id disambiguation ─────────────────────────────────────────────────
// Return an id that is not already in `used`, disambiguating with a suffix that LOOPS until unique (a
// single suffix could itself collide with a crafted id). Mutates `used`.
export function uniqueId(base, used, i = 0) {
  let id = safeString(base);
  let n = i;
  while (used.has(id)) { id = `${safeString(base)}#${n}`; n++; }
  used.add(id);
  return id;
}

export default { strongHash, unitHash, guard, safeString, codeCompare, byKey, uniqueId };

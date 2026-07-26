# fallhardened — specification

The contract each primitive guarantees. These are the properties `hardened.test.mjs` pins and that the
estate relies on.

## `strongHash(content) → string`
- Returns 32 lowercase hex chars (128-bit): four FNV-1a passes with distinct seeds, each avalanched with
  MurmurHash3 `fmix32`.
- **Object-safe:** objects are hashed via canonical `JSON.stringify`, never `String()`. Two structurally
  different objects do not collapse to one address.
- **Deterministic:** same content ⇒ same hash, every run, every machine.
- **Throws** on genuinely unserialisable content (circular reference, `BigInt`). This is deliberate: the
  caller isolates such content so two distinct unserialisable values never share an address.

## `unitHash(key) → number in [0,1)`
- `safeString(key)` → FNV-1a + `fmix32` → divided into the unit interval. For consistent-hash rings.
- Deterministic; well-distributed; never throws (coerces via `safeString`).

## `guard(fn, fallback) → wrappedFn`
- Returns a function that calls `fn` and returns its result, but returns `fallback` if `fn` throws.
- **Async-aware:** if `fn` returns a thenable, a rejection resolves to `fallback` (never an unhandled
  rejection). The never-throw boundary for `validate`/`verify`/`classify`.

## `safeString(v) → string`
- `null`/`undefined` → `''`. Otherwise `String(v)`, but a throwing `toString`/`Symbol` yields `''`, never
  a crash.

## `clamp01(v) → number in [0,1]`
- Coerces with `Number`; non-finite → `0`; else clamps to `[0,1]`.

## `codeCompare(a, b) → -1 | 0 | 1`
- Total order by UTF-16 code unit (via `safeString`). **Locale-independent** — unlike `localeCompare`,
  it orders identically on every machine, so a content seal computed here verifies there.

## `byKey(keyOf, dir = 1) → comparator`
- Comparator over `keyOf(x)`: numbers by subtraction (`* dir`), otherwise `codeCompare` (`* dir`).

## `uniqueId(base, used, i = 0) → string`
- Returns an id not present in the `used` set, disambiguating with a `#n` suffix that **loops** until
  unique (a single suffix could re-collide with a crafted id). Adds the result to `used`.

## `isFiniteNumber` · `asArray` · `finiteOr`
- `isFiniteNumber(v)`: `true` only for a finite `number`.
- `asArray(v)`: `v` if an array, else `[]`.
- `finiteOr(v, dflt)`: `v` if a finite number, else `dflt`.

Zero dependencies. Deterministic. Every one of these is fuzzed and mutation-tested.

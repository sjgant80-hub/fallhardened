# CLAUDE.md — fallhardened

## What this is
The estate's shared, hardened primitives. Each function is the *one* correct implementation of something
the engines kept re-deriving and getting subtly wrong across four audit passes. Import from here; do not
re-implement.

## Invariants (do not regress)
- **Zero dependencies, deterministic.** No `Math.random`, no `Date.now`, no locale-dependent calls.
- **`strongHash` is 128-bit and object-safe.** Canonical JSON, four FNV-1a passes with distinct seeds,
  each avalanched with fmix32. It THROWS on genuinely unserialisable input (circular / BigInt) *on
  purpose* — the caller must isolate such content rather than let two distinct values share an address.
  Never narrow it to 32-bit; never `String()` an object into it.
- **`guard` is the never-throw boundary.** It is async-aware: a rejected promise resolves to the fallback.
  This is the fix for the whole throw-on-malformed class — apply it at the entry point.
- **Ordering is by code unit, never `localeCompare`.** `codeCompare`/`byKey` must stay locale-independent
  or content seals differ across machines.
- **`uniqueId` loops until unique.** A single suffix can re-collide with crafted input. Keep the loop.
- **`safeString` survives a throwing `toString`.** Returns `''`, never crashes, never `"[object Object]"`.

## Every test is a real incident
`hardened.test.mjs` — each test encodes an actual bug the audits found (collision, `[object Object]`,
throw-on-BigInt, locale sort, id re-collision). Add a test by reproducing the incident first.

## Verify
- `npm test` — the suite (9 tests).
- `npx witness fuzz ./hardened.mjs guard` — the never-throw primitives must show `neverThrows: true`.
  (`strongHash` is *expected* to throw on unserialisable input — that is its contract, not a defect.)

## Do NOT
- Do not add dependencies.
- Do not "optimise" `strongHash` down to one pass or 32 bits — width is the point.
- Do not swap `codeCompare` for `localeCompare` for "nicer" ordering — it breaks determinism.

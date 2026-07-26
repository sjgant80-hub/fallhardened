# fallhardened

**Live:** [sjgant80-hub.github.io/fallhardened](https://sjgant80-hub.github.io/fallhardened/)

**The primitives whose hand-rolled versions caused the bugs.** Four adversarial audit passes across the
estate's engines found the same classes of bug over and over — and nearly every one came from
re-implementing a primitive by hand and getting it subtly wrong. This module is the *one* correct
implementation of each, so a build imports it instead of re-inventing the sharp edge.

Zero dependencies. Deterministic. Every function is fuzzed and mutation-tested (see
[witness](https://sjgant80-hub.github.io/witness/)).

## The sharp edges it removes

| Hand-rolled bug the audits found | The primitive that fixes it |
| --- | --- |
| A 32-bit content hash that **collided** by ~65k items and silently cross-bound content | `strongHash` — 128-bit, object-safe |
| `String(obj)` flattening every object to `"[object Object]"` | `strongHash` (canonical JSON) / `safeString` |
| `verify()` **throwing** on `null` / `BigInt` / circular / a toxic getter instead of returning invalid | `guard(fn, fallback)` |
| Locale-dependent `localeCompare` ordering Unicode-equal keys differently across machines, breaking a seal | `codeCompare`, `byKey` |
| An id suffix that could itself **re-collide** with a crafted id | `uniqueId` (loops until unique) |
| Consistent-hash ring positions with a weak/biased hash | `unitHash` ([0,1), FNV-1a + fmix32) |

## API

```js
import { strongHash, unitHash, guard, safeString, clamp01, codeCompare, byKey, uniqueId,
         isFiniteNumber, asArray, finiteOr } from 'fallhardened';

strongHash({ any: 'content' })   // → 32 hex chars (128-bit). THROWS on genuinely unserialisable input
                                 //   (circular / BigInt) so the caller isolates it — never two → one address
unitHash('worker#7')             // → a number in [0,1) for consistent-hash rings
guard(verify, { valid: false })  // → a version of verify() that returns the fallback instead of throwing
                                 //   (sync OR async — a rejected promise resolves to the fallback)
safeString(toxic)                // → '' even if toString() throws; never "[object Object]" surprises
clamp01(x)                       // → x clamped to [0,1]; non-finite → 0
codeCompare(a, b)                // → -1|0|1 by code unit (locale-independent, seal-safe)
byKey(o => o.score, -1)          // → a comparator; numbers by subtraction, strings by code unit
uniqueId('node', usedSet)        // → an id not in usedSet, disambiguated by a suffix that loops until unique
```

## Why a shared module and not copy-paste

The audit lesson was not "these functions had bugs" — it was that **every engine re-derived them and each
re-derivation reintroduced a different subtle failure**. One audited, fuzzed, mutation-tested
implementation, imported everywhere, means the sharp edge is filed off *once*. When a new failure mode is
found, it is fixed here and the whole estate inherits the fix.

Zero dependencies. Deterministic. MIT.

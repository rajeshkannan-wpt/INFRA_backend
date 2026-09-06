# @wpt/crypto

Single home for Signal-Protocol orchestration (X3DH, Double Ratchet, Sender
Key / Group Key) per §5 of the architecture doc: *"logic lives here ONCE,
not reimplemented per platform."*

## Why this isn't a wrapper around an npm `libsignal` package

§5 literally says "orchestration wrapper around libsignal." I checked the
current state of that ecosystem before scaffolding this (Aug 2026):

- **`@signalapp/libsignal-client`** (Signal's own, actively maintained) —
  Node native addon. No browser or React Native build. Using it would mean
  a *different* binding per platform, which is the exact per-platform
  reimplementation §5 is trying to avoid.
- **`libsignal-protocol-javascript`** (Signal's old pure-JS implementation)
  — officially archived, "no longer maintained," superseded by the native
  client above.
- **`@privacyresearch/libsignal-protocol-typescript`** — pure JS/TS port of
  the archived library, but itself last published ~3 years ago with very
  few dependents. Cross-platform, but stale.
- **`libsignal` / `@raphaelvserafim/libsignal`** (npm) — actively
  maintained, but explicitly Node.js-targeted, not verified for
  browser/RN.

There isn't currently a single, actively maintained, truly
cross-platform (Node + browser + RN) package that implements the Signal
Protocol. So instead of wrapping one, this package builds the
orchestration directly on **`@noble/curves`, `@noble/hashes`,
`@noble/ciphers`** — audited, actively maintained, pure-JS/WASM-free
primitive libraries that run identically on all three runtimes. `primitives.ts`
is the only file that touches those; `x3dh.ts`, `double-ratchet.ts`, and
`sender-key.ts` are the protocol-level orchestration that apps actually
import, matching the intent of §5 even though the dependency underneath
isn't literally named "libsignal."

**Flagging this explicitly because it's a deviation from the doc as
written — if there's a reason it has to be the actual libsignal client
(e.g. wire-format interop with an existing Signal-based system), that
changes the plan and probably pushes `apps/backend` to be the only place
that can hold the crypto engine, with web/mobile talking to it instead of
running it locally.**

## Status

Structure and type surface only (this task = monorepo scaffolding, §5).
The actual key-derivation/chaining steps in `x3dh.ts`, `double-ratchet.ts`,
and `sender-key.ts` throw `TODO` errors — implementing those is
security-critical and deserves its own reviewed change, not something to
fold into a scaffolding commit.

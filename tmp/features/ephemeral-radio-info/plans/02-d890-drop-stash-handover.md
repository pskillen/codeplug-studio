# Phase 02 handover — D890 write without hydration stash (#875)

## Hardware verify

**Status: PENDING** — no AT-D890UV on the agent session.

### Operator checklist

1. Build with this branch; open an `anytone-at-d890uv` build → Export → Web Serial.
2. Confirm the red “Write path not migrated” alert is **gone**.
3. Click **Write to radio** without a prior Read in the project — confirm modal shows live **LocalInfo serial**.
4. Complete Write; radio programmes; optional **Verify write** after restart.
5. Capture a before/after address-set dump (staging snapshot or wire log) and compare to pre-change behaviour — transmitted set is expected to **shrink** (no stash-seeded talkgroup/order leakage) but measure on hardware; do not assume counts.

### Notes for verifier

- Sparse erase-unit RMW is unchanged — optional settings / alarm bytes should still match fresh-read preservation.
- Satellite keps write path was not modified.
- Cross-session identity is now **operator confirm** on serial, not stash-vs-live in protocol.

## Address-set expectation (unit-level)

Upload cache is seeded from the **assembled write image** on connect (`applyAtD890WriteImageToCache`), not from `cacheFromBag`. Stash-seeded `LocalInfo` and talkgroup stride blocks are no longer in the pre-upload cache snapshot. Hardware should confirm fewer spurious 16-byte chunks outside touched erase units.

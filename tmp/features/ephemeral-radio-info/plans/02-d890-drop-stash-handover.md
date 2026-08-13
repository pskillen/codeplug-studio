# Phase 02 handover — D890 write without hydration stash (#875)

## Hardware verify

**Status: PENDING** — operator hardware after the in-session encode-base correction on [PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118). Do **not** rebase phase 3 (`876/pskil/radio-info-ephemeral`) until the radio boots.

[PR #1126](https://github.com/pskillen/codeplug-studio/pull/1126) (`1125/pskil/d890-zonehide-visible`, ZoneHide + [#1129](https://github.com/pskillen/codeplug-studio/issues/1129) zeros overlay) is **parked**. Do not hardware-test zeros overlay.

### Operator checklist

1. Build **this** branch only (`875/pskil/d890-write-base-live`); open an `anytone-at-d890uv` build → Export → Web Serial.
2. Confirm the red “Write path not migrated” alert is **gone**.
3. Click **Write to radio** without a prior Read in the project — confirm modal shows live **LocalInfo serial**.
4. **Before Write:** dump `radioIdSet`, `radioIdData`, `masterIdData`, `channelSet` tail (last 12 bytes), `zoneHide`, and a sample channel AES byte (`0x22`).
5. Complete Write; radio must **boot** (no _Program Error Please Initialize The Radio_). Optional **Verify write** after restart.
6. **After Write:** dump the same regions. Occupancy / RadioId records / master / ChannelSet tail / AES must **match the pre-write preserve story** (empty `radioIds` projection and unmodelled AES left alone; occupied ZoneHide clear unless hide is modelled). Recover with `origin/main` + stash (`R/21-40`) if needed.

### Notes for verifier

- Sparse erase-unit RMW is unchanged — optional settings / alarm bytes should still match fresh-read preservation **outside** the modelled overlay.
- Satellite keps write path was not modified.
- Cross-session identity is **operator confirm** on serial, not stash-vs-live in protocol.
- Empty in-session download cache refuses Write (no `0xff` assemble fallback).

## Address-set expectation (unit-level)

Upload cache comes from this PROGRAM session `download()`, then modelled overlay via `encodeAtD890ProjectionOntoImage`. Stash-seeded `LocalInfo` and talkgroup stride blocks are no longer in the pre-upload cache snapshot. Hardware should confirm fewer spurious 16-byte chunks outside touched erase units.

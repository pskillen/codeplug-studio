# AT-D890UV APRS serial Write — progress

**Tracking:** [#758](https://github.com/pskillen/codeplug-studio/issues/758) · follow-up [#884](https://github.com/pskillen/codeplug-studio/issues/884) · **Branch:** `884/pskillen/at-d890uv-aprs-slot-cache-sync`

## Status

Code complete — hardware verify still pending (re-run after #884 cache-sync fix).

## Shipped in branch

- Tier-3 [aprs.md](../../reference/radios/anytone/at-d890uv/aprs.md) + memory-layout / Write-contract updates
- Sparse Read of `AprsConfigMain` + `AprsReceiveFilters`
- `aprsCodec.ts` — patch modelled global fields; `channelCodec` digital APRS bits
- `radioIoWriteProjection` → `organisation.aprs` for `radio-io-at-d890uv`
- WATCH-08 allow-list + write coverage row
- Unit tests: `aprsCodec.test.ts`, channel APRS round-trip, hydration merge, writable extents
- [#884](https://github.com/pskillen/codeplug-studio/issues/884): `applyAtD890WriteImageToCache` calls `syncAprsRegionsToCache` so patched `AprsConfigMain` reaches `listWriteChunks` (regression in `memory.test.ts`)

## Hardware verify checklist

When a D890UV is available:

1. Fresh **Read** in Studio (Web Serial egress).
2. Change digital APRS in library: global intervals, fixed location, slot channel/TG, per-channel receive + digital report binding.
3. **Write** from build.
4. **Read** again; compare modelled global bytes (`0x3501000` modelled offsets) and channel APRS bits against expectations.
5. Confirm optional GPS (`0x3501280`) and RX filters unchanged unless intentionally edited on radio.
6. Confirm digital report slots 2–N show intended MR channels (not VFO A) — [#884](https://github.com/pskillen/codeplug-studio/issues/884).

Record outcome in [at-d890uv-aprs-write-outstanding.md](at-d890uv-aprs-write-outstanding.md).

## WATCH-08 fence review

Deliberate allow-list additions for [#758](https://github.com/pskillen/codeplug-studio/issues/758) per [#753](https://github.com/pskillen/codeplug-studio/issues/753):

- `AprsConfigMain` `0x3501000`/`0x260` — modelled global APRS (patch-only)
- `AprsReceiveFilters` `0x3501300`/`0x100` — on allow-list for RMW integrity; Studio does not re-encode filter bodies
- `OptionalSettingsAprs` `0x3501280` — remains **sentinel / never-write**

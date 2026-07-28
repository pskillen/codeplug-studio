# AT-D890UV APRS serial Write — progress

**Tracking:** [#758](https://github.com/pskillen/codeplug-studio/issues/758) · **Branch:** `758/pskillen/at-d890uv-aprs-serial-write`

## Status

In progress — implementation slices 1–5.

## Shipped in branch

- (pending commits)

## Hardware verify checklist

When a D890UV is available:

1. Fresh **Read** in Studio (Web Serial egress).
2. Change digital APRS in library: global intervals, fixed location, slot channel/TG, per-channel receive + digital report binding.
3. **Write** from build.
4. **Read** again; compare modelled global bytes (`0x3501000` modelled offsets) and channel APRS bits against expectations.
5. Confirm optional GPS (`0x3501280`) and RX filters unchanged unless intentionally edited on radio.

Record outcome in [at-d890uv-aprs-write-outstanding.md](at-d890uv-aprs-write-outstanding.md).

## WATCH-08 fence review

Deliberate allow-list additions for [#758](https://github.com/pskillen/codeplug-studio/issues/758) per [#753](https://github.com/pskillen/codeplug-studio/issues/753):

- `AprsConfigMain` `0x3501000`/`0x260` — modelled global APRS (patch-only)
- `AprsReceiveFilters` `0x3501300`/`0x100` — on allow-list for RMW integrity; Studio does not re-encode filter bodies
- `OptionalSettingsAprs` `0x3501280` — remains **sentinel / never-write**

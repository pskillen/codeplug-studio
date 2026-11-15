# Dm32Memory

## Purpose

Read-only DM-32UV Memory viewer: channels decoded from the open debug archive (live read or file), without a project, library or build, and without opening a transport. Zones, scan lists, talk groups, RX groups, contacts and settings show "Not yet available".

## Props

| Prop      | Meaning                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| `archive` | Optional open `DebugArchive`. Absent asks for a capture; a non-DM-32 archive is refused. |

## Usage

`RadioDebugPage` mounts it in the Memory tab of the `dm-32uv` profile with the selected retained read. It keys itself by archive identity (`archiveKey`), so replacing the archive resets search and sort.

## Behaviour

`buildDm32SparseCapture` (`integrations/radio-io/radios/dm32uv/debugMemory.ts`) takes accepted whole 4 KiB blocks from `classifyDm32DebugCoverage` and lists its refusals with reasons. Channel page order comes only from the `debug/capture.json` discovery map: channel page k is the k-th discovered block with tag `0x12` to `0x40` in tag order (`0x41` is the VFO bank and is excluded). Without a map the panel says "Page order not established". The channel count is the u16 at the first channel page; the stated count above the 4,000 hardware slots is reported, not listed. Each slot needs its 48 captured bytes; a page whose stored tag disagrees with discovery counts as not captured. States: decoded, empty (all `0xFF`), blank record (no name or RX, not erased; raw bytes shown), not captured. A decoded record shows "Invalid BCD" with raw bytes for RX/TX nibbles above 9, "No TX frequency stored" when the TX bytes are all `0xFF`, and the raw mode byte. Scan list, RX group and TX contact indexes are raw, unresolved numbers. Channels have one name field, so that complete label is searched and sorted; callsign data is unavailable.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md), [RadioDebugPage](RadioDebugPage.md), [DM-32UV channel record](../../../../../docs/reference/radios/baofeng/dm-32uv/channel-record.md)

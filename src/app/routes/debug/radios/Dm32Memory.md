# Dm32Memory

## Purpose

Read-only DM-32UV Memory viewer: channels, zones, scan lists, talk groups, radio IDs and contacts decoded from the open debug archive (live read or file), without a project, library or build, and without opening a transport. RX groups and settings show "Not yet available".

## Props

| Prop      | Meaning                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| `archive` | Optional open `DebugArchive`. Absent asks for a capture; a non-DM-32 archive is refused. |

## Usage

`RadioDebugPage` mounts it in the Memory tab of the `dm-32uv` profile with the selected retained read. It keys itself by archive identity (`archiveKey`), so replacing the archive resets search and sort.

## Behaviour

`buildDm32SparseCapture` (`integrations/radio-io/radios/dm32uv/debugMemory.ts`) takes accepted whole 4 KiB blocks from `classifyDm32DebugCoverage` and lists its refusals with reasons. Channel page order comes only from the `debug/capture.json` discovery map: channel page k is the k-th discovered block with tag `0x12` to `0x40` in tag order (`0x41` is the VFO bank and is excluded). Without a map the panel says "Page order not established". The channel count is the u16 at the first channel page; the stated count above the 4,000 hardware slots is reported, not listed. Each slot needs its 48 captured bytes; a page whose stored tag disagrees with discovery counts as not captured. States: decoded, empty (all `0xFF`), blank record (no name or RX, not erased; raw bytes shown), not captured. A decoded record shows "Invalid BCD" with raw bytes for RX/TX nibbles above 9, "No TX frequency stored" when the TX bytes are all `0xFF`, and the raw mode byte. Scan list, RX group and TX contact indexes are raw, unresolved numbers. Zones and scan lists (`debugMemoryZones.ts`) keep radio order and list only records within the stated count (capped at 250 zones and 32 lists); a record whose page was not captured is "Not captured", a record with no name is vacant. Zone pages come from the discovery map (tags `0x5C` to `0x64`, 28 records per page, the first page's records start at `+16`; header bytes are shown raw and the meaning of the stored count is unverified); the scan-list page is the single `0x11` page and works without a discovery map. Members are channel slot numbers resolved against the decoded channels with a DM-32 status set (resolved, out of range, empty, not captured, inventory not captured, unreadable), order and duplicates kept; a zone member count above 64 is shown raw and reads no members. A scan list stores named members plus one for the implicit current channel; hang, priority and designated-TX bytes are raw hex only. Selecting a zone or scan list shows its members; search covers the name and member labels. A channel's scan list id resolves to the scan list's name, or reads absent. Channels have one name field, so that complete label is searched and sorted; callsign data is unavailable.

Talk groups, radio IDs and analogue contacts (`debugMemoryLists.ts`, panels in `Dm32MemoryLists.tsx`) look a page up by its stored tag and use it only when exactly one accepted block carries it; several are listed ("Several pages tagged 0xNN, not decoded") and a missing page is "Not captured". Talk groups (tag `0x44`) are 24-byte entries after one header byte, ending at the first all-zero or all-`0xFF` entry, at most 170 per page; the quick-access page `0x0B` count (u16 at `+0`) is shown beside the decoded count with a mismatch warning, a count above 800 is reported and not listed, and tags `0x45` to `0x48` are listed as present or not captured, layout not established, so the list is never called complete. Radio IDs (tag `0x67`) use a count byte (cap 250) and 16-byte entries from `+0x10`; vacant positions are counted, not listed. Contacts always says the digital address book (V-frame `0x0F` bank) is not captured; analogue contacts (tag `0x06`) show the count byte at `+0x1FF` and raw 32-byte records from `+0x200` as hex only. Talk groups and radio IDs have a name only: search and sort cover name and DMR ID, and callsign data is unavailable. Channel TX contact and RX group stay raw numbers (resolution is a later piece).

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md), [RadioDebugPage](RadioDebugPage.md), [DM-32UV channel record](../../../../../docs/reference/radios/baofeng/dm-32uv/channel-record.md)

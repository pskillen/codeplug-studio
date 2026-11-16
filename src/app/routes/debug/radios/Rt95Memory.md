# RT95 memory viewer

## Purpose

Inspect captured clone channels, MMD1 zones and P-key bytes without a library or build.

## Props and usage

`Rt95Memory` takes a `DebugArchive`; `Rt95MemoryView` (the RT95 descriptor's `Memory`) wraps it with the no-capture alert and the not-decoded lines. Settings are the page-level Settings tab, `Rt95Settings` (projection plus `useSensitiveReveal`, rendering [Rt95MemorySettings](Rt95MemorySettings.md)).

## Behaviour

Channels, Zones and P-keys are categories of the shared [MemoryCategories](../../../components/debug/MemoryCategories.md) dropdown (default Channels, last choice remembered); the zone and P-key content below is unchanged.

The viewer re-evaluates the two preserved chip-guard probes and checks the recorded outcome before describing guard evidence as verified. It validates MMD1 through the shared decoder and shows zones independently of clone availability. Each zone is a block: name and number, a member count, a valid or invalid member CRC badge, then a table of members resolved from the same decoded slots the channel table uses (no second decode). The column is "Radio name / description", radio name first; the RT95 record has no callsign field, and the MM9PDY target writes the callsign into the radio name when the channel has one, so the viewer does not claim a callsign. Members whose slot is empty, unavailable or unreadable (invalid frequency BCD, or invalid power, width or enabled tone values) are not listed: one line counts them ("N members point at empty or unreadable slots") and expands to the slot numbers and reasons. ZST1 state is validated separately. P-key DIR is a stored value, not firmware detection. Body EEPROM is reached through the head, which can return checksum-valid zeros without a body reply. All output is read-only.

Clone slots can be searched, sorted and filtered to include empty slots. The viewer exposes exact width, custom tones, raw duplex and signalling, and a 32-byte record detail; invalid or unavailable fields are identified. Settings are shown by `Rt95MemorySettings` (every registered field, grouped, searchable, with trust, targets, raw bytes and the unclaimed runs, each named with a confidence: 42 bytes with a meaning, 93 unused (no reader)); the power-on password is masked until **Show password**, using `useSensitiveReveal`. VOX enable is bit 0. Validated MMD1 descriptions supplement the wire name only when their CRC and channel fingerprint match. Provenance is stated once per section in a dimmed line (clone image: the storage MCU is not documented; MMD1 data: main board), not on every cell. Only a channel description keeps its `[body]` tag.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md) · [RT95 debug reference](../../../../../docs/reference/radios/retevis/rt95/debug-memory.md)

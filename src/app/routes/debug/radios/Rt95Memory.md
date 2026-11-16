# RT95 memory viewer

## Purpose

Inspect captured clone channels, MMD1 zones and P-key bytes without a library or build.

## Props and usage

`Rt95Memory` takes a `DebugArchive`; `Rt95MemoryView` (the RT95 descriptor's `Memory`) wraps it with the no-capture alert and passes the descriptor's `notDecoded` to the category dropdown (one line, not a line per category). Sentences live in `rt95/debugMemoryText.ts`. Settings are the page-level Settings tab: the shared `SettingsTab` and `SettingsTable` draw the view `rt95SettingsView` (`rt95/debugSettingsView.ts`) builds from `projectRt95Settings`.

## Behaviour

Channels, Zones and P-keys are categories of the shared [MemoryCategories](../../../components/debug/MemoryCategories.md) dropdown (default Channels, last choice remembered); the zone and P-key content below is unchanged.

The viewer re-evaluates the two preserved chip-guard probes and checks the recorded outcome before describing guard evidence as verified. It validates MMD1 through the shared decoder and shows zones independently of clone availability. Each zone is a block: name and number, a member count, a valid or invalid member CRC badge, then a table of members resolved from the same decoded slots the channel table uses (no second decode). The column is "Radio name / description", radio name first; the RT95 record has no callsign field, and the MM9PDY target writes the callsign into the radio name when the channel has one, so the viewer does not claim a callsign. Members whose slot is empty, unavailable or unreadable (invalid frequency BCD, or invalid power, width or enabled tone values) are not listed: one line counts them ("N members point at empty or unreadable slots") and expands to the slot numbers and reasons. ZST1 state is validated separately. P-key DIR is a stored value, not firmware detection. Body EEPROM is reached through the head, which can return checksum-valid zeros without a body reply. All output is read-only.

Zones and P-keys are `MemoryCategoryPanel`s too: the header, guard and ZST1 selection lines stay above the Zones table; a zone row opens the owner-approved member table below it (radio name, then description, filler hidden and counted); P-keys is a table of group, key, byte and meaning. Their sentences are in `rt95/debugMemoryText.ts`. The Channels category is a `MemoryCategoryPanel`: slot, identity (the radio name, the only name the record has; empty or unreadable slots are named in the identity column), description, then the decoded fields. There is no Occupancy column (it read "occupied" on every listed row). Slots can be searched, sorted and filtered to include empty slots; clicking a row shows its 32-byte raw record below the table. The viewer exposes exact width, custom tones, raw duplex and signalling; invalid or unavailable fields are identified. The Settings tab shows every registered field in striped groups (Setting, Value, Confidence; the confidence evidence names the CPS/CHIRP layout source and write targets; address and raw bytes behind the raw switch) and the unclaimed runs in a folded section, each named with a confidence: 42 bytes with a meaning, 93 unused (no reader); the power-on password is masked until **Show password**, using `useSensitiveReveal`. VOX enable is bit 0. Validated MMD1 descriptions supplement the wire name only when their CRC and channel fingerprint match. Provenance is stated once per section in a dimmed line (clone image: the storage MCU is not documented; MMD1 data: main board), not on every cell. Only a channel description keeps its `[body]` tag.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md) · [RT95 debug reference](../../../../../docs/reference/radios/retevis/rt95/debug-memory.md)

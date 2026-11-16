# RT95 memory viewer

## Purpose

Inspect captured clone channels, all registered settings, MMD1 zones and P-key bytes without a library or build.

## Props and usage

`Rt95Memory` takes a `DebugArchive`; `MemoryViewer` mounts it for RT95 archives. Related: [Rt95MemorySettings](Rt95MemorySettings.md).

## Behaviour

The viewer re-evaluates the two preserved chip-guard probes and checks the recorded outcome before describing guard evidence as verified. It validates MMD1 through the shared decoder and shows zones independently of clone availability. Members use one-based radio slots and are resolved against captured occupancy and channel records; records with invalid frequency BCD or invalid power, width or enabled tone values are shown as unreadable. ZST1 state is validated separately. P-key DIR is a stored value, not firmware detection. Body EEPROM is reached through the head, which can return checksum-valid zeros without a body reply. All output is read-only.

Clone slots can be searched, sorted and filtered to include empty slots. The viewer exposes exact width, custom tones, raw duplex and signalling, and a 32-byte record detail; invalid or unavailable fields are identified. Settings are shown by `Rt95MemorySettings` (every registered field, grouped, searchable, with trust, targets, raw bytes and the unclaimed runs, each named with a confidence: 42 bytes with a meaning, 93 unused (no reader)); the power-on password is masked until **Show password**, using `useSensitiveReveal`. VOX enable is bit 0. Validated MMD1 descriptions supplement the wire name only when their CRC and channel fingerprint match. Clone fields are [unknown] and descriptions [body].

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md) · [RT95 debug reference](../../../../../docs/reference/radios/retevis/rt95/debug-memory.md)

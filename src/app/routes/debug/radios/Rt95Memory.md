# RT95 memory viewer

## Purpose

Inspect captured MMD1 zones and P-key bytes without a library or build.

## Props and usage

`Rt95Memory` takes a `DebugArchive`; `MemoryViewer` mounts it for RT95 archives.

## Behaviour

The viewer re-evaluates the two preserved chip-guard probes and checks the recorded outcome before describing guard evidence as verified. It validates MMD1 through the shared decoder and shows zones independently of clone availability. Members use one-based radio slots and are resolved against captured occupancy and channel records; records with invalid frequency BCD or invalid power, width or enabled tone values are shown as unreadable. ZST1 state is validated separately. P-key DIR is a stored value, not firmware detection. Body EEPROM is reached through the head, which can return checksum-valid zeros without a body reply. All output is read-only.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md) · [RT95 debug reference](../../../../../docs/reference/radios/retevis/rt95/debug-memory.md)

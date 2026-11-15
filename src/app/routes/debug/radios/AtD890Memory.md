# AtD890Memory

## Purpose

Read-only AT-D890UV Memory viewer: MR channels and zones decoded from the open debug archive, without a project, library or build.

## Props

| Prop      | Meaning                                                                               |
| --------- | ------------------------------------------------------------------------------------- |
| `archive` | Optional open `DebugArchive`. Absent shows a no-capture state; a non-D890 is refused. |

## Usage

`RadioDebugPage` mounts it in the Memory tab of the `at-d890uv` profile. It sits under the existing design-system v2 provider.

## Behaviour

Projection is in `integrations/radio-io/radios/at-d890uv/debugMemory.ts`: only recognised, length-matched, in-bounds sparse entries count; duplicates and overlaps are refused; coverage is byte-exact. Channels and zones list only after their complete occupancy bitmap is captured, otherwise the panel says "Not captured". Slots keep their one-based numbers. Missing record halves stay visible as "Not captured", distinct from a captured empty or unreadable record. Zone names and member lists decode independently; members keep radio order and duplicates, and each zero-based index resolves to channel slot index plus one, with distinct explanations for absent, not-captured, unreadable, out-of-range and unresolvable references. Identity is the single complete name field (it may contain a callsign); separate callsign and name are unavailable. Tables are v2 `DataTable`s with search and temporary sorting, default slot order. Contacts, talk groups, RX groups, scan lists and settings show "Coming in a later piece". Replacing the archive remounts the viewer, resetting rows, references and the selected zone.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md), [RadioDebugPage](RadioDebugPage.md)

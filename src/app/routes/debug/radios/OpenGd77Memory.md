# OpenGd77Memory

## Purpose

Read-only OpenGD77 (DM-1701, MD-9600) Memory viewer: channels, zones, contacts, RX groups, the User Database decoded from the open debug archive's captured FLASH spans, without a project, library or build. Settings are the page-level Settings tab ([SettingsTab](SettingsTab.md), view built by `opengd77/debugSettingsView.ts` from `debugSettings.ts`: the firmware struct at `0x604B` is decoded only after its magic `0x4780` checks, a wrong or missing magic shows as a reason under the Firmware settings group with no field named, a member not wholly captured reads Not captured or Partly captured, and the codeplug `prgPwd` and boot PIN rows are sensitive and hidden until **Show password**; Hex masks the same bytes), not an inner tab.

## Props

| Prop      | Meaning                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| `archive` | Optional open `DebugArchive`. Absent shows a no-capture state; refusals are listed. |

## Usage

Set as the `Memory` component on both OpenGD77 descriptors; `RadioDebugPage` mounts it in the Memory tab, keyed by the selected read so replacing the archive remounts it. It sits under the design-system v2 provider.

## Behaviour

Channels and Zones are drawn by the shared [MemoryCategoryPanel](../../../components/debug/MemoryCategoryPanel.md) (click a zone for its members below the table); sentences come from `opengd77/debugMemoryText.ts`. Contacts, RX groups (click a list for its members) and the User Database (opt-in, paged, with its submitted whole-database search; the panel's search box filters the visible page) are drawn by it too, from `OpenGd77Directories.tsx`.

Its categories (Channels, Zones, Contacts, RX groups, User Database) are chosen from the shared [MemoryCategories](../../../components/debug/MemoryCategories.md) dropdown, not inner tabs.

Projection is in `integrations/radio-io/radios/opengd77/debugMemory.ts`: only registered `flash-span-N` entries with the span's address, a length within the span and matching stored bytes count; wrong, duplicate or overlapping entries are refused with a reason; coverage is byte-exact and never gap-filled. A channel bank is decoded only when its whole `0x1C10` bytes were captured; a missing bank is one "Not captured" line (first to last slot) above the table, not 128 rows. Slots keep one-based numbers; an occupied bitmap bit with an empty record is labelled as such. Power is the model's own ladder step (from `openGd77DebugModel`), "Default" for none. Identity is the single name field (OpenGD77 records carry no separate callsign). TX contact and RX group show as unresolved numbers (not resolved against the contact bank here). Tables are v2 `DataTable`s with search and temporary sorting, default slot order. The zone bank must be wholly captured; unnamed zones are listed; selecting a zone shows members in radio order with duplicates and each resolution (resolved, absent, empty record, not captured, out of range). The Contacts, RX groups and User Database tabs mount the panels from [OpenGd77Directories](OpenGd77Directories.md).

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md), [RadioDebugPage](RadioDebugPage.md), [debug-memory.md](../../../../../docs/reference/radios/opengd77/debug-memory.md)

# MembershipSortMenu

## Purpose

One-shot **Sort…** menu for library membership / zone order. Confirms before calling `onSort` — overwrites the current order (no undo).

## Props

| Prop             | Type                   | Description                                               |
| ---------------- | ---------------------- | --------------------------------------------------------- |
| `modes`          | `MembershipSortMode[]` | Optional subset (default: name/callsign/duplex/band/mode) |
| `disabled`       | `boolean`              | Disable the menu trigger                                  |
| `onSort`         | `(mode) => void`       | Called after confirm                                      |
| `label`          | `string`               | Button label (default `Sort…`)                            |
| `confirmMessage` | `(mode) => string`     | Optional confirm body (default library copy)              |

## Behaviour

- Uses `window.confirm` with `membershipSortConfirmMessage` by default, or `buildExportSortConfirmMessage` / `buildExportSortSelectionConfirmMessage` on build wire surfaces.
- Does **not** persist a sort setting — callers rewrite ordered arrays / `Zone.order` / build `orderOrSlot`.
- Flat-memory Channels uses two instances: **Sort channels…** (full list) and **Sort selection…** (collate + sort selected only; disabled when fewer than 2 rows selected).

## Related

- [`membershipSort.ts`](../../../../src/core/domain/membershipSort.ts)
- [zone-member-picker.md](../../../../docs/features/library/zone-member-picker.md)
- [`BuildFlatMemoryChannelsPage`](../../routes/builds/BuildFlatMemoryChannelsPage.tsx)

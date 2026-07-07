# ChannelBulkEditModal

Modal for applying opt-in field changes to multiple library channels from the channels list.

## Purpose

Operators multi-select channels on `/library/channels` and bulk-update common fields without opening each channel editor. Mode-profile fields only patch channels that already have the relevant profile — modes are never added or removed.

## Props

| Prop        | Type                                               | Description                                   |
| ----------- | -------------------------------------------------- | --------------------------------------------- |
| `opened`    | `boolean`                                          | Mantine modal open state                      |
| `onClose`   | `() => void`                                       | Close without persisting                      |
| `channels`  | `Channel[]`                                        | Selected channels in table order (2 or more)  |
| `onApplied` | `(outcome: PersistChannelBulkEditSuccess) => void` | Called after a successful apply, before close |

## Usage

```tsx
<ChannelBulkEditModal
  opened={bulkEditOpen}
  onClose={() => setBulkEditOpen(false)}
  channels={selectedChannels}
  onApplied={(outcome) => {
    setMessage(formatChannelBulkEditMessage(outcome));
    setSelectedKeys([]);
  }}
/>
```

Single-channel selection is handled by the list page (navigate to the channel editor) — do not open this modal for one channel.

## Behaviour

- Title shows **Bulk edit** with a badge count of selected channels.
- **View selected channels** expands a compact scrollable name list.
- Each field has a **Change …** checkbox; unchecked fields are omitted from the patch and their controls are disabled.
- Channel-level fields (`scanInclusion`, `forbidTransmit`, `power`) apply to every selected channel when enabled.
- **Analog mode settings** accordion appears only when at least one selected channel has an analog mode profile. Squelch updates all analog profiles on each affected channel; channels without analog modes are skipped (impact text explains the split).
- **Apply** runs `persistChannelBulkEdit` with revision checks; revision conflicts show an error and leave the parent selection intact.
- Core patch logic: `@core/domain/channelBulkEdit.ts`.

## Related

- [library/README.md](../../../docs/features/library/README.md) — channels list bulk edit workflow ([#207](https://github.com/pskillen/codeplug-studio/issues/207))
- `ScanInclusionSegment`, `ForbidTransmitSegment`, `PercentLevelSlider`

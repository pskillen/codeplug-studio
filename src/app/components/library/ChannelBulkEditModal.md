# ChannelBulkEditModal

Modal for applying opt-in field changes to multiple library channels from the channels list, and for bulk-deleting the selection.

## Purpose

Operators multi-select channels on `/library/channels` and bulk-update common fields without opening each channel editor. The same modal also offers **bulk delete** with a confirmation step ([#310](https://github.com/pskillen/codeplug-studio/issues/310)). Mode-profile fields only patch channels that already have the relevant profile — modes are never added or removed.

## Props

| Prop           | Type                                                        | Description                                   |
| -------------- | ----------------------------------------------------------- | --------------------------------------------- |
| `opened`       | `boolean`                                                   | Mantine modal open state                      |
| `onClose`      | `() => void`                                                | Close without persisting                      |
| `channels`     | `Channel[]`                                                 | Selected channels in table order (2 or more)  |
| `projectId`    | `string \| null`                                            | Active project for delete                     |
| `deleteEntity` | `(kind: 'channel', id: string) => Promise<DeleteOutcome>`   | Library delete with integrity                 |
| `reload`       | `() => Promise<void>`                                       | Refresh library after delete                  |
| `onApplied`    | `(outcome: PersistChannelBulkEditSuccess) => void`          | Called after a successful apply, before close |
| `onDeleted`    | `(outcome: PersistChannelBulkDeleteOutcome) => void`        | Called when one or more channels were deleted |

## Usage

```tsx
const { projectId, deleteEntity, reload } = useLibrary();

<ChannelBulkEditModal
  opened={bulkEditOpen}
  onClose={() => setBulkEditOpen(false)}
  channels={selectedChannels}
  projectId={projectId}
  deleteEntity={deleteEntity}
  reload={reload}
  onApplied={(outcome) => {
    setMessage(formatChannelBulkEditMessage(outcome));
    setSelectedKeys([]);
  }}
  onDeleted={(outcome) => {
    setMessage(formatChannelBulkDeleteMessage(outcome));
    setMessageColor(bulkDeleteAlertColor(outcome));
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
- **Delete N channels** (footer, left) opens an in-modal confirmation. Confirm runs `persistChannelBulkDelete` with zone auto-cascade (same integrity as single delete). Partial blocks close the modal when at least one channel was deleted; total failure stays open with an error.
- Core patch logic: `@core/domain/channelBulkEdit.ts`.

## Related

- [library/README.md](../../../docs/features/library/README.md) — channels list bulk edit/delete ([#207](https://github.com/pskillen/codeplug-studio/issues/207), [#310](https://github.com/pskillen/codeplug-studio/issues/310))
- `ScanInclusionSegment`, `ForbidTransmitSegment`, `PercentLevelSlider`
- `persistChannelBulkDelete` in `src/app/lib/channelBulkDelete.ts`

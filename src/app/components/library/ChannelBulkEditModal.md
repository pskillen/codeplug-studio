# ChannelBulkEditModal

Modal for applying opt-in field changes to multiple library channels from the channels list, and for bulk-deleting the selection.

## Purpose

Operators multi-select channels on `/library/channels` and bulk-update common fields without opening each channel editor. The same modal also offers **bulk delete** with a confirmation step ([#310](https://github.com/pskillen/codeplug-studio/issues/310)). Mode-profile fields only patch channels that already have the relevant profile — modes are never added or removed.

## Props

| Prop           | Type                                                      | Description                                   |
| -------------- | --------------------------------------------------------- | --------------------------------------------- |
| `opened`       | `boolean`                                                 | `ModalShell` open state                       |
| `onClose`      | `() => void`                                              | Close without persisting                      |
| `channels`     | `Channel[]`                                               | Selected channels in table order (2 or more)  |
| `projectId`    | `string \| null`                                          | Active project for delete                     |
| `library`      | `Library`                                                 | Zones, APRS configuration, and channel slots  |
| `deleteEntity` | `(kind: 'channel', id: string) => Promise<DeleteOutcome>` | Library delete with integrity                 |
| `reload`       | `() => Promise<void>`                                     | Refresh library after delete                  |
| `onApplied`    | `(outcome: ChannelBulkApplyOutcome) => void`              | Called after a successful apply, before close |
| `onDeleted`    | `(outcome: PersistChannelBulkDeleteOutcome) => void`      | Called when one or more channels were deleted |

## Usage

```tsx
const { projectId, deleteEntity, reload, library } = useLibrary();

<ChannelBulkEditModal
  opened={bulkEditOpen}
  onClose={() => setBulkEditOpen(false)}
  channels={selectedChannels}
  projectId={projectId}
  library={library}
  deleteEntity={deleteEntity}
  reload={reload}
  onApplied={(outcome) => {
    setMessage(formatChannelBulkApplyMessage(outcome));
    setSelectedKeys([]);
  }}
  onDeleted={(outcome) => {
    setMessage(formatChannelBulkDeleteMessage(outcome));
    setMessageColor(bulkDeleteAlertColor(outcome));
    setSelectedKeys([]);
  }}
/>;
```

Single-channel selection is handled by the list page (navigate to the channel editor) — do not open this modal for one channel.

## Behaviour

- Shell: `ModalShell` (`size="xl"`) with pencil icon, selection banner, and footer **Apply to N channels** / Cancel / Delete.
- **View selected channels** expands a compact scrollable name list.
- Groups match the channel editor: **RF**, **Mode settings**, **Zones**, **Scanning**, **APRS**. Collapsible `Panel`s; RF and Scanning start open. Header **badge** shows how many overrides in that group, open or closed.
- Each field starts as **No change**. Gradient fields use an offset idle segment; sliders use [`BulkEditField`](./BulkEditField.md). Apply writes only opted-in fields.
- When every selected channel (and analog/DMR profile, for those fields) shares a value, that option shows a secondary outline. The outline is a hint — it does not opt the field in until the operator selects it.
- Segmented controls use `layout="row"` (not full width). Transmit and TX permit sit on one row at desktop width.
- Channel-level fields (`scanInclusion`, `forbidTransmit`, `txPermit`, `power`) apply to every selected channel when opted in.
- Analog fields appear only when at least one selected channel has an analog mode. RX and TX tones (CTCSS or DCS, including **None** to clear) and squelch update all analog profiles independently; digital-only channels are skipped. Talker alias appears when at least one channel has DMR.
- **APRS** (collapsed by default) independently opts in receive, report type, digital PTT, and report slot. Slot labels come from the library APRS configuration. Analog AX.25 APRS is not modelled.
- **Zones** (collapsed by default) uses two [`BulkZonePickerColumn`](./BulkZonePickerColumn.md) pickers: **Remove from** and **Add to**. Apply writes direct zone members (`putZone`); nested-only membership is listed with Open zone links and is not changed.
- **Apply** runs `persistChannelBulkEdit` then `persistChannelBulkZoneMembership` with revision checks; revision conflicts show an error and leave the parent selection intact. Zone-only applies skip the channel patch.
- **Delete N channels** (footer, left) opens an in-modal confirmation. Confirm runs `persistChannelBulkDelete` with zone auto-cascade (same integrity as single delete). Partial blocks close the modal when at least one channel was deleted; total failure stays open with an error.
- Core patch logic: `@core/domain/channelBulkEdit.ts`. Zone membership: `@core/domain/zoneMembership.ts`.

## Related

- [library/README.md](../../../docs/features/library/README.md) — channels list bulk edit/delete ([#207](https://github.com/pskillen/codeplug-studio/issues/207), [#310](https://github.com/pskillen/codeplug-studio/issues/310), [#1269](https://github.com/pskillen/codeplug-studio/issues/1269))
- [`BulkEditField`](./BulkEditField.md), [`BulkZonePickerColumn`](./BulkZonePickerColumn.md), [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md)
- `ScanInclusionSegment`, `ForbidTransmitSegment`, `PercentLevelSlider`
- `persistChannelBulkDelete` in `src/app/lib/channelBulkDelete.ts`

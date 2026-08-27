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

- Shell: `ModalShell` (`size="xl"`) with pencil icon, selection banner, and footer hint + **Apply to N channels** / Cancel / Delete.
- **View selected channels** expands a compact scrollable name list.
- Groups match the channel editor: **RF**, **Mode settings**, **Zones**, **Scanning**, **APRS**. Collapsible `Panel`s; RF and Scanning start open. Header **badge** shows how many overrides in that group, open or closed.
- Each field starts as **No change**. Gradient fields use an offset idle segment; long selects use [`BulkEditField`](./BulkEditField.md). Apply writes only opted-in fields.
- Idle + shared value: fill on the shared option, outline on **No change**. Mixed: fill on **No change**. Opted in: fill and outline on the chosen value.
- Desktop: two-column `.fieldGroup` grid; mobile: one group per row. Controls use `layout="column"` (title, then control, then description).
- **Power** is **No change | Default | Custom**. Default writes `power: null`. Custom shows the percent thumb; preview dots mark every selected channel’s power.
- Analog **CTCSS/DCS** wraps independent RX and TX tone selects. Squelch keeps **No change | Set** plus the slider.
- Channel-level fields (`scanInclusion`, `forbidTransmit`, `txPermit`, `power`) apply to every selected channel when opted in.
- Analog fields appear only when at least one selected channel has an analog mode. Digital-only channels are skipped for analog patches. Talker alias appears when at least one channel has DMR.
- **APRS** (collapsed by default): receive, report type, and digital PTT are three-way gradients; report slot stays **No change | Set** plus a select. Analog AX.25 APRS is not modelled.
- **Zones** (collapsed by default) uses two [`BulkZonePickerColumn`](./BulkZonePickerColumn.md) pickers: **Remove from** and **Add to**. Apply writes direct zone members (`putZone`); nested-only membership is listed with Open zone links and is not changed.
- **Choose at least one value above to apply** sits in the footer so it does not shift the scroll body.
- **Apply** runs `persistChannelBulkEdit` then `persistChannelBulkZoneMembership` with revision checks; revision conflicts show an error and leave the parent selection intact. Zone-only applies skip the channel patch.
- **Delete N channels** (footer, left) opens an in-modal confirmation. Confirm runs `persistChannelBulkDelete` with zone auto-cascade (same integrity as single delete). Partial blocks close the modal when at least one channel was deleted; total failure stays open with an error.
- Core patch logic: `@core/domain/channelBulkEdit.ts`. Zone membership: `@core/domain/zoneMembership.ts`.

## Related

- [library/README.md](../../../docs/features/library/README.md) — channels list bulk edit/delete ([#207](https://github.com/pskillen/codeplug-studio/issues/207), [#310](https://github.com/pskillen/codeplug-studio/issues/310), [#1269](https://github.com/pskillen/codeplug-studio/issues/1269))
- [`BulkEditField`](./BulkEditField.md), [`BulkZonePickerColumn`](./BulkZonePickerColumn.md), [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md), [`PercentLevelSlider`](../v2/PercentLevelSlider.md)
- `ScanInclusionSegment`, `ForbidTransmitSegment`, `PercentLevelSlider`
- `persistChannelBulkDelete` in `src/app/lib/channelBulkDelete.ts`

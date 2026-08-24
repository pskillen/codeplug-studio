# BrandmeisterRxListSyncAction

## Purpose

BrandMeister talk-group / RX group list sync button for a saved DMR channel, placed in **Mode settings → DMR settings** below **RX group list**. Opens [`BrandmeisterRxGroupListSyncDialog`](./BrandmeisterRxGroupListSyncDialog.tsx).

## Props

| Prop      | Type      | Description                                |
| --------- | --------- | ------------------------------------------ |
| `channel` | `Channel` | Live channel row (includes typed callsign) |
| `library` | `Library` | Current project library                    |

## Usage

```tsx
<BrandmeisterRxListSyncAction channel={channel} library={library} />
```

Rendered from `DmrPanel` in [`ChannelModeProfilesEditor`](../channels/ChannelModeProfilesEditor.tsx) when `channel` is a saved row.

## Behaviour

- Button disabled when `channel.callsign` is empty; shows a hint to enter a callsign in Identity.
- Queries BrandMeister by callsign; multi-hit results open [`RepeaterListingPickerModal`](./RepeaterListingPickerModal.tsx).
- Does not change frequencies or other repeater details — RX list sync only.
- Lookup logic shared via [`useRepeaterListingLookup`](./useRepeaterListingLookup.ts).

## Related

- [`ChannelDirectoryVerifyActions.md`](./ChannelDirectoryVerifyActions.md) — repeater field verify (Identity)
- [`docs/features/repeater-directories/README.md`](../../../docs/features/repeater-directories/README.md)

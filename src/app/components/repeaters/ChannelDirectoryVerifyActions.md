# ChannelDirectoryVerifyActions

## Purpose

Directory verify buttons for a saved library channel, placed in the channel editor **Identity** section next to **Callsign**. Opens [`RepeaterListingUpdateDialog`](./RepeaterListingUpdateDialog.tsx) to diff and apply repeater field updates from ukrepeater.net, IRTS, RepeaterBook, or BrandMeister (when the channel has a DMR profile).

## Props

| Prop      | Type      | Description                                      |
| --------- | --------- | ------------------------------------------------ |
| `channel` | `Channel` | Live channel row (includes typed callsign)       |

## Usage

```tsx
<ChannelDirectoryVerifyActions channel={liveChannel} />
```

Render only on saved channels (`entity` set) inside the Identity panel, below the callsign field.

## Behaviour

- Buttons disabled when `channel.callsign` is empty; shows a hint to enter a callsign.
- **Check RepeaterBook** disabled without a Settings token; link to Settings when missing.
- **Check BrandMeister repeater** shown only when the channel has a DMR mode profile.
- **Title case names** checkbox forwarded to the listing mapper on apply.
- Multi-hit directory results open [`RepeaterListingPickerModal`](./RepeaterListingPickerModal.tsx).
- Lookup logic shared via [`useRepeaterListingLookup`](./useRepeaterListingLookup.ts).

## Related

- [`BrandmeisterRxListSyncAction.md`](./BrandmeisterRxListSyncAction.md) — RX group list sync (DMR settings)
- [`docs/features/repeater-directories/README.md`](../../../docs/features/repeater-directories/README.md)

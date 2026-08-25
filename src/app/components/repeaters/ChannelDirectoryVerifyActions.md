# ChannelDirectoryVerifyActions

## Purpose

Directory verify/lookup buttons for a library channel, placed in the channel editor **Identity** section next to **Callsign** — on both saved channels and the blank New-channel screen. Opens [`RepeaterListingUpdateDialog`](./RepeaterListingUpdateDialog.tsx) to diff and apply repeater field updates from ukrepeater.net, IRTS, RepeaterBook, or BrandMeister (when the channel has a DMR profile).

## Props

| Prop                 | Type                                        | Description                                                                                                            |
| -------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `channel`            | `Channel`                                   | Live channel row (includes typed callsign)                                                                             |
| `onApplyAndSave`     | `(patched: Channel) => void`                | Forwarded to the dialog's primary "Apply & save" button. Omit to hide it.                                              |
| `onApplyAndContinue` | `(patched: Channel) => void`                | Forwarded to the dialog's secondary "Apply only" button — required, no I/O.                                            |
| `mode`               | `'verify' \| 'lookup'` (default `'verify'`) | `'verify'` — saved-channel copy ("Check ukrepeater.net"). `'lookup'` — New-channel copy ("Look up on ukrepeater.net"). |

## Usage

```tsx
// Saved channel
<ChannelDirectoryVerifyActions
  channel={liveChannel}
  onApplyAndSave={handleApplyAndSave}
  onApplyAndContinue={applyDirectoryPatch}
/>

// New channel
<ChannelDirectoryVerifyActions
  channel={liveChannel}
  onApplyAndSave={handleApplyAndSave}
  onApplyAndContinue={applyDirectoryPatch}
  mode="lookup"
/>
```

Renders in the Identity panel, below the callsign field, on both saved and New channels — the `entity`-gated hide is gone; a fresh, stable channel row (see `ChannelEditor.tsx`'s slice-1 `base` fix) is enough to enable lookup before the first save.

## Behaviour

- Buttons disabled when `channel.callsign` is empty; shows a hint to enter a callsign.
- **RepeaterBook** button disabled without a Settings token; link to Settings when missing.
- **BrandMeister** button shown only when the channel has a DMR mode profile.
- Buttons lay out on an explicit CSS grid (`repeat(auto-fit, minmax(190px, 1fr))`), not a wrapping flex row — settles into a predictable 1/2/3/4-per-row instead of an uneven wrap at odd container widths.
- **Title case names — ukrepeater.net and IRTS** checkbox sits on its own row below the button grid (not inline with the buttons — it isn't itself a directory-check action) and is forwarded to the listing mapper on apply; the label names which sources it affects since BrandMeister always uses its own fixed mapping.
- Multi-hit directory results open [`RepeaterListingPickerModal`](./RepeaterListingPickerModal.tsx).
- Lookup logic shared via [`useRepeaterListingLookup`](./useRepeaterListingLookup.ts).
- Both callback props are threaded straight through to [`RepeaterListingUpdateDialog`](./RepeaterListingUpdateDialog.md) — see that sidecar for what each button does.

## Related

- [`RepeaterListingUpdateDialog.md`](./RepeaterListingUpdateDialog.md) — the diff/apply dialog this component opens
- [`BrandmeisterRxListSyncAction.md`](./BrandmeisterRxListSyncAction.md) — RX group list sync (DMR settings)
- [`docs/features/repeater-directories/README.md`](../../../docs/features/repeater-directories/README.md)

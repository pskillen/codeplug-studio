# RepeaterListingUpdateDialog

Directory comparison modal — diffs a library `Channel` against a repeater directory listing and applies operator-selected fields.

## Purpose

Shows a field-by-field diff table (`channelDiff.ts`) between a channel and a matched `RepeaterListing`, so an operator can review directory data before overwriting anything. Used by [`ChannelDirectoryVerifyActions`](./ChannelDirectoryVerifyActions.tsx) (channel editor Identity "Check …" / "Look up …" buttons, on both saved channels and New channel) and [`RepeaterDirectorySearch`](./RepeaterDirectorySearch.tsx) (existing-row update).

## Props

| Prop                 | Type                                        | Notes                                                                                                                                                                   |
| -------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channel`            | `Channel`                                   | Library channel being compared                                                                                                                                          |
| `listing`            | `RepeaterListing \| null`                   | Matched directory listing; `null` renders nothing                                                                                                                       |
| `opened`             | `boolean`                                   | Modal visibility                                                                                                                                                        |
| `onClose`            | `() => void`                                | Cancel / dismiss                                                                                                                                                        |
| `onApplyAndSave`     | `(patched: Channel) => void`                | Primary button ("Apply & save"). Persists `patched` via `persistence.putChannel` — today's behaviour, unchanged. Omit to hide the button.                               |
| `onApplyAndContinue` | `(patched: Channel) => void`                | Secondary button ("Apply only"). Hands back `patched`, writes nothing. Omit to hide the button.                                                                         |
| `mapOptions`         | `MapListingOptions`                         | Title-case, omit-comment — forwarded to the mapper                                                                                                                      |
| `mode`               | `'verify' \| 'lookup'` (default `'verify'`) | Copy variant — `'verify'` is today's "check against a directory" framing for a saved channel; `'lookup'` swaps to an "import" framing for the blank New-channel screen. |

## Usage

```tsx
// Saved channel — today's one-click check-and-save workflow, unchanged
<RepeaterListingUpdateDialog
  channel={channel}
  listing={matchedListing}
  opened={updateOpen}
  onClose={() => setUpdateOpen(false)}
  onApplyAndSave={() => refreshChannel()}
/>

// New channel — callsign-first import, with a save-free "Apply only" option
<RepeaterListingUpdateDialog
  channel={draftChannel}
  listing={matchedListing}
  opened={updateOpen}
  onClose={() => setUpdateOpen(false)}
  onApplyAndSave={(patched) => navigate(`/library/channels/${patched.id}`)}
  onApplyAndContinue={(patched) => fillFormFrom(patched)}
  mode="lookup"
/>
```

## Behaviour

- Rows come from `diffChannelFromListing(channel, listing, mapOptions)`; unchanged rows render dimmed with a disabled checkbox.
- Each row's apply checkbox starts checked when `row.selectByDefault` is `true` — the diff builder already forces this to `false` for lower-precision location/locator overrides.
- **Clearing changes** (`row.emphasis === 'warning'`): when applying the directory value would clear a value the channel currently has (e.g. an RX tone from an earlier import when the directory listing now maps that tone TX-only), the checkbox starts **unchecked** and the directory cell renders as a warning [`Pill`](../v2/Pill.md) instead of plain text — see [repeater-directories — directory comparison does not auto-apply clears](../../../../docs/features/repeater-directories/README.md#directory-comparison-does-not-auto-apply-clears) ([#1254](https://github.com/pskillen/codeplug-studio/issues/1254)). The operator can still tick the box to apply the clear.
- **Apply & save** calls `buildPatchFromDiff`, saves via `persistence.putChannel` with optimistic-concurrency `revision` check (a conflict surfaces as a `StatusBanner`), then calls `onApplyAndSave(patched)` and closes — this is the same one-click "check → diff → save" loop the editor has always had on saved channels.
- **Apply only** calls `buildPatchFromDiff`, hands the result straight to `onApplyAndContinue(patched)`, and closes — no I/O. This exists for the New-channel screen, where there's no existing channel row to persist against yet; the caller fans the patch out into its own form state instead.
- Both buttons share the same `selectedFields`/disabled logic (`diffHasChanges(diffRows) && selectedFields.size > 0`); a caller need only wire up the button(s) it uses.
- Must render inside `DesignSystemV2Provider`.

## Related

- [channelDiff.ts](../../../integrations/repeaters/channelDiff.ts) — diff/patch logic and `selectByDefault`/`emphasis` rules
- [Pill.md](../v2/Pill.md)
- [docs/features/repeater-directories/README.md](../../../../docs/features/repeater-directories/README.md)

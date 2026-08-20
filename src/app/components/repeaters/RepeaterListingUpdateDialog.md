# RepeaterListingUpdateDialog

Directory comparison modal — diffs a library `Channel` against a repeater directory listing and applies operator-selected fields.

## Purpose

Shows a field-by-field diff table (`channelDiff.ts`) between a channel and a matched `RepeaterListing`, so an operator can review directory data before overwriting anything on an existing channel. Used by [`RepeaterVerifyPanel`](./RepeaterVerifyPanel.tsx) (channel editor "Check …" buttons) and [`RepeaterDirectorySearch`](./RepeaterDirectorySearch.tsx) (existing-row update).

## Props

| Prop         | Type                      | Notes                                              |
| ------------ | ------------------------- | -------------------------------------------------- |
| `channel`    | `Channel`                 | Library channel being compared                     |
| `listing`    | `RepeaterListing \| null` | Matched directory listing; `null` renders nothing  |
| `opened`     | `boolean`                 | Modal visibility                                   |
| `onClose`    | `() => void`              | Cancel / dismiss                                   |
| `onApplied`  | `() => void`              | Called after a successful save                     |
| `mapOptions` | `MapListingOptions`       | Title-case, omit-comment — forwarded to the mapper |

## Usage

```tsx
<RepeaterListingUpdateDialog
  channel={channel}
  listing={matchedListing}
  opened={updateOpen}
  onClose={() => setUpdateOpen(false)}
  onApplied={() => refreshChannel()}
/>
```

## Behaviour

- Rows come from `diffChannelFromListing(channel, listing, mapOptions)`; unchanged rows render dimmed with a disabled checkbox.
- Each row's apply checkbox starts checked when `row.selectByDefault` is `true` — the diff builder already forces this to `false` for lower-precision location/locator overrides.
- **Clearing changes** (`row.emphasis === 'warning'`): when applying the directory value would clear a value the channel currently has (e.g. an RX tone from an earlier import when the directory listing now maps that tone TX-only), the checkbox starts **unchecked** and the directory cell renders as a warning [`Pill`](../v2/Pill.md) instead of plain text — see [repeater-directories — directory comparison does not auto-apply clears](../../../../docs/features/repeater-directories/README.md#directory-comparison-does-not-auto-apply-clears) ([#1254](https://github.com/pskillen/codeplug-studio/issues/1254)). The operator can still tick the box to apply the clear.
- **Apply selected** calls `buildPatchFromDiff` and saves via `persistence.putChannel` with optimistic-concurrency `revision` check; a conflict surfaces as a `StatusBanner`.
- Must render inside `DesignSystemV2Provider`.

## Related

- [channelDiff.ts](../../../integrations/repeaters/channelDiff.ts) — diff/patch logic and `selectByDefault`/`emphasis` rules
- [Pill.md](../v2/Pill.md)
- [docs/features/repeater-directories/README.md](../../../../docs/features/repeater-directories/README.md)

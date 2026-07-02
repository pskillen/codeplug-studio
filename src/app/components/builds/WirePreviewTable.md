## Purpose

Shared table for build wire preview pages: per-entity include toggle, display label, and wire name override input.

## Props

| Prop                       | Type                              | Description                                                              |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `rows`                     | `WirePreviewRow[]`                | Rows from `previewWireRows`                                              |
| `nameLimit`                | `number` (optional)               | Profile wire name cap; shows error when exceeded                         |
| `onExcludedChange`         | `(row, excluded) => void`         | Include toggle handler                                                   |
| `onWireNameChange`         | `(row, wireName) => void`         | Wire name input handler                                                  |
| `onUnsavedChangesChange`   | `(hasUnsaved) => void` (optional) | True while any row has an unapplied draft                                |
| `clickableDefaultWireName` | `boolean` (optional)              | When true, the default name hint is clickable to store it as an override |

## Usage

```tsx
<WirePreviewTable
  rows={rows}
  nameLimit={16}
  onExcludedChange={(row, excluded) => void setRowExcluded(row, excluded)}
  onWireNameChange={(row, wireName) => void setRowWireName(row, wireName)}
/>
```

## Behaviour

- **Include** — `Switch`; unchecked sets `excluded: true` on the build override (sparse storage).
- **Wire name** — local draft with explicit **Apply** (tick) and **Revert** (×) actions; Enter applies, Escape reverts; empty input uses the default name; hint shows clickable `Default: {generatedWireName}` to store the generated name as an explicit override. Unapplied drafts trigger a leave-page confirmation on wire preview routes.
- Multi-mode channel expansion rows use composite override keys (`channelId:${modeSuffix}`).

## Related

- [Builds feature hub](../../../docs/features/builds/README.md)
- `useBuildWirePreview` hook

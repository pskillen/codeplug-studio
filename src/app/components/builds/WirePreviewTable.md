## Purpose

Shared table for build wire preview pages: per-entity include toggle, display label, and wire name override input.

## Props

| Prop               | Type                      | Description                                      |
| ------------------ | ------------------------- | ------------------------------------------------ |
| `rows`             | `WirePreviewRow[]`        | Rows from `previewWireRows`                      |
| `nameLimit`        | `number` (optional)       | Profile wire name cap; shows error when exceeded |
| `onExcludedChange` | `(row, excluded) => void` | Include toggle handler                           |
| `onWireNameChange` | `(row, wireName) => void` | Wire name input handler                          |

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
- **Wire name** — local draft with debounced persist (`useDebouncedNameFilter`); empty input uses the default name; hint always shows `Default: {generatedWireName}`.
- Multi-mode channel expansion rows use composite override keys (`channelId:-F` / `:-D`).

## Related

- [Builds feature hub](../../../docs/features/builds/README.md)
- `useBuildWirePreview` hook

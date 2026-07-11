# ExportWarningsAlert

Renders CPS export warning strings from `exportBuildAll` in a scannable layout.

## Purpose

Groups wire-name shortening warnings by entity kind (channels, talk groups, zones, …) with a short intro and `original → exported` lines. Groups zone/scan-list member-cap and truncation warnings with zone name and count lines. Other warnings (orphan inclusions, build-level caps, cycles) stay as plain messages.

## Props

| Prop       | Type       | Description                          |
| ---------- | ---------- | ------------------------------------ |
| `warnings` | `string[]` | Raw warning strings from core export |

## Usage

```tsx
<ExportWarningsAlert warnings={exportWarnings} />
```

## Behaviour

- Parses messages emitted by `pushWireNameLengthWarning` in core (`exported as "…"` form).
- Does not mutate or dedupe the input; core export already dedupes.
- Used on the build Export panel and inside the CSV preview modal.

## Related

- [builds feature hub](../../../docs/features/builds/README.md)
- [`CpsCsvPreviewModal.tsx`](./CpsCsvPreviewModal.tsx)
- [`ExportBuildCpsPanel.tsx`](./ExportBuildCpsPanel.tsx)

# ExportWarningsAlert

Renders CPS export warning strings from `exportBuildAll` in a scannable, foldable layout.

## Purpose

Groups related warnings and collapses each group by default (expandable accordion) so large exports stay usable:

| Group | Contents |
| --- | --- |
| **Export unlinked items** | Orphan inclusion lines (channels not in a zone, TGs / RGLs / contacts not referenced) |
| **Member-cap groups** | Zone / scan list / RX list member cap and truncation warnings |
| **Shortened names** | One section per entity kind (channels, talk groups, zones, contacts, …) with `original → exported` lines |

Other warnings (build-level caps, cycles, …) stay as plain messages above the accordion.

## Props

| Prop       | Type       | Description                          |
| ---------- | ---------- | ------------------------------------ |
| `warnings` | `string[]` | Raw warning strings from core export |

## Usage

```tsx
<ExportWarningsAlert warnings={exportWarnings} />
```

## Behaviour

- Collapsed headers show **title + issue count** (e.g. `Channel names shortened (23)`).
- Parses messages emitted by `pushWireNameLengthWarning` in core (`exported as "…"` form) and assemble orphan-inclusion lines.
- Does not mutate or dedupe the input; core export already dedupes.
- Used on the build Export panel and inside the CSV preview modal (same component).

## Related

- [builds feature hub](../../../docs/features/builds/README.md)
- [`formatExportWarnings.ts`](./formatExportWarnings.ts)
- [`CpsCsvPreviewModal.tsx`](./CpsCsvPreviewModal.tsx)
- [`ExportBuildCpsPanel.tsx`](./ExportBuildCpsPanel.tsx)
- [#408](https://github.com/pskillen/codeplug-studio/issues/408)

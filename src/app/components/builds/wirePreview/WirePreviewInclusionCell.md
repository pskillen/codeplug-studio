# WirePreviewInclusionCell

## Purpose

Inline Skip / Force export control for wire-preview entity lists.

## Props

| Prop                   | Type                                        | Description                                  |
| ---------------------- | ------------------------------------------- | -------------------------------------------- |
| `row`                  | `WirePreviewRow`                            | Preview row                                  |
| `disabled`             | `boolean` (opt.)                            | Disable while saving                         |
| `onExcludedChange`     | `(row, excluded) => void`                   | Persist skip                                 |
| `onForceIncludeChange` | `(row, forceInclude) => void` (opt., zones) | Persist force-include for library omit zones |

## Behaviour

- Default: **Skip from export** switch.
- Zones with library `omitFromExport` and a force handler: **Force export** only (red when on). Turn force off to honour the library omit — no separate Skip.
- Clicks stop propagation so the row modal still opens from other cells.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [WirePreviewDataTable.md](./WirePreviewDataTable.md)

# ExportWarningsAlert

Renders CPS export warning strings from `exportBuildAll` in a scannable, foldable layout.

## Purpose

Splits presentation into two severity tiers so a clean successful name-shorten is never styled as a problem:

| Section | Contents |
| --- | --- |
| **Export warnings** (yellow `Alert`) | Real problems: still-too-long after shortening, shortening disabled while over the limit, member-cap / truncation, unlinked inclusion, and other general assemble warnings |
| **Names shortened** (neutral collapsed accordion) | Clean successful shortens (`exported as "…"` and fits the limit) — visible if the operator wants to check, never counted or framed as a warning |

Within those sections, related lines are grouped and collapsed by default:

| Group                     | Contents                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Export unlinked items** | Orphan inclusion lines (channels not in a zone, TGs / RGLs / contacts not referenced)                    |
| **Member-cap groups**     | Zone / scan list / RX list member cap and truncation warnings                                            |
| **Shortened names**       | One section per entity kind (channels, talk groups, zones, contacts, …) with `original → exported` lines |

Other warnings (build-level caps, cycles, …) stay as plain messages inside the yellow alert above its accordion.

A fully clean export that only has successful shortens renders **no** yellow alert — only the neutral info accordion.

## Props

| Prop       | Type       | Description                          |
| ---------- | ---------- | ------------------------------------ |
| `warnings` | `string[]` | Raw warning strings from core export |

## Usage

```tsx
<ExportWarningsAlert warnings={exportWarnings} />
```

## Behaviour

- Collapsed headers show **title + issue count** (e.g. `Channel names shortened (23)`). Info-section headers use the same convention with muted styling and no "warning" framing.
- Parses messages emitted by `pushWireNameLengthWarning` in core (`exported as "…"` form) and assemble orphan-inclusion lines; `formatExportWarnings` partitions clean shortens into `shortenedInfoGroups` and problem shortens into `shortenedProblemGroups`.
- Does not mutate or dedupe the input; core export already dedupes.
- Used on the build Export panel and inside the CSV preview modal (same component).

## Related

- [builds feature hub](../../../docs/features/builds/README.md)
- [`formatExportWarnings.ts`](./formatExportWarnings.ts)
- [`CpsCsvPreviewModal.tsx`](./CpsCsvPreviewModal.tsx)
- [`ExportBuildCpsPanel.tsx`](./ExportBuildCpsPanel.tsx)
- [#408](https://github.com/pskillen/codeplug-studio/issues/408)
- [#1099](https://github.com/pskillen/codeplug-studio/issues/1099)

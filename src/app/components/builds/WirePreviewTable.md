## Purpose

Shared table for build wire preview pages: per-entity export controls, display label, and wire name override input.

## Props

| Prop                       | Type                                     | Description                                                               |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| `rows`                     | `WirePreviewRow[]`                       | Rows from `previewWireRows`                                               |
| `nameLimit`                | `number` (optional)                      | Profile wire name cap; shows error when exceeded                          |
| `onExcludedChange`         | `(row, excluded) => void`                | Skip-from-export toggle handler (`excluded: true` when checked)           |
| `onForceIncludeChange`     | `(row, forceInclude) => void` (optional) | Force-export handler for library `omitFromExport` zones (zones page only) |
| `onWireNameChange`         | `(row, wireName) => void`                | Wire name input handler                                                   |
| `onUnsavedChangesChange`   | `(hasUnsaved) => void` (optional)        | True while any row has an unapplied draft                                 |
| `clickableDefaultWireName` | `boolean` (optional)                     | When true, the default name hint is clickable to store it as an override  |
| `scanListColumn`           | `WirePreviewScanListColumn` (optional)   | Dedicated-scan builds: per-channel Scan List select + hideable column      |

### `WirePreviewScanListColumn`

| Field                 | Type                                                       |
| --------------------- | ---------------------------------------------------------- |
| `options`             | `{ value, label }[]` — include `{ value: '', label: 'None' }` |
| `getScanListId`       | `(row) => string \| undefined` — uses `libraryEntityId`    |
| `onScanListChange`    | `(row, scanListId?) => void`                               |
| `disabled`            | Disables selects while a build save is in flight           |
| `libraryHasScanLists` | When false, shows create-list guidance above the table     |

## Usage

```tsx
<WirePreviewTable
  rows={rows}
  nameLimit={16}
  onExcludedChange={(row, excluded) => void setRowExcluded(row, excluded)}
  onForceIncludeChange={entityKind === 'zone' ? setRowForceIncluded : undefined}
  onWireNameChange={(row, wireName) => void setRowWireName(row, wireName)}
/>
```

## Behaviour

- **Skip from export column** — default rows: **Skip from export** `Switch` (checked = `excluded: true`). Library `omitFromExport` zones: **Force export** switch (`forceInclude` on `zoneOverrides`); when force export is on, a **Skip from export** switch appears for build-level exclusion.
- **Scan list column** (optional) — `Select` per channel row when `scanListColumn` is set (`DedicatedScanLists` builds). Toggle **Show scan list column** hides the column; assignment uses `channelOverrides.scanListId` on `libraryEntityId`. Disabled when the row is skipped from export.
- **Display name (internal data)** — library label; **N channels** / **M zones** pills (hover for first six names); **Not exported as zone** badge when `omitFromExport`; optional **displayDetails** sub-lines (e.g. DM32 RX-list fan-out: channel name, talk group name + ID + slot); fallback expansion note for other synthesized rows; **Edit in library** link.
- **Wire name** — local draft with explicit **Apply** (tick) and **Revert** (×) actions; Enter applies, Escape reverts; empty input uses the default name; hint shows clickable `Default: {generatedWireName}` to store the generated name as an explicit override. Unapplied drafts trigger a leave-page confirmation on wire preview routes.
- Multi-mode channel expansion rows use composite override keys (`channelId:${modeSuffix}`).
- Parent route renders **Hide items not to be included in export** above this table (`useBuildWirePreview`); this component receives already-filtered `rows`.

## Related

- [wire-preview.md](../../../docs/features/builds/wire-preview.md)
- [Builds feature hub](../../../docs/features/builds/README.md)
- `useBuildWirePreview` hook

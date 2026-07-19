## Purpose

Per-row override editor for wire preview list pages. Mantine `Modal` with common fields (wire name, skip, force-include) from `resolveOverrideModalSections`, plus route-supplied sections.

**Tracking:** [#349](https://github.com/pskillen/codeplug-studio/issues/349) · zone tabs [#472](https://github.com/pskillen/codeplug-studio/issues/472)

## Props

| Prop                   | Type                                     | Description                                                                  |
| ---------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `opened`               | `boolean`                                | Modal visibility                                                             |
| `onClose`              | `() => void`                             | Close handler                                                                |
| `row`                  | `WirePreviewRow \| null`                 | Active preview row                                                           |
| `build`                | `FormatBuild`                            | Active build                                                                 |
| `entityKind`           | `WirePreviewEntityKind`                  | Entity kind for section registry                                             |
| `nameLimit`            | `number` (optional)                      | Profile wire name cap                                                        |
| `onExcludedChange`     | `(row, excluded) => void`                | Skip-from-export                                                             |
| `onForceIncludeChange` | `(row, forceInclude) => void` (optional) | Zone force-export (`entityKind === 'zone'`)                                  |
| `onWireNameChange`     | `(row, wireName) => void`                | Wire name override (Apply/Revert in `CommonOverrideSection`)                 |
| `extraSections`        | `ReactNode` (optional)                   | Non-tabbed append (channel expansion context, CHIRP scan on flat-memory)     |
| `membersSection`       | `ReactNode` (optional)                   | Zone **Members** tab — `ZoneMemberOrderSection` from the zones wire page     |
| `scanSection`          | `ReactNode` (optional)                   | Zone **Scan** tab — `ZoneScanOverrideSection` when zone-derived scan applies |

## Sections

`resolveOverrideModalSections` currently returns only:

| Section                 | When                                         |
| ----------------------- | -------------------------------------------- |
| `CommonOverrideSection` | Always — wire name, skip, zone force-include |

Route composition (not the registry):

| Content                   | Where                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| Zone member export order  | `BuildZonesWirePage` → `membersSection` (Members tab)              |
| Zone-derived scan export  | `BuildZonesWirePage` → `scanSection` (Scan tab; trait-gated)       |
| CHIRP per-channel scan    | Flat-memory channel page → `extraSections`                         |
| Channel expansion context | Channels wire page → `extraSections`                               |

## Behaviour

- **Non-zone entities:** single `Stack` — library header, common section, optional `extraSections`.
- **Zones** (when `membersSection` and/or `scanSection` provided): Mantine **Tabs** — **Export** (header + common), optional **Members**, optional **Scan**. Default tab is Export. Scan tab omitted when the build lacks zone-derived scan support (`zoneScanExportSupported`: `ZoneGrouping` + `ScanLists` or `DedicatedScanLists`).
- Wire name uses local draft with **Apply** / **Revert** (`WireNameOverrideInput`) before persisting.
- List pages do **not** use `useUnsavedNavigationGuard`; only `/builds/:id/channels/bulk` guards unapplied wire-name drafts on navigation.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [WirePreviewDataTable.md](./WirePreviewDataTable.md)
- `overrideModalSections/` — common + route-mounted zone/CHIRP sections

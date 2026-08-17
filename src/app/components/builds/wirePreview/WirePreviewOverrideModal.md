## Purpose

Per-row override editor for wire preview list pages. As of the wire-preview rework (phase 6),
**retained only for kinds with more than a name to edit** — zones (Members / Scan tabs) and
CHIRP flat-memory channels (scan inclusion via `extraSections`). Every other entity kind edits
its export name inline via [`WirePreviewExportNameCell`](./WirePreviewExportNameCell.md) on the
table and never opens this modal (`BuildWirePreviewListPage` gates `onRowActivate` on
`entityKind === 'zone'`). Mantine `Modal` with common fields (wire name, skip, force-include)
from `resolveOverrideModalSections`, plus route-supplied sections.

**Tracking:** [#349](https://github.com/pskillen/codeplug-studio/issues/349) · zone tabs [#472](https://github.com/pskillen/codeplug-studio/issues/472) · inline edit rework [#1217](https://github.com/pskillen/codeplug-studio/issues/1217)

## Props

| Prop                   | Type                                     | Description                                                                                                                 |
| ---------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `opened`               | `boolean`                                | Modal visibility                                                                                                            |
| `onClose`              | `() => void`                             | Close handler                                                                                                               |
| `row`                  | `WirePreviewRow \| null`                 | Active preview row                                                                                                          |
| `build`                | `FormatBuild`                            | Active build                                                                                                                |
| `entityKind`           | `WirePreviewEntityKind`                  | Entity kind for section registry                                                                                            |
| `library`              | `LibrarySlice \| null` (optional)        | Feeds the row's [Resolution section](./WireResolutionSection.md); omitted or unset (e.g. before the library loads) skips it |
| `nameLimit`            | `number` (optional)                      | Profile wire name cap                                                                                                       |
| `onExcludedChange`     | `(row, excluded) => void`                | Skip-from-export                                                                                                            |
| `onForceIncludeChange` | `(row, forceInclude) => void` (optional) | Zone force-export (`entityKind === 'zone'`)                                                                                 |
| `onWireNameChange`     | `(row, wireName) => void`                | Wire name override (Apply / Reset in `CommonOverrideSection`; Suggestion fills draft only)                                  |
| `extraSections`        | `ReactNode` (optional)                   | Non-tabbed append (channel expansion context, CHIRP scan on flat-memory)                                                    |
| `membersSection`       | `ReactNode` (optional)                   | Zone **Members** tab — `ZoneMemberOrderSection` from the zones wire page                                                    |
| `scanSection`          | `ReactNode` (optional)                   | Zone **Scan** tab — `ZoneScanOverrideSection` when zone-derived scan applies                                                |

## Sections

`resolveOverrideModalSections` currently returns only:

| Section                 | When                                         |
| ----------------------- | -------------------------------------------- |
| `CommonOverrideSection` | Always — wire name, skip, zone force-include |

Route composition (not the registry):

| Content                  | Where                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Zone member export order | `BuildZonesWirePage` → `membersSection` (Members tab)        |
| Zone-derived scan export | `BuildZonesWirePage` → `scanSection` (Scan tab; trait-gated) |
| CHIRP per-channel scan   | Flat-memory channel page → `extraSections`                   |

Channel expansion context (mode/site details) moved to the always-visible **Details** column
(`WirePreviewDisplayCell`) on the table — it no longer needs a modal since the modal doesn't
open for channel rows.

`CommonOverrideSection` also renders a [`WireResolutionSection`](./WireResolutionSection.md)
below the wire-name editor when both `build` and `library` are available — absorbed from the
deleted `/builds/:id/export-resolution` About page (wire-preview rework phase 8). Channel rows
(CHIRP flat-memory) show wire name + transmit + TX permit + talker alias + analog squelch;
zone rows show wire name + zone-derived scan membership per exported channel.

## Behaviour

- **Non-zone entities:** modal is not reachable — `BuildWirePreviewListPage` only sets the
  active row (opening this modal) when `entityKind === 'zone'`. CHIRP flat-memory channels are a
  separate route (`BuildFlatMemoryChannelsPage`) that keeps row-click-opens-modal for its
  `ChirpChannelScanSection`.
- **Zones** (when `membersSection` and/or `scanSection` provided): Mantine **Tabs** — **Export** (header + common), optional **Members**, optional **Scan**. Default tab is Export. Scan tab omitted when the build lacks zone-derived scan support (`zoneScanExportSupported`: `ZoneGrouping` + `ScanLists` or `DedicatedScanLists`).
- Wire name uses the shared [`WireNameInlineEditor`](./WireNameInlineEditor.md) (Save / Revert) before persisting — same component the table cell and bulk edit use. Clicking a suggestion fills the draft only.
- List pages do **not** use `useUnsavedNavigationGuard`; only `/builds/:id/channels/bulk` guards unapplied wire-name drafts on navigation.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [WirePreviewDataTable.md](./WirePreviewDataTable.md)
- [WireResolutionSection.md](./WireResolutionSection.md)
- `overrideModalSections/` — common + route-mounted zone/CHIRP sections

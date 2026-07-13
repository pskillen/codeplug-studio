## Purpose

Per-row override editor for wire preview list pages. Mantine `Modal` with common fields (wire name, skip, force-include) plus trait-driven sections from `resolveOverrideModalSections`.

**Tracking:** [#349](https://github.com/pskillen/codeplug-studio/issues/349)

## Props

| Prop                   | Type                                     | Description                                                        |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `opened`               | `boolean`                                | Modal visibility                                                   |
| `onClose`              | `() => void`                             | Close handler                                                      |
| `row`                  | `WirePreviewRow \| null`                 | Active preview row                                                 |
| `build`                | `FormatBuild`                            | Active build (format-specific sections)                            |
| `entityKind`           | `WirePreviewEntityKind`                  | Entity kind for section registry                                   |
| `nameLimit`            | `number` (optional)                      | Profile wire name cap                                              |
| `onExcludedChange`     | `(row, excluded) => void`                | Skip-from-export                                                   |
| `onForceIncludeChange` | `(row, forceInclude) => void` (optional) | Zone force-export (`entityKind === 'zone'`)                        |
| `onWireNameChange`     | `(row, wireName) => void`                | Wire name override (Apply/Revert in `CommonOverrideSection`)       |
| `extraSections`        | `ReactNode` (optional)                   | Route-specific sections (zone scan, CHIRP scan, expansion context) |

## Sections

`resolveOverrideModalSections` composes:

| Section                   | When                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `CommonOverrideSection`   | Always — wire name, skip, zone force-include               |
| `ZoneScanOverrideSection` | DM32 / Anytone zones — scan list export + member inclusion |
| `ChirpChannelScanSection` | CHIRP channels — per-channel scan inclusion                |

Parent routes pass `extraSections` for read-only expansion/fan-out context on channel rows.

## Behaviour

- Wire name uses local draft with **Apply** / **Revert** (`WireNameOverrideInput`) before persisting.
- List pages do **not** use `useUnsavedNavigationGuard`; only `/builds/:id/channels/bulk` guards unapplied wire-name drafts on navigation.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [WirePreviewDataTable.md](./WirePreviewDataTable.md)
- `overrideModalSections/` — format-specific modal sections

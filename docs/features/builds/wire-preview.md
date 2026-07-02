## Purpose

Operator workflow for reviewing and shaping CPS wire names before export. Each build entity type has a dedicated sub-route under `/builds/:id/*` with a shared `WirePreviewTable`.

**Tracking:** [#87](https://github.com/pskillen/codeplug-studio/issues/87)

**Code:** `src/core/services/previewWireRows.ts`, `src/app/hooks/useBuildWirePreview.ts`, `src/app/routes/builds/wire-preview/`

## Override semantics

Build overrides use **sparse opt-out** storage (`BuildEntityOverride`):

| Field            | Meaning                                                            |
| ---------------- | ------------------------------------------------------------------ |
| _(no row)_       | Entity is **included**; wire name is generated from library fields |
| `excluded: true` | Omit from export projection                                        |
| `wireName`       | Override the generated CPS name                                    |

Overrides are stored on `FormatBuild` as `channelOverrides`, `zoneOverrides`, `talkGroupOverrides`, `contactOverrides`, and `rxGroupListOverrides` (`studioSchemaVersion: 3`).

## Preview rows

`previewWireRows(build, library, entityKind, options)` returns rows with:

- **displayLabel** — human-readable library label (may note multi-mode suffix)
- **generatedWireName** — `callsign` + `name` via `defaultChannelWireName` / `composeChannelWireName`; multi-mode channels append mode suffixes (`-F`, `-D`, `-Y`, `-DS`, …) when expansion applies
- **effectiveWireName** — override or generated
- **key** — stable override id (composite `${channelId}:${modeSuffix}` for multi-mode expansion rows)

Wire preview pages and the export panel share **`useExportSettings`** (browser `localStorage`) for shortening, name mode, and abbreviation toggles. Wire name overrides use a local draft with explicit **Apply** and **Revert** actions before persisting (avoids revision races from implicit debounced saves). Navigating away with unapplied drafts opens a confirmation dialog (`useUnsavedNavigationGuard`).

## Routes

| Route                        | Entity kind   | Notes                                                                                                                                                  |
| ---------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/builds/:id/channels`       | `channel`     | Export name mode + **use channel abbreviations** toggles; click default name to store override; multi-mode rows; leave-page guard for unapplied drafts |
| `/builds/:id/zones`          | `zone`        | Click default name to store override                                                                                                                   |
| `/builds/:id/talk-groups`    | `talkGroup`   | Unreferenced TGs still listed; click default name to store override                                                                                    |
| `/builds/:id/contacts`       | `contact`     | Digital + analog contacts; click default name to store override                                                                                        |
| `/builds/:id/rx-group-lists` | `rxGroupList` | Click default name to store override                                                                                                                   |

Secondary nav is trait-gated (`buildNavItems` in `src/app/routes/builds/nav.ts`).

## Related

- [zone-grouping.md](zone-grouping.md) — build zone layout editor
- [name-shortening.md](../import-export/name-shortening.md) — abbreviation pipeline
- [WirePreviewTable sidecar](../../../src/app/components/builds/WirePreviewTable.md)
- [data-model](../data-model/README.md) — `FormatBuild` overrides

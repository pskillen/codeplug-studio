# Format builds

Per-target CPS workflows that map the vendor-neutral [library](../library/README.md) to one radio format and profile.

**Tracking:** Phase 4a [#82](https://github.com/pskillen/codeplug-studio/issues/82) · Epic [#36](https://github.com/pskillen/codeplug-studio/issues/36)

**Source:** `src/app/routes/builds/`, `src/app/state/buildService.ts`

## Problem

The library holds RF semantics once. Each radio/CPS family expects different organisation (zones, flat memories, scan lists) and wire limits. A **format build** is the persisted assembly for one target — selections, trait layout, and wire-name overrides survive between sessions.

## Operator workflow

1. Curate channels, zones, and contacts in **Library**.
2. Open **Radio builds** (sidebar) → **New build**.
3. Pick a CPS format (OpenGD77, CHIRP, …) and a **profile** (trait + wire variant).
4. Review the build overview — edit profile and capability traits.
5. Shape wire names and zone layout on entity sub-routes — see [wire-preview.md](wire-preview.md).
6. Export CPS files from **Export** — see [name-shortening.md](../import-export/name-shortening.md) for export name settings.

See [profiles.md](profiles.md) for profile picker workflows.

Native YAML remains **project interchange** (library + all builds). It is not created via the new-build flow.

## Routes

| Route                        | Purpose                                     |
| ---------------------------- | ------------------------------------------- |
| `/builds`                    | List builds for the active project          |
| `/builds/new`                | Create build — format → profile → name      |
| `/builds/:id`                | Redirect → overview                         |
| `/builds/:id/overview`       | Identity, target profile, capability traits |
| `/builds/:id/channels`       | Wire preview — channels                     |
| `/builds/:id/zones`          | Wire preview — zones                        |
| `/builds/:id/talk-groups`    | Wire preview — talk groups                  |
| `/builds/:id/contacts`       | Wire preview — contacts                     |
| `/builds/:id/rx-group-lists` | Wire preview — RX group lists               |
| `/builds/:id/export`         | CPS export panel                            |

Requires an active project (`RequireActiveProject`).

Sidebar label is **Radio builds**; routes and code use `builds`.

## CPS export

Per-build CPS export is on `/builds/:id/export` (`ExportBuildCpsPanel`) — not on Import / export. The import/export route keeps an **Export to CPS** section that links here.

## Documentation map

| Doc                                  | Topic                                  |
| ------------------------------------ | -------------------------------------- |
| [profiles.md](profiles.md)           | Radio profile picker                   |
| [wire-preview.md](wire-preview.md)   | Wire name overrides and preview routes |
| [zone-grouping.md](zone-grouping.md) | Build zone layout editor               |

## Persistence

Builds are `FormatBuild` rows in IndexedDB (`formatBuilds` store). CRUD goes through `BuildService` and `useFormatBuilds` — same persistence port as library entities.

YAML import/export includes `formatBuilds[]` in the project document.

## Implementation status

| Area                         | Status   | Notes                                                                                                                                                                                              |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List + create + detail shell | Shipped  | [#82](https://github.com/pskillen/codeplug-studio/issues/82)                                                                                                                                       |
| Per-build CPS export         | Shipped  | `ExportBuildCpsPanel` — per-file CSV, ZIP download, Drive ZIP upload                                                                                                                               |
| Profile picker component     | Shipped  | [#85](https://github.com/pskillen/codeplug-studio/issues/85) — `ProfilePicker`                                                                                                                     |
| Wire preview + overrides     | Shipped  | [#87](https://github.com/pskillen/codeplug-studio/issues/87) — sub-routes + `WirePreviewTable`                                                                                                     |
| Zone grouping editor         | Deferred | Library zone membership at export; DM32 export flags on layout ([#104](https://github.com/pskillen/codeplug-studio/issues/104)); UI [#121](https://github.com/pskillen/codeplug-studio/issues/121) |
| Multi-mode channel expansion | Shipped  | [#89](https://github.com/pskillen/codeplug-studio/issues/89) — preview + OpenGD77 export                                                                                                           |
| Export name shortening       | Shipped  | [#90](https://github.com/pskillen/codeplug-studio/issues/90) — `useExportSettings` + dictionary                                                                                                    |
| Export inclusion flags       | Shipped  | [#103](https://github.com/pskillen/codeplug-studio/issues/103) — orphan channels/TGs/RGLs on `FormatBuild` + export UI                                                                             |

## Export inclusion flags

Per-build toggles on `FormatBuild` (default **on**) control whether orphan library entities are included in CPS export:

| Field                        | When enabled (default)                               |
| ---------------------------- | ---------------------------------------------------- |
| `exportUnlinkedChannels`     | Channels not in any zone member list                 |
| `exportUnlinkedTalkGroups`   | Talk groups not referenced by an exported channel    |
| `exportUnlinkedRxGroupLists` | RX group lists not referenced by an exported channel |

Switches on `/builds/:id/export` persist to the build row. Wire preview `includedPreviewWireRows` honours the same flags.

- [profiles.md](profiles.md) — radio profile picker workflows
- [data-model](../data-model/README.md) — `FormatBuild`, trait layout, selections
- [import-export/opengd77](../import-export/opengd77/README.md) — OpenGD77 profiles
- [DESIGN.md](../../../DESIGN.md) — build capability traits

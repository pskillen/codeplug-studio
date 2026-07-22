# Format builds

Per-target CPS workflows that map the vendor-neutral [library](../library/README.md) to one radio format and profile.

**Tracking:** Phase 4a [#82](https://github.com/pskillen/codeplug-studio/issues/82) · Epic [#36](https://github.com/pskillen/codeplug-studio/issues/36)

**Source:** `src/app/routes/builds/`, `src/app/state/buildService.ts`

## Problem

The library holds RF semantics once. Each radio/CPS family expects different organisation (zones, flat memories, scan lists) and wire limits. A **format build** is the persisted assembly for one target — selections, trait layout, and wire-name overrides survive between sessions.

## Operator workflow

1. Curate channels, zones, and contacts in **Library**.
2. Open **Export for radio** (sidebar) → **New build**.
3. Pick a CPS format (OpenGD77, CHIRP, …) and a **profile** (trait + wire variant).
4. Land on **Export** (default) — download CPS files, Drive upload, inclusion and name settings.
5. Use **Setup** for rename/delete, profile changes, and capability badges; open **Radio characteristics** for organisation and export limits.
6. Shape wire names and zone layout on entity sub-routes — see [wire-preview.md](wire-preview.md).
7. Switch builds from the secondary-nav **Build** select without returning to the list.

See [profiles.md](profiles.md) for profile picker workflows.

Native YAML remains **project interchange** (library + all builds) on **Summary**. It is not created via the new-build flow.

## Export vs Setup

| Surface                            | Owns                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Export** (`/builds/:id/export`)  | Download / Drive / donor merge / format settings / inclusion — the job operators open a build for |
| **Setup** (`/builds/:id/overview`) | Build identity (rename/delete), target profile, organisation capability badges                    |

Export does not host identity editors; Setup does not host download actions. Secondary nav lists **Export** first; `/builds/:id` redirects to Export.

## Routes

| Route                           | Purpose                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `/builds`                       | List builds for the active project                                       |
| `/builds/new`                   | Create build — format → profile → name                                   |
| `/builds/:id`                   | Redirect → export                                                        |
| `/builds/:id/export`            | CPS export panel (default / front door)                                  |
| `/builds/:id/overview`          | Setup — identity, target profile, organisation badges                    |
| `/builds/:id/characteristics`   | Read-only radio characteristics — organisation, export limits, ladders   |
| `/builds/:id/channels`          | Wire preview — channels (list + modal)                                   |
| `/builds/:id/scan-list`         | Flat-memory only — per-channel scan include/skip (CHIRP / NeonPlug UV5R) |
| `/builds/:id/channels/bulk`     | Wire preview — channel bulk edit                                         |
| `/builds/:id/zones`             | Wire preview — zones                                                     |
| `/builds/:id/scan-lists`        | Wire preview — dedicated scan lists (e.g. Anytone)                       |
| `/builds/:id/talk-groups`       | Wire preview — talk groups                                               |
| `/builds/:id/contacts`          | Wire preview — contacts                                                  |
| `/builds/:id/rx-group-lists`    | Wire preview — RX group lists                                            |
| `/builds/:id/export-resolution` | Read-only behavioural defaults cascade audit (Channels + Zones tabs)     |

Requires an active project (`RequireActiveProject`).

Sidebar label is **Export for radio**; routes and code use `builds`. Secondary section title matches. [`BuildSwitcher`](../../../src/app/components/builds/BuildSwitcher/BuildSwitcher.md) sits above build nav links.

## CPS export

Per-build CPS export is on `/builds/:id/export` (`ExportBuildCpsPanel`) — the build front door. Project YAML backup lives on [Summary](../report/README.md), not on a separate Import/export page.

**CSV preview** ([#151](https://github.com/pskillen/codeplug-studio/issues/151)): outline **Preview CSV** button (after Save ZIP to Drive) opens a modal with one tab per CPS file, rendered as a read-only table. Uses the same `exportBuildAll` path as download — see [`CpsCsvPreview.md`](../../../src/app/components/builds/CpsCsvPreview.md). Build-wide export warnings (profile caps, long wire names, zone cycle messages) are collected once at the core export layer and deduplicated — each distinct message appears once in the preview and ZIP paths ([#319](https://github.com/pskillen/codeplug-studio/issues/319)). The shared [`ExportWarningsAlert`](../../../src/app/components/builds/ExportWarningsAlert.md) folds unlinked-item, member-cap, and shortened-name groups behind collapsed title + count headers ([#408](https://github.com/pskillen/codeplug-studio/issues/408)).

## Documentation map

| Doc                                                                                     | Topic                                         |
| --------------------------------------------------------------------------------------- | --------------------------------------------- |
| [profiles.md](profiles.md)                                                              | Radio profile picker                          |
| [wire-preview.md](wire-preview.md)                                                      | Wire name overrides and preview routes        |
| [wire-name-composition.md](wire-name-composition.md)                                    | Traits → fields for auto-generated wire names |
| [zone-grouping.md](zone-grouping.md)                                                    | Build zone layout editor                      |
| [`BuildSwitcher.md`](../../../src/app/components/builds/BuildSwitcher/BuildSwitcher.md) | Secondary-nav build identity + switcher       |

## Persistence

Builds are `FormatBuild` rows in IndexedDB (`formatBuilds` store). CRUD goes through `BuildService` and `useFormatBuilds` — same persistence port as library entities.

YAML import/export includes `formatBuilds[]` in the project document.

## Implementation status

| Area                         | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List + create + detail shell | Shipped | [#82](https://github.com/pskillen/codeplug-studio/issues/82); export-first IA + build switcher [#569](https://github.com/pskillen/codeplug-studio/issues/569)                                                                                                                                                                                                                                                                                                                                 |
| Per-build CPS export         | Shipped | `ExportBuildCpsPanel` — per-file CSV, ZIP download, Drive ZIP upload, CSV preview modal ([#151](https://github.com/pskillen/codeplug-studio/issues/151)); deduplicated export warnings ([#319](https://github.com/pskillen/codeplug-studio/issues/319)); foldable warning groups ([#408](https://github.com/pskillen/codeplug-studio/issues/408))                                                                                                                                             |
| Profile picker component     | Shipped | [#85](https://github.com/pskillen/codeplug-studio/issues/85) — `ProfilePicker`                                                                                                                                                                                                                                                                                                                                                                                                                |
| Wire preview + overrides     | Shipped | [#87](https://github.com/pskillen/codeplug-studio/issues/87) — sub-routes; [#349](https://github.com/pskillen/codeplug-studio/issues/349) — list + modal + channel bulk; list Skip/Force + entity settings cards + build Sort… ([#457](https://github.com/pskillen/codeplug-studio/issues/457)); zones reorder preview ([#468](https://github.com/pskillen/codeplug-studio/issues/468)); force-export for library omit zones ([#186](https://github.com/pskillen/codeplug-studio/issues/186)) |
| Zone grouping editor         | Shipped | Expandable zone rows on `/builds/:id/zones` — export-as-scan-list + member counts in row header ([#152](https://github.com/pskillen/codeplug-studio/issues/152), [#318](https://github.com/pskillen/codeplug-studio/issues/318)); DM32 carrier/scratch in expanded panel ([#121](https://github.com/pskillen/codeplug-studio/issues/121))                                                                                                                                                     |
| Multi-mode channel expansion | Shipped | [#89](https://github.com/pskillen/codeplug-studio/issues/89) — preview + OpenGD77 export                                                                                                                                                                                                                                                                                                                                                                                                      |
| Export name shortening       | Shipped | [#90](https://github.com/pskillen/codeplug-studio/issues/90) — `useExportSettings` + dictionary                                                                                                                                                                                                                                                                                                                                                                                               |
| Export inclusion flags       | Shipped | [#103](https://github.com/pskillen/codeplug-studio/issues/103) — orphan channels/TGs/RGLs on `FormatBuild` + export UI                                                                                                                                                                                                                                                                                                                                                                        |
| Channel behaviour overrides  | Shipped | [#420](https://github.com/pskillen/codeplug-studio/issues/420) — optional build `exportSettings` overrides on Export panel                                                                                                                                                                                                                                                                                                                                                                    |
| Target CPS / firmware versions | Shipped | [#596](https://github.com/pskillen/codeplug-studio/issues/596) — optional `FormatBuild.cpsVersion` / `firmwareVersion` on Overview → Target (schema v22)                                                                                                                                                                                                                                                                                                                                      |
| Export resolution summary    | Shipped | [#421](https://github.com/pskillen/codeplug-studio/issues/421) / [#443](https://github.com/pskillen/codeplug-studio/issues/443) — Channels + Zones tabs; zone-derived scan membership cascade                                                                                                                                                                                                                                                                                                 |
| Radio characteristics        | Shipped | [#515](https://github.com/pskillen/codeplug-studio/issues/515) — `/builds/:id/characteristics`; copy in `buildCapabilityCopy.ts`; limits via `getProfileExportLimits` (blanks for unmodelled caps)                                                                                                                                                                                                                                                                                            |

## Export inclusion flags

Per-build toggles on `FormatBuild` (default **on**) control whether orphan library entities are included in CPS export:

| Field                           | When enabled (default)                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `exportUnlinkedChannels`        | Channels not in any zone (zone-organised builds only; flat-memory builds ignore this flag) |
| `exportUnlinkedTalkGroups`      | Talk groups not referenced by an exported channel                                          |
| `exportUnlinkedRxGroupLists`    | RX group lists not referenced by an exported channel                                       |
| `exportUnlinkedDigitalContacts` | Digital contacts not referenced by an exported channel                                     |
| `exportUnlinkedAnalogContacts`  | Analog contacts not referenced by an exported channel                                      |

Switches on `/builds/:id/export` **and** the matching Build → entity settings cards persist to the build row. Wire preview `includedPreviewWireRows` honours the same flags.

- [profiles.md](profiles.md) — radio profile picker workflows
- [data-model](../data-model/README.md) — `FormatBuild`, trait layout, selections
- [import-export/opengd77](../import-export/opengd77/README.md) — OpenGD77 profiles
- [DESIGN.md](../../../DESIGN.md) — build capability traits

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
4. Review the build overview — edit profile, trait layout, and wire overrides.

See [profiles.md](profiles.md) for profile picker workflows.

Native YAML remains **project interchange** (library + all builds). It is not created via the new-build flow.

## Routes

| Route         | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `/builds`     | List builds for the active project                                            |
| `/builds/new` | Create build — format → profile → name                                        |
| `/builds/:id` | Build overview — identity, target profile, traits, layout placeholder, **Export to CPS** stub |

Requires an active project (`RequireActiveProject`).

Sidebar label is **Radio builds**; routes and code use `builds`.

## CPS export

Per-build CPS export is on the build detail page (`ExportBuildCpsPanelStub`) — not on Import / export. The import/export route keeps an **Export to CPS** section that links here.

## Persistence

Builds are `FormatBuild` rows in IndexedDB (`formatBuilds` store). CRUD goes through `BuildService` and `useFormatBuilds` — same persistence port as library entities.

YAML import/export includes `formatBuilds[]` in the project document.

## Implementation status

| Area                         | Status  | Notes                                                         |
| ---------------------------- | ------- | ------------------------------------------------------------- |
| List + create + detail shell | Shipped | [#82](https://github.com/pskillen/codeplug-studio/issues/82)  |
| Per-build CPS export stub    | Shipped | `ExportBuildCpsPanelStub` on build detail                     |
| Profile picker component     | Shipped | [#85](https://github.com/pskillen/codeplug-studio/issues/85) — `ProfilePicker` |
| Zone grouping editor         | Planned | [#87](https://github.com/pskillen/codeplug-studio/issues/87)  |
| CPS export download          | Planned | [#86](https://github.com/pskillen/codeplug-studio/issues/86)+ |

## Related

- [profiles.md](profiles.md) — radio profile picker workflows
- [data-model](../data-model/README.md) — `FormatBuild`, trait layout, selections
- [import-export/opengd77](../import-export/opengd77/README.md) — OpenGD77 profiles
- [DESIGN.md](../../../DESIGN.md) — build capability traits

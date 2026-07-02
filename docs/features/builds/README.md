# Format builds

Per-target CPS workflows that map the vendor-neutral [library](../library/README.md) to one radio format and profile.

**Tracking:** Phase 4a [#82](https://github.com/pskillen/codeplug-studio/issues/82) · Epic [#36](https://github.com/pskillen/codeplug-studio/issues/36)

**Source:** `src/app/routes/builds/`, `src/app/state/buildService.ts`

## Problem

The library holds RF semantics once. Each radio/CPS family expects different organisation (zones, flat memories, scan lists) and wire limits. A **format build** is the persisted assembly for one target — selections, trait layout, and wire-name overrides survive between sessions.

## Operator workflow

1. Curate channels, zones, and contacts in **Library**.
2. Open **Builds** → **New build**.
3. Pick a CPS format (OpenGD77, CHIRP, …) and a **profile** (trait + wire variant).
4. Review the build overview — trait editors and wire overrides ship in follow-on tickets.

Native YAML remains **project interchange** (library + all builds). It is not created via the new-build flow.

## Routes

| Route         | Purpose                                               |
| ------------- | ----------------------------------------------------- |
| `/builds`     | List builds for the active project                    |
| `/builds/new` | Create build — format → profile → name                |
| `/builds/:id` | Build overview — identity, traits, layout placeholder |

Requires an active project (`RequireActiveProject`).

## Persistence

Builds are `FormatBuild` rows in IndexedDB (`formatBuilds` store). CRUD goes through `BuildService` and `useFormatBuilds` — same persistence port as library entities.

YAML import/export includes `formatBuilds[]` in the project document.

## Implementation status

| Area                         | Status  | Notes                                                         |
| ---------------------------- | ------- | ------------------------------------------------------------- |
| List + create + detail shell | Shipped | [#82](https://github.com/pskillen/codeplug-studio/issues/82)  |
| Profile picker component     | Planned | [#85](https://github.com/pskillen/codeplug-studio/issues/85)  |
| Zone grouping editor         | Planned | [#87](https://github.com/pskillen/codeplug-studio/issues/87)  |
| CPS export from build        | Planned | [#86](https://github.com/pskillen/codeplug-studio/issues/86)+ |

## Related

- [data-model](../data-model/README.md) — `FormatBuild`, trait layout, selections
- [import-export/opengd77](../import-export/opengd77/README.md) — OpenGD77 profiles
- [DESIGN.md](../../../DESIGN.md) — build capability traits

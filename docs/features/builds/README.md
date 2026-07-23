# Radio builds

Per-target radio workflows that map the vendor-neutral [library](../library/README.md) to one handheld configuration, then egress via Web Serial and/or CPS files.

**Tracking:** Phase 4a [#82](https://github.com/pskillen/codeplug-studio/issues/82) · Epic [#36](https://github.com/pskillen/codeplug-studio/issues/36) · RadioBuild redesign [#654](https://github.com/pskillen/codeplug-studio/issues/654)

**Source:** `src/app/routes/builds/`, `src/app/state/buildService.ts`

## Problem

The library holds RF semantics once. Each radio expects different organisation (zones, flat memories, scan lists) and wire limits. A **radio build** (`RadioBuild`) is the persisted assembly for one **named configuration** of a catalog radio target — selections, trait layout, and wire-name overrides survive between sessions. Getting data onto the radio uses **egress pathways** (`EgressPath`: Web Serial, NeonPlug, CHIRP CSV, …) under that build.

## Many builds, same radio type

`radioTargetId` is a **catalog reference**, not a uniqueness key. A project may have several builds for the same handheld type, each with its own overrides and egress children:

| Build name   | `radioTargetId`     | Example difference                       |
| ------------ | ------------------- | ---------------------------------------- |
| UV-5R Team A | `baofeng-uv5r-mini` | Subset of channels; one scan config      |
| UV-5R Team B | `baofeng-uv5r-mini` | Different inclusions / scan / wire names |

Both share the **library**; each has its own `RadioBuild` → `assemble` → `EgressPath` tree. Creating another build for the same target always allocates a new UUID — no “one build per radio” gate.

## Operator workflow

1. Curate channels, zones, and contacts in **Library**.
2. Open **Export for radio** (sidebar) → **New build**.
3. Pick a **radio target** (e.g. Baofeng UV-5R Mini) and a display name (use names to distinguish Team A / Team B permutations).
4. Land on **Export** (default) — choose an **egress** (Web Serial, NeonPlug, CHIRP, …), then download / write / donor merge as that pathway requires.
5. Use **Setup** for rename/delete and capability badges; open **Radio characteristics** for organisation and export limits.
6. Shape wire names and zone layout on entity sub-routes — see [wire-preview.md](wire-preview.md).
7. Switch builds from the secondary-nav **Build** select without returning to the list.

See [profiles.md](profiles.md) for egress profile limits and the CHIRP runtime profile override on Export.

Native YAML remains **project interchange** (library + all radio builds + egress paths) on **Summary**. It is not created via the new-build flow.

## Export vs Setup

| Surface                            | Owns                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Export** (`/builds/:id/export`)  | **Radio-level** projection settings (gated by `radioTargetId` traits), then **egress switcher**, download / Drive / donor / hydration |
| **Setup** (`/builds/:id/overview`) | Build identity (rename/delete), catalog radio target, organisation capability badges                                                  |

Export does not host identity editors; Setup does not host download actions. Secondary nav lists **Export** first; `/builds/:id` redirects to Export.

Projection settings (scan inclusion, m×n, naming fill-ins, …) stay visible across pathway switches ([#658](https://github.com/pskillen/codeplug-studio/issues/658)). Pathway chrome (CHIRP profile picker, NeonPlug donor, Web Serial, CPS download) follows the active egress.

**Hydration** (NeonPlug donor `.neonplug`, Web Serial `radio-clone` image) is stored on the owning **`EgressPath`**, not on the `RadioBuild` row. NeonPlug settings and Radio image retain pages summarise hydration for that egress child. Secondary nav shows those pages whenever the matching bag is stored — the Export pathway switcher need not be on that egress ([#668](https://github.com/pskillen/codeplug-studio/issues/668)).

## Routes

| Route                           | Purpose                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/builds`                       | List builds — **Group**: List / By radio                                                                                                 |
| `/builds/new`                   | Create build — **choose radio target** → name (seeds all compatible egress children)                                                     |
| `/builds/:id`                   | Redirect → export                                                                                                                        |
| `/builds/:id/export`            | CPS export panel (default / front door)                                                                                                  |
| `/builds/:id/overview`          | Setup — identity, target profile, organisation badges                                                                                    |
| `/builds/:id/characteristics`   | Read-only radio characteristics — organisation, export limits, ladders                                                                   |
| `/builds/:id/channels`          | Wire preview — channels (list + modal)                                                                                                   |
| `/builds/:id/scan-list`         | Flat-memory only — per-channel scan include/skip as **build** overrides (CHIRP / NeonPlug UV5R); does not mutate library `scanInclusion` |
| `/builds/:id/channels/bulk`     | Wire preview — channel bulk edit                                                                                                         |
| `/builds/:id/zones`             | Wire preview — zones                                                                                                                     |
| `/builds/:id/scan-lists`        | Wire preview — dedicated scan lists (e.g. Anytone)                                                                                       |
| `/builds/:id/talk-groups`       | Wire preview — talk groups                                                                                                               |
| `/builds/:id/contacts`          | Wire preview — contacts                                                                                                                  |
| `/builds/:id/rx-group-lists`    | Wire preview — RX group lists                                                                                                            |
| `/builds/:id/export-resolution` | Read-only behavioural defaults cascade audit (Channels + Zones tabs)                                                                     |
| `/builds/:id/neonplug-settings` | When a NeonPlug donor bag is stored — read-only donor settings from that egress’s `hydration` (nav regardless of active pathway)          |
| `/builds/:id/radio-image`       | When a Web Serial `radio-clone` bag is stored — read-only clone image summary from that egress’s `hydration` (nav regardless of pathway) |

Requires an active project (`RequireActiveProject`).

Sidebar label is **Export for radio**; routes and code use `builds`. Secondary section title matches. [`BuildSwitcher`](../../../src/app/components/builds/BuildSwitcher/BuildSwitcher.md) sits above build nav links.

**CPS export:** Per-build CPS export is on `/builds/:id/export` (`ExportBuildCpsPanel`) — the build front door. Project YAML backup lives on [Summary](../report/README.md), not on a separate Import/export page.

**Web Serial:** create a radio target that lists a Web Serial egress (e.g. Baofeng UV-5R Mini). On Export, pick the **Web Serial** pathway: `BuildRadioIoPanel` hosts Read (hydrate `radio-clone` on that egress) / Write (`assemble` into the hydrated image). Secondary nav **Radio image** appears after a successful Read stores hydration (even if another pathway is selected). CPS file egresses (NeonPlug, CHIRP, …) remain separate children under the same build. See [radio-read-write](../radio-read-write/README.md) and [adding-a-radio-adapter.md](../radio-read-write/adding-a-radio-adapter.md).

**CSV preview** ([#151](https://github.com/pskillen/codeplug-studio/issues/151)): outline **Preview CSV** button (after Save ZIP to Drive) opens a modal with one tab per CPS file, rendered as a read-only table. Uses the same `exportBuildAll` path as download — see [`CpsCsvPreview.md`](../../../src/app/components/builds/CpsCsvPreview.md). Build-wide export warnings (profile caps, long wire names, zone cycle messages) are collected once at the core export layer and deduplicated — each distinct message appears once in the preview and ZIP paths ([#319](https://github.com/pskillen/codeplug-studio/issues/319)). The shared [`ExportWarningsAlert`](../../../src/app/components/builds/ExportWarningsAlert.md) folds unlinked-item, member-cap, and shortened-name groups behind collapsed title + count headers ([#408](https://github.com/pskillen/codeplug-studio/issues/408)).

## Documentation map

| Doc                                                                                     | Topic                                         |
| --------------------------------------------------------------------------------------- | --------------------------------------------- |
| [profiles.md](profiles.md)                                                              | Radio profile picker                          |
| [wire-preview.md](wire-preview.md)                                                      | Wire name overrides and preview routes        |
| [wire-name-composition.md](wire-name-composition.md)                                    | Traits → fields for auto-generated wire names |
| [zone-grouping.md](zone-grouping.md)                                                    | Build zone layout editor                      |
| [radio-build-egress-progress.md](radio-build-egress-progress.md)                        | #654 execution log (shipped)                  |
| [radio-build-egress-outstanding.md](radio-build-egress-outstanding.md)                  | #654 discovered debt                          |
| [`BuildSwitcher.md`](../../../src/app/components/builds/BuildSwitcher/BuildSwitcher.md) | Secondary-nav build identity + switcher       |

## Persistence

`RadioBuild` rows live in IndexedDB (`radioBuilds` store). Child `EgressPath` rows live in `egressPaths` (compound index `byRadioBuild`). CRUD goes through `BuildService` and `useFormatBuilds` (hook name retained) — same persistence port as library entities. **Schema v22** drops legacy `formatBuilds` outright — no build-data migration; library rows are untouched.

Native YAML import/export includes `radioBuilds[]` and `egressPaths[]` in the project document. Legacy documents with a non-empty `formatBuilds[]` are not migrated — that array is dropped with a single import warning (`radioBuilds` / `egressPaths` come back empty; library is retained).

## Implementation status

| Area                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| List + create + detail shell  | Shipped | [#82](https://github.com/pskillen/codeplug-studio/issues/82); export-first IA + build switcher [#569](https://github.com/pskillen/codeplug-studio/issues/569)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Per-build CPS export          | Shipped | `ExportBuildCpsPanel` — per-file CSV, ZIP download, Drive ZIP upload, CSV preview modal ([#151](https://github.com/pskillen/codeplug-studio/issues/151)); deduplicated export warnings ([#319](https://github.com/pskillen/codeplug-studio/issues/319)); foldable warning groups ([#408](https://github.com/pskillen/codeplug-studio/issues/408))                                                                                                                                                                                                                                                |
| Profile picker component      | Shipped | [#85](https://github.com/pskillen/codeplug-studio/issues/85) — `ProfilePicker`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Wire preview + overrides      | Shipped | [#87](https://github.com/pskillen/codeplug-studio/issues/87) — sub-routes; [#349](https://github.com/pskillen/codeplug-studio/issues/349) — list + modal + channel bulk; list Skip/Force + entity settings cards + build Sort… ([#457](https://github.com/pskillen/codeplug-studio/issues/457)); zones reorder preview ([#468](https://github.com/pskillen/codeplug-studio/issues/468)); force-export for library omit zones ([#186](https://github.com/pskillen/codeplug-studio/issues/186)); flat-memory scan build overrides ([#589](https://github.com/pskillen/codeplug-studio/issues/589)) |
| Zone grouping editor          | Shipped | Expandable zone rows on `/builds/:id/zones` — export-as-scan-list + member counts in row header ([#152](https://github.com/pskillen/codeplug-studio/issues/152), [#318](https://github.com/pskillen/codeplug-studio/issues/318)); DM32 carrier/scratch in expanded panel ([#121](https://github.com/pskillen/codeplug-studio/issues/121))                                                                                                                                                                                                                                                        |
| Multi-mode channel expansion  | Shipped | [#89](https://github.com/pskillen/codeplug-studio/issues/89) — preview + OpenGD77 export                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Export name shortening        | Shipped | [#90](https://github.com/pskillen/codeplug-studio/issues/90) — `useExportSettings` + dictionary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Export inclusion flags        | Shipped | [#103](https://github.com/pskillen/codeplug-studio/issues/103) — orphan channels/TGs/RGLs on `RadioBuild` + export UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Channel behaviour overrides   | Shipped | [#420](https://github.com/pskillen/codeplug-studio/issues/420) — optional build `exportSettings` overrides on Export panel                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Export resolution summary     | Shipped | [#421](https://github.com/pskillen/codeplug-studio/issues/421) / [#443](https://github.com/pskillen/codeplug-studio/issues/443) — Channels + Zones tabs; zone-derived scan membership cascade                                                                                                                                                                                                                                                                                                                                                                                                    |
| Radio characteristics         | Shipped | [#515](https://github.com/pskillen/codeplug-studio/issues/515) — `/builds/:id/characteristics`; copy in `buildCapabilityCopy.ts`; limits via `getProfileExportLimits` (blanks for unmodelled caps)                                                                                                                                                                                                                                                                                                                                                                                               |
| RadioBuild + EgressPath       | Shipped | [#654](https://github.com/pskillen/codeplug-studio/issues/654) — radio-centric `RadioBuild` + child `EgressPath` pathways; egress switcher on Export; hydration on egress; schema v22                                                                                                                                                                                                                                                                                                                                                                                                            |
| Export projection trait gates | Shipped | [#658](https://github.com/pskillen/codeplug-studio/issues/658) — Export settings visibility / fill-ins from `radioTargetId` traits (not active egress profile)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Retain viewer nav             | Shipped | [#668](https://github.com/pskillen/codeplug-studio/issues/668) — NeonPlug settings / Radio image when hydration bag exists (not only while pathway active)                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Export inclusion flags

Per-build toggles on `RadioBuild` (default **on**) control whether orphan library entities are included in CPS export:

| Field                           | When enabled (default)                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `exportUnlinkedChannels`        | Channels not in any zone (zone-organised builds only; flat-memory builds ignore this flag) |
| `exportUnlinkedTalkGroups`      | Talk groups not referenced by an exported channel                                          |
| `exportUnlinkedRxGroupLists`    | RX group lists not referenced by an exported channel                                       |
| `exportUnlinkedDigitalContacts` | Digital contacts not referenced by an exported channel                                     |
| `exportUnlinkedAnalogContacts`  | Analog contacts not referenced by an exported channel                                      |

Switches on `/builds/:id/export` **and** the matching Build → entity settings cards persist to the build row. Wire preview `includedPreviewWireRows` honours the same flags.

- [profiles.md](profiles.md) — radio profile picker workflows
- [data-model](../data-model/README.md) — `RadioBuild`, `EgressPath`, trait layout, overrides
- [import-export/opengd77](../import-export/opengd77/README.md) — OpenGD77 profiles
- [DESIGN.md](../../../DESIGN.md) — build capability traits

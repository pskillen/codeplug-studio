# Library CRUD

Tier-1 reference for editing the vendor-neutral **library** — the per-project inventory of channels, talk groups, contacts, RX group lists, and zones.

**Tracking:** Phase 2 [#10](https://github.com/pskillen/codeplug-studio/issues/10) (persistence: [#9](https://github.com/pskillen/codeplug-studio/issues/9), Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)); list routes [#20](https://github.com/pskillen/codeplug-studio/issues/20), channels table [#24](https://github.com/pskillen/codeplug-studio/issues/24), zone picker [#25](https://github.com/pskillen/codeplug-studio/issues/25)

**Source:** `src/app/routes/library/`, `src/app/state/` (`useLibrary`, `libraryService`), `src/core/domain/references.ts`

## Documentation map

| Doc                                                                             | Contents                              |
| ------------------------------------------------------------------------------- | ------------------------------------- |
| [mode-profiles-progress.md](mode-profiles-progress.md)                          | Multi-mode editor initiative progress |
| [zone-member-picker.md](zone-member-picker.md)                                  | Two-list zone membership editor       |
| [channel-sets-progress.md](channel-sets-progress.md)                            | Channel sets initiative ([#172](https://github.com/pskillen/codeplug-studio/issues/172)) |
| [rx-group-list-member-picker.md](rx-group-list-member-picker.md)                | Two-list RX group list member editor  |
| [app-shell/data-table.md](../app-shell/data-table.md)                           | Shared `DataTable` and list prefs     |
| [app-shell/library-routes-progress.md](../app-shell/library-routes-progress.md) | List routes initiative progress       |

## List routes

`/library` redirects to `/library/channels`. Each entity kind has a dedicated list page; section nav order matches `routes/library/nav.ts`:

| List route                | UI                                                                                                           | Map |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | --- |
| `/library/channels`       | `DataTable` — sortable columns, toolbar search, hideable optional columns, URL + `localStorage` filter prefs | Yes |
| `/library/zones`          | `DataTable` — members, comment; operator location + map below table                                          | Yes |
| `/library/talk-groups`    | `DataTable` — mode, ID, optional Abbrev, channels/RX lists using, comment                                    | No  |
| `/library/contacts`       | Two `DataTable` sections: digital contacts + analog contacts (separate `dq` / `aq` URL filters)              | No  |
| `/library/rx-group-lists` | `DataTable` — members, channels using                                                                        | No  |

Shared list UI: [app-shell/data-table.md](../app-shell/data-table.md).

### Channels list (#24)

- Filters in section nav: name/callsign search, band, mode, simplex/split, distance radius (when operator location is set).
- Filter state syncs to URL query params and per-project `localStorage`.
- Column sort and visibility prefs persist per project.
- `modeProfiles[]` drives mode pills and mode filter matching (vendor-neutral labels only).

### Contacts page

Digital and analog contacts remain separate models and editor slugs (`digital-contacts`, `analog-contacts`); the combined `/library/contacts` list page is a UX grouping only. Each section has its own `DataTable`, name filter (`dq` / `aq` URL params), and persisted column sort.

### Zone member picker (#25)

Zone editor uses `ZoneMemberPicker` — available ↔ in-zone lists with per-side search, add/remove, and move up/down. Saved `Zone.members` preserves **picker order** as `{ kind: 'channel', id }[]`. See [zone-member-picker.md](zone-member-picker.md).

### RX group list member picker ([#107](https://github.com/pskillen/codeplug-studio/issues/107), [#108](https://github.com/pskillen/codeplug-studio/issues/108))

RX group list editor uses `RxGroupListMemberPicker` — same interaction pattern as zones, with a unified talk-group + digital-contact pool. Per-member `timeSlotOverride` (`Auto` / `TS1` / `TS2`) is editable on the in-list side for DMR members. See [rx-group-list-member-picker.md](rx-group-list-member-picker.md).

### Channel DMR RX list summary ([#75](https://github.com/pskillen/codeplug-studio/issues/75))

Channel editor DMR tab shows `RxGroupListSummary` below the RX group list selector — live member preview with link to the list editor. Sidecar: `src/app/components/library/RxGroupListSummary.md`.

### Channel sets ([#172](https://github.com/pskillen/codeplug-studio/issues/172))

**Route:** `/library/channels/add-channel-set` — section nav **Add channel set…**

Generate curated frequency inventories into the library:

| Set | Channels | Notes |
| --- | --- | --- |
| PMR446 | 16 | Default `forbidTransmit` |
| UK VHF simplex (V- or S-channels) | 30 | Same grid, pick naming scheme |
| UK UHF simplex (U272–U288 or legacy U16–U32) | 17 | Same grid, pick naming scheme |
| UK CB / EU CEPT CB | 40 each | |

Workflow: pick set → preview table with dedup status → optional power, forbid-TX, name prefix, **also create zone** → bulk `putChannel` (+ optional `putZone`). Duplicate RX frequencies in the library are skipped.

- Core: `src/core/domain/channelSets/`, `src/core/services/channelSetImport.ts`
- UI: `ChannelSetPicker` — sidecar `src/app/components/channelSets/ChannelSetPicker.md`
- Reference: [channel-sets.md](../../reference/channel-sets.md)

## Editor routes

| Path                 | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `/library/:kind/:id` | Edit an entity (`:id` = `new` to create) |

`:kind` is a slug (`channels`, `talk-groups`, `digital-contacts`, `analog-contacts`, `rx-group-lists`, `zones`) mapped to an internal `EntityKind` in `routes/library/registry.ts`. Editors navigate back to the matching list route on save/cancel via `listPathForEditorSlug()`.

## Entities and editors

| Entity          | Key fields                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Channel         | name, optional `abbreviation` (export shortening), callsign, RX/TX (MHz↔Hz), power, location + `maidenheadLocator`, scan-skip, comment, **multi** `modeProfiles[]` |
| Talk group      | name, optional `abbreviation` (multi-TG export shortening), digital mode, group ID, comment                                                                        |
| Digital contact | name, digital mode, contact ID, comment                                                                                                                            |
| Analog contact  | name, code, comment                                                                                                                                                |
| RX group list   | name, members (talk groups / digital contacts); optional `timeSlotOverride` per member (`1` \| `2` \| unset)                                                       |
| Zone            | name, ordered channel members (`EntityRef[]`), comment                                                                                                             |

Channel DMR profiles reference a **digital contact** and an **RX group list** by UUID `id` (the editor exposes dropdowns); NXDN/TETRA profiles may reference talk groups by UUID. RX group lists and zones hold member `EntityRef[]`. `RxGroupListMember.timeSlotOverride` is an optional per-member DMR slot hint (vendor-neutral; maps to CPS TS Override at export). Names are display labels only — never foreign keys.

### Channel editor ([#16](https://github.com/pskillen/codeplug-studio/issues/16), [#28](https://github.com/pskillen/codeplug-studio/issues/28))

- **No default mode** on new channels — operator selects modes via multi-select; `modeProfiles` starts empty.
- **Location section:** Maidenhead locator, lat/lon, use-location, map click/drag (`ChannelLocationSection` + `MapLocationPicker`). Save reconciles locator ↔ coords via `reconcileChannelLocation` (coordinates win on conflict).
- **Mode profiles:** tabbed editor per selected mode (`ChannelModeProfilesEditor`).
- **DMR tab:** below the RX group list selector, `RxGroupListSummary` shows the selected list's members (name, kind, digital ID, timeslot override) with a link to the list editor ([#75](https://github.com/pskillen/codeplug-studio/issues/75)).
- Component sidecars under `src/app/components/channels/` and `MapLocationPicker/`.

### Talk group editor ([#110](https://github.com/pskillen/codeplug-studio/issues/110))

- **Identity:** name + optional abbreviation on one row (`TalkGroupEditor`); `TalkGroupWireNameExamples` shows informational multi-talkgroup wire-name previews at a typical 16-character limit.
- **List:** optional **Abbrev** column on `/library/talk-groups` (default visible).
- **Persistence:** empty abbreviation omitted on save; native YAML round-trip preserves the field.
- Sidecar: `src/app/components/library/TalkGroupWireNameExamples.md`.

## Data flow

```text
Editor → persistence.put<Entity>(row, expectedRevision)  // optimistic concurrency
list   ← useLibrary() → LibraryService.loadLibrary(projectId)
change → persistence.subscribe(...) → useLibrary refresh (this tab + other tabs)
delete → LibraryService.deleteWithIntegrity → findReferencesTo (core)
```

- **Optimistic concurrency:** editors save with the loaded `revision`; a stale write returns `revision_conflict` and the editor shows a reload-and-retry message.
- **Referential integrity:** deletes are **blocked** when another entity still references the target (e.g. a zone listing a channel, an RX group list listing a talk group, a channel DMR profile pointing at a contact / RX list). The block lists the referencing entities.

## Boundaries

- Vendor-neutral: no radio caps, format strings, or CSV concepts. Cardinality/limits and **CPS wire names** belong on the **format build** (`FormatBuild` selections and overrides), not here.
- `core` holds pure domain + integrity (`references.ts`); persistence orchestration lives in the app layer (`LibraryService`), never in `core`.

## Library vs format build

The library holds RF facts you curate once (frequency, mode, contact refs, human-readable names). When you export to a specific radio, a persisted **`FormatBuild`** maps those entities to that CPS workflow — trait layout, which rows participate, and **wire-name overrides** (including shortened names for 16-character limits or m×n expansion). Export always uses **both** layers; see [data-model — Two persisted layers](../data-model/README.md#two-persisted-layers-not-one-export-format).

## Related

- [app-shell/data-table.md](../app-shell/data-table.md) · [zone-member-picker.md](zone-member-picker.md) · [rx-group-list-member-picker.md](rx-group-list-member-picker.md)
- [app-shell/library-routes-progress.md](../app-shell/library-routes-progress.md) · [app-shell/library-routes-outstanding.md](../app-shell/library-routes-outstanding.md)
- [map](../map/README.md) — map on channels/zones list routes
- [data-model](../data-model/README.md) · [app-shell](../app-shell/README.md)
- [storage.md](../../poc-migration/storage.md) — persistence design

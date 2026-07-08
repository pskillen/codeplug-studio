# Library CRUD

Tier-1 reference for editing the vendor-neutral **library** — the per-project inventory of channels, talk groups, contacts, RX group lists, scan lists, and zones.

**Tracking:** Phase 2 [#10](https://github.com/pskillen/codeplug-studio/issues/10) (persistence: [#9](https://github.com/pskillen/codeplug-studio/issues/9), Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)); list routes [#20](https://github.com/pskillen/codeplug-studio/issues/20), channels table [#24](https://github.com/pskillen/codeplug-studio/issues/24), zone picker [#25](https://github.com/pskillen/codeplug-studio/issues/25); zone management epic [#179](https://github.com/pskillen/codeplug-studio/issues/179)

**Source:** `src/app/routes/library/`, `src/app/state/` (`useLibrary`, `libraryService`), `src/core/domain/references.ts`

## Implementation status

| Area                                    | Status                                                                                                                                   | Notes                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Zone + channel editor cross-links       | Shipped ([#180](https://github.com/pskillen/codeplug-studio/issues/180))                                                                 | Revision-2 — see [zone-member-picker.md](zone-member-picker.md)                |
| Channel / zone delete                   | Shipped ([#180](https://github.com/pskillen/codeplug-studio/issues/180), [#202](https://github.com/pskillen/codeplug-studio/issues/202)) | All entity kinds — editors + list row actions; channel zone-membership cascade |
| Unsaved-changes guard on editors        | Shipped ([#189](https://github.com/pskillen/codeplug-studio/issues/189))                                                                 | `UnsavedChangesModal` + `useEntityEditorUnsavedGuard` on all entity editors    |
| Channels list bulk selection → new zone | Shipped ([#154](https://github.com/pskillen/codeplug-studio/issues/154))                                                                 | `DataTable` selectable; **New zone from selected**                             |
| Channels list bulk edit                 | Shipped ([#207](https://github.com/pskillen/codeplug-studio/issues/207))                                                                 | **Bulk edit** modal — scan, forbid TX, power, analog squelch                   |
| Zone from location (proximity)          | Shipped ([#181](https://github.com/pskillen/codeplug-studio/issues/181))                                                                 | Section nav **New zone from location**                                         |
| Nested zone members                     | Shipped ([#157](https://github.com/pskillen/codeplug-studio/issues/157))                                                                 | Flatten at export; `omitFromExport`; schema v7                                 |
| Tri-state scan inclusion                | Shipped ([#203](https://github.com/pskillen/codeplug-studio/issues/203))                                                                 | `scanInclusion`; build export default; schema v8                               |
| Library scan lists                      | Shipped ([#257](https://github.com/pskillen/codeplug-studio/issues/257))                                                                 | `ScanList` entity; schema v10; Anytone dedicated scan                          |
| Zone member editor                      | Shipped ([#180](https://github.com/pskillen/codeplug-studio/issues/180))                                                                 | Vertical stacked editor on zone form                                           |
| Channel sets                            | Shipped ([#172](https://github.com/pskillen/codeplug-studio/issues/172))                                                                 | Optional zone on import                                                        |
| OpenAIP airband import                  | Shipped ([#263](https://github.com/pskillen/codeplug-studio/issues/263))                                                                 | `/library/channels/add-from-openaip` — see [aviation](../aviation/README.md)   |

## Documentation map

| Doc                                                                             | Contents                                                                                        |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [mode-profiles-progress.md](mode-profiles-progress.md)                          | Multi-mode editor initiative progress                                                           |
| [zone-member-picker.md](zone-member-picker.md)                                  | Vertical zone member editor ([#180](https://github.com/pskillen/codeplug-studio/issues/180))    |
| [library-zones-revision-2-progress.md](library-zones-revision-2-progress.md)    | Revision-2 zone management progress                                                             |
| [nested-zones.md](nested-zones.md)                                              | Hierarchical zones; flatten at export                                                           |
| [channel-sets-progress.md](channel-sets-progress.md)                            | Channel sets initiative ([#172](https://github.com/pskillen/codeplug-studio/issues/172))        |
| [rx-group-list-member-picker.md](rx-group-list-member-picker.md)                | Two-list RX group list member editor                                                            |
| [scan-lists.md](scan-lists.md)                                                  | Library scan lists ([#257](https://github.com/pskillen/codeplug-studio/issues/257))             |
| [aviation](../aviation/README.md)                                               | OpenAIP airport airband import ([#263](https://github.com/pskillen/codeplug-studio/issues/263)) |
| [app-shell/data-table.md](../app-shell/data-table.md)                           | Shared `DataTable` and list prefs                                                               |
| [app-shell/library-routes-progress.md](../app-shell/library-routes-progress.md) | List routes initiative progress                                                                 |

## List routes

`/library` redirects to `/library/channels`. Each entity kind has a dedicated list page; section nav order matches `routes/library/nav.ts`:

| List route                | UI                                                                                                                                                | Map |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `/library/channels`       | `DataTable` — sortable columns, **Zones** column, delete row action, toolbar search, hideable optional columns, URL + `localStorage` filter prefs | Yes |
| `/library/zones`          | `DataTable` — members, comment, delete row action; operator location + map below table                                                            | Yes |
| `/library/talk-groups`    | `DataTable` — mode, ID, optional Abbrev, channels/RX lists using, comment, delete row action                                                      | No  |
| `/library/contacts`       | Two `DataTable` sections: digital contacts + analog contacts (separate `dq` / `aq` URL filters), delete row action each                           | No  |
| `/library/rx-group-lists` | `DataTable` — members, channels using, delete row action                                                                                          | No  |
| `/library/scan-lists`     | `DataTable` — member count, channels-using ref count, delete row action                                                                           | No  |

Shared list UI: [app-shell/data-table.md](../app-shell/data-table.md).

### Channels list (#24)

- Filters on the list page (`ChannelListFilters`): band, mode, simplex/split, distance radius (when operator location is set). Name/callsign search is on the `DataTable` toolbar only.
- The embedded map plots the **same filtered channel set** as the table (all active filters apply).
- Filter state syncs to URL query params and per-project `localStorage`.
- Column sort and visibility prefs persist per project.
- `modeProfiles[]` drives mode pills and mode filter matching (vendor-neutral labels only).
- **Row checkboxes**, **Bulk edit** ([#207](https://github.com/pskillen/codeplug-studio/issues/207)), and **New zone from selected** ([#154](https://github.com/pskillen/codeplug-studio/issues/154)).
  - **Bulk edit** — select 2+ channels to open `ChannelBulkEditModal` (see sidecar `ChannelBulkEditModal.md`). Each field is opt-in; unset fields leave existing values. Channel-level: scan inclusion, forbid TX, power. Analog squelch patches existing analog mode profiles only (skipped on digital-only channels). Selecting exactly one channel opens the standard channel editor instead.
  - **New zone from selected** — navigates to zone editor with members pre-filled in table order.
- **Zones** column — direct zone badges (link to zone editor), **Not in a zone** / **Nested only** when applicable ([#180](https://github.com/pskillen/codeplug-studio/issues/180)).
- **Delete** row action — removes channel; offers remove-from-zones cascade when blocked by zone membership.

### Zone member editor (#25, #157, #180)

Zone editor uses **`ZoneMemberEditor`** — vertical layout: rich **In this zone** list (export order, per-channel `includeInScanList`, reorder) above **Other channels & zones** add pool. Channel editor shows **`ChannelZoneMembershipSection`** — list zones containing the channel, add/remove without opening each zone. See [zone-member-picker.md](zone-member-picker.md). Sidecars: `ZoneMemberEditor.md`, `ChannelZoneMembershipSection.md`.

The zone editor map uses **Draw this zone** / **Draw other zones** controls: the editing zone hull is full colour; other library zones render muted for reference. Channels outside the zone are dimmed on the map (same treatment as out-of-radius channels on zone-from-location). Auto-fit zoom uses only the editing zone's member channels (not the full library).

### Contacts page

Digital and analog contacts remain separate models and editor slugs (`digital-contacts`, `analog-contacts`); the combined `/library/contacts` list page is a UX grouping only. Each section has its own `DataTable`, name filter (`dq` / `aq` URL params), and persisted column sort.

### Zone from location ([#181](https://github.com/pskillen/codeplug-studio/issues/181))

**Route:** `/library/zones/new-from-location` — section nav **New zone from location**

Map-first workflow to create a zone from geolocated channels within a radius of a reference point:

1. Set **reference position** — map click, Maidenhead locator, city/postcode geocode (Photon or Mapbox), **Use my location**, or pick an existing channel with coordinates.
2. Choose **radius** (km slider with snap marks 5–200; default 25).
3. Preview on the map — radius circle, dimmed out-of-radius channels, optional dashed **Draw new zone** hull; existing zones shown muted when **Draw other zones** is on.
4. Review the **selected channels** table (nearest-first order).
5. **Create zone** — persists a new `Zone` with channel members and opens the zone editor.

Core selection: `selectChannelsWithinRadius` in `src/core/domain/proximityZone.ts`. Channels without coordinates are excluded. Membership is a static snapshot at creation time.

### RX group list member picker ([#107](https://github.com/pskillen/codeplug-studio/issues/107), [#108](https://github.com/pskillen/codeplug-studio/issues/108))

RX group list editor uses `RxGroupListMemberPicker` — same interaction pattern as zones, with a unified talk-group + digital-contact pool. Per-member `timeSlotOverride` (`Auto` / `TS1` / `TS2`) is editable on the in-list side for DMR members. See [rx-group-list-member-picker.md](rx-group-list-member-picker.md).

### Scan lists ([#257](https://github.com/pskillen/codeplug-studio/issues/257))

**Route:** `/library/scan-lists` — section nav **Scan lists**

`ScanListEditor` uses `ScanListMemberEditor` for ordered channel membership (channels only — no nested zones). Build pages for `DedicatedScanLists` profiles link here for list curation; per-channel scan assignment stays on the build Channels wire page. See [scan-lists.md](scan-lists.md).

### Channel DMR RX list summary ([#75](https://github.com/pskillen/codeplug-studio/issues/75))

Channel editor DMR tab shows `RxGroupListSummary` below the RX group list selector — live member preview with link to the list editor. Sidecar: `src/app/components/library/RxGroupListSummary.md`.

### Channel sets ([#172](https://github.com/pskillen/codeplug-studio/issues/172))

**Route:** `/library/channels/add-channel-set` — section nav **Add channel set…**

Generate curated frequency inventories into the library:

| Set                                            | Channels | Notes                    |
| ---------------------------------------------- | -------- | ------------------------ |
| PMR446                                         | 16       | Default `forbidTransmit` |
| UK VHF simplex (V-channels or legacy S08–S23)  | 30 / 16  | Pick naming scheme       |
| UK UHF simplex (U272–U288 or legacy SU16–SU32) | 17       | Pick naming scheme       |
| UK CB / EU CEPT CB                             | 40 each  |                          |

Workflow: pick set → preview table (per-channel checkboxes, dedup status) → optional power, **bandwidth** (12.5 or 25 kHz), forbid-TX, name prefix, **also create zone** → bulk `putChannel` (+ optional `putZone`). Duplicate RX frequencies in the library are skipped.

- Core: `src/core/domain/channelSets/`, `src/core/services/channelSetImport.ts`
- UI: `ChannelSetPicker` — sidecar `src/app/components/channelSets/ChannelSetPicker.md`
- Reference: [channel-sets.md](../../reference/channel-sets.md)

### OpenAIP airband ([#263](https://github.com/pskillen/codeplug-studio/issues/263))

**Route:** `/library/channels/add-from-openaip` — section nav **Add from OpenAIP**

Search [OpenAIP](https://www.openaip.net/) for airport frequencies and import RX-only AM channels:

1. Configure API key in Settings (browser storage only).
2. Search by ICAO/IATA/name, town, Maidenhead locator, or current location + radius.
3. Review map and per-airport frequency tables; add one airport or batch selected.
4. Optional **Create zone per airport** on import.

Core: `src/core/domain/airband/`, `src/core/services/airbandImport.ts`. Integration: `src/integrations/aviation/`. UI: `OpenAipAirportSearch` — sidecar `src/app/components/aviation/OpenAipAirportSearch.md`. Reference: [openaip](../../reference/openaip/README.md). Feature hub: [aviation](../aviation/README.md).

Airband is **not** a static channel set — see [channel-sets-outstanding.md](channel-sets-outstanding.md).

## Editor routes

| Path                 | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `/library/:kind/:id` | Edit an entity (`:id` = `new` to create) |

`:kind` is a slug (`channels`, `talk-groups`, `digital-contacts`, `analog-contacts`, `rx-group-lists`, `scan-lists`, `zones`) mapped to an internal `EntityKind` in `routes/library/registry.ts`. Editors navigate back to the matching list route on save/cancel via `listPathForEditorSlug()`.

### Unsaved changes ([#189](https://github.com/pskillen/codeplug-studio/issues/189))

All entity editors track dirty form state against the mount baseline (`useEntityEditorUnsavedGuard`). When dirty:

- In-app navigation (Cancel link, section nav, back link) opens [`UnsavedChangesModal`](../../src/app/components/ui/UnsavedChangesModal.md) — Stay or Leave.
- Tab close triggers the browser `beforeunload` prompt.
- **Save** calls `permitNavigationOnce` before navigating back to the list.

**Not guarded:** zone membership on the channel editor **Zones** tab — `ChannelZoneMembershipSection` persists add/remove immediately (separate from the main channel form).

## Entities and editors

| Entity          | Key fields                                                                                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel         | name, optional `abbreviation` (export shortening), callsign, RX/TX (MHz↔Hz), power, location + `maidenheadLocator`, `scanInclusion` (default/skip/alwaysScan), optional `scanListId` (FK to library scan list), comment, **multi** `modeProfiles[]` |
| Talk group      | name, optional `abbreviation` (multi-TG export shortening), digital mode, group ID, comment                                                                                                                                                         |
| Digital contact | name, digital mode, contact ID, comment                                                                                                                                                                                                             |
| Analog contact  | name, code, comment                                                                                                                                                                                                                                 |
| RX group list   | name, members (talk groups / digital contacts); optional `timeSlotOverride` per member (`1` \| `2` \| unset)                                                                                                                                        |
| Scan list       | name, ordered `memberChannelIds` (channel UUID FKs)                                                                                                                                                                                                 |
| Zone            | name, ordered members (`channel` and/or nested `zone` refs), comment                                                                                                                                                                                |

Channel DMR profiles reference a **digital contact** and an **RX group list** by UUID `id` (the editor exposes dropdowns); NXDN/TETRA profiles may reference talk groups by UUID. RX group lists and zones hold member `EntityRef[]`. `RxGroupListMember.timeSlotOverride` is an optional per-member DMR slot hint (vendor-neutral; maps to CPS TS Override at export). Names are display labels only — never foreign keys.

### Channel editor ([#16](https://github.com/pskillen/codeplug-studio/issues/16), [#28](https://github.com/pskillen/codeplug-studio/issues/28))

- **Top-level tabs:** Identity, Frequencies, Modes (mode pick + `PillTabs` profiles), **Scanning** (`scanInclusion` + `scanListId`), Location, Zone membership (edit only), Repeater verify (edit only) — reduces scroll on long channel forms.
- **No default mode** on new channels — operator selects modes via card grid (`ChannelModesMultiSelect`); `modeProfiles` starts empty.
- **Location section:** Maidenhead locator, lat/lon, use-location, map click/drag (`ChannelLocationSection` + `MapLocationPicker`). Map unmounts when another editor tab is active ([#208](https://github.com/pskillen/codeplug-studio/issues/208)). Save reconciles locator ↔ coords via `reconcileChannelLocation` (coordinates win on conflict).
- **Mode profiles:** tabbed editor per selected mode (`ChannelModeProfilesEditor`).
- **Zone membership** (edit only): `ChannelZoneMembershipSection` — zones containing this channel, add/remove ([#180](https://github.com/pskillen/codeplug-studio/issues/180)).
- **Duplicate** and **Delete channel** actions on saved channels ([#180](https://github.com/pskillen/codeplug-studio/issues/180)).
- **DMR tab:** below the RX group list selector, `RxGroupListSummary` shows the selected list's members (name, kind, digital ID, timeslot override) with a link to the list editor ([#75](https://github.com/pskillen/codeplug-studio/issues/75)).
- Component sidecars under `src/app/components/channels/` and `MapLocationPicker/`.

### Talk group editor ([#110](https://github.com/pskillen/codeplug-studio/issues/110))

- **Identity:** name + optional abbreviation on one row (`TalkGroupEditor`); `TalkGroupWireNameExamples` shows informational multi-talkgroup wire-name previews at a typical 16-character limit.
- **Mode:** `GradientSegmentedControl` with `digitalModes` scheme — segment colours match `ModePill` (`channelModes.ts`).
- **List:** optional **Abbrev** column on `/library/talk-groups` (default visible).
- **Persistence:** empty abbreviation omitted on save; native YAML round-trip preserves the field.
- Sidecar: `src/app/components/library/TalkGroupWireNameExamples.md`.

### Digital contact editor

- **Identity:** `DigitalContactEditor` — Mantine `FormSection`, `TextInput`, Save/Cancel `Group` (matches talk group / channel editor shell).
- **Mode:** `GradientSegmentedControl` with `digitalModes` scheme — same labels and colours as talk groups and `ModePill`.

### Analog contact editor

- **Identity:** `AnalogContactEditor` — same Mantine form shell as digital contacts (name, code, comment).

## Data flow

```text
Editor → persistence.put<Entity>(row, expectedRevision)  // optimistic concurrency
list   ← useLibrary() → LibraryService.loadLibrary(projectId)
change → persistence.subscribe(...) → useLibrary refresh (this tab + other tabs)
delete → LibraryService.deleteWithIntegrity → findReferencesTo (core)
```

- **Optimistic concurrency:** editors save with the loaded `revision`; a stale write returns `revision_conflict` and the editor shows a reload-and-retry message.
- **Referential integrity:** deletes are **blocked** when another entity still references the target (e.g. a zone listing a channel, an RX group list listing a talk group, a channel mode profile pointing at a contact / RX list / talk group, a parent zone nesting a child zone). The block lists the referencing entities.
- **Delete UI ([#202](https://github.com/pskillen/codeplug-studio/issues/202)):** every saved entity has a **Delete** button on its editor (`EntityDeleteButton`; channels use `ChannelDeleteButton` for zone cascade). List pages add a trash **actions** column (`EntityListDeleteAction`; channels use `ChannelListDeleteAction`). Flow: `runEntityDeleteFlow` → `useLibrary().deleteEntity` → `LibraryService.deleteWithIntegrity`. Channel delete may offer remove-from-zones cascade when blocked only by zone membership.

## Boundaries

- Vendor-neutral: no radio caps, format strings, or CSV concepts. Cardinality/limits and **CPS wire names** belong on the **format build** (`FormatBuild` selections and overrides), not here.
- `core` holds pure domain + integrity (`references.ts`); persistence orchestration lives in the app layer (`LibraryService`), never in `core`.

## Library vs format build

The library holds RF facts you curate once (frequency, mode, contact refs, human-readable names). When you export to a specific radio, a persisted **`FormatBuild`** maps those entities to that CPS workflow — trait layout, which rows participate, and **wire-name overrides** (including shortened names for 16-character limits or m×n expansion). Export always uses **both** layers; see [data-model — Two persisted layers](../data-model/README.md#two-persisted-layers-not-one-export-format).

## Related

- [app-shell/data-table.md](../app-shell/data-table.md) · [zone-member-picker.md](zone-member-picker.md) · [rx-group-list-member-picker.md](rx-group-list-member-picker.md)
- [app-shell/library-routes-progress.md](../app-shell/library-routes-progress.md) · [app-shell/library-routes-outstanding.md](../app-shell/library-routes-outstanding.md)
- [map](../map/README.md) — maps on channels/zones list routes + Summary overview
- [data-model](../data-model/README.md) · [app-shell](../app-shell/README.md)
- [storage.md](../../poc-migration/storage.md) — persistence design

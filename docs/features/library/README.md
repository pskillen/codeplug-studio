# Library CRUD

Tier-1 reference for editing the vendor-neutral **library** — the per-project inventory of channels, talk groups, contacts, RX group lists, scan lists, and zones.

**Tracking:** Phase 2 [#10](https://github.com/pskillen/codeplug-studio/issues/10) (persistence: [#9](https://github.com/pskillen/codeplug-studio/issues/9), Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)); list routes [#20](https://github.com/pskillen/codeplug-studio/issues/20), channels table [#24](https://github.com/pskillen/codeplug-studio/issues/24), zone picker [#25](https://github.com/pskillen/codeplug-studio/issues/25); zone management epic [#179](https://github.com/pskillen/codeplug-studio/issues/179)

**Source:** `src/app/routes/library/`, `src/app/state/` (`useLibrary`, `libraryService`), `src/core/domain/references.ts`

## Implementation status

| Area                                      | Status                                                                                                                                         | Notes                                                                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zone + channel editor cross-links         | Shipped ([#180](https://github.com/pskillen/codeplug-studio/issues/180))                                                                       | Revision-2 — see [zone-member-picker.md](zone-member-picker.md)                                                                                                                |
| Channel / zone delete                     | Shipped ([#180](https://github.com/pskillen/codeplug-studio/issues/180), [#202](https://github.com/pskillen/codeplug-studio/issues/202))       | All entity kinds — editors + list row actions; channel zone-membership cascade                                                                                                 |
| Unsaved-changes guard on editors          | Shipped ([#189](https://github.com/pskillen/codeplug-studio/issues/189), r2 C2 [#945](https://github.com/pskillen/codeplug-studio/issues/945)) | v2 `ConfirmModal` default tone via `UnsavedChangesModal` adapter + `useEntityEditorUnsavedGuard`                                                                               |
| Channels list bulk selection → new zone   | Shipped ([#154](https://github.com/pskillen/codeplug-studio/issues/154))                                                                       | `DataTable` selectable; **New zone from selected**                                                                                                                             |
| Channels list bulk edit                   | In progress ([#1269](https://github.com/pskillen/codeplug-studio/issues/1269))                                                             | **Bulk edit** modal — No change opt-in, editor-matched groups; scan, TX, power, analog squelch (tones / APRS / zones follow in the same ticket)                                |
| Channels list bulk delete                 | Shipped ([#310](https://github.com/pskillen/codeplug-studio/issues/310))                                                                       | **Bulk edit** modal — delete selected with confirm; zone auto-cascade                                                                                                          |
| Zone from location (proximity)            | Shipped ([#181](https://github.com/pskillen/codeplug-studio/issues/181))                                                                       | Section nav **New zone from location**                                                                                                                                         |
| Nested zone members                       | Shipped ([#157](https://github.com/pskillen/codeplug-studio/issues/157))                                                                       | Flatten at export; `omitFromExport`; schema v7                                                                                                                                 |
| Tri-state scan inclusion                  | Shipped ([#203](https://github.com/pskillen/codeplug-studio/issues/203))                                                                       | `scanInclusion`; build export default; schema v8                                                                                                                               |
| Channel behavioural defaults              | Shipped ([#388](https://github.com/pskillen/codeplug-studio/issues/388))                                                                       | `/library/channels/defaults`; Frequencies + mode-profile overrides; schema v18 — see [channel-behavioural-defaults reference](../../reference/channel-behavioural-defaults.md) |
| Zone behavioural defaults                 | Shipped ([#443](https://github.com/pskillen/codeplug-studio/issues/443))                                                                       | `/library/zones/defaults`; member tri-state + build projection; schema v19 — see [zone-behavioural-defaults reference](../../reference/zone-behavioural-defaults.md)           |
| Library scan lists                        | Shipped ([#257](https://github.com/pskillen/codeplug-studio/issues/257))                                                                       | `ScanList` entity; schema v10; Anytone dedicated scan                                                                                                                          |
| Zone member editor                        | Shipped ([#180](https://github.com/pskillen/codeplug-studio/issues/180), r2 [#942](https://github.com/pskillen/codeplug-studio/issues/942))    | mk2 E2 — `MembershipPanel` + `AddMembersScreen`; scanning panel separate from member rows                                                                                      |
| Channel sets                              | Shipped ([#172](https://github.com/pskillen/codeplug-studio/issues/172))                                                                       | Optional zone on import; mk2 D4 picker ([#944](https://github.com/pskillen/codeplug-studio/issues/944))                                                                        |
| OpenAIP airband import                    | Shipped ([#263](https://github.com/pskillen/codeplug-studio/issues/263))                                                                       | `/library/channels/add-from-openaip` — see [aviation](../aviation/README.md)                                                                                                   |
| Digital contact metadata + radioid import | Shipped ([#374](https://github.com/pskillen/codeplug-studio/issues/374))                                                                       | Enriched `DigitalContact` CRUD; directory browse/copy at `/library/contacts/directory` — see [contact-directories](../contact-directories/README.md)                           |
| Delete all digital contacts               | Shipped ([#427](https://github.com/pskillen/codeplug-studio/issues/427))                                                                       | Library → Contacts toolbar; checkbox-gated modal; cascade-clears channel/`RX` refs then IDB partition clear                                                                    |
| Membership / zone export order            | Shipped ([#456](https://github.com/pskillen/codeplug-studio/issues/456))                                                                       | `Zone.order` + membership arrays; Sort… confirm; build `orderOrSlot` / layout hints                                                                                            |
| Zone edit screen split                    | Superseded (r2 [#942](https://github.com/pskillen/codeplug-studio/issues/942))                                                                 | Single E2 workspace; `/add` and `/scanning` redirect to main + overlay/hash                                                                                                    |
| Grow zone from map                        | Shipped ([#588](https://github.com/pskillen/codeplug-studio/issues/588))                                                                       | Inside-hull + near-locator suggestions; multi-add on add-from-map screen                                                                                                       |
| Channel Power approx watts hint           | Shipped ([#414](https://github.com/pskillen/codeplug-studio/issues/414))                                                                       | Frequencies tab — informational ladder projection; `Channel.power` stays percent-only                                                                                          |
| Channel TX offset quick buttons           | Shipped ([#156](https://github.com/pskillen/codeplug-studio/issues/156))                                                                       | Frequencies tab — offset display + band quick buttons; see [tx-offsets.md](../../reference/tx-offsets.md)                                                                      |
| Channels list layout (table / cards)      | Shipped ([#1205](https://github.com/pskillen/codeplug-studio/issues/1205))                                                                     | Operator-chosen layout, card grouping, zone filter, independent card details — supersedes #967 / #971 trials                                                                   |

## Documentation map

| Doc                                                                             | Contents                                                                                                                                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [zone-member-picker.md](zone-member-picker.md)                                  | Vertical zone member editor ([#180](https://github.com/pskillen/codeplug-studio/issues/180))                                                              |
| [nested-zones.md](nested-zones.md)                                              | Hierarchical zones; flatten at export                                                                                                                     |
| [rx-group-list-member-picker.md](rx-group-list-member-picker.md)                | mk2 E6 membership editor ([#942](https://github.com/pskillen/codeplug-studio/issues/942))                                                                 |
| [scan-lists.md](scan-lists.md)                                                  | Library scan lists ([#257](https://github.com/pskillen/codeplug-studio/issues/257), r2 E7 [#942](https://github.com/pskillen/codeplug-studio/issues/942)) |
| [aviation](../aviation/README.md)                                               | OpenAIP airport airband import ([#263](https://github.com/pskillen/codeplug-studio/issues/263))                                                           |
| [contact-directories](../contact-directories/README.md)                         | RadioID.net DMR contact import ([#374](https://github.com/pskillen/codeplug-studio/issues/374))                                                           |
| [app-shell/data-table.md](../app-shell/data-table.md)                           | Shared `DataTable` and list prefs                                                                                                                         |
| [channel-behavioural-defaults](../../reference/channel-behavioural-defaults.md) | Epic [#388](https://github.com/pskillen/codeplug-studio/issues/388) cascade — tier-2 reference                                                            |
| [zone-behavioural-defaults](../../reference/zone-behavioural-defaults.md)       | Zone defaults ([#443](https://github.com/pskillen/codeplug-studio/issues/443))                                                                            |
| [channel-sets](../../reference/channel-sets.md)                                 | Static channel sets ([#172](https://github.com/pskillen/codeplug-studio/issues/172); epic [#281](https://github.com/pskillen/codeplug-studio/issues/281)) |

Shipped initiatives (mode profiles, membership order, zones revision-2, library routes): see GitHub issues cited in the status table — progress/outstanding logs retired in [#294](https://github.com/pskillen/codeplug-studio/issues/294).

## List routes

`/library` redirects to `/library/channels`. Each entity kind has a dedicated list page; section nav order matches `routes/library/nav.ts`:

| List route                   | UI                                                                                                                                                  | Map                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `/library/channels`          | v2 `DataTable` — tabbed `FilterPopover` filters, selection bulk footer, `ModalShell` bulk edit, hideable columns, URL + `localStorage` filter prefs | Yes — stacked via `LibraryMapStack` |
| `/library/channels/defaults` | Library-wide channel behavioural defaults (TX deny, TX permit, talker alias, analog squelch) — nested under Channels in section nav                 | No                                  |
| `/library/zones`             | v2 `DataTable` — `reorderMode` grip + `Zone.order`; Sort zones…; members, comment; split map via `LibraryMapStack`                                  | Yes                                 |
| `/library/talk-groups`       | v2 `DataTable` — mode, ID, Abbrev, channels/RX lists using, comment, `RowActionIcon` delete                                                         | No                                  |
| `/library/contacts`          | Dual v2 `DataTable` in `Panel`s: digital `scale="extreme"` + Delete all; analog thin list; **Digital ID directory** link in header                  | No                                  |
| `/library/rx-group-lists`    | v2 `DataTable` — members, channels using, row delete                                                                                                | No                                  |
| `/library/scan-lists`        | v2 `DataTable` — members, channels-using ref count, row delete                                                                                      | No                                  |

Shared L1 chrome: `LibraryInventoryHeader`, optional `FilterPopover` (channels — tabbed flyout on desktop, edge-to-edge on mobile, `≤48em`), `LibraryMapStack` (C7 map+list). List tables use `components/v2/DataTable` — see [design-system-v2](../design-system-v2/README.md) ([#940](https://github.com/pskillen/codeplug-studio/issues/940)).

### Channels list (#24)

- Filters on the list page (`ChannelListFilters`): a **Filters** button opens a tabbed flyout popover (`FilterPopover`) — **band**, **mode**, and **zone membership** (including **Not in a zone**) are tabs showing one chip wall at a time; **duplex** and **distance radius** (when operator location is set) sit in the popover footer, visible regardless of the active tab. Active filters stay visible as removable pills below the row even when the popover is closed. On mobile (`≤48em`) the popover goes edge-to-edge and the row reorders — Filters, then the Cards/Table view switch, then **Use my location**, each full width with 44px+ tap targets — instead of the desktop row (Filters + Use my location adjacent, view switch pushed right). Name/callsign search is a page-level field shared by table and card layouts — not `DataTable`'s own toolbar search — so it stays visible in both modes.
- **Layout** — **Table** or **Cards** on desktop and mobile (operator choice; persisted per project in `localStorage`, not URL). Table mode always renders a real grid (horizontal scroll on narrow viewports). Card mode uses `ChannelCard` with bulk selection.
- **Card grouping** (card mode only) — **None**, **Zone**, **Band**, or **Simplex/split** (persisted). Zone grouping uses direct membership only (same rule as the Zones column); multi-zone channels appear once per matching section. Band / duplex grouping use `groupChannels.ts`.
- **Card details** — **Show/hide details** toggles optional field rows on cards independently of table **Show/hide cols** (separate `localStorage` keys). Card **Band** stays its own field; **Mode** uses the same joined pill group as the table Name column (`*` marks primary when multiple modes).
- **Table Name column** — merges **callsign + Band** pills (first line), **Name** (second line), and a joined **Mode** pill group (third line) into one non-hideable column sized to content (table scrolls horizontally when modes are long). Callsign leads because it's the licensed identifier, not the operator's convenience label — see [display styleguide — Channel naming](../../reference/styleguide/display.md#channel-naming). There is no separate Callsign/Band/Mode column in the table.
- **Table Tone column** — optional, hidden by default, placed after **Frequency**. One analog mode profile shows `rxTone / txTone`; more than one shows one `MODE: rxTone / txTone` line per analog profile (`-` for unset tones). Digital-only channels show `—`.
- The embedded map plots the **same filtered channel set** as the list (all active filters apply).
- Filter state (including zone) syncs to URL query params and per-project `localStorage`. Table column sort/visibility and card layout/group/details prefs persist per project.
- `modeProfiles[]` drives mode pills and mode filter matching (vendor-neutral labels only).
- **Row / card checkboxes**, **Bulk edit** ([#207](https://github.com/pskillen/codeplug-studio/issues/207)), and **New zone from selected** ([#154](https://github.com/pskillen/codeplug-studio/issues/154)) — available in **both** table and card layouts (`ChannelListBulkActions`).
  - **Bulk edit** ([#207](https://github.com/pskillen/codeplug-studio/issues/207), revamp [#1269](https://github.com/pskillen/codeplug-studio/issues/1269)) — select 2+ channels to open `ChannelBulkEditModal` (see sidecar `ChannelBulkEditModal.md`). Fields start as **No change**; only opted-in values are written. Groups match the channel editor (**RF**, **Mode settings**, **Scanning**). Channel-level: scan inclusion, transmit permission, TX permit, power. Analog squelch and squelch mode patch existing analog mode profiles only (skipped on digital-only channels). Talker alias patches DMR profiles. When every selected channel shares a value, that option is outlined as a hint. **Delete** removes the selection after in-modal confirm (zone membership auto-cascade; scan-list and other refs block with a summary). Selecting exactly one channel opens the standard channel editor instead.
  - **New zone from selected** — navigates to zone editor with members pre-filled in list order.
- **Zones** column — direct zone badges (link to zone editor), **Not in a zone** / **Nested only** when applicable ([#180](https://github.com/pskillen/codeplug-studio/issues/180)).
- **Delete** row action — removes channel; offers remove-from-zones cascade when blocked by zone membership.
- **ChannelCard** — name link, **callsign** in the header when set (omitted when empty), optional field rows, delete action, optional selection checkbox. See [ChannelCard.md](../../../src/app/components/library/ChannelCard.md).

### Zone member editor (#25, #157, #180)

**Create:** `/library/zones/new` — identity, full membership editor (reorder + add pool), map.

**Edit existing zone** — shared draft state on `/library/zones/:id` with focused sub-screens:

| Route                             | Purpose                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/library/zones/:id`              | Identity, reorder-only members, navigation to add / scanning / map preview                                                  |
| `/library/zones/:id/add`          | Read-only member summary + **Other channels & zones** add pool + map                                                        |
| `/library/zones/:id/add-from-map` | Geographic grow — inside-hull and near-locator suggestions ([#588](https://github.com/pskillen/codeplug-studio/issues/588)) |
| `/library/zones/:id/scanning`     | Per-channel zone-derived scan inclusion only                                                                                |

`ZoneMemberEditor` composes from **modes** (`reorder`, `addPool`, `scanOnly`, `summary`, `full`) per screen. Channel editor still uses **`ChannelZoneMembershipSection`**. See [zone-member-picker.md](zone-member-picker.md). Sidecars: `ZoneMemberEditor.md`, `GrowZoneRecommendations.md`, `ChannelZoneMembershipSection.md`.

The zone editor map uses **Draw this zone** / **Draw other zones** controls: the editing zone hull is full colour; other library zones render muted for reference. Channels outside the zone are dimmed on the map (same treatment as out-of-radius channels on zone-from-location). Auto-fit zoom uses only the editing zone's member channels (not the full library).

### Contacts page

Digital and analog contacts remain separate models and editor slugs (`digital-contacts`, `analog-contacts`); the combined `/library/contacts` list page is a UX grouping only. Each section has its own `DataTable`, name filter (`dq` / `aq` URL params), and persisted column sort.

Digital contacts support enriched metadata (callsign, city, state, country, remarks) in the editor ([#377](https://github.com/pskillen/codeplug-studio/issues/377)). Bulk RadioID.net import writes the **digital ID directory** shadow store ([#985](https://github.com/pskillen/codeplug-studio/issues/985)) at `/library/contacts/directory`; copy rows into library contacts when needed, or project the shadow into CPS / Web Serial without copying — see [contact-directories](../contact-directories/README.md). **Digital ID directory** in the Contacts header links there.

**Delete all** ([#427](https://github.com/pskillen/codeplug-studio/issues/427)) — digital section toolbar only (disabled at 0). Clears **library** contacts only. **Clear directory** on the directory page wipes the shadow partition without touching library rows.

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

RX group list editor uses `RxGroupListMemberPicker` — **B+C** membership (`MembershipPanel` + `AddMembersScreen`), same pattern as zones and scan lists. Talk groups and digital contacts are separate B sections. Per-member `timeSlotOverride` (`Auto` / `TS1` / `TS2`) is editable on C rows for DMR members. See [rx-group-list-member-picker.md](rx-group-list-member-picker.md).

### Scan lists ([#257](https://github.com/pskillen/codeplug-studio/issues/257))

**Route:** `/library/scan-lists` — section nav **Scan lists**

`ScanListEditor` uses `ScanListMemberEditor` for ordered channel membership (channels only — no nested zones). Build pages for `DedicatedScanLists` profiles link here for list curation; per-channel scan assignment stays on the build Channels wire page. See [scan-lists.md](scan-lists.md).

### Channel DMR RX list summary ([#75](https://github.com/pskillen/codeplug-studio/issues/75))

Channel editor DMR tab shows `RxGroupListSummary` below the RX group list selector — live member preview with link to the list editor. Sidecar: `src/app/components/library/RxGroupListSummary.md`.

### Channel sets ([#172](https://github.com/pskillen/codeplug-studio/issues/172))

**Route:** `/library/channels/add-channel-set` — **Add from…** modal → **Channel set** card

Generate curated frequency inventories into the library:

| Set                                            | Channels | Notes                    |
| ---------------------------------------------- | -------- | ------------------------ |
| PMR446                                         | 16       | Default `forbidTransmit` |
| UK VHF simplex (V-channels or legacy S08–S23)  | 30 / 16  | Pick naming scheme       |
| UK UHF simplex (U272–U288 or legacy SU16–SU32) | 17       | Pick naming scheme       |
| UK CB / EU CEPT CB                             | 40 each  |                          |

Workflow: pick set → preview `DataTable` (per-channel checkboxes, dedup status) → optional power, **bandwidth** (12.5 or 25 kHz), forbid-TX, name prefix, **also create zone** → bulk `putChannel` (+ optional `putZone`). Duplicate RX frequencies in the library are skipped.

- Core: `src/core/domain/channelSets/`, `src/core/services/channelSetImport.ts`
- UI: `ChannelSetPicker` on `DirectoryIngestPage` — sidecar `src/app/components/channelSets/ChannelSetPicker.md`
- **Add from…** picker: `AddFromDataSourceModal` on v2 `ModalShell` — sidecar `src/app/components/library/AddFromDataSourceModal.md`
- Reference: [channel-sets.md](../../reference/channel-sets.md)

### OpenAIP airband ([#263](https://github.com/pskillen/codeplug-studio/issues/263))

**Route:** `/library/channels/add-from-openaip` — section nav **Add from…** → OpenAIP

Search [OpenAIP](https://www.openaip.net/) for airport frequencies and import RX-only AM channels:

1. Configure API key in Settings (browser storage only).
2. Search by ICAO/IATA/name, town, Maidenhead locator, or current location + radius.
3. Review map and per-airport frequency tables; add one airport or batch selected.
4. Optional **Create zone per airport** on import.

Core: `src/core/domain/airband/`, `src/core/services/airbandImport.ts`. Integration: `src/integrations/aviation/`. UI: `OpenAipAirportSearch` — sidecar `src/app/components/aviation/OpenAipAirportSearch.md`. Reference: [openaip](../../reference/remote-directories/openaip/README.md). Feature hub: [aviation](../aviation/README.md).

Airband is **not** a static channel set — see [aviation](../aviation/README.md) and channel-sets epic [#281](https://github.com/pskillen/codeplug-studio/issues/281).

## Editor routes

| Path                 | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `/library/:kind/:id` | Edit an entity (`:id` = `new` to create) |

`:kind` is a slug (`channels`, `talk-groups`, `digital-contacts`, `analog-contacts`, `rx-group-lists`, `scan-lists`, `zones`) mapped to an internal `EntityKind` in `routes/library/registry.ts`. Editors navigate back to the matching list route on save/cancel via `listPathForEditorSlug()`.

### Unsaved changes ([#189](https://github.com/pskillen/codeplug-studio/issues/189))

All entity editors track dirty form state against the mount baseline (`useEntityEditorUnsavedGuard`). When dirty:

- In-app navigation (Cancel link, section nav, back link) opens [`UnsavedChangesModal`](../../src/app/components/ui/UnsavedChangesModal.md) (v2 `ConfirmModal`, C2 [#945](https://github.com/pskillen/codeplug-studio/issues/945)) — Stay or Discard.
- Tab close triggers the browser `beforeunload` prompt.
- **Save** calls `permitNavigationOnce` before navigating back to the list.

**Not guarded:** zone membership on the channel editor **Zones** tab — `ChannelZoneMembershipSection` persists add/remove immediately (separate from the main channel form).

## Entities and editors

| Entity          | Key fields                                                                                                                                                                                                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel         | name, optional `abbreviation` (export shortening), callsign, RX/TX (MHz↔Hz), power, location + `maidenheadLocator`, `scanInclusion` (default/skip/alwaysScan), optional `scanListId` (FK to library scan list), comment, optional `primaryMode` (dual-mode CPS primary), **multi** `modeProfiles[]` (DMR profile includes optional `dmrMode`) |
| Talk group      | name, optional `abbreviation` (multi-TG export shortening), digital mode, group ID, comment                                                                                                                                                                                                                                                   |
| Digital contact | name, digital mode, contact ID, comment                                                                                                                                                                                                                                                                                                       |
| Analog contact  | name, code, comment                                                                                                                                                                                                                                                                                                                           |
| RX group list   | name, members (talk groups / digital contacts); optional `timeSlotOverride` per member (`1` \| `2` \| unset)                                                                                                                                                                                                                                  |
| Scan list       | name, ordered `memberChannelIds` (channel UUID FKs)                                                                                                                                                                                                                                                                                           |
| Zone            | name, ordered members (`channel` and/or nested `zone` refs), comment                                                                                                                                                                                                                                                                          |

Channel DMR profiles reference a **digital contact** and an **RX group list** by UUID `id` (the editor exposes dropdowns); NXDN/TETRA profiles may reference talk groups by UUID. RX group lists and zones hold member `EntityRef[]`. `RxGroupListMember.timeSlotOverride` is an optional per-member DMR slot hint (vendor-neutral; maps to CPS TS Override at export). Names are display labels only — never foreign keys.

### Channel editor ([#16](https://github.com/pskillen/codeplug-studio/issues/16), [#28](https://github.com/pskillen/codeplug-studio/issues/28), r2 [#941](https://github.com/pskillen/codeplug-studio/issues/941), rework [#1265](https://github.com/pskillen/codeplug-studio/issues/1265))

- **Layout (mk2 E1, [#941](https://github.com/pskillen/codeplug-studio/issues/941), Identity polish [#1209](https://github.com/pskillen/codeplug-studio/issues/1209), verify placement [#1262](https://github.com/pskillen/codeplug-studio/issues/1262), scope + jump-nav rework [#1265](https://github.com/pskillen/codeplug-studio/issues/1265)):** `EditorHeader` (back crumb, title, subtitle) + a sticky horizontal **section jump-nav** + scroll `Panel` sections + `StickyFooter` (Cancel/Save, dirty status). Order: Identity → Names and notes → RF → Mode settings (stacked blocks; DMR includes BrandMeister RX-list sync on edit) → Location → Zones (edit only) → Scanning → APRS. Every panel carries an `id` the jump-nav scroll-spies against (`useSectionScrollSpy`); clicking a nav item or a same-page cross-link (e.g. Identity's frequency summary → RF) calls `scrollToPageSection`. Product-only Scanning/APRS panels are not in mk2 frames but remain restyled in the same chrome.
- **Header title:** on a saved channel, `EditorHeader`'s `<h1>` reads `"<Callsign> <Name>"` (callsign first, falling back to name alone when callsign is empty, or "Untitled channel" when both are). New channel keeps "New channel" until saved. Callsign leads because it's the licensed identifier — see [display styleguide — Channel naming](../../reference/styleguide/display.md#channel-naming).
- **Identity — minimum-viable-channel fields only:** callsign + [`ChannelDirectoryVerifyActions`](../../../src/app/components/repeaters/ChannelDirectoryVerifyActions.tsx) (ukrepeater.net, IRTS, RepeaterBook, optional BrandMeister repeater; disabled when callsign is empty — see below), name, a **read-only** RX/TX/band summary line that jump-links to RF, and `ChannelModesField` mode chips. Abbreviation, comment, and the export wire-name preview moved out to their own **Names and notes** panel (`collapsible`, starts collapsed on mobile) — Identity now holds only the fields a channel can't ship without, per the design review that drove this rework.
- **Directory lookup is not gated on a saved channel.** `ChannelDirectoryVerifyActions` renders on **New channel** too, not only on saved channels — the callsign-first workflow (type a callsign, click a lookup button, review the diff, apply) is now the primary way to start a repeater channel, alongside typing every field by hand. The dialog's copy switches via `mode`: **`verify`** ("Check ukrepeater.net…", saved channel) vs **`lookup`** ("Look up on ukrepeater.net…", New channel).
- **Apply & save vs Apply only:** [`RepeaterListingUpdateDialog`](../../../src/app/components/repeaters/RepeaterListingUpdateDialog.tsx) offers two actions. **Apply & save** persists immediately (`persistence.putChannel`) — this is the same one-click "check → diff → save" loop the editor has always had on saved channels, unchanged; on New channel it also creates the channel and navigates to its edit page. **Apply only** is New-channel-specific: it fans the patch into the open form's existing field state and writes nothing, so the operator can keep filling in the rest of the channel (mode settings, location, …) before the first save. See [repeater-directories](../repeater-directories/README.md) for the directory-integration side of this.
- **RF** (renamed from "Frequency" — the panel already covers RX/TX, offset, Transmit, TX permit, and Power, not only the two frequency fields): `TxOffsetControls` — Simplex + band offsets on v2 `Button`; live offset display ([#156](https://github.com/pskillen/codeplug-studio/issues/156); [tx-offsets.md](../../reference/tx-offsets.md)). `ForbidTransmitSegment` (**RX only** = receive-only) and `TxPermitSegment` (**Busy lock** vs **Permit always** while the frequency is in use), both at `layout="row"` so they no longer force the panel to a single-column stack. `PercentLevelSlider` stores vendor-neutral percent (`null` = radio default); `PowerLadderHints` beside it on desktop, collapsed **Power examples** on mobile ([#414](https://github.com/pskillen/codeplug-studio/issues/414), [#1209](https://github.com/pskillen/codeplug-studio/issues/1209)). Informational only.
- **Value-aware segment colours:** gradient segmented controls (Transmit, TX permit, Scanning, and the DMR/analog mode-settings controls below) no longer collapse a neutral "Default"/"Auto" option onto the same colour as a real option just because a short palette ran out of colours to pad with — `GradientSegmentedControl`'s `neutralValues` excludes neutral values from palette fitting entirely. See [GradientSegmentedControl.md](../../../src/app/components/ui/GradientSegmentedControl.md).
- **Scanning:** scan inclusion + optional `scanListId` FK only (TX controls are under RF).
- **No default mode** on new channels — operator selects modes via `ChannelModesField` in Identity; `modeProfiles` starts empty.
- **Location:** `ChannelLocationSection` + `MapLocationPicker` in v2 `MapPanel`. Save reconciles locator ↔ coords via `reconcileChannelLocation`. When the channel has a callsign but no location yet, the panel shows a "Set from a directory in Identity" jump-link instead of a static hint.
- **Mode profiles:** stacked per-mode blocks in `ChannelModeProfilesEditor`; v2 `SegmentedControl` for **Primary mode** when multiple modes; DMR panel includes **DMR operating mode** and [`BrandmeisterRxListSyncAction`](../../../src/app/components/repeaters/BrandmeisterRxListSyncAction.tsx) below RX group list on saved channels.
- **Zone membership** (edit only): light inverse chips + zone add (`ChannelZoneMembershipSection`) — not full Membership shuttle ([#942](https://github.com/pskillen/codeplug-studio/issues/942)); shows "Not in a zone yet." when the channel has no direct or nested-only membership.
- **Duplicate** and **Delete channel** on saved channels ([#180](https://github.com/pskillen/codeplug-studio/issues/180)).
- Component sidecars: `ChannelModesField.md`, `EditorHeader.md`, `StickyFooter.md`, `SectionNav.md`, `GradientSegmentedControl.md`, and siblings under `src/app/components/channels/`; directory verify sidecars under `src/app/components/repeaters/`.

### Library strip (design system v2, [#921](https://github.com/pskillen/codeplug-studio/issues/921)–[#923](https://github.com/pskillen/codeplug-studio/issues/923), [#932](https://github.com/pskillen/codeplug-studio/issues/932)–[#935](https://github.com/pskillen/codeplug-studio/issues/935))

All contextual Library destinations use `DesignSystemV2Provider` with v2 list chrome (`SearchInput` / `DataTable` `selectionChrome="v2"`) and editor shells (sticky header + `Panel` sections). Zone, RGL, and scan list membership editors use the Membership family (`MembershipPanel`, `AddMembersScreen`, pool rows). Maps on zone/channel list pages use `MapPanel` + `CodeplugMap` ([#925](https://github.com/pskillen/codeplug-studio/issues/925)).

### Talk group editor ([#110](https://github.com/pskillen/codeplug-studio/issues/110), r2 [#943](https://github.com/pskillen/codeplug-studio/issues/943))

- **Layout (mk2 E3):** `EditorHeader` + single `Panel` compact form + `StickyFooter` — same chrome family as channel editor ([#941](https://github.com/pskillen/codeplug-studio/issues/941)).
- **Identity:** name, v2 `SegmentedControl` mode, talk group ID, abbreviation, comment; `TalkGroupWireNameExamples` for export shortening hints.
- **List:** optional **Abbrev** column on `/library/talk-groups` (default visible).
- **Persistence:** empty abbreviation omitted on save; native YAML round-trip preserves the field.
- Sidecar: `src/app/components/library/TalkGroupWireNameExamples.md`.

### Digital contact editor (r2 [#943](https://github.com/pskillen/codeplug-studio/issues/943))

- **Layout (mk2 E4):** `EditorHeader` + compact `Panel` + `StickyFooter`.
- **Fields:** callsign, name, country, DMR ID, mode (`SegmentedControl`), city/state, remarks, comment.
- **RadioID:** `DismissibleNotice` when contact looks directory-sourced; `RadioidContactVerifyPanel` below the form on saved contacts.

### Analog contact editor (r2 [#943](https://github.com/pskillen/codeplug-studio/issues/943))

- **Layout (mk2 E5):** `EditorHeader` + compact `Panel` + `StickyFooter`.
- **Fields:** name, CTCSS/DCS tone (`code`), comment.

### Library defaults (r2 [#943](https://github.com/pskillen/codeplug-studio/issues/943))

- **Routes:** `/library/channels/defaults`, `/library/zones/defaults` — dense settings (not full editor chrome).
- **Channel:** v2 `Panel` + `SegmentedControl` for forbid TX, TX permit, talker alias, analog squelch.
- **Zone:** v2 `ToggleSwitch` for zone-derived scan-list include default.
- Annotated vs mk2 E8: separate routes retained; no invented Power/Bandwidth/contact-Country defaults.

### Zone-from-location & grow (M2/M3, r2 [#943](https://github.com/pskillen/codeplug-studio/issues/943))

- **M2** `/library/zones/new-from-location`: `EditorHeader`, `GeocodeCentreField` (`Combobox` geocode), radius chips, v2 `DataTable` multi-select, create footer.
- **M3** `/library/zones/:id/add-from-map`: table-first grow recommendations with distance column, multi-select + bulk add, `GeocodeCentreField` in near-locator mode.
- Sidecar: `GrowZoneRecommendations.md`; geocode field: `GeocodeCentreField.tsx` (library glue, no sidecar).

## Data flow

```text
Editor → persistence.put<Entity>(row, expectedRevision)  // optimistic concurrency
list   ← useLibrary() → LibraryService.loadLibrary(projectId)
change → persistence.subscribe(...) → useLibrary refresh (this tab + other tabs)
delete → LibraryService.deleteWithIntegrity → findReferencesTo (core)
```

- **Optimistic concurrency:** editors save with the loaded `revision`; a stale write returns `revision_conflict` and the editor shows a reload-and-retry message.
- **Referential integrity:** single-entity deletes are **blocked** when another entity still references the target (e.g. a zone listing a channel, an RX group list listing a talk group, a channel mode profile pointing at a contact / RX list / talk group, a parent zone nesting a child zone). The block lists the referencing entities. **Exception:** **Delete all digital contacts** cascade-clears inbound refs first (`LibraryService.deleteAllDigitalContacts`) — it does not use the per-row block path.
- **Delete UI ([#202](https://github.com/pskillen/codeplug-studio/issues/202), [#310](https://github.com/pskillen/codeplug-studio/issues/310), [#427](https://github.com/pskillen/codeplug-studio/issues/427)):** every saved entity has a **Delete** button on its editor (`EntityDeleteButton`; channels use `ChannelDeleteButton` for zone cascade). List pages add a trash **actions** column (`EntityListDeleteAction`; channels use `ChannelListDeleteAction`). Flow: `runEntityDeleteFlow` → `useLibrary().deleteEntity` → `LibraryService.deleteWithIntegrity`. Channel delete may offer remove-from-zones cascade when blocked only by zone membership. **Bulk delete** from the channels list bulk-edit modal uses `persistChannelBulkDelete` with the same integrity rules and one confirmation for the whole selection. **Delete all digital contacts** uses `DeleteAllDigitalContactsDialog` (checkbox gate) → `useLibrary().deleteAllDigitalContacts`.

## Boundaries

- Vendor-neutral: no radio caps, format strings, or CSV concepts. Cardinality/limits and **CPS wire names** belong on the **format build** (`FormatBuild` selections and overrides), not here.
- `core` holds pure domain + integrity (`references.ts`); persistence orchestration lives in the app layer (`LibraryService`), never in `core`.

## Library vs format build

The library holds RF facts you curate once (frequency, mode, contact refs, human-readable names). When you export to a specific radio, a persisted **`FormatBuild`** maps those entities to that CPS workflow — trait layout, which rows participate, and **wire-name overrides** (including shortened names for 16-character limits or m×n expansion). Export always uses **both** layers; see [data-model — Two persisted layers](../data-model/README.md#two-persisted-layers-not-one-export-format).

## Related

- [app-shell/data-table.md](../app-shell/data-table.md) · [zone-member-picker.md](zone-member-picker.md) · [rx-group-list-member-picker.md](rx-group-list-member-picker.md)
- [map](../map/README.md) — maps on channels/zones list routes + Summary overview
- [data-model](../data-model/README.md) · [app-shell](../app-shell/README.md)
- [storage.md](../../poc-migration/storage.md) — persistence design

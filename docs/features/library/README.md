# Library CRUD
Tier-1 reference for editing the vendor-neutral **library** — the per-project inventory of channels, talk groups, contacts, RX group lists, scan lists, and zones.

You can also add channels and zones from a connected radio with [Read into library](../radio-read-write/read-into-library.md).

**Source:** `src/app/routes/library/`, `src/app/state/` (`useLibrary`, `libraryService`), `src/core/domain/references.ts`

**Status:** shipped; the library is the working editing surface for every entity kind, and the pages below describe how it behaves today.

## Documentation map
| Doc | Contents |
| --- | --- |
| [zone-member-picker.md](zone-member-picker.md)                                  | Vertical zone member editor                                                              |
| [nested-zones.md](nested-zones.md)                                              | Hierarchical zones; flatten at export                                                                                                                     |
| [rx-group-list-member-picker.md](rx-group-list-member-picker.md)                | Membership editor for RX group lists                                                                 |
| [channel-modes.md](channel-modes.md)                                            | How the editor and view present a channel's modes                                                                                                         |
| [scan-lists.md](scan-lists.md)                                                  | Library scan lists |
| [aviation](../aviation/README.md)                                               | OpenAIP airport airband import                                                           |
| [contact-directories](../contact-directories/README.md)                         | RadioID.net DMR contact import                                                           |
| [app-shell/data-table.md](../app-shell/data-table.md)                           | Shared `DataTable` and list prefs                                                                                                                         |
| [channel-behavioural-defaults](../../reference/channel-behavioural-defaults.md) | Epic cascade — tier-2 reference                                                            |
| [zone-behavioural-defaults](../../reference/zone-behavioural-defaults.md)       | Zone defaults                                                                            |
| [channel-sets](../../reference/channel-sets.md)                                 | Static channel sets |
| [public-service-channels/](public-service-channels/README.md)                   | Receive-only statutory-service memories                                                |

## What the library covers

| Area | Notes |
| --- | --- |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zone + channel editor cross-links | Revision-2 — see [zone-member-picker.md](zone-member-picker.md) |
| Channel view page | `/library/channels/:id` read-first; editor at `/edit` — see [Channel view](#channel-view) |
| Channel / zone delete | All entity kinds — editors + list row actions; channel zone-membership cascade |
| Unsaved-changes guard on editors | v2 `ConfirmModal` default tone via `UnsavedChangesModal` adapter + `useEntityEditorUnsavedGuard` |
| Channels list bulk selection → new zone | `DataTable` selectable; **New zone from selected** |
| Channels list bulk edit | **Bulk edit** modal — inverted shared-value fill; two-column groups; Power Default/Custom; CTCSS/DCS; collapsed APRS gradients; zone add/remove |
| Analog CTCSS/DCS tone picker | Channel editor and bulk edit: **Off \ |
| Channels list bulk delete | **Bulk edit** modal — delete selected with confirm; zone auto-cascade |
| Zone from location (proximity) | Section nav **New zone from location** |
| Nested zone members | Flatten at export; `omitFromExport`; schema v7 |
| Tri-state scan inclusion | `scanInclusion`; build export default; schema v8 |
| Channel behavioural defaults | `/library/channels/defaults`; Frequencies + mode-profile overrides; schema v18 — see [channel-behavioural-defaults reference](../../reference/channel-behavioural-defaults.md) |
| Zone behavioural defaults | `/library/zones/defaults`; member tri-state + build projection; schema v19 — see [zone-behavioural-defaults reference](../../reference/zone-behavioural-defaults.md) |
| Library scan lists | `ScanList` entity; schema v10; Anytone dedicated scan |
| Zone member editor | `MembershipPanel` + `AddMembersScreen`; scanning panel separate from member rows |
| Channel sets | Optional zone on import |
| Public service channels | Receive-only UK + Ireland datasets; `/library/channels/add-public-services` |
| OpenAIP airband import | `/library/channels/add-from-openaip` — see [aviation](../aviation/README.md) |
| Digital contact metadata + radioid import | Enriched `DigitalContact` CRUD; directory browse/copy at `/library/contacts/directory` — see [contact-directories](../contact-directories/README.md) |
| Delete all digital contacts | Library → Contacts toolbar; checkbox-gated modal; cascade-clears channel/`RX` refs then IDB partition clear |
| Membership / zone export order | `Zone.order` + membership arrays; Sort… confirm; build `orderOrSlot` / layout hints |
| Grow zone from map | Inside-hull + near-locator suggestions; multi-add on add-from-map screen |
| Channel Power approx watts hint | Frequencies tab — informational ladder projection; `Channel.power` stays percent-only |
| Channel TX offset quick buttons | Frequencies tab — offset display + band quick buttons; see [tx-offsets.md](../../reference/tx-offsets.md) |
| Channels list layout (table / cards) | Operator-chosen layout, card grouping, zone filter, independent card details |

## List routes
`/library` redirects to `/library/channels`. Each entity kind has a dedicated list page; section nav order matches `routes/library/nav.ts`:

| List route                   | UI                                                                                                                                                                                                                                                                                                                                                                             | Map                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `/library/channels`          | v2 `DataTable` (sticky header; name column and checkbox pinned on sideways scroll; on mobile a callsign + name line with the checkbox and band / mode pills (one row, name truncates first) stays put above the scrolling columns) — tabbed `FilterPopover` filters, selection bulk footer, `ModalShell` bulk edit, hideable columns, URL + `localStorage` filter prefs | Yes — split via `ListMapLayout` |
| `/library/channels/defaults` | Library-wide channel behavioural defaults (TX deny, TX permit, talker alias, analog squelch) — nested under Channels in section nav                                                                                                                                                                                                                                            | No                              |
| `/library/zones`             | v2 `DataTable` — `reorderMode` grip + `Zone.order`; Sort zones…; members, comment; split map via `ListMapLayout`                                                                                                                                                                                                                                                               | Yes                             |
| `/library/talk-groups`       | v2 `DataTable` — mode, ID, Abbrev, channels/RX lists using, comment, `RowActionIcon` delete                                                                                                                                                                                                                                                                                    | No                              |
| `/library/contacts`          | Dual v2 `DataTable` in `Panel`s: digital `scale="extreme"` + Delete all; analog thin list; **ID directory** link in header                                                                                                                                                                                                                                                     | No                              |
| `/library/rx-group-lists`    | v2 `DataTable` — members, channels using, row delete                                                                                                                                                                                                                                                                                                                           | No                              |
| `/library/scan-lists`        | v2 `DataTable` — members, channels-using ref count, row delete                                                                                                                                                                                                                                                                                                                 | No                              |
| `/library/digital-ids`       | Your own DMR and NXDN IDs, grouped by protocol — Default badge, Set as default, channels using, row delete; notice when a protocol has no default                                                                                                                                                                                                                              | No                              |

Shared L1 chrome: `LibraryInventoryHeader`, optional `FilterPopover` (channels — tabbed flyout on desktop, edge-to-edge on mobile, `≤48em`), `ListMapLayout` (map+list: sticky map on desktop, list | map swipe panes with filters and actions in a bottom controls sheet on mobile). List tables use `components/v2/DataTable` — see [design-system-v2](../design-system-v2/README.md).

### Channels list
- Filters on the list page (`ChannelListFilters`): a **Filters** button opens a tabbed flyout popover (`FilterPopover`) — **band**, **mode**, and **zone membership** (including **Not in a zone**) are tabs showing one chip wall at a time; **duplex** and **distance radius** (when operator location is set) sit in the popover footer, visible regardless of the active tab. Active filters stay visible as removable pills below the row even when the popover is closed. On mobile (`≤48em`) the Filters panel opens as a bottom sheet, and the search box, **Filters**, **Use my location** and the applied-filter pills sit directly above the table (`ListMapLayout`'s `listHeadControls`) so an active filter is never hidden; only the Cards/Table switch and card grouping live in the bottom controls sheet. Desktop keeps one row (Filters + Use my location adjacent, view switch pushed right). Name/callsign search is a page-level field shared by table and card layouts — not `DataTable`'s own toolbar search — so it stays visible in both modes.
- **Layout** — **Table** or **Cards** on desktop and mobile (operator choice; persisted per project in `localStorage`, not URL). Table mode always renders a real grid (horizontal scroll on narrow viewports). Card mode uses `ChannelCard` with bulk selection.
- **Card grouping** (card mode only) — **None**, **Zone**, **Band**, or **Simplex/split** (persisted). Zone grouping uses direct membership only (same rule as the Zones column); multi-zone channels appear once per matching section. Band / duplex grouping use `groupChannels.ts`.
- **Card details** — **Show/hide details** toggles optional field rows on cards independently of table **Show/hide cols** (separate `localStorage` keys). Card **Band** stays its own field; **Mode** uses one `ChannelModeSummaries` chip per mode (main mode first and bordered).
- **Table Name column** — merges **callsign + Band** pills (first line), **Name** (second line), and one summary chip per mode via `ChannelModeSummaries` (third line, chips wrap onto extra rows inside the pinned Name cell) into one non-hideable column. Callsign leads because it's the licensed identifier, not the operator's convenience label — see [display styleguide — Channel naming](../../reference/styleguide/display.md#channel-naming). There is no separate Callsign/Band/Mode column in the table.
- **Table Tone column** — optional, hidden by default, placed after **Frequency**. One analog mode profile shows `rxTone / txTone`; more than one shows one `MODE: rxTone / txTone` line per analog profile (`-` for unset tones). Digital-only channels show `—`.
- The embedded map plots the **same filtered channel set** as the list (all active filters apply).
- Filter state (including zone) syncs to URL query params and per-project `localStorage`. Table column sort/visibility and card layout/group/details prefs persist per project.
- `modeProfiles[]` drives mode summaries and mode filter matching (vendor-neutral labels only).
- **Row / card checkboxes**, **Bulk edit**, and **New zone from selected** — available in **both** table and card layouts (`ChannelListBulkActions`).
  - **Bulk edit** — select 2+ channels to open `ChannelBulkEditModal` (see sidecar `ChannelBulkEditModal.md`). The modal receives the **full checkbox selection**, not only rows that match the current search/filter. Fields start as **No change**; only opted-in values are written. Desktop uses a two-column field grid (`layout="column"`: title, control, description below). When every selected channel shares a value, that option is filled (Mantine primary) and **No change** keeps the outline — picking a value applies it. **Power** and analog **Squelch** are **No change | Default | Custom** (slider thumb only on Custom; preview dots for numeric levels). Analog RX/TX tones use the same **Off \| CTCSS \| DCS** picker as the channel editor (inverted DCS stores `D###I`; **Off** clears the tone). Those tones and squelch patch existing analog profiles only. Talker alias patches DMR profiles. APRS receive, report type, and digital PTT collapse into the gradient; report slot stays **No change | Set** plus a select. **Zones** add or remove direct UUID membership (`BulkZonePickerColumn`). Apply is **No changes** until a field is opted in, then **Apply to N channels**. **Delete** is a destructive footer button; it removes the selection after in-modal confirm (zone membership auto-cascade; scan-list and other refs block with a summary). Selecting exactly one channel opens the standard channel editor instead.
  - **New zone from selected** — navigates to zone editor with members pre-filled in list order.
- **Zones** column — direct zone badges (link to zone editor), **Not in a zone** / **Nested only** when applicable.
- **Delete** row action — removes channel; offers remove-from-zones cascade when blocked by zone membership.
- **ChannelCard** — name link, **callsign** in the header when set (omitted when empty), optional field rows, delete action, optional selection checkbox. See [ChannelCard.md](../../../src/app/components/library/ChannelCard.md).

### Zone member editor
**Create:** `/library/zones/new` — identity only (name, comment, export flag). **Save zone** opens the new zone's edit page, straight into the add-members screen when the zone is empty (`?add=members`). Channels preselected on the channels list (**New zone from selected**) still seed the zone's members, and then skip the add screen.

**Edit existing zone** — shared draft state on `/library/zones/:id` with focused sub-screens:

| Route                             | Purpose                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/library/zones/:id`              | Identity, reorder-only members, navigation to add / scanning / map preview                                                  |
| `/library/zones/:id/add`          | Read-only member summary + **Other channels & zones** add pool + map                                                        |
| `/library/zones/:id/add-from-map` | Geographic grow — inside-hull and near-locator suggestions |
| `/library/zones/:id/scanning`     | Per-channel zone-derived scan inclusion only                                                                                |

`ZoneMemberEditor` composes from **modes** (`reorder`, `addPool`, `scanOnly`, `summary`, `full`) per screen. Channel editor still uses **`ChannelZoneMembershipSection`**. See [zone-member-picker.md](zone-member-picker.md). Sidecars: `ZoneMemberEditor.md`, `GrowZoneRecommendations.md`, `ChannelZoneMembershipSection.md`.

The zone editor map uses **Draw this zone** / **Draw other zones** controls: the editing zone hull is full colour; other library zones render muted for reference. Channels outside the zone are dimmed on the map (same treatment as out-of-radius channels on zone-from-location). Auto-fit zoom uses only the editing zone's member channels (not the full library).

### Contacts page
Digital and analog contacts remain separate models and editor slugs (`digital-contacts`, `analog-contacts`); the combined `/library/contacts` list page is a UX grouping only. Each section has its own `DataTable`, name filter (`dq` / `aq` URL params), and persisted column sort.

Digital contacts support enriched metadata (callsign, city, state, country, remarks) in the editor. Bulk RadioID.net import writes the **digital ID directory** shadow store at `/library/contacts/directory`; copy rows into library contacts when needed, or project the shadow into CPS / Web Serial without copying — see [contact-directories](../contact-directories/README.md). **Digital ID directory** in the Contacts header links there.

**Delete all** — digital section toolbar only (disabled at 0). Clears **library** contacts only. **Clear directory** on the directory page wipes the shadow partition without touching library rows.

### Zone from location
**Route:** `/library/zones/new-from-location` — section nav **New zone from location**

Map-first workflow to create a zone from geolocated channels within a radius of a reference point:

1. Set **reference position** — map click, Maidenhead locator, city/postcode geocode (Photon or Mapbox), **Use my location**, or pick an existing channel with coordinates.
2. Choose **radius** (km slider with snap marks 5–200; default 25).
3. Preview on the map — radius circle, dimmed out-of-radius channels, optional dashed **Draw new zone** hull; existing zones shown muted when **Draw other zones** is on.
4. Review the **selected channels** table (nearest-first order).
5. **Create zone** — persists a new `Zone` with channel members and opens the zone editor.

**Layout:** desktop shows the centre controls beside a sticky viewport-height map, with the channels table and name below. On mobile the page folds into collapsible panels (Centre point, Channels found, Name this zone), each with a one-line summary when folded; the map is a thumbnail that opens a full-screen picker (tap to place a point, **Use this point** to apply it), and **Create zone** stays pinned above the tab bar.

Core selection: `selectChannelsWithinRadius` in `src/core/domain/proximityZone.ts`. Channels without coordinates are excluded. Membership is a static snapshot at creation time.

### RX group list member picker
RX group list editor uses `RxGroupListMemberPicker` — **B+C** membership (`MembershipPanel` + `AddMembersScreen`), same pattern as zones and scan lists. Talk groups and digital contacts are separate B sections. Per-member `timeSlotOverride` (`Auto` / `TS1` / `TS2`) is editable on C rows for DMR members. See [rx-group-list-member-picker.md](rx-group-list-member-picker.md).

### Scan lists
**Route:** `/library/scan-lists` — section nav **Scan lists**

`ScanListEditor` uses `ScanListMemberEditor` for ordered channel membership (channels only — no nested zones). Build pages for `DedicatedScanLists` profiles link here for list curation; per-channel scan assignment stays on the build Channels wire page. See [scan-lists.md](scan-lists.md).

### Channel DMR RX list summary
Channel editor DMR tab shows `RxGroupListSummary` below the RX group list selector — live member preview with link to the list editor. Sidecar: `src/app/components/library/RxGroupListSummary.md`.

### Channel sets
**Route:** `/library/channels/add-channel-set` — **Add from…** modal → **Channel set** card

Generate curated frequency inventories into the library:

| Set                                            | Channels | Notes                                            |
| ---------------------------------------------- | -------- | ------------------------------------------------ |
| PMR446                                         | 16       | Default `forbidTransmit`                         |
| DMR446 (16)                                    | 16       | DMR simplex, CC1 / TS1; default `forbidTransmit` |
| UK VHF simplex (V-channels or legacy S08–S23)  | 30 / 16  | Pick naming scheme                               |
| UK UHF simplex (U272–U288 or legacy SU16–SU32) | 17       | Pick naming scheme                               |
| UK CB / EU CEPT CB                             | 40 each  |                                                  |

Workflow: pick set → preview `DataTable` (per-channel checkboxes, dedup status) → optional power, **bandwidth** (12.5 or 25 kHz; analogue sets only), forbid-TX, name prefix, **also create zone** → bulk `putChannel` (+ optional `putZone`). Duplicate RX frequencies in the library are skipped.

- Core: `src/core/domain/channelSets/`, `src/core/services/channelSetImport.ts`
- UI: `ChannelSetPicker` on `DirectoryIngestPage` — sidecar `src/app/components/channelSets/ChannelSetPicker.md`
- **Add from…** picker: `AddFromDataSourceModal` on v2 `ModalShell` — sidecar `src/app/components/library/AddFromDataSourceModal.md`
- Reference: [channel-sets.md](../../reference/channel-sets.md)

### Public service channels
**Route:** `/library/channels/add-public-services` — **Add from…** modal → **Public services** card

Import bundled, receive-only memories for published unencrypted service allocations (UK fireground, HM Coastguard, Irish Coast Guard, selected ports). Country is pre-selected from browser locale when a dataset exists; groups default to ticked; transmit cannot be enabled during import. Frequency collisions with a differently named library channel stay selectable and show an advisory.

- Hub: [public-service-channels/](public-service-channels/README.md)
- UI: `PublicServicePicker` — sidecar `src/app/components/publicServices/PublicServicePicker.md`
- Core: `src/core/domain/publicServices/`, `src/core/services/publicServiceImport.ts`

### OpenAIP airband
**Route:** `/library/channels/add-from-openaip` — section nav **Add from…** → OpenAIP

Search [OpenAIP](https://www.openaip.net/) for airport frequencies and import RX-only AM channels:

1. Configure API key in Settings (browser storage only).
2. Search by ICAO/IATA/name, town, Maidenhead locator, or current location + radius.
3. Review map and per-airport frequency tables; add one airport or batch selected.
4. Optional **Create zone per airport** on import.

Core: `src/core/domain/airband/`, `src/core/services/airbandImport.ts`. Integration: `src/integrations/aviation/`. UI: `OpenAipAirportSearch` — sidecar `src/app/components/aviation/OpenAipAirportSearch.md`. Reference: [openaip](../../reference/remote-directories/openaip/README.md). Feature hub: [aviation](../aviation/README.md).

Airband is **not** a static channel set — see [aviation](../aviation/README.md) and channel-sets epic.

## Editor routes
| Path                         | Purpose                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/library/channels/:id`      | **View** a channel — read-first page |
| `/library/channels/:id/edit` | Edit a channel                                                                                          |
| `/library/channels/new`      | Create a channel                                                                                        |
| `/library/:kind/:id`         | Edit any other entity (`:id` = `new` to create)                                                         |

`:kind` is a slug (`channels`, `talk-groups`, `digital-contacts`, `analog-contacts`, `rx-group-lists`, `scan-lists`, `zones`) mapped to an internal `EntityKind` in `routes/library/registry.ts`. Editors navigate back to the matching list route on save/cancel via `listPathForEditorSlug()`; the channel editor goes back to the channel's view page instead (or the list, for a new channel that was cancelled).

Build channel links with `channelViewPath(id)` / `channelEditPath(id)` from `src/app/lib/channelPaths.ts`. Links open the **view** by default — list rows and cards, map markers, zone member rows, scan-list summaries, Nearby and directory search results, APRS and OpenAIP rows. Only links whose intent is clearly to edit go to `/edit`: the single-selection **Edit** bulk action, a build's **Edit in library** link, Duplicate, and Previous / Next inside the editor.

### Channel view
`ChannelViewPage` (`src/app/routes/library/ChannelViewPage.tsx`) shows what is set on a channel and hides what is empty:

- **Header:** callsign · name (callsign first, monospace; name alone when there is no callsign), then **Edit** (also the **E** key), **Duplicate** (asks first, then opens the copy in the editor) and **Delete**.
- **Frequency:** RX frequency large; TX and the signed offset below, or **Simplex** / **Receive only**; band pill and the comment (no mode pills in the hero).
- **How to talk on it:** full-width talk cards above the column grid (`channelView/ChannelTalkCard.tsx`, sentences from `channelView/modeTalk.ts`). Each card states how to use that mode in a sentence (values to dial in bold), then the small facts the sentence did not use, then an RX group list brief when the profile has one (`channelView/RxGroupListBrief.tsx`). One mode → one card (no badge). Two modes → two cards, main mode first with a **Main mode** badge. Three or more → one compact row per mode (summary chip, expandable). A mode with nothing set says so and links to that mode in the editor (`#mode` or `#mode-<mode>`).
- **Details:** abbreviation, power, transmit / TX permit / scan overrides, scan list, APRS — each only when it differs from the default.
- **Zones:** each zone that contains the channel, linked, with "via <nested zone>" for nested-only membership.
- **Builds:** each build in the project with whether the channel reaches it — **Included** (and the build's wire-name override, if any), **Excluded in this build**, or ruled out by the radio's modes or frequency ranges (`channelStatusInBuild` in `@core/domain/channelEligibility.ts`).
- **Location:** a small map with the channel (and you, once known), **distance and bearing from you** (the same operator position as the list's **Use my location**; the button reads "How far is this from me?" until it is set), locator and coordinates. Once your position is known the map draws a dashed great-circle line from you to the channel, labelled with the distance at its midpoint (`CodeplugMap` `distanceLine`). With no location, a link to the editor's Location section.
- **Directory:** collapsed; the same directory checks as the editor, with **Apply & save** only (no form to fill).

Talk cards span both columns above the grid. Two columns from 62em (Details, zones and builds left, map and directory right); one column below.

### Unsaved changes
All entity editors track dirty form state against the mount baseline (`useEntityEditorUnsavedGuard`). When dirty:

- In-app navigation (Cancel link, section nav, back link) opens [`UnsavedChangesModal`](../../src/app/components/ui/UnsavedChangesModal.md) (v2 `ConfirmModal`, C2) — Stay or Discard.
- Tab close triggers the browser `beforeunload` prompt.
- **Save** calls `permitNavigationOnce` before navigating back to the list.

**Not guarded:** zone membership on the channel editor **Zones** tab — `ChannelZoneMembershipSection` persists add/remove immediately (separate from the main channel form).

## Entities and editors
| Entity          | Key fields                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel         | name, optional `abbreviation` (export shortening), callsign, RX/TX (MHz↔Hz), power, location + `maidenheadLocator`, `scanInclusion` (default/skip/alwaysScan), optional `scanListId` (FK to library scan list), comment, optional `primaryMode` (the main mode: kept by a radio that can use only one of the channel's modes, transmitted in by a dual-mode radio), **multi** `modeProfiles[]` (DMR profile includes optional `dmrMode`) |
| Talk group      | name, optional `abbreviation` (multi-TG export shortening), digital mode, group ID, comment                                                                                                                                                                                                                                                                                                                                              |
| Digital contact | name, digital mode, contact ID, comment                                                                                                                                                                                                                                                                                                                                                                                                  |
| Analog contact  | name, code, comment                                                                                                                                                                                                                                                                                                                                                                                                                      |
| RX group list   | name, members (talk groups / digital contacts); optional `timeSlotOverride` per member (`1` \| `2` \| unset)                                                                                                                                                                                                                                                                                                                             |
| Scan list       | name, ordered `memberChannelIds` (channel UUID FKs)                                                                                                                                                                                                                                                                                                                                                                                      |
| Zone            | name, ordered members (`channel` and/or nested `zone` refs), comment                                                                                                                                                                                                                                                                                                                                                                     |

Channel DMR profiles reference a **digital contact**, an **RX group list** and a **Digital ID** by UUID `id` (the editor exposes dropdowns); NXDN profiles reference a talk group **or** an NXDN contact (the call), an RX group list and a Digital ID by UUID; TETRA profiles may reference talk groups by UUID. NXDN contact and unit IDs are checked 1–65519 in the editors, and your own NXDN Digital IDs the same (never 65535); a talk group may also be 65535 (all-call). An RX group list that mixes modes shows a non-blocking warning. RX group lists and zones hold member `EntityRef[]`. `RxGroupListMember.timeSlotOverride` is an optional per-member DMR slot hint (vendor-neutral; maps to CPS TS Override at export). Names are display labels only — never foreign keys.

### Digital IDs
Your own DMR and NXDN IDs: the IDs your radio sends. They live in the Library at `/library/digital-ids` (code: `OwnDigitalId`, store `ownDigitalIds`), with a name (may be empty), a protocol, a number (DMR 1–16776415, NXDN 1–65519) and a default flag. They are not contacts or talk groups (who you call) and not the ID directory (the downloaded lookup list).

- **Default per protocol.** The first ID created for a protocol becomes its default automatically; **Set as default** moves it (the new default is written first, then the old one is cleared). Deleting the default leaves the protocol with none, and the page shows a notice ("No default DMR ID. Channels set to Default use whatever DMR ID the radio already has, and some radios send none, until you choose one."). An ID that channels choose cannot be deleted. The same number twice in one protocol is refused in the editor, and a native YAML file (schema 30) with the same protocol and number twice, or two defaults in one protocol, is refused on import.
- **On a channel.** The DMR panel's "DMR ID" and the NXDN panel's "Unit ID" are selects: **Default (Name, number)** first, then that protocol's IDs, and a "Manage Digital IDs" link. A channel on Default sends the default; a chosen ID overrides it where the radio has a per-channel ID. A choice whose row is gone or belongs to the other protocol shows as "(missing)" and the channel editor refuses to save it.
- **Migration.** Projects saved before Digital IDs (IndexedDB schema 30 upgrade, native YAML and Drive files at schema 29 or lower) turn each distinct per-channel number into one unnamed Digital ID (shown as "DMR 2351234"), every channel that had a number chooses it explicitly, and **no default is set**. That keeps every existing export byte-identical until you set a default or change a channel's ID, with one exception: a hand-edited legacy `dmrId: 0` (the editor could never produce it) means "no override", so it becomes Default and the OpenGD77 CSV writes `None` where it wrote `0`. A legacy number outside the protocol's range (for example a DMR number above 16776415) is migrated as it is, so the channel keeps its choice, and the page lists it as out of range until you fix or delete it. The first-ID-is-default rule applies only to IDs you create, never to migration.
- **What writes them.** AT-D890UV (stock and MM9PDY) and DM-32UV Web Serial write the default DMR ID first in the radio-ID list; the AT-D890UV also writes the master ID, and only when a default DMR ID exists (otherwise it warns and leaves its IDs alone). OpenGD77 Web Serial writes a channel's chosen DMR ID to the per-channel override and nothing for Default. An unnamed ID is written to the radio-ID list as `ID <number>` (for example `ID 2351234`), or for a chosen ID the channel's callsign or name; an unnamed default does not replace the master name an AT-D890UV already holds. Over the radio's cap of distinct IDs, a channel whose ID did not fit sends the default ID and the usual "only N export" warning says so. When the AT-D890UV image Studio read has the radio's Master Id choice on (`0x03684026` = 1), Review warns that per-channel ID overrides have no effect. Anytone CSV, DM-32 CSV and NeonPlug do not write Digital IDs yet; the OpenGD77 radio's own base-settings ID is; the NXDN default is written by the AT-D890 own-ID work.

Details: [data-model](../data-model/README.md), [D890 Write contract](../../reference/radios/anytone/at-d890uv/README.md), [DM-32UV radio IDs](../../reference/radios/baofeng/dm-32uv/contacts-zones-lists.md).

### Channel editor
- **Layout:** `EditorHeader` (back crumb, title, mode-summary subtitle on saved channels) + a sticky horizontal **section jump-nav** + scroll `Panel` sections + `StickyFooter` (Cancel/Save, dirty status). Order: **Identity** → **Mode and frequency** → **Modes** (two or more modes only) → **Transmit** → **Names and notes** → Location → Zones (edit only) → Scanning → APRS. Every panel carries an `id` the jump-nav scroll-spies against (`useSectionScrollSpy`); clicking a nav item or a same-page cross-link (e.g. Location's "Set from a directory in Identity") calls `scrollToPageSection`.
- **Header title:** on a saved channel, `EditorHeader`'s `<h1>` reads `"<Callsign> <Name>"` (callsign first, falling back to name alone when callsign is empty, or "Untitled channel" when both are). New channel keeps "New channel" until saved. Callsign leads because it's the licensed identifier — see [display styleguide — Channel naming](../../reference/styleguide/display.md#channel-naming).
- **Identity — minimum-viable-channel fields only:** callsign + [`ChannelDirectoryVerifyActions`](../../../src/app/components/repeaters/ChannelDirectoryVerifyActions.tsx) (ukrepeater.net, IRTS, RepeaterBook, optional BrandMeister repeater; disabled when callsign is empty — see below) and name. Abbreviation, comment, and the export wire-name preview live in **Names and notes** (`collapsible`, starts collapsed on mobile).
- **Directory lookup is not gated on a saved channel.** `ChannelDirectoryVerifyActions` renders on **New channel** too, not only on saved channels — the callsign-first workflow (type a callsign, click a lookup button, review the diff, apply) is now the primary way to start a repeater channel, alongside typing every field by hand. The dialog's copy switches via `mode`: **`verify`** ("Check ukrepeater.net…", saved channel) vs **`lookup`** ("Look up on ukrepeater.net…", New channel).
- **Apply & save vs Apply only:** [`RepeaterListingUpdateDialog`](../../../src/app/components/repeaters/RepeaterListingUpdateDialog.tsx) offers two actions. **Apply & save** persists immediately (`persistence.putChannel`) — this is the same one-click "check → diff → save" loop the editor has always had on saved channels, unchanged; on New channel it also creates the channel and navigates to its edit page (`/library/channels/:id/edit`). **Apply only** is New-channel-specific: it fans the patch into the open form's existing field state and writes nothing, so the operator can keep filling in the rest of the channel (modes, location, …) before the first save. See [repeater-directories](../repeater-directories/README.md) for the directory-integration side of this.
- **Mode and frequency:** [`ChannelModePicker`](../../../src/app/components/channels/ChannelModePicker.md) (placeholder with FM, DMR, FM + DMR presets on a new channel; switch, chips, or **+ Also runs another mode**), RX/TX, `TxOffsetControls` (Simplex + band offsets; [tx-offsets.md](../../reference/tx-offsets.md)), and — with one mode — that mode's [`ModePanel`](../../../src/app/components/channels/modePanels/ModePanels.md) inline (BrandMeister RX-list sync on DMR when editing a saved channel). With two or more modes, per-mode [`ModeSection`](../../../src/app/components/channels/ModeSection.md) panels move to **Modes**.
- **Transmit** (`collapsible`, folded on a phone with a one-line summary): `PercentLevelSlider` (`null` = radio default); `PowerLadderHints` beside it on desktop, collapsed **Power examples** on mobile. `ForbidTransmitSegment` and `TxPermitSegment` at `layout="row"`. Informational only.
- **Value-aware segment colours:** gradient segmented controls (Transmit, TX permit, Scanning, and the DMR/analog mode panels) no longer collapse a neutral "Default"/"Auto" option onto the same colour as a real option just because a short palette ran out of colours to pad with — `GradientSegmentedControl`'s `neutralValues` excludes neutral values from palette fitting entirely. See [GradientSegmentedControl.md](../../../src/app/components/ui/GradientSegmentedControl.md).
- **Scanning:** scan inclusion + optional `scanListId` FK only (TX controls are under **Transmit**).
- **No default mode** on new channels — the picker shows "Which mode does this channel use?" with FM, DMR and FM + DMR presets (FM + DMR makes FM the main mode). Frequencies can be set before a mode; a channel can still be saved with no mode (`modeProfiles` empty).
- **Location:** `ChannelLocationSection` + `MapLocationPicker` in v2 `MapPanel`. Save reconciles locator ↔ coords via `reconcileChannelLocation`. When the channel has a callsign but no location yet, the panel shows a "Set from a directory in Identity" jump-link instead of a static hint. **Find a place** searches the town in the channel name (one click) or any address, town or postcode, ranked near the current position, and moves the channel only to the result the operator picks: the fix for directory imports that only carry a 4-character locator ([ChannelPlaceSearch](../../../src/app/components/channels/ChannelPlaceSearch.md)).
- **Mode profiles:** each mode's settings come from its panel in [`modePanels/`](../../../src/app/components/channels/modePanels/ModePanels.md). Switching mode keeps the old profile until save; switching back restores it. With two or more modes, each mode has its own section; the main mode's shows **Main mode**, the others **Make main**; sections keep their order; with three or more modes (two or more on a phone) the others start folded to their summary; a mode added in this edit starts open. See [channel-modes.md](channel-modes.md). Analog tones use [`ChannelToneField`](../../../src/app/components/channels/ChannelToneField.md) (**Off \| CTCSS \| DCS**).
- **Zone membership** (edit only): light inverse chips + zone add (`ChannelZoneMembershipSection`) — not full Membership shuttle; shows "Not in a zone yet." when the channel has no direct or nested-only membership.
- **Duplicate** and **Delete channel** on saved channels. Duplicate (here and on the view page) is [`ChannelDuplicateButton`](../../../src/app/components/library/ChannelDuplicateButton.md): it asks first, then copies with `duplicateChannel` from `@core/domain/factories.ts` and opens the copy in the editor. In the editor the copy takes the live form, unsaved edits included, and the confirm says so.
- **Save** returns to the channel's view page; **Cancel** returns to the view page (or the list, for a new channel). The header crumb reads **View channel** on a saved channel. A `#section` hash on the URL (e.g. `/edit#location` from the view page) scrolls to that panel.
- Component sidecars: `ChannelModePicker.md`, `ModeSection.md`, `modePanels/ModePanels.md`, `ChannelToneField.md`, `EditorHeader.md`, `StickyFooter.md`, `SectionNav.md`, `GradientSegmentedControl.md`, and siblings under `src/app/components/channels/`; directory verify sidecars under `src/app/components/repeaters/`.

### Library strip
All contextual Library destinations use `DesignSystemV2Provider` with v2 list chrome (`SearchInput` / `DataTable` `selectionChrome="v2"`) and editor shells (sticky header + `Panel` sections). Zone, RGL, and scan list membership editors use the Membership family (`MembershipPanel`, `AddMembersScreen`, pool rows). Maps on zone/channel list pages use `MapPanel` + `CodeplugMap`.

### Talk group editor
- **Layout:** `EditorHeader` + single `Panel` compact form + `StickyFooter` — same chrome family as channel editor.
- **Identity:** name, v2 `SegmentedControl` mode, talk group ID, abbreviation, comment; `TalkGroupWireNameExamples` for export shortening hints.
- **List:** optional **Abbrev** column on `/library/talk-groups` (default visible).
- **Persistence:** empty abbreviation omitted on save; native YAML round-trip preserves the field.
- Sidecar: `src/app/components/library/TalkGroupWireNameExamples.md`.

### Digital contact editor
- **Layout:** `EditorHeader` + compact `Panel` + `StickyFooter`.
- **Fields:** callsign, name, country, DMR ID, mode (`SegmentedControl`), city/state, remarks, comment.
- **RadioID:** `DismissibleNotice` when contact looks directory-sourced; `RadioidContactVerifyPanel` below the form on saved contacts.

### Analog contact editor
- **Layout:** `EditorHeader` + compact `Panel` + `StickyFooter`.
- **Fields:** name, CTCSS/DCS tone (`code`), comment.

### Library defaults
- **Routes:** `/library/channels/defaults`, `/library/zones/defaults` — dense settings (not full editor chrome).
- **Channel:** v2 `Panel` + `SegmentedControl` for forbid TX, TX permit, talker alias, analog squelch.
- **Zone:** v2 `ToggleSwitch` for zone-derived scan-list include default.
- Separate routes retained; no invented Power/Bandwidth/contact-Country defaults.

### Zone-from-location & grow
- **M2** `/library/zones/new-from-location`: `EditorHeader`, `GeocodeCentreField` (`Combobox` geocode), radius chips, v2 `DataTable` multi-select, create footer; folding panels + `MapThumbnail` / `FullScreenMapSheet` on mobile.
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
- **Referential integrity:** single-entity deletes are **blocked** when another entity still references the target (e.g. a zone listing a channel, an RX group list listing a talk group, a channel mode profile pointing at a contact / RX list / talk group, a parent zone nesting a child zone). The block lists the referencing entities. **Exception:** **Delete all digital contacts** cascade-clears inbound refs first (`LibraryService.deleteAllDigitalContacts`) — it does not use the per-row block path. **Radio builds:** builds never block a delete. After any single-entity delete, `LibraryService` drops the deleted id from every build's trait layout (zone grouping, flat memory, scan lists, scan flags) and override rows (`pruneStaleBuildReferences`, core), so a build never keeps a dangling id.
- **Delete UI:** every saved entity has a **Delete** button on its editor (`EntityDeleteButton`; channels use `ChannelDeleteButton` for zone cascade). List pages add a trash **actions** column (`EntityListDeleteAction`; channels use `ChannelListDeleteAction`). Flow: `runEntityDeleteFlow` → `useLibrary().deleteEntity` → `LibraryService.deleteWithIntegrity`. Channel delete may offer remove-from-zones cascade when blocked only by zone membership. **Bulk delete** from the channels list bulk-edit modal uses `persistChannelBulkDelete` with the same integrity rules and one confirmation for the whole selection. **Delete all digital contacts** uses `DeleteAllDigitalContactsDialog` (checkbox gate) → `useLibrary().deleteAllDigitalContacts`.

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

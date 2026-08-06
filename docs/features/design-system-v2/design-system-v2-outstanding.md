# Design system v2 — Outstanding

Debt and follow-ups discovered during [epic #915](https://github.com/pskillen/codeplug-studio/issues/915).

## Debt

| Item                                               | Severity      | Notes                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain BandPill / ModePill in membership rows      | Low           | Zone/RGL/scan shuttle rows still use v1 `BandPill` / `ModePill` inside `ShuttleRow` labels — acceptable until domain pills re-skin                                                                                                                                                                    |
| Mantine segments in v2 editors                     | Low           | APRS sub-panels and some channel mode-profile fields still use Mantine / v1 segments — talk group / digital contact mode pickers migrated to v2 `SegmentedControl` in #943                                                                 |
| `ZoneEditActions.tsx` unused                       | Low           | Save moved to layout sticky header — file can be removed in #927 retire pass                                                                                                                                                                                                                          |
| Cookie banner vs BottomTabBar overlap              | Low           | Fixed cookie dialog may sit over the mobile tab bar until a dedicated offset lands                                                                                                                                                                                                                    |
| `DataTable` v2 `storedOrder` not built             | Low           | Capability inventory flags it as speculative — "API + styleguide only, no current product call site." Add against a real consumer if one emerges; v1 `ui/DataTable` still has it                                                                                                                      |
| v2/v1 component coexistence                        | Low           | `EmptyState`, `DismissibleNotice` (vs `SoftWarning`), `FileDropzone` (vs `YamlFileDropzone`), and `DataTable` all now have independent v1 and v2 implementations by design (fork-and-coexist, not extend-in-place) — consolidate call sites in a later migration, then retire the v1 versions in #927 |
| `Combobox` not wired to a real consumer            | Closed (#943) | `GeocodeCentreField` on `ZoneFromLocationPage` and `GrowZoneRecommendations`                                                                                  |
| `WirePreviewTable` / `WriteVerifyReport` are stubs | Medium        | Static-fixture presentational only (#938) — full data wiring to real `WirePreviewRow`/`WriteVerifyResult` domain types is Builds (#924)'s job                                                                                                                                                         |
| Membership family not wired into live editors      | Closed (#942) | Zone / RGL / scan editors now use MembershipPanel + AddMembersScreen                                                                                                                                                                                                                                  |
| Mantine controls in channel mode profile panels    | Low           | `ChannelModeProfilesEditor` stacked layout (#941) still uses Mantine `Select`/`NumberInput` for DMR/contact fields — v2 `Combobox` wiring deferred until membership/editor tickets need it                                                                                                            |
| FacetChip / SplitFilter not in `components/v2`     | Low           | Page-local under `library/FacetBar.tsx` per mk2 Batch 2 — promote to v2 forms only if `_ds` adds a spec ([#940](https://github.com/pskillen/codeplug-studio/issues/940))                                                                                                                              |
| MapPanel gear popover for zone map settings        | Low           | Zones split map uses in-map `CodeplugMap` controls; mk2 gear popover not wired separately ([#940](https://github.com/pskillen/codeplug-studio/issues/940))                                                                                                                                            |
| Pre-#938 `components/v2/*` fidelity unverified     | Low           | Components shipped in #916–#935 were built against earlier, possibly incomplete DS snapshots — their "Shipped" status in the README is not a confirmed match to the current mk2 export. A fidelity audit is separate future work, not #938's scope                                                    |

## Closed during form editors + zone helpers (#943)

- E3–E5 compact editors: `EditorHeader`/`StickyFooter`, `CompactFormEditor.module.css`, v2 mode segments
- E8 dense defaults on separate channel/zone routes (annotated variance from mk2 combined frame documented in library hub)
- M2/M3: `GeocodeCentreField` Combobox consumer; v2 `DataTable` multi-select on zone-from-location and grow recommendations

## Closed during membership editors (#942)

- Zone / RGL / scan membership editors migrated from `ShuttleList*` to Membership family
- E2 consolidated zone workspace (members + map + Scanning behaviour); legacy `/add` and `/scanning` redirect

## Closed during channel editor E1 (#941)

- `EditorHeader` + `StickyFooter` promoted to `components/v2` (missed from #938 Batch 3 canvas helpers)
- Channel editor mk2 E1 layout: Identity modes multi-select, stacked Mode settings, sticky footer, light zone chips
- `ChannelModesField`, FormField/TextInput validation error affordance

## Closed during foundations gap-fill (#938)

- Overlays (`ModalShell`, `ConfirmModal`, `ProgressModal`), `DataTable` v2 full capability set, the Membership family, remaining forms/feedback primitives (`StatusDot`, `EmptyState` v2, `DismissibleNotice`, `FileDropzone`, `Combobox`), and build-specific stubs (`WirePreviewTable`, `WriteVerifyReport`) — every component gap the mk2 DS export required per the ticket body
- Icon-size tokens formalized into `DSV2_TOKENS.iconSize` (no new values invented — the DS bundle itself never settled a formal nav/action split)
- Post-review fixes to `DataTable` v2: lead-column (checkbox/expander) cells were clipped by the regular 16px content-column padding in a 32-40px column — replaced with a dedicated tight-padding `.leadCell` style. Per-row reorder now uses a real drag handle (`SelectedItemDragHandle`, reusing the generic `DataTableBulkReorderProvider`/`Sortable` dnd-kit wrapper and `@core/domain/zoneOrder.ts` algorithms) instead of up/down buttons, matching the capability doc's "grip-handle + numeric order column" — the bulk-toolbar Move up/down buttons stay for selection-level reorder without dragging.
- Second post-review fix round: `ModalShell` (and `ConfirmModal`/`ProgressModal`) rendered with a transparent panel because Mantine's `Modal` portals to `document.body` by default, outside `.dsv2-scope` where `--dsv2-*` custom properties live — fixed by pinning `portalProps={{ target: DSV2_SCOPE_SELECTOR }}`. The styleguide's `MembershipPanel` demo now wires a real dnd-kit `useSortable` drag handle into `MembershipRow` (`dragHandleProps` was already designed as externally-supplied, per `ShuttleRow`'s pattern, but the styleguide page hadn't actually wired it, so handles rendered as static icons). `AddMembersScreen` is now a full-screen takeover only below the desktop breakpoint (`< 48em`); at `≥ 48em` it renders as a centered modal-style card over a dimmed backdrop instead of full-bleed.

## Closed during library ports

- ShuttleList skins only in styleguide — now wired in `ZoneMemberEditor`, `RxGroupListMemberPicker`, `ScanListMemberEditor`
- Epic #915 exclusion of TG / Contacts / Scan / APRS — shipped as best-effort chrome ports ([#932](https://github.com/pskillen/codeplug-studio/issues/932)–[#935](https://github.com/pskillen/codeplug-studio/issues/935))

## Closed in MapPanel (#925)

- Hatch-only `MapPanel` — live maps now render via `children` on library lists, zone editors, directory search, channel/APRS location pickers, and Maidenhead tools

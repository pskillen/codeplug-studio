# Design system v2 — Progress

Execution log for [epic #915](https://github.com/pskillen/codeplug-studio/issues/915) (child of [#495](https://github.com/pskillen/codeplug-studio/issues/495)).

**r2 retrofit** (plan: `tmp/design-system-prep/retrofit-r2-plan.md`) supersedes the mk1 rollout's visual acceptance below — it targets the completed mk2 Claude Design export, not incidental live UI. mk1 slices stay as history.

## r2 retrofit slices

| Slice                       | Status      | Branch / PR                                                     | Notes                                                                                                        |
| --------------------------- | ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Foundations gap-fill (#938) | Shipped     | [PR #946](https://github.com/pskillen/codeplug-studio/pull/946) | Overlays, DataTable v2 full capability set, Membership family, forms/feedback, build stubs, icon-size tokens |
| Shell & project (#939)      | Shipped     | merged to `main`                                                | S1–S4, P1 Home, P3 Drive modals, P4 Quick start — mk2 Batch 1 + P4                                           |
| Library lists (#940)        | Shipped     | `940/pskillen/ds-r2-library-lists`                              | Batch 2 L1–L7, C3, C7 — v2 DataTable + L1 chrome + ModalShell bulk overlays                                  |
| Channel editor (#941)       | Shipped     | [PR #951](https://github.com/pskillen/codeplug-studio/pull/951) | Batch 3 E1 — EditorHeader/StickyFooter + stacked modes + sticky footer                                       |
| Membership editors (#942)   | Shipped     | [PR pending]                                                    | Batch 3 E2/M1/E6/E7 — zone workspace, RGL timeslot, scan minimal M1                                          |
| Form editors + zone (#943)  | In progress | `943/pskillen/ds-r2-form-editors`                               | Batch 3 E3–E5, E8, M2, M3 — stacked on #942 branch                                                           |

### #943 form editors + zone helpers (E3–E5, E8, M2, M3)

| Sub-slice                | Status   | Notes                                                                                              |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------- |
| Kickoff + diff checklist | Complete | Branch `943/pskillen/ds-r2-form-editors` from `942/pskillen/ds-r2-membership-editors`              |
| E3–E5 compact forms      | Complete | `EditorHeader`/`StickyFooter`, `CompactFormEditor.module.css`, v2 `SegmentedControl`               |
| E8 dense defaults        | Complete | Separate channel/zone routes; `DefaultsSettings.module.css`; annotated vs mk2 E8 frame             |
| M2 zone-from-location    | Complete | `GeocodeCentreField`, radius chips, v2 `DataTable` multi-select, `ZoneFromLocationPage.module.css` |
| M3 grow recommendations  | Complete | Table-first `GrowZoneRecommendations` + v2 `DataTable` bulk add                                    |
| Docs + PR                | Complete | Feature hubs; Combobox debt closed; PR open                                                        |

**Annotated mk2 deltas (locked):** no Talk-group Usage field; no Power/Bandwidth/contact-Country defaults invention; Combobox wired on M2/M3.

### #942 membership editors (Batch 3 E2/M1/E6/E7)

| Sub-slice                | Status   | Notes                                                                                    |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| Kickoff + diff checklist | Complete | Branch `942/pskillen/ds-r2-membership-editors` from `main` (#941 merged)                 |
| Zone Membership*         | Complete | `ZoneMemberEditor`, `ZoneMemberAddPool`, `ZoneMemberAddOverlay`                          |
| E2 workspace             | Complete | EditorHeader/StickyFooter, members+map, Scanning behaviour panel, legacy route redirects |
| RGL E6                   | Complete | `RxGroupListMemberPicker` + `RxGroupListAddOverlay`                                      |
| Scan E7                  | Complete | `ScanListMemberEditor` + `ScanListAddOverlay`                                            |

### #940 library lists (Batch 2)

| Sub-slice                | Status   | Notes                                                                                                        |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| Kickoff + diff checklist | Complete | Branch `940/pskillen/ds-r2-library-lists`                                                                    |
| L1 shared chrome         | Complete | `LibraryInventoryHeader`, `FacetBar`, `LibraryMapStack`, `libraryListTable` helpers                          |
| L4/L6/L7 thin lists      | Complete | Talk groups, RX group lists, scan lists on v2 DataTable                                                      |
| L5 Contacts              | Complete | Dual tables, extreme digital, RadioID header action                                                          |
| L3 Zones + C7            | Complete | reorderMode grip, split map stack, Sort zones…                                                               |
| L2 Channels + C7         | Complete | Facet chips, v2 table/map, selection bulk                                                                    |
| C3 overlays              | Complete | `ChannelBulkEditModal`, `AprsChannelBulkAssignModal` on ModalShell; APRS assignments table on v2 `DataTable` |

## mk1 slices (history — superseded by r2)

| Slice                          | Status     | Branch / PR                                                     | Notes                                                |
| ------------------------------ | ---------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Foundations (#916)             | Shipped    | [PR #928](https://github.com/pskillen/codeplug-studio/pull/928) | Theme isolation, `components/v2/*`, `/styleguide/v2` |
| Chrome port (#917)             | Shipped    | [PR #930](https://github.com/pskillen/codeplug-studio/pull/930) | AppShell + ContextualStrip + BottomTabBar live       |
| Summary / Channels (#918–#920) | Shipped    | [PR #931](https://github.com/pskillen/codeplug-studio/pull/931) | Summary, Channels list, Channel editor on v2         |
| Library ports (#921+)          | Superseded | `921/pskillen/design-system-v2-library`                         | Visual acceptance replaced by r2 #940                |

## Next

**r2 retrofit** in flight: form editors + zone helpers ([#943](https://github.com/pskillen/codeplug-studio/issues/943)) PR open.

## Verification

### #940 library lists

- [x] `npm run format:check && npm run lint && npm run test && npm run build`
- [ ] Manual desktop + narrow pass on L2–L7 vs Batch 2 frames
- [ ] C3 ModalShell chrome; C7 map toggle on mobile

### #938 foundations gap-fill

- [x] `npm run format:check && npm run lint && npm run test && npm run build`
- [x] Manual desktop + narrow pass on every new/extended `/styleguide/v2/*` page

### #941 channel editor (E1)

| Sub-slice                    | Status   | Notes                                                                            |
| ---------------------------- | -------- | -------------------------------------------------------------------------------- |
| Kickoff + diff checklist     | Complete | Branch `941/pskillen/ds-r2-channel-editor`                                       |
| v2 EditorHeader/StickyFooter | Complete | Sidecars + `/styleguide/v2/navigation`                                           |
| E1 shell + sections          | Complete | Stacked Mode settings; Identity modes; Frequency RX-first + Power; sticky footer |
| Product panels               | Complete | Scanning / APRS / Repeater restyled into E1 chrome                               |

## Verification

### #941 channel editor

- [x] `npm run format:check && npm run lint && npm run test && npm run build`
- [ ] Manual desktop + narrow pass vs Batch 3 E1 frames

### #940 library lists

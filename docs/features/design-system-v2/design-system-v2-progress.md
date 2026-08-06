# Design system v2 — Progress

Execution log for [epic #915](https://github.com/pskillen/codeplug-studio/issues/915) (child of [#495](https://github.com/pskillen/codeplug-studio/issues/495)).

**r2 retrofit** (plan: `tmp/design-system-prep/retrofit-r2-plan.md`) supersedes the mk1 rollout's visual acceptance below — it targets the completed mk2 Claude Design export, not incidental live UI. mk1 slices stay as history.

## r2 retrofit slices

| Slice                       | Status      | Branch / PR                                                     | Notes                                                                                                        |
| --------------------------- | ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Foundations gap-fill (#938) | Shipped     | [PR #946](https://github.com/pskillen/codeplug-studio/pull/946) | Overlays, DataTable v2 full capability set, Membership family, forms/feedback, build stubs, icon-size tokens |
| Shell & project (#939)      | In progress | `939/pskillen/ds-r2-shell`                                      | S1–S4, P1 Home, P3 Drive modals, P4 Quick start — mk2 Batch 1 + P4                                           |
| Library lists (#940)        | In progress | `940/pskillen/ds-r2-library-lists`                              | Batch 2: L1–L7, C3, C7 — v2 DataTable + L1 chrome + ModalShell bulk overlays                                 |

### #938 foundations gap-fill

| Sub-slice                                                                          | Status   | Notes                                                                    |
| ---------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| Icon-size tokens                                                                   | Complete | `DSV2_TOKENS.iconSize` + `--dsv2-icon-size-*`                            |
| Overlays: ModalShell → ConfirmModal → ProgressModal                                | Complete | New `/styleguide/v2/overlays`                                            |
| DataTable v2: core → selection/bulk → reorder → nesting/scale/visibility           | Complete | New independent `v2/DataTable.tsx`; coexists with v1                     |
| Membership: MembershipRow → MembershipPanel → MembershipPoolRow → AddMembersScreen | Complete | New `/styleguide/v2/membership`; not wired into live editors (#941–#943) |
| Forms/feedback: StatusDot, EmptyState, DismissibleNotice, FileDropzone, Combobox   | Complete | Demoed on existing `/forms`, `/data-display`, `/feedback` pages          |
| Build stubs: WirePreviewTable, WriteVerifyReport                                   | Complete | Static-fixture only; full wiring is Builds (#924)                        |

## mk1 slices (history — superseded by r2)

| Slice                          | Status      | Branch / PR                                                     | Notes                                                |
| ------------------------------ | ----------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Foundations (#916)             | Shipped     | [PR #928](https://github.com/pskillen/codeplug-studio/pull/928) | Theme isolation, `components/v2/*`, `/styleguide/v2` |
| Chrome port (#917)             | Shipped     | [PR #930](https://github.com/pskillen/codeplug-studio/pull/930) | AppShell + ContextualStrip + BottomTabBar live       |
| Summary / Channels (#918–#920) | Shipped     | [PR #931](https://github.com/pskillen/codeplug-studio/pull/931) | Summary, Channels list, Channel editor on v2         |
| Library ports (#921+)          | In progress | `921/pskillen/design-system-v2-library`                         | PR pending — all Library strip screens ported        |

### Library ports (#921 branch)

| Sub-slice                | Status      | Notes                                                                                                                                      |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Kickoff                  | Complete    | Child issues [#932](https://github.com/pskillen/codeplug-studio/issues/932)–[#935](https://github.com/pskillen/codeplug-studio/issues/935) |
| Zones list + edit (#921) | Complete    | v2 list + sticky editor shell                                                                                                              |
| Zones add/scan (#922)    | Complete    | ShuttleList* on ZoneMemberEditor                                                                                                           |
| RGLs (#923)              | Complete    | List + editor + shuttle picker                                                                                                             |
| Talk Groups (#932)       | Complete    | Best-effort chrome port                                                                                                                    |
| Contacts (#933)          | Complete    | List + digital/analog editors                                                                                                              |
| Scan lists (#934)        | Complete    | ShuttleList membership                                                                                                                     |
| APRS (#935)              | Complete    | Tabbed page chrome                                                                                                                         |
| Builds/export (#924)     | Deferred    | Out of scope this PR                                                                                                                       |
| MapPanel (#925)          | Shipped     | MapPanel children slot; all map call sites wrapped                                                                                         |
| Mobile QA (#926)         | Not started | —                                                                                                                                          |
| Retire v1 (#927)         | Not started | After full rollout only                                                                                                                    |

## Verification

### #938 foundations gap-fill (this branch)

- [x] `npm run format:check && npm run lint && npm run test && npm run build`
- [x] Manual desktop + narrow pass on every new/extended `/styleguide/v2/*` page (overlays, membership, data-display, forms, feedback) — zero console errors, interactions verified (modal open/close, AddMembersScreen stage/commit + blocked candidate, DataTable v2 reorder/nested-expand/column-visibility, Combobox search/select, DismissibleNotice dismiss)

### mk1 library ports (history)

- [ ] `npm run format:check && npm run lint && npm run test && npm run build`
- [ ] Manual desktop + mobile pass on Library strip (Zones, RGLs, TG, Contacts, Scan, APRS)
- [ ] Membership reorder/add/remove on Zones, RGLs, Scan lists

### #940 library lists (Batch 2)

| Sub-slice | Status | Notes |
| --- | --- | --- |
| Kickoff + diff checklist | In progress | Branch `940/pskillen/ds-r2-library-lists` from `origin/main` |
| L1 shared chrome | Pending | `LibraryInventoryHeader`, `FacetBar`, `LibraryMapStack` |
| L4/L6/L7 thin lists | Pending | v2 DataTable migration |
| L5 Contacts | Pending | Dual tables, extreme scale digital |
| L3 Zones + C7 | Pending | reorderMode grip, map split/toggle |
| L2 Channels + C7 | Pending | facets, selection bulk, map stacked |
| C3 overlays | Pending | `ChannelBulkEditModal`, `AprsChannelBulkAssignModal` → ModalShell |

**mk2 vs live deltas (acceptance checklist):**

| ID | Desktop gaps | Narrow gaps |
| --- | --- | --- |
| L1 | v1 DataTable; no shared header/facet shell | column collapse not on v2 table |
| L2 | Mantine facets; v1 table; Mantine bulk modal | facet scroll; map toggle |
| L3 | arrow reorder vs grip; hand-rolled toolbar | map toggle |
| L4/L6/L7 | duplicated page CSS; v1 table | column collapse |
| L5 | v1 table in Panel; no mk2 header counts layout | stacked sections |
| C3 | Mantine Modal chrome | mobile modal inset |
| C7 | map present but no shared stack/split/toggle helper | mobile map collapsed |

## Next

**r2 retrofit** active: [#940](https://github.com/pskillen/codeplug-studio/issues/940) library lists on `940/pskillen/ds-r2-library-lists`.

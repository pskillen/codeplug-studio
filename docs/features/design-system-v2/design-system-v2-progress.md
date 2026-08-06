# Design system v2 — Progress

Execution log for [epic #915](https://github.com/pskillen/codeplug-studio/issues/915) (child of [#495](https://github.com/pskillen/codeplug-studio/issues/495)).

**r2 retrofit** (plan: `tmp/design-system-prep/retrofit-r2-plan.md`) supersedes the mk1 rollout's visual acceptance below — it targets the completed mk2 Claude Design export, not incidental live UI. mk1 slices stay as history.

## r2 retrofit slices

| Slice                       | Status  | Branch / PR                      | Notes                                                                                                        |
| --------------------------- | ------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Foundations gap-fill (#938) | Shipped | `938/pskillen/ds-r2-foundations` | Overlays, DataTable v2 full capability set, Membership family, forms/feedback, build stubs, icon-size tokens |

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
- [ ] Manual desktop + narrow pass on every new/extended `/styleguide/v2/*` page against mk2 Batch frames

### mk1 library ports (history)

- [ ] `npm run format:check && npm run lint && npm run test && npm run build`
- [ ] Manual desktop + mobile pass on Library strip (Zones, RGLs, TG, Contacts, Scan, APRS)
- [ ] Membership reorder/add/remove on Zones, RGLs, Scan lists

## Next

**r2 retrofit** continues with [#939](https://github.com/pskillen/codeplug-studio/issues/939) shell & project lifecycle (highest blast radius — review carefully), then #940–#945 in parallel once #939 merges, per `tmp/design-system-prep/retrofit-r2-plan.md`'s suggested pickup order.

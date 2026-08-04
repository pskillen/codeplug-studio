# Design system v2 — Progress

Execution log for [epic #915](https://github.com/pskillen/codeplug-studio/issues/915) (child of [#495](https://github.com/pskillen/codeplug-studio/issues/495)).

## Slices

| Slice                    | Status      | Branch / PR                                                     | Notes                                                   |
| ------------------------ | ----------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| Foundations (#916)       | Shipped     | [PR #928](https://github.com/pskillen/codeplug-studio/pull/928) | Theme isolation, `components/v2/*`, `/styleguide/v2`    |
| Chrome port (#917)       | Shipped     | [PR #930](https://github.com/pskillen/codeplug-studio/pull/930) | AppShell + ContextualStrip + BottomTabBar live          |
| Summary / Channels (#918–#920) | Shipped | [PR #931](https://github.com/pskillen/codeplug-studio/pull/931) | Summary, Channels list, Channel editor on v2            |
| Library ports (#921+)    | In progress | `921/pskillen/design-system-v2-library`                         | Zones, RGLs, TG, Contacts, Scan, APRS                   |

### Library ports (#921 branch)

| Sub-slice             | Status      | Notes                                                                |
| --------------------- | ----------- | -------------------------------------------------------------------- |
| Kickoff               | Complete    | Branch from main; child issues [#932](https://github.com/pskillen/codeplug-studio/issues/932)–[#935](https://github.com/pskillen/codeplug-studio/issues/935) |
| Zones list + edit (#921) | In progress | —                                                                 |
| Zones add/scan (#922) | Not started | ShuttleList* on ZoneMemberEditor                                     |
| RGLs (#923)           | Not started | —                                                                    |
| Talk Groups (#932)    | Not started | Best-effort chrome port                                              |
| Contacts (#933)       | Not started | Best-effort chrome port                                              |
| Scan lists (#934)     | Not started | ShuttleList membership                                               |
| APRS (#935)           | Not started | Best-effort chrome port                                              |
| Builds/export (#924)  | Deferred    | Out of scope this PR                                                 |
| MapPanel (#925)       | Deferred    | Out of scope this PR                                                 |
| Mobile QA (#926)      | Not started | —                                                                    |
| Retire v1 (#927)      | Not started | After full rollout only                                              |

## Verification

### Before merge (library ports PR)

- [ ] `npm run format:check && npm run lint && npm run test && npm run build`
- [ ] Manual desktop + mobile pass on Library strip (Zones, RGLs, TG, Contacts, Scan, APRS)
- [ ] Membership reorder/add/remove on Zones, RGLs, Scan lists

## Next

Ship library ports PR → #924 Builds/export or #925 MapPanel as separate tickets.

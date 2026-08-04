# Design system v2 — Progress

Execution log for [epic #915](https://github.com/pskillen/codeplug-studio/issues/915) (child of [#495](https://github.com/pskillen/codeplug-studio/issues/495)).

## Slices

| Slice                    | Status      | Branch / PR                                                     | Notes                                                |
| ------------------------ | ----------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Foundations (#916)       | Shipped     | [PR #928](https://github.com/pskillen/codeplug-studio/pull/928) | Theme isolation, `components/v2/*`, `/styleguide/v2` |
| Chrome port (#917)       | In progress | `917/pskillen/design-system-v2-chrome`                          | AppShell + ContextualStrip + BottomTabBar live       |
| Screen ports (#918–#925) | Not started | —                                                               | Summary, Channels, Zones, RX lists, Builds, Map      |
| Mobile QA (#926)         | Not started | —                                                               | Cross-cutting narrow + Android WebView               |
| Retire v1 (#927)         | Not started | —                                                               | After full rollout only                              |

### #917 chrome port (this branch)

| Sub-slice                    | Status   | Notes                                                           |
| ---------------------------- | -------- | --------------------------------------------------------------- |
| Five-tab primary nav data    | Complete | Summary / Library / Tools / Export / Help + strip maps          |
| AppLayout → v2 chrome        | Complete | Provider isolates header/strip/bottom bar; Outlet stays v1      |
| Entity list New/Add toolbars | Complete | Preserved after SectionNav removal                              |
| Banner/footer token restyle  | Complete | Cookie / Drive refresh / BuildFooter borders from `DSV2_TOKENS` |
| Dead v1 chrome cleanup       | Complete | AppNav, SectionNav sidebar, AppHeader, ActiveProjectBar gone    |

## Verification

### Done (local)

- [x] Nav unit tests (`primaryNavItems`, `contextualStripItems`)
- [x] `AppShell` project-click / disabled / hide-tabs tests
- [x] `tsc --noEmit -p tsconfig.app.json`

### Before merge

- [ ] `npm run format:check && npm run lint && npm run test && npm run build`
- [ ] Manual desktop + mobile pass across Summary / Library / Builds / Tools / Help / Settings / Debug
- [ ] Confirm `--dsv2-*` does not leak onto `<Outlet/>`

## Next

Open PR for #917 → design review → screen ports (#918+).

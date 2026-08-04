# Design system v2 — Progress

Execution log for [epic #915](https://github.com/pskillen/codeplug-studio/issues/915) (child of [#495](https://github.com/pskillen/codeplug-studio/issues/495)).

## Slices

| Slice                    | Status      | Branch / PR                                 | Notes                                                |
| ------------------------ | ----------- | ------------------------------------------- | ---------------------------------------------------- |
| Foundations (#916)       | In progress | `916/pskillen/design-system-v2-foundations` | Theme isolation, `components/v2/*`, `/styleguide/v2` |
| Chrome port (#917)       | Not started | —                                           | Replace AppNav / SectionNav / AppLayout              |
| Screen ports (#918–#925) | Not started | —                                           | Summary, Channels, Zones, RX lists, Builds, Map      |
| Mobile QA (#926)         | Not started | —                                           | Cross-cutting narrow + Android WebView               |
| Retire v1 (#927)         | Not started | —                                           | After full rollout only                              |

### #916 foundations (this PR)

| Sub-slice                                | Status   | Commit scope             |
| ---------------------------------------- | -------- | ------------------------ |
| Theme tokens + resolver                  | Complete | `theme-v2.ts` + tests    |
| DesignSystemV2Provider                   | Complete | Isolation test + sidecar |
| Button / Pill / OverrideField / MapPanel | Complete | Net-new primitives       |
| AppShell / BottomTabBar                  | Complete | Presentational chrome    |
| ShuttleList family                       | Complete | Reuse list-kit           |
| `/styleguide/v2` routes                  | Complete | Nested layout + demos    |
| Feature hub + progress pair              | Complete | This docs slice          |

## Verification

### Done (local)

- [x] `vitest` for `theme-v2` and `components/v2/*`
- [x] `tsc --noEmit -p tsconfig.app.json`
- [x] Isolation: Mantine styles target `.dsv2-scope` with `--dsv2-accent` (provider test)

### Before merge

- [ ] `npm run format:check && npm run lint && npm run test && npm run build`
- [ ] Manual: `/styleguide/v2` + sub-pages at narrow width
- [ ] Manual: spot-check v1 `/styleguide/*` and one live screen — no visual/CSS var leak

## Next

Open PR for #916 → design review gate → pick up #917.

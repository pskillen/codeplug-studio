# Design system v2 — Outstanding

Debt and follow-ups discovered during [epic #915](https://github.com/pskillen/codeplug-studio/issues/915) / foundations [#916](https://github.com/pskillen/codeplug-studio/issues/916).

## Debt

| Item                                                 | Severity | Notes                                                                                                                                                                                     |
| ---------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forms/data-display components not yet ported         | Medium   | DS also defines `TextInput`, `SearchInput`, `SegmentedControl`, `ToggleSwitch`, `Checkbox`, `StatusDot`, `CountTile`, `StatusBanner` — deferred beyond the #916 narrowed set.             |
| v1 spacing not remapped in `themeV2`                 | Low      | Accepted #916 gap — reused `Page` / `PageSection` get v2 colors/radii but not exact v2 padding. Revisit if chrome port (#917) needs tighter match.                                        |
| ShuttleList skins Mantine title chrome inside panels | Low      | `SelectedItemList` / `AvailableItemPicker` still render their own Mantine `Text` titles; v2 panel is a wrapper. Fine for preview; may want thinner wrappers when membership screens port. |
| MapPanel hatch only                                  | Deferred | Real `CodeplugMap` wiring tracked as [#925](https://github.com/pskillen/codeplug-studio/issues/925).                                                                                      |
| Domain BandPill / ModePill still v1                  | Deferred | Explicitly out of #916; use `Pill` `tone="semantic"` when those screens port.                                                                                                             |

## Closed during #916

- Token gaps vs DS `tokens/*.css` (accent tints, border-strip, typography names, panel padding swap) — fixed in fidelity pass on PR #928
- `AppShell` reinvented as sidebar layout — rewritten to DS top-header API; added `ContextualStrip` + `SectionNav`

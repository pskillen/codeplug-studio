# Mode profiles — progress

**Tracking:** [#16](https://github.com/pskillen/codeplug-studio/issues/16) · [#28](https://github.com/pskillen/codeplug-studio/issues/28)

## Complete

| Commit    | Slice                                                                                  |
| --------- | -------------------------------------------------------------------------------------- |
| `cfa1d85` | Core: typed `ChannelModeProfile` union, `maidenheadLocator`, schema v2, domain helpers |
| `201202e` | App: channel field helpers, `ChannelModesMultiSelect`                                  |
| `5576ebf` | App: `ChannelModeProfilesEditor`                                                       |
| `a0f0146` | App: `ChannelLocationSection` + map picker docs                                        |
| `8ce43df` | Library: full `ChannelEditor` rewrite                                                  |
| `26b0d72` | Downstream: map projection, repeater import/diff, list descriptions                    |

## Verify

- [ ] Import multi-mode repeater → edit FM + DMR independently → save → all profiles persist
- [ ] New channel → add FM + DMR via multi-select → save
- [ ] Locator `IO91WM` ↔ map pick ↔ save → `maidenheadLocator` + `location` persist
- [ ] `npm run lint && npm run test && npm run build`

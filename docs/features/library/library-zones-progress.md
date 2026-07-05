# Library zones — progress

**Epic:** [#179 — Channel and Zone Management](https://github.com/pskillen/codeplug-studio/issues/179)

**Branch:** `154/pskil/zone-selection-and-nesting`

## Status

| Slice                                 | Issue                                                          | Status   | Notes                                                      |
| ------------------------------------- | -------------------------------------------------------------- | -------- | ---------------------------------------------------------- |
| Create zone from selected channels    | [#154](https://github.com/pskillen/codeplug-studio/issues/154) | Complete | `ChannelsListPage` selection + `ZoneEditor` location state |
| Nested zones (denormalised on export) | [#157](https://github.com/pskillen/codeplug-studio/issues/157) | Complete | Schema v6, flatten at assemble/map/export                  |

## Shipped

- `feat(library): create zone from selected channels`
- `feat(core): nested zone members and effective channel resolution`
- `feat(core): studio schema v6 for nested zone members`
- `feat(builds): flatten nested zones at assemble and map boundaries`
- `feat(library): zone member picker supports nested zones`
- `feat(import-export): native YAML nested zone members`
- `docs(library): zone selection and nested zones`

## Next

Open PR; push to `origin/dev` for remote verification.

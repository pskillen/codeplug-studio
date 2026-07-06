# Library zones — progress

**Epic:** [#179 — Channel and Zone Management](https://github.com/pskillen/codeplug-studio/issues/179)

**Branch:** `154/pskil/zone-selection-and-nesting`

## Status

| Slice                                 | Issue                                                          | Status   | Notes                                                      |
| ------------------------------------- | -------------------------------------------------------------- | -------- | ---------------------------------------------------------- |
| Create zone from selected channels    | [#154](https://github.com/pskillen/codeplug-studio/issues/154) | Complete | `ChannelsListPage` selection + `ZoneEditor` location state |
| Nested zones (denormalised on export) | [#157](https://github.com/pskillen/codeplug-studio/issues/157) | Complete | Model v6; export flatten + `omitFromExport` v7             |

## Shipped

- `feat(library): create zone from selected channels`
- `feat(core): nested zone members and effective channel resolution`
- `feat(core): studio schema v6 for nested zone members`
- `feat(builds): flatten nested zones at assemble and map boundaries`
- `feat(library): zone member picker supports nested zones`
- `feat(import-export): native YAML nested zone members`
- `docs(library): zone selection and nested zones`
- `fix(core): flatten nested zones when build has zoneGrouping layout`
- `feat(core): studio schema v7 zone omitFromExport flag`
- `feat(core): omit nested-only zones from assemble export projection`
- `feat(library): omitFromExport toggle on zone editor`
- `test(import-export): nested zone flatten and omitFromExport in CPS export`
- `docs(library): nested zone export and omitFromExport`

## Next

Merge PR [#182](https://github.com/pskillen/codeplug-studio/pull/182); verify on `dev`.

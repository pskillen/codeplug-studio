# Library zones — progress

**Epic:** [#179 — Channel and Zone Management](https://github.com/pskillen/codeplug-studio/issues/179)

**Branch:** `181/pskil/zone-from-location`

## Status

| Slice                                 | Issue                                                          | Status   | Notes                                                      |
| ------------------------------------- | -------------------------------------------------------------- | -------- | ---------------------------------------------------------- |
| Create zone from selected channels    | [#154](https://github.com/pskillen/codeplug-studio/issues/154) | Complete | `ChannelsListPage` selection + `ZoneEditor` location state |
| Nested zones (denormalised on export) | [#157](https://github.com/pskillen/codeplug-studio/issues/157) | Complete | Model v6; export flatten + `omitFromExport` v7             |
| Zone from location (proximity)        | [#181](https://github.com/pskillen/codeplug-studio/issues/181) | Complete | `/library/zones/new-from-location`; map emphasis modes     |

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
- `feat(core): proximity zone channel selection helper`
- `feat(map): proximity overlays and zone hull emphasis modes`
- `feat(library): zone-from-location page and nav entry`
- `feat(library): emphasise editing zone on zone editor map`
- `docs(library): zone from location workflow`

## Next

Open PR for [#181](https://github.com/pskillen/codeplug-studio/issues/181); verify on `dev`.

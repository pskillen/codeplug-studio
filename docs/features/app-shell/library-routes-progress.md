# Library routes parity — progress

**Tracking:** [#20](https://github.com/pskillen/codeplug-studio/issues/20), [#24](https://github.com/pskillen/codeplug-studio/issues/24), [#25](https://github.com/pskillen/codeplug-studio/issues/25)  
**Branch:** `20/pskillen/library-routes-parity`  
**PR:** [#41](https://github.com/pskillen/codeplug-studio/pull/41)

## Completed

| Slice | Commit                                                                | Summary                                                        |
| ----- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | `chore(app-shell): rename visible title to MM9PDY Codeplug Studio`    | Tab + header branding                                          |
| 2     | `refactor(app-shell): library nav catalog and entity list primitives` | `nav.ts`, card `LibraryEntityList`, per-route section nav      |
| 3     | `feat(ui): port DataTable and channel list filter infrastructure`     | DataTable, list prefs, channel filter hooks, operator position |
| 4     | `feat(library): add per-entity list routes with channels DataTable`   | List pages + map on channels/zones                             |
| 5     | `feat(channels): wire section nav filters to channels list`           | Band/mode/search/distance filters in section nav               |
| 6     | `feat(zones): two-list member picker with ordered membership`         | `ZoneMemberPicker`, Mantine `ZoneEditor`                       |
| 7     | `refactor(library): remove monolithic library scroll page`            | Deleted `LibraryPage`, editor back links                       |
| 8     | `docs(library): document routes, channels table, and zone picker`     | app-shell, library, map READMEs + outstanding log              |
| 9     | `refactor(app-shell): put library section links above nav controls`   | `LibrarySectionNavFrame`                                       |
| 10    | `feat(library): migrate entity list pages to DataTable`               | All entity lists on DataTable; removed `LibraryEntityList`     |

## Docs

- [data-table.md](data-table.md) — DataTable, list prefs hooks, reference-count helpers
- [library/zone-member-picker.md](../library/zone-member-picker.md) — zone membership picker
- Hub updates: [README.md](README.md), [library/README.md](../library/README.md), [map/README.md](../map/README.md)

## Test plan (manual)

- [ ] `/library` → `/library/channels`
- [ ] Section nav: Channels → Zones → Talk groups → Contacts → RX group lists; New buttons per area
- [ ] Channels DataTable: sort, filter, column prefs survive reload
- [ ] Zones / talk groups / contacts / RX lists: name filter + column sort survive reload
- [ ] Contacts: digital (`dq`) and analog (`aq`) filters independent
- [ ] Zone editor: ordered members preserved on save
- [ ] Map on channels/zones list routes

## Next

- Merge PR #41; close #20, #24, #25 when accepted
- Follow-ups: [#28](https://github.com/pskillen/codeplug-studio/issues/28), [#29](https://github.com/pskillen/codeplug-studio/issues/29) — channel location in editor

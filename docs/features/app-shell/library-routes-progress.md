# Library routes parity — progress

**Tracking:** [#20](https://github.com/pskillen/codeplug-studio/issues/20), [#24](https://github.com/pskillen/codeplug-studio/issues/24), [#25](https://github.com/pskillen/codeplug-studio/issues/25)  
**Branch:** `20/pskillen/library-routes-parity`

## Completed

| Slice | Commit                                                                | Summary                                                        |
| ----- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | `chore(app-shell): rename visible title to MM9PDY Codeplug Studio`    | Tab + header branding                                          |
| 2     | `refactor(app-shell): library nav catalog and entity list primitives` | `nav.ts`, `LibraryEntityList`, per-route section nav registry  |
| 3     | `feat(ui): port DataTable and channel list filter infrastructure`     | DataTable, list prefs, channel filter hooks, operator position |
| 4     | `feat(library): add per-entity list routes with channels DataTable`   | List pages + map on channels/zones                             |
| 5     | `feat(channels): wire section nav filters to channels list`           | Band/mode/search/distance filters in section nav               |
| 6     | `feat(zones): two-list member picker with ordered membership`         | `ZoneMemberPicker`, Mantine `ZoneEditor`                       |
| 7     | `refactor(library): remove monolithic library scroll page`            | Deleted `LibraryPage`, editor back links                       |

## Docs

- Slice 8 docs commit (this initiative) — app-shell, library, map READMEs + outstanding log

## Test plan (manual)

- [ ] `/library` → `/library/channels`
- [ ] Section nav: Channels → Zones → Talk groups → Contacts → RX group lists; New buttons per area
- [ ] Channels DataTable: sort, filter, column prefs survive reload
- [ ] Zone editor: ordered members preserved on save
- [ ] Map on channels/zones list routes

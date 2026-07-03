# Baofeng DM32 CSV export — progress

**Epic:** [#37](https://github.com/pskillen/codeplug-studio/issues/37) (Phase 5 — DM32 CSV **export**)  
**Import epic:** [#112](https://github.com/pskillen/codeplug-studio/issues/112) (Phase 5b)  
**Hub:** [dm32/README.md](dm32/README.md)  
**Tier-3 wire reference:** [docs/reference/dm32/](../../reference/dm32/README.md)  
**Archive reference:** [codeplug-tool#67](https://github.com/pskillen/codeplug-tool/issues/67)

---

## Overall status

**Status:** In progress — export adapter + zone-derived scan shipped 2026-07-03

| Phase                            | Issue                                                          | Status   | Notes                                      |
| -------------------------------- | -------------------------------------------------------------- | -------- | ------------------------------------------ |
| TG abbrev + multi-TG wire core   | [#110](https://github.com/pskillen/codeplug-studio/issues/110) | Complete | Shipped                                    |
| Zone export trait refactor       | [#104](https://github.com/pskillen/codeplug-studio/issues/104) | Complete | PR `104/pskil/dm32-foundation`             |
| Feature hub README               | [#113](https://github.com/pskillen/codeplug-studio/issues/113) | Complete | [dm32/README.md](dm32/README.md)           |
| Profiles + columns + fixtures    | [#114](https://github.com/pskillen/codeplug-studio/issues/114) | Complete | `formats/dm32/`, `test-data/baofeng-dm32/` |
| Export adapter                   | [#115](https://github.com/pskillen/codeplug-studio/issues/115) | Complete | `115/pskil/dm32-export`                    |
| Zone-derived scan lists          | [#129](https://github.com/pskillen/codeplug-studio/issues/129) | Complete | Schema v5, `zoneDerivedScanLists/`         |
| Zone export trait UI             | [#121](https://github.com/pskillen/codeplug-studio/issues/121) | Complete | Build zones page controls                  |
| Export UI + wire preview fan-out | [#119](https://github.com/pskillen/codeplug-studio/issues/119) | Open     | Export panel + channel fan-out preview     |
| Directional export tests         | [#122](https://github.com/pskillen/codeplug-studio/issues/122) | Open     | Next                                       |
| Export epic closeout docs        | [#123](https://github.com/pskillen/codeplug-studio/issues/123) | Open     | After #122                                 |

**Import (Phase 5b — [#112](https://github.com/pskillen/codeplug-studio/issues/112)):** [#124](https://github.com/pskillen/codeplug-studio/issues/124)–[#128](https://github.com/pskillen/codeplug-studio/issues/128) — unblocked on export scaffold.

---

## Slice — Export foundation ([#104](https://github.com/pskillen/codeplug-studio/issues/104), [#114](https://github.com/pskillen/codeplug-studio/issues/114), [#113](https://github.com/pskillen/codeplug-studio/issues/113))

**Status:** Complete  
**Branch:** `104/pskil/dm32-foundation`

**Delivered**

- `src/core/import-export/formats/dm32/` — profiles, columns, csvWrite, packageZip; profile ladder tests
- `getFormatProfiles('dm32')`; trait profile id `dm32-baofeng-dm32uv`
- `test-data/baofeng-dm32/v1.60/` fixtures (six in-scope CSVs)
- Zone export flags on `ZoneGroupingLayout`; removed from library `Zone`; schema v4 + migration
- [dm32/README.md](dm32/README.md) hub + cross-doc updates

---

## Slice — Talk group abbreviation ([#110](https://github.com/pskillen/codeplug-studio/issues/110))

**Status:** Complete

**Not wired yet** (tracked in [#119](https://github.com/pskillen/codeplug-studio/issues/119))

- `showMultiTalkGroupOptions` on export panel — [#119](https://github.com/pskillen/codeplug-studio/issues/119)

---

## Slice — Zone export trait UI ([#121](https://github.com/pskillen/codeplug-studio/issues/121))

**Status:** Complete  
**Branch:** `115/pskil/dm32-export`

**Delivered**

- `BuildZoneExportControls` on `/builds/:id/zones` for DM32 builds
- Per-zone `exportScratchChannel`, `exportScanList`, scan carrier MHz on `ZoneGroupingLayout`
- Per-member `includeInScanList` on library zone membership
- [zone-grouping.md](../builds/zone-grouping.md) operator workflow

---

## Next

1. [#119](https://github.com/pskillen/codeplug-studio/issues/119) — export panel + wire preview fan-out
2. [#122](https://github.com/pskillen/codeplug-studio/issues/122) → [#123](https://github.com/pskillen/codeplug-studio/issues/123)

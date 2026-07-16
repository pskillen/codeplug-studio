# Library scan lists

Deep dive for the vendor-neutral **`ScanList`** entity — ordered channel membership curated once in the library and projected into CPS `ScanList.CSV` on dedicated-scan-list builds (Anytone today).

**Tracking:** [#257](https://github.com/pskillen/codeplug-studio/issues/257)

## Purpose

Scan list **definitions** (name + member channels) live in the library like zones and RX group lists. **Per-build** wire names, exclusion, and per-channel `Scan List` FK assignment stay on `FormatBuild` overrides — not in the library entity.

DM32 zone-derived `Scan.csv` synthesis is unchanged — it uses `ScanLists` + `zoneDerivedScanLists/`, not library scan lists.

## Entity

| Field               | Type       | Notes                                      |
| ------------------- | ---------- | ------------------------------------------ |
| _(persistable row)_ |            | `id`, `projectId`, `revision`, `updatedAt` |
| `name`              | string     | Display / default wire label               |
| `memberChannelIds`  | `string[]` | Ordered UUID FKs to library `Channel` rows |

Relationships use UUID `id` fields only — never wire names as internal FKs.

## Library vs build

| Concern                          | Layer   | Field / UI                                                                    |
| -------------------------------- | ------- | ----------------------------------------------------------------------------- |
| List membership (`ScanList.CSV`) | Library | `ScanList.memberChannelIds` — `/library/scan-lists` editor                    |
| Wire name / omit from export     | Build   | `scanListOverrides` — Scan lists wire preview page                            |
| Channel → scan list FK           | Library | `Channel.scanListId` — channel editor **Scanning** tab + channels list column |
| Default scan inclusion           | Library | `Channel.scanInclusion` on **Scanning** tab                                   |
| Wire name / omit from export     | Build   | `scanListOverrides` — Scan lists wire preview page                            |

`assemble` reads `library.scanLists`, applies `scanListOverrides`, filters members to the exported channel set, and resolves channel `scanListWireName` from `Channel.scanListId`.

## Code anchors

| Symbol                           | Path                                                         | Role                                 |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------ |
| `ScanList`                       | `src/core/models/library.ts`                                 | Entity type                          |
| `newScanList`                    | `src/core/domain/factories.ts`                               | Factory                              |
| `assembleScanLists`              | `src/core/services/assemble.ts`                              | Library → export projection          |
| `migrateBuildScanListsToLibrary` | `src/core/domain/migrateScanLists.ts`                        | Hoist legacy `ScanListsLayout`       |
| `ScanListsListPage`              | `src/app/routes/library/ScanListsListPage.tsx`               | List route                           |
| `ScanListEditor`                 | `src/app/routes/library/ScanListEditor.tsx`                  | Name + members                       |
| `ScanListMemberEditor`           | `src/app/components/library/ScanListMemberEditor.tsx`        | Channel member picker                |
| `BuildScanListLibraryGuidance`   | `src/app/components/builds/BuildScanListLibraryGuidance.tsx` | Build scan lists page → library link |
| `ScanListSummary`                | `src/app/components/library/ScanListSummary.tsx`             | Channel editor scan list preview     |

## Migration

Projects with build-scoped `ScanListsLayout` sections hoist entries into `library.scanLists` on load (`migrateProjectAggregate`), preserving entry `id` so existing `scanListOverrides` stay valid. Legacy `channelOverrides.scanListId` hoists to `Channel.scanListId` (schema v11).

## Manual verify

1. `/library/scan-lists` → create list, add channels, reorder — save and reopen; order matches.
2. Channel editor **Scanning** tab — set scan inclusion + scan list; list page optional **Scan list** column.
3. Anytone build → export ZIP — `Channel.CSV` `Scan List` and `ScanList.CSV` align.
4. Export page — no **Default scan behaviour** segment; dedicated-scan copy instead ([#258](https://github.com/pskillen/codeplug-studio/issues/258)).

## Scan resume and hang-time concepts

Library scan lists today model **membership and naming** only. CPS formats may also expose scan **resume mode** (time-operated, carrier-operated, search/stop) and **hang-time / priority sample** intervals. Those are format-specific wire columns — do not bake vendor labels into the library entity. For Anytone AT-D890UV terminology and contested Dropout vs Dwell semantics, see the tier-3 [scan-lists translation map](../../reference/anytone/scan-lists.md).

## Related

- [library/README.md](README.md) · [rx-group-list-member-picker.md](rx-group-list-member-picker.md)
- [Anytone hub](../import-export/anytone/README.md) · [tier-3 scan lists](../../reference/anytone/scan-lists.md)
- [native-yaml `library.scanLists`](../../reference/native-yaml/README.md)

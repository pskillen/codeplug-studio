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

| Concern                          | Layer   | Field / UI                                                                              |
| -------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| List membership (`ScanList.CSV`) | Library | `ScanList.memberChannelIds` — `/library/scan-lists` editor                              |
| Wire name / omit from export     | Build   | `scanListOverrides` — Scan lists wire preview page                                      |
| Channel → scan list FK           | Build   | `channelOverrides.scanListId` — Channels wire preview (dedicated builds)                |
| Default scan inclusion           | Build   | `exportSettings.defaultScanInclusion` — **not** shown for `DedicatedScanLists` profiles |

`assemble` reads `library.scanLists`, applies `scanListOverrides`, filters members to the exported channel set, and resolves channel `scanListWireName` from `channelOverrides.scanListId`.

## Code anchors

| Symbol                           | Path                                                         | Role                           |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------ |
| `ScanList`                       | `src/core/models/library.ts`                                 | Entity type                    |
| `newScanList`                    | `src/core/domain/factories.ts`                               | Factory                        |
| `assembleScanLists`              | `src/core/services/assemble.ts`                              | Library → export projection    |
| `migrateBuildScanListsToLibrary` | `src/core/domain/migrateScanLists.ts`                        | Hoist legacy `ScanListsLayout` |
| `ScanListsListPage`              | `src/app/routes/library/ScanListsListPage.tsx`               | List route                     |
| `ScanListEditor`                 | `src/app/routes/library/ScanListEditor.tsx`                  | Name + members                 |
| `ScanListMemberEditor`           | `src/app/components/library/ScanListMemberEditor.tsx`        | Channel member picker          |
| `BuildScanListLibraryGuidance`   | `src/app/components/builds/BuildScanListLibraryGuidance.tsx` | Build scan lists page → library link |
| `WirePreviewTable` scan column   | `src/app/components/builds/WirePreviewTable.tsx`             | Channels build — hideable Scan list column |

## Migration

Projects with build-scoped `ScanListsLayout` sections hoist entries into `library.scanLists` on load (`migrateProjectAggregate`), preserving entry `id` so existing `scanListOverrides` and `channelOverrides.scanListId` remain valid. Legacy layout sections are stripped after hoist; native YAML v9 files without `library.scanLists` import and migrate the same way.

## Manual verify

1. `/library/scan-lists` → create list, add channels, reorder — save and reopen; order matches.
2. Anytone build → Channels page — assign scan list per row in the wire preview table (toggle **Show scan list column** to hide).
3. Export ZIP — `Channel.CSV` `Scan List` and `ScanList.CSV` align.
4. Export page — no **Default scan behaviour** segment; dedicated-scan copy instead ([#258](https://github.com/pskillen/codeplug-studio/issues/258)).

## Related

- [library/README.md](README.md) · [rx-group-list-member-picker.md](rx-group-list-member-picker.md)
- [Anytone hub](../import-export/anytone/README.md) · [tier-3 scan lists](../../reference/anytone/scan-lists.md)
- [native-yaml `library.scanLists`](../../reference/native-yaml/README.md)

# Anytone CPS CSV — progress

**Epic:** [#228](https://github.com/pskillen/codeplug-studio/issues/228) (Phase 7 — Anytone CPS **export**)  
**Import epic:** [#229](https://github.com/pskillen/codeplug-studio/issues/229) (Phase 7b)  
**Hub:** [anytone/README.md](anytone/README.md)  
**Tier-3 wire reference:** [docs/reference/anytone/](../../reference/anytone/README.md)

---

## Overall status

**Status:** Phase 7 export **shipped** ([#228](https://github.com/pskillen/codeplug-studio/issues/228)) — DMR MVP on `anytone-at-d890uv`  
**In progress:** m×n channel expansion + scratch channels ([#305](https://github.com/pskillen/codeplug-studio/issues/305), [#325](https://github.com/pskillen/codeplug-studio/issues/325))  
**Branch:** `305/pskil/anytone-mxn-scratch`

| Phase                       | Issue                                                                                                                          | Status   | Notes                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------ |
| Wire spike + fixtures       | [#230](https://github.com/pskillen/codeplug-studio/issues/230)                                                                 | Complete | DMR + extended wire docs + test-data                   |
| Feature hub README          | [#231](https://github.com/pskillen/codeplug-studio/issues/231)                                                                 | Complete | Tier-1 hub + index rows                                |
| Profile, columns, registry  | [#232](https://github.com/pskillen/codeplug-studio/issues/232)                                                                 | Complete | Scaffold on export branch                              |
| Export adapter              | [#233](https://github.com/pskillen/codeplug-studio/issues/233)                                                                 | Complete | DMR MVP serialisers + ZIP                              |
| Build editor + wire preview | [#234](https://github.com/pskillen/codeplug-studio/issues/234)                                                                 | Complete | Scan lists route + channel assignment                  |
| Format catalog CPS export   | [#235](https://github.com/pskillen/codeplug-studio/issues/235)                                                                 | Complete | Catalog `exportStatus: shipped`                        |
| Directional export tests    | [#236](https://github.com/pskillen/codeplug-studio/issues/236)                                                                 | Complete | `exportGolden.test.ts`                                 |
| Export epic reconciliation  | [#237](https://github.com/pskillen/codeplug-studio/issues/237)                                                                 | Complete | Docs + adding-a-new-format example                     |
| Library scan lists + UI     | [#257](https://github.com/pskillen/codeplug-studio/issues/257), [#258](https://github.com/pskillen/codeplug-studio/issues/258) | Complete | `DedicatedScanLists` trait; library CRUD; export panel |

---

## Wave 1 — library scan lists ([#257](https://github.com/pskillen/codeplug-studio/issues/257), [#258](https://github.com/pskillen/codeplug-studio/issues/258))

**Status:** Complete

| Slice                      | Status   | Notes                                          |
| -------------------------- | -------- | ---------------------------------------------- |
| `DedicatedScanLists` trait | Complete | Split from DM32 `ScanLists`; build nav gating  |
| Library `ScanList` entity  | Complete | Schema v10; persistence; assemble from library |
| Layout migration           | Complete | Hoist `ScanListsLayout` → `library.scanLists`  |
| Library CRUD routes        | Complete | `/library/scan-lists` list + editor            |
| Build UI + export polish   | Complete | Library guidance; hide default scan inclusion  |

**Branch:** `257/pskil/library-scan-lists-anytone-ui`

---

## Wave 0 — wire spike + hub

**Status:** Complete

| Slice                    | Status   | Notes                                               |
| ------------------------ | -------- | --------------------------------------------------- |
| Progress pair kickoff    | Complete | `anytone-progress.md`, `anytone-outstanding.md`     |
| DMR core wire + fixtures | Complete | `test-data/anytone/at-d890uv/`, DMR tier-3 docs     |
| Extended feature wire    | Complete | AMAir, FM, APRS, NXDN tier-3 + fixtures             |
| Feature hub + index      | Complete | `anytone/README.md`, features + import-export index |

**Deliverables:**

- Tier-3: `docs/reference/anytone/` (DMR core + am-air, fm-broadcast, aprs, nxdn)
- Fixtures: `test-data/anytone/at-d890uv/` (redacted)
- Tier-1: `docs/features/import-export/anytone/README.md`

**Next:** [#232](https://github.com/pskillen/codeplug-studio/issues/232) — profile, columns scaffold, registry.

---

## Wave 2 — cross-file wire name fidelity ([#292](https://github.com/pskillen/codeplug-studio/issues/292))

**Status:** Complete

| Slice                         | Status   | Notes                                                                      |
| ----------------------------- | -------- | -------------------------------------------------------------------------- |
| Export wire context           | Complete | `exportWireContext.ts` — one canonical name per entity per export pass     |
| Serialiser FK alignment       | Complete | Channels, zones, scan lists, TGs, RGLs, AMAir/FM receive banks             |
| Wire preview + export UI copy | Complete | List previews shortened; uses shared **Shorten long names** export setting |
| Directional tests             | Complete | `exportWireContext.test.ts` cross-file name equality                       |

---

## Wave 3 — m×n expansion + scratch ([#305](https://github.com/pskillen/codeplug-studio/issues/305), [#325](https://github.com/pskillen/codeplug-studio/issues/325))

**Status:** Complete

| Slice                         | Status   | Notes                                                  |
| ----------------------------- | -------- | ------------------------------------------------------ |
| Export settings + defaults    | Complete | `expandRxGroupLists`, `exportScratchChannels`          |
| Channel expansion core        | Complete | `anytone/channelExpansion.ts` + timeslot projection    |
| Serialise + zone/scan fan-out | Complete | Wire context, directional tests                        |
| Export UI + wire preview      | Complete | Toggles default on; displayDetails                     |
| Operator projection docs      | Complete | [export-projections.md](anytone/export-projections.md) |

---

## Wave 8 — APRS analog slot bindings ([#359](https://github.com/pskillen/codeplug-studio/issues/359))

**Status:** Complete

| Slice                        | Status   | Notes                                                             |
| ---------------------------- | -------- | ----------------------------------------------------------------- |
| Shared bank slot numbering   | Complete | `exportChannelSlots.ts` — DMR + receive banks                     |
| Multi-bank `APRS.CSV` export | Complete | `buildAnytoneExportChannelSlotById` + export warnings             |
| Directional tests            | Complete | `exportAprsWire.test.ts`, AM air golden in `exportGolden.test.ts` |
| Slot picker UX               | Complete | Grouped channel select by export bank                             |
| Docs                         | Complete | Tier-1 APRS + tier-3 `aprs.md`                                    |

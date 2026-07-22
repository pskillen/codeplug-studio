# Anytone CPS CSV — import / export

Product behaviour for Anytone CPS CSV in Codeplug Studio. Wire column tables live in the tier-3 [Anytone reference](../../../reference/export-formats/anytone/README.md).

Per-radio map: [anytone profiles.md](../../../reference/export-formats/anytone/profiles.md) → [`docs/reference/radios/`](../../../reference/radios/).

**Tracking:** Epic [#505](https://github.com/pskillen/codeplug-studio/issues/505) (import + export; supersedes M1 [#228](https://github.com/pskillen/codeplug-studio/issues/228) / [#229](https://github.com/pskillen/codeplug-studio/issues/229)) · Library scan lists [#257](https://github.com/pskillen/codeplug-studio/issues/257) · Export UI [#258](https://github.com/pskillen/codeplug-studio/issues/258)

**Source:** `src/core/import-export/formats/anytone/`

**Outstanding:** [anytone-outstanding.md](../anytone-outstanding.md)  
**CSV reconciliation ([#297](https://github.com/pskillen/codeplug-studio/issues/297)):** [gaps](csv-reconciliation-gaps.md) · [outstanding](csv-reconciliation-outstanding.md)

## Implementation status

| Area                                  | Status  | Notes                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire reference + fixtures (AT-D890UV) | Shipped | [#230](https://github.com/pskillen/codeplug-studio/issues/230) — tier-3 docs + `test-data/anytone/at-d890uv/`                                                                                                                                                                            |
| Extended wire (AM/FM/APRS/NXDN)       | Shipped | Wire documented; export deferred — see model gaps below                                                                                                                                                                                                                                  |
| Radio variant profile (`at-d890uv`)   | Shipped | [#232](https://github.com/pskillen/codeplug-studio/issues/232) — `profiles.ts`, trait registration                                                                                                                                                                                       |
| Export adapter (DMR MVP)              | Shipped | [#233](https://github.com/pskillen/codeplug-studio/issues/233)                                                                                                                                                                                                                           |
| Build editor + wire preview           | Shipped | [#234](https://github.com/pskillen/codeplug-studio/issues/234)                                                                                                                                                                                                                           |
| Format catalog CPS export             | Shipped | [#235](https://github.com/pskillen/codeplug-studio/issues/235) · conditional AM/FM files in Export UI [#288](https://github.com/pskillen/codeplug-studio/issues/288)                                                                                                                     |
| CPS `.LST` manifest (export)          | Shipped | [#289](https://github.com/pskillen/codeplug-studio/issues/289) — Approach A: lists ZIP CSV members only; stem from project name                                                                                                                                                          |
| Directional export tests              | Shipped | [#236](https://github.com/pskillen/codeplug-studio/issues/236) · `APRS.CSV` + channel APRS columns ([#251](https://github.com/pskillen/codeplug-studio/issues/251)); analog slot `channelN` ([#359](https://github.com/pskillen/codeplug-studio/issues/359))                             |
| Cross-file wire name fidelity         | Shipped | [#292](https://github.com/pskillen/codeplug-studio/issues/292) — shared export wire context; preview + `shortenNames` on all CPS name FKs; zone-derived scan carrier names aligned across `DMRZone.CSV` + `Channel.CSV` ([#370](https://github.com/pskillen/codeplug-studio/issues/370)) |
| Library scan lists + dedicated trait  | Shipped | [#257](https://github.com/pskillen/codeplug-studio/issues/257), [#258](https://github.com/pskillen/codeplug-studio/issues/258)                                                                                                                                                           |
| Zone-derived scan lists (opt-in)      | Shipped | [#318](https://github.com/pskillen/codeplug-studio/issues/318) — merge with library `ScanList.CSV`; neutral carrier channel; master toggle default off                                                                                                                                   |
| Channel Type + DMR MODE export        | Shipped | [#303](https://github.com/pskillen/codeplug-studio/issues/303), [#311](https://github.com/pskillen/codeplug-studio/issues/311) — `primaryMode`, `dmrMode` from library                                                                                                                   |
| Busy Lock / TX Permit export          | Partial | [#396](https://github.com/pskillen/codeplug-studio/issues/396) — fixed `ChannelFree` / `Channel Free` by TX mode; library field deferred ([#388](https://github.com/pskillen/codeplug-studio/issues/388))                                                                                |
| AM air zone export (`AMZone.CSV`)     | Shipped | [#316](https://github.com/pskillen/codeplug-studio/issues/316) — partition from build zones; Airband build wire preview                                                                                                                                                                  |
| Omit `RadioIDList.CSV` export         | Shipped | [#302](https://github.com/pskillen/codeplug-studio/issues/302) — until radio IDs modelled; avoids CPS clobber                                                                                                                                                                            |
| m×n channel expansion + scratch       | Shipped | [#305](https://github.com/pskillen/codeplug-studio/issues/305), [#325](https://github.com/pskillen/codeplug-studio/issues/325) — opt-in projection; see [export-projections.md](export-projections.md)                                                                                   |
| Wire gap analysis (docs + tickets)    | Shipped | [#357](https://github.com/pskillen/codeplug-studio/issues/357) — tier-3 enum checklist updated; VFO rows not required (CPS adds on import); adapter code deferred to child tickets under [#228](https://github.com/pskillen/codeplug-studio/issues/228)                                  |
| CPS import                            | Planned | [#229](https://github.com/pskillen/codeplug-studio/issues/229) (Phase 7b)                                                                                                                                                                                                                |

## Format identity

| Layer                 | Id                  | Label       |
| --------------------- | ------------------- | ----------- |
| Format (`formatId`)   | `anytone`           | Anytone CPS |
| Variant (`profileId`) | `anytone-at-d890uv` | AT-D890UV   |

Sibling variants (AT-D878UV, AT-D578UV, …) are out of scope for v1.

## Trait profile vs radio profile

| Concept           | Where (planned)                                     | Purpose                                                      |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| **Trait profile** | `TRAIT_PROFILES` in `src/core/models/traits.ts`     | Build capability traits: zone grouping, scan lists, …        |
| **Radio profile** | `ANYTONE_PROFILES` in `formats/anytone/profiles.ts` | Wire limits at CPS boundary: caps, power ladder, name length |

Both share profile id **`anytone-at-d890uv`**.

### Recommended traits (wire spike [#230](https://github.com/pskillen/codeplug-studio/issues/230))

| Trait                      | Include? | Evidence                                                                                                                                 |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `zoneGrouping`             | Yes      | `DMRZone.CSV`                                                                                                                            |
| `dedicatedScanLists`       | Yes      | Library `ScanList` + `ScanList.CSV`                                                                                                      |
| `scanLists`                | No       | DM32 zone-derived scan — different trait                                                                                                 |
| `zoneAsScanList`           | No       | Scan lists are first-class files                                                                                                         |
| `multiTalkGroupPerChannel` | No       | OpenGD77-style native RGL selection on channel — not AT-D890UV workflow                                                                  |
| `mxnChannelExpansion`      | Yes      | Optional export projection — lean row + native RGL still valid when off ([#305](https://github.com/pskillen/codeplug-studio/issues/305)) |

Extended banks (AM air, broadcast FM, NXDN, APRS) need export projection or future traits — see [model gaps](#model-gaps).

## Model gaps

Wire spike mapped CPS files to internal types. Full inventory: [tier-3 README — file inventory](../../../reference/export-formats/anytone/README.md).

| Area        | Maps today? | Blocker / note                                                                                                                                                                                                                                              |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DMR core    | Yes         | `Channel`, `TalkGroup`, `RxGroupList`, library `ScanList`, build overrides                                                                                                                                                                                  |
| Radio IDs   | **No**      | `RadioIDList.CSV` omitted from export ([#302](https://github.com/pskillen/codeplug-studio/issues/302)) — [radio-ids.md](../../../reference/export-formats/anytone/radio-ids.md)                                                                             |
| AM air / FM | Partial     | `AMAir`/`FM` channel banks shipped; `AMZone.CSV` export shipped ([#316](https://github.com/pskillen/codeplug-studio/issues/316))                                                                                                                            |
| NXDN        | Partial     | `ChannelModeProfileNxdn`, NX parallel files; multi-protocol build TBD                                                                                                                                                                                       |
| APRS        | **Yes**     | `AprsConfiguration` + `Channel.aprs` — [aprs.md](../../../reference/export-formats/anytone/aprs.md) ([#251](https://github.com/pskillen/codeplug-studio/issues/251)); analog slot bindings ([#359](https://github.com/pskillen/codeplug-studio/issues/359)) |

Library CRUD does **not** enforce radio caps. Export adapters warn or truncate at the wire boundary only.

## Operator lifecycle

Create an `anytone-at-d890uv` build, curate library zones and **scan lists** (`/library/scan-lists`), assign per-channel scan lists on the build **Channels** page, optionally enable **zone-derived scan lists** per zone on **Zones** + Export toggle ([#318](https://github.com/pskillen/codeplug-studio/issues/318)), optionally enable **m×n channel expansion** and **scratch channels** on Export ([#305](https://github.com/pskillen/codeplug-studio/issues/305), [#325](https://github.com/pskillen/codeplug-studio/issues/325)) — see [export-projections.md](export-projections.md), preview wire rows, and export a CPS CSV ZIP from the build Export page — no DM32-style **Default scan behaviour** control ([#258](https://github.com/pskillen/codeplug-studio/issues/258)). Exported CSV files use **Windows (CRLF) line endings** for AT-D890UV CPS import ([#291](https://github.com/pskillen/codeplug-studio/issues/291)). Cross-file name consistency on export ([#292](https://github.com/pskillen/codeplug-studio/issues/292)). See [operator lifecycle](../workflows/operator-lifecycle.md) and [library scan lists](../../library/scan-lists.md).

## Related

- [export-projections.md](export-projections.md) — m×n expansion, scratch, zones, scan lists
- [import-export hub](../README.md)
- [builds hub](../../builds/README.md)
- [data-model](../../data-model/README.md)
- [adding-a-new-format.md](../adding-a-new-format.md)
- [csv-reconciliation-gaps.md](csv-reconciliation-gaps.md) — CPS vs Studio wire audit ([#297](https://github.com/pskillen/codeplug-studio/issues/297))
- [cps-services.md](../cps-services.md)

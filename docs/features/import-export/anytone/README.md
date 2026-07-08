# Anytone CPS CSV — import / export

Product behaviour for Anytone CPS CSV in Codeplug Studio. Wire column tables live in the tier-3 [Anytone reference](../../../reference/anytone/README.md).

**Tracking:** Phase 7 export [#228](https://github.com/pskillen/codeplug-studio/issues/228) · Library scan lists [#257](https://github.com/pskillen/codeplug-studio/issues/257) · Export UI [#258](https://github.com/pskillen/codeplug-studio/issues/258) · Import [#229](https://github.com/pskillen/codeplug-studio/issues/229)

**Source:** `src/core/import-export/formats/anytone/`

**Progress:** [anytone-progress.md](../anytone-progress.md) · **Outstanding:** [anytone-outstanding.md](../anytone-outstanding.md)

## Implementation status

| Area                                  | Status  | Notes                                                                                                                          |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Wire reference + fixtures (AT-D890UV) | Shipped | [#230](https://github.com/pskillen/codeplug-studio/issues/230) — tier-3 docs + `test-data/anytone/at-d890uv/`                  |
| Extended wire (AM/FM/APRS/NXDN)       | Shipped | Wire documented; export deferred — see model gaps below                                                                        |
| Radio variant profile (`at-d890uv`)   | Shipped | [#232](https://github.com/pskillen/codeplug-studio/issues/232) — `profiles.ts`, trait registration                             |
| Export adapter (DMR MVP)              | Shipped | [#233](https://github.com/pskillen/codeplug-studio/issues/233)                                                                 |
| Build editor + wire preview           | Shipped | [#234](https://github.com/pskillen/codeplug-studio/issues/234)                                                                 |
| Format catalog CPS export             | Shipped | [#235](https://github.com/pskillen/codeplug-studio/issues/235)                                                                 |
| Directional export tests              | Shipped | [#236](https://github.com/pskillen/codeplug-studio/issues/236)                                                                 |
| Library scan lists + dedicated trait  | Shipped | [#257](https://github.com/pskillen/codeplug-studio/issues/257), [#258](https://github.com/pskillen/codeplug-studio/issues/258) |
| CPS import                            | Planned | [#229](https://github.com/pskillen/codeplug-studio/issues/229) (Phase 7b)                                                      |

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

| Trait                      | Include? | Evidence                                 |
| -------------------------- | -------- | ---------------------------------------- |
| `zoneGrouping`             | Yes      | `DMRZone.CSV`                            |
| `dedicatedScanLists`       | Yes      | Library `ScanList` + `ScanList.CSV`      |
| `scanLists`                | No       | DM32 zone-derived scan — different trait |
| `zoneAsScanList`           | No       | Scan lists are first-class files         |
| `multiTalkGroupPerChannel` | No       | Native `DMRReceiveGroupCallList.CSV`     |
| `mxnChannelExpansion`      | No       | Single TG + RGL per channel row          |

Extended banks (AM air, broadcast FM, NXDN, APRS) need export projection or future traits — see [model gaps](#model-gaps).

## Model gaps

Wire spike mapped CPS files to internal types. Full inventory: [tier-3 README — file inventory](../../../reference/anytone/README.md).

| Area        | Maps today? | Blocker / note                                                                 |
| ----------- | ----------- | ------------------------------------------------------------------------------ |
| DMR core    | Yes         | `Channel`, `TalkGroup`, `RxGroupList`, library `ScanList`, build overrides     |
| AM air / FM | Partial     | Existing `Channel` + `am`/`fm` modes; separate CPS banks — export deferred     |
| NXDN        | Partial     | `ChannelModeProfileNxdn`, NX parallel files; multi-protocol build TBD          |
| APRS        | **No**      | New `AprsConfiguration` entity — [aprs.md](../../../reference/anytone/aprs.md) |

Library CRUD does **not** enforce radio caps. Export adapters warn or truncate at the wire boundary only.

## Operator lifecycle

Create an `anytone-at-d890uv` build, curate library zones and **scan lists** (`/library/scan-lists`), assign per-channel scan lists on the build **Channels** page, preview wire rows, and export a CPS CSV ZIP from the build Export page — no DM32-style **Default scan behaviour** control ([#258](https://github.com/pskillen/codeplug-studio/issues/258)). See [operator lifecycle](../workflows/operator-lifecycle.md) and [library scan lists](../../library/scan-lists.md).

## Related

- [import-export hub](../README.md)
- [builds hub](../../builds/README.md)
- [data-model](../../data-model/README.md)
- [adding-a-new-format.md](../adding-a-new-format.md)
- [cps-services.md](../cps-services.md)

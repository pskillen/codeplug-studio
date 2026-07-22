# CHIRP CSV — import / export

Product behaviour for CHIRP analogue FM/AM CSV in Codeplug Studio. Wire column tables live in the tier-3 [CHIRP reference](../../../reference/chirp/README.md).

**Tracking:** Epic [#504](https://github.com/pskillen/codeplug-studio/issues/504) (import + export; supersedes M1 [#38](https://github.com/pskillen/codeplug-studio/issues/38) / [#214](https://github.com/pskillen/codeplug-studio/issues/214)) · DCS/CrossMode [#527](https://github.com/pskillen/codeplug-studio/issues/527) · import [#222](https://github.com/pskillen/codeplug-studio/issues/222)–[#226](https://github.com/pskillen/codeplug-studio/issues/226)

**Source:** `src/core/import-export/formats/chirp/`

## Implementation status

| Area                                                      | Status  | Notes                                                                                                                                                                                                                                             |
| --------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire reference                                            | Shipped | [reference/chirp/](../../../reference/chirp/README.md)                                                                                                                                                                                            |
| Trait profiles (`chirp-uv5r`, `chirp-rt95`, `chirp-uv21`) | Shipped | `TRAIT_PROFILES` — `FlatMemoryList`, `PerChannelScanFlag`                                                                                                                                                                                         |
| Radio profiles + columns                                  | Shipped | `formats/chirp/profiles.ts`, `columns.ts` — caps from CHIRP drivers ([#598](https://github.com/pskillen/codeplug-studio/issues/598)): UV-5R 999/12, UV-21 1000/12, RT95 200/6                                                                     |
| Enum / column verification                                | Shipped | [enum-verification.md](../../../reference/chirp/enum-verification.md)                                                                                                                                                                             |
| cps-verify (uv5r, uv21, rt95)                             | Shipped | `cps-verify/fixtures/chirp/`                                                                                                                                                                                                                      |
| Flat memory assemble projection                           | Shipped | `exportOrderOrSlot.ts`, `assemble.ts` — `orderOrSlot` on overrides                                                                                                                                                                                |
| Export adapter (single CSV)                               | Shipped | `exportBuildSingleFile` → `serialiseChirpCsv` — **first-class** for `chirp-uv5r`, `chirp-uv21`, and `chirp-rt95` ([#609](https://github.com/pskillen/codeplug-studio/issues/609), [#610](https://github.com/pskillen/codeplug-studio/issues/610)) |
| Channels build UI                                         | Shipped | `/builds/:id/channels` + `/scan-list` — flat memory list, wire names; per-channel scan as **build** overrides ([#589](https://github.com/pskillen/codeplug-studio/issues/589))                                                                    |
| Browser download + export UI                              | Shipped | `ExportBuildCpsPanel` — Download CSV + preview                                                                                                                                                                                                    |
| UV-5R NeonPlug pathway FYI                                | Shipped | [#556](https://github.com/pskillen/codeplug-studio/issues/556) — blue info alert on export for `chirp-uv5r` (optional NeonPlug browser pathway; no New build pill)                                                                                |
| Export golden tests                                       | Shipped | `exportGolden.test.ts` — three profile fixtures                                                                                                                                                                                                   |
| DCS / CrossMode export                                    | Shipped | [#527](https://github.com/pskillen/codeplug-studio/issues/527) — `formatChirpToneColumns` mirrors CHIRP `split_tone_decode`                                                                                                                       |
| CPS import                                                | Planned | Phase 6b [#214](https://github.com/pskillen/codeplug-studio/issues/214)                                                                                                                                                                           |

## Trait profile vs radio profile

Studio uses two related concepts (same `profileId` keys):

| Concept           | Where                                           | Purpose                                                                             |
| ----------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Trait profile** | `TRAIT_PROFILES` in `src/core/models/traits.ts` | Build capability traits — flat memory list, per-channel scan flag. Drives build UI. |
| **Radio profile** | `CHIRP_PROFILES` in `formats/chirp/profiles.ts` | Wire limits at export: `maxMemorySlots`, `nameLimit`, power ladder.                 |

| Profile id   | Label               | Name limit | Memory slots |
| ------------ | ------------------- | ---------- | ------------ |
| `chirp-uv5r` | Baofeng UV-5R Mini  | 12         | 999          |
| `chirp-uv21` | Baofeng UV-21Pro V2 | 12         | 1000         |
| `chirp-rt95` | Retevis RT95 VOX    | 6          | 200          |

Per-radio wire detail: [docs/reference/chirp/radios/](../../../reference/chirp/radios/README.md).

## Operator workflow

1. Curate analogue channels in the **library** (shared across builds).
2. Create a **CHIRP build** for the target radio profile.
3. On **Channels**, review the default-included analogue memory list, reorder, and set wire names. On **Scan list**, set build-wide default scan behaviour and **per-channel scan overrides** (build-scoped — does not change the library channel).
4. **Export** a single profile-correct CSV from `/builds/:id/export` — organisation follows flat memory order on the build layout.

CSV export is **first-class** for all three CHIRP radio profiles (`chirp-uv5r`, `chirp-uv21`, `chirp-rt95`). For **UV-5R Mini** only (`chirp-uv5r`), the export page shows a blue FYI that a [NeonPlug](../neonplug/README.md) build can also write the radio in the browser ([#556](https://github.com/pskillen/codeplug-studio/issues/556)) — without urging you to leave CHIRP CSV. UV-21 and RT95 do not show that hint.

## Export behaviour

- **Include by default** — empty `channelOverrides` includes all analogue FM/AM channels; set `excluded: true` to opt out.
- **Memory order** — `orderOrSlot` on `channelOverrides` (1-based); gaps export as blank CHIRP memory slots.
- **Single CSV** download (not ZIP).
- **Analogue channels only** — digital/DMR channels skipped with warning.
- **`Location`:** 1-based index in flat memory order — not stored in the library.
- **Scan default:** build `exportSettings.defaultScanInclusion` defaults to `skip` (CHIRP convention).
- **Per-channel scan:** `channelOverrides.scanInclusion` when set wins over library `Channel.scanInclusion`, then the build/format default for remaining `default` — see [scan-inclusion.md](../../../reference/scan-inclusion.md).

## Lossy fields

| Field                          | Behaviour                                           |
| ------------------------------ | --------------------------------------------------- |
| `Location`                     | Export-time assignment from build memory order      |
| DMR columns (`URCALL`, …)      | Empty on analogue export                            |
| Mixed-project digital channels | Skipped with warning                                |
| `DTCS-R` / `TSQL-R` tmodes     | Not emitted on export — no reverse-only model field |
| Duplex `+`/`-` with offset 0   | Collapses to simplex in model                       |
| `Comment`                      | Not exported — library field only                   |
| `TStep`                        | Constant `5.00` on export                           |

DCS / CrossMode export is model-driven from `rxTone`/`txTone` (see [channels.md — Tones](../../../reference/chirp/channels.md#tones)).

## Related

- [import-export hub](../README.md)
- [builds hub](../../builds/README.md)
- [data-model](../../data-model/README.md)
- [scan-inclusion](../../../reference/scan-inclusion.md)
- [operator lifecycle](../workflows/operator-lifecycle.md)
- [Browser radio I/O (later)](../browser-radio-io-progress.md) — WebSerial after CSV MVP
- [enum-verification](../../../reference/chirp/enum-verification.md)

# CHIRP CSV — import / export

Product behaviour for CHIRP analogue FM/AM CSV in Codeplug Studio. Wire column tables live in the tier-3 [CHIRP reference](../../../reference/chirp/README.md).

**Tracking:** Phase 6 [#38](https://github.com/pskillen/codeplug-studio/issues/38) · [progress](chirp-progress.md) · [outstanding](chirp-outstanding.md)

**Source:** `src/core/import-export/formats/chirp/`

## Implementation status

| Area                                                      | Status  | Notes                                                                   |
| --------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| Wire reference                                            | Shipped | [reference/chirp/](../../../reference/chirp/README.md)                  |
| Trait profiles (`chirp-uv5r`, `chirp-rt95`, `chirp-uv21`) | Shipped | `TRAIT_PROFILES` — `FlatMemoryList`, `PerChannelScanFlag`               |
| Radio profiles + columns                                  | Shipped | `formats/chirp/profiles.ts`, `columns.ts`                               |
| Flat memory assemble projection                           | Shipped | `exportOrderOrSlot.ts`, `assemble.ts` — `orderOrSlot` on overrides      |
| Export adapter (single CSV)                               | Shipped | `exportBuildSingleFile` → `serialiseChirpCsv`                           |
| Channels build UI                                         | Shipped | `/builds/:id/channels` — flat memory list, wire names, scan tri-state   |
| Browser download + export UI                              | Shipped | `ExportBuildCpsPanel` — Download CSV + preview                          |
| Export golden tests                                       | Shipped | `exportGolden.test.ts` — three profile fixtures                         |
| CPS import                                                | Planned | Phase 6b [#214](https://github.com/pskillen/codeplug-studio/issues/214) |

## Trait profile vs radio profile

Studio uses two related concepts (same `profileId` keys):

| Concept           | Where                                           | Purpose                                                                             |
| ----------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Trait profile** | `TRAIT_PROFILES` in `src/core/models/traits.ts` | Build capability traits — flat memory list, per-channel scan flag. Drives build UI. |
| **Radio profile** | `CHIRP_PROFILES` in `formats/chirp/profiles.ts` | Wire limits at export: `maxMemorySlots`, `nameLimit`, power ladder.                 |

| Profile id   | Label               | Name limit | Memory slots |
| ------------ | ------------------- | ---------- | ------------ |
| `chirp-uv5r` | Baofeng UV-5R Mini  | 7          | 128          |
| `chirp-rt95` | Retevis RT95 VOX    | 16         | 128          |
| `chirp-uv21` | Baofeng UV-21Pro V2 | 16         | 128          |

Per-radio wire detail: [docs/reference/chirp/radios/](../../../reference/chirp/radios/README.md).

## Operator workflow

1. Curate analogue channels in the **library** (shared across builds).
2. Create a **CHIRP build** for the target radio profile.
3. On **Channels**, review the default-included analogue memory list, reorder, set wire names, default scan behaviour, and per-channel scan overrides.
4. **Export** a single profile-correct CSV from `/builds/:id/export` — organisation follows flat memory order on the build layout.

## Export behaviour

- **Include by default** — empty `channelOverrides` includes all analogue FM/AM channels; set `excluded: true` to opt out.
- **Memory order** — `orderOrSlot` on `channelOverrides` (1-based); gaps export as blank CHIRP memory slots.
- **Single CSV** download (not ZIP).
- **Analogue channels only** — digital/DMR channels skipped with warning.
- **`Location`:** 1-based index in flat memory order — not stored in the library.
- **Scan default:** build `exportSettings.defaultScanInclusion` defaults to `skip` (CHIRP convention).

## Lossy fields

| Field                          | Behaviour                                      |
| ------------------------------ | ---------------------------------------------- |
| `Location`                     | Export-time assignment from build memory order |
| DMR columns (`URCALL`, …)      | Empty on analogue export                       |
| Mixed-project digital channels | Skipped with warning                           |
| `DtcsCode` / `CrossMode`       | Export constants only — DCS not modelled       |
| Duplex `+`/`-` with offset 0   | Collapses to simplex in model                  |
| `Comment`                      | Not exported — library field only              |
| `TStep`                        | Constant `5.00` on export                      |

## Related

- [import-export hub](../README.md)
- [builds hub](../../builds/README.md)
- [data-model](../../data-model/README.md)
- [scan-inclusion](../../../reference/scan-inclusion.md)
- [operator lifecycle](../workflows/operator-lifecycle.md)

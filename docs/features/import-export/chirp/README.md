# CHIRP CSV — import / export

Product behaviour for CHIRP analogue FM/AM CSV in Codeplug Studio. Wire column tables live in the tier-3 [CHIRP reference](../../../reference/chirp/README.md).

**Tracking:** Phase 6 [#38](https://github.com/pskillen/codeplug-studio/issues/38) · [progress](chirp-progress.md) · [outstanding](chirp-outstanding.md)

**Source:** `src/core/import-export/formats/chirp/`

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Wire reference | Shipped | [reference/chirp/](../../../reference/chirp/README.md) |
| Trait profiles (`chirp-uv5r`, `chirp-rt95`, `chirp-uv21`) | In progress | `TRAIT_PROFILES` — `FlatMemoryList`, `PerChannelScanFlag` |
| Radio profiles + columns scaffold | In progress | `formats/chirp/profiles.ts`, `columns.ts` |
| Flat memory assemble projection | Planned | `assemble` + `flatMemoryLayout` |
| Export adapter (single CSV) | Planned | `assemble` → `serialiseChirpCsv` |
| Memories build UI | Planned | Ordered channel list on CHIRP builds |
| Browser download + export UI | Planned | `ExportBuildCpsPanel` single-file path |
| CPS import | Planned | Phase 6b [#214](https://github.com/pskillen/codeplug-studio/issues/214) |

## Trait profile vs radio profile

Studio uses two related concepts (same `profileId` keys):

| Concept | Where | Purpose |
| --- | --- | --- |
| **Trait profile** | `TRAIT_PROFILES` in `src/core/models/traits.ts` | Build capability traits — flat memory list, per-channel scan flag. Drives build UI. |
| **Radio profile** | `CHIRP_PROFILES` in `formats/chirp/profiles.ts` | Wire limits at export: `maxMemorySlots`, `nameLimit`, power ladder. |

| Profile id | Label | Name limit | Memory slots |
| --- | --- | --- | --- |
| `chirp-uv5r` | Baofeng UV-5R Mini | 7 | 128 |
| `chirp-rt95` | Retevis RT95 VOX | 16 | 128 |
| `chirp-uv21` | Baofeng UV-21Pro V2 | 16 | 128 |

Per-radio wire detail: [docs/reference/chirp/radios/](../../../reference/chirp/radios/README.md).

## Operator workflow

1. Curate analogue channels in the **library** (shared across builds).
2. Create a **CHIRP build** for the target radio profile.
3. On **Memories**, order channels for export (`Location` 1…n).
4. Set per-channel **scan inclusion** on library channels or via build export defaults (`Skip` column).
5. **Export** a single profile-correct CSV from `/builds/:id/export`.

CHIRP builds do **not** use library zones — organisation is flat memory order on the build layout.

## Export behaviour

- **Single CSV** download (not ZIP).
- **Analogue channels only** — digital/DMR channels skipped with warning.
- **`Location`:** 1-based index in flat memory order — not stored in the library.
- **Scan default:** build `exportSettings.defaultScanInclusion` defaults to `skip` (CHIRP convention).

## Lossy fields

| Field | Behaviour |
| --- | --- |
| `Location` | Export-time assignment from build memory order |
| DMR columns (`URCALL`, …) | Empty on analogue export |
| Mixed-project digital channels | Skipped with warning |
| `DtcsCode` / `CrossMode` | Export constants only — DCS not modelled |
| Duplex `+`/`-` with offset 0 | Collapses to simplex in model |
| `Comment` | Not exported — library field only |
| `TStep` | Constant `5.00` on export |

## Related

- [import-export hub](../README.md)
- [builds hub](../../builds/README.md)
- [data-model](../../data-model/README.md)
- [scan-inclusion](../../../reference/scan-inclusion.md)
- [operator lifecycle](../workflows/operator-lifecycle.md)

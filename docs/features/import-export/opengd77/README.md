# OpenGD77 CSV — import / export

Product behaviour for OpenGD77 CPS CSV in Codeplug Studio. Wire column tables live in the tier-3 [OpenGD77 reference](../../../reference/export-formats/opengd77/README.md).

**Tracking:** Phase 4a [#84](https://github.com/pskillen/codeplug-studio/issues/84)+ · Epic [#36](https://github.com/pskillen/codeplug-studio/issues/36)

**Source:** `src/core/import-export/formats/opengd77/`

## Implementation status

| Area                                  | Status  | Notes                                                                                                        |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| Radio variant profiles (1701, MD9600) | Shipped | `profiles.ts` — wire limits, power ladder                                                                    |
| Trait profile registration            | Shipped | `TRAIT_PROFILES` in `src/core/models/traits.ts`                                                              |
| Export adapter                        | Shipped | [#88](https://github.com/pskillen/codeplug-studio/issues/88) — `assemble` → serialise                        |
| Multi-mode channel expansion          | Shipped | [#89](https://github.com/pskillen/codeplug-studio/issues/89) — `-F`/`-D` rows at serialise + preview         |
| Export name shortening                | Shipped | [#90](https://github.com/pskillen/codeplug-studio/issues/90) — dictionary + `useExportSettings`              |
| Browser download + export UI          | Shipped | `ExportBuildCpsPanel` on `/builds/:id/export` ([#91](https://github.com/pskillen/codeplug-studio/issues/91)) |
| CPS import                            | Planned | Phase 4b                                                                                                     |

## Trait profile vs radio profile

Studio uses two related concepts:

| Concept           | Where                                           | Purpose                                                                                                                                                   |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trait profile** | `TRAIT_PROFILES` in `src/core/models/traits.ts` | Which **build capability traits** apply (zone grouping, flat memory, scan lists, …). Drives build UI composition.                                         |
| **Radio profile** | `OPENGD77_PROFILES` in `profiles.ts`            | **Wire variant limits** at the CPS boundary: `nameLimit`, `maxChannels`, zone/RGL member caps, power ladder. Used by export adapters and profile pickers. |

Both share the same `profileId` keys (`opengd77-1701`, `opengd77-md9600`) so a `FormatBuild` row references one id that resolves in both registries.

Trait profiles stay **vendor-neutral** in naming and scope. Radio profiles are **OpenGD77-specific** — CHIRP and DM32 will have sibling modules under their format directories.

## Radio profiles (tier 1 summary)

| Profile           | Label                        | Channel cap | Zone members | Name limit |
| ----------------- | ---------------------------- | ----------- | ------------ | ---------- |
| `opengd77-1701`   | Baofeng 1701 / Retevis RT-84 | 1023        | 80           | 16         |
| `opengd77-md9600` | TYT MD-9600 / Retevis RT-90  | 1023        | 80           | 16         |

Per-radio map: [opengd77 profiles.md](../../../reference/export-formats/opengd77/profiles.md) → [`docs/reference/radios/`](../../../reference/radios/).

Power column mapping (P-levels, `Master` sentinel): [channels.md](../../../reference/export-formats/opengd77/channels.md).

## UI consumption

- **New build flow** — `getFormatProfiles('opengd77')` lists radio profiles with labels and limit hints.
- **Build export** (`/builds/:id/export`) — `ExportNameSettingsFields` + build `profileId`; wire preview sub-routes share the same `useExportSettings` preferences.
- **Multi-mode channels** — when a channel has multiple `modeProfiles`, export and wire preview emit separate `-F` (analog) and `-D` (digital) wire rows unless `expandModes` is false.

Library CRUD does **not** enforce these caps. Export adapters warn or truncate at the wire boundary only.

## Related

- [import-export hub](../README.md)
- [builds hub](../../builds/README.md) — format build workflows
- [data-model](../../data-model/README.md) — `FormatBuild`, selections, trait layout
- [export-mapping.md](export-mapping.md) — internal projection → CPS files
- [name-shortening.md](../name-shortening.md) — wire name compose + abbreviations ([#90](https://github.com/pskillen/codeplug-studio/issues/90))
- [cps-services.md](../cps-services.md) — `assemble` and `exportBuild`

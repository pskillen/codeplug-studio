# NeonPlug profile — `neonplug-dm32uv`

Thin adapter stub. **Radio home (caps, power, squelch):** [Baofeng DM-32UV](../../../../radios/baofeng/dm-32uv/README.md).

| | |
| --- | --- |
| **Studio ids** | format `neonplug`, profile `neonplug-dm32uv` (`src/core/import-export/formats/neonplug/profiles.ts`) |
| **Ground truth** | NeonPlug [`src/radios/dm32uv/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/dm32uv) |

## Adapter-only notes

**Expected `CodeplugData` surface:** analogue + digital `channels`; `zones` / `scanLists` / `contacts` / `rxGroups` / `radioIds` populated; `radioInfo.model` e.g. `DP570UV` / DM32 family; settings / emergency / encryption present in NeonPlug backups (**lossy** for Studio M1).

**Trait alignment:** zone grouping, zone-derived or projected scan lists, multi-talkgroup / m×n expansion + scratch companions (default on) — see [export-projections.md](../../../../features/import-export/neonplug/export-projections.md).

Numeric caps identical to DM32 `dm32-baofeng-dm32uv` (sync test in `formats/neonplug/profiles.test.ts`).

Channel / zone wire: [channels.md](../channels.md), [zones.md](../zones.md). Sibling CPS CSV: [baofeng-dm32uv.md](../../dm32/radios/baofeng-dm32uv.md).

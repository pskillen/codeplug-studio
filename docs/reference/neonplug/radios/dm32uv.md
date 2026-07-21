# NeonPlug — Baofeng DM-32UV / DP570UV

Profile notes for digital NeonPlug exports targeting DM-32 family radios.

**Studio ids:** format `neonplug`, profile `neonplug-dm32uv` (`src/core/import-export/formats/neonplug/profiles.ts`)

**NeonPlug ground truth:** [`src/radios/dm32uv/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/dm32uv), Channel/Zone/ScanList models under `src/models/`

## Expected `CodeplugData` surface

| Array / field                     | Typical use                                          |
| --------------------------------- | ---------------------------------------------------- |
| `channels`                        | Full analogue + digital Channel objects              |
| `zones`                           | Named zones with channel-number members              |
| `scanLists`                       | Up to 15 members; priority / hang fields             |
| `contacts`                        | Contact book                                         |
| `rxGroups`                        | RX group lists                                       |
| `radioIds`                        | Operator DMR ID list                                 |
| `radioInfo.model`                 | e.g. `DP570UV` / DM32 family string from NeonPlug    |
| Settings / emergency / encryption | Present in NeonPlug backups; **lossy** for Studio M1 |

## Trait alignment (Studio)

Reuse concepts already used by DM32 CSV:

- Zone grouping
- Zone-derived or projected scan lists
- Multi-talkgroup / m×n expansion + scratch companions (default on) — see [export-projections.md](../../../features/import-export/neonplug/export-projections.md)

## Export caps (Studio profile)

Identical to DM32 CPS `dm32-baofeng-dm32uv` — NeonPlug `LIMITS` backported into both profiles. Sync test in `formats/neonplug/profiles.test.ts` prevents drift.

| Cap                                        | Value |
| ------------------------------------------ | ----- |
| `maxChannels`                              | 4000  |
| `maxZones`                                 | 250   |
| `zoneMembers`                              | 64    |
| `maxScanLists`                             | 32    |
| `scanListMembers`                          | 15    |
| `maxRxGroupLists`                          | 32    |
| `rxGroupListMembers`                       | 32    |
| `maxContacts`                              | 250   |
| `maxTalkGroups`                            | 800   |
| Channel / zone / contact / talk-group name | 16    |
| Scan list name                             | 10    |
| RX group list name                         | 10    |

Do **not** bake these into library CRUD — export warnings and Radio characteristics only.

## Related

- Sibling CPS CSV (same radio caps, different wire): [DM32 baofeng-dm32uv](../../dm32/radios/baofeng-dm32uv.md)
- Parked CPS CSV fidelity backlog: [cps-csv-gaps.md](../../../features/import-export/dm32/cps-csv-gaps.md)
- [channels.md](../channels.md), [zones.md](../zones.md)

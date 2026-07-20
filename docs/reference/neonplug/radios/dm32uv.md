# NeonPlug — Baofeng DM-32UV / DP570UV

Profile notes for digital NeonPlug exports targeting DM-32 family radios.

**Proposed Studio ids:** format `neonplug`, profile `neonplug-dm32uv`

**NeonPlug ground truth:** [`src/radios/dm32uv/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/dm32uv), Channel/Zone/ScanList models under `src/models/`

## Expected `CodeplugData` surface

| Array / field        | Typical use                                              |
| -------------------- | -------------------------------------------------------- |
| `channels`           | Full analogue + digital Channel objects                  |
| `zones`              | Named zones with channel-number members                  |
| `scanLists`          | Up to 15 members; priority / hang fields                 |
| `contacts`           | Contact book                                             |
| `rxGroups`           | RX group lists                                           |
| `radioIds`           | Operator DMR ID list                                     |
| `radioInfo.model`    | e.g. `DP570UV` / DM32 family string from NeonPlug        |
| Settings / emergency / encryption | Present in NeonPlug backups; **lossy** for Studio M1 |

## Trait alignment (Studio)

Reuse concepts already used by DM32 CSV:

- Zone grouping
- Zone-derived or projected scan lists
- Multi-talkgroup / m×n expansion decisions deferred to export options (same product questions as DM32)

## Cardinality hints (from NeonPlug model comments)

| Limit                         | Value (wire comments)        |
| ----------------------------- | ---------------------------- |
| Channel number range          | 1–4000                       |
| Channel name                  | max 16 chars                 |
| Zone name                     | max 10 chars                 |
| Scan list name                | max 10 chars                 |
| Scan list members             | ≤ 15                         |
| RX group talk-group members   | ≤ 32                         |
| Contacts book                 | ids 1–250                    |

Confirm against NeonPlug capabilities / radio constants when implementing export warnings — do **not** bake these into library CRUD.

## Related

- Sibling CPS CSV: [DM32 reference](../../dm32/README.md) — different wire; similar radio target
- [channels.md](../channels.md), [zones.md](../zones.md)

# DM32 — Scan.csv

Zone-derived scan list export for Baofeng DM-32UV CPS. Manual scan-list CRUD and import are deferred.

**Policy:** [zone-derived-scan-lists.md](../../zone-derived-scan-lists.md)  
**Code:** `src/core/import-export/zoneDerivedScanLists/`, `formats/dm32/serialise.ts`

## Export behaviour

When a DM32 build zone entry has `exportScanList: true` and the export master toggle **Export zone-derived scan lists** is on:

1. Emit a `Scan.csv` row named after the zone wire name, shortened to **`scanListNameLimit` (10)** when **Shorten long names** is on (general zone/channel `nameLimit` remains 16)
2. Synthesise a scan carrier channel `{zoneName} Scan` (default 145.500 MHz simplex)
3. Prepend carrier as first zone member in `Zones.csv`
4. Set channel `Scan List` FK on the scan **carrier** channel only (members keep manual assignment) — FK uses the **same** ≤10 Scan Name string

Member filter: zone-member `includeInScanList` cascade and channel `scanInclusion` (via `effectiveScanSkips`) — see [zone-derived-scan-lists.md](../../zone-derived-scan-lists.md). Cap: **15** named CSV members per list (`scanListMembers` profile limit) with export warning — even when the source zone has up to **64** members (`zoneMembers`). CPS UI/marketing “16 channels per scan list” includes an implicit current-channel slot that is **not** written as an explicit `Channel Members` entry ([#486](https://github.com/pskillen/codeplug-studio/issues/486)).

**List-count cap:** zone-derived export emits at most **min(`maxScanLists`, 15)** scan lists — channel `scanListId` is a 4-bit FK (0 = none → **15** referenceable lists). Profile `maxScanLists` (**32**) is EEPROM bank size; the effective export ceiling is the hardware FK limit. Overflow zones are skipped with a warning on CSV, NeonPlug, and `radio-io-dm32uv` ([#805](https://github.com/pskillen/codeplug-studio/issues/805)). Hardware constant: `DM32UV_LIMITS.CHANNEL_SCAN_LIST_ID_MAX` in `src/core/radios/baofeng/dm-32uv/limits.ts` (also on Web Serial `DM32_LIMITS`).

Synthesised timing / mode columns below are Studio defaults until CPS elicitation ([#447](https://github.com/pskillen/codeplug-studio/issues/447)).

### Empty-list floor (#564)

When derivation would leave `Scan.csv` with **no data rows** (no zone has `exportScanList`, master toggle off, or no eligible members), Studio still emits **one** default row so CPS / radio layout never sees a count-zero scan region. With ≥1 exported channel, `Channel Members` holds the first expanded wire name (trailing `|`) so the floor stays aligned with NeonPlug’s ≥1-member workaround:

| Column                 | Floor value                                            |
| ---------------------- | ------------------------------------------------------ |
| `Scan Name`            | `Scan list 1`                                          |
| `CTC Scan Mode`        | `Detection CTC`                                        |
| `Scan Tx Mode`         | `Last Actived Channel`                                 |
| `Hang Time`            | `5.0`                                                  |
| `Priority Channel 1/2` | `None`                                                 |
| `Designed Channel`     | `None`                                                 |
| `Priority Sweep Time`  | `500`                                                  |
| `Talkback`             | `0`                                                    |
| `Channel Members`      | First expanded wire name + `\|` (empty if no channels) |

No synthetic carrier is created for the floor row; channel `Scan List` stays `None`. Sibling NeonPlug DM32UV export applies the same policy to `scanLists[]` — see [neonplug/scan-lists.md](../neonplug/scan-lists.md).

## Wire columns (`Scan.csv`)

| Column                 | Export value                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Scan Name`            | Zone wire name, shortened to ≤**10** when name shortening is on (`scanListNameLimit`; not general `nameLimit` 16)                 |
| `CTC Scan Mode`        | `Detection CTC`                                                                                                                   |
| `Scan Tx Mode`         | `Last Actived Channel`                                                                                                            |
| `Hang Time`            | `5.0`                                                                                                                             |
| `Priority Channel 1/2` | `None`                                                                                                                            |
| `Designed Channel`     | Carrier wire name                                                                                                                 |
| `Priority Sweep Time`  | `500`                                                                                                                             |
| `Talkback`             | `0`                                                                                                                               |
| `Channel Members`      | Pipe-separated expanded channel wire names, **with a trailing `\|`** (CPS wire style; Zones.csv does **not** use a trailing pipe) |

## Import

**Not shipped** — Phase 5b or later ([#112](https://github.com/pskillen/codeplug-studio/issues/112)). Import skips `Scan.csv`; channel `Scan List` column ignored on import.

## Related

- [channels.md](channels.md) — `Scan List` column
- [zones.md](zones.md) — zone member pipe list

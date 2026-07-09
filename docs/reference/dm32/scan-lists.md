# DM32 — Scan.csv

Zone-derived scan list export for Baofeng DM-32UV CPS. Manual scan-list CRUD and import are deferred.

**Policy:** [zone-derived-scan-lists.md](../zone-derived-scan-lists.md)  
**Code:** `src/core/import-export/zoneDerivedScanLists/`, `formats/dm32/serialise.ts`

## Export behaviour

When a DM32 build zone entry has `exportScanList: true` and the export master toggle **Export zone-derived scan lists** is on:

1. Emit a `Scan.csv` row named after the zone wire name
2. Synthesise a scan carrier channel `{zoneName} Scan` (default 145.500 MHz simplex)
3. Prepend carrier as first zone member in `Zones.csv`
4. Set channel `Scan List` FK on the scan **carrier** channel only (members keep manual assignment)

Member filter: `includeInScanList !== false` and `Channel.scanSkip !== true`. Cap: **16** members per list (`scanListMembers` profile limit) with export warning.

## Wire columns (`Scan.csv`)

| Column                 | Export value                               |
| ---------------------- | ------------------------------------------ |
| `Scan Name`            | Zone wire name                             |
| `CTC Scan Mode`        | `Detection CTC`                            |
| `Scan Tx Mode`         | `Last Actived Channel`                     |
| `Hang Time`            | `5.0`                                      |
| `Priority Channel 1/2` | `None`                                     |
| `Designed Channel`     | Carrier wire name                          |
| `Priority Sweep Time`  | `500`                                      |
| `Talkback`             | `0`                                        |
| `Channel Members`      | Pipe-separated expanded channel wire names |

## Import

**Not shipped** — Phase 5b or later. Import skips `Scan.csv`; channel `Scan List` column ignored on import.

## Related

- [channels.md](channels.md) — `Scan List` column
- [zones.md](zones.md) — zone member pipe list

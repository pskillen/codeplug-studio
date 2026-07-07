# Zone-derived scan lists

Export-time synthesis of **scan lists**, **scan carrier channels**, and channel `Scan List` FK wiring from zone configuration. Manual `ScanList` CRUD remains future work ([#112](https://github.com/pskillen/codeplug-studio/issues/112) import epic).

**Implementation:** `src/core/import-export/zoneDerivedScanLists/`  
**DM32 wire layout:** [dm32/scan-lists.md](dm32/scan-lists.md)

## Two-level gating

| Layer              | Where                           | Purpose                                             |
| ------------------ | ------------------------------- | --------------------------------------------------- |
| **Build layout**   | `ZoneGroupingLayout` zone entry | Per-zone `exportScanList`, `scanCarrierFrequencyHz` |
| **Export options** | DM32 export panel               | Master `exportZoneDerivedScanLists` (default on)    |

```text
emitScan(zone) = layout.exportScanList === true
              && options.exportZoneDerivedScanLists !== false
```

## Member filtering

A channel is included in a zone-derived scan list when:

1. `ZoneMemberEntry.includeInScanList !== false`, and
2. `effectiveScanSkips(channel, exportOptions)` — honours `scanInclusion` tri-state + build `defaultScanInclusion`

## Scan carrier

When scan export is enabled for a zone:

- **Scan list name** = zone wire name
- **Carrier channel** = `{zoneName} Scan` at `scanCarrierFrequencyHz` or **145.500 MHz** simplex
- Carrier is first member in `Zones.csv` pipe list
- `Scan.csv` `Scan Tx Mode` = `Last Actived Channel`

## Format behaviour

| Target       | Zone scan flags                |
| ------------ | ------------------------------ |
| **DM32**     | Honoured when master toggle on |
| **OpenGD77** | Ignored (zone = scan)          |
| **CHIRP**    | Ignored                        |

## Related

- [zone-grouping.md](../../features/builds/zone-grouping.md) — build UI
- [dm32/README.md](../../features/import-export/dm32/README.md) — export hub

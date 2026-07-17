# Zone-derived scan lists

Export-time synthesis of **scan lists** and channel `Scan List` FK wiring from zone configuration. Library `ScanList` CRUD is shipped ([#257](https://github.com/pskillen/codeplug-studio/issues/257)); zone-derived lists are an **optional export projection** alongside manual library scan lists.

**Implementation:** `src/core/import-export/zoneDerivedScanLists/` (DM32) · `src/core/import-export/formats/anytone/zoneDerivedScanLists.ts` (Anytone)  
**DM32 wire layout:** [dm32/scan-lists.md](dm32/scan-lists.md) · **Anytone:** [anytone/scan-lists.md](anytone/scan-lists.md)

## Two-level gating

| Layer              | Where                           | Purpose                                                                    |
| ------------------ | ------------------------------- | -------------------------------------------------------------------------- |
| **Build layout**   | `ZoneGroupingLayout` zone entry | Per-zone `exportScanList`, `scanCarrierFrequencyHz` (carrier channel)      |
| **Export options** | Build export panel              | Master `exportZoneDerivedScanLists` (DM32 default on, Anytone default off) |

```text
emitScan(zone) = layout.exportScanList === true
              && options.exportZoneDerivedScanLists !== false
```

## Member filtering

A channel is included in a zone-derived scan list when:

1. `resolveEffectiveIncludeInZoneDerivedScanList` for the **exported** zone is `include` — cascade: library `zoneDefaults` → member `includeInScanList` → build `defaultIncludeInZoneDerivedScanList` → layout `scanMemberInclusion` (see [zone-behavioural-defaults.md](zone-behavioural-defaults.md)), and
2. `effectiveScanSkips(channel, exportOptions)` — honours channel `scanInclusion` tri-state + build `defaultScanInclusion`

Nested parent/child projections are independent — skip on a parent export does not rewrite the child zone.

## Scan carrier (DM32 and Anytone)

When scan export is enabled for a zone on **DM32** or **Anytone**:

- **Scan list name** = zone wire name
- **Carrier channel** = `{zoneName} Scan` at `scanCarrierFrequencyHz` or **145.500 MHz** simplex
- Carrier is prepended as the first member in the zone CSV pipe list (`Zones.csv` / `DMRZone.CSV`)
- Zone-derived `ScanList.CSV` members are **DMR bank channels only** — AMAir/FM receive-bank channels in the zone are excluded (they live in `AMAir.CSV` / `FM.CSV`, not `Channel.CSV`)
- Only the **carrier channel** receives the zone-derived `Scan List` FK — member channels keep library/manual assignments only (channels can belong to multiple zones; scan lists are per-channel)
- **Auto Scan** = `1` on the carrier channel (`Channel.CSV` / `Channels.csv`)

**DM32:** `Scan.csv` `Scan Tx Mode` = `Last Actived Channel`.

**Anytone:** zone-derived rows also merge into `ScanList.CSV` alongside library scan lists.

## Format behaviour

| Target       | Zone scan flags                | Merge with library `ScanList`               |
| ------------ | ------------------------------ | ------------------------------------------- |
| **DM32**     | Honoured when master toggle on | N/A (zone-derived only)                     |
| **Anytone**  | Honoured when master toggle on | Yes — library rows first, then zone-derived |
| **OpenGD77** | Ignored (zone = scan)          | —                                           |
| **CHIRP**    | Ignored                        | —                                           |

Channel `Scan List` FK on Anytone: library `Channel.scanListId` on member channels; zone-derived FK attaches to the carrier channel only.

## Related

- [zone-grouping.md](../../features/builds/zone-grouping.md) — build UI
- [dm32/README.md](../../features/import-export/dm32/README.md) — DM32 export hub
- [anytone/README.md](../../features/import-export/anytone/README.md) — Anytone export hub ([#318](https://github.com/pskillen/codeplug-studio/issues/318))

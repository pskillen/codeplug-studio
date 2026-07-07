# Anytone — APRS (`APRS.CSV`)

Global APRS configuration for AT-D890UV — **one wide data row** (~150 columns), unlike OpenGD77 named configs in a multi-row `APRS.csv`.

**Fixture:** [`test-data/anytone/at-d890uv/APRS.CSV`](../../../test-data/anytone/at-d890uv/APRS.CSV) (redacted)

Per-channel APRS flags on `Channel.CSV`: [aprs-on-channels.md](aprs-on-channels.md).

## Fidelity tier

| Tier             | Status                                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| **Not modelled** | No first-class internal entity today                                    |
| Export v1        | Header-only or fixture-default row (OpenGD77 pattern) until model lands |

## Column groups (inventory)

### Timing and roaming

| Columns                    | Purpose (wire)         |
| -------------------------- | ---------------------- |
| `Manual TX Interval[s]`    | Manual beacon interval |
| `APRS Auto TX Interval[s]` | Auto beacon interval   |
| `Support For Roaming`      | Roaming enable         |
| `Fixed Location Beacon`    | Fixed GPS beacon flag  |

### GPS / fixed position

| Columns                                                                    | Purpose   |
| -------------------------------------------------------------------------- | --------- |
| `LatiDegree`, `LatiMinInt`, `LatiMinMark`, `North or South`                | Latitude  |
| `LongtiDegree`, `LongtiMinInt`, `LongtiMinMark`, `East or West Hemisphere` | Longitude |

### APRS channel slots (×8)

Repeating pattern `channelN`, `slotN`, `Aprs TgN`, `Call TypeN` for N=1…8 — binds APRS behaviour to DMR channel/slot/talk-group tuples.

### Identity and path

| Column                                | Sample (redacted)      |
| ------------------------------------- | ---------------------- |
| `TOCALL` / `TOCALL SSID`              | `APAT81` / `0`         |
| `Your Call Sign` / `Your SSID`        | Operator callsign      |
| `APRS Symbol Table` / `APRS Map Icon` | `/` / `[`              |
| `Digipeater Path`                     | e.g. `WIDE1-1,WIDE2-1` |
| `Enter Your Sending Text`             | Free text status       |

### RF and TX

| Columns                                  | Purpose                                        |
| ---------------------------------------- | ---------------------------------------------- |
| `Transmission Frequency [MHz]`           | APRS TX frequency                              |
| `Transmit Delay[ms]`, `Prewave Time[ms]` | Timing                                         |
| `Send Sub Tone`, `CTCSS`, `DCS`          | Tone settings                                  |
| `Transmit Power`                         | Power level                                    |
| `Transmission Frequency"0` … `"7`        | Additional TX freq slots (quoted header names) |

### RX filters (×32)

`Receive Filter1` … `Receive Filter32` with paired `Call SignN` / `SSIDN` columns — APRS receive routing filters.

### Packet type enables

`POSITION`, `MIC-E`, `OBJECT`, `ITEM`, `MESSAGE`, `WX REPORT`, `NMEA REPORT`, `STATUS REPORT`, `OTHER` — enable flags for APRS packet types.

## Proposed internal model (follow-up issue)

Not implemented in this wire spike — sketch for tier-1 data-model work:

```typescript
/** Proposed — not in src/core/models/ today */
interface AprsConfiguration {
  id: string;
  // Scope TBD: library row vs FormatBuild-scoped settings
  manualTxIntervalSec: number | null;
  autoTxIntervalSec: number | null;
  fixedLocation: GeoPoint | null;
  yourCallsign: string;
  yourSsid: number | null;
  tocall: string;
  digipeaterPath: string;
  symbolTable: string;
  mapIcon: string;
  txFrequencyHz: number | null;
  channelSlots: AprsChannelSlot[]; // up to 8
  rxFilters: AprsRxFilter[]; // up to 32
  packetTypeFlags: Record<string, boolean>;
}
```

**Open design questions** (record in [anytone-outstanding.md](../../features/import-export/anytone-outstanding.md)):

- Library-global vs build-scoped configuration
- Relationship to per-channel APRS columns on `Channel.CSV`
- Whether APRS shares `TalkGroup` refs for `Aprs TgN` columns

## Related

- [aprs-on-channels.md](aprs-on-channels.md)
- [OpenGD77 dtmf-aprs.md](../opengd77/dtmf-aprs.md) — sibling deferred pattern
- [channels.md](channels.md)

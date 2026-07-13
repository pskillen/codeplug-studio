# Anytone — APRS (`APRS.CSV`)

Global APRS configuration for AT-D890UV — **one wide data row** (~150 columns), unlike OpenGD77 named configs in a multi-row `APRS.csv`.

**Fixture:** [`test-data/anytone/at-d890uv/APRS.CSV`](../../../test-data/anytone/at-d890uv/APRS.CSV) (redacted)

Per-channel APRS flags on `Channel.CSV`: [aprs-on-channels.md](aprs-on-channels.md).

**Internal model (tier 1):** Digital APRS semantics, entity fields, and export policy are documented in [docs/features/aprs/](../../../features/aprs/README.md) — not duplicated here. This file is the wire column inventory only.

## Fidelity tier

| Tier             | Status                                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| **Modelled**     | Beacon timing, position source, 8 DMR slots, default DMR target — see tier-1 [aprs](../../../features/aprs/README.md) |
| **Export v1**    | Modelled columns via [#251](https://github.com/pskillen/codeplug-studio/issues/251); remainder from `aprsDefaults.ts` constants |
| **Not modelled** | Analog identity/path, RX filters, packet types, tones, extra TX freqs   |

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

## Related

- [aprs-on-channels.md](aprs-on-channels.md)
- [docs/features/aprs/](../../../features/aprs/README.md) — tier-1 digital APRS model
- [OpenGD77 dtmf-aprs.md](../opengd77/dtmf-aprs.md) — sibling deferred pattern
- [channels.md](channels.md)

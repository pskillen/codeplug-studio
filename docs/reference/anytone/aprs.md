# Anytone — APRS (`APRS.CSV`)

Global APRS configuration for AT-D890UV — **one wide data row** (176 columns), unlike OpenGD77 named configs in a multi-row `APRS.csv`.

**Fixture:** [`test-data/anytone/at-d890uv/APRS.CSV`](../../../test-data/anytone/at-d890uv/APRS.CSV) (redacted)

Per-channel APRS flags on `Channel.CSV`: [aprs-on-channels.md](aprs-on-channels.md).

**Internal model (tier 1):** Digital APRS semantics, entity fields, and export policy are documented in [docs/features/aprs/](../../../features/aprs/README.md) — not duplicated here. This file is the wire column inventory only.

## Fidelity tier

| Tier             | Status                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modelled**     | Beacon timing, position source, 8 digital channel slots (any library channel; Anytone maps to correct CPS bank `No.`), DMR timeslot + target ID per slot — see tier-1 [aprs](../../../features/aprs/README.md) |
| **Export v1**    | Shipped ([#251](https://github.com/pskillen/codeplug-studio/issues/251)) — modelled columns from library; remainder from `aprsDefaults.ts`                                                                     |
| **Not modelled** | Analog identity/path, RX filters, packet types, tones, extra TX freqs                                                                                                                                          |

### Position source wire (export v1)

| `positionSource`                      | `Fixed Location Beacon` | Coordinates                                                                         |
| ------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `fixed`                               | `1`                     | Decomposed from `fixedLocation` (`GeoPoint` decimal degrees → degree/minute fields) |
| `gps`, `beidou`, `galileo`, `allGnss` | `0`                     | Cleared to `0` (GNSS from radio; not modelled per constellation on wire)            |

`APRS TG` and unnumbered `Call Type` remain fixture defaults — semantics unconfirmed.

## Column groups (inventory)

### Timing and roaming

| Columns                    | Purpose (wire)                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Manual TX Interval[s]`    | Manual beacon interval (plain seconds on wire)                                                                              |
| `APRS Auto TX Interval[s]` | Auto beacon interval — **wire byte code** `k`, not seconds ([#366](https://github.com/pskillen/codeplug-studio/issues/366)) |
| `Support For Roaming`      | Roaming enable                                                                                                              |
| `Fixed Location Beacon`    | Fixed GPS beacon flag                                                                                                       |

#### Timing wire (export v1)

| Column                     | Wire value                                                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Manual TX Interval[s]`    | Integer seconds (`trunc` of library value; `0` = off)                                                                                                                                                                                          |
| `APRS Auto TX Interval[s]` | Integer code `k` (`0` = off). Encode from library seconds `s`: `k = trunc(s / 15) − 3`. Decode on import: `s = (k + 3) × 15` for `k > 0`. Encodable range **60–3870 s** in **15 s** steps (`k` = 1…255). Example: **180 s** → `k = 9` on wire. |

### GPS / fixed position

| Columns                                                                    | Purpose   |
| -------------------------------------------------------------------------- | --------- |
| `LatiDegree`, `LatiMinInt`, `LatiMinMark`, `North or South`                | Latitude  |
| `LongtiDegree`, `LongtiMinInt`, `LongtiMinMark`, `East or West Hemisphere` | Longitude |

### APRS channel slots (×8)

Repeating pattern `channelN`, `slotN`, `Aprs TgN`, `Call TypeN` for N=1…8:

| Wire column  | Meaning                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channelN`   | CPS `No.` for the referenced library channel in its bank file — `Channel.CSV` (DMR / main bank), `AMAir.CSV`, or `FM.CSV`. Wire `0` = current channel. VFO rows (257 / 101) are not bindable. |
| `slotN`      | DMR timeslot (`1` or `2`) for digital APRS transmission                                                                                                                                       |
| `Aprs TgN`   | Target DMR ID (talk group or private)                                                                                                                                                         |
| `Call TypeN` | `0` private / `1` group                                                                                                                                                                       |

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
| `Transmission Frequency0` … `7`          | Additional TX freq slots. Some older CPS samples show broken quoting (`Transmission Frequency"N`); Studio emits clean `Transmission FrequencyN`. |

### RX filters (×32)

`Receive Filter1` … `Receive Filter32` with paired `Call SignN` / `SSIDN` columns — APRS receive routing filters.

### Packet type enables

`POSITION`, `MIC-E`, `OBJECT`, `ITEM`, `MESSAGE`, `WX REPORT`, `NMEA REPORT`, `STATUS REPORT`, `OTHER` — enable flags for APRS packet types.

## Related

- [aprs-on-channels.md](aprs-on-channels.md)
- [docs/features/aprs/](../../../features/aprs/README.md) — tier-1 digital APRS model
- [OpenGD77 dtmf-aprs.md](../opengd77/dtmf-aprs.md) — sibling deferred pattern
- [channels.md](channels.md)

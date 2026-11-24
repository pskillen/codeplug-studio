# RadioFoundry satellite keps (debug-link SATELLITE)

RadioFoundry stores satellite orbital data (two-line elements) and one FM uplink/downlink profile per satellite in dedicated flash, **outside** the codeplug image. Studio loads that area only through debug-link command `0x26 SATELLITE` (reply `0xA6`). On supported boards the satellite area sits past every block the cable codeplug write serves, so a codeplug write does not touch it.

**Code:** `src/integrations/radio-io/radios/radiofoundry/satellite.ts`, `satelliteWrite.ts`, `protocol.ts` (`satelliteRequest`). **Eligibility (library → wire):** `src/core/radios/radiofoundry/satelliteCapability.ts`. **Capacity limits:** [limits.md](limits.md).

**Upstream:** RadioFoundry at commit `454a5b76` — `docs/spec/satellite.md` §6, `docs/spec/debuglink.md` §3.30, `core/debuglink/debuglink_satellite.c`, `core/satellite/store.c`.

## Detection

Studio probes with SATELLITE `INFO` (status `0` required). The debug-link `VERSION` text may list `SATELLITE_TLE` under `features=` when the build includes tracking, or under `off=` when the feature is compiled but disabled. Older builds that predate the command answer `INFO` with status `1`. Status `4` means the feature is off or there is no satellite storage area — the exact message depends on whether `off=` includes `SATELLITE_TLE`. The MD-9600 maximal preset leaves satellite tracking off even when other boards enable an area. Support is a property of the **build**, not the Studio board pick alone.

## Operations Studio sends and refuses

| Op      | Name                              | Studio                                                  |
| ------- | --------------------------------- | ------------------------------------------------------- |
| 0       | INFO                              | yes — probe and read-back                               |
| 1       | LIST                              | yes — inventory pages                                   |
| 3       | DATA                              | yes — record stream chunks                              |
| 4       | COMMIT                            | yes — after data and profiles                           |
| 5       | ABORT                             | yes — on failure before commit                          |
| 9       | REPLACE_BEGIN                     | yes — whole-set replace                                 |
| 11      | PROFILE_VALUES_GET                | yes — read-back check                                   |
| 12      | PROFILE_STAGE_CHUNK               | yes — frequency profiles (protocol ≥ 6)                 |
| 2       | BEGIN                             | **never** — legacy additive install                     |
| 6       | SYNC_CHANNELS                     | **never** — would create codeplug channels on the radio |
| 7–8, 10 | PROFILE_GET / SET / PROFILE_STAGE | **never** — legacy profile path                         |
| 13      | SYNC_CHANNELS_STATUS              | **never**                                               |

Only `satelliteRequest` emits `0x26`. It throws `RadioInterlockError` before writing when the op is not in the allowlist above.

## Record encoding (replace transaction)

Records are sent in **ascending catalog (NORAD) order** as one byte stream checksummed with CRC-32 IEEE (`zlib.crc32` / Studio `crc32Ieee`):

| Field      | Wire                                               |
| ---------- | -------------------------------------------------- |
| Catalog    | `u32` little-endian                                |
| Name       | `u8` length (1–48 UTF-8 bytes), then UTF-8 payload |
| TLE line 1 | 69 printable ASCII bytes (`0x20`–`0x7E`)           |
| TLE line 2 | 69 printable ASCII bytes                           |

`REPLACE_BEGIN` carries `recordCount`, total `byteCount`, and CRC-32 over the stream. The radio refuses an empty set (`recordCount` 0), more than capacity (10 on current firmware), or byte counts outside `144 × count` … `191 × count`. Studio validates names and lines before I/O; the radio additionally refuses invalid catalog numbers, bad UTF-8 names, TLE classification (column 8) other than `U` / `C` / `S`, and unparseable epochs.

## Profile encoding

From satellite protocol **6** upward, profiles are staged with `PROFILE_STAGE_CHUNK`: consecutive chunks of up to four satellites, each entry `catalog u32`, `rxHz u32`, `txHz u32`, `toneTenths u16` (all little-endian). `rxHz` is the downlink (what the radio receives); `txHz` is the uplink.

**Profile validity (firmware source, not fully spelled out in the public spec):** both frequencies non-zero and below 1 GHz; `rxHz` in a board receive band and `txHz` in a transmit band (`RadioFoundryBoardLimits.BANDS_HZ`); `toneTenths` 0 (none) or 600–2600 (60.0–260.0 Hz uplink CTCSS). Studio applies the same rules in `satelliteCapability.ts` at the write boundary only.

## LIST epoch

`LIST` returns each catalog id and a **whole-second Unix epoch** derived from TLE line 1 with integer arithmetic (year `YY ≥ 57 → 19YY else 20YY`, day-of-year, fraction digits). Studio recomputes with `radioFoundryTleEpochSeconds` and compares after commit.

## Transaction flow

1. `INFO` — protocol 6 or 7, capacity, installed count.
2. `LIST` pages — prove the existing store reads (when `installed > 0`).
3. `REPLACE_BEGIN` — whole-set replace; yields `transactionId`.
4. `DATA` — consecutive chunks (≤ 59 bytes payload per request).
5. `PROFILE_STAGE_CHUNK` — all profiles for the staged records.
6. `COMMIT` — `transactionId` + stream CRC again.
7. Read-back: `INFO`, `LIST` (epochs), `PROFILE_VALUES_GET` (frequencies).

Any failure after `REPLACE_BEGIN` and before a successful `COMMIT` sends `ABORT`. Studio never sends an empty inventory (the radio refuses `recordCount` 0).

## Debug detail

Each write keeps a log of every SATELLITE request it sends: operation (number and name), argument length, the status the radio answered (or "no reply" when the link failed) and the reply body length. On success the Done step offers it under **Debug details** (collapsed, with Copy) after a summary line (records sent, installed count, read-back result), and it is written once to the console as `[radiofoundry-keps]`. On failure it is attached to the error as `debugText`, so the error panel's **Copy debug text** carries it. Frame contents are not logged, only sizes and statuses.

## Not done by a keps write

- Studio does **not** send `SYNC_CHANNELS` after a keps write, so the radio's Satellites-zone channels are not changed; the satellite set and frequency profiles are replaced and nothing else. Revisit if Studio manages those channels later.
- The MD-9600 refuses satellite transmit until RadioFoundry confirms the board revision (`boards/md9600/board.c`, lines 24 to 25 in the RadioFoundry source); keps still write and read back.
- Studio warns in step 1 when a satellite's orbit data is 14 or more days old (the radio's own threshold). It shows as a note, does not refuse, and does not stop Review.

## Protocol versions

Studio accepts satellite protocol **6** (chunked profiles, up to 10) and **7** (current upstream at `454a5b76`).

## Inferred behaviour

The host reference tool runs SATELLITE in the same debug-link session immediately after a codeplug commit without rebooting; storage may answer busy (status `3`) and the cable writer retries for up to five seconds. **Bench confirmation** on Studio hardware is planned with the keps write adapter that calls `writeRadioFoundrySatellites`.

## From the library

Studio packs each **enabled** satellite that passes TLE and catalog checks into one record (NORAD id, UTF-8 name up to 48 bytes, both TLE lines) plus one **frequency profile**: an FM transmitter marked for write whose uplink and downlink both fall in this board's bands (`BANDS_HZ`). When several FM transmitters qualify, the **first** in library order wins unless the build picks another in the Satellite keps tab's Radio column (`satelliteBankSlot: 'fm'` on the transmitter UUID). The wire name is the build's spacecraft `wireName` override when set, otherwise the shortened library name (48-byte budget); if encoding yields nothing, the catalog id is used. Satellites that fail TLE, catalog, mode, band, or write-inclusion checks are listed as excluded with a reason; extra FM candidates on a written satellite appear as skipped transmitters. The write **replaces the whole satellite set** on the radio and read-backs epochs and profiles. Studio refuses an empty eligible set or more than ten satellites before any I/O, and asks the radio on `INFO` whether its build supports satellite tracking — a build with tracking off is told plainly and nothing is written. Mapping lives in `src/integrations/radio-io/radios/radiofoundry/satelliteCodec.ts`; the app adapter is `writeRadioFoundrySatellitesToRadio`.

## Related

- [Firmware limits](limits.md) — `SATELLITE_*` capacity and name ceilings
- [Cable write](cable-write.md) — codeplug command `0x1C` (separate from SATELLITE)
- [Firmware identity](firmware.md) — `features=` / `off=` lines

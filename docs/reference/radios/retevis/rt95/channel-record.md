# RT95 VOX — channel record

32-byte channel element in the PROGRAM→QX contiguous image (AnyTone 778UV family). CHIRP `RetevisRT95vox` / `AnyTone778UVBase`.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: CHIRP `anytone778uv.py` `MEM_FORMAT` memory struct (facts only — no GPL paste).

## Geometry

| Fact                          | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Record size                   | `32` bytes                                                         |
| Count                         | `200` (memories 1–200)                                             |
| Span in image                 | `0x1900` from `0x0000`                                             |
| Occupancy                     | Bit in `occupied_bitfield` @ `0x1940` — not an empty FF fill alone |
| Name length (VOX)             | **6** ASCII (`NAME_LENGTH = 6`)                                    |
| Name length (non-VOX sibling) | 5 — first of the 6 name bytes is `0x00` padding                    |

## Field offsets

| Offset / bits | Field                                             | Encoding / notes                                          |
| ------------- | ------------------------------------------------- | --------------------------------------------------------- |
| `0–3`         | RX frequency                                      | BCD (`bbcd`); Hz via CHIRP BCD decode                     |
| `4–7`         | Offset                                            | BCD; used with duplex / odd-split                         |
| `8`           | unknown                                           | Preserve on RMW                                           |
| `9` bits      | talkaround, scramble, **txpower:2**, **duplex:2** | See enums below                                           |
| `10` bits     | **channel_width:2**, reverse, **tx_off**          | Width + TX disable (`tx_off` → duplex off)                |
| `11` bits     | dtcs/ctcss encode/decode enables                  | Four enable bits                                          |
| `12`          | CTCSS decode tone index                           | See tone map                                              |
| `13`          | CTCSS encode tone index                           | Same                                                      |
| `14`          | DTCS decode code low                              | + high bit / invert in following byte                     |
| `15` bits     | DTCS decode invert + high bit                     |                                                           |
| `16`          | DTCS encode code low                              |                                                           |
| `17` bits     | DTCS encode invert + high bit                     |                                                           |
| `18` bits     | **busy_channel_lockout:2**                        | Off / repeater / busy                                     |
| `19`          | unknown                                           | Preserve                                                  |
| `20` bit      | **tone_squelch_en**                               | TSQL-style squelch                                        |
| `21–23`       | unknown                                           | Preserve                                                  |
| `24–29`       | name                                              | 6 chars; VOX uses all 6                                   |
| `30–31`       | custom CTCSS                                      | `ul16`; custom tone `0x33` not fully implemented in CHIRP |

Exact bit packing follows CHIRP’s little-endian bitfield layout within each byte — implement from the struct map at adapter time; do not invent alternate packing.

## Power (`txpower`)

| Wire   | CHIRP label | Approx RF      |
| ------ | ----------- | -------------- |
| `0x00` | Low         | ~5 W (37 dBm)  |
| `0x01` | Medium      | ~10 W (40 dBm) |
| `0x02` | High        | ~25 W (44 dBm) |

Library % for file adapters: [power.md](power.md).

## Duplex

| Wire   | CHIRP duplex        |
| ------ | ------------------- |
| `0x00` | none (`''`)         |
| `0x01` | `+`                 |
| `0x02` | `-`                 |
| `0x03` | `split` (odd split) |

`tx_off = 1` → CHIRP exposes duplex `off` (TX disabled) regardless of duplex enum.

## Channel width

| Wire   | Meaning        |
| ------ | -------------- |
| `0x00` | 12.5 kHz (NFM) |
| `0x01` | 20 kHz         |
| `0x02` | 25 kHz (FM)    |

CHIRP `valid_modes` for this family: `FM`, `NFM` (20 kHz may warn / map carefully in the adapter).

## Busy channel lockout

| Wire   | Meaning  |
| ------ | -------- |
| `0x00` | Off      |
| `0x01` | Repeater |
| `0x02` | Busy     |

## CTCSS tone indices (summary)

Wire byte → tone Hz via CHIRP `TONE_MAP_VAL_TO_TONE` (`0x00` = 62.5 Hz … `0x32` = 254.1 Hz). Index **`0x33`** = custom CTCSS (not fully supported in CHIRP). Do not paste the full table as GPL source — cite the driver path when implementing; Studio may keep a vendor-neutral Hz table at the adapter edge.

DTCS uses CHIRP `ALL_DTCS_CODES` index split across low byte + high bit, with separate invert bits for encode/decode.

## Related

- [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- CSV naming cross-check only: [export-formats/chirp/channels.md](../../../export-formats/chirp/channels.md)

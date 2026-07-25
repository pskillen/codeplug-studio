# UV-21Pro V2 — channel record

32-byte channel element used in the PROGRAM+R/W clone image (UV-17Pro family). Same geometry as CHIRP `UV17Pro` / `UV21ProV2`.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: CHIRP `baofeng_uv17Pro.py` memory object (facts only — no GPL paste).

## Geometry

| Fact                 | Value                                                       |
| -------------------- | ----------------------------------------------------------- |
| Record size          | `32` bytes                                                  |
| Count                | `1000`                                                      |
| Span in packed image | `0x7D00` from `0x0000`                                      |
| Empty sentinel       | first byte `0xFF`; CHIRP fills empty slots with `0xFF × 32` |
| Name length          | 12 ASCII                                                    |

There is **no** separate channel-count field in the image — occupancy is per-slot empty markers.

## Field offsets

| Offset        | Field                   | Encoding / notes                                                                                                                |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `0–3`         | RX frequency            | Little-endian BCD; value × 10 → Hz                                                                                              |
| `4–7`         | TX frequency            | Same; duplex off / RX-only → all `0xFF`                                                                                         |
| `8–9`         | RX tone                 | `u16` LE; `0` / `0xFFFF` = none; `≥ 0x258` = CTCSS × 10; else DTCS index (`index+1` normal, `index+1+0x69` reverse — CHIRP `R`) |
| `10–11`       | TX tone                 | Same                                                                                                                            |
| `12`          | `scode`                 | CHIRP; Studio writes `1`                                                                                                        |
| `13`          | `pttid`                 | CHIRP; Studio writes `0`                                                                                                        |
| `14` bits 0–1 | `lowpower`              | `0` = High; non-zero → Low (see [power.md](power.md))                                                                           |
| `14`          | other bitfields         | CHIRP `scramble` etc.                                                                                                           |
| `15` bit 6    | `wide`                  | **Polarity:** `1` = NFM, `0` = FM (inverted vs classic UV-5R)                                                                   |
| `15` bit 2    | `scan`                  | `1` = participate in scan (CHIRP not Skip); Studio maps effective scan inclusion on Write                                       |
| `15` other    | `sqmode`, `bcl`, `fhss` | CHIRP extras                                                                                                                    |
| `16–19`       | unknown                 | CHIRP reserved; zeroed on encode                                                                                                |
| `20–31`       | name                    | 12 chars; stop at `0x00` / `0xFF`                                                                                               |

## Power

| Wire (`lowpower`) | Meaning | Typical RF |
| ----------------- | ------- | ---------- |
| `0`               | High    | 5 W        |
| non-zero          | Low     | 1 W        |

Internal library % mapping: [power.md](power.md).

## Mode (bandwidth)

| `wide` bit | Meaning      |
| ---------- | ------------ |
| `0`        | FM (wide)    |
| `1`        | NFM (narrow) |

**AM mode:** CHIRP `UV21ProV2` adds AM to `MODES`. Studio v1 Web Serial encode maps FM/NFM only — AM library channels are skipped with a warning (same as CHIRP CSV path). Document as known loss.

## Duplex off / TX inhibit

CHIRP encodes duplex-off as TX frequency bytes **`FF × 4`**. Studio Web Serial maps library `forbidTransmit` to `RadioChannelDto.rxOnly` and writes TX bytes `FF×4` on encode.

## Channel-span Write policy

On Write, Studio **clears the full packed channel span** (`0x0000`…`0x7D00`) to empty (`0xFF`) before encoding projected channels — orphan slots from a prior Read are removed. The firmware ASCII overlay at `0x1EF0` inside the span is preserved. Upload remains **full-image** so VFO/settings/ANI and the fourth `MEM_*` region stay Read-retained.

## Related

- [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- Sibling record map: [UV-5R Mini channel record](../uv-5r-mini/channel-record.md)
- CSV naming cross-check: [export-formats/chirp/channels.md](../../../export-formats/chirp/channels.md)

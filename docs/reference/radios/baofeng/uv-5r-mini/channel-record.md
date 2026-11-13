# UV-5R Mini — channel record

32-byte channel element used in the PROGRAM+R/W clone image (UV-17Pro family). Shared by NeonPlug and CHIRP `UV5RMini`.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `channelFormat.ts`; CHIRP `baofeng_uv17Pro.py` memory object (facts only — no GPL paste).

## Geometry

| Fact                 | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| Record size          | `32` bytes                                                             |
| Count                | `999`                                                                  |
| Span in packed image | `0x7CE0` from `0x0000`                                                 |
| Empty sentinel       | first byte `0xFF` (NeonPlug); CHIRP fills empty slots with `0xFF × 32` |
| Name length          | 12 ASCII                                                               |

There is **no** separate channel-count field in the image — occupancy is per-slot empty markers.

## Field offsets

| Offset             | Field        | Encoding / notes                                                                                                                                           |
| ------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0–3`              | RX frequency | Little-endian BCD; value × 10 → Hz                                                                                                                         |
| `4–7`              | TX frequency | Same; duplex off → all `0xFF`                                                                                                                              |
| `8–9`              | RX tone      | `u16` LE; `0` / `0xFFFF` = none; `≥ 0x258` = CTCSS × 10; else DTCS index (`index+1` normal, `index+1+0x69` reverse — CHIRP `R`)                            |
| `10–11`            | TX tone      | Same                                                                                                                                                       |
| `12`               | `scode`      | DTMF signal code (CHIRP). Not modelled; `decodeChannelExtras` reads it                                                                                     |
| `13`               | `pttid`      | PTT ID mode (CHIRP). Not modelled                                                                                                                          |
| `14` bits 0–1      | `lowpower`   | `0` = High; non-zero → Low (see [power.md](power.md))                                                                                                      |
| `14` bits 5–4      | `scramble`   | CHIRP voice scramble. Not modelled                                                                                                                         |
| `14` bits 7–6, 3–2 | unnamed      | Not modelled                                                                                                                                               |
| `15` bit 6         | `wide`       | **Polarity:** `1` = NFM, `0` = FM (inverted vs classic UV-5R)                                                                                              |
| `15` bit 2         | `scan`       | `1` = participate in scan (CHIRP not Skip); Studio maps effective scan inclusion on Write ([#696](https://github.com/pskillen/codeplug-studio/issues/696)) |
| `15` bits 5–4      | `sqmode`     | CHIRP shows it as **RX DTMF**: the speaker opens only on DTMF plus CTCSS/DCS. Not modelled                                                                 |
| `15` bit 3         | `bcl`        | CHIRP busy channel lockout. Not modelled                                                                                                                   |
| `15` bit 0         | `fhss`       | CHIRP frequency hopping. Not modelled                                                                                                                      |
| `15` bits 7, 1     | unnamed      | Not modelled                                                                                                                                               |
| `16–19`            | unnamed      | CHIRP reserved. Not modelled                                                                                                                               |
| `20–31`            | name         | 12 chars; stop at `0x00` / `0xFF`                                                                                                                          |

## Power

| Wire (`lowpower`) | Meaning | Typical RF |
| ----------------- | ------- | ---------- |
| `0`               | High    | 5 W        |
| non-zero          | Low     | 1 W        |

Internal library % mapping for file adapters: [power.md](power.md).

## Mode (bandwidth)

| `wide` bit | Meaning      |
| ---------- | ------------ |
| `0`        | FM (wide)    |
| `1`        | NFM (narrow) |

**AM mode:** CHIRP `UV5RMini` adds AM to `MODES` (same UV-17Pro family codec as UV-21). The clone image has no AM bit — CHIRP infers AM from airband frequency on Read and encodes AM as `wide=0` on Write. Studio CHIRP CSV writes `Mode=AM`; Web Serial Write maps library `mode: am` to `bandwidth: FM`.

Do not copy classic UV-5R wide-bit polarity into this codec.

## Duplex off / TX inhibit

NeonPlug and CHIRP encode duplex-off as TX frequency bytes **`FF × 4`**. Studio Web Serial maps library `forbidTransmit` (via `effectiveForbidTransmit` at the app boundary) to `RadioChannelDto.rxOnly` and writes TX bytes `FF×4` on encode; decode sets `rxOnly` when TX is all `FF`.

## What Write keeps

Write starts from the in-session Read and rewrites every slot of the channel span (`0x0000`…`0x7CE0`), a whole record at a time:

| Slot before → after Write | Bytes written                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Live → unchanged channel  | The record as read, byte for byte                                                                      |
| Live → any other channel  | A fresh record: `scode` `1`, `pttid` `0`, other unmodelled bytes and bits `0`, name padded with `0x00` |
| Empty → channel           | A fresh record, as above                                                                               |
| Live → not in the build   | `0xFF × 32`                                                                                            |
| Empty → not in the build  | The record as read (first byte stays `0xFF`)                                                           |

A channel is unchanged when every field Studio models decodes the same as the record in the slot: RX, TX or RX only, both tones, power, `wide`, `scan` and name. Any edit, or a different channel landing in the slot (a channel inserted or deleted earlier in a build without fixed slots shifts every later one), counts as changed, so the record is encoded fresh and never inherits the slot's PTT ID, RX DTMF, BCL, FHSS, scramble, `scode` or reserved bytes. Comparing decoded values means raw forms Studio reads as one value survive an unchanged Write: tone `0x0000` and `0xFFFF` (both none), a DCS index past the table, TX `00×4` (simplex), power values `1`–`3` (all Low), name padding. Nothing in the channel span is kept as a firmware string: `0x1EF0` is inside slots 248 and 249 ([memory-layout.md](memory-layout.md)).

With a library that matches the radio, Read → Write → Read gives the same image. One exception: a library channel always has a name, so a nameless slot gets one on Write. Upload remains **full-image** so VFO/settings/ANI at `0x8040+` stay Read-retained.

Decided in [#1578](https://github.com/pskillen/codeplug-studio/issues/1578).

## Related

- [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- CSV naming cross-check only: [export-formats/chirp/channels.md](../../../export-formats/chirp/channels.md)

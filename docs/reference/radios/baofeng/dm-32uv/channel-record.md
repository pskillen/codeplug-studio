# DM-32UV — channel record

48-byte channel element packed into 4KB metadata-tagged channel blocks (`0x12`…`0x41`). Talk-group selection is **not** inside the channel record — it comes from TX-contact blocks `0x42` / `0x43`.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

This table used to follow NeonPlug `structures.ts` (`parseChannel` / `encodeChannel`). It now follows firmware 048 for the fields that firmware reads ([#1292](https://github.com/pskillen/codeplug-studio/issues/1292)). Name, BCD frequencies, `0x18`, squelch, and tones still follow the NeonPlug packing.

## Geometry

| Fact              | Value                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Record size       | **48** bytes                                                                                                                                                                                                                                                                                                                                                        |
| Max channels      | **4000** ([limits.md](limits.md))                                                                                                                                                                                                                                                                                                                                   |
| First block       | Metadata `0x12`; **16-byte header**; channels from `0x10`; **84** ch                                                                                                                                                                                                                                                                                                |
| Later blocks      | No header; channels from `0x00`; **85** ch                                                                                                                                                                                                                                                                                                                          |
| Count field       | First block `0x00`–`0x01` u16 LE                                                                                                                                                                                                                                                                                                                                    |
| Empty / init fill | Encode path fills `0xFF` before writing fields; **Write** clears unused slots to `0xFF`. Occupied records write modelled fields and **0** for unmodelled bytes the firmware reads ([#1292](https://github.com/pskillen/codeplug-studio/issues/1292)). Full-record replace (no in-record RMW) remains [#685](https://github.com/pskillen/codeplug-studio/issues/685) |
| Name length       | 16 ASCII (null-terminated)                                                                                                                                                                                                                                                                                                                                          |

Last channel offset in first block: `0x10 + 83×48 = 0xFA0`.

## Field offsets (48-byte record)

| Offset        | Field                            | Encoding / notes                                                                                                                               |
| ------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x00`–`0x0F` | Name                             | 16 ASCII, null-terminated                                                                                                                      |
| `0x10`–`0x13` | RX frequency                     | 4-byte BCD (NeonPlug `decodeBCDFrequency`)                                                                                                     |
| `0x14`–`0x17` | TX frequency                     | Same; all `0xFF` = no TX                                                                                                                       |
| `0x18`        | Mode / power / forbid TX         | Bits 7–4 mode; bit 3 forbid TX; bits 2–1 power; bit 0 lone worker                                                                              |
| `0x19`        | Bandwidth / scan-add / scan list | Bit 7 bandwidth; bit 6 scan-add; bits 5–0 scan-list id (1-based, `0` = none, max **32**). Id `32` is `0x20` and does not use bit 6             |
| `0x1A`        | TX admit / APRS RX               | Bits 6–4 TX admit (written 0); bit 2 APRS receive                                                                                              |
| `0x1B`        | Emergency                        | Bit 7 indicator; bit 6 ACK; bits 4–0 system id. Written 0                                                                                      |
| `0x1C`        | Squelch / APRS report            | Bits 7–4 squelch 0–15; bits 3–2 APRS report mode                                                                                               |
| `0x1D`        | Mode-specific features           | Digital: enc / confirms / TDMA / TS / CC; analog: VOX / scramble / …                                                                           |
| `0x1E`        | Encryption key                   | 1-based key index, `0` = none, and only when `0x1F` bit 6 is set. Written **0** until encryption is modelled. Firmware does not read `0x2A`    |
| `0x1F`        | RX group / encryption enable     | Bits 5–0 RX group id (masked on Write). Bit 6 encryption enable, written clear                                                                 |
| `0x20`        | APRS report channel              | 0–7 index. Written **0**                                                                                                                       |
| `0x21`–`0x22` | RX CTCSS/DCS                     | 2-byte CTCSS/DCS encoding                                                                                                                      |
| `0x23`–`0x24` | TX CTCSS/DCS                     | Same                                                                                                                                           |
| `0x25`        | Additional flags                 | Compander dup, VOX-related, …                                                                                                                  |
| `0x26`        | Signalling type                  | Bits 3–1 signalling type. Written 0 (off)                                                                                                      |
| `0x27`        | Unused                           | Firmware 048 does not read this byte. Written **0**. NeonPlug used it for step / signalling                                                    |
| `0x28`        | Reserved                         | Written 0                                                                                                                                      |
| `0x29`        | Step / PTT ID                    | Bits 6–4 step index into 2.5, 5, 6.25, 10, 12.5, 25, 50, 100 kHz (Write uses index **1** = 5 kHz). Bits 3–2 PTT ID, written 0                  |
| `0x2A`        | Unread                           | Firmware never reads this byte. Write still stores 0. NeonPlug treated it as the encryption key id                                             |
| `0x2B`        | DMR radio ID index               | `0xFF` = none (modelled sentinel, not fill); else 0-based index into operator radio-ID bank (`0x67`) from channel `ModeProfile.dmrId` on Write |
| `0x2C`–`0x2F` | Unmodelled tail                  | Written **0** on occupied records                                                                                                              |

### Mode (`0x18` bits 7–4)

| Value | Meaning       |
| ----- | ------------- |
| `0`   | Analog        |
| `1`   | Digital       |
| `2`   | Fixed Analog  |
| `3`   | Fixed Digital |

### Power (`0x18` bits 2–1)

| Value | Meaning |
| ----- | ------- |
| `0`   | Low     |
| `1`   | Medium  |
| `2`   | High    |

### Forbid TX (`0x18` bit 3) and aviation TX frequency

| Condition                          | Wire behaviour                                                         |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `rxOnly` / forbid TX set           | Bit 3 set on `0x18`                                                    |
| RX in **87–136 MHz** and forbid TX | TX frequency bytes `0x14`–`0x17` = `0xFF` (NeonPlug receive-only band) |

Library `forbidTransmit` maps to `rxOnly` on the Web Serial write path (parity with OpenGD77 / UV-5R Mini).

Internal % mapping for file adapters: [power.md](power.md).

### Bandwidth (`0x19` bit 7)

| Bit | Meaning           |
| --- | ----------------- |
| `0` | 12.5 kHz (narrow) |
| `1` | 25 kHz (wide)     |

### Unmodelled fields at Write

Studio does not expose encryption, step, signalling, PTT ID, TX admit, emergency system, or APRS report-channel CRUD. On an occupied Web Serial Write, those bytes are **0** (encryption key off, step index 1 for 5 kHz, signalling and PTT ID off). `0x2B = 0xFF` is still "no radio-ID index". Empty slots stay all `0xFF`. Squelch level 3 remains at `0x1C` bits 7–4. Stock and MM9PDY DM-32UV share this encoder; MM9PDY writes scan-list id **0** (no list) and does not write scan-list records. Re-Read of replaced channel regions must not show prior-radio-only values in those bytes.

## TX contact indirection (talk group)

Channel records do **not** store the DMR talk-group ID. NeonPlug sets `contactId: 0` on parse and resolves TG via:

| Block metadata | Scope                                            |
| -------------- | ------------------------------------------------ |
| `0x42`         | Channels 1–2048 — 2 bytes per channel            |
| `0x43`         | Channels 2049+ and VFO A/B (`0x0FFA` / `0x0FFC`) |

Index into talk-group list in block `0x44`. Full packing: [contacts-zones-lists.md](contacts-zones-lists.md).

## Forbid-TX flag byte (block-relative)

NeonPlug also maintains a forbid-TX related flag **8 bytes before** the channel entry inside the 4KB block (`getChannelFlagByteBlockOffset`). Adapter work should treat channel `0x18` bit 3 and this side flag as related — verify on hardware.

## Related

- [memory-layout.md](memory-layout.md) · [contacts-zones-lists.md](contacts-zones-lists.md) · [settings.md](settings.md)
- CSV naming cross-check only: [export-formats/dm32](../../../export-formats/dm32/README.md)

# DM-32UV — channel record

48-byte channel element packed into 4KB metadata-tagged channel blocks (`0x12`…`0x41`). Talk-group selection is **not** inside the channel record — it comes from TX-contact blocks `0x42` / `0x43`.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `structures.ts` (`parseChannel` / `encodeChannel`), `protocol.ts` (packing).

## Geometry

| Fact              | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Record size       | **48** bytes                                                         |
| Max channels      | **4000** ([limits.md](limits.md))                                    |
| First block       | Metadata `0x12`; **16-byte header**; channels from `0x10`; **84** ch |
| Later blocks      | No header; channels from `0x00`; **85** ch                           |
| Count field       | First block `0x00`–`0x01` u16 LE                                     |
| Empty / init fill | Encode path fills `0xFF` before writing fields                       |
| Name length       | 16 ASCII (null-terminated)                                           |

Last channel offset in first block: `0x10 + 83×48 = 0xFA0`.

## Field offsets (48-byte record)

| Offset        | Field                                 | Encoding / notes                                                     |
| ------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `0x00`–`0x0F` | Name                                  | 16 ASCII, null-terminated                                            |
| `0x10`–`0x13` | RX frequency                          | 4-byte BCD (NeonPlug `decodeBCDFrequency`)                           |
| `0x14`–`0x17` | TX frequency                          | Same; all `0xFF` = no TX                                             |
| `0x18`        | Mode / power / forbid TX              | Bits 7–4 mode; bit 3 forbid TX; bits 2–1 power; bit 0 lone worker    |
| `0x19`        | Bandwidth / scan                      | Bit 7 bandwidth; bit 6 scan add; bits 5–2 scan list id               |
| `0x1A`        | Talkaround / APRS RX                  | Bit 7 forbid talkaround; bit 2 APRS receive                          |
| `0x1B`        | Emergency                             | Bits 7/6 indicators; bits 0–5 system id                              |
| `0x1C`        | Squelch / APRS report                 | Bits 7–4 squelch 0–15; bits 3–2 APRS report mode                     |
| `0x1D`        | Mode-specific features                | Digital: enc / confirms / TDMA / TS / CC; analog: VOX / scramble / … |
| `0x1E`        | (reserved / unused in NeonPlug parse) | —                                                                    |
| `0x1F`        | Digital RX group / analog PTT         | Digital: RX group id bits 5–0; analog: PTT ID                        |
| `0x21`–`0x22` | RX CTCSS/DCS                          | 2-byte CTCSS/DCS encoding                                            |
| `0x23`–`0x24` | TX CTCSS/DCS                          | Same                                                                 |
| `0x25`        | Additional flags                      | Compander dup, VOX-related, …                                        |
| `0x26`        | RX squelch mode / PTT display         | Bit 7 PTT display (dup of `0x1F`); bits 6–4 squelch mode             |
| `0x27`        | Step / signaling                      | Bits 7–4 step; bits 3–0 signaling type                               |
| `0x28`        | Reserved                              | —                                                                    |
| `0x29`        | PTT ID type                           | Bits 7–4 Off/BOT/EOT/Both                                            |
| `0x2A`        | Encryption key id (digital)           | `0` = none; `1`–`8` key index                                        |
| `0x2B`        | DMR radio ID index                    | `0xFF` = none; else 0-based index into radio-ID list                 |
| `0x2C`–`0x2F` | Reserved                              | —                                                                    |

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

Internal % mapping for file adapters: [power.md](power.md).

### Bandwidth (`0x19` bit 7)

| Bit | Meaning           |
| --- | ----------------- |
| `0` | 12.5 kHz (narrow) |
| `1` | 25 kHz (wide)     |

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

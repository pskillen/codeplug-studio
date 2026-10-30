# RadioFoundry codeplug

One file, `codeplug.bin`, for a radio running RadioFoundry. This is the open-firmware codeplug image: a headerless binary whose file offset is the STM32 wire address. It is not a CSV zip, not a stock DM-32 codeplug, and not an OpenGD77 CSV.

|           |                                                                          |
| --------- | ------------------------------------------------------------------------ |
| Format id | `radiofoundry`                                                           |
| Profile   | `radiofoundry-dm32uv`                                                    |
| Delivery  | One CPS file (`cps-file`). No Web Serial and no cable write from Studio. |
| Export    | Shipped                                                                  |
| Import    | Not registered                                                           |

**Length:** 716384 bytes (0xAEE60). Bytes Studio does not write stay `0xFF`. The zone table is the exception: the bitmap and all 68 zone records are zeroed before real zones are written, so byte 0x806F is `0x00`–`0x04` and the radio keeps the 80-channel zone layout.

Hardware caps, including the shared contact bank and the nine power steps, are the [DM-32UV (RadioFoundry) limits](../../radios/baofeng/dm-32uv-radiofoundry/limits.md). Names on the wire are 16 ASCII characters, `0xFF` padded, with no NUL. The radio name is 8 characters, taken from the default DMR radio ID's name. An empty radio name is `0xFF` bytes. A 17th character, or a radio name past 8, is truncated and warned. Non-ASCII characters are replaced or dropped, with a warning.

References on the wire are 1-based indexes assigned at export. Names are labels, not keys.

## What is written

- Channels: FM (mode byte 0) and DMR (mode byte 1) only. A channel with both keeps `primaryMode` and warns. Any other mode is dropped with a warning. Channels past the cap are dropped with a warning.
- The default DMR radio ID, 8 BCD digits, big-endian, in general settings. Export fails with an error the operator can read when that ID is missing or outside 1–16776415. Other own IDs are not written into the radio-wide slot. A channel that points at a different own ID gets the per-channel override.
- Talk groups and private contacts in one table. Call type is group, private, or all-call. Byte 0x17 is `0x01` (no timeslot override).
- RX lists. The length-table byte is the member count plus 1, or 0 when the list is unused. Extra members are truncated with a warning.
- Zones. Member lists are 1-based channel numbers. The first 0 ends the list. Nested zone members are already flattened before this writer runs. Extra zones are dropped and extra members truncated, each with a warning.
- Power: null writes 0 (the radio's own default). A percent from 1 to 100 is split into nine equal steps and written as step + 1 (1 through 9). The watt value of each step is unmeasured.
- Bandwidth: 25 kHz sets the bit. 12.5 kHz clears it. Any other value is written as 12.5 kHz, with a warning.
- Squelch percent maps onto 0–21. Null writes 0.
- Frequencies are BCD of 10 Hz units, stored as a little-endian 32-bit word. A frequency outside 136–174 MHz and 400–480 MHz is a warning, not a failed export.

## What this version leaves out

Left as `0xFF`, with no records written:

- DMR ID database, LUCZ, APRS, boot text, VFOs, quick keys
- CTCSS/DCS (tone bytes are `0xFFFF`)
- DTMF / analog contacts
- Scan lists. Each scan list produces a warning. Studio does not add a carrier channel, does not run repeater-times-talk-group expansion, and does not clone talk groups per timeslot.

Layout detail is RadioFoundry's own spec (`docs/spec/open-firmware-cps.md` and `docs/spec/tftp.md` section 3). This page does not restate that byte table.

# RadioFoundry codeplug

One file, `codeplug.bin`, for a radio running RadioFoundry. This is the open-firmware codeplug image: a headerless binary whose file offset is the STM32 wire address. It is not a CSV zip, not a stock DM-32 codeplug, and not an OpenGD77 CSV.

|           |                                                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format id | `radiofoundry`                                                                                                                                                    |
| Profile   | `radiofoundry-dm32uv`                                                                                                                                             |
| Delivery  | One CPS file (`cps-file`). Cable write is a separate egress on the same radio target: [programming cable](../../radios/baofeng/dm-32uv-radiofoundry/protocol.md). |
| Export    | Shipped                                                                                                                                                           |
| Import    | Shipped. The same `codeplug.bin` parses into library entities.                                                                                                    |

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
- FM RX and TX tones. None is `0xFFFF`. CTCSS is BCD tenths of Hz (88.5 Hz is `0x0885`). DCS sets bit 15, and bit 14 when inverted (`D023N` is `0x8023`, `D023I` and `D023P` are `0xC023`). A tone the radio would ignore is written as none, with a warning.
- Receive-only, from the channel's transmit setting. Scan skip sets both scan-skip bits; otherwise both are clear. A fixed location is the 24-bit coordinate and its flag. A DMR channel in direct mode sets that flag. Talker alias sets the text bit for the channel's timeslot. The APRS bits in that byte stay clear.
- A written channel slot replaces all 56 bytes. Fields the library does not model are zero, which means the radio uses its own TX timeout, SFR is off, beep is on, power saving is on, the channel is not roaming or out of band, VOX and talkaround are off, the vendor power and squelch bits are clear, channel byte 0x2D (the OpenGD77 APRS index) is 0, talker-alias APRS bits are clear, flag 2 holds only the timeslot, STE is off, and the VFO offset and step are zero. This firmware does not read byte 0x2D, so the channel report slot is not stored there. A cable write sends those zeros. It does not keep the radio's previous bytes in that slot.
- APRS configurations. All 8 records (EEPROM image 0x1588, 64 bytes each) are owned. A record Studio does not fill is 0xFF throughout, so an older configuration cannot remain. With no library APRS configuration, every record is that empty record. With a library configuration, record 1 carries the configuration name (8 bytes, 0xFF padded; an empty name is written as `APRS`, because a first byte of 0x00 or 0xFF means the record is empty) and the comment (23 bytes at offset 0x1F, 0xFF padded). A name or comment that does not fit is truncated and warned. The magic is 0x4153. The firmware reads only record 1, and from that record it uses the comment. It also takes the digipeater path, but only when the path is empty, `WIDE1-1`, `WIDE1-1,WIDE2-1`, `WIDE2-1`, or `WIDE2-2`. The library has no digipeater path. A blank path would be read as None and would replace the path the radio is using, so record 1's first path callsign is `X`, which this firmware ignores, and the radio keeps its current path. Fixed latitude, longitude, and TX frequency stay 0 because the firmware does not use them. Sender SSID and symbol stay 0 because the firmware parses them and does not apply them. Destination ID, beacon interval, and position source live in the settings ring, which the cable protocol refuses, so they are not written. Records 2–8 stay empty.
- Unused channel records are not written. A channel is empty when its in-use bit is clear, and those bitmaps are cleared and owned.
- The contact table is fully replaced, up to the contact cap. An unused slot is `0xFF` throughout, which the firmware treats as empty. A later slot does not keep a contact that used to sit there.
- An RX list is unused when its length-table byte is 0. That byte is owned. The list record is not written: the firmware does not read it when the length is 0. A list that has members is replaced in full.
- Zones: the bitmap and every zone record are owned. Unused zone slots are the zeroed empty record.
- Frequencies are BCD of 10 Hz units, stored as a little-endian 32-bit word. A frequency outside 136–174 MHz and 400–480 MHz is a warning, not a failed export.

## What is read

Import uses the same file. A file shorter than 716384 bytes is rejected with an error the operator can read. A longer file is a codeplug in the first 716384 bytes. Bytes after that, including padding or a DMR ID database, are ignored.

The reader walks channel-bank bitmaps and the zone bitmap. References are the same 1-based indexes the exporter writes.

- An in-use channel becomes a library channel. Mode 0 is FM and mode 1 is DMR. Name, RX and TX frequency, power, squelch, CTCSS/DCS, bandwidth, color code, timeslot, TX contact, RX list, per-channel DMR ID, RX-only, and fixed location are copied when the record has them. VFO A and VFO B are not channels.
- The 8-byte callsign and the 8 BCD radio ID become the default own digital ID (name and number). A per-channel DMR ID that differs from that ID becomes another own digital ID.
- A group contact becomes a talk group. A private contact becomes a digital contact. Call type 2 becomes talk group 16777215. A slot whose first byte is `0xFF`, or whose call type is `0xFF`, is skipped.
- An RX list whose length-table byte is not 0 becomes an RX list. Member indexes point at contacts.
- An in-use zone becomes a zone. Byte 0x806F selects the record: `0x00`–`0x04` is 80 channels per zone, and `0xFF` is the 16-channel layout (68 records of 48 bytes, name then 16 channel numbers). Any other value is rejected. The exporter writes the 80-channel layout.

Contact byte 0x17 equal to `0x01` means no timeslot override. The library has no field for a contact timeslot override, so any other value is left unread. APRS records, DTMF contacts, and the DMR ID database are not imported. There is no scan-list record to read.

## What export leaves out

Left as `0xFF`, with no records written:

- DMR ID database, LUCZ, boot text, VFOs, quick keys
- DTMF / analog contacts
- Scan lists. Each scan list produces a warning. Studio does not add a carrier channel, does not run repeater-times-talk-group expansion, and does not clone talk groups per timeslot.

Layout detail is RadioFoundry's own spec (`docs/spec/open-firmware-cps.md` and `docs/spec/tftp.md` section 3). This page does not restate that byte table.

# DM-32UV (RadioFoundry) — programming cable

Cable write for a Baofeng DM-32UV running RadioFoundry. The [codeplug file](../../../export-formats/radiofoundry/README.md) stays. This page is the other egress on the same radio target: `radio-io-dm32uv-radiofoundry`, labelled Web Serial. Desktop uses the browser serial port. The Android app uses the same baud on USB serial. There is no transport picker.

|           |                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baud      | 115200 8N1. No second baud.                                                                                                                                        |
| Command   | Fast CODEPLUG. Debug-link command `0x1C`, direct mode.                                                                                                             |
| Addresses | Image offsets. The radio adds physical `0x700000`. Studio does not send that base. The codeplug image ends at `0xAEE60`. ID-database overflow starts at `0xD8000`. |
| Blocks    | 4096 bytes, and only a block whose bytes changed. A blank block is not sent as data.                                                                               |
| Commit    | COMMIT reloads the codeplug. Studio does not reboot the radio.                                                                                                     |

The image is the one [RadioFoundry codeplug](../../../export-formats/radiofoundry/README.md) export builds (`assemble`, then the codeplug serialiser).

## Digital contacts

Ticking **Digital contacts** chooses Contacts, ID directory, or Both. Leaving it unticked releases the private-contact slots this write would have filled, so those slots stay as the radio had them. It does not change channels, zones, talk groups, or RX lists. Every other contact slot is still written. An unused slot is the empty record.

| Source       | What is sent                                                                                                                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contacts     | Private DMR contacts already stored in the codeplug contact table. If those bytes match the radio, progress says no contact blocks changed.                                                                                                                                                        |
| ID directory | DMR ID database. Header `Id`, format `N`, 27-byte records sorted by DMR ID, at image `0x50000` (256 KB, 9,708 records). Rows past that continue at image `0xD8000` and stop before the native codeplug at `0x800000` (287,629 records). The radio adds `0x700000`. Studio does not send that base. |
| Both         | The contact table and the DMR ID database.                                                                                                                                                                                                                                                         |

Rows that do not fit before the native codeplug are dropped with a warning. The voice-prompt area, and the gap between the codeplug image and `0xD8000`, are not written. A codeplug-only write leaves `0x50000` and `0xD8000` unowned. An empty chosen source does not claim that contacts will be written.

## Written slots

A cable write replaces every byte of a channel, zone, contact, talk group, or RX-list slot it writes. The radio read is not a source for those bytes.

- A channel that is in use is all 56 bytes. Unmodelled fields are zero, which means: TX timeout follows the radio-wide timeout, SFR is off, beep is on, power saving is on, the channel is not roaming or out of band, VOX and talkaround are off, the vendor power and squelch bits are clear, there is no APRS configuration, talker-alias APRS bits are clear, flag 2 holds only the timeslot, STE is off, and the VFO offset and step are zero. The text bit of talker alias still follows the library. APRS is not implemented.
- An unused channel record is not written. The in-use bitmap is owned and cleared, and a clear bit means that record is empty.
- The zone bitmap and every zone record are owned. An unused zone slot is the zeroed empty record.
- Every contact slot is owned. Talk groups and private contacts share the table. An unused slot is `0xFF` throughout, the empty record. A slot after the last written contact does not keep the contact that used to be there. Unticking Digital contacts releases only the private-contact records, as above.
- The RX-list length table is owned and zeroed. 0 means unused. The firmware does not read a list record whose length byte is 0, so that record is not written. A list with members is replaced in full.

## What is not written

- An address the serialiser does not own. The byte read from the radio stays. That includes general settings other than the callsign and the radio DMR ID, voice prompts, factory calibration, the settings ring, the sector journal, and the native codeplug area. The DMR ID database stays unowned unless that source is selected.
- Anything below the open-firmware image.

Studio does not speak the stock DM-32 programmer, and it does not speak the OpenGD77 `R` / `X` / `W` codec. If the radio does not answer the fast command, the write stops.

**Code:** `src/integrations/radio-io/radios/dm32uv-radiofoundry/`.

Hardware caps: [limits.md](limits.md).

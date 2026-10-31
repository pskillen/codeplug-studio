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

Ticking **Digital contacts** chooses Contacts, ID directory, or Both. Leaving it unticked does not clear the contact table, and it does not change channels, zones, talk groups, or RX lists.

| Source       | What is sent                                                                                                                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contacts     | Private DMR contacts already stored in the codeplug contact table. If those bytes match the radio, progress says no contact blocks changed.                                                                                                                                                        |
| ID directory | DMR ID database. Header `Id`, format `N`, 27-byte records sorted by DMR ID, at image `0x50000` (256 KB, 9,708 records). Rows past that continue at image `0xD8000` and stop before the native codeplug at `0x800000` (287,629 records). The radio adds `0x700000`. Studio does not send that base. |
| Both         | The contact table and the DMR ID database.                                                                                                                                                                                                                                                         |

Rows that do not fit before the native codeplug are dropped with a warning. The voice-prompt area, and the gap between the codeplug image and `0xD8000`, are not written. A codeplug-only write leaves `0x50000` and `0xD8000` unowned. An empty chosen source does not claim that contacts will be written.

## What is not written

- A byte the serialiser leaves as `0xFF` because it does not own that address. The byte read from the radio stays.
- The per-channel TX timeout, the SFR bytes, and the flag bits for no beep, no power saving, roaming, and VOX. Studio writes the other bits in those flag bytes.
- The settings ring, the sector journal, the native codeplug area, and factory calibration.
- Anything below the open-firmware image.

Studio does not speak the stock DM-32 programmer, and it does not speak the OpenGD77 `R` / `X` / `W` codec. If the radio does not answer the fast command, the write stops.

**Code:** `src/integrations/radio-io/radios/dm32uv-radiofoundry/`.

Hardware caps: [limits.md](limits.md).

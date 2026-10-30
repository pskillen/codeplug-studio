# DM-32UV (RadioFoundry) — programming cable

Cable write for a Baofeng DM-32UV running RadioFoundry. The [codeplug file](../../../export-formats/radiofoundry/README.md) stays. This page is the other egress on the same radio target: `radio-io-dm32uv-radiofoundry`, labelled Web Serial. Desktop uses the browser serial port. The Android app uses the same baud on USB serial. There is no transport picker.

|           |                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| Baud      | 115200 8N1. No second baud.                                                                                              |
| Command   | Fast CODEPLUG. Debug-link command `0x1C`, direct mode.                                                                   |
| Addresses | Image offsets inside the codeplug image (`0xAEE60`). The radio adds physical `0x700000`. Studio does not send that base. |
| Blocks    | 4096 bytes, and only a block whose bytes changed. A blank block is not sent as data.                                     |
| Commit    | COMMIT reloads the codeplug. Studio does not reboot the radio.                                                           |

The image is the one [RadioFoundry codeplug](../../../export-formats/radiofoundry/README.md) export builds (`assemble`, then the codeplug serialiser).

## What is not written

- A byte the serialiser leaves as `0xFF` because it does not own that address. The byte read from the radio stays.
- The settings ring, the sector journal, the native codeplug area, and factory calibration.
- Anything below the open-firmware image.

Studio does not speak the stock DM-32 programmer, and it does not speak the OpenGD77 `R` / `X` / `W` codec. If the radio does not answer the fast command, the write stops.

**Code:** `src/integrations/radio-io/radios/dm32uv-radiofoundry/`.

Hardware caps: [limits.md](limits.md).

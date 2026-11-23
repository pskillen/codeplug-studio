# DM-32UV (RadioFoundry) — programming cable

Cable write for a Baofeng DM-32UV running RadioFoundry. The [codeplug file](../../../export-formats/radiofoundry/README.md) stays. This page is the other egress on the same radio target: `radio-io-dm32uv-radiofoundry`, labelled Web Serial. Desktop uses the browser serial port. The Android app uses the same baud on USB serial. There is no transport picker.

|           |                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baud      | 115200 8N1. No second baud.                                                                                                                                        |
| Command   | Fast CODEPLUG. Debug-link command `0x1C`, direct mode.                                                                                                             |
| Addresses | Image offsets. The radio adds physical `0x700000`. Studio does not send that base. The codeplug image ends at `0xAEE60`. ID-database overflow starts at `0xD8000`. |
| Blocks    | 4096 bytes, and only a block whose bytes changed. A blank block is not sent as data.                                                                               |
| Identity  | INFO, then VERSION. Board names `DM-32UV`, `DM-32`, `dm32`; see [firmware](../../radiofoundry/firmware.md).                                                        |
| Commit    | COMMIT reloads the codeplug. Studio does not reboot the radio.                                                                                                     |

The image is the one [RadioFoundry codeplug](../../../export-formats/radiofoundry/README.md) export builds (`assemble`, then the codeplug serialiser).

## Layout from INFO

This board: EEPROM image `0x10000`, flash image start `0x20000`, image end `0x800000` (the ID database ceiling), physical base `0x700000`. The checks Studio makes on INFO, the base and the board name are in [guards](../../radiofoundry/cable-write.md#guards). The app picks this protocol by the RadioFoundry profile family, not by the DM-32UV's profile id.

## Digital contacts

See [cable write](../../radiofoundry/cable-write.md#digital-contacts). On this board the ID directory is 9,708 records in area 1 (image `0x50000`, 256 KB) and 287,629 in all, stopping before the native codeplug at `0x800000`.

## Written slots

See [cable write](../../radiofoundry/cable-write.md#written-slots).

## APRS

See [cable write](../../radiofoundry/cable-write.md#aprs).

## What is not written

See [cable write](../../radiofoundry/cable-write.md#what-is-not-written). **Code:** `src/integrations/radio-io/radios/radiofoundry/`. Hardware caps: [limits.md](limits.md).

## Link framing

Same K1 jack, UART0 and USB-serial cable as stock; see [stock transport and framing](../dm-32uv/protocol.md#transport-and-framing). Debug-link frames are `A5 5A cmd seq len payload CRC16`, with at most 64 payload bytes, encoded by the shared codec `src/integrations/radio-io/kit/codecs/radioFoundryDebugLink.ts`. Once `A5 5A` is seen the radio waits up to **200 ms** for the next byte, then drops the frame and resynchronises on the next `A5 5A`. A bad CRC gets an error frame. Studio checks CRC16, sequence and status on every reply, so a write split by the host is not a risk here (the gap is far below 200 ms). This comes from the RadioFoundry spec; the radio's receive code was not read.

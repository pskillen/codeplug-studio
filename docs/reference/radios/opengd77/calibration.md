# OpenGD77 calibration working copy (DM-1701, MD-9600)

Tier-3 reference for the 512-byte calibration table that OpenGD77 STM32 firmware serves at flash address `0x10000`, and how the debug pages read and decode it. Code: `src/core/radios/opengd77/calibration.ts` (layout), `src/integrations/radio-io/radios/opengd77/debugCalibration.ts` (read and selection).

> **This is the OpenGD77 working copy, not stock factory calibration.** It is not validated on hardware ([#1716](https://github.com/pskillen/codeplug-studio/issues/1716) stays open for that). Nothing here gives a value a physical unit, a valid range or a health verdict.

## Provenance

Layout facts come from reading two OpenGD77 firmware source snapshots, owner-supplied and read only; no source text is copied here.

| Tree                     | Snapshot   | Used for |
| ------------------------ | ---------- | -------- |
| MDUV380 / DM-1701 family | 2026-01-30 | DM-1701  |
| MD-9600                  | 2026-01-31 | MD-9600  |

Both declare the same byte-only (no alignment) 512-byte table, apart from the meaning of the slot at `0x1A0` below. Offsets here follow **declaration order**, not the source comments, which contain mistakes: the VHF oscillator tune is commented as UHF, and VHF CTCSS 151.4 Hz is commented `0x9B` but sits at `0xAB`. Whether a given firmware build uses the same layout is unknown; the viewer shows the radio's reported revision and build date next to this caveat.

## How the firmware keeps it

At startup the loader reads the factory data from the flash security-register block, then keeps two copies: a local copy in normal flash at `0x10000..0x101FF` and a RAM working copy. The local copy is used when the eight bytes at offset `0x1B0` equal the marker `00 25 00 40 00 45 01 40`; otherwise the loader reads the factory data, writes the marker over those eight bytes and writes the local copy. The marker is not a checksum.

On the DM-1701 tree the factory import also scales the low, mid and high power values per model and fills the very-low slots, so the working copy there is already derived from the factory values.

A mode-1 flash read lying wholly inside `0x10000..0x101FF` is answered from the RAM working copy, not from a fresh flash read. A read that crosses the boundary takes the ordinary flash path, so the capture reads 16 aligned blocks of 32 bytes (`52 01 <addr> 00 20`, addresses `0x10000` to `0x101E0`).

## Offset table

Bands: UHF arrays hold 9 bytes (nine frequency points), VHF arrays 5 bytes. Every field is `uint8` or an array of `uint8`.

| Offset                                | Field                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `00`..`05`                            | VOX level 1, VOX level 10, RX low voltage, RX high voltage, RSSI -120 dBm, RSSI -70 dBm (one byte each; RX voltages: exact use unknown)        |
| `06`..`08`                            | unknown                                                                                                                                        |
| `09`, `0C`                            | UHF oscillator tune, VHF oscillator tune                                                                                                       |
| `0A`..`0B`, `0D`..`0F`                | unknown                                                                                                                                        |
| `10` / `19`                           | High power UHF[9] / VHF[5]                                                                                                                     |
| `20` / `29`                           | Low power UHF[9] / VHF[5]                                                                                                                      |
| `30` / `39`                           | RX front-end tuning UHF[9] / VHF[5]                                                                                                            |
| `40`, `50`, `60`, `70`                | UHF squelch open 9, close 9, open 1, close 1 (9 each, 7 unknown after each)                                                                    |
| `90` / `9B`, `A0` / `AB`, `B0` / `BB` | CTCSS deviation 67, 151.4, 254.1 Hz, UHF[9] / VHF[5]                                                                                           |
| `D0` / `DB`                           | DCS deviation UHF[9] / VHF[5]                                                                                                                  |
| `E0`, `E5`, `EA`, `EF`                | VHF squelch open 9, close 9, open 1, close 1 (5 each)                                                                                          |
| `100`                                 | VHF frequency points: 10 entries of 4 BCD bytes (5 RX/TX pairs)                                                                                |
| `130` / `139`, `140` / `149`          | DMR I gain, DMR Q gain, UHF[9] / VHF[5]                                                                                                        |
| `170` / `179`, `180` / `189`          | FM I gain, FM Q gain, UHF[9] / VHF[5]                                                                                                          |
| `190` / `199`                         | Mid power UHF[9] / VHF[5]                                                                                                                      |
| `1A0` / `1A9`                         | MD-9600 tree: mid-low power. DM-1701 tree: very-low power (the firmware says official firmware does not use it). The meaning follows the model |
| `1B0`                                 | UHF frequency points: 18 entries of 4 BCD bytes (9 RX/TX pairs); entries 0 and 1 (`1B0`..`1B7`) are the local marker                           |

Every other byte is shown as an unknown range (for example `79`..`8F`, `C0`..`CF`, `F4`..`FF`, `128`..`12F`, `150`..`16F`, `1F8`..`1FF`).

Frequency entries are shown as the stored digits (each byte's high then low nibble, as stored) with no unit claim; a nibble above 9 shows "invalid BCD" with its raw bytes. When the marker is absent, no value is decoded: only raw bytes are shown, because the layout the loader writes is not what is there.

## Confidence vocabulary

| Axis    | Values                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout  | `source-declared`: the offset and width come from the declaration order in the two snapshots; not checked on hardware                                                     |
| Meaning | `named`: the source names the field. `partial`: the source says the use is unknown, or the digits have no stated unit. `unknown`: unnamed bytes (shown as unknown ranges) |

## What is not claimed

- The stock firmware's location or format for calibration.
- Physical units, valid ranges, or whether the radio is healthy or well calibrated.
- That the working copy equals the stored flash copy, or the factory values.
- Hardware validation: tracked in [#1716](https://github.com/pskillen/codeplug-studio/issues/1716).
- Any other OpenGD77 build or fork matching these two snapshots.

## Not read: security registers (mode 10)

The factory data lives in the flash security registers, readable with mode 10. The debug capture does not use it and the allow-list refuses every mode-10 frame. The source passes a block index (not a byte offset) and its loop reads one block more than asked, so a factory initialisation call writes 256 bytes past its 512-byte destination; whether a given build is affected is unknown. Mode 10 stays off until that is reviewed.

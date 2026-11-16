# MD-9600 / RT-90 calibration working copy

Tier-3 reference for the 512-byte OpenGD77 calibration table on the MD-9600 / RT-90: what each byte is, its unit, what in OpenGD77 reads it, and how sure we are. Code: `src/core/radios/opengd77/calibration.ts` (layout and decode), `src/integrations/radio-io/radios/opengd77/debugCalibration.ts` (read and selection). Shared mechanics (marker, read path, what is not claimed): [OpenGD77 calibration.md](../../opengd77/calibration.md). Sibling model: [DM-1701 calibration.md](../../baofeng/dm-1701/calibration.md).

> **This is the OpenGD77 working copy, not stock factory calibration.** Not validated on hardware. Nothing here says a value is good, bad or healthy.

## Provenance

Read from the OpenGD77 source, MD-9600 tree, snapshot 2026-01-31 (the `M` tree; paths below are relative to its `application/`), by static reading only; nothing built, run or sent, and no owner radio repository exists for these radios. Evidence is the source file and line in each row. The source comments contain mistakes, so offsets follow declaration order (every member is a `uint8_t`).

Bytes `000-0FF` are flash security register 1 and `100-1FF` register 2 (factory data, read by `SPI_Flash_readSecurityRegisters`, `SPI_Flash.c:307-325`). The local copy is flash `0x10000-0x101FF` and the RAM working copy is `calibrationData`; a read wholly inside that range is answered from RAM (`usb_com.c:177-182`).

**The MD-9600 copies the factory bytes unchanged** apart from the marker (`calibration.c:172-197`).

## Frequency grids the consumers use

Frequencies are in 10 Hz units; above 300 MHz is UHF. UHF has 9 points, 400 to 480 MHz every 10 MHz, in both models.

| Table                   | VHF points (5)                  | Evidence                                                  |
| ----------------------- | ------------------------------- | --------------------------------------------------------- |
| Power                   | 136, 145.5, 155, 164.5, 174 MHz | `trx.c:60-76`, `calibration.c:436-553` (VHF step 9.5 MHz) |
| I/Q gains and RX tuning | 136, 145.5, 155, 164.5, 174 MHz | `calibration.c:243-471` (`calIQTableMinFreq`)             |

Interpolation is linear (`interpolate()`, `calibration.c:473-476`). Above the top point the remainder is taken from the band minimum, so power, I/Q gains and RX tuning go wrong above 480 MHz UHF and above the top VHF point (a firmware bug, not a Studio one).

## Power points

| Slot          | UHF / VHF offsets | Point             | Notes                                                                            |
| ------------- | ----------------- | ----------------- | -------------------------------------------------------------------------------- |
| High power    | `010` / `019`     | 40 W (TX level 8) | Level 8 (`trx.c:825-865`).                                                       |
| Mid power     | `190` / `199`     | 25 W (TX level 7) |                                                                                  |
| Low power     | `020` / `029`     | 5 W (TX level 5)  | Levels 0 to 4 (100 mW to 1 W) are Low x 0.82 to 0.90 (VHF) / 0.41 to 0.64 (UHF). |
| Mid-low power | `1A0` / `1A9`     | 10 W (TX level 6) | Copied from the factory data.                                                    |

On-radio calibration menu labels match: 5 W / 10 W / 25 W / 40 W (`menuCalibration.c:58-70`). TX level 9 (`+W-`) bypasses calibration: the DAC code is `settings.userPower` (`trx.c:858`). Power values are DAC codes divided by 16 (the firmware uses `byte << 4` as a 12-bit DAC value), not watts.

## Field table

"Reader" is what in OpenGD77 reads the member (the whole-table copies of SPI load/save, USB read and CPS staging do not count). Confidence: **traced** = the source names the field and its reader (or the absence of one) was traced; **partly** = inferred, or the reader is known but the stock meaning is not.

| Offset                                      | Size     | Field                                           | Unit / encoding                                                                                                                     | Reader                                                                               | Confidence        | Evidence                                                    |
| ------------------------------------------- | -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------- |
| `000`, `001`                                | 1, 1     | VOX level 1, 10                                 | stock VOX thresholds                                                                                                                | none                                                                                 | traced            | `calibration.c:39-40`, no references                        |
| `002`, `003`                                | 1, 1     | RX low / high voltage                           | unknown (source: "exact use unknown")                                                                                               | none                                                                                 | partly            | `calibration.c:41-42`; `adc.c:85`                           |
| `004`, `005`                                | 1, 1     | RSSI -120 / -70 dBm                             | stock S-meter references                                                                                                            | none (getter "Not Used")                                                             | traced            | `calibration.c:615-622`; `menuRSSIScreen.c:83`              |
| `009`                                       | 1        | UHF oscillator tune                             | offset binary: signed trim = byte - 128                                                                                             | `trxUpdateC6000Calibration`: HR-C6000 page 4 registers `0x47`, `0x48` (sign), `0x04` | traced            | `calibration.c:598-613`; `trx.c:906-916`                    |
| `00C`                                       | 1        | VHF oscillator tune                             | same (the source comment says UHF; the getter maps VHF here)                                                                        | same, VHF                                                                            | traced            | `calibration.c:600`                                         |
| `010` / `019`                               | 9 / 5    | High power                                      | DAC code / 16, 40 W point                                                                                                           | `calibrationGetPowerForFrequency` then `trxUpdate_PA_DAC_Drive`                      | traced            | `trx.c`                                                     |
| `020` / `029`                               | 9 / 5    | Low power                                       | DAC code / 16, 5 W point                                                                                                            | same                                                                                 | traced            | `trx.c`                                                     |
| `030` / `039`                               | 9 / 5    | RX front-end tuning                             | varactor DAC code / 16                                                                                                              | `trx.c:924-928`                                                                      | traced            | `radioHardwareInterface.c:395-399`                          |
| `040`, `050`, `060`, `070`                  | 9 each   | UHF squelch open 9 / close 9 / open 1 / close 1 | stock thresholds                                                                                                                    | none (OpenGD77 squelch is its own, `trx.c`)                                          | traced            | no references                                               |
| `0E0`, `0E5`, `0EA`, `0EF`                  | 5 each   | VHF squelch, same four                          | stock thresholds                                                                                                                    | none                                                                                 | traced            | no references                                               |
| `090` / `09B`, `0A0` / `0AB`, `0B0` / `0BB` | 9 / 5 x3 | CTCSS deviation 67 / 151.4 / 254.1 Hz           | stock deviation                                                                                                                     | none (OpenGD77 hard-codes it, `HR-C6000.c:2792-2840`)                                | traced            | the 151.4 Hz VHF offset is `0xAB`, not the commented `0x9B` |
| `0D0` / `0DB`                               | 9 / 5    | DCS deviation                                   | stock deviation                                                                                                                     | none                                                                                 | traced            | `HR-C6000.c:2792-2840`                                      |
| `100`                                       | 10 x4    | VHF calibration frequencies                     | u32 little-endian BCD, 10 Hz units; 5 RX/TX pairs, RX first                                                                         | none                                                                                 | partly (inferred) | marker comment `calibration.c:170`                          |
| `130` / `139`                               | 9 / 5    | DMR I gain                                      | HR-C6000 page 4 register `0x45`, by TX frequency                                                                                    | `HRC6000SetDMR`                                                                      | traced            | `HR-C6000.c:2869-2870`                                      |
| `140` / `149`                               | 9 / 5    | DMR Q gain                                      | register `0x46`                                                                                                                     | same                                                                                 | traced            | same                                                        |
| `170` / `179`                               | 9 / 5    | FM I gain                                       | register `0x45`, analogue TX                                                                                                        | `HRC6000SetFMTx`                                                                     | traced            | `HR-C6000.c:2786-2787`                                      |
| `180` / `189`                               | 9 / 5    | FM Q gain                                       | register `0x46`                                                                                                                     | same                                                                                 | traced            | same                                                        |
| `190` / `199`                               | 9 / 5    | Mid power                                       | DAC code / 16, 25 W point                                                                                                           | power path                                                                           | traced            | `trx.c`                                                     |
| `1A0` / `1A9`                               | 9 / 5    | Mid-low power                                   | DAC code / 16, 10 W point                                                                                                           | power path                                                                           | traced            | `calibration.c`                                             |
| `1B0`                                       | 18 x4    | UHF calibration frequencies                     | same encoding, 9 RX/TX pairs; entries 0-1 (`1B0-1B7`) are the OpenGD77 marker `00 25 00 40 00 45 01 40` = 400.02500 / 400.14500 MHz | only the marker check                                                                | partly (inferred) | `calibration.c:169-181`                                     |

Frequency points are shown as `digits / 100000` MHz (the bytes reversed, then read as BCD), with the raw bytes kept. The RX tuning row is read: varactor tuning voltage, DAC code / 16 (`byte << 4`), interpolated over the RX frequency; UHF on DAC channel 1, VHF on DAC channel 2 (`trx.c:924-928`, `radioHardwareInterface.c:395-399`). Not editable from the on-radio menu.

## Bytes nothing reads

Studio labels a row **not used by OpenGD77** when no OpenGD77 code reads it: 20 named rows on the MD-9600 / RT-90 (VOX, RSSI, squelch, CTCSS, DCS), plus the 2 RX voltage rows and the stock tuning points. Counting those and the unnamed ranges below, **376 of 512 bytes have no reader** (222 in named rows, 154 in unnamed ranges); 136 bytes in named rows are read.

### The 24 unnamed ranges (154 bytes)

No OpenGD77 code reads or writes any of them (zero references to any `Unknown*` member; only whole-table copies). Whether stock firmware uses them cannot be settled from this source, so Studio shows each as "not used by OpenGD77; stock meaning unknown". Same ranges in both models.

| Range                                                                                  | Bytes   | Class                                                       |
| -------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| `006-008`, `00A-00B`, `00D-00F`                                                        | 3, 2, 3 | header, unnamed                                             |
| `01E-01F`, `02E-02F`, `03E-03F`, `13E-13F`, `17E-17F`, `18E-18F`, `19E-19F`, `1AE-1AF` | 8 x 2   | row spares (16-byte rows are UHF[9] + VHF[5] + 2, inferred) |
| `14E-16F`                                                                              | 34      | row spare (2) and two whole unnamed rows `150-16F` (32)     |
| `099-09A`, `0A9-0AA`, `0B9-0BA`, `0D9-0DA`                                             | 4 x 2   | gap between UHF[9] and VHF[5] in CTCSS/DCS rows             |
| `049-04F`, `059-05F`, `069-06F`                                                        | 3 x 7   | UHF squelch row tails                                       |
| `079-08F`                                                                              | 23      | row tail (7) and whole unnamed row `080-08F` (16)           |
| `0C0-0CF`                                                                              | 16      | whole unnamed row                                           |
| `0F4-0FF`                                                                              | 12      | end of security register 1                                  |
| `128-12F`                                                                              | 8       | after the VHF frequency points                              |
| `1F8-1FF`                                                                              | 8       | end of security register 2                                  |

## Studio counts

70 rows: 40 traced, 30 partly (28 frequency-point rows plus the 2 RX voltage rows), 0 unknown. 358 bytes in rows, 154 bytes in classified-unused ranges, 0 bytes undecoded.

## Not claimed

Stock (TYT / Baofeng) meaning of the unnamed bytes and of `002` / `003`; physical units (watts, dBm, Hz of deviation); that the working copy equals factory values; hardware validation; any other OpenGD77 build or fork.

# DM-32UV — calibration page and factory sector

Firmware 048 field layout for the backup panel and the debug Calibration tab. Rules for which page is live, the factory-sector double read, and the Write/Restore skip are in [backup-restore.md](backup-restore.md). There is **no checksum** on the calibration page.

**Hub:** [README.md](README.md)

Layout and meaning are traced by static analysis of stock `DM32.01.L01.048` (the radio repo's decode research and its adjust-mode map), not validated on hardware. MM9PDY or other builds may differ. No value has a physical unit: static analysis gives raw register, DAC or ADC units, never watts or dB.

## In-range calibration page

Tag `0x02` at offset `+0xFFF` is the calibration page only inside the live V-frame `0x0A` window (block addresses from `addressBase` through `alignedEnd`). The lowest in-range address is the live page. Every higher in-range `0x02` is a duplicate, not the live page. A page that ends in `0x02` outside the window is not calibration.

| Offset                                           | What                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+0x000`                                         | UHF band low/high, 2× u16 LE BCD, 100 kHz units (interpolation domain, not a TX limit)                                                                                                                  |
| `+0x0CC`                                         | VHF band low/high, same                                                                                                                                                                                 |
| `+0x300`, `+0x314`, `+0x328`, `+0x33C`           | 5× u32 LE BCD frequency points (UHF RX, UHF TX, VHF RX, VHF TX), 10 Hz units; also the adjust-mode and PCTESTM test frequencies                                                                         |
| `+0x040` / `+0x045` / `+0x04A`                   | UHF TX power low/mid/high, 5 bytes each: TX power drive per frequency point; adjust mode sends value × 16 to DAC `0x140F000C`; watts unknown                                                            |
| `+0x0D0` / `+0x0D5` / `+0x0DA`                   | VHF TX power low/mid/high, same                                                                                                                                                                         |
| `+0x064`/`+0x069`, `+0x06E`/`+0x073`             | UHF level-1 and level-9 pairs, 5 bytes each: squelch thresholds at squelch levels 1 and 9, interpolated by the channel squelch, written to RF register `0x78`; raw RF threshold units                   |
| `+0x0E0`/`+0x0E5`, `+0x0EA`/`+0x0EF`             | VHF level-1 and level-9 pairs, same                                                                                                                                                                     |
| `+0x080`/`+0x085`                                | 108–136 MHz level pair, 5 bytes each, same                                                                                                                                                              |
| `+0x00C`                                         | u16 LE battery threshold, stored **raw**: no mask and no range check; compared against the scaled battery voltage (10 mV units, inferred)                                                               |
| `+0x00E`                                         | u16 LE battery ADC scale, masked `0xFFF`, valid 1–1000 else the firmware default `0x284` (644). Voltage = raw × 750 / scale, so it is the ADC count at the 7.50 V reference (inferred from the formula) |
| `+0x016`                                         | Modem register `0x11000108` bytes 3 and 2 (adjust group 1); the register has no name                                                                                                                    |
| `+0x017`–`+0x01B` (UHF), `+0x0A6`–`+0x0AA` (VHF) | 5-point tables: per-TX-frequency value written to modem register `0x11000114` low halfword in analogue mode (modulation level, name inferred); adjust group 2                                           |
| `+0x01C`–`+0x01E` (UHF), `+0x0AB`–`+0x0AD` (VHF) | 3-point tables: per-TX-frequency value to RF register `0x40` (OR `0x3400`); adjust group 5 also addresses `+0x019`–`+0x01B` and `+0x0AE`–`+0x0B0`                                                       |
| `+0x027`–`+0x028`                                | **u16 LE**, 10 bits used: modem register `0x11000114` high halfword (adjust group 4, clamped to `0x400`); the register has no name                                                                      |
| `+0x07A`, `+0x07C`                               | u16 LE ADC channel 1 counts, written by the adjust Save (item O to `+0x07A`, any other item to `+0x07C`); no runtime reader found                                                                       |
| `+0x201`, `+0x202`                               | CTCSS and DCS TX levels, RF register `0x51` (OR `0x9000` / `0x8000`); adjust groups 6 and 7                                                                                                             |
| `+0x203`–`+0x209`                                | Loaded to `0x38470[0x35..0x40]`, consumers not found (`+0x203`, `+0x204` at most 31; `+0x205` a nibble; `+0x206`–`+0x209` use 5, 7, 4, 4 bits)                                                          |
| `+0x20A`, `+0x20B`                               | Audio levels: analogue/FM 1..15 (default 13), digital 1..63 (default 39)                                                                                                                                |
| `+0x030`, `+0x150`                               | 12 bytes: three BCD frequencies each near 400, 435, 470 MHz (observed). **No reader in 048**: `0x03029A3C` reads `+0x300`–`+0x34F`, not these                                                           |
| `+0x0C0`, `+0x188`                               | Present, no firmware reader found (12-byte rows)                                                                                                                                                        |
| `+0x210`–`+0x215`                                | Present, no firmware reader found (6 bytes)                                                                                                                                                             |
| `+0x096 + i`                                     | Read only by dead code (`0x0301A994` has no caller)                                                                                                                                                     |
| `+0xFFF`                                         | Tag `0x02`                                                                                                                                                                                              |

Adjust (PCTESTM) mode maps each calibration byte to a register: group 0 TX power to the DAC, group 1 `+0x016`, group 2 the 5-point tables, group 4 `+0x027`, group 5 the 3-point tables, groups 6 and 7 `+0x201` and `+0x202`, groups 9 to 12 the level pairs (RF register `0x78` = (v << 8) OR (v − 1)). The adjust Save also stores the battery ADC average into `+0x00E` and the channel 1 average into `+0x07A`/`+0x07C`.

### Viewer confidence

The Calibration tab on `/debug/radios/dm-32uv` ([Radio debug](../../../features/radio-debug/README.md)) shows these fields read-only, with layout and meaning confidence per row. Source addresses are the firmware consumers from the firmware notes. Registry: `src/integrations/radio-io/radios/dm32uv/calibrationFields.ts`; the tab is built from it by `debugCalibrationView.ts`. The charts plot TX power against the TX frequency points (traced) and squelch thresholds against the RX frequency points (an inferred pairing, not traced).

| Confidence (layout / meaning) | Fields                                                                                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| traced / traced               | Band limits; frequency points; TX power (drive, units unknown); level pairs (squelch thresholds); `+0x00C`, `+0x00E`; `+0x016`; `+0x027`; `+0x201`/`+0x202`; `+0x20A`, `+0x20B`; 5-point and 3-point tables (register paths traced, register names unknown) |
| traced / partly traced        | `+0x07A`, `+0x07C` (written by adjust Save, no runtime reader)                                                                                                                                                                                              |
| traced / unknown              | `+0x203`–`+0x209` (loaded, no consumer found); `+0x030`, `+0x150` (observed content, no reader)                                                                                                                                                             |
| unknown / unknown             | `+0x0C0`, `+0x188`, `+0x210`–`+0x215`, `+0x096 + i` and every other byte (raw hex only)                                                                                                                                                                     |

Invalid BCD nibbles and a `+0x00E` scale outside 1–1000 are shown as raw bytes with a reason, never as zero. `+0x00C` is shown as its raw u16. The viewer gives no physical units, validity bands or health verdicts.

## Factory sector

Program flash `0x0300B000`–`0x0300BFFF`. Backup reads it twice with `47 00 00 00 00 10` and keeps the 4096 bytes only when both replies match. See [protocol.md](protocol.md#factory-sector-backup-only).

| Offset            | What                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+0x80`           | Option byte, copied at boot to `0x3FDBC`/`0x3FDBF`: b2 = GPS fitted (UART1, menu rows, GNSS setting); b5 hides menu rows 1 and 3 and is read by channel load; b6 and b0, b1, b3 partly known |
| `+0x81`           | Option byte: b0 to `0x3FDBC` b5, b1–b3 to `0x3FDBF` b1–b3; no known use                                                                                                                      |
| `+0x82`           | Option byte: b4 to `0x3FDBC` b6, read by the idle screen; other bits no known use                                                                                                            |
| `+0xA0`           | Option byte to `0x3FDBD`: **`0xA3` forces the English UI** (settings loader)                                                                                                                 |
| `+0xA1`           | TX region. `0`–`3` restricted. `4` or `0xA5` = 136–174 / 400–470 MHz                                                                                                                         |
| `+0xA2`           | Option byte to `0x3FDC1`; no known use                                                                                                                                                       |
| `+0x10C`–`+0x10F` | Anti-clone key (kept raw; never a viewer row)                                                                                                                                                |

The rest of the sector is only in the raw region bin.

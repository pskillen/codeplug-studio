# DM-32UV — calibration page and factory sector

Firmware 048 field layout for the backup panel. Rules for which page is live, the factory-sector double read, and the Write/Restore skip are in [backup-restore.md](backup-restore.md). There is **no checksum** on the calibration page.

**Hub:** [README.md](README.md)

## In-range calibration page

Tag `0x02` at offset `+0xFFF` is the calibration page only inside the live V-frame `0x0A` window (block addresses from `addressBase` through `alignedEnd`). The lowest in-range address is the live page. Every higher in-range `0x02` is a duplicate, not the live page. A page that ends in `0x02` outside the window is not calibration.

| Offset                                 | What                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `+0x000`                               | UHF band low/high, 2× u16 LE BCD, 100 kHz units                                                                            |
| `+0x0CC`                               | VHF band low/high, same                                                                                                    |
| `+0x300`, `+0x314`, `+0x328`, `+0x33C` | 5× u32 LE BCD frequency points (UHF RX, UHF TX, VHF RX, VHF TX), 10 Hz units                                               |
| `+0x040` / `+0x045` / `+0x04A`         | UHF TX power low/mid/high, 5 bytes each                                                                                    |
| `+0x0D0` / `+0x0D5` / `+0x0DA`         | VHF TX power low/mid/high, 5 bytes each                                                                                    |
| `+0x064`/`+0x069`, `+0x06E`/`+0x073`   | UHF level-1 and level-9 pairs, 5 bytes each (squelch, inferred)                                                            |
| `+0x0E0`/`+0x0E5`, `+0x0EA`/`+0x0EF`   | VHF level-1 and level-9 pairs, 5 bytes each                                                                                |
| `+0x080`/`+0x085`                      | 108–136 MHz level pair, 5 bytes each                                                                                       |
| `+0x00C`, `+0x00E`                     | u16 LE masked `0xFFF`, valid 1–1000                                                                                        |
| `+0x017` (UHF), `+0x0A6` (VHF)         | 5 bytes, unknown                                                                                                           |
| `+0x01C` (UHF), `+0x0AB` (VHF)         | 3 bytes, unknown                                                                                                           |
| `+0x016`, `+0x027`, `+0x201`–`+0x209`  | Scalars read at boot                                                                                                       |
| `+0x030`, `+0x150`                     | 12 bytes: three BCD frequencies each near 400, 435, 470 MHz (adjust-mode test frequencies, inferred; read by `0x03029A3C`) |
| `+0x0C0`, `+0x188`                     | Present, no firmware reader found (12-byte rows)                                                                           |
| `+0x210`–`+0x215`                      | Present, no firmware reader found (6 bytes)                                                                                |
| `+0xFFF`                               | Tag `0x02`                                                                                                                 |

### Viewer confidence

The Calibration tab on `/debug/radios/dm-32uv` ([Radio debug](../../../features/radio-debug/README.md)) shows these fields read-only, with layout and meaning confidence per row. The layout was traced in stock `DM32.01.L01.048` only and is not validated on hardware; MM9PDY or other builds may differ. Source addresses are the firmware consumers from the firmware notes. Registry: `src/integrations/radio-io/radios/dm32uv/calibrationFields.ts`.

| Confidence (layout / meaning) | Fields                                                                                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| traced / traced               | Band limits `+0x000`, `+0x0CC`; frequency points `+0x300`/`+0x314`/`+0x328`/`+0x33C`; scalars `+0x00C`, `+0x00E` (battery-scale role of `+0x00E` inferred)                                                            |
| traced / partly traced        | TX power `+0x040`/`+0x045`/`+0x04A`, `+0x0D0`/`+0x0D5`/`+0x0DA` (units unknown); level pairs `+0x064`–`+0x073`, `+0x0E0`–`+0x0EF`, `+0x080`/`+0x085` (squelch role inferred); `+0x030`, `+0x150` (inferred, raw only) |
| traced / unknown              | Boot scalars `+0x016`, `+0x027`, `+0x201`–`+0x209`; tables `+0x017`, `+0x0A6` (5-point) and `+0x01C`, `+0x0AB` (3-point)                                                                                              |
| unknown / unknown             | `+0x0C0`, `+0x188`, `+0x210`–`+0x215`, `+0x096+i` and every other byte (raw hex only)                                                                                                                                 |

Invalid BCD nibbles and masked scalars outside 1–1000 are shown as raw bytes with a reason, never as zero. The viewer gives no physical units, validity bands or health verdicts.

## Factory sector

Program flash `0x0300B000`–`0x0300BFFF`. Backup reads it twice with `47 00 00 00 00 10` and keeps the 4096 bytes only when both replies match. See [protocol.md](protocol.md#factory-sector-backup-only).

| Offset                            | What                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| `+0x80`–`+0x82`, `+0xA0`, `+0xA2` | Option bytes. `+0x80` bit 2 = GPS                                    |
| `+0xA1`                           | TX region. `0`–`3` restricted. `4` or `0xA5` = 136–174 / 400–470 MHz |
| `+0x10C`–`+0x10F`                 | Anti-clone key                                                       |

The rest of the sector is only in the raw region bin.

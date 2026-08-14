# OpenGD77 — satellite orbital bank (keps)

Satellite tracking payload for OpenGD77-family firmware (Baofeng DM-1701, TYT MD-9600, and other OpenUV380-class radios). Lives inside the **additional-settings** FLASH region as a TLV block, not as a standalone D890-style memory table and not as CPS `satellites.txt`.

Cite: qdmr `OpenGD77BaseCodeplug::SatelliteElement` / `SatelliteBankElement` / `AdditionalSettingsElement` (`lib/opengd77base_codeplug.hh`, `.cc`), `OpenUV380SatelliteConfig` (`lib/openuv380_satelliteconfig.hh`, `.cc`), `OpenGD77SatelliteConfig` (`lib/opengd77_satelliteconfig.hh`, `.cc`) — facts only; do not paste GPL sources.

**Hub:** [README.md](README.md) · **Additional settings:** [settings-aprs.md](settings-aprs.md) · **Memory:** [memory-layout.md](memory-layout.md) · **Protocol:** [protocol.md](protocol.md) · **Feature hub:** [satellite-keps](../../../features/satellite-keps/README.md)

> **Not hardware-verified.** Everything below is reverse-engineered from qdmr (GPL-3) in this session. There was no physical DM-1701 / MD-9600 keps write capture. Treat facts as qdmr-inferred until an operator confirms on hardware ([#858](https://github.com/pskillen/codeplug-studio/issues/858)).

## Region summary

| Fact                                      | Value                                            | Source                                                                     |
| ----------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| Container                                 | Additional-settings element, size `0x11a0`       | `AdditionalSettingsElement::size()`                                        |
| OpenUV380 base (Studio targets)           | FLASH `0x00020000`                               | `openuv380_codeplug.hh` / `OpenUV380SatelliteConfig::Offset::satellites()` |
| GD-77-class base (not first Studio write) | FLASH `0x000000`                                 | `OpenGD77SatelliteConfig::Offset::satellites()`                            |
| Header magic                              | ASCII `"OpenGD77"` @ `0x00`, 8 bytes, pad `0xff` | `clear()` / `isValid()`                                                    |
| Header version                            | u32 LE `1` @ `0x08`                              | `isValid()` requires version **1**                                         |
| Block directory                           | TLV walk from `0x0c`                             | `hasSettings()` / `satellites()`                                           |
| Satellite block id                        | `3` (`Settings::SatelliteOrbitals`)              | enum in `AdditionalSettingsElement`                                        |
| Bank size                                 | `0x09e0`                                         | `SatelliteBankElement::size()`                                             |
| Bank TLV payload size                     | `size() - 8` = `0x09d8`                          | `clear()` writes this at `+4`                                              |
| Record size                               | `0x64` (100 bytes)                               | `SatelliteElement::size()`                                                 |
| Max satellites                            | **25** (one record per **spacecraft**)           | `SatelliteBankElement::Limit::satellites()`                                |
| Name length                               | **8** ASCII, pad `0x00`                          | `SatelliteElement::Limit::nameLength()`                                    |
| Occupancy bitmap                          | **None** — unused slots are zeroed               | `encode()` clears every slot then fills `0..count-1`                       |

qdmr does **not** define a separate DM-1701 vs MD-9600 satellite map — same OpenUV380 additional-settings region and the same `SatelliteBankElement`.

### Packing unit (not D890, not Gemini)

Each wire record is **one spacecraft**: Keplerian fields plus a **fixed** FM pair, APRS pair, beacon frequency, and APRS path — not N generic transponder presets and not one record per library transmitter.

| Slot   | Wire fields                                                                              |
| ------ | ---------------------------------------------------------------------------------------- |
| FM     | downlink Hz, uplink Hz, CTCSS (uplink)                                                   |
| APRS   | downlink Hz, uplink Hz                                                                   |
| Beacon | frequency Hz                                                                             |
| Path   | 24-byte ASCII (qdmr `encode()` does **not** currently write this — `@bug set APRS path`) |

A `#857` GitHub comment drafted a `satellites.txt` / “3 presets × 25” CPS story. That is **not** this binary bank. Studio writes the FLASH TLV, not OpenGD77 CPS `satellites.txt`.

## Additional-settings TLV

After the 12-byte header, blocks are concatenated:

| Offset in block | Type    | Meaning                                                     |
| --------------- | ------- | ----------------------------------------------------------- |
| `0x00`          | u32 LE  | Block id (`1` boot image … `5` dark theme; satellite = `3`) |
| `0x04`          | u32 LE  | Payload size (bytes after this 8-byte header)               |
| `0x08`          | payload | Block body                                                  |

Walk: `offset += 8 + payloadSize`, stop at region end or id `0xffffffff` (unused / virgin).

`satellites()`:

1. Require valid header (`"OpenGD77"` + version `1`). Invalid → no bank pointer.
2. If a block with id `3` exists, return it in place.
3. If the walk hits `0xffffffff`, **create** a cleared satellite bank there (writes id `3` + payload size + zeros).
4. Otherwise fail (region full / no hole).

**Co-residents.** Boot image (id 1), boot melody (id 2), themes (ids 4–5) share this `0x11a0` blob. A naive `memset` of the whole region wipes them — qdmr users reported boot image / melody / theme loss after a keplers write ([qdmr#508](https://github.com/hmatuschek/qdmr/issues/508)). Studio keps write must **RMW only block 3** (or create it in a `0xffffffff` hole) and leave other TLVs untouched.

**Virgin / unknown header.** OpenUV380 `encode()` (qdmr): if magic is `"OpenGD77"` but version ≠ 1, **refuse** (newer firmware). Any other garbage / `0xff` flash: `clear()` the additional-settings header, then encode the bank. Studio should match that refuse-vs-init split.

## Satellite bank (`0x09e0`)

| Offset  | Len         | Field                                                   |
| ------- | ----------- | ------------------------------------------------------- |
| `0x00`  | 4           | Block id `3` (u32 LE) — same as TLV id                  |
| `0x04`  | 4           | Segment size `0x09d8` (u32 LE)                          |
| `0x08`  | `25 × 0x64` | Satellite records, stride `0x64`                        |
| `0x9cc` | `0x14`      | Unused tail inside `size()` (`0x09e0 - 0x08 - 25×0x64`) |

`clear()` zeros the whole bank, then writes id + segment size. `encode()` `clear()`s, then for each index `0..24` zeros the slot and, if the database has an entry, packs it.

## Record layout (`0x64` bytes)

Zero-initialized, then fields written. Orbital numbers are **packed BCD nibbles**, not ASCII TLE columns (unlike the D890). Frequencies are **u32 LE Hertz**, not deci-Hz.

### BCD nibble encoding

qdmr `writeDigit` / `writeInteger` / `writeFractional` / `writeFixedPoint`:

| Nibble      | Meaning       |
| ----------- | ------------- |
| `0x0`–`0x9` | Decimal digit |
| `0xa`       | Decimal point |
| `0xb`       | Blank         |
| `0xc`       | Minus         |

Each `Offset::Bit` is `{ byte, bit }` with `bit` `0` (low nibble) or `4` (high nibble). qdmr advances that cursor from the **MSB of the byte** (`codeplug.hh` `Bit::operator+`): `{b, 4} + 4 bits` → `{b, 0}`, then `{b+1, 4}`. Linear `byte*8+bit` addressing skips the low nibble and overlaps the next Keplerian field — firmware then predicts garbage elevation / zigzag tracks. Implementers must match qdmr’s integer / fractional / sign placement (the setters below encode the widths).

Worked example: epoch year `24` at `{0x08, 4}` occupies **both nibbles of `0x08`** (`0x24`). Inclination `51.6416` at `{0x14, 4}` is bytes `05 1a 64 16` (`051.6416`) and must not spill into RAAN at `{0x18, 4}`.

### Fields

| Offset      | Encoding             | Field                                                                                 | qdmr setter widths                               |
| ----------- | -------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `0x00`      | 8 ASCII, pad `0x00`  | Name                                                                                  | `nameLength() = 8`                               |
| `{0x08, 4}` | BCD integer          | Epoch year (`year % 100`), 2 digits, no sign nibble surviving                         | `writeInteger(..., false, 2)`                    |
| `{0x09, 4}` | BCD fixed-point      | Epoch day-of-year (qdmr `epoch.toEpoch()` / “Julien” day), 3 integer + point + 8 frac | `writeFixedPoint(..., false, 3, 8)`              |
| `{0x0f, 4}` | BCD signed frac      | Mean-motion first derivative                                                          | `writeFixedPoint(..., true, 0, 8)`               |
| `{0x14, 4}` | BCD fixed-point      | Inclination (deg)                                                                     | 3 + point + 4 frac                               |
| `{0x18, 4}` | BCD fixed-point      | RAAN / ascension (deg)                                                                | 3 + point + 4 frac                               |
| `{0x1c, 4}` | BCD fractional       | Eccentricity (no integer part)                                                        | 7 frac digits                                    |
| `{0x1f, 0}` | BCD fixed-point      | Argument of perigee (deg)                                                             | 3 + point + 4 frac                               |
| `{0x23, 0}` | BCD fixed-point      | Mean anomaly (deg)                                                                    | 3 + point + 4 frac                               |
| `{0x27, 0}` | BCD fixed-point      | Mean motion (rev/day)                                                                 | 2 + point + 8 frac                               |
| `{0x2d, 4}` | BCD integer          | Revolution number at epoch                                                            | 5 digits, no sign                                |
| `0x30`      | u32 LE               | FM downlink (Hz)                                                                      |                                                  |
| `0x34`      | u32 LE               | FM uplink (Hz)                                                                        |                                                  |
| `0x38`      | u32 LE               | CTCSS as `mHz / 100` (0.1 Hz units); **unwritten** if not CTCSS                       |                                                  |
| `0x3c`      | u32 LE               | APRS downlink (Hz)                                                                    |                                                  |
| `0x40`      | u32 LE               | APRS uplink (Hz)                                                                      |                                                  |
| `0x44`      | u32 LE               | Beacon (Hz)                                                                           |                                                  |
| `0x4c`      | 24 ASCII, pad `0x00` | APRS path                                                                             | `pathLength() = 24`; qdmr encode currently skips |

`0x48`–`0x4b` sit between beacon and path and are left zero by the listed setters.

## Write-session shape (Studio)

Not a separate `SATELLITE_DATA` PROGRAM type (that is D890). OpenGD77 keps ride the normal CPS serial session:

1. Connect / CPS mode (existing `OpenGd77Protocol.connect()`).
2. Fresh-read FLASH `0x00020000` / `0x11a0` (already a registered download span).
3. Overlay packed block id `3` inside that blob; preserve magic/version and other TLVs.
4. Program only **dirty 4 KB `'X'` sectors** (`collectDirtySectors`). Additional-settings is `0x11a0` starting on a sector boundary — typically one sector (`0x20000`–`0x20fff`), with unused tail in that sector preserved by RMW.
5. **SAVE_REBOOT** (`control 00h`) — same as full codeplug Write; firmware applies FLASH after reboot. qdmr satellite config is a dedicated `0x11a0` image write of this same region; Studio should still reboot so the tracking UI sees new keps.

**Do not** mark `additionalSettings` `writeRole: 'replaced'` on full **Write codeplug**. Keps are never part of Write codeplug ([#1121](https://github.com/pskillen/codeplug-studio/issues/1121)).

## Capacity / names (export-boundary only)

| Constraint         | Value                  | Notes                                                                                                                                             |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Max spacecraft     | 25                     | Halt write if more enabled satellites would occupy slots                                                                                          |
| Name               | 8 chars                | Library names stay unlimited; packer truncates                                                                                                    |
| FM / APRS / beacon | one of each per record | Extra library transmitters beyond those roles skip with a reason — not extra slots                                                                |
| Studio RF gate     | 136–174 / 400–480 MHz  | Separate from channel-eligibility 400–470; see [DM-1701 capabilities](../baofeng/dm-1701/capabilities.md#satellite-keps-write-eligibility-studio) |
| Radio UI slots     | Freq 1 / 2 / 3         | qdmr fields FM / APRS / beacon; Freq 3 also takes CW/SSTV/telemetry RX                                                                            |
| Contested slot     | Build override         | `satelliteBankSlot` on the transmitter UUID; otherwise first-wins among classified transmitters                                                   |

Code SoT: `OPENGD77_FAMILY_LIMITS` in `src/core/radios/opengd77/limits.ts`. Human: [DM-1701 limits](../baofeng/dm-1701/limits.md) / [MD-9600 limits](../tyt/md-9600/limits.md).

## Related

- [settings-aprs.md](settings-aprs.md) — additional-settings header + block id table
- D890 sibling (different geometry): [anytone/at-d890uv/satellite-keps.md](../anytone/at-d890uv/satellite-keps.md)

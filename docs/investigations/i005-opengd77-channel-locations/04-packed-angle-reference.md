# Packed-angle reference

Facts too bulky for `01-findings.md`. Numeric examples are from `R/angle-2026-08-17` (qDMR formula). Offsets are from `S/fw-struct` + `S/qdmr-offsets`.

Firmware source (do not treat as a Studio tree): Telectroboy archive of official MD-9600 2026-01-31 firmware, `application/include/functions/codeplug.h`, `CodeplugChannel_t`. Same header is compiled for `PLATFORM_RT84_DM1701`.

---

## Record offsets (bytes)

```
0x00  name[16]
0x10  rxFreq  BCD8 LE × 10 Hz
0x14  txFreq  BCD8 LE × 10 Hz
0x18  chMode
0x19  power
0x1a  locationLat0     LS
0x1b  tot              (15 s units; unrelated; do not clobber)
0x1c  locationLat1
0x1d  locationLat2     MS
0x1e  locationLon0     LS
0x1f  locationLon1
0x20  rxTone  u16 LE
0x22  txTone  u16 LE
0x24  locationLon2     MS   (firmware comment wrongly says "Latitude")
0x25  unused
0x26  LibreDMR_flag1   bit 3 (0x08) = USE_LOCATION
```

Assemble: `code = (b2 << 16) | (b1 << 8) | b0` (unsigned 24-bit).

## Flag byte `0x26` (LibreDMR_flag1)

| Bit | Mask | Firmware name | qDMR name | Studio write today |
| --- | ---- | ------------- | --------- | ------------------ |
| 7 | `0x80` | OPTIONAL_DMRID | overrideDMRID | 0 |
| 6 | `0x40` | NO_BEEP | disableBeep | 0 |
| 5 | `0x20` | NO_ECO | disablePowerSave | 0 |
| 4 | `0x10` | OUT_OF_BAND (MD-9600) | — | 0 |
| 3 | `0x08` | **USE_LOCATION** | **useFixedLocation** | 0 ← the gap |
| 2 | `0x04` | FORCE_DMO | simplex | 0 |
| 0 | `0x01` | ROAMING | — | 0 |

Set bit 3 without OR-clobbering the rest of a future modelled flags byte. Today the whole byte is 0, so `0x08` is sufficient.

## qDMR 24-bit code

```
sign     = (angle < 0) ? 1 : 0
scaled   = abs(trunc(angle * 10000))     // C++ int() toward zero
degrees  = scaled / 10000                // 8 bits
frac     = scaled % 10000                // 15 bits, 0–9999
code     = (sign << 23) | (degrees << 15) | frac
```

Decode:

```
sign     = (code >> 23) & 1 ? -1 : 1
degrees  = (code >> 15) & 0xff
frac     = code & 0x7fff
angle    = sign * (degrees + frac / 10000)
```

Longitude 180 fits in the 8-bit degree field (max 255).

## Worked examples (qDMR formula)

Little-endian byte order as stored in the split fields.

| WGS84 | code | hex (24-bit) | b0 | b1 | b2 | notes |
| ----- | ---- | ------------ | -- | -- | -- | ----- |
| `0` | 0 | `00 00 00` | `00` | `00` | `00` | indistinguishable from "unset" without the flag |
| `51.5000` | 1676168 | `00199388` | `88` | `93` | `19` | exact 0.0001 |
| `55.9533` | 1811773 | `001ba53d` | `3d` | `a5` | `1b` | Edinburgh lat |
| `-3.1883` | 8488795 | `0081875b` | `5b` | `87` | `81` | Edinburgh lon (sign in b2) |
| `51.5074` | 1676241 | `001993d1` | `d1` | `93` | `19` | **truncates to 51.5073** |
| `-0.1278` | 8389886 | `008004fe` | `fe` | `04` | `80` | west of Greenwich |
| `90` | 2949120 | `002d0000` | `00` | `00` | `2d` | |
| `-90` | 11337728 | `00ad0000` | `00` | `00` | `ad` | |
| `180` | 5898240 | `005a0000` | `00` | `00` | `5a` | |
| `-180` | 14286848 | `00da0000` | `00` | `00` | `da` | |

Edinburgh on the wire (illustrative):

| Field | Offset | Value |
| ----- | ------ | ----- |
| lat b0/b1/b2 | `0x1a`, `0x1c`, `0x1d` | `3d`, `a5`, `1b` |
| tot | `0x1b` | leave as TOT (Studio currently writes `0`) |
| lon b0/b1/b2 | `0x1e`, `0x1f`, `0x24` | `5b`, `87`, `81` |
| flags | `0x26` | `0x08` if `useLocation` |

## What "unset" looks like

All-zero lat/lon **plus** flag clear is the current Studio write. Firmware treats missing radio GPS as "NOT SET"; channel Use Location off disables distance/roaming even if leftover bytes were non-zero. Prefer: zero the six bytes **and** clear bit 3 when the library has no location or `useLocation` is false.

Zero degrees with the flag set would claim a location at (0,0) — the Gulf of Guinea. Do not set the flag unless `useLocation` is true **and** coordinates are present.

## Competing formula (do not use on this record)

Binary 15-fractional-bit (`intPart << 15 | round(frac * 32768)`) is what a misreading of the 2026 `latLon*` changelog suggests. For `51.5°` that yields low 15 bits `16384` (`0x4000`), not qDMR `5000` (`0x1388`). Channel Details UI is four decimal digits, not a binary fraction.

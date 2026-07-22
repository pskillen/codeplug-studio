# OpenGD77 — settings, APRS, and additional settings

High-level offsets needed for a first OpenUV380 adapter. Shared record packing; bases differ by protocol group ([memory-layout.md](memory-layout.md)).

**Hub:** [README.md](README.md)

Cite: qdmr `lib/opengd77base_codeplug.hh`.

## General settings

| Fact | Value |
| ---- | ----- |
| Element size | `0x90` |
| UHF min / max | `0x00` / `0x02` |
| VHF min / max | `0x04` / `0x06` |
| Call | `0x60` (max length 8) |
| DMR ID | `0x68` |

**Base:** `0x80` (FLASH on OpenUV380; EEPROM on GD-77)

## Boot settings

| Field | Offset |
| ----- | ------ |
| bootText | `0x00` |
| bootPasswdEnable | `0x01` |
| bootPasswd | `0x0c` |
| line1 | `0x28` (16 chars) |
| line2 | `0x38` (16 chars) |

**Base:** `0x7518` (FLASH on OpenUV380; EEPROM on GD-77)

## FM APRS settings

| Fact | Value |
| ---- | ----- |
| Element size | `0x40` |
| Systems | `8` |
| Bank layout | systems @ `0x00`, stride `0x40` |

### Per-system offsets

| Field | Offset |
| ----- | ------ |
| name | `0x00` (8 chars) |
| sourceSSID | `0x08` |
| latitude | `0x09` |
| longitude | `0x0c` |
| via1 call / SSID | `0x0f` / `0x15` |
| via2 call / SSID | `0x16` / `0x1c` |
| icon table / index | `0x1d` / `0x1e` |
| comment | `0x1f` (23 chars) |
| fmFrequency | `0x37` |
| flags @ `0x3d` | precision (bit4), QSY (bit2), fixed pos (bit1), baud (bit0) |

BaudRate enum in qdmr: `Baud1200 = 0`, `Baud300 = 1`.

**Note:** `APRSSettingsBankElement::size()` returns `0x40` in qdmr while Limit is 8 systems — treat layout span as **8 × `0x40`**.

**Base:** `0x1588` (FLASH on OpenUV380; EEPROM on GD-77)

## Additional settings (FLASH)

| Fact | Value |
| ---- | ----- |
| Element size | `0x11a0` |
| Magic string | `0x00` (8 chars) |
| Version | `0x08` |
| Blocks | `0x0c` |

### Block IDs

| ID | Content |
| -- | ------- |
| 1 | Boot image |
| 2 | Boot melody |
| 3 | Satellite orbitals |
| 4 | Light theme |
| 5 | Dark theme |

| Protocol | Base |
| -------- | ---- |
| OpenUV380 | FLASH `0x00020000` |
| GD-77 | FLASH `0x000000` |

## Known deferrals

| Topic | Status |
| ----- | ------ |
| Callsign DB | Different bases/entry sizes for OpenGD77 vs OpenUV380 (`opengd77_callsigndb.*` / `openuv380_callsigndb.*`) — not required for first channel/contact/zone adapter |
| Satellite orbital payload detail | Block present in additional settings; deep map deferred |
| DTMF *settings* (vs contacts) | Region reserved; full field table deferred |

## Related

- [memory-layout.md](memory-layout.md) · [protocol.md](protocol.md)
- CSV APRS/DTMF skip notes: [export-formats/opengd77/dtmf-aprs.md](../../export-formats/opengd77/dtmf-aprs.md)

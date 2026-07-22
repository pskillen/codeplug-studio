# OpenGD77 — USB serial protocol

Handshake and framing for OpenGD77-family radios over USB serial (Web Serial target). Distinct from CPS CSV file interchange.

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: qdmr `lib/opengd77_interface.hh` / `.cc` (facts only; GPL-3).

## USB identity

| Item | Value |
| ---- | ----- |
| VID | `0x1fc9` |
| PID | `0x0094` |
| Transfer block | 32 bytes |
| Flash sector | 4096 bytes |

## Message type bytes

| Type | Role |
| ---- | ---- |
| `'C'` | Command (CPS screen, ping, control, …) |
| `'R'` | Read |
| `'W'` | Write (GD-77 protocol variant) |
| `'X'` | Write (UV380 protocol variant — DM-1701 / MD-9600) |

OpenUV380-class radios use `'X'` for write requests; GD-77-class use `'W'`. Read and command prefixes are shared.

## Commands (`'C'`)

| Flag | Meaning |
| ---- | ------- |
| `00h` | Show CPS screen |
| `01h` | Clear screen |
| `02h` | Display text |
| `03h` | Render screen |
| `05h` | Close CPS screen |
| `06h` | Control radio |
| `07h` | Start GPS logging |
| `feh` | Ping |

### Control actions (`06h` payload)

| Code | Meaning |
| ---- | ------- |
| `00h` | Save settings and reboot |
| `01h` | Reboot |
| `02h` | Save settings and VFOs (no reboot) |
| `03h` | Flash LED green |
| `04h` | Flash LED red |
| `05h` | Re-init internal buffers |
| `06h` | Re-init sound buffers |
| `07h` | Update date-time from GPS |

## Read (`'R'`)

| Mem code | Region |
| -------- | ------ |
| `01h` | Flash |
| `02h` | EEPROM |
| `05h` | MCU ROM |
| `06h` | Display buffer |
| `07h` | WAV buffer |
| `08h` | AMBE buffer |
| `09h` | Radio / firmware info |
| `0ah` | FLASH security registers |

Read request carries address (BE) and length (BE); response returns up to 32 bytes payload (or FirmwareInfo for code `09h`).

## Write (`'W'` / `'X'`)

| Command | Meaning |
| ------- | ------- |
| `1` | Set flash sector |
| `2` | Write sector buffer |
| `3` | Finish / write flash sector |
| `4` | Write EEPROM |
| `7` | Write WAV buffer |

Typical flash path: set sector → write 32-byte buffers → finish sector. EEPROM writes use command `4` with address + payload.

## FirmwareInfo (`'R'` mem `09h`)

| Field | Notes |
| ----- | ----- |
| structVersion | Currently observed as 3 in qdmr |
| radioType | See [README.md](README.md) radioType table |
| fw_revision[16] | ASCII, 0-padded |
| build_date[16] | `YYYYMMDDhhmmss`, 0-padded |
| flashChipSerial | u32 |
| features | LE bitflags |

### Feature bits (LE)

| Bit | Meaning |
| --- | ------- |
| 0 | Inverted display |
| 1 | Extended callsign DB |
| 2 | Voice prompt loaded |

### Protocol variant from radioType

| Group | radioType examples | Write byte | Studio |
| ----- | ------------------ | ---------- | ------ |
| GD77 | GD-77, GD-77S, RD-5R, DM-1801, … | `'W'` | Later |
| UV380 | MD-9600 (`05h`), DM-1701 (`08h`/`0ah`), MD-UV390, … | `'X'` | First adapters |

## Typical session flow

1. Open serial port for VID/PID (or OS-assigned CDC device matching those IDs).
2. Optional ping (`'C'` + `feh`).
3. Read FirmwareInfo (`'R'` + `09h`) → choose OpenGD77 vs OpenUV380 map and write type.
4. Show CPS screen (`'C'` + `00h`) before bulk memory ops.
5. Read/write 32-byte blocks against registered spans ([memory-layout.md](memory-layout.md)).
6. Save / reboot via control commands as required; close CPS screen (`05h`).

Exact framing byte layouts are in qdmr’s `doc/code/opengd77_protocol_*.txt` verbincludes — cite those files when implementing a codec; do not copy GPL sources into Studio.

## Related

- [fixtures.md](fixtures.md) — capturing dumps for tests
- [memory-layout.md](memory-layout.md)
- Planned kit: transport [#615](https://github.com/pskillen/codeplug-studio/issues/615), protocol kit [#616](https://github.com/pskillen/codeplug-studio/issues/616)

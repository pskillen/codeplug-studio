# OpenGD77 — USB serial protocol

Handshake and framing for OpenGD77-family radios over USB serial (Web Serial target). Distinct from CPS CSV file interchange.

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: qdmr `lib/opengd77_interface.hh` / `.cc` (facts only; GPL-3).

## USB identity

| Item           | Value      |
| -------------- | ---------- |
| VID            | `0x1fc9`   |
| PID            | `0x0094`   |
| Transfer block | 32 bytes   |
| Flash sector   | 4096 bytes |

## Message type bytes

| Type  | Role                                               |
| ----- | -------------------------------------------------- |
| `'C'` | Command (CPS screen, ping, control, …)             |
| `'R'` | Read                                               |
| `'W'` | Write (GD-77 protocol variant)                     |
| `'X'` | Write (UV380 protocol variant — DM-1701 / MD-9600) |

OpenUV380-class radios use `'X'` for write requests; GD-77-class use `'W'`. Read and command prefixes are shared.

## Commands (`'C'`)

| Flag  | Meaning           |
| ----- | ----------------- |
| `00h` | Show CPS screen   |
| `01h` | Clear screen      |
| `02h` | Display text      |
| `03h` | Render screen     |
| `05h` | Close CPS screen  |
| `06h` | Control radio     |
| `07h` | Start GPS logging |
| `feh` | Ping              |

### Control actions (`06h` payload)

| Code  | Meaning                            |
| ----- | ---------------------------------- |
| `00h` | Save settings and reboot           |
| `01h` | Reboot only (no save)              |
| `02h` | Save settings and VFOs (no reboot) |
| `03h` | Flash LED green                    |
| `04h` | Flash LED red                      |
| `05h` | Re-init internal buffers           |
| `06h` | Re-init sound buffers              |
| `07h` | Update date-time from GPS          |

Firmware citations below are the official OpenGD77 MDUV380/DM-1701 source, release R20260130 (the build the DM-1701 hardware report runs; R20240908 is identical in this code). Paths are relative to `MDUV380_firmware/application/source/usb/` unless noted. They cite facts only; no firmware code or bytes are copied.

### CPS screen stacking and control 6 sub-commands

- **SHOW_CPS (`C 00`) stacks.** Every `C 00` pushes the CPS menu (`usb_com.c:664-665`) and the push does not check whether it is already on top (`application/source/user_interface/menuSystem.c:263-279`). **CLOSE_CPS (`C 05`) pops exactly one level** (`usb_com.c:683-693`). The CPS screen ignores keys and the radio stops scanning and showing the S-meter. Send `C 00` **once per session** and `C 05` once; Studio tracks whether it has shown the screen and does not send it again from the codeplug, User Database, keps or restore paths.
- **Control 6 sub 0 (save and reboot)** switches the current zone to All Channels if channels were rewritten, saves the radio's RAM settings with `settingsSaveSettings` and the last-used-channel-in-zone table, then resets 500 ms later (`usb_com.c:702-798`). It is the normal end of a successful Write.
- **Control 6 sub 1 (reboot only)** resets 500 ms later and saves nothing (`usb_com.c:799-807`). It is equivalent to the operator's manual power cycle and is what Studio sends **after a failed Write once any FLASH sector write began**. A reboot is the only command that clears the firmware's open-sector state and the CPS menu stack together. Studio never sends sub 0 on a failure path, because it would re-save RAM settings over a half-written FLASH. Studio then reads the one-byte reply for up to 500 ms (best effort, recorded in the Debug details; the port may drop on reset) but cannot trust it: `'-'` is also what a dropped busy frame gets, so the error tells the operator to power-cycle if the radio does not restart. Before any sector write began, a failure sends CLOSE_CPS once instead.

## Read (`'R'`)

| Mem code | Region                   |
| -------- | ------------------------ |
| `01h`    | Flash                    |
| `02h`    | EEPROM                   |
| `05h`    | MCU ROM                  |
| `06h`    | Display buffer           |
| `07h`    | WAV buffer               |
| `08h`    | AMBE buffer              |
| `09h`    | Radio / firmware info    |
| `0ah`    | FLASH security registers |

Read request carries address (BE) and length (BE); response returns up to 32 bytes payload (or FirmwareInfo for code `09h`).

## Write (`'W'` / `'X'`)

| Command | Meaning                     |
| ------- | --------------------------- |
| `1`     | Set flash sector            |
| `2`     | Write sector buffer         |
| `3`     | Finish / write flash sector |
| `4`     | Write EEPROM                |
| `7`     | Write WAV buffer            |

Typical flash path: set sector → write 32-byte buffers → finish sector. EEPROM writes use command `4` with address + payload (GD-77 class only; the MDUV380 firmware ignores it).

### ACK and NACK framing

| Message             | Success                         | Failure                                  |
| ------------------- | ------------------------------- | ---------------------------------------- |
| `'C'` command       | one byte `'-'`                  | one byte `'-'` (`usb_com.c:913-917`)     |
| `'R'` read          | `'R'` + u16 BE length + payload | one byte `'-'` (`usb_com.c:322-329`)     |
| `'W'` / `'X'` write | **two** bytes `{type, cmd}`     | **one** byte `'-'` (`usb_com.c:593-599`) |

A `C` command is answered `'-'` whether it worked or not (the firmware replies after every `C`, and also when it drops a frame because it is busy, `usbd_cdc_if.c:475-481`), so a `C` ACK carries no success information; only a stale byte could fake one, which is why the line is drained before each. A write NACK is **one byte**, so a host must read **one** byte first: `'-'` is a NACK and nothing follows; any other byte is followed by the second byte, which must be `{type, cmd}`. Waiting for two bytes turns a real NACK into a timeout; accepting a `'-'` plus the next byte as a pair hides a desync (a stray `'-'` ahead of a good ACK). Studio reads write ACKs this way (`readOpenGd77WriteAck`), and drains and records any bytes already pending before every SET_SECTOR and every `C` command, so a leftover byte can never pass for the next ACK.

### Why the firmware answers `'-'` to a write

From `cpsHandleWriteCommand` (`usb_com.c:331-600`) and `CDC_Receive_FS` (`MDUV380_firmware/USB_DEVICE/App/usbd_cdc_if.c:280-487`):

| Command                                                    | `'-'` when                                                                                                                                                                      | Evidence                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `X 01` SET_SECTOR                                          | a sector is **already open** (a previous SET_SECTOR was never FINISHed, or a calibration write is staged). Sector index `0x10` (abs `0x10000`) is special-cased as calibration. | `usb_com.c:337-356`     |
| `X 02` SECTOR_BUFFER                                       | **no sector is open**. Bytes outside the open sector are silently dropped, not refused.                                                                                         | `usb_com.c:358-469`     |
| `X 03` FINISH                                              | no sector is open, or erase / page program is still busy after the wait loop.                                                                                                   | `usb_com.c:471-500`     |
| any frame                                                  | it arrives while the previous request is **still being processed**: the USB interrupt answers `'-'` at once and drops the frame.                                                | `usbd_cdc_if.c:475-481` |
| any frame                                                  | it overflows the 2048-byte request buffer.                                                                                                                                      | `usbd_cdc_if.c:335-344` |
| unknown type byte (for example the `'A'` of an `AT` probe) | always.                                                                                                                                                                         | `usb_com.c:972-976`     |

The firmware checks **no address bounds, alignment or protected range** on flash writes (apart from the calibration sector above). Every NACK also clears the open sector (`usb_com.c:596`), so the next SET_SECTOR after a NACK succeeds. The open-sector state is cleared only by FINISH, a NACK or a reboot: neither CLOSE_CPS nor a new USB session clears it.

### Partial-sector writes

The firmware reads the whole sector into its buffer at SET_SECTOR (`usb_com.c:353`) and overwrites only the bytes it is sent before FINISH writes the sector back. A host therefore **sends only the 32-byte blocks it owns**. Studio sends only the blocks inside the registered FLASH spans ([memory-layout.md](memory-layout.md)), which lie on 32-byte boundaries (asserted in code). Filling the rest of a sector with `0xff` and sending all of it would erase what the radio keeps there: the radio's own settings struct starts at `0x604B` on MDUV380 (`application/source/interfaces/settingsStorage.c:31`) and extends past the end of the first span at `0x6060`. User Database sectors are the exception: the host owns the whole sector, so all 128 blocks are sent.

### Error reporting

A failed flash write throws a typed error naming the command, the sector and the block, for example `OpenGD77 refused FINISH for FLASH sector 0x9c000 (sector 3 of 12): radio answered '-'`, and the Write stepper attaches the last 24 TX/RX frames under **Debug details** with a copy button. Stale bytes found on the line before the failing sector are listed in the message.

## FirmwareInfo (`'R'` mem `09h`)

| Field           | Notes                                      |
| --------------- | ------------------------------------------ |
| structVersion   | Currently observed as 3 in qdmr            |
| radioType       | See [README.md](README.md) radioType table |
| fw_revision[16] | ASCII, 0-padded                            |
| build_date[16]  | `YYYYMMDDhhmmss`, 0-padded                 |
| flashChipSerial | u32                                        |
| features        | LE bitflags                                |

### Feature bits (LE)

| Bit | Meaning              |
| --- | -------------------- |
| 0   | Inverted display     |
| 1   | Extended callsign DB |
| 2   | Voice prompt loaded  |

### Protocol variant from radioType

| Group | radioType examples                                  | Write byte | Studio         |
| ----- | --------------------------------------------------- | ---------- | -------------- |
| GD77  | GD-77, GD-77S, RD-5R, DM-1801, …                    | `'W'`      | Later          |
| UV380 | MD-9600 (`05h`), DM-1701 (`08h`/`0ah`), MD-UV390, … | `'X'`      | First adapters |

## Typical session flow

1. Open serial port for VID/PID (or OS-assigned CDC device matching those IDs).
2. Optional ping (`'C'` + `feh`).
3. Read FirmwareInfo (`'R'` + `09h`) → choose OpenGD77 vs OpenUV380 map and write type.
4. Show CPS screen (`'C'` + `00h`) before bulk memory ops.
5. Read/write 32-byte blocks against registered spans ([memory-layout.md](memory-layout.md)).
6. Save / reboot via control commands as required; close CPS screen (`05h`).

## Linux: ModemManager probes the port

The DM-1701 advertises a CDC-ACM interface with the "Common AT commands" protocol, so ModemManager on Linux probes the port after every enumeration (power-up, replug, reboot from a Write) and each `AT…` byte it sends is answered `'-'`. This is **hygiene, not the cause** of the DM-1701 Write failure: with ModemManager stopped, the codeplug Write still failed (owner's hardware run, 2026-11-04, recorded on the Write-failure issue). To stop the probing anyway, add a udev rule for the radio (`1fc9:0094`):

```text
ATTRS{idVendor}=="1fc9", ATTRS{idProduct}=="0094", ENV{ID_MM_DEVICE_IGNORE}="1"
```

## Hung or unresponsive radio

A completed `download()` is evidence of 32-byte replies, not of FLASH content. On one hung TYT MD-9600 session ([i006](../../../investigations/i006-md9600-serial-read-ident/README.md)), every FLASH (and EEPROM) `'R'` of length 32 returned the **first 32 bytes of FirmwareInfo**, and the session still finished — `expectedLength` 32 would have thrown on a 46-byte ident frame. Inspect then decoded firmware revision / build-date ASCII as channel names.

That dump shape is an **edge case**, not a hang detector. The next unresponsive radio may stall, NAK, or return different junk. Do not retarget [memory-layout.md](memory-layout.md) from a dump taken while the radio is hung. Do not Restore a zip that is that ident prefix tiled across the spans.

## Write verify

Upload stages the **contiguous runs of 32-byte blocks actually sent** for each dirty FLASH sector (`dirtySectorChunks`, from `collectDirtySectors`; never whole 4096-byte sectors, and not untouched image gaps or `0xff` filler over bytes the radio keeps) plus a pre-upload snapshot of **kept** regions from `writeRole.ts`. Write encode overlays modelled banks onto the **in-session pre-write FLASH prior** (same download as the dirty-sector base) — not a persisted clone bag and not a virgin `0xff` image. **Zero dirty sectors** means the modelled overlay already matched live FLASH: Studio still sends `SAVE_REBOOT`, but the DM-1701 does **not** drop to All Channels (that kick happens when FLASH is actually programmed). Digital contact names on Write use `digitalContactExportNameMode` (same map as CPS / Contacts wire preview). After codeplug dirty sectors, **RadioID directory** Write starts a qdmr-style FLASH write_start (red LED + save-settings-no-reboot) then programs occupied User Database sectors from the encoded image only — **no** read-modify-write of `0x50000`. The firmware's write state does not depend on earlier `'R'` reads (the open sector is the only write state), so reading before writing is not what makes a write fail; an earlier hardware `radio returned '-'` was a framing desync or another cause (see [ACK and NACK framing](#ack-and-nack-framing)). User Database is not part of `OPENUV380_FLASH_SPANS` and not a verify-image region. **Verify write** runs after `SAVE_REBOOT` — operator waits for restart, reconnects, full `download()`, and compares sector payloads plus kept spans. Feature: [write-verify.md](../../../features/radio-read-write/write-verify.md).

For **Restore** (not Write): `restoreFromBackup` copies zip FLASH spans onto a **blank** prior, programs those dirty sectors, then **SAVE_REBOOT**. It does not pre-write-read live FLASH and does not arm a write projection. See [backup-restore.md](backup-restore.md). Hardware verify pending.

Exact framing byte layouts are in qdmr’s `doc/code/opengd77_protocol_*.txt` verbincludes — cite those files when implementing a codec; do not copy GPL sources into Studio.

## Related

- [fixtures.md](fixtures.md) — capturing dumps for tests
- [memory-layout.md](memory-layout.md)
- Write-failure tracking: [#1537](https://github.com/pskillen/codeplug-studio/issues/1537)
- Planned kit: transport [#615](https://github.com/pskillen/codeplug-studio/issues/615), protocol kit [#616](https://github.com/pskillen/codeplug-studio/issues/616)
- Hung-session `'R'` tiling FirmwareInfo prefix: [i006](../../../investigations/i006-md9600-serial-read-ident/README.md)

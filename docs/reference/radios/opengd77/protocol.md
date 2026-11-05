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

A `C` command is answered `'-'` whether it worked or not (the firmware replies after every `C`, and also when it drops a frame because it is busy, `usbd_cdc_if.c:475-481`), so a `C` ACK carries no success information; only a stale byte could fake one, which is why the line is drained before each. A write NACK is **one byte**, so a host must read **one** byte first: `'-'` is a NACK and nothing follows; any other byte is followed by the second byte, which must be `{type, cmd}`. Waiting for two bytes turns a real NACK into a timeout; accepting a `'-'` plus the next byte as a pair hides a desync (a stray `'-'` ahead of a good ACK). Studio reads write ACKs this way (`readOpenGd77WriteAck`), and drains the line before every `C` command and before every frame of a flash sector, so a leftover byte can never pass for the next ACK. Bytes found at a flash-sector frame are not ignored: they restart the sector (see [Split frames and sector recovery](#split-frames-and-sector-recovery)).

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

The firmware checks **no address bounds, alignment or protected range** on flash writes (apart from the calibration sector above). Every NACK also clears the open sector (`usb_com.c:596`), so the next SET_SECTOR after a NACK succeeds. The open-sector state (`static int sector`, `usb_com.c:84`) is cleared only by FINISH, a NACK or a reboot: neither CLOSE_CPS (`:683-692`) nor a new USB session clears it, so after an unclean session the **first SET_SECTOR of the next session is refused** `'-'` (that refusal closes the sector). Studio's sector recovery handles this as any refused SET_SECTOR; power-cycling a radio that showed a failed write also clears it.

### Partial-sector writes

The firmware reads the whole sector into its buffer at SET_SECTOR (`usb_com.c:353`) and overwrites only the bytes it is sent before FINISH writes the sector back. A host therefore **sends only the 32-byte blocks it owns**. Studio sends only the blocks inside the registered FLASH spans ([memory-layout.md](memory-layout.md)), which lie on 32-byte boundaries (asserted in code). Filling the rest of a sector with `0xff` and sending all of it would erase what the radio keeps there: the radio's own settings struct starts at `0x604B` on MDUV380 (`application/source/interfaces/settingsStorage.c:31`) and extends past the end of the first span at `0x6060`. User Database sectors are the exception: the host owns the whole sector, so all 128 blocks are sent.

### Framing rule (DM-1701 and MD-9600)

Both radios are native USB CDC (`1fc9:0094`, 64-byte packets, no bridge chip). The receive path (`CDC_Receive_FS`, `usbd_cdc_if.c:281-487`) has no per-platform branches, and the MD-9600 build uses the same USB device stack (`usbd_desc.c:77-78`, the `PLATFORM_MD9600` product string "OpenMD9600 Transceiver"):

- A length header is read only when the **first packet is exactly 64 bytes**; any shorter packet completes the frame and the rest of the 2,048-byte request buffer is zero-filled.
- A packet that arrives while the previous frame is still pending is answered `'-'` from the interrupt handler and dropped.
- The write and `C` handlers treat `PLATFORM_MD9600` like the DM-1701 (`usb_com.c:66-75, 365, 398, 446`), and the flash map, settings offset and User Database geometry are shared.

The MD-9600 receive path is confirmed, not inferred: in the MD-9600 R20260131 source, `usbd_cdc_if.c`, `usbd_desc.c` and the whole CDC library are byte-identical to the DM-1701 tree, `usb_com.c` differs only in unrelated hunks, and `usbd_conf.c` only in an interrupt priority. This is source reading only: it has not been run on an MD-9600, and older MD-9600 releases (the owner's firmware version is unknown) were not read.

Every frame Studio sends is under 64 bytes (largest is the 40-byte SECTOR_BUFFER), so each is one packet, and the Web Serial writer keeps each `write()` off the host buffer boundary. No OpenGD77-specific framing change is needed.

### Split frames and sector recovery

**Frame assembly.** The firmware treats each USB packet shorter than 64 bytes as a whole frame and zero-fills the rest of its request buffer, so a host must send each frame in one USB packet (`usbd_cdc_if.c:350-466`). Chrome's Web Serial can split one `write()` into two OS writes, and so two packets, when it straddles a wrap of its host-side buffer (the Web Serial transport rotates its writer before the wrap). When it happens the radio takes the first fragment as a complete frame and answers the remainder with a busy `'-'` from the interrupt handler, ahead of the real reply. The consequences:

| What the radio saw                                         | What the host sees                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A short SET_SECTOR or FINISH fragment                      | A stray `'-'`, then the real `X cmd` ACK (or a NACK)                                        |
| A SECTOR_BUFFER fragment                                   | A stray `'-'`, then a good ACK; the block reached the sector buffer as zeros or only partly |
| A fragment parsed as a different command or another sector | A refusal, or a different sector open                                                       |

By where the cut falls (firmware: `usb_com.c:335-600, 920-975`):

| First packet (k bytes) of | Firmware does                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------- |
| SECTOR_BUFFER, k = 1      | NACK; the open sector is closed                                                     |
| SECTOR_BUFFER, k = 2 to 7 | Length 0: a no-op ACK; the block keeps its old bytes                                |
| SECTOR_BUFFER, k >= 8     | Data bytes k-8 onward are zero-filled; ACK                                          |
| SET_SECTOR, k >= 2        | Opens the wrong sector; the real sector is never written                            |
| `R`, any k <= 7           | Length 0: replies `R 00 00` (a read can never be silently wrong because of a split) |
| `C 06 xx`, k = 2          | Becomes `C 06 00`: **save-and-reboot**, including from `C 06 01`                    |

The second packet, while the first is still pending, gets the busy `'-'` and the first's reply is usually lost to the busy IN endpoint. After the first was handled, the second is parsed from its first byte (`R`, `X`, `W`, `C`, or `0xE0`, which enters hotspot mode when a hotspot type is set; anything else gets `'-'`). The one case that looks fine to the host is the second packet being handled after the first's ACK went out and its own reply being dropped because the host had not collected the first: only good ACKs arrive. It was not observed and its rate is unmeasured; the read-back below catches it.

**Exposure on builds before the transport fix.** A session sends 62,844 bytes before its first sector (connect plus two span reads), so the first 64 KiB multiple falls about 2,690 bytes into the first write phase, and a Write crossed one boundary (worst case three). A Backup of a User Database above about 5,050 entries crossed one on an `R` frame. Keps writes and plain Read / Check write never reached 64 KiB. A User Database Write of 69,600 entries crossed about 36 boundaries. On Linux most such Writes failed in the first dirty sector before FINISH; a Restore failed part-way.

So a `'-'` may be a stray byte ahead of a real ACK rather than a refusal, and a split can corrupt the sector buffer under good ACKs. The firmware state after any of these is unknown (the sector open or closed, the wrong sector open, the buffer holding zeros). Nothing reaches flash before FINISH, SET_SECTOR re-reads the sector from flash, and a refused SET_SECTOR closes any open sector without writing (`usb_com.c:338-354`, `:596`).

**Recovery sequence.** On any `'-'`, wrong reply, timeout, bytes already on the line at a frame, or read-back mismatch within a sector, Studio restarts that one sector:

1. Record a trace note (`NOTE sector 0x… attempt 2: <reason>`), wait about 150 ms, and drain the line.
2. Send SET_SECTOR for the sector. If it is refused, the refusal closed whatever was open without writing: wait, drain again and send SET_SECTOR once more (this one must be ACKed).
3. Resend **every** owned block of the sector from the first (the fresh sector load discarded the earlier ones), then FINISH.
4. Read the owned bytes back (below). A mismatch restarts the sector.

At most 3 attempts per sector; the third failure throws the typed error of the last anomaly with "Gave up after 3 attempts at this sector", and the session recovers with reboot-only. Only the open sector is at risk, so restarting it is enough. Reboot-only (`C 06 01`) is also preceded by a settle and a drain, because sent while a reply is still pending it is dropped as busy.

**Read-back.** After each sector's FINISH the owned 32-byte blocks are read back with `R` and compared with what was sent. A mismatch (or a failed read) counts as an anomaly in the same attempt budget. The cost is one `R` round trip per owned block, so a Write takes roughly twice the frames and noticeably longer than before; User Database writes (every block of every sector) pay it most. The QuickKeys bytes `0x7524..0x7537` are not compared: the firmware keeps the radio's own whatever SECTOR_BUFFER sends there (`usb_com.c:395-440`, MDUV380 / DM-1701), so a Restore of a backup with different QuickKeys would otherwise fail every attempt.

### Error reporting

A failed flash write throws a typed error naming the command, the sector and the block, for example `OpenGD77 refused FINISH for FLASH sector 0x9c000 (sector 3 of 12): radio answered '-'. Gave up after 3 attempts at this sector.`, and the Write stepper attaches the last 24 TX/RX frames under **Debug details** with a copy button. Each TX line shows the cumulative byte offset at which its frame starts (`TX @1048000 58 02 …`). The offset counts TX bytes since the connection opened. It is not the position in the transport's write buffer, which restarts each time the transport rotates its writer, and each sector restart shows as a `NOTE` line. Bytes found on the line mid-sector are a `STALE` line and a restart, not a message to read afterwards.

## FirmwareInfo (`'R'` mem `09h`)

| Field           | Notes                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| structVersion   | Currently observed as 3 in qdmr                                                                                        |
| radioType       | See [README.md](README.md) radioType table                                                                             |
| fw_revision[16] | ASCII, 0-padded                                                                                                        |
| build_date[16]  | `YYYYMMDDhhmmss`, 0-padded                                                                                             |
| flashId         | u32 at offset 40, the SPI flash part id. `0x4018` is the 16 MiB W25Q128; the 1701 and MD-9600 only boot normally on it |
| features        | LE bitflags                                                                                                            |

### Feature bits (LE)

| Bit | Meaning                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Inverted display                                                                                                                            |
| 1   | The User Database loaded at boot is in `'n'` mode (second segment on the voice prompts). A state, not a capability: clear on a normal radio |
| 2   | Voice prompts loaded                                                                                                                        |

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

Upload stages the **contiguous runs of 32-byte blocks actually sent** for each dirty FLASH sector (`dirtySectorChunks`, from `collectDirtySectors`; never whole 4096-byte sectors, and not untouched image gaps or `0xff` filler over bytes the radio keeps) plus a pre-upload snapshot of **kept** regions from `writeRole.ts`. Write encode overlays modelled banks onto the **in-session pre-write FLASH prior** (same download as the dirty-sector base) — not a persisted clone bag and not a virgin `0xff` image. **Zero dirty sectors** means the modelled overlay already matched live FLASH: Studio still sends `SAVE_REBOOT`, but the DM-1701 does **not** drop to All Channels (that kick happens when FLASH is actually programmed). Digital contact names on Write use `digitalContactExportNameMode` (same map as CPS / Contacts wire preview). After codeplug dirty sectors, **RadioID directory** Write starts a qdmr-style FLASH write_start (red LED + save-settings-no-reboot) then programs occupied User Database sectors from the encoded image only — **no** read-modify-write of `0x50000`. The firmware's write state does not depend on earlier `'R'` reads (the open sector is the only write state), so reading before writing is not what makes a write fail; an earlier hardware `radio returned '-'` was a framing desync or another cause (see [ACK and NACK framing](#ack-and-nack-framing)). User Database is not part of `OPENUV380_FLASH_SPANS` and not a verify-image region; it has its own check. **Verify write** runs after `SAVE_REBOOT` — operator waits for restart, reconnects, full `download()`, and compares sector payloads plus kept spans. When the Write sent a User Database (programmed completely), Verify also reads back the header (12 bytes) and the occupied entries (`downloadUserDatabaseOccupied`) and reports them as the **User Database** region group: the header is compared byte for byte and the entries per 4 KB sector slice by CRC-32 (the bytes themselves are not kept: 69,600 entries are about 1.9 MB, over the session-storage quota), so a mismatching sector is reported with both digests, not bytes. If the radio's header count is below what was sent, the missing slices are `not read`. The read-back costs roughly the length of the Write's data. Keps are not checked (their sessions never cross 64 KiB). Feature: [write-verify.md](../../../features/radio-read-write/write-verify.md).

For **Restore** (not Write): `restoreFromBackup` copies zip FLASH spans onto a **blank** prior, programs those dirty sectors, then **SAVE_REBOOT**. It does not pre-write-read live FLASH and does not arm a write projection. See [backup-restore.md](backup-restore.md). Hardware verify pending.

Exact framing byte layouts are in qdmr’s `doc/code/opengd77_protocol_*.txt` verbincludes — cite those files when implementing a codec; do not copy GPL sources into Studio.

## Related

- [fixtures.md](fixtures.md) — capturing dumps for tests
- [memory-layout.md](memory-layout.md)
- Write-failure tracking: [#1537](https://github.com/pskillen/codeplug-studio/issues/1537)
- Planned kit: transport [#615](https://github.com/pskillen/codeplug-studio/issues/615), protocol kit [#616](https://github.com/pskillen/codeplug-studio/issues/616)
- Hung-session `'R'` tiling FirmwareInfo prefix: [i006](../../../investigations/i006-md9600-serial-read-ident/README.md)

# RadioFoundry cable write

What a cable write sends and refuses, for every board running RadioFoundry. Each board's page gives its transport numbers and its ID-directory size: see [limits](limits.md) and the per-board pages it links. Firmware identity: [firmware.md](firmware.md).

## Digital contacts

Ticking **Digital contacts** chooses Contacts, ID directory, or Both. Leaving it unticked releases the private-contact slots this write would have filled, so those slots stay as the radio had them. It does not change channels, zones, talk groups, or RX lists. Every other contact slot is still written. An unused slot is the empty record.

| Source       | What is sent                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contacts     | Private DMR contacts already stored in the codeplug contact table. If those bytes match the radio, progress says no contact blocks changed.                                                                                                 |
| ID directory | DMR ID database. Header `Id`, format `N`, 27-byte records sorted by DMR ID, at image `0x50000` (256 KB). Rows past that continue at image `0xD8000` and stop at the board's image end. Studio sends image offsets, never the physical base. |
| Both         | The contact table and the DMR ID database.                                                                                                                                                                                                  |

Rows that do not fit before the board's image end are dropped with a warning. The voice-prompt area, and the gap between the codeplug image and `0xD8000`, are not written. A codeplug-only write leaves `0x50000` and `0xD8000` unowned. An empty chosen source does not claim that contacts will be written.

## Written slots

A cable write replaces every byte of a channel, zone, contact, talk group, or RX-list slot it writes. The radio read is not a source for those bytes.

During download, block checksums (**Block checksums** progress) run before any block read. On a write pre-read, a block the armed source owns in full is compared to the radio by CRC instead of being read.

- A channel that is in use is all 56 bytes. Unmodelled fields are zero, which means: TX timeout follows the radio-wide timeout, SFR is off, beep is on, power saving is on, the channel is not roaming or out of band, VOX and talkaround are off, the vendor power and squelch bits are clear, channel byte 0x2D is 0, talker-alias APRS bits are clear, flag 2 holds only the timeslot, STE is off, and the VFO offset and step are zero. The text bit of talker alias still follows the library. Byte 0x2D is the OpenGD77 APRS index. This firmware does not read it, so the channel report slot is not stored there.
- An unused channel record is not written. The in-use bitmap is owned and cleared, and a clear bit means that record is empty.
- The zone bitmap and every zone record are owned. An unused zone slot is the zeroed empty record.
- Every contact slot is owned. Talk groups and private contacts share the table. An unused slot is `0xFF` throughout, the empty record. A slot after the last written contact does not keep the contact that used to be there. Unticking Digital contacts releases only the private-contact records, as above.
- The RX-list length table is owned and zeroed. 0 means unused. The firmware does not read a list record whose length byte is 0, so that record is not written. A list with members is replaced in full.

## APRS

The cable write owns all 8 APRS records in the [codeplug image](../../export-formats/radiofoundry/README.md) (EEPROM image 0x1588, 64 bytes each). Owning those bytes is enough: the overlay already sends every owned address. There is no separate APRS writer.

Sent from the library configuration: the name and the comment, in record 1. Records 2–8 are 0xFF throughout, so a previous configuration cannot remain. With no library configuration, all eight records are that empty record.

Not sent, and why:

- Digipeater path. The library does not have one. A blank path in the record would be read as None and would change the path the radio is using. Record 1's first path callsign is `X`, which is not one of the five paths this firmware applies, so the radio keeps the path it already has.
- Destination ID, beacon interval, and position source. They live in the settings ring. The cable protocol refuses that region.
- The per-channel report slot, and channel index byte 0x2D. This firmware does not read that byte. It stays 0.
- Fixed latitude, longitude, and TX frequency in the record. The firmware does not use them. Sender SSID and symbol are parsed and not applied, so they stay 0.

## What is not written

- An address the serialiser does not own. The byte read from the radio stays. That includes general settings other than the callsign and the radio DMR ID, voice prompts, factory calibration, the settings ring (including digital APRS destination, beacon interval, and position source), the sector journal, and the native codeplug area. The DMR ID database stays unowned unless that source is selected.
- The settings area. Block `0xE000` is never sent, and a source that owns any byte of it is refused before a frame goes out. See [settings area](../../export-formats/radiofoundry/settings-area.md).
- Anything below the open-firmware image.

Studio does not speak the stock DM-32 programmer, and it does not speak the OpenGD77 `R` / `X` / `W` codec. If the radio does not answer the fast command, the write stops.

**Code:** `src/integrations/radio-io/radios/radiofoundry/`.

Hardware caps: [limits.md](limits.md).

## Guards

- **INFO layout.** Studio refuses the handshake when the block size, the EEPROM image size (`0x10000`) or the flash image start (`0x20000`) differ from the layout the codeplug file uses. The image end is the lower of INFO's and the board's, and that is the ID database ceiling.
- **Physical base.** INFO reports the physical base of the open-firmware image. Connect refuses a radio whose base differs from the chosen board's (`RadioFoundryBoardLimits.PHYSICAL_CODEPLUG_BASE`): it is a different radio, or the wrong build for it. This runs before VERSION is sent.
- **Board name.** After INFO and the base check, Studio reads VERSION and refuses a `board=` that is not one of the board's names. A missing VERSION carries on. See [firmware.md](firmware.md).
- **Planned blocks.** A write sends only blocks it planned: the served image blocks plus the ID-directory area-2 blocks the write owns. Any other address is refused before a frame goes out. A physical base that lies inside area 2 is therefore never sent unless it is a directory block this write owns.
- **Image range.** A block must be 4 KB aligned and inside EEPROM, flash, or ID-database area 2 up to the ceiling.
- **Settings area.** Block `0xE000` is never sent.

**Code:** `src/integrations/radio-io/radios/radiofoundry/`.

## Refusals

RadioFoundry answers a codeplug command with **status 7 (refused)** and a **reason byte** (see RadioFoundry `cps-fast.md` §6). Studio maps each reason to a plain sentence and attaches debug detail (`RadioIoError.debugText`: operation, status, reason name, INFO flags, whether storage is writable, board, and firmware build when VERSION was read).

| Reason | Name       | Studio error type    | Meaning (plain)                                                            |
| ------ | ---------- | -------------------- | -------------------------------------------------------------------------- |
| 1      | RANGE      | Interlock (no retry) | Write outside the radio’s allowed range.                                   |
| 2      | STORAGE    | Interlock (no retry) | Flash still holds another firmware’s settings (foreign region); see below. |
| 3      | NO_STAGING | Protocol             | Staged writes not available.                                               |
| 4      | STAGE_FULL | Protocol             | Staging area full.                                                         |
| 5      | STAGE_BUSY | Protocol             | Staging area busy.                                                         |
| 6      | STATE      | Protocol             | Radio not in a state that accepts the command.                             |
| 7      | CRC        | Protocol             | Block checksum mismatch.                                                   |
| 8      | STREAM     | Protocol             | Block data stream rejected.                                                |
| 9      | FLASH      | Interlock (no retry) | Flash cannot be written.                                                   |

**What Studio shows.** The user-facing message names the operation and reason (`RadioFoundry refused BEGIN (reason 2, STORAGE): …`). When debug text exists, the Write stepper shows a collapsible **Debug details** block and logs `[radio-write]` to the console. **Interlock** refusals (reasons 1, 2, and 9) do not offer **Reconnect, read & write** — retrying the same session cannot fix them.

**Settings storage at pre-flight.** At connect, CODEPLUG INFO **byte 1 bit 1** (`storage_ready`) is false for **none**, **foreign** and **no flash map** alike — only a STORAGE INFO (command `0x0F`, op 0, read-only) before the pre-write read tells Studio which case it is. Studio refuses there when storage is not writable. **Foreign** alone offers **Unlock storage…** in the Write stepper (Danger zone wizard; see [storage-claim.md](storage-claim.md)) or RadioFoundry's own tools. The upload-time backstop when INFO cannot distinguish the case uses a generic not-ready sentence.

The block reader (`readImageBlocks`: SUMS, then READ of non-blank blocks, CRC-checked, 50 ms between SUMS requests) is shared with the read-only Debug capture, which wraps the port in its own frame guard.

| STORAGE INFO outcome       | Operator message (summary)                                                      |
| -------------------------- | ------------------------------------------------------------------------------- |
| `foreign`                  | Flash still holds another firmware’s settings — claim storage, then write again |
| `none`                     | Storage did not start — power-cycle and try again                               |
| Status 4 (no map)          | Firmware has no storage map for this radio                                      |
| Unknown / no reply / other | Storage not ready; firmware cannot say why                                      |

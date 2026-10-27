# AT-D890UV — backup and restore

Operator zip snapshot of **known-map regions** (not a chip dump, not the ~80 MiB digital-contact FLASH). Restore overlays restorable archive bytes onto a **fresh live erase-unit read** — the same RMW lesson as Write (`i002`: never encode onto a blank map). Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, or encode-from-build helpers.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1141](https://github.com/pskillen/codeplug-studio/issues/1141)

**Coverage:** `known-map-regions`. Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Code table: `src/integrations/radio-io/radios/at-d890uv/backupRestoreRoles.ts`.

| Role                              | Regions                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restorable**                    | Channels (bitmap + data), zones (bitmap, hide, names, members, A/B), scan lists, talk groups + order, RX lists, radio IDs + master ID, **optional settings** (main / ext / GPS info), the settings-unit extents a range change wipes (MM9PDY settings store, DTMF list, ext / APRS text / GPS info tails, GPS zone switch, APRS beacon names), **VFO A/B**, **APRS** config + receive filters, AM airband + AM zones (when present in the zip) |
| **Inspect-only — never restored** | LocalInfo, alarm settings/data (`0x3482e00` is call type, kind, and a BCD id, with `0x30` marked), unnamed leftover, family safe-skip `0x2fa0010`, the NXDN list and NXDN RX group lists (below)                                                                                                                                                                                                                                               |

Write-codeplug does not encode optional settings from a build: it preserves them through the RMW, apart from registered field patches (today the MM9PDY TG step keys; [#1393](https://github.com/pskillen/codeplug-studio/issues/1393), see [memory-layout.md](memory-layout.md)). Restore **does** replay optional settings and APRS from the zip onto live units. Alarm stays inspect-only; if a restore touches the shared `0x3480000` unit, live alarm bytes are retransmitted so erase does not blank them — they are not taken from the archive.

### NXDN lists

Read also takes the NXDN talk-group / contact list (`0x18000000` units) and the NXDN RX group lists (`0x04B80000` unit), on every D890, because the vendor CPS reads the same regions. The NXDN list and the NXDN RX group lists are stored in the backup but are both **inspect-only**. The list sits above the virtual map the restore image covers, so Restore cannot write it back yet; the RX group lists are held back with it because their members are slots in that list, and restoring them alone would point them at the wrong entries (this includes the range-change Danger-zone restore, which restores every restorable region). Both become restorable together when the list does. See [nxdn.md](nxdn.md).

### What a range change wipes and what a Restore brings back

A frequency-range change erases and re-defaults the whole settings unit (`0x3500000`, both halves), VFO A/B, channels, zone members, scan lists and zone names. A backup taken before the change holds all of it, and Restore with every region selected puts it back: everything in the [settings-unit map](memory-layout.md) (including the MM9PDY settings store, which the stock firmware never reads) plus VFO A/B (`vfo-channels`). It does not bring back calibration (that is the vital backup), LocalInfo (inspect-only) or the DTMF settings unit `0x3480000` (not wiped). Backups made before these spans existed lack the settings-unit regions; they still restore, and the bytes there stay as freshly read from the radio. VFO A/B are different: on a real radio they are bitmap-set channel slots, so older zips already carry them inside the `channel-data` regions and restore them.

Digital-contact FLASH is not in the codeplug backup. Calibration and identity are not in it either; they have their own file, the [vital-data backup](#vital-data-backup) below. (An earlier version of this page said calibration is not an isolated named bank. That was wrong: the tune bank at `0x04F00000` holds it, and hardware reads of it worked.)

### After a range change

The change itself wipes and re-defaults; Studio's job afterwards is to put the backup back in the right order.

- **What the boot wipes:** channels, zone members, scan lists, zone names, the whole settings unit (it is re-defaulted for the new range), and VFO A/B. The tune bank is rewritten identically apart from its copy of the range.
- **What Restore brings back:** every restorable region of the zip (see the table above), including the settings-unit extents and VFO A/B.
- **The order rule:** Restore runs **after** the post-change restart, in a **new** session, and writes the codeplug and the settings **together**. Settings alone onto the defaulted codeplug make the radio start at "Program Error / Please Initialize The Radio!", because the restored zone A/B numbers point at empty zones. For the same reason a Restore from the Backup page onto a radio whose range differs from the zip's forces every restorable region.
- **What it never touches:** LocalInfo and calibration. The wizard checks them against the vital backup before restoring and stops on a difference.
- **Official CPS:** it refuses files saved before the change ("Band Error!") until it has read the radio again.

## Vital-data backup

Calibration and identity cannot be recreated if lost, so Studio has a separate, read-only **Back up vital data** action on the D890 Backup / Restore page (tracking [#1288](https://github.com/pskillen/codeplug-studio/issues/1288)). It is not part of the codeplug zip and has **no restore**.

| Unit (requested address) | What it is                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `0x04F00000`             | Calibration (live): tune bank, marked live (`55 55 AA AA` at `+0x3FFFC`). About 1 KiB of non-`FF` tables from `+0x000` |
| `0x04F40000`             | Calibration B: tune bank, upper address. **Labelled "as returned".** On hardware it returns LocalInfo, byte for byte   |
| `0x04F80000`             | LocalInfo (live), marked live. Serial at `+0x30`, range code at `+0x03`, stun/kill flags at `+0x00`/`+0x01`            |
| `0x04FC0000`             | LocalInfo B, upper address                                                                                             |

Rules, from the first hardware read (V1.05):

- **Diversion.** The tune bank's upper unit is not marked live and the radio diverts reads of it to LocalInfo (`0x04F80000`). It cannot be read over USB, so Studio reads the lower address of each pair and calls the upper read "as returned", never a B copy. The manifest records `identicalTo` when two units match. Reading `0x00000000` returns the ICON pack from physical `0x40000`; the vital set does not use it.
- **Read twice, compare.** The whole set is read twice (about 2.3 s per 256 KiB unit at `0xF0`-byte frames, about 20 s in all). Any difference between the passes fails loudly and no file is produced. Two runs eight minutes apart gave identical hashes on hardware.
- **Echoed address.** Every read frame's echoed address is checked. Each unit is read on its own, so no frame crosses a 256 KiB boundary (the last frame of a unit is shorter than `0xF0`).
- **Emptiness.** Almost every unit is "formatted": blank apart from the live marker. The last 4 bytes of a unit are ignored when listing non-`FF` ranges; "all `FF`" is the wrong test.
- **`END` reboots the radio.** The USB device re-enumerates after the normal boot time (20 s or more). After the backup Studio sends `END` as for any read session, and the radio restarts. Wait for it before starting another session.
- **Stun / kill guard.** Before any unit is read, Studio reads LocalInfo `+0x00`/`+0x01`. If either is non-zero it calls `abandonProgramMode()` so no `END` is sent (in a read session `END` with a flag set clears the flag and erases and rewrites LocalInfo, #1288), stops, and tells the user to power-cycle the radio. The check lives in `at-d890uv/stunKillGuard.ts`; the write and read sessions of PR 4c should converge on it.
- **Read-only.** The session sends no `W` frames (asserted by a test).

File: a zip with `manifest.json` (`format: codeplug-studio-d890-vital-backup`, `kind: d890-vital`) and `units/<requested address>.bin`, one per unit. The manifest holds the serial, the 16 ident bytes, the variant (ident byte 8, equal to LocalInfo `+0x03` on hardware), firmware, time, Studio version, and SHA-256 per unit. Opening it checks every length and hash. The codeplug backup parser rejects it with a pointer to **Open vital data file**, and the vital parser rejects a codeplug backup. The file contains the serial and calibration, so the UI warns that it is sensitive.

Code: `vitalBackup.ts` (read), `vitalBackupZip.ts` (zip), `src/app/services/atD890VitalBackup.ts`, `AtD890VitalBackupPanel.tsx`. A decoded tune-table viewer is a later PR; the UI shows raw non-`FF` ranges and hashes only. **Not yet checked on a radio** beyond the reference tool's results above.

## Restore path

1. App identity: live LocalInfo serial must match the zip (hard refuse).
2. `AtD890uvProtocol.restoreFromBackup` — connected PROGRAM session.
3. Overlay selected restorable region bytes onto freshly read erase units.
4. Transmit non-`0xff` 16-byte blocks; skip LocalInfo, `0x2fa0010`, and flash bookkeeping markers (`+0x3fbf0` / `+0x3fff0`).

The `0x2fa0010` skip is anytone-cps lore. The official CPS encoder we read does not skip that address. Studio still skips it on Restore, as a family precaution. D890 `LocalInfo+0x10` (`0x4f80010`) is excluded because LocalInfo is not on the upload allow-list.

Progress copy is **Restore**, not “Writing codeplug.”

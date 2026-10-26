# AT-D890UV — backup and restore

Operator zip snapshot of **known-map regions** (not a chip dump, not the ~80 MiB digital-contact FLASH). Restore overlays restorable archive bytes onto a **fresh live erase-unit read** — the same RMW lesson as Write (`i002`: never encode onto a blank map). Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, or encode-from-build helpers.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1141](https://github.com/pskillen/codeplug-studio/issues/1141)

**Coverage:** `known-map-regions`. Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Code table: `src/integrations/radio-io/radios/at-d890uv/backupRestoreRoles.ts`.

| Role                              | Regions                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Restorable**                    | Channels (bitmap + data), zones (bitmap, hide, names, members, A/B), scan lists, talk groups + order, RX lists, radio IDs + master ID, **optional settings** (main / ext / GPS info), **APRS** config + receive filters, AM airband + AM zones (when present in the zip) |
| **Inspect-only — never restored** | LocalInfo, alarm settings/data (`0x3482e00` is call type, kind, and a BCD id, with `0x30` marked), unnamed leftover, family safe-skip `0x2fa0010`                                                                                                                        |

Write-codeplug still does **not** encode optional settings from a build (Read / RMW-preserve only). Restore **does** replay optional settings and APRS from the zip onto live units. Alarm stays inspect-only; if a restore touches the shared `0x3480000` unit, live alarm bytes are retransmitted so erase does not blank them — they are not taken from the archive.

Digital-contact FLASH is not in the codeplug backup. Calibration and identity are not in it either; they have their own file, the [vital-data backup](#vital-data-backup) below. (An earlier version of this page said calibration is not an isolated named bank. That was wrong: the tune bank at `0x04F00000` holds it, and hardware reads of it worked.)

## Vital-data backup

Calibration and identity cannot be recreated if lost, so Studio has a separate, read-only **Back up vital data** action on the D890 Backup / Restore page (tracking [#1288](https://github.com/pskillen/codeplug-studio/issues/1288)). It is not part of the codeplug zip and has **no restore**.

| Unit (requested address) | What it is                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `0x04F00000`             | Tune bank, marked live (`55 55 AA AA` at `+0x3FFFC`). About 1 KiB of non-`FF` tables from `+0x000`    |
| `0x04F40000`             | Tune bank, upper address. **Labelled "as returned".** On hardware it returns LocalInfo, byte for byte |
| `0x04F80000`             | LocalInfo, marked live. Serial at `+0x30`, range code at `+0x03`, stun/kill flags at `+0x00`/`+0x01`  |
| `0x04FC0000`             | LocalInfo, upper address                                                                              |

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

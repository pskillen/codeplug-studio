# AT-D890UV — backup and restore

Operator zip snapshot of **known-map regions** (not a chip dump, not the ~80 MiB digital-contact FLASH). Restore overlays restorable archive bytes onto a **fresh live erase-unit read** — the same RMW lesson as Write (`i002`: never encode onto a blank map). Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, or encode-from-build helpers.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1141](https://github.com/pskillen/codeplug-studio/issues/1141)

**Coverage:** `known-map-regions`. Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Code table: `src/integrations/radio-io/radios/at-d890uv/backupRestoreRoles.ts`.

| Role                              | Regions                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Restorable**                    | Channels (bitmap + data), zones (bitmap, hide, names, members, A/B), scan lists, talk groups + order, RX lists, radio IDs + master ID, **optional settings** (main / ext / GPS info), **APRS** config + receive filters, AM airband + AM zones (when present in the zip) |
| **Inspect-only — never restored** | LocalInfo, alarm bitmap/data, unnamed leftover, family safe-skip `0x2fa0010`                                                                                                                                                                                             |

Write-codeplug still does **not** encode optional settings from a build (Read / RMW-preserve only). Restore **does** replay optional settings and APRS from the zip onto live units. Alarm stays inspect-only; if a restore touches the shared `0x3480000` unit, live alarm bytes are retransmitted so erase does not blank them — they are not taken from the archive.

Calibration is not an isolated named bank on this radio. Digital-contact FLASH is not in the backup.

## Restore path

1. App identity: live LocalInfo serial must match the zip (hard refuse).
2. `AtD890uvProtocol.restoreFromBackup` — connected PROGRAM session.
3. Overlay selected restorable region bytes onto freshly read erase units.
4. Transmit non-`0xff` 16-byte blocks; skip LocalInfo, `0x2fa0010`, and flash bookkeeping markers (`+0x3fbf0` / `+0x3fff0`).

Progress copy is **Restore**, not “Writing codeplug.”

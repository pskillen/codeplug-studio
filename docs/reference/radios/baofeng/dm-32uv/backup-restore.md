# DM-32UV — backup and restore

Operator zip snapshot of **sparse 4KB codeplug blocks** (known map, not a chip dump, not the full V-frame `0x0F` contact bank). Restore replays **restorable** archive blocks onto a radio whose live V-frame bases still match the zip. Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, `mergeChannelsIntoHydration`, or Write remap after factory reset.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1144](https://github.com/pskillen/codeplug-studio/issues/1144)

**Coverage:** `known-map-regions`. Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Code table: `src/integrations/radio-io/radios/dm32uv/backupRestoreRoles.ts`.

| Role                              | Regions                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Restorable**                    | Discovered 4KB blocks that are not calibration (channels, zones, scan, TGs, RX groups, settings) |
| **Inspect-only — never restored** | Calibration blocks (`0x02` at offset `0xFFF`)                                                    |

There is no LocalInfo bank on this radio. Backup still records `restoreFragileAfterFactoryReset` plus live `addressBase` / `dm32ContactsBase` / `dm32ContactsEnd` from V-frames `0x0A` / `0x0F`.

## Factory reset

Restore **refuses** when those live bases differ from the zip (typical after a factory reset). A factory-reset radio is already in a working state. **Remapping archive blocks onto a new map is out of scope** — that remap exists only on Write-codeplug (`#703`).

Warn at backup: after a factory reset, a backup taken beforehand cannot be restored.

## Restore path

1. App identity: model match. This layout has **no serial** in the zip — confirm firmware / label. Serial mismatch is a hard refuse when a zip has a serial (D890-style archives).
2. Live V-frame bases must match the manifest or restore is refused **before any write**.
3. `Dm32uvProtocol.restoreFromBackup` — connected PROGRAM session; writes selected restorable 4KB blocks at their archive addresses.
4. Never calibration. Never assemble. Never persist a radio-clone bag.
5. Progress copy is **Restore**, not “Writing codeplug.” Write-codeplug overlays modelled channels onto an in-session content pre-write read; Restore does **not** call `upload()`, assemble, or that pre-write read.

## Related

- [protocol.md](protocol.md) — V-frame + 4KB R/W
- [memory-layout.md](memory-layout.md) — metadata discovery
- [settings.md](settings.md) — co-resident blocks including calibration

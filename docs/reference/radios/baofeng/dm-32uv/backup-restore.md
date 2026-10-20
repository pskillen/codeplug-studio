# DM-32UV — backup and restore

Operator zip snapshot of **sparse 4KB codeplug blocks** (known map, not a chip dump, not the full V-frame `0x0F` contact bank). Restore replays **restorable** archive blocks onto a radio whose live V-frame bases still match the zip. Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, `mergeChannelsIntoHydration`, or Write remap after factory reset.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1144](https://github.com/pskillen/codeplug-studio/issues/1144)

**Coverage:** `known-map-regions`. Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Code table: `src/integrations/radio-io/radios/dm32uv/backupRestoreRoles.ts`.

| Role                              | Regions                                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restorable**                    | Discovered 4KB blocks that are not calibration (channels, zones, scan, TGs, RX groups, settings)                                                                        |
| **Inspect-only — never restored** | In-range calibration pages (tag `0x02` inside the V-frame `0x0A` window) and, when both reads match, the factory sector. Field tables: [calibration.md](calibration.md) |

There is no LocalInfo bank on this radio. Backup still records `restoreFragileAfterFactoryReset` plus live `addressBase` / `dm32ContactsBase` / `dm32ContactsEnd` from V-frames `0x0A` / `0x0F`.

Tag `0x02` is calibration only inside the live V-frame `0x0A` window. The lowest in-range address is the live page; a higher in-range `0x02` is a duplicate and is still inspect-only. Pages that end in `0x02` outside the window are not packed. The factory sector is read twice during backup (`47 00 00 00 00 10` only). Studio keeps it only when both replies match; a mismatch keeps nothing and does not send a third read. Sending opcode `0x43` or `0x53` is forbidden. Write and Restore do not send the calibration page, and neither the page nor the factory sector is a restore checkbox. Restoring them is not in this ticket. Offsets: [calibration.md](calibration.md). The eFuse UID from V-frame `0x02` is shown as identity and is not stored in `manifest.serial`.

## Factory reset

Restore **refuses** when those live bases differ from the zip (typical after a factory reset). A factory-reset radio is already in a working state. **Remapping archive blocks onto a new map is out of scope** — that remap exists only on Write-codeplug (`#703`).

Warn at backup: after a factory reset, a backup taken beforehand cannot be restored.

## Restore path

1. App identity: model match. This layout has **no serial** in the zip — confirm firmware / label. Serial mismatch is a hard refuse when a zip has a serial (D890-style archives).
2. Live V-frame bases must match the manifest or restore is refused **before any write**.
3. Duplicate occupied metadata tags are refused before any write ([protocol.md](protocol.md#write-codeplug-4kb-block)).
4. `Dm32uvProtocol.restoreFromBackup` — connected PROGRAM session; writes selected restorable 4KB blocks at their archive addresses.
5. Never calibration. A restorable chunk that ends in `0x02`, or that targets the live calibration address, is refused before any write. Never assemble. Never persist a radio-clone bag.
6. Progress copy is **Restore**, not “Writing codeplug.” Write-codeplug overlays modelled channels onto an in-session content pre-write read; Restore does **not** call `upload()`, assemble, or that pre-write read. After a successful Restore, stock and MM9PDY tell the operator to power the radio off and on ([protocol.md](protocol.md#write-codeplug-4kb-block)).

## Related

- [protocol.md](protocol.md) — V-frame + 4KB R/W
- [memory-layout.md](memory-layout.md) — metadata discovery
- [calibration.md](calibration.md) — calibration and factory-sector field tables
- [settings.md](settings.md) — co-resident blocks including calibration

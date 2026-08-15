# OpenGD77 / OpenUV380 — backup and restore

Operator zip snapshot of **registered FLASH programming spans** (not a chip dump, not FirmwareInfo). Restore replays selected restorable spans onto the radio by treating a **blank 0xff prior** as dirty (not the live FLASH image, and not an armed Write overlay). After sectors, Studio sends **SAVE_REBOOT** (`C` + `06h` + `00h`) the same as Write `upload`. Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, `armWriteProjection`, or encode the current build into FLASH.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../features/radio-read-write/backup-restore.md) · Tracking: [#1142](https://github.com/pskillen/codeplug-studio/issues/1142)

**Coverage:** `known-map-regions`. Shared by DM-1701 and MD-9600 (`OpenGd77Protocol`). Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Code table: `src/integrations/radio-io/radios/opengd77/backupRestoreRoles.ts` (`OPENGD77_BACKUP_FLASH_SPANS`).

| Role             | Regions                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restorable**   | All four registered OpenUV380 FLASH spans (`flash-span-0` … `flash-span-3`), including Write-kept settings / DTMF / APRS / VFO / boot that live inside those spans                                                                |
| **Inspect-only** | Addresses **outside** those spans, including occupied **User Database** (`user-database` zip region at FLASH `0x50000` + overflow `0xd8000`). FirmwareInfo is mem `09h` and is not packed in the zip. Do not invent a cal offset. |

Write-codeplug still overlays modelled channels/zones/contacts/RX lists onto a **live pre-write read** and keeps settings/APRS from that prior. Restore **does** rewrite settings and APRS when those bytes are in the selected FLASH spans.

## Restore path

1. App identity: model match; serial refuse when the zip has a serial (OpenGD77 archives often have none — confirm firmware / label).
2. `OpenGd77Protocol.restoreFromBackup` — already connected CPS session.
3. Copy selected restorable span bins onto a virgin OpenUV380 map; `collectDirtySectors` vs empty prior (force program archive bytes even when live FLASH already matches).
4. Program dirty 4KB FLASH sectors (`X` framing). Never LocalInfo. Never calibration (none in this map).
5. **SAVE_REBOOT** even if the operator selected spans that happen to be all `0xff` vs blank (then sector count may be zero; reboot still sent).

Progress copy is **Restore**, not “Writing codeplug.” Write `upload` is unchanged (in-session pre-write read + projection overlay).

## Related

- [protocol.md](protocol.md) — `SAVE_REBOOT` control action
- [memory-layout.md](memory-layout.md) — registered FLASH spans
- Radio homes: [DM-1701](../baofeng/dm-1701/README.md), [MD-9600](../tyt/md-9600/README.md)

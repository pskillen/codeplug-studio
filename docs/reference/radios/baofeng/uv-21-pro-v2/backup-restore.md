# UV-21Pro V2 — backup and restore

Operator zip snapshot of the **CHIRP-sized PROGRAM+R/W programming clone** (four named `MEM_*` regions packed to `0x8380`). Restore uploads selected restorable MEM bins with the same upload handshake as Write `upload`. Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, or merge channels into hydration, and it does not persist a radio-clone bag on the project.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1143](https://github.com/pskillen/codeplug-studio/issues/1143)

**Coverage:** `full-clone` of the programming image (not a whole-flash dump). Shared protocol: `Uv17ProProtocol`. Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Code table: `src/integrations/radio-io/radios/uv17pro-family/backupRestoreRoles.ts` (`uv17ProBackupMemSpans` for `UV21_PRO_V2_LAYOUT`).

| Role             | Regions                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Restorable**   | `mem-0` … `mem-3` — packed offsets of radio `0x0000` / `0x9000` / `0xA000` / `0xD000`. Includes Write-kept VFO / settings / ANI / fourth MEM block                                                                  |
| **Inspect-only** | None on this map. Studio has **no** isolated calibration or LocalInfo table. Residual: if the vendor hid cal inside these spans, Restore will send those bytes — do **not** invent a cal offset to skip            |

Write-codeplug still requires **project / session stash** (`hydrationRequiredForWrite: true`). Restore does **not** use that stash; it replays zip MEM bins only.

## Restore path

Same as [UV-5R Mini](../uv-5r-mini/backup-restore.md): upload handshake, then `0x40` writes for selected restorable MEM radio addresses only. Packed image size is `0x8380` (four regions).

Progress copy is **Restore**, not “Writing codeplug.”

## Related

- [protocol.md](protocol.md) · [memory-layout.md](memory-layout.md)
- Sibling: [UV-5R Mini backup-restore](../uv-5r-mini/backup-restore.md)

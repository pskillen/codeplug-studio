# UV-5R Mini — backup and restore

Operator zip snapshot of the **CHIRP-sized PROGRAM+R/W programming clone** (three named `MEM_*` regions packed to `0x8240`). Restore uploads selected restorable MEM bins with the same upload handshake as Write `upload`. Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, or `mergeChannelsIntoHydration`, and it does not persist a radio-clone bag on the project.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1143](https://github.com/pskillen/codeplug-studio/issues/1143)

**Coverage:** `full-clone` of the programming image (not a whole-flash dump). Shared protocol: `Uv17ProProtocol`. Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Code table: `src/integrations/radio-io/radios/uv17pro-family/backupRestoreRoles.ts` (`uv17ProBackupMemSpans`).

| Role             | Regions                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restorable**   | `mem-0` … `mem-2` — packed offsets of radio `0x0000` / `0x9000` / `0xA000`. Includes Write-kept VFO / settings / ANI that live inside those spans                                                       |
| **Inspect-only** | None on this map. Studio has **no** isolated calibration or LocalInfo table. Residual: if the vendor hid cal inside these spans, Restore will send those bytes — do **not** invent a cal offset to skip |

Write-codeplug still requires **project / session stash** (`hydrationRequiredForWrite: true`) and overlays modelled channels onto that image. Restore **does not** use that stash; it replays zip MEM bins only.

## Restore path

1. App identity: model match; no serial in this layout — confirm firmware / label. Serial mismatch is a hard refuse when a zip has a serial.
2. `Uv17ProProtocol.restoreFromBackup` — connect purpose `restore` (handshake `none`); restore runs the **upload** magics itself.
3. Copy selected restorable MEM bins onto a packed `0x8240` map; program only those radio addresses (`0x40` blocks). Unselected MEM spans are not written.
4. Never LocalInfo. Never a separate calibration write (none in this layout).
5. Progress copy is **Restore**, not “Writing codeplug.” Write `upload` is unchanged (stash / in-session hydration still required).

## Related

- [protocol.md](protocol.md) — PROGRAM+R/W upload handshake
- [memory-layout.md](memory-layout.md) — packed `MEM_*` map
- Sibling: [UV-21Pro V2 backup-restore](../uv-21-pro-v2/backup-restore.md)

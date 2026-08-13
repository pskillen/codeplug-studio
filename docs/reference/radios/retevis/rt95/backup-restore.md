# RT95 VOX — backup and restore

Operator zip snapshot of the **PROGRAM→QX programming clone** (`0x32A0` bytes, region `programming-image`). Restore uploads that clone with the same handshake as Write `upload` (PROGRAM → ident → priming read `0x3b10` → `0x10` blocks). Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, or `mergeChannelsIntoHydration`, and it does not persist a radio-clone bag on the project.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1145](https://github.com/pskillen/codeplug-studio/issues/1145)

**Coverage:** `full-clone` of the programming image (tiny; not an 80 MiB dump). Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Backup packing: `src/integrations/radio-io/backup/regionsFromDownload.ts` (`fromRt95`). Restore payload: `src/integrations/radio-io/radios/rt95/restoreFromBackup.ts`.

| Role             | Regions                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Restorable**   | `programming-image` — contiguous `0x0000`–`0x3290` clone (`0x32A0` bytes), including settings / DTMF / bandlimit that live in that span                                                                                        |
| **Inspect-only** | None on this map. Studio has **no** isolated calibration or LocalInfo table, and **no serial** in the layout. Residual: if the vendor hid cal inside the clone, Restore will send those bytes — do **not** invent a cal offset |

Write-codeplug overlays modelled channels onto an **in-session** full-clone read (`resolveRadioWriteImageForUpload`; `hydrationRequiredForWrite: false`). Restore **does not** use a project bag or that pre-write read; it replays zip clone bins via `upload()` only.

## Restore path

1. App identity: model match; no serial in this layout — confirm firmware / label. Serial mismatch is a hard refuse when a zip has a serial.
2. `Rt95Protocol.restoreFromBackup` — connect purpose `restore` (handshake `none`); restore runs the **upload** handshake itself.
3. Copy selected restorable clone bins onto a `0x32A0` map; program `0x10` blocks `0x0000`…`0x3290`. Unselected / inspect-only bins are not written.
4. Never LocalInfo. Never a separate calibration write (none in this layout).
5. Progress copy is **Restore**, not “Writing codeplug.” Write `upload` stays “write these bytes” (no live `download()` inside it). Write does not require a project bag.

## Related

- [protocol.md](protocol.md) — PROGRAM→QX upload handshake
- [memory-layout.md](memory-layout.md) — contiguous clone map

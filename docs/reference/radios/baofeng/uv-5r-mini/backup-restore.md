# UV-5R Mini — backup and restore

Operator zip snapshot of the **CHIRP-sized PROGRAM+R/W programming clone** (three named `MEM_*` regions packed to `0x8240`), plus, from a build on the **MM9PDY target**, the zone table as a fourth region. Restore uploads selected restorable MEM bins with the same upload handshake as Write `upload`. Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, or `mergeChannelsIntoHydration`, and it does not persist a radio-clone bag on the project.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1143](https://github.com/pskillen/codeplug-studio/issues/1143)

**Coverage:** `full-clone` of the programming image (not a whole-flash dump). Shared protocol: `Uv17ProProtocol`. Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Code table: `src/integrations/radio-io/radios/uv17pro-family/backupRestoreRoles.ts` (`uv17ProBackupMemSpans`).

| Role             | Regions                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restorable**   | `mem-0` … `mem-2` — packed offsets of radio `0x0000` / `0x9000` / `0xA000`. Includes Write-kept VFO / settings / ANI that live inside those spans                                                       |
| **Inspect-only** | None on this map. Studio has **no** isolated calibration or LocalInfo table. Residual: if the vendor hid cal inside these spans, Restore will send those bytes — do **not** invent a cal offset to skip |

Write-codeplug overlays modelled channels onto an **in-session** radio read. Restore **does not** use a project bag; it replays zip bins only.

## The zone table region (MM9PDY target)

The build's Web Serial profile decides whether Backup and Restore carry the MM9PDY zone table (external SPI
`0xC000`-`0xCFFF`, see [mm9pdy-data.md](mm9pdy-data.md)). Code: `src/integrations/radio-io/radios/uv5r-mini/zoneBackup.ts`.

| Profile                              | Backup                                                                                                                                                                                    | Restore                                                                                                                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock (`radio-io-uv5r-mini`)         | The three clone regions. Nothing at or above `0xC000` is read                                                                                                                             | Clone regions only. A backup's table region shows as _Restores from the UV-5R Mini (MM9PDY) target only_ and is left out; a request that names it is refused before the first frame. The radio's table is untouched                                           |
| MM9PDY (`radio-io-uv5r-mini-mm9pdy`) | The clone, then the table sector read as 64 frames, packed as region `zones` (`regions/zones.bin`, address `0xC000`, 4096 bytes, restorable). Its label says the zone count or "no table" | Clone blocks first, then the header frame at `0xC000` (that write erases the sector), then every later frame that is not all `FF`, in address order, as the backup holds them. A backup with no table restores the header alone: the radio ends with no table |

- The `zones` region's address is the radio address, unlike the clone regions' packed offsets. Opening the zip puts
  the table at `0xC000` of the archive image, past the packed clone.
- Restore runs under the Backup / Restore profile, never a Write's zone intent. The write interlock checks the whole
  plan (clone blocks and table frames, all inside `0xC000`-`0xCFC0` for the table) before the handshake, and the
  model check runs before any frame. A region named `zones` at any address or size other than `0xC000` / 4096 is
  refused.
- The MM9PDY target's Restore follows its Write and is available on every site, production included.
- A Restore of a stock backup on the MM9PDY profile writes the clone only; the radio's table stays as it was.

## Restore path

1. App identity: model match; no serial in this layout — confirm firmware / label. Serial mismatch is a hard refuse when a zip has a serial.
2. `Uv17ProProtocol.restoreFromBackup` — connect purpose `restore` (handshake `none`); restore runs the **upload** magics itself.
3. Copy selected restorable MEM bins onto a packed `0x8240` map; program only those radio addresses (`0x40` blocks). Unselected MEM spans are not written. On the MM9PDY profile a selected `zones` region follows, header first.
4. Never LocalInfo. Never a separate calibration write (none in this layout).
5. Progress copy is **Restore**, not “Writing codeplug.” Write `upload` is unchanged (stash / in-session hydration still required).

## Related

- [protocol.md](protocol.md) — PROGRAM+R/W upload handshake
- [memory-layout.md](memory-layout.md) — packed `MEM_*` map
- Sibling: [UV-21Pro V2 backup-restore](../uv-21-pro-v2/backup-restore.md)

# RT95 VOX — backup and restore

Operator zip snapshot of the **PROGRAM→QX programming clone** (`0x32A0` bytes, region `programming-image`). Restore uploads that clone with the same handshake as Write `upload` (PROGRAM → ident → priming read `0x3b10` → `0x10` blocks). Restore is **not** Write-codeplug: it does not call `assemble`, `prepareRadioWriteImage`, or `mergeChannelsIntoHydration`, and it does not persist a radio-clone bag on the project.

**Hub:** [README.md](README.md) · Product contract: [backup-restore.md](../../../../features/radio-read-write/backup-restore.md) · Tracking: [#1145](https://github.com/pskillen/codeplug-studio/issues/1145)

**Coverage:** `full-clone` of the programming image (tiny; not an 80 MiB dump). Hardware verify of Restore is **pending**.

## Restorable vs inspect-only

Backup packing: `src/integrations/radio-io/backup/regionsFromDownload.ts` (`fromRt95`). Restore payload: `src/integrations/radio-io/radios/rt95/restoreFromBackup.ts`.

| Role             | Regions                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restorable**   | `programming-image` — contiguous `0x0000`–`0x3290` clone (`0x32A0` bytes), including settings / DTMF / bandlimit that live in that span                                                                                                                                                                                                        |
| **Inspect-only** | None on this map. The codeplug backup has **no** isolated calibration or LocalInfo table, and **no serial** in the layout. The factory calibration is outside the clone (`0x3CC0`–`0x3FBF`, beyond the `0x32A0` image; F24, F115), so Restore never sends it. It is saved separately by the [safety backup](#safety-backup-calibration-region) |

Write-codeplug overlays modelled channels onto an **in-session** full-clone read (`resolveRadioWriteImageForUpload`). Restore **does not** use a project bag or that pre-write read; it replays zip clone bins via `upload()` only.

## Restore path

1. App identity: model match; no serial in this layout — confirm firmware / label. Serial mismatch is a hard refuse when a zip has a serial.
   **Band check:** the backup's band code (image `0x326D`) must equal the connected radio's ident band. A mismatch is refused before any block is written: "This backup is from a radio with a different band … Restore refused, no block was written.". The stock CPS refuses a Write on the same test (F112).
2. `Rt95Protocol.restoreFromBackup` — connect purpose `restore` (handshake `none`); restore runs the **upload** handshake itself.
3. Copy selected restorable clone bins onto a `0x32A0` map; program `0x10` blocks `0x0000`…`0x3290`. Unselected / inspect-only bins are not written.
4. Never LocalInfo. Never a separate calibration write (none in this layout).
5. Progress copy is **Restore**, not “Writing codeplug.” Write `upload` stays “write these bytes” (no live `download()` inside it). Write does not require a project bag.

## Safety backup (calibration region)

EEPROM `0x3B00`–`0x3FFF` holds what a codeplug write cannot rebuild: the ident block (`0x3B00`), the factory calibration (about `0x3CC0`–`0x3FBF`) and the `AT778-UV` signature (`0x3FF8`). Studio can save it from the **Safety backup** section of Backup / Restore on an RT95 build. It is read-only (`PROGRAM`, `02`, `R`, `END`) and there is no restore in Studio. Code: `src/integrations/radio-io/radios/rt95/safetyBackup/`.

**Read rules** (the firmware project's): the ident must be `RT95-P`; every 16-byte block is read twice; a block that differs is read a third time and kept only if it equals one of the first two, else the backup fails. After the read it fails if any block in `0x3B00`–`0x3FFF` is all zero (the head answered for a main board that did not), if `0x7B00` equals `0x3B00` (a 16 KiB part), or if `0x3FF8`–`0x3FFF` is not `AT778-UV` (memory formatted or damaged). `END` is always sent.

**Two regions.** _Calibration_ reads `0x3B00`–`0x3FFF` (1,280 bytes) plus one read of `0x7B00`. _Full EEPROM_ reads `0x0000`–`0x7FFF` (32,768 bytes, about 4 to 6 minutes) and satisfies the requirement too, since it contains the calibration region.

**Files.** One zip per backup, `rt95-eeprom-<cal|full>-<SERIAL>-<YYYYmmdd-HHMMSS>.zip`, holding `<base>.bin` and `<base>.json` with the same base name. The manifest keys are `format`, `version` (1), `start`, `end`, `size`, `sha256`, `fingerprint` (first 8 hex of the sha256), `ident` (`model`, `bandlimit`, `version`), `chip` (`"32KiB"`), `signature_ok`, `passes` (2), `rereads` (block addresses that needed a third read), `created` (local time, seconds), `tool`, `tool_sha256` (empty from Studio) and `serial`.

| Format      | `format`                                           | `start`–`end` | Restore                                                                       |
| ----------- | -------------------------------------------------- | ------------- | ----------------------------------------------------------------------------- |
| Full EEPROM | `rt95-full-backup` v1 (the firmware project's own) | 0–32767       | The firmware project's `rt95_restore.py <base>.json` reads it after unzipping |
| Calibration | `rt95-cal-backup` v1, the same keys                | 15104–16383   | A record only, until the firmware project's restore tool accepts this format  |

**Which radio.** The operator types the serial number from the radio's label; it is normalised (trim, uppercase, inner whitespace collapsed), put in the file name and the manifest `serial`, and is the key of the record. The ident is read and shown but never used as the key: it cannot tell two RT95s apart, and anything read from the EEPROM cannot identify a radio whose calibration was lost. A backup from older tooling with no `serial` is recorded after the operator types one.

**The record.** Browser storage key `codeplug-studio.radio-safety-backups.v1`: `family` (`retevis-rt95`), `radioKey` (the serial), `region`, `fileName`, `sha256`, `fingerprint`, `savedAt`, `studioVersion`. **Never the bytes.** A record is written only when the operator ticks that they saved the downloaded file, or opens a file they already have and Studio verifies it (format, sizes, sha256 and fingerprint, `AT778-UV` in the data, ident `RT95-P`, at least two passes). Any age counts; one saved backup per radio is enough.

## Related

- [protocol.md](protocol.md) — PROGRAM→QX upload handshake
- [memory-layout.md](memory-layout.md) — contiguous clone map

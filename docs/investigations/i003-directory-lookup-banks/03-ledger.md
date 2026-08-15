# Evidence ledger

**Rows are immutable.** If a verdict is wrong, add a **new** row that references the old id.

| Prefix | Kind                                                         |
| ------ | ------------------------------------------------------------ |
| `S/`   | Source read (code / docs / qdmr / user guide) — not hardware |
| `O/`   | Operator report (no artefact)                                |
| `R/`   | Studio Write / verify (none yet)                             |
| `D/`   | Memory dump (none yet)                                       |

**Timestamps in artefact names are UTC.** Git commits may be BST (+1).

Do not commit personal codeplugs, live dumps, or operator DMR-ID images.

---

## Source reads

| id                       | When       | What was read                                                                                                                                                                                                                                                                                                                                                        | Result as reported                                                                                                                                                       | What it actually established                                                                                         |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `S/2026-08-15-code`      | 2026-08-15 | Studio: `dualBankRadioWrite.ts`, `radioIoWriteProjection.ts` (`buildOpenGd77ContactsAndRx`, `buildDm32RadioIdBank`), `cpsDigitalDirectoryProjection.ts`, OpenGD77 `contactCodec.ts` / `constants.ts` / `cloneSummary.ts` / `backupRestoreRoles.ts`, DM-32 `radioIdCodec.ts` / `contactCodec.ts` / `protocol.ts` download skip, `traits.ts`, `profileExportLimits.ts` | Directory → OpenGD77 `digitalContacts` (1024); directory → DM-32 `radioIds` (`0x67`, 250); library DM-32 → V-`0x0F`; OpenGD77 backup spans omit callsign DB              | **Code behaviour today.** Not what the radios display. Not that qdmr addresses are correct on hardware.              |
| `S/2026-08-15-qdmr`      | 2026-08-15 | Fetched `openuv380_callsigndb.hh` / `.cc`, `opengd77_callsigndb.hh`, `opengd77base_callsigndb.hh` from hmatuschek/qdmr master; Doxygen OpenUV380CallsignDB page                                                                                                                                                                                                      | UV380 encode: header `0x50000`, entries1 `0xd8000`, size0 `0x40000`, size1 `0xd28000`, entry `0x1b`; GD-77 header `0x30000`; class comment on UV380 still says `0x30000` | **What qdmr’s encoder allocates.** Not a 1701 dump. `size1` arithmetic must not become Studio SoT.                   |
| `S/2026-08-15-userguide` | 2026-08-15 | LibreDMR `OpenGD77_User_Guide.md` — DMR ID display + “Writing DMR IDs — the User Database”                                                                                                                                                                                                                                                                           | Display uses DMR ID database; CPS has a separate write UI; ~13 800–69 600 IDs by character count; Talker Alias can fill gaps                                             | **Firmware operator contract** as documented. Not packing bytes or FLASH bases.                                      |
| `S/2026-08-15-impl`      | 2026-08-15 | Studio #1211 implementation: `userDatabaseCodec.ts`, sidecar `programUserDatabaseSectors`, `collectDualBankDirectorySlice` OpenGD77 overlap keep, CPS skip+warn, occupied Backup region `user-database`                                                                                                                                                              | Code: directory → User Database occupied sectors; contact bank is library TGs/privates only; inspect count separate from DMR contacts                                    | **Code behaviour on this branch.** Not a live dump. FLASH bases still qdmr `Offset`. Incoming-call display unproven. |

## Operator reports

| id       | When       | What was reported                                                                                                                           | What it actually established                                                                                                                                           |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `O/1211` | 2026-08-15 | OpenGD77 Baofeng 1701 directory contacts seemed capped at 1024 on Backup / Restore; question whether they are written to the correct memory | Symptom that opened #1211. Does **not** by itself prove User Database vs contact bank. Combined with `S/2026-08-15-code`, the 1024 figure is the contact-bank decoder. |

## Runs / dumps

None yet.

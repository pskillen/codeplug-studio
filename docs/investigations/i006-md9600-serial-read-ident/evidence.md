# Evidence — i006

Condensed ledger: only the runs a conclusion still rests on, plus the hung-session probes whose _retraction_ is instructive. Operator zips are local Downloads only — **do not commit**.

Clocks: dump `capturedAt` is UTC. 08:46Z = 09:46 BST; 11:31Z = 12:31 BST on 2026-08-18.

| Prefix | Kind                                     |
| ------ | ---------------------------------------- |
| `S/`   | source read                              |
| `R/`   | computed scan (no radio in that process) |
| `D/`   | dump / snapshot                          |
| `E/`   | dump-CLI errand                          |

## Source

| id                 | What it established                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `S/git-offsets`    | `OPENUV380_OFFSET` / `OPENUV380_FLASH_SPANS` unchanged since `b645be87` (2026-07-24).                                     |
| `S/memory-layout`  | Documented OpenUV380 bases (`channelBank0` `0x3780`, bank bitmask @ `+0x00`, records @ `+0x10`, zones/contacts/RX lists). |
| `S/firmwareInfo`   | FirmwareInfo is 46 bytes; the hung tile is the **first 32**.                                                              |
| `S/readMem`        | FLASH `'R'` uses `expectedLength` 32. A 46-byte ident reply would abort.                                                  |
| `S/download`       | Studio asks FLASH mem `01h` over the four spans after ident + SHOW_CPS.                                                   |
| `S/backup-live`    | Live inspect hydrates the download image; zip bins are those bytes.                                                       |
| `S/decode-empty`   | Ident tile → junk channel names; zone/contact skip names starting `0x00`.                                                 |
| `S/dump-tool-read` | Dump CLI sends a real `'R'` per region; it does not reprint ident as a stub.                                              |

## Dumps (not in git)

| id                                   | Artefact                                                     | Why it matters                                                                                         |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `D/2026-08-18-md9600-backup`         | `~/Downloads/radio-backup-MD-9600-2026-08-18T08-46-34-128Z/` | Hung Backup. Four spans, correct sizes, 100% ident tile. Unreliable as a codeplug. **Do not Restore.** |
| `D/2026-08-18-md9600-backup-healthy` | `~/Downloads/radio-backup-MD-9600-2026-08-18T11-31-53-517Z/` | Healthy Backup. Real OpenUV380 image + User Database. Inspect displays correctly.                      |
| `D/2026-08-18-e3-*`                  | `/tmp/e3-md9600-skip-ident/`, `/tmp/e3-md9600-ident/`        | Recovered-radio 32-byte windows at `0x3780`. Match healthy Backup `channelBank0`.                      |

Hung-session CLI bins (`E1`/`E2` under `/tmp/e1-…`, `/tmp/e2-…`) are the same ident tile as the `08:46Z` zip.

## Runs

| id                                 | Result                                                                                                            | Established                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `R/2026-08-18-tile-scan`           | Hung zip: 0 mismatches vs 32-byte FirmwareInfo prefix in 125 664 FLASH bytes                                      | Not a shifted codeplug inside those spans.                |
| `R/2026-08-18-hang-context`        | Operator: radio hung during `E1`/`E2`                                                                             | Re-interprets those probes as hang, not healthy protocol. |
| `R/2026-08-18-healthy-backup-scan` | 0 ident-equal 32-byte blocks; 113 / 11 / 39 / 12 named channels / zones / contacts / RX lists at documented bases | Healthy `download()` is FLASH. Map holds.                 |

## Errands

| id    | Config                                                   | Established after hang context                                    |
| ----- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `E/1` | ident + SHOW_CPS; FLASH then EEPROM @ `0x3780`           | Hung: both ident tile. Not the healthy FLASH-vs-EEPROM answer.    |
| `E/2` | SHOW_CPS only; FLASH @ `0x3780`                          | Hung: still ident tile.                                           |
| `E/3` | recovered; skip-ident then ident+FLASH+EEPROM @ `0x3780` | Channel-bank window (`GB7EM Aberdeen`); ident did not replace it. |

Dump CLI: `dev-tools/radio-memory-dump/` ([PR #1246](https://github.com/pskillen/codeplug-studio/pull/1246)). Read-only; never `'W'`/`'X'`.

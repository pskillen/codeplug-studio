# Dead ends — i006

Do not re-diff `memory-layout.md` or hunt for names at a shifted offset _inside_ a hung Backup zip.

## Map / docs

| Hypothesis                                                                                        | Killed by                          | Why it's dead                                                                           |
| ------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| Studio recently retargeted MD-9600 / OpenUV380 FLASH bases, so Read looks at the wrong addresses. | `S/git-offsets`                    | `OPENUV380_OFFSET` and `OPENUV380_FLASH_SPANS` unchanged since `b645be87` (2026-07-24). |
| Docs and code disagree on the programming-image bases.                                            | `S/git-offsets`; `S/memory-layout` | They still match 1:1.                                                                   |
| OpenUV380 FLASH map is wrong for MD-9600, which is why Read shows garbage names.                  | `R/2026-08-18-healthy-backup-scan` | Healthy Backup decodes bank 0, zones, contacts, and RX groups at documented bases.      |

## Hung zip bytes

| Hypothesis                                                                            | Killed by                  | Why it's dead                                                    |
| ------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| The hung zip holds a real codeplug at the wrong offset _within_ the downloaded spans. | `R/2026-08-18-tile-scan`   | 100% 32-byte FirmwareInfo tile; no channel-like ASCII.           |
| Inspect omits zones/contacts as a UI gap.                                             | `S/inspect-ui`; tile scan  | Those sections are listed; the bins had no names to show.        |
| FLASH `'R'` replies were 46-byte FirmwareInfo frames and `readMem` desynced.          | `S/readMem`                | Length-32 `expectedLength` would throw. Download finished.       |
| Zip reconstruct scrambled a good live image.                                          | `S/backup-live`; tile scan | Live inspect hydrates the download image. The bins are the tile. |
| Studio full-span Backup tiles ident even when this MD-9600 is healthy.                | healthy Backup scan        | `11:31Z` zip is a real codeplug; inspect displays correctly.     |

## Protocol / session (healthy vs hung)

| Hypothesis                                                                         | Killed by             | Why it's dead                                                                               |
| ---------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| After ident, MD-9600 codeplug at `0x3780` is on EEPROM and FLASH is empty/ident.   | `E/3`                 | Recovered FLASH and EEPROM both return the channel-bank window. Hung `E1` EEPROM was ident. |
| A healthy MD-9600 `'R'` at `0x3780` always returns the FirmwareInfo ident tile.    | `E/3`; healthy Backup | Bank window / real names.                                                                   |
| Sticky ident (mem `09h` then later `'R'`) is why hung probes returned ident tiles. | `E/3` run B           | After ident, FLASH @`0x3780` stayed the channel-bank window. Hang explains `E1`/`E2`.       |

## Not killed — do not treat as measured

| Claim                                           | Why it stays out of the killed table                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Need EEPROM mem `02h` for GD-77-class low banks | Healthy FLASH already holds the bank. Identical EEPROM bytes at `0x3780` (`E3`) are unexplained — not an adapter rewrite.        |
| Write offsets are wrong / Write would brick     | Not measured. Do not Restore the hung zip. Prod Write remains as [#788](https://github.com/pskillen/codeplug-studio/issues/788). |
| “Used to work” was CSV, not Web Serial          | Unconfirmed historically. Healthy serial Backup now works.                                                                       |

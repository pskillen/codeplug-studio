# RadioFoundry read-only Debug capture

What a RadioFoundry **Debug read** sends over the programming cable, how the frame guard gates the port, and what goes into the inspect-only backup archive. Product behaviour and the Debug UI are described in [Radio debug](../../../features/radio-debug/README.md).

## Allowed frames

Every host→radio frame during a Debug read passes through a guard. Each write must be **exactly one** valid debug-link frame (correct length and CRC). The guard admits only:

| Command            | Payload                                                      | Role                                              |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------- |
| CODEPLUG op 0 INFO | `[0x00]`                                                     | Required first; may repeat when the radio is busy |
| VERSION `0x02`     | empty                                                        | After INFO                                        |
| CODEPLUG op 1 SUMS | 6 bytes, count 1–16, every block in the run inside the image | After INFO                                        |
| CODEPLUG op 2 READ | 7 bytes, block inside the image                              | After INFO                                        |
| IDDB `0x1F`        | `00 00 00 00` (database id 0 only)                           | After INFO                                        |

Refused (non-exhaustive): PING, KEY, PTT, RADIO, READ_MEM, REBOOT, STORAGE (any op), CODEPLUG ops 3–10 (BEGIN through ABORT and unknown ops), SATELLITE, CPKV, IDDB with non-zero id, non-debug-link bytes (including OpenGD77 `R`/`W`/`X`/`C` and MMDVM `0xE0`), two frames in one write, bad CRC, truncated frames.

## Order and latch

The first allowed frame must be **INFO**. VERSION, SUMS, READ and IDDB are allowed only after an INFO has been sent. A refusal **latches**: later writes are refused and nothing reaches the port. After cancel, writes throw `RadioAbortedError`.

## Address rules

A block is inside the image when it is 4 KB aligned and either:

- wholly in the EEPROM image (`addr + 4096 ≤ 0x10000`), or
- in the flash image (`addr ≥ 0x20000` and `addr + 4096 ≤ ceiling`), or
- in DMR ID-database area 2 (`addr ≥ 0xD8000` and `addr + 4096 ≤ ceiling`).

The ceiling starts at the board’s `IMAGE_END` and may only be **lowered** to INFO’s image end after connect (`limitImageEnd`). The gap `0x10000–0x1FFFF` is never served.

**Area 2** (`0xD8000` …) is read only when the operator ticks “Also read the DMR ID database area 2” (see `RADIOFOUNDRY_DEBUG_AREA2_OPTION`). Blocks run to the lower of INFO’s and the board’s image end.

## Stages

Progress stages: **Connect** (INFO, VERSION, IDDB 0), **Codeplug** (served EEPROM + flash blocks via shared `readImageBlocks`), **ID database** (optional area 2).

SUMS pacing matches every other `readImageBlocks` caller (`RADIOFOUNDRY_SUMS_PAUSE_MS`, 50 ms between SUMS).

## Archive

`buildRadioFoundryDebugArchiveParts` produces manifest, regions and sidecars for `packRadioBackupZip`. Coverage is `partial`; every region is `inspect-only`.

| Region id      | Address   | Length                                                                                 |
| -------------- | --------- | -------------------------------------------------------------------------------------- |
| `eeprom-image` | `0x0`     | `0x10000`                                                                              |
| `flash-image`  | `0x20000` | `0x8EE60`                                                                              |
| `iddb-area2`   | `0xD8000` | through the last non-blank area-2 block (absent when area 2 was not read or all blank) |

| Sidecar             | Content                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `debug/info.bin`    | INFO body after status                                                        |
| `debug/version.txt` | VERSION text (UTF-8), when received                                           |
| `debug/iddb.bin`    | IDDB reply after status, when status was 0                                    |
| `debug/sums.bin`    | 9 bytes per block read (addr u32 LE, CRC u32 LE, blank u8), sorted by address |

The Debug read path is separate from cable **Write** ([cable-write.md](cable-write.md)); capture code must not call upload, write ops or STORAGE claim paths.

## Backup coverage

The Coverage panel classifies a RadioFoundry partial archive with `classifyRadioFoundryDebugCoverage` in `radiofoundry/debugCoverage.ts`. Per manifest region it counts **blocks read** (SUMS row with `blank = 0`) and **reported blank, not sent** (`blank = 1`) from `debug/sums.bin` (9-byte rows: address u32 LE, CRC u32 LE, blank u8). Area 2 is **not read** when no `iddb-area2` region and no SUMS rows from `0xD8000`; otherwise it reports the read end and blank blocks after it up to the capture ceiling from `debug/info.bin` (capped by the board `IMAGE_END`). The gap `0x10000–0x1FFFF` is always named as never served by the codeplug protocol.

## Overview identity rows

Rows on the debug Overview tab are built in `radiofoundry/debugIdentity.ts` from sidecars only:

| Row                     | Sidecar                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Firmware · read         | `debug/version.txt` (via `summariseRadioFoundryBuild`); without VERSION but with INFO: "INFO answered, VERSION not reported" |
| Board · VERSION         | `debug/version.txt` (`board=`)                                                                                               |
| Release · git · VERSION | `debug/version.txt` (`release`, `git`, `git_time`)                                                                           |
| Source · VERSION        | `debug/version.txt` (`source`, `repo`)                                                                                       |
| Features · VERSION      | `debug/version.txt` (`features`, `off`)                                                                                      |
| Protocol · INFO         | `debug/info.bin` (protocol version, flags)                                                                                   |
| Image · INFO            | `debug/info.bin` (EEPROM end, flash start, image end, physical base)                                                         |
| DMR ID database · IDDB  | `debug/iddb.bin` (format letter, record count)                                                                               |
| Serial                  | always "None reported"                                                                                                       |

## Hex secret masks

Inside the `eeprom-image` region (`integrations/radio-io/radios/radiofoundry/debugSensitive.ts`):

| What                       | Image offset            | Length       | Label                                                             |
| -------------------------- | ----------------------- | ------------ | ----------------------------------------------------------------- |
| CPS programming password   | `0x100`                 | 8            | Codeplug password                                                 |
| Boot PIN (BCD)             | `0x751C`                | 3            | Boot PIN                                                          |
| DTMF kill code             | `0x1408`                | 16           | DTMF kill code                                                    |
| DTMF wake code             | `0x1418`                | 16           | DTMF wake code                                                    |
| Settings-area system keys  | `0xE000` + entry offset | value length | `System secret 0x03xx`                                            |
| Settings-area traffic keys | `0xE000` + entry offset | value length | `Traffic key 0x19xx`                                              |
| Unreadable settings sector | `0xE000`                | `0x1000`     | Settings area (unreadable, masked whole)                          |
| Settings continuation      | `0xF000`                | `0x1000`     | Settings area continuation (when header bytes 12–15 are non-zero) |

Boot PIN enable at `0x7519` is shown plain. Device info, APRS and the ID database body are not masked.

## Settings tab (raw)

`radioFoundrySettingsView` reads the settings sector inside `eeprom-image` with `readRadioFoundrySettingsArea`. Each valid entry is one row: key as `Key 0xNNNN`, value as spaced hex, `address` at `0xE000 + offset`, `sensitive` when `isRadioFoundrySecretKey(key)`. `bad` and `newer` states are ambiguous; `empty` is OK with no rows.

## DMR ID database (Memory decode)

Area 1 starts at image offset `0x50000` inside `flash-image`, up to `0x40000` bytes. The 12-byte header opens with ASCII `Id`; format `N` (0x4E) uses 27-byte records (record-size byte `0x65`) sorted by ascending 3-byte little-endian DMR IDs with 24 bytes of packed text. Records that do not fit in area 1 continue at image `0xD8000` in the optional `iddb-area2` region when the operator ticked area 2 on read.

Format `n` (0x6E) stores area 2 in the voice-prompt area at image `0xAF400`. This capture path does not read that region; Memory surfaces the header only.

Format `C` uses a different layout; Memory shows the header bytes only (F3).

The radio accepts the database when the header record count ends inside the capture ceiling (`debug/info.bin` image end, capped by the board `IMAGE_END`). `debug/iddb.bin` carries the radio's own format letter and record count after IDDB(0).

`radioFoundryIdDatabaseView` in `integrations/radio-io/radios/radiofoundry/debugIdDatabase.ts` decodes captured format `N` records only, checks ascending order across area 1 and area 2, counts blank records the header claims among captured bytes, and supports lookup by DMR ID over captured records only.

## Compare

`radioFoundryCompareAdapter` compares `eeprom-image` and `flash-image` when both archives share the model id and region layout. `iddb-area2` is `reported` only (length may differ). Sidecars `debug/info.bin`, `debug/version.txt` and `debug/iddb.bin` are additional `reported` sections at base 0. Sensitive bytes use `radioFoundryArchiveSensitiveRanges` on `eeprom-image`.

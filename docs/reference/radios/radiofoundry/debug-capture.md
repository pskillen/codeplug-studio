# RadioFoundry read-only Debug capture

What a RadioFoundry **Debug read** sends over the programming cable, how the frame guard gates the port, and what goes into the inspect-only backup archive. Product behaviour and the Debug UI are described in [Radio debug](../../../features/radio-debug/README.md).

## Allowed frames

Every host→radio frame during a Debug read passes through a guard. Each write must be **exactly one** valid debug-link frame (correct length and CRC). The guard admits only:

| Command | Payload | Role |
| --- | --- | --- |
| CODEPLUG op 0 INFO | `[0x00]` | Required first; may repeat when the radio is busy |
| VERSION `0x02` | empty | After INFO |
| CODEPLUG op 1 SUMS | 6 bytes, count 1–16, every block in the run inside the image | After INFO |
| CODEPLUG op 2 READ | 7 bytes, block inside the image | After INFO |
| IDDB `0x1F` | `00 00 00 00` (database id 0 only) | After INFO |

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

| Region id | Address | Length |
| --- | --- | --- |
| `eeprom-image` | `0x0` | `0x10000` |
| `flash-image` | `0x20000` | `0x8EE60` |
| `iddb-area2` | `0xD8000` | through the last non-blank area-2 block (absent when area 2 was not read or all blank) |

| Sidecar | Content |
| --- | --- |
| `debug/info.bin` | INFO body after status |
| `debug/version.txt` | VERSION text (UTF-8), when received |
| `debug/iddb.bin` | IDDB reply after status, when status was 0 |
| `debug/sums.bin` | 9 bytes per block read (addr u32 LE, CRC u32 LE, blank u8), sorted by address |

The Debug read path is separate from cable **Write** ([cable-write.md](cable-write.md)); capture code must not call upload, write ops or STORAGE claim paths.
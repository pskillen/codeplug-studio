# RadioFoundry storage claim (debug link)

Danger-zone operation **STORAGE op 2 CLAIM** on firmware **454a5b76** and later. Studio sends it only from the **Unlock settings storage** wizard; generic write refuses while the region is **foreign** ([cable-write.md](cable-write.md)).

## Commands Studio may send during claim

| Command | Payload | Reply (status 0) | Notes |
| --- | --- | --- | --- |
| VERSION `0x02` | empty | `0` + key=value text | `board=` must match the build's board names |
| INFO_CHIP `0x0B` | empty | ≥ 28 data bytes | Token = `uid0` u32 @ offset 6 in data |
| STORAGE `0x0F` op 0 INFO | `00` | 26 data bytes | Region 0 none, 1 ours, 2 foreign |
| STORAGE op 1 READ | `01 \| addr u32 LE \| len u16 LE` (7 bytes) | echoed addr + `len` bytes | `len` 1..1000; READ timeout ~5 s |
| STORAGE op 2 CLAIM | `02 \| token u32 LE` (5 bytes) | reason `00` | Exactly one CLAIM per wizard session |

Status bytes follow [debug link](../../export-formats/radiofoundry/README.md): 4 = unavailable (no map), 7 = refused. CLAIM checks token before region; wrong token → 7/1, not foreign → status 4.

## Per-board ranges (INFO op 0)

| Board | Settings | Journal | Calibration copy |
| --- | --- | --- | --- |
| DM-1701 / RT84 | `0x011000` + `0x8000` | `0x019000` + `0x2000` | `0x010000` + `0x200` |
| MD-9600 / RT90 | `0x011000` + `0x8000` | `0x019000` + `0x2000` | (size 0) |
| DM-32UV | `0x711000` + `0x8000` | `0x719000` + `0x2000` | (size 0) |

Journal size in INFO is always **0x2000** (two 4 KB sectors), not read from the map.

## Token

From **INFO_CHIP** on the cable in the backup step. DM-32UV needs RadioFoundry from **2026-10-22** (INFO_CHIP on HR_C7000); older builds answer status 4 and Studio refuses before CLAIM.

## Erase scope and success

On OK the firmware erases **10 × 4 KB** (settings ring + journal), about 4 s. Calibration and the codeplug image are not touched. **There is no restore path** through Studio or RadioFoundry; the backup zip is for returning to stock with vendor tools.

Success is **only** `region == ours` on a later STORAGE INFO. During erase, INFO may still show `foreign, pending 0`.

Code: `src/integrations/radio-io/radios/radiofoundry/storageClaim/`, product rules in `src/core/radios/radiofoundry/storageClaim.ts`.
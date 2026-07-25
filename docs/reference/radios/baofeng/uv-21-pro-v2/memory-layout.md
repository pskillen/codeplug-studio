# UV-21Pro V2 — memory layout

Multi-region clone image for **PROGRAM + R/W** (UV-17Pro family). Assembled image size `MEM_TOTAL = 0x8380`.

**Hub:** [README.md](README.md) · **Records:** [channel-record.md](channel-record.md) · **Protocol:** [protocol.md](protocol.md)

> Classic **UV-5R** uses **S/X** at 9600 baud with a different image size — do **not** merge that path into this map.

## Transfer sizes

| Constant        | Value       | Role                                                 |
| --------------- | ----------- | ---------------------------------------------------- |
| Block size      | `0x40` (64) | Read/write quantum                                   |
| Channel record  | `32`        | See [channel-record.md](channel-record.md)           |
| Channel count   | `1000`      | Channels occupy first `0x7D00` bytes of packed image |
| Assembled image | `0x8380`    | Concatenation of four radio regions                  |

## Radio regions (`MEM_STARTS` / `MEM_SIZES`)

CHIRP `UV17Pro` / `UV21ProV2`:

| Index | Radio address | Size     | Notes                                               |
| ----- | ------------- | -------- | --------------------------------------------------- |
| 0     | `0x0000`      | `0x8040` | Channels + mid-image VFO/settings area              |
| 1     | `0x9000`      | `0x0040` | Second region (packed after first)                  |
| 2     | `0xA000`      | `0x02C0` | Third region (ANI / PTT / codes — larger than Mini) |
| 3     | `0xD000`      | `0x0040` | Fourth region                                       |

Cite: CHIRP `baofeng_uv17Pro.py` `UV17Pro` / `UV21ProV2`.

## Packed image ↔ radio address map

Clone download concatenates the four regions in order into one buffer:

| Packed image offset | Size     | Radio address |
| ------------------- | -------- | ------------- |
| `0x0000`            | `0x8040` | `0x0000`      |
| `0x8040`            | `0x0040` | `0x9000`      |
| `0x8080`            | `0x02C0` | `0xA000`      |
| `0x8340`            | `0x0040` | `0xD000`      |

Sum: `0x8040 + 0x40 + 0x2C0 + 0x40 = 0x8380`.

## Notable packed-image offsets

| Offset     | Size / role                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x0000` … | Channel records (`1000 × 32 = 0x7D00`)                                                                                                          |
| `0x1EF0`   | Firmware version string (`_fw_ver_start`) — **overlays channel span**; preserved via Read hydration unless a channel Write overwrites that slot |
| `0x8000`   | VFO A (32 bytes)                                                                                                                                |
| `0x8020`   | VFO B (32 bytes)                                                                                                                                |
| `0x8040`   | Settings (64 bytes) — see [settings.md](settings.md)                                                                                            |
| `0x8080`   | ANI (`_mem_params.ani`)                                                                                                                         |
| `0x80A0`   | PTT ID (`_mem_params.pttid`)                                                                                                                    |
| `0x81E0`   | Upcode                                                                                                                                          |
| `0x8210`   | Downcode                                                                                                                                        |
| `0x8220`   | Modes / end-format area (CHIRP `_end_fmt` seeks here)                                                                                           |
| `0x8280`   | Name bank (`_mem_params.names`) — CHIRP bank-name support (not modelled in Studio v1)                                                           |
| `0x8340` … | Fourth `MEM_*` region (radio `0xD000`) — retain on Write                                                                                        |

**Address caveat:** Packed image offset `0x8040` is radio address **`0x9000`** (second `MEM_*` region). Studio uses full-image hydrated upload with the correct packed ↔ radio map — see [settings.md](settings.md).

## Differences vs UV-5R Mini

| Item         | UV-21Pro V2           | UV-5R Mini           |
| ------------ | --------------------- | -------------------- |
| `MEM_TOTAL`  | `0x8380`              | `0x8240`             |
| Regions      | 4 (`+ 0xD000`)        | 3                    |
| Channel span | `0x7D00` (1000 slots) | `0x7CE0` (999 slots) |
| Third region | `0x02C0` @ `0xA000`   | `0x01C0` @ `0xA000`  |
| Ident        | `PROGRAMBFNORMALU`    | `PROGRAMCOLORPROU`   |

Channel record geometry (32 bytes) and wide-bit polarity match the UV-17Pro family — see [channel-record.md](channel-record.md).

## Verification

Cross-checked against:

| Fact set                       | Source                                               |
| ------------------------------ | ---------------------------------------------------- |
| `MEM_*`, block size, FW offset | CHIRP `chirp/drivers/baofeng_uv17Pro.py` (`UV17Pro`) |
| `UV21ProV2` caps               | Same parent class — bands + AM only                  |

A live radio dump is optional for docs; see [fixtures.md](fixtures.md).

## Related

- [channel-record.md](channel-record.md) · [settings.md](settings.md) · [protocol.md](protocol.md)
- [limits.md](limits.md) · [power.md](power.md)
- Sibling: [UV-5R Mini memory layout](../uv-5r-mini/memory-layout.md)

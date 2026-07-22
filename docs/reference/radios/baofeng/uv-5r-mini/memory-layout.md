# UV-5R Mini — memory layout

Multi-region clone image for **PROGRAM + R/W** (UV-17Pro family). Assembled image size `MEM_TOTAL = 0x8240`.

**Hub:** [README.md](README.md) · **Records:** [channel-record.md](channel-record.md) · **Protocol:** [protocol.md](protocol.md)

> Classic **UV-5R** uses **S/X** at 9600 baud with a different image size — do **not** merge that path into this map.

## Transfer sizes

| Constant | Value | Role |
| -------- | ----- | ---- |
| Block size | `0x40` (64) | Read/write quantum |
| Channel record | `32` | See [channel-record.md](channel-record.md) |
| Channel count | `999` | Channels occupy first `0x7CE0` bytes of packed image |
| Assembled image | `0x8240` | Concatenation of three radio regions |

## Radio regions (`MEM_STARTS` / `MEM_SIZES`)

Identical in NeonPlug and CHIRP `UV5RMini`:

| Index | Radio address | Size | Notes |
| ----- | ------------- | ---- | ----- |
| 0 | `0x0000` | `0x8040` | Channels + mid-image VFO/settings area |
| 1 | `0x9000` | `0x0040` | Second region (packed after first) |
| 2 | `0xA000` | `0x01C0` | Third region (ANI / PTT / codes area in packed map) |

Cite: NeonPlug `constants.ts`; CHIRP `baofeng_uv17Pro.py` `UV5RMini`.

## Packed image ↔ radio address map

Clone download concatenates the three regions in order into one buffer:

| Packed image offset | Size | Radio address |
| ------------------- | ---- | ------------- |
| `0x0000` | `0x8040` | `0x0000` |
| `0x8040` | `0x0040` | `0x9000` |
| `0x8080` | `0x01C0` | `0xA000` |

Sum: `0x8040 + 0x40 + 0x1C0 = 0x8240`.

## Notable packed-image offsets

| Offset | Size / role |
| ------ | ----------- |
| `0x0000` … | Channel records (`999 × 32 = 0x7CE0`) |
| `0x1EF0` | Firmware version string (`_fw_ver_start`) |
| `0x8000` | VFO A (32 bytes) — NeonPlug / CHIRP-aligned comment |
| `0x8020` | VFO B (32 bytes) |
| `0x8040` | Settings (64 bytes) — see [settings.md](settings.md) |
| `0x8080` | ANI |
| `0x80A0` | PTT ID |
| `0x81E0` | Upcode |
| `0x8210` | Downcode |
| `0x8220` | Modes / end-format area (CHIRP `_end_fmt` seeks here; 32 B) |

**Address caveat:** Packed image offset `0x8040` is radio address **`0x9000`** (second `MEM_*` region). NeonPlug settings **parse** uses packed `0x8040`; settings **write** currently uses radio addr `0x8040` — treat as verify-on-hardware debt for adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617). See [settings.md](settings.md).

## Not classic UV-5R (S/X)

| Item | UV-5R Mini (this doc) | Classic UV-5R |
| ---- | --------------------- | ------------- |
| Protocol | PROGRAM + R/W (`0x52` / `0x57`) | S/X blocks |
| Ident | `PROGRAMCOLORPROU` | Model-specific UV5R idents |
| Baud | NeonPlug 38400 / CHIRP 115200 | 9600 |
| Image | `0x8240`, multi-region | `~0x1808`, different ranges |
| Channels / name | 999 / 12 chars | Classic layout; name length 7 |
| Wide bit | `1` → NFM | `1` → FM (opposite polarity) |

## Verification

Cross-checked against:

| Fact set | Source |
| -------- | ------ |
| `MEM_*`, block size, FW offset | NeonPlug `src/radios/uv5rmini/constants.ts` |
| Same `MEM_*` | CHIRP `chirp/drivers/baofeng_uv17Pro.py` (`UV5RMini`) |
| Packed settings layout comment | NeonPlug `settingsFormat.ts` |

A live radio dump is optional for this doc ticket; see [fixtures.md](fixtures.md).

## Related

- [channel-record.md](channel-record.md) · [settings.md](settings.md) · [protocol.md](protocol.md)
- [limits.md](limits.md) · [power.md](power.md)

# RT95 VOX — memory layout

Contiguous clone image for **PROGRAM→QX** (AnyTone 778UV family). Assembled image size **`0x32A0`** bytes (`0x0000` … last block at `0x3290`).

**Hub:** [README.md](README.md) · **Records:** [channel-record.md](channel-record.md) · **Protocol:** [protocol.md](protocol.md)

> UV-5R Mini multi-region packed `0x8240` does **not** apply here. Do not reuse Mini region packing.

## Transfer sizes

| Constant        | Value             | Role                                       |
| --------------- | ----------------- | ------------------------------------------ |
| Block size      | `0x10` (16)       | Read/write quantum                         |
| Address range   | `0x0000`–`0x3290` | Inclusive start of last block              |
| Assembled image | `0x32A0`          | `(0x3290 / 0x10 + 1) × 0x10`               |
| Channel record  | `32`              | See [channel-record.md](channel-record.md) |
| Channel count   | `200`             | Slots 1–200                                |

## Region table (image offsets)

Offsets are **radio addresses** and packed-image offsets (1:1 — contiguous map).

| Offset   | Size / end            | Role                                                                 |
| -------- | --------------------- | -------------------------------------------------------------------- |
| `0x0000` | `200 × 32` = `0x1900` | Channel records — [channel-record.md](channel-record.md)             |
| `0x1940` | 64 bytes              | Memory status: occupied bitfield (32) + scan-enabled bitfield (32)   |
| `0x1980` | 7 bytes               | Starting display line                                                |
| `0x1990` | `16 × 16`             | PTT-ID encode slots M1–M16                                           |
| `0x1A90` | …                     | DTMF / remote stun-kill / self-ID block — [settings.md](settings.md) |
| `0x3200` | …                     | Radio `settings` (beep, squelch, VOX, keys PA–PD, …)                 |
| `0x3240` | 6 bytes               | Power-on password digits                                             |
| `0x3250` | 12 bytes              | PF key mode 1/2 bindings (P1–P6 × 2)                                 |
| `0x3260` | …                     | `radio_settings` (MR A/B, VFO/MR flags, **bandlimit** at `0x326D`)   |

Gap between DTMF (`0x1A90` region) and `0x3200` is present in the image but sparsely documented in CHIRP — preserve on RMW uploads.

## Channel bank

| Item            | Value                                       |
| --------------- | ------------------------------------------- |
| First channel   | Image offset `0x0000` (memory number **1**) |
| Record stride   | 32 bytes                                    |
| Last channel    | Offset `0x0000 + 199×32 = 0x18E0`           |
| Occupancy       | Bit in `occupied_bitfield` at `0x1940`      |
| Scan membership | Bit in `scan_enabled_bitfield` at `0x1960`  |

Bitfield indexing: memory _n_ (1-based) → bit `(n - 1)` in the 32-byte field (byte `i // 8`, bit `i % 8`).

## Bandlimit

| Location           | Role                                    |
| ------------------ | --------------------------------------- |
| Version reply byte | Live radio band table index (handshake) |
| Image `0x326D`     | Stored bandlimit in `radio_settings`    |

CHIRP band tables (Hz, VHF then UHF):

| Index  | VHF         | UHF         |
| ------ | ----------- | ----------- |
| `0x00` | 144–148 MHz | 430–440 MHz |
| `0x01` | 136–174 MHz | 400–490 MHz |
| `0x02` | 144–146 MHz | 430–440 MHz |

Unknown index → treat as `0x01` (most permissive) with a warning. Upload should warn when image bandlimit ≠ radio version bandlimit — radio may refuse TX out of band.

## Verification

Cross-checked against:

| Fact set                           | Source                  |
| ---------------------------------- | ----------------------- |
| `MEMORY_ADDRESS_RANGE`, block size | CHIRP `anytone778uv.py` |
| `MEM_FORMAT` seeks / structs       | CHIRP `anytone778uv.py` |
| VOX name length / allow-list       | CHIRP `RetevisRT95vox`  |

A live radio dump is optional for this doc ticket; see [fixtures.md](fixtures.md).

## Related

- [channel-record.md](channel-record.md) · [settings.md](settings.md) · [protocol.md](protocol.md)
- [limits.md](limits.md) · [power.md](power.md)

# UV-5R Mini — channel record

32-byte channel element used in the PROGRAM+R/W clone image (UV-17Pro family). Shared by NeonPlug and CHIRP `UV5RMini`.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `channelFormat.ts`; CHIRP `baofeng_uv17Pro.py` memory object (facts only — no GPL paste).

## Geometry

| Fact | Value |
| ---- | ----- |
| Record size | `32` bytes |
| Count | `999` |
| Span in packed image | `0x7CE0` from `0x0000` |
| Empty sentinel | first byte `0xFF` (NeonPlug); CHIRP fills empty slots with `0xFF × 32` |
| Name length | 12 ASCII |

There is **no** separate channel-count field in the image — occupancy is per-slot empty markers.

## Field offsets

| Offset | Field | Encoding / notes |
| ------ | ----- | ---------------- |
| `0–3` | RX frequency | Little-endian BCD; value × 10 → Hz |
| `4–7` | TX frequency | Same; duplex off → all `0xFF` |
| `8–9` | RX tone | `u16` LE; `0` / `0xFFFF` = none; `≥ 0x258` = CTCSS × 10; else DTCS index |
| `10–11` | TX tone | Same |
| `12` | `scode` | CHIRP; NeonPlug often writes `1` |
| `13` | `pttid` | CHIRP |
| `14` bits 0–1 | `lowpower` | `0` = High; non-zero → Low (see [power.md](power.md)) |
| `14` | other bitfields | CHIRP `scramble` etc.; NeonPlug largely ignores on decode |
| `15` bit 6 | `wide` | **Polarity:** `1` = NFM, `0` = FM (inverted vs classic UV-5R) |
| `15` other | `sqmode`, `bcl`, `scan`, `fhss` | CHIRP extras; NeonPlug decode focuses on wide bit |
| `16–19` | unknown | CHIRP reserved |
| `20–31` | name | 12 chars; stop at `0x00` / `0xFF` |

## Power

| Wire (`lowpower`) | Meaning | Typical RF |
| ----------------- | ------- | ---------- |
| `0` | High | 5 W |
| non-zero | Low | 1 W |

Internal library % mapping for file adapters: [power.md](power.md).

## Mode (bandwidth)

| `wide` bit | Meaning |
| ---------- | ------- |
| `0` | FM (wide) |
| `1` | NFM (narrow) |

Do not copy classic UV-5R wide-bit polarity into this codec.

## Related

- [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- CSV naming cross-check only: [export-formats/chirp/channels.md](../../../export-formats/chirp/channels.md)

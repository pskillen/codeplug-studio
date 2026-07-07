# Retevis RT95 VOX — CHIRP profile

**Profile id:** `chirp-rt95`  
**Fixture:** `formats/chirp/__fixtures__/export/Retevis_RT95 VOX_20251106.csv`  
**Max RF:** 25 W

## Limits

| Constraint       | Value |
| ---------------- | ----- |
| Max memory slots | 128   |
| Channel name     | 16    |

## Power ladder (wire → percent)

Percent = watts ÷ 25 W max. `null` internal percent exports as high (`25W`).

| Wire  | Watts | Percent |
| ----- | ----- | ------- |
| `25W` | 25 W  | 100     |
| `10W` | 10 W  | 40      |

## Related

- [Profile index](README.md)
- [channels.md](../channels.md)

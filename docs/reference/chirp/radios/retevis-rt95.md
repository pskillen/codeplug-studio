# Retevis RT95 VOX — CHIRP profile

**Profile id:** `retevis-rt95`  
**Fixture:** `test-data/chirp/20260629/retevis-rt95/Retevis_RT95 VOX_20251106.csv`  
**Max RF:** 25 W

## Limits

| Constraint | Value |
| --- | --- |
| Max memory slots | 128 |

## Power ladder (wire → percent)

Percent = watts ÷ 25 W max. `null` internal percent exports as high (`25W`).

| Wire | Watts | Percent |
| --- | --- | --- |
| `25W` | 25 W | 100 |
| `10W` | 10 W | 40 |

## Related

- [Profile index](README.md)
- [channels.md](../channels.md)

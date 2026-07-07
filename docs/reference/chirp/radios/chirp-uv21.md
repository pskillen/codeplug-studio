# Baofeng UV-21Pro V2 — CHIRP profile

**Profile id:** `chirp-uv21`  
**Fixture:** `formats/chirp/__fixtures__/export/Baofeng_UV-21ProV2_20251129.csv`  
**Max RF:** 6 W

## Limits

| Constraint       | Value |
| ---------------- | ----- |
| Max memory slots | 128   |
| Channel name     | 16    |

## Power ladder (wire → percent)

Percent = watts ÷ 6 W max. `null` internal percent exports as high (`5.0W`).

| Wire   | Watts | Percent |
| ------ | ----- | ------- |
| `5.0W` | 5 W   | 83      |
| `1.0W` | 1 W   | 17      |

## Related

- [Profile index](README.md)
- [channels.md](../channels.md)

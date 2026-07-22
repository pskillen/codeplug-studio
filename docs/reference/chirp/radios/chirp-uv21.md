# Baofeng UV-21Pro V2 — CHIRP profile

**Profile id:** `chirp-uv21`  
**Fixture:** `formats/chirp/__fixtures__/export/Baofeng_UV-21ProV2_20251129.csv`  
**Max RF:** 5 W (CHIRP High)  
**CHIRP driver:** `UV21ProV2` in `baofeng_uv17Pro.py` (inherits UV17Pro `CHANNELS` / `LENGTH_NAME` / power)

## Limits

| Constraint       | Value | Source |
| ---------------- | ----- | ------ |
| Max memory slots | 1000  | UV17Pro `CHANNELS` |
| Channel name     | 12    | UV17Pro `LENGTH_NAME` |

## Power ladder (wire → percent)

Matches UV-17Pro / UV-5R Mini High 5 W / Low 1 W. Studio exports Generic CSV **watt** strings (`5.0W` / `1.0W`). `null` internal percent exports as high.

| Wire   | Watts | Percent |
| ------ | ----- | ------- |
| `5.0W` | 5 W   | 100     |
| `1.0W` | 1 W   | 20      |

## Wire verification

`cps-verify` profile `chirp-uv21` — see [enum-verification.md](../enum-verification.md).

## Related

- [Profile index](README.md)
- [channels.md](../channels.md)
- [enum-verification.md](../enum-verification.md)

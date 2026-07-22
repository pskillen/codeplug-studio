# Retevis RT95 VOX — CHIRP profile

**Profile id:** `chirp-rt95`  
**Fixture:** `formats/chirp/__fixtures__/export/Retevis_RT95 VOX_20251106.csv`  
**Max RF:** ~25 W (CHIRP High ≈ 44 dBm)  
**CHIRP driver:** `RetevisRT95vox` in `anytone778uv.py`

## Limits

| Constraint       | Value | Source |
| ---------------- | ----- | ------ |
| Max memory slots | 200   | `memory_bounds=(1, 200)` |
| Channel name     | 6     | `NAME_LENGTH` on `AnyTone778UVvoxBase` |

## Power ladder (wire → percent)

CHIRP radio driver labels are Low / Medium / High (~5 / 10 / 25 W). Studio exports Generic CSV **watt** strings for interchange (`parse_power`). `null` → high (`25W`).

| Wire   | Watts | Percent | CHIRP label |
| ------ | ----- | ------- | ----------- |
| `25W`  | 25 W  | 100     | High        |
| `10W`  | 10 W  | 40      | Medium      |
| `5.0W` | 5 W   | 20      | Low         |

## Wire verification

`cps-verify` profile `chirp-rt95` — see [enum-verification.md](../enum-verification.md).

## Related

- [Profile index](README.md)
- [channels.md](../channels.md)
- [enum-verification.md](../enum-verification.md)

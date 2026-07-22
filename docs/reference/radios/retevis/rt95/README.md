# Retevis RT95 VOX

Mobile / base analogue FM/AM radio. Studio targets it via CHIRP CSV (`RetevisRT95vox`).

| | |
| --- | --- |
| **Manufacturer** | Retevis |
| **Model** | RT95 VOX |
| **Aliases** | RT95 |
| **Max RF** | ~25 W (CHIRP High ≈ 44 dBm) |
| **CHIRP driver** | `RetevisRT95vox` in `anytone778uv.py` |

## Studio profile ids

| Adapter | `profileId` | Notes |
| --- | --- | --- |
| CHIRP CSV | `chirp-rt95` | Generic CSV watt strings; 6-char names, 200 slots |

## Documentation map

| Doc | Contents |
| --- | --- |
| [limits.md](limits.md) | Memory slots, name length |
| [capabilities.md](capabilities.md) | Modes, organisation traits |
| [power.md](power.md) | High / Medium / Low ladder (internal %) |

## Adapter wire

- [CHIRP export-format](../../../export-formats/chirp/README.md) — column mapping / verification

## Ground truth

| Source | Role |
| --- | --- |
| Fixture `formats/chirp/__fixtures__/export/Retevis_RT95 VOX_20251106.csv` | Export shape |
| CHIRP `RetevisRT95vox` (`memory_bounds=(1, 200)`, `NAME_LENGTH=6`) | Caps |

## Related

- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · extract [#621](https://github.com/pskillen/codeplug-studio/issues/621)

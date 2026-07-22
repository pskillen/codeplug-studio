# Retevis RT95 VOX — CHIRP profile

**Profile id:** `chirp-rt95`  
**Fixture:** `formats/chirp/__fixtures__/export/Retevis_RT95 VOX_20251106.csv`  
**Max RF:** ~25 W (CHIRP High ≈ 44 dBm)  
**CHIRP driver:** `RetevisRT95vox` in `anytone778uv.py`

CSV export is **first-class** — same shared CHIRP pathway as UV-5R Mini (`exportBuildSingleFile` → `serialiseChirpCsv`). The sharp edges vs UV-5R are **6-char** names and **200** memory slots.

## Limits

| Constraint       | Value   | Export behaviour                                                         |
| ---------------- | ------- | ------------------------------------------------------------------------ |
| Max memory slots | 200     | Warn when channel count exceeds; truncate lowest-priority rows if forced |
| Channel name     | 6 chars | Name shortening at export boundary (tightest CHIRP profile in Studio)    |
| Modes            | NFM, AM | Skip non-FM/AM internal modes with warning                               |

Flat-memory CHIRP profiles do **not** use zones, scan lists, contacts, talk groups, or RX group lists. Radio characteristics marks those rows as not used (`getProfileExportLimits`).

## Wire verification

`cps-verify` profile `chirp-rt95` enforces the memory-slot and name-length caps above, plus LF / selective quoting / exact headers documented in [CHIRP README — Wire verification](../README.md#wire-verification). Caps match CHIRP `RetevisRT95vox` (`memory_bounds=(1, 200)`, `NAME_LENGTH=6`) — see [enum-verification.md](../enum-verification.md).

## Power ladder (wire → percent)

CHIRP radio driver labels are Low / Medium / High (~5 / 10 / 25 W). Studio exports Generic CSV **watt** strings for interchange (`parse_power`) — not radio labels. `null` → high (`25W`).

| Wire   | Watts | Percent | CHIRP label |
| ------ | ----- | ------- | ----------- |
| `25W`  | 25 W  | 100     | High        |
| `10W`  | 10 W  | 40      | Medium      |
| `5.0W` | 5 W   | 20      | Low         |

## Filename convention

`Retevis_RT95 VOX_{YYYYMMDD}.csv`

## Related

- [Profile index](README.md)
- [channels.md](../channels.md)
- [enum-verification.md](../enum-verification.md)

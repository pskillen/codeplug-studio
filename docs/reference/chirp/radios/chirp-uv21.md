# Baofeng UV-21Pro V2 — CHIRP profile

**Profile id:** `chirp-uv21`  
**Fixture:** `formats/chirp/__fixtures__/export/Baofeng_UV-21ProV2_20251129.csv`  
**Max RF:** 5 W (CHIRP High)  
**CHIRP driver:** `UV21ProV2` in `baofeng_uv17Pro.py` (inherits UV17Pro `CHANNELS` / `LENGTH_NAME` / power)

CSV export is **first-class** — same shared CHIRP pathway as UV-5R Mini (`exportBuildSingleFile` → `serialiseChirpCsv`).

## Limits

| Constraint       | Value    | Export behaviour                                                         |
| ---------------- | -------- | ------------------------------------------------------------------------ |
| Max memory slots | 1000     | Warn when channel count exceeds; truncate lowest-priority rows if forced |
| Channel name     | 12 chars | Name shortening at export boundary                                       |
| Modes            | NFM, AM  | Skip non-FM/AM internal modes with warning                               |

Flat-memory CHIRP profiles do **not** use zones, scan lists, contacts, talk groups, or RX group lists. Radio characteristics marks those rows as not used (`getProfileExportLimits`).

## Wire verification

`cps-verify` profile `chirp-uv21` enforces the memory-slot and name-length caps above, plus LF / selective quoting / exact headers documented in [CHIRP README — Wire verification](../README.md#wire-verification). Caps match CHIRP `UV21ProV2` / UV17Pro (`CHANNELS=1000`, `LENGTH_NAME=12`) — see [enum-verification.md](../enum-verification.md).

## Power ladder (wire → percent)

Matches UV-17Pro / UV-5R Mini High 5 W / Low 1 W. Studio exports Generic CSV **watt** strings. `null` internal percent exports as high (`5.0W`).

| Wire   | Watts | Percent |
| ------ | ----- | ------- |
| `5.0W` | 5 W   | 100     |
| `1.0W` | 1 W   | 20      |

## Filename convention

`Baofeng_UV-21ProV2_{YYYYMMDD}.csv`

## Related

- [Profile index](README.md)
- [channels.md](../channels.md)
- [enum-verification.md](../enum-verification.md)

# Baofeng UV-5R Mini — CHIRP profile

**Profile id:** `baofeng-uv5r-mini`  
**Fixture:** `test-data/chirp/20260629/baofeng-uv5r-mini/Baofeng_UV-5R Mini_20251129.csv`  
**Max RF:** 5 W

## Limits

| Constraint | Value | Export behaviour |
| --- | --- | --- |
| Max memory slots | 128 | Warn when channel count exceeds; truncate lowest-priority rows if forced |
| Modes | NFM, AM | Skip non-FM/AM internal modes with warning |

## Power ladder (wire → percent)

Percent = watts ÷ 5 W max. `null` internal percent exports as high (`5.0W`).

| Wire | Watts | Percent |
| --- | --- | --- |
| `5.0W` | 5 W | 100 |
| `1.0W` | 1 W | 20 |

## Filename convention

`Baofeng_UV-5R Mini_{YYYYMMDD}.csv`

## Related

- [Profile index](README.md)
- [channels.md](../channels.md)
